import { S, clients, hasPermission, isGerant } from '../state/store.js';
import { BUSINESS_TYPES, WILAYAS } from '../constants/index.js';
import {
  gc, applyFilters, pBdg, sBdg, srcCls, isBdg, fmtD, rBdg,
  progStatusLabel, progStatusCls, progTypeBdg, getProgramStats,
  selOpts, wOpts, actTypeOpts, getActTypes, esc, avCls, init,
  searchMatch, countAdvFil, pBorder, cOpts, isClientAtRisk
} from '../utils/index.js';
import {
  computeScore, computeGlobalStats, generateAutoNote, computeRiskProfile,
  scoreColor, computeAlerts, scoreLabel, riskColor, riskBdg, riskLabel,
  analyzeRootCause
} from '../business/intelligence.js';
import { ActivityType, getActivityVisuals } from '../business/timelineService.js';
import { getClientCategoryBreakdown } from '../business/programMetrics.js';
import {
  normalizeClientStatus,
  isConfirmedClientStatus,
  isUnconfirmedClientStatus,
  buildClientClassificationPlan
} from '../business/clientStatus.js';
import { t } from '../utils/i18n.js';

const VI = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  chart: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  plus: '<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'
};

const vIc = (name, size = 15, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VI[name] || VI.clock}</svg>`;

function getPlatformSvg(platform) {
  if (platform === 'Mobile') return vIc('smartphone', 14);
  if (platform === 'Web') return vIc('globe', 14);
  return vIc('monitor', 14);
}

function getTimelineEventSvg(type) {
  switch (type) {
    case ActivityType.CLIENT_CREATED: return { icon: 'userplus', tone: 'var(--g)' };
    case ActivityType.CLIENT_EDITED: return { icon: 'edit', tone: 'var(--sys-blue)' };
    case ActivityType.CLIENT_DELETED:
    case ActivityType.PROGRAM_DELETED:
    case ActivityType.ISSUE_DELETED:
    case ActivityType.REQUIREMENT_DELETED:
    case ActivityType.CONTACT_DELETED:
    case ActivityType.BACKUP_DELETED:
    case ActivityType.STAFF_DELETED: return { icon: 'trash', tone: 'var(--r)' };
    case ActivityType.GPS_CAPTURED: return { icon: 'pin', tone: 'var(--sys-blue)' };
    case ActivityType.PROGRAM_ADDED:
    case ActivityType.PROGRAM_EDITED: return { icon: 'package', tone: 'var(--sys-teal)' };
    case ActivityType.PROGRAM_VERSION_UPDATED: return { icon: 'refresh', tone: 'var(--g)' };
    case ActivityType.ISSUE_ADDED:
    case ActivityType.ISSUE_EDITED: return { icon: 'warn', tone: 'var(--w)' };
    case ActivityType.ISSUE_RESOLVED: return { icon: 'check', tone: 'var(--g)' };
    case ActivityType.REQUIREMENT_ADDED:
    case ActivityType.REQUIREMENT_EDITED: return { icon: 'bulb', tone: 'var(--purple)' };
    case ActivityType.CONTACT_ADDED: return { icon: 'phone', tone: 'var(--sys-blue)' };
    case ActivityType.BACKUP_CREATED: return { icon: 'database', tone: 'var(--purple)' };
    case ActivityType.BACKUP_RESTORED: return { icon: 'refresh', tone: 'var(--w)' };
    case ActivityType.DATA_IMPORTED: return { icon: 'upload', tone: 'var(--g)' };
    case ActivityType.DATA_EXPORTED: return { icon: 'download', tone: 'var(--sys-blue)' };
    case ActivityType.STAFF_ADDED:
    case ActivityType.STAFF_EDITED: return { icon: 'shield', tone: 'var(--sys-blue)' };
    case ActivityType.SYSTEM_PURGE: return { icon: 'warn', tone: 'var(--r)' };
    case ActivityType.CLIENTS_STATUS_CLASSIFIED: return { icon: 'sliders', tone: 'var(--g)' };
    default: return { icon: 'clock', tone: 'var(--sys-blue)' };
  }
}

export function renderList() {
  if (!hasPermission('clients.view')) {
    return `
      <div class="dashboard-root">
        <div class="empty" style="max-width:560px;margin:2rem auto">
          <div class="empty-icon">${vIc('lock', 24)}</div>
          <h2 style="font-size:18px;font-weight:800;color:var(--t1);margin:0">${t('عذراً، ليس لديك صلاحية عرض قائمة العملاء')}</h2>
          <p class="empty-text" style="margin:0">
            ${S.lang === 'fr' ? 'La permission' : S.lang === 'en' ? 'The' : 'صلاحية'} <code>clients.view</code> ${S.lang === 'fr' ? 'n’est pas activée pour votre compte. Contactez l’administrateur pour l’activer depuis le panneau de configuration.' : S.lang === 'en' ? 'permission is not enabled for your account. Contact the administrator to enable it in the control panel.' : 'غير مفعلة لحسابك حالياً. يمكنك التواصل مع المسؤول لتفعيلها من لوحة التحكم.'}
          </p>
          <button class="btn btn-primary btn-sm" onclick="logoutStaff()">
            ${vIc('users', 14)}
            <span>${S.lang === 'fr' ? 'Changer de compte utilisateur' : S.lang === 'en' ? 'Switch user account' : 'تبديل حساب المستخدم'}</span>
          </button>
        </div>
      </div>
    `;
  }

  const safeAll = (clients || []).filter(Boolean);
  const confirmedCount = safeAll.filter(c => isConfirmedClientStatus(c.status)).length;
  const unconfirmedCount = safeAll.filter(c => isUnconfirmedClientStatus(c.status)).length;
  const noProgCount = safeAll.filter(c => getProgramStats(c).total === 0).length;
  const legacyCount = safeAll.filter(c => c.status !== 'مؤكد' && c.status !== 'غير مؤكد').length;
  const plan = buildClientClassificationPlan(safeAll, 'balanced');
  const totalProgs = safeAll.reduce((s, c) => s + getProgramStats(c).total, 0);
  const totalInstalls = safeAll.reduce((s, c) => s + getProgramStats(c).totalInstalls, 0);
  const fil = applyFilters(safeAll);
  const cnt = countAdvFil();
  const canEditClients = hasPermission('clients.edit') || hasPermission('canEditClients');

  if (S.isLoading && clients.length === 0) {
    return `
      <div class="dashboard-root">
        <div class="stats-row">
          ${Array(4).fill(0).map(() => `<div class="stat-c skeleton" style="height:82px"></div>`).join('')}
        </div>
        <div class="search-row skeleton" style="height:42px;margin-bottom:14px"></div>
        <div class="cgrid">
          ${Array(6).fill(0).map(() => `<div class="cc skeleton" style="height:175px"></div>`).join('')}
        </div>
      </div>
    `;
  }

  const itemHeight = 165;
  const numCols = window.innerWidth <= 520 ? 1 : (window.innerWidth >= 1120 ? 3 : 2);
  const totalRows = Math.ceil(fil.length / numCols);
  const scrollTop = S.virtualScrollTop || 0;
  const viewportHeight = S.viewportHeight || window.innerHeight;
  const visibleRowsCount = Math.ceil(viewportHeight / itemHeight);
  const bufferRows = 4;
  const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferRows);
  const endRow = Math.min(totalRows, startRow + visibleRowsCount + bufferRows * 2);
  const startIndex = startRow * numCols;
  const endIndex = Math.min(fil.length, endRow * numCols);
  const visibleItems = fil.slice(startIndex, endIndex);
  const topSpacerHeight = startRow * itemHeight;
  const bottomSpacerHeight = Math.max(0, (totalRows - endRow) * itemHeight);

  return `
    <div class="dashboard-root">
      <div class="phead">
        <div>
          <h1>${t('سجل العملاء')}</h1>
          <p class="sub">${t('إدارة ومتابعة قاعدة العملاء والتراخيص النشطة عبر الولايات')}</p>
        </div>
        <div class="phead-actions">
          ${canEditClients ? `
            <button class="btn btn-outline btn-sm" onclick="openClientCleanupModal()" title="${t('تصفية وتصنيف الزبائن')}">
              ${vIc('sliders', 14)}
              <span>${t('تصفية وتصنيف الزبائن')}</span>
            </button>
          ` : ''}
          ${hasPermission('analytics.view') ? `
            <button class="btn btn-outline btn-sm" onclick="S.gi=true;R()">
              ${vIc('cpu', 14)}
              <span>${t('الذكاء العالمي')}</span>
            </button>
          ` : ''}
          ${hasPermission('clients.create') ? `
            <button class="btn btn-primary btn-sm" onclick="openModal('addClient')">
              ${vIc('userplus', 14)}
              <span>${t('إضافة عميل جديد')}</span>
            </button>
          ` : ''}
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-c sg" style="cursor:pointer" onclick="setFil('مؤكد')" title="${t('تصفية وتحديد')}">
          <div class="stat-v num">${confirmedCount}</div>
          <div class="stat-l">${t('مؤكد')}</div>
        </div>
        <div class="stat-c so" style="cursor:pointer" onclick="setFil('غير مؤكد')" title="${t('تصفية وتحديد')}">
          <div class="stat-v num">${unconfirmedCount}</div>
          <div class="stat-l">${t('غير مؤكد')}</div>
        </div>
        <div class="stat-c sb" style="cursor:pointer" onclick="setFil('بدون برامج')" title="${t('عرض العملاء بدون برامج')}">
          <div class="stat-v num">${noProgCount}</div>
          <div class="stat-l">${t('بدون برامج')}</div>
        </div>
        <div class="stat-c" style="cursor:pointer" onclick="setFil('الكل')" title="${t('جميع العملاء')}">
          <div class="stat-v num" style="color:var(--b)">${totalProgs}</div>
          <div class="stat-l">${t('برامج')} · <span class="num">${totalInstalls}</span> ${t('جهاز')}</div>
        </div>
      </div>

      ${canEditClients && (plan.changesCount > 0 || legacyCount > 0) ? `
        <div style="background:rgba(255,159,10,0.09);border:1px solid rgba(255,159,10,0.28);border-radius:var(--r-md);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:10px;min-width:220px;flex:1">
            <span style="width:32px;height:32px;border-radius:10px;background:rgba(255,159,10,0.16);color:var(--wt);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${vIc('sliders', 16)}</span>
            <div>
              <div style="font-size:13px;font-weight:800;color:var(--t1)">
                ${t('تصنيف تلقائي مقترح')}: <span class="num" style="color:var(--wt)">${plan.changesCount}</span> ${t('عميل بحاجة للتحديث')}
              </div>
              <div style="font-size:12px;color:var(--t2);margin-top:2px">
                ${t('المتوازن (أي برنامج أو تواصل أو سجل = مؤكد)')} · <span class="num">${noProgCount}</span> ${t('بدون برامج')}${legacyCount > 0 ? ` · <span class="num">${legacyCount}</span> ${t('حالات قديمة')}` : ''}
              </div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openClientCleanupModal()">
            ${vIc('sliders', 14)}
            <span>${t('تصفية وتصنيف الزبائن')}</span>
          </button>
        </div>
      ` : ''}

      <div class="search-row">
        ${hasPermission('search.global') || hasPermission('search.clients') ? `
          <div style="position:relative;flex:1;display:flex;align-items:center">
            <span style="position:absolute;inset-inline-start:14px;color:var(--t3);display:flex;pointer-events:none">${vIc('search', 15)}</span>
            <input class="search-input" style="padding-inline-start:40px" placeholder="${t('ابحث: اسم، شركة، ولاية، نشاط، تخصص، هاتف...')}" value="${esc(S.q)}" oninput="onQ(this.value)">
          </div>
        ` : `<div style="flex:1;font-size:12px;color:var(--t3);padding:10px 14px;background:var(--glass-bg);border-radius:var(--r-md);border:1px solid var(--border);display:flex;align-items:center;gap:8px">${vIc('lock', 14)} <span>${t('البحث محجوز للمصرح لهم')}</span></div>`}
        ${hasPermission('filters.advanced') ? `
          <button class="adv-fil-toggle${cnt > 0 || S.showAdvFil ? ' active' : ''}" onclick="toggleAdvFil()">
            ${vIc('sliders', 14)}
            <span>${t('فلترة')}</span>
            ${cnt > 0 ? `<span class="adv-fil-badge num">${cnt}</span>` : ''}
          </button>
        ` : ''}
      </div>

      ${S.q ? `
        <div class="search-result-bar">
          ${vIc('search', 14)}
          <span><strong class="num">${fil.length}</strong> ${t('نتيجة لـ')} "<em>${esc(S.q)}</em>"</span>
          <div style="margin-inline-start:8px;display:flex;gap:8px;flex-wrap:wrap">
            ${[...new Set(fil.flatMap(client => searchMatch(client, S.q).fields))].map(f => `<span class="sf-tag">${t(f)}</span>`).join('')}
          </div>
          <button class="search-clear" onclick="onQ('')">${t('مسح')}</button>
        </div>
      ` : ''}

      ${renderAdvFilterPanel()}

      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0 12px;gap:12px;flex-wrap:wrap">
        <div class="filter-bar" style="margin:0;border:none;padding:0;gap:6px">
          ${['الكل', 'مؤكد', 'غير مؤكد', 'بدون برامج', 'خطر'].map(s => {
            const isRisk = s === 'خطر';
            const rCnt = isRisk ? safeAll.filter(c => isClientAtRisk(c)).length : 0;
            const active = S.filter === s;
            const riskStyle = isRisk
              ? (active ? 'background:var(--r);color:#fff;border-color:rgba(255,69,58,0.45)' : 'color:var(--rt);border-color:rgba(255,69,58,0.30)')
              : '';
            return `<span class="fpill${active ? ' on' : ''}${isRisk ? ' fpill-risk' : ''}" style="${riskStyle}" onclick="setFil('${s}')">
              ${isRisk ? `${vIc('warn', 13)} <span>${t('في وضع خطر')} (<span class="num">${rCnt}</span>)</span>` : t(s)}
            </span>`;
          }).join('')}
        </div>

        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t2)">
          <span style="font-weight:600">${t('ترتيب:')}</span>
          <select class="fctl" onchange="setSortBy(this.value)" style="width:auto;min-height:34px;padding:4px 10px;font-size:12px">
            <option value="id"${S.sortBy === 'id' ? ' selected' : ''}>${t('رقم العميل')}</option>
            <option value="fullName"${S.sortBy === 'fullName' ? ' selected' : ''}>${t('الاسم الكامل')}</option>
            <option value="score"${S.sortBy === 'score' ? ' selected' : ''}>${t('نقاط التقييم')}</option>
            <option value="lastContact"${S.sortBy === 'lastContact' ? ' selected' : ''}>${t('تاريخ التواصل')}</option>
          </select>
          <button class="btn btn-outline btn-xs" onclick="toggleSortOrder()" style="width:32px;height:34px;padding:0;justify-content:center" title="${S.sortOrder === 'asc' ? t('تصاعدي') : t('تنازلي')}">
            ${S.sortOrder === 'asc' ? '▲' : '▼'}
          </button>
        </div>
      </div>

      ${fil.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">${vIc('search', 24)}</div>
          <div class="empty-text">${S.lang === 'fr' ? 'Aucun résultat ne correspond aux filtres appliqués.' : S.lang === 'en' ? 'No results match the current filters.' : 'لا توجد نتائج تطابق الفلاتر المحددة حالياً.'}</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            ${cnt > 0 ? `<button class="btn btn-outline btn-sm" onclick="clearAdvFil()">${t('مسح الفلاتر')}</button>` : ''}
            ${hasPermission('clients.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addClient')">${t('إضافة عميل جديد')}</button>` : ''}
            ${isGerant() || hasPermission('backup.restore') ? `
              <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0" title="${t('استيراد ملف .dum أو .json')}">
                ${vIc('upload', 14)}
                <span>${t('استيراد (.dum / .json)')}</span>
                <input type="file" accept=".dum,.dump,.json,.txt,.csv" style="display:none" onchange="importData(this.files[0]);this.value=''">
              </label>
            ` : ''}
          </div>
        </div>
      ` : `
        <div class="cgrid">
          <div style="grid-column:1/-1;height:${topSpacerHeight}px;pointer-events:none"></div>
          ${visibleItems.map(c => {
            const oi = c.openIssuesCount !== undefined ? c.openIssuesCount : (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
            const urg = c.urgentIssuesCount !== undefined ? c.urgentIssuesCount : (c.issues || []).filter(i => i.priority === 'عاجل' && i.status !== 'محلول' && i.status !== 'مغلق').length;
            const sc = computeScore(c);
            const scColor = scoreColor(sc.total);
            const hit = S.q ? searchMatch(c, S.q) : null;
            const phoneDisplay = hasPermission('clients.view_sensitive') ? (esc(c.phone) || '—') : (c.phone ? '0550•• ••••' : '—');
            const ps = getProgramStats(c);
            const cb = getClientCategoryBreakdown(c);
            const atRisk = isClientAtRisk(c);
            const catSummaryText = cb.groupedSummary
              .slice(0, 3)
              .map(g => `${g.labelAr} (${g.devices})`)
              .join(' · ');
            return `
              <div class="cc" onclick="selClient(${c.id})" id="cc-card-${c.id}">
                <div class="cc-top">
                  <div class="av ${avCls(c.status)}">${esc(init(c.fullName))}</div>
                  <div style="min-width:0;flex:1">
                    <div class="cc-name">${esc(c.fullName)}</div>
                    <div class="cc-company" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.company) || '—'}</div>
                  </div>
                  <div class="score-tip num" style="font-size:15px;font-weight:800;color:${scColor};flex-shrink:0" data-tip="${sc.total >= 75 ? t('عميل متميز') : sc.total >= 50 ? t('عميل جيد') : sc.total >= 25 ? t('يحتاج متابعة') : t('خطر عالٍ')}">
                    ${sc.total}
                  </div>
                </div>

                <div class="cc-meta-line">
                  ${sBdg(c.status)}
                  <span style="opacity:.45">·</span>
                  ${ps.total > 0
                    ? `<span class="bdg bdg-b">${vIc('package', 12)} <span class="num">${ps.total}</span> ${t('برامج')} · <span class="num">${ps.totalInstalls}</span> ${t('جهاز')}</span>${catSummaryText ? `<span style="font-size:11px;color:var(--t2);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(catSummaryText)}">${esc(catSummaryText)}</span>` : ''}`
                    : `<span class="bdg bdg-gr">${t('لا برامج')}</span>`}
                </div>

                ${c.businessType ? `<div class="cc-activity">${t(c.businessType)}${c.businessField ? ` · ${t(c.businessField)}` : ''}</div>` : ''}
                ${hit && hit.fields.length > 0 ? `<div class="cc-search-match">${hit.fields.map(f => `<span class="sf-tag">${t(f)}</span>`).join('<span style="opacity:.4">·</span>')}</div>` : ''}

                <div class="cc-footer">
                  <div class="cc-phone" dir="ltr">${vIc('phone', 12)} <span>${phoneDisplay}</span></div>
                  <div class="cc-wilaya">${vIc('pin', 12)} <span>${esc(c.wilaya) || '—'}</span></div>
                </div>

                ${oi > 0 ? `<div class="cc-alert" style="color:${urg > 0 ? 'var(--rt)' : 'var(--wt)'}">${vIc('warn', 12)} <span class="num">${oi}</span> ${t('مشاكل مفتوحة')}${urg > 0 ? ` (${t('عاجل')})` : ''}</div>` : ''}
                ${atRisk ? `<div class="cc-alert" style="color:var(--rt)">${vIc('shield', 12)} <span>${esc(computeRiskProfile(c).risks[0] || (c.status === 'متوقف' ? t('الحساب متوقف') : (isUnconfirmedClientStatus(c.status) ? t('غير مؤكد') : t('في وضع خطر'))))}</span></div>` : ''}
              </div>
            `;
          }).join('')}
          <div style="grid-column:1/-1;height:${bottomSpacerHeight}px;pointer-events:none"></div>
        </div>
      `}
    </div>
  `;
}

export function renderDetail() {
  const c = gc();
  if (S.isLoading && !c) {
    return `
      <div class="dashboard-root">
        <div class="back skeleton" style="width:140px;height:34px;margin-bottom:14px"></div>
        <div class="chdr skeleton" style="height:140px;margin-bottom:14px"></div>
        <div class="qstats">
          ${Array(4).fill(0).map(() => `<div class="qs skeleton" style="height:78px"></div>`).join('')}
        </div>
        <div class="tabs-wrap skeleton" style="height:44px"></div>
      </div>
    `;
  }
  if (!c) {
    return `
      <div class="dashboard-root">
        <div class="back" onclick="goBack()">${vIc(S.lang === 'ar' ? 'chevronRight' : 'chevronLeft', 14)} <span>${t('قائمة العملاء')}</span></div>
        <div class="empty"><div class="empty-text">${t('العميل غير موجود')}</div></div>
      </div>
    `;
  }

  const cIssues = Array.isArray(c.issues) ? c.issues : [];
  const cRequirements = Array.isArray(c.requirements) ? c.requirements : [];
  const oi = cIssues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
  const fo = cIssues.filter(i => i.featureOpp).length;
  const sc = computeScore(c);
  const scColor = scoreColor(sc.total);
  const ps = getProgramStats(c);
  const cb = getClientCategoryBreakdown(c);
  const headerProgText = cb.groupedSummary.length > 0
    ? cb.groupedSummary.map(g => `${g.labelAr} (${g.devices})`).join(' · ')
    : (c.programNames?.[0] || t('برنامج مرخص'));
  const urgentCount = cIssues.filter(i => i.priority === 'عاجل' && i.status !== 'محلول' && i.status !== 'مغلق').length;

  return `
    <div class="dashboard-root">
      <div class="back" onclick="goBack()">${t('← قائمة العملاء')}</div>

      <div class="chdr">
        <div class="ch-top">
          <div class="ch-av">${esc(init(c.fullName))}</div>
          <div style="flex:1;min-width:0">
            <div class="ch-name">${esc(c.fullName)}</div>
            <div class="ch-company">${esc(c.company) || '—'}</div>
          </div>
          <div class="ch-acts">
            ${sBdg(c.status)}
            ${(hasPermission('clients.edit') || hasPermission('canEditClients')) ? `
              <button class="btn ${isConfirmedClientStatus(c.status) ? 'btn-outline' : 'btn-success-soft'} btn-sm" onclick="toggleClientConfirmationStatus(${c.id})">
                ${vIc(isConfirmedClientStatus(c.status) ? 'x' : 'check', 14)}
                <span>${isConfirmedClientStatus(c.status) ? t('تحويل لغير مؤكد') : t('تأكيد العميل')}</span>
              </button>
              <button class="btn btn-outline btn-sm" onclick="openModal('editClient')">${vIc('edit', 14)} <span>${t('تعديل')}</span></button>
            ` : ''}
          </div>
        </div>
        <div class="ch-meta">
          <span class="ch-mi">${vIc('pin', 14)} <span>${esc(c.wilaya) || '—'}${c.location ? '، ' + esc(c.location) : ''}</span></span>
          <span class="ch-mi" dir="ltr">${vIc('phone', 14)} <span>${hasPermission('clients.view_sensitive') ? (esc(c.phone) || '—') : (c.phone ? '0550•• ••••' : '—')}</span></span>
          ${ps.total > 0
            ? `<span class="ch-mi">${vIc('package', 14)} <span>${esc(headerProgText)} · <span class="num">${ps.totalInstalls}</span> ${t('جهاز')}</span></span>`
            : `<span class="ch-mi" style="opacity:.55">${vIc('package', 14)} <span>${t('لا برامج')}</span></span>`}
          <span class="ch-mi">${vIc('briefcase', 14)} <span>${t(c.businessType) || '—'}${c.businessField ? ' · ' + t(c.businessField) : ''}</span></span>
        </div>
      </div>

      <div class="qstats" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
        <div class="qs ${oi > 0 ? 'qr' : 'qg'}"><div class="qs-v num">${oi}</div><div class="qs-l">${t('مشاكل مفتوحة')}</div></div>
        <div class="qs ${fo > 0 ? 'qw' : ''}"><div class="qs-v num">${fo}</div><div class="qs-l">${t('فرص ميزات')}</div></div>
        <div class="qs qg"><div class="qs-v num">${ps.total}</div><div class="qs-l">${t('البرامج')} (<span class="num">${ps.totalInstalls}</span> ${t('جهاز')})</div></div>
        <div class="qs qc"><div class="qs-v num">${(c.contactHistory || []).length}</div><div class="qs-l">${t('سجلات تواصل')}</div></div>
        <div class="qs"><div class="qs-v num" style="color:${scColor}">${sc.total}</div><div class="qs-l">${t('نقاط العميل')}</div></div>
      </div>

      <div class="tabs-wrap">
        <button class="tabBtn${S.tab === 'overview' ? ' on' : ''}" onclick="setTab('overview')">${vIc('user', 14)} <span>${t('نظرة عامة')}</span></button>
        ${hasPermission('programs.view') ? `<button class="tabBtn${S.tab === 'programs' ? ' on' : ''}" onclick="setTab('programs')">${vIc('package', 14)} <span>${t('البرامج')}</span> <span class="tab-count num">${(c.programs || []).length}</span></button>` : ''}
        ${hasPermission('issues.view') ? `<button class="tabBtn${S.tab === 'issues' ? ' on' : ''}" onclick="setTab('issues')">${vIc('wrench', 14)} <span>${t('المشاكل')}</span> <span class="tab-count num${urgentCount > 0 ? ' urgent' : ''}">${cIssues.length}</span></button>` : ''}
        ${hasPermission('features.view') ? `<button class="tabBtn${S.tab === 'requirements' ? ' on' : ''}" onclick="setTab('requirements')">${vIc('bulb', 14)} <span>${t('المتطلبات')}</span> <span class="tab-count num">${cRequirements.length}</span></button>` : ''}
        ${hasPermission('contacts.view_history') ? `<button class="tabBtn${S.tab === 'contacts' ? ' on' : ''}" onclick="setTab('contacts')">${vIc('phone', 14)} <span>${t('التواصل')}</span> <span class="tab-count num">${(c.contactHistory || []).length}</span></button>` : ''}
        ${hasPermission('clients.view_timeline') ? `<button class="tabBtn${S.tab === 'timeline' ? ' on' : ''}" onclick="setTab('timeline')">${vIc('clock', 14)} <span>${t('الخط الزمني')}</span></button>` : ''}
        ${hasPermission('reports.view') ? `<button class="tabBtn${S.tab === 'report' ? ' on' : ''}" onclick="setTab('report')">${vIc('file', 14)} <span>${t('التقرير')}</span></button>` : ''}
        ${hasPermission('analytics.view') ? `<button class="tabBtn${S.tab === 'intelligence' ? ' on' : ''}" onclick="setTab('intelligence')">${vIc('cpu', 14)} <span>${t('الذكاء')}</span></button>` : ''}
      </div>

      <div class="tab-pane">
        ${S.tab === 'overview' ? renderOverview(c) : ''}
        ${S.tab === 'programs' && hasPermission('programs.view') ? renderPrograms(c) : ''}
        ${S.tab === 'issues' && hasPermission('issues.view') ? renderIssues(c) : ''}
        ${S.tab === 'requirements' && hasPermission('features.view') ? renderReqs(c) : ''}
        ${S.tab === 'contacts' && hasPermission('contacts.view_history') ? renderContacts(c) : ''}
        ${S.tab === 'timeline' && hasPermission('clients.view_timeline') ? renderTimeline(c) : ''}
        ${S.tab === 'report' && hasPermission('reports.view') ? renderReport(c) : ''}
        ${S.tab === 'intelligence' && hasPermission('analytics.view') ? renderIntelligence(c) : ''}
      </div>
    </div>
  `;
}

function renderOverview(c) {
  const gpsSection = c.gps && c.gps.lat
    ? `<div class="gps-row">${vIc('pin', 16)}<span class="gps-coords num">${c.gps.lat}, ${c.gps.lng}</span><button class="btn btn-blue-soft btn-xs" onclick="captureGPS()">${S.lang === 'fr' ? 'Mettre à jour GPS' : S.lang === 'en' ? 'Update GPS' : 'تحديث GPS'}</button></div>`
    : `<button class="btn btn-blue-soft btn-sm" style="margin-top:12px;width:100%" onclick="captureGPS()">${vIc('pin', 14)} <span>${S.lang === 'fr' ? 'Définir position GPS' : S.lang === 'en' ? 'Set GPS Location' : 'تحديد الموقع بـ GPS'}</span></button>`;

  const hasBiz = c.businessType || c.businessField;
  const bizCard = hasBiz
    ? `<div class="biz-profile">
        <div class="biz-icon">${vIc('building', 20)}</div>
        <div class="biz-info">
          <div class="biz-activity">${t(c.businessType)}</div>
          <div class="biz-type">${t(c.businessField) || (S.lang === 'fr' ? 'Spécialité non définie' : S.lang === 'en' ? 'Specialty not specified' : 'لم يُحدد التخصص بعد')}</div>
        </div>
        <span class="biz-badge">${S.lang === 'fr' ? 'Fiche activité' : S.lang === 'en' ? 'Business Profile' : 'ملف النشاط'}</span>
      </div>`
    : `<div class="biz-profile" style="cursor:pointer" onclick="openModal('editClient')">
        <div class="biz-icon">${vIc('building', 20)}</div>
        <div class="biz-info"><div class="biz-empty">${S.lang === 'fr' ? 'Activité non définie — cliquez pour ajouter' : S.lang === 'en' ? 'No activity defined — click to set' : 'لم يُحدد النشاط التجاري — اضغط لإضافته'}</div></div>
        <span class="biz-badge">+ ${t('إضافة')}</span>
      </div>`;

  const an = generateAutoNote(c);
  const ps = getProgramStats(c);
  const cb = getClientCategoryBreakdown(c);
  const categoriesOverview = cb.groupedSummary.length > 0
    ? cb.groupedSummary.map(g => `${esc(g.labelAr)} (<span class="num">${g.devices}</span> ${t('جهاز')})`).join(' · ')
    : '—';

  return `
    <div class="auto-note">
      <span class="an-ic">${vIc('sparkles', 18)}</span>
      <div class="an-body">
        <div class="an-lbl">${t('تحليل ذكي تلقائي')}</div>
        <div class="an-text">${esc(an.text)}</div>
        ${an.action ? `<div class="an-text" style="margin-top:6px;font-weight:700">${esc(an.action)}</div>` : ''}
        <div class="an-tags">${an.tags.map(tItem => `<span class="an-tag ${tItem.cls}">${esc(t(tItem.t))}</span>`).join('')}</div>
      </div>
    </div>

    ${bizCard}

    <div class="igrid">
      <div class="iitem"><div class="ilbl">${t('الاسم الكامل')}</div><div class="ival">${esc(c.fullName)}</div></div>
      <div class="iitem"><div class="ilbl">${t('الشركة / المؤسسة')}</div><div class="ival ${c.company ? '' : 'muted'}">${esc(c.company) || '—'}</div></div>
      <div class="iitem"><div class="ilbl">${t('الهاتف')}</div><div class="ival num" dir="ltr" style="text-align:${S.lang === 'ar' ? 'right' : 'left'}">${hasPermission('clients.view_sensitive') ? (esc(c.phone) || '—') : (c.phone ? '0550•• ••••' : '—')}</div></div>
      <div class="iitem"><div class="ilbl">${t('حساب Gmail')}</div><div class="ival" dir="ltr" style="text-align:${S.lang === 'ar' ? 'right' : 'left'}">${esc(c.gmailAccount) || '—'}</div></div>
      <div class="iitem"><div class="ilbl">${t('الولاية')}</div><div class="ival">${esc(c.wilaya) || '—'}</div></div>
      <div class="iitem"><div class="ilbl">${t('المنطقة / الحي')}</div><div class="ival ${c.location ? '' : 'muted'}">${esc(c.location) || '—'}</div></div>
      <div class="iitem"><div class="ilbl">${t('الحالة')}</div><div class="ival">${sBdg(c.status)}</div></div>
      <div class="iitem"><div class="ilbl">${t('النشاط الرئيسي')}</div><div class="ival">${c.businessType ? `${t(c.businessType)}` : '<span class="muted">—</span>'}</div></div>
      <div class="iitem"><div class="ilbl">${t('تخصص النشاط')}</div><div class="ival ${c.businessField ? '' : 'muted'}">${t(c.businessField) || '—'}</div></div>
      <div class="iitem"><div class="ilbl">${t('إجمالي البرامج والأجهزة')}</div><div class="ival num">${ps.total} ${t('برامج')} ${ps.total > 0 ? `<span style="font-size:11.5px;color:var(--t3)">· ${ps.totalInstalls} ${t('جهاز')}</span>` : ''}</div></div>
      <div class="iitem"><div class="ilbl">${t('توزيع الفئات والمنصات')}</div><div class="ival ${cb.groupedSummary.length ? '' : 'muted'}">${categoriesOverview}</div></div>
      <div class="iitem"><div class="ilbl">${t('تاريخ البداية')}</div><div class="ival num">${fmtD(c.startDate)}</div></div>
      <div class="iitem"><div class="ilbl">${t('نوع الترخيص')}</div><div class="ival" style="color:var(--brand);font-weight:700">${t('مدى الحياة (Licence à vie)')}</div></div>
      <div class="iitem"><div class="ilbl">${t('آخر تواصل')}</div><div class="ival"><span class="last-contact-clickable num" onclick="setTab('contacts')" title="${t('عرض التفاصيل')}">${fmtD(c.lastContact) || '—'}</span></div></div>
    </div>

    ${gpsSection}
    ${c.notes ? `<div style="margin-top:14px"><div class="ilbl" style="margin-bottom:5px">${t('ملاحظات')}</div><div class="notes-box">${esc(c.notes)}</div></div>` : ''}

    ${hasPermission('clients.delete') || hasPermission('canDeleteClients') ? `
      <div class="dzone">
        <div class="dz-t">${t('منطقة الخطر')}</div>
        <div class="dz-b">${t('حذف هذا العميل يحذف جميع مشاكله ومتطلباته نهائياً ولا يمكن التراجع')}</div>
        <button class="btn btn-danger-soft btn-sm" onclick="delClient(${c.id})">${vIc('trash', 13)} <span>${t('حذف العميل نهائياً')}</span></button>
      </div>
    ` : `
      <div style="margin-top:16px;background:rgba(255,255,255,0.03);border:1px solid var(--border-soft);border-radius:var(--r-sm);padding:12px;font-size:12px;color:var(--t3);display:flex;align-items:center;justify-content:center;gap:8px">
        ${vIc('lock', 14)} <span>${t('حذف العملاء محجوز للمصرح لهم فقط من طرف الرئيس.')}</span>
      </div>
    `}
  `;
}

function renderIssues(c) {
  return `
    <div class="pane-hdr">
      <span class="pane-title">${t('المشاكل والتذاكر')} (<span class="num">${c.issues.length}</span>)</span>
      ${hasPermission('issues.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addIssue')">${vIc('plus', 14)} <span>${t('مشكلة جديدة')}</span></button>` : ''}
    </div>
    ${c.issues.length === 0
      ? `<div class="empty"><div class="empty-icon">${vIc('check', 24)}</div><div class="empty-text">${t('لا توجد مشاكل مسجلة لهذا العميل')}</div>${hasPermission('issues.create') ? `<button class="btn btn-outline btn-sm" onclick="openModal('addIssue')">${t('تسجيل أول مشكلة')}</button>` : ''}</div>`
      : c.issues.map(iss => `
        <div class="icard ${pBorder(iss.priority)}">
          <div class="ic-top"><div class="ic-title">${esc(iss.title)}</div>${isBdg(iss.status)}</div>
          <div class="ic-meta">
            ${pBdg(iss.priority)}
            <span>·</span>
            <span class="ic-type">${esc(t(iss.type))}</span>
            ${iss.source ? `<span>·</span><span class="ic-src ${srcCls(iss.source)}">${esc(t(iss.source))}</span>` : ''}
            ${iss.confidence ? `<span>·</span><span class="ic-conf num">${iss.confidence}% ${t('ثقة')}</span>` : ''}
            ${iss.repeatCount > 1 ? `<span>·</span><span class="ic-repeat num">× ${iss.repeatCount}</span>` : ''}
            ${iss.featureOpp ? `<span>·</span><span class="ic-opp">${vIc('bulb', 12)} ${t('فرصة ميزة')}</span>` : ''}
            <span class="ic-date num" style="margin-inline-start:auto">${fmtD(iss.date)}</span>
          </div>
          ${iss.notes ? `<div class="ic-sol">${esc(iss.notes)}</div>` : ''}
          ${iss.solution ? `<div class="ic-sol"><strong style="color:var(--gt)">${t('الحل:')}</strong> ${esc(iss.solution)}</div>` : ''}
          <div class="ic-acts">
            ${iss.status !== 'محلول' && iss.status !== 'مغلق' && hasPermission('issues.resolve') ? `<button class="btn btn-success-soft btn-xs" onclick="markSolved(${c.id},${iss.id})">${vIc('check', 12)} <span>${t('تم الحل')}</span></button>` : ''}
            ${hasPermission('issues.edit') ? `<button class="btn btn-ghost btn-xs" onclick="editIssue(${c.id},${iss.id})">${vIc('edit', 12)} <span>${t('تعديل')}</span></button>` : ''}
            ${hasPermission('issues.delete') ? `<button class="btn btn-danger-soft btn-xs" onclick="delIssue(${c.id},${iss.id})">${vIc('trash', 12)} <span>${t('حذف')}</span></button>` : ''}
          </div>
        </div>`).join('')}
  `;
}

function renderReqs(c) {
  return `
    <div class="pane-hdr">
      <span class="pane-title">${t('المتطلبات والاقتراحات')} (<span class="num">${c.requirements.length}</span>)</span>
      ${hasPermission('features.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addRequirement')">${vIc('plus', 14)} <span>${t('طلب جديد')}</span></button>` : ''}
    </div>
    ${c.requirements.length === 0
      ? `<div class="empty"><div class="empty-icon">${vIc('bulb', 24)}</div><div class="empty-text">${t('لا توجد متطلبات مسجلة')}</div>${hasPermission('features.create') ? `<button class="btn btn-outline btn-sm" onclick="openModal('addRequirement')">${t('تسجيل أول طلب')}</button>` : ''}</div>`
      : c.requirements.map(req => `
        <div class="icard ${pBorder(req.priority)}">
          <div class="ic-top"><div class="ic-title">${esc(req.title)}</div>${rBdg(req.status)}</div>
          <div class="ic-meta">
            ${pBdg(req.priority)}
            <span>·</span>
            <span class="ic-type">${esc(t(req.type))}</span>
            <span>·</span>
            <span class="bdg bdg-gr">${t('تأثير')} ${esc(t(req.impact))}</span>
            <span class="ic-date num" style="margin-inline-start:auto">${fmtD(req.date)}</span>
          </div>
          ${req.notes ? `<div class="ic-sol">${esc(req.notes)}</div>` : ''}
          <div class="ic-acts">
            ${hasPermission('features.edit') ? `<button class="btn btn-ghost btn-xs" onclick="editReq(${c.id},${req.id})">${vIc('edit', 12)} <span>${t('تعديل')}</span></button>` : ''}
            ${hasPermission('features.delete') ? `<button class="btn btn-danger-soft btn-xs" onclick="delReq(${c.id},${req.id})">${vIc('trash', 12)} <span>${t('حذف')}</span></button>` : ''}
          </div>
        </div>`).join('')}
  `;
}

function renderContacts(c) {
  const hist = (c.contactHistory || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="ch-tab">
      <div class="ch-summary">
        <span class="ch-count">${vIc('phone', 14)} <span class="num">${hist.length}</span> ${t('تواصل مسجل')}</span>
        ${hasPermission('contacts.create_entry') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addContact')">${vIc('plus', 14)} <span>${t('تسجيل تواصل')}</span></button>` : ''}
      </div>
      ${hist.length === 0
        ? `<div class="ch-empty">${t('لا توجد سجلات تواصل بعد')}<br><small>${t('سجّل أول تواصل مع هذا العميل')}</small></div>`
        : `<div class="timeline">
          ${hist.map((h, i) => `
            <div class="tl-entry">
              <div class="tl-dot${i === 0 ? ' first' : ''}"></div>
              <div class="tl-date num">${fmtD(h.date)}</div>
              <div class="tl-note">${esc(h.note)}</div>
              <div class="tl-acts">
                ${hasPermission('contacts.delete_entry') ? `<button class="btn btn-danger-soft btn-xs" onclick="delContact(${c.id},${h.id})">${vIc('trash', 12)} <span>${t('حذف')}</span></button>` : ''}
              </div>
            </div>`).join('')}
        </div>`}
    </div>
  `;
}

function renderPrograms(c) {
  const ps = getProgramStats(c);
  const cb = getClientCategoryBreakdown(c);
  const progs = c.programs || [];
  const canEdit = hasPermission('programs.edit');
  return `
    <div class="prog-summary">
      <div class="ps-item ps-active"><div class="ps-val num">${ps.total}</div><div class="ps-lbl">${t('إجمالي البرامج')}</div></div>
      <div class="ps-item"><div class="ps-val num">${ps.totalInstalls}</div><div class="ps-lbl">${t('إجمالي الأجهزة')}</div></div>
      <div class="ps-item ps-active"><div class="ps-val num">${cb.groupedSummary.length}</div><div class="ps-lbl">${t('الفئات المفعّلة (مدى الحياة)')}</div></div>
    </div>
    <div class="pane-hdr">
      <span class="pane-title">${t('قائمة البرامج والتراخيص')}</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${canEdit && progs.length > 0 ? `<button class="btn btn-outline btn-sm" onclick="openModal('syncProgramVersion')">${vIc('refresh', 14)} <span>${t('تحديث إصدار برنامج')}</span></button>` : ''}
        ${hasPermission('programs.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addProgram')">${vIc('plus', 14)} <span>${t('برنامج جديد')}</span></button>` : ''}
      </div>
    </div>
    ${progs.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${vIc('package', 24)}</div>
          <div class="empty-text">${t('لا توجد برامج مرتبطة بهذا العميل')}</div>
          ${hasPermission('programs.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addProgram')">${t('إضافة أول برنامج')}</button>` : ''}
        </div>`
      : progs.map(p => {
        const instCount = Math.max(1, Number(p.installationsCount) || 1);
        return `
        <div class="prog-card ${progStatusCls(p)}">
          <div class="prog-top">
            <div class="prog-name">${getPlatformSvg(p.platform)} <span>${esc(p.programName)}${p.version ? ` · ${esc(p.version)}` : ''}</span></div>
            ${progStatusLabel(p)}
          </div>
          <div class="prog-meta">
            ${progTypeBdg(p.type || p.programName)}
            <span>·</span>
            <span class="bdg bdg-gr">${esc(p.platform || 'Desktop')}</span>
          </div>
          <div class="prog-installs prog-installs-row">
            <span>${vIc('monitor', 14)} <strong class="num">${instCount}</strong> ${t('جهاز مُرخَّص')}</span>
            ${canEdit ? `
              <div class="prog-dev-ctrl" title="${t('تعديل عدد الأجهزة لهذا البرنامج')}">
                <button type="button" class="prog-dev-btn" onclick="adjustProgramDevices(${c.id},${p.id},-1)" ${instCount <= 1 ? 'disabled' : ''} aria-label="${t('إنقاص جهاز')}">−1</button>
                <button type="button" class="prog-dev-btn" onclick="adjustProgramDevices(${c.id},${p.id},1)" aria-label="${t('إضافة جهاز')}">+1 ${t('جهاز')}</button>
              </div>
            ` : ''}
          </div>
          <div class="prog-dates">
            <div class="prog-date-item">
              <div class="prog-date-lbl">${t('تاريخ البداية')}</div>
              <div class="prog-date-val num">${fmtD(p.startDate) || '—'}</div>
            </div>
            <div class="prog-date-item">
              <div class="prog-date-lbl">${t('نوع الترخيص')}</div>
              <div class="prog-date-val" style="color:var(--brand);font-weight:700">${t('مدى الحياة')}</div>
            </div>
          </div>
          <div class="prog-acts">
            ${canEdit ? `<button class="btn btn-ghost btn-xs" onclick="editProg(${c.id},${p.id})">${vIc('edit', 12)} <span>${t('تعديل')}</span></button>` : ''}
            ${hasPermission('programs.delete') ? `<button class="btn btn-danger-soft btn-xs" onclick="delProgram(${c.id},${p.id})">${vIc('trash', 12)} <span>${t('حذف')}</span></button>` : ''}
          </div>
        </div>`;
      }).join('')}
    ${Array.isArray(c.versionHistory) && c.versionHistory.length > 0 ? `
      <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">
        <div class="pane-hdr" style="margin-bottom:10px">
          <span class="pane-title" style="display:inline-flex;align-items:center;gap:6px">${vIc('refresh', 14)} <span>${t('سجل تحديثات الإصدارات')} (<span class="num">${c.versionHistory.length}</span>)</span></span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${c.versionHistory.map(vh => `
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;display:flex;flex-direction:column;gap:5px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                <strong style="font-size:12.5px;color:var(--t1)">${esc(vh.programLabel || vh.programKey || 'برنامج')}</strong>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span class="bdg bdg-gr num">${esc(vh.previousVersion || '—')}</span>
                  <span style="color:var(--t3)">→</span>
                  <span class="bdg bdg-g num">${esc(vh.newVersion || '—')}</span>
                </div>
              </div>
              <div style="font-size:11.5px;color:var(--t2);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span>${t('الأجهزة المحدثة')}: <strong class="num" style="color:var(--t1)">${vh.affectedDevices || 0}</strong></span>
                <span>·</span>
                <span>${t('التاريخ')}: <span class="num">${fmtD(vh.updateDate) || esc(vh.updateDate || '—')}</span></span>
                <span>·</span>
                <span>${t('بواسطة')}: <strong style="color:var(--t1)">${esc(vh.employeeName || '—')}</strong></span>
              </div>
              ${vh.note ? `<div style="font-size:11.5px;color:var(--t3)">${esc(vh.note)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function renderReport(c) {
  const sc = computeScore(c);
  const rp = computeRiskProfile(c);
  const ps = getProgramStats(c);
  const an = generateAutoNote(c);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openIss = c.issues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة');
  const solvedIss = c.issues.filter(i => i.status === 'محلول' || i.status === 'مغلق');
  const urgIss = openIss.filter(i => i.priority === 'عاجل');
  const repeated = c.issues.filter(i => i.repeatCount >= 3);
  const featureOp = c.issues.filter(i => i.featureOpp);
  const hiReqs = c.requirements.filter(r => r.impact === 'عالي' && r.status !== 'مرفوض');
  const hist = (c.contactHistory || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const last30ct = hist.filter(h => (today - new Date(h.date + 'T00:00')) / 86400000 <= 30).length;
  const daysSince = c.lastContact ? Math.floor((today - new Date(c.lastContact + 'T00:00')) / 86400000) : null;

  const scColor = sc.total >= 75 ? 'var(--g)' : sc.total >= 50 ? 'var(--w)' : sc.total >= 25 ? 'var(--brand)' : 'var(--r)';
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
  const riskLbl = rp.level === 'high' ? t('خطر عالٍ') : rp.level === 'medium' ? t('تحت المراقبة') : t('وضع مستقر');
  const riskBdgCls = rp.level === 'high' ? 'bdg-r' : rp.level === 'medium' ? 'bdg-y' : 'bdg-g';

  const oppLevel = (() => {
    let score = 0;
    if (hiReqs.length >= 2) score += 3;
    if (featureOp.length >= 2) score += 2;
    if (last30ct >= 3) score += 2;
    if (isUnconfirmedClientStatus(c.status)) score += 2;
    if (ps.total >= 2) score += 1;
    return score >= 6 ? 'عالية' : score >= 3 ? 'متوسطة' : 'منخفضة';
  })();
  const oppColor = oppLevel === 'عالية' ? 'var(--g)' : oppLevel === 'متوسطة' ? 'var(--w)' : 'var(--t3)';

  const actions = [];
  if (urgIss.length > 0) actions.push({ icon: 'warn', text: `حل ${urgIss.length} مشكلة عاجلة مفتوحة فوراً`, cls: 'urgent' });
  if (daysSince !== null && daysSince > 45 && isConfirmedClientStatus(c.status)) actions.push({ icon: 'phone', text: `جدولة مكالمة متابعة — لا تواصل منذ ${daysSince} يوم`, cls: '' });
  if (repeated.length >= 2) actions.push({ icon: 'wrench', text: `جلسة تقنية لحل ${repeated.length} مشاكل متكررة جذرياً`, cls: '' });
  if (hiReqs.length > 0) actions.push({ icon: 'bulb', text: `مراجعة ${hiReqs.length} طلب ذو تأثير عالٍ مع فريق المنتج`, cls: '' });
  if (isUnconfirmedClientStatus(c.status) && hist.length < 3) actions.push({ icon: 'users', text: 'التواصل مع العميل لتأكيد احتياجاته وتفعيل أول برنامج', cls: '' });
  if (actions.length === 0) actions.push({ icon: 'check', text: 'الوضع مستقر — استمر في المتابعة الدورية', cls: 'ok' });

  const sbar = (lbl, val, max, col) => `
    <div class="rep-score-bar">
      <span class="rep-score-lbl">${lbl}</span>
      <div class="rep-score-track"><div class="rep-score-fill" style="width:${max ? Math.round(val / max * 100) : 0}%;background:${col}"></div></div>
      <span class="rep-score-val num">${val}/${max}</span>
    </div>
  `;

  return `
    <div class="report-wrap">
      <div class="report-header">
        <div class="rh-top">
          <div class="rh-av">${esc((c.fullName || '').substring(0, 2))}</div>
          <div style="flex:1;min-width:0">
            <div class="rh-name">${esc(c.fullName)}</div>
            <div class="rh-sub">${esc(c.company) || '—'}</div>
          </div>
          <div style="text-align:end;flex-shrink:0">
            <div class="num" style="font-size:28px;font-weight:800;color:${scColor};line-height:1">${sc.total}</div>
            <div style="font-size:11px;color:var(--t3);margin-top:3px">/ 100 نقطة</div>
          </div>
        </div>
        <div class="rh-meta">
          <span class="rh-mi">${vIc('pin', 13)} <span>${esc(c.wilaya) || '—'}</span></span>
          <span class="rh-mi" dir="ltr">${vIc('phone', 13)} <span class="num">${esc(c.phone) || '—'}</span></span>
          <span class="rh-mi">${vIc('briefcase', 13)} <span>${esc(c.businessType) || '—'}</span></span>
          <span class="rh-mi">${vIc('cal', 13)} <span>${t('تاريخ التقرير:')} ${new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</span></span>
        </div>
      </div>

      <div class="report-kpis">
        <div class="rkpi ${openIss.length > 0 ? 'rr' : 'rg'}"><div class="rkpi-v num">${openIss.length}</div><div class="rkpi-l">مشاكل مفتوحة</div></div>
        <div class="rkpi rb"><div class="rkpi-v num">${ps.total}</div><div class="rkpi-l">برامج · ${ps.totalInstalls} جهاز</div></div>
        <div class="rkpi ro"><div class="rkpi-v num">${hist.length}</div><div class="rkpi-l">سجلات تواصل</div></div>
        <div class="rkpi ${rp.level === 'high' ? 'rr' : rp.level === 'medium' ? 'ro' : 'rg'}"><div class="rkpi-v" style="font-size:15px">${riskLbl}</div><div class="rkpi-l">مستوى الخطر</div></div>
        <div class="rkpi"><div class="rkpi-v" style="color:${oppColor};font-size:16px">${oppLevel}</div><div class="rkpi-l">مستوى الفرصة</div></div>
        <div class="rkpi"><div class="rkpi-v num">${c.requirements.length}</div><div class="rkpi-l">متطلبات</div></div>
      </div>

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('building', 14)} <span>الملف التجاري</span></div>
        <div class="rep-card">
          <div class="rep-row"><div class="rep-dot"></div><div><strong>النشاط:</strong> ${esc(c.businessType) || 'غير محدد'}${c.businessField ? ' — ' + esc(c.businessField) : ''}</div></div>
          <div class="rep-row"><div class="rep-dot"></div><div><strong>الموقع:</strong> ${esc(c.wilaya) || '—'}${c.location ? '، ' + esc(c.location) : ''}</div></div>
          <div class="rep-row"><div class="rep-dot"></div><div><strong>الحالة:</strong> ${esc(t(normalizeClientStatus(c.status)))} — ${isConfirmedClientStatus(c.status) ? 'عميل مؤكد ببرامج أو تواصل' : 'عميل غير مؤكد — بانتظار التواصل والتأكيد'}</div></div>
          <div class="rep-row"><div class="rep-dot"></div><div><strong>تاريخ الاشتراك:</strong> <span class="num">${fmtD(c.startDate) || '—'}</span> · ترخيص مدى الحياة</div></div>
          ${c.notes ? `<div class="rep-row"><div class="rep-dot"></div><div><strong>ملاحظات:</strong> ${esc(c.notes)}</div></div>` : ''}
        </div>
      </div>

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('package', 14)} <span>البرامج والتراخيص</span></div>
        ${ps.total === 0
          ? `<div class="rep-card" style="color:var(--t3);text-align:center">لا توجد برامج مرتبطة</div>`
          : (c.programs || []).map(p => `<div class="rep-card">
                <div class="rep-row"><div class="rep-dot green"></div><div><strong>${esc(p.programName)}</strong>${p.version ? ` · <span class="bdg bdg-b num">${esc(p.version)}</span>` : ''} — <span style="color:var(--g)">نشط (مدى الحياة)</span></div></div>
                <div class="rep-row"><div class="rep-dot"></div><div>المنصة: ${esc(p.platform)} · النوع: ${esc(p.type)} · <span class="num">${p.installationsCount}</span> جهاز</div></div>
                <div class="rep-row"><div class="rep-dot"></div><div>تاريخ التثبيت: <span class="num">${fmtD(p.startDate) || '—'}</span></div></div>
              </div>`).join('')}
      </div>
      ${Array.isArray(c.versionHistory) && c.versionHistory.length > 0 ? `
      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('refresh', 14)} <span>تاريخ تحديثات الإصدارات</span></div>
        <div class="rep-card">
          ${c.versionHistory.map(vh => `
            <div class="rep-row">
              <div class="rep-dot green"></div>
              <div>
                <strong>${esc(vh.programLabel || vh.programKey)}</strong>:
                <span class="num">${esc(vh.previousVersion || '—')}</span> → <strong class="num" style="color:var(--gt)">${esc(vh.newVersion || '—')}</strong>
                · <span class="num">${vh.affectedDevices || 0}</span> جهاز
                · <span class="num">${fmtD(vh.updateDate) || esc(vh.updateDate || '—')}</span>
                · بواسطة ${esc(vh.employeeName || '—')}
                ${vh.note ? ` — ${esc(vh.note)}` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('wrench', 14)} <span>تحليل المشاكل</span></div>
        ${c.issues.length === 0
          ? `<div class="rep-card" style="color:var(--gt)">لا توجد مشاكل مسجلة</div>`
          : `<div class="rep-card">
            <div class="rep-row"><div class="rep-dot red"></div><div><strong class="num">${openIss.length}</strong> مشكلة مفتوحة${urgIss.length > 0 ? ` (${urgIss.length} عاجلة)` : ''}</div></div>
            <div class="rep-row"><div class="rep-dot green"></div><div><strong class="num">${solvedIss.length}</strong> مشكلة محلولة</div></div>
            ${repeated.length > 0 ? `<div class="rep-row"><div class="rep-dot yellow"></div><div><strong class="num">${repeated.length}</strong> مشاكل متكررة (repeatCount ≥ 3) — تشير إلى خلل بنيوي</div></div>` : ''}
            ${featureOp.length > 0 ? `<div class="rep-row"><div class="rep-dot"></div><div><strong class="num">${featureOp.length}</strong> فرصة لتحويل مشكلة إلى ميزة منتج</div></div>` : ''}
          </div>
          ${openIss.length > 0 ? `<div class="rep-card"><strong>المشاكل المفتوحة:</strong><br>${openIss.map(i => `<div class="rep-row" style="margin-top:5px"><div class="rep-dot ${i.priority === 'عاجل' ? 'red' : i.priority === 'عالية' ? 'yellow' : ''}"></div><div>${esc(i.title)} — ${esc(i.priority)} — ${esc(i.type)}</div></div>`).join('')}</div>` : ''}`}
      </div>

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('phone', 14)} <span>تحليل التواصل</span></div>
        <div class="rep-card">
          <div class="rep-row"><div class="rep-dot"></div><div><strong>إجمالي التواصلات:</strong> <span class="num">${hist.length}</span> سجل</div></div>
          <div class="rep-row"><div class="rep-dot ${last30ct >= 2 ? 'green' : last30ct === 0 ? 'red' : 'yellow'}"></div><div><strong>خلال 30 يوم الأخيرة:</strong> <span class="num">${last30ct}</span> تواصل</div></div>
          <div class="rep-row"><div class="rep-dot ${daysSince !== null && daysSince > 60 ? 'red' : daysSince !== null && daysSince > 30 ? 'yellow' : 'green'}"></div><div><strong>آخر تواصل:</strong> <span class="num">${fmtD(c.lastContact) || '—'}</span>${daysSince !== null ? ` (منذ ${daysSince} يوم)` : ''}</div></div>
          ${hist.length > 0 ? `<div class="rep-row"><div class="rep-dot"></div><div><strong>آخر ملاحظة:</strong> ${esc(hist[0].note)}</div></div>` : ''}
        </div>
      </div>

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('chart', 14)} <span>تقييم العميل</span></div>
        <div class="rep-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div class="num" style="font-size:28px;font-weight:800;color:${scColor}">${sc.total}</div>
            <div style="font-size:12.5px;color:var(--t2)">${sc.total >= 75 ? 'عميل متميز' : sc.total >= 50 ? 'عميل جيد' : sc.total >= 25 ? 'يحتاج متابعة' : 'خطر عالٍ'}</div>
          </div>
          ${sbar('البرامج', sc.prog, 35, 'var(--sys-green)')}
          ${sbar('التواصل', sc.act, 25, 'var(--sys-blue)')}
          ${sbar('صحة المشاكل', sc.iss, 25, 'var(--sys-orange)')}
          ${sbar('المتطلبات', sc.req, 15, 'var(--sys-purple)')}
        </div>
      </div>

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('shield', 14)} <span>ملف المخاطر</span></div>
        <div class="rep-card">
          <div class="rep-risk-badge bdg ${riskBdgCls}">${riskLbl}</div>
          ${rp.risks.length === 0
            ? `<div style="color:var(--gt)">لا توجد مخاطر مكتشفة</div>`
            : rp.risks.map(r => `<div class="rep-row"><div class="rep-dot red"></div><div>${esc(r)}</div></div>`).join('')}
        </div>
      </div>

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('bulb', 14)} <span>فرص النمو</span></div>
        <div class="rep-card">
          <div class="rep-row"><div class="rep-dot ${oppLevel === 'عالية' ? 'green' : oppLevel === 'متوسطة' ? 'yellow' : ''}"></div><div><strong>مستوى الفرصة:</strong> <span style="color:${oppColor};font-weight:700">${oppLevel}</span></div></div>
          ${hiReqs.length > 0 ? `<div class="rep-row"><div class="rep-dot green"></div><div>${hiReqs.length} طلب ذو تأثير عالٍ — فرصة لتوسيع التراخيص</div></div>` : ''}
          ${featureOp.length > 0 ? `<div class="rep-row"><div class="rep-dot green"></div><div>${featureOp.length} مشكلة قابلة للتحويل لميزة — قيمة منتج مضافة</div></div>` : ''}
          ${isUnconfirmedClientStatus(c.status) ? `<div class="rep-row"><div class="rep-dot yellow"></div><div>عميل غير مؤكد — قيد المتابعة والتواصل للتأكيد</div></div>` : ''}
          ${ps.total >= 2 ? `<div class="rep-row"><div class="rep-dot green"></div><div>يستخدم ${ps.total} برامج — ارتباط قوي بالمنصة</div></div>` : ''}
        </div>
      </div>

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('sparkles', 14)} <span>الملاحظة الذكية التلقائية</span></div>
        <div class="rep-card">${esc(an.text)}${an.action ? `<div style="margin-top:6px;font-weight:700;color:var(--t1)">${esc(an.action)}</div>` : ''}</div>
      </div>

      <div class="rep-sec">
        <div class="rep-sec-title">${vIc('target', 14)} <span>الإجراءات المقترحة</span></div>
        ${actions.map(a => `<div class="rep-action ${a.cls}"><span class="rep-action-icon">${vIc(a.icon, 15)}</span><span>${esc(a.text)}</span></div>`).join('')}
      </div>

      <button class="btn btn-outline rep-print" onclick="window.print()">${vIc('printer', 14)} <span>طباعة / تصدير PDF</span></button>
    </div>
  `;
}

function renderIntelligence(c) {
  const sc = computeScore(c);
  const color = scoreColor(sc.total);
  const label = scoreLabel(sc.total);
  const rp = computeRiskProfile(c);
  const clientAlerts = computeAlerts().filter(a => a.cid === c.id);
  const repeated = c.issues.filter(i => i.repeatCount >= 3);
  const opps = c.issues.filter(i => i.featureOpp);
  const sourceDist = {};
  c.issues.forEach(i => { const s = i.source || 'غير محدد'; sourceDist[s] = (sourceDist[s] || 0) + 1; });

  const sbar = (lbl, val, max, col) => `
    <div class="sbar-row">
      <span class="sbar-lbl">${lbl}</span>
      <div class="sbar-track"><div class="sbar-fill" style="width:${max ? Math.round(val / max * 100) : 0}%;background:${col}"></div></div>
      <span class="sbar-val num">${val}/${max}</span>
    </div>
  `;

  return `
    <div class="intel-sec">
      <div class="intel-sec-title">نتيجة العميل</div>
      <div class="score-card">
        <div class="score-ring" style="border-color:${color}66">
          <div class="score-ring-num num" style="color:${color}">${sc.total}</div>
          <div class="score-ring-lbl">/ 100</div>
        </div>
        <div class="score-details">
          <div class="score-name" style="color:${color}">${label}</div>
          <div class="score-desc">تقييم مبني على 4 محاور: برامج نشطة، تواصل، صحة المشاكل، قيمة المتطلبات</div>
          <div class="sbar-wrap">
            ${sbar('البرامج', sc.prog, 35, 'var(--sys-green)')}
            ${sbar('النشاط', sc.act, 25, 'var(--sys-blue)')}
            ${sbar('صحة المشاكل', sc.iss, 25, 'var(--sys-orange)')}
            ${sbar('المتطلبات', sc.req, 15, 'var(--sys-purple)')}
          </div>
        </div>
      </div>
    </div>

    <div class="intel-sec">
      <div class="intel-sec-title">ملف المخاطر</div>
      <div class="intel-card" style="${rp.level === 'high' ? 'border-color:rgba(255,69,58,0.35);background:rgba(255,69,58,0.06)' : ''}">
        <div class="intelc-title">${vIc('shield', 15)} <span class="bdg ${riskBdg(rp.level)}">${riskLabel(rp.level)}</span></div>
        ${rp.risks.length === 0
          ? `<div class="risk-empty">لا توجد مخاطر مكتشفة</div>`
          : rp.risks.map(r => `<div class="risk-bar"><span class="risk-icon">${vIc('warn', 14)}</span><span class="risk-text">${esc(r)}</span></div>`).join('')}
      </div>
    </div>

    <div class="intel-sec">
      <div class="intel-sec-title">تحليل المشاكل</div>
      ${c.issues.length === 0 ? `<div class="intel-card"><div class="intelc-body" style="color:var(--t3);text-align:center;padding:8px 0">لا توجد مشاكل مسجلة لهذا العميل</div></div>` : ''}
      ${repeated.length > 0 ? `<div class="intel-card">
        <div class="intelc-title">${vIc('repeat', 15)} <span>مشاكل متكررة — تحتاج حلاً جذرياً</span></div>
        <div class="intelc-body">${repeated.map(i => `<div class="intelc-item">• ${esc(i.title)} <span class="ic-repeat num">× ${i.repeatCount}</span></div>`).join('')}</div>
      </div>` : ''}
      ${opps.length > 0 ? `<div class="intel-card">
        <div class="intelc-title">${vIc('bulb', 15)} <span>فرص تحويلها لميزات جديدة</span></div>
        <div class="intelc-body">${opps.map(i => `<div class="intelc-item">• ${esc(i.title)}</div>`).join('')}</div>
      </div>` : ''}
      ${c.issues.length > 0 ? `<div class="intel-card">
        <div class="intelc-title">${vIc('chart', 15)} <span>توزيع مصادر المشاكل</span></div>
        <div class="source-pills">${Object.entries(sourceDist).map(([s, n]) => `<span class="bdg bdg-gr">${esc(s)}: <strong class="num" style="color:var(--t1)">${n}</strong></span>`).join('<span style="opacity:.4">·</span>')}</div>
      </div>` : ''}
      ${c.issues.length > 0 && repeated.length === 0 && opps.length === 0 ? `<div class="intel-card">
        <div class="intelc-body" style="color:var(--gt)">لا توجد مشاكل متكررة — الوضع جيد</div>
      </div>` : ''}
    </div>

    ${c.issues.length > 0 ? `
      <div class="intel-sec">
        <div class="intel-sec-title">تحليل الجذر لكل مشكلة</div>
        ${c.issues.filter(i => i.status !== 'مغلق').map(iss => {
          const causes = analyzeRootCause(iss);
          return `<div class="intel-card">
            <div class="intelc-title">
              ${pBdg(iss.priority)}
              <span>${esc(iss.title)}</span>
              ${iss.source ? `<span class="ic-src ${srcCls(iss.source)}" style="margin-inline-start:auto">${esc(iss.source)}</span>` : ''}
            </div>
            <div class="intelc-body">
              ${causes.map(cause => `<div class="cause-item">→ ${esc(cause)}</div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    ` : ''}

    <div class="intel-sec">
      <div class="intel-sec-title">تنبيهات خاصة بهذا العميل</div>
      ${clientAlerts.length === 0
        ? `<div class="intel-card"><div class="intelc-body" style="color:var(--gt)">لا توجد تنبيهات نشطة لهذا العميل</div></div>`
        : clientAlerts.map(a => `<div class="abanner ${a.level}" style="margin-bottom:6px">
            <span class="ab-icon">${vIc('warn', 15)}</span>
            <div class="ab-body"><div class="ab-title">${a.msg}</div><div class="ab-sub">${a.sub}</div></div>
          </div>`).join('')}
    </div>
  `;
}

export function renderGlobalIntelligence() {
  const gs = computeGlobalStats();
  const alerts = computeAlerts();
  const crossIssues = gs.crossIssues;

  return `
    <div class="gi-overlay" onclick="if(event.target.classList.contains('gi-overlay')){S.gi=false;R()}">
      <div class="gi-sheet">
        <div class="gi-hdr">
          <div class="gi-title">${vIc('cpu', 18)} <span>${t('لوحة الذكاء العالمي')}</span></div>
          <button class="mclose" onclick="S.gi=false;R()">×</button>
        </div>

        <div class="gi-kpis">
          <div class="gi-kpi"><div class="gi-kpi-v num" style="color:var(--b)">${gs.totalProgsGlobal}</div><div class="gi-kpi-l">برامج · ${gs.totalInstGlobal} جهاز</div></div>
          <div class="gi-kpi"><div class="gi-kpi-v num" style="color:${gs.openIssues.length > 0 ? 'var(--r)' : 'var(--g)'}">${gs.openIssues.length}</div><div class="gi-kpi-l">مشاكل مفتوحة</div></div>
          <div class="gi-kpi"><div class="gi-kpi-v num" style="color:var(--purple)">${gs.featureOpps.length}</div><div class="gi-kpi-l">فرص ميزات</div></div>
          <div class="gi-kpi"><div class="gi-kpi-v num" style="color:${gs.highRiskClients.length > 0 ? 'var(--r)' : 'var(--g)'}">${gs.highRiskClients.length}</div><div class="gi-kpi-l">عملاء في خطر</div></div>
          <div class="gi-kpi"><div class="gi-kpi-v num">${gs.avgScore}</div><div class="gi-kpi-l">متوسط نقاط العملاء</div></div>
          <div class="gi-kpi"><div class="gi-kpi-v num" style="color:var(--brand)">${alerts.filter(a => a.level === 'urgent').length}</div><div class="gi-kpi-l">تنبيهات عاجلة</div></div>
        </div>

        ${gs.highRiskClients.length > 0 ? `
          <div class="gi-sec">
            <div class="gi-sec-title">عملاء في وضع خطر</div>
            ${gs.highRiskClients.map(c => {
              const rp = computeRiskProfile(c);
              const sc = computeScore(c);
              return `<div class="gi-card" style="border-color:rgba(255,69,58,0.35);background:rgba(255,69,58,0.06);cursor:pointer" onclick="S.gi=false;selClient(${c.id})">
                <div class="gi-card-title">
                  ${vIc('warn', 14)}
                  <span class="bdg bdg-r">خطر عالي</span>
                  <span>${esc(c.fullName)}</span>
                  <span class="bdg bdg-gr" style="margin-inline-start:auto">${esc(c.wilaya)}</span>
                  <span class="num" style="font-size:11.5px;color:var(--t3)">نقاط: ${sc.total}</span>
                </div>
                <div class="gi-card-body">${rp.risks.map(r => `<div class="gi-item"><span>·</span><span>${esc(r)}</span></div>`).join('')}</div>
              </div>`;
            }).join('')}
          </div>
        ` : ''}

        ${crossIssues.length > 0 ? `
          <div class="gi-sec">
            <div class="gi-sec-title">مشاكل متكررة عبر عدة عملاء — مشاكل نظامية</div>
            ${crossIssues.map(ci => `
              <div class="gi-card">
                <div class="gi-card-title">
                  ${vIc('repeat', 14)}
                  <span class="bdg bdg-o">${esc(ci.type)}</span>
                  <span class="num" style="margin-inline-start:auto;font-size:11.5px;color:var(--t3)">${ci.count} حالة / ${ci.clientNames.length} عملاء</span>
                </div>
                <div class="gi-card-body">
                  ${ci.items.slice(0, 3).map(i => `<div class="gi-item"><span>·</span><span style="color:var(--t1)">${esc(i.title)}</span></div>`).join('')}
                  <div class="cross-clients">العملاء: ${ci.clientNames.map(esc).join(' ، ')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${gs.featureOpps.length > 0 ? `
          <div class="gi-sec">
            <div class="gi-sec-title">فرص ميزات محتملة (من المشاكل)</div>
            ${gs.featureOpps.slice(0, 5).map(f => `
              <div class="gi-card" style="cursor:pointer" onclick="S.gi=false;selClient(${f.clientId})">
                <div class="gi-card-title">${vIc('bulb', 14)} <span>${esc(f.title)}</span></div>
                <div class="gi-card-body">العميل: ${esc(f.clientName)} — تكرار: <span class="num">${f.repeatCount}</span> مرة — مصدر: ${esc(f.source)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${gs.topReqs.length > 0 ? `
          <div class="gi-sec">
            <div class="gi-sec-title">أهم المتطلبات (مرتبة بالتأثير والأولوية)</div>
            ${gs.topReqs.map(r => `
              <div class="gi-card" style="cursor:pointer" onclick="S.gi=false;selClient(${r.clientId})">
                <div class="gi-card-title">${esc(r.title)}</div>
                <div class="gi-card-body">${esc(r.clientName)} — ${esc(r.type)} — تأثير ${esc(r.impact)} — ${esc(r.status)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderAdvFilterPanel() {
  if (!hasPermission('filters.advanced')) return '';
  const cnt = countAdvFil();
  const activities = BUSINESS_TYPES;
  const actTypes = S.fActivity
    ? getActTypes(S.fActivity)
    : [...new Set(clients.map(c => c.businessField).filter(Boolean))].sort();
  const programs = [...new Set(clients.flatMap(c => [...(Array.isArray(c.programNames) ? c.programNames : []), ...(Array.isArray(c.programs) ? c.programs.map(p => p?.programName) : [])]).filter(Boolean))].sort();
  const opt = (arr, cur) => `<option value="">${t('الكل')}</option>` + arr.map(v => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(t(v))}</option>`).join('');
  const totalFiltered = applyFilters(clients).length;
  const optW = () => `<option value="">${t('الكل')}</option>` + wOpts(S.fWilaya);

  return `
    <div class="adv-fil-panel${S.showAdvFil ? '' : ' hidden'}">
      ${hasPermission('filters.by_wilaya') ? `
        <div class="adf-group">
          <div class="adf-lbl">${t('الولاية')}</div>
          <select class="adf-sel${S.fWilaya ? ' has-val' : ''}" onchange="setAdvFil('fWilaya',this.value)">${optW()}</select>
        </div>
        <div class="adf-group">
          <div class="adf-lbl">${t('البلدية')}</div>
          <select class="adf-sel${S.fCommune ? ' has-val' : ''}" onchange="setAdvFil('fCommune',this.value)">
            <option value="">${t('الكل')}</option>
            ${cOpts(S.fWilaya, S.fCommune)}
          </select>
        </div>
      ` : ''}
      <div class="adf-group">
        <div class="adf-lbl">${t('النشاط الرئيسي')}</div>
        <select class="adf-sel${S.fActivity ? ' has-val' : ''}" onchange="setAdvFil('fActivity',this.value)">
          ${`<option value="">${t('الكل')}</option>` + activities.map(a => `<option value="${a}"${S.fActivity === a ? ' selected' : ''}>${t(a)}</option>`).join('')}
        </select>
      </div>
      <div class="adf-group">
        <div class="adf-lbl">${t('تخصص النشاط')}${S.fActivity ? ` (${t(S.fActivity)})` : ''}</div>
        <select class="adf-sel${S.fActType ? ' has-val' : ''}" onchange="setAdvFil('fActType',this.value)">${opt(actTypes, S.fActType)}</select>
      </div>
      ${hasPermission('filters.by_program') ? `
        <div class="adf-group">
          <div class="adf-lbl">${t('البرنامج')}</div>
          <select class="adf-sel${S.fProgram ? ' has-val' : ''}" onchange="setAdvFil('fProgram',this.value)">${opt(programs, S.fProgram)}</select>
        </div>
      ` : ''}
      <div class="adv-fil-footer">
        <span class="adv-fil-summary">${cnt > 0 ? `<strong class="num">${totalFiltered}</strong> ${t('نتيجة لـ')} (${cnt})` : `${t('جميع العملاء')} (<span class="num">${clients.length}</span>)`}</span>
        ${cnt > 0 ? `<button class="btn btn-ghost btn-xs" onclick="clearAdvFil()">${vIc('x', 12)} <span>${t('مسح الفلاتر')}</span></button>` : ''}
      </div>
    </div>
  `;
}

function renderTimeline(c) {
  const list = S.clientActivities || [];
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
  return `
    <div class="pane-hdr">
      <span class="pane-title">${t('الخط الزمني للنشاط')} (<span class="num">${list.length}</span>)</span>
      <button class="btn btn-outline btn-sm" onclick="loadClientTimeline(${c.id})">${vIc('refresh', 14)} <span>${t('تحديث')}</span></button>
    </div>
    ${list.length === 0
      ? `<div class="empty"><div class="empty-icon">${vIc('clock', 24)}</div><div class="empty-text">${t('لا توجد أحداث مسجلة للعميل حتى الآن. سيتم تسجيل التفاعلات تلقائياً هنا.')}</div></div>`
      : `<div class="timeline" style="margin-top:16px">
          ${list.map((act, i) => {
            const vis = getActivityVisuals(act.type);
            const ev = getTimelineEventSvg(act.type);
            const dateStr = new Date(act.timestamp).toLocaleString(locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            return `
              <div class="tl-entry">
                <div class="tl-dot${i === 0 ? ' first' : ''}" style="background:${ev.tone}"></div>
                <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;display:flex;flex-direction:column;gap:6px">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                    <span class="bdg ${vis.colorClass}" style="display:inline-flex;align-items:center;gap:5px">${vIc(ev.icon, 13)} <span>${t(vis.label)}</span></span>
                    <span class="num" style="font-size:11.5px;color:var(--t3)" dir="ltr">${dateStr}</span>
                  </div>
                  <div style="font-size:13.5px;font-weight:700;color:var(--t1)">${esc(t(act.title))}</div>
                  <div style="font-size:12.5px;color:var(--t2);line-height:1.55">${esc(t(act.description))}</div>
                  ${act.actorEmail ? `<div style="font-size:11px;color:var(--t3);display:flex;align-items:center;gap:5px;padding-top:4px;border-top:1px solid var(--border-soft)">
                    ${vIc('user', 12)} <span>${t('المنفذ:')}</span> <strong style="color:var(--t2)">${esc(act.actorEmail)}</strong>
                  </div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>`}
  `;
}

export { renderDashboard } from './render-dashboard.js';
