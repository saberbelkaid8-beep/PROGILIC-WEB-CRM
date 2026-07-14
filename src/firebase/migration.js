import { db } from './config.js';
import { doc, writeBatch, setDoc, deleteField, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './service.js';
import { validateClient, validateProgram, validateIssue, validateRequirement, validateContact } from './validation.js';

export async function migrateLegacyDataIfNeeded(userId, legacyData, currentNid) {
  const userPath = `users/${userId}`;
  console.log(`[MIGRATION] Starting schema migration v2 -> v3 for user: ${userId}`);

  try {
    const clientsToMigrate = legacyData.clients || [];
    let migratedClientsCount = 0;
    let globalActive = 0;
    let globalProspective = 0;
    let globalStopped = 0;
    let globalPrograms = 0;
    let globalInstalls = 0;
    let globalIssues = 0;

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

        const programsList = c.programs || [];
        const issuesList = c.issues || [];
        const requirementsList = c.requirements || [];
        const contactsList = c.contactHistory || [];

        const openIssuesCount = issuesList.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
        const installsCount = programsList.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0);

        const clientRaw = { ...c, openIssuesCount, programsCount: programsList.length, requirementsCount: requirementsList.length, installationsCount: installsCount };
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
        
        globalPrograms += programsList.length;
        globalInstalls += installsCount;
        globalIssues += openIssuesCount;
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
      totalPrograms: globalPrograms,
      totalLicensedDevices: globalInstalls,
      averageScore: migratedClientsCount > 0 ? Math.round(clientsToMigrate.reduce((acc, c) => acc + (typeof c.score === 'number' ? Math.max(0, Math.min(100, Math.round(c.score))) : 100), 0) / migratedClientsCount) : 100,
      totalOpenIssues: globalIssues
    };

    const userRef = doc(db, userPath);
    await setDoc(userRef, {
      v: 3,
      updatedAt: new Date().toISOString(),
      nid: currentNid || 100,
      stats: globalStats,
      clients: deleteField()
    }, { merge: true });

    console.log(`[MIGRATION] Completed successfully for user: ${userId}. Migrated ${migratedClientsCount} clients.`);
    return globalStats;

  } catch (error) {
    console.error(`[MIGRATION] Fatal error during migration:`, error);
    handleFirestoreError(error, OperationType.MIGRATION, userPath);
  }
}
