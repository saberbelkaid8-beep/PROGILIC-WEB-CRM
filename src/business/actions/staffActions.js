import { S, staffUsers, currentStaffUser, setStaffUsers, setCurrentStaffUser, isGerant, getActiveTenantId, currentUser, updateState } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { R } from '../../presentation/render-core.js';
import { t } from '../../utils/i18n.js';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, buildDeptPermissions } from '../../constants/index.js';
import { saveEmployeeForTenant, deleteEmployeeForTenant, classifyFirestoreError } from '../../firebase/service.js';
import { handleFirestoreQuotaExceeded } from '../storage.js';
import { hashPassword, verifyPassword } from '../../utils/crypto.js';
import { verifyAdminPassword } from '../employeeService.js';
import { logActivity, ActivityType } from '../timelineService.js';

function ensureOnlineForMutation() {
  const isBrowserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!S.isOnline || !isBrowserOnline) {
    showToast(t('الاتصال بالإنترنت مقطوع. لا يمكن حفظ أي تعديل بدون تأكيد السحابة.'), 'error');
    return false;
  }
  if (S.quotaExceeded || (typeof globalThis !== 'undefined' && globalThis.__progilicFirestoreQuotaExceeded)) {
    showToast(t('تم تجاوز الحصة اليومية لـ Firestore. التعديلات موقوفة مؤقتاً لحماية قاعدة البيانات.'), 'error');
    return false;
  }
  return true;
}

window.loginStaff = function(staffId, password) {
  const cleanPass = (password || '').trim();
  if (!cleanPass) {
    showToast(t("يرجى إدخال كلمة المرور للمتابعة."), "error");
    return;
  }

  const staffList = S.staffUsers || [];
  const found = staffList.find(s => s.id === staffId || s.username === staffId);
  if (!found) {
    showToast(t("الموظف غير موجود في هذا الحساب."), "error");
    return;
  }

  let isValid = false;
  let needsCredentialPersist = false;
  if (found.passwordHash && found.passwordSalt) {
    isValid = verifyPassword(cleanPass, found.passwordHash, found.passwordSalt);
    // Backward compatibility: If Gérant has default salt/hash and enters 'admin'
    if (!isValid && found.role === 'GERANT' && cleanPass === 'admin') {
      isValid = true;
      const { hash, salt } = hashPassword('admin');
      found.passwordHash = hash;
      found.passwordSalt = salt;
      needsCredentialPersist = true;
      setStaffUsers(staffList, getActiveTenantId());
    }
  } else if (found.password) {
    // Migration helper for legacy accounts: verify and auto-upgrade to salted hash
    if (found.password === cleanPass) {
      isValid = true;
      const { hash, salt } = hashPassword(cleanPass);
      found.passwordHash = hash;
      found.passwordSalt = salt;
      delete found.password;
      delete found.pwd;
      needsCredentialPersist = true;
      setStaffUsers(staffList, getActiveTenantId());
    }
  } else if (found.role === 'GERANT') {
    // For Gérant account owner without a password yet, set this entered password as their secure password
    isValid = true;
    const { hash, salt } = hashPassword(cleanPass);
    found.passwordHash = hash;
    found.passwordSalt = salt;
    needsCredentialPersist = true;
    setStaffUsers(staffList, getActiveTenantId());
  }

  if (!isValid) {
    showToast(t("كلمة المرور غير صحيحة. يرجى إدخال كلمة المرور الصحيحة."), "error");
    return;
  }

  const tenantId = getActiveTenantId();
  if (
    needsCredentialPersist &&
    tenantId &&
    S.isOnline &&
    (typeof navigator === 'undefined' || navigator.onLine !== false) &&
    !S.quotaExceeded &&
    !(typeof globalThis !== 'undefined' && globalThis.__progilicFirestoreQuotaExceeded)
  ) {
    saveEmployeeForTenant(tenantId, found).catch(err => {
      if (classifyFirestoreError(err) === 'quota-exceeded') {
        handleFirestoreQuotaExceeded('loginStaff', err);
      } else {
        console.warn("Failed persisting upgraded staff credentials:", err);
      }
    });
  }

  setCurrentStaffUser(found);
  S.showStaffPortal = false;
  showToast(t("مرحباً بك، ") + (found.name || found.fullName) + ` (${found.position || 'موظف'})`, "success");
  R();
};

