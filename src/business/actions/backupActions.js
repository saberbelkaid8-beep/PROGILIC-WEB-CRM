import { S, clients, setClients, updateState, currentUser, setCurrentUser, hasPermission, isGerant } from '../../state/store.js';
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
import { closeModal } from './uiActions.js';
import { t } from '../../utils/i18n.js';
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
  if (!hasPermission('backup.create')) {
    showToast(t('⚠️ لا تملك صلاحية إنشاء نسخ احتياطية.'), 'error');
    return;
  }
  const promptMsg = S.lang === 'fr'
    ? 'Entrez une description pour cette sauvegarde (optionnel) :'
    : (S.lang === 'en'
      ? 'Enter a description for this backup (optional):'
      : 'أدخل وصفاً أو ملاحظة لهذه النسخة الاحتياطية (اختياري):');
  const defaultReason = S.lang === 'fr' ? 'Sauvegarde manuelle' : (S.lang === 'en' ? 'Manual backup' : 'نسخة احتياطية يدوية');
  const placeholderText = S.lang === 'fr' ? 'Ex: Avant mise à jour majeure' : (S.lang === 'en' ? 'E.g.: Before major update' : 'مثال: قبل تحديث بيانات العملاء الكبرى');
  
  let reason = await showPrompt(promptMsg, t('إنشاء نسخة احتياطية'), "", placeholderText);
  if (reason === null) return; // user cancelled
  reason = reason.trim() || defaultReason;
  try {
    const backup = await createSnapshotBackup(currentUser.uid, reason, clients, S.stats, S.nid);
    if (backup) {
      logActivity(null, ActivityType.BACKUP_CREATED, "إنشاء نسخة احتياطية", `تم إنشاء نسخة احتياطية يدوية للنظام: "${reason}".`).catch(console.warn);
      showToast(t("تم إنشاء النسخة الاحتياطية بنجاح!"), "success");
      await loadBackupsList();
    }
  } catch (err) {
    console.error("Failed to trigger manual backup:", err);
    showToast(t("فشل إنشاء النسخة الاحتياطية."), "error");
  }
}

export async function triggerRestore(backupId) {
  if (!currentUser) return;
  if (!hasPermission('backup.restore')) {
    showToast(t('⚠️ لا تملك صلاحية استرجاع واستيراد البيانات.'), 'error');
    return;
  }
  const confirmMsg = S.lang === 'fr'
    ? 'Êtes-vous sûr de vouloir restaurer cette sauvegarde ? Les données actuelles seront remplacées (une sauvegarde automatique sera prise avant de commencer).'
    : (S.lang === 'en'
      ? 'Are you sure you want to restore this backup? Current data will be replaced (an automatic safety snapshot will be taken first).'
      : 'هل أنت متأكد من استرجاع هذه النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية (وسيتم أخذ نسخة وقائية تلقائية للحالة الحالية قبل البدء).');
  const confirmed = await showConfirm(confirmMsg, t('تأكيد الاسترجاع'));
  if (!confirmed) return;
  try {
    const ok = await restoreFromBackup(currentUser.uid, backupId);
    if (ok) {
      logActivity(null, ActivityType.BACKUP_RESTORED, "استرجاع نسخة احتياطية", `تم استرجاع النظام بنجاح من النسخة الاحتياطية (${backupId}).`).catch(console.warn);
      closeModal();
      R();
    }
  } catch (err) {
    console.error("Failed to restore backup:", err);
  }
}

export async function downloadBackup(backupId, format = 'json') {
  if (!S.backups) return;
  if (!hasPermission('backup.download')) {
    showToast(t('⚠️ لا تملك صلاحية تحميل ملفات النسخ الاحتياطي.'), 'error');
    return;
  }
  const backup = S.backups.find(b => b.id === backupId);
  if (backup) {
    downloadBackupJSON(backup, format);
    logActivity(null, ActivityType.DATA_EXPORTED, "تحميل نسخة احتياطية", `تم تحميل النسخة الاحتياطية (${backupId}) بصيغة ${format}.`).catch(console.warn);
  }
}

export async function triggerDeleteBackup(backupId) {
  if (!currentUser) return;
  if (!hasPermission('backup.delete')) {
    showToast(t('⚠️ لا تملك صلاحية حذف النسخ الاحتياطية.'), 'error');
    return;
  }
  const confirmMsg = S.lang === 'fr'
    ? 'Êtes-vous sûr de vouloir supprimer définitivement cette sauvegarde du navigateur ?'
    : (S.lang === 'en'
      ? 'Are you sure you want to permanently delete this backup from the browser?'
      : 'هل أنت متأكد من حذف هذه النسخة الاحتياطية نهائياً من المتصفح؟');
  const confirmed = await showConfirm(confirmMsg, t('حذف نسخة احتياطية'));
  if (!confirmed) return;
  try {
    await deleteBackup(currentUser.uid, backupId);
    logActivity(null, ActivityType.BACKUP_DELETED, "حذف نسخة احتياطية", `تم حذف النسخة الاحتياطية (${backupId}).`).catch(console.warn);
    showToast(t("تم حذف النسخة الاحتياطية بنجاح."), "success");
    await loadBackupsList();
  } catch (err) {
    console.error("Failed to delete backup:", err);
  }
}
