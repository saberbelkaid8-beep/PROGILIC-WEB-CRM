/**
 * PROGILIC CRM v3 - Global Timeline & Activity Audit View
 * Styled with the Apple Liquid Glass / Dark Glassmorphism Dashboard design system.
 */

import { S, hasPermission } from '../state/store.js';
import { ActivityType, getActivityVisuals } from '../business/timelineService.js';
import { buildTimelineReport, getFilteredTimelineList } from '../business/actions/timelineActions.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';

const I = {
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>'
};

const ic = (name, size = 16, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || I.clock}</svg>`;

function getEventIconAndTone(type) {
  switch (type) {
    case ActivityType.CLIENT_CREATED:
      return { icon: 'userplus', tone: 'g' };
    case ActivityType.CLIENT_EDITED:
      return { icon: 'edit', tone: 'b' };
    case ActivityType.CLIENT_DELETED:
      return { icon: 'trash', tone: 'r' };
    case ActivityType.GPS_CAPTURED:
      return { icon: 'pin', tone: 'b' };
    case ActivityType.PROGRAM_ADDED:
      return { icon: 'package', tone: 't' };
    case ActivityType.PROGRAM_EDITED:
      return { icon: 'edit', tone: 'b' };
    case ActivityType.PROGRAM_DELETED:
      return { icon: 'trash', tone: 'r' };
    case ActivityType.ISSUE_ADDED:
      return { icon: 'warn', tone: 'w' };
    case ActivityType.ISSUE_EDITED:
      return { icon: 'wrench', tone: 'w' };
    case ActivityType.ISSUE_RESOLVED:
      return { icon: 'check', tone: 'g' };
    case ActivityType.ISSUE_DELETED:
      return { icon: 'trash', tone: 'r' };
    case ActivityType.REQUIREMENT_ADDED:
      return { icon: 'bulb', tone: 'p' };
    case ActivityType.REQUIREMENT_EDITED:
      return { icon: 'wrench', tone: 'p' };
    case ActivityType.REQUIREMENT_DELETED:
      return { icon: 'trash', tone: 'r' };
    case ActivityType.CONTACT_ADDED:
      return { icon: 'phone', tone: 'b' };
    case ActivityType.CONTACT_DELETED:
      return { icon: 'trash', tone: 'r' };
    case ActivityType.BACKUP_CREATED:
      return { icon: 'database', tone: 'p' };
    case ActivityType.BACKUP_RESTORED:
      return { icon: 'refresh', tone: 'w' };
    case ActivityType.BACKUP_DELETED:
      return { icon: 'trash', tone: 'r' };
    case ActivityType.DATA_IMPORTED:
      return { icon: 'upload', tone: 'g' };
    case ActivityType.DATA_EXPORTED:
      return { icon: 'download', tone: 'b' };
    case ActivityType.STAFF_ADDED:
      return { icon: 'users', tone: 't' };
    case ActivityType.STAFF_EDITED:
      return { icon: 'shield', tone: 'b' };
    case ActivityType.STAFF_DELETED:
      return { icon: 'trash', tone: 'r' };
    case ActivityType.SYSTEM_PURGE:
      return { icon: 'warn', tone: 'r' };
    default:
      return { icon: 'clock', tone: 'b' };
  }
}

const hbRow = (label, value, max, color) => `
  <div class="hb">
    <span class="l" title="${esc(label)}">${esc(label)}</span>
    <div class="t"><div class="f" style="width:${Math.min(100, Math.max(0, ((value || 0) / (max || 1)) * 100))}%;background:${color}"></div></div>
    <span class="v num">${value || 0}</span>
  </div>