window.switchStaffDirectly = function(staffId) {
  const staffList = S.staffUsers || [];
  const found = staffList.find(s => s.id === staffId);
  if (!found) return;
  setCurrentStaffUser({ ...found });
  S.showStaffPortal = false;
  S.showStaffManager = false;
  showToast(t("تم التبديل وتجربة حساب: ") + (found.name || found.fullName), "info");
  R();
};

window.logoutStaff = function() {
  setCurrentStaffUser(null);
  S.showStaffPortal = true;
  showToast(t("تم تسجيل خروج الموظف وفتح بوابة تبديل المستخدمين."), "info");
  R();
};

window.toggleStaffManagerModal = function(show) {
  if (!isGerant()) {
    showToast(t("عذراً، فقط المسؤول العام (GERANT) يمكنه الوصول إلى لوحة إدارة الصلاحيات والبيانات."), "error");
    return;
  }
  S.showStaffManager = show !== undefined ? show : !S.showStaffManager;
  R();
};

window.saveStaffMember = async function(form) {
  if (!isGerant()) {
    showToast(t("عذراً، فقط المسؤول العام (GERANT) يمكنه تعديل أو إضافة بيانات الموظفين والأقسام."), "error");
    return;
  }
  if (!ensureOnlineForMutation()) return;
  const tenantId = getActiveTenantId();
  if (!tenantId) {
    showToast(t("تعذر تحديد الحساب السحابي النشط لحفظ بيانات الموظف."), "error");
    return;
  }

  const staffList = [...(S.staffUsers || [])];
  const id = form.id || 'staff-' + Date.now();
  const existingIndex = staffList.findIndex(s => s.id === id);
  const existing = existingIndex >= 0 ? staffList[existingIndex] : null;

  let passwordHash = existing?.passwordHash || null;
  let passwordSalt = existing?.passwordSalt || null;

  if (form.password && form.password.trim()) {
    const res = hashPassword(form.password.trim());
    passwordHash = res.hash;
    passwordSalt = res.salt;
  }
  
  const dept = form.department || 'القسم التقني';
  const initialPerms = existing && existing.permissions && Object.keys(existing.permissions).length > 0
    ? existing.permissions
    : buildDeptPermissions(dept);

  const staffObj = {
    ...(existing || {}),
    id,
    tenantId,
    adminEmail: currentUser?.email || '',
    name: form.name || form.fullName || 'موظف جديد',
    fullName: form.fullName || form.name || 'موظف جديد',
    username: form.username || form.name || 'user',
    position: form.position || 'موظف',
    department: dept,
    supervisor: form.supervisor || 'المدير العام',
    tasks: form.tasks || '',
    passwordHash,
    passwordSalt,
    status: form.status || existing?.status || 'نشط',
    role: form.role || (id === 'gerant' ? 'GERANT' : 'employee'),
    permissions: initialPerms,
    createdAt: existing?.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString()
  };

  updateState({ isMutating: true });
  try {
    await saveEmployeeForTenant(tenantId, staffObj);
  } catch (e) {
    updateState({ isMutating: false });
    if (classifyFirestoreError(e) === 'quota-exceeded') {
      handleFirestoreQuotaExceeded('saveStaffMember', e);
    } else {
      showToast(t("فشل حفظ بيانات الموظف في السحابة: ") + (e.message || ''), "error");
    }
    return;
  }
  updateState({ isMutating: false });

  if (existingIndex >= 0) {
    staffList[existingIndex] = staffObj;
  } else {
    staffList.push(staffObj);
  }

  setStaffUsers(staffList, tenantId);
  if (S.currentStaffUser && S.currentStaffUser.id === id) {
    setCurrentStaffUser(staffObj, tenantId);
  }

  // Log audit activity after server ack
  const isEdit = existingIndex >= 0;
  logActivity(
    null,
    isEdit ? ActivityType.STAFF_EDITED : ActivityType.STAFF_ADDED,
    isEdit ? "تعديل بيانات وصلاحيات موظف" : "إضافة موظف جديد",
    `تم ${isEdit ? 'تعديل بيانات وصلاحيات' : 'تسجيل حساب'} الموظف "${staffObj.name}" (${staffObj.department || staffObj.position}).`
  ).catch(console.warn);

  showToast(t("تم حفظ بيانات الموظف بنجاح في السحابة!"), "success");
  S.modal = null;
  R();
};

