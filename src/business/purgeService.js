import { S, clients, setClients, updateState, currentUser, getActiveTenantId } from '../state/store.js';
import { createSnapshotBackup, downloadBackupJSON } from './backupService.js';
import { showToast } from '../utils/toast.js';
import { writeBatch, doc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';
import { saveUserData } from '../firebase/service.js';
import { clearAllUserData, saveClients } from './idbStorage.js';
import { computeScore } from './intelligence.js';
import { computeStats } from './mergeDatabase.js';

const AUDIT_LOGS_KEY = 'crm_purge_audit_logs';
const MAX_FIRESTORE_BATCH_OPS = 400;
const SUBCOLLECTION_FETCH_CONCURRENCY = 15;

export function normalizeClientNameKey(name = '') {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function parseClientNamesFromMarkdown(markdownText = '') {
  const seen = new Set();
  const names = [];
  const lines = String(markdownText || '').split(/\r?\n/);
  for (const line of lines) {
    const match = /^##\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const rawName = match[1].trim();
    if (!rawName) continue;
    const key = normalizeClientNameKey(rawName);
    if (!seen.has(key)) {
      seen.add(key);
      names.push(rawName);
    }
  }
  return names;
}

function getEffectiveProgramCount(clientObj) {
  const inlineLen = Array.isArray(clientObj?.programs) ? clientObj.programs.length : 0;
  return Math.max(inlineLen, Number(clientObj?.programsCount || 0));
}

function doesClientMatchProgramFilter(clientObj, {
  programTargetMode = 'all_with_programs',
  targetDate = '',
  targetDateMode = 'exact',
  targetClientNameKeys = null
}) {
  if (!clientObj) return false;
  if (getEffectiveProgramCount(clientObj) <= 0) return false;

  if (programTargetMode === 'from_md') {
    if (!(targetClientNameKeys instanceof Set) || targetClientNameKeys.size === 0) return false;
    const key = normalizeClientNameKey(clientObj.fullName || clientObj.name || '');
    return Boolean(key && targetClientNameKeys.has(key));
  }

  if (programTargetMode === 'by_date') {
    const cleanDate = String(targetDate || '').trim();
    if (!cleanDate) return false;
    const progs = Array.isArray(clientObj.programs) ? clientObj.programs : [];
    const clientStart = String(clientObj.startDate || '').trim().slice(0, 10);
    const progDates = progs.map(p => String(p?.startDate || '').trim().slice(0, 10)).filter(Boolean);
    const allDates = [clientStart, ...progDates].filter(Boolean);
    if (allDates.length === 0) return false;
    if (targetDateMode === 'since') {
      return allDates.some(d => d >= cleanDate);
    }
    return allDates.some(d => d === cleanDate);
  }

  return true;
}

async function commitBatchOperations(operations = [], chunkSize = MAX_FIRESTORE_BATCH_OPS) {
  if (!Array.isArray(operations) || operations.length === 0) return 0;
  let committed = 0;
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (!op || !op.ref) continue;
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else if (op.type === 'set') {
        batch.set(op.ref, op.data, op.options || { merge: true });
      }
    }
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

async function fetchClientSubcollectionDeleteOps(userId, clientId, subcollectionNames = []) {
  const ops = [];
  const basePath = `users/${userId}/clients/${String(clientId)}`;
  for (const subName of subcollectionNames) {
    try {
      const snap = await getDocs(collection(db, `${basePath}/${subName}`));
      if (snap && Array.isArray(snap.docs)) {
        snap.docs.forEach(d => {
          ops.push({ type: 'delete', ref: d.ref });
        });
      }
    } catch (err) {
      console.warn(`[Purge] Subcollection read notice (${basePath}/${subName}):`, err);
    }
  }
  return ops;
}

async function deleteClientsAndSubcollectionsInFirestore(userId, targetClients = [], onProgress = null) {
  if (!userId || !Array.isArray(targetClients) || targetClients.length === 0) return 0;
  const operations = [];
  const subCols = ['programs', 'issues', 'requirements', 'contacts'];

  for (let i = 0; i < targetClients.length; i += SUBCOLLECTION_FETCH_CONCURRENCY) {
    const chunk = targetClients.slice(i, i + SUBCOLLECTION_FETCH_CONCURRENCY);
    const chunkOps = await Promise.all(
      chunk.map(async (c) => {
        const subOps = await fetchClientSubcollectionDeleteOps(userId, c.id, subCols);
        subOps.push({
          type: 'delete',
          ref: doc(db, `users/${userId}/clients/${String(c.id)}`)
        });
        return subOps;
      })
    );
    chunkOps.forEach(list => operations.push(...list));
    if (onProgress) {
      const pct = 45 + Math.round((Math.min(i + chunk.length, targetClients.length) / targetClients.length) * 20);
      onProgress({ step: 3, text: `⚡ جاري تحضير حذف ${targetClients.length} عميل من السحابة...`, pct });
    }
  }

  return commitBatchOperations(operations);
}

async function clearClientSubcollectionsInFirestore(userId, targetClients = [], collectionsToClear = {}, nowIso, onProgress = null) {
  if (!userId || !Array.isArray(targetClients) || targetClients.length === 0) return new Map();

  const subColsToDelete = [];
  if (collectionsToClear.programs) subColsToDelete.push('programs');
  if (collectionsToClear.issues) subColsToDelete.push('issues');
  if (collectionsToClear.requirements) subColsToDelete.push('requirements');
  if (collectionsToClear.contacts) subColsToDelete.push('contacts');

  const operations = [];
  const updatedById = new Map();

  for (let i = 0; i < targetClients.length; i += SUBCOLLECTION_FETCH_CONCURRENCY) {
    const chunk = targetClients.slice(i, i + SUBCOLLECTION_FETCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (c) => {
        const subOps = await fetchClientSubcollectionDeleteOps(userId, c.id, subColsToDelete);

        const nextClient = { ...c };
        const clientPatch = { updatedAt: nowIso };

        if (collectionsToClear.programs) {
          nextClient.programs = [];
          nextClient.programsCount = 0;
          nextClient.installationsCount = 0;
          nextClient.programNames = [];
          nextClient.endDate = '';
          nextClient.programsPurgedAt = nowIso;

          clientPatch.programs = [];
          clientPatch.programsCount = 0;
          clientPatch.installationsCount = 0;
          clientPatch.programNames = [];
          clientPatch.endDate = '';
          clientPatch.programsPurgedAt = nowIso;
        }

        if (collectionsToClear.issues) {
          nextClient.issues = [];
          nextClient.openIssuesCount = 0;
          clientPatch.issues = [];
          clientPatch.openIssuesCount = 0;
        }

        if (collectionsToClear.requirements) {
          nextClient.requirements = [];
          nextClient.requirementsCount = 0;
          clientPatch.requirements = [];
          clientPatch.requirementsCount = 0;
        }

        if (collectionsToClear.contacts) {
          nextClient.contactHistory = [];
          nextClient.lastContact = '';
          clientPatch.contactHistory = [];
          clientPatch.lastContact = '';
        }

        const nextScore = computeScore({ ...nextClient, _subcollectionsLoaded: true }).total;
        nextClient.score = nextScore;
        nextClient.updatedAt = nowIso;
        clientPatch.score = nextScore;

        subOps.push({
          type: 'set',
          ref: doc(db, `users/${userId}/clients/${String(c.id)}`),
          data: clientPatch,
          options: { merge: true }
        });

        return { clientId: String(c.id), nextClient, ops: subOps };
      })
    );

    for (const item of chunkResults) {
      updatedById.set(item.clientId, item.nextClient);
      operations.push(...item.ops);
    }

    if (onProgress) {
      const processed = Math.min(i + chunk.length, targetClients.length);
      const pct = 45 + Math.round((processed / targetClients.length) * 25);
      onProgress({
        step: 3,
        text: `⚡ جاري حذف البرامج وتحديث سجلات العملاء في السحابة (${processed}/${targetClients.length})...`,
        pct
      });
    }
  }

  if (onProgress) {
    onProgress({
      step: 3,
      text: `☁️ جاري اعتماد ${operations.length} عملية تحديث وحذف في Firestore...`,
      pct: 75
    });
  }

  await commitBatchOperations(operations);
  return updatedById;
}

/**
 * Retrieves audit logs for past database purge/cleanup operations.
 */
export function getPurgeAuditLogs() {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read purge audit logs:", e);
    return [];
  }
}

