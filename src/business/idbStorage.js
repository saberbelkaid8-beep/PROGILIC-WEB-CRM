/**
 * PROGILIC CRM v3 - User-Isolated IndexedDB Storage Layer
 * Provides robust Promise-wrapped native IndexedDB access,
 * isolating storage by Firebase User UID.
 * Fallbacks gracefully to in-memory store if IndexedDB is blocked or unsupported.
 */

let dbInstance = null;
let currentUid = null;
let useFallback = false;

// Safe in-memory store fallback
const inMemoryStore = {
  clients: {},
  meta: {},
  syncQueue: {},
  backups: {},
  activities: {}
};

// Auto-detect IndexedDB availability safely
try {
  if (typeof window === 'undefined') {
    useFallback = true;
  } else {
    const idb = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    if (!idb) {
      console.warn("[IDB] IndexedDB not found on this browser. Using in-memory fallback.");
      useFallback = true;
    }
  }
} catch (e) {
  console.warn("[IDB] IndexedDB access threw security exception. Using in-memory fallback.", e);
  useFallback = true;
}

/**
 * Opens (and initializes if needed) the user's specific IndexedDB database.
 * If user changes, closes the previous connection and opens the new database.
 */
export function openUserDB(uid) {
  if (!uid) {
    return Promise.reject(new Error("UID is required to open user database."));
  }

  if (useFallback) {
    return Promise.resolve(null);
  }

  if (dbInstance && currentUid === uid) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (e) {
        console.error("[IDB] Error closing previous DB connection:", e);
      }
      dbInstance = null;
    }

    currentUid = uid;
    // Database is isolated per user
    const dbName = `PROGILIC_CRM_DB_${uid}`;
    
    let request;
    try {
      request = indexedDB.open(dbName, 3);
    } catch (err) {
      console.error(`[IDB] Synchronous failure opening database ${dbName}:`, err);
      console.warn("[IDB] Switching to in-memory storage fallback.");
      useFallback = true;
      resolve(null);
      return;
    }

    request.onupgradeneeded = (e) => {
      try {
        const db = e.target.result;
        console.log(`[IDB] Creating/upgrading stores for database: ${dbName}`);

        if (!db.objectStoreNames.contains('clients')) {
          db.createObjectStore('clients', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('activities')) {
          const activityStore = db.createObjectStore('activities', { keyPath: 'id', autoIncrement: true });
          activityStore.createIndex('clientId', 'clientId', { unique: false });
        }
      } catch (err) {
        console.error("[IDB] Upgrade failure:", err);
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      console.log(`[IDB] Database opened successfully: ${dbName}`);
      resolve(dbInstance);
    };

    request.onerror = (e) => {
      console.error(`[IDB] Failed to open database ${dbName}:`, e.target.error || e.target);
      console.warn("[IDB] Switching to in-memory storage fallback due to DB open error.");
      useFallback = true;
      resolve(null);
    };
  });
}

/**
 * Closes the current database connection.
 */
export function closeUserDB() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      console.error("[IDB] Error closing DB connection:", e);
    }
    dbInstance = null;
    currentUid = null;
    console.log("[IDB] Database connection closed.");
  }
}

/* ==========================================================================
   CLIENTS STORE OPERATIONS
   ========================================================================== */

export async function getClients(uid) {
  if (useFallback) {
    if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
    return Object.values(inMemoryStore.clients[uid]);
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
      return Object.values(inMemoryStore.clients[uid]);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('clients', 'readonly');
      const store = tx.objectStore('clients');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] getClients error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
    return Object.values(inMemoryStore.clients[uid]);
  }
}

export async function saveClient(uid, client) {
  if (client && client.id) {
    client.id = Number(client.id);
  }
  if (useFallback) {
    if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
    inMemoryStore.clients[uid][client.id] = JSON.parse(JSON.stringify(client));
    return true;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
      inMemoryStore.clients[uid][client.id] = JSON.parse(JSON.stringify(client));
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('clients', 'readwrite');
      const store = tx.objectStore('clients');
      const request = store.put(client);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] saveClient error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
    inMemoryStore.clients[uid][client.id] = JSON.parse(JSON.stringify(client));
    return true;
  }
}

