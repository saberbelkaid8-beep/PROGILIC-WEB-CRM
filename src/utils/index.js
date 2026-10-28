import { S, clients } from '../state/store.js';
import { WILAYAS, ACTIVITY_TYPES } from '../constants/index.js';
import { t } from './i18n.js';

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
export const fmtD = (d) => {
  if (!d) return '—';
  try {
    const dt = new Date(d + 'T00:00');
    const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
    return dt.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};
export const td = () => new Date().toISOString().split('T')[0];

export function sBdg(s) { const m = { 'نشط': 'bdg-g', 'محتمل': 'bdg-b', 'متوقف': 'bdg-y' }; return `<span class="bdg ${m[s] || 'bdg-gr'}">${t(s)}</span>` }
export function pBdg(p) { const m = { 'عاجل': 'bdg-r', 'عالية': 'bdg-o', 'متوسطة': 'bdg-y', 'منخفضة': 'bdg-g' }; return `<span class="bdg ${m[p] || 'bdg-gr'}">${t(p)}</span>` }
export function isBdg(s) { const m = { 'مفتوح': 'bdg-r', 'قيد المعالجة': 'bdg-y', 'محلول': 'bdg-g', 'مغلق': 'bdg-gr' }; return `<span class="bdg ${m[s] || 'bdg-gr'}">${t(s)}</span>` }
export function rBdg(s) { const m = { 'مقترح': 'bdg-b', 'قيد الدراسة': 'bdg-y', 'مخطط': 'bdg-o', 'منفذ': 'bdg-g', 'مرفوض': 'bdg-r' }; return `<span class="bdg ${m[s] || 'bdg-gr'}">${t(s)}</span>` }
export function avCls(s) { const m = { 'نشط': 'av-g', 'محتمل': 'av-b', 'متوقف': 'av-gr' }; return m[s] || 'av-gr' }
export function pBorder(p) { const m = { 'عاجل': 'p-urgent', 'عالية': 'p-high', 'متوسطة': 'p-med', 'منخفضة': 'p-low' }; return m[p] || '' }
export function srcCls(s) { const m = { 'نظام': 'src-sys', 'عميل': 'src-cl', 'سوء استخدام': 'src-usr', 'شبكة': 'src-net', 'غير محدد': 'src-uk' }; return m[s] || 'src-uk' }

export function selOpts(arr, cur) { return arr.map(o => `<option value="${o}"${cur === o ? ' selected' : ''}>${t(o)}</option>`).join('') }
import { getWilayasList, getCommunesForWilaya, getWilayaByName } from './algeria.js';

export function wOpts(cur) { 
  const isLatin = S.lang === 'fr' || S.lang === 'en';
  const wilayas = getWilayasList();
  const options = wilayas.map(w => {
    const val = w.name_ar; // Store the Arabic name in DB for backwards compatibility
    const display = isLatin ? w.name_fr : w.name_ar;
    return `<option value="${val}"${cur === val ? ' selected' : ''}>${w.id} - ${display}</option>`;
  });
  if (cur && !wilayas.some(wilaya => wilaya.name_ar === cur)) {
    const currentWilaya = wilayas.find(wilaya => wilaya.id === getWilayaByName(cur));
    if (currentWilaya) {
      const display = isLatin ? currentWilaya.name_fr : cur;
      options.unshift(`<option value="${esc(cur)}" selected>${currentWilaya.id} - ${esc(display)}</option>`);
    }
  }
  return options.join('');
}

export function cOpts(wilayaName, curCommune) {
  if (!wilayaName) return '';
  const wid = getWilayaByName(wilayaName);
  if (!wid) return '';
  const isLatin = S.lang === 'fr' || S.lang === 'en';
  const communes = getCommunesForWilaya(wid);
  const options = communes.map(c => {
    const val = c.name_ar;
    const display = isLatin ? c.name_fr : c.name_ar;
    return `<option value="${val}"${curCommune === val ? ' selected' : ''}>${display}</option>`;
  });
  if (curCommune && !communes.some(commune => commune.name_ar === curCommune)) {
    options.unshift(`<option value="${esc(curCommune)}" selected>${esc(curCommune)}</option>`);
  }
  return options.join('');
}

export function updateCommunesOpts() {
  const wSelect = document.getElementById('f_wi');
  const cSelect = document.getElementById('f_cm');
  if (wSelect && cSelect) {
    const wName = wSelect.value;
    cSelect.innerHTML = `<option value="">${t('اختر البلدية')}</option>` + cOpts(wName, '');
  }
}

export function getActTypes(act) { return ACTIVITY_TYPES[act] || ACTIVITY_TYPES['أخرى']; }
export function actTypeOpts(act, cur) { return `<option value="">${t('اختر التخصص')}</option>` + getActTypes(act).map(tOpt => `<option value="${tOpt}"${cur === tOpt ? ' selected' : ''}>${t(tOpt)}</option>`).join(''); }

export function updateActTypeOpts() {
  const act = document.getElementById('f_bt')?.value || '';
  const sel = document.getElementById('f_bf');
  if (!sel) return;
  sel.innerHTML = actTypeOpts(act, '');
}

import { PLATFORM_PROGRAM_TYPES } from '../constants/index.js';

export function getProgramTypesForPlatform(platform) {
  return PLATFORM_PROGRAM_TYPES[platform] || [];
}

export function programTypeOpts(platform, cur) {
  const types = getProgramTypesForPlatform(platform || 'Desktop');
  if (!types || types.length === 0) {
    return `<option value="">(${t('لا توجد برامج ويب حالياً — قيد التطوير')})</option>`;
  }
  return types.map(ty => {
    const isSelected = cur === ty || (cur && ty.startsWith(cur)) || (cur && cur.startsWith(ty.split(' ')[0]));
    return `<option value="${ty}"${isSelected ? ' selected' : ''}>${t(ty)}</option>`;
  }).join('');
}

export function updateProgramTypeSelect(platform, targetId = 'fp_ty') {
  const sel = document.getElementById(targetId);
  if (!sel) return;
  sel.innerHTML = programTypeOpts(platform, '');
}

export function onClientStatusChange() {
  const st = document.getElementById('f_st')?.value;
  const sdInput = document.getElementById('f_sd');
  const progSec = document.getElementById('active_client_prog_sec');
  if (st === 'نشط') {
    if (sdInput && !sdInput.value) {
      sdInput.value = new Date().toISOString().split('T')[0];
    }
    if (progSec) progSec.style.display = 'block';
  } else {
    if (progSec) progSec.style.display = 'none';
  }
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
    res = {
      total: c.programsCount || 0,
      totalInstalls: c.installationsCount || 0,
      active: c.programsCount || 0,
      expired: 0
    };
  } else {
    const progs = c.programs || [];
    const totalInstalls = progs.reduce((s, p) => s + (Number(p.installationsCount) || 1), 0);
    res = { total: progs.length, totalInstalls, active: progs.length, expired: 0 };
  }
  progStatsCache.set(c, res);
  return res;
}

