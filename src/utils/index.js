import { S, clients } from '../state/store.js';
import { WILAYAS, ACTIVITY_TYPES } from '../constants/index.js';

export function esc(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s.replace(/[&<>"']/g, m => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

export const gc = () => clients.find(c => c.id === S.selId) || null;
export const init = (n) => { const p = (n || '').trim().split(' '); return p.length >= 2 ? (p[0][0] || '') + (p[1][0] || '') : (n || '').substring(0, 2).toUpperCase() };
export const fmtD = (d) => { if (!d) return '—'; try { const dt = new Date(d + 'T00:00'); return dt.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d } };
export const td = () => new Date().toISOString().split('T')[0];

export function sBdg(s) { const m = { 'نشط': 'bdg-g', 'محتمل': 'bdg-b', 'متوقف': 'bdg-y' }; return `<span class="bdg ${m[s] || 'bdg-gr'}">${s}</span>` }
export function pBdg(p) { const m = { 'عاجل': 'bdg-r', 'عالية': 'bdg-o', 'متوسطة': 'bdg-y', 'منخفضة': 'bdg-g' }; return `<span class="bdg ${m[p] || 'bdg-gr'}">${p}</span>` }
export function isBdg(s) { const m = { 'مفتوح': 'bdg-r', 'قيد المعالجة': 'bdg-y', 'محلول': 'bdg-g', 'مغلق': 'bdg-gr' }; return `<span class="bdg ${m[s] || 'bdg-gr'}">${s}</span>` }
export function rBdg(s) { const m = { 'مقترح': 'bdg-b', 'قيد الدراسة': 'bdg-y', 'مخطط': 'bdg-o', 'منفذ': 'bdg-g', 'مرفوض': 'bdg-r' }; return `<span class="bdg ${m[s] || 'bdg-gr'}">${s}</span>` }
export function avCls(s) { const m = { 'نشط': 'av-g', 'محتمل': 'av-b', 'متوقف': 'av-gr' }; return m[s] || 'av-gr' }
export function pBorder(p) { const m = { 'عاجل': 'p-urgent', 'عالية': 'p-high', 'متوسطة': 'p-med', 'منخفضة': 'p-low' }; return m[p] || '' }
export function srcCls(s) { const m = { 'نظام': 'src-sys', 'عميل': 'src-cl', 'سوء استخدام': 'src-usr', 'شبكة': 'src-net', 'غير محدد': 'src-uk' }; return m[s] || 'src-uk' }

export function selOpts(arr, cur) { return arr.map(o => `<option value="${o}"${cur === o ? ' selected' : ''}>${o}</option>`).join('') }
import { getWilayasList, getCommunesForWilaya, getWilayaByName } from './algeria.js';

export function wOpts(cur) { 
  return getWilayasList().map(w => {
    const val = w.name_ar; // Store the Arabic name in DB for backwards compatibility
    const display = S.lang === 'fr' ? w.name_fr : w.name_ar;
    return `<option value="${val}"${cur === val ? ' selected' : ''}>${w.id} - ${display}</option>`;
  }).join('');
}

export function cOpts(wilayaName, curCommune) {
  if (!wilayaName) return '';
  const wid = getWilayaByName(wilayaName);
  if (!wid) return '';
  return getCommunesForWilaya(wid).map(c => {
    const val = c.name_ar;
    const display = S.lang === 'fr' ? c.name_fr : c.name_ar;
    return `<option value="${val}"${curCommune === val ? ' selected' : ''}>${display}</option>`;
  }).join('');
}

export function updateCommunesOpts() {
  const wSelect = document.getElementById('f_wi');
  const cSelect = document.getElementById('f_cm');
  if (wSelect && cSelect) {
    const wName = wSelect.value;
    cSelect.innerHTML = `<option value="">${S.lang === 'fr' ? 'Sélectionner Commune' : 'اختر البلدية'}</option>` + cOpts(wName, '');
  }
}

export function getActTypes(act) { return ACTIVITY_TYPES[act] || ACTIVITY_TYPES['أخرى']; }
export function actTypeOpts(act, cur) { return `<option value="">اختر التخصص</option>` + getActTypes(act).map(t => `<option value="${t}"${cur === t ? ' selected' : ''}>${t}</option>`).join(''); }

export function updateActTypeOpts() {
  const act = document.getElementById('f_bt')?.value || '';
  const sel = document.getElementById('f_bf');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = actTypeOpts(act, cur);
}

export function activityIcon(act) {
  const m = { "تجارة جملة": "📦", "تجارة تجزئة": "🛒", "شركة خدمات": "🏢", "صناعة / تصنيع": "🏭", "مطاعم وفنادق": "🍽️", "صحة وصيدلة": "💊", "تعليم وتكوين": "📚", "بناء وعقارات": "🏗️", "نقل ولوجستيك": "🚛", "زراعة وأغذية": "🌾", "تقنية ومعلوماتية": "💻", "مالية وتأمين": "💰" };
  return m[act] || '🏪';
}

const progStatsCache = new WeakMap();

export function getProgramStats(c) {
  if (!c) return { total: 0, totalInstalls: 0, active: 0, expired: 0 };
  if (progStatsCache.has(c)) {
    return progStatsCache.get(c);
  }
  let res;
  if (!c._subcollectionsLoaded && c.programsCount !== undefined) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expired = c.endDate && new Date(c.endDate + 'T00:00') < today ? 1 : 0;
    res = {
      total: c.programsCount || 0,
      totalInstalls: c.installationsCount || 0,
      active: Math.max(0, (c.programsCount || 0) - expired),
      expired
    };
  } else {
    const progs = c.programs || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalInstalls = progs.reduce((s, p) => s + (Number(p.installationsCount) || 1), 0);
    const active = progs.filter(p => !p.endDate || new Date(p.endDate + 'T00:00') >= today);
    const expired = progs.filter(p => p.endDate && new Date(p.endDate + 'T00:00') < today);
    res = { total: progs.length, totalInstalls, active: active.length, expired: expired.length };
  }
  progStatsCache.set(c, res);
  return res;
}

export function progStatusCls(p) {
  if (!p.endDate) return 'active-prog';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(p.endDate + 'T00:00');
  if (!p.startDate) return end >= today ? 'active-prog' : 'expired-prog';
  const start = new Date(p.startDate + 'T00:00');
  if (start > today) return 'future-prog';
  return end >= today ? 'active-prog' : 'expired-prog';
}

export function progStatusLabel(p) {
  const cls = progStatusCls(p);
  if (cls === 'active-prog') return '<span class="bdg bdg-g">نشط</span>';
  if (cls === 'expired-prog') return '<span class="bdg bdg-r">منتهي</span>';
  return '<span class="bdg bdg-b">قادم</span>';
}

export function platformIcon(pl) { const m = { 'Desktop': '🖥', 'Mobile': '📱', 'Web': '🌐', 'Hybrid': '⚡' }; return m[pl] || '💻'; }
export function progTypeBdg(t) { const m = { 'تجاري': 'bdg-g', 'إنتاجي': 'bdg-b', 'لوحة تحكم': 'bdg-p', 'خدمي': 'bdg-o', 'أخرى': 'bdg-gr' }; return `<span class="bdg ${m[t] || 'bdg-gr'}">${t}</span>`; }

export function normalizePhone(p) { return (p || '').replace(/[\s\-\.]/g, '') }

export function searchMatch(c, rawQ) {
  if (!rawQ) return { match: true, fields: [] };
  // Fallback if no global search results are passed, but preferably we get them from performSearch
  // Actually, we can just use the old searchMatch for highlighting if needed, or find the result in MiniSearch.
  // We'll rewrite this to get fields from minisearch directly if we want to be clean, 
  // but to keep highlighting working simply we can retain the old fields logic for visual matching.
  const q = rawQ.trim().toLowerCase();
  if (!q) return { match: true, fields: [] };
  const fields = [];
  if ((c.fullName || '').toLowerCase().includes(q)) fields.push('الاسم');
  if ((c.company || '').toLowerCase().includes(q)) fields.push('الشركة');
  if ((c.wilaya || '').toLowerCase().includes(q)) fields.push('الولاية');
  if ((c.businessType || '').toLowerCase().includes(q)) fields.push('النشاط');
  if ((c.businessField || '').toLowerCase().includes(q)) fields.push('التخصص');
  const ph = normalizePhone(c.phone); const qph = normalizePhone(rawQ);
  if (ph && qph.length >= 4 && ph.includes(qph)) fields.push('الهاتف');
  
  // Search within program names
  const progNames = c.programNames || (c.programs || []).map(p => p.programName);
  if (progNames.some(name => name.toLowerCase().includes(q))) {
    fields.push('البرنامج');
  }
  
  return { match: fields.length > 0, fields };
}

import { performSearch } from '../business/searchIndex.js';

export function applyFilters(list) {
  let fil = [...list];
  if (S.filter !== 'الكل') fil = fil.filter(c => c.status === S.filter);
  
  // In-Memory Search Index using MiniSearch
  if (S.q) {
    const searchResults = performSearch(S.q);
    if (searchResults) {
      const matchedIds = new Set(searchResults.map(r => r.id));
      fil = fil.filter(c => matchedIds.has(c.id));
      // Sort the list based on MiniSearch relevance score
      const scoreMap = new Map(searchResults.map(r => [r.id, r.score]));
      fil.sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0));
    }
  }
  
  if (S.fWilaya) fil = fil.filter(c => c.wilaya === S.fWilaya);
  if (S.fCommune) fil = fil.filter(c => c.commune === S.fCommune);
  if (S.fActivity) fil = fil.filter(c => c.businessType === S.fActivity);
  if (S.fActType) fil = fil.filter(c => c.businessField === S.fActType);
  if (S.fProgram) {
    fil = fil.filter(c => {
      const progNames = c.programNames || (c.programs || []).map(p => p.programName);
      return progNames.some(name => name === S.fProgram);
    });
  }
  
  // Enterprise Sorting Algorithm with Arabic Collation Support
  const key = S.sortBy || 'id';
  const order = S.sortOrder || 'desc';
  
  return fil.sort((a, b) => {
    let valA, valB;
    if (key === 'score') {
      valA = a.score !== undefined ? a.score : 100;
      valB = b.score !== undefined ? b.score : 100;
    } else if (key === 'lastContact') {
      valA = a.lastContact || '0000-00-00';
      valB = b.lastContact || '0000-00-00';
    } else if (key === 'endDate') {
      valA = a.endDate || '9999-12-31';
      valB = b.endDate || '9999-12-31';
    } else {
      valA = a[key] === null || a[key] === undefined ? '' : a[key];
      valB = b[key] === null || b[key] === undefined ? '' : b[key];
    }
    
    if (typeof valA === 'string' && typeof valB === 'string') {
      return order === 'asc' 
        ? valA.localeCompare(valB, 'ar', { sensitivity: 'base' }) 
        : valB.localeCompare(valA, 'ar', { sensitivity: 'base' });
    } else {
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return order === 'asc' ? numA - numB : numB - numA;
    }
  });
}

export function countAdvFil() { return [S.fWilaya, S.fCommune, S.fActivity, S.fActType, S.fProgram].filter(Boolean).length; }

export function gv(id) { const el = document.getElementById(id); return el ? (el.value || '') : '' }
export function gc2(id) { const el = document.getElementById(id); return el ? el.checked : false }
export function gn(id, def = 0) { const el = document.getElementById(id); return el ? Number(el.value) || def : def }
