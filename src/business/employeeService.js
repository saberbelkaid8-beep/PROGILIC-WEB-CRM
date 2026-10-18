// Employee & Department Management Service for PROGILIC CRM
// Implements the 4 Official PROGILIC Departments and Role-Based Access Control (RBAC)
// Managed strictly by the Gérant (General Manager)

import { S, currentUser, setCurrentUser, currentStaffUser, setCurrentStaffUser, hasPermission as storeHasPermission, isGerant as storeIsGerant } from '../state/store.js';
import { showToast } from '../utils/toast.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';

/**
 * The 4 Official PROGILIC Departments from organizational specifications:
 * 1. قسم ما قبل البيع — Service Pré-vente
 * 2. القسم التجاري — Service Commercial
 * 3. قسم المتابعة — Service Suivi
 * 4. القسم التقني — Service Technique
 */
export const DEPARTMENTS = [
  {
    id: 'pre_vente',
    num: 1,
    titleAr: 'قسم ما قبل البيع',
    titleFr: 'Service Pré-vente',
    badgeClass: 'badge-pre-vente',
    color: '#0284c7', // Sky Blue
    bgSoft: 'rgba(2, 132, 199, 0.1)',
    borderSoft: 'rgba(2, 132, 199, 0.3)',
    icon: '📞',
    descriptionAr: 'التواصل الأولي مع العملاء، التعريف ببرنامج PROGILIC، فهم احتياجاتهم، تقديم الشروحات والعروض، ومتابعة العملاء المحتملين.',
    responsibilities: [
      'التواصل الأولي والترحيب بالعملاء الجدد والمحتملين',
      'التعريف ببرنامج PROGILIC بمختلف نسخه وحلوله',
      'فهم وتحليل احتياجات نشاط العميل وتحديد البرنامج الأنسب',
      'تقديم الشروحات التفصيلية والعروض التجريبية (Démos)',
      'متابعة العملاء المحتملين والإجابة على استفساراتهم وتأهيلهم'
    ],
    defaultPosition: 'مسؤول ما قبل البيع وعلاقات العملاء',
    defaultSupervisor: 'المدير العام (Gérant)',
    defaultPermissions: {
      canViewClients: true,
      canAddClients: true,
      canEditClients: true,
      canDeleteClients: false,
      canManagePrograms: false,
      canManageIssues: false,
      canManageRequirements: true,
      canManageContacts: true,
      canViewDashboard: true,
      canExportData: false,
      canManageEmployees: false,
      canAccessAi: true
    }
  },
  {
    id: 'commercial',
    num: 2,
    titleAr: 'القسم التجاري',
    titleFr: 'Service Commercial',
    badgeClass: 'badge-commercial',
    color: '#10b981', // Emerald Green
    bgSoft: 'rgba(16, 185, 129, 0.1)',
    borderSoft: 'rgba(16, 185, 129, 0.3)',
    icon: '💼',
    descriptionAr: 'تسيير الجانب التجاري، متابعة الصفقات والبيع، العروض التجارية، والتنسيق مع العملاء بخصوص شراء الحلول والبرامج.',
    responsibilities: [
      'تسيير وإدارة الجانب التجاري والصفقات اليومية',
      'متابعة عمليات البيع، الفواتير، وتجديد العقود والاشتراكات',
      'إعداد وتقديم العروض التجارية والتفاوض مع الزبائن',
      'التنسيق مع العملاء بخصوص شراء الحلول والبرامج، تراخيص POS، وتوسيع الشبكة'
    ],
    defaultPosition: 'مسؤول المبيعات والعقود التجارية',
    defaultSupervisor: 'المدير العام (Gérant)',
    defaultPermissions: {
      canViewClients: true,
      canAddClients: true,
      canEditClients: true,
      canDeleteClients: false,
      canManagePrograms: true,
      canManageIssues: false,
      canManageRequirements: false,
      canManageContacts: true,
      canViewDashboard: true,
      canExportData: true,
      canManageEmployees: false,
      canAccessAi: true
    }
  },
  {
    id: 'suivi',
    num: 3,
    titleAr: 'قسم المتابعة',
    titleFr: 'Service Suivi',
    badgeClass: 'badge-suivi',
    color: '#8b5cf6', // Violet
    bgSoft: 'rgba(139, 92, 246, 0.1)',
    borderSoft: 'rgba(139, 92, 246, 0.3)',
    icon: '📈',
    descriptionAr: 'متابعة العملاء ومراقبة سير العمل بين الأقسام، خصوصاً قسم ما قبل البيع والقسم التقني، مع متابعة المهام والمشكلات والتأكد من تقدمها.',
    responsibilities: [
      'متابعة دورية للعملاء وقياس مدى رضاهم واستقرار البرنامج لديهم',
      'مراقبة سير العمل والتنسيق المشترك بين الأقسام',
      'الربط المباشر والفعال بين قسم ما قبل البيع والقسم التقني',
      'متابعة المهام والمشكلات والتذاكر المفتوحة والتأكد من تقدمها وإغلاقها بنجاح'
    ],
    defaultPosition: 'منسق جودة المتابعة وسير العمل',
    defaultSupervisor: 'المدير العام (Gérant)',
    defaultPermissions: {
      canViewClients: true,
      canAddClients: true,
      canEditClients: true,
      canDeleteClients: false,
      canManagePrograms: false,
      canManageIssues: true,
      canManageRequirements: true,
      canManageContacts: true,
      canViewDashboard: true,
      canExportData: false,
      canManageEmployees: false,
      canAccessAi: true
    }
  },
  {
    id: 'technique',
    num: 4,
    titleAr: 'القسم التقني',
    titleFr: 'Service Technique',
    badgeClass: 'badge-technique',
    color: '#f59e0b', // Amber / Tech
    bgSoft: 'rgba(245, 158, 11, 0.1)',
    borderSoft: 'rgba(245, 158, 11, 0.3)',
    icon: '💻',
    descriptionAr: 'الجانب التقني المرتبط بالمطوّر، معالجة المشكلات البرمجية، تطوير البرنامج، إصلاح الأخطاء، وتنفيذ التعديلات التقنية.',
    responsibilities: [
      'التكفل بالجانب التقني المباشر المرتبط بالمطوّر والأنظمة البرمجية',
      'معالجة المشكلات البرمجية، الأخطاء والـ Bugs بدقة وسرعة',
      'تطوير ميزات البرنامج، تحديث إصدارات PROGILIC (v21, v23, v25)',
      'إصلاح الأخطاء وتنفيذ التعديلات التقنية الخاصة بطلبات الزبائن'
    ],
    defaultPosition: 'مهندس برمجيات ودعم تقني',
    defaultSupervisor: 'المدير العام (Gérant)',
    defaultPermissions: {
      canViewClients: true,
      canAddClients: false,
      canEditClients: true,
      canDeleteClients: false,
      canManagePrograms: true,
      canManageIssues: true,
      canManageRequirements: true,
      canManageContacts: false,
      canViewDashboard: true,
      canExportData: false,
      canManageEmployees: false,
      canAccessAi: true
    }
  }
];

