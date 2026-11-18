import { S, clients, getClients, hasPermission, getActiveTenantId } from '../../state/store.js';
import { R } from '../../presentation/render-core.js';
import { loadGlobalActivities, ActivityType, getActivityVisuals, logActivity, syncCrmServicesToTimeline } from '../timelineService.js';
import { getClientProgramsPurgeCutoff } from '../programRecovery.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';

export { loadGlobalActivities, syncCrmServicesToTimeline };

export async function syncAllCrmServicesAction() {
  if (!hasPermission('timeline.view')) return;
  const uid = getActiveTenantId() || S.currentUser?.tenantId || S.currentUser?.uid;
  if (!uid) {
    showToast(t("يرجى تسجيل الدخول أولاً"), "warning");
    return;
  }
  showToast(t("جاري استخراج ورفع خدمات الـ CRM إلى المخطط الزمني والسحابة..."), "info");
  const list = await syncCrmServicesToTimeline(uid);
  showToast(t(`تمت مزامنة ${list.length} خدمة وعملية في المخطط الزمني بنجاح!`), "success");
  R();
}

export function setTimelineUserFilter(userName) {
  S.timelineUserFilter = userName;
  R();
}

export function setTimelineDatePreset(preset) {
  S.timelineDatePreset = preset;
  if (preset !== 'custom') {
    S.timelineDateFrom = '';
    S.timelineDateTo = '';
  }
  R();
}

export function setTimelineDateFrom(dateStr) {
  S.timelineDateFrom = dateStr;
  S.timelineDatePreset = 'custom';
  R();
}

export function setTimelineDateTo(dateStr) {
  S.timelineDateTo = dateStr;
  S.timelineDatePreset = 'custom';
  R();
}

export function clearTimelineDates() {
  S.timelineDateFrom = '';
  S.timelineDateTo = '';
  S.timelineDatePreset = 'all';
  R();
}

export function setTimelineCategoryFilter(cat) {
  S.timelineCategoryFilter = cat;
  R();
}

export function setTimelineSearch(q) {
  S.timelineSearch = q;
  R();
}

export function clearTimelineFilters() {
  S.timelineUserFilter = 'all';
  S.timelineDatePreset = 'all';
  S.timelineDateFrom = '';
  S.timelineDateTo = '';
  S.timelineCategoryFilter = 'all';
  S.timelineSearch = '';
  R();
}

export async function refreshGlobalTimeline() {
  if (!hasPermission('timeline.view')) return;
  await loadGlobalActivities();
  showToast(t("تم تحديث المخطط الزمني وسجل العمليات بنجاح"), "success");
  R();
}

