import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUserData,
  saveUserData,
  saveClientSubItemTransaction,
  saveClientSubItemsBatch,
  saveTenantActivitiesBatch
} from '../../src/firebase/service.js';

const mockBatchOps = vi.hoisted(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(() => Promise.resolve())
}));

const mockTxOps = vi.hoisted(() => ({
  get: vi.fn(async () => ({ exists: () => true, data: () => ({ id: 1, fullName: 'Client 1', status: 'نشط' }) })),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
}));

// Mock Firebase Apps
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
  getApps: vi.fn(() => [])
}));

vi.mock('firebase/auth', () => {
  function MockGoogleAuthProvider() {
    this.setCustomParameters = vi.fn();
  }
  function MockFacebookAuthProvider() {
    this.setCustomParameters = vi.fn();
  }
  function MockOAuthProvider() {
    this.setCustomParameters = vi.fn();
  }
  return {
    getAuth: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    FacebookAuthProvider: MockFacebookAuthProvider,
    OAuthProvider: MockOAuthProvider,
    onAuthStateChanged: vi.fn(),
    setPersistence: vi.fn(() => Promise.resolve()),
    browserLocalPersistence: 'browserLocalPersistence'
  };
});

// Mock Firebase SDK
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(),
  persistentMultipleTabManager: vi.fn(),
  memoryLocalCache: vi.fn(),
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn((_db, path) => ({ path })),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  deleteField: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(async (_db, fn) => fn(mockTxOps)),
  writeBatch: vi.fn(() => mockBatchOps),
  getDocsFromServer: vi.fn(() => Promise.resolve({ docs: [] })),
  enableMultiTabIndexedDbPersistence: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(() => () => {})
}));

