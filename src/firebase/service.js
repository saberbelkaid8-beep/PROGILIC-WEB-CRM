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

export function isQuotaExceededError(error) {
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || error || '').toLowerCase();
  return code === 'resource-exhausted' || code.endsWith('/resource-exhausted') ||
    msg.includes('quota limit exceeded') || msg.includes('quota exceeded') ||
    msg.includes('free daily read units');
}

export function classifyFirestoreError(error) {
  if (!error) return 'unknown';
  if (isQuotaExceededError(error)) return 'quota-exceeded';
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || error || '').toLowerCase();
  if (code === 'version_conflict' || code === 'version-conflict' || msg.includes('version_conflict')) {
    return 'version-conflict';
  }
  if (code === 'permission-denied' || code.endsWith('/permission-denied') || msg.includes('missing or insufficient permissions') || msg.includes('permission')) {
    return 'permission-denied';
  }
  if (code === 'unauthenticated' || code.endsWith('/unauthenticated')) {
    return 'unauthenticated';
  }
  if (
    code === 'network-offline' ||
    code === 'unavailable' ||
    code.endsWith('/unavailable') ||
    code === 'failed-precondition' ||
    msg.includes('the client is offline') ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('firestore_timeout')
  ) {
    return 'network-offline';
  }
  return 'unknown';
}

export function assertOnlineForWrite() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const err = new Error('الاتصال بالإنترنت غير متاح. النظام يعمل حصرياً أونلاين ولا يقبل التعديلات دون تأكيد السحابة.');
    err.code = 'network-offline';
    err.classification = 'network-offline';
    throw err;
  }
  if (typeof globalThis !== 'undefined' && globalThis.__progilicFirestoreQuotaExceeded) {
    const err = new Error('Quota limit exceeded. تم إيقاف الكتابة لحماية الحصة حتى استعادة الخدمة.');
    err.code = 'resource-exhausted';
    err.classification = 'quota-exceeded';
    throw err;
  }
  if (auth && !auth.currentUser) {
    const err = new Error('المستخدم غير مسجل الدخول في Firebase Auth.');
    err.code = 'unauthenticated';
    err.classification = 'unauthenticated';
    throw err;
  }
}

export function handleFirestoreError(error, operationType, path, options = {}) {
  const classification = classifyFirestoreError(error);
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    classification,
    code: error?.code || classification,
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
  if (classification === 'quota-exceeded') {
    if (typeof globalThis !== 'undefined') {
      globalThis.__progilicFirestoreQuotaExceeded = true;
    }
    if (!options.rethrow) return null;
  }
  if (!options.rethrow && (!auth?.currentUser || classification === 'permission-denied')) {
    return null;
  }
  const wrapped = error instanceof Error ? error : new Error(JSON.stringify(errInfo));
  if (!wrapped.code) wrapped.code = error?.code || classification;
  wrapped.classification = classification;
  wrapped.errInfo = errInfo;
  throw wrapped;
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
export async function getUserDataStrict(userId) {
  if (auth && !auth.currentUser) {
    return { status: 'unauthenticated', exists: false, fromCache: false, data: null, error: null };
  }
  userId = sanitizeUserId(userId);
  if (!userId) {
    return { status: 'unauthenticated', exists: false, fromCache: false, data: null, error: null };
  }
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, path);
    const snap = await getDoc(docRef);
    const fromCache = Boolean(snap?.metadata?.fromCache);
    if (!snap.exists()) {
      return { status: 'missing', exists: false, fromCache, data: null, error: null };
    }
    return { status: 'ok', exists: true, fromCache, data: snap.data(), error: null };
  } catch (error) {
    const classification = classifyFirestoreError(error);
    if (classification === 'quota-exceeded' && typeof globalThis !== 'undefined') {
      globalThis.__progilicFirestoreQuotaExceeded = true;
    }
    return {
      status: classification,
      exists: false,
      fromCache: false,
      data: null,
      error
    };
  }
}

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
  assertOnlineForWrite();
  userId = sanitizeUserId(userId);
  if (!userId) throw new Error('Missing user ID for saveUserData');
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, data, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, { rethrow: true });
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
      fromCache: Boolean(snap?.metadata?.fromCache),
      clients: snap.docs.map(d => ({ ...d.data(), firestoreId: d.id }))
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, { rethrow: true });
  }
}

// Fetches all subcollections (programs, issues, requirements, contacts) of a client
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
    handleFirestoreError(error, OperationType.GET, basePath, { rethrow: true });
  }
}

