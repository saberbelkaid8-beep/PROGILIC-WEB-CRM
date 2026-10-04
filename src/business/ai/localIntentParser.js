/**
 * Offline / Local Intent Parser using regex rules and fuzzy entity matching.
 * Used as a fallback when offline or when network latency is constrained.
 */

export function parseLocalIntent(text, activeContext = {}) {
  const clean = (text || '').trim();
  if (!clean) return null;

  const lower = clean.toLowerCase();

  // 1. Navigation intents
  if (lower.includes('لوحة') || lower.includes('الرئيسية') || lower.includes('dashboard') || lower.includes('tableau de bord') || lower.includes('home')) {
    return {
      intent: 'NAVIGATE',
      confidence: 0.95,
      targetPage: 'dashboard',
      summary: 'التنقل إلى لوحة التحكم / Navigation to Dashboard',
      plan: ['فتح لوحة التحكم الرئيسية / Open main dashboard']
    };
  }
  if (lower.includes('العملاء') || lower.includes('قائمة العملاء') || lower.includes('clients') || lower.includes('liste client') || lower.includes('customer')) {
    return {
      intent: 'NAVIGATE',
      confidence: 0.95,
      targetPage: 'clients',
      summary: 'التنقل إلى قائمة العملاء / Navigation to Clients',
      plan: ['فتح شاشة العملاء / Open clients view']
    };
  }

  // 2. Search / Filter intents
  if (lower.startsWith('بحث') || lower.startsWith('ابحث') || lower.startsWith('جد') || lower.includes('فحص') ||
      lower.startsWith('search') || lower.startsWith('find') || lower.startsWith('chercher') || lower.startsWith('recherch') || lower.startsWith('trouv')) {
    const query = clean.replace(/^(بحث|ابحث عن|ابحث|جد|عن|search|find|look for|chercher|rechercher|trouver)\s+/i, '');
    return {
      intent: 'SEARCH_CLIENTS',
      confidence: 0.88,
      extractedData: { query },
      summary: `البحث عن: "${query}"`,
      plan: [`تطبيق فلتر البحث الكلي بقيمة "${query}"`]
    };
  }

  // 3. Create client intent
  if (lower.includes('إضافة عميل') || lower.includes('عميل جديد') || lower.includes('اضف عميل') || lower.includes('سجل عميل') ||
      lower.includes('ajouter client') || lower.includes('nouveau client') || lower.includes('créer client') ||
      lower.includes('add client') || lower.includes('new client') || lower.includes('create client') ||
      lower.includes('زيد كليون') || lower.includes('دير كليون')) {
    // Extract phone if present
    const phoneMatch = clean.match(/0[567]\d{8}/);
    const phone = phoneMatch ? phoneMatch[0] : '';
    
    // Extract name if standard pattern
    let fullName = clean
      .replace(/(إضافة عميل|عميل جديد|اضف عميل|سجل عميل|اسمه|باسم|هاتفه|رقم|ajouter client|nouveau client|créer client|add client|new client|create client|nommé|named|زيد كليون|دير كليون)/gi, '')
      .replace(phone, '')
      .trim();

    return {
      intent: 'CREATE_CLIENT',
      confidence: fullName ? 0.85 : 0.70,
      extractedData: {
        fullName,
        phone,
        status: 'نشط'
      },
      summary: `تعبئة مسودة إضافة عميل جديد / Draft new client: ${fullName || 'Sans nom'}`,
      plan: ['فتح نافذة إضافة عميل جديد', 'تعبئة الحقول المستخرجة بانتظار التأكيد']
    };
  }

  // 4. Open selected client details
  if ((lower.includes('افتح') || lower.includes('عرض') || lower.includes('تفاصيل') || lower.includes('ouvrir') || lower.includes('open') || lower.includes('details')) && activeContext.selectedClientId) {
    return {
      intent: 'OPEN_CLIENT_DETAILS',
      confidence: 0.90,
      extractedData: { clientId: activeContext.selectedClientId },
      summary: `فتح ملف العميل الحالي (${activeContext.selectedClientName || ''})`,
      plan: ['عرض التفاصيل الكاملة للعميل']
    };
  }

  // Default fallback response
  return {
    intent: 'UNKNOWN',
    confidence: 0.40,
    extractedData: { rawText: clean },
    summary: 'لم يتم التعرف التلقائي على الأمر أوفلاين. يرجى تجربة صيغة أطرد.',
    clarificationNeeded: ['يرجى استخدام عبارات صريحة مثل: إضافة عميل، البحث عن، أو فتح صفحة العملاء.']
  };
}
