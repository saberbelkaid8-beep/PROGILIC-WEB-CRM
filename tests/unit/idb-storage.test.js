import { afterEach, describe, expect, it, vi } from 'vitest';

function installIndexedDBMock() {
  const databases = new Map();
  const request = result => {
    const resultRequest = { result, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => resultRequest.onsuccess?.());
    return resultRequest;
  };
  const indexedDB = {
    deleteDatabase(name) {
      databases.delete(name);
      return request(undefined);
    },
    open(name) {
      const openRequest = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null
      };
      setTimeout(() => {
        let database = databases.get(name);
        if (!database) {
          const stores = new Map();
          database = {
            objectStoreNames: { contains: storeName => stores.has(storeName) },
            createObjectStore(storeName, options) {
              stores.set(storeName, { keyPath: options.keyPath, records: new Map() });
            },
            transaction(storeNames) {
              const names = Array.isArray(storeNames) ? storeNames : [storeNames];
              const transaction = { oncomplete: null, onerror: null, onabort: null, error: null };
              transaction.objectStore = storeName => {
                if (!names.includes(storeName)) throw new Error(`Unknown store ${storeName}`);
                const store = stores.get(storeName);
                return {
                  put(record) {
                    store.records.set(record[store.keyPath], JSON.parse(JSON.stringify(record)));
                    queueMicrotask(() => transaction.oncomplete?.());
                    return request(record[store.keyPath]);
                  },
                  get(key) {
                    return request(store.records.has(key)
                      ? JSON.parse(JSON.stringify(store.records.get(key)))
                      : undefined);
                  },
                  getAll() {
                    return request([...store.records.values()].map(record => JSON.parse(JSON.stringify(record))));
                  },
                  delete(key) {
                    store.records.delete(key);
                    queueMicrotask(() => transaction.oncomplete?.());
                    return request(undefined);
                  },
                  clear() {
                    store.records.clear();
                    queueMicrotask(() => transaction.oncomplete?.());
                    return request(undefined);
                  }
                };
              };
              return transaction;
            },
            close: vi.fn()
          };
          databases.set(name, database);
          openRequest.result = database;
          openRequest.onupgradeneeded?.();
        } else {
          openRequest.result = database;
        }
        openRequest.onsuccess?.();
      }, 0);
      return openRequest;
    }
  };
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDB });
  return databases;
}

describe('IndexedDB CRM storage', () => {
  afterEach(async () => {
    const storage = await import('../../src/business/idbStorage.js');
    storage.closeUserDB('storage-test');
    storage.closeUserDB('another-user');
    delete globalThis.indexedDB;
  });

  it('persists and isolates client, metadata, queue, and backup records by user', async () => {
    installIndexedDBMock();
    const storage = await import('../../src/business/idbStorage.js');
    const client = { id: 21, fullName: 'Test customer', programs: [{ id: 7 }] };
    const operation = { id: 'op-1', type: 'ADD_CLIENT', state: 'pending' };
    const activity = { id: 'activity-1', type: 'PROGRAM_ADDED' };
    const backup = { id: 'backup-1', timestamp: '2026-01-01T00:00:00Z', clients: [client] };

    await storage.saveClients('storage-test', [client]);
    await storage.setMeta('storage-test', 'schemaVersion', 1);
    await storage.saveSyncQueue('storage-test', [operation]);
    await storage.saveBackup('storage-test', backup);
    await storage.addActivity('storage-test', activity);

    expect(await storage.getClients('storage-test')).toEqual([client]);
    expect(await storage.getMeta('storage-test', 'schemaVersion')).toBe(1);
    expect(await storage.getSyncQueue('storage-test')).toEqual([operation]);
    expect(await storage.getBackups('storage-test')).toEqual([backup]);
    expect(await storage.getActivities('storage-test')).toEqual([activity]);
    expect(await storage.getClients('another-user')).toEqual([]);
    expect(await storage.getSyncQueue('another-user')).toEqual([]);
    await storage.deleteActivity('storage-test', activity.id);
    expect(await storage.getActivities('storage-test')).toEqual([]);
  });

  it('verifies a snapshot by reading it back from IndexedDB', async () => {
    installIndexedDBMock();
    const { createSnapshotBackup } = await import('../../src/business/backupService.js');

    const backup = await createSnapshotBackup(
      'storage-test',
      'verification test',
      [{ id: 1, programs: [{ id: 5 }] }],
      { totalPrograms: 1 },
      101
    );

    expect(backup).toMatchObject({
      version: 4,
      schemaVersion: 1,
      nid: 101,
      clients: [{ id: 1, programs: [{ id: 5 }] }]
    });
  });

  it('keeps an unknown snapshot ID sequence unknown', async () => {
    installIndexedDBMock();
    const { createSnapshotBackup } = await import('../../src/business/backupService.js');

    const backup = await createSnapshotBackup(
      'storage-test',
      'unknown sequence test',
      [],
      {},
      undefined
    );

    expect(backup.nid).toBeNull();
  });
});
