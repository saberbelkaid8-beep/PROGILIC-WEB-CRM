import {
  S,
  clients,
  staffUsers,
  updateState,
  currentUser,
  currentStaffUser,
  hasPermission,
  getActiveTenantId
} from '../../state/store.js';
import { auth } from '../../firebase/config.js';
import { saveTaskForTenant, deleteTaskForTenant } from '../../firebase/service.js';
import { logActivity, ActivityType } from '../timelineService.js';
import { R } from '../../presentation/render-core.js';
import { gv, td } from '../../utils/index.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm, showPrompt } from '../../utils/confirm.js';
import { t } from '../../utils/i18n.js';
import { closeModal, openModal } from './uiActions.js';

function resolveTenantUid() {
  return (auth && auth.currentUser && auth.currentUser.uid)
    || (currentUser && currentUser.tenantId)
    || getActiveTenantId()
    || currentUser?.uid
    || null;
}

function ensureOnlineForTaskMutation() {
  const browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!S.isOnline || !browserOnline) {
    showToast(t('الاتصال بالإنترنت مقطوع. لا يمكن حفظ المهام بدون تأكيد السحابة.'), 'error');
    return false;
  }
  if (S.quotaExceeded || (typeof globalThis !== 'undefined' && globalThis.__progilicFirestoreQuotaExceeded)) {
    showToast(t('تم تجاوز الحصة اليومية لـ Firestore. التعديلات موقوفة مؤقتاً.'), 'error');
    return false;
  }
  return true;
}

function lookupStaff(staffId) {
  if (!staffId) return null;
  return (staffUsers || []).find(s => String(s?.id) === String(staffId)) || null;
}

function lookupClient(clientId) {
  if (!clientId && clientId !== 0) return null;
  return (clients || []).find(c => String(c?.id) === String(clientId)) || null;
}

export function openAddTaskModal(prefill = {}) {
  if (!hasPermission('tasks.create')) {
    showToast(t('⚠️ لا تملك صلاحية إنشاء مهام أو متابعات جديدة.'), 'error');
    return;
  }
  openModal('addTask', { prefill });
}

export function editTask(taskId) {
  if (!hasPermission('tasks.edit')) {
    showToast(t('⚠️ لا تملك صلاحية تعديل المهام والمتابعات.'), 'error');
    return;
  }
  openModal('editTask', { eid: String(taskId) });
}

export function setTaskFilter(key, val) {
  if (!['taskFilter', 'taskStaffFilter', 'taskDeptFilter', 'taskSearch'].includes(key)) return;
  updateState({ [key]: val });
  R();
}

export async function saveTask(editId = null) {
  const eid = editId && editId !== 'null' ? String(editId) : null;
  if (eid === null && !hasPermission('tasks.create')) {
    showToast(t('⚠️ لا تملك صلاحية إنشاء مهام جديدة.'), 'error');
    return;
  }
  if (eid !== null && !hasPermission('tasks.edit')) {
    showToast(t('⚠️ لا تملك صلاحية تعديل المهام.'), 'error');
    return;
  }
  if (!ensureOnlineForTaskMutation()) return;

  const title = (gv('ft_t') || '').trim();
  if (!title) {
    showToast(t('الرجاء إدخال عنوان المهمة *'), 'error');
    return;
  }

  const uid = resolveTenantUid();
  if (!uid) {
    showToast(t('يرجى تسجيل الدخول بحساب سحابي صالح أولاً.'), 'error');
    return;
  }

  const existing = eid ? (S.tasks || []).find(x => String(x.id) === eid) : null;
  const staffId = (gv('ft_staff') || '').trim();
  const staffObj = lookupStaff(staffId);
  const staffName = staffObj ? (staffObj.fullName || staffObj.name) : (existing?.assignedStaffName || '');

  const rawClientId = (gv('ft_client') || '').trim();
  const clientObj = lookupClient(rawClientId);
  const clientId = clientObj ? Number(clientObj.id) : (existing?.clientId ?? null);
  const clientName = clientObj ? (clientObj.fullName || '') : (existing?.clientName || '');

  const department = (gv('ft_dept') || staffObj?.department || existing?.department || 'suivi').trim();
  const status = (gv('ft_st') || existing?.status || 'مفتوحة').trim();
  const priority = (gv('ft_prio') || existing?.priority || 'متوسطة').trim();
  const dueDate = (gv('ft_due') || td()).trim();
  const description = (gv('ft_desc') || '').trim();
  const resultNote = (gv('ft_res') || existing?.resultNote || '').trim();
  const nowIso = new Date().toISOString();

  const payload = {
    id: eid || `task_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`,
    uid,
    title,
    description,
    clientId,
    clientName,
    contactId: existing?.contactId ?? S.form?.prefill?.contactId ?? null,
    assignedStaffId: staffId,
    assignedStaffName: staffName,
    department,
    dueDate,
    priority,
    status,
    resultNote,
    completedAt: status === 'مكتملة' ? (existing?.completedAt || td()) : '',
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso
  };

  try {
    const saved = await saveTaskForTenant(uid, payload);
    const nextList = eid
      ? (S.tasks || []).map(x => String(x.id) === eid ? saved : x)
      : [saved, ...(S.tasks || [])];
    updateState({ tasks: nextList });

    logActivity(
      saved.clientId || null,
      status === 'مكتملة' ? ActivityType.TASK_COMPLETED : (eid ? ActivityType.TASK_UPDATED : ActivityType.TASK_ADDED),
      eid ? `تحديث مهمة: ${saved.title}` : `إنشاء مهمة متابعة: ${saved.title}`,
      `المكلف: ${saved.assignedStaffName || 'غير محدد'} | القسم: ${saved.department} | الموعد: ${saved.dueDate || 'غير محدد'} | الحالة: ${saved.status}${saved.resultNote ? ` | النتيجة: ${saved.resultNote}` : ''}`,
      'online-crm',
      { clientName: saved.clientName || 'عام', taskId: saved.id, department: saved.department }
    ).catch(console.warn);

    showToast(t('تم حفظ المهمة وتأكيدها في السحابة.'), 'success');
    closeModal();
  } catch (err) {
    showToast(t('فشل حفظ المهمة في السحابة: ') + (err?.message || ''), 'error');
  }
}