export function exportGlobalTimelineCSV() {
  if (!hasPermission('timeline.view')) return;
  const activities = getFilteredTimelineList();
  if (!activities || activities.length === 0) {
    showToast(t("لا توجد عمليات لتصديرها وفق الفلاتر الحالية"), "info");
    return;
  }

  const headers = [
    t("المعرف"),
    t("التاريخ والوقت"),
    t("اسم المستخدم"),
    t("القسم / المنصب"),
    t("نوع العملية"),
    t("القسم"),
    t("العميل"),
    t("عنوان الإجراء"),
    t("تفاصيل العملية")
  ];
  const locale = S.lang === 'fr' ? 'fr-FR' : S.lang === 'en' ? 'en-US' : 'ar-DZ';

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = activities.map(a => [
    escapeCSV(a.id || ''),
    escapeCSV(a.timestamp ? new Date(a.timestamp).toLocaleString(locale) : ''),
    escapeCSV(a.userName || 'المسؤول العام'),
    escapeCSV(a.userRole || ''),
    escapeCSV(a.title || a.type || ''),
    escapeCSV(a.category || ''),
    escapeCSV(a.clientName || (a.clientId ? `عميل #${a.clientId}` : '')),
    escapeCSV(a.title || ''),
    escapeCSV(a.description || '')
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `progilic_crm_timeline_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  logActivity(null, ActivityType.DATA_EXPORTED, 'تصدير تقرير المخطط الزمني', `تم تصدير ${activities.length} عملية بعد تطبيق الفلاتر الحالية.`).catch(console.warn);
  showToast(t("تم تصدير تقرير المخطط الزمني بنجاح!"), "success");
}

function parseMarkdownFilterDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function isTimestampInMarkdownRange(value, start, end) {
  if (!value) return false;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())
    ? parseMarkdownFilterDate(value)
    : new Date(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return false;
  const ts = parsed.getTime();
  return (!start || ts >= start.getTime()) && (!end || ts < end.getTime());
}

export function buildClientsTimelineMarkdown() {
  const rawActivities = getFilteredTimelineList();
  const locale = S.lang === 'fr' ? 'fr-FR' : S.lang === 'en' ? 'en-US' : 'ar-DZ';
  const fromDate = parseMarkdownFilterDate(S.timelineDateFrom);
  const toDate = parseMarkdownFilterDate(S.timelineDateTo);
  const afterToDate = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1) : null;
  const defaultActor = S.currentUser?.email || 'المسؤول العام';

  const currentClients = Array.isArray(getClients?.() || clients) ? (getClients?.() || clients) : [];
  const clientById = new Map(currentClients.filter(Boolean).map(c => [String(c.id), c]));
  const allGlobalActs = Array.isArray(S.globalActivities) ? S.globalActivities : rawActivities;

  const activities = rawActivities.filter(act => {
    if (!act || act.type !== ActivityType.PROGRAM_ADDED || !act.clientId) return true;
    const clientObj = clientById.get(String(act.clientId));
    if (!clientObj) return true;
    const hasCurrentPrograms = Array.isArray(clientObj.programs) && clientObj.programs.length > 0;
    if (hasCurrentPrograms) return true;
    const purgeCutoff = getClientProgramsPurgeCutoff(clientObj, allGlobalActs);
    if (purgeCutoff && (!act.timestamp || act.timestamp <= purgeCutoff)) {
      return false;
    }
    return true;
  });

  const existingIds = new Set(activities.map(a => String(a.id)));
  const combined = [...activities];

  // Ensure all matching clients/sub-items in memory since the selected date are included even if not yet synced to globalActivities
  if (S.timelineUserFilter === 'all' && (!S.timelineSearch || !S.timelineSearch.trim())) {
    for (const c of currentClients) {
      if (!c || !c.id) continue;
      const clientName = c.fullName || c.name || `عميل #${c.id}`;

      const clientActId = `act_client_${c.id}`;
      if (
        (S.timelineCategoryFilter === 'all' || S.timelineCategoryFilter === 'clients') &&
        !existingIds.has(clientActId) &&
        c.startDate &&
        (!fromDate && !afterToDate || isTimestampInMarkdownRange(c.startDate, fromDate, afterToDate))
      ) {
        combined.push({
          id: clientActId,
          clientId: Number(c.id),
          clientName,
          type: ActivityType.CLIENT_CREATED,
          category: 'clients',
          title: `تسجيل واعتماد العميل (${clientName})`,
          description: `تسجيل العميل في نظام PROGILIC CRM بنشاط: ${c.businessType || 'عام'}${c.businessField ? ` - ${c.businessField}` : ''}، الولاية: ${c.wilaya || 'غير محدد'}.`,
          timestamp: `${c.startDate}T00:00:00.000Z`,
          actorEmail: defaultActor,
          userName: defaultActor
        });
        existingIds.add(clientActId);
      }

      if (
        (S.timelineCategoryFilter === 'all' || S.timelineCategoryFilter === 'programs') &&
        Array.isArray(c.programs)
      ) {
        c.programs.forEach((p, idx) => {
          if (!p) return;
          const progId = p.id || `p_${idx}`;
          const progActId = `act_prog_${c.id}_${progId}`;
          const progDate = p.startDate || c.startDate;
          const alreadyExists = existingIds.has(progActId) || combined.some(a =>
            Number(a.clientId) === Number(c.id) &&
            a.type === ActivityType.PROGRAM_ADDED &&
            ((a.meta?.programId !== undefined && String(a.meta.programId) === String(progId)) ||
              (p.programName && String(a.description || '').includes(`"${p.programName}"`)))
          );
          if (!alreadyExists && progDate && (!fromDate && !afterToDate || isTimestampInMarkdownRange(progDate, fromDate, afterToDate))) {
            combined.push({
              id: progActId,
              clientId: Number(c.id),
              clientName,
              type: ActivityType.PROGRAM_ADDED,
              category: 'programs',
              title: `خدمة ترخيص برنامج: ${p.programName || 'برنامج PROGILIC'}`,
              description: `تقديم وتثبيت خدمة برمجية "${p.programName || 'برنامج'}" للعميل ${clientName} - المنصة: ${p.platform || 'Desktop'} - نوع الخدمة: ${p.type || 'تجاري'} - أجهزة مرخصة: ${p.installationsCount || 1} محطة${p.startDate ? ` (البداية: ${p.startDate})` : ''}${p.endDate ? ` (النهاية: ${p.endDate})` : ''} .`,
              timestamp: `${progDate}T09:00:00.000Z`,
              actorEmail: defaultActor,
              userName: defaultActor
            });
            existingIds.add(progActId);
          }
        });
      }
    }
  }

  if (combined.length === 0) return '';

  // Group activities by client
  const groups = new Map();
  for (const act of combined) {
    const key = act.clientId ? `client:${act.clientId}` : (act.clientName ? `name:${act.clientName}` : 'system:general');
    if (!groups.has(key)) {
      groups.set(key, {
        clientId: act.clientId || null,
        clientName: act.clientName || (act.clientId ? `عميل #${act.clientId}` : 'عمليات النظام العامة'),
        items: []
      });
    }
    groups.get(key).items.push(act);
  }

  const sortedGroups = [...groups.values()].map(group => {
    group.items.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    return group;
  }).sort((a, b) => String(b.items[0]?.timestamp || '').localeCompare(String(a.items[0]?.timestamp || '')));

  const headerPeriod = S.timelineDateFrom || S.timelineDateTo
    ? `${S.timelineDateFrom || 'البداية'} → ${S.timelineDateTo || 'اليوم'}`
    : (S.timelineDatePreset && S.timelineDatePreset !== 'all' ? S.timelineDatePreset : 'كل الأوقات');

  const lines = [
    `# سجل العملاء والأنشطة — PROGILIC CRM`,
    ``,
    `- **الفترة:** ${headerPeriod}`,
    `- **عدد العملاء / المجموعات:** ${sortedGroups.length}`,
    `- **إجمالي الأنشطة:** ${combined.length}`,
    ``,
    `---`,
    ``
  ];

  for (const group of sortedGroups) {
    lines.push(`## ${group.clientName}`);
    lines.push(`الخط الزمني للنشاط (${group.items.length})`);
    lines.push(``);

    for (const act of group.items) {
      const vis = getActivityVisuals(act.type);
      const dateStr = act.timestamp
        ? new Date(act.timestamp).toLocaleString(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '';
      const executor = act.actorEmail || act.userName || 'المسؤول العام';

      lines.push(`${vis.icon}`);
      lines.push(`**${t(vis.label)}**`);
      if (dateStr) lines.push(`${dateStr}`);
      if (act.title) lines.push(`**${t(act.title)}**`);
      if (act.description) lines.push(`${t(act.description)}`);
      lines.push(`👤 المنفذ: ${executor}`);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(``);
  }

  return lines.join('\n');
}

export function exportGlobalTimelineMarkdown() {
  if (!hasPermission('timeline.view')) return;
  const markdownContent = buildClientsTimelineMarkdown();
  if (!markdownContent) {
    showToast(t("لا توجد عمليات أو عملاء لتصديرها وفق الفلاتر الحالية"), "info");
    return;
  }

  const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateTag = S.timelineDateFrom ? `since_${S.timelineDateFrom}` : new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `progilic_crm_clients_${dateTag}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  logActivity(null, ActivityType.DATA_EXPORTED, 'تصدير سجل العملاء والنشاط (Markdown)', `تم تصدير ملف Markdown وفق الفلاتر الحالية.`).catch(console.warn);
  showToast(t("تم تصدير ملف Markdown (.md) بنجاح!"), "success");
}

export function buildClientNamesOnlyMarkdown() {
  const currentClients = Array.isArray(getClients?.() || clients) ? (getClients?.() || clients) : [];
  const fromDate = parseMarkdownFilterDate(S.timelineDateFrom);
  const toDate = parseMarkdownFilterDate(S.timelineDateTo);
  const afterToDate = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1) : null;

  const seenNames = new Set();
  const matchedClients = [];

  for (const c of currentClients) {
    if (!c) continue;
    const name = String(c.fullName || c.name || '').trim();
    if (!name) continue;
    if (fromDate || afterToDate) {
      if (!c.startDate || !isTimestampInMarkdownRange(c.startDate, fromDate, afterToDate)) continue;
    }
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    matchedClients.push({ name, startDate: c.startDate || '', wilaya: c.wilaya || '' });
  }

  if (matchedClients.length === 0) return '';

  const headerPeriod = S.timelineDateFrom || S.timelineDateTo
    ? `${S.timelineDateFrom || 'البداية'} → ${S.timelineDateTo || 'اليوم'}`
    : 'كل الأوقات';

  const lines = [
    `# قائمة أسماء العملاء — PROGILIC CRM`,
    ``,
    `- **الفترة:** ${headerPeriod}`,
    `- **إجمالي العملاء:** ${matchedClients.length}`,
    ``,
    `---`,
    ``
  ];

  matchedClients.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.name}`);
  });

  return lines.join('\n');
}

export function exportClientNamesMarkdown() {
  if (!hasPermission('timeline.view')) return;
  const markdownContent = buildClientNamesOnlyMarkdown();
  if (!markdownContent) {
    showToast(t("لا توجد أسماء عملاء مطابقة للفترة الحالية"), "info");
    return;
  }

  const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateTag = S.timelineDateFrom ? `since_${S.timelineDateFrom}` : new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `progilic_crm_client_names_${dateTag}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(t("تم تصدير قائمة أسماء العملاء (.md) بنجاح!"), "success");
}

