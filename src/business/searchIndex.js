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
    if (fieldName === 'phone') {
      return normalizePhone(document.phone);
    }
    if (fieldName === 'programsList') {
      const progNames = document.programNames || (document.programs || []).map(p => p.programName);
      return progNames.join(' ');
    }
    return document[fieldName];
  }
});

export function buildSearchIndex(clients) {
  miniSearch.removeAll();
  miniSearch.addAll(clients);
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
