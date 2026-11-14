import { S, staffUsers, currentStaffUser, setStaffUsers, setCurrentStaffUser, isGerant, getActiveTenantId, currentUser } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { R } from '../../presentation/render-core.js';
import { t } from '../../utils/i18n.js';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, buildDeptPermissions } from '../../constants/index.js';
import { saveEmployeeForTenant, deleteEmployeeForTenant } from '../../firebase/service.js';
import { hashPassword, verifyPassword } from '../../utils/crypto.js';
import { deleteEmployeeWithPassword, verifyAdminPassword, getEmployeeById } from '../employeeService.js';
import { logActivity, ActivityType } from '../timelineService.js';

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
  if (found.passwordHash && found.passwordSalt) {
    isValid = verifyPassword(cleanPass, found.passwordHash, found.passwordSalt);
    // Backward compatibility: If Gérant has default salt/hash and enters 'admin'
    if (!isValid && found.role === 'GERANT' && cleanPass === 'admin') {
      isValid = true;
      const { hash, salt } = hashPassword('admin');
      found.passwordHash = hash;
      found.passwordSalt = salt;
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
      setStaffUsers(staffList, getActiveTenantId());
    }
  } else if (found.role === 'GERANT') {
    // For Gérant account owner without a password yet, set this entered password as their secure password
    isValid = true;
    const { hash, salt } = hashPassword(cleanPass);
    found.passwordHash = hash;
    found.passwordSalt = salt;
    setStaffUsers(staffList, getActiveTenantId());
  }

  if (!isValid) {
    showToast(t("كلمة المرور غير صحيحة. يرجى إدخال كلمة المرور الصحيحة."), "error");
    return;
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
  const tenantId = getActiveTenantId();
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
    id,
    tenantId: tenantId || 'default',
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

  if (existingIndex >= 0) {
    staffList[existingIndex] = { ...staffList[existingIndex], ...staffObj };
  } else {
    staffList.push(staffObj);
  }

  setStaffUsers(staffList, tenantId);

  // Sync to Firestore under tenant isolation
  if (tenantId) {
    try {
      await saveEmployeeForTenant(tenantId, staffObj);
    } catch (e) {
      console.warn("Failed saving employee to Firestore:", e);
    }
  }

  // Log audit activity
  const isEdit = existingIndex >= 0;
  logActivity(
    null,
    isEdit ? ActivityType.STAFF_EDITED : ActivityType.STAFF_ADDED,
    isEdit ? "تعديل بيانات وصلاحيات موظف" : "إضافة موظف جديد",
    `تم ${isEdit ? 'تعديل بيانات وصلاحيات' : 'تسجيل حساب'} الموظف "${staffObj.name}" (${staffObj.department || staffObj.position}).`
  ).catch(console.warn);

  showToast(t("تم حفظ بيانات الموظف بنجاح في قاعدة البيانات!"), "success");
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

  // If admin password was already supplied, perform verification and delete
  if (adminPassword) {
    const res = deleteEmployeeWithPassword(id, adminPassword);
    if (!res.success) {
      showToast(t(res.message), "error");
      return;
    }
    logActivity(null, ActivityType.STAFF_DELETED, "حذف حساب موظف", `تم حذف حساب الموظف (${id}) بواسطة كلمة مرور المسؤول العام.`).catch(console.warn);
    showToast(t(res.message), "success");
    if (S.modal === 'adminPasswordConfirm') S.modal = null;
    R();
    return;
  }

  // Otherwise, open the Admin Password Verification Modal
  window.__deleteTargetEmpId = id;
  S.modal = 'adminPasswordConfirm';
  R();
};

