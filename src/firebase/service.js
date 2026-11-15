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
  deleteField,
  onSnapshot
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
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
  // If user signed out, don't crash with an unhandled exception
  if (!auth?.currentUser || error?.code === 'permission-denied' || (error?.message && error.message.includes('permissions'))) {
    return null;
  }
  throw new Error(JSON.stringify(errInfo));
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
    const snap = await getDoc(docRef);
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
  userId = sanitizeUserId(userId);
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

// Transaction: Create client, persist initial programs to subcollection, and initialize stats
export async function addClientTransaction(userId, clientData, globalStats) {
  userId = sanitizeUserId(userId);
  const userPath = `users/${userId}`;
  const clientId = String(clientData.id);
  const clientPath = `users/${userId}/clients/${clientId}`;

  const rawPrograms = Array.isArray(clientData.programs) ? clientData.programs.filter(Boolean) : [];
  const normalizedPrograms = rawPrograms.map((prog, idx) => {
    const progId = prog.id || (Date.now() + idx + 1);
    return {
      ...prog,
      id: progId,
      programName: String(prog.programName || 'غير محدد'),
      platform: String(prog.platform || 'Desktop'),
      type: String(prog.type || 'تجاري'),
      version: prog.platform === 'Mobile' ? '' : String(prog.version || ''),
      installationsCount: Math.max(1, Number(prog.installationsCount) || 1),
      startDate: String(prog.startDate || clientData.startDate || ''),
      endDate: String(prog.endDate || '')
    };
  });

  const programsCount = normalizedPrograms.length;
  const installationsCount = normalizedPrograms.reduce((sum, p) => sum + (Number(p.installationsCount) || 1), 0);
  const programNames = normalizedPrograms.map(p => p.programName).filter(Boolean);
  const activeProg = normalizedPrograms.filter(p => p.endDate).sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
  const resolvedEndDate = clientData.endDate || (activeProg.length > 0 ? activeProg[0].endDate : '');

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);
      const userSnap = typeof tx.get === 'function' ? await tx.get(userRef) : null;
      const serverStats = userSnap && userSnap.exists && userSnap.exists() ? (userSnap.data()?.stats || {}) : null;

      // Write parent client document with accurate program metadata
      tx.set(clientRef, {
        ...clientData,
        programs: normalizedPrograms,
        programNames,
        endDate: resolvedEndDate,
        version: 1, // OCC: Initial version
        openIssuesCount: Array.isArray(clientData.issues)
          ? clientData.issues.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length
          : 0,
        requirementsCount: Array.isArray(clientData.requirements) ? clientData.requirements.length : 0,
        programsCount,
        installationsCount,
        score: clientData.score || 100,
        updatedAt: new Date().toISOString()
      });

      // Write each initial program to the programs subcollection atomically
      for (const progDoc of normalizedPrograms) {
        const progRef = doc(db, `${clientPath}/programs/${String(progDoc.id)}`);
        tx.set(progRef, progDoc, { merge: true });
      }

      // Update pre-aggregated user stats safely without double-counting pre-incremented stats
      const nextStats = { ...(globalStats || {}) };
      const callerAlreadyCounted = Boolean(
        globalStats &&
        typeof globalStats.totalClients === 'number' &&
        globalStats.totalClients > (Number(serverStats?.totalClients) || 0)
      );

      if (!callerAlreadyCounted) {
        nextStats.totalClients = (nextStats.totalClients || 0) + 1;
        if (clientData.status === 'نشط') nextStats.activeClients = (nextStats.activeClients || 0) + 1;
        else if (clientData.status === 'محتمل') nextStats.prospectiveClients = (nextStats.prospectiveClients || 0) + 1;
        else if (clientData.status === 'متوقف') nextStats.stoppedClients = (nextStats.stoppedClients || 0) + 1;
        if (programsCount > 0) {
          nextStats.totalPrograms = (nextStats.totalPrograms || 0) + programsCount;
          nextStats.totalLicensedDevices = (nextStats.totalLicensedDevices || 0) + installationsCount;
        }
      }

      const userPayload = {
        stats: nextStats,
        nid: clientData.id,
        updatedAt: new Date().toISOString()
      };
      if (!userSnap || !userSnap.exists || !userSnap.exists()) {
        userPayload.v = 3;
      }
      tx.set(userRef, userPayload, { merge: true });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath);
  }
}

