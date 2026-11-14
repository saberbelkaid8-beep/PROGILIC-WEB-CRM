import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserData, saveUserData } from '../../src/firebase/service.js';

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
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn()
  })),
  enableMultiTabIndexedDbPersistence: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(() => () => {})
}));

import { getDocFromServer, getDocsFromServer, onSnapshot, setDoc } from 'firebase/firestore';
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
});
