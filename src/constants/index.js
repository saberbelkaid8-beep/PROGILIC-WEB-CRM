import locationData from '../data/algeria-locations.json';

export const SCHEMA_VERSION = 3;

export const WILAYAS = locationData.map(wilaya => wilaya.name_ar);

export const BUSINESS_TYPES = [
  "تجارة جملة", "تجارة تجزئة", "شركة خدمات", "صناعة / تصنيع", "مطاعم وفنادق", "صحة وصيدلة", "تعليم وتكوين", "بناء وعقارات", "نقل ولوجستيك", "زراعة وأغذية", "تقنية ومعلوماتية", "مالية وتأمين", "أخرى"
];

export const ACTIVITY_TYPES = {
  "تجارة جملة": ["مواد غذائية بالجملة", "مواد التغليف والتعليب والحلويات بالجملة", "إلكترونيات بالجملة", "ملابس وأقمشة بالجملة", "مواد بناء بالجملة", "أدوية وشبه صيدلاني بالجملة", "أخرى (جملة)"],
  "تجارة تجزئة": ["سوبرماركت / بقالة", "مواد التغليف والتعليب والحلويات بالتجزئة", "محل ملابس وأزياء", "عطور وتجميل", "خردوات ومواد بناء", "أثاث ومفروشات", "قطع غيار سيارات", "إلكترونيات وكهرومنزلية", "أخرى (تجزئة)"],
  "شركة خدمات": ["وكالة سياحة وأسفار", "وكالة إعلانات واتصال", "خدمات تنظيف وصيانة", "خدمات استشارية", "كراء السيارات", "أخرى (خدمات)"],
  "صناعة / تصنيع": ["صناعة غذائية", "صناعة بلاستيك", "صناعة نسيج", "صناعة معدنية", "أخرى (صناعة)"],
  "مطاعم وفنادق": ["مطعم تقليدي", "وجبات سريعة", "مقهى / قاعة شاي", "فندق / نزل", "قاعة حفلات", "أخرى (إطعام)"],
  "صحة وصيدلة": ["صيدلية / شبه صيدلي", "عيادة طبية", "مخبر تحاليل", "عيادة أسنان", "أخرى (صحة)"],
  "تعليم وتكوين": ["مدرسة خاصة", "معهد تكوين", "مدرسة لغات", "أخرى (تعليم)"],
  "بناء وعقارات": ["ترقية عقارية", "مقاولات بناء", "مكتب دراسات", "أخرى (بناء)"],
  "نقل ولوجستيك": ["نقل بضائع", "نقل مسافرين", "خدمات توصيل", "أخرى (نقل)"],
  "زراعة وأغذية": ["إنتاج زراعي", "تربية مواشي ودواجن", "أخرى (زراعة)"],
  "تقنية ومعلوماتية": ["برمجيات وتطوير", "بيع وصيانة حواسيب", "أخرى (تقنية)"],
  "مالية وتأمين": ["وكالة تأمين", "مكتب محاسبة", "أخرى (مالية)"],
  "أخرى": ["نشاط غير مصنف"]
};

export const PLATFORMS = ["Desktop", "Mobile", "Web", "Hybrid"];
export const PROGRAM_TYPES = ["تجاري", "إنتاجي", "لوحة تحكم", "خدمي", "أخرى"];
export const PROGRAM_VERSIONS = ["V21", "V23", "V24", "V26", "V27"];

export const PRIORITY_LEVELS = ["عاجل", "عالية", "متوسطة", "منخفضة"];
export const ISSUE_STATUSES = ["مفتوح", "قيد المعالجة", "محلول", "مغلق"];
export const REQ_STATUSES = ["مقترح", "قيد الدراسة", "مخطط", "منفذ", "مرفوض"];
export const IMPACT_LEVELS = ["عالي", "متوسط", "منخفض"];

export const ISSUE_TYPES = ["خطأ تقني", "أداء", "استفسار", "طلب ميزة", "خطأ مستخدم", "أخرى"];
export const ISSUE_SOURCES = ["نظام", "عميل", "سوء استخدام", "شبكة", "غير محدد"];

