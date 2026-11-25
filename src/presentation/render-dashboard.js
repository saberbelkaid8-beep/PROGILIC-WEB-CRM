/**
 * PROGILIC CRM v3 - Pixel-Perfect Dashboard Implementation
 * Matches the requested executive layout with 100% reactive real-time data synchronization.
 */

import { S, clients, staffUsers, isGerant, hasPermission } from '../state/store.js';
import { computeScore, computeAlerts, evaluateIssueSla } from '../business/intelligence.js';
import { esc, getProgramStats } from '../utils/index.js';
import { isConfirmedClientStatus, isUnconfirmedClientStatus } from '../business/clientStatus.js';
import { t } from '../utils/i18n.js';
import { DEPARTMENTS } from '../business/employeeService.js';
import { computeFleetDeviceMetrics, filterRecentDashboardActivities } from '../business/programMetrics.js';
import { computeProgramVersionMetrics } from '../business/programVersionSync.js';

// SVG Icons Dictionary
const I = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  lifebuoy: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  calclock: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  chevl: '<path d="m15 18-6-6 6-6"/>',
  cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
};

const ic = (n, s = 18, sw = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`;

// Helper to generate SVG sparklines
function spark(d, color, w = 88, h = 38) {
  if (!d || d.length === 0) d = [10, 15, 20, 25, 30, 35, 40, 45];
  const mn = Math.min(...d), mx = Math.max(...d), p = 4;
  const pts = d.map((v, i) => [p + i * (w - 2 * p) / (d.length - 1 || 1), h - p - (v - mn) / (mx - mn || 1) * (h - 2 * p)]);
  const last = pts[pts.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="direction:ltr"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`;
}

// Helper for horizontal progress bar rows
const hb = (l, v, max, c, fmt, rng, extraAttr = '', extraClass = '') => `
  <div class="hb${extraClass ? ' ' + extraClass : ''}" ${extraAttr}>
    <span class="l" title="${esc(l)}">${esc(l)}${rng ? ` <bdi dir="ltr" style="font-family:Inter;font-size:11.5px;color:var(--muted);font-weight:600;margin-inline-start:4px">${esc(rng)}</bdi>` : ''}</span>
    <div class="t"><div class="f" style="width:${Math.min(100, Math.max(0, (((v || 0) / (max || 1)) * 100)))}%;background:${c}"></div></div>
    <span class="v num">${fmt !== undefined && fmt !== null ? fmt : (v !== undefined && v !== null ? v : 0)}</span>
  </div>
`;

// Helper for KPI card
function kpi({ icon, tint, fg, label, value, unit, sub, delta, dgood, dtxt, data, color }) {
  return `
    <div class="card kpi c2">
      <div class="top"><div class="chipi" style="background:${tint};color:${fg}">${ic(icon, 19)}</div>${label}</div>
      <div class="val"><b class="num">${value}</b>${unit ? `<small>${unit}</small>` : ''}</div>
      <div class="row">
        <div style="display:flex;flex-direction:column;gap:6px">
          <span class="delta ${dgood ? 'g' : 'b'}">${ic(delta, 13, 2.6)}<span>${dtxt}</span></span>
          <span class="sub">${sub}</span>
        </div>
        ${spark(data, color)}
      </div>
    </div>
  `;
}

// Donut SVG
function donut(segs, size = 176, r = 66, sw = 22, center = '') {
  const C = 2 * Math.PI * r, gap = 3;
  let off = 0, out = '';
  const tot = segs.reduce((a, s) => a + s.v, 0) || 1;
  segs.forEach(s => {
    const len = (s.v / tot) * C;
    out += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.c}" stroke-width="${sw}" stroke-dasharray="${Math.max(0, len - gap)} ${C - len + gap}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    off += len;
  });
  return `
    <div style="position:relative;width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}">${out}</svg>
      <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">${center}</div>
    </div>
  `;
}

// Column Chart for Licenses (Interactive Platform Comparison: Desktop, Mobile, Web)
function colChart(rows, mxVal = 140) {
  const W = 360, H = 175, pb = 32, pt = 28, bw = 54;
  const mx = Math.max(mxVal, ...rows.map(r => r.v), 10);
  const n = rows.length, step = W / (n || 1);
  const colors = {
    'Desktop': { bar: '#007AFF', bg: 'rgba(0,122,255,0.12)', label: '#007AFF', icon: '💻' },
    'Mobile': { bar: '#34C759', bg: 'rgba(52,199,89,0.12)', label: '#34C759', icon: '📱' },
    'Web': { bar: '#FF9500', bg: 'rgba(255,149,0,0.12)', label: '#FF9500', icon: '🌐' }
  };
  const maxV = Math.max(...rows.map(r => r.v));
  const tot = rows.reduce((acc, r) => acc + r.v, 0) || 1;

  let g = `<line x1="10" x2="${W - 10}" y1="${H - pb}" y2="${H - pb}" stroke="rgba(0,0,0,0.08)" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  rows.forEach((r, i) => {
    const pal = colors[r.l] || { bar: '#007AFF', bg: 'rgba(0,122,255,0.12)', label: '#007AFF', icon: '💻' };
    const isLeader = r.v > 0 && r.v === maxV;
    const h = Math.max(6, (r.v / mx) * (H - pb - pt));
    const x = step * i + (step - bw) / 2;
    const y = H - pb - h;
    const pct = Math.round((r.v / tot) * 100);
    const progsNote = r.progs !== undefined ? ` · ${r.progs} ${t('برنامج')}` : '';

    g += `
      <g style="cursor:pointer" onclick="openLicensesExplorerModal('${r.l}')" class="plat-col-group">
        <title>${esc(r.l)}: ${r.v} ${t('جهاز')} (${pct}%${progsNote}) — ${t('اضغط لعرض تراخيص')} ${esc(r.l)} ${t('فقط')}</title>
        <rect x="${x}" y="${pt}" width="${bw}" height="${H - pb - pt}" rx="12" fill="${pal.bg}" opacity="0.45"/>
        <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="10" fill="${pal.bar}" style="filter:drop-shadow(0 4px 10px ${pal.bar}40)"/>
        <text x="${x + bw / 2}" y="${y - 8}" text-anchor="middle" font-size="13" font-weight="800" fill="var(--ink)" font-family="Inter">${r.v}</text>
        ${isLeader ? `<text x="${x + bw / 2}" y="${pt - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="#EAB308">👑 ${t('المتصدر')}</text>` : ''}
        <text x="${x + bw / 2}" y="${H - 14}" text-anchor="middle" font-size="12" font-weight="700" fill="${pal.label}" font-family="Inter">${pal.icon} ${esc(r.l)}</text>
        <text x="${x + bw / 2}" y="${H - 2}" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--muted)" font-family="Inter">${pct}%</text>
      </g>
    `;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="direction:ltr;overflow:visible">${g}</svg>`;
}

