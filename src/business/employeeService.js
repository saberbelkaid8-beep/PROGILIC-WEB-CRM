// Employee & Department Management Service for PROGILIC CRM
// Implements the 4 Official PROGILIC Departments and Role-Based Access Control (RBAC)
// Managed strictly by the Gérant (General Manager)

import { S, currentUser, setCurrentUser, currentStaffUser, setCurrentStaffUser, hasPermission as storeHasPermission, isGerant as storeIsGerant, getActiveTenantId, setStaffUsers } from '../state/store.js';
import { showToast } from '../utils/toast.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { saveEmployeeForTenant, deleteEmployeeForTenant } from '../firebase/service.js';
import { auth } from '../firebase/config.js';
import { buildDeptPermissions, ALL_PERMISSIONS } from '../constants/index.js';

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
    defaultPermissions: buildDeptPermissions('pre_vente')
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
    defaultPermissions: buildDeptPermissions('commercial')
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
    defaultPermissions: buildDeptPermissions('suivi')
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
    defaultPermissions: buildDeptPermissions('technique')
  }
];

export const PERMISSION_DEFINITIONS = [
  // 1. العملاء (Clients Management - 9)
  { key: 'clients.view', label: 'عرض دليل العملاء', group: 'العملاء (Clients)', desc: 'الاطلاع على قائمة العملاء والبحث فيها', legacyKey: 'canViewClients' },
  { key: 'clients.create', label: 'إضافة عملاء جدد', group: 'العملاء (Clients)', desc: 'تسجيل عملاء جدد في قاعدة البيانات', legacyKey: 'canAddClients' },
  { key: 'clients.edit', label: 'تعديل بيانات العملاء', group: 'العملاء (Clients)', desc: 'تحديث بيانات التواصل، الحالة والعنوان', legacyKey: 'canEditClients' },
  { key: 'clients.delete', label: 'حذف سجلات العملاء (حساسة)', group: 'العملاء (Clients)', desc: 'إمكانية مسح سجلات العملاء نهائياً', legacyKey: 'canDeleteClients' },
  { key: 'clients.export', label: 'تصدير بيانات العملاء (CSV/JSON)', group: 'العملاء (Clients)', desc: 'تحميل وتصدير نسخ من بيانات العملاء', legacyKey: 'canExportData' },
  { key: 'clients.view_sensitive', label: 'عرض البيانات الحساسة وأرقام الهاتف', group: 'العملاء (Clients)', desc: 'الاطلاع على تفاصيل الاتصال الحساسة للعملاء' },
  { key: 'clients.manage_status', label: 'إدارة وتغيير حالة العميل', group: 'العملاء (Clients)', desc: 'تغيير حالة العميل بين نشط، محتمل، ومتوقف' },
  { key: 'clients.view_timeline', label: 'عرض الخط الزمني للأنشطة', group: 'العملاء (Clients)', desc: 'استعراض تاريخ الأنشطة والتفاعلات اليومية' },
  { key: 'clients.view_contact_history', label: 'عرض سجل التواصل والمكالمات', group: 'العملاء (Clients)', desc: 'الاطلاع على المكالمات والزيارات المسجلة' },

  // Global activity timeline
  { key: 'timeline.view', label: 'عرض المخطط الزمني وتقريره', group: 'المخطط الزمني (Activity Timeline)', desc: 'عرض سجل العمليات وتصفية الأنشطة وإعداد تقرير الإدارة' },

  // 2. البرامج والتراخيص (Programs & Licenses - 7)
  { key: 'programs.view', label: 'عرض البرامج والتراخيص', group: 'البرامج والتراخيص (Programs & Licenses)', desc: 'الاطلاع على البرامج المرخصة والأجهزة', legacyKey: 'canManagePrograms' },
  { key: 'programs.create', label: 'إضافة برامج ورخص جديدة', group: 'البرامج والتراخيص (Programs & Licenses)', desc: 'تسجيل رخص برامج جديدة للعملاء' },
  { key: 'programs.edit', label: 'تعديل بيانات التراخيص', group: 'البرامج والتراخيص (Programs & Licenses)', desc: 'تحديث المنصة، عدد الأجهزة وتواريخ العقد' },
  { key: 'programs.delete', label: 'حذف البرامج والتراخيص', group: 'البرامج والتراخيص (Programs & Licenses)', desc: 'إلغاء وحذف ترخيص البرنامج من حساب العميل' },
  { key: 'programs.view_licenses', label: 'عرض تفاصيل مفاتيح التراخيص', group: 'البرامج والتراخيص (Programs & Licenses)', desc: 'الاطلاع على مفاتيح التفعيل ورخص POS', legacyKey: 'canManageLicenses' },
  { key: 'programs.manage_licenses', label: 'إدارة التراخيص والتجديد', group: 'البرامج والتراخيص (Programs & Licenses)', desc: 'تجديد فترات التراخيص وتعديل صلاحيتها' },
  { key: 'programs.view_installations', label: 'عرض الأجهزة والمحطات المرخصة', group: 'البرامج والتراخيص (Programs & Licenses)', desc: 'متابعة عدد المحطات والأجهزة المنصبة' },

  // 3. الدعم الفني والأعطال (Technical Issues - 11)
  { key: 'issues.view', label: 'عرض البلاغات والمشاكل التقنية', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'الاطلاع على قائمة المشاكل والتذاكر', legacyKey: 'canManageIssues' },
  { key: 'issues.create', label: 'تسجيل بلاغ/مشكلة جديدة', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'إنشاء تذكرة دعم فني أو بلاغ عطل' },
  { key: 'issues.edit', label: 'تعديل بيانات التذكرة', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'تحديث وصف وتفاصيل المشكلة' },
  { key: 'issues.delete', label: 'حذف التذاكر التقنية', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'مسح سجل التذكرة أو البلاغ نهائياً' },
  { key: 'issues.change_status', label: 'تغيير حالة التذكرة', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'تحديث حالة المشكلة (مفتوح، قيد المعالجة، محلول، مغلق)' },
  { key: 'issues.change_priority', label: 'تعديل أولوية المشكلة', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'تحديد درجة الإلحاح (عاجل، عالية، متوسطة، منخفضة)' },
  { key: 'issues.change_type', label: 'تصنيف نوع العطل', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'تحديد نوع المشكلة (تقني، أداء، خطأ مستخدم...)' },
  { key: 'issues.add_notes', label: 'إضافة ملاحظات وحلول تقنية', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'تدوين الحلول التقنية والملاحظات التشخيصية' },
  { key: 'issues.resolve', label: 'حل وإصلاح المشكلة', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'تأكيد إصلاح العطل البرمجي' },
  { key: 'issues.reopen', label: 'إعادة فتح المشكلة', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'إعادة تنشيط تذكرة في حال تكرار العطل' },
  { key: 'issues.close', label: 'الإغلاق النهائي للتذكرة', group: 'الدعم الفني والأعطال (Technical Issues)', desc: 'إغلاق وأرشفة البلاغ بعد التحقق' },

  // 4. الميزات والمتطلبات (Features & Requirements - 6)
  { key: 'features.view', label: 'عرض طلبات الميزات والمتطلبات', group: 'الميزات والمتطلبات (Features & Requirements)', desc: 'استعراض مقترحات تطوير النظام', legacyKey: 'canManageRequirements' },
  { key: 'features.create', label: 'تسجيل ميزة/متطلب جديد', group: 'الميزات والمتطلبات (Features & Requirements)', desc: 'إضافة طلب تطوير ميزة جديدة من العميل' },
  { key: 'features.edit', label: 'تعديل المتطلب والمواصفات', group: 'الميزات والمتطلبات (Features & Requirements)', desc: 'تحديث مواصفات الميزة المطلوبة' },
  { key: 'features.delete', label: 'حذف متطلبات التطوير', group: 'الميزات والمتطلبات (Features & Requirements)', desc: 'إلغاء وحذف طلب الميزة نهائياً' },
  { key: 'features.change_status', label: 'تحديث مسار تنفيذ الميزة', group: 'الميزات والمتطلبات (Features & Requirements)', desc: 'تغيير مسار التنفيذ (مقترح، قيد الدراسة، مخطط، منفذ)' },
  { key: 'features.add_notes', label: 'إضافة ملاحظات تحليلية للميزة', group: 'الميزات والمتطلبات (Features & Requirements)', desc: 'تدوين ملاحظات تحليل الجدوى والتنفيذ' },

  // 5. سجلات التواصل (Contacts - 4)
  { key: 'contacts.view_history', label: 'عرض سجل الاتصالات والمواعيد', group: 'سجلات التواصل (Contacts)', desc: 'مراجعة المواعيد والاتصالات السابقة', legacyKey: 'canManageContacts' },
  { key: 'contacts.create_entry', label: 'تسجيل مكالمة أو زيارة', group: 'سجلات التواصل (Contacts)', desc: 'إضافة مدخل تواصل جديد مع التاريخ' },
  { key: 'contacts.edit_entry', label: 'تعديل مدخل التواصل', group: 'سجلات التواصل (Contacts)', desc: 'تعديل تفاصيل المكالمة أو الملاحظة' },
  { key: 'contacts.delete_entry', label: 'حذف سجل تواصل', group: 'سجلات التواصل (Contacts)', desc: 'مسح سجل مكالمة أو موعد' },

  // 6. لوحة القيادة والتقارير (Dashboard & Reports - 3)
  { key: 'dashboard.view', label: 'عرض لوحة القيادة والمؤشرات', group: 'لوحة القيادة والتقارير (Dashboard & Reports)', desc: 'الاطلاع على الإحصائيات والمؤشرات العامة', legacyKey: 'canViewDashboard' },
  { key: 'reports.view', label: 'استعراض التقارير الإحصائية', group: 'لوحة القيادة والتقارير (Dashboard & Reports)', desc: 'عرض تقارير التوزيع الجغرافي والولايات' },
  { key: 'reports.export', label: 'تصدير التقارير الإحصائية', group: 'لوحة القيادة والتقارير (Dashboard & Reports)', desc: 'تصدير التقارير والرسوم البيانية' },

  // 7. التحليلات والذكاء الاصطناعي (Analytics & AI - 3)
  { key: 'analytics.view', label: 'استعراض التحليلات الذكية', group: 'التحليلات والذكاء الاصطناعي (Analytics & AI)', desc: 'عرض المؤشرات التحليلية المتقدمة', legacyKey: 'canAccessAi' },
  { key: 'analytics.view_risks', label: 'تحليل مخاطر انقطاع العملاء', group: 'التحليلات والذكاء الاصطناعي (Analytics & AI)', desc: 'مراقبة تقييمات الصحة ومخاطر فقدان العملاء' },
  { key: 'analytics.view_insights', label: 'رؤى المساعد الذكي (AI Copilot)', group: 'التحليلات والذكاء الاصطناعي (Analytics & AI)', desc: 'استخدام المساعد الصوتي والتحليلي الذكي' },

  // 8. البحث والفلاتر المتقدمة (Search & Filters - 5)
  { key: 'search.global', label: 'البحث الشامل في النظام', group: 'البحث والفلاتر (Search & Filters)', desc: 'البحث السريع في كافة البيانات' },
  { key: 'search.clients', label: 'البحث في سجلات العملاء', group: 'البحث والفلاتر (Search & Filters)', desc: 'البحث المتخصص حسب النشاط والاسم' },
  { key: 'filters.advanced', label: 'استخدام الفلاتر المتقدمة', group: 'البحث والفلاتر (Search & Filters)', desc: 'تطبيق معايير التصفية المتعددة والمركبة' },
  { key: 'filters.by_wilaya', label: 'التصفية الجغرافية بالولايات', group: 'البحث والفلاتر (Search & Filters)', desc: 'فرز العملاء جغرافياً حسب الولاية والبلدية' },
  { key: 'filters.by_program', label: 'التصفية حسب البرامج', group: 'البحث والفلاتر (Search & Filters)', desc: 'فرز العملاء حسب نوع البرنامج المرخص' },

  // 9. النسخ الاحتياطي والأرشيف (Backups - 5)
  { key: 'backup.view', label: 'عرض النسخ الاحتياطية وسجلات الأمان', group: 'النسخ الاحتياطي والأرشيف (Backups)', desc: 'الاطلاع على قائمة النسخ وسجلات التدقيق', legacyKey: 'canManageBackups' },
  { key: 'backup.create', label: 'إنشاء نسخ احتياطية يدوية', group: 'النسخ الاحتياطي والأرشيف (Backups)', desc: 'أخذ لقطة فورية لقاعدة البيانات' },
  { key: 'backup.download', label: 'تحميل ملفات النسخ الاحتياطي', group: 'النسخ الاحتياطي والأرشيف (Backups)', desc: 'تنزيل ملف .dum أو .json محلياً' },
  { key: 'backup.restore', label: 'استرجاع واستيراد البيانات', group: 'النسخ الاحتياطي والأرشيف (Backups)', desc: 'استعادة بيانات من نسخة سابقة' },
  { key: 'backup.delete', label: 'حذف النسخ الاحتياطية', group: 'النسخ الاحتياطي والأرشيف (Backups)', desc: 'تنظيف ومسح النسخ القديمة' },

  // 10. إدارة المستخدمين والموظفين (Users & Staff - 5)
  { key: 'users.view', label: 'عرض دليل الموظفين والمستخدمين', group: 'المستخدمون والموظفون (Users & Staff)', desc: 'الاطلاع على فريق العمل والمناصب', legacyKey: 'canManageEmployees' },
  { key: 'users.create', label: 'إضافة موظف/مستخدم جديد', group: 'المستخدمون والموظفون (Users & Staff)', desc: 'تسجيل حساب مستخدم جديد' },
  { key: 'users.edit', label: 'تعديل بيانات الموظفين والمناصب', group: 'المستخدمون والموظفون (Users & Staff)', desc: 'تحديث المنصب والمسمى والمسؤول المباشر' },
  { key: 'users.disable', label: 'تعطيل وتنشيط الحسابات', group: 'المستخدمون والموظفون (Users & Staff)', desc: 'إيقاف حساب موظف مؤقتاً أو إعادة تنشيطه' },
  { key: 'users.delete', label: 'حذف حساب مستخدم (يتطلب كلمة سر المسؤول)', group: 'المستخدمون والموظفون (Users & Staff)', desc: 'مسح حساب موظف نهائياً مع التحقق الإلزامي من كلمة مرور المسؤول العام (Gérant)', legacyKey: 'canDeleteEmployees' },

  // 11. الأقسام والهيكلة (Departments - 4)
  { key: 'departments.view', label: 'استعراض هيكل الأقسام الأربعة', group: 'الأقسام والهيكلة (Departments)', desc: 'الاطلاع على اختصاصات ومهام الأقسام' },
  { key: 'departments.create', label: 'إضافة قسم جديد', group: 'الأقسام والهيكلة (Departments)', desc: 'استحداث قسم إداري جديد' },
  { key: 'departments.edit', label: 'تعديل مهام واختصاصات القسم', group: 'الأقسام والهيكلة (Departments)', desc: 'تحديث المسؤوليات وتفاصيل القسم' },
  { key: 'departments.delete', label: 'حذف الأقسام', group: 'الأقسام والهيكلة (Departments)', desc: 'حذف قسم إداري' },

  // 12. الصلاحيات والنظام (Permissions & Settings - 5)
  { key: 'permissions.view', label: 'عرض مصفوفة الصلاحيات (60+)', group: 'الصلاحيات والنظام (Permissions & Settings)', desc: 'الاطلاع على تفاصيل مصفوفة الصلاحيات الممنوحة' },
  { key: 'permissions.assign', label: 'منح الصلاحيات للموظفين', group: 'الصلاحيات والنظام (Permissions & Settings)', desc: 'تفعيل صلاحيات إضافية للموظف' },
  { key: 'permissions.revoke', label: 'سحب الصلاحيات من الموظفين', group: 'الصلاحيات والنظام (Permissions & Settings)', desc: 'تعطيل صلاحيات معينة لموظف' },
  { key: 'settings.view', label: 'عرض إعدادات النظام', group: 'الصلاحيات والنظام (Permissions & Settings)', desc: 'استعراض تفضيلات النظام واللغات' },
  { key: 'settings.edit', label: 'تعديل وضبط النظام', group: 'الصلاحيات والنظام (Permissions & Settings)', desc: 'تعديل الإعدادات العامة للنظام' },

  // 13. الحساب الشخصي والجلسات (Account & Sessions - 3)
  { key: 'account.view', label: 'عرض الملف الشخصي', group: 'الحساب والجلسات (Account & Sessions)', desc: 'الاطلاع على بيانات الجلسة النشطة' },
  { key: 'account.change_password', label: 'تغيير كلمة المرور الشخصية', group: 'الحساب والجلسات (Account & Sessions)', desc: 'تحديث كلمة المرور الشخصية للمستخدم' },
  { key: 'account.manage_sessions', label: 'إدارة الجلسات وتبديل المستخدمين', group: 'الحساب والجلسات (Account & Sessions)', desc: 'التحكم في تسجيلات الدخول وبوابة التبديل' }
];