/**
 * Appends a new audit log record.
 */
function recordAuditLog(entry) {
  try {
    const logs = getPurgeAuditLogs();
    logs.unshift(entry);
    if (logs.length > 50) logs.pop();
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to write purge audit log:", e);
  }
}

/**
 * Simulates a purge/cleanup operation (Dry Run Mode)
 * Returns metrics and impact preview without altering any database records.
 */
export function simulatePurge(config = {}) {
  const {
    targetScope = 'filtered', // 'all', 'filtered', 'selective'
    selectiveCollections = { clients: true, programs: true, issues: true, requirements: true, contacts: true, cache: true },
    filterType = 'stopped_clients', // 'stopped_clients', 'solved_issues', 'old_contacts', 'client_programs'
    olderThanDays = 30,
    programTargetMode = 'all_with_programs', // 'all_with_programs', 'by_date', 'from_md'
    targetDate = '',
    targetDateMode = 'exact', // 'exact', 'since'
    targetClientNames = []
  } = config;

  let affectedClients = [];
  let affectedProgramsCount = 0;
  let affectedIssuesCount = 0;
  let affectedReqsCount = 0;
  let affectedContactsCount = 0;
  let clientsDeletedCount = 0;

  const now = new Date();
  const targetClientNameKeys = new Set(
    (Array.isArray(targetClientNames) ? targetClientNames : [])
      .map(normalizeClientNameKey)
      .filter(Boolean)
  );

  if (targetScope === 'all') {
    affectedClients = [...clients];
    clientsDeletedCount = affectedClients.length;
    clients.forEach(c => {
      affectedProgramsCount += getEffectiveProgramCount(c);
      affectedIssuesCount += (c.issues || []).length;
      affectedReqsCount += (c.requirements || []).length;
      affectedContactsCount += (c.contactHistory || []).length;
    });
  } else if (targetScope === 'filtered') {
    if (filterType === 'client_programs') {
      affectedClients = clients.filter(c => doesClientMatchProgramFilter(c, {
        programTargetMode,
        targetDate,
        targetDateMode,
        targetClientNameKeys
      }));
      clientsDeletedCount = 0;
      affectedClients.forEach(c => {
        affectedProgramsCount += getEffectiveProgramCount(c);
      });
    } else if (filterType === 'stopped_clients') {
      affectedClients = clients.filter(c => {
        if (c.status !== 'متوقف') return false;
        if (!c.lastContact) return true;
        const diffDays = Math.floor((now - new Date(c.lastContact + 'T00:00')) / 86400000);
        return diffDays >= olderThanDays;
      });
      clientsDeletedCount = affectedClients.length;
      affectedClients.forEach(c => {
        affectedProgramsCount += getEffectiveProgramCount(c);
        affectedIssuesCount += (c.issues || []).length;
        affectedReqsCount += (c.requirements || []).length;
        affectedContactsCount += (c.contactHistory || []).length;
      });
    } else if (filterType === 'solved_issues') {
      clients.forEach(c => {
        const solved = (c.issues || []).filter(i => i.status === 'محلول' || i.status === 'مغلق');
        if (solved.length > 0) {
          affectedIssuesCount += solved.length;
          if (!affectedClients.some(x => x.id === c.id)) affectedClients.push(c);
        }
      });
      clientsDeletedCount = 0;
    } else if (filterType === 'old_contacts') {
      clients.forEach(c => {
        const oldCont = (c.contactHistory || []).filter(ch => {
          if (!ch.date) return false;
          const diff = Math.floor((now - new Date(ch.date + 'T00:00')) / 86400000);
          return diff >= olderThanDays;
        });
        if (oldCont.length > 0) {
          affectedContactsCount += oldCont.length;
          if (!affectedClients.some(x => x.id === c.id)) affectedClients.push(c);
        }
      });
      clientsDeletedCount = 0;
    }
  } else if (targetScope === 'selective') {
    const deleteWholeClients = Boolean(selectiveCollections.clients);
    clients.forEach(c => {
      const pCount = selectiveCollections.programs ? getEffectiveProgramCount(c) : 0;
      const iCount = selectiveCollections.issues ? (c.issues || []).length : 0;
      const rCount = selectiveCollections.requirements ? (c.requirements || []).length : 0;
      const cCount = selectiveCollections.contacts ? (c.contactHistory || []).length : 0;

      if (deleteWholeClients || pCount > 0 || iCount > 0 || rCount > 0 || cCount > 0) {
        affectedClients.push(c);
      }
      affectedProgramsCount += pCount;
      affectedIssuesCount += iCount;
      affectedReqsCount += rCount;
      affectedContactsCount += cCount;
    });
    clientsDeletedCount = deleteWholeClients ? affectedClients.length : 0;
  }

  const estBytes = (clientsDeletedCount * 1200) +
                   (affectedProgramsCount * 400) +
                   (affectedIssuesCount * 500) +
                   (affectedReqsCount * 400) +
                   (affectedContactsCount * 300);

  const freedKb = (estBytes / 1024).toFixed(1);

  return {
    targetScope,
    filterType,
    olderThanDays,
    programTargetMode,
    targetDate,
    targetDateMode,
    totalClientsAffected: affectedClients.length,
    clientsDeletedCount,
    clientsKeptCount: clientsDeletedCount === 0 ? affectedClients.length : 0,
    programsCount: affectedProgramsCount,
    issuesCount: affectedIssuesCount,
    reqsCount: affectedReqsCount,
    contactsCount: affectedContactsCount,
    estimatedFreedKb: freedKb,
    sampleClients: affectedClients.slice(0, 5).map(c => ({ id: c.id, fullName: c.fullName, company: c.company, status: c.status }))
  };
}