export async function updateTaskStatus(taskId, nextStatus) {
  if (!hasPermission('tasks.edit')) {
    showToast(t('⚠️ لا تملك صلاحية تحديث حالة المهام.'), 'error');
    return;
  }
  if (!ensureOnlineForTaskMutation()) return;

  const task = (S.tasks || []).find(x => String(x.id) === String(taskId));
  if (!task) return;

  let resultNote = task.resultNote || '';
  if (nextStatus === 'مكتملة') {
    const entered = await showPrompt(
      'أدخل ملخص النتيجة أو الإجراء المُنجز لإغلاق المهمة:',
      'إنجاز المهمة',
      resultNote,
      'مثال: تم إرسال العرض التجاري وتأكيد موعد التنصيب'
    );
    if (entered === null) return;
    resultNote = entered.trim();
  }

  const uid = resolveTenantUid();
  if (!uid) return;

  const updated = {
    ...task,
    status: nextStatus,
    resultNote,
    completedAt: nextStatus === 'مكتملة' ? td() : '',
    updatedAt: new Date().toISOString()
  };

  try {
    const saved = await saveTaskForTenant(uid, updated);
    updateState({
      tasks: (S.tasks || []).map(x => String(x.id) === String(taskId) ? saved : x)
    });

    logActivity(
      saved.clientId || null,
      nextStatus === 'مكتملة' ? ActivityType.TASK_COMPLETED : ActivityType.TASK_UPDATED,
      nextStatus === 'مكتملة' ? `إنجاز مهمة: ${saved.title}` : `تغيير حالة مهمة إلى (${nextStatus})`,
      `${saved.resultNote ? `النتيجة: ${saved.resultNote} — ` : ''}المكلف: ${saved.assignedStaffName || currentStaffUser?.fullName || ''}`,
      'online-crm',
      { clientName: saved.clientName || 'عام', taskId: saved.id, department: saved.department }
    ).catch(console.warn);

    showToast(nextStatus === 'مكتملة' ? t('تم إنجاز المهمة بنجاح ✓') : t('تم تحديث حالة المهمة.'), 'success');
    R();
  } catch (err) {
    showToast(t('فشل تحديث المهمة في السحابة: ') + (err?.message || ''), 'error');
  }
}

export async function delTask(taskId) {
  if (!hasPermission('tasks.delete')) {
    showToast(t('⚠️ لا تملك صلاحية حذف المهام.'), 'error');
    return;
  }
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذه المهمة نهائياً؟', t('تأكيد الحذف'));
  if (!confirmed) return;
  if (!ensureOnlineForTaskMutation()) return;

  const uid = resolveTenantUid();
  if (!uid) return;

  try {
    await deleteTaskForTenant(uid, String(taskId));
    updateState({
      tasks: (S.tasks || []).filter(x => String(x.id) !== String(taskId))
    });
    showToast(t('تم حذف المهمة من السحابة.'), 'success');
    R();
  } catch (err) {
    showToast(t('فشل حذف المهمة من السحابة: ') + (err?.message || ''), 'error');
  }
}
