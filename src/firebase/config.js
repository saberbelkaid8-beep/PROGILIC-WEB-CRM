import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Clear any leftover browser Firestore IndexedDB or legacy localStorage client caches
function purgeLegacyBrowserDataCaches() {
  if (typeof window === 'undefined') return;
  try {
    const legacyKeys = [
      'crm_clients_cache',
      'crm_stats_cache',
      'crm_nid_cache',
      'crm_sync_queue',
      'crm_currentUser',
      'crm_current_staff'
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
          // Remove only Firestore/CRM data caches; preserve firebaseLocalStorageDb for Auth session
          if (name && (name.startsWith('firestore/') || name.startsWith('PROGILIC_CRM'))) {
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
// Ensure persistence is set for authentication
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Strictly Online Mode: Use memoryLocalCache only (no IndexedDB disk cache, prevents stale data & BloomFilterError)
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.error("Firestore initialization failed:", e);
}

export const db = firestoreDb;

// Validate Connection to Firestore on boot as per Firebase Integration guidelines
export async function testConnection() {
  try {
    const { doc, getDocFromServer } = await import("firebase/firestore");
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("[Firestore] Operating in offline mode or network restricted:", error.message);
    }
  }
}
testConnection();

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure Facebook Auth Provider
export const facebookProvider = new FacebookAuthProvider();

// Configure Apple Auth Provider
export const appleProvider = new OAuthProvider('apple.com');
