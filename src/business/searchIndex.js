import MiniSearch from 'minisearch';
import { normalizePhone } from '../utils/index.js';

let miniSearch = new MiniSearch({
  fields: ['fullName', 'company', 'wilaya', 'businessType', 'businessField', 'phone', 'programsList'],
  storeFields: ['id'], // we only need id to map back
  searchOptions: {
    fuzzy: 0.2, // fuzzy matching
    prefix: true, // prefix matching
    combineWith: 'AND'
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
let searchDocuments = [];

export function buildSearchIndex(clients) {
  miniSearch.removeAll();
  const validDocs = Array.isArray(clients) ? clients.filter(c => c && typeof c === 'object' && c.id != null) : [];
  searchDocuments = validDocs;
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
  const queryTerms = normalizeSearchText(rawQuery).split(' ').filter(Boolean);

  if (queryTerms.length > 1) {
    const exactNameMatches = searchDocuments.filter(client =>
      normalizeSearchText(client.fullName || '').includes(normalizeSearchText(rawQuery))
    );
    if (exactNameMatches.length > 0) {
      return exactNameMatches.map(client => ({ id: client.id, score: 1 }));
    }
  }

  // normalize phone query if it looks like a phone
  let searchQ = rawQuery;
  const isPhone = /^\d+$/.test(rawQuery.replace(/[\s\-\.]/g, ''));
  if (isPhone) {
    searchQ = normalizePhone(rawQuery);
  }
  
  return miniSearch.search(searchQ);
}

function normalizeSearchText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getMiniSearchInstance() {
  return miniSearch;
}
