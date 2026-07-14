import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence, clearIndexedDbPersistence } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
// Ensure persistence is set for authentication
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Initialize Firestore with custom DB ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable Offline Persistence for Firestore (Enterprise Architecture)
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Multiple tabs open, persistence can only be enabled in one tab at a a time.");
  } else if (err.code === 'unimplemented') {
    console.warn("The current browser does not support all of the features required to enable persistence");
  }
});

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure Facebook Auth Provider
export const facebookProvider = new FacebookAuthProvider();

// Configure Apple Auth Provider
export const appleProvider = new OAuthProvider('apple.com');
