/**
 * Date Validation Utility
 */

/**
 * Validate that a date string is today or in the past (rejects future dates).
 * Expects ISO date format "YYYY-MM-DD".
 */
export function isValidSessionDate(dateStr: string): boolean {
  const parsed = new Date(dateStr + 'T00:00:00');
  if (isNaN(parsed.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);

  return parsed <= today;
}
