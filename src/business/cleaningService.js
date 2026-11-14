import { db } from '../firebase/config.js';
import { doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { clients, S, setClients } from '../state/store.js';
import { validateClient, validateProgram } from '../firebase/validation.js';
import { createSnapshotBackup } from './backupService.js';
import { showToast } from '../utils/toast.js';

async function commitChunkedOperations(ops) {
  const CHUNK_SIZE = 450;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + CHUNK_SIZE);
    slice.forEach(op => {
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else if (op.type === 'set') {
        batch.set(op.ref, op.data, op.options || {});
      }
    });
    await batch.commit();
  }
}

/**
 * PROGILIC CRM - Data Cleaning & Sanitization Service
 * Performs bulk cleaning of client names, program deduplication, and schema enhancement.
 */
export async function runProductionDataCleaning(userId) {
  if (!userId) return { success: false, error: 'No User ID' };

  console.log(`[Cleaning] Starting PRODUCTION data cleaning for user: ${userId}`);

  try {
    // 1. Mandatory Backup with proper arguments
    await createSnapshotBackup(userId, 'نسخة وقائية قبل التنظيف', clients, S.stats, S.nid);
    console.log(`[Cleaning] Initial backup created successfully.`);

    const ops = [];
    const clientsToClean = clients.filter(c =>
      (c.fullName && (c.fullName.includes('GC -') || c.fullName.includes('GC-') || c.fullName.includes('GC _'))) ||
      (Array.isArray(c.programs) && c.programs.length > 0)
    );

    console.log(`[Cleaning] Found ${clientsToClean.length} clients requiring cleanup logic.`);

    const cleanedClients = [...clients];

    for (const client of clientsToClean) {
      const clientIdx = cleanedClients.findIndex(x => x.id === client.id);
      if (clientIdx === -1) continue;

      const original = { ...client };
      let cleanName = original.fullName || '';
      let category = original.category || '';

      // Rule: Extract GC category
      if (cleanName.startsWith('GC - ')) { category = 'GC'; cleanName = cleanName.replace('GC - ', '').trim(); }
      else if (cleanName.startsWith('GC-')) { category = 'GC'; cleanName = cleanName.replace('GC-', '').trim(); }
      else if (cleanName.startsWith('GC _ ')) { category = 'GC'; cleanName = cleanName.replace('GC _ ', '').trim(); }

      // Rule: Process programs (Deduplication & version review)
      const subPath = `users/${userId}/clients/${original.id}/programs`;
      const progsSnap = await getDocs(collection(db, subPath));
      const rawProgs = progsSnap.docs.map(d => ({ ...d.data(), _docId: d.id }));

      const seen = new Map(); // key -> { mergedData }
      const toDelete = [];

      rawProgs.forEach(p => {
        const key = `${p.programName}_${p.platform}_${String(p.version || '').trim().toUpperCase()}`;
        if (seen.has(key)) {
          const existing = seen.get(key);
          existing.installationsCount += (Number(p.installationsCount) || 1);
          toDelete.push(p._docId);
        } else {
          const { _docId, firestoreId, ...cleanProgFields } = p;
          const processed = { ...cleanProgFields, _docId };
          if ((processed.programName || '').toLowerCase().includes('logiciel commercial')) {
            processed.version = '';
            processed.type = '';
          }
          seen.set(key, processed);
        }
      });

      const uniqueProgsWithDocId = Array.from(seen.values());
      const sanitizedUniqueProgs = uniqueProgsWithDocId.map(({ _docId, ...rest }) => validateProgram(rest));
      const totalInstalls = sanitizedUniqueProgs.reduce((sum, p) => sum + (Number(p.installationsCount) || 0), 0);

      const clientRef = doc(db, `users/${userId}/clients/${original.id}`);
      const nextClientDoc = validateClient({
        ...original,
        fullName: cleanName || original.fullName,
        category,
        installationsCount: totalInstalls,
        programsCount: sanitizedUniqueProgs.length,
        programNames: sanitizedUniqueProgs.map(p => p.programName),
        programs: sanitizedUniqueProgs,
        updatedAt: new Date().toISOString()
      });

      ops.push({ type: 'set', ref: clientRef, data: nextClientDoc });

      // Update Programs subcollection (without leaking _docId or firestoreId)
      uniqueProgsWithDocId.forEach((p, idx) => {
        const { _docId } = p;
        const pRef = doc(db, `${subPath}/${_docId || sanitizedUniqueProgs[idx].id}`);
        ops.push({ type: 'set', ref: pRef, data: sanitizedUniqueProgs[idx], options: { merge: true } });
      });

      // Delete duplicates
      toDelete.forEach(fid => {
        const dRef = doc(db, `${subPath}/${fid}`);
        ops.push({ type: 'delete', ref: dRef });
      });

      // Update local memory copy immutably
      cleanedClients[clientIdx] = {
        ...original,
        ...nextClientDoc,
        programs: sanitizedUniqueProgs
      };
    }

    if (ops.length > 0) {
      await commitChunkedOperations(ops);
      console.log(`[Cleaning] Production cleaning committed successfully (${ops.length} operations).`);
    }

    setClients(cleanedClients);

    showToast('✅ تم تنظيف وتوحيد البيانات بنجاح في قاعدة البيانات أونلاين.', 'success');
    return { success: true, count: clientsToClean.length };

  } catch (err) {
    console.error(`[Cleaning] Fatal error during production cleanup:`, err);
    showToast('❌ فشل تنظيف البيانات أونلاين: ' + err.message, 'error');
    throw err;
  }
}
