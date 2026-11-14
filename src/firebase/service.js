import { 
  doc, 
  getDocFromServer,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  getDocsFromServer,
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  runTransaction, 
  writeBatch,
  deleteField,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from './config.js';
import { validateClient } from './validation.js';

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
  if (!auth?.currentUser) {
    return null;
  }
  const errInfo = {
    code: error?.code || 'unknown',
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser.uid,
      email: auth.currentUser.email || null,
      emailVerified: Boolean(auth.currentUser.emailVerified),
      isAnonymous: Boolean(auth.currentUser.isAnonymous)
    }
  };
  console.error('Firestore operation failed:', JSON.stringify(errInfo));
  const wrappedError = new Error(JSON.stringify(errInfo));
  wrappedError.code = errInfo.code;
  wrappedError.cause = error;
  throw wrappedError;
}

function sanitizeUserId(userId) {
  if (auth && auth.currentUser && auth.currentUser.uid) {
    return auth.currentUser.uid;
  }
  if (!userId || userId === 'gerant_active_user' || String(userId).startsWith('emp_')) {
    return (auth && auth.currentUser && auth.currentUser.uid) || null;
  }
  return userId;
}

// 1. User Profile & Global Pre-aggregated Stats
export async function getUserData(userId) {
  if (auth && !auth.currentUser) return null;
  userId = sanitizeUserId(userId);
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, path);
    const snap = await getDocFromServer(docRef);
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    return handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserData(userId, data) {
  if (auth && !auth.currentUser) {
    console.log("[Firestore] User is not signed in to Firebase Auth. Skipping remote user doc write.");
    return;
  }
  userId = sanitizeUserId(userId);
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
  userId = sanitizeUserId(userId);
  const path = `users/${userId}/clients`;
  try {
    const collRef = collection(db, path);
    let q;
    if (lastDoc) {
      q = query(collRef, orderBy('id'), startAfter(lastDoc), limit(limitVal));
    } else {
      q = query(collRef, orderBy('id'), limit(limitVal));
    }
    const snap = await getDocsFromServer(q);
    return {
      docs: snap.docs,
      clients: snap.docs.map(clientDoc => {
        const data = clientDoc.data();
        const numericId = Number(clientDoc.id);
        return {
          ...data,
          id: data.id ?? (Number.isSafeInteger(numericId) ? numericId : clientDoc.id),
          firestoreId: clientDoc.id
        };
      })
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getClientsFromServer(userId) {
  userId = sanitizeUserId(userId);
  if (!userId) return [];
  const path = `users/${userId}/clients`;
  try {
    const snapshot = await getDocsFromServer(collection(db, path));
    const cloudClients = snapshot.docs.map(clientDoc => {
      const data = clientDoc.data();
      const numericId = Number(clientDoc.id);
      return {
        ...data,
        id: data.id ?? (Number.isSafeInteger(numericId) ? numericId : clientDoc.id),
        firestoreId: clientDoc.id
      };
    });
    const userData = await getUserData(userId);
    const legacyClients = Array.isArray(userData?.clients) ? userData.clients : [];
    const mergedById = new Map();

    legacyClients.forEach(client => {
      if (!client || typeof client !== 'object') return;
      const sourceId = client.id ?? client.firestoreId;
      if (sourceId === undefined || sourceId === null) return;
      const numericId = Number(sourceId);
      const id = Number.isSafeInteger(numericId) ? numericId : sourceId;
      mergedById.set(String(id), { ...client, id, _subcollectionsLoaded: false });
    });

    cloudClients.forEach(client => {
      const key = String(client.id);
      const legacyClient = mergedById.get(key);
      const mergedClient = { ...legacyClient, ...client };
      ['programs', 'issues', 'requirements', 'contactHistory'].forEach(field => {
        if (Array.isArray(legacyClient?.[field]) && legacyClient[field].length > 0
          && (!Array.isArray(client[field]) || client[field].length === 0)) {
          mergedClient[field] = legacyClient[field];
        }
      });
      mergedById.set(key, mergedClient);
    });

    return Array.from(mergedById.values());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getClientFromServer(userId, clientId) {
  userId = sanitizeUserId(userId);
  if (!userId || !clientId) return null;
  const path = `users/${userId}/clients/${clientId}`;
  try {
    const snapshot = await getDocFromServer(doc(db, path));
    if (snapshot.exists()) {
      const data = snapshot.data();
      const numericId = Number(snapshot.id);
      return {
        ...data,
        id: data.id ?? (Number.isSafeInteger(numericId) ? numericId : snapshot.id),
        firestoreId: snapshot.id
      };
    }

    const serverClients = await getClientsFromServer(userId);
    const matchingClient = serverClients.find(client =>
      String(client.id) === String(clientId) || String(client.firestoreId) === String(clientId)
    );
    if (matchingClient) return matchingClient;

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export const getClientById = getClientFromServer;

// Fetches all subcollections (programs, issues, requirements, contacts) of a client to reconstruct the legacy interface
export async function getClientSubcollections(userId, clientId) {
  userId = sanitizeUserId(userId);
  const basePath = `users/${userId}/clients/${clientId}`;
  try {
    const [progsSnap, issuesSnap, reqsSnap, contactsSnap] = await Promise.all([
      getDocsFromServer(collection(db, `${basePath}/programs`)),
      getDocsFromServer(collection(db, `${basePath}/issues`)),
      getDocsFromServer(collection(db, `${basePath}/requirements`)),
      getDocsFromServer(collection(db, `${basePath}/contacts`))
    ]);

    const mapDocuments = snapshot => snapshot.docs.map(document => {
      const data = document.data() || {};
      const numericId = Number(document.id);
      return {
        ...data,
        id: data.id ?? (Number.isSafeInteger(numericId) ? numericId : document.id)
      };
    });

    return {
      programs: mapDocuments(progsSnap),
      issues: mapDocuments(issuesSnap),
      requirements: mapDocuments(reqsSnap),
      contactHistory: mapDocuments(contactsSnap)
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, basePath);
  }
}

// Transaction: Create client and initialize stats
export async function addClientTransaction(userId, clientData, globalStats) {
  userId = sanitizeUserId(userId);
  const userPath = `users/${userId}`;
  const clientId = String(clientData.id);
  const clientPath = `users/${userId}/clients/${clientId}`;
  let computedNextStats = null;

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);

      const userSnap = typeof tx.get === 'function' ? await tx.get(userRef) : null;
      const existingUser = userSnap && typeof userSnap.exists === 'function' && userSnap.exists()
        ? (userSnap.data() || {})
        : {};

      const progs = Array.isArray(clientData.programs) ? clientData.programs : [];
      const openIssues = Array.isArray(clientData.issues) ? clientData.issues.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')) : [];
      const reqs = Array.isArray(clientData.requirements) ? clientData.requirements : [];
      const totalInstalls = progs.reduce((total, program) => {
        const count = Number(program?.installationsCount);
        return Number.isSafeInteger(count) && count > 0 ? total + count : total;
      }, 0);

      // Update pre-aggregated user stats once cleanly from base stats
      const baseStats = globalStats || existingUser.stats || {};
      const nextStats = { ...baseStats };
      nextStats.totalClients = (nextStats.totalClients || 0) + 1;
      if (clientData.status === 'نشط') nextStats.activeClients = (nextStats.activeClients || 0) + 1;
      else if (clientData.status === 'محتمل') nextStats.prospectiveClients = (nextStats.prospectiveClients || 0) + 1;
      else if (clientData.status === 'متوقف') nextStats.stoppedClients = (nextStats.stoppedClients || 0) + 1;

      if (progs.length > 0) {
        nextStats.totalPrograms = (nextStats.totalPrograms || 0) + progs.length;
        nextStats.totalLicensedDevices = (nextStats.totalLicensedDevices || 0) + totalInstalls;
      }
      computedNextStats = nextStats;

      // Verify and set client metadata
      tx.set(clientRef, {
        ...clientData,
        version: 1, // OCC: Initial version
        openIssuesCount: openIssues.length,
        requirementsCount: reqs.length,
        programsCount: progs.length,
        installationsCount: totalInstalls,
        programNames: progs.map(p => p.programName).filter(Boolean),
        score: clientData.score || 100,
        updatedAt: new Date().toISOString()
      });

      // Write initial program subdocuments if created with new client
      progs.forEach(prog => {
        if (prog && prog.id !== undefined && prog.id !== null) {
          const progRef = doc(db, `${clientPath}/programs/${prog.id}`);
          tx.set(progRef, prog, { merge: true });
        }
      });

      // Write initial issue subdocuments if created with new client
      if (Array.isArray(clientData.issues)) {
        clientData.issues.forEach(iss => {
          if (iss && iss.id) {
            const issRef = doc(db, `${clientPath}/issues/${iss.id}`);
            tx.set(issRef, iss, { merge: true });
          }
        });
      }

      // Write initial requirement subdocuments if created with new client
      if (Array.isArray(clientData.requirements)) {
        clientData.requirements.forEach(req => {
          if (req && req.id) {
            const reqRef = doc(db, `${clientPath}/requirements/${req.id}`);
            tx.set(reqRef, req, { merge: true });
          }
        });
      }

      const userPayload = {
        v: existingUser.v || 3,
        stats: nextStats,
        nid: Math.max(Number(existingUser.nid) || 0, Number(clientData.id) || 0),
        updatedAt: new Date().toISOString()
      };
      if (typeof tx.set === 'function') {
        tx.set(userRef, userPayload, { merge: true });
      } else if (typeof tx.update === 'function') {
        tx.update(userRef, userPayload);
      }
    });
    return computedNextStats;
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath);
    return null;
  }
}

// Transaction: Update client and adjust stats if status changed
export async function updateClientTransaction(userId, clientId, clientData, oldStatus, globalStats, baseVersion = 0) {
  userId = sanitizeUserId(userId);
  const userPath = `users/${userId}`;
  const clientPath = `users/${userId}/clients/${clientId}`;

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);

      const docSnap = await tx.get(clientRef);
      if (docSnap.exists()) {
        const currentVersion = docSnap.data().version || 0;
        if (currentVersion > baseVersion && baseVersion > 0) {
          const conflictError = new Error('VERSION_CONFLICT');
          conflictError.code = 'VERSION_CONFLICT';
          conflictError.serverData = docSnap.data();
          throw conflictError;
        }
      }

      tx.update(clientRef, {
        ...clientData,
        version: Math.max(baseVersion || 0, docSnap.exists() ? (docSnap.data().version || 0) : 0) + 1,
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
    if (error.code === 'VERSION_CONFLICT') {
      throw error;
    }
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath);
  }
}

// Transaction: Delete client and adjust stats
export async function deleteClientTransaction(userId, clientId, clientData, globalStats) {
  userId = sanitizeUserId(userId);
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
export async function saveClientSubItemTransaction(userId, clientId, collectionName, itemId, itemData, counterUpdates, globalStatsUpdates, recoveryClient = null) {
  userId = sanitizeUserId(userId);
  const clientPath = `users/${userId}/clients/${clientId}`;
  const itemPath = `${clientPath}/${collectionName}/${itemId}`;
  const userPath = `users/${userId}`;

  try {
    await runTransaction(db, async (tx) => {
      const clientRef = doc(db, clientPath);
      const itemRef = doc(db, itemPath);
      const userRef = doc(db, userPath);

      const clientPatch = {
        ...counterUpdates,
        updatedAt: new Date().toISOString()
      };

      const clientSnapshot = typeof tx.get === 'function' ? await tx.get(clientRef) : null;
      const clientExists = typeof clientSnapshot?.exists === 'function' ? clientSnapshot.exists() : true;

      if (!clientExists) {
        if (!recoveryClient) {
          const missingClientError = new Error(`Cannot save ${collectionName} record: client ${clientId} is missing from Firestore.`);
          missingClientError.code = 'client-not-found';
          throw missingClientError;
        }

        const clientIdNumber = Number(recoveryClient.id);
        if (!Number.isSafeInteger(clientIdNumber)) {
          throw new TypeError('Cannot restore the missing client: its CRM ID is invalid.');
        }

        const clientRecord = validateClient({
          ...recoveryClient,
          id: clientIdNumber,
          ...counterUpdates,
          version: Math.max(Number(recoveryClient.version) || 0, 1),
          _subcollectionsLoaded: true,
          updatedAt: clientPatch.updatedAt
        });
        clientRecord.programs = Array.isArray(recoveryClient.programs) ? recoveryClient.programs : [];
        clientRecord.issues = Array.isArray(recoveryClient.issues) ? recoveryClient.issues : [];
        clientRecord.requirements = Array.isArray(recoveryClient.requirements) ? recoveryClient.requirements : [];
        clientRecord.contactHistory = Array.isArray(recoveryClient.contactHistory) ? recoveryClient.contactHistory : [];

        tx.set(clientRef, clientRecord);
        tx.set(itemRef, itemData, { merge: true });
      } else {
        tx.set(itemRef, itemData, { merge: true });
        if (typeof tx.update === 'function') {
          tx.update(clientRef, clientPatch);
        } else {
          tx.set(clientRef, clientPatch, { merge: true });
        }
      }

      // Update global pre-aggregated counters
      if (globalStatsUpdates) {
        const userPatch = {
          stats: globalStatsUpdates,
          updatedAt: new Date().toISOString()
        };
        if (typeof tx.update === 'function') {
          tx.update(userRef, userPatch);
        } else {
          tx.set(userRef, userPatch, { merge: true });
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, itemPath);
  }
}

// Generic helper to delete an item inside a client subcollection and run transaction to update denormalized counters
export async function deleteClientSubItemTransaction(userId, clientId, collectionName, itemId, counterUpdates, globalStatsUpdates) {
  userId = sanitizeUserId(userId);
  const clientPath = `users/${userId}/clients/${clientId}`;
  const itemPath = `${clientPath}/${collectionName}/${itemId}`;
  const userPath = `users/${userId}`;

  try {
    await runTransaction(db, async (tx) => {
      const clientRef = doc(db, clientPath);
      const itemRef = doc(db, itemPath);
      const userRef = doc(db, userPath);

      if (typeof tx.get === 'function') {
        await tx.get(clientRef);
      }

      // Delete subcollection document
      tx.delete(itemRef);

      // Update denormalized properties on client document
      const clientPatch = {
        ...counterUpdates,
        updatedAt: new Date().toISOString()
      };
      if (typeof tx.update === 'function') {
        tx.update(clientRef, clientPatch);
      } else {
        tx.set(clientRef, clientPatch, { merge: true });
      }

      // Update global pre-aggregated counters
      if (globalStatsUpdates) {
        const userPatch = {
          stats: globalStatsUpdates,
          updatedAt: new Date().toISOString()
        };
        if (typeof tx.update === 'function') {
          tx.update(userRef, userPatch);
        } else {
          tx.set(userRef, userPatch, { merge: true });
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, itemPath);
  }
}

export async function saveClientSubItemsBatch(userId, entries = []) {
  const safeUserId = sanitizeUserId(userId);
  if (!safeUserId || !Array.isArray(entries) || entries.length === 0) return 0;

  const CHUNK_SIZE = 100; // <= 2 ops per entry = max 200 ops per Firestore batch
  let savedCount = 0;

  try {
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const entry of chunk) {
        if (!entry || entry.clientId === undefined || entry.clientId === null || !entry.collectionName || !entry.itemId) {
          continue;
        }
        const clientPath = `users/${safeUserId}/clients/${String(entry.clientId)}`;
        const itemRef = doc(db, `${clientPath}/${entry.collectionName}/${String(entry.itemId)}`);
        batch.set(itemRef, entry.itemData || {}, { merge: true });

        if (entry.counterUpdates) {
          const clientRef = doc(db, clientPath);
          const patch = {
            ...entry.counterUpdates,
            updatedAt: new Date().toISOString()
          };
          if (typeof batch.update === 'function') {
            batch.update(clientRef, patch);
          } else {
            batch.set(clientRef, patch, { merge: true });
          }
        }
        savedCount += 1;
      }
      await batch.commit();
    }
    return savedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${safeUserId}/clients`);
    return 0;
  }
}

// 3. Tenant-Isolated Employees CRUD operations
export function sanitizeEmployeeForFirestore(emp, tenantId) {
  if (!emp) return null;
  const tid = tenantId || (auth?.currentUser ? auth.currentUser.uid : 'default');
  const safeId = String(emp.id || `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  const fullName = String(emp.fullName || emp.name || 'موظف');
  const name = String(emp.name || emp.fullName || 'موظف');
  const username = String(emp.username || safeId).toLowerCase().trim();
  const department = String(emp.department || 'pre_vente');
  const status = (emp.status === 'معطل' || emp.status === 'inactive') ? 'معطل' : 'نشط';

  const clean = {
    id: safeId,
    tenantId: tid,
    fullName: fullName.slice(0, 100),
    name: name.slice(0, 100),
    username: username.slice(0, 50),
    department: department.slice(0, 100),
    status: status,
    position: String(emp.position || 'موظف').slice(0, 100),
    supervisor: String(emp.supervisor || 'المدير العام (Gérant)').slice(0, 100),
    phone: String(emp.phone || '').slice(0, 30),
    email: String(emp.email || '').slice(0, 100),
    tasks: String(emp.tasks || '').slice(0, 2000),
    role: String(emp.role || 'employee').slice(0, 50),
    createdAt: String(emp.createdAt || new Date().toISOString().split('T')[0]),
    updatedAt: new Date().toISOString(),
    permissions: (emp.permissions && typeof emp.permissions === 'object') ? emp.permissions : {}
  };

  if (emp.adminEmail) clean.adminEmail = String(emp.adminEmail).slice(0, 100);
  else if (auth?.currentUser?.email) clean.adminEmail = String(auth.currentUser.email).slice(0, 100);

  if (emp.lastLogin) clean.lastLogin = String(emp.lastLogin).slice(0, 100);
  if (emp.passwordHash) clean.passwordHash = String(emp.passwordHash);
  if (emp.passwordSalt) clean.passwordSalt = String(emp.passwordSalt);

  return clean;
}

export async function getEmployeesForTenant(tenantId) {
  if (!tenantId) return [];
  const path = `users/${tenantId}/employees`;
  try {
    const collRef = collection(db, path);
    const snap = await getDocs(collRef);
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveEmployeeForTenant(tenantId, employee) {
  if (!tenantId || !employee || !employee.id) return null;
  const safeId = String(employee.id);
  const path = `users/${tenantId}/employees/${safeId}`;
  try {
    const payload = sanitizeEmployeeForFirestore(employee, tenantId);
    if (!payload) return null;

    const docRef = doc(db, path);
    await setDoc(docRef, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
  }
}

export async function deleteEmployeeForTenant(tenantId, employeeId) {
  if (!tenantId || !employeeId) return false;
  const safeId = String(employeeId);
  const path = `users/${tenantId}/employees/${safeId}`;
  try {
    const docRef = doc(db, path);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

export function subscribeEmployeesForTenant(tenantId, onUpdate, onError) {
  if (!tenantId) return () => {};
  const path = `users/${tenantId}/employees`;
  try {
    const collRef = collection(db, path);
    return onSnapshot(collRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      if (typeof onUpdate === 'function') {
        onUpdate(list);
      }
    }, (error) => {
      console.warn("Employees realtime sync notice:", error);
      if (typeof onError === 'function') onError(error);
    });
  } catch (err) {
    console.warn("Failed creating employees subscription:", err);
    return () => {};
  }
}

function normalizeActivityPayload(safeTenantId, activity) {
  let safeClientId = null;
  if (activity.clientId !== null && activity.clientId !== undefined) {
    if (typeof activity.clientId === 'number' && !Number.isNaN(activity.clientId)) {
      safeClientId = activity.clientId;
    } else if (typeof activity.clientId === 'string' && activity.clientId.trim() !== '') {
      const parsed = Number(activity.clientId);
      safeClientId = !Number.isNaN(parsed) ? parsed : activity.clientId.slice(0, 128);
    }
  }

  let safeMeta = {};
  if (activity.meta && typeof activity.meta === 'object' && !Array.isArray(activity.meta)) {
    try {
      safeMeta = JSON.parse(JSON.stringify(activity.meta));
    } catch (_) {
      safeMeta = {};
    }
  }

  return {
    id: String(activity.id).slice(0, 128),
    clientId: safeClientId,
    clientName: String(activity.clientName || '').slice(0, 100),
    type: String(activity.type || 'UNKNOWN').slice(0, 50),
    category: String(activity.category || 'system').slice(0, 30),
    title: String(activity.title || '').slice(0, 200),
    description: String(activity.description || '').slice(0, 2000),
    timestamp: String(activity.timestamp || new Date().toISOString()).slice(0, 40),
    userName: String(activity.userName || '').slice(0, 100),
    userRole: String(activity.userRole || '').slice(0, 100),
    userId: String(activity.userId || '').slice(0, 128),
    actorUid: safeTenantId,
    actorEmail: String(activity.actorEmail || (auth && auth.currentUser && auth.currentUser.email) || '').slice(0, 254),
    source: String(activity.source || 'local').slice(0, 20),
    meta: safeMeta
  };
}

export async function saveTenantActivity(tenantId, activity) {
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId || !activity?.id) return null;
  const path = `users/${safeTenantId}/activities/${String(activity.id)}`;
  const payload = normalizeActivityPayload(safeTenantId, activity);
  try {
    await setDoc(doc(db, path), payload);
    return payload.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
  }
}

export async function saveTenantActivitiesBatch(tenantId, activities = []) {
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId || !Array.isArray(activities) || activities.length === 0) return [];

  const CHUNK_SIZE = 200;
  const savedIds = [];
  const basePath = `users/${safeTenantId}/activities`;

  try {
    for (let i = 0; i < activities.length; i += CHUNK_SIZE) {
      const chunk = activities.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const activity of chunk) {
        if (!activity?.id) continue;
        const payload = normalizeActivityPayload(safeTenantId, activity);
        batch.set(doc(db, `${basePath}/${payload.id}`), payload, { merge: true });
        savedIds.push(payload.id);
      }
      await batch.commit();
    }
    return savedIds;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, basePath);
    return [];
  }
}

export async function getTenantActivities(tenantId, clientId = null) {
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId) return null;
  const path = `users/${safeTenantId}/activities`;
  try {
    const activitiesRef = collection(db, path);
    const activitiesQuery = clientId === null
      ? activitiesRef
      : query(activitiesRef, where('clientId', '==', Number(clientId)));
    const snapshot = await getDocsFromServer(activitiesQuery);
    return snapshot.docs.map(activityDoc => ({
      ...activityDoc.data(),
      id: activityDoc.data().id || activityDoc.id
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}