// Mini Column Sparkline for Departments
function miniCols(vals, color = '#2a78d6', w = 150, h = 40) {
  if (!vals || vals.length === 0) vals = [0, 0, 0, 0, 0, 0, 0];
  const mx = Math.max(...vals, 1);
  const bw = 14, step = w / vals.length;
  let g = '';
  vals.forEach((v, i) => {
    const bh = v > 0 ? Math.max(4, (v / mx) * (h - 2)) : 2;
    const x = step * i + (step - bw) / 2;
    g += `<rect x="${x}" y="${h - bh}" width="${bw}" height="${bh}" rx="3" fill="${color}" opacity="${v === 0 ? 0.2 : (v / mx < 0.35 ? 0.6 : 1)}"/>`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="direction:ltr">${g}</svg>`;
}

// Circular Score Ring
function ringScore(s, c) {
  const r = 19, C = 2 * Math.PI * r, len = (s / 100) * C;
  return `
    <div class="ring">
      <svg width="44" height="44">
        <circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--border-soft)" stroke-width="5"/>
        <circle cx="22" cy="22" r="${r}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${len} ${C}" transform="rotate(-90 22 22)"/>
      </svg>
      <b style="color:var(--ink)">${s}</b>
    </div>
  `;
}

// Format relative date
function formatRelativeTime(ts) {
  if (!ts) return 'مؤخراً';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `قبل ${days} يوم`;
}

// Local date & inference helpers
function toLocalYmd(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
}

function parseLocalDateMs(val, fallbackId = null) {
  if (val) {
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (!Number.isNaN(dt.getTime())) return dt.getTime();
    }
    const parsed = new Date(s).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  const numId = Number(fallbackId);
  // Only treat numeric ID as a creation timestamp if it's a valid epoch ms (2020–2100)
  if (Number.isFinite(numId) && numId >= 1577836800000 && numId <= 4102444800000) {
    return numId;
  }
  return null;
}

function inferPlatformFromName(programName = '') {
  const lower = String(programName || '').toLowerCase();
  if (lower.startsWith('mobile') || lower.includes('vdd') || lower.includes('tableau de bord') || lower.includes('التاجر') || lower.includes('لوحة القيادة')) {
    return 'Mobile';
  }
  if (lower.startsWith('web') || lower.includes('الويب')) {
    return 'Web';
  }
  return 'Desktop';
}

/**
 * Main renderDashboard Entry Point
 */
export function renderDashboard() {
  const period = S.dbPeriod || 30;
  const selectedWilaya = S.dbWilaya || 'all';
  const todayObj = new Date();

  // Filter clients by Wilaya if selected (ignore null/malformed entries safely)
  const safeClients = (Array.isArray(clients) ? clients : []).filter(Boolean);
  const cl = selectedWilaya === 'all' 
    ? safeClients 
    : safeClients.filter(c => c.wilaya === selectedWilaya);

  const totalClients = cl.length;
  const confirmedClients = cl.filter(c => isConfirmedClientStatus(c.status)).length;
  const unconfirmedClients = cl.filter(c => isUnconfirmedClientStatus(c.status)).length;
  const noProgramsClients = cl.filter(c => getProgramStats(c).total === 0).length;

  const todayMidnightMs = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate()).getTime();
  const todayStr = toLocalYmd(todayObj);
  const DAY = 86400000;
  const now = Date.now();
  const clIdSet = new Set(cl.map(c => Number(c.id)));

  // 1. Programs & Devices Fleet Metrics (Device-Centric + Category & Platform Breakdown)
  const fleet = computeFleetDeviceMetrics(cl, todayObj);
  const totalPrograms = fleet.totalPrograms;
  const totalLicensedDevices = fleet.totalLicensedDevices;

  // 2. Open Issues and Priorities
  const allIssues = cl.flatMap(c => (c.issues || []).map(i => ({ ...i, clientId: c.id, clientName: c.fullName, clientWilaya: c.wilaya })));
  const openIssues = allIssues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد');
  const unhydratedOpenIssuesExtra = cl.reduce((acc, c) => acc + (!c._subcollectionsLoaded && (c.issues || []).length === 0 ? (Number(c.openIssuesCount) || 0) : 0), 0);
  const totalOpenIssuesCount = openIssues.length + unhydratedOpenIssuesExtra;
  const urgentIssues = openIssues.filter(i => i.priority === 'عاجل' || i.priority === 'عالية');

  const issuesByPriority = {
    عاجل: openIssues.filter(i => i.priority === 'عاجل').length,
    عالية: openIssues.filter(i => i.priority === 'عالية').length,
    متوسطة: openIssues.filter(i => i.priority === 'متوسطة').length,
    منخفضة: openIssues.filter(i => i.priority === 'منخفضة' || !i.priority).length
  };

  // 3. Feature Requests (Requirements Pipeline)
  const allReqs = cl.flatMap(c => (c.requirements || []).map(r => ({ ...r, clientId: c.id, clientName: c.fullName })));
  const reqsByStatus = {
    مقترح: allReqs.filter(r => r.status === 'مقترح' || !r.status).length,
    'قيد الدراسة': allReqs.filter(r => r.status === 'قيد الدراسة').length,
    مخطط: allReqs.filter(r => r.status === 'مخطط').length,
    منفذ: allReqs.filter(r => r.status === 'منفذ').length
  };

  // 4. Client Scores, Health & Top Accounts
  let totalScoreSum = 0;
  const scoreCategories = {
    متميز: 0,       // 75+
    جيد: 0,          // 50–74
    'يحتاج متابعة': 0, // 25–49
    'متابعة عاجلة': 0  // <25
  };
  const topClientsList = [];

  cl.forEach(c => {
    const sc = c._subcollectionsLoaded
      ? computeScore(c).total
      : (c.score !== undefined ? Number(c.score) : computeScore(c).total);
    totalScoreSum += sc;
    if (sc >= 75) scoreCategories['متميز']++;
    else if (sc >= 50) scoreCategories['جيد']++;
    else if (sc >= 25) scoreCategories['يحتاج متابعة']++;
    else scoreCategories['متابعة عاجلة']++;

    const ps = getProgramStats(c);
    if (ps.total > 0 || isConfirmedClientStatus(c.status)) {
      topClientsList.push({
        client: c,
        score: sc,
        programsCount: ps.total,
        devicesCount: ps.totalInstalls,
        lastContact: c.lastContact || ''
      });
    }
  });

  const avgScore = totalClients ? Math.round(totalScoreSum / totalClients) : 0;
  const excellentPct = totalClients ? Math.round((scoreCategories['متميز'] / totalClients) * 100) : 0;
  topClientsList.sort((a, b) => b.devicesCount - a.devicesCount || b.score - a.score);

  // 5. Wilayas Distribution
  const wilayaCounts = {};
  cl.forEach(c => {
    const w = (c.wilaya || 'غير محدد').trim();
    wilayaCounts[w] = (wilayaCounts[w] || 0) + 1;
  });
  const sortedWilayas = Object.entries(wilayaCounts).sort((a, b) => b[1] - a[1]);
  const topWilayas = sortedWilayas.slice(0, 8);
  const otherWilayasCount = Math.max(0, sortedWilayas.length - 8);
  const otherWilayasClientsSum = sortedWilayas.slice(8).reduce((acc, curr) => acc + curr[1], 0);
  const maxWilayaVal = topWilayas.length ? topWilayas[0][1] : 1;

  // Map resolved timestamps from Timeline activities when available
  const resolvedActByIssueKey = new Map();
  const issueAddedActs = [];
  const issueResolvedActs = [];
  (S.globalActivities || []).forEach(act => {
    if (!act || !act.timestamp) return;
    if (selectedWilaya !== 'all' && act.clientId && !clIdSet.has(Number(act.clientId))) return;
    if (act.type === 'ISSUE_ADDED') issueAddedActs.push(act);
    if (act.type === 'ISSUE_RESOLVED') {
      issueResolvedActs.push(act);
      if (act.clientId && act.description) {
        resolvedActByIssueKey.set(`${Number(act.clientId)}|${String(act.description)}`, act.timestamp);
      }
    }
  });

  function getIssueResolvedYmd(issue) {
    if (issue.status !== 'محلول' && issue.status !== 'مغلق') return '';
    if (issue.resolvedDate) return String(issue.resolvedDate).slice(0, 10);
    const matchingAct = issueResolvedActs.find(a =>
      Number(a.clientId) === Number(issue.clientId) &&
      issue.title &&
      (String(a.description || '').includes(issue.title) || String(a.title || '').includes(issue.title))
    );
    if (matchingAct?.timestamp) {
      const dt = new Date(matchingAct.timestamp);
      if (!Number.isNaN(dt.getTime())) return toLocalYmd(dt);
    }
    return String(issue.date || '').slice(0, 10);
  }

  function getIssueResolvedMs(issue) {
    if (issue.status !== 'محلول' && issue.status !== 'مغلق') return null;
    if (issue.resolvedDate) return parseLocalDateMs(issue.resolvedDate);
    const matchingAct = issueResolvedActs.find(a =>
      Number(a.clientId) === Number(issue.clientId) &&
      issue.title &&
      (String(a.description || '').includes(issue.title) || String(a.title || '').includes(issue.title))
    );
    if (matchingAct?.timestamp) {
      const ms = new Date(matchingAct.timestamp).getTime();
      if (!Number.isNaN(ms)) return ms;
    }
    return parseLocalDateMs(issue.date, issue.id);
  }

  // 6. Support Trend (Line chart over selected period - 1, 7, 30, 90 days)
  const mon = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const nw = [];
  const rs = [];
  const chartLabels = [];
  const isWeekendIndices = new Set();

  if (period === 1) {
    // Hourly movement for today (24 hours in 2-hour increments)
    const getIssueHourToday = (issue, isResolveCheck = false) => {
      if (isResolveCheck) {
        const rAct = issueResolvedActs.find(a =>
          Number(a.clientId) === Number(issue.clientId) &&
          issue.title &&
          (String(a.description || '').includes(issue.title) || String(a.title || '').includes(issue.title))
        );
        if (rAct?.timestamp) {
          const dt = new Date(rAct.timestamp);
          if (!Number.isNaN(dt.getTime()) && toLocalYmd(dt) === todayStr) return dt.getHours();
        }
      }
      if (issue.date && String(issue.date).includes('T')) {
        const dt = new Date(issue.date);
        if (!Number.isNaN(dt.getTime()) && toLocalYmd(dt) === todayStr) return dt.getHours();
      }
      if (!isResolveCheck) {
        const aAct = issueAddedActs.find(a =>
          Number(a.clientId) === Number(issue.clientId) &&
          issue.title &&
          (String(a.description || '').includes(issue.title) || String(a.title || '').includes(issue.title))
        );
        if (aAct?.timestamp) {
          const dt = new Date(aAct.timestamp);
          if (!Number.isNaN(dt.getTime()) && toLocalYmd(dt) === todayStr) return dt.getHours();
        }
      }
      const idMs = parseLocalDateMs(null, issue.id);
      if (idMs !== null && toLocalYmd(new Date(idMs)) === todayStr) {
        return new Date(idMs).getHours();
      }
      return String(issue.date || '').slice(0, 10) === todayStr ? 9 : null;
    };

    for (let h = 0; h < 24; h += 2) {
      chartLabels.push(`${String(h).padStart(2, '0')}:00`);
      const hEnd = h + 2;
      const issuesOpenedInHour = allIssues.filter(i => {
        if ((i.date || '').slice(0, 10) !== todayStr) return false;
        const hr = getIssueHourToday(i, false);
        return hr !== null && hr >= h && hr < hEnd;
      }).length;
      const issuesResolvedInHour = allIssues.filter(i => {
        if (i.status !== 'محلول' && i.status !== 'مغلق') return false;
        if (getIssueResolvedYmd(i) !== todayStr) return false;
        const hr = getIssueHourToday(i, true);
        return hr !== null && hr >= h && hr < hEnd;
      }).length;
      nw.push(issuesOpenedInHour);
      rs.push(issuesResolvedInHour);
    }
  } else {
    // Daily movements for 7, 30, or 90 days in local timezone
    const daysCount = period;
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - i);
      const dStr = toLocalYmd(d);

      const createdCount = allIssues.filter(iss => (iss.date || '').slice(0, 10) === dStr).length;
      const resolvedCount = allIssues.filter(iss => getIssueResolvedYmd(iss) === dStr).length;

      nw.push(createdCount);
      rs.push(resolvedCount);

      const dayOfWeek = d.getDay();
      if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday or Saturday
        isWeekendIndices.add(daysCount - 1 - i);
      }

      if (period === 7) {
        chartLabels.push(`${dayNames[dayOfWeek]}`);
      } else {
        chartLabels.push(`${d.getDate()} ${mon[d.getMonth()]}`);
      }
    }
  }

  const sumN = nw.reduce((a, b) => a + b, 0);
  const sumR = rs.reduce((a, b) => a + b, 0);

  // Real time-bucketed KPI Sparklines & Deltas (Zero fake formulas)
  const monthWindowStartMs = todayMidnightMs - 30 * DAY;
  const weekWindowStartMs = todayMidnightMs - 7 * DAY;
  const checkpoints30d = Array.from({ length: 8 }, (_, idx) => (
    idx === 7 ? now : monthWindowStartMs + Math.round((idx * 30 * DAY) / 7)
  ));

  // KPI 1: Clients growth over last 30 days
  const newClients30d = cl.filter(c => {
    const ms = parseLocalDateMs(c.startDate, c.id);
    return ms !== null && ms >= monthWindowStartMs && ms <= now;
  }).length;
  const clientsSparkline = checkpoints30d.map((cp, idx) => {
    if (idx === 7) return totalClients;
    return cl.filter(c => {
      const ms = parseLocalDateMs(c.startDate, c.id);
      return ms === null || ms <= cp;
    }).length;
  });

  // KPI 2: Licensed Devices growth over last 30 days
  const newDevices30d = fleet.newDevices30d;
  const devicesSparkline = fleet.devicesSparkline;

  // KPI 3: Open issues 7-day movement
  const issuesOpened7d = allIssues.filter(i => {
    const ms = parseLocalDateMs(i.date, i.id);
    return ms !== null && ms >= weekWindowStartMs && ms <= now;
  }).length;
  const issuesResolved7d = allIssues.filter(i => {
    const ms = getIssueResolvedMs(i);
    return ms !== null && ms >= weekWindowStartMs && ms <= now;
  }).length;
  const ticketsNet7d = issuesOpened7d - issuesResolved7d;
  const ticketsSparkline = (() => {
    const pts = new Array(8).fill(0);
    pts[7] = totalOpenIssuesCount;
    for (let stepIdx = 6; stepIdx >= 0; stepIdx--) {
      const dayOffset = 6 - stepIdx;
      const d = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - dayOffset);
      const dStr = toLocalYmd(d);
      const openedOnDay = allIssues.filter(iss => (iss.date || '').slice(0, 10) === dStr).length;
      const resolvedOnDay = allIssues.filter(iss => getIssueResolvedYmd(iss) === dStr).length;
      pts[stepIdx] = Math.max(0, pts[stepIdx + 1] - openedOnDay + resolvedOnDay);
    }
    return pts;
  })();

  // KPI 4: Support Resolution Rate & SLA Compliance
  const unhydratedSolvedIssuesExtra = cl.reduce((acc, c) => acc + (!c._subcollectionsLoaded && (c.issues || []).length === 0 ? (Number(c.solvedIssuesCount) || 0) : 0), 0);
  const totalSolvedIssues = allIssues.filter(i => i.status === 'محلول' || i.status === 'مغلق').length + unhydratedSolvedIssuesExtra;
  const totalIssuesCount = totalOpenIssuesCount + totalSolvedIssues;
  const resolutionRatePct = totalIssuesCount ? Math.round((totalSolvedIssues / totalIssuesCount) * 100) : 100;
  const slaBreachedOpenCount = openIssues.filter(i => evaluateIssueSla(i, now).breached).length;
  const resolvedSparkline = (() => {
    const pts = [];
    for (let dayOffset = 7; dayOffset >= 0; dayOffset--) {
      const d = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - dayOffset);
      const dStr = toLocalYmd(d);
      const solvedByDay = allIssues.filter(iss => {
        const ymd = getIssueResolvedYmd(iss);
        return ymd && ymd <= dStr;
      }).length + unhydratedSolvedIssuesExtra;
      pts.push(solvedByDay);
    }
    return pts;
  })();

  // KPI 5: Health score cohort trend & stable ratio
  const healthyClientsCount = scoreCategories['متميز'] + scoreCategories['جيد'];
  const scoreSparkline = checkpoints30d.map((cp, idx) => {
    if (idx === 7) return avgScore;
    const cohort = cl.filter(c => {
      const ms = parseLocalDateMs(c.startDate, c.id);
      return ms === null || ms <= cp;
    });
    if (cohort.length === 0) return avgScore;
    const sum = cohort.reduce((acc, c) => {
      const sc = c._subcollectionsLoaded ? computeScore(c).total : (c.score !== undefined ? Number(c.score) : computeScore(c).total);
      return acc + sc;
    }, 0);
    return Math.round(sum / cohort.length);
  });

  // KPI 6: Follow-up & Communication coverage (30d)
  const contacted30Clients = fleet.contacted30Clients;
  const contactCoveragePct = fleet.contactCoveragePct;
  const contacts30dCount = fleet.contacts30dCount;
  const contactsSparkline = fleet.contactsSparkline;

  // SVG Line Chart Builder (Multi-period with Real-Time Data)
  function buildLineChartSVG() {
    const W = 870, H = 268, pl = 34, pr = 10, pt = 14, pb = 30;
    const nPts = nw.length;
    const yMax = Math.max(8, ...nw, ...rs);
    const X = i => pl + (i * (W - pl - pr)) / (nPts - 1 || 1);
    const Y = v => pt + (1 - v / yMax) * (H - pt - pb);

    let g = '';
    // Weekend highlighting
    if (period !== 1) {
      isWeekendIndices.forEach(i => {
        const x0 = X(i) - (W - pl - pr) / (nPts * 2);
        const wd = (W - pl - pr) / nPts;
        g += `<rect x="${Math.max(pl, x0)}" y="${pt}" width="${wd}" height="${H - pt - pb}" fill="var(--border-soft)"/>`;
      });
    }

    // Horizontal grid lines
    const step = Math.max(2, Math.ceil(yMax / 4));
    for (let v = 0; v <= yMax; v += step) {
      g += `
        <line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v ? 'var(--border-soft)' : 'var(--border)'}" stroke-width="1"/>
        <text x="${pl - 10}" y="${Y(v) + 4}" text-anchor="end" font-size="11.5" fill="var(--muted)" font-family="Inter">${v}</text>
      `;
    }

    // X-axis date labels
    const stepX = period === 1 ? 2 : (period === 7 ? 1 : Math.max(1, Math.floor(nPts / 6)));
    chartLabels.forEach((lbl, i) => {
      if ((i % stepX === 0 && i < nPts - 1) || i === nPts - 1) {
        g += `<text x="${X(i)}" y="${H - 8}" text-anchor="${i === nPts - 1 ? 'end' : i === 0 ? 'start' : 'middle'}" font-size="11.5" fill="var(--muted)" font-family="Cairo">${lbl}</text>`;
      }
    });

    const path = a => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
    g += `<path d="${path(nw)}" fill="none" stroke="#2a78d6" stroke-width="2.5" stroke-linejoin="round"/>`;
    g += `<path d="${path(rs)}" fill="none" stroke="#eb6834" stroke-width="2.5" stroke-linejoin="round"/>`;
    g += `
      <circle cx="${X(nPts - 1)}" cy="${Y(nw[nPts - 1])}" r="4.5" fill="#2a78d6" stroke="#fff" stroke-width="2"/>
      <circle cx="${X(nPts - 1)}" cy="${Y(rs[nPts - 1])}" r="4.5" fill="#eb6834" stroke="#fff" stroke-width="2"/>
    `;
    return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="direction:ltr">${g}</svg>`;
  }

  // 7. Platform Comparison Column Chart Data (Device-Centric!)
  const platformRows = [
    { l: 'Desktop', v: fleet.platformDevices.Desktop, progs: fleet.platformPrograms.Desktop },
    { l: 'Mobile', v: fleet.platformDevices.Mobile, progs: fleet.platformPrograms.Mobile },
    { l: 'Web', v: fleet.platformDevices.Web, progs: fleet.platformPrograms.Web }
  ];
  const versionMetrics = computeProgramVersionMetrics(cl);

  // 8. Urgent Alerts list (filtered to active Wilaya if selected)
  const urgentAlerts = computeAlerts()
    .filter(a => (a.level === 'urgent' || a.level === 'warning') && (selectedWilaya === 'all' || clIdSet.has(Number(a.cid))));
  const alertDisplayList = urgentAlerts.slice(0, 5);

  // 9. Recent Activities list (strictly sanitized, deduplicated, sorted newest first)
  const recentActivities = filterRecentDashboardActivities(
    S.globalActivities || [],
    clients,
    selectedWilaya === 'all' ? null : clIdSet
  ).slice(0, 6);

  // 10. Department Activity (This Week) — 100% Real Live Synchronization
  const activitiesByDept = {
    pre_vente: { 
      name: 'قسم ما قبل البيع',
      count: 0, 
      subtext: '', 
      icon: 'megaphone', 
      colorClass: 'ico b', 
      barColor: '#2563EB',
      vals: [0, 0, 0, 0, 0, 0, 0],
      staffCount: 0
    },
    commercial: { 
      name: 'القسم التجاري',
      count: 0, 
      subtext: '', 
      icon: 'handshake', 
      colorClass: 'ico g', 
      barColor: '#059669',
      vals: [0, 0, 0, 0, 0, 0, 0],
      staffCount: 0
    },
    suivi: { 
      name: 'قسم المتابعة',
      count: 0, 
      subtext: '', 
      icon: 'headset', 
      colorClass: 'ico w', 
      barColor: '#D97706',
      vals: [0, 0, 0, 0, 0, 0, 0],
      staffCount: 0
    },
    technique: { 
      name: 'القسم التقني',
      count: 0, 
      subtext: '', 
      icon: 'wrench', 
      colorClass: 'ico p', 
      barColor: '#7C3AED',
      vals: [0, 0, 0, 0, 0, 0, 0],
      staffCount: 0
    }
  };

  // Count real staff members in each department
  (staffUsers || []).forEach(u => {
    const d = u.department || 'suivi';
    if (activitiesByDept[d]) activitiesByDept[d].staffCount++;
  });

  // Calculate this week's start & end bounds (Sunday 00:00:00 local time)
  const currentDayOfWeek = todayObj.getDay();
  const sundayThisWeek = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - currentDayOfWeek);
  const weekStartMs = sundayThisWeek.getTime();
  const weekEndMs = weekStartMs + 7 * DAY;

  const seenDeptKeys = new Set();
  const recordDeptEvent = (deptId, key, dtMs) => {
    if (!activitiesByDept[deptId] || dtMs === null || dtMs < weekStartMs || dtMs >= weekEndMs) return;
    if (key && seenDeptKeys.has(key)) return;
    if (key) seenDeptKeys.add(key);
    activitiesByDept[deptId].count++;
    const dayIdx = new Date(dtMs).getDay();
    if (activitiesByDept[deptId].vals[dayIdx] !== undefined) {
      activitiesByDept[deptId].vals[dayIdx]++;
    }
  };

  // 1. Explicitly logged / synced Timeline activities this week (deduplicated against client sub-items)
  (S.globalActivities || []).forEach(act => {
    if (!act || !act.timestamp) return;
    if (selectedWilaya !== 'all' && act.clientId && !clIdSet.has(Number(act.clientId))) return;
    const actMs = new Date(act.timestamp).getTime();
    if (Number.isNaN(actMs) || actMs < weekStartMs || actMs >= weekEndMs) return;

    const tp = String(act.type || '');
    if (tp.startsWith('BACKUP_') || tp.startsWith('DATA_') || tp.startsWith('STAFF_') || tp === 'SYSTEM_PURGE' || tp.endsWith('_DELETED')) {
      return;
    }

    let deptId = null;
    let key = null;
    const cidStr = act.clientId ? String(act.clientId) : '';
    const actIdStr = String(act.id || '');

    if (tp === 'CLIENT_CREATED' || tp === 'CLIENT_EDITED' || tp === 'GPS_CAPTURED') {
      deptId = 'pre_vente';
      key = tp === 'CLIENT_CREATED' && cidStr ? `client:${cidStr}` : `act:${actIdStr}`;
    } else if (tp === 'PROGRAM_ADDED' || tp === 'PROGRAM_EDITED' || tp === 'PROGRAM_VERSION_UPDATED') {
      deptId = 'commercial';
      let progId = act.meta?.programId ? String(act.meta.programId) : '';
      if (!progId && actIdStr.startsWith(`act_prog_${cidStr}_`)) {
        progId = actIdStr.slice(`act_prog_${cidStr}_`.length);
      }
      key = tp === 'PROGRAM_ADDED' && cidStr && progId ? `prog:${cidStr}:${progId}` : `act:${actIdStr}`;
    } else if (tp === 'CONTACT_ADDED') {
      deptId = 'suivi';
      let chId = actIdStr.startsWith(`act_contact_${cidStr}_`) ? actIdStr.slice(`act_contact_${cidStr}_`.length) : '';
      key = cidStr && chId ? `contact:${cidStr}:${chId}` : `act:${actIdStr}`;
    } else if (tp === 'ISSUE_ADDED' || tp === 'ISSUE_EDITED' || tp === 'ISSUE_RESOLVED') {
      deptId = 'technique';
      let issId = actIdStr.startsWith(`act_issue_${cidStr}_`) ? actIdStr.slice(`act_issue_${cidStr}_`.length) : '';
      key = tp === 'ISSUE_ADDED' && cidStr && issId ? `issue:${cidStr}:${issId}` : `act:${actIdStr}`;
    } else if (tp === 'REQUIREMENT_ADDED' || tp === 'REQUIREMENT_EDITED') {
      deptId = 'technique';
      let reqId = actIdStr.startsWith(`act_req_${cidStr}_`) ? actIdStr.slice(`act_req_${cidStr}_`.length) : '';
      key = tp === 'REQUIREMENT_ADDED' && cidStr && reqId ? `req:${cidStr}:${reqId}` : `act:${actIdStr}`;
    }

    if (deptId) {
      recordDeptEvent(deptId, key, actMs);
    }
  });

  // 2. Client records & subcollections not yet represented in timeline activities this week
  cl.forEach(c => {
    const cidStr = String(c.id);
    if (isUnconfirmedClientStatus(c.status)) {
      const dt = parseLocalDateMs(c.startDate, c.id);
      recordDeptEvent('pre_vente', `client:${cidStr}`, dt);
    }
    (c.programs || []).forEach(p => {
      const dt = parseLocalDateMs(p.startDate, p.id);
      recordDeptEvent('commercial', `prog:${cidStr}:${p.id || p.programName}`, dt);
    });
    (c.contactHistory || []).forEach(entry => {
      const dt = parseLocalDateMs(entry.date, entry.id);
      recordDeptEvent('suivi', `contact:${cidStr}:${entry.id || entry.date}`, dt);
    });
    (c.issues || []).forEach(i => {
      const dt = parseLocalDateMs(i.date, i.id);
      recordDeptEvent('technique', `issue:${cidStr}:${i.id || i.title}`, dt);
    });
    (c.requirements || []).forEach(r => {
      const dt = parseLocalDateMs(r.date, r.id);
      recordDeptEvent('technique', `req:${cidStr}:${r.id || r.title}`, dt);
    });
  });

  const totalRealWeekActivities = 
    activitiesByDept.pre_vente.count + 
    activitiesByDept.commercial.count + 
    activitiesByDept.suivi.count + 
    activitiesByDept.technique.count;

  // Department descriptive subtexts
  activitiesByDept.pre_vente.subtext = `${unconfirmedClients} ${t('غير مؤكد')} · ${activitiesByDept.pre_vente.staffCount} ${t('موظف')}`;
  activitiesByDept.commercial.subtext = `${totalLicensedDevices} ${t('جهاز مرخص')} · ${totalPrograms} ${t('برنامج')}`;
  const totalCalls = fleet.totalCalls;
  activitiesByDept.suivi.subtext = `${totalCalls} ${t('مكالمة وزيارة')} · ${activitiesByDept.suivi.staffCount} ${t('موظف')}`;
  const unhydratedReqsExtra = cl.reduce((acc, c) => acc + (!c._subcollectionsLoaded && (c.requirements || []).length === 0 ? (Number(c.requirementsCount) || 0) : 0), 0);
  const totalReqsCount = allReqs.length + unhydratedReqsExtra;
  activitiesByDept.technique.subtext = `${totalSolvedIssues} ${t('تذكرة محلولة')} · ${totalReqsCount} ${t('ميزة')}`;

  // Date Header String
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = new Intl.DateTimeFormat(S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ'), dateOptions).format(todayObj);

  return `
    <div class="dashboard-root">
      <!-- Page Header -->
      <div class="phead">
        <div>
          <h1>${t('لوحة القيادة')}</h1>
          <p>${esc(formattedDate)} · ${t('ملخص نشاط العملاء والتراخيص والدعم الفني')}</p>
        </div>
        <div style="flex:1"></div>
        <div class="chips">
          <div class="chip ${period === 1 ? 'on' : ''}" onclick="setDbPeriod(1)">${t('اليوم')}</div>
          <div class="chip ${period === 7 ? 'on' : ''}" onclick="setDbPeriod(7)">${t('7 أيام')}</div>
          <div class="chip ${period === 30 ? 'on' : ''}" onclick="setDbPeriod(30)">${t('30 يومًا')}</div>
          <div class="chip ${period === 90 ? 'on' : ''}" onclick="setDbPeriod(90)">${t('90 يومًا')}</div>
        </div>
        
        <!-- Enhanced Wilaya Selector -->
        <div style="position:relative; display:inline-flex; align-items:center; gap:6px">
          <div style="position:relative">
            <select 
              class="db-btn ${selectedWilaya !== 'all' ? '' : 'ghost'}" 
              onchange="setDbWilaya(this.value)" 
              style="appearance:none; padding-inline-end:32px; font-weight:700; cursor:pointer;"
            >
              <option value="all" ${selectedWilaya === 'all' ? 'selected' : ''}>📍 ${t('كل الولايات')} (${clients.length})</option>
              ${sortedWilayas.map(([w, cnt]) => `
                <option value="${esc(w)}" ${selectedWilaya === w ? 'selected' : ''}>${esc(w)} (${cnt})</option>
              `).join('')}
            </select>
            <div style="position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none; color:${selectedWilaya !== 'all' ? '#fff' : 'var(--muted)'};">
              ${ic('chevl', 14, 2.6)}
            </div>
          </div>
          ${selectedWilaya !== 'all' ? `
            <button class="btn btn-xs btn-outline" onclick="setDbWilaya('all')" style="height:38px;padding:0 10px" title="${t('إلغاء التصفية')}">
              ✕ ${t('الكل')}
            </button>
          ` : ''}
        </div>

        <button class="db-btn" onclick="exportDashboardReport()">
          ${ic('download', 17)} ${t('تصدير التقرير')}
        </button>
      </div>

      <!-- Active Wilaya Filter Notification Banner -->
      ${selectedWilaya !== 'all' ? `
        <div style="background:linear-gradient(90deg, rgba(42,120,214,0.12), rgba(42,120,214,0.04)); border:1px solid #2a78d6; border-radius:10px; padding:10px 16px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between">
          <div style="display:flex; align-items:center; gap:8px">
            <span style="font-size:18px">📍</span>
            <span style="font-size:13px; color:var(--t1)">
              ${t('فلترة نشطة حالياً حسب ولاية:')} <strong>${esc(selectedWilaya)}</strong> (${cl.length} ${t('عميل')}) — ${t('تم تحديث كافة المؤشرات والرسوم البيانية أدناه بناءً على هذه الولاية فقط.')}
            </span>
          </div>
          <button class="btn btn-xs btn-outline" onclick="setDbWilaya('all')" style="border-color:#2a78d6; color:#2a78d6">
            ✕ ${t('إلغاء الفلترة وعرض كل الولايات')}
          </button>
        </div>
      ` : ''}

      <!-- Dashboard Grid -->
      <div class="db-grid">
        <!-- Row A: 6 KPI Cards -->
        ${kpi({
          icon: 'users',
          tint: '#EFF6FF',
          fg: '#2563EB',
          label: t('إجمالي العملاء'),
          value: totalClients,
          sub: `${confirmedClients} ${t('مؤكد')} · ${unconfirmedClients} ${t('غير مؤكد')}`,
          delta: 'up',
          dgood: true,
          dtxt: `+${newClients30d} ${t('هذا الشهر')}`,
          data: clientsSparkline,
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'package',
          tint: '#FFF3E8',
          fg: '#EA580C',
          label: t('الأجهزة المرخصة'),
          value: totalLicensedDevices,
          unit: t('جهازًا'),
          sub: `${t('عبر')} ${totalPrograms} ${t('برنامج مرخص')}`,
          delta: 'up',
          dgood: true,
          dtxt: `+${newDevices30d} ${t('هذا الشهر')}`,
          data: devicesSparkline,
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'lifebuoy',
          tint: '#FFFBEB',
          fg: '#D97706',
          label: t('تذاكر دعم مفتوحة'),
          value: totalOpenIssuesCount,
          sub: `${t('منها')} ${urgentIssues.length} ${t('عاجلة')}`,
          delta: ticketsNet7d > 0 ? 'up' : 'down',
          dgood: ticketsNet7d <= 0,
          dtxt: ticketsNet7d > 0
            ? `+${ticketsNet7d} ${t('هذا الأسبوع')}`
            : (ticketsNet7d < 0
              ? `−${Math.abs(ticketsNet7d)} ${t('هذا الأسبوع')}`
              : (issuesResolved7d > 0 ? `✓ ${issuesResolved7d} ${t('محلولة هذا الأسبوع')}` : `0 ${t('هذا الأسبوع')}`)),
          data: ticketsSparkline,
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'check',
          tint: '#ECFDF5',
          fg: '#059669',
          label: t('معدل حل التذاكر'),
          value: resolutionRatePct,
          unit: '%',
          sub: `${totalSolvedIssues} ${t('محلولة من أصل')} ${totalIssuesCount}`,
          delta: issuesResolved7d > 0 ? 'up' : 'check',
          dgood: resolutionRatePct >= 70 || totalOpenIssuesCount === 0,
          dtxt: issuesResolved7d > 0
            ? `+${issuesResolved7d} ${t('محلولة هذا الأسبوع')}`
            : (slaBreachedOpenCount === 0 ? t('ضمن وقت الاستجابة') : `${slaBreachedOpenCount} ${t('متجاوزة لـ SLA')}`),
          data: resolvedSparkline,
          color: '#10B981'
        })}

        ${kpi({
          icon: 'gauge',
          tint: '#ECFDF5',
          fg: '#059669',
          label: t('متوسط نقاط العملاء'),
          value: avgScore,
          unit: '/ 100',
          sub: `${excellentPct}% ${t('عملاء متميزون')}`,
          delta: avgScore >= 50 ? 'up' : 'down',
          dgood: avgScore >= 50,
          dtxt: `${healthyClientsCount}/${totalClients} ${t('حساب مستقر')}`,
          data: scoreSparkline,
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'phone',
          tint: '#F5F3FF',
          fg: '#7C3AED',
          label: t('تغطية المتابعة'),
          value: contacted30Clients,
          unit: t('عميلًا'),
          sub: `${contactCoveragePct}% ${t('نسبة التغطية')} · ${totalCalls} ${t('تواصل')}`,
          delta: contacts30dCount > 0 ? 'up' : 'check',
          dgood: contactCoveragePct >= 50 || contacts30dCount > 0,
          dtxt: `+${contacts30dCount} ${t('خلال 30 يومًا')}`,
          data: contactsSparkline,
          color: '#7C3AED'
        })}

        <!-- Row B -->
        <!-- B1: Support Trend Line Chart -->
        <div class="card c6">
          <div class="chd">
            <div>
              <h3>${t('حركة الدعم الفني — ')}${period === 1 ? t('اليوم لحظياً') : (period === 7 ? t('آخر 7 أيام') : (period === 30 ? t('آخر 30 يوماً') : t('آخر 90 يوماً')))}</h3>
              <p>${t('تذاكر جديدة مقابل تذاكر محلولة يومياً · تزامن حي ومباشر مع الـ CRM')}</p>
            </div>
            <div class="legend" style="margin-inline-start:auto;padding-top:3px">
              <span><i class="ln" style="background:#2a78d6"></i>${t('جديدة')} (${sumN})</span>
              <span><i class="ln" style="background:#eb6834"></i>${t('محلولة')} (${sumR})</span>
              ${period !== 1 ? `<span><i style="background:var(--border-soft);border:1px solid var(--border)"></i>${t('الجمعة والسبت')}</span>` : ''}
            </div>
          </div>
          ${buildLineChartSVG()}
        </div>

        <!-- B2: Client Status Donut -->
        <div class="card c3">
          <div class="chd">
            <div>
              <h3>${t('حالة العملاء')}</h3>
              <p>${t('حسب حالة الحساب')}</p>
            </div>
          </div>
          <div style="display:flex;justify-content:center;margin:2px 0 8px">
            ${donut([
              { v: confirmedClients, c: '#10B981' },
              { v: unconfirmedClients, c: '#F59E0B' }
            ], 176, 66, 22, `
              <div>
                <div class="num" style="font-family:Inter;font-size:34px;font-weight:800;line-height:1;color:var(--ink)">${totalClients ? Math.round((confirmedClients / totalClients) * 100) : 0}%</div>
                <div style="font-size:12px;color:var(--muted);font-weight:600">${t('مؤكد')} · <span class="num">${totalClients}</span></div>
              </div>
            `)}
          </div>
          <div class="lrow" style="cursor:pointer" onclick="S.filter='مؤكد';setView('list')" title="${t('مؤكد')}">
            <i style="background:#10B981"></i>${t('مؤكد')}
            <span class="n">${confirmedClients}</span>
            <span class="p">${totalClients ? Math.round((confirmedClients / totalClients) * 100) : 0}%</span>
          </div>
          <div class="lrow" style="cursor:pointer" onclick="S.filter='غير مؤكد';setView('list')" title="${t('غير مؤكد')}">
            <i style="background:#F59E0B"></i>${t('غير مؤكد')}
            <span class="n">${unconfirmedClients}</span>
            <span class="p">${totalClients ? Math.round((unconfirmedClients / totalClients) * 100) : 0}%</span>
          </div>
          <div class="lrow" style="cursor:pointer" onclick="S.filter='بدون برامج';setView('list')" title="${t('بدون برامج')}">
            <i style="background:#64748B"></i>${t('بدون برامج')}
            <span class="n">${noProgramsClients}</span>
            <span class="p">${totalClients ? Math.round((noProgramsClients / totalClients) * 100) : 0}%</span>
          </div>
        </div>

        <!-- B3: Devices Sold by Program Category & Platform -->
        <div class="card c3">
          <div class="chd">
            <div>
              <h3>${t('الأجهزة المباعة حسب الفئة')}</h3>
              <p>${totalLicensedDevices} ${t('جهازًا عبر')} ${totalPrograms} ${t('برنامجًا')}</p>
            </div>
            <div class="act" onclick="openLicensesExplorerModal()" title="${t('استعراض كافة التراخيص حسب الفئة والمنصة')}">
              ${t('التفاصيل')} ${ic('chevl', 14, 2.6)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;--rh:42px">
            ${hb('Desktop · Commercial', fleet.categoryDevices.Commercial, Math.max(totalLicensedDevices, 1), '#2563EB', `${fleet.categoryDevices.Commercial} ${t('جهاز')}`, `(${fleet.categoryPrograms.Commercial})`, `onclick="openLicensesExplorerModal('Desktop','all','Commercial')" title="${t('عرض عملاء برنامج Commercial')}"`, 'cat-breakdown-row')}
            ${hb('Desktop · Production', fleet.categoryDevices.Production, Math.max(totalLicensedDevices, 1), '#7C3AED', `${fleet.categoryDevices.Production} ${t('جهاز')}`, `(${fleet.categoryPrograms.Production})`, `onclick="openLicensesExplorerModal('Desktop','all','Production')" title="${t('عرض عملاء برنامج Production')}"`, 'cat-breakdown-row')}
            ${hb('Desktop · Distribution', fleet.categoryDevices.Distribution, Math.max(totalLicensedDevices, 1), '#F97316', `${fleet.categoryDevices.Distribution} ${t('جهاز')}`, `(${fleet.categoryPrograms.Distribution})`, `onclick="openLicensesExplorerModal('Desktop','all','Distribution')" title="${t('عرض عملاء برنامج Distribution')}"`, 'cat-breakdown-row')}
            ${hb('Mobile', fleet.categoryDevices.Mobile, Math.max(totalLicensedDevices, 1), '#10B981', `${fleet.categoryDevices.Mobile} ${t('جهاز')}`, `(${fleet.categoryPrograms.Mobile})`, `onclick="openLicensesExplorerModal('Mobile','all','all')" title="${t('عرض عملاء تطبيقات Mobile')}"`, 'cat-breakdown-row')}
            ${hb('Web', fleet.categoryDevices.Web, Math.max(totalLicensedDevices, 1), '#0EA5E9', `${fleet.categoryDevices.Web} ${t('جهاز')}`, `(${fleet.categoryPrograms.Web})`, `onclick="openLicensesExplorerModal('Web','all','all')" title="${t('عرض عملاء منظومة Web')}"`, 'cat-breakdown-row')}
          </div>
          <div class="hr"></div>
          <div style="font-size:11.5px;color:var(--t2);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
            <span>📱 Tableau de bord: <strong class="num">${fleet.mobileSubApps.dashboard}</strong></span>
            <span>VDD: <strong class="num">${fleet.mobileSubApps.vdd}</strong></span>
            <span>Commerçant: <strong class="num">${fleet.mobileSubApps.commercant}</strong></span>
          </div>
        </div>

        <!-- Row C -->
        <!-- C1: Wilayas Distribution & Geographic Report Link -->
        <div class="card c4">
          <div class="chd">
            <div>
              <h3>${t('توزيع العملاء حسب الولاية')}</h3>
              <p>${t('أعلى 8 ولايات من أصل')} ${sortedWilayas.length}</p>
            </div>
            <div class="act" onclick="openGeoReportModal()" title="${t('فتح التقرير الجغرافي التفاعلي الكامل لكافة الولايات')}">
              ${t('التقرير الجغرافي')} ${ic('chevl', 14, 2.6)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;--rh:41px">
            ${topWilayas.length ? topWilayas.map(([w, cnt]) => `
              <div style="cursor:pointer" onclick="setDbWilaya('${esc(w)}')">
                ${hb(w, cnt, maxWilayaVal, '#2a78d6')}
              </div>
            `).join('') : `
              <div style="padding:1rem;color:var(--muted);text-align:center">${t('لا توجد بيانات ولايات')}</div>
            `}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <div style="font-size:12px;color:var(--muted)">
              + ${otherWilayasCount} ${t('ولاية أخرى تضم')} <b class="num" style="color:var(--ink2)">${otherWilayasClientsSum}</b> ${t('عميلًا')}
            </div>
            <button class="btn btn-xs btn-outline" onclick="openGeoReportModal()">
              📍 ${t('استعراض كل الولايات')}
            </button>
          </div>
        </div>

        <!-- C2: Licenses & Devices by Platform -->
        <div class="card c4">
          <div class="chd">
            <div>
              <h3>${t('مقارنة منصات التشغيل')}</h3>
              <p>${totalLicensedDevices} ${t('جهاز مُرخّص')} · ${totalPrograms} ${t('برنامج')}</p>
            </div>
            <div class="act" onclick="openLicensesExplorerModal()" title="${t('استعراض كافة تفاصيل التراخيص والعملاء')}">
              ${t('التفاصيل')} ${ic('chevl', 14, 2.6)}
            </div>
          </div>

          <!-- 3 Platform Quick Filters (Device Counts) -->
          <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap">
            <button class="btn btn-xs" onclick="openLicensesExplorerModal('Desktop')" style="flex:1; min-width:80px; background:rgba(0,122,255,0.1); color:#007AFF; border:1px solid rgba(0,122,255,0.25); font-weight:700; border-radius:10px; padding:4px 8px; font-size:11.5px;" title="${t('عرض تفاصيل تراخيص')} Desktop">
              💻 Desktop (${fleet.platformDevices.Desktop} ${t('جهاز')})
            </button>
            <button class="btn btn-xs" onclick="openLicensesExplorerModal('Mobile')" style="flex:1; min-width:80px; background:rgba(52,199,89,0.1); color:#34C759; border:1px solid rgba(52,199,89,0.25); font-weight:700; border-radius:10px; padding:4px 8px; font-size:11.5px;" title="${t('عرض تفاصيل تراخيص')} Mobile">
              📱 Mobile (${fleet.platformDevices.Mobile} ${t('جهاز')})
            </button>
            <button class="btn btn-xs" onclick="openLicensesExplorerModal('Web')" style="flex:1; min-width:80px; background:rgba(255,149,0,0.1); color:#FF9500; border:1px solid rgba(255,149,0,0.25); font-weight:700; border-radius:10px; padding:4px 8px; font-size:11.5px;" title="${t('عرض تفاصيل تراخيص')} Web">
              🌐 Web (${fleet.platformDevices.Web} ${t('جهاز')})
            </button>
          </div>

          <div style="padding-top:4px">
            ${colChart(platformRows)}
          </div>
          <div class="hr" style="margin:12px 0 10px"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span class="sec" style="margin:0">${t('توزيع الإصدارات المعتمدة')} (${versionMetrics.totalVersionedDevices} ${t('جهاز')})</span>
            <span style="font-size:11px;color:#007AFF;cursor:pointer;font-weight:700" onclick="openLicensesExplorerModal()">${t('استعراض الكل')} ↗</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;--rh:36px">
            ${versionMetrics.byVersion.length > 0 ? versionMetrics.byVersion.slice(0, 5).map(v => `
              ${hb(
                v.version,
                v.devicesCount,
                Math.max(versionMetrics.totalVersionedDevices, 1),
                '#0EA5E9',
                `${v.devicesCount} ${t('جهاز')}`,
                `(${v.programsCount})`,
                `onclick="openLicensesExplorerModal('all','${v.version === 'غير محدد' ? 'all' : esc(v.version)}')" title="${t('عرض التراخيص على الإصدار')} ${esc(v.version)}"`,
                'cat-breakdown-row'
              )}
            `).join('') : `
              <div style="font-size:12px;color:var(--muted);padding:6px 0">${t('لا توجد إصدارات مسجلة بعد')}</div>
            `}
          </div>
        </div>

        <!-- C3: Tickets and Feature Requests Pipeline with Navigation -->
        <div class="card c4">
          <div class="chd">
            <div>
              <h3>${t('التذاكر وطلبات الميزات')}</h3>
              <p>${t('الدعم الفني ومسار التطوير')}</p>
            </div>
            <div class="act" onclick="openTicketsAndReqsModal('issues', 'all')" title="${t('استعراض كافة التذاكر والطلبات')}">
              ${t('استعراض الكل')} ${ic('chevl', 14, 2.6)}
            </div>
          </div>
          
          <!-- Tickets rows with click to filter -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div class="sec" style="margin:0">${t('التذاكر المفتوحة حسب الأولوية')} (${totalOpenIssuesCount})</div>
            <span style="font-size:11px;color:#2a78d6;cursor:pointer;font-weight:700" onclick="openTicketsAndReqsModal('issues', 'all')">${t('عرض الكل')} ↗</span>
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('issues', 'عاجل')" title="${t('عرض التذاكر العاجلة')}">
            ${hb(t('عاجل'), issuesByPriority['عاجل'], Math.max(totalOpenIssuesCount, 1), '#EF4444')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('issues', 'عالية')" title="${t('عرض التذاكر عالية الأولوية')}">
            ${hb(t('عالية'), issuesByPriority['عالية'], Math.max(totalOpenIssuesCount, 1), '#F97316')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('issues', 'متوسطة')" title="${t('عرض التذاكر متوسطة الأولوية')}">
            ${hb(t('متوسطة'), issuesByPriority['متوسطة'], Math.max(totalOpenIssuesCount, 1), '#F59E0B')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('issues', 'منخفضة')" title="${t('عرض التذاكر منخفضة الأولوية')}">
            ${hb(t('منخفضة'), issuesByPriority['منخفضة'], Math.max(totalOpenIssuesCount, 1), '#94A3B8')}
          </div>

          <div class="hr"></div>
          
          <!-- Features rows with click to filter -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div class="sec" style="margin:0">${t('مسار طلبات الميزات')} (${allReqs.length} ${t('طلبًا')})</div>
            <span style="font-size:11px;color:#2a78d6;cursor:pointer;font-weight:700" onclick="openTicketsAndReqsModal('reqs', 'all')">عرض الكل ↗</span>
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('reqs', 'مقترح')" title="${t('عرض الميزات المقترحة')}">
            ${hb(t('مقترح'), reqsByStatus['مقترح'], Math.max(allReqs.length, 1), '#86b6ef')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('reqs', 'قيد الدراسة')" title="${t('عرض الميزات قيد الدراسة')}">
            ${hb(t('قيد الدراسة'), reqsByStatus['قيد الدراسة'], Math.max(allReqs.length, 1), '#5598e7')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('reqs', 'مخطط')" title="${t('عرض الميزات المخططة')}">
            ${hb(t('مخطط'), reqsByStatus['مخطط'], Math.max(allReqs.length, 1), '#2a78d6')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('reqs', 'منفذ')" title="${t('عرض الميزات المنفذة')}">
            ${hb(t('منفذ'), reqsByStatus['منفذ'], Math.max(allReqs.length, 1), '#184f95')}
          </div>
        </div>

        <!-- Row D -->
        <!-- D1: Urgent Actionable Alerts (Clear Explanation & Instant Action) -->
        <div class="card c4">
          <div class="chd">
            <div>
              <h3>${t('تنبيهات عاجلة')}</h3>
              <p>${t('تتطلب تدخلاً فورياً (تذاكر عاجلة · تجاوز SLA · انقطاع تواصل)')}</p>
            </div>
            <span class="pill r" style="margin-inline-start:auto">${urgentAlerts.length} ${t('عاجلة')}</span>
          </div>
          ${alertDisplayList.length ? alertDisplayList.map(a => `
            <div class="item" onclick="selClient(${a.cid})" title="${t('اضغط للانتقال مباشرة لملف العميل المعني')}">
              <div class="ico ${a.level === 'urgent' ? 'r' : 'w'}">${ic(a.type === 'NO_CONTACT' ? 'phone' : 'warn', 19)}</div>
              <div class="tx">
                <b>${esc(a.msg)}</b>
                <span>${esc(a.sub || '')}</span>
              </div>
              <div class="end">
                <span class="pill ${a.level === 'urgent' ? 'r' : 'w'}">${a.level === 'urgent' ? t('عاجل') : t('تنبيه')}</span>
              </div>
            </div>
          `).join('') : `
            <div style="padding:2rem 1rem;text-align:center;color:var(--muted)">
              <div style="font-size:24px;margin-bottom:6px">🎉</div>
              <div>${t('لا توجد تنبيهات عاجلة حالياً، كافة الحسابات والأنظمة مستقرة!')}</div>
            </div>
          `}
        </div>

        <!-- D2: Top Active Clients & Licenses -->
        <div class="card c4">
          <div class="chd">
            <div>
              <h3>${t('أبرز العملاء وتراخيصهم')}</h3>
              <p>${t('الأكثر أجهزة ونشاطاً وتفاعلاً')}</p>
            </div>
            <div 
              class="act" 
              onclick="S.filter='مؤكد'; S.sortBy='score'; S.sortOrder='desc'; setView('list');" 
              title="${t('عرض كافة العملاء المؤكدين في القائمة')}"
            >
              ${t('عرض الكل')} ${ic('chevl', 14, 2.6)}
            </div>
          </div>
          ${topClientsList.slice(0, 5).map(item => `
            <div class="item" onclick="selClient(${item.client.id})" title="${t('فتح ملف')} ${esc(item.client.fullName)}">
              ${ringScore(item.score, item.score >= 75 ? '#10B981' : (item.score >= 50 ? '#2563EB' : '#F59E0B'))}
              <div class="tx">
                <b>${esc(item.client.fullName)}</b>
                <span>${esc(item.client.wilaya || '—')} · ${item.programsCount} ${t('برامج')} · ${item.lastContact ? `${t('آخر تواصل:')} ${esc(item.lastContact)}` : t('بدون تواصل مسجل')}</span>
              </div>
              <div class="end">
                <span class="num" style="font-size:12px;font-weight:700;color:var(--sys-blue)">${item.devicesCount} ${t('جهاز')}</span>
              </div>
            </div>
          `).join('') || `
            <div style="padding:2rem 1rem;text-align:center;color:var(--muted)">
              <div style="font-size:24px;margin-bottom:6px">📦</div>
              <div>${t('سيظهر أبرز العملاء بمجرد تسجيل البرامج والتراخيص')}</div>
            </div>
          `}
        </div>

        <!-- D3: Recent Activities from Timeline -->
        <div class="card c4">
          <div class="chd">
            <div>
              <h3>${t('آخر الأنشطة')}</h3>
              <p>${t('من المخطط الزمني العام · لحظي')}</p>
            </div>
            <div class="act" onclick="setView('global-timeline')">
              ${t('كل الأنشطة')} ${ic('chevl', 14, 2.6)}
            </div>
          </div>
          ${recentActivities.length ? recentActivities.map(act => {
            const actor = act.actor || 'النظام';
            const initials = actor.trim().slice(0, 2);
            const clickAction = act.hasLinkedClient ? `selClient(${Number(act.clientId)})` : `setView('global-timeline')`;

            return `
              <div class="item" onclick="${clickAction}">
                <div class="av" style="background:${act.badgeBg};color:${act.badgeColor}">${esc(initials)}</div>
                <div class="tx">
                  <b>${esc(actor)} <span class="tag" style="background:${act.badgeBg};color:${act.badgeColor}">${t(act.badgeTag)}</span></b>
                  <span>${esc(act.title || act.description || '')}</span>
                </div>
                <div class="end" style="font-size:11.5px;color:var(--muted)">
                  ${formatRelativeTime(act.timestamp)}
                </div>
              </div>
            `;
          }).join('') : `
            <div style="padding:2rem 1rem;text-align:center;color:var(--muted)">
              <div style="font-size:24px;margin-bottom:6px">⏱️</div>
              <div>${t('سيظهر نشاط فريق العمل هنا لحظياً')}</div>
            </div>
          `}
        </div>

        <!-- Row E: Departments Activity (This Week) — 100% Real Live Synchronization -->
        <div class="c12" style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:4px;flex-wrap:wrap">
          <div>
            <h3 style="font-size:17px;font-weight:700">${t('نشاط الأقسام — هذا الأسبوع')}</h3>
            <span style="font-size:12.5px;color:var(--muted)">${totalRealWeekActivities} ${t('نشاطًا مسجلًا فعلياً · الأحد إلى السبت')}</span>
          </div>
          ${isGerant() ? `
            <button class="btn btn-xs btn-outline" onclick="toggleStaffManagerModal(true)">
              👑 ${t('إدارة موظفي الأقسام والصلاحيات')}
            </button>
          ` : ''}
        </div>

        <!-- Dept 1: Pre-vente -->
        <div class="card dept c3" onclick="toggleStaffManagerModal(true)">
          <div class="h">
            <div class="${activitiesByDept.pre_vente.colorClass}" style="width:32px;height:32px">${ic(activitiesByDept.pre_vente.icon, 17)}</div>
            ${t('قسم ما قبل البيع')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <div class="big">${activitiesByDept.pre_vente.count}<small>${t('نشاطًا')}</small></div>
              <div class="m" style="margin-top:6px">${activitiesByDept.pre_vente.subtext}</div>
            </div>
            ${miniCols(activitiesByDept.pre_vente.vals, '#2563EB')}
          </div>
        </div>

        <!-- Dept 2: Commercial -->
        <div class="card dept c3" onclick="toggleStaffManagerModal(true)">
          <div class="h">
            <div class="${activitiesByDept.commercial.colorClass}" style="width:32px;height:32px">${ic(activitiesByDept.commercial.icon, 17)}</div>
            ${t('القسم التجاري')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <div class="big">${activitiesByDept.commercial.count}<small>${t('نشاطًا')}</small></div>
              <div class="m" style="margin-top:6px">${activitiesByDept.commercial.subtext}</div>
            </div>
            ${miniCols(activitiesByDept.commercial.vals, '#059669')}
          </div>
        </div>

        <!-- Dept 3: Suivi -->
        <div class="card dept c3" onclick="toggleStaffManagerModal(true)">
          <div class="h">
            <div class="${activitiesByDept.suivi.colorClass}" style="width:32px;height:32px">${ic(activitiesByDept.suivi.icon, 17)}</div>
            ${t('قسم المتابعة')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <div class="big">${activitiesByDept.suivi.count}<small>${t('نشاطًا')}</small></div>
              <div class="m" style="margin-top:6px">${activitiesByDept.suivi.subtext}</div>
            </div>
            ${miniCols(activitiesByDept.suivi.vals, '#D97706')}
          </div>
        </div>

        <!-- Dept 4: Technique -->
        <div class="card dept c3" onclick="toggleStaffManagerModal(true)">
          <div class="h">
            <div class="${activitiesByDept.technique.colorClass}" style="width:32px;height:32px">${ic(activitiesByDept.technique.icon, 17)}</div>
            ${t('القسم التقني')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <div class="big">${activitiesByDept.technique.count}<small>${t('نشاطًا')}</small></div>
              <div class="m" style="margin-top:6px">${activitiesByDept.technique.subtext}</div>
            </div>
            ${miniCols(activitiesByDept.technique.vals, '#7C3AED')}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <span>PROGILIC CRM v3 · ${t('مزامنة سحابية لحظية عبر كل المستخدمين والأجهزة')}</span>
        <span>${t('تحديث فوري وتفاعلي متزامن مع كل عملية')}</span>
      </div>
    </div>
  `;
}