// Subscribe selectively to a single open client's 4 subcollections for real-time detail updates
export function subscribeClientSubcollections(userId, clientId, onUpdate, onError) {
  userId = sanitizeUserId(userId);
  if (!userId || !clientId) return () => {};
  const basePath = `users/${userId}/clients/${String(clientId)}`;
  const subNames = [
    { coll: 'programs', field: 'programs' },
    { coll: 'issues', field: 'issues' },
    { coll: 'requirements', field: 'requirements' },
    { coll: 'contacts', field: 'contactHistory' }
  ];
  const unsubs = [];

  for (const { coll, field } of subNames) {
    try {
      const collRef = collection(db, `${basePath}/${coll}`);
      const unsub = onSnapshot(collRef, (snapshot) => {
        const items = snapshot.docs.map(d => d.data());
        if (typeof onUpdate === 'function') {
          onUpdate({
            clientId: String(clientId),
            collectionName: coll,
            fieldName: field,
            items,
            fromCache: Boolean(snapshot.metadata?.fromCache),
            hasPendingWrites: Boolean(snapshot.metadata?.hasPendingWrites),
            empty: snapshot.empty
          });
        }
      }, (error) => {
        if (typeof onError === 'function') onError(error, coll);
      });
      unsubs.push(unsub);
    } catch (err) {
      if (typeof onError === 'function') onError(err, coll);
    }
  }

  return () => {
    unsubs.forEach(u => {
      try { u(); } catch (_) {}
    });
  };
}

function sanitizeParentClientPayload(clientData = {}) {
  const clean = { ...(clientData || {}) };
  delete clean.issues;
  delete clean.requirements;
  delete clean.contactHistory;
  delete clean._subcollectionsLoaded;
  delete clean.firestoreId;
  delete clean._dirtyLocal;
  if (Array.isArray(clean.versionHistory)) {
    clean.versionHistory = clean.versionHistory
      .filter(h => h && typeof h === 'object')
      .slice(0, 100);
  }
  return clean;
}

// Transaction: Create client, persist initial programs to subcollection, and initialize stats
export async function addClientTransaction(userId, clientData, globalStats) {
  assertOnlineForWrite();
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
      versionNum: Math.max(1, Number(prog.versionNum) || 1),
      programName: String(prog.programName || 'غير محدد'),
      platform: String(prog.platform || 'Desktop'),
      type: String(prog.type || 'تجاري'),
      version: String(prog.version || ''),
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
  const nowIso = new Date().toISOString();

  const issues = Array.isArray(clientData.issues) ? clientData.issues : [];
  const openIssues = issues.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد'));
  const issuesByPriority = clientData.issuesByPriority || {
    عاجل: openIssues.filter(i => i.priority === 'عاجل' || i.priority === 'عاجلة').length,
    عالية: openIssues.filter(i => i.priority === 'عالية').length,
    متوسطة: openIssues.filter(i => i.priority === 'متوسطة').length,
    منخفضة: openIssues.filter(i => i.priority === 'منخفضة' || !i.priority).length
  };
  const reqs = Array.isArray(clientData.requirements) ? clientData.requirements : [];
  const reqsByStatus = clientData.reqsByStatus || {
    مقترح: reqs.filter(r => r.status === 'مقترح' || !r.status).length,
    'قيد الدراسة': reqs.filter(r => r.status === 'قيد الدراسة').length,
    مخطط: reqs.filter(r => r.status === 'مخطط').length,
    منفذ: reqs.filter(r => r.status === 'منفذ').length
  };

  const sanitizedParent = sanitizeParentClientPayload(clientData);

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);
      const userSnap = typeof tx.get === 'function' ? await tx.get(userRef) : null;
      const userDocData = userSnap && userSnap.exists && userSnap.exists() ? (userSnap.data() || {}) : null;
      const serverStats = userDocData?.stats || null;

      // Write parent client document with accurate summary metadata
      tx.set(clientRef, {
        ...sanitizedParent,
        programs: normalizedPrograms,
        programNames,
        endDate: resolvedEndDate,
        version: 1, // OCC: Initial version
        openIssuesCount: openIssues.length,
        urgentIssuesCount: (issuesByPriority.عاجل || 0) + (issuesByPriority.عالية || 0),
        solvedIssuesCount: issues.filter(i => i && (i.status === 'محلول' || i.status === 'مغلق')).length,
        issuesByPriority,
        requirementsCount: reqs.length,
        reqsByStatus,
        contactsCount: Array.isArray(clientData.contactHistory) ? clientData.contactHistory.length : (clientData.contactsCount || 0),
        programsCount,
        installationsCount,
        versionHistory: Array.isArray(sanitizedParent.versionHistory) ? sanitizedParent.versionHistory : [],
        score: clientData.score !== undefined ? clientData.score : 100,
        updatedAt: nowIso
      });

      // Write each initial program to the programs subcollection atomically
      for (const progDoc of normalizedPrograms) {
        const progRef = doc(db, `${clientPath}/programs/${String(progDoc.id)}`);
        tx.set(progRef, progDoc, { merge: true });
      }

      // Compute atomic stats from authoritative serverStats when present
      const baseStats = serverStats ? { ...serverStats } : { ...(globalStats || {}) };
      const callerAlreadyCounted = Boolean(
        !serverStats &&
        globalStats &&
        typeof globalStats.totalClients === 'number' &&
        globalStats.totalClients > 0
      );

      const nextStats = { ...baseStats };
      if (!callerAlreadyCounted) {
        nextStats.totalClients = (nextStats.totalClients || 0) + 1;
        if (clientData.status === 'نشط') nextStats.activeClients = (nextStats.activeClients || 0) + 1;
        else if (clientData.status === 'محتمل') nextStats.prospectiveClients = (nextStats.prospectiveClients || 0) + 1;
        else if (clientData.status === 'متوقف') nextStats.stoppedClients = (nextStats.stoppedClients || 0) + 1;
        if (programsCount > 0) {
          nextStats.totalPrograms = (nextStats.totalPrograms || 0) + programsCount;
          nextStats.totalLicensedDevices = (nextStats.totalLicensedDevices || 0) + installationsCount;
        }
        if (openIssues.length > 0) {
          nextStats.totalOpenIssues = (nextStats.totalOpenIssues || 0) + openIssues.length;
        }
      }

      const userPayload = {
        stats: nextStats,
        nid: Math.max(Number(userDocData?.nid || 100), Number(clientData.id) || 100),
        updatedAt: nowIso
      };
      if (!userDocData) {
        userPayload.v = 3;
      }
      tx.set(userRef, userPayload, { merge: true });
    });
    return { version: 1, updatedAt: nowIso };
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath, { rethrow: true });
  }
}

