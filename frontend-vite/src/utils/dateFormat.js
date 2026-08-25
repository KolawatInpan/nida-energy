/**
 * Shared date formatting utilities — consistent "DD Mmm YYYY" format.
 *
 * fmtDate(date)         → "10 Jul 2026"
 * fmtDateTime(date)     → "10 Jul 2026, 14:30"
 * fmtTime(date)         → "14:30"
 * fmtDateFull(date)     → "10 July 2026"
 * fmtISO(date)          → "2026-07-10"  (for <input type="date">, API params)
 */

const LOCALE = 'en-GB';

/**
 * Format date as "DD Mmm YYYY" (e.g., "10 Jul 2026").
 * @param {Date|string|number} value
 * @returns {string}
 */
export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format datetime as "DD Mmm YYYY, HH:MM" (e.g., "10 Jul 2026, 14:30").
 * @param {Date|string|number} value
 * @returns {string}
 */
export function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })
    + ', '
    + d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format time as "HH:MM" (24h, e.g., "14:30").
 * @param {Date|string|number} value
 * @returns {string}
 */
export function fmtTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format date as "DD MMMM YYYY" (e.g., "10 July 2026").
 * @param {Date|string|number} value
 * @returns {string}
 */
export function fmtDateFull(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Format as "YYYY-MM-DD" for <input type="date"> and API params.
 * @param {Date|string|number} value
 * @returns {string}
 */
export function fmtISO(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default { fmtDate, fmtDateTime, fmtTime, fmtDateFull, fmtISO };
