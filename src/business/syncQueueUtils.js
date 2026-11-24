/**
 * Pure helpers for durable offline/pending sync queue persistence,
 * mutation coalescing, non-destructive onSnapshot overlay, and OCC version tracking.
 */

export const PENDING_SYNC_STORAGE_PREFIX = 'progilic_pending_sync_';

const RETRYABLE_SYNC_CODES = new Set([
  'network-offline',
  'firestore_timeout',
  'unavailable',
  'deadline-exceeded',
  'aborted',
  'cancelled'
]);

const NON_RETRYABLE_SYNC_CODES = new Set([
  'quota-exceeded',
  'resource-exhausted',
  'permission-denied',
  'unauthenticated',
  'version-conflict',
  'invalid-argument',
  'failed-precondition',
  'not-found'
]);

export function getPendingSyncStorageKey(uid) {
  return `${PENDING_SYNC_STORAGE_PREFIX}${String(uid || 'anonymous').trim()}`;
}

export function isQueueableSyncError(error, classification = null) {
  const code = String(classification?.code || error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();

  if (code === 'version-conflict' || msg === 'version_conflict') return false;
  if (NON_RETRYABLE_SYNC_CODES.has(code)) return false;
  if (code.includes('permission') || code.includes('quota') || code.includes('resource-exhausted')) {
    return false;
  }

  if (RETRYABLE_SYNC_CODES.has(code)) return true;
  if (msg.includes('offline') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout')) {
    return true;
  }
  return false;
}

export function extractMutationClientId(item) {
  if (!item || !item.payload) return null;
  const p = item.payload;
  const raw = p.clientId !== undefined ? p.clientId : p.clientData?.id;
  if (raw === undefined || raw === null || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : String(raw);
}

export function getPendingClientIds(queue = [], inFlightSet = null) {
  const ids = new Set();
  if (Array.isArray(queue)) {
    for (const item of queue) {
      const cid = extractMutationClientId(item);
      if (cid !== null) ids.add(String(cid));
    }
  }
  if (inFlightSet && typeof inFlightSet[Symbol.iterator] === 'function') {
    for (const cid of inFlightSet) {
      if (cid !== undefined && cid !== null && cid !== '') {
        ids.add(String(cid));
      }
    }
  }
  return ids;
}

/**
 * Merges a new mutation into the ordered pending queue without losing prior
 * baseVersion or earlier sub-item/client edits.
 */
export function coalescePendingMutation(queue = [], mutation) {
  const list = Array.isArray(queue) ? queue.map(item => ({ ...item, payload: { ...(item.payload || {}) } })) : [];
  if (!mutation || !mutation.type) return list;

  const targetCid = extractMutationClientId(mutation);
  const itemToPush = {
    ...mutation,
    id: mutation.id || `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: mutation.queuedAt || new Date().toISOString(),
    payload: { ...(mutation.payload || {}) }
  };

  if (targetCid === null) {
    list.push(itemToPush);
    return list;
  }

  const cidStr = String(targetCid);

  if (itemToPush.type === 'UPDATE_CLIENT') {
    const addIdx = list.findIndex(
      x => x.type === 'ADD_CLIENT' && String(extractMutationClientId(x)) === cidStr
    );
    if (addIdx > -1) {
      list[addIdx].payload.clientData = {
        ...(list[addIdx].payload.clientData || {}),
        ...(itemToPush.payload.clientData || {})
      };
      list[addIdx].queuedAt = itemToPush.queuedAt;
      return list;
    }

    const updIdx = list.findIndex(
      x => x.type === 'UPDATE_CLIENT' && String(extractMutationClientId(x)) === cidStr
    );
    if (updIdx > -1) {
      const existing = list[updIdx];
      list[updIdx] = {
        ...itemToPush,
        id: existing.id,
        payload: {
          ...existing.payload,
          ...itemToPush.payload,
          // Always keep the earliest expected server baseVersion and oldStatus
          baseVersion: existing.payload.baseVersion !== undefined ? existing.payload.baseVersion : itemToPush.payload.baseVersion,
          oldStatus: existing.payload.oldStatus !== undefined ? existing.payload.oldStatus : itemToPush.payload.oldStatus,
          clientData: {
            ...(existing.payload.clientData || {}),
            ...(itemToPush.payload.clientData || {})
          }
        }
      };
      return list;
    }
  }

  if (itemToPush.type === 'DELETE_CLIENT') {
    const hadPendingAdd = list.some(
      x => x.type === 'ADD_CLIENT' && String(extractMutationClientId(x)) === cidStr
    );
    const remaining = list.filter(x => String(extractMutationClientId(x)) !== cidStr);
    if (!hadPendingAdd) {
      remaining.push(itemToPush);
    }
    return remaining;
  }

  list.push(itemToPush);
  return list;
}

function applySingleSubItemOverlay(client, payload) {
  const { subCollection, itemData, itemId, counterUpdates } = payload || {};
  const next = { ...client };

  if (counterUpdates && typeof counterUpdates === 'object') {
    Object.assign(next, counterUpdates);
  }

  if (subCollection && Array.isArray(next[subCollection])) {
    const arr = next[subCollection].map(x => ({ ...x }));
    if (itemData) {
      const idx = arr.findIndex(x => String(x?.id) === String(itemData.id));
      if (idx > -1) arr[idx] = { ...arr[idx], ...itemData };
      else arr.unshift({ ...itemData });
      next[subCollection] = arr;
    } else if (itemId !== undefined && itemId !== null) {
      next[subCollection] = arr.filter(x => String(x?.id) !== String(itemId));
    }
  }

  return next;
}

/**
 * Re-applies queued local mutations onto incoming Firestore snapshot client list
 * so remote updates to OTHER clients reflect immediately while unsaved edits for
 * pending clients are NEVER erased by snapshots or reconnect reloads.
 */
export function overlayPendingMutationsOnClients(serverClients = [], queue = [], previousLocalClients = []) {
  const baseList = Array.isArray(serverClients) ? serverClients.map(c => ({ ...c })) : [];
  const prevById = new Map(
    (Array.isArray(previousLocalClients) ? previousLocalClients : [])
      .filter(Boolean)
      .map(c => [String(c.id), c])
  );

  if (!Array.isArray(queue) || queue.length === 0) {
    return baseList;
  }

  const clientsById = new Map(baseList.map(c => [String(c.id), c]));

  for (const item of queue) {
    const cid = extractMutationClientId(item);
    if (cid === null) continue;
    const cidStr = String(cid);
    const p = item.payload || {};

    if (item.type === 'ADD_CLIENT') {
      const existing = clientsById.get(cidStr);
      const localRecord = p.clientData || prevById.get(cidStr);
      if (localRecord) {
        clientsById.set(cidStr, {
          ...(existing || {}),
          ...localRecord,
          _dirtyLocal: true
        });
      }
    } else if (item.type === 'UPDATE_CLIENT') {
      const existing = clientsById.get(cidStr) || prevById.get(cidStr);
      if (existing) {
        clientsById.set(cidStr, {
          ...existing,
          ...(p.clientData || {}),
          // Keep server version if higher so next flush doesn't get stuck unless stale
          version: existing.version || p.baseVersion || 1,
          _dirtyLocal: true
        });
      }
    } else if (item.type === 'DELETE_CLIENT') {
      clientsById.delete(cidStr);
    } else if (item.type === 'SAVE_SUB_ITEM' || item.type === 'DELETE_SUB_ITEM') {
      const existing = clientsById.get(cidStr) || prevById.get(cidStr);
      if (existing) {
        const overlaid = applySingleSubItemOverlay(existing, p);
        overlaid._dirtyLocal = true;
        clientsById.set(cidStr, overlaid);
      }
    } else if (item.type === 'SYNC_PROGRAM_VERSION') {
      const existing = clientsById.get(cidStr) || prevById.get(cidStr);
      if (existing) {
        const nextHistory = Array.isArray(existing.versionHistory) ? [...existing.versionHistory] : [];
        if (p.versionHistoryEntry && !nextHistory.some(h => h?.id === p.versionHistoryEntry.id)) {
          nextHistory.unshift(p.versionHistoryEntry);
        }
        clientsById.set(cidStr, {
          ...existing,
          ...(p.counterUpdates || {}),
          versionHistory: nextHistory,
          _dirtyLocal: true
        });
      }
    }
  }

  return Array.from(clientsById.values());
}

/**
 * Advances expected concurrency baseVersion/expectedItemVersion on subsequent queued
 * mutations for the same client after a preceding queued mutation succeeds.
 */
export function advanceQueuedMutationVersions(queue = [], clientId, ack = {}) {
  if (!Array.isArray(queue) || !ack) return queue;
  const cidStr = String(clientId);
  return queue.map(item => {
    if (String(extractMutationClientId(item)) !== cidStr) return item;
    const nextPayload = { ...(item.payload || {}) };
    if (ack.version !== undefined && ack.version !== null) {
      if ('baseVersion' in nextPayload || item.type === 'UPDATE_CLIENT' || item.type === 'SYNC_PROGRAM_VERSION') {
        nextPayload.baseVersion = ack.version;
      }
      if (nextPayload.concurrency && typeof nextPayload.concurrency === 'object') {
        nextPayload.concurrency = {
          ...nextPayload.concurrency,
          baseVersion: ack.version
        };
      }
    }
    return {
      ...item,
      payload: nextPayload
    };
  });
}
