/**
 * Entity Resolution & Duplicate Detection Engine
 */

import { clients } from '../../state/store.js';
import { performSearch } from '../searchIndex.js';

export function findMatchingClients(queryText) {
  if (!queryText || typeof queryText !== 'string') return [];
  
  const trimmed = queryText.trim().toLowerCase();
  
  // 1. Direct phone match
  const phoneMatch = clients.filter(c => c.phone && c.phone.includes(trimmed));
  if (phoneMatch.length > 0) return phoneMatch;

  // 2. Exact/contains name match
  const nameMatch = clients.filter(c => 
    (c.fullName && c.fullName.toLowerCase().includes(trimmed)) ||
    (c.company && c.company.toLowerCase().includes(trimmed))
  );
  if (nameMatch.length > 0) return nameMatch;

  // 3. MiniSearch index fallback
  try {
    const searchResults = performSearch(queryText);
    if (searchResults && searchResults.length > 0) {
      return searchResults.map(r => clients.find(c => String(c.id) === String(r.id))).filter(Boolean);
    }
  } catch (err) {
    console.warn('EntityResolver search index error:', err);
  }

  return [];
}

export function checkForDuplicates(extractedData) {
  if (!extractedData) return [];

  const { fullName = '', phone = '', company = '' } = extractedData;
  const duplicates = [];

  clients.forEach(c => {
    let score = 0;
    const reasons = [];

    if (phone && c.phone && c.phone.trim() === phone.trim()) {
      score += 0.8;
      reasons.push('تطابق رقم الهاتف');
    }

    if (fullName && c.fullName && c.fullName.trim().toLowerCase() === fullName.trim().toLowerCase()) {
      score += 0.7;
      reasons.push('تطابق الاسم الكامل');
    }

    if (company && c.company && c.company.trim().toLowerCase() === company.trim().toLowerCase()) {
      score += 0.5;
      reasons.push('تطابق اسم الشركة/المحل');
    }

    if (score >= 0.5) {
      duplicates.push({
        client: c,
        score,
        reasons
      });
    }
  });

  return duplicates.sort((a, b) => b.score - a.score);
}