export async function saveClients(uid, clientsList) {
  if (useFallback) {
    if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
    inMemoryStore.clients[uid] = {};
    clientsList.forEach(client => {
      if (client && client.id) {
        client.id = Number(client.id);
        inMemoryStore.clients[uid][client.id] = JSON.parse(JSON.stringify(client));
      }
    });
    return true;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
      inMemoryStore.clients[uid] = {};
      clientsList.forEach(client => {
        if (client && client.id) {
          client.id = Number(client.id);
          inMemoryStore.clients[uid][client.id] = JSON.parse(JSON.stringify(client));
        }
      });
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('clients', 'readwrite');
      const store = tx.objectStore('clients');

      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        if (clientsList.length === 0) {
          resolve(true);
          return;
        }

        let count = 0;
        let hasError = false;

        clientsList.forEach((client) => {
          if (client && client.id) {
            client.id = Number(client.id);
          }
          const putReq = store.put(client);
          putReq.onsuccess = () => {
            count++;
            if (count === clientsList.length && !hasError) {
              resolve(true);
            }
          };
          putReq.onerror = (err) => {
            if (!hasError) {
              hasError = true;
              reject(err);
            }
          };
        });
      };

      clearRequest.onerror = () => reject(clearRequest.error);
    });
  } catch (err) {
    console.error("[IDB] saveClients error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.clients[uid]) inMemoryStore.clients[uid] = {};
    inMemoryStore.clients[uid] = {};
    clientsList.forEach(client => {
      if (client && client.id) {
        client.id = Number(client.id);
        inMemoryStore.clients[uid][client.id] = JSON.parse(JSON.stringify(client));
      }
    });
    return true;
  }
}

export async function deleteClient(uid, clientId) {
  clientId = Number(clientId);
  if (useFallback) {
    if (inMemoryStore.clients[uid]) {
      delete inMemoryStore.clients[uid][clientId];
    }
    return true;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (inMemoryStore.clients[uid]) {
        delete inMemoryStore.clients[uid][clientId];
      }
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('clients', 'readwrite');
      const store = tx.objectStore('clients');
      const request = store.delete(clientId);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] deleteClient error, falling back to in-memory:", err);
    useFallback = true;
    if (inMemoryStore.clients[uid]) {
      delete inMemoryStore.clients[uid][clientId];
    }
    return true;
  }
}

/* ==========================================================================
   META (KEY-VALUE) STORE OPERATIONS
   ========================================================================== */

export async function getMeta(uid, key) {
  if (useFallback) {
    if (!inMemoryStore.meta[uid]) inMemoryStore.meta[uid] = {};
    return inMemoryStore.meta[uid][key];
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.meta[uid]) inMemoryStore.meta[uid] = {};
      return inMemoryStore.meta[uid][key];
    }
    return new Promise((resolve, resolveReject) => {
      const tx = db.transaction('meta', 'readonly');
      const store = tx.objectStore('meta');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolveReject(request.error);
    });
  } catch (err) {
    console.error("[IDB] getMeta error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.meta[uid]) inMemoryStore.meta[uid] = {};
    return inMemoryStore.meta[uid][key];
  }
}

export async function setMeta(uid, key, value) {
  if (useFallback) {
    if (!inMemoryStore.meta[uid]) inMemoryStore.meta[uid] = {};
    inMemoryStore.meta[uid][key] = JSON.parse(JSON.stringify(value));
    return true;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.meta[uid]) inMemoryStore.meta[uid] = {};
      inMemoryStore.meta[uid][key] = JSON.parse(JSON.stringify(value));
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      const request = store.put(value, key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] setMeta error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.meta[uid]) inMemoryStore.meta[uid] = {};
    inMemoryStore.meta[uid][key] = JSON.parse(JSON.stringify(value));
    return true;
  }
}

