/**
 * Calculates the current consecutive-day streak ending at `today`.
 * - Validates date strings and filters out invalid entries
 * - Deduplicates and sorts logDates
 * - If today is not in the set, returns 0
 * - Walks backwards counting consecutive dates (each exactly 1 day apart)
 * - Returns the count (including today)
 */
export function calculateStreak(logDates: string[], today: string): number {
  if (!logDates || logDates.length === 0) return 0;
  if (!isValidDateStr(today)) return 0;

  const validDates = logDates.filter(isValidDateStr);
  if (validDates.length === 0) return 0;

  const uniqueSorted = [...new Set(validDates)].sort();
  const dateSet = new Set(uniqueSorted);

  if (!dateSet.has(today)) return 0;

  let count = 1;
  let current = today;

  while (true) {
    const prev = getPreviousDate(current);
    if (dateSet.has(prev)) {
      count++;
      current = prev;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Returns true if the string is a valid YYYY-MM-DD date.
 */
function isValidDateStr(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for the day before the given date.
 */
function getPreviousDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
