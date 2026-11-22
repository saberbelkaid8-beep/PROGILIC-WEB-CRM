import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Clear ONLY legacy localStorage caches and obsolete custom IDB stores;
// preserve Firebase Auth and Firestore's native persistentLocalCache IndexedDB store.
function purgeLegacyBrowserDataCaches() {
  if (typeof window === 'undefined') return;
  try {
    const legacyKeys = [
      'crm_clients_cache',
      'crm_stats_cache',
      'crm_nid_cache',
      'crm_sync_queue',
      'crm_currentUser',
      'crm_current_staff',
      'crm_active_gerant_user',
      'crm_active_employee_session',
      'crm_logged_out'
    ];
    if (window.localStorage) {
      for (const k of legacyKeys) {
        window.localStorage.removeItem(k);
      }
    }
  } catch (_) {}

  try {
    if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
      window.indexedDB.databases().then((dbs) => {
        for (const dbInfo of (dbs || [])) {
          const name = dbInfo && dbInfo.name;
          // Remove only legacy custom PROGILIC_CRM stores; DO NOT delete firestore/* or firebaseLocalStorageDb!
          if (name && name.startsWith('PROGILIC_CRM')) {
            try {
              window.indexedDB.deleteDatabase(name);
            } catch (_) {}
          }
        }
      }).catch(() => {});
    }
  } catch (_) {}
}
purgeLegacyBrowserDataCaches();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
if (typeof setPersistence === 'function' && auth) {
  setPersistence(auth, browserLocalPersistence).catch(console.error);
}

// Persistent Cache as read/bandwidth optimization ONLY (strictly multi-tab safe, never an independent DB)
let firestoreDb;
try {
  let localCacheConfig;
  try {
    localCacheConfig = persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    });
  } catch (_) {
    localCacheConfig = memoryLocalCache();
  }

  firestoreDb = initializeFirestore(app, {
    localCache: localCacheConfig,
    experimentalForceLongPolling: true
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  try {
    firestoreDb = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true
    }, firebaseConfig.firestoreDatabaseId);
  } catch (fallbackErr) {
    console.error("Firestore initialization failed:", fallbackErr || e);
  }
}

export const db = firestoreDb;

// Verify active Cloud Firestore server reachability
export async function verifyOnlineConnectivity() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { online: false, reason: 'browser-offline' };
  }
  try {
    const fsMod = await import("firebase/firestore");
    if (typeof fsMod.getDocFromServer === 'function' && typeof fsMod.doc === 'function' && db) {
      await fsMod.getDocFromServer(fsMod.doc(db, 'test', 'connection'));
    }
    return { online: true };
  } catch (error) {
    const code = String(error?.code || '').toLowerCase();
    const msg = String(error?.message || '').toLowerCase();
    if (code === 'resource-exhausted' || msg.includes('quota')) {
      return { online: true, quotaExceeded: true, error };
    }
    if (code === 'permission-denied' || msg.includes('permissions')) {
      // Server responded with permission rule -> server is reachable
      return { online: true };
    }
    if (msg.includes('offline') || code === 'unavailable') {
      return { online: false, reason: 'firestore-offline', error };
    }
    return { online: navigator?.onLine !== false, error };
  }
}

// Validate Connection to Firestore when authenticated
export async function testConnection() {
  if (!auth || !auth.currentUser) return false;
  try {
    const fsMod = await import("firebase/firestore");
    if (typeof fsMod.getDocFromServer === 'function' && typeof fsMod.doc === 'function' && db) {
      await fsMod.getDocFromServer(fsMod.doc(db, 'test', 'connection'));
      return true;
    }
    return false;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("[Firestore] Operating in offline mode or network restricted:", error.message);
    }
    return false;
  }
}

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure Facebook Auth Provider
export const facebookProvider = new FacebookAuthProvider();

// Configure Apple Auth Provider
export const appleProvider = new OAuthProvider('apple.com');