/* ==========================================================================
   SYNC QUEUE STORE OPERATIONS
   ========================================================================== */

export async function getSyncQueue(uid) {
  if (useFallback) {
    return inMemoryStore.syncQueue[uid] || [];
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      return inMemoryStore.syncQueue[uid] || [];
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] getSyncQueue error, falling back to in-memory:", err);
    useFallback = true;
    return inMemoryStore.syncQueue[uid] || [];
  }
}

export async function saveSyncQueue(uid, queue) {
  if (useFallback) {
    inMemoryStore.syncQueue[uid] = JSON.parse(JSON.stringify(queue));
    return true;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      inMemoryStore.syncQueue[uid] = JSON.parse(JSON.stringify(queue));
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        if (queue.length === 0) {
          resolve(true);
          return;
        }

        let count = 0;
        let hasError = false;

        queue.forEach((item) => {
          const putReq = store.put(item);
          putReq.onsuccess = () => {
            count++;
            if (count === queue.length && !hasError) {
              resolve(true);
            }
          };
          putReq.onerror = (err) => {
            if (!hasError) {
              hasError = true;
              reject(err);
            }
          };
        });
      };

      clearRequest.onerror = () => reject(clearRequest.error);
    });
  } catch (err) {
    console.error("[IDB] saveSyncQueue error, falling back to in-memory:", err);
    useFallback = true;
    inMemoryStore.syncQueue[uid] = JSON.parse(JSON.stringify(queue));
    return true;
  }
}

/* ==========================================================================
   BACKUPS STORE OPERATIONS
   ========================================================================== */

export async function getBackups(uid) {
  if (useFallback) {
    if (!inMemoryStore.backups[uid]) inMemoryStore.backups[uid] = {};
    const list = Object.values(inMemoryStore.backups[uid]);
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return list;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.backups[uid]) inMemoryStore.backups[uid] = {};
      const list = Object.values(inMemoryStore.backups[uid]);
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return list;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('backups', 'readonly');
      const store = tx.objectStore('backups');
      const request = store.getAll();

      request.onsuccess = () => {
        const list = request.result || [];
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] getBackups error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.backups[uid]) inMemoryStore.backups[uid] = {};
    const list = Object.values(inMemoryStore.backups[uid]);
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return list;
  }
}

export async function saveBackup(uid, backup) {
  if (useFallback) {
    if (!inMemoryStore.backups[uid]) inMemoryStore.backups[uid] = {};
    inMemoryStore.backups[uid][backup.id] = JSON.parse(JSON.stringify(backup));
    return true;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.backups[uid]) inMemoryStore.backups[uid] = {};
      inMemoryStore.backups[uid][backup.id] = JSON.parse(JSON.stringify(backup));
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('backups', 'readwrite');
      const store = tx.objectStore('backups');
      const request = store.put(backup);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] saveBackup error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.backups[uid]) inMemoryStore.backups[uid] = {};
    inMemoryStore.backups[uid][backup.id] = JSON.parse(JSON.stringify(backup));
    return true;
  }
}

export async function deleteBackup(uid, backupId) {
  if (useFallback) {
    if (inMemoryStore.backups[uid]) {
      delete inMemoryStore.backups[uid][backupId];
    }
    return true;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (inMemoryStore.backups[uid]) {
        delete inMemoryStore.backups[uid][backupId];
      }
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('backups', 'readwrite');
      const store = tx.objectStore('backups');
      const request = store.delete(backupId);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] deleteBackup error, falling back to in-memory:", err);
    useFallback = true;
    if (inMemoryStore.backups[uid]) {
      delete inMemoryStore.backups[uid][backupId];
    }
    return true;
  }
}

/* ==========================================================================
   ACTIVITIES (TIMELINE) STORE OPERATIONS
   ========================================================================== */

