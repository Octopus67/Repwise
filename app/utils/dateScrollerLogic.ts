/**
 * Date scroller logic — week generation, day cell formatting, logged dates.
 *
 * Pure functions — no React Native imports.
 */

export interface DayCell {
  dayName: string;
  dayNumber: number;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Get the 7 ISO date strings (Mon–Sun) for the week containing referenceDate.
 */
export function getWeekDates(referenceDate: string): string[] {
  const d = new Date(referenceDate + 'T12:00:00');
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  const jsDay = d.getDay();
  // Convert to Mon=0 offset
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;

  const monday = new Date(d);
  monday.setDate(d.getDate() - mondayOffset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    dates.push(day.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Format a date string into a day cell with abbreviated name and day number.
 */
export function formatDayCell(dateStr: string): DayCell {
  const d = new Date(dateStr + 'T12:00:00');
  const jsDay = d.getDay();
  const mondayIndex = jsDay === 0 ? 6 : jsDay - 1;
  return {
    dayName: DAY_NAMES[mondayIndex],
    dayNumber: d.getDate(),
  };
}

/**
 * Extract the set of unique entry_date values from entries.
 */
export function getLoggedDatesSet(
  entries: Array<{ entry_date: string }>,
): Set<string> {
  return new Set(entries.map((e) => e.entry_date));
}