export const DEPARTMENTS = [
  { id: 'pre_vente', num: 1, name: 'قسم ما قبل البيع', titleAr: 'قسم ما قبل البيع', titleFr: 'Service Pré-vente', desc: 'التواصل الأولي، التعريف بـ PROGILIC، الشروحات والعروض وتأهيل العملاء' },
  { id: 'commercial', num: 2, name: 'القسم التجاري', titleAr: 'القسم التجاري', titleFr: 'Service Commercial', desc: 'تسيير الجانب التجاري، متابعة الصفقات والبيع، والعقود والاشتراكات' },
  { id: 'suivi', num: 3, name: 'قسم المتابعة', desc: 'متابعة العملاء، مراقبة سير العمل بين الأقسام، وحل المشكلات والتذاكر', titleAr: 'قسم المتابعة', titleFr: 'Service Suivi' },
  { id: 'technique', num: 4, name: 'القسم التقني', desc: 'الجانب التقني المرتبط بالمطور، معالجة المشكلات البرمجية، وتطوير الميزات', titleAr: 'القسم التقني', titleFr: 'Service Technique' }
];

export const ALL_PERMISSIONS = [
  'clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'clients.export', 'clients.view_sensitive', 'clients.manage_status', 'clients.view_timeline', 'clients.view_contact_history',
  'programs.view', 'programs.create', 'programs.edit', 'programs.delete', 'programs.view_licenses', 'programs.manage_licenses', 'programs.view_installations',
  'issues.view', 'issues.create', 'issues.edit', 'issues.delete', 'issues.change_status', 'issues.change_priority', 'issues.change_type', 'issues.add_notes', 'issues.resolve', 'issues.reopen', 'issues.close',
  'features.view', 'features.create', 'features.edit', 'features.delete', 'features.change_status', 'features.add_notes',
  'contacts.view_history', 'contacts.create_entry', 'contacts.edit_entry', 'contacts.delete_entry',
  'dashboard.view', 'reports.view', 'reports.export', 'analytics.view', 'analytics.view_risks', 'analytics.view_insights',
  'search.global', 'search.clients', 'filters.advanced', 'filters.by_wilaya', 'filters.by_program',
  'backup.view', 'backup.create', 'backup.download', 'backup.restore', 'backup.delete',
  'users.view', 'users.create', 'users.edit', 'users.disable', 'users.delete',
  'departments.view', 'departments.create', 'departments.edit', 'departments.delete',
  'permissions.view', 'permissions.assign', 'permissions.revoke',
  'settings.view', 'settings.edit',
  'account.view', 'account.change_password', 'account.manage_sessions',
  'timeline.view'
];

