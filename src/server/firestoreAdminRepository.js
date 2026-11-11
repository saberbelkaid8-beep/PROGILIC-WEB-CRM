/**
 * PROGILIC CRM v3 — Server-Side Firestore Admin Repository
 * 
 * Secure, constrained persistence layer using Firebase Admin Firestore.
 * Explicitly enforces tenant boundaries for server-originated operations
 * (such as Trello webhooks, background synchronization, and batch reconciliation).
 * 
 * Completely independent of browser globals, window, or client SDK state.
 */

import { getAdminFirestore } from './firebaseAdmin.js';

/**
 * Validates that tenantId is a non-empty, safe alphanumeric string.
 */
function assertValidTenantId(tenantId) {
  if (!tenantId || typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(tenantId.trim())) {
    throw new Error(`[Security] Invalid or forbidden tenantId: "${tenantId}". Access denied.`);
  }
  return tenantId.trim();
}

/**
 * Validates document ID to prevent path traversal or injection.
 */
function assertValidDocId(id, label = 'document ID') {
  if (!id || (typeof id !== 'string' && typeof id !== 'number') || !/^[a-zA-Z0-9_-]{1,128}$/.test(String(id).trim())) {
    throw new Error(`[Security] Invalid ${label}: "${id}". Must be alphanumeric safe identifier.`);
  }
  return String(id).trim();
}

/**
 * Allowlisted subcollections under a client document.
 */
const ALLOWED_CLIENT_SUBCOLLECTIONS = new Set(['programs', 'issues', 'requirements', 'contacts']);

export class FirestoreAdminRepository {
  constructor(firestoreInstance = null) {
    this._db = firestoreInstance;
  }

  get db() {
    return this._db || getAdminFirestore();
  }

  // --- 1. Trello Sync Mapping Repository (/users/{tenantId}/trello_sync/{itemId}) ---

  async getSyncRecord(tenantId, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const firestore = this.db;
    if (!firestore) return null;

    const docRef = firestore.collection('users').doc(validTenant).collection('trello_sync').doc(validItemId);
    const snap = await docRef.get();
    return snap.exists ? snap.data() : null;
  }

  async saveSyncRecord(tenantId, itemId, data) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const firestore = this.db;
    if (!firestore) throw new Error('[Security] PERSISTENCE_ERROR: Firestore Admin is not available.');

    const docRef = firestore.collection('users').doc(validTenant).collection('trello_sync').doc(validItemId);
    const record = {
      ...data,
      itemId: validItemId,
      updatedAt: new Date().toISOString()
    };

