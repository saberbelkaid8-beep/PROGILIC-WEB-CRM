import { S, clients, setClients, updateState, currentUser, setCurrentUser } from '../../state/store.js';
import { persist, loadClientSubcollectionsIfNeeded, enqueueSyncAction } from '../storage.js';
import { R } from '../../presentation/render-core.js';
import { logActivity, ActivityType, getTimeline } from '../timelineService.js';
import { getBackups, deleteBackup } from '../idbStorage.js';
import { createSnapshotBackup, restoreFromBackup, downloadBackupJSON } from '../backupService.js';
import { auth, googleProvider, facebookProvider, appleProvider } from '../../firebase/config.js';
import { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'firebase/auth';
import { gv, gc2, gc, gn, td } from '../../utils/index.js';
import { autoDetectFeatureOpp, computeScore } from '../intelligence.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm, showPrompt } from '../../utils/confirm.js';
import { 
  addClientTransaction, 
  updateClientTransaction, 
  deleteClientTransaction, 
  saveClientSubItemTransaction, 
  deleteClientSubItemTransaction 
} from '../../firebase/service.js';



export async function loadBackupsList() {
  if (!currentUser) return;
  try {
    const list = await getBackups(currentUser.uid);
    updateState({ backups: list });
    R();
  } catch (err) {
    console.error("Failed to load backups list:", err);
  }
}

export async function triggerManualBackup() {
  if (!currentUser) return;
  let reason = await showPrompt("أدخل وصفاً أو ملاحظة لهذه النسخة الاحتياطية (اختياري):", "إنشاء نسخة احتياطية يدوية", "", "مثال: قبل تحديث بيانات العملاء الكبرى");
  if (reason === null) return; // user cancelled
  reason = reason.trim() || "نسخة احتياطية يدوية";
  try {
    const backup = await createSnapshotBackup(currentUser.uid, reason, clients, S.stats, S.nid);
    if (backup) {
      showToast("تم إنشاء النسخة الاحتياطية بنجاح!", "success");
      await loadBackupsList();
    }
  } catch (err) {
    console.error("Failed to trigger manual backup:", err);
    showToast("فشل إنشاء النسخة الاحتياطية.", "error");
  }
}

export async function triggerRestore(backupId) {
  if (!currentUser) return;
  const confirmed = await showConfirm(
    "هل أنت متأكد من استرجاع هذه النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية (وسيتم أخذ نسخة وقائية تلقائية للحالة الحالية قبل البدء).", 
    "تأكيد الاسترجاع"
  );
  if (!confirmed) return;
  try {
    const ok = await restoreFromBackup(currentUser.uid, backupId);
    if (ok) {
      closeModal();
      R();
    }
  } catch (err) {
    console.error("Failed to restore backup:", err);
  }
}

export async function downloadBackup(backupId) {
  if (!S.backups) return;
  const backup = S.backups.find(b => b.id === backupId);
  if (backup) {
    downloadBackupJSON(backup);
  }
}

export async function triggerDeleteBackup(backupId) {
  if (!currentUser) return;
  const confirmed = await showConfirm("هل أنت متأكد من حذف هذه النسخة الاحتياطية نهائياً من المتصفح؟", "حذف نسخة احتياطية");
  if (!confirmed) return;
  try {
    await deleteBackup(currentUser.uid, backupId);
    showToast("تم حذف النسخة الاحتياطية بنجاح.", "success");
    await loadBackupsList();
  } catch (err) {
    console.error("Failed to delete backup:", err);
  }
}

