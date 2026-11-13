import { db } from './config.js';
import { doc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './service.js';
import { validateClient, validateProgram, validateIssue, validateRequirement, validateContact } from './validation.js';

export async function migrateLegacyDataIfNeeded(userId, legacyData, currentNid, options = {}) {
  if (options.approved !== true || options.backupVerified !== true) {
    return {
      status: 'blocked',
      writesPerformed: 0,
      reason: 'Legacy migration requires explicit approval and a verified pre-migration backup.'
    };
  }

  const userPath = `users/${userId}`;
  console.log(`[MIGRATION] Starting schema migration v2 -> v3 for user: ${userId}`);

  try {
    const clientsToMigrate = legacyData.clients || [];
    for (const client of clientsToMigrate) {
      validateClient(client);
      if (Array.isArray(client?.programs)) {
        client.programs.forEach(validateProgram);
      }
    }
    let migratedClientsCount = 0;
    let globalActive = 0;
    let globalProspective = 0;
    let globalStopped = 0;
    let globalPrograms = 0;
    let globalInstalls = 0;
    let globalIssues = 0;
    let programCountsComplete = true;
    let installationCountsComplete = true;
    let issueCountsComplete = true;

    // Batch chunking (Firestore limit is 500 writes per batch)
    // A single client might have up to 10 sub-documents. So ~40 clients per batch is safe.
    const CHUNK_SIZE = 25; 
    
    for (let i = 0; i < clientsToMigrate.length; i += CHUNK_SIZE) {
      const chunk = clientsToMigrate.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      
      console.log(`[MIGRATION] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(clientsToMigrate.length / CHUNK_SIZE)}`);
      
      for (const c of chunk) {
        const clientId = String(c.id);
        const clientPath = `users/${userId}/clients/${clientId}`;

        const programsList = Array.isArray(c.programs) ? c.programs : [];
        const issuesList = Array.isArray(c.issues) ? c.issues : [];
        const requirementsList = Array.isArray(c.requirements) ? c.requirements : [];
        const contactsList = c.contactHistory || [];

        const hasLoadedIssues = c._subcollectionsLoaded === true || issuesList.length > 0;
        const openIssuesCount = hasLoadedIssues
          ? issuesList.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length
          : c.openIssuesCount;
        const requirementsCount = c._subcollectionsLoaded === true || requirementsList.length > 0
          ? requirementsList.length
          : c.requirementsCount;
        const canonicalInstallations = programsList.reduce((total, program) => {
          const count = Number(program.installationsCount);
          return Number.isSafeInteger(count) && count > 0 ? total + count : total;
        }, 0);

        const hasLoadedPrograms = c._subcollectionsLoaded === true || programsList.length > 0;
        const programCount = hasLoadedPrograms ? programsList.length : c.programsCount;
        const allProgramInstallationsKnown = programsList.every(program => {
          const count = Number(program.installationsCount);
          return Number.isSafeInteger(count) && count > 0;
        });
        const installationsCount = hasLoadedPrograms
          ? (allProgramInstallationsKnown ? canonicalInstallations : undefined)
          : c.installationsCount;
        const clientRaw = { ...c };
        if (openIssuesCount !== undefined) clientRaw.openIssuesCount = openIssuesCount;
        if (requirementsCount !== undefined) clientRaw.requirementsCount = requirementsCount;
        if (programCount !== undefined) clientRaw.programsCount = programCount;
        if (installationsCount !== undefined) clientRaw.installationsCount = installationsCount;
        const clientDoc = validateClient(clientRaw);

        // Write client document
        batch.set(doc(db, clientPath), clientDoc);

        // Write subcollections
        programsList.forEach(p => {
          const validData = validateProgram(p);
          batch.set(doc(db, `${clientPath}/programs/${validData.id}`), validData);
        });

        issuesList.forEach(i => {
          const validData = validateIssue(i);
          batch.set(doc(db, `${clientPath}/issues/${validData.id}`), validData);
        });

        requirementsList.forEach(r => {
          const validData = validateRequirement(r);
          batch.set(doc(db, `${clientPath}/requirements/${validData.id}`), validData);
        });

        contactsList.forEach(ch => {
          const validData = validateContact(ch);
          batch.set(doc(db, `${clientPath}/contacts/${validData.id}`), validData);
        });

        // Update counters
        migratedClientsCount++;
        if (clientDoc.status === 'نشط') globalActive++;
        else if (clientDoc.status === 'محتمل') globalProspective++;
        else if (clientDoc.status === 'متوقف') globalStopped++;
        
        if (programCount !== undefined && programCount !== null && Number.isSafeInteger(Number(programCount)) && Number(programCount) >= 0) {
          globalPrograms += Number(programCount);
        } else {
          programCountsComplete = false;
        }
        if (installationsCount !== undefined && installationsCount !== null && Number.isSafeInteger(Number(installationsCount)) && Number(installationsCount) >= 0) {
          globalInstalls += Number(installationsCount);
        } else {
          installationCountsComplete = false;
        }
        if (openIssuesCount !== undefined && Number.isSafeInteger(openIssuesCount) && openIssuesCount >= 0) {
          globalIssues += openIssuesCount;
        } else {
          issueCountsComplete = false;
        }
      }
      
      // Commit the chunk
      await batch.commit();
      console.log(`[MIGRATION] Chunk committed successfully.`);
    }

    // Now update user global parent metadata doc
    // Using setDoc with merge: true overwrites the document and allows us to use deleteField
    // wait, actually setDoc({ merge: true }) DOES allow deleteField! 
    const globalStats = {
      activeClients: globalActive,
      prospectiveClients: globalProspective,
      stoppedClients: globalStopped,
      totalClients: migratedClientsCount,
      averageScore: migratedClientsCount > 0 ? Math.round(clientsToMigrate.reduce((acc, c) => acc + (typeof c.score === 'number' ? Math.max(0, Math.min(100, Math.round(c.score))) : 100), 0) / migratedClientsCount) : 100,
    };
    if (programCountsComplete) globalStats.totalPrograms = globalPrograms;
    if (installationCountsComplete) globalStats.totalLicensedDevices = globalInstalls;
    if (issueCountsComplete) globalStats.totalOpenIssues = globalIssues;

    const userRef = doc(db, userPath);
    const userMetadata = {
      v: 3,
      updatedAt: new Date().toISOString(),
      stats: globalStats
    };
    if (Number.isSafeInteger(currentNid) && currentNid >= 0) userMetadata.nid = currentNid;
    await setDoc(userRef, userMetadata, { merge: true });

    console.log(`[MIGRATION] Completed successfully for user: ${userId}. Migrated ${migratedClientsCount} clients.`);
    return globalStats;

  } catch (error) {
    console.error(`[MIGRATION] Fatal error during migration:`, error);
    handleFirestoreError(error, OperationType.MIGRATION, userPath);
  }
}
