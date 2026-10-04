import MiniSearch from 'minisearch';
import { normalizePhone } from '../utils/index.js';

let miniSearch = new MiniSearch({
  fields: ['fullName', 'company', 'wilaya', 'businessType', 'businessField', 'phone', 'programsList'],
  storeFields: ['id'], // we only need id to map back
  searchOptions: {
    fuzzy: 0.2, // fuzzy matching
    prefix: true // prefix matching
  },
  extractField: (document, fieldName) => {
    if (!document || typeof document !== 'object') return '';
    if (fieldName === 'phone') {
      return normalizePhone(document.phone);
    }
    if (fieldName === 'programsList') {
      const progNames = document.programNames || (Array.isArray(document.programs) ? document.programs.map(p => p?.programName).filter(Boolean) : []);
      return progNames.join(' ');
    }
    return document[fieldName] || '';
  }
});

export function buildSearchIndex(clients) {
  miniSearch.removeAll();
  const validDocs = Array.isArray(clients) ? clients.filter(c => c && typeof c === 'object' && c.id != null) : [];
  if (validDocs.length > 0) {
    try {
      miniSearch.addAll(validDocs);
    } catch (e) {
      console.warn("Search index addAll error:", e);
    }
  }
}

export function performSearch(query) {
  if (!query || !query.trim()) return null;
  const rawQuery = query.trim();
  // normalize phone query if it looks like a phone
  let searchQ = rawQuery;
  const isPhone = /^\d+$/.test(rawQuery.replace(/[\s\-\.]/g, ''));
  if (isPhone) {
    searchQ = normalizePhone(rawQuery);
  }
  
  return miniSearch.search(searchQ);
}

export function getMiniSearchInstance() {
  return miniSearch;
}