import { getDocFromServer, getDocsFromServer, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { clients, setClients } from '../../src/state/store.js';

describe('Firebase Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user data correctly', async () => {
    const mockDoc = {
      exists: () => true,
      data: () => ({ v: 3, nid: 105 })
    };
    getDocFromServer.mockResolvedValue(mockDoc);

    const data = await getUserData('test-uid');
    expect(data.v).toBe(3);
    expect(data.nid).toBe(105);
  });

  it('should handle non-existent user data', async () => {
    getDocFromServer.mockResolvedValue({ exists: () => false });
    const data = await getUserData('test-uid');
    expect(data).toBeNull();
  });

  it('fetches a missing timeline client directly from the Firestore server', async () => {
    const { getClientById } = await import('../../src/firebase/service.js');
    getDocFromServer.mockResolvedValue({
      exists: () => true,
      id: '12345',
      data: () => ({ fullName: 'عميل السحابة', status: 'نشط' })
    });

    await expect(getClientById('test-uid', '12345')).resolves.toMatchObject({
      id: 12345,
      firestoreId: '12345',
      fullName: 'عميل السحابة'
    });
    expect(getDocFromServer).toHaveBeenCalled();
  });

  it('finds a client when its Firestore document ID differs from its CRM ID', async () => {
    const { getClientFromServer } = await import('../../src/firebase/service.js');
    getDocFromServer.mockResolvedValueOnce({ exists: () => false });
    getDocsFromServer.mockResolvedValueOnce({
      docs: [{
        id: 'legacy-document-key',
        data: () => ({ id: 12345, fullName: 'Legacy customer', status: 'نشط' })
      }]
    });

    await expect(getClientFromServer('test-uid', '12345')).resolves.toMatchObject({
      id: 12345,
      firestoreId: 'legacy-document-key',
      fullName: 'Legacy customer'
    });
  });

  it('falls back to a full client record embedded in the legacy user document', async () => {
    const { getClientFromServer } = await import('../../src/firebase/service.js');
    getDocFromServer.mockImplementation(async reference => reference.path === 'users/test-uid'
      ? {
          exists: () => true,
          data: () => ({
            clients: [{ id: 12345, fullName: 'Legacy customer', status: 'نشط', programs: [{ id: 7 }] }]
          })
        }
      : { exists: () => false });
    getDocsFromServer.mockResolvedValue({ docs: [] });

    await expect(getClientFromServer('test-uid', '12345')).resolves.toMatchObject({
      id: 12345,
      programs: [{ id: 7 }]
    });
  });

  it('uses Firestore document IDs when subcollection records omit their own IDs', async () => {
    const { getClientSubcollections } = await import('../../src/firebase/service.js');
    getDocsFromServer
      .mockResolvedValueOnce({ docs: [{ id: '77', data: () => ({ programName: 'ERP' }) }] })
      .mockResolvedValueOnce({ docs: [{ id: '88', data: () => ({ title: 'Issue' }) }] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] });

    await expect(getClientSubcollections('test-uid', '12345')).resolves.toMatchObject({
      programs: [{ id: 77, programName: 'ERP' }],
      issues: [{ id: 88, title: 'Issue' }]
    });
  });

  it('updates clients only from server-confirmed realtime snapshots', async () => {
    const { startRealtimeSync, stopRealtimeSync } = await import('../../src/business/storage.js');
    const listeners = [];
    setClients([{ id: 1, fullName: 'Existing client' }]);
    onSnapshot.mockImplementation((...args) => {
      listeners.push(args);
      return vi.fn();
    });

    startRealtimeSync('test-tenant');
    const clientsListener = listeners[1][2];
    clientsListener({
      metadata: { fromCache: true, hasPendingWrites: false },
      docs: [{ id: '2', data: () => ({ id: 2, fullName: 'Cached client' }) }]
    });
    expect(clients.map(client => client.fullName)).toEqual(['Existing client']);

    clientsListener({
      metadata: { fromCache: false, hasPendingWrites: false },
      docs: [{ id: '2', data: () => ({ id: 2, fullName: 'Cloud client' }) }]
    });
    expect(clients.map(client => client.fullName)).toEqual(['Cloud client']);
    expect(listeners[1][1]).toEqual({ includeMetadataChanges: true });

    stopRealtimeSync();
  });

  it('should save user data correctly', async () => {
    setDoc.mockResolvedValue(true);
    await saveUserData('test-uid', { v: 3 });
    expect(setDoc).toHaveBeenCalled();
  });

  it('fetches client records from Firestore server with document ID fallback', async () => {
    const { getClientsFromServer, getClientFromServer } = await import('../../src/firebase/service.js');
    getDocsFromServer.mockResolvedValue({
      docs: [{
        id: '12345',
        data: () => ({ fullName: 'عميل السحابة', status: 'نشط' })
      }]
    });
    getDocFromServer.mockResolvedValue({
      exists: () => true,
      id: '12345',
      data: () => ({ fullName: 'عميل السحابة', status: 'نشط' })
    });

    await expect(getClientsFromServer('test-uid')).resolves.toMatchObject([
      { id: 12345, firestoreId: '12345', fullName: 'عميل السحابة' }
    ]);
    await expect(getClientFromServer('test-uid', '12345')).resolves.toMatchObject({
      id: 12345,
      firestoreId: '12345',
      fullName: 'عميل السحابة'
    });
  });

  it('applies server-confirmed client snapshots and ignores cache-only snapshots', async () => {
    const { startRealtimeSync, stopRealtimeSync } = await import('../../src/business/storage.js');
    const listeners = [];
    getDocsFromServer.mockResolvedValue({ docs: [] });
    onSnapshot.mockImplementation((...args) => {
      listeners.push(args);
      return vi.fn();
    });
    setClients([{ id: 1, fullName: 'Existing client' }]);

    startRealtimeSync('test-tenant');
    const clientsListener = listeners[1][2];
    clientsListener({
      metadata: { fromCache: true, hasPendingWrites: false },
      docs: [{ id: '2', data: () => ({ id: 2, fullName: 'Cached client' }) }]
    });
    expect(clients.map(client => client.fullName)).toEqual(['Existing client']);

    clientsListener({
      metadata: { fromCache: false, hasPendingWrites: false },
      docs: [{ id: '2', data: () => ({ id: 2, fullName: 'Cloud client' }) }]
    });
    expect(clients.map(client => client.fullName)).toEqual(['Cloud client']);
    expect(listeners[1][1]).toEqual({ includeMetadataChanges: true });

    stopRealtimeSync();
  });

  it('keeps clients embedded in the legacy user profile when the clients collection is empty', async () => {
    const { startRealtimeSync, stopRealtimeSync } = await import('../../src/business/storage.js');
    const listeners = [];
    const legacyClient = { id: 55, fullName: 'Profile-only customer', status: 'نشط' };
    getDocsFromServer.mockResolvedValue({ docs: [] });
    getDocFromServer.mockImplementation(async reference => reference.path === 'users/test-tenant'
      ? { exists: () => true, data: () => ({ clients: [legacyClient] }) }
      : { exists: () => false });
    onSnapshot.mockImplementation((...args) => {
      listeners.push(args);
      return vi.fn();
    });

    startRealtimeSync('test-tenant');
    listeners[0][2]({
      metadata: { fromCache: false, hasPendingWrites: false },
      exists: () => true,
      data: () => ({ clients: [legacyClient] })
    });
    listeners[1][2]({
      metadata: { fromCache: false, hasPendingWrites: false },
      docs: []
    });

    expect(clients).toEqual([expect.objectContaining({
      id: 55,
      fullName: 'Profile-only customer'
    })]);
    stopRealtimeSync();
  });

  it('merges legacy profile clients with cloud records while preferring cloud fields', async () => {
    const { getClientsFromServer } = await import('../../src/firebase/service.js');
    getDocsFromServer.mockResolvedValue({
      docs: [{
        id: '101',
        data: () => ({ id: 101, fullName: 'Cloud customer', status: 'نشط' })
      }]
    });
    getDocFromServer.mockImplementation(async reference => reference.path === 'users/test-uid'
      ? {
          exists: () => true,
          data: () => ({
            clients: [
              { id: 101, fullName: 'Old name', programs: [{ id: 7, programName: 'ERP' }] },
              { id: 202, fullName: 'Profile-only customer' }
            ]
          })
        }
      : { exists: () => false });

    const result = await getClientsFromServer('test-uid');
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 101,
        fullName: 'Cloud customer',
        programs: [{ id: 7, programName: 'ERP' }]
      }),
      expect.objectContaining({ id: 202, fullName: 'Profile-only customer' })
    ]));
  });

  it('should deduplicate concurrent loadDataFromFirestore calls', async () => {
    const { loadDataFromFirestore } = await import('../../src/business/storage.js');
    const mockUser = { uid: 'test-user-dedup', email: 'test@example.com', emailVerified: true, providerData: [], getIdToken: vi.fn(() => Promise.resolve('mock-token')) };
    
    getDocFromServer.mockImplementation(() => new Promise(res => setTimeout(() => res({ exists: () => true, data: () => ({ v: 3, nid: 100 }) }), 20)));

    const p1 = loadDataFromFirestore(mockUser);
    const p2 = loadDataFromFirestore(mockUser);

    // Both promises should be identical (same in-flight instance)
    expect(p1).toBe(p2);
    await Promise.all([p1, p2]);
  });

  it('reads client and user documents before saving license transaction writes', async () => {
    await saveClientSubItemTransaction(
      'test-uid',
      '101',
      'programs',
      '5001',
      { id: 5001, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري', version: 'V27' },
      { programsCount: 1 },
      { totalPrograms: 1 }
    );
    expect(mockTxOps.get).toHaveBeenCalledTimes(2);
    expect(mockTxOps.get).toHaveBeenNthCalledWith(1, { path: 'users/test-uid/clients/101' });
    expect(mockTxOps.get).toHaveBeenNthCalledWith(2, { path: 'users/test-uid' });
  });

  it('restores a missing client from its complete local record in the same transaction', async () => {
    mockTxOps.get.mockResolvedValueOnce({ exists: () => false });
    const program = {
      id: 5001,
      programName: 'Desktop - Commercial V27',
      platform: 'Desktop',
      type: 'Commercial',
      version: 'V27'
    };
    const recoveryClient = {
      id: 101,
      fullName: 'Recovered customer',
      status: 'نشط',
      programs: [program],
      issues: [],
      requirements: [],
      contactHistory: []
    };

    await saveClientSubItemTransaction(
      'test-uid',
      '101',
      'programs',
      '5001',
      program,
      { programsCount: 1, installationsCount: 0, programNames: [program.programName] },
      { totalPrograms: 1 },
      recoveryClient
    );

    expect(mockTxOps.set).toHaveBeenCalledWith(
      { path: 'users/test-uid/clients/101' },
      expect.objectContaining({
        id: 101,
        fullName: 'Recovered customer',
        programsCount: 1,
        programs: [program]
      })
    );
    expect(mockTxOps.set).toHaveBeenCalledWith(
      { path: 'users/test-uid/clients/101/programs/5001' },
      program,
      { merge: true }
    );
  });

  it('updates only license summary fields on an existing client', async () => {
    const existingProgram = { id: 700, programName: 'Existing ERP' };
    mockTxOps.get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        id: 101,
        fullName: 'Legacy customer',
        status: 'نشط',
        legacyUnsupportedField: 'old-value',
        programs: [existingProgram]
      })
    });

    await saveClientSubItemTransaction(
      'test-uid',
      '101',
      'programs',
      '701',
      { id: 701, programName: 'New ERP', platform: 'Desktop', type: 'Commercial' },
      { programsCount: 2 },
      null
    );

    expect(mockTxOps.update).toHaveBeenCalledWith(
      { path: 'users/test-uid/clients/101' },
      expect.objectContaining({
        programsCount: 2,
        updatedAt: expect.any(String)
      })
    );
    expect(mockTxOps.set).not.toHaveBeenCalledWith(
      { path: 'users/test-uid/clients/101' },
      expect.anything()
    );
  });

  it('updates only stats metadata on an existing user document during license saves', async () => {
    mockTxOps.get
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 101, fullName: 'Legacy customer', status: 'نشط' })
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ clients: [{ id: 101 }], unsupportedLegacyField: true })
      });

    await saveClientSubItemTransaction(
      'test-uid',
      '101',
      'programs',
      '702',
      { id: 702, programName: 'ERP', platform: 'Desktop', type: 'Commercial' },
      { programsCount: 1 },
      { totalPrograms: 1 }
    );

    expect(mockTxOps.update).toHaveBeenCalledWith(
      { path: 'users/test-uid' },
      expect.objectContaining({
        stats: { totalPrograms: 1 },
        updatedAt: expect.any(String)
      })
    );
    expect(mockTxOps.set).not.toHaveBeenCalledWith(
      { path: 'users/test-uid' },
      expect.anything()
    );
  });

  it('saveTenantActivitiesBatch commits 450 activities in 3 chunked writeBatch calls instead of 450 individual setDoc calls', async () => {
    const activities = Array.from({ length: 450 }, (_, idx) => ({
      id: `act_client_${idx + 1}`,
      clientId: idx + 1,
      clientName: `عميل ${idx + 1}`,
      type: 'CLIENT_CREATED',
      category: 'clients',
      title: 'تسجيل',
      description: 'تفاصيل',
      timestamp: '2026-11-13T10:00:00.000Z',
      userName: 'المسؤول',
      userRole: 'Gérant',
      userId: 'gerant',
      actorEmail: 'ceo@progilic.dz',
      source: 'crm-sync'
    }));

    const saved = await saveTenantActivitiesBatch('test-uid', activities);
    expect(saved).toHaveLength(450);
    expect(writeBatch).toHaveBeenCalledTimes(3);
    expect(mockBatchOps.commit).toHaveBeenCalledTimes(3);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('saveClientSubItemsBatch commits 200 sub-item entries in 2 chunked writeBatch calls', async () => {
    const entries = Array.from({ length: 200 }, (_, idx) => ({
      clientId: idx + 1,
      collectionName: 'programs',
      itemId: String(2000 + idx),
      itemData: { id: 2000 + idx, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري', version: 'V27' },
      counterUpdates: { programsCount: 1, installationsCount: 1, programNames: ['Desktop - تجاري V27'] },
      existingClientData: { id: idx + 1, fullName: `Client ${idx + 1}`, status: 'نشط' }
    }));

    const count = await saveClientSubItemsBatch('test-uid', entries);
    expect(count).toBe(200);
    expect(writeBatch).toHaveBeenCalledTimes(2);
    expect(mockBatchOps.commit).toHaveBeenCalledTimes(2);
  });
});
