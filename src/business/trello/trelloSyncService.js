/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Core Synchronization, Distributed Idempotency, Fencing, and Safe Persistence Engine
 */

import { generateLeaseToken } from './leaseToken.js';
import { TRELLO_SYNC_STATUS, OPERATION_DESTINATION } from './trelloTypes.js';
import { classifyTrelloItem } from './trelloAiClassifier.js';
import { resolveTrelloCustomer } from '../ai/entityResolver.js';
import { determineOperationRoute } from './deterministicRouter.js';
import { createCommitPlan } from './commitPlan.js';
import { logActivity, ActivityType } from '../timelineService.js';
import { clients, setClients, S } from '../../state/store.js';
import { enqueueSyncAction } from '../storage.js';

// In-memory fallback sync store for offline / mock testing resilience
export const inMemorySyncStore = new Map();
export const inMemoryReviewQueue = new Map();

let serverAdminRepo = null;

/**
 * Injects the server-side FirestoreAdminRepository when running in Node.js server context.
 * Kept decoupled from bundle imports to ensure browser Vite builds remain 100% client-safe.
 */
export function setServerAdminRepo(repo) {
  serverAdminRepo = repo;
}

export function resetServerAdminRepoForTesting() {
  serverAdminRepo = null;
}

export async function getSyncRecord(tenantId, itemId) {
  if (!tenantId || !itemId) return null;
  const memKey = `${tenantId}:${itemId}`;
  if (inMemorySyncStore.has(memKey)) return inMemorySyncStore.get(memKey);

  // Server-side Firebase Admin persistence (if running in Node.js server)
  if (serverAdminRepo) {
    try {
      const record = await serverAdminRepo.getSyncRecord(tenantId, itemId);
      if (record) {
        inMemorySyncStore.set(memKey, record);
        return record;
      }
    } catch (err) {
      console.error(`[Trello Sync] Fail-Closed: Error reading sync record for ${itemId}: ${err.message}`);
      throw err;
    }
  }

  return null;
}

export async function saveSyncRecord(tenantId, itemId, data) {
  const memKey = `${tenantId}:${itemId}`;
  const prev = inMemorySyncStore.get(memKey) || {};
  const record = { ...prev, ...data, updatedAt: new Date().toISOString() };
  inMemorySyncStore.set(memKey, record);

  // Server-side Firebase Admin persistence
  if (serverAdminRepo) {
    try {
      await serverAdminRepo.saveSyncRecord(tenantId, itemId, record);
    } catch (err) {
      console.error(`[Trello Sync] Error writing sync record to Firestore Admin: ${err.message}`);
      throw err;
    }
  }

  return record;
}

export async function saveReviewItem(tenantId, itemId, reviewData) {
  const memKey = `${tenantId}:${itemId}`;
  const record = { ...reviewData, id: itemId, createdAt: new Date().toISOString() };
  inMemoryReviewQueue.set(memKey, record);

  // Server-side Firebase Admin persistence
  if (serverAdminRepo) {
    try {
      await serverAdminRepo.saveReviewItem(tenantId, itemId, record);
    } catch (err) {
      console.error(`[Trello Sync] Error writing review item to Firestore Admin: ${err.message}`);
      throw err;
    }
  }

  return record;
}

export async function deleteReviewItem(tenantId, itemId) {
  const memKey = `${tenantId}:${itemId}`;
  inMemoryReviewQueue.delete(memKey);

  // Server-side Firebase Admin persistence
  if (serverAdminRepo) {
    try {
      await serverAdminRepo.deleteReviewItem(tenantId, itemId);
    } catch (err) {
      console.error(`[Trello Sync] Error deleting review item from Firestore Admin: ${err.message}`);
      throw err;
    }
  }

  return true;
}

/**
 * Synchronizes an individual Trello Checklist Item into PROGILIC CRM
 * Enforces distributed lease locking and stale-worker fencing protection.
 */
