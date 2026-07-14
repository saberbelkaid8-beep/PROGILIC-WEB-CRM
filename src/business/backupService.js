/**
 * PROGILIC CRM v3 - Automated Local Backup System
 * Manages client snapshot history, automatic 24-hour schedules,
 * keeping the last 30 snapshots, restore safeguards, and JSON export.
 */

import { saveBackup, getBackups, deleteBackup } from './idbStorage.js';
import { S, clients, setClients, updateState } from '../state/store.js';
import { logActivity, ActivityType } from './timelineService.js';
import { showToast } from '../utils/toast.js';

/**
 * Creates a snapshot backup and handles rolling 30-backup cleanup.
 * 
 * @param {string} uid User UID
 * @param {string} reason Reason/Trigger description in Arabic
 * @param {Array} clientsList Current in-memory clients
 * @param {object} stats Current pre-aggregated statistics
 * @param {number} nid Current ID sequence number
 * @returns {Promise<object>} The created backup object
 */
export async function createSnapshotBackup(uid, reason, clientsList, stats, nid) {
  if (!uid) {
    console.error("[Backup] Cannot create backup without active user UID");
    return null;
  }

  // Deep clone to isolate snapshot data from future state mutations
  const clientsCopy = JSON.parse(JSON.stringify(clientsList || []));
  const statsCopy = JSON.parse(JSON.stringify(stats || {}));

  const backup = {
    id: `bak_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    reason,
    clients: clientsCopy,
    stats: statsCopy,
    nid: nid || 100,
    version: 3
  };

  try {
    await saveBackup(uid, backup);
    console.log(`[Backup] Created snapshot "${reason}" with ID: ${backup.id}`);
    
    // Prune backups beyond the rolling limit of 30
    await pruneOldBackups(uid);

    return backup;
  } catch (err) {
    console.error("[Backup] Failed to save snapshot to IndexedDB:", err);
    return null;
  }
}

/**
 * Checks and triggers periodic backup if 24 hours have elapsed since last backup.
 */
export async function checkAndTriggerPeriodicBackup(uid, clientsList, stats, nid) {
  if (!uid) return;
  try {
    const list = await getBackups(uid);
    let shouldBackup = false;
    let reason = "نسخ احتياطي دوري تلقائي";

    if (list.length === 0) {
      shouldBackup = true;
      reason = "نسخ احتياطي تلقائي أولى للبيانات";
    } else {
      const lastBackup = list[0]; // already sorted descending by timestamp
      const elapsedMs = Date.now() - new Date(lastBackup.timestamp).getTime();
      const hoursElapsed = elapsedMs / (1000 * 60 * 60);

      if (hoursElapsed >= 24) {
        shouldBackup = true;
        reason = `نسخ احتياطي دوري تلقائي (${Math.round(hoursElapsed)} ساعة)`;
      }
    }

    if (shouldBackup) {
      await createSnapshotBackup(uid, reason, clientsList, stats, nid);
    }
  } catch (err) {
    console.warn("[Backup] Failed checking periodic backup eligibility:", err);
  }
}

/**
 * Prunes rolling backups for a user, keeping only the 30 newest items.
 */
async function pruneOldBackups(uid) {
  try {
    const list = await getBackups(uid); // Sorted newest first
    if (list.length > 30) {
      const toDelete = list.slice(30);
      console.log(`[Backup Pruning] Deleting ${toDelete.length} old backups...`);
      for (const item of toDelete) {
        await deleteBackup(uid, item.id);
      }
    }
  } catch (err) {
    console.error("[Backup Pruning] Failed during cleanup of old items:", err);
  }
}

/**
 * Restores CRM state from a specific local backup snapshot,
 * with a pre-restore auto-snapshot safety safeguard.
 */
export async function restoreFromBackup(uid, backupId) {
  if (!uid) {
    showToast("لا يوجد مستخدم نشط للقيام بالاسترجاع.", "error");
    return false;
  }

  try {
    const list = await getBackups(uid);
    const targetBackup = list.find(b => b.id === backupId);
    if (!targetBackup) {
      showToast("لم يتم العثور على النسخة الاحتياطية المحددة.", "error");
      return false;
    }

    // Safeguard Snapshot: Back up the current active state first before overwriting!
    await createSnapshotBackup(
      uid, 
      `نسخ احتياطي تلقائي وقائي (قبل استرجاع نسخة ${targetBackup.reason})`, 
      clients, 
      S.stats, 
      S.nid
    );

    // Deep copy data from backup to state
    const restoredClients = JSON.parse(JSON.stringify(targetBackup.clients || []));
    const restoredStats = JSON.parse(JSON.stringify(targetBackup.stats || {}));
    const restoredNid = targetBackup.nid || 100;

    // Apply to UI state
    setClients(restoredClients);
    updateState({
      nid: restoredNid,
      stats: restoredStats
    });

    // Log this restore event into the timeline of all clients, or generally
    await logActivity(
      null, 
      ActivityType.BACKUP_RESTORED, 
      "استرجاع نسخة احتياطية", 
      `تم استرجاع النظام بنجاح إلى النسخة المؤرشفة: ${targetBackup.reason}`,
      'restore',
      { backupId, backupTimestamp: targetBackup.timestamp }
    );

    showToast("تم استرجاع النسخة الاحتياطية والبيانات بنجاح! تم حفظ نسخة من حالتك السابقة تلقائياً.", "success");
    return true;
  } catch (err) {
    console.error("[Backup Restore] Critical failure during restore:", err);
    showToast("فشل استرجاع النسخة الاحتياطية: " + err.message, "error");
    return false;
  }
}

/**
 * Exports a specific backup record as a JSON file download.
 */
export function downloadBackupJSON(backup) {
  try {
    const payload = JSON.stringify(backup, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Clean friendly filename
    const dateStr = new Date(backup.timestamp).toISOString().split('T')[0];
    a.href = url;
    a.download = `progilic-backup-${dateStr}-${backup.id}.json`;
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    showToast("تم تصدير ملف النسخة الاحتياطية بنجاح.");
  } catch (err) {
    showToast("فشل تصدير النسخة الاحتياطية: " + err.message, "error");
  }
}
