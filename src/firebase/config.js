import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
// Ensure persistence is set for authentication
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Initialize Firestore with modern multi-tab persistent cache
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("Falling back to memory Firestore cache:", e);
  try {
    firestoreDb = initializeFirestore(app, {
      localCache: memoryLocalCache()
    }, firebaseConfig.firestoreDatabaseId);
  } catch (e2) {
    console.error("Firestore initialization failed:", e2);
  }
}

export const db = firestoreDb;

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure Facebook Auth Provider
export const facebookProvider = new FacebookAuthProvider();

// Configure Apple Auth Provider
export const appleProvider = new OAuthProvider('apple.com');