export const PERMISSION_GROUPS = [
  {
    id: 'clients',
    title: 'إدارة العملاء والملفات',
    icon: '👥',
    permissions: [
      { key: 'clients.view', label: 'عرض دليل العملاء', desc: 'الاطلاع على قائمة العملاء والبحث فيها' },
      { key: 'clients.create', label: 'إضافة عملاء جدد', desc: 'تسجيل عملاء جدد في قاعدة البيانات' },
      { key: 'clients.edit', label: 'تعديل بيانات العملاء', desc: 'تحديث بيانات التواصل، الحالة والعنوان' },
      { key: 'clients.delete', label: 'حذف سجلات العملاء (حساسة)', desc: 'إمكانية مسح سجلات العملاء نهائياً' },
      { key: 'clients.export', label: 'تصدير بيانات العملاء (CSV/JSON)', desc: 'تحميل وتصدير نسخ من بيانات العملاء' },
      { key: 'clients.view_sensitive', label: 'عرض البيانات الحساسة وأرقام الهاتف', desc: 'الاطلاع على تفاصيل الاتصال الحساسة للعملاء' },
      { key: 'clients.manage_status', label: 'إدارة وتغيير حالة العميل', desc: 'تغيير حالة العميل بين نشط، محتمل، ومتوقف' },
      { key: 'clients.view_timeline', label: 'عرض الخط الزمني للأنشطة', desc: 'استعراض تاريخ الأنشطة والتفاعلات اليومية' },
      { key: 'clients.view_contact_history', label: 'عرض سجل التواصل والمكالمات', desc: 'الاطلاع على المكالمات والزيارات المسجلة' }
    ]
  },
  {
    id: 'timeline',
    title: 'المخطط الزمني وتقارير الأنشطة',
    icon: '⏱️',
    permissions: [
      { key: 'timeline.view', label: 'عرض المخطط الزمني وتقريره', desc: 'عرض سجل العمليات وتصفية الأنشطة وإعداد تقرير الإدارة' }
    ]
  },
  {
    id: 'programs',
    title: 'البرامج والتراخيص والأنظمة',
    icon: '📦',
    permissions: [
      { key: 'programs.view', label: 'عرض البرامج والتراخيص', desc: 'الاطلاع على البرامج المرخصة والأجهزة' },
      { key: 'programs.create', label: 'إضافة برامج ورخص جديدة', desc: 'تسجيل رخص برامج جديدة للعملاء' },
      { key: 'programs.edit', label: 'تعديل بيانات التراخيص', desc: 'تحديث المنصة، عدد الأجهزة وتواريخ العقد' },
      { key: 'programs.delete', label: 'حذف البرامج والتراخيص', desc: 'إلغاء وحذف ترخيص البرنامج من حساب العميل' },
      { key: 'programs.view_licenses', label: 'عرض تفاصيل مفاتيح التراخيص', desc: 'الاطلاع على مفاتيح التفعيل ورخص POS' },
      { key: 'programs.manage_licenses', label: 'إدارة التراخيص والتجديد', desc: 'تجديد فترات التراخيص وتعديل صلاحيتها' },
      { key: 'programs.view_installations', label: 'عرض الأجهزة والمحطات المرخصة', desc: 'متابعة عدد المحطات والأجهزة المنصبة' }
    ]
  },
  {
    id: 'issues',
    title: 'الدعم الفني والأعطال والتذاكر',
    icon: '🐛',
    permissions: [
      { key: 'issues.view', label: 'عرض البلاغات والمشاكل التقنية', desc: 'الاطلاع على قائمة المشاكل والتذاكر' },
      { key: 'issues.create', label: 'تسجيل بلاغ/مشكلة جديدة', desc: 'إنشاء تذكرة دعم فني أو بلاغ عطل' },
      { key: 'issues.edit', label: 'تعديل بيانات التذكرة', desc: 'تحديث وصف وتفاصيل المشكلة' },
      { key: 'issues.delete', label: 'حذف التذاكر التقنية', desc: 'مسح سجل التذكرة أو البلاغ نهائياً' },
      { key: 'issues.change_status', label: 'تغيير حالة التذكرة', desc: 'تحديث حالة المشكلة (مفتوح، قيد المعالجة، محلول، مغلق)' },
      { key: 'issues.change_priority', label: 'تعديل أولوية المشكلة', desc: 'تحديد درجة الإلحاح (عاجل، عالية، متوسطة، منخفضة)' },
      { key: 'issues.change_type', label: 'تصنيف نوع العطل', desc: 'تحديد نوع المشكلة (تقني، أداء، خطأ مستخدم...)' },
      { key: 'issues.add_notes', label: 'إضافة ملاحظات وحلول تقنية', desc: 'تدوين الحلول التقنية والملاحظات التشخيصية' },
      { key: 'issues.resolve', label: 'حل وإصلاح المشكلة', desc: 'تأكيد إصلاح العطل البرمجي' },
      { key: 'issues.reopen', label: 'إعادة فتح المشكلة', desc: 'إعادة تنشيط تذكرة في حال تكرار العطل' },
      { key: 'issues.close', label: 'الإغلاق النهائي للتذكرة', desc: 'إغلاق وأرشفة البلاغ بعد التحقق' }
    ]
  },
  {
    id: 'features',
    title: 'طلبات الميزات والتطوير',
    icon: '💡',
    permissions: [
      { key: 'features.view', label: 'عرض طلبات الميزات والمتطلبات', desc: 'استعراض مقترحات تطوير النظام' },
      { key: 'features.create', label: 'تسجيل ميزة/متطلب جديد', desc: 'إضافة طلب تطوير ميزة جديدة من العميل' },
      { key: 'features.edit', label: 'تعديل المتطلب والمواصفات', desc: 'تحديث مواصفات الميزة المطلوبة' },
      { key: 'features.delete', label: 'حذف متطلبات التطوير', desc: 'إلغاء وحذف طلب الميزة نهائياً' },
      { key: 'features.change_status', label: 'تحديث مسار تنفيذ الميزة', desc: 'تغيير مسار التنفيذ (مقترح، قيد الدراسة، مخطط، منفذ)' },
      { key: 'features.add_notes', label: 'إضافة ملاحظات تحليلية للميزة', desc: 'تدوين ملاحظات تحليل الجدوى والتنفيذ' }
    ]
  },
  {
    id: 'contacts',
    title: 'سجلات التواصل والزيارات',
    icon: '📞',
    permissions: [
      { key: 'contacts.view_history', label: 'عرض سجل الاتصالات والمواعيد', desc: 'مراجعة المواعيد والاتصالات السابقة' },
      { key: 'contacts.create_entry', label: 'تسجيل مكالمة أو زيارة', desc: 'إضافة مدخل تواصل جديد مع التاريخ' },
      { key: 'contacts.edit_entry', label: 'تعديل مدخل التواصل', desc: 'تعديل تفاصيل المكالمة أو الملاحظة' },
      { key: 'contacts.delete_entry', label: 'حذف سجل تواصل', desc: 'مسح سجل مكالمة أو موعد' }
    ]
  },
  {
    id: 'analytics_reports',
    title: 'لوحة القيادة والتقارير والتحليلات',
    icon: '📊',
    permissions: [
      { key: 'dashboard.view', label: 'عرض لوحة القيادة والمؤشرات', desc: 'الاطلاع على الإحصائيات والمؤشرات العامة' },
      { key: 'reports.view', label: 'استعراض التقارير الإحصائية', desc: 'عرض تقارير التوزيع الجغرافي والولايات' },
      { key: 'reports.export', label: 'تصدير التقارير الإحصائية', desc: 'تصدير التقارير والرسوم البيانية' },
      { key: 'analytics.view', label: 'استعراض التحليلات الذكية', desc: 'عرض المؤشرات التحليلية المتقدمة' },
      { key: 'analytics.view_risks', label: 'تحليل مخاطر انقطاع العملاء', desc: 'مراقبة تقييمات الصحة ومخاطر فقدان العملاء' },
      { key: 'analytics.view_insights', label: 'رؤى المساعد الذكي (AI Copilot)', desc: 'استخدام المساعد الصوتي والتحليلي الذكي' }
    ]
  },
  {
    id: 'search_filters',
    title: 'البحث الشامل والفلاتر المتقدمة',
    icon: '🔍',
    permissions: [
      { key: 'search.global', label: 'البحث الشامل في النظام', desc: 'البحث السريع في كافة البيانات' },
      { key: 'search.clients', label: 'البحث في سجلات العملاء', desc: 'البحث المتخصص حسب النشاط والاسم' },
      { key: 'filters.advanced', label: 'استخدام الفلاتر المتقدمة', desc: 'تطبيق معايير التصفية المتعددة والمركبة' },
      { key: 'filters.by_wilaya', label: 'التصفية الجغرافية بالولايات', desc: 'فرز العملاء جغرافياً حسب الولاية والبلدية' },
      { key: 'filters.by_program', label: 'التصفية حسب البرامج', desc: 'فرز العملاء حسب نوع البرنامج المرخص' }
    ]
  },
  {
    id: 'backups',
    title: 'النسخ الاحتياطي وإدارة الأرشيف',
    icon: '💾',
    permissions: [
      { key: 'backup.view', label: 'عرض النسخ الاحتياطية وسجلات الأمان', desc: 'الاطلاع على قائمة النسخ وسجلات التدقيق' },
      { key: 'backup.create', label: 'إنشاء نسخ احتياطية يدوية', desc: 'أخذ لقطة فورية لقاعدة البيانات' },
      { key: 'backup.download', label: 'تحميل ملفات النسخ الاحتياطي', desc: 'تنزيل ملف .dum أو .json محلياً' },
      { key: 'backup.restore', label: 'استرجاع واستيراد البيانات', desc: 'استعادة بيانات من نسخة سابقة' },
      { key: 'backup.delete', label: 'حذف النسخ الاحتياطية', desc: 'تنظيف ومسح النسخ القديمة' }
    ]
  },
  {
    id: 'admin_governance',
    title: 'إدارة المستخدمين والأقسام والحوكمة',
    icon: '👑',
    permissions: [
      { key: 'users.view', label: 'عرض دليل الموظفين والمستخدمين', desc: 'الاطلاع على فريق العمل والمناصب' },
      { key: 'users.create', label: 'إضافة موظف/مستخدم جديد', desc: 'تسجيل حساب مستخدم جديد' },
      { key: 'users.edit', label: 'تعديل بيانات الموظفين والمناصب', desc: 'تحديث المنصب والمسمى والمسؤول المباشر' },
      { key: 'users.disable', label: 'تعطيل وتنشيط الحسابات', desc: 'إيقاف حساب موظف مؤقتاً أو إعادة تنشيطه' },
      { key: 'users.delete', label: 'حذف حساب مستخدم (يتطلب كلمة سر المسؤول)', desc: 'مسح حساب موظف نهائياً مع التحقق الإلزامي من كلمة مرور المسؤول العام (Gérant)' },
      { key: 'departments.view', label: 'استعراض هيكل الأقسام الأربعة', desc: 'الاطلاع على اختصاصات ومهام الأقسام' },
      { key: 'departments.create', label: 'إضافة قسم جديد', desc: 'استحداث قسم إداري جديد' },
      { key: 'departments.edit', label: 'تعديل مهام واختصاصات القسم', desc: 'تحديث المسؤوليات وتفاصيل القسم' },
      { key: 'departments.delete', label: 'حذف الأقسام', desc: 'حذف قسم إداري' },
      { key: 'permissions.view', label: 'عرض مصفوفة الصلاحيات', desc: 'الاطلاع على تفاصيل مصفوفة الصلاحيات الممنوحة' },
      { key: 'permissions.assign', label: 'منح الصلاحيات للموظفين', desc: 'تفعيل صلاحيات إضافية للموظف' },
      { key: 'permissions.revoke', label: 'سحب الصلاحيات من الموظفين', desc: 'تعطيل صلاحيات معينة لموظف' },
      { key: 'settings.view', label: 'عرض إعدادات النظام', desc: 'استعراض تفضيلات النظام واللغات' },
      { key: 'settings.edit', label: 'تعديل وضبط النظام', desc: 'تعديل الإعدادات العامة للنظام' },
      { key: 'account.view', label: 'عرض الملف الشخصي', desc: 'الاطلاع على بيانات الجلسة النشطة' },
      { key: 'account.change_password', label: 'تغيير كلمة المرور الشخصية', desc: 'تحديث كلمة المرور الشخصية للمستخدم' },
      { key: 'account.manage_sessions', label: 'إدارة الجلسات وتبديل المستخدمين', desc: 'التحكم في تسجيلات الدخول وبوابة التبديل' }
    ]
  }
];