export async function syncTrelloChecklistItem(tenantId, checklistItem, card, board, options = {}) {
  const itemId = String(checklistItem?.id || '');
  if (!tenantId || !itemId) {
    return { status: TRELLO_SYNC_STATUS.FAILED, error: 'MISSING_REQUIRED_IDENTIFIERS' };
  }

  // Forward-only inception filter: skip items created/actioned prior to scheduled inception date
  const env = options.env || (typeof process !== 'undefined' ? process.env : {});
  const inceptionStr = env.TRELLO_SYNC_INCEPTION_TIMESTAMP || env.TRELLO_SYNC_START_DATE || '2026-11-21T00:00:00Z';
  if (inceptionStr && options.actionDate) {
    const actionTime = new Date(options.actionDate).getTime();
    const cutoffTime = new Date(inceptionStr).getTime();
    if (!Number.isNaN(actionTime) && !Number.isNaN(cutoffTime) && actionTime < cutoffTime) {
      return {
        status: TRELLO_SYNC_STATUS.SKIPPED,
        skipped: true,
        reason: 'SKIPPED_PRIOR_TO_INCEPTION',
        message: `Item action date is prior to inception cutoff ${inceptionStr}`
      };
    }
  }

  const now = Date.now();
  const existingSync = await getSyncRecord(tenantId, itemId);

  // 1. Distributed Lease / Concurrency check
  if (existingSync) {
    // If currently processing with an active lease (15s lease window)
    if (existingSync.status === TRELLO_SYNC_STATUS.PROCESSING && existingSync.leaseExpiresAt > now) {
      return { status: TRELLO_SYNC_STATUS.FAILED, reason: 'CONCURRENT_PROCESSING_ACTIVE' };
    }

    // If already synced and the checklist item name & state haven't changed: Idempotent Skip
    if (existingSync.status === TRELLO_SYNC_STATUS.SYNCED &&
        existingSync.rawText === checklistItem.name &&
        existingSync.trelloState === checklistItem.state &&
        !options.forceRecheck) {
      return { 
        status: TRELLO_SYNC_STATUS.SYNCED, 
        skipped: true, 
        reason: 'ALREADY_SYNCED_IDEMPOTENT',
        targetRecordId: existingSync.targetRecordId
      };
    }
  }

  // Acquire atomic distributed lease using cryptographically secure token
  const myLeaseToken = generateLeaseToken();
  const leaseDuration = options.leaseDurationMs || 15000;
  const leaseExpiresAt = now + leaseDuration;
  let leaseGeneration = 1;

  if (serverAdminRepo && typeof serverAdminRepo.acquireSyncLease === 'function') {
    const leaseRes = await serverAdminRepo.acquireSyncLease(tenantId, itemId, myLeaseToken, leaseDuration);
    if (!leaseRes.acquired) {
      return { status: TRELLO_SYNC_STATUS.FAILED, reason: 'CONCURRENT_PROCESSING_ACTIVE', leaseExpiresAt: leaseRes.leaseExpiresAt };
    }
    leaseGeneration = leaseRes.leaseGeneration || 1;
    inMemorySyncStore.set(`${tenantId}:${itemId}`, {
      itemId,
      cardId: card?.id || '',
      boardId: board?.id || '',
      rawText: checklistItem.name,
      trelloState: checklistItem.state,
      status: TRELLO_SYNC_STATUS.PROCESSING,
      leaseExpiresAt: leaseRes.leaseExpiresAt,
      leaseToken: myLeaseToken,
      leaseGeneration
    });
  } else {
    await saveSyncRecord(tenantId, itemId, {
      itemId,
      cardId: card?.id || '',
      boardId: board?.id || '',
      rawText: checklistItem.name,
      trelloState: checklistItem.state,
      status: TRELLO_SYNC_STATUS.PROCESSING,
      leaseExpiresAt,
      leaseToken: myLeaseToken,
      leaseGeneration: 1
    });
  }

  try {
    // 2. Contextual AI Extraction
    const extracted = await classifyTrelloItem(checklistItem, { cardName: card?.name, cardDesc: card?.desc });

    // 3. Multi-tier Customer Entity Resolution
    let activeClients = clients;
    if (serverAdminRepo && typeof serverAdminRepo.listClients === 'function') {
      const repoClients = await serverAdminRepo.listClients(tenantId);
      if (Array.isArray(repoClients) && repoClients.length > 0) {
        activeClients = (Array.isArray(clients) && clients.length > 0) ? clients : repoClients;
      }
    }
    const customerRes = resolveTrelloCustomer(extracted.customer, activeClients);

    // 4. Deterministic Business Gatekeeper
    const env = options.env || (typeof process !== 'undefined' ? process.env : {});
    const route = determineOperationRoute(extracted, customerRes, checklistItem, env);

    // 5. Handling Review Queue Route
    if (route.destination === OPERATION_DESTINATION.REVIEW_QUEUE) {
      await saveReviewItem(tenantId, itemId, {
        checklistItemId: itemId,
        cardId: card?.id,
        rawText: checklistItem.name,
        trelloState: checklistItem.state,
        extracted,
        customerResolution: customerRes,
        reviewReason: route.reason,
        reviewDetails: route.details
      });

      await saveSyncRecord(tenantId, itemId, {
        status: TRELLO_SYNC_STATUS.REVIEW_REQUIRED,
        reviewReason: route.reason,
        reviewDetails: route.details,
        leaseExpiresAt: 0
      });

      return { status: TRELLO_SYNC_STATUS.REVIEW_REQUIRED, reason: route.reason, details: route.details };
    }

    // 6. FENCING CHECK: Verify lease ownership before any state mutation or queued write
    let isFencingValid = true;
    let fencingReason = '';

    if (serverAdminRepo && typeof serverAdminRepo.verifyLeaseOwnership === 'function') {
      const leaseCheck = await serverAdminRepo.verifyLeaseOwnership(tenantId, itemId, myLeaseToken, leaseGeneration);
      if (!leaseCheck.valid) {
        isFencingValid = false;
        fencingReason = leaseCheck.reason || 'Lease expired or superseded.';
      }
    } else {
      const currentLeaseRecord = await getSyncRecord(tenantId, itemId);
      const serverNow = Date.now();
      if (!currentLeaseRecord || currentLeaseRecord.leaseToken !== myLeaseToken || currentLeaseRecord.leaseGeneration !== leaseGeneration || currentLeaseRecord.leaseExpiresAt < serverNow) {
        isFencingValid = false;
        fencingReason = 'Lease ownership lost or expired before CRM write commit.';
      }
    }

    if (!isFencingValid) {
      console.warn(`[Trello Fencing] Write rejected for item ${itemId}. Reason: ${fencingReason}`);
      return {
        status: TRELLO_SYNC_STATUS.FAILED,
        error: 'STALE_WORKER_FENCING_REJECTED',
        reason: fencingReason
      };
    }

    // 7. Customer Attachment or Safe Creation
    let targetClient = customerRes.client;
    let wasClientCreated = false;

    if (!targetClient && customerRes.status === 'NEW_CLIENT_QUALIFIED') {
      const newClientId = Date.now();
      targetClient = {
        id: newClientId,
        ...customerRes.proposedClientData,
        score: 100,
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: [],
        _subcollectionsLoaded: true
      };

      if (serverAdminRepo && typeof serverAdminRepo.createClient === 'function') {
        await serverAdminRepo.createClient(tenantId, targetClient);
      } else {
        enqueueSyncAction('ADD_CLIENT', { clientId: String(newClientId), clientData: targetClient, stats: S?.stats || {} });
      }
      if (typeof setClients === 'function' && Array.isArray(clients)) {
        setClients([targetClient, ...clients]);
      }
      wasClientCreated = true;

      // Server-side Timeline Activity
      if (serverAdminRepo && typeof serverAdminRepo.logActivity === 'function') {
        await serverAdminRepo.logActivity(tenantId, {
          clientId: newClientId,
          type: 'CLIENT_CREATED',
          title: 'إضافة عميل جديد (Trello)',
          description: `تم تسجيل العميل "${targetClient.fullName}" تلقائياً بناءً على عملية مستوردة من Trello.`,
          userName: 'Trello',
          userId: 'trello-integration',
          metadata: { trelloChecklistItemId: itemId, clientName: targetClient.fullName }
        });
      }

      try {
        await logActivity(
          newClientId,
          ActivityType.CLIENT_CREATED,
          'إضافة عميل جديد (Trello)',
          `تم تسجيل العميل "${targetClient.fullName}" تلقائياً بناءً على عملية مستوردة من Trello.`,
          'trello',
          { trelloChecklistItemId: itemId, clientName: targetClient.fullName }
        );
      } catch (e) {}
    }

    if (!targetClient) {
      throw new Error('Target client could not be determined.');
    }

    // 8. Atomic Protected Sync Commit & In-Place Record Generation
    const cid = targetClient.id;
    let targetRecordId = Date.now() + Math.floor(Math.random() * 1000);
    let beforeSnapshot = null;
    let actionType = 'SUB_ITEM_CREATED';

    const targetCollectionKey = route.destination;
    const clientArrayKey = route.destination === OPERATION_DESTINATION.CONTACTS ? 'contactHistory' : route.destination;

    if (!Array.isArray(targetClient[clientArrayKey])) {
      targetClient[clientArrayKey] = [];
    }
    const subList = targetClient[clientArrayKey];
    const existingIdx = subList.findIndex(item =>
      (existingSync?.targetRecordId && String(item.id) === String(existingSync.targetRecordId)) ||
      (item.trelloChecklistItemId && String(item.trelloChecklistItemId) === String(itemId))
    );

    let finalItemRecord = null;
    if (existingIdx > -1) {
      beforeSnapshot = { ...subList[existingIdx] };
      targetRecordId = subList[existingIdx].id;
      actionType = 'RECORD_UPDATED';
      finalItemRecord = {
        ...subList[existingIdx],
        ...route.payload,
        id: targetRecordId,
        trelloChecklistItemId: itemId,
        lastModifiedBy: 'trello'
      };
      subList[existingIdx] = finalItemRecord;
    } else {
      finalItemRecord = {
        id: targetRecordId,
        ...route.payload,
        source: 'trello',
        trelloChecklistItemId: itemId,
        lastModifiedBy: 'trello'
      };
      subList.push(finalItemRecord);
    }

    if (route.destination === OPERATION_DESTINATION.CONTACTS && route.payload?.date) {
      targetClient.lastContact = route.payload.date;
    }

    // Prepare next immutable clients array copy for store sync
    let nextClientsSnapshot = null;
    if (typeof clients !== 'undefined' && Array.isArray(clients)) {
      nextClientsSnapshot = clients.map(c => {
        if (String(c.id) !== String(cid)) return c;
        const currArr = Array.isArray(c[clientArrayKey]) ? [...c[clientArrayKey]] : [];
        const sIdx = currArr.findIndex(item =>
          (existingSync?.targetRecordId && String(item.id) === String(existingSync.targetRecordId)) ||
          (item.trelloChecklistItemId && String(item.trelloChecklistItemId) === String(itemId))
        );
        if (sIdx > -1) currArr[sIdx] = { ...finalItemRecord };
        else currArr.push({ ...finalItemRecord });
        return {
          ...c,
          [clientArrayKey]: currArr,
          ...(route.destination === OPERATION_DESTINATION.CONTACTS && route.payload?.date ? { lastContact: route.payload.date } : {})
        };
      });
    }

    // Execute Atomic Protected Firestore Transaction
    if (serverAdminRepo && typeof serverAdminRepo.commitProtectedSyncTransaction === 'function') {
      const syncPayload = {
        clientId: String(cid),
        collectionKey: targetCollectionKey,
        subItemId: String(targetRecordId),
        subItemRecord: finalItemRecord,
        clientRecord: targetClient,
        activityRecord: {
          clientId: cid,
          type: ActivityType.TRELLO_SYNCED,
          title: route.auditTitle,
          description: route.auditDescription,
          userName: 'Trello',
          userId: 'trello-integration',
          metadata: {
            trelloCardId: card?.id,
            trelloChecklistItemId: itemId,
            clientName: targetClient.fullName,
            destination: route.destination,
            targetRecordId
          }
        },
        syncRecordUpdates: {
          targetCollection: route.destination,
          targetRecordId,
          clientId: cid,
          rawText: checklistItem.name,
          trelloState: checklistItem.state,
          wasClientCreatedByTrello: wasClientCreated,
          beforeSnapshot,
          actionType
        },
        finalStatus: TRELLO_SYNC_STATUS.SYNCED
      };

      await serverAdminRepo.commitProtectedSyncTransaction(tenantId, itemId, myLeaseToken, leaseGeneration, syncPayload);
    } else {
      if (serverAdminRepo && typeof serverAdminRepo.saveClientSubItem === 'function') {
        await serverAdminRepo.saveClientSubItem(tenantId, String(cid), targetCollectionKey, String(targetRecordId), finalItemRecord);
      }
      enqueueSyncAction('SAVE_SUB_ITEM', { clientId: String(cid), collectionName: targetCollectionKey, itemId: String(targetRecordId), itemData: finalItemRecord });

      if (serverAdminRepo && typeof serverAdminRepo.upsertClient === 'function') {
        await serverAdminRepo.upsertClient(tenantId, String(cid), targetClient);
      }
    }

    if (typeof setClients === 'function' && Array.isArray(nextClientsSnapshot)) {
      setClients(nextClientsSnapshot);
    }

    try {
      await logActivity(
        cid,
        ActivityType.TRELLO_SYNCED,
        route.auditTitle,
        route.auditDescription,
        'trello',
        {
          trelloCardId: card?.id,
          trelloChecklistItemId: itemId,
          clientName: targetClient.fullName,
          destination: route.destination,
          targetRecordId
        }
      );
    } catch (e) {}

    // 10. Update Idempotency Mapping with Full Provenance Snapshot
    await saveSyncRecord(tenantId, itemId, {
      status: TRELLO_SYNC_STATUS.SYNCED,
      targetCollection: route.destination,
      targetRecordId,
      clientId: cid,
      rawText: checklistItem.name,
      trelloState: checklistItem.state,
      wasClientCreatedByTrello: wasClientCreated,
      beforeSnapshot,
      actionType,
      leaseExpiresAt: 0,
      syncedAt: new Date().toISOString()
    });

    return {
      status: TRELLO_SYNC_STATUS.SYNCED,
      clientId: cid,
      targetCollection: route.destination,
      destination: route.destination,
      targetRecordId,
      actionType,
      payload: route.payload
    };
  } catch (err) {
    console.error(`[Trello Sync] Error processing item ${itemId}:`, err);
    await saveSyncRecord(tenantId, itemId, {
      status: TRELLO_SYNC_STATUS.FAILED,
      error: err.message,
      leaseExpiresAt: 0
    });
    return { status: TRELLO_SYNC_STATUS.FAILED, error: err.message };
  }
}

