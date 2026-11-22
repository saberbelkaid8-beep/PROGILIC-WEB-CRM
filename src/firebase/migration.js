import { db } from './config.js';
import { doc, writeBatch, setDoc, deleteField } from 'firebase/firestore';
import { assertOnlineForWrite, handleFirestoreError, OperationType } from './service.js';
import { validateClient, validateProgram, validateIssue, validateRequirement, validateContact } from './validation.js';

export async function migrateLegacyDataIfNeeded(userId, legacyData, currentNid) {
  const userPath = `users/${userId}`;
  console.log(`[MIGRATION] Starting schema migration v2 -> v3 for user: ${userId}`);

  try {
    assertOnlineForWrite();
    const clientsToMigrate = Array.isArray(legacyData?.clients) ? legacyData.clients.filter(Boolean) : [];
    let migratedClientsCount = 0;
    let globalActive = 0;
    let globalProspective = 0;
    let globalStopped = 0;
    let globalPrograms = 0;
    let globalInstalls = 0;
    let globalIssues = 0;
    let scoreSum = 0;

    // Track exact writeBatch operation counts so we never exceed Firestore's 500-op hard limit
    const MAX_BATCH_OPS = 400;
    let batch = writeBatch(db);
    let opCount = 0;

    const flushBatchIfNeeded = async (force = false) => {
      if (opCount >= MAX_BATCH_OPS || (force && opCount > 0)) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const c of clientsToMigrate) {
      const clientId = String(c.id);
      const clientPath = `users/${userId}/clients/${clientId}`;

      const programsList = Array.isArray(c.programs) ? c.programs.filter(Boolean).map(validateProgram) : [];
      const issuesList = Array.isArray(c.issues) ? c.issues.filter(Boolean).map(validateIssue) : [];
      const requirementsList = Array.isArray(c.requirements) ? c.requirements.filter(Boolean).map(validateRequirement) : [];
      const contactsList = Array.isArray(c.contactHistory) ? c.contactHistory.filter(Boolean).map(validateContact) : [];

      const openIssues = issuesList.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد');
      const issuesByPriority = {
        عاجل: openIssues.filter(i => i.priority === 'عاجل' || i.priority === 'عاجلة').length,
        عالية: openIssues.filter(i => i.priority === 'عالية').length,
        متوسطة: openIssues.filter(i => i.priority === 'متوسطة').length,
        منخفضة: openIssues.filter(i => i.priority === 'منخفضة' || !i.priority).length
      };
      const reqsByStatus = {
        مقترح: requirementsList.filter(r => r.status === 'مقترح' || !r.status).length,
        'قيد الدراسة': requirementsList.filter(r => r.status === 'قيد الدراسة').length,
        مخطط: requirementsList.filter(r => r.status === 'مخطط').length,
        منفذ: requirementsList.filter(r => r.status === 'منفذ').length
      };
      const installsCount = programsList.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0);

      const clientRaw = {
        ...c,
        programs: programsList,
        programNames: programsList.map(p => p.programName).filter(Boolean),
        openIssuesCount: openIssues.length,
        urgentIssuesCount: (issuesByPriority.عاجل || 0) + (issuesByPriority.عالية || 0),
        solvedIssuesCount: issuesList.filter(i => i.status === 'محلول' || i.status === 'مغلق').length,
        issuesByPriority,
        programsCount: programsList.length,
        requirementsCount: requirementsList.length,
        reqsByStatus,
        installationsCount: installsCount,
        contactsCount: contactsList.length,
        version: Math.max(1, Number(c.version) || 1)
      };
      const clientDoc = validateClient(clientRaw);

      const subWrites = [
        ...programsList.map(p => ({ ref: doc(db, `${clientPath}/programs/${p.id}`), data: p })),
        ...issuesList.map(i => ({ ref: doc(db, `${clientPath}/issues/${i.id}`), data: i })),
        ...requirementsList.map(r => ({ ref: doc(db, `${clientPath}/requirements/${r.id}`), data: r })),
        ...contactsList.map(ch => ({ ref: doc(db, `${clientPath}/contacts/${ch.id}`), data: ch }))
      ];

      if (opCount > 0 && opCount + 1 + subWrites.length > MAX_BATCH_OPS) {
        await flushBatchIfNeeded(true);
      }

      batch.set(doc(db, clientPath), clientDoc);
      opCount++;
      await flushBatchIfNeeded(false);

      for (const sw of subWrites) {
        batch.set(sw.ref, sw.data);
        opCount++;
        await flushBatchIfNeeded(false);
      }

      migratedClientsCount++;
      if (clientDoc.status === 'نشط') globalActive++;
      else if (clientDoc.status === 'محتمل') globalProspective++;
      else if (clientDoc.status === 'متوقف') globalStopped++;

      globalPrograms += programsList.length;
      globalInstalls += installsCount;
      globalIssues += openIssues.length;
      scoreSum += clientDoc.score;
    }

    await flushBatchIfNeeded(true);

    const globalStats = {
      activeClients: globalActive,
      prospectiveClients: globalProspective,
      stoppedClients: globalStopped,
      totalClients: migratedClientsCount,
      totalPrograms: globalPrograms,
      totalLicensedDevices: globalInstalls,
      averageScore: migratedClientsCount > 0 ? Math.round(scoreSum / migratedClientsCount) : 100,
      totalOpenIssues: globalIssues
    };

    const userRef = doc(db, userPath);
    try {
      await setDoc(userRef, {
        v: 3,
        updatedAt: new Date().toISOString(),
        nid: currentNid || 100,
        stats: globalStats,
        clients: deleteField()
      }, { merge: true });
    } catch (setErr) {
      console.warn("[MIGRATION] setDoc with deleteField had minor issue, falling back to clean setDoc:", setErr);
      await setDoc(userRef, {
        v: 3,
        updatedAt: new Date().toISOString(),
        nid: currentNid || 100,
        stats: globalStats
      }, { merge: true });
    }

    console.log(`[MIGRATION] Completed successfully for user: ${userId}. Migrated ${migratedClientsCount} clients.`);
    return globalStats;
  } catch (error) {
    console.error(`[MIGRATION] Fatal error during migration:`, error);
    handleFirestoreError(error, OperationType.MIGRATION, userPath, { rethrow: true });
  }
}
