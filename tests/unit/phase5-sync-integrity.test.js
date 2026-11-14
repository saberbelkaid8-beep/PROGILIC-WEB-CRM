import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mergeSubcollectionWithQueue,
  mergeClientSyncState,
  loadClientSubcollectionsIfNeeded,
  enqueueSyncAction,
  flushSyncQueue,
  resolveConflict,
  clearAllData
} from '../../src/business/storage.js';
import {
  getPendingActivitiesForTenant,
  mergeActivities,
  logActivity,
  ActivityType
} from '../../src/business/timelineService.js';
import {
  S,
  clients,
  setClients,
  updateState,
  setCurrentUser,
  setCurrentStaffUser
} from '../../src/state/store.js';
import * as firebaseService from '../../src/firebase/service.js';
import * as idbStorage from '../../src/business/idbStorage.js';

vi.mock('../../src/business/idbStorage.js', () => ({
  getClients: vi.fn(async () => []),
  getSyncQueue: vi.fn(async () => []),
  saveClients: vi.fn(async () => true),
  setMeta: vi.fn(async () => true),
  saveSyncQueue: vi.fn(async () => true),
  clearAllUserData: vi.fn(async () => true)
}));

vi.mock('../../src/firebase/service.js', () => ({
  addClientTransaction: vi.fn(),
  updateClientTransaction: vi.fn(),
  saveClientSubItemTransaction: vi.fn(),
  deleteClientSubItemTransaction: vi.fn(),
  deleteClientTransaction: vi.fn(),
  getClientSubcollections: vi.fn(),
  saveTenantActivity: vi.fn(async (_uid, act) => act.id),
  saveTenantActivitiesBatch: vi.fn(async (_uid, acts) => acts.map(a => a.id))
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn(async () => {})
  })),
  doc: vi.fn((_db, path) => ({ path })),
  collection: vi.fn((_db, path) => ({ path })),
  getDocs: vi.fn(async () => ({ docs: [] }))
}));