export const PERMISSION_DEFINITIONS = [
  { key: 'canViewClients', label: 'عرض دليل العملاء', group: 'العملاء', desc: 'الاطلاع على قائمة العملاء والبحث فيها' },
  { key: 'canAddClients', label: 'إضافة عملاء جدد', group: 'العملاء', desc: 'تسجيل عملاء جدد في قاعدة البيانات' },
  { key: 'canEditClients', label: 'تعديل بيانات العملاء', group: 'العملاء', desc: 'تحديث بيانات التواصل، الحالة والعنوان' },
  { key: 'canDeleteClients', label: 'حذف العملاء (حساسة)', group: 'العملاء', desc: 'إمكانية مسح سجلات العملاء نهائياً' },
  { key: 'canManagePrograms', label: 'إدارة البرامج والتراخيص', group: 'البرامج والمبيعات', desc: 'إضافة البرامج والأجهزة ورخص POS' },
  { key: 'canManageContacts', label: 'تسجيل الاتصالات والزيارات', group: 'البرامج والمبيعات', desc: 'إضافة وتعديل سجل التواصل مع العملاء' },
  { key: 'canManageIssues', label: 'إدارة المشكلات التقنية والبلاغات', group: 'الدعم التقني', desc: 'تسجيل المشاكل، تحديد الأولويات والحلول' },
  { key: 'canManageRequirements', label: 'إدارة طلبات الميزات والمتطلبات', group: 'الدعم التقني', desc: 'تسجيل وتتبع اقتراحات تطوير البرنامج' },
  { key: 'canViewDashboard', label: 'عرض لوحة القيادة والمؤشرات', group: 'التقارير والإدارة', desc: 'الاطلاع على الرسوم البيانية وإحصائيات الولايات' },
  { key: 'canExportData', label: 'تصدير البيانات (JSON/CSV)', group: 'التقارير والإدارة', desc: 'تحميل نسخ من بيانات النظام' },
  { key: 'canManageEmployees', label: 'إدارة الموظفين وتعديل الصلاحيات', group: 'التقارير والإدارة', desc: 'مقتصرة على المسؤول العام (Gérant)' },
  { key: 'canAccessAi', label: 'المساعد الذكي (AI Copilot)', group: 'التقارير والإدارة', desc: 'استخدام المساعد الذكي الصوتي والكتابي' }
];

