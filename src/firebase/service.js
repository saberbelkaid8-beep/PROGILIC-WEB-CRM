import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  runTransaction, 
  writeBatch,
  deleteField
} from 'firebase/firestore';
import { db, auth } from './config.js';

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
  TRANSACTION: 'transaction',
  MIGRATION: 'migration'
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 1. User Profile & Global Pre-aggregated Stats
export async function getUserData(userId) {
console.log("getUserData: start");

  const path = `users/${userId}`;
  try {
    const docRef = doc(db, path);
    console.log("getUserData: before getDoc");
const snap = await getDoc(docRef);
console.log("getUserData: after getDoc");

    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserData(userId, data) {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 2. Client CRUD & Subcollections Load/Save Engine

// Fetches the clients collection for listing with optional pagination and limit
export async function getClientsPage(userId, limitVal = 100, lastDoc = null) {
  const path = `users/${userId}/clients`;
  try {
    const collRef = collection(db, path);
    let q;
    if (lastDoc) {
      q = query(collRef, orderBy('id'), startAfter(lastDoc), limit(limitVal));
    } else {
      q = query(collRef, orderBy('id'), limit(limitVal));
    }
    const snap = await getDocs(q);
    return {
      docs: snap.docs,
      clients: snap.docs.map(d => ({ ...d.data(), firestoreId: d.id }))
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Fetches all subcollections (programs, issues, requirements, contacts) of a client to reconstruct the legacy interface
export async function getClientSubcollections(userId, clientId) {
  const basePath = `users/${userId}/clients/${clientId}`;
  try {
    const [progsSnap, issuesSnap, reqsSnap, contactsSnap] = await Promise.all([
      getDocs(collection(db, `${basePath}/programs`)),
      getDocs(collection(db, `${basePath}/issues`)),
      getDocs(collection(db, `${basePath}/requirements`)),
      getDocs(collection(db, `${basePath}/contacts`))
    ]);

    return {
      programs: progsSnap.docs.map(d => d.data()),
      issues: issuesSnap.docs.map(d => d.data()),
      requirements: reqsSnap.docs.map(d => d.data()),
      contactHistory: contactsSnap.docs.map(d => d.data())
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, basePath);
  }
}

// Transaction: Create client and initialize stats
export async function addClientTransaction(userId, clientData, globalStats) {
  const userPath = `users/${userId}`;
  const clientId = String(clientData.id);
  const clientPath = `users/${userId}/clients/${clientId}`;

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);

      // Verify and set user metadata update
      tx.set(clientRef, {
        ...clientData,
        openIssuesCount: 0,
        requirementsCount: 0,
        programsCount: 0,
        installationsCount: 0,
        score: clientData.score || 100,
        updatedAt: new Date().toISOString()
      });

      // Update pre-aggregated user stats
      const nextStats = { ...globalStats };
      nextStats.totalClients = (nextStats.totalClients || 0) + 1;
      if (clientData.status === 'نشط') nextStats.activeClients = (nextStats.activeClients || 0) + 1;
      else if (clientData.status === 'محتمل') nextStats.prospectiveClients = (nextStats.prospectiveClients || 0) + 1;
      else if (clientData.status === 'متوقف') nextStats.stoppedClients = (nextStats.stoppedClients || 0) + 1;

      tx.update(userRef, {
        stats: nextStats,
        nid: clientData.id,
        updatedAt: new Date().toISOString()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath);
  }
}

// Transaction: Update client and adjust stats if status changed
export async function updateClientTransaction(userId, clientId, clientData, oldStatus, globalStats) {
  const userPath = `users/${userId}`;
  const clientPath = `users/${userId}/clients/${clientId}`;

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);

      tx.update(clientRef, {
        ...clientData,
        updatedAt: new Date().toISOString()
      });

      if (oldStatus !== clientData.status) {
        const nextStats = { ...globalStats };
        // Decrement old status
        if (oldStatus === 'نشط') nextStats.activeClients = Math.max(0, (nextStats.activeClients || 0) - 1);
        else if (oldStatus === 'محتمل') nextStats.prospectiveClients = Math.max(0, (nextStats.prospectiveClients || 0) - 1);
        else if (oldStatus === 'متوقف') nextStats.stoppedClients = Math.max(0, (nextStats.stoppedClients || 0) - 1);

        // Increment new status
        if (clientData.status === 'نشط') nextStats.activeClients = (nextStats.activeClients || 0) + 1;
        else if (clientData.status === 'محتمل') nextStats.prospectiveClients = (nextStats.prospectiveClients || 0) + 1;
        else if (clientData.status === 'متوقف') nextStats.stoppedClients = (nextStats.stoppedClients || 0) + 1;

        tx.update(userRef, {
          stats: nextStats,
          updatedAt: new Date().toISOString()
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath);
  }
}

// Transaction: Delete client and adjust stats
export async function deleteClientTransaction(userId, clientId, clientData, globalStats) {
  const userPath = `users/${userId}`;
  const clientPath = `users/${userId}/clients/${clientId}`;

  try {
    // Delete subcollections in a separate batch first
    const basePath = `users/${userId}/clients/${clientId}`;
    const [progs, issues, reqs, contacts] = await Promise.all([
      getDocs(collection(db, `${basePath}/programs`)),
      getDocs(collection(db, `${basePath}/issues`)),
      getDocs(collection(db, `${basePath}/requirements`)),
      getDocs(collection(db, `${basePath}/contacts`))
    ]);

    const batch = writeBatch(db);
    progs.docs.forEach(d => batch.delete(d.ref));
    issues.docs.forEach(d => batch.delete(d.ref));
    reqs.docs.forEach(d => batch.delete(d.ref));
    contacts.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    // Now run transactional delete for client and stats decrement
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);

      tx.delete(clientRef);

      const nextStats = { ...globalStats };
      nextStats.totalClients = Math.max(0, (nextStats.totalClients || 0) - 1);
      if (clientData.status === 'نشط') nextStats.activeClients = Math.max(0, (nextStats.activeClients || 0) - 1);
      else if (clientData.status === 'محتمل') nextStats.prospectiveClients = Math.max(0, (nextStats.prospectiveClients || 0) - 1);
      else if (clientData.status === 'متوقف') nextStats.stoppedClients = Math.max(0, (nextStats.stoppedClients || 0) - 1);

      // Reduce total programs and installations counts
      nextStats.totalPrograms = Math.max(0, (nextStats.totalPrograms || 0) - (clientData.programsCount || 0));
      nextStats.totalLicensedDevices = Math.max(0, (nextStats.totalLicensedDevices || 0) - (clientData.installationsCount || 0));
      nextStats.totalOpenIssues = Math.max(0, (nextStats.totalOpenIssues || 0) - (clientData.openIssuesCount || 0));

      tx.update(userRef, {
        stats: nextStats,
        updatedAt: new Date().toISOString()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath);
  }
}

// Generic helper to save an item inside a client subcollection and run transaction to update denormalized counters
export async function saveClientSubItemTransaction(userId, clientId, collectionName, itemId, itemData, counterUpdates, globalStatsUpdates) {
  const clientPath = `users/${userId}/clients/${clientId}`;
  const itemPath = `${clientPath}/${collectionName}/${itemId}`;
  const userPath = `users/${userId}`;

  try {
    await runTransaction(db, async (tx) => {
      const clientRef = doc(db, clientPath);
      const itemRef = doc(db, itemPath);
      const userRef = doc(db, userPath);

      // Write subcollection document
      tx.set(itemRef, itemData, { merge: true });

      // Update denormalized properties on client document
      tx.update(clientRef, {
        ...counterUpdates,
        updatedAt: new Date().toISOString()
      });

      // Update global pre-aggregated counters
      if (globalStatsUpdates) {
        tx.update(userRef, {
          stats: globalStatsUpdates,
          updatedAt: new Date().toISOString()
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, itemPath);
  }
}

// Generic helper to delete an item inside a client subcollection and run transaction to update denormalized counters
export async function deleteClientSubItemTransaction(userId, clientId, collectionName, itemId, counterUpdates, globalStatsUpdates) {
  const clientPath = `users/${userId}/clients/${clientId}`;
  const itemPath = `${clientPath}/${collectionName}/${itemId}`;
  const userPath = `users/${userId}`;

  try {
    await runTransaction(db, async (tx) => {
      const clientRef = doc(db, clientPath);
      const itemRef = doc(db, itemPath);
      const userRef = doc(db, userPath);

      // Delete subcollection document
      tx.delete(itemRef);

      // Update denormalized properties on client document
      tx.update(clientRef, {
        ...counterUpdates,
        updatedAt: new Date().toISOString()
      });

      // Update global pre-aggregated counters
      if (globalStatsUpdates) {
        tx.update(userRef, {
          stats: globalStatsUpdates,
          updatedAt: new Date().toISOString()
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, itemPath);
  }
}

