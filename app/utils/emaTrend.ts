/**
 * EMA (Exponential Moving Average) trend computation for bodyweight data.
 *
 * Constants match the backend adaptive engine (src/modules/adaptive/engine.py):
 *   EMA_ALPHA = 0.25 (2 / (EMA_WINDOW + 1), where EMA_WINDOW = 7)
 *   MAX_DAILY_FLUCTUATION = 2.0 kg
 *
 * Pure functions — no React Native imports.
 */

export const EMA_ALPHA = 0.25; // Must match backend src/modules/adaptive/engine.py
export const EMA_MIN_POINTS = 3;

const MAX_DAILY_FLUCTUATION_KG = 2.0;
const KG_TO_LBS = 2.20462;

export interface WeightPoint {
  date: string; // ISO date string YYYY-MM-DD
  value: number; // kg
}

/**
 * Filter extreme day-over-day fluctuations (>2kg change).
 * The first entry is always kept. Subsequent entries are dropped if
 * |value - previous_kept_value| > threshold. Matches backend behavior.
 */
function filterExtremeFluctuations(sorted: WeightPoint[]): WeightPoint[] {
  if (sorted.length <= 1) return [...sorted];

  const filtered: WeightPoint[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prevValue = filtered[filtered.length - 1].value;
    if (Math.abs(sorted[i].value - prevValue) <= MAX_DAILY_FLUCTUATION_KG) {
      filtered.push(sorted[i]);
    }
  }
  return filtered;
}

/**
 * Compute EMA series from sorted weight entries.
 * Returns empty array if fewer than EMA_MIN_POINTS entries after filtering.
 * Filters extreme fluctuations (>2kg/day change) before computing.
 * EMA formula: EMA[0] = first value, EMA[i] = alpha * value[i] + (1-alpha) * EMA[i-1]
 */
export function computeEMA(weights: WeightPoint[]): WeightPoint[] {
  const sorted = [...weights].sort(
    (a, b) => a.date.localeCompare(b.date),
  );

  const filtered = filterExtremeFluctuations(sorted);

  if (filtered.length < EMA_MIN_POINTS) return [];

  const result: WeightPoint[] = [];
  let ema = filtered[0].value;
  result.push({ date: filtered[0].date, value: ema });

  for (let i = 1; i < filtered.length; i++) {
    ema = EMA_ALPHA * filtered[i].value + (1 - EMA_ALPHA) * ema;
    result.push({ date: filtered[i].date, value: ema });
  }

  return result;
}

/**
 * Weekly change = EMA(latest) - EMA(7 days ago).
 * Finds the EMA point closest to 7 days before the latest point.
 * Returns null if insufficient history or no point within 3 days of the target.
 */
export function computeWeeklyChange(
  emaSeries: WeightPoint[],
): number | null {
  if (emaSeries.length < 2) return null;

  const latest = emaSeries[emaSeries.length - 1];
  const latestDate = new Date(latest.date);
  const targetDate = new Date(latestDate);
  targetDate.setDate(targetDate.getDate() - 7);

  let closestPoint: WeightPoint | null = null;
  let closestDiff = Infinity;

  for (const point of emaSeries) {
    const pointDate = new Date(point.date);
    const diffMs = Math.abs(pointDate.getTime() - targetDate.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < closestDiff) {
      closestDiff = diffDays;
      closestPoint = point;
    }
  }

  // No point within 3 days of the 7-day-ago target
  if (closestPoint === null || closestDiff > 3) return null;

  // Don't return 0 change if the closest point IS the latest point
  if (closestPoint.date === latest.date) return null;

  return latest.value - closestPoint.value;
}

/**
 * Format weekly change for display.
 * Returns "↓0.3kg" for negative, "↑0.2kg" for positive, "→0.0kg" for zero, "—" for null.
 * Supports kg and lbs units.
 */
export function formatWeeklyChange(
  change: number | null,
  unit: 'kg' | 'lbs',
): string {
  if (change === null) return '—';

  const converted = unit === 'lbs' ? change * KG_TO_LBS : change;
  const abs = Math.abs(converted);
  const formatted = abs.toFixed(1);
  const suffix = unit;

  if (converted < 0) return `↓${formatted}${suffix}`;
  if (converted > 0) return `↑${formatted}${suffix}`;
  return `→${formatted}${suffix}`;
}