export const INITIAL_EMPLOYEES = [];

function getCurrentUserUid() {
  try {
    if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.uid) {
      return auth.currentUser.uid;
    }
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) {
      return currentUser.uid;
    }
  } catch (e) {}
  return null;
}

/**
 * Returns all registered employees for the current user/company account
 */
export function getEmployees() {
  if (S && Array.isArray(S.staffUsers) && S.staffUsers.length > 0) {
    return S.staffUsers;
  }
  try {
    const uid = getCurrentUserUid() || 'default';
    const key = `crm_staff_users_${uid}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return S && Array.isArray(S.staffUsers) ? S.staffUsers : [];
}

/**
 * Saves the full list of employees for the current user/company account
 */
export function saveEmployees(employeesList) {
  try {
    const uid = getCurrentUserUid() || 'default';
    const safeList = Array.isArray(employeesList) ? employeesList : [];
    if (typeof window !== 'undefined' && window.setStaffUsers) {
      window.setStaffUsers(safeList, uid);
    }
    localStorage.setItem(`crm_staff_users_${uid}`, JSON.stringify(safeList));
  } catch (e) {
    console.error("Failed saving employees:", e);
  }
}

/**
 * Gets a department by its ID
 */
export function getDepartment(deptId) {
  if (!deptId) return DEPARTMENTS[0];
  const found = DEPARTMENTS.find(d => 
    d.id === deptId || 
    d.titleAr === deptId || 
    d.titleFr === deptId || 
    (typeof d.name === 'string' && d.name === deptId)
  );
  if (found) return found;

  if (deptId === 'الإدارة العليا' || deptId === 'gerant') {
    return {
      id: 'gerant',
      num: 0,
      titleAr: 'الإدارة العليا',
      titleFr: 'Direction Générale',
      badgeClass: 'badge-gerant',
      color: '#38bdf8',
      bgSoft: 'rgba(56, 189, 248, 0.12)',
      borderSoft: 'rgba(56, 189, 248, 0.35)',
      icon: '👑',
      descriptionAr: 'الإشراف العام وتحديد الصلاحيات وإدارة فريق العمل',
      responsibilities: [
        'الإشراف العام على سير عمل المؤسسة وكافة الأقسام',
        'تحديد الصلاحيات الممنوحة لكل موظف وتعديلها',
        'إدارة قواعد البيانات والنسخ الاحتياطي وحماية السجلات',
        'متابعة مؤشرات الأداء والتقارير الإجمالية'
      ],
      defaultPosition: 'المدير العام (Gérant)',
      defaultSupervisor: '-',
      defaultPermissions: {}
    };
  }
  return DEPARTMENTS[0];
}

/**
 * Gets an employee by ID
 */
export function getEmployeeById(id) {
  const list = getEmployees();
  return list.find(e => e.id === id) || null;
}

/**
 * Creates or updates an employee
 */
export function upsertEmployee(employeeData) {
  const list = getEmployees();
  const index = list.findIndex(e => e.id === employeeData.id);
  
  // Hash password if supplied and remove any plaintext password
  let passwordHash = undefined;
  let passwordSalt = undefined;
  if (employeeData.password && typeof employeeData.password === 'string' && employeeData.password.trim()) {
    const res = hashPassword(employeeData.password.trim());
    passwordHash = res.hash;
    passwordSalt = res.salt;
  }

  const sanitizedData = { ...employeeData };
  delete sanitizedData.password;
  delete sanitizedData.pwd;

  if (passwordHash) {
    sanitizedData.passwordHash = passwordHash;
    sanitizedData.passwordSalt = passwordSalt;
  }

  if (index >= 0) {
    list[index] = {
      ...list[index],
      ...sanitizedData,
      updatedAt: new Date().toISOString()
    };
    // Ensure any legacy plaintext password is scrubbed
    delete list[index].password;
    delete list[index].pwd;
  } else {
    const newId = employeeData.id || `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newEmp = {
      id: newId,
      fullName: employeeData.fullName || 'موظف جديد',
      username: (employeeData.username || `emp_${Date.now()}`).trim().toLowerCase(),
      passwordHash: passwordHash || null,
      passwordSalt: passwordSalt || null,
      department: employeeData.department || 'pre_vente',
      position: employeeData.position || getDepartment(employeeData.department).defaultPosition,
      supervisor: employeeData.supervisor || 'المدير العام (Gérant)',
      phone: employeeData.phone || '',
      email: employeeData.email || '',
      tasks: employeeData.tasks || getDepartment(employeeData.department).descriptionAr,
      status: employeeData.status || 'نشط',
      createdAt: employeeData.createdAt || new Date().toISOString().split('T')[0],
      lastLogin: null,
      permissions: employeeData.permissions || { ...getDepartment(employeeData.department).defaultPermissions }
    };
    list.push(newEmp);
  }

  saveEmployees(list);
  return list;
}

