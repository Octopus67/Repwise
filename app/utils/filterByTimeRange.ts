/**
 * Filter trend data points by a time range relative to today.
 */

import type { TimeRange, TrendPoint } from '../types/analytics';

export type { TimeRange, TrendPoint };

const RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

/**
 * Filter data points to only include those within the specified time range from today.
 * Points with date >= (today - days) are included.
 */
export function filterByTimeRange(
  data: TrendPoint[],
  range: TimeRange,
): TrendPoint[] {
  const days = RANGE_DAYS[range];
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);

  return data.filter((point) => {
    const pointDate = new Date(point.date + 'T00:00:00');
    return pointDate >= cutoff;
  });
}