// Backfill recovered programs into client's programs subcollection and sync denormalized counters
export async function backfillClientProgramsTransaction(userId, clientId, programsToWrite = [], counterUpdates = {}, globalStats = null, options = {}) {
  if (auth && !auth.currentUser) return false;
  userId = sanitizeUserId(userId);
  if (!userId || !clientId) return false;

  const clientPath = `users/${userId}/clients/${String(clientId)}`;
  try {
    const batch = writeBatch(db);
    for (const prog of (Array.isArray(programsToWrite) ? programsToWrite : [])) {
      if (!prog || !prog.id) continue;
      const progRef = doc(db, `${clientPath}/programs/${String(prog.id)}`);
      batch.set(progRef, prog, { merge: true });
    }

    const clientRef = doc(db, clientPath);
    batch.set(clientRef, {
      ...counterUpdates,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (globalStats) {
      const userRef = doc(db, `users/${userId}`);
      batch.set(userRef, {
        stats: globalStats,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    await batch.commit();
    return true;
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    const isPermErr = error?.code === 'permission-denied' || msg.includes('permission') || msg.includes('permissions');
    if (isPermErr && typeof options?.onPermissionDenied === 'function') {
      options.onPermissionDenied(error);
    }
    handleFirestoreError(error, OperationType.WRITE, clientPath);
    return false;
  }
}

// Batch backfill recovered programs for multiple clients at once (max 400 ops per Firestore writeBatch)
export async function backfillClientProgramsBatch(userId, items = [], options = {}) {
  if (auth && !auth.currentUser) return false;
  userId = sanitizeUserId(userId);
  if (!userId || !Array.isArray(items) || items.length === 0) return true;

  const MAX_BATCH_OPS = 400;
  let batch = writeBatch(db);
  let opCount = 0;
  const nowIso = new Date().toISOString();
  let lastPath = `users/${userId}/clients`;

  try {
    for (const item of items) {
      if (!item || !item.clientId) continue;
      const programsToWrite = Array.isArray(item.programsToWrite)
        ? item.programsToWrite.filter(p => p && p.id)
        : [];
      const neededOps = programsToWrite.length + 1;

      if (opCount > 0 && opCount + neededOps > MAX_BATCH_OPS) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }

      const clientPath = `users/${userId}/clients/${String(item.clientId)}`;
      lastPath = clientPath;

      for (const prog of programsToWrite) {
        const progRef = doc(db, `${clientPath}/programs/${String(prog.id)}`);
        batch.set(progRef, prog, { merge: true });
        opCount++;
      }

      const clientRef = doc(db, clientPath);
      batch.set(clientRef, {
        ...(item.counterUpdates || {}),
        updatedAt: nowIso
      }, { merge: true });
      opCount++;
    }

    if (opCount > 0) {
      await batch.commit();
    }
    return true;
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    const isPermErr = error?.code === 'permission-denied' || msg.includes('permission') || msg.includes('permissions');
    if (isPermErr && typeof options?.onPermissionDenied === 'function') {
      options.onPermissionDenied(error);
    }
    handleFirestoreError(error, OperationType.WRITE, lastPath);
    return false;
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
export async function saveClientSubItemTransaction(userId, clientId, collectionName, itemId, itemData, counterUpdates, globalStatsUpdates) {
  userId = sanitizeUserId(userId);
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
  userId = sanitizeUserId(userId);
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

export async function saveTenantActivity(tenantId, activity) {
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId || !activity?.id) return null;
  const path = `users/${safeTenantId}/activities/${String(activity.id)}`;
  const payload = {
    id: String(activity.id),
    clientId: activity.clientId ? Number(activity.clientId) : null,
    clientName: String(activity.clientName || '').slice(0, 100),
    type: String(activity.type || 'UNKNOWN').slice(0, 50),
    category: String(activity.category || 'system').slice(0, 30),
    title: String(activity.title || '').slice(0, 200),
    description: String(activity.description || '').slice(0, 2000),
    timestamp: String(activity.timestamp || new Date().toISOString()),
    userName: String(activity.userName || '').slice(0, 100),
    userRole: String(activity.userRole || '').slice(0, 100),
    userId: String(activity.userId || '').slice(0, 128),
    actorUid: safeTenantId,
    actorEmail: String(activity.actorEmail || (auth && auth.currentUser && auth.currentUser.email) || '').slice(0, 254),
    source: String(activity.source || 'local').slice(0, 20),
    meta: activity.meta || {}
  };
  try {
    await setDoc(doc(db, path), payload);
    return payload.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
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
    const snapshot = await getDocs(activitiesQuery);
    return snapshot.docs.map(activityDoc => ({
      ...activityDoc.data(),
      id: activityDoc.data().id || activityDoc.id
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}