export async function getActivities(uid, clientId = null) {
  if (useFallback) {
    if (!inMemoryStore.activities[uid]) inMemoryStore.activities[uid] = [];
    const list = [...inMemoryStore.activities[uid]];
    if (clientId !== null && clientId !== undefined) {
      const filtered = list.filter(a => Number(a.clientId) === Number(clientId));
      filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return filtered;
    }
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return list;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.activities[uid]) inMemoryStore.activities[uid] = [];
      const list = [...inMemoryStore.activities[uid]];
      if (clientId !== null && clientId !== undefined) {
        const filtered = list.filter(a => Number(a.clientId) === Number(clientId));
        filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        return filtered;
      }
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return list;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('activities', 'readonly');
      const store = tx.objectStore('activities');
      let request;

      if (clientId !== null && clientId !== undefined) {
        const index = store.index('clientId');
        request = index.getAll(Number(clientId));
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const list = request.result || [];
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] getActivities error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.activities[uid]) inMemoryStore.activities[uid] = [];
    const list = [...inMemoryStore.activities[uid]];
    if (clientId !== null && clientId !== undefined) {
      const filtered = list.filter(a => Number(a.clientId) === Number(clientId));
      filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return filtered;
    }
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return list;
  }
}

export async function addActivity(uid, activity) {
  const formatted = {
    ...activity,
    clientId: activity.clientId ? Number(activity.clientId) : null,
    timestamp: activity.timestamp || new Date().toISOString()
  };
  if (useFallback) {
    if (!inMemoryStore.activities[uid]) inMemoryStore.activities[uid] = [];
    formatted.id = Date.now() + Math.floor(Math.random() * 1000);
    inMemoryStore.activities[uid].push(formatted);
    return formatted.id;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      if (!inMemoryStore.activities[uid]) inMemoryStore.activities[uid] = [];
      formatted.id = Date.now() + Math.floor(Math.random() * 1000);
      inMemoryStore.activities[uid].push(formatted);
      return formatted.id;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('activities', 'readwrite');
      const store = tx.objectStore('activities');
      const request = store.add(formatted);

      request.onsuccess = (e) => {
        resolve(e.target.result);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[IDB] addActivity error, falling back to in-memory:", err);
    useFallback = true;
    if (!inMemoryStore.activities[uid]) inMemoryStore.activities[uid] = [];
    formatted.id = Date.now() + Math.floor(Math.random() * 1000);
    inMemoryStore.activities[uid].push(formatted);
    return formatted.id;
  }
}

export async function clearAllUserData(uid) {
  if (useFallback) {
    inMemoryStore.clients[uid] = {};
    inMemoryStore.meta[uid] = {};
    inMemoryStore.syncQueue[uid] = [];
    inMemoryStore.backups[uid] = {};
    inMemoryStore.activities[uid] = [];
    return true;
  }
  try {
    const db = await openUserDB(uid);
    if (useFallback || !db) {
      inMemoryStore.clients[uid] = {};
      inMemoryStore.meta[uid] = {};
      inMemoryStore.syncQueue[uid] = [];
      inMemoryStore.backups[uid] = {};
      inMemoryStore.activities[uid] = [];
      return true;
    }
    return new Promise((resolve, reject) => {
      const stores = ['clients', 'meta', 'syncQueue', 'backups', 'activities'];
      const tx = db.transaction(stores, 'readwrite');
      let completed = 0;
      let hasError = false;

      stores.forEach((storeName) => {
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => {
          completed++;
          if (completed === stores.length && !hasError) {
            resolve(true);
          }
        };
        req.onerror = (err) => {
          if (!hasError) {
            hasError = true;
            reject(err);
          }
        };
      });
    });
  } catch (err) {
    console.error("[IDB] clearAllUserData error, falling back to in-memory:", err);
    useFallback = true;
    inMemoryStore.clients[uid] = {};
    inMemoryStore.meta[uid] = {};
    inMemoryStore.syncQueue[uid] = [];
    inMemoryStore.backups[uid] = {};
    inMemoryStore.activities[uid] = [];
    return true;
  }
}
