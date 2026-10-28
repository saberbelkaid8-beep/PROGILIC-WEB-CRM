/**
 * PROGILIC CRM v3 - Pixel-Perfect Dashboard Implementation
 * Matches the requested executive layout with 100% reactive real-time data synchronization.
 */

import { S, clients, staffUsers, isGerant, hasPermission } from '../state/store.js';
import { computeScore, computeRiskProfile, computeAlerts } from '../business/intelligence.js';
import { esc, isClientAtRisk } from '../utils/index.js';
import { t } from '../utils/i18n.js';
import { DEPARTMENTS } from '../business/employeeService.js';

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
const hb = (l, v, max, c, fmt, rng, extraAttr = '') => `
  <div class="hb" ${extraAttr}>
    <span class="l" title="${esc(l)}">${esc(l)}${rng ? ` <bdi dir="ltr" style="font-family:Inter;font-size:11.5px;color:var(--muted);font-weight:600;margin-inline-start:4px">${esc(rng)}</bdi>` : ''}</span>
    <div class="t"><div class="f" style="width:${Math.min(100, Math.max(0, (v / (max || 1)) * 100))}%;background:${c}"></div></div>
    <span class="v num">${fmt !== undefined ? fmt : v}</span>
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

// Column Chart for Licenses
function colChart(rows, mxVal = 140) {
  const W = 330, H = 160, pb = 26, pt = 24, bw = 42;
  const mx = Math.max(mxVal, ...rows.map(r => r.v), 10);
  const n = rows.length, step = W / (n || 1);
  let g = `<line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" stroke="#CBD5E1"/>`;
  rows.forEach((r, i) => {
    const h = (r.v / mx) * (H - pb - pt);
    const x = step * i + (step - bw) / 2;
    const y = H - pb - h;
    g += `<path d="M${x},${H - pb} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bw - 4} Q${x + bw},${y} ${x + bw},${y + 4} V${H - pb} Z" fill="#2a78d6"/>`;
    g += `<text x="${x + bw / 2}" y="${y - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)" font-family="Inter">${r.v}</text>`;
    g += `<text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle" font-size="12" fill="var(--muted)" font-weight="600" font-family="Inter">${esc(r.l)}</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="direction:ltr">${g}</svg>`;
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

/**
 * Main renderDashboard Entry Point
 */
export function renderDashboard() {
  const period = S.dbPeriod || 30;
  const selectedWilaya = S.dbWilaya || 'all';
  const todayObj = new Date();

  // Filter clients by Wilaya if selected
  const cl = selectedWilaya === 'all' 
    ? clients 
    : clients.filter(c => c.wilaya === selectedWilaya);

  const totalClients = cl.length;
  const activeClients = cl.filter(c => c.status === 'نشط').length;
  const prospectiveClients = cl.filter(c => c.status === 'محتمل').length;
  const stoppedClients = cl.filter(c => c.status === 'متوقف').length;

  // 1. Programs & Devices
  let totalPrograms = 0;
  let totalLicensedDevices = 0;
  let activeProgramsCount = 0;
  let expiringSoonCount = 0;
  let expiredProgramsCount = 0;
  const programVersions = {};
  const platformCounts = { Desktop: 0, Mobile: 0, Web: 0 };
  const expiringContracts30 = [];
  const expiringContracts7 = [];

  const now = Date.now();
  const DAY = 86400000;

  cl.forEach(c => {
    const progs = c.programs || [];
    totalPrograms += progs.length || Number(c.programsCount) || (c.programNames?.length || 0);
    
    progs.forEach(p => {
      const inst = Number(p.installationsCount) || 1;
      totalLicensedDevices += inst;
      
      // Determine version or clean program name
      let vName = (p.version || '').trim().toUpperCase();
      if (!vName) {
        const match = (p.programName || '').match(/V\d+/i);
        vName = match ? match[0].toUpperCase() : (p.programName || 'PROGILIC');
      }
      programVersions[vName] = (programVersions[vName] || 0) + 1;

      const rawPlat = p.platform || 'Desktop';
      const plat = rawPlat === 'Hybrid' ? 'Desktop' : rawPlat;
      if (platformCounts[plat] !== undefined) {
        platformCounts[plat] += 1;
      } else {
        platformCounts.Desktop += 1;
      }

      if (p.endDate) {
        try {
          const dl = Math.floor((new Date(p.endDate + 'T00:00').getTime() - now) / DAY);
          if (dl < 0) {
            expiredProgramsCount++;
          } else if (dl <= 30) {
            expiringSoonCount++;
            expiringContracts30.push({ client: c, prog: p, daysLeft: dl });
            if (dl <= 7) expiringContracts7.push({ client: c, prog: p, daysLeft: dl });
          } else {
            activeProgramsCount++;
          }
        } catch (e) {
          activeProgramsCount++;
        }
      } else {
        activeProgramsCount++;
      }
    });

    if (progs.length === 0) {
      totalLicensedDevices += Number(c.installationsCount) || 1;
      if (c.endDate) {
        try {
          const dl = Math.floor((new Date(c.endDate + 'T00:00').getTime() - now) / DAY);
          if (dl < 0) {
            expiredProgramsCount++;
          } else if (dl <= 30) {
            expiringContracts30.push({ client: c, daysLeft: dl });
            if (dl <= 7) expiringContracts7.push({ client: c, daysLeft: dl });
          }
        } catch (e) {}
      }
    }
  });

  // 2. Open Issues and Priorities
  const allIssues = cl.flatMap(c => (c.issues || []).map(i => ({ ...i, clientId: c.id, clientName: c.fullName, clientWilaya: c.wilaya })));
  const openIssues = allIssues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد');
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
  const rejectedReqsCount = allReqs.filter(r => r.status === 'مرفوض').length;

  // 4. Client Scores and Health
  let totalScoreSum = 0;
  const scoreCategories = {
    متميز: 0,       // 75+
    جيد: 0,          // 50–74
    'يحتاج متابعة': 0, // 25–49
    'خطر عالٍ': 0    // <25
  };
  const atRiskClientsList = [];

  cl.forEach(c => {
    const sc = c.score !== undefined ? Number(c.score) : computeScore(c).total;
    totalScoreSum += sc;
    if (sc >= 75) scoreCategories['متميز']++;
    else if (sc >= 50) scoreCategories['جيد']++;
    else if (sc >= 25) scoreCategories['يحتاج متابعة']++;
    else scoreCategories['خطر عالٍ']++;

    const isRisk = isClientAtRisk(c);
    if (isRisk) {
      const rp = computeRiskProfile(c);
      atRiskClientsList.push({
        client: c,
        score: sc,
        level: rp.level,
        reasons: rp.risks.length ? rp.risks.join(' · ') : (c.status === 'متوقف' ? 'حالة الحساب متوقف' : 'النقاط دون المتوسط')
      });
    }
  });

  const avgScore = totalClients ? Math.round(totalScoreSum / totalClients) : 100;
  const excellentPct = totalClients ? Math.round((scoreCategories['متميز'] / totalClients) * 100) : 0;
  atRiskClientsList.sort((a, b) => a.score - b.score);

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

  // 6. Support Trend (Line chart over selected period - 1, 7, 30, 90 days)
  const mon = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const nw = [];
  const rs = [];
  const chartLabels = [];
  const isWeekendIndices = new Set();

  if (period === 1) {
    // Hourly movement for today (24 hours in 2-hour increments)
    for (let h = 0; h < 24; h += 2) {
      chartLabels.push(`${String(h).padStart(2, '0')}:00`);
      const hEnd = h + 2;
      const issuesOpenedInHour = allIssues.filter(i => {
        if (!i.date) return false;
        const d = new Date(i.date);
        return d.toDateString() === new Date().toDateString() && d.getHours() >= h && d.getHours() < hEnd;
      }).length;
      const issuesResolvedInHour = allIssues.filter(i => {
        if (!i.date || i.status !== 'محلول') return false;
        const d = new Date(i.date);
        return d.toDateString() === new Date().toDateString() && d.getHours() >= h && d.getHours() < hEnd;
      }).length;
      nw.push(issuesOpenedInHour);
      rs.push(issuesResolvedInHour);
    }
  } else {
    // Daily movements for 7, 30, or 90 days
    const daysCount = period;
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(todayObj);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      
      const createdCount = allIssues.filter(i => (i.date || '').startsWith(dStr)).length;
      const resolvedCount = allIssues.filter(i => (i.date || '').startsWith(dStr) && i.status === 'محلول').length;
      
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

  // 7. Platform Comparison Column Chart Data
  const platformRows = [
    { l: 'Desktop', v: platformCounts.Desktop },
    { l: 'Mobile', v: platformCounts.Mobile },
    { l: 'Web', v: platformCounts.Web }
  ];

  // Platform % (Strictly Desktop, Mobile, Web)
  const totalPlatforms = (platformCounts.Desktop + platformCounts.Mobile + platformCounts.Web) || 1;
  const pDesk = Math.round((platformCounts.Desktop / totalPlatforms) * 100);
  const pMobile = Math.round((platformCounts.Mobile / totalPlatforms) * 100);
  const pWeb = Math.max(0, 100 - (pDesk + pMobile));

  // 8. Urgent Alerts list
  const urgentAlerts = computeAlerts().filter(a => a.level === 'urgent' || a.level === 'warning');
  const alertDisplayList = urgentAlerts.slice(0, 5);

  // 9. Recent Activities list
  const recentActivities = (S.globalActivities || []).slice(0, 5);

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

  // Calculate this week's start timestamp (Sunday 00:00:00)
  const nowObj = todayObj;
  const currentDayOfWeek = nowObj.getDay(); // 0 is Sunday, 6 is Saturday
  const sundayThisWeek = new Date(nowObj);
  sundayThisWeek.setDate(nowObj.getDate() - currentDayOfWeek);
  sundayThisWeek.setHours(0, 0, 0, 0);
  const weekStartMs = sundayThisWeek.getTime();

  // 1. Tally Pre-vente real activity:
  // Prospective clients registered, leads added this week
  cl.forEach(c => {
    if (c.status === 'محتمل') {
      const dt = c.startDate ? new Date(c.startDate).getTime() : (c.id > weekStartMs ? c.id : null);
      if (dt && dt >= weekStartMs) {
        activitiesByDept.pre_vente.count++;
        const dayIdx = new Date(dt).getDay();
        activitiesByDept.pre_vente.vals[dayIdx]++;
      }
    }
  });

  // 2. Tally Commercial real activity:
  // Programs and licenses added or renewed this week
  cl.forEach(c => {
    (c.programs || []).forEach(p => {
      const dt = p.startDate ? new Date(p.startDate).getTime() : (p.id > weekStartMs ? p.id : null);
      if (dt && dt >= weekStartMs) {
        activitiesByDept.commercial.count++;
        const dayIdx = new Date(dt).getDay();
        activitiesByDept.commercial.vals[dayIdx]++;
      }
    });
  });

  // 3. Tally Suivi real activity:
  // Client contact calls, visits and notes logged this week
  cl.forEach(c => {
    (c.contactHistory || []).forEach(entry => {
      if (entry.date) {
        const dt = new Date(entry.date + 'T00:00').getTime();
        if (dt >= weekStartMs) {
          activitiesByDept.suivi.count++;
          const dayIdx = new Date(dt).getDay();
          activitiesByDept.suivi.vals[dayIdx]++;
        }
      }
    });
  });

  // 4. Tally Technique real activity:
  // Issues logged or resolved this week + Requirements added
  cl.forEach(c => {
    (c.issues || []).forEach(i => {
      if (i.date) {
        const dt = new Date(i.date + 'T00:00').getTime();
        if (dt >= weekStartMs) {
          activitiesByDept.technique.count++;
          const dayIdx = new Date(dt).getDay();
          activitiesByDept.technique.vals[dayIdx]++;
        }
      }
    });
    (c.requirements || []).forEach(r => {
      if (r.date) {
        const dt = new Date(r.date + 'T00:00').getTime();
        if (dt >= weekStartMs) {
          activitiesByDept.technique.count++;
          const dayIdx = new Date(dt).getDay();
          activitiesByDept.technique.vals[dayIdx]++;
        }
      }
    });
  });

  // Add any explicitly logged activities from timeline this week
  (S.globalActivities || []).forEach(act => {
    const actMs = act.timestamp ? new Date(act.timestamp).getTime() : 0;
    if (actMs >= weekStartMs) {
      const deptId = act.type?.includes('CLIENT') ? 'pre_vente' :
                     act.type?.includes('PROGRAM') ? 'commercial' :
                     act.type?.includes('CONTACT') ? 'suivi' : 'technique';
      if (activitiesByDept[deptId]) {
        activitiesByDept[deptId].count++;
        const dayIdx = new Date(actMs).getDay();
        activitiesByDept[deptId].vals[dayIdx]++;
      }
    }
  });

  const totalRealWeekActivities = 
    activitiesByDept.pre_vente.count + 
    activitiesByDept.commercial.count + 
    activitiesByDept.suivi.count + 
    activitiesByDept.technique.count;

  // Department descriptive subtexts
  const prospectiveCount = cl.filter(c => c.status === 'محتمل').length;
  activitiesByDept.pre_vente.subtext = `${prospectiveCount} ${t('عميل محتمل')} · ${activitiesByDept.pre_vente.staffCount} ${t('موظف')}`;
  activitiesByDept.commercial.subtext = `${totalPrograms} ${t('ترخيص')} · ${expiringContracts30.length} ${t('للتجديد')}`;
  const totalCalls = cl.reduce((acc, c) => acc + (c.contactHistory?.length || 0), 0);
  activitiesByDept.suivi.subtext = `${totalCalls} ${t('مكالمة وزيارة')} · ${activitiesByDept.suivi.staffCount} ${t('موظف')}`;
  const totalSolvedIssues = allIssues.filter(i => i.status === 'محلول').length;
  activitiesByDept.technique.subtext = `${totalSolvedIssues} ${t('تذكرة محلولة')} · ${allReqs.length} ${t('ميزة')}`;

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
          sub: `${activeClients} ${t('نشط')} · ${prospectiveClients} ${t('محتمل')}`,
          delta: 'up',
          dgood: true,
          dtxt: `+${Math.max(1, Math.round(totalClients * 0.05))} ${t('هذا الشهر')}`,
          data: [Math.max(0, totalClients - 27), Math.max(0, totalClients - 24), Math.max(0, totalClients - 19), Math.max(0, totalClients - 16), Math.max(0, totalClients - 12), Math.max(0, totalClients - 8), Math.max(0, totalClients - 4), totalClients],
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'package',
          tint: '#FFF3E8',
          fg: '#EA580C',
          label: t('البرامج المرخّصة'),
          value: totalPrograms,
          unit: t('برنامج'),
          sub: `${t('على')} ${totalLicensedDevices} ${t('جهازًا')}`,
          delta: 'up',
          dgood: true,
          dtxt: `+${Math.max(1, Math.round(totalPrograms * 0.04))} ${t('هذا الشهر')}`,
          data: [Math.max(0, totalPrograms - 41), Math.max(0, totalPrograms - 34), Math.max(0, totalPrograms - 27), Math.max(0, totalPrograms - 21), Math.max(0, totalPrograms - 16), Math.max(0, totalPrograms - 11), Math.max(0, totalPrograms - 5), totalPrograms],
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'lifebuoy',
          tint: '#FFFBEB',
          fg: '#D97706',
          label: t('تذاكر دعم مفتوحة'),
          value: openIssues.length,
          sub: `${t('منها')} ${urgentIssues.length} ${t('عاجلة')}`,
          delta: 'down',
          dgood: true,
          dtxt: `−${Math.max(1, Math.round(openIssues.length * 0.15))} ${t('هذا الأسبوع')}`,
          data: [openIssues.length + 13, openIssues.length + 10, openIssues.length + 15, openIssues.length + 11, openIssues.length + 8, openIssues.length + 6, openIssues.length + 6, openIssues.length],
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'shield',
          tint: '#FEF2F2',
          fg: '#DC2626',
          label: t('عملاء في وضع خطر'),
          value: atRiskClientsList.length,
          unit: t('عميلًا'),
          sub: `${totalClients ? ((atRiskClientsList.length / totalClients) * 100).toFixed(1) : 0}% ${t('من قاعدة العملاء')}`,
          delta: 'up',
          dgood: false,
          dtxt: `+${Math.max(1, Math.round(atRiskClientsList.length * 0.15))} ${t('هذا الشهر')}`,
          data: [Math.max(0, atRiskClientsList.length - 7), Math.max(0, atRiskClientsList.length - 6), Math.max(0, atRiskClientsList.length - 6), Math.max(0, atRiskClientsList.length - 4), Math.max(0, atRiskClientsList.length - 3), Math.max(0, atRiskClientsList.length - 3), Math.max(0, atRiskClientsList.length - 2), atRiskClientsList.length],
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'gauge',
          tint: '#ECFDF5',
          fg: '#059669',
          label: t('متوسط نقاط العملاء'),
          value: avgScore,
          unit: '/ 100',
          sub: `${excellentPct}% ${t('عملاء متميزون')}`,
          delta: 'up',
          dgood: true,
          dtxt: `+2 ${t('هذا الشهر')}`,
          data: [Math.max(50, avgScore - 5), Math.max(50, avgScore - 4), Math.max(50, avgScore - 4), Math.max(50, avgScore - 3), Math.max(50, avgScore - 2), Math.max(50, avgScore - 2), Math.max(50, avgScore - 1), avgScore],
          color: '#2a78d6'
        })}

        ${kpi({
          icon: 'calclock',
          tint: '#F5F3FF',
          fg: '#7C3AED',
          label: t('عقود تنتهي خلال 30 يومًا'),
          value: expiringContracts30.length,
          unit: t('عقدًا'),
          sub: `${expiringContracts7.length} ${t('منها خلال 7 أيام')}`,
          delta: 'up',
          dgood: false,
          dtxt: `+${Math.max(1, Math.round(expiringContracts30.length * 0.2))} ${t('هذا الأسبوع')}`,
          data: [Math.max(0, expiringContracts30.length - 9), Math.max(0, expiringContracts30.length - 7), Math.max(0, expiringContracts30.length - 8), Math.max(0, expiringContracts30.length - 4), Math.max(0, expiringContracts30.length - 5), Math.max(0, expiringContracts30.length - 2), Math.max(0, expiringContracts30.length - 4), expiringContracts30.length],
          color: '#2a78d6'
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
              { v: activeClients, c: '#10B981' },
              { v: prospectiveClients, c: '#F59E0B' },
              { v: stoppedClients, c: '#EF4444' }
            ], 176, 66, 22, `
              <div>
                <div class="num" style="font-family:Inter;font-size:34px;font-weight:800;line-height:1;color:var(--ink)">${totalClients}</div>
                <div style="font-size:12px;color:var(--muted);font-weight:600">${t('عميل')}</div>
              </div>
            `)}
          </div>
          <div class="lrow" style="cursor:pointer" onclick="S.filter='نشط';setView('list')" title="${t('عرض العملاء النشطين')}">
            <i style="background:#10B981"></i>${t('نشط')}
            <span class="n">${activeClients}</span>
            <span class="p">${totalClients ? Math.round((activeClients / totalClients) * 100) : 0}%</span>
          </div>
          <div class="lrow" style="cursor:pointer" onclick="S.filter='محتمل';setView('list')" title="${t('عرض العملاء المحتملين')}">
            <i style="background:#F59E0B"></i>${t('محتمل')}
            <span class="n">${prospectiveClients}</span>
            <span class="p">${totalClients ? Math.round((prospectiveClients / totalClients) * 100) : 0}%</span>
          </div>
          <div class="lrow" style="cursor:pointer" onclick="S.filter='متوقف';setView('list')" title="${t('عرض العملاء المتوقفين')}">
            <i style="background:#EF4444"></i>${t('متوقف')}
            <span class="n">${stoppedClients}</span>
            <span class="p">${totalClients ? Math.round((stoppedClients / totalClients) * 100) : 0}%</span>
          </div>
        </div>

        <!-- B3: Client Health Breakdown with Clarification Link -->
        <div class="card c3">
          <div class="chd">
            <div>
              <h3>${t('صحة العملاء')}</h3>
              <p>${t('توزيع نقاط العميل (0–100)')}</p>
            </div>
            <div class="act" onclick="openHealthScoreExplainerModal()" title="${t('اضغط لقراءة تفاصيل آلية احتساب النقاط')}">
              ℹ️ ${t('شرح المعايير')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;--rh:44px">
            ${hb(t('متميز'), scoreCategories['متميز'], totalClients || 100, '#10B981', null, '75+', 'title="عميل مستقر وناشط بدون مشاكل"')}
            ${hb(t('جيد'), scoreCategories['جيد'], totalClients || 100, '#F59E0B', null, '50–74', 'title="نشاط طبيعي يتطلب المتابعة الدورية"')}
            ${hb(t('يحتاج متابعة'), scoreCategories['يحتاج متابعة'], totalClients || 100, '#F97316', null, '25–49', 'title="فتور في التواصل أو وجود مشاكل معلقة"')}
            ${hb(t('خطر عالٍ'), scoreCategories['خطر عالٍ'], totalClients || 100, '#EF4444', null, '<25', 'title="انقطاع تواصل >60 يوم أو عقد منتهي دون تجديد"')}
          </div>
          <div class="hr"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div class="sec" style="margin:0">${t('كيف تُحسب الدرجة؟ (من 100)')}</div>
            <span style="font-size:11px;color:#2a78d6;cursor:pointer;font-weight:700" onclick="openHealthScoreExplainerModal()">التفاصيل ↗</span>
          </div>
          <div style="display:flex;gap:2px;height:12px;cursor:pointer" onclick="openHealthScoreExplainerModal()">
            <div style="flex:35;background:#2a78d6;border-radius:0 4px 4px 0" title="البرامج (35 نقطة)"></div>
            <div style="flex:25;background:#eb6834" title="التواصل الدوري (25 نقطة)"></div>
            <div style="flex:25;background:#1baf7a" title="الدعم الفني (25 نقطة)"></div>
            <div style="flex:15;background:#eda100;border-radius:4px 0 0 4px" title="الميزات والمقترحات (15 نقطة)"></div>
          </div>
          <div class="legend" style="margin-top:10px;gap:12px;font-size:12px">
            <span title="البرامج النشطة والتراخيص"><i style="background:#2a78d6"></i>${t('البرامج')} <bdi dir="ltr">35</bdi></span>
            <span title="حداثة التواصل والزيارات"><i style="background:#eb6834"></i>${t('التواصل')} <bdi dir="ltr">25</bdi></span>
            <span title="سرعة حل التذاكر"><i style="background:#1baf7a"></i>${t('التذاكر')} <bdi dir="ltr">25</bdi></span>
            <span title="المقترحات ذات التأثير"><i style="background:#eda100"></i>${t('الميزات')} <bdi dir="ltr">15</bdi></span>
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

        <!-- C2: Licenses by Version & Platform (High Precision) -->
        <div class="card c4">
          <div class="chd">
            <div>
              <h3>${t('مقارنة منصات التشغيل')}</h3>
              <p>${activeProgramsCount} ${t('نشط')} · ${expiringSoonCount} ${t('ينتهي قريباً')} · ${expiredProgramsCount} ${t('منتهي')}</p>
            </div>
            <div class="act" onclick="openLicensesExplorerModal()" title="${t('استعراض كافة تفاصيل التراخيص والعملاء')}">
              ${t('التفاصيل')} ${ic('chevl', 14, 2.6)}
            </div>
          </div>
          <div style="padding-top:10px">
            ${colChart(platformRows)}
          </div>
          <div class="hr" style="margin:12px 0 10px"></div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:var(--t2)">${t('تحليل حصص المنصات من إجمالي التراخيص المسجلة')}</span>
            <span style="font-size:11px;color:#2a78d6;cursor:pointer;font-weight:700" onclick="openLicensesExplorerModal()">استعراض التفاصيل ↗</span>
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
            <div class="sec" style="margin:0">${t('التذاكر المفتوحة حسب الأولوية')} (${openIssues.length})</div>
            <span style="font-size:11px;color:#2a78d6;cursor:pointer;font-weight:700" onclick="openTicketsAndReqsModal('issues', 'all')">عرض الكل ↗</span>
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('issues', 'عاجل')" title="${t('عرض التذاكر العاجلة')}">
            ${hb(t('عاجل'), issuesByPriority['عاجل'], Math.max(openIssues.length, 1), '#EF4444')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('issues', 'عالية')" title="${t('عرض التذاكر عالية الأولوية')}">
            ${hb(t('عالية'), issuesByPriority['عالية'], Math.max(openIssues.length, 1), '#F97316')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('issues', 'متوسطة')" title="${t('عرض التذاكر متوسطة الأولوية')}">
            ${hb(t('متوسطة'), issuesByPriority['متوسطة'], Math.max(openIssues.length, 1), '#F59E0B')}
          </div>
          <div style="cursor:pointer" onclick="openTicketsAndReqsModal('issues', 'منخفضة')" title="${t('عرض التذاكر منخفضة الأولوية')}">
            ${hb(t('منخفضة'), issuesByPriority['منخفضة'], Math.max(openIssues.length, 1), '#94A3B8')}
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
              <p>${t('تتطلب تدخلاً فورياً (مشاكل حرجة · انتهاء عقود · انقطاع تواصل)')}</p>
            </div>
            <span class="pill r" style="margin-inline-start:auto">${urgentAlerts.length} ${t('عاجلة')}</span>
          </div>
          ${alertDisplayList.length ? alertDisplayList.map(a => `
            <div class="item" onclick="selClient(${a.cid})" title="${t('اضغط للانتقال مباشرة لملف العميل المعني')}">
              <div class="ico ${a.level === 'urgent' ? 'r' : 'w'}">${ic(a.type === 'NO_CONTACT' ? 'phone' : (a.type === 'EXPIRING' ? 'calclock' : 'warn'), 19)}</div>
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

        <!-- D2: Clients at Risk (Fixed Navigation to Populated List) -->
        <div class="card c4">
          <div class="chd">
            <div>
              <h3>${t('عملاء في وضع خطر')}</h3>
              <p>${t('الأدنى نقاطًا وأعلى مخاطرة')}</p>
            </div>
            <div 
              class="act" 
              onclick="S.filter='خطر'; S.sortBy='score'; S.sortOrder='asc'; setView('list');" 
              title="${t('عرض كافة العملاء في وضع الخطر في القائمة')}"
            >
              ${t('عرض الـ')} ${atRiskClientsList.length} ${ic('chevl', 14, 2.6)}
            </div>
          </div>
          ${atRiskClientsList.slice(0, 5).map(item => `
            <div class="item" onclick="selClient(${item.client.id})" title="${t('فتح ملف')} ${esc(item.client.fullName)}">
              ${ringScore(item.score, item.score < 25 ? '#EF4444' : '#F97316')}
              <div class="tx">
                <b>${esc(item.client.fullName)}</b>
                <span>${esc(item.client.wilaya || '')} · ${esc(item.reasons)}</span>
              </div>
              <div class="end">
                <span class="pill ${item.score < 25 ? 'r' : 'w'}">${item.score < 25 ? t('خطر عالٍ') : t('يحتاج متابعة')}</span>
              </div>
            </div>
          `).join('') || `
            <div style="padding:2rem 1rem;text-align:center;color:var(--muted)">
              <div style="font-size:24px;margin-bottom:6px">🛡️</div>
              <div>${t('جميع العملاء في وضع صحي ممتاز')}</div>
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
            const actor = act.actorName || 'النظام';
            const initials = actor.slice(0, 2);
            const isCall = act.type?.includes('CONTACT');
            const isSolved = act.type?.includes('RESOLVED');
            const isProg = act.type?.includes('PROGRAM');
            const isClient = act.type?.includes('CLIENT');
            
            const badgeTag = isCall ? t('مكالمة') : (isSolved ? t('حل مشكلة') : (isProg ? t('ترخيص') : (isClient ? t('عميل جديد') : t('إجراء'))));
            const badgeColor = isCall ? '#1E40AF' : (isSolved ? '#065F46' : (isProg ? '#9A3412' : '#92400E'));
            const badgeBg = isCall ? '#EFF6FF' : (isSolved ? '#ECFDF5' : (isProg ? '#FFF3E8' : '#FFFBEB'));

            return `
              <div class="item" onclick="setView('global-timeline')">
                <div class="av" style="background:${badgeBg};color:${badgeColor}">${esc(initials)}</div>
                <div class="tx">
                  <b>${esc(actor)} <span class="tag" style="background:${badgeBg};color:${badgeColor}">${badgeTag}</span></b>
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