/**
 * Deletes an employee by ID
 */
export function deleteEmployee(id) {
  const list = getEmployees().filter(e => e.id !== id);
  saveEmployees(list);
  return list;
}

/**
 * Updates permissions for an employee (strictly Gérant action)
 */
export function updateEmployeePermissions(id, permissions) {
  const list = getEmployees();
  const emp = list.find(e => e.id === id);
  if (!emp) return false;
  emp.permissions = { ...permissions };
  saveEmployees(list);
  return true;
}

/**
 * Updates an employee's password securely using salted cryptographic hashing (strictly Gérant action)
 */
export function updateEmployeePassword(id, newPassword) {
  const list = getEmployees();
  const emp = list.find(e => e.id === id);
  if (!emp) return false;
  const cleanPass = (newPassword || '').trim();
  if (!cleanPass) return false;
  
  const { hash, salt } = hashPassword(cleanPass);
  emp.passwordHash = hash;
  emp.passwordSalt = salt;
  // Remove any legacy plaintext password
  delete emp.password;
  delete emp.pwd;

  saveEmployees(list);
  return true;
}

/**
 * Authenticates an employee by username/email and password using salted hash verification
 */
export function authenticateEmployee(loginInput, password) {
  const cleanLogin = (loginInput || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanLogin || !cleanPass) {
    throw new Error('يرجى إدخال اسم المستخدم وكلمة المرور.');
  }

  const list = getEmployees();
  const emp = list.find(e => 
    (e.username.toLowerCase() === cleanLogin || (e.email && e.email.toLowerCase() === cleanLogin))
  );

  if (!emp) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  let isValid = false;
  if (emp.passwordHash && emp.passwordSalt) {
    isValid = verifyPassword(cleanPass, emp.passwordHash, emp.passwordSalt);
  } else if (emp.password) {
    // Migration helper for legacy accounts: verify and auto-upgrade to salted hash
    if (emp.password === cleanPass) {
      isValid = true;
      const { hash, salt } = hashPassword(cleanPass);
      emp.passwordHash = hash;
      emp.passwordSalt = salt;
      delete emp.password;
      delete emp.pwd;
      saveEmployees(list);
    }
  }

  if (!isValid) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  if (emp.status === 'معطل') {
    throw new Error('هذا الحساب معطل حالياً من طرف المسؤول العام (Gérant).');
  }

  // Update last login
  emp.lastLogin = new Date().toLocaleString('ar-DZ');
  saveEmployees(list);

  return emp;
}

/**
 * Helper to determine if a user has Gérant (General Manager) authority.
 * Any account owner/admin across all accounts (not restricted to an employee session) has full Gérant authority.
 */
export function isUserGerant(user = currentUser) {
  if (currentStaffUser) {
    return currentStaffUser.role === 'GERANT';
  }
  return storeIsGerant();
}

/**
 * Helper to verify if the currently active user has a given permission.
 * Delegates to canonical store.js implementation which checks currentStaffUser.
 */
export function hasPermission(permissionKey) {
  return storeHasPermission(permissionKey);
}

/**
 * Logs in as an employee
 */
export function loginAsEmployeeSession(emp) {
  const userObj = {
    uid: emp.id,
    email: emp.email || `${emp.username}@progilic.dz`,
    displayName: emp.fullName,
    username: emp.username,
    isEmployee: true,
    role: 'employee',
    employeeId: emp.id,
    department: emp.department,
    position: emp.position,
    supervisor: emp.supervisor,
    tasks: emp.tasks,
    permissions: emp.permissions || {},
    emailVerified: true
  };

  try {
    localStorage.setItem(ACTIVE_EMPLOYEE_KEY, JSON.stringify(userObj));
    localStorage.removeItem('crm_logged_out');
  } catch (e) {}

  setCurrentStaffUser(emp);
  setCurrentUser(userObj);
  return userObj;
}

/**
 * Checks for stored active employee session on application start
 */
export function getStoredEmployeeSession() {
  try {
    const raw = localStorage.getItem(ACTIVE_EMPLOYEE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

/**
 * Clears employee session and returns to Gérant mode
 */
export function exitEmployeeSession() {
  try {
    localStorage.removeItem(ACTIVE_EMPLOYEE_KEY);
  } catch (e) {}
}