window.deleteStaffMember = async function(id, adminPassword = null) {
  if (!isGerant()) {
    showToast(t("عذراً، فقط المسؤول العام (GERANT) يمكنه حذف الموظفين."), "error");
    return;
  }
  if (id === 'gerant' || id === 'gerant-1') {
    showToast(t("لا يمكن حذف حساب المسؤول العام (Gérant)."), "error");
    return;
  }

  // If admin password was already supplied, perform verification, cloud deletion, and update
  if (adminPassword) {
    return await window.confirmDeleteEmployeeWithAdminPassword(id, adminPassword);
  }

  // Otherwise, open the Admin Password Verification Modal
  window.__deleteTargetEmpId = id;
  S.modal = 'adminPasswordConfirm';
  R();
};

window.confirmDeleteEmployeeWithAdminPassword = async function(id, adminPassword) {
  const targetId = id || window.__deleteTargetEmpId;
  if (!targetId) {
    showToast(t("معرف المستخدم غير محدد."), "error");
    return false;
  }
  if (targetId === 'gerant' || targetId === 'gerant-1') {
    showToast(t("لا يمكن حذف حساب المسؤول العام الرئيسي (Gérant)."), "error");
    return false;
  }

  const ver = verifyAdminPassword(adminPassword);
  if (!ver.success) {
    showToast(t(ver.message), "error");
    return false;
  }

  if (!ensureOnlineForMutation()) return false;
  const tenantId = getActiveTenantId();
  if (!tenantId) {
    showToast(t("تعذر تحديد الحساب السحابي النشط لحذف الموظف."), "error");
    return false;
  }

  updateState({ isMutating: true });
  try {
    await deleteEmployeeForTenant(tenantId, targetId);
  } catch (e) {
    updateState({ isMutating: false });
    if (classifyFirestoreError(e) === 'quota-exceeded') {
      handleFirestoreQuotaExceeded('deleteEmployee', e);
    } else {
      showToast(t("فشل حذف حساب الموظف من السحابة: ") + (e.message || ''), "error");
    }
    return false;
  }
  updateState({ isMutating: false });

  const remaining = (S.staffUsers || []).filter(e => e.id !== targetId);
  setStaffUsers(remaining, tenantId);
  logActivity(null, ActivityType.STAFF_DELETED, "حذف حساب موظف", `تم حذف حساب الموظف (${targetId}) بواسطة كلمة مرور المسؤول العام.`).catch(console.warn);
  showToast(t("تم التحقق من كلمة مرور المسؤول وحذف حساب المستخدم من السحابة بنجاح."), "success");
  window.__deleteTargetEmpId = null;
  S.modal = null;
  R();
  return true;
};

window.toggleStaffPermission = async function(staffId, permKey) {
  if (!isGerant()) {
    showToast(t("عذراً، فقط المسؤول العام (GERANT) يمكنه تعديل الصلاحيات."), "error");
    return;
  }
  if (!ensureOnlineForMutation()) return;
  const tenantId = getActiveTenantId();
  if (!tenantId) {
    showToast(t("تعذر تحديد الحساب السحابي النشط لتحديث الصلاحيات."), "error");
    return;
  }

  const staffList = [...(S.staffUsers || [])];
  const idx = staffList.findIndex(s => s.id === staffId);
  if (idx < 0) return;
  
  const perms = { ...(staffList[idx].permissions || {}) };
  perms[permKey] = !perms[permKey];
  const updatedStaff = { ...staffList[idx], permissions: perms, updatedAt: new Date().toISOString() };

  updateState({ isMutating: true });
  try {
    await saveEmployeeForTenant(tenantId, updatedStaff);
  } catch (e) {
    updateState({ isMutating: false });
    if (classifyFirestoreError(e) === 'quota-exceeded') {
      handleFirestoreQuotaExceeded('toggleStaffPermission', e);
    } else {
      showToast(t("فشل حفظ الصلاحية في السحابة: ") + (e.message || ''), "error");
    }
    return;
  }
  updateState({ isMutating: false });

  staffList[idx] = updatedStaff;
  setStaffUsers(staffList, tenantId);
  if (S.currentStaffUser && S.currentStaffUser.id === staffId) {
    setCurrentStaffUser(updatedStaff, tenantId);
  }

  logActivity(null, ActivityType.STAFF_EDITED, "تعديل صلاحية مستخدم", `تم تعديل الصلاحية (${permKey}) للموظف "${updatedStaff.name}".`).catch(console.warn);
  showToast(t("تم تحديث الصلاحية وحفظها في السحابة"), "success");
  R();
};

