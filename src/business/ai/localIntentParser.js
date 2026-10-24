/**
 * Offline / Local Intent Parser using regex rules and fuzzy entity matching.
 * Used as a fallback when offline or when network latency is constrained.
 */
import { WILAYAS } from '../../constants/index.js';

export function parseLocalIntent(text, activeContext = {}) {
  const clean = (text || '').trim();
  if (!clean) return null;

  const lower = clean.toLowerCase();
  const language = activeContext.language || 'ar';
  const localized = (ar, fr, en) => language === 'fr' ? fr : language === 'en' ? en : ar;

  // 1. Navigation intents
  if (lower.includes('لوحة') || lower.includes('الرئيسية') || lower.includes('dashboard') || lower.includes('tableau de bord') || lower.includes('home')) {
    return {
      intent: 'NAVIGATE',
      confidence: 0.95,
      targetPage: 'dashboard',
      summary: localized('التنقل إلى لوحة التحكم', 'Ouverture du tableau de bord', 'Opening the dashboard'),
      plan: [localized('فتح لوحة التحكم الرئيسية', 'Ouvrir le tableau de bord principal', 'Open the main dashboard')]
    };
  }
  if (lower.includes('العملاء') || lower.includes('قائمة العملاء') || lower.includes('clients') || lower.includes('liste client') || lower.includes('customer')) {
    return {
      intent: 'NAVIGATE',
      confidence: 0.95,
      targetPage: 'clients',
      summary: localized('التنقل إلى قائمة العملاء', 'Ouverture de la liste des clients', 'Opening the client list'),
      plan: [localized('فتح شاشة العملاء', 'Ouvrir la liste des clients', 'Open the clients view')]
    };
  }

  // 2. Search / Filter intents
  if (lower.startsWith('بحث') || lower.startsWith('ابحث') || lower.startsWith('جد') || lower.includes('فحص') ||
      lower.startsWith('search') || lower.startsWith('find') || lower.startsWith('chercher') || lower.startsWith('recherch') || lower.startsWith('trouv')) {
    const query = clean.replace(/^(ابحث عن|بحث عن|ابحث|بحث|جد|عن|look for|search for|search|find|rechercher|chercher|trouver)\s+/i, '');
    return {
      intent: 'SEARCH_CLIENTS',
      confidence: 0.88,
      extractedData: { query },
      summary: localized(`البحث عن: "${query}"`, `Recherche de : "${query}"`, `Searching for: "${query}"`),
      plan: [localized(`تطبيق فلتر البحث الكلي بقيمة "${query}"`, `Appliquer le filtre de recherche « ${query} »`, `Apply the search filter for "${query}"`)]
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
    
    let extractedWilaya = '';
    for (const w of WILAYAS) {
      if (clean.includes(w) || clean.includes(`من ${w}`) || clean.includes(`في ${w}`)) {
        extractedWilaya = w;
        break;
      }
    }

    // Extract name if standard pattern
    let fullName = clean
      .replace(/(إضافة عميل جديد|إضافة عميل|عميل جديد|اضف عميل|سجل عميل|اسمه|باسم|هاتفه|رقم|ajouter client|nouveau client|créer client|add client|new client|create client|nommé|named|زيد كليون|دير كليون|كليون جديد|كليون|جديد)/gi, '')
      .replace(phone, '')
      .replace(new RegExp(`(من|في|ولاية|wilaya de|wilaya)?\\s*${extractedWilaya}`, 'gi'), '')
      .replace(/[\s,،-]+/g, ' ')
      .trim();

    return {
      intent: 'CREATE_CLIENT',
      confidence: fullName ? 0.92 : 0.75,
      extractedData: {
        fullName: fullName || 'بدون اسم',
        phone,
        wilaya: extractedWilaya,
        status: 'نشط'
      },
      summary: localized(
        `تجهيز مسودة إضافة العميل "${fullName || 'جديد'}"${extractedWilaya ? ` من ${extractedWilaya}` : ''}. يرجى المراجعة والتأكيد.`,
        `Préparation du brouillon pour le client « ${fullName || 'nouveau client'} »${extractedWilaya ? ` à ${extractedWilaya}` : ''}. Vérifiez les informations et confirmez.`,
        `Preparing a draft for client "${fullName || 'new client'}"${extractedWilaya ? ` in ${extractedWilaya}` : ''}. Review and confirm.`
      ),
      plan: [
        localized('فتح نافذة إضافة عميل جديد', 'Ouvrir le formulaire de création d’un client', 'Open the new client form'),
        localized('تعبئة الحقول المستخرجة بانتظار التأكيد', 'Préremplir les champs extraits avant confirmation', 'Fill in the extracted fields for review')
      ]
    };
  }

  // 4. Open selected client details
  if ((lower.includes('افتح') || lower.includes('عرض') || lower.includes('تفاصيل') || lower.includes('ouvrir') || lower.includes('open') || lower.includes('details')) && activeContext.selectedClientId) {
    return {
      intent: 'OPEN_CLIENT_DETAILS',
      confidence: 0.90,
      extractedData: { clientId: activeContext.selectedClientId },
      summary: localized(
        `فتح ملف العميل الحالي (${activeContext.selectedClientName || ''})`,
        `Ouverture de la fiche du client actuel (${activeContext.selectedClientName || ''})`,
        `Opening the current client record (${activeContext.selectedClientName || ''})`
      ),
      plan: [localized('عرض التفاصيل الكاملة للعميل', 'Afficher tous les détails du client', 'Show all client details')]
    };
  }

  // Default fallback response
  return {
    intent: 'UNKNOWN',
    confidence: 0.40,
    extractedData: { rawText: clean },
    summary: localized(
      'لم يتم التعرف تلقائياً على الأمر دون اتصال. يرجى تجربة صيغة أوضح.',
      'Commande non reconnue hors ligne. Essayez une formulation plus précise.',
      'The command was not recognized offline. Try a clearer request.'
    ),
    clarificationNeeded: [localized(
      'يرجى استخدام عبارات صريحة مثل: إضافة عميل، البحث عن، أو فتح صفحة العملاء.',
      'Utilisez une demande explicite, par exemple : ajouter un client, rechercher ou ouvrir la liste des clients.',
      'Use a clear request, such as adding a client, searching, or opening the client list.'
    )]
  };
}
