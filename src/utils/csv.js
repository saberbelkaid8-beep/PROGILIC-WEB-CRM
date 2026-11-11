/**
 * PROGILIC CRM v3 — CSV & Spreadsheet Serialization Sanitizer
 * 
 * Sanitizes CSV cells to protect against Spreadsheet Formula Injection (CSV Injection)
 * while safely preserving leading zeros (e.g. Algerian phone numbers) and long numeric
 * identifiers (NIF, NIS, R.C.) without introducing executable formulas.
 */

export function formatCsvCell(v) {
  if (v === null || v === undefined) return '""';
  let str = String(v);

  // Check if string contains or starts with formula triggers, even after leading whitespace
  const trimmed = str.trimStart();
  const hasFormulaTrigger = /^[=+\-@\t\r]/.test(trimmed) || /^[\t\r\n]/.test(str);

  if (hasFormulaTrigger) {
    // If it is a standard clean signed number like "-5" or "+10.5", allow it as numeric
    const isCleanNumber = /^[+-]?\d+(\.\d+)?$/.test(trimmed);
    if (!isCleanNumber) {
      str = "'" + str;
    }
  } else if (/^0\d+$/.test(str) || (/^\d{12,}$/.test(str))) {
    // Leading zeros or long numeric IDs: prefix with single quote to preserve as text in Excel/LibreOffice without formulas
    str = "'" + str;
  }

  return `"${str.replace(/"/g, '""')}"`;
}