export function normalizeArabicText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel/diacritics
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\b(محل|مؤسسة|شركة|متجر|ets|sarl)\b/gi, '')
    .replace(/[-_./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let clean = phone.replace(/[^\d+]/g, '');
  if (clean.startsWith('+213')) clean = '0' + clean.slice(4);
  else if (clean.startsWith('00213')) clean = '0' + clean.slice(5);
  else if (clean.startsWith('213')) clean = '0' + clean.slice(3);
  return clean.replace(/\D/g, '');
}

export function resolveTrelloCustomer(extractedCustomer, clientsList = clients) {
  if (!extractedCustomer) {
    return { status: 'AMBIGUOUS', client: null, candidates: [], confidence: 0 };
  }

  const rawName = (extractedCustomer.rawName || '').trim();
  const rawPhone = (extractedCustomer.phone || '').trim();
  const normPhone = normalizePhoneNumber(rawPhone);
  const normName = normalizeArabicText(rawName);

  // 1. Tier 1: Decisive Phone Match
  if (normPhone && normPhone.length >= 9) {
    const phoneMatches = clientsList.filter(c => {
      const cPhone = normalizePhoneNumber(c.phone);
      return cPhone && (cPhone === normPhone || cPhone.endsWith(normPhone.slice(-9)));
    });

    if (phoneMatches.length === 1) {
      return {
        status: 'MATCHED_EXISTING',
        client: phoneMatches[0],
        matchType: 'PHONE_EXACT',
        confidence: 0.98
      };
    }
    if (phoneMatches.length > 1) {
      return {
        status: 'AMBIGUOUS',
        candidates: phoneMatches,
        matchType: 'PHONE_MULTIPLE',
        confidence: 0.5
      };
    }
  }

  // 2. Tier 2: Normalized Name + Company Composite Match
  if (normName && normName.length >= 3) {
    const candidates = [];

    clientsList.forEach(c => {
      const cNormName = normalizeArabicText(c.fullName);
      const cNormComp = normalizeArabicText(c.company);

      let score = 0;
      if (cNormName === normName) score += 0.8;
      else if (cNormName.includes(normName) || normName.includes(cNormName)) score += 0.6;

      if (cNormComp && (cNormComp === normName || cNormComp.includes(normName) || normName.includes(cNormComp))) {
        score += 0.4;
      }

      if (score >= 0.6) {
        candidates.push({ client: c, score });
      }
    });

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 1 && candidates[0].score >= 0.75) {
      const topClient = candidates[0].client;
      const rawExactMatch = (topClient.fullName || '').trim().toLowerCase() === rawName.toLowerCase();
      const companyMatches = Boolean(extractedCustomer.company && topClient.company && normalizeArabicText(extractedCustomer.company) === normalizeArabicText(topClient.company));
      const wilayaMatches = Boolean(extractedCustomer.wilaya && topClient.wilaya && normalizeArabicText(extractedCustomer.wilaya) === normalizeArabicText(topClient.wilaya));
      const phoneMatches = Boolean(normPhone && normalizePhoneNumber(topClient.phone) === normPhone);

      // Rule: Normalized ة/ه or ى/ي similarity cannot independently establish customer identity
      if (!rawExactMatch && !companyMatches && !wilayaMatches && !phoneMatches) {
        return {
          status: 'AMBIGUOUS',
          candidates: [topClient],
          matchType: 'NAME_ONLY_UNCONFIRMED',
          confidence: 0.65,
          reason: 'Normalized Arabic name similarity cannot independently confirm customer identity without secondary confirmation (phone, wilaya, or company).'
        };
      }

      return {
        status: 'MATCHED_EXISTING',
        client: topClient,
        matchType: rawExactMatch ? 'NAME_EXACT' : 'NAME_AND_SECONDARY_CORROBORATED',
        confidence: candidates[0].score
      };
    }

    if (candidates.length > 1) {
      const topClient = candidates[0].client;
      const hasSecondary = Boolean(
        (extractedCustomer.company && topClient.company && normalizeArabicText(extractedCustomer.company) === normalizeArabicText(topClient.company)) ||
        (extractedCustomer.wilaya && topClient.wilaya && normalizeArabicText(extractedCustomer.wilaya) === normalizeArabicText(topClient.wilaya))
      );

      // Check if top candidate is significantly ahead AND has secondary corroboration
      if (candidates[0].score >= 0.8 && (candidates[0].score - candidates[1].score >= 0.3) && hasSecondary) {
        return {
          status: 'MATCHED_EXISTING',
          client: topClient,
          matchType: 'NAME_DOMINANT_CORROBORATED',
          confidence: candidates[0].score
        };
      }
      return {
        status: 'AMBIGUOUS',
        candidates: candidates.map(c => c.client),
        matchType: 'NAME_MULTIPLE',
        confidence: 0.5
      };
    }
  }

  // 3. Tier 3: Customer is New to CRM - Validate sufficiency of identifiers
  const nameTokens = rawName.split(/\s+/).filter(Boolean);
  const hasSubstantialName = nameTokens.length >= 2 || (rawName.length >= 5 && !/^(client|زبون|محل)$/i.test(rawName));
  const hasSecondaryContact = Boolean(normPhone || extractedCustomer.wilaya || extractedCustomer.company);

  if (hasSubstantialName && hasSecondaryContact) {
    return {
      status: 'NEW_CLIENT_QUALIFIED',
      client: null,
      proposedClientData: {
        fullName: rawName,
        phone: rawPhone,
        company: extractedCustomer.company || '',
        wilaya: extractedCustomer.wilaya || '',
        commune: '',
        status: extractedCustomer.isExistingRealWorldClient ? 'نشط' : 'محتمل',
        notes: `تم إنشاء الحساب تلقائياً عبر تكامل Trello (${new Date().toISOString().split('T')[0]}).`
      },
      confidence: 0.9
    };
  }

  return {
    status: 'NEW_CLIENT_INSUFFICIENT_INFO',
    client: null,
    reason: 'Insufficient identifiers to safely register customer without review.',
    confidence: 0.3
  };
}