    await docRef.set(record, { merge: true });
    return record;
  }

  async deleteSyncRecord(tenantId, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const firestore = this.db;
    if (!firestore) return false;

    await firestore.collection('users').doc(validTenant).collection('trello_sync').doc(validItemId).delete();
    return true;
  }

  /**
   * Atomically acquires a distributed synchronization lease using a Firestore transaction.
   * Increments a durable monotonically increasing leaseGeneration counter.
   */
  async acquireSyncLease(tenantId, itemId, leaseToken, leaseDurationMs = 15000) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    if (!leaseToken || typeof leaseToken !== 'string') {
      throw new Error('[Security] Missing or invalid leaseToken for lease acquisition.');
    }
    const firestore = this.db;
    if (!firestore) throw new Error('[Security] PERSISTENCE_ERROR: Firestore Admin is not available.');

    const docRef = firestore.collection('users').doc(validTenant).collection('trello_sync').doc(validItemId);
    const now = Date.now();

    const executeAcquire = async (getFn, setFn) => {
      const snap = await getFn(docRef);
      const data = (snap && typeof snap.data === 'function') ? snap.data() : (snap?.exists ? snap.data : null);

      if (data) {
        // If actively processing with an unexpired lease held by another worker
        if (data.status === 'PROCESSING' && data.leaseExpiresAt > now && data.leaseToken !== leaseToken) {
          return {
            acquired: false,
            reason: 'CONCURRENT_PROCESSING_ACTIVE',
            activeLeaseToken: data.leaseToken,
            leaseExpiresAt: data.leaseExpiresAt,
            leaseGeneration: Number(data.leaseGeneration) || 0
          };
        }
      }

      const currentGen = (data && typeof data.leaseGeneration === 'number') ? data.leaseGeneration : 0;
      const nextGen = currentGen + 1;
      const leaseExpiresAt = now + leaseDurationMs;

      const updateData = {
        ...(data || {}),
        itemId: validItemId,
        status: 'PROCESSING',
        leaseToken,
        leaseGeneration: nextGen,
        leaseExpiresAt,
        updatedAt: new Date().toISOString()
      };

      await setFn(docRef, updateData, { merge: true });

      return {
        acquired: true,
        leaseToken,
        leaseGeneration: nextGen,
        leaseExpiresAt
      };
    };

    if (typeof firestore.runTransaction === 'function') {
      return await firestore.runTransaction(async (transaction) => {
        return await executeAcquire(
          (ref) => transaction.get(ref),
          (ref, data, opt) => transaction.set(ref, data, opt)
        );
      });
    }

    return await executeAcquire(
      (ref) => ref.get(),
      (ref, data, opt) => ref.set(data, opt)
    );
  }

  /**
   * Safely extends an active lease before expiration if the worker still holds ownership and generation.
   */
  async renewSyncLease(tenantId, itemId, leaseToken, leaseGeneration = null, leaseDurationMs = 15000) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    if (!leaseToken || typeof leaseToken !== 'string') {
      throw new Error('[Security] Missing or invalid leaseToken for lease renewal.');
    }
    const firestore = this.db;
    if (!firestore) throw new Error('[Security] PERSISTENCE_ERROR: Firestore Admin is not available.');

    const docRef = firestore.collection('users').doc(validTenant).collection('trello_sync').doc(validItemId);
    const now = Date.now();

    const executeRenew = async (getFn, setFn) => {
      const snap = await getFn(docRef);
      const data = (snap && typeof snap.data === 'function') ? snap.data() : (snap?.exists ? snap.data : null);

      if (!data || data.leaseToken !== leaseToken) {
        return { renewed: false, reason: 'TOKEN_MISMATCH' };
      }
      if (typeof leaseGeneration === 'number' && data.leaseGeneration !== leaseGeneration) {
        return { renewed: false, reason: 'GENERATION_MISMATCH', currentGeneration: data.leaseGeneration };
      }
      if (data.leaseExpiresAt <= now) {
        return { renewed: false, reason: 'LEASE_EXPIRED_CANNOT_RENEW' };
      }

      const leaseExpiresAt = now + leaseDurationMs;
      const updates = {
        leaseExpiresAt,
        updatedAt: new Date().toISOString()
      };

      await setFn(docRef, updates, { merge: true });

      return {
        renewed: true,
        leaseToken,
        leaseGeneration: data.leaseGeneration,
        leaseExpiresAt
      };
    };

    if (typeof firestore.runTransaction === 'function') {
      return await firestore.runTransaction(async (transaction) => {
        return await executeRenew(
          (ref) => transaction.get(ref),
          (ref, data, opt) => transaction.set(ref, data, opt)
        );
      });
    }

    return await executeRenew(
      (ref) => ref.get(),
      (ref, data, opt) => ref.set(data, opt)
    );
  }

  /**
   * Verifies that the current worker holds a valid, unexpired lease token & generation before committing CRM mutations.
   */
  async verifyLeaseOwnership(tenantId, itemId, leaseToken, leaseGeneration = null) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const record = await this.getSyncRecord(validTenant, validItemId);
    const now = Date.now();

    if (!record) {
      return { valid: false, reason: 'RECORD_NOT_FOUND' };
    }
    if (record.leaseToken !== leaseToken) {
      return { valid: false, reason: 'TOKEN_MISMATCH', currentToken: record.leaseToken };
    }
    if (typeof leaseGeneration === 'number' && record.leaseGeneration !== leaseGeneration) {
      return { valid: false, reason: 'GENERATION_MISMATCH', currentGeneration: record.leaseGeneration };
    }
    if (record.leaseExpiresAt <= now) {
      return { valid: false, reason: 'LEASE_EXPIRED', leaseExpiresAt: record.leaseExpiresAt, now };
    }
    return { valid: true, leaseToken, leaseGeneration: record.leaseGeneration, leaseExpiresAt: record.leaseExpiresAt };
  }

  /**
   * Performs an atomic protected sync commit, closing the TOCTOU window.
   * Validates lease token, generation, and lease expiration inside a single Firestore transaction
   * before applying CRM mutations, sync record update, and activity log.
   */
  async commitProtectedSyncTransaction(tenantId, itemId, leaseToken, leaseGeneration, syncPayload) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const firestore = this.db;
    if (!firestore) throw new Error('[Security] PERSISTENCE_ERROR: Firestore Admin is not available.');

    const syncDocRef = firestore.collection('users').doc(validTenant).collection('trello_sync').doc(validItemId);

    const executeCommit = async (getFn, setFn) => {
      const syncSnap = await getFn(syncDocRef);
      const syncData = (syncSnap && typeof syncSnap.data === 'function') ? syncSnap.data() : (syncSnap?.exists ? syncSnap.data : null);

      if (!syncData) {
        throw new Error('LEASE_RECORD_NOT_FOUND');
      }
      if (syncData.leaseToken !== leaseToken) {
        throw new Error(`STALE_WORKER_TOKEN_MISMATCH: Current token is ${syncData.leaseToken}`);
      }
      if (typeof leaseGeneration === 'number' && syncData.leaseGeneration !== leaseGeneration) {
        throw new Error(`STALE_WORKER_GENERATION_MISMATCH: Current generation is ${syncData.leaseGeneration}`);
      }
      if (syncData.leaseExpiresAt <= Date.now()) {
        throw new Error('LEASE_EXPIRED_BEFORE_COMMIT');
      }

      // Write CRM Sub-Item if present
      if (syncPayload.clientId && syncPayload.collectionKey && syncPayload.subItemId && syncPayload.subItemRecord) {
        const subDocRef = firestore
          .collection('users')
          .doc(validTenant)
          .collection('clients')
          .doc(String(syncPayload.clientId))
          .collection(syncPayload.collectionKey)
          .doc(String(syncPayload.subItemId));
        await setFn(subDocRef, syncPayload.subItemRecord, { merge: true });
      }

      // Write / Update Client Record if present
      if (syncPayload.clientId && syncPayload.clientRecord) {
        const clientRef = firestore.collection('users').doc(validTenant).collection('clients').doc(String(syncPayload.clientId));
        await setFn(clientRef, syncPayload.clientRecord, { merge: true });
      }

      // Write Timeline Activity
      if (syncPayload.activityRecord) {
        const actId = syncPayload.activityRecord.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const actRef = firestore.collection('users').doc(validTenant).collection('activities').doc(actId);
        await setFn(actRef, { ...syncPayload.activityRecord, id: actId, actorUid: validTenant }, { merge: true });
      }

      // Finalize Sync Record
      const finalSyncRecord = {
        ...(syncData || {}),
        ...(syncPayload.syncRecordUpdates || {}),
        status: syncPayload.finalStatus || 'SYNCED',
        leaseExpiresAt: 0,
        syncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setFn(syncDocRef, finalSyncRecord, { merge: true });

      return { committed: true, itemId: validItemId, finalSyncRecord };
    };

    if (typeof firestore.runTransaction === 'function') {
      return await firestore.runTransaction(async (transaction) => {
        return await executeCommit(
          (ref) => transaction.get(ref),
          (ref, data, opt) => transaction.set(ref, data, opt)
        );
      });
    }

    return await executeCommit(
      (ref) => ref.get(),
      (ref, data, opt) => ref.set(data, opt)
    );
  }

  /**
   * Releases or expires an active lease upon completion or failure.
   */
  async releaseSyncLease(tenantId, itemId, leaseToken, leaseGeneration = null, finalStatus = null) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const firestore = this.db;
    if (!firestore) return false;

    const docRef = firestore.collection('users').doc(validTenant).collection('trello_sync').doc(validItemId);

    const executeRelease = async (getFn, setFn) => {
      const snap = await getFn(docRef);
      if (!snap || (!snap.exists && typeof snap.exists !== 'undefined')) return false;
      const data = (snap && typeof snap.data === 'function') ? snap.data() : (snap?.data || null);
      if (!data) return false;

      if (data.leaseToken === leaseToken && (leaseGeneration === null || data.leaseGeneration === leaseGeneration)) {
        const updates = {
          leaseExpiresAt: 0,
          updatedAt: new Date().toISOString()
        };
        if (finalStatus) {
          updates.status = finalStatus;
        }
        await setFn(docRef, updates, { merge: true });
        return true;
      }
      return false;
    };

    if (typeof firestore.runTransaction === 'function') {
      return await firestore.runTransaction(async (transaction) => {
        return await executeRelease(
          (ref) => transaction.get(ref),
          (ref, data, opt) => transaction.set(ref, data, opt)
        );
      });
    }

    return await executeRelease(
      (ref) => ref.get(),
      (ref, data, opt) => ref.set(data, opt)
    );
  }

  // --- 2. Trello Review Queue Repository (/users/{tenantId}/trello_review/{itemId}) ---

  async getReviewItem(tenantId, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'reviewItemId');
    const firestore = this.db;
    if (!firestore) return null;

    const docRef = firestore.collection('users').doc(validTenant).collection('trello_review').doc(validItemId);
    const snap = await docRef.get();
    return snap.exists ? snap.data() : null;
  }

  async saveReviewItem(tenantId, itemId, reviewData) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'reviewItemId');
    const firestore = this.db;
    if (!firestore) throw new Error('[Security] PERSISTENCE_ERROR: Firestore Admin is not available.');

    const docRef = firestore.collection('users').doc(validTenant).collection('trello_review').doc(validItemId);
    const record = {
      ...reviewData,
      id: validItemId,
      checklistItemId: validItemId,
      createdAt: reviewData.createdAt || new Date().toISOString()
    };

    await docRef.set(record, { merge: true });
    return record;
  }

  async deleteReviewItem(tenantId, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'reviewItemId');
    const firestore = this.db;
    if (!firestore) return false;

    await firestore.collection('users').doc(validTenant).collection('trello_review').doc(validItemId).delete();
    return true;
  }

  async listReviewItems(tenantId, limitCount = 50) {
    const validTenant = assertValidTenantId(tenantId);
    const firestore = this.db;
    if (!firestore) return [];

    const querySnap = await firestore
      .collection('users')
      .doc(validTenant)
      .collection('trello_review')
      .limit(limitCount)
      .get();

    return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // --- 3. CRM Clients Repository (/users/{tenantId}/clients/{clientId}) ---

  async getClient(tenantId, clientId) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    const firestore = this.db;
    if (!firestore) return null;

    const docRef = firestore.collection('users').doc(validTenant).collection('clients').doc(validClientId);
    const snap = await docRef.get();
    return snap.exists ? { id: Number(snap.id) || snap.id, ...snap.data() } : null;
  }

  async listClients(tenantId, limitCount = 500) {
    const validTenant = assertValidTenantId(tenantId);
    const firestore = this.db;
    if (!firestore) return [];

    const querySnap = await firestore
      .collection('users')
      .doc(validTenant)
      .collection('clients')
      .limit(limitCount)
      .get();

    return querySnap.docs.map(d => ({ id: Number(d.id) || d.id, ...d.data() }));
  }

  async createClient(tenantId, clientData) {
    const validTenant = assertValidTenantId(tenantId);
    const clientId = clientData.id ? assertValidDocId(clientData.id, 'clientId') : String(Date.now());
    const firestore = this.db;
    if (!firestore) throw new Error('[Security] PERSISTENCE_ERROR: Firestore Admin is not available.');

    const docRef = firestore.collection('users').doc(validTenant).collection('clients').doc(clientId);
    const record = {
      ...clientData,
      id: Number(clientId) || clientId,
      updatedAt: new Date().toISOString()
    };

    await docRef.set(record);
    return record;
  }

  async upsertClient(tenantId, clientId, clientData) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    const firestore = this.db;
    if (!firestore) throw new Error('[Security] PERSISTENCE_ERROR: Firestore Admin is not available.');

    const docRef = firestore.collection('users').doc(validTenant).collection('clients').doc(validClientId);
    const record = {
      ...clientData,
      id: Number(validClientId) || validClientId,
      updatedAt: new Date().toISOString()
    };

    await docRef.set(record, { merge: true });
    return record;
  }

  async deleteClient(tenantId, clientId) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    const firestore = this.db;
    if (!firestore) return false;

    await firestore.collection('users').doc(validTenant).collection('clients').doc(validClientId).delete();
    return true;
  }

  // --- 4. Client Subcollection Repository (/users/{tenantId}/clients/{clientId}/{subcollection}/{itemId}) ---

  async saveClientSubItem(tenantId, clientId, subcollection, itemId, itemData) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    if (!ALLOWED_CLIENT_SUBCOLLECTIONS.has(subcollection)) {
      throw new Error(`[Security] Forbidden subcollection "${subcollection}". Must be one of: ${[...ALLOWED_CLIENT_SUBCOLLECTIONS].join(', ')}`);
    }
    const validItemId = assertValidDocId(itemId, 'subItemId');
    const firestore = this.db;
    if (!firestore) throw new Error('[Security] PERSISTENCE_ERROR: Firestore Admin is not available.');

    const docRef = firestore
      .collection('users')
      .doc(validTenant)
      .collection('clients')
      .doc(validClientId)
      .collection(subcollection)
      .doc(validItemId);

    const record = {
      ...itemData,
      id: Number(validItemId) || validItemId
    };

    await docRef.set(record, { merge: true });
    return record;
  }

  async getClientSubItem(tenantId, clientId, subcollection, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    if (!ALLOWED_CLIENT_SUBCOLLECTIONS.has(subcollection)) {
      throw new Error(`[Security] Forbidden subcollection "${subcollection}". Must be one of: ${[...ALLOWED_CLIENT_SUBCOLLECTIONS].join(', ')}`);
    }
    const validItemId = assertValidDocId(itemId, 'subItemId');
    const firestore = this.db;
    if (!firestore) return null;

    const doc = await firestore
      .collection('users')
      .doc(validTenant)
      .collection('clients')
      .doc(validClientId)
      .collection(subcollection)
      .doc(validItemId)
      .get();

    return doc.exists ? doc.data() : null;
  }

  async deleteClientSubItem(tenantId, clientId, subcollection, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    if (!ALLOWED_CLIENT_SUBCOLLECTIONS.has(subcollection)) {
      throw new Error(`[Security] Forbidden subcollection "${subcollection}".`);
    }
    const validItemId = assertValidDocId(itemId, 'subItemId');
    const firestore = this.db;
    if (!firestore) return false;

    await firestore
      .collection('users')
      .doc(validTenant)
      .collection('clients')
      .doc(validClientId)
      .collection(subcollection)
      .doc(validItemId)
      .delete();

    return true;
  }

  // --- 5. Timeline Audit Log Repository (/users/{tenantId}/activities/{activityId}) ---

  async logActivity(tenantId, activityData) {
    const validTenant = assertValidTenantId(tenantId);
    const firestore = this.db;
    if (!firestore) return null;

    const activityId = activityData.id
      ? assertValidDocId(activityData.id, 'activityId')
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const record = {
      ...activityData,
      id: activityId,
      actorUid: validTenant,
      timestamp: activityData.timestamp || new Date().toISOString()
    };

    const docRef = firestore.collection('users').doc(validTenant).collection('activities').doc(activityId);
    await docRef.set(record);
    return activityId;
  }

  async listActivities(tenantId) {
    const validTenant = assertValidTenantId(tenantId);
    const firestore = this.db;
    if (!firestore) return [];
    const snap = await firestore.collection('users').doc(validTenant).collection('activities').get();
    return snap.docs.map(d => d.data());
  }

  async getActivities(tenantId) {
    return this.listActivities(tenantId);
  }
}