export function progStatusCls(p) {
  return 'active-prog';
}

export function progStatusLabel(p) {
  return `<span class="bdg bdg-g">${t('نشط (مدى الحياة)')}</span>`;
}

export function platformIcon(pl) { const m = { 'Desktop': '🖥', 'Mobile': '📱', 'Web': '🌐', 'Hybrid': '⚡' }; return m[pl] || '💻'; }
export function progTypeBdg(tVal) { const m = { 'تجاري': 'bdg-g', 'إنتاجي': 'bdg-b', 'لوحة تحكم': 'bdg-p', 'خدمي': 'bdg-o', 'أخرى': 'bdg-gr' }; return `<span class="bdg ${m[tVal] || 'bdg-gr'}">${t(tVal)}</span>`; }

export function normalizePhone(p) { return (p || '').replace(/[\s\-\.]/g, '') }

export function searchMatch(c, rawQ) {
  if (!rawQ) return { match: true, fields: [] };
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const q = normalize(rawQ);
  if (!q) return { match: true, fields: [] };
  const fields = [];
  if (normalize(c.fullName).includes(q)) fields.push('الاسم');
  if (normalize(c.company).includes(q)) fields.push('الشركة');
  if (normalize(c.wilaya).includes(q)) fields.push('الولاية');
  if (normalize(c.businessType).includes(q)) fields.push('النشاط');
  if (normalize(c.businessField).includes(q)) fields.push('التخصص');
  const ph = normalizePhone(c.phone); const qph = normalizePhone(rawQ);
  if (ph && qph.length >= 4 && ph.includes(qph)) fields.push('الهاتف');
  
  // Search within program names
  const progNames = [...(Array.isArray(c.programNames) ? c.programNames : []), ...(Array.isArray(c.programs) ? c.programs.map(p => p?.programName) : [])];
  if (progNames.some(name => normalize(name).includes(q))) {
    fields.push('البرنامج');
  }
  
  return { match: fields.length > 0, fields };
}

import { performSearch } from '../business/searchIndex.js';

export function isClientAtRisk(c) {
  if (!c || typeof c !== 'object') return false;
  const sc = c.score !== undefined ? Number(c.score) : 100;
  if (sc < 50 || c.status === 'متوقف') return true;

  // No contact for 30+ days
  if (c.lastContact) {
    try {
      const days = Math.floor((Date.now() - new Date(c.lastContact + 'T00:00').getTime()) / 86400000);
      if (days >= 30) return true;
    } catch (e) {}
  }

  // Open urgent or high priority issues
  const hasUrgent = (c.issues || []).some(i => 
    i && (i.priority === 'عاجل' || i.priority === 'عالية') && 
    (i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد')
  );
  if (hasUrgent) return true;

  // Ending or expired contract (within 30 days or past)
  if (c.endDate) {
    try {
      const dl = Math.floor((new Date(c.endDate + 'T00:00').getTime() - Date.now()) / 86400000);
      if (dl <= 30) return true;
    } catch (e) {}
  }
  const progExpiring = (c.programs || []).some(p => {
    if (!p || !p.endDate) return false;
    try {
      const dl = Math.floor((new Date(p.endDate + 'T00:00').getTime() - Date.now()) / 86400000);
      return dl <= 30;
    } catch (e) {
      return false;
    }
  });
  if (progExpiring) return true;

  return false;
}

export function applyFilters(list) {
  let fil = [...list];
  if (S.filter !== 'الكل') {
    if (S.filter === 'خطر') {
      fil = fil.filter(c => isClientAtRisk(c));
    } else {
      fil = fil.filter(c => c.status === S.filter);
    }
  }
  
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
      const progNames = [...(Array.isArray(c.programNames) ? c.programNames : []), ...(Array.isArray(c.programs) ? c.programs.map(p => p?.programName) : [])];
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