// Backfill recovered programs into client's programs subcollection and sync denormalized counters
export async function backfillClientProgramsTransaction(userId, clientId, programsToWrite = [], counterUpdates = {}, globalStats = null, options = {}) {
  if (auth && !auth.currentUser) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
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
    try {
      handleFirestoreError(error, OperationType.WRITE, clientPath);
    } catch (_) {}
    return false;
  }
}

// Batch backfill recovered programs for multiple clients at once (max 400 ops per Firestore writeBatch)
export async function backfillClientProgramsBatch(userId, items = [], options = {}) {
  if (auth && !auth.currentUser) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
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
    try {
      handleFirestoreError(error, OperationType.WRITE, lastPath);
    } catch (_) {}
    return false;
  }
}

// Transaction: Update client and adjust stats atomically if status changed, enforcing OCC baseVersion
export async function updateClientTransaction(userId, clientId, clientData, oldStatus, globalStats, baseVersion = 0) {
  assertOnlineForWrite();
  userId = sanitizeUserId(userId);
  const userPath = `users/${userId}`;
  const clientPath = `users/${userId}/clients/${clientId}`;
  const nowIso = new Date().toISOString();
  let nextVersion = (Number(baseVersion) || 0) + 1;

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);

      // Firestore requires all reads to be executed before all writes
      const docSnap = await tx.get(clientRef);
      const userSnap = typeof tx.get === 'function' ? await tx.get(userRef) : null;

      let serverOldStatus = oldStatus;
      let currentVersion = 0;
      if (docSnap.exists()) {
        const serverData = docSnap.data() || {};
        currentVersion = Number(serverData.version || 0);
        serverOldStatus = serverData.status || oldStatus;
        const expectedBase = Number(baseVersion ?? 0);
        if (currentVersion > expectedBase) {
          const conflictError = new Error('VERSION_CONFLICT');
          conflictError.code = 'VERSION_CONFLICT';
          conflictError.serverData = serverData;
          throw conflictError;
        }
      }

      const sanitizedParent = sanitizeParentClientPayload(clientData);
      nextVersion = Math.max(Number(baseVersion) || 0, currentVersion) + 1;
      tx.update(clientRef, {
        ...sanitizedParent,
        version: nextVersion,
        updatedAt: nowIso
      });

      if (clientData.status && serverOldStatus !== clientData.status) {
        const serverStats = userSnap && userSnap.exists && userSnap.exists() ? (userSnap.data()?.stats || null) : null;
        const nextStats = { ...(serverStats || globalStats || {}) };

        if (serverOldStatus === 'نشط') nextStats.activeClients = Math.max(0, (nextStats.activeClients || 0) - 1);
        else if (serverOldStatus === 'محتمل') nextStats.prospectiveClients = Math.max(0, (nextStats.prospectiveClients || 0) - 1);
        else if (serverOldStatus === 'متوقف') nextStats.stoppedClients = Math.max(0, (nextStats.stoppedClients || 0) - 1);

        if (clientData.status === 'نشط') nextStats.activeClients = (nextStats.activeClients || 0) + 1;
        else if (clientData.status === 'محتمل') nextStats.prospectiveClients = (nextStats.prospectiveClients || 0) + 1;
        else if (clientData.status === 'متوقف') nextStats.stoppedClients = (nextStats.stoppedClients || 0) + 1;

        tx.set(userRef, {
          stats: nextStats,
          updatedAt: nowIso
        }, { merge: true });
      }
    });
    return { version: nextVersion, updatedAt: nowIso };
  } catch (error) {
    if (error?.code === 'VERSION_CONFLICT') {
      throw error;
    }
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath, { rethrow: true });
  }
}

