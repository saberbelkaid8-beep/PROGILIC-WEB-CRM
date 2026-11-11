/**
 * PROGILIC CRM v3 — Server-Side Firebase Admin Foundation
 * 
 * Provides safe singleton initialization of Firebase Admin SDK
 * using Application Default Credentials (ADC) or project configuration.
 * Strictly server-side: never imported or exposed to browser bundles.
 */

import { initializeApp, getApps, getApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let adminApp = null;
let adminFirestore = null;
let adminAuth = null;
let mockFirestoreOverride = null;
let mockAuthOverride = null;

// Load base project config for default projectId and database ID
let baseConfig = {};
try {
  const configPath = path.resolve(__dirname, '../../firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    baseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('[Firebase Admin] Notice reading firebase-applet-config.json:', e.message);
}

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ||
                   process.env.GCLOUD_PROJECT ||
                   baseConfig.projectId ||
                   'gen-lang-client-0400245577';

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ||
                    baseConfig.firestoreDatabaseId ||
                    '(default)';

let adminInitStatus = 'UNINITIALIZED';
let adminInitError = null;

/**
 * Initializes Firebase Admin as a singleton.
 * Safe against multiple initializations and server restarts.
 */
export function initFirebaseAdmin(options = {}) {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    adminInitStatus = 'READY';
    adminInitError = null;
  } else {
    adminInitStatus = 'INITIALIZING';
    try {
      const appOptions = {
        projectId: options.projectId || PROJECT_ID
      };

      // Credential resolution order:
      // 1. GOOGLE_APPLICATION_CREDENTIALS file
      // 2. FIREBASE_SERVICE_ACCOUNT_KEY inline JSON
      // 3. Application Default Credentials (ADC) in Google Cloud Run
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        appOptions.credential = applicationDefault();
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const parsedKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          appOptions.credential = cert(parsedKey);
        } catch (_) {
          appOptions.credential = applicationDefault();
        }
      } else {
        try {
          appOptions.credential = applicationDefault();
        } catch (_) {
          // In local test runner without GCP ADC credentials
        }
      }

      adminApp = initializeApp(appOptions);
      adminInitStatus = 'READY';
      adminInitError = null;
      console.log(`[Firebase Admin] Initialized successfully for project: ${PROJECT_ID}`);
    } catch (err) {
      adminInitStatus = 'FAILED';
      adminInitError = err.message || 'INITIALIZATION_FAILED';
      console.warn(`[Firebase Admin] Initialization error: ${err.message}. Admin SDK will not be operational.`);
      adminApp = null;
    }
  }

  return adminApp;
}

/**
 * Returns the server-side Firestore instance with correct database targeting.
 */
export function getAdminFirestore() {
  if (mockFirestoreOverride) {
    return mockFirestoreOverride;
  }

  if (!adminFirestore) {
    const app = initFirebaseAdmin();
    if (app) {
      try {
        if (DATABASE_ID && DATABASE_ID !== '(default)') {
          adminFirestore = getFirestore(app, DATABASE_ID);
        } else {
          adminFirestore = getFirestore(app);
        }
      } catch (err) {
        console.warn('[Firebase Admin] Firestore instance creation error:', err.message);
      }
    }
  }

  return adminFirestore;
}

/**
 * Returns the server-side Auth instance for ID token verification.
 */
export function getAdminAuth() {
  if (mockAuthOverride) {
    return mockAuthOverride;
  }

  if (!adminAuth) {
    const app = initFirebaseAdmin();
    if (app) {
      try {
        adminAuth = getAuth(app);
      } catch (err) {
        console.warn('[Firebase Admin] Auth instance creation error:', err.message);
      }
    }
  }

  return adminAuth;
}

/**
 * Checks if Firebase Admin is currently operational.
 */
export function isFirebaseAdminAvailable() {
  return Boolean(mockFirestoreOverride || (adminApp && adminFirestore));
}

/**
 * Returns current initialization and connection status of Firebase Admin.
 * Safe for health reporting: exposes no secrets or credential data.
 */
export function getFirebaseAdminStatus() {
  return {
    status: mockFirestoreOverride ? 'READY' : adminInitStatus,
    error: adminInitError,
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    hasApp: Boolean(adminApp || mockFirestoreOverride),
    hasFirestore: Boolean(adminFirestore || mockFirestoreOverride),
    hasAuth: Boolean(adminAuth || mockAuthOverride)
  };
}

/**
 * Performs a safe, non-destructive probe to verify Firestore connectivity.
 * Reads a single document with limit(1) from the users collection without writing or mutating data.
 */
export async function checkFirestoreReadiness() {
  if (mockFirestoreOverride) {
    if (typeof mockFirestoreOverride.collection === 'function') {
      try {
        await mockFirestoreOverride.collection('users').limit(1).get();
        return { operational: true, source: 'mock_test_override' };
      } catch (mockErr) {
        return { operational: false, reason: 'MOCK_FIRESTORE_ERROR', error: mockErr.message };
      }
    }
    return { operational: true, source: 'mock_test_override' };
  }

  const firestore = getAdminFirestore();
  if (!firestore) {
    return {
      operational: false,
      reason: adminInitError ? `ADMIN_INIT_FAILED: ${adminInitError}` : 'FIRESTORE_NOT_INITIALIZED'
    };
  }

  try {
    const startTime = Date.now();
    await firestore.collection('users').limit(1).get();
    const latencyMs = Date.now() - startTime;
    return {
      operational: true,
      latencyMs,
      projectId: PROJECT_ID,
      databaseId: DATABASE_ID
    };
  } catch (err) {
    return {
      operational: false,
      reason: 'FIRESTORE_PROBE_FAILED',
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message ? err.message.slice(0, 100) : 'Firestore probe failed'
    };
  }
}

/**
 * Dependency injection for automated unit and integration tests.
 */
export function setAdminFirestoreForTesting(mockDb) {
  mockFirestoreOverride = mockDb;
}

export function setAdminAuthForTesting(mockAuth) {
  mockAuthOverride = mockAuth;
}

export function resetFirebaseAdminForTesting() {
  mockFirestoreOverride = null;
  mockAuthOverride = null;
  adminApp = null;
  adminFirestore = null;
  adminAuth = null;
  adminInitStatus = 'UNINITIALIZED';
  adminInitError = null;
}