export function printGlobalTimeline() {
  window.print();
}

export function buildTimelineReport(activities) {
  const categoryCounts = new Map();
  const userCounts = new Map();
  const dayCounts = new Map();
  const typeCounts = new Map();

  for (const activity of activities) {
    const visuals = getActivityVisuals(activity.type);
    const category = activity.category || visuals.category || 'system';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

    const userId = String(activity.userId || activity.actorUid || activity.userName || 'unknown');
    const user = userCounts.get(userId) || { id: userId, name: activity.userName || 'المسؤول العام', count: 0 };
    user.count++;
    userCounts.set(userId, user);

    const timestamp = new Date(activity.timestamp);
    if (!Number.isNaN(timestamp.getTime())) {
      const day = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}`;
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }

    const type = activity.type || 'UNKNOWN';
    const action = typeCounts.get(type) || { type, label: visuals.label, count: 0 };
    action.count++;
    typeCounts.set(type, action);
  }

  return {
    total: activities.length,
    users: [...userCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    categories: [...categoryCounts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    days: [...dayCounts.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)).slice(-7),
    actions: [...typeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    clientsCreated: activities.filter(activity => activity.type === ActivityType.CLIENT_CREATED).length,
    clientsDeleted: activities.filter(activity => activity.type === ActivityType.CLIENT_DELETED).length,
    issuesCreated: activities.filter(activity => activity.type === ActivityType.ISSUE_ADDED).length,
    issuesResolved: activities.filter(activity => activity.type === ActivityType.ISSUE_RESOLVED).length
  };
}

/**
 * Filters the active activities array according to current user filter,
 * date range, category, and search query.
 */
export function getFilteredTimelineList() {
  let list = Array.isArray(S.globalActivities) ? [...S.globalActivities] : [];

  // 1. Filter by User
  if (S.timelineUserFilter && S.timelineUserFilter !== 'all') {
    list = list.filter(a => {
      const uName = (a.userName || '').trim().toLowerCase();
      const target = S.timelineUserFilter.trim().toLowerCase();
      return uName === target
        || String(a.userId || '').toLowerCase() === target
        || String(a.actorUid || '').toLowerCase() === target;
    });
  }

  // 2. Filter by Category
  if (S.timelineCategoryFilter && S.timelineCategoryFilter !== 'all') {
    list = list.filter(a => (a.category || getActivityVisuals(a.type).category) === S.timelineCategoryFilter);
  }

  // 3. Filter by Date Presets and Range
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const startOfDayBeforeYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);

  if (S.timelineDatePreset === 'today') {
    list = list.filter(a => isInRange(a.timestamp, startOfToday, startOfTomorrow));
  } else if (S.timelineDatePreset === 'yesterday') {
    list = list.filter(a => isInRange(a.timestamp, startOfYesterday, startOfToday));
  } else if (S.timelineDatePreset === 'day_before_yesterday' || S.timelineDatePreset === 'dayBeforeYesterday') {
    list = list.filter(a => isInRange(a.timestamp, startOfDayBeforeYesterday, startOfYesterday));
  } else if (S.timelineDatePreset === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    list = list.filter(a => isInRange(a.timestamp, weekAgo, new Date(now.getTime() + 1)));
  } else if (S.timelineDatePreset === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    list = list.filter(a => isInRange(a.timestamp, monthStart, startOfTomorrow));
  } else if (S.timelineDatePreset === 'custom' || S.timelineDateFrom || S.timelineDateTo) {
    const fromDate = parseLocalDate(S.timelineDateFrom);
    const toDate = parseLocalDate(S.timelineDateTo);
    if ((S.timelineDateFrom && !fromDate) || (S.timelineDateTo && !toDate)) return [];
    const afterToDate = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1) : null;
    if (fromDate && afterToDate && fromDate >= afterToDate) return [];
    list = list.filter(a => isInRange(a.timestamp, fromDate, afterToDate));
  }

  // 4. Free Text Search Filter
  if (S.timelineSearch && S.timelineSearch.trim()) {
    const terms = S.timelineSearch.trim().toLocaleLowerCase().split(/\s+/);
    list = list.filter(a => {
      const searchable = [
        a.userName, a.clientName, a.title, a.description, a.userRole, a.type, a.category, a.source,
        a.clientId, a.actorEmail
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }

  function parseLocalDate(value) {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function isInRange(value, start, end) {
    const timestamp = new Date(value).getTime();
    return !Number.isNaN(timestamp) && (!start || timestamp >= start.getTime()) && (!end || timestamp < end.getTime());
  }

  // Sort newest first
  list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  return list;
}
