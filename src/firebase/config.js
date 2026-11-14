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

// Initialize Firestore with modern multi-tab persistent cache and forced long-polling to prevent iframe/proxy 10s stream timeouts
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("Falling back to memory Firestore cache:", e);
  try {
    firestoreDb = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true
    }, firebaseConfig.firestoreDatabaseId);
  } catch (e2) {
    console.error("Firestore initialization failed:", e2);
  }
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
