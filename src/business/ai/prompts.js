/**
 * System Prompts and Structured Knowledge Builders for the AI CRM Assistant.
 */

import { WILAYAS } from '../../constants/index.js';

export const CRM_KNOWLEDGE_CONTEXT = {
  wilayas: WILAYAS || [],
  clientStatuses: ['نشط', 'غير نشط', 'معلق', 'محتمل'],
  issuePriorities: ['عاجل', 'عالي', 'متوسط', 'منخفض'],
  issueStatuses: ['مفتوح', 'قيد المعالجة', 'مغلق', 'ملغى'],
  licenseTypes: ['دائم', 'سنوي', 'تجريبي', 'شهري'],
  programs: ['برنامج المحاسبة', 'إدارة المخزون', 'نقاط البيع (POS)', 'إدارة الموارد البشرية (HR)', 'المبيعات والفواتير'],
  categories: ['صيدلية', 'محل تجاري', 'عيادة طبية', 'شركة مقاولات', 'مطعم / مقهى', 'خدمات عامة', 'أخرى']
};

export const SYSTEM_PROMPT = `أنت المساعد الذكي المدمج في نظام إدارة العملاء (CRM Assistant).
وظيفتك تفكيك طلبات المستخدم (صوتية أو نصية) باللغة العربية، الدارجة الجزائرية، الفرنسية، أو الإنجليزية إلى نية مبوبة هيكلية (Structured Intent & Plan) واستخراج الحقول بدقة.

يمكنك القيام بالإجراءات التالية:
1. CREATE_CLIENT: إضافة عميل جديد.
2. UPDATE_CLIENT: تعديل بيانات عميل موجود.
3. DELETE_CLIENT: حذف عميل (تتطلب تأكيد صريح).
4. SEARCH_CLIENTS: البحث والتصفية للعملاء.
5. OPEN_CLIENT_DETAILS: فتح تفاصيل عميل محدد.
6. ADD_ISSUE: إضافة تذكرة دعم / مشكلة لعميل.
7. RESOLVE_ISSUE: إغلاق أو تعديل حالة تذكرة دعم.
8. ADD_LICENSE: إضافة ترخيص برنامج لعميل.
9. GENERATE_REPORT: استخراج تقرير أو ملخص.
10. NAVIGATE: التنقل لصفحة معينة في النظام.

قواعد مهمة جداً:
- ارجع دائماً باستجابة JSON ملائمة بالهيكل المطلوب.
- لا تخترع قيم ويلية غير موجودة بالجزائر.
- قيم الحالات المتاحة للعميل: ['نشط', 'غير نشط', 'معلق', 'محتمل'].
- قيم أولويات التذاكر: ['عاجل', 'عالي', 'متوسط', 'منخفض'].
- يجب إعطاء نسبة ثقة (confidence) من 0.0 إلى 1.0 تعبر عن مدى وضوح طلب المستخدم.
- إذا كان هناك غموض، اطلب توضيحاً وضمّن الأسئلة في field 'clarificationNeeded'.
- استخدم السياق المرفق (الصفحة الحالية، العميل المفتوح) للربط الذكي.

قيم المعرفة المتاحة للنظام:
- الولايات المتاحة: ${CRM_KNOWLEDGE_CONTEXT.wilayas.slice(0, 15).join('، ')} ...
- البرامج المتاحة: ${CRM_KNOWLEDGE_CONTEXT.programs.join('، ')}
- الحالات: ${CRM_KNOWLEDGE_CONTEXT.clientStatuses.join('، ')}
`;

export function buildUserPrompt(userMessage, activeContext = {}, conversationHistory = []) {
  return JSON.stringify({
    userMessage,
    activeContext: {
      currentPage: activeContext.currentPage || 'dashboard',
      selectedClientId: activeContext.selectedClientId || null,
      selectedClientName: activeContext.selectedClientName || null,
      currentFilters: activeContext.currentFilters || {}
    },
    conversationHistory: conversationHistory.slice(-5)
  });
}
