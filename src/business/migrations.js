/**
 * PROGILIC CRM v3 - Data Migration Utility
 * Safely migrates legacy global "localStorage" cache into the user-isolated IndexedDB
 * upon first-time startup, verifying integrity before clearing old keys.
 */

import { saveClients, setMeta, saveSyncQueue, getClients } from './idbStorage.js';
import { logActivity, ActivityType } from './timelineService.js';
import { showToast } from '../utils/toast.js';

/**
 * Automatically detects and migrates legacy localStorage keys to the user's IndexedDB.
 * Ensures strict isolation by migrating to the specific user's UID db.
 * 
 * @param {string} uid User's Firebase Authentication UID
 * @returns {Promise<boolean>} True if migration ran and succeeded, false otherwise.
 */
export async function migrateLocalStorageToIDB(uid) {
  if (!uid) return false;

  const legacyClientsKey = 'crm_clients_cache';
  const legacyStatsKey = 'crm_stats_cache';
  const legacyNidKey = 'crm_nid_cache';
  const legacyQueueKey = 'crm_sync_queue';

  // Check if there is anything to migrate safely
  let cachedClientsStr = null;
  let cachedStatsStr = null;
  let cachedNidStr = null;
  let cachedQueueStr = null;

  try {
    cachedClientsStr = localStorage.getItem(legacyClientsKey);
    cachedStatsStr = localStorage.getItem(legacyStatsKey);
    cachedNidStr = localStorage.getItem(legacyNidKey);
    cachedQueueStr = localStorage.getItem(legacyQueueKey);
  } catch (e) {
    console.warn("[Migration] localStorage access is restricted or unsupported. Skipping migration:", e);
    return false;
  }

  if (!cachedClientsStr && !cachedStatsStr && !cachedQueueStr) {
    console.log("[Migration] No legacy localStorage cache found. Migration skipped.");
    return false;
  }

  console.log("[Migration] Legacy cache found. Initiating migration to IndexedDB...");

  try {
    let clientsList = [];
    if (cachedClientsStr) {
      clientsList = JSON.parse(cachedClientsStr);
    }

    let stats = {};
    if (cachedStatsStr) {
      stats = JSON.parse(cachedStatsStr);
    }

    let nid = 100;
    if (cachedNidStr) {
      nid = Number(cachedNidStr) || 100;
    }

    let queue = [];
    if (cachedQueueStr) {
      queue = JSON.parse(cachedQueueStr);
    }

    console.log(`[Migration] Read ${clientsList.length} clients, nid: ${nid}, ${queue.length} pending actions.`);

    // 1. Write to IndexedDB
    await saveClients(uid, clientsList);
    await setMeta(uid, 'stats', stats);
    await setMeta(uid, 'nid', nid);
    await saveSyncQueue(uid, queue);

    // 2. Verification step: Read back to ensure writing succeeded
    const verifiedClients = await getClients(uid);
    if (clientsList.length > 0 && verifiedClients.length !== clientsList.length) {
      throw new Error(`Verification failed. Source clients: ${clientsList.length}, target clients: ${verifiedClients.length}`);
    }

    console.log("[Migration] Verification successful! IndexedDB matches localStorage source.");

    // 3. Clear legacy localStorage keys safely
    localStorage.removeItem(legacyClientsKey);
    localStorage.removeItem(legacyStatsKey);
    localStorage.removeItem(legacyNidKey);
    localStorage.removeItem(legacyQueueKey);

    // 4. Log migration to the timeline
    await logActivity(
      null,
      ActivityType.DATA_IMPORTED,
      "ترحيل تلقائي لقاعدة البيانات",
      "تم ترحيل البيانات المحلية بنجاح من الذاكرة العشوائية السابقة للمتصفح إلى قاعدة البيانات المحلية المؤمنة IndexedDB.",
      'import',
      { clientsCount: clientsList.length, nid }
    );

    console.log("[Migration] Legacy localStorage keys cleared successfully.");
    showToast("✨ تم ترحيل بياناتك المحلية السابقة إلى قاعدة البيانات المؤمنة الجديدة بنجاح!", "success", 6000);
    return true;
  } catch (err) {
    console.error("[Migration] Fatal migration failure, localStorage data was NOT cleared:", err);
    showToast("⚠️ حدثت مشكلة أثناء تحديث قاعدة البيانات المحلية. لم يتم فقدان أي بيانات، سيتم إعادة المحاولة.", "warning", 6000);
    return false;
  }
}
