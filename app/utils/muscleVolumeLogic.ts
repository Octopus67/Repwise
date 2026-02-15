/**
 * Pure utility functions for muscle volume heat map feature.
 */

const STATUS_COLORS: Record<string, string> = {
  below_mev: '#6B7280',
  optimal: '#22C55E',
  approaching_mrv: '#EAB308',
  above_mrv: '#EF4444',
};

/** Map volume status to hex color. */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#6B7280';
}

/** Format frequency display string. */
export function formatFrequency(muscleGroup: string, frequency: number, sets: number): string {
  return `${muscleGroup}: ${frequency}×/week, ${sets} sets`;
}

/** Get the Monday (ISO week start) for a given date. */
export function getWeekStart(d: Date): string {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy.toISOString().split('T')[0];
}

/** Check if a week start date is the current or a future week. */
export function isCurrentOrFutureWeek(weekStart: string): boolean {
  const currentMonday = getWeekStart(new Date());
  return weekStart >= currentMonday;
}

/** Get the Monday of the adjacent week. */
export function getAdjacentWeek(weekStart: string, direction: 'prev' | 'next'): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
  return d.toISOString().split('T')[0];
}

/** Format a week range for display (e.g., "Jan 15 – Jan 21"). */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Status label for display. */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    below_mev: 'Below MEV',
    optimal: 'Optimal',
    approaching_mrv: 'Approaching MRV',
    above_mrv: 'Above MRV',
  };
  return labels[status] ?? status;
}
