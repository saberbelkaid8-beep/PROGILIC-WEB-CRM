import { S, staffUsers, currentStaffUser, setStaffUsers, setCurrentStaffUser, isGerant, getActiveTenantId, currentUser } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { R } from '../../presentation/render-core.js';
import { t } from '../../utils/i18n.js';
import { ALL_PERMISSIONS } from '../../constants/index.js';
import { saveEmployeeForTenant, deleteEmployeeForTenant } from '../../firebase/service.js';
import { hashPassword, verifyPassword } from '../../utils/crypto.js';

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
    // For Gérant account owner without a separate staff password, verify or set on first entry
    if (currentUser && !currentUser.isEmployee) {
      isValid = true;
      const { hash, salt } = hashPassword(cleanPass);
      found.passwordHash = hash;
      found.passwordSalt = salt;
      delete found.password;
      delete found.pwd;
      setStaffUsers(staffList, getActiveTenantId());
    }
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
  
  const staffObj = {
    id,
    tenantId: tenantId || 'default',
    adminEmail: currentUser?.email || '',
    name: form.name || form.fullName || 'موظف جديد',
    fullName: form.fullName || form.name || 'موظف جديد',
    username: form.username || form.name || 'user',
    position: form.position || 'موظف',
    department: form.department || 'القسم التقني',
    supervisor: form.supervisor || 'المدير العام',
    tasks: form.tasks || '',
    passwordHash,
    passwordSalt,
    status: form.status || existing?.status || 'نشط',
    role: form.role || 'employee',
    permissions: existing ? existing.permissions : {},
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

  showToast(t("تم حفظ بيانات الموظف بنجاح في قاعدة البيانات!"), "success");
  S.modal = null;
  R();
};

window.deleteStaffMember = async function(id) {
  if (!isGerant()) {
    showToast(t("عذراً، فقط المسؤول العام (GERANT) يمكنه حذف الموظفين."), "error");
    return;
  }
  if (id === 'gerant' || id === 'gerant-1') {
    showToast(t("لا يمكن حذف حساب المسؤول العام (Gérant)."), "error");
    return;
  }
  const tenantId = getActiveTenantId();
  const staffList = (S.staffUsers || []).filter(s => s.id !== id);
  setStaffUsers(staffList, tenantId);

  // Delete from Firestore
  if (tenantId) {
    try {
      await deleteEmployeeForTenant(tenantId, id);
    } catch (e) {
      console.warn("Failed deleting employee from Firestore:", e);
    }
  }

  showToast(t("تم حذف الموظف بنجاح."), "success");
  R();
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
    } catch (e) {}
  }

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
  
  const perms = {};
  if (grant) {
    ALL_PERMISSIONS.forEach(p => { perms[p] = true; });
  }
  staffList[idx] = { ...staffList[idx], permissions: perms, updatedAt: new Date().toISOString() };
  setStaffUsers(staffList, tenantId);
  if (S.currentStaffUser && S.currentStaffUser.id === staffId) {
    setCurrentStaffUser(staffList[idx], tenantId);
  }

  if (tenantId) {
    try {
      await saveEmployeeForTenant(tenantId, staffList[idx]);
    } catch (e) {}
  }

  showToast(grant ? t("تم منح جميع الصلاحيات بنجاح") : t("تم إلغاء جميع الصلاحيات"), "success");
  R();
};