export const INITIAL_EMPLOYEES = [];

function getCurrentUserUid() {
  try {
    const tid = getActiveTenantId();
    if (tid) return tid;
    if (auth && auth.currentUser && auth.currentUser.uid) {
      return auth.currentUser.uid;
    }
    if (currentUser && currentUser.uid) {
      return currentUser.uid;
    }
  } catch (e) {}
  return null;
}

/**
 * Returns all registered employees for the current user/company account
 */
export function getEmployees() {
  return S && Array.isArray(S.staffUsers) ? S.staffUsers : [];
}

/**
 * Saves the full list of employees for the current user/company account
 */
export function saveEmployees(employeesList) {
  try {
    const uid = getCurrentUserUid() || 'default';
    const safeList = Array.isArray(employeesList) ? employeesList : [];
    
    // Update reactive state store
    setStaffUsers(safeList, uid);
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
      defaultPermissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {})
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
 * Creates or updates an employee and syncs to Firestore
 */
export function upsertEmployee(employeeData) {
  const list = [...getEmployees()];
  const index = list.findIndex(e => e.id === employeeData.id);
  const uid = getCurrentUserUid() || 'default';
  
  // Hash password if supplied and remove any plaintext password
  let passwordHash = employeeData.passwordHash || undefined;
  let passwordSalt = employeeData.passwordSalt || undefined;
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

  let finalEmp = null;

  if (index >= 0) {
    list[index] = {
      ...list[index],
      ...sanitizedData,
      tenantId: list[index].tenantId || uid,
      name: sanitizedData.fullName || sanitizedData.name || list[index].name,
      fullName: sanitizedData.fullName || sanitizedData.name || list[index].fullName,
      status: sanitizedData.status || list[index].status || 'نشط',
      updatedAt: new Date().toISOString()
    };
    // Ensure any legacy plaintext password is scrubbed
    delete list[index].password;
    delete list[index].pwd;
    finalEmp = list[index];
  } else {
    const newId = employeeData.id || `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const fullName = employeeData.fullName || employeeData.name || 'موظف جديد';
    const newEmp = {
      id: newId,
      tenantId: uid,
      name: fullName,
      fullName: fullName,
      username: (employeeData.username || `emp_${Date.now()}`).trim().toLowerCase(),
      passwordHash: passwordHash || employeeData.passwordHash || null,
      passwordSalt: passwordSalt || employeeData.passwordSalt || null,
      department: employeeData.department || 'pre_vente',
      position: employeeData.position || getDepartment(employeeData.department).defaultPosition,
      supervisor: employeeData.supervisor || 'المدير العام (Gérant)',
      phone: employeeData.phone || '',
      email: employeeData.email || '',
      tasks: employeeData.tasks || getDepartment(employeeData.department).descriptionAr,
      status: employeeData.status || 'نشط',
      role: employeeData.role || 'employee',
      createdAt: employeeData.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
      lastLogin: null,
      permissions: employeeData.permissions ? {
        ...buildDeptPermissions(employeeData.department || 'pre_vente'),
        ...employeeData.permissions
      } : buildDeptPermissions(employeeData.department || 'pre_vente')
    };
    list.push(newEmp);
    finalEmp = newEmp;
  }

  saveEmployees(list);

  // Sync to Firestore under tenant isolation
  if (uid && uid !== 'default' && finalEmp) {
    saveEmployeeForTenant(uid, finalEmp).catch(err => {
      console.warn("[EmployeeService] Background Firestore employee save notice:", err);
    });
  }

  return list;
}

/**
 * Retrieves the primary Gérant account object from staff list
 */
export function getGerantAccount() {
  const list = getEmployees();
  return list.find(e => e.role === 'GERANT' || e.id === 'gerant' || e.id === 'gerant-1') || null;
}

/**
 * Verifies the Admin (Gérant) password against salted cryptographic hash or active credentials
 */
export function verifyAdminPassword(password) {
  const cleanPass = (password || '').trim();
  if (!cleanPass) {
    return { success: false, message: 'يرجى إدخال كلمة مرور المسؤول العام (Gérant).' };
  }

  // 1. Verify caller has Gérant authority
  if (!isUserGerant()) {
    return { success: false, message: 'عذراً، فقط المسؤول العام (GERANT) يملك صلاحية التحقق وحذف المستخدمين.' };
  }

  const gerant = getGerantAccount();

  // 2. Check Gérant staff member salted cryptographic hash
  if (gerant && gerant.passwordHash && gerant.passwordSalt) {
    const isValid = verifyPassword(cleanPass, gerant.passwordHash, gerant.passwordSalt);
    if (isValid) {
      return { success: true };
    }
  }

  // 3. Check legacy unhashed password and auto-upgrade
  if (gerant && gerant.password) {
    if (gerant.password === cleanPass) {
      const { hash, salt } = hashPassword(cleanPass);
      gerant.passwordHash = hash;
      gerant.passwordSalt = salt;
      delete gerant.password;
      delete gerant.pwd;
      saveEmployees(getEmployees());
      return { success: true };
    }
  }

  // Strictly Online: No local caching of admin password hash

  // 5. If Gérant has no set password yet (e.g. freshly initialized session or default admin),
  // initialize and securely bind this password as the Gérant master password
  if (gerant && !gerant.passwordHash && !gerant.password) {
    const { hash, salt } = hashPassword(cleanPass);
    gerant.passwordHash = hash;
    gerant.passwordSalt = salt;
    delete gerant.password;
    delete gerant.pwd;
    saveEmployees(getEmployees());
    // Strictly Online: No local password binding
    return { success: true };
  }

  return { success: false, message: 'كلمة المرور غير صحيحة. يرجى إدخال كلمة مرور المسؤول العام الصحيحة للمتابعة.' };
}

/**
 * Securely deletes an employee after verifying the Admin (Gérant) password
 */
export function deleteEmployeeWithPassword(id, adminPassword) {
  if (!id) {
    return { success: false, message: 'معرف المستخدم غير محدد.' };
  }
  if (id === 'gerant' || id === 'gerant-1') {
    return { success: false, message: 'لا يمكن حذف حساب المسؤول العام الرئيسي (Gérant).' };
  }
  if (!isUserGerant() && !hasPermission('users.delete')) {
    return { success: false, message: 'عذراً، فقط المسؤول العام (GERANT) يملك صلاحية حذف المستخدمين.' };
  }

  const ver = verifyAdminPassword(adminPassword);
  if (!ver.success) {
    return ver;
  }

  deleteEmployee(id);
  return { success: true, message: 'تم التحقق من كلمة مرور المسؤول وحذف حساب المستخدم بنجاح.' };
}

/**
 * Deletes an employee by ID and syncs to Firestore
 */
export function deleteEmployee(id) {
  const uid = getCurrentUserUid() || 'default';
  const list = getEmployees().filter(e => e.id !== id);
  saveEmployees(list);

  if (uid && uid !== 'default' && id) {
    deleteEmployeeForTenant(uid, id).catch(err => {
      console.warn("[EmployeeService] Background Firestore employee delete notice:", err);
    });
  }

  return list;
}

/**
 * Updates permissions for an employee (strictly Gérant action) and syncs to Firestore
 */
export function updateEmployeePermissions(id, permissions) {
  const list = getEmployees();
  const emp = list.find(e => e.id === id);
  if (!emp) return false;
  emp.permissions = { ...permissions };
  emp.updatedAt = new Date().toISOString();
  saveEmployees(list);

  if (currentStaffUser && currentStaffUser.id === id) {
    setCurrentStaffUser({ ...emp });
  }

  const uid = getCurrentUserUid() || 'default';
  if (uid && uid !== 'default') {
    saveEmployeeForTenant(uid, emp).catch(err => {
      console.warn("[EmployeeService] Background Firestore permissions save notice:", err);
    });
  }

  return true;
}

/**
 * Updates an employee's password securely using salted cryptographic hashing (strictly Gérant action) and syncs to Firestore
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
  emp.updatedAt = new Date().toISOString();
  // Remove any legacy plaintext password
  delete emp.password;
  delete emp.pwd;

  saveEmployees(list);

  const uid = getCurrentUserUid() || 'default';
  if (uid && uid !== 'default') {
    saveEmployeeForTenant(uid, emp).catch(err => {
      console.warn("[EmployeeService] Background Firestore password save notice:", err);
    });
  }

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
  emp.lastLogin = new Date().toISOString();
  saveEmployees(list);

  return emp;
}

/**
 * Verifies an employee's password against stored cryptographic hash or credentials
 */
export function verifyEmployeePassword(employee, password) {
  if (!employee || !password || typeof password !== 'string' || !password.trim()) {
    return false;
  }
  const cleanPass = password.trim();
  if (employee.passwordHash && employee.passwordSalt) {
    return verifyPassword(cleanPass, employee.passwordHash, employee.passwordSalt);
  }
  if (employee.password) {
    return employee.password === cleanPass;
  }
  return false;
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
  const tenantUid = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || (currentUser && !currentUser.isEmployee ? currentUser.uid : null) || getActiveTenantId();
  const userObj = {
    uid: tenantUid || (currentUser && currentUser.uid) || emp.id,
    tenantId: tenantUid || (currentUser && currentUser.uid) || null,
    email: emp.email || `${emp.username}@progilic.dz`,
    displayName: emp.fullName,
    username: emp.username,
    isEmployee: true,
    role: 'employee',
    employeeId: emp.id,
    id: emp.id,
    department: emp.department,
    position: emp.position,
    supervisor: emp.supervisor,
    tasks: emp.tasks,
    permissions: emp.permissions || {},
    emailVerified: true
  };

  // Strictly Online: No local session persistence

  setCurrentStaffUser(emp);
  setCurrentUser(userObj);
  return userObj;
}

/**
 * Checks for stored active employee session on application start
 */
export function getStoredEmployeeSession() {
  return null;
}

/**
 * Clears employee session and returns to Gérant mode
 */
export function exitEmployeeSession() {
  const tenantUid = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || currentUser?.uid;
  setCurrentStaffUser(null);
  if (auth && auth.currentUser) {
    setCurrentUser({
      uid: auth.currentUser.uid,
      tenantId: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'المسؤول العام (Gérant)',
      emailVerified: true,
      role: 'gerant',
      isEmployee: false
    });
  } else if (tenantUid) {
    setCurrentUser({
      uid: tenantUid,
      tenantId: tenantUid,
      displayName: 'المسؤول العام (Gérant)',
      role: 'gerant',
      isEmployee: false
    });
  }
}