`;

export function renderGlobalTimeline() {
  if (!hasPermission('timeline.view')) {
    return `
      <div class="dashboard-root tl-root">
        <div class="card tl-empty-card">
          <div class="ico r">${ic('lock', 22)}</div>
          <h3>${t('ليس لديك صلاحية عرض المخطط الزمني')}</h3>
        </div>
      </div>
    `;
  }

  const allActivities = Array.isArray(S.globalActivities) ? S.globalActivities : [];
  const filtered = getFilteredTimelineList();
  const report = buildTimelineReport(filtered);
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');

  const cloudStatus = {
    synced: { label: 'سجل السحابة أونلاين متزامن فورياً مع كافة المستخدمين', tone: 'is-good' },
    pending: { label: 'أنشطة جديدة قيد الرفع والمزامنة أونلاين', tone: 'is-warn' },
    partial: { label: 'مطلوب اتصال بالإنترنت للمزامنة السحابية', tone: 'is-bad' },
    'local-only': { label: 'مطلوب تسجيل الدخول بالإنترنت للمزامنة السحابية', tone: 'is-bad' }
  }[S.timelineCloudStatus] || { label: 'مزامنة سحابية حية نشطة أونلاين', tone: 'is-good' };

  const totalCount = allActivities.length;
  const filteredCount = filtered.length;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayCount = allActivities.filter(a => {
    const timestamp = new Date(a.timestamp);
    return !Number.isNaN(timestamp.getTime())
      && timestamp.getFullYear() === today.getFullYear()
      && timestamp.getMonth() === today.getMonth()
      && timestamp.getDate() === today.getDate();
  }).length;

  const userCounts = {};
  allActivities.forEach(a => {
    const u = a.userName || 'المسؤول العام';
    userCounts[u] = (userCounts[u] || 0) + 1;
  });
  let topUserName = '—';
  let topUserActions = 0;
  Object.entries(userCounts).forEach(([u, count]) => {
    if (count > topUserActions) {
      topUserActions = count;
      topUserName = u;
    }
  });

  const solvedCount = allActivities.filter(a => a.type === 'ISSUE_RESOLVED').length;

  const uniqueUsers = new Map();
  const addUser = (id, name) => {
    const userName = name || 'المسؤول العام';
    uniqueUsers.set(String(id || userName), { id: String(id || userName), name: userName });
  };
  if (S.staffUsers && S.staffUsers.length > 0) {
    S.staffUsers.forEach(s => {
      const n = s.name || s.fullName;
      if (n) addUser(s.id, n);
    });
  }
  allActivities.forEach(a => {
    if (a.userName) addUser(a.userId || a.actorUid, a.userName);
  });
  addUser('gerant', 'المسؤول العام');
  const userOptions = Array.from(uniqueUsers.values()).sort((a, b) => a.name.localeCompare(b.name));

  const isAnyFilterActive =
    (S.timelineUserFilter && S.timelineUserFilter !== 'all') ||
    (S.timelineCategoryFilter && S.timelineCategoryFilter !== 'all') ||
    (S.timelineDatePreset && S.timelineDatePreset !== 'all') ||
    Boolean(S.timelineDateFrom) ||
    Boolean(S.timelineDateTo) ||
    Boolean(S.timelineSearch && S.timelineSearch.trim());

  const groupedByDate = {};
  filtered.forEach(a => {
    const timestamp = new Date(a.timestamp);
    const dayKey = !Number.isNaN(timestamp.getTime())
      ? `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}`
      : 'سابقاً';
    if (!groupedByDate[dayKey]) groupedByDate[dayKey] = [];
    groupedByDate[dayKey].push(a);
  });
  const dateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const presets = [
    { id: 'all', label: 'كل الأوقات' },
    { id: 'today', label: 'اليوم' },
    { id: 'yesterday', label: 'أمس (البارح)' },
    { id: 'day_before_yesterday', label: 'أول أمس (أول البارح)' },
    { id: 'week', label: 'آخر 7 أيام' },
    { id: 'month', label: 'هذا الشهر' },
    { id: 'custom', label: 'مخصص' }
  ];

  return `
    <div class="dashboard-root tl-root">

      <!-- Page Header -->
      <div class="phead">
        <div>
          <h1>${t('المخطط الزمني وسجل العمليات الشامل')}</h1>
          <div class="tl-subline">
            <span>${t('سجل عمليات موحد لحساب المؤسسة، مع اسم الموظف المنفذ والتاريخ والوقت والتصفية والتقرير الإداري.')}</span>
            <span>·</span>
            <span role="status" class="tl-sync-state ${cloudStatus.tone}">${t(cloudStatus.label)}</span>
          </div>
        </div>
        <div style="flex:1"></div>
        <div class="tl-actions">
          <button class="db-btn" onclick="syncAllCrmServicesAction()" title="${t('مزامنة ورفع كافة خدمات وتراخيص الـ CRM الحالية إلى المخطط الزمني السحابي')}">
            ${ic('zap', 15)} <span>${t('مزامنة كل خدمات الـ CRM')}</span>
          </button>
          <button class="db-btn ghost" onclick="refreshGlobalTimeline()" title="${t('تحديث السجل')}">
            ${ic('refresh', 15)} <span>${t('تحديث')}</span>
          </button>
          <button class="db-btn ghost" onclick="exportGlobalTimelineCSV()" title="${t('تصدير كـ CSV')}">
            ${ic('download', 15)} <span>${t('تصدير CSV')}</span>
          </button>
          <button class="db-btn ghost" onclick="exportGlobalTimelineMarkdown()" title="${t('تصدير كملف Markdown (.md)')}">
            ${ic('file', 15)} <span>${t('تصدير Markdown (.md)')}</span>
          </button>
          <button class="db-btn ghost" onclick="exportClientNamesMarkdown()" title="${t('تصدير أسماء العملاء فقط (.md)')}">
            ${ic('users', 15)} <span>${t('أسماء العملاء (.md)')}</span>
          </button>
        </div>
      </div>

      <!-- KPI Cards & Filter / Report Grid -->
      <div class="db-grid">

        <div class="card kpi c3">
          <div class="top">
            <div class="chipi tl-chipi-b">${ic('file', 18)}</div>
            <span>${t('إجمالي العمليات المسجلة')}</span>
          </div>
          <div class="val"><b class="num">${totalCount}</b><small>${t('عملية')}</small></div>
          <div class="row">
            <span class="sub">${t('عرض')} <b class="num">${filteredCount}</b> ${t('مطابقة للفلترة')}</span>
          </div>
        </div>

        <div class="card kpi c3">
          <div class="top">
            <div class="chipi tl-chipi-g">${ic('zap', 18)}</div>
            <span>${t('عمليات اليوم')}</span>
          </div>
          <div class="val"><b class="num">${todayCount}</b><small>${t('عملية')}</small></div>
          <div class="row">
            <span class="sub">${t('النشاط المسجل بتاريخ اليوم')}</span>
          </div>
        </div>

        <div class="card kpi c3">
          <div class="top">
            <div class="chipi tl-chipi-w">${ic('award', 18)}</div>
            <span>${t('المستخدم الأكثر نشاطاً')}</span>
          </div>
          <div class="val">
            <b style="font-size:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px" title="${esc(topUserName)}">${esc(topUserName)}</b>
          </div>
          <div class="row">
            <span class="sub"><b class="num">${topUserActions}</b> ${t('عملية مسجلة')}</span>
          </div>
        </div>

        <div class="card kpi c3">
          <div class="top">
            <div class="chipi tl-chipi-p">${ic('check', 18)}</div>
            <span>${t('مشاكل تم حلها')}</span>
          </div>
          <div class="val"><b class="num">${solvedCount}</b><small>${t('تذكرة')}</small></div>
          <div class="row">
            <span class="sub">${t('إجمالي التذاكر المغلقة في السجل')}</span>
          </div>
        </div>

        <!-- Unified Glass Filter Panel -->
        <div class="card c12 tl-filter-card">
          <div class="tl-filters-grid">

            <div class="tl-field">
              <label class="tl-label">${ic('user', 14)} <span>${t('تصفية باسم المستخدم المنفذ:')}</span></label>
              <select class="tl-control" onchange="setTimelineUserFilter(this.value)">
                <option value="all" ${S.timelineUserFilter === 'all' ? 'selected' : ''}>${t('جميع المستخدمين (الكل)')}</option>
                ${userOptions.map(user => `
                  <option value="${esc(user.id)}" ${S.timelineUserFilter === user.id || S.timelineUserFilter === user.name ? 'selected' : ''}>
                    ${esc(user.name)}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="tl-field">
              <label class="tl-label">${ic('tag', 14)} <span>${t('نوع العملية / القسم:')}</span></label>
              <select class="tl-control" onchange="setTimelineCategoryFilter(this.value)">
                <option value="all" ${S.timelineCategoryFilter === 'all' ? 'selected' : ''}>${t('جميع الأقسام والعمليات')}</option>
                <option value="clients" ${S.timelineCategoryFilter === 'clients' ? 'selected' : ''}>${t('العملاء وحساباتهم')}</option>
                <option value="issues" ${S.timelineCategoryFilter === 'issues' ? 'selected' : ''}>${t('المشاكل والدعم الفني')}</option>
                <option value="programs" ${S.timelineCategoryFilter === 'programs' ? 'selected' : ''}>${t('البرامج والتراخيص')}</option>
                <option value="requirements" ${S.timelineCategoryFilter === 'requirements' ? 'selected' : ''}>${t('المتطلبات والميزات')}</option>
                <option value="contacts" ${S.timelineCategoryFilter === 'contacts' ? 'selected' : ''}>${t('سجل التواصل والمكالمات')}</option>
                <option value="backup" ${S.timelineCategoryFilter === 'backup' ? 'selected' : ''}>${t('النسخ الاحتياطي والأمان')}</option>
                <option value="staff" ${S.timelineCategoryFilter === 'staff' ? 'selected' : ''}>${t('المستخدمون والصلاحيات')}</option>
                <option value="system" ${S.timelineCategoryFilter === 'system' ? 'selected' : ''}>${t('عمليات النظام')}</option>
              </select>
            </div>

            <div class="tl-field">
              <label class="tl-label">${ic('search', 14)} <span>${t('بحث فوري في العمليات:')}</span></label>
              <input type="text"
                     class="tl-control"
                     placeholder="${t('ابحث: اسم المستخدم، العميل، تفاصيل الإجراء...')}"
                     value="${esc(S.timelineSearch || '')}"
                     oninput="setTimelineSearch(this.value)">
            </div>

          </div>

          <div class="tl-date-bar">
            <div class="tl-date-presets">
              <span class="tl-label">${ic('cal', 14)} <span>${t('الفترة الزمنية:')}</span></span>
              <div class="chips">
                ${presets.map(p => `
                  <div class="chip ${S.timelineDatePreset === p.id ? 'on' : ''}" onclick="setTimelineDatePreset('${p.id}')">
                    ${t(p.label)}
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="tl-date-inputs">
              <label class="tl-date-field">
                <span>${t('من تاريخ:')}</span>
                <input type="date"
                       class="tl-control tl-date"
                       value="${S.timelineDateFrom || ''}"
                       onchange="setTimelineDateFrom(this.value)">
              </label>
              <label class="tl-date-field">
                <span>${t('إلى تاريخ:')}</span>
                <input type="date"
                       class="tl-control tl-date"
                       value="${S.timelineDateTo || ''}"
                       onchange="setTimelineDateTo(this.value)">
              </label>
              ${S.timelineDateFrom || S.timelineDateTo ? `
                <button class="tl-clear-btn" onclick="clearTimelineDates()" title="${t('إلغاء التحديد المخصص')}">
                  ${ic('x', 13)} <span>${t('إلغاء التواريخ')}</span>
                </button>
              ` : ''}
              ${isAnyFilterActive ? `
                <button class="tl-clear-btn" onclick="clearTimelineFilters()">
                  ${ic('x', 13)} <span>${t('مسح جميع الفلاتر')}</span>
                </button>
              ` : ''}
            </div>
          </div>

          <div class="tl-filter-meta">
            <div>
              ${t('عرض')} <strong class="tl-count-accent num">${filteredCount}</strong> ${t('عملية من أصل')} <strong class="num">${totalCount}</strong> ${t('عملية مسجلة')}
              ${S.timelineUserFilter !== 'all' ? ` · <strong>${esc(S.timelineUserFilter)}</strong>` : ''}
              ${S.timelineCategoryFilter !== 'all' ? ` · <strong>${esc(S.timelineCategoryFilter)}</strong>` : ''}
            </div>
            <span>${t('توثيق فوري معتمد')}</span>
          </div>
        </div>

        ${renderTimelineReport(report, filtered, locale)}

      </div>

      <!-- Timeline Feed Stream -->
      ${filtered.length === 0 ? `
        <div class="card tl-empty-card">
          <div class="ico b">${ic('clock', 24)}</div>
          <h3>${t('لا توجد عمليات تطابق معايير البحث والفلترة')}</h3>
          <p>${t('لم يتم العثور على أية عمليات للمستخدم أو الفترة الزمنية أو القسم المختار. يمكنك تجربة تغيير الفلاتر أو مسحها.')}</p>
          <button class="db-btn" onclick="clearTimelineFilters()">
            ${ic('x', 15)} <span>${t('إعادة ضبط ومسح الفلاتر')}</span>
          </button>
        </div>
      ` : `
        <div class="tl-stream">
          ${dateKeys.map(dayKey => {
            const dayActivities = groupedByDate[dayKey];
            const isToday = dayKey === todayStr;
            const dayLabel = isToday ? t('اليوم') : dayKey;

            return `
              <div class="tl-day-group">
                <div class="tl-day-head">
                  <div class="tl-day-title">
                    ${ic('cal', 15)}
                    <span class="num">${esc(dayLabel)}</span>
                  </div>
                  <div class="tl-day-rule"></div>
                  <span class="tl-day-count num">${dayActivities.length} ${t('عملية')}</span>
                </div>

                <div class="tl-rail">
                  ${dayActivities.map(a => {
                    const vis = getActivityVisuals(a.type);
                    const { icon: svgName, tone } = getEventIconAndTone(a.type);
                    const timeDate = a.timestamp ? new Date(a.timestamp) : new Date();
                    const timeFormatted = timeDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const fullDateStr = timeDate.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                    return `
                      <article class="card tl-event">
                        <span class="tl-node ${tone}" aria-hidden="true"></span>

                        <div class="tl-event-top">
                          <div class="tl-event-lead">
                            <div class="ico ${tone}">${ic(svgName, 17)}</div>
                            <div class="tl-event-heading">
                              <div class="tl-event-title">${esc(t(a.title))}</div>
                              <div class="tl-event-meta">
                                <span class="tl-actor-name">${esc(a.userName || 'المسؤول العام')}</span>
                                ${a.userRole ? `<span>·</span><span>${esc(a.userRole)}</span>` : ''}
                                <span>·</span>
                                <span class="tl-action-label">${esc(t(vis.label))}</span>
                              </div>
                            </div>
                          </div>

                          <div class="tl-event-side">
                            <div class="tl-time-meta num" dir="ltr">
                              <span class="tl-time-primary">${timeFormatted}</span>
                              <span>·</span>
                              <span>${fullDateStr}</span>
                            </div>
                            ${a.clientId ? `
                              <button class="tl-client-link" onclick="selClient(${a.clientId})" title="${t('فتح ملف العميل')}">
                                ${ic('building', 13)}
                                <span>${esc(a.clientName || ('عميل #' + a.clientId))}</span>
                              </button>
                            ` : ''}
                          </div>
                        </div>

                        <div class="tl-event-desc">
                          ${esc(t(a.description))}
                        </div>

                        <div class="tl-event-foot">
                          <span class="tl-verified">
                            ${ic('check', 13)}
                            <span>${t('عملية معتمدة ومسجلة في النظام')}</span>
                          </span>
                          <span class="num">#${esc(String(a.id || ''))}</span>
                        </div>
                      </article>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}

      <div class="footer">
        <span>PROGILIC CRM v3 · ${t('مزامنة سحابية لحظية عبر كل المستخدمين والأجهزة')}</span>
        <span>${t('تحديث فوري وتفاعلي متزامن مع كل عملية')}</span>
      </div>

    </div>
  `;
}

function renderTimelineReport(report, activities, locale) {
  const categoryNames = {
    clients: 'العملاء',
    programs: 'البرامج والتراخيص',
    issues: 'المشاكل والدعم',
    requirements: 'المتطلبات',
    contacts: 'التواصل',
    backup: 'النسخ الاحتياطي',
    staff: 'المستخدمون والصلاحيات',
    system: 'النظام'
  };
  const maxCategory = Math.max(1, ...report.categories.map(item => item.count));
  const maxDay = Math.max(1, ...report.days.map(item => item.count));
  const maxUser = Math.max(1, ...report.users.slice(0, 5).map(item => item.count));
  const activeFilters = [
    S.timelineUserFilter !== 'all' ? `${S.timelineUserFilter}` : '',
    S.timelineCategoryFilter !== 'all' ? `${categoryNames[S.timelineCategoryFilter] || S.timelineCategoryFilter}` : '',
    S.timelineDateFrom || S.timelineDateTo ? `${S.timelineDateFrom || 'البداية'} - ${S.timelineDateTo || 'اليوم'}` : S.timelineDatePreset !== 'all' ? `${S.timelineDatePreset}` : '',
    S.timelineSearch ? `${S.timelineSearch}` : ''
  ].filter(Boolean);

  const reportTitle = t('📈 تقرير الإدارة عن الأنشطة').replace(/^📈\s*/, '');

  return `
    <section class="card c12 tl-report-card">
      <div class="chd" style="margin-bottom:0">
        <div>
          <h3>${esc(reportTitle)}</h3>
          <p>${t('تحليل العمليات الظاهرة وفق الفلاتر الحالية، وليس تقرير طباعة.')}</p>
        </div>
        <span style="margin-inline-start:auto;font-size:12px;color:var(--muted)">
          ${activeFilters.length ? activeFilters.map(esc).join(' · ') : t('كل العمليات المسجلة')}
        </span>
      </div>

      <div class="tl-stat-strip">
        ${[
          ['إجمالي العمليات', report.total, 'var(--sys-blue)'],
          ['مستخدمون نشطون', report.users.length, 'var(--sys-purple)'],
          ['عملاء جدد', report.clientsCreated, 'var(--sys-green)'],
          ['حذف عملاء', report.clientsDeleted, 'var(--sys-red)'],
          ['مشاكل مسجلة / محلولة', `${report.issuesCreated} / ${report.issuesResolved}`, 'var(--sys-orange)']
        ].map(([label, value, color]) => `
          <div class="tl-stat-cell">
            <span class="tl-stat-lbl">${t(label)}</span>
            <strong class="tl-stat-val num" style="color:${color}">${value}</strong>
          </div>
        `).join('')}
      </div>

      <div class="tl-analytics-grid">
        <div class="tl-analytics-col">
          <h4>${t('توزيع العمليات حسب القسم')}</h4>
          ${report.categories.length ? report.categories.map(item =>
            hbRow(categoryNames[item.category] || item.category, item.count, maxCategory, 'var(--sys-blue)')
          ).join('') : `<div class="tl-empty-inline">${t('لا توجد عمليات ضمن الفلاتر الحالية.')}</div>`}
        </div>

        <div class="tl-analytics-col">
          <h4>${t('أكثر المستخدمين نشاطاً')}</h4>
          ${report.users.length ? report.users.slice(0, 5).map(user =>
            hbRow(user.name, user.count, maxUser, 'var(--sys-purple)')
          ).join('') : `<div class="tl-empty-inline">${t('لا يوجد مستخدمون ضمن النتائج.')}</div>`}
        </div>

        <div class="tl-analytics-col">
          <h4>${t('حركة العمليات حسب اليوم')}</h4>
          ${report.days.length ? report.days.map(day => {
            const label = new Date(`${day.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
            return hbRow(label, day.count, maxDay, 'var(--sys-green)');
          }).join('') : `<div class="tl-empty-inline">${t('لا توجد تواريخ صالحة لعرض الحركة اليومية.')}</div>`}
        </div>

        <div class="tl-analytics-col">
          <h4>${t('أكثر أنواع الإجراءات تكراراً')}</h4>
          ${report.actions.length ? report.actions.map(action => `
            <div class="lrow" style="padding:7px 4px">
              <span style="color:var(--ink2);font-weight:500">${esc(t(action.label))}</span>
              <span class="n num">${action.count}</span>
            </div>
          `).join('') : `<div class="tl-empty-inline">${t('لا توجد إجراءات ضمن النتائج.')}</div>`}
        </div>
      </div>

      <div style="font-size:11.5px;color:var(--muted);padding-top:4px;border-top:1px solid var(--border-soft)">
        ${t('التقرير يعرض')} <strong class="num" style="color:var(--ink2)">${activities.length}</strong> ${t('عملية مطابقة؛ استخدم تصدير CSV لتنزيل تفاصيل هذه العمليات.')}
      </div>
    </section>
  `;
}
