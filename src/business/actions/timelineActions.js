import { S, updateState } from '../../state/store.js';
import { R } from '../../presentation/render-core.js';
import { loadGlobalActivities, ActivityType } from '../timelineService.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';

export { loadGlobalActivities };

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
  await loadGlobalActivities();
  showToast(t("تم تحديث المخطط الزمني وسجل العمليات بنجاح"), "success");
  R();
}

export function exportGlobalTimelineCSV() {
  const activities = getFilteredTimelineList();
  if (!activities || activities.length === 0) {
    showToast(t("لا توجد عمليات لتصديرها وفق الفلاتر الحالية"), "info");
    return;
  }

  const headers = [
    "المعرف",
    "التاريخ والوقت",
    "اسم المستخدم",
    "القسم / المنصب",
    "نوع العملية",
    "القسم",
    "العميل",
    "عنوان الإجراء",
    "تفاصيل العملية"
  ];

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = activities.map(a => [
    escapeCSV(a.id || ''),
    escapeCSV(a.timestamp ? new Date(a.timestamp).toLocaleString('ar-DZ') : ''),
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

  showToast(t("تم تصدير تقرير المخطط الزمني بنجاح!"), "success");
}

export function printGlobalTimeline() {
  window.print();
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
      return uName === target || (a.userId && String(a.userId) === String(target));
    });
  }

  // 2. Filter by Category
  if (S.timelineCategoryFilter && S.timelineCategoryFilter !== 'all') {
    list = list.filter(a => a.category === S.timelineCategoryFilter);
  }

  // 3. Filter by Date Presets and Range
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (S.timelineDatePreset === 'today') {
    list = list.filter(a => a.timestamp && a.timestamp.startsWith(todayStr));
  } else if (S.timelineDatePreset === 'yesterday') {
    const yest = new Date(now.getTime() - 86400000);
    const yestStr = yest.toISOString().split('T')[0];
    list = list.filter(a => a.timestamp && a.timestamp.startsWith(yestStr));
  } else if (S.timelineDatePreset === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    list = list.filter(a => a.timestamp && new Date(a.timestamp) >= weekAgo);
  } else if (S.timelineDatePreset === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    list = list.filter(a => a.timestamp && new Date(a.timestamp) >= monthStart);
  } else if (S.timelineDatePreset === 'custom' || S.timelineDateFrom || S.timelineDateTo) {
    if (S.timelineDateFrom) {
      const fromTime = new Date(S.timelineDateFrom).getTime();
      list = list.filter(a => a.timestamp && new Date(a.timestamp).getTime() >= fromTime);
    }
    if (S.timelineDateTo) {
      // End of that day
      const toTime = new Date(`${S.timelineDateTo}T23:59:59.999Z`).getTime();
      list = list.filter(a => a.timestamp && new Date(a.timestamp).getTime() <= toTime);
    }
  }

  // 4. Free Text Search Filter
  if (S.timelineSearch && S.timelineSearch.trim()) {
    const q = S.timelineSearch.trim().toLowerCase();
    list = list.filter(a => {
      const u = (a.userName || '').toLowerCase();
      const c = (a.clientName || '').toLowerCase();
      const t = (a.title || '').toLowerCase();
      const d = (a.description || '').toLowerCase();
      const r = (a.userRole || '').toLowerCase();
      return u.includes(q) || c.includes(q) || t.includes(q) || d.includes(q) || r.includes(q);
    });
  }

  // Sort newest first
  list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  return list;
}