describe('Phase 5 — Cloud & Local Synchronization Integrity Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser({ uid: 'tenant-phase5', tenantId: 'tenant-phase5', role: 'gerant' });
    setCurrentStaffUser(null);
    setClients([]);
    updateState({
      isOnline: true,
      syncQueue: [],
      globalActivities: [],
      modal: null,
      conflictItem: null,
      conflictServerData: null
    });
  });

  describe('1. mergeSubcollectionWithQueue & Subcollection Hydration', () => {
    it('treats empty remote subcollection as authoritative when no pending queue ops exist', () => {
      const localItems = [{ id: 'p1', programName: 'Old Cached' }];
      const remoteItems = [];
      const queue = [];

      const result = mergeSubcollectionWithQueue(101, 'programs', remoteItems, localItems, queue);
      expect(result).toEqual([]);
    });

    it('overlays pending SAVE_SUB_ITEM onto remote subcollections', () => {
      const remoteItems = [{ id: 'p1', programName: 'Remote Program' }];
      const queue = [
        {
          type: 'SAVE_SUB_ITEM',
          state: 'pending',
          payload: {
            clientId: 101,
            collectionName: 'programs',
            itemId: 'p2',
            itemData: { id: 'p2', programName: 'Offline Added Program' }
          }
        }
      ];

      const result = mergeSubcollectionWithQueue(101, 'programs', remoteItems, [], queue);
      expect(result.length).toBe(2);
      expect(result.some(p => p.id === 'p2')).toBe(true);
    });

    it('removes item from subcollection if pending DELETE_SUB_ITEM exists in queue', () => {
      const remoteItems = [
        { id: 'p1', programName: 'Program 1' },
        { id: 'p2', programName: 'Program 2' }
      ];
      const queue = [
        {
          type: 'DELETE_SUB_ITEM',
          state: 'pending',
          payload: {
            clientId: 101,
            collectionName: 'programs',
            itemId: 'p1'
          }
        }
      ];

      const result = mergeSubcollectionWithQueue(101, 'programs', remoteItems, [], queue);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('p2');
    });

    it('does not replace cached programs with an empty cloud subcollection when the summary says they exist', async () => {
      const program = { id: 45, programName: 'Cached ERP', platform: 'Desktop', type: 'Commercial' };
      setClients([{
        id: 101,
        fullName: 'Customer',
        programs: [program],
        programsCount: 1,
        programNames: ['Cached ERP'],
        _subcollectionsLoaded: false
      }]);
      firebaseService.getClientSubcollections.mockResolvedValue({
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: []
      });

      await loadClientSubcollectionsIfNeeded(101);

      expect(clients[0].programs).toEqual([program]);
      expect(clients[0].programsCount).toBe(1);
      expect(clients[0]._subcollectionsLoaded).toBe(false);
    });

    it('keeps the existing program summary when cloud details are missing', async () => {
      setClients([{
        id: 102,
        fullName: 'Customer',
        programs: [],
        programsCount: 2,
        programNames: ['ERP', 'Mobile'],
        _subcollectionsLoaded: false
      }]);
      firebaseService.getClientSubcollections.mockResolvedValue({
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: []
      });

      await loadClientSubcollectionsIfNeeded(102);

      expect(clients[0].programs).toEqual([]);
      expect(clients[0].programsCount).toBe(2);
      expect(clients[0].programNames).toEqual(['ERP', 'Mobile']);
      expect(clients[0]._subcollectionsLoaded).toBe(false);
    });

    it('uses the cloud document ID to load client subcollections', async () => {
      setClients([{
        id: 103,
        firestoreId: 'legacy-document-key',
        fullName: 'Customer',
        programs: [],
        programsCount: 0,
        programNames: [],
        _subcollectionsLoaded: false
      }]);
      firebaseService.getClientSubcollections.mockResolvedValue({
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: []
      });

      await loadClientSubcollectionsIfNeeded(103);

      expect(firebaseService.getClientSubcollections).toHaveBeenCalledWith(
        'tenant-phase5',
        'legacy-document-key'
      );
    });
  });

  describe('2. mergeClientSyncState & Snapshot Reconciliation', () => {
    it('preserves offline ADD_CLIENT when remote snapshot arrives', () => {
      const remoteSummaries = [
        { id: 1, fullName: 'Cloud Customer', version: 1, programsCount: 0 }
      ];
      const localClients = [
        { id: 1, fullName: 'Cloud Customer', version: 1, programsCount: 0 },
        { id: 999, fullName: 'Offline Created Customer', version: 0, programsCount: 1, programs: [{ id: 'p99', programName: 'Local App' }] }
      ];
      const syncQueue = [
        {
          type: 'ADD_CLIENT',
          state: 'pending',
          payload: { clientData: localClients[1], stats: {} }
        }
      ];

      const merged = mergeClientSyncState(remoteSummaries, localClients, syncQueue);
      expect(merged.length).toBe(2);
      expect(merged.find(c => c.id === 999)).toBeDefined();
    });

    it('does not resurrect a client that has a pending DELETE_CLIENT in the sync queue', () => {
      const remoteSummaries = [
        { id: 1, fullName: 'To Be Deleted', version: 1 }
      ];
      const localClients = [
        { id: 1, fullName: 'To Be Deleted', version: 1 }
      ];
      const syncQueue = [
        {
          type: 'DELETE_CLIENT',
          state: 'pending',
          payload: { clientId: 1 }
        }
      ];

      const merged = mergeClientSyncState(remoteSummaries, localClients, syncQueue);
      expect(merged.length).toBe(0);
    });

    it('resets _subcollectionsLoaded to false if remote summary version or programsCount changed', () => {
      const remoteSummaries = [
        { id: 1, fullName: 'Customer', version: 2, programsCount: 3 }
      ];
      const localClients = [
        { id: 1, fullName: 'Customer', version: 1, programsCount: 1, programs: [{ id: 'p1' }], _subcollectionsLoaded: true }
      ];

      const merged = mergeClientSyncState(remoteSummaries, localClients, []);
      expect(merged[0]._subcollectionsLoaded).toBe(false);
      expect(merged[0].programsCount).toBe(3);
    });

    it('retains cached programs when the cloud summary claims records missing from the snapshot', () => {
      const cachedProgram = { id: 7, programName: 'Cached ERP' };
      const merged = mergeClientSyncState(
        [{ id: 1, fullName: 'Customer', programsCount: 2, programNames: ['Cached ERP', 'Mobile'] }],
        [{ id: 1, fullName: 'Customer', programsCount: 2, programs: [cachedProgram], _subcollectionsLoaded: true }],
        []
      );

      expect(merged[0].programs).toEqual([cachedProgram]);
      expect(merged[0].programsCount).toBe(2);
      expect(merged[0]._subcollectionsLoaded).toBe(false);
    });
  });

  describe('3. Timeline Activity Convergence', () => {
    it('merges remote activities with pending local activities without duplicates', () => {
      const remoteActivities = [
        { id: 'act-1', type: 'CLIENT_ADDED', title: 'Remote Activity', timestamp: '2026-11-14T10:00:00Z' }
      ];
      const localActivities = [
        { id: 'act-1', type: 'CLIENT_ADDED', title: 'Remote Activity', timestamp: '2026-11-14T10:00:00Z' },
        { id: 'act-pending-2', type: 'PROGRAM_ADDED', title: 'Offline Local Activity', timestamp: '2026-11-14T10:05:00Z' }
      ];

      const merged = mergeActivities(remoteActivities, localActivities);
      expect(merged.length).toBe(2);
      expect(merged[0].id).toBe('act-pending-2'); // Newer first
      expect(merged[1].id).toBe('act-1');
    });
  });

  describe('4. Optimistic Concurrency Control (OCC) & BaseVersion', () => {
    it('forwards baseVersion in flushSyncQueue to updateClientTransaction', async () => {
      S.isOnline = true;
      S.syncQueue = [
        {
          id: 'q1',
          type: 'UPDATE_CLIENT',
          payload: {
            clientId: 10,
            clientData: { fullName: 'Updated Name' },
            oldStatus: 'نشط',
            stats: {},
            baseVersion: 5
          }
        }
      ];

      firebaseService.updateClientTransaction.mockResolvedValueOnce({ id: 10, version: 6 });

      await flushSyncQueue();

      expect(firebaseService.updateClientTransaction).toHaveBeenCalledWith(
        'tenant-phase5',
        10,
        { fullName: 'Updated Name' },
        'نشط',
        {},
        5
      );
      expect(S.syncQueue.length).toBe(0);
    });

    it('triggers VERSION_CONFLICT modal and leaves operation in requires-attention', async () => {
      S.isOnline = true;
      S.syncQueue = [
        {
          id: 'conflict-op',
          type: 'UPDATE_CLIENT',
          payload: {
            clientId: 10,
            clientData: { fullName: 'Concurrent Edit' },
            oldStatus: 'نشط',
            stats: {},
            baseVersion: 2
          }
        }
      ];

      const conflictErr = new Error('VERSION_CONFLICT');
      conflictErr.code = 'VERSION_CONFLICT';
      conflictErr.serverData = { id: 10, fullName: 'Cloud Edit', version: 3 };
      firebaseService.updateClientTransaction.mockRejectedValueOnce(conflictErr);

      await flushSyncQueue();

      expect(S.modal).toBe('conflict');
      expect(S.syncQueue.length).toBe(1);
      expect(S.syncQueue[0].state).toBe('requires-attention');
    });

    it('resolveConflict(server) updates local state and flushes operation from queue', () => {
      setClients([
        { id: 10, fullName: 'Local Stale Name', version: 2, programs: [{ id: 'p1' }] }
      ]);
      S.conflictItem = {
        id: 'conflict-op',
        payload: { clientId: 10, clientData: { fullName: 'Local Stale Name' } }
      };
      S.conflictServerData = { id: 10, fullName: 'Server Fresh Name', version: 3 };
      S.syncQueue = [S.conflictItem];

      resolveConflict('server');

      expect(clients[0].fullName).toBe('Server Fresh Name');
      expect(clients[0].version).toBe(3);
      expect(clients[0].programs).toEqual([{ id: 'p1' }]); // Preserves subcollection!
      expect(S.syncQueue.length).toBe(0);
      expect(S.modal).toBeNull();
      expect(idbStorage.saveClients).toHaveBeenCalled();
    });
  });

  describe('5. RBAC Protection on Destructive Operations', () => {
    it('blocks clearAllData when user lacks gerant or delete permissions', async () => {
      setCurrentUser({ uid: 'emp-1', role: 'employee', isEmployee: true, permissions: { 'clients.view': true } });
      setCurrentStaffUser({ id: 'emp-1', role: 'employee', permissions: { 'clients.view': true } });

      await expect(clearAllData()).rejects.toThrow('غير مصرح');
    });
  });
});