// Global default singleton instance
export const adminRepo = new FirestoreAdminRepository();

/**
 * Isolated, Transaction-Aware In-Memory Repository Adapter for Automated Testing
 * Guarantees zero network calls and proves tests cannot mutate production Firestore CRM data.
 */
export class InMemoryFirestoreAdminRepository {
  constructor(initialClients = []) {
    this.syncRecords = new Map();
    this.reviewItems = new Map();
    this.clients = new Map();
    this.subItems = new Map(); // key: `${tenantId}:${clientId}:${subcollection}:${itemId}`
    this.activities = new Map();

    if (Array.isArray(initialClients)) {
      initialClients.forEach(c => {
        const id = String(c.id);
        this.clients.set(`test_tenant_uid:${id}`, { ...c });
      });
    }
  }

  seedClients(tenantId, clientsList) {
    if (Array.isArray(clientsList)) {
      clientsList.forEach(c => {
        const id = String(c.id);
        this.clients.set(`${tenantId}:${id}`, JSON.parse(JSON.stringify(c)));
      });
    }
  }

  async getSyncRecord(tenantId, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const key = `${validTenant}:${validItemId}`;
    const record = this.syncRecords.get(key);
    return record ? JSON.parse(JSON.stringify(record)) : null;
  }

  async saveSyncRecord(tenantId, itemId, data) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const key = `${validTenant}:${validItemId}`;
    const prev = this.syncRecords.get(key) || {};
    const record = {
      ...prev,
      ...data,
      itemId: validItemId,
      updatedAt: new Date().toISOString()
    };
    this.syncRecords.set(key, JSON.parse(JSON.stringify(record)));
    return record;
  }

  async deleteSyncRecord(tenantId, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const key = `${validTenant}:${validItemId}`;
    return this.syncRecords.delete(key);
  }

  async acquireSyncLease(tenantId, itemId, leaseToken, leaseDurationMs = 15000) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const key = `${validTenant}:${validItemId}`;
    const now = Date.now();
    const data = this.syncRecords.get(key);

    if (data && data.status === 'PROCESSING' && data.leaseExpiresAt > now && data.leaseToken !== leaseToken) {
      return {
        acquired: false,
        reason: 'CONCURRENT_PROCESSING_ACTIVE',
        activeLeaseToken: data.leaseToken,
        leaseExpiresAt: data.leaseExpiresAt,
        leaseGeneration: Number(data.leaseGeneration) || 0
      };
    }

    const currentGen = (data && typeof data.leaseGeneration === 'number') ? data.leaseGeneration : 0;
    const nextGen = currentGen + 1;
    const leaseExpiresAt = now + leaseDurationMs;
    const updated = {
      ...(data || {}),
      itemId: validItemId,
      status: 'PROCESSING',
      leaseToken,
      leaseGeneration: nextGen,
      leaseExpiresAt,
      updatedAt: new Date().toISOString()
    };
    this.syncRecords.set(key, JSON.parse(JSON.stringify(updated)));

    return {
      acquired: true,
      leaseToken,
      leaseGeneration: nextGen,
      leaseExpiresAt
    };
  }

  async renewSyncLease(tenantId, itemId, leaseToken, leaseGeneration = null, leaseDurationMs = 15000) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const key = `${validTenant}:${validItemId}`;
    const data = this.syncRecords.get(key);

    if (!data || data.leaseToken !== leaseToken) {
      return { renewed: false, reason: 'TOKEN_MISMATCH' };
    }
    if (typeof leaseGeneration === 'number' && data.leaseGeneration !== leaseGeneration) {
      return { renewed: false, reason: 'GENERATION_MISMATCH', currentGeneration: data.leaseGeneration };
    }
    if (data.leaseExpiresAt <= Date.now()) {
      return { renewed: false, reason: 'LEASE_EXPIRED_CANNOT_RENEW' };
    }

    const leaseExpiresAt = Date.now() + leaseDurationMs;
    data.leaseExpiresAt = leaseExpiresAt;
    data.updatedAt = new Date().toISOString();
    this.syncRecords.set(key, JSON.parse(JSON.stringify(data)));

    return {
      renewed: true,
      leaseToken,
      leaseGeneration: data.leaseGeneration,
      leaseExpiresAt
    };
  }

  async verifyLeaseOwnership(tenantId, itemId, leaseToken, leaseGeneration = null) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const key = `${validTenant}:${validItemId}`;
    const record = this.syncRecords.get(key);
    const now = Date.now();

    if (!record) {
      return { valid: false, reason: 'RECORD_NOT_FOUND' };
    }
    if (record.leaseToken !== leaseToken) {
      return { valid: false, reason: 'TOKEN_MISMATCH', currentToken: record.leaseToken };
    }
    if (typeof leaseGeneration === 'number' && record.leaseGeneration !== leaseGeneration) {
      return { valid: false, reason: 'GENERATION_MISMATCH', currentGeneration: record.leaseGeneration };
    }
    if (record.leaseExpiresAt <= now) {
      return { valid: false, reason: 'LEASE_EXPIRED', leaseExpiresAt: record.leaseExpiresAt, now };
    }
    return { valid: true, leaseToken, leaseGeneration: record.leaseGeneration, leaseExpiresAt: record.leaseExpiresAt };
  }

  async commitProtectedSyncTransaction(tenantId, itemId, leaseToken, leaseGeneration, syncPayload) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const key = `${validTenant}:${validItemId}`;
    const syncData = this.syncRecords.get(key);

    if (!syncData) throw new Error('LEASE_RECORD_NOT_FOUND');
    if (syncData.leaseToken !== leaseToken) throw new Error(`STALE_WORKER_TOKEN_MISMATCH: Current token is ${syncData.leaseToken}`);
    if (typeof leaseGeneration === 'number' && syncData.leaseGeneration !== leaseGeneration) throw new Error(`STALE_WORKER_GENERATION_MISMATCH: Current generation is ${syncData.leaseGeneration}`);
    if (syncData.leaseExpiresAt <= Date.now()) throw new Error('LEASE_EXPIRED_BEFORE_COMMIT');

    // Write Sub-item
    if (syncPayload.clientId && syncPayload.collectionKey && syncPayload.subItemId && syncPayload.subItemRecord) {
      await this.saveClientSubItem(tenantId, String(syncPayload.clientId), syncPayload.collectionKey, String(syncPayload.subItemId), syncPayload.subItemRecord);
    }
    // Write Client
    if (syncPayload.clientId && syncPayload.clientRecord) {
      await this.upsertClient(tenantId, String(syncPayload.clientId), syncPayload.clientRecord);
    }
    // Write Activity
    if (syncPayload.activityRecord) {
      await this.logActivity(tenantId, syncPayload.activityRecord);
    }

    const finalSyncRecord = {
      ...(syncData || {}),
      ...(syncPayload.syncRecordUpdates || {}),
      status: syncPayload.finalStatus || 'SYNCED',
      leaseExpiresAt: 0,
      syncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.syncRecords.set(key, JSON.parse(JSON.stringify(finalSyncRecord)));

    return { committed: true, itemId: validItemId, finalSyncRecord };
  }

  async releaseSyncLease(tenantId, itemId, leaseToken, leaseGeneration = null, finalStatus = null) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'checklistItemId');
    const key = `${validTenant}:${validItemId}`;
    const data = this.syncRecords.get(key);
    if (!data || data.leaseToken !== leaseToken) return false;
    if (leaseGeneration !== null && data.leaseGeneration !== leaseGeneration) return false;

    data.leaseExpiresAt = 0;
    data.updatedAt = new Date().toISOString();
    if (finalStatus) data.status = finalStatus;
    this.syncRecords.set(key, JSON.parse(JSON.stringify(data)));
    return true;
  }

  async getReviewItem(tenantId, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'reviewItemId');
    const key = `${validTenant}:${validItemId}`;
    const data = this.reviewItems.get(key);
    return data ? JSON.parse(JSON.stringify(data)) : null;
  }

  async saveReviewItem(tenantId, itemId, reviewData) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'reviewItemId');
    const key = `${validTenant}:${validItemId}`;
    const record = {
      ...reviewData,
      id: validItemId,
      checklistItemId: validItemId,
      createdAt: reviewData.createdAt || new Date().toISOString()
    };
    this.reviewItems.set(key, JSON.parse(JSON.stringify(record)));
    return record;
  }

  async deleteReviewItem(tenantId, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validItemId = assertValidDocId(itemId, 'reviewItemId');
    const key = `${validTenant}:${validItemId}`;
    return this.reviewItems.delete(key);
  }

  async listReviewItems(tenantId, limitCount = 50) {
    const validTenant = assertValidTenantId(tenantId);
    const prefix = `${validTenant}:`;
    const results = [];
    for (const [key, val] of this.reviewItems.entries()) {
      if (key.startsWith(prefix)) results.push(JSON.parse(JSON.stringify(val)));
      if (results.length >= limitCount) break;
    }
    return results;
  }

  async getClient(tenantId, clientId) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    const key = `${validTenant}:${validClientId}`;
    const client = this.clients.get(key);
    return client ? JSON.parse(JSON.stringify(client)) : null;
  }

  async listClients(tenantId, limitCount = 500) {
    const validTenant = assertValidTenantId(tenantId);
    const prefix = `${validTenant}:`;
    const results = [];
    for (const [key, val] of this.clients.entries()) {
      if (key.startsWith(prefix)) {
        results.push(JSON.parse(JSON.stringify(val)));
      }
      if (results.length >= limitCount) break;
    }
    return results;
  }

  async createClient(tenantId, clientData) {
    const validTenant = assertValidTenantId(tenantId);
    const clientId = clientData.id ? assertValidDocId(clientData.id, 'clientId') : String(Date.now());
    const key = `${validTenant}:${clientId}`;
    const record = {
      ...clientData,
      id: Number(clientId) || clientId,
      updatedAt: new Date().toISOString()
    };
    this.clients.set(key, JSON.parse(JSON.stringify(record)));
    return record;
  }

  async upsertClient(tenantId, clientId, clientData) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    const key = `${validTenant}:${validClientId}`;
    const prev = this.clients.get(key) || {};
    const record = {
      ...prev,
      ...clientData,
      id: Number(validClientId) || validClientId,
      updatedAt: new Date().toISOString()
    };
    this.clients.set(key, JSON.parse(JSON.stringify(record)));
    return record;
  }

  async deleteClient(tenantId, clientId) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    const key = `${validTenant}:${validClientId}`;
    return this.clients.delete(key);
  }

  async saveClientSubItem(tenantId, clientId, subcollection, itemId, itemData) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    if (!ALLOWED_CLIENT_SUBCOLLECTIONS.has(subcollection)) {
      throw new Error(`[Security] Forbidden subcollection "${subcollection}".`);
    }
    const validItemId = assertValidDocId(itemId, 'subItemId');
    const key = `${validTenant}:${validClientId}:${subcollection}:${validItemId}`;
    const record = {
      ...itemData,
      id: Number(validItemId) || validItemId
    };
    this.subItems.set(key, JSON.parse(JSON.stringify(record)));

    // Keep nested array on client in-memory representation updated
    const clientKey = `${validTenant}:${validClientId}`;
    const client = this.clients.get(clientKey);
    if (client) {
      if (!Array.isArray(client[subcollection])) client[subcollection] = [];
      const idx = client[subcollection].findIndex(x => String(x.id) === String(validItemId));
      if (idx > -1) {
        client[subcollection][idx] = { ...record };
      } else {
        client[subcollection].push({ ...record });
      }
    }

    return record;
  }

  async getClientSubItem(tenantId, clientId, subcollection, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    if (!ALLOWED_CLIENT_SUBCOLLECTIONS.has(subcollection)) {
      throw new Error(`[Security] Forbidden subcollection "${subcollection}".`);
    }
    const validItemId = assertValidDocId(itemId, 'subItemId');
    const key = `${validTenant}:${validClientId}:${subcollection}:${validItemId}`;
    const item = this.subItems.get(key);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async deleteClientSubItem(tenantId, clientId, subcollection, itemId) {
    const validTenant = assertValidTenantId(tenantId);
    const validClientId = assertValidDocId(clientId, 'clientId');
    if (!ALLOWED_CLIENT_SUBCOLLECTIONS.has(subcollection)) {
      throw new Error(`[Security] Forbidden subcollection "${subcollection}".`);
    }
    const validItemId = assertValidDocId(itemId, 'subItemId');
    const key = `${validTenant}:${validClientId}:${subcollection}:${validItemId}`;
    this.subItems.delete(key);

    const clientKey = `${validTenant}:${validClientId}`;
    const client = this.clients.get(clientKey);
    if (client && Array.isArray(client[subcollection])) {
      client[subcollection] = client[subcollection].filter(x => String(x.id) !== String(validItemId));
    }
    return true;
  }

  async logActivity(tenantId, activityData) {
    const validTenant = assertValidTenantId(tenantId);
    const activityId = activityData.id
      ? assertValidDocId(activityData.id, 'activityId')
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const record = {
      ...activityData,
      id: activityId,
      actorUid: validTenant,
      userName: activityData.userName || 'Trello',
      userId: activityData.userId || 'trello-integration',
      timestamp: activityData.timestamp || new Date().toISOString()
    };
    this.activities.set(`${validTenant}:${activityId}`, JSON.parse(JSON.stringify(record)));
    return activityId;
  }

  listActivities(tenantId) {
    const validTenant = assertValidTenantId(tenantId);
    const prefix = `${validTenant}:`;
    const results = [];
    for (const [key, val] of this.activities.entries()) {
      if (key.startsWith(prefix)) results.push(JSON.parse(JSON.stringify(val)));
    }
    return results;
  }

  getActivities(tenantId) {
    return this.listActivities(tenantId);
  }
}

export function createTestAdminRepository(initialClients = []) {
  return new InMemoryFirestoreAdminRepository(initialClients);
}
