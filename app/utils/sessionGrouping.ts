/**
 * Session Grouping Utility
 *
 * Groups training sessions by date for display in LogsScreen.
 */

import type { TrainingSessionResponse } from '../types/training';

/**
 * Group sessions by session_date, sorted descending (most recent first).
 */
export function groupSessionsByDate(
  sessions: TrainingSessionResponse[],
): Array<{ date: string; sessions: TrainingSessionResponse[] }> {
  const map = new Map<string, TrainingSessionResponse[]>();

  for (const session of sessions) {
    const date = session.session_date;
    const group = map.get(date);
    if (group) {
      group.push(session);
    } else {
      map.set(date, [session]);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([date, sessions]) => ({ date, sessions }));
}