/**
 * Executes a full or filtered Purge operation across Cloud Firestore & Local Stores.
 */
export async function executePurge(config = {}, onProgress) {
  const {
    targetScope = 'filtered',
    selectiveCollections = { clients: true, programs: true, issues: true, requirements: true, contacts: true, cache: true },
    filterType = 'stopped_clients',
    olderThanDays = 30,
    programTargetMode = 'all_with_programs',
    targetDate = '',
    targetDateMode = 'exact',
    targetClientNames = [],
    autoBackup = true,
    downloadBackup = true,
    operatorNote = 'عملية محو وتصفية سريعة'
  } = config;

  if (!currentUser && !(auth && auth.currentUser)) {
    throw new Error("المستخدم غير مسجل الدخول.");
  }

  const userId = (auth && auth.currentUser && auth.currentUser.uid) || currentUser?.tenantId || currentUser?.uid || getActiveTenantId();
  const userEmail = (auth && auth.currentUser && auth.currentUser.email) || currentUser?.email || 'operator';
  const now = new Date();
  const nowIso = now.toISOString();

  // Progress Stage 1: Auto Backup
  if (onProgress) onProgress({ step: 1, text: "📦 جاري إنشاء النسخة الاحتياطية الوقائية في المتصفح...", pct: 15 });

  let backupRecord = null;
  if (autoBackup) {
    backupRecord = await createSnapshotBackup(userId, `نسخة تلقائية قبل المحو - ${operatorNote}`, clients, S.stats, S.nid);
    if (downloadBackup && backupRecord) {
      downloadBackupJSON(backupRecord);
    }
  }

  // Progress Stage 2: Calculate target data
  if (onProgress) onProgress({ step: 2, text: "🔍 جاري حصر وثائق الخادم المشمولة بالتصفية...", pct: 35 });

  const sim = simulatePurge(config);
  const targetClientNameKeys = new Set(
    (Array.isArray(targetClientNames) ? targetClientNames : [])
      .map(normalizeClientNameKey)
      .filter(Boolean)
  );

  // Progress Stage 3: Cloud Firestore Batch Wipe / Update
  if (onProgress) onProgress({ step: 3, text: "⚡ جاري إرسال أوامر التصفية للسحابة (Firestore)...", pct: 50 });

  let updatedClients = [...clients];
  let purgeProgramsOnly = false;
  let purgedClientIds = [];

  if (targetScope === 'all') {
    await deleteClientsAndSubcollectionsInFirestore(userId, clients, onProgress);
    updatedClients = [];

  } else if (targetScope === 'filtered') {
    if (filterType === 'client_programs') {
      const targetList = clients.filter(c => doesClientMatchProgramFilter(c, {
        programTargetMode,
        targetDate,
        targetDateMode,
        targetClientNameKeys
      }));
      purgeProgramsOnly = true;
      purgedClientIds = targetList.map(c => c.id);

      const updatedMap = await clearClientSubcollectionsInFirestore(
        userId,
        targetList,
        { programs: true },
        nowIso,
        onProgress
      );
      updatedClients = clients.map(c => updatedMap.get(String(c.id)) || c);

    } else if (filterType === 'stopped_clients') {
      const toDeleteList = clients.filter(c => {
        if (c.status !== 'متوقف') return false;
        if (!c.lastContact) return true;
        const diffDays = Math.floor((now - new Date(c.lastContact + 'T00:00')) / 86400000);
        return diffDays >= olderThanDays;
      });

      await deleteClientsAndSubcollectionsInFirestore(userId, toDeleteList, onProgress);

      const deleteIds = new Set(toDeleteList.map(c => String(c.id)));
      updatedClients = clients.filter(c => !deleteIds.has(String(c.id)));

    } else if (filterType === 'solved_issues') {
      const affected = [];
      const operations = [];
      updatedClients = clients.map(c => {
        const solvedIssues = (c.issues || []).filter(i => i.status === 'محلول' || i.status === 'مغلق');
        if (solvedIssues.length === 0) return c;
        const remainingIssues = (c.issues || []).filter(i => i.status !== 'محلول' && i.status !== 'مغلق');
        const openIssuesCount = remainingIssues.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد')).length;
        const nextClient = { ...c, issues: remainingIssues, openIssuesCount, updatedAt: nowIso };
        nextClient.score = computeScore({ ...nextClient, _subcollectionsLoaded: true }).total;
        affected.push({ clientId: c.id, solvedIssues, nextClient });
        return nextClient;
      });

      for (const item of affected) {
        for (const iss of item.solvedIssues) {
          if (iss && iss.id !== undefined) {
            operations.push({
              type: 'delete',
              ref: doc(db, `users/${userId}/clients/${String(item.clientId)}/issues/${String(iss.id)}`)
            });
          }
        }
        operations.push({
          type: 'set',
          ref: doc(db, `users/${userId}/clients/${String(item.clientId)}`),
          data: {
            issues: item.nextClient.issues,
            openIssuesCount: item.nextClient.openIssuesCount,
            score: item.nextClient.score,
            updatedAt: nowIso
          },
          options: { merge: true }
        });
      }
      await commitBatchOperations(operations);

    } else if (filterType === 'old_contacts') {
      const affected = [];
      const operations = [];
      updatedClients = clients.map(c => {
        const oldContacts = (c.contactHistory || []).filter(ch => {
          if (!ch.date) return false;
          const diff = Math.floor((now - new Date(ch.date + 'T00:00')) / 86400000);
          return diff >= olderThanDays;
        });
        if (oldContacts.length === 0) return c;
        const recentContacts = (c.contactHistory || []).filter(ch => {
          if (!ch.date) return true;
          const diff = Math.floor((now - new Date(ch.date + 'T00:00')) / 86400000);
          return diff < olderThanDays;
        });
        const nextClient = { ...c, contactHistory: recentContacts, updatedAt: nowIso };
        affected.push({ clientId: c.id, oldContacts, nextClient });
        return nextClient;
      });

      for (const item of affected) {
        for (const ch of item.oldContacts) {
          if (ch && ch.id !== undefined) {
            operations.push({
              type: 'delete',
              ref: doc(db, `users/${userId}/clients/${String(item.clientId)}/contacts/${String(ch.id)}`)
            });
          }
        }
        operations.push({
          type: 'set',
          ref: doc(db, `users/${userId}/clients/${String(item.clientId)}`),
          data: {
            contactHistory: item.nextClient.contactHistory,
            updatedAt: nowIso
          },
          options: { merge: true }
        });
      }
      await commitBatchOperations(operations);
    }
  } else if (targetScope === 'selective') {
    if (selectiveCollections.clients) {
      await deleteClientsAndSubcollectionsInFirestore(userId, clients, onProgress);
      updatedClients = [];
    } else {
      const hasSubcollectionSelection = Boolean(
        selectiveCollections.programs ||
        selectiveCollections.issues ||
        selectiveCollections.requirements ||
        selectiveCollections.contacts
      );
      if (hasSubcollectionSelection) {
        const targetList = clients.filter(c => (
          (selectiveCollections.programs && getEffectiveProgramCount(c) > 0) ||
          (selectiveCollections.issues && (c.issues || []).length > 0) ||
          (selectiveCollections.requirements && (c.requirements || []).length > 0) ||
          (selectiveCollections.contacts && (c.contactHistory || []).length > 0)
        ));
        if (selectiveCollections.programs && !selectiveCollections.issues && !selectiveCollections.requirements && !selectiveCollections.contacts) {
          purgeProgramsOnly = true;
          purgedClientIds = targetList.map(c => c.id);
        } else if (selectiveCollections.programs) {
          purgeProgramsOnly = true;
          purgedClientIds = targetList.map(c => c.id);
        }

        const updatedMap = await clearClientSubcollectionsInFirestore(
          userId,
          targetList,
          selectiveCollections,
          nowIso,
          onProgress
        );
        updatedClients = clients.map(c => updatedMap.get(String(c.id)) || c);
      }
    }
  }

  // Progress Stage 4: Local Cache / IndexedDB Flush
  if (onProgress) onProgress({ step: 4, text: "🧹 جاري تطهير الذاكرة المؤقتة ومزامنة المؤشرات...", pct: 85 });

  try {
    if (selectiveCollections.cache && updatedClients.length === 0) {
      await clearAllUserData(userId);
    } else {
      await saveClients(userId, updatedClients);
    }
  } catch (idbErr) {
    console.warn("[Purge] Local cache sync notice:", idbErr);
  }

  const { stats: newStats } = computeStats(updatedClients);

  await saveUserData(userId, {
    v: 3,
    updatedAt: nowIso,
    stats: newStats
  });

  // Update in-memory global state
  setClients(updatedClients);
  updateState({ stats: newStats });

  // Progress Stage 5: Record Security Audit Log
  if (onProgress) onProgress({ step: 5, text: "📜 تسجيل العملية في سجل التدقيق الأمني (Audit Log)...", pct: 100 });

  const auditEntry = {
    id: 'audit-' + Date.now(),
    timestamp: nowIso,
    operatorEmail: userEmail,
    scope: targetScope,
    filterType: targetScope === 'filtered' ? filterType : 'all',
    deletedClientsCount: sim.clientsDeletedCount,
    affectedClientsCount: sim.totalClientsAffected,
    deletedProgramsCount: sim.programsCount,
    deletedIssuesCount: sim.issuesCount,
    backupSnapshotId: backupRecord ? backupRecord.id : null,
    operatorNote
  };

  recordAuditLog(auditEntry);

  if (sim.clientsDeletedCount === 0 && sim.programsCount > 0) {
    showToast(`تم حذف ${sim.programsCount} برنامج/ترخيص بنجاح مع الإبقاء على أسماء وسجلات العملاء (${sim.totalClientsAffected} عميل)!`, "success");
  } else if (sim.clientsDeletedCount === 0) {
    showToast(`تمت تصفية البيانات المحددة بنجاح مع الإبقاء على جميع العملاء!`, "success");
  } else {
    showToast(`تمت تصفية ومحو البيانات بنجاح! تم حذف ${sim.clientsDeletedCount} عميل و ${sim.programsCount} برنامج.`, "success");
  }

  return {
    success: true,
    summary: sim,
    auditEntry,
    purgeProgramsOnly,
    purgedBefore: nowIso,
    purgedClientIds
  };
}
