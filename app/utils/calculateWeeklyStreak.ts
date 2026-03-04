/**
 * Calculates the current weekly training streak.
 * A streak counts consecutive weeks where the user trained at least once.
 * Weeks are Monday-Sunday (ISO week).
 */

import { getWeekDates } from './dateScrollerLogic';

export function calculateWeeklyStreak(trainedDates: string[], today: string): number {
  if (!trainedDates || trainedDates.length === 0) return 0;
  if (!isValidDateStr(today)) return 0;

  const validDates = trainedDates.filter(isValidDateStr);
  if (validDates.length === 0) return 0;

  const dateSet = new Set(validDates);
  
  // Get current week dates
  const currentWeekDates = getWeekDates(today);
  
  // Check if current week has any training
  const hasCurrentWeekTraining = currentWeekDates.some(date => dateSet.has(date));
  if (!hasCurrentWeekTraining) return 0;

  let streak = 1;
  let checkDate = today;

  // Go back week by week
  while (true) {
    // Get previous week's Monday
    const prevWeekMonday = getPreviousWeekMonday(checkDate);
    const prevWeekDates = getWeekDates(prevWeekMonday);
    
    // Check if previous week has any training
    const hasPrevWeekTraining = prevWeekDates.some(date => dateSet.has(date));
    
    if (hasPrevWeekTraining) {
      streak++;
      checkDate = prevWeekMonday;
    } else {
      break;
    }
  }

  return streak;
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
 * Returns the Monday of the previous week for the given date.
 */
function getPreviousWeekMonday(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  
  // Get current week's Monday
  const jsDay = date.getDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - mondayOffset);
  
  // Go back 7 days to get previous week's Monday
  monday.setDate(monday.getDate() - 7);
  
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}