window.confirmDeleteEmployeeWithAdminPassword = async function(id, adminPassword) {
  const targetId = id || window.__deleteTargetEmpId;
  const res = deleteEmployeeWithPassword(targetId, adminPassword);
  if (!res.success) {
    showToast(t(res.message), "error");
    return false;
  }
  logActivity(null, ActivityType.STAFF_DELETED, "حذف حساب موظف", `تم حذف حساب الموظف بواسطة كلمة مرور المسؤول العام.`).catch(console.warn);
  showToast(t(res.message), "success");
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
  const tenantId = getActiveTenantId();
  const staffList = [...(S.staffUsers || [])];
  const idx = staffList.findIndex(s => s.id === staffId);
  if (idx < 0) return;
  
  const perms = { ...(staffList[idx].permissions || {}) };
  perms[permKey] = !perms[permKey];
  staffList[idx] = { ...staffList[idx], permissions: perms, updatedAt: new Date().toISOString() };

  setStaffUsers(staffList, tenantId);
  if (S.currentStaffUser && S.currentStaffUser.id === staffId) {
    setCurrentStaffUser(staffList[idx], tenantId);
  }

  if (tenantId) {
    try {
      await saveEmployeeForTenant(tenantId, staffList[idx]);
    } catch (e) {
      console.warn('Failed saving employee permission to Firestore:', e);
    }
  }

  logActivity(null, ActivityType.STAFF_EDITED, "تعديل صلاحية مستخدم", `تم تعديل الصلاحية (${permKey}) للموظف "${staffList[idx].name}".`).catch(console.warn);
  showToast(t("تم تحديث الصلاحية بنجاح"), "success");
  R();
};

window.grantAllStaffPermissions = async function(staffId, grant) {
  if (!isGerant()) {
    showToast(t("عذراً، فقط المسؤول العام (GERANT) يمكنه تعديل الصلاحيات."), "error");
    return;
  }
  const tenantId = getActiveTenantId();
  const staffList = [...(S.staffUsers || [])];
  const idx = staffList.findIndex(s => s.id === staffId);
  if (idx < 0) return;
  
  const perms = { ...(staffList[idx].permissions || {}) };
  ALL_PERMISSIONS.forEach(p => {
    perms[p] = !!grant;
  });
  staffList[idx] = { ...staffList[idx], permissions: perms, updatedAt: new Date().toISOString() };
  setStaffUsers(staffList, tenantId);
  if (S.currentStaffUser && S.currentStaffUser.id === staffId) {
    setCurrentStaffUser(staffList[idx], tenantId);
  }

  if (tenantId) {
    try {
      await saveEmployeeForTenant(tenantId, staffList[idx]);
    } catch (e) {
      console.warn('Failed saving employee permissions to Firestore:', e);
    }
  }

  logActivity(
    null,
    ActivityType.STAFF_EDITED,
    "تعديل جميع صلاحيات موظف",
    `تم ${grant ? 'منح' : 'إلغاء'} جميع الصلاحيات للموظف "${staffList[idx].name}".`
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

  const tenantId = getActiveTenantId();
  const staffList = [...(S.staffUsers || [])];
  const idx = staffList.findIndex(s => s.id === staffId);
  if (idx < 0) return;

  const perms = { ...(staffList[idx].permissions || {}) };
  group.permissions.forEach(p => {
    perms[p.key] = !!grant;
  });

  staffList[idx] = { ...staffList[idx], permissions: perms, updatedAt: new Date().toISOString() };
  setStaffUsers(staffList, tenantId);

  if (S.currentStaffUser && S.currentStaffUser.id === staffId) {
    setCurrentStaffUser(staffList[idx], tenantId);
  }

  if (tenantId) {
    try {
      await saveEmployeeForTenant(tenantId, staffList[idx]);
    } catch (e) {
      console.warn('Failed saving employee group permissions to Firestore:', e);
    }
  }

  logActivity(
    null,
    ActivityType.STAFF_EDITED,
    "تعديل صلاحيات مجموعة موظف",
    `تم ${grant ? 'منح' : 'إلغاء'} صلاحيات مجموعة "${group.name || group.id}" للموظف "${staffList[idx].name}".`
  ).catch(console.warn);
  showToast(grant ? t("تم منح صلاحيات المجموعة بنجاح") : t("تم إلغاء صلاحيات المجموعة"), "success");
  if (typeof R === 'function') R();
};