/**
 * Resolves a Human Review Queue item with full persistence and audit logging
 */
export async function resolveReviewItem(tenantId, itemId, resolution) {
  const { approved, selectedClientId, destination, customData, resolvedBy = 'operator' } = resolution;
  const reviewRecord = inMemoryReviewQueue.get(`${tenantId}:${itemId}`) || await getSyncRecord(tenantId, itemId);

  if (!approved) {
    await deleteReviewItem(tenantId, itemId);
    await saveSyncRecord(tenantId, itemId, {
      status: 'REVIEW_REJECTED',
      resolvedBy,
      resolvedAt: new Date().toISOString()
    });
    return { status: 'REJECTED', itemId };
  }

  let targetClient = null;
  if (typeof clients !== 'undefined' && Array.isArray(clients) && clients.length > 0) {
    targetClient = clients.find(c => String(c.id) === String(selectedClientId));
  }
  if (!targetClient && serverAdminRepo && typeof serverAdminRepo.getClient === 'function') {
    targetClient = await serverAdminRepo.getClient(tenantId, String(selectedClientId));
  }
  if (!targetClient) {
    throw new Error(`Target client ${selectedClientId} not found.`);
  }

  const cid = targetClient.id;
  const opId = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const targetCollection = destination || 'contacts';
  const rawText = reviewRecord?.rawText || customData?.title || 'عملية مراجعة Trello';

  if (targetCollection === 'issues') {
    const nextIssues = [...(targetClient.issues || [])];
    const iss = {
      id: opId,
      title: rawText,
      description: 'تمت المراجعة والاعتماد يدوياً من Trello',
      type: 'أخرى',
      priority: 'متوسطة',
      status: 'مفتوح',
      date: today,
      source: 'trello',
      trelloChecklistItemId: itemId,
      lastModifiedBy: 'trello'
    };
    nextIssues.push(iss);
    targetClient = { ...targetClient, issues: nextIssues };
    if (serverAdminRepo && typeof serverAdminRepo.saveClientSubItem === 'function') {
      await serverAdminRepo.saveClientSubItem(tenantId, String(cid), 'issues', String(opId), iss);
    }
    enqueueSyncAction('SAVE_SUB_ITEM', { clientId: String(cid), collectionName: 'issues', itemId: String(opId), itemData: iss });
  } else if (targetCollection === 'requirements') {
    const nextReqs = [...(targetClient.requirements || [])];
    const req = {
      id: opId,
      title: rawText,
      description: 'تمت المراجعة والاعتماد يدوياً من Trello',
      type: 'ميزة جديدة',
      priority: 'متوسطة',
      status: 'قيد الدراسة',
      impact: 'متوسط',
      date: today,
      source: 'trello',
      trelloChecklistItemId: itemId,
      lastModifiedBy: 'trello'
    };
    nextReqs.push(req);
    targetClient = { ...targetClient, requirements: nextReqs };
    if (serverAdminRepo && typeof serverAdminRepo.saveClientSubItem === 'function') {
      await serverAdminRepo.saveClientSubItem(tenantId, String(cid), 'requirements', String(opId), req);
    }
    enqueueSyncAction('SAVE_SUB_ITEM', { clientId: String(cid), collectionName: 'requirements', itemId: String(opId), itemData: req });
  } else if (targetCollection === 'programs') {
    const nextProgs = [...(targetClient.programs || [])];
    const prog = {
      id: opId,
      programName: customData?.programName || 'PROGILIC ERP',
      platform: 'Desktop',
      type: 'تجاري',
      version: 'V27',
      installationsCount: 1,
      startDate: today,
      endDate: '',
      source: 'trello',
      trelloChecklistItemId: itemId,
      lastModifiedBy: 'trello'
    };
    nextProgs.push(prog);
    targetClient = {
      ...targetClient,
      programs: nextProgs,
      programsCount: nextProgs.length,
      installationsCount: nextProgs.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0),
      programNames: nextProgs.map(p => p.programName)
    };
    if (serverAdminRepo && typeof serverAdminRepo.saveClientSubItem === 'function') {
      await serverAdminRepo.saveClientSubItem(tenantId, String(cid), 'programs', String(opId), prog);
    }
    enqueueSyncAction('SAVE_SUB_ITEM', {
      clientId: String(cid),
      collectionName: 'programs',
      itemId: String(opId),
      itemData: prog,
      counterUpdates: {
        programsCount: nextProgs.length,
        installationsCount: targetClient.installationsCount,
        programNames: targetClient.programNames,
        programs: nextProgs
      }
    });
  } else {
    const nextContacts = [...(targetClient.contactHistory || [])];
    const cont = {
      id: opId,
      type: 'خدمة/أخرى',
      note: rawText,
      date: today,
      source: 'trello',
      trelloChecklistItemId: itemId,
      lastModifiedBy: 'trello'
    };
    nextContacts.push(cont);
    targetClient = { ...targetClient, contactHistory: nextContacts, lastContact: today };
    if (serverAdminRepo && typeof serverAdminRepo.saveClientSubItem === 'function') {
      await serverAdminRepo.saveClientSubItem(tenantId, String(cid), 'contacts', String(opId), cont);
    }
    enqueueSyncAction('SAVE_SUB_ITEM', { clientId: String(cid), collectionName: 'contacts', itemId: String(opId), itemData: cont });
  }

  if (serverAdminRepo && typeof serverAdminRepo.upsertClient === 'function') {
    await serverAdminRepo.upsertClient(tenantId, String(cid), targetClient);
  }
  if (typeof setClients === 'function' && Array.isArray(clients)) {
    setClients(clients.map(c => String(c.id) === String(cid) ? targetClient : c));
  }
  await deleteReviewItem(tenantId, itemId);

  if (serverAdminRepo && typeof serverAdminRepo.logActivity === 'function') {
    await serverAdminRepo.logActivity(tenantId, {
      clientId: cid,
      type: ActivityType.TRELLO_SYNCED,
      title: 'اعتماد عملية من طابور المراجعة',
      description: `تمت مراجعة واعتماد العملية "${rawText}" وإلحاقها بالعميل "${targetClient.fullName}".`,
      userName: 'Trello',
      userId: 'trello-integration',
      metadata: { trelloChecklistItemId: itemId, resolvedBy, targetCollection, targetRecordId: opId }
    });
  }

  try {
    await logActivity(
      cid,
      ActivityType.TRELLO_SYNCED,
      'اعتماد عملية من طابور المراجعة',
      `تمت مراجعة واعتماد العملية "${rawText}" وإلحاقها بالعميل "${targetClient.fullName}".`,
      'trello',
      { trelloChecklistItemId: itemId, resolvedBy, targetCollection, targetRecordId: opId }
    );
  } catch (e) {}

  await saveSyncRecord(tenantId, itemId, {
    status: TRELLO_SYNC_STATUS.SYNCED,
    targetCollection,
    targetRecordId: opId,
    clientId: cid,
    wasClientCreatedByTrello: false,
    actionType: 'REVIEW_APPROVED',
    resolvedBy,
    syncedAt: new Date().toISOString()
  });

  return { status: 'APPROVED', clientId: cid, targetRecordId: opId };
}

