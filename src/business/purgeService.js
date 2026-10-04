import { S, clients, setClients, updateState, currentUser } from '../state/store.js';
import { createSnapshotBackup, downloadBackupJSON } from './backupService.js';
import { showToast } from '../utils/toast.js';
import { writeBatch, doc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { saveUserData } from '../firebase/service.js';
import { clearAllUserData, getClients, saveClients } from './idbStorage.js';

const AUDIT_LOGS_KEY = 'crm_purge_audit_logs';

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
    // Keep last 50 entries
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
export function simulatePurge(config) {
  const {
    targetScope = 'filtered', // 'all', 'filtered', 'selective'
    selectiveCollections = { clients: true, programs: true, issues: true, requirements: true, contacts: true, cache: true },
    filterType = 'stopped_clients', // 'stopped_clients', 'solved_issues', 'expired_programs', 'old_contacts', 'custom_date'
    olderThanDays = 30
  } = config;

  let affectedClients = [];
  let affectedProgramsCount = 0;
  let affectedIssuesCount = 0;
  let affectedReqsCount = 0;
  let affectedContactsCount = 0;

  const now = new Date();

  if (targetScope === 'all') {
    affectedClients = [...clients];
    clients.forEach(c => {
      affectedProgramsCount += (c.programs || []).length;
      affectedIssuesCount += (c.issues || []).length;
      affectedReqsCount += (c.requirements || []).length;
      affectedContactsCount += (c.contactHistory || []).length;
    });
  } else if (targetScope === 'filtered') {
    if (filterType === 'stopped_clients') {
      affectedClients = clients.filter(c => {
        if (c.status !== 'متوقف') return false;
        if (!c.lastContact) return true;
        const diffDays = Math.floor((now - new Date(c.lastContact + 'T00:00')) / 86400000);
        return diffDays >= olderThanDays;
      });
      affectedClients.forEach(c => {
        affectedProgramsCount += (c.programs || []).length;
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
    } else if (filterType === 'expired_programs') {
      clients.forEach(c => {
        const expired = (c.programs || []).filter(p => p.endDate && new Date(p.endDate + 'T00:00') < now);
        if (expired.length > 0) {
          affectedProgramsCount += expired.length;
          if (!affectedClients.some(x => x.id === c.id)) affectedClients.push(c);
        }
      });
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
    }
  } else if (targetScope === 'selective') {
    clients.forEach(c => {
      if (selectiveCollections.clients) affectedClients.push(c);
      if (selectiveCollections.programs) affectedProgramsCount += (c.programs || []).length;
      if (selectiveCollections.issues) affectedIssuesCount += (c.issues || []).length;
      if (selectiveCollections.requirements) affectedReqsCount += (c.requirements || []).length;
      if (selectiveCollections.contacts) affectedContactsCount += (c.contactHistory || []).length;
    });
  }

  // Calculate estimated bytes freed (~1.2KB per client object + 400B per item)
  const estBytes = (affectedClients.length * 1200) +
                   (affectedProgramsCount * 400) +
                   (affectedIssuesCount * 500) +
                   (affectedReqsCount * 400) +
                   (affectedContactsCount * 300);

  const freedKb = (estBytes / 1024).toFixed(1);

  return {
    targetScope,
    filterType,
    olderThanDays,
    totalClientsAffected: affectedClients.length,
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
export async function executePurge(config, onProgress) {
  const {
    targetScope = 'filtered',
    selectiveCollections = { clients: true, programs: true, issues: true, requirements: true, contacts: true, cache: true },
    filterType = 'stopped_clients',
    olderThanDays = 30,
    autoBackup = true,
    downloadBackup = true,
    operatorNote = 'عملية محو وتصفية سريعة'
  } = config;

  if (!currentUser) {
    throw new Error("المستخدم غير مسجل الدخول.");
  }

  const userId = currentUser.uid;
  const userEmail = currentUser.email || 'operator';
  const now = new Date();

  // Progress Stage 1: Auto Backup
  if (onProgress) onProgress({ step: 1, text: "📦 جاري إنشاء النسخة الاحتياطية الوقائية في المتصفح...", pct: 20 });

  let backupRecord = null;
  if (autoBackup) {
    backupRecord = await createSnapshotBackup(userId, `نسخة تلقائية قبل المحو - ${operatorNote}`, clients, S.stats, S.nid);
    if (downloadBackup && backupRecord) {
      downloadBackupJSON(backupRecord);
    }
  }

  // Progress Stage 2: Calculate target data
  if (onProgress) onProgress({ step: 2, text: "🔍 جاري حصر وثائق الخادم المشمولة بالتصفية...", pct: 40 });

  const sim = simulatePurge(config);
  
  // Progress Stage 3: Cloud Firestore Batch Wipe
  if (onProgress) onProgress({ step: 3, text: "⚡ جاري إرسال أوامر الحذف الجماعي (Batch Delete) للسحابة...", pct: 60 });

  let updatedClients = [...clients];

  if (targetScope === 'all') {
    // Delete all client docs and subcollections
    const batch = writeBatch(db);
    for (const c of clients) {
      batch.delete(doc(db, `users/${userId}/clients/${c.id}`));
    }
    await batch.commit();
    updatedClients = [];

  } else if (targetScope === 'filtered') {
    if (filterType === 'stopped_clients') {
      const idsToDelete = sim.sampleClients.map(c => c.id);
      // Delete matching clients
      const toDeleteList = clients.filter(c => {
        if (c.status !== 'متوقف') return false;
        if (!c.lastContact) return true;
        const diffDays = Math.floor((now - new Date(c.lastContact + 'T00:00')) / 86400000);
        return diffDays >= olderThanDays;
      });

      const batch = writeBatch(db);
      for (const c of toDeleteList) {
        batch.delete(doc(db, `users/${userId}/clients/${c.id}`));
      }
      await batch.commit();

      const deleteIds = new Set(toDeleteList.map(c => c.id));
      updatedClients = clients.filter(c => !deleteIds.has(c.id));

    } else if (filterType === 'solved_issues') {
      updatedClients = clients.map(c => {
        const remainingIssues = (c.issues || []).filter(i => i.status !== 'محلول' && i.status !== 'مغلق');
        return { ...c, issues: remainingIssues };
      });
    } else if (filterType === 'expired_programs') {
      updatedClients = clients.map(c => {
        const activePrograms = (c.programs || []).filter(p => !p.endDate || new Date(p.endDate + 'T00:00') >= now);
        return { ...c, programs: activePrograms };
      });
    } else if (filterType === 'old_contacts') {
      updatedClients = clients.map(c => {
        const recentContacts = (c.contactHistory || []).filter(ch => {
          if (!ch.date) return true;
          const diff = Math.floor((now - new Date(ch.date + 'T00:00')) / 86400000);
          return diff < olderThanDays;
        });
        return { ...c, contactHistory: recentContacts };
      });
    }
  } else if (targetScope === 'selective') {
    updatedClients = clients.map(c => {
      let nc = { ...c };
      if (selectiveCollections.programs) nc.programs = [];
      if (selectiveCollections.issues) nc.issues = [];
      if (selectiveCollections.requirements) nc.requirements = [];
      if (selectiveCollections.contacts) nc.contactHistory = [];
      return nc;
    });

    if (selectiveCollections.clients) {
      const batch = writeBatch(db);
      for (const c of clients) {
        batch.delete(doc(db, `users/${userId}/clients/${c.id}`));
      }
      await batch.commit();
      updatedClients = [];
    }
  }

  // Progress Stage 4: Local Cache / IndexedDB Flush
  if (onProgress) onProgress({ step: 4, text: "🧹 جاري تطهير الذاكرة المؤقتة ومزامنة المؤشرات...", pct: 80 });

  if (selectiveCollections.cache && updatedClients.length === 0) {
    await clearAllUserData(userId);
  } else {
    await saveClients(userId, updatedClients);
  }

  // Calculate updated stats
  const activeCount = updatedClients.filter(c => c.status === 'نشط').length;
  const prospectiveCount = updatedClients.filter(c => c.status === 'محتمل').length;
  const stoppedCount = updatedClients.filter(c => c.status === 'متوقف').length;
  const totalProgs = updatedClients.reduce((acc, c) => acc + (c.programs || []).length, 0);
  const totalInsts = updatedClients.reduce((acc, c) => acc + (c.programs || []).reduce((sum, p) => sum + (Number(p.installationsCount) || 1), 0), 0);
  const totalOpenIss = updatedClients.reduce((acc, c) => acc + (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length, 0);

  const newStats = {
    activeClients: activeCount,
    prospectiveClients: prospectiveCount,
    stoppedClients: stoppedCount,
    totalClients: updatedClients.length,
    totalPrograms: totalProgs,
    totalLicensedDevices: totalInsts,
    averageScore: updatedClients.length > 0 ? Math.round(updatedClients.reduce((acc, c) => acc + (c.score || 100), 0) / updatedClients.length) : 100,
    totalOpenIssues: totalOpenIss
  };

  await saveUserData(userId, {
    v: 3,
    updatedAt: now.toISOString(),
    stats: newStats
  });

  // Update in-memory global state
  setClients(updatedClients);
  updateState({ stats: newStats });

  // Progress Stage 5: Record Security Audit Log
  if (onProgress) onProgress({ step: 5, text: "📜 تسجيل العملية في سجل التدقيق الأمني (Audit Log)...", pct: 100 });

  const auditEntry = {
    id: 'audit-' + Date.now(),
    timestamp: now.toISOString(),
    operatorEmail: userEmail,
    scope: targetScope,
    filterType: targetScope === 'filtered' ? filterType : 'all',
    deletedClientsCount: sim.totalClientsAffected,
    deletedProgramsCount: sim.programsCount,
    deletedIssuesCount: sim.issuesCount,
    backupSnapshotId: backupRecord ? backupRecord.id : null,
    operatorNote
  };

  recordAuditLog(auditEntry);

  showToast(`تمت تصفية ومحو البيانات بنجاح! تم حذف ${sim.totalClientsAffected} عميل و ${sim.issuesCount} مشكلة.`, "success");

  return {
    success: true,
    summary: sim,
    auditEntry
  };
}
