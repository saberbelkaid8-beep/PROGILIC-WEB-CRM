export const SCHEMA_VERSION = 3;

export const WILAYAS = [
  "أدرار", "الشلف", "الأغواط", "أم البواقي", "باتنة", "بجاية", "بسكرة", "بشار", "البليدة", "البويرة",
  "تمنراست", "تبسة", "تلمسان", "تيارت", "تيزي وزو", "الجزائر", "الجلفة", "جيجل", "سطيف", "سعيدة",
  "سكيكدة", "سيدي بلعباس", "عنابة", "قالمة", "قسنطينة", "المدية", "مستغانم", "المسيلة", "معسكر", "ورقلة",
  "وهران", "البيض", "إليزي", "برج بوعريريج", "بومرداس", "الطارف", "تندوف", "تيسمسيلت", "الوادي", "خنشلة",
  "سوق أهراس", "تيبازة", "ميلة", "عين الدفلى", "النعامة", "عين تموشنت", "غرداية", "غليزان", "تيميمون", "برج باجي مختار",
  "أولاد جلال", "بني عباس", "إن صالح", "إن قزام", "تقرت", "جانت", "المغير", "المنيعة"
];

export const BUSINESS_TYPES = [
  "تجارة جملة", "تجارة تجزئة", "شركة خدمات", "صناعة / تصنيع", "مطاعم وفنادق", "صحة وصيدلة", "تعليم وتكوين", "بناء وعقارات", "نقل ولوجستيك", "زراعة وأغذية", "تقنية ومعلوماتية", "مالية وتأمين", "أخرى"
];

export const ACTIVITY_TYPES = {
  "تجارة جملة": ["مواد غذائية بالجملة", "إلكترونيات بالجملة", "ملابس وأقمشة بالجملة", "مواد بناء بالجملة", "أدوية وشبه صيدلاني بالجملة", "أخرى (جملة)"],
  "تجارة تجزئة": ["سوبرماركت / بقالة", "محل ملابس وأزياء", "عطور وتجميل", "خردوات ومواد بناء", "أثاث ومفروشات", "قطع غيار سيارات", "إلكترونيات وكهرومنزلية", "أخرى (تجزئة)"],
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

export const PRIORITY_LEVELS = ["عاجل", "عالية", "متوسطة", "منخفضة"];
export const ISSUE_STATUSES = ["مفتوح", "قيد المعالجة", "محلول", "مغلق"];
export const REQ_STATUSES = ["مقترح", "قيد الدراسة", "مخطط", "منفذ", "مرفوض"];
export const IMPACT_LEVELS = ["عالي", "متوسط", "منخفض"];

export const ISSUE_TYPES = ["خطأ تقني", "أداء", "استفسار", "طلب ميزة", "خطأ مستخدم", "أخرى"];
export const ISSUE_SOURCES = ["نظام", "عميل", "سوء استخدام", "شبكة", "غير محدد"];

export const DEPARTMENTS = [
  { id: 'tech', name: 'القسم التقني', desc: 'إدارة الأخطاء، التراخيص، الأنظمة والتقنيات' },
  { id: 'commercial', name: 'قسم التجاري', desc: 'إدارة العملاء، العقود، المبيعات والأسعار' },
  { id: 'followup', name: 'قسم المتابعة', desc: 'متابعة الأنشطة، الزيارات، السجلات والتاريخ' },
  { id: 'aftersales', name: 'قسم ما بعد البيع', desc: 'دعم العملاء، الشكاوى، الحلول والرضا' }
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
  'users.view', 'users.create', 'users.edit', 'users.disable',
  'departments.view', 'departments.create', 'departments.edit',
  'permissions.view', 'permissions.assign', 'permissions.revoke',
  'settings.view', 'settings.edit',
  'account.view', 'account.change_password', 'account.manage_sessions'
];

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
    createdAt: new Date().toISOString().split('T')[0],
    permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {})
  };
}

export const DEFAULT_STAFF_USERS = [
  createDefaultGerant('default')
];