/**
 * Builds an explicit 70-key permissions map for a given department
 * Every single permission in ALL_PERMISSIONS is definitively true or false
 */
export function buildDeptPermissions(deptId) {
  const base = {};
  ALL_PERMISSIONS.forEach(p => { base[p] = false; });

  const grant = (list) => {
    list.forEach(p => { if (p in base) base[p] = true; });
  };

  // Common baseline permissions
  grant([
    'dashboard.view', 'search.global', 'search.clients',
    'filters.advanced', 'filters.by_wilaya', 'filters.by_program',
    'account.view', 'account.change_password', 'account.manage_sessions'
  ]);

  switch (deptId) {
    case 'pre_vente':
    case 'قسم ما قبل البيع':
    case 'ما قبل البيع':
    case 'Service Pré-vente':
      grant([
        'clients.view', 'clients.create', 'clients.edit', 'clients.view_sensitive',
        'clients.manage_status', 'clients.view_timeline', 'clients.view_contact_history',
        'contacts.view_history', 'contacts.create_entry', 'contacts.edit_entry',
        'features.view', 'features.create', 'analytics.view'
      ]);
      break;

    case 'commercial':
    case 'القسم التجاري':
    case 'قسم التجاري':
    case 'تجاري':
    case 'Service Commercial':
      grant([
        'clients.view', 'clients.create', 'clients.edit', 'clients.export',
        'clients.view_sensitive', 'clients.manage_status', 'clients.view_timeline',
        'clients.view_contact_history', 'programs.view', 'programs.create', 'programs.edit',
        'programs.view_licenses', 'programs.manage_licenses', 'programs.view_installations',
        'contacts.view_history', 'contacts.create_entry', 'contacts.edit_entry',
        'reports.view', 'reports.export', 'analytics.view'
      ]);
      break;

    case 'suivi':
    case 'قسم المتابعة':
    case 'المتابعة':
    case 'Service Suivi':
      grant([
        'clients.view', 'clients.create', 'clients.edit', 'clients.view_sensitive',
        'clients.manage_status', 'clients.view_timeline', 'clients.view_contact_history',
        'issues.view', 'issues.create', 'issues.edit', 'issues.change_status',
        'issues.change_priority', 'issues.change_type', 'issues.add_notes',
        'features.view', 'features.create', 'features.edit', 'features.change_status',
        'features.add_notes', 'contacts.view_history', 'contacts.create_entry',
        'contacts.edit_entry', 'reports.view', 'analytics.view'
      ]);
      break;

    case 'technique':
    case 'tech':
    case 'القسم التقني':
    case 'قسم التقني':
    case 'تقني':
    case 'Service Technique':
      grant([
        'clients.view', 'clients.edit', 'clients.view_sensitive', 'clients.view_timeline',
        'programs.view', 'programs.create', 'programs.edit', 'programs.delete',
        'programs.view_licenses', 'programs.manage_licenses', 'programs.view_installations',
        'issues.view', 'issues.create', 'issues.edit', 'issues.delete', 'issues.change_status',
        'issues.change_priority', 'issues.change_type', 'issues.add_notes', 'issues.resolve',
        'issues.reopen', 'issues.close', 'features.view', 'features.create', 'features.edit',
        'features.delete', 'features.change_status', 'features.add_notes', 'analytics.view'
      ]);
      break;

    case 'gerant':
    case 'الإدارة العليا':
    case 'المدير العام':
    case 'الرئيس':
    case 'GERANT':
      ALL_PERMISSIONS.forEach(p => { base[p] = true; });
      break;

    default:
      grant(['clients.view']);
      break;
  }

  return base;
}

export function createDefaultGerant(tenantId = 'default', gerantName = 'المدير العام (GERANT)') {
  return {
    id: 'gerant',
    tenantId: tenantId,
    name: gerantName,
    fullName: gerantName,
    username: 'gerant',
    position: 'المدير العام (Gérant)',
    department: 'الإدارة العليا',
    supervisor: '-',
    tasks: 'إدارة النظام الكاملة، تحديد الصلاحيات، الإشراف على جميع الأقسام',
    role: 'GERANT',
    status: 'نشط',
    // Default salted cryptographic hash for password 'admin'
    passwordHash: '4dc349bbbedc982acc537b311a18d4e17b97a766042561141561d3dcf8c0b9f4',
    passwordSalt: 'progilic_admin_salt_2026',
    createdAt: new Date().toISOString().split('T')[0],
    permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {})
  };
}

export const DEFAULT_STAFF_USERS = [
  createDefaultGerant('default')
];
