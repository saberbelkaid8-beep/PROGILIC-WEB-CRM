/**
 * PROGILIC CRM v3 — Hardened Timeline CSV Export Builder
 * 
 * Ensures every header label and activity property passes through formatCsvCell
 * to protect against spreadsheet formula injection across timeline exports.
 */

import { formatCsvCell } from '../../utils/csv.js';
import { t } from '../../utils/i18n.js';

export function buildTimelineCSV(activities, locale = 'ar-DZ') {
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

  const headerRow = headers.map(h => formatCsvCell(h)).join(",");

  const rows = (activities || []).map(a => [
    formatCsvCell(a.id || ''),
    formatCsvCell(a.timestamp ? new Date(a.timestamp).toLocaleString(locale) : ''),
    formatCsvCell(a.userName || 'المسؤول العام'),
    formatCsvCell(a.userRole || ''),
    formatCsvCell(a.title || a.type || ''),
    formatCsvCell(a.category || ''),
    formatCsvCell(a.clientName || (a.clientId ? `عميل #${a.clientId}` : '')),
    formatCsvCell(a.title || ''),
    formatCsvCell(a.description || '')
  ].join(","));

  return "\uFEFF" + [headerRow, ...rows].join("\r\n");
}