/**
 * Safe, idempotent item-level rollback
 * Preserves pre-existing customer records and subsequent manual staff modifications.
 */
export async function rollbackTrelloItem(tenantId, itemId, options = {}) {
  const syncRecord = await getSyncRecord(tenantId, itemId);
  if (!syncRecord) {
    return { status: 'ERROR', error: 'RECORD_NOT_FOUND' };
  }
  if (syncRecord.status === 'ROLLED_BACK') {
    return { status: 'ALREADY_ROLLED_BACK', itemId };
  }

  const { clientId, targetCollection, targetRecordId, wasClientCreatedByTrello, beforeSnapshot, actionType } = syncRecord;
  let targetClient = null;
  if (typeof clients !== 'undefined' && Array.isArray(clients) && clients.length > 0) {
    targetClient = clients.find(c => String(c.id) === String(clientId));
  }
  if (!targetClient && serverAdminRepo && typeof serverAdminRepo.getClient === 'function') {
    targetClient = await serverAdminRepo.getClient(tenantId, String(clientId));
  }

  if (!targetClient) {
    // Client no longer in state, simply update sync mapping
    await saveSyncRecord(tenantId, itemId, { status: 'ROLLED_BACK', rolledBackAt: new Date().toISOString() });
    return { status: 'ROLLED_BACK', note: 'Client was already removed.' };
  }

  // 1. If client was created solely by Trello, check if other staff added records to it
  if (wasClientCreatedByTrello) {
    const hasManualStaffRecords = (targetClient.issues || []).some(i => i.source !== 'trello') ||
                                  (targetClient.programs || []).some(p => p.source !== 'trello') ||
                                  (targetClient.requirements || []).some(r => r.source !== 'trello') ||
                                  (targetClient.contactHistory || []).some(c => c.source !== 'trello');

    if (!hasManualStaffRecords && !options.preserveClient) {
      // Safe to purge client because no human staff ever touched it
      if (serverAdminRepo && typeof serverAdminRepo.deleteClient === 'function') {
        await serverAdminRepo.deleteClient(tenantId, String(clientId));
      }
      enqueueSyncAction('DELETE_CLIENT', { clientId: String(clientId) });
      if (typeof setClients === 'function' && Array.isArray(clients)) {
        setClients(clients.filter(c => String(c.id) !== String(clientId)));
      }
      await saveSyncRecord(tenantId, itemId, { status: 'ROLLED_BACK', rolledBackAt: new Date().toISOString() });
      return { status: 'ROLLED_BACK', clientDeleted: true };
    }
  }

  // 2. Rollback sub-item in collection while preserving subsequent manual human edits
  if (targetCollection && targetRecordId && targetClient[targetCollection]) {
    const subList = targetClient[targetCollection];
    const itemIdx = subList.findIndex(x => String(x.id) === String(targetRecordId));

    if (itemIdx > -1) {
      const existingItem = subList[itemIdx];

      // Check for subsequent manual employee edits
      if (existingItem.lastModifiedBy && existingItem.lastModifiedBy !== 'trello' && !options.force) {
        return {
          status: 'CONFLICT_MANUAL_EDITS_DETECTED',
          error: 'Record was manually edited by staff after Trello sync. Rollback aborted to prevent data loss.'
        };
      }

      if (actionType === 'RECORD_UPDATED' && beforeSnapshot) {
        // Revert to snapshot
        subList[itemIdx] = { ...beforeSnapshot };
        if (serverAdminRepo && typeof serverAdminRepo.saveClientSubItem === 'function') {
          await serverAdminRepo.saveClientSubItem(tenantId, String(clientId), targetCollection, String(targetRecordId), beforeSnapshot);
        }
        enqueueSyncAction('SAVE_SUB_ITEM', { clientId: String(clientId), collectionName: targetCollection, itemId: String(targetRecordId), itemData: beforeSnapshot });
      } else {
        // Remove created item
        subList.splice(itemIdx, 1);
        if (serverAdminRepo && typeof serverAdminRepo.deleteClientSubItem === 'function') {
          await serverAdminRepo.deleteClientSubItem(tenantId, String(clientId), targetCollection, String(targetRecordId));
        }
        enqueueSyncAction('DELETE_SUB_ITEM', { clientId: String(clientId), collectionName: targetCollection, itemId: String(targetRecordId) });
      }
    }
  }

  if (serverAdminRepo && typeof serverAdminRepo.upsertClient === 'function') {
    await serverAdminRepo.upsertClient(tenantId, String(clientId), targetClient);
  }
  if (typeof setClients === 'function' && Array.isArray(clients)) {
    setClients([...clients]);
  }

  await saveSyncRecord(tenantId, itemId, {
    status: 'ROLLED_BACK',
    rolledBackAt: new Date().toISOString(),
    rolledBackBy: options.rolledBackBy || 'system'
  });

  if (serverAdminRepo && typeof serverAdminRepo.logActivity === 'function') {
    await serverAdminRepo.logActivity(tenantId, {
      clientId,
      type: ActivityType.TRELLO_SYNCED,
      title: 'تراجع عن مزامنة Trello (Rollback)',
      description: 'تم التراجع الآمن عن العملية المستوردة من Trello مع الحفاظ على سلامة بيانات العميل.',
      userName: 'Trello',
      userId: 'trello-integration',
      metadata: { trelloChecklistItemId: itemId }
    });
  }

  try {
    await logActivity(
      clientId,
      ActivityType.TRELLO_SYNCED,
      'تراجع عن مزامنة Trello (Rollback)',
      'تم التراجع الآمن عن العملية المستوردة من Trello مع الحفاظ على سلامة بيانات العميل.',
      'trello',
      { trelloChecklistItemId: itemId }
    );
  } catch (e) {}

  return { status: 'ROLLED_BACK', itemId };
}

