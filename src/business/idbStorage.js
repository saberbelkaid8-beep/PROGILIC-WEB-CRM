const DATABASE_PREFIX = 'progilic-crm';
const DATABASE_VERSION = 1;
const STORE_NAMES = ['clients', 'metadata', 'syncQueue', 'backups', 'activities'];
const databasePromises = new Map();

function databaseName(uid) {
  if (!uid || typeof uid !== 'string') {
    throw new Error('A user ID is required for local CRM storage.');
  }
  return `${DATABASE_PREFIX}-${encodeURIComponent(uid)}`;
}

export function openUserDB(uid) {
  const name = databaseName(uid);
  if (databasePromises.has(name)) return databasePromises.get(name);
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('IndexedDB is unavailable; local CRM storage cannot be used.'));
  }

  const openPromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(name, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of STORE_NAMES) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: storeName === 'metadata' ? 'key' : 'id' });
        }
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromises.delete(name);
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another open tab.'));
  });
  databasePromises.set(name, openPromise);
  openPromise.catch(() => databasePromises.delete(name));
  return openPromise;
}

export function closeUserDB(uid) {
  if (!uid) return;
  const name = databaseName(uid);
  const promise = databasePromises.get(name);
  if (!promise) return;
  databasePromises.delete(name);
  promise.then(database => database.close()).catch(() => {});
}

function transact(uid, storeNames, mode, action) {
  return openUserDB(uid).then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted.'));
    try {
      result = action(transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  }));
}

function readRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB read failed.'));
  });
}

export async function getClients(uid) {
  const database = await openUserDB(uid);
  const transaction = database.transaction('clients', 'readonly');
  return readRequest(transaction.objectStore('clients').getAll());
}

export function saveClient(uid, client) {
  if (!client || client.id === undefined || client.id === null) {
    return Promise.reject(new Error('A client with a stable ID is required.'));
  }
  return transact(uid, 'clients', 'readwrite', transaction => {
    transaction.objectStore('clients').put(client);
    return true;
  });
}

export function saveClients(uid, clients) {
  if (!Array.isArray(clients) || clients.some(client => client?.id === undefined || client?.id === null)) {
    return Promise.reject(new Error('Clients must be an array of records with stable IDs.'));
  }
  return transact(uid, 'clients', 'readwrite', transaction => {
    const store = transaction.objectStore('clients');
    clients.forEach(client => store.put(client));
    return true;
  });
}

export function deleteClient(uid, clientId) {
  return transact(uid, 'clients', 'readwrite', transaction => {
    transaction.objectStore('clients').delete(clientId);
    return true;
  });
}

export async function getMeta(uid, key) {
  const database = await openUserDB(uid);
  const transaction = database.transaction('metadata', 'readonly');
  const record = await readRequest(transaction.objectStore('metadata').get(key));
  return record ? record.value : null;
}

export function setMeta(uid, key, value) {
  if (!key) return Promise.reject(new Error('A metadata key is required.'));
  return transact(uid, 'metadata', 'readwrite', transaction => {
    transaction.objectStore('metadata').put({ key, value });
    return true;
  });
}

export async function getSyncQueue(uid) {
  const database = await openUserDB(uid);
  const transaction = database.transaction('syncQueue', 'readonly');
  return readRequest(transaction.objectStore('syncQueue').getAll());
}

export function saveSyncQueue(uid, queue) {
  if (!Array.isArray(queue) || queue.some(item => !item?.id)) {
    return Promise.reject(new Error('The sync queue must contain operations with stable IDs.'));
  }
  return transact(uid, 'syncQueue', 'readwrite', transaction => {
    const store = transaction.objectStore('syncQueue');
    store.clear();
    queue.forEach(item => store.put(item));
    return true;
  });
}

export async function getBackups(uid) {
  const database = await openUserDB(uid);
  const transaction = database.transaction('backups', 'readonly');
  const backups = await readRequest(transaction.objectStore('backups').getAll());
  return backups.sort((left, right) => String(right.timestamp || '').localeCompare(String(left.timestamp || '')));
}

export function saveBackup(uid, backup) {
  if (!backup?.id || !Array.isArray(backup.clients)) {
    return Promise.reject(new Error('A backup must have an ID and a clients array.'));
  }
  return transact(uid, 'backups', 'readwrite', transaction => {
    transaction.objectStore('backups').put(backup);
    return true;
  });
}

export function deleteBackup(uid, backupId) {
  return transact(uid, 'backups', 'readwrite', transaction => {
    transaction.objectStore('backups').delete(backupId);
    return true;
  });
}

export async function getActivities(uid) {
  const database = await openUserDB(uid);
  const transaction = database.transaction('activities', 'readonly');
  return readRequest(transaction.objectStore('activities').getAll());
}

export function addActivity(uid, activity) {
  if (!activity?.id) return Promise.reject(new Error('An activity with a stable ID is required.'));
  return transact(uid, 'activities', 'readwrite', transaction => {
    transaction.objectStore('activities').put(activity);
    return activity.id;
  });
}

export function deleteActivity(uid, activityId) {
  return transact(uid, 'activities', 'readwrite', transaction => {
    transaction.objectStore('activities').delete(activityId);
    return true;
  });
}

export function clearAllUserData(uid) {
  return transact(uid, STORE_NAMES, 'readwrite', transaction => {
    STORE_NAMES.forEach(storeName => transaction.objectStore(storeName).clear());
    return true;
  });
}