// Transaction: Delete client and adjust stats atomically
export async function deleteClientTransaction(userId, clientId, clientData, globalStats) {
  assertOnlineForWrite();
  userId = sanitizeUserId(userId);
  const userPath = `users/${userId}`;
  const clientPath = `users/${userId}/clients/${clientId}`;
  const nowIso = new Date().toISOString();

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

    // Run transactional delete for client and atomic stats decrement
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, userPath);
      const clientRef = doc(db, clientPath);
      const clientSnap = typeof tx.get === 'function' ? await tx.get(clientRef) : null;
      const userSnap = typeof tx.get === 'function' ? await tx.get(userRef) : null;
      const serverClient = clientSnap && clientSnap.exists && clientSnap.exists() ? (clientSnap.data() || clientData) : clientData;
      const serverStats = userSnap && userSnap.exists && userSnap.exists() ? (userSnap.data()?.stats || null) : null;

      tx.delete(clientRef);

      if (serverStats || globalStats) {
        const nextStats = { ...(serverStats || globalStats || {}) };
        nextStats.totalClients = Math.max(0, (nextStats.totalClients || 0) - 1);
        if (serverClient.status === 'نشط') nextStats.activeClients = Math.max(0, (nextStats.activeClients || 0) - 1);
        else if (serverClient.status === 'محتمل') nextStats.prospectiveClients = Math.max(0, (nextStats.prospectiveClients || 0) - 1);
        else if (serverClient.status === 'متوقف') nextStats.stoppedClients = Math.max(0, (nextStats.stoppedClients || 0) - 1);

        nextStats.totalPrograms = Math.max(0, (nextStats.totalPrograms || 0) - (serverClient.programsCount || 0));
        nextStats.totalLicensedDevices = Math.max(0, (nextStats.totalLicensedDevices || 0) - (serverClient.installationsCount || 0));
        nextStats.totalOpenIssues = Math.max(0, (nextStats.totalOpenIssues || 0) - (serverClient.openIssuesCount || 0));

        tx.set(userRef, {
          stats: nextStats,
          updatedAt: nowIso
        }, { merge: true });
      }
    });
    return { deleted: true, updatedAt: nowIso };
  } catch (error) {
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath, { rethrow: true });
  }
}

function applySubItemStatsDeltas(serverStats, serverClient, counterUpdates, fallbackGlobalStats) {
  if (!serverStats) {
    return fallbackGlobalStats || null;
  }
  const nextStats = { ...serverStats };
  const prevProgs = Number(serverClient?.programsCount || 0);
  const prevDevices = Number(serverClient?.installationsCount || 0);
  const prevOpenIssues = Number(serverClient?.openIssuesCount || 0);

  if (typeof counterUpdates?.programsCount === 'number') {
    nextStats.totalPrograms = Math.max(0, (nextStats.totalPrograms || 0) + (counterUpdates.programsCount - prevProgs));
  }
  if (typeof counterUpdates?.installationsCount === 'number') {
    nextStats.totalLicensedDevices = Math.max(0, (nextStats.totalLicensedDevices || 0) + (counterUpdates.installationsCount - prevDevices));
  }
  if (typeof counterUpdates?.openIssuesCount === 'number') {
    nextStats.totalOpenIssues = Math.max(0, (nextStats.totalOpenIssues || 0) + (counterUpdates.openIssuesCount - prevOpenIssues));
  }
  if (fallbackGlobalStats && typeof fallbackGlobalStats.averageScore === 'number') {
    nextStats.averageScore = fallbackGlobalStats.averageScore;
  }
  return nextStats;
}

