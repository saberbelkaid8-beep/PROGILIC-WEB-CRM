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
<<<<<<< HEAD
  getDocFromServer: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
=======
  getDocFromServer: vi.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn((_db, path) => ({ path })),
>>>>>>> d4ccc4c496065282d1a0dbac96cc15d79eae78e8
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  deleteField: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(async (_db, fn) => fn(mockTxOps)),
  writeBatch: vi.fn(() => mockBatchOps),
  enableMultiTabIndexedDbPersistence: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(() => () => {})
}));

<<<<<<< HEAD
import { getDoc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { clients, setClients } from '../../src/state/store.js';
=======
import { getDoc, setDoc, writeBatch } from 'firebase/firestore';
>>>>>>> d4ccc4c496065282d1a0dbac96cc15d79eae78e8

describe('Firebase Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user data correctly', async () => {
    const mockDoc = {
      exists: () => true,
      data: () => ({ v: 3, nid: 105 })
    };
    getDoc.mockResolvedValue(mockDoc);

    const data = await getUserData('test-uid');
    expect(data.v).toBe(3);
    expect(data.nid).toBe(105);
  });

  it('should handle non-existent user data', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
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

  it('should deduplicate concurrent loadDataFromFirestore calls', async () => {
    const { loadDataFromFirestore } = await import('../../src/business/storage.js');
    const mockUser = { uid: 'test-user-dedup', email: 'test@example.com', emailVerified: true, providerData: [], getIdToken: vi.fn(() => Promise.resolve('mock-token')) };
    
    getDoc.mockImplementation(() => new Promise(res => setTimeout(() => res({ exists: () => true, data: () => ({ v: 3, nid: 100 }) }), 20)));

    const p1 = loadDataFromFirestore(mockUser);
    const p2 = loadDataFromFirestore(mockUser);

    // Both promises should be identical (same in-flight instance)
    expect(p1).toBe(p2);
    await Promise.all([p1, p2]);
  });

  it('saveClientSubItemTransaction reads only clientRef without redundant users/{uid} BatchGetDocuments read', async () => {
    await saveClientSubItemTransaction(
      'test-uid',
      '101',
      'programs',
      '5001',
      { id: 5001, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري', version: 'V27' },
      { programsCount: 1 }
    );
    expect(mockTxOps.get).toHaveBeenCalledTimes(1);
    expect(mockTxOps.get).toHaveBeenCalledWith({ path: 'users/test-uid/clients/101' });
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
