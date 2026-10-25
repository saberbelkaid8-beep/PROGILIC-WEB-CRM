import { S, updateState, hasPermission } from '../../state/store.js';
import { R } from '../../presentation/render-core.js';
import { loadGlobalActivities, ActivityType, getActivityVisuals, logActivity, syncCrmServicesToTimeline } from '../timelineService.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';

export { loadGlobalActivities, syncCrmServicesToTimeline };

export async function syncAllCrmServicesAction() {
  if (!hasPermission('timeline.view')) return;
  const uid = S.currentUser?.uid;
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