window.grantAllStaffPermissions = async function(staffId, grant) {
  if (!isGerant()) {
    showToast(t("عذراً، فقط المسؤول العام (GERANT) يمكنه تعديل الصلاحيات."), "error");
    return;
  }
  if (!ensureOnlineForMutation()) return;
  const tenantId = getActiveTenantId();
  if (!tenantId) {
    showToast(t("تعذر تحديد الحساب السحابي النشط لتحديث الصلاحيات."), "error");
    return;
  }

  const staffList = [...(S.staffUsers || [])];
  const idx = staffList.findIndex(s => s.id === staffId);
  if (idx < 0) return;
  
  const perms = { ...(staffList[idx].permissions || {}) };
  ALL_PERMISSIONS.forEach(p => {
    perms[p] = !!grant;
  });
  const updatedStaff = { ...staffList[idx], permissions: perms, updatedAt: new Date().toISOString() };

  updateState({ isMutating: true });
  try {
    await saveEmployeeForTenant(tenantId, updatedStaff);
  } catch (e) {
    updateState({ isMutating: false });
    if (classifyFirestoreError(e) === 'quota-exceeded') {
      handleFirestoreQuotaExceeded('grantAllStaffPermissions', e);
    } else {
      showToast(t("فشل تحديث الصلاحيات في السحابة: ") + (e.message || ''), "error");
    }
    return;
  }
  updateState({ isMutating: false });

  staffList[idx] = updatedStaff;
  setStaffUsers(staffList, tenantId);
  if (S.currentStaffUser && S.currentStaffUser.id === staffId) {
    setCurrentStaffUser(updatedStaff, tenantId);
  }

  logActivity(
    null,
    ActivityType.STAFF_EDITED,
    "تعديل جميع صلاحيات موظف",
    `تم ${grant ? 'منح' : 'إلغاء'} جميع الصلاحيات للموظف "${updatedStaff.name}".`
  ).catch(console.warn);
  showToast(grant ? t("تم منح جميع الصلاحيات بنجاح") : t("تم إلغاء جميع الصلاحيات"), "success");
  R();
};

window.grantStaffGroupPermissions = async function(staffId, groupId, grant) {
  if (!isGerant()) {
    showToast(t("عذراً، فقط المسؤول العام (GERANT) يمكنه تعديل الصلاحيات."), "error");
    return;
  }
  const group = PERMISSION_GROUPS.find(g => g.id === groupId);
  if (!group) return;
  if (!ensureOnlineForMutation()) return;
  const tenantId = getActiveTenantId();
  if (!tenantId) {
    showToast(t("تعذر تحديد الحساب السحابي النشط لتحديث الصلاحيات."), "error");
    return;
  }

  const staffList = [...(S.staffUsers || [])];
  const idx = staffList.findIndex(s => s.id === staffId);
  if (idx < 0) return;

  const perms = { ...(staffList[idx].permissions || {}) };
  group.permissions.forEach(p => {
    perms[p.key] = !!grant;
  });

  const updatedStaff = { ...staffList[idx], permissions: perms, updatedAt: new Date().toISOString() };

  updateState({ isMutating: true });
  try {
    await saveEmployeeForTenant(tenantId, updatedStaff);
  } catch (e) {
    updateState({ isMutating: false });
    if (classifyFirestoreError(e) === 'quota-exceeded') {
      handleFirestoreQuotaExceeded('grantStaffGroupPermissions', e);
    } else {
      showToast(t("فشل تحديث صلاحيات المجموعة في السحابة: ") + (e.message || ''), "error");
    }
    return;
  }
  updateState({ isMutating: false });

  staffList[idx] = updatedStaff;
  setStaffUsers(staffList, tenantId);

  if (S.currentStaffUser && S.currentStaffUser.id === staffId) {
    setCurrentStaffUser(updatedStaff, tenantId);
  }

  logActivity(
    null,
    ActivityType.STAFF_EDITED,
    "تعديل صلاحيات مجموعة موظف",
    `تم ${grant ? 'منح' : 'إلغاء'} صلاحيات مجموعة "${group.name || group.id}" للموظف "${updatedStaff.name}".`
  ).catch(console.warn);
  showToast(grant ? t("تم منح صلاحيات المجموعة بنجاح") : t("تم إلغاء صلاحيات المجموعة"), "success");
  if (typeof R === 'function') R();
};