// Save an item inside a client subcollection and run atomic transaction to update summary counters with OCC
export async function saveClientSubItemTransaction(userId, clientId, collectionName, itemId, itemData, counterUpdates, globalStatsUpdates, concurrency = {}) {
  assertOnlineForWrite();
  userId = sanitizeUserId(userId);
  const clientPath = `users/${userId}/clients/${clientId}`;
  const itemPath = `${clientPath}/${collectionName}/${itemId}`;
  const userPath = `users/${userId}`;
  const nowIso = new Date().toISOString();
  const isProgram = collectionName === 'programs';
  const versionField = isProgram ? 'versionNum' : 'version';
  let nextParentVersion = (Number(concurrency?.baseVersion) || 0) + 1;
  let nextItemVersion = (Number(concurrency?.expectedItemVersion) || 0) + 1;

  try {
    await runTransaction(db, async (tx) => {
      const clientRef = doc(db, clientPath);
      const itemRef = doc(db, itemPath);
      const userRef = doc(db, userPath);

      const clientSnap = typeof tx.get === 'function' ? await tx.get(clientRef) : null;
      const itemSnap = typeof tx.get === 'function' ? await tx.get(itemRef) : null;
      const userSnap = (globalStatsUpdates && typeof tx.get === 'function') ? await tx.get(userRef) : null;
      const serverClient = clientSnap && clientSnap.exists && clientSnap.exists() ? (clientSnap.data() || {}) : {};
      const serverItem = itemSnap && itemSnap.exists && itemSnap.exists() ? (itemSnap.data() || {}) : null;
      const serverStats = userSnap && userSnap.exists && userSnap.exists() ? (userSnap.data()?.stats || null) : null;

      // Subitem-level OCC validation
      const expectedItemVer = concurrency?.expectedItemVersion;
      if (expectedItemVer !== undefined && expectedItemVer !== null) {
        if (!serverItem) {
          const conflictError = new Error('VERSION_CONFLICT');
          conflictError.code = 'VERSION_CONFLICT';
          conflictError.conflictScope = 'subitem';
          conflictError.deletedRemotely = true;
          conflictError.collectionName = collectionName;
          conflictError.itemId = String(itemId);
          conflictError.serverData = serverClient;
          conflictError.serverItem = null;
          throw conflictError;
        }
        const currentItemVer = Number(serverItem[versionField] || 0);
        if (currentItemVer > Number(expectedItemVer)) {
          const conflictError = new Error('VERSION_CONFLICT');
          conflictError.code = 'VERSION_CONFLICT';
          conflictError.conflictScope = 'subitem';
          conflictError.collectionName = collectionName;
          conflictError.itemId = String(itemId);
          conflictError.serverData = serverClient;
          conflictError.serverItem = serverItem;
          throw conflictError;
        }
      } else if (concurrency?.isCreate && serverItem) {
        const conflictError = new Error('VERSION_CONFLICT');
        conflictError.code = 'VERSION_CONFLICT';
        conflictError.conflictScope = 'subitem';
        conflictError.collectionName = collectionName;
        conflictError.itemId = String(itemId);
        conflictError.serverData = serverClient;
        conflictError.serverItem = serverItem;
        throw conflictError;
      }

      // Parent-level OCC validation only when caller has no item-level OCC and explicitly supplied a positive baseVersion
      const hasItemOcc = (expectedItemVer !== undefined && expectedItemVer !== null) || Boolean(concurrency?.isCreate);
      const serverParentVer = Number(serverClient.version || 0);
      if (
        !hasItemOcc &&
        Number(concurrency?.baseVersion) > 0 &&
        clientSnap &&
        clientSnap.exists &&
        clientSnap.exists() &&
        serverParentVer > Number(concurrency.baseVersion)
      ) {
        const conflictError = new Error('VERSION_CONFLICT');
        conflictError.code = 'VERSION_CONFLICT';
        conflictError.conflictScope = 'subitem';
        conflictError.collectionName = collectionName;
        conflictError.itemId = String(itemId);
        conflictError.serverData = serverClient;
        conflictError.serverItem = serverItem;
        throw conflictError;
      }

      const currentServerItemVer = Number(serverItem?.[versionField] || 0);
      nextItemVersion = Math.max(Number(expectedItemVer || 0), currentServerItemVer) + 1;
      nextParentVersion = Math.max(Number(concurrency?.baseVersion || 0), serverParentVer) + 1;

      tx.set(itemRef, {
        ...itemData,
        [versionField]: nextItemVersion
      }, { merge: true });

      tx.update(clientRef, {
        ...counterUpdates,
        version: nextParentVersion,
        updatedAt: nowIso
      });

      if (globalStatsUpdates) {
        const nextStats = applySubItemStatsDeltas(serverStats, serverClient, counterUpdates, globalStatsUpdates);
        if (nextStats) {
          tx.set(userRef, {
            stats: nextStats,
            updatedAt: nowIso
          }, { merge: true });
        }
      }
    });
    return { version: nextParentVersion, itemVersion: nextItemVersion, updatedAt: nowIso };
  } catch (error) {
    if (error?.code === 'VERSION_CONFLICT') {
      throw error;
    }
    handleFirestoreError(error, OperationType.TRANSACTION, itemPath, { rethrow: true });
  }
}