/**
 * Batch rollback for an entire historical backfill run
 */
export async function rollbackBackfillRun(tenantId, runResults, options = {}) {
  const items = runResults?.details || [];
  const results = { total: items.length, rolledBack: 0, skipped: 0, conflicts: [] };

  for (const item of items) {
    const itemId = item.itemId;
    const res = await rollbackTrelloItem(tenantId, itemId, options);
    if (res.status === 'ROLLED_BACK') results.rolledBack++;
    else if (res.status === 'CONFLICT_MANUAL_EDITS_DETECTED') results.conflicts.push({ itemId, reason: res.error });
    else results.skipped++;
  }

  return results;
}

/**
 * Decoupled Trello deletion handler: preserves CRM data integrity
 */
export async function handleTrelloItemDeleted(tenantId, itemId) {
  const syncRecord = await getSyncRecord(tenantId, itemId);
  if (!syncRecord) return { ignored: true };

  await saveSyncRecord(tenantId, itemId, {
    status: TRELLO_SYNC_STATUS.SOURCE_DELETED,
    deletedAtSource: new Date().toISOString()
  });

  if (syncRecord.clientId) {
    await logActivity(
      syncRecord.clientId,
      ActivityType.TRELLO_SYNCED,
      'أرشفة / حذف مهمة Trello',
      'تم حذف أو أرشفة المهمة المرتبطة في Trello، مع الاحتفاظ الكامل بالسجل والبيانات داخل CRM.',
      'trello',
      { trelloChecklistItemId: itemId }
    );
  }
  return { status: 'PRESERVED' };
}
