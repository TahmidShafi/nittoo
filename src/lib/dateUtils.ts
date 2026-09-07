// ==============================================================================
// Nittoo Date Utilities
// UTC-Safe Date Arithmetic and Formatting (YYYY-MM-DD)
// ==============================================================================

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Parses a YYYY-MM-DD string into UTC midnight timestamp
 */
export function parseISODateToUTC(dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [year, month, day] = parts;
  return Date.UTC(year, month - 1, day);
}

/**
 * Returns today's date in UTC as a YYYY-MM-DD string
 */
export function getTodayUTC(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the exact integer days between two YYYY-MM-DD dates (inclusive or exclusive based on calendar day difference)
 * Example: 2026-06-01 to 2026-06-02 = 1 day
 */
export function getDaysBetween(startDateStr: string, endDateStr: string): number {
  const startUTC = parseISODateToUTC(startDateStr);
  const endUTC = parseISODateToUTC(endDateStr);
  return Math.round((endUTC - startUTC) / MILLISECONDS_PER_DAY);
}

/**
 * Calculates days used from opened_date to reference date (default: today UTC).
 * Minimum return is 0 days.
 */
export function getDaysUsed(openedDateStr: string, referenceDateStr: string = getTodayUTC()): number {
  const diff = getDaysBetween(openedDateStr, referenceDateStr);
  return Math.max(0, diff);
}

/**
 * Adds integer days to a YYYY-MM-DD date, returning a new YYYY-MM-DD string
 */
export function addDays(dateStr: string, days: number): string {
  const startUTC = parseISODateToUTC(dateStr);
  const resultDate = new Date(startUTC + days * MILLISECONDS_PER_DAY);
  const year = resultDate.getUTCFullYear();
  const month = String(resultDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(resultDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date for UI display (e.g. "Aug 30, 2026")
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats an ISO string or YYYY-MM-DD date for display
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return formatDisplayDate(dateStr.slice(0, 10));
}