// Delete an item inside a client subcollection and run atomic transaction to update summary counters with OCC
export async function deleteClientSubItemTransaction(userId, clientId, collectionName, itemId, counterUpdates, globalStatsUpdates, concurrency = {}) {
  assertOnlineForWrite();
  userId = sanitizeUserId(userId);
  const clientPath = `users/${userId}/clients/${clientId}`;
  const itemPath = `${clientPath}/${collectionName}/${itemId}`;
  const userPath = `users/${userId}`;
  const nowIso = new Date().toISOString();
  const isProgram = collectionName === 'programs';
  const versionField = isProgram ? 'versionNum' : 'version';
  let nextParentVersion = (Number(concurrency?.baseVersion) || 0) + 1;

  try {
    await runTransaction(db, async (tx) => {
      const clientRef = doc(db, clientPath);
      const itemRef = doc(db, itemPath);
      const userRef = doc(db, userPath);

      const clientSnap = typeof tx.get === 'function' ? await tx.get(clientRef) : null;
      const itemSnap = typeof tx.get === 'function' ? await tx.get(itemRef) : null;
      const userSnap = (globalStatsUpdates && typeof tx.get === 'function') ? await tx.get(userRef) : null;
      const serverClient = clientSnap && clientSnap.exists && clientSnap.exists() ? (clientSnap.data() || {}) : {};
      const serverItem = itemSnap && itemSnap.exists && itemSnap.exists() ? (itemSnap.data() || {}) : null;
      const serverStats = userSnap && userSnap.exists && userSnap.exists() ? (userSnap.data()?.stats || null) : null;

      const expectedItemVer = concurrency?.expectedItemVersion;
      if (expectedItemVer !== undefined && expectedItemVer !== null) {
        if (!serverItem) {
          const conflictError = new Error('VERSION_CONFLICT');
          conflictError.code = 'VERSION_CONFLICT';
          conflictError.conflictScope = 'subitem';
          conflictError.deletedRemotely = true;
          conflictError.collectionName = collectionName;
          conflictError.itemId = String(itemId);
          conflictError.serverData = serverClient;
          conflictError.serverItem = null;
          throw conflictError;
        }
        const currentItemVer = Number(serverItem[versionField] || 0);
        if (currentItemVer > Number(expectedItemVer)) {
          const conflictError = new Error('VERSION_CONFLICT');
          conflictError.code = 'VERSION_CONFLICT';
          conflictError.conflictScope = 'subitem';
          conflictError.collectionName = collectionName;
          conflictError.itemId = String(itemId);
          conflictError.serverData = serverClient;
          conflictError.serverItem = serverItem;
          throw conflictError;
        }
      }

      const hasItemOcc = expectedItemVer !== undefined && expectedItemVer !== null;
      const serverParentVer = Number(serverClient.version || 0);
      if (
        !hasItemOcc &&
        Number(concurrency?.baseVersion) > 0 &&
        clientSnap &&
        clientSnap.exists &&
        clientSnap.exists() &&
        serverParentVer > Number(concurrency.baseVersion)
      ) {
        const conflictError = new Error('VERSION_CONFLICT');
        conflictError.code = 'VERSION_CONFLICT';
        conflictError.conflictScope = 'subitem';
        conflictError.collectionName = collectionName;
        conflictError.itemId = String(itemId);
        conflictError.serverData = serverClient;
        conflictError.serverItem = serverItem;
        throw conflictError;
      }

      nextParentVersion = Math.max(Number(concurrency?.baseVersion || 0), serverParentVer) + 1;

      tx.delete(itemRef);

      tx.update(clientRef, {
        ...counterUpdates,
        version: nextParentVersion,
        updatedAt: nowIso
      });

      if (globalStatsUpdates) {
        const nextStats = applySubItemStatsDeltas(serverStats, serverClient, counterUpdates, globalStatsUpdates);
        if (nextStats) {
          tx.set(userRef, {
            stats: nextStats,
            updatedAt: nowIso
          }, { merge: true });
        }
      }
    });
    return { version: nextParentVersion, updatedAt: nowIso };
  } catch (error) {
    if (error?.code === 'VERSION_CONFLICT') {
      throw error;
    }
    handleFirestoreError(error, OperationType.TRANSACTION, itemPath, { rethrow: true });
  }
}

