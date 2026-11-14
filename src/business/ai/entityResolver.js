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