// Transaction: Atomically synchronize explicit target software version across matched program records of one client
export async function syncProgramVersionTransaction(userId, clientId, {
  updatedPrograms = [],
  counterUpdates = {},
  versionHistoryEntry = null,
  concurrency = {}
} = {}) {
  assertOnlineForWrite();
  userId = sanitizeUserId(userId);
  const safeClientId = String(clientId);
  const clientPath = `users/${userId}/clients/${safeClientId}`;
  const nowIso = new Date().toISOString();
  const safeUpdatedPrograms = Array.isArray(updatedPrograms) ? updatedPrograms.filter(p => p && p.id !== undefined) : [];
  let nextParentVersion = (Number(concurrency?.baseVersion) || 0) + 1;
  let resultPrograms = [];
  let resultHistory = [];

  try {
    await runTransaction(db, async (tx) => {
      const clientRef = doc(db, clientPath);
      const clientSnap = typeof tx.get === 'function' ? await tx.get(clientRef) : null;
      const serverClient = clientSnap && clientSnap.exists && clientSnap.exists() ? (clientSnap.data() || {}) : {};
      const currentVersion = Number(serverClient.version || 0);

      if (
        concurrency?.baseVersion !== undefined &&
        concurrency?.baseVersion !== null &&
        clientSnap &&
        clientSnap.exists &&
        clientSnap.exists() &&
        currentVersion > Number(concurrency.baseVersion)
      ) {
        const conflictError = new Error('VERSION_CONFLICT');
        conflictError.code = 'VERSION_CONFLICT';
        conflictError.conflictScope = 'versionSync';
        conflictError.serverData = serverClient;
        throw conflictError;
      }

      // Firestore requires all reads before any writes inside a transaction
      const progRefsAndSnaps = [];
      for (const prog of safeUpdatedPrograms) {
        const progRef = doc(db, `${clientPath}/programs/${String(prog.id)}`);
        const progSnap = typeof tx.get === 'function' ? await tx.get(progRef) : null;
        progRefsAndSnaps.push({ prog, progRef, progSnap });
      }

      nextParentVersion = Math.max(Number(concurrency?.baseVersion || 0), currentVersion) + 1;

      const existingHistory = Array.isArray(serverClient.versionHistory) ? [...serverClient.versionHistory] : [];
      if (versionHistoryEntry && !existingHistory.some(h => h && h.id === versionHistoryEntry.id)) {
        existingHistory.unshift(versionHistoryEntry);
      }
      resultHistory = existingHistory.slice(0, 100);

      resultPrograms = [];
      for (const { prog, progRef, progSnap } of progRefsAndSnaps) {
        const serverProg = progSnap && progSnap.exists && progSnap.exists() ? (progSnap.data() || {}) : {};
        const nextProgVersionNum = Math.max(
          Number(prog.versionNum) || 1,
          Number(serverProg.versionNum || 0) + 1
        );
        const mergedProg = {
          ...serverProg,
          ...prog,
          versionNum: nextProgVersionNum
        };
        resultPrograms.push(mergedProg);
        tx.set(progRef, mergedProg, { merge: true });
      }

      const updatedById = new Map(resultPrograms.map(p => [String(p.id), p]));
      const finalInlinePrograms = Array.isArray(counterUpdates.programs)
        ? counterUpdates.programs.map(p => updatedById.get(String(p?.id)) || p)
        : resultPrograms;

      const sanitizedCounters = sanitizeParentClientPayload({
        ...counterUpdates,
        programs: finalInlinePrograms
      });

      tx.update(clientRef, {
        ...sanitizedCounters,
        versionHistory: resultHistory,
        version: nextParentVersion,
        updatedAt: nowIso
      });
    });

    return {
      version: nextParentVersion,
      updatedAt: nowIso,
      updatedPrograms: resultPrograms,
      versionHistory: resultHistory
    };
  } catch (error) {
    if (error?.code === 'VERSION_CONFLICT') {
      throw error;
    }
    handleFirestoreError(error, OperationType.TRANSACTION, clientPath, { rethrow: true });
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
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, { rethrow: true });
  }
}

export async function saveEmployeeForTenant(tenantId, employee) {
  assertOnlineForWrite();
  if (!tenantId || !employee || !employee.id) {
    throw new Error('بيانات الموظف غير مكتملة للحفظ السحابي.');
  }
  const safeId = String(employee.id);
  const path = `users/${tenantId}/employees/${safeId}`;
  try {
    const payload = sanitizeEmployeeForFirestore(employee, tenantId);
    if (!payload) throw new Error('تعذر تهيئة بيانات الموظف.');

    const docRef = doc(db, path);
    await setDoc(docRef, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, { rethrow: true });
  }
}

export async function deleteEmployeeForTenant(tenantId, employeeId) {
  assertOnlineForWrite();
  if (!tenantId || !employeeId) {
    throw new Error('معرف الموظف مطلوب للحذف السحابي.');
  }
  const safeId = String(employeeId);
  const path = `users/${tenantId}/employees/${safeId}`;
  try {
    const docRef = doc(db, path);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, { rethrow: true });
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
        onUpdate(list, {
          fromCache: Boolean(snapshot.metadata?.fromCache),
          empty: snapshot.empty,
          docChanges: typeof snapshot.docChanges === 'function' ? snapshot.docChanges() : []
        });
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
  assertOnlineForWrite();
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
    handleFirestoreError(error, OperationType.WRITE, path, { rethrow: true });
  }
}

export async function getTenantActivities(tenantId, clientId = null, limitCount = 250) {
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId) return null;
  const path = `users/${safeTenantId}/activities`;
  try {
    const activitiesRef = collection(db, path);
    const activitiesQuery = clientId === null
      ? query(activitiesRef, orderBy('timestamp', 'desc'), limit(limitCount))
      : query(activitiesRef, where('clientId', '==', Number(clientId)), limit(limitCount));
    const snapshot = await getDocs(activitiesQuery);
    return snapshot.docs.map(activityDoc => ({
      ...activityDoc.data(),
      id: activityDoc.data().id || activityDoc.id
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, { rethrow: true });
  }
}

export function subscribeTenantActivities(tenantId, limitCount = 200, onUpdate, onError) {
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId) return () => {};
  const path = `users/${safeTenantId}/activities`;
  try {
    const collRef = collection(db, path);
    const q = query(collRef, orderBy('timestamp', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.data().id || d.id
      }));
      if (typeof onUpdate === 'function') {
        onUpdate(items, {
          fromCache: Boolean(snapshot.metadata?.fromCache),
          empty: snapshot.empty,
          docChanges: typeof snapshot.docChanges === 'function' ? snapshot.docChanges() : []
        });
      }
    }, (error) => {
      if (typeof onError === 'function') onError(error);
    });
  } catch (err) {
    if (typeof onError === 'function') onError(err);
    return () => {};
  }
}

// 5. Cloud Tenant Backups CRUD
export async function saveTenantBackup(userId, backup) {
  assertOnlineForWrite();
  const safeUid = sanitizeUserId(userId);
  if (!safeUid || !backup?.id) {
    throw new Error('معرف المستخدم والنسخة مطلوبان للحفظ السحابي.');
  }
  const safeId = String(backup.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${safeUid}/backups/${safeId}`;
  const payload = {
    id: safeId,
    uid: safeUid,
    timestamp: String(backup.timestamp || new Date().toISOString()),
    reason: String(backup.reason || 'نسخة احتياطية سحابية').slice(0, 120),
    clientCount: Number(backup.clientCount ?? (Array.isArray(backup.clients) ? backup.clients.length : 0)) || 0,
    nid: Number(backup.nid) || 100,
    stats: backup.stats || null,
    clients: Array.isArray(backup.clients) ? backup.clients : []
  };
  try {
    await setDoc(doc(db, path), payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, { rethrow: true });
  }
}

export async function getTenantBackups(userId, limitCount = 35) {
  const safeUid = sanitizeUserId(userId);
  if (!safeUid) return [];
  const path = `users/${safeUid}/backups`;
  try {
    const collRef = collection(db, path);
    const q = query(collRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, { rethrow: true });
  }
}

export async function deleteTenantBackup(userId, backupId) {
  assertOnlineForWrite();
  const safeUid = sanitizeUserId(userId);
  if (!safeUid || !backupId) {
    throw new Error('معرف النسخة مطلوب للحذف السحابي.');
  }
  const safeId = String(backupId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${safeUid}/backups/${safeId}`;
  try {
    await deleteDoc(doc(db, path));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, { rethrow: true });
  }
}

export async function saveTaskForTenant(tenantId, task) {
  assertOnlineForWrite();
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId || !task || !task.id) {
    throw new Error('بيانات المهمة غير مكتملة للحفظ السحابي.');
  }
  const safeId = String(task.id);
  const path = `users/${safeTenantId}/tasks/${safeId}`;
  const payload = {
    id: safeId,
    title: String(task.title || '').slice(0, 200),
    description: String(task.description || '').slice(0, 2000),
    clientId: task.clientId ? Number(task.clientId) : null,
    clientName: String(task.clientName || '').slice(0, 100),
    contactId: task.contactId ? String(task.contactId) : null,
    assignedStaffId: String(task.assignedStaffId || '').slice(0, 100),
    assignedStaffName: String(task.assignedStaffName || '').slice(0, 100),
    department: String(task.department || 'pre_vente').slice(0, 50),
    dueDate: String(task.dueDate || '').slice(0, 30),
    priority: String(task.priority || 'متوسطة').slice(0, 30),
    status: String(task.status || 'معلقة').slice(0, 30),
    resultNote: String(task.resultNote || '').slice(0, 1000),
    completedAt: String(task.completedAt || '').slice(0, 30),
    createdAt: String(task.createdAt || new Date().toISOString()),
    updatedAt: String(task.updatedAt || new Date().toISOString())
  };
  try {
    await setDoc(doc(db, path), payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, { rethrow: true });
  }
}

export async function deleteTaskForTenant(tenantId, taskId) {
  assertOnlineForWrite();
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId || !taskId) {
    throw new Error('معرف المهمة مطلوب للحذف السحابي.');
  }
  const safeId = String(taskId);
  const path = `users/${safeTenantId}/tasks/${safeId}`;
  try {
    await deleteDoc(doc(db, path));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, { rethrow: true });
  }
}

export function subscribeTasksForTenant(tenantId, onUpdate, onError) {
  const safeTenantId = sanitizeUserId(tenantId);
  if (!safeTenantId) return () => {};
  const path = `users/${safeTenantId}/tasks`;
  try {
    const collRef = collection(db, path);
    return onSnapshot(collRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      if (typeof onUpdate === 'function') {
        onUpdate(list, {
          fromCache: Boolean(snapshot.metadata?.fromCache),
          empty: snapshot.empty,
          docChanges: typeof snapshot.docChanges === 'function' ? snapshot.docChanges() : []
        });
      }
    }, (error) => {
      if (typeof onError === 'function') onError(error);
    });
  } catch (err) {
    if (typeof onError === 'function') onError(err);
    return () => {};
  }
}
