import * as fc from 'fast-check';
import {
  computeEMA,
  computeWeeklyChange,
  formatWeeklyChange,
  EMA_ALPHA,
  EMA_MIN_POINTS,
  WeightPoint,
} from '../../utils/emaTrend';

/**
 * Feature: competitive-parity-v1, Properties 9, 10, 11
 * Validates: Requirements 4.1.2, 4.1.5, 4.1.6
 */

// --- Helpers ---

/** Build a sorted weight series with sequential dates starting from a base date. */
function buildWeightSeries(
  baseDate: Date,
  values: number[],
): WeightPoint[] {
  return values.map((v, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { date: `${yyyy}-${mm}-${dd}`, value: v };
  });
}

/**
 * Reference EMA implementation for verification.
 * EMA[0] = values[0], EMA[i] = alpha * values[i] + (1-alpha) * EMA[i-1]
 */
function referenceEMA(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

// --- Arbitraries ---

/** Generate a weight value that won't cause extreme fluctuation filtering (small changes). */
const gentleWeightArb = (length: number) =>
  fc.tuple(
    fc.float({ min: 50, max: 150, noNaN: true, noDefaultInfinity: true }),
    fc.array(
      fc.float({ min: -1.5, max: 1.5, noNaN: true, noDefaultInfinity: true }),
      { minLength: length - 1, maxLength: length - 1 },
    ),
  ).map(([start, deltas]) => {
    const values: number[] = [start];
    for (const d of deltas) {
      values.push(values[values.length - 1] + d);
    }
    return values;
  });

const baseDateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2025-01-01'),
});

// ============================================================
// Property 9: Frontend EMA matches reference implementation
// ============================================================

describe('Property 9: Frontend EMA matches reference implementation', () => {
  /**
   * **Validates: Requirements 4.1.2**
   *
   * For any sequence of at least 3 weight entries (date, value pairs sorted by date),
   * computeEMA should produce EMA values where each EMA[i] = alpha * value[i] + (1-alpha) * EMA[i-1],
   * seeded with EMA[0] = value[0]. Alpha = 0.25.
   */
  test('EMA output matches reference formula for gentle weight series', () => {
    fc.assert(
      fc.property(
        baseDateArb,
        gentleWeightArb(fc.sample(fc.integer({ min: 3, max: 30 }), 1)[0] || 5),
        (baseDate, values) => {
          const series = buildWeightSeries(baseDate, values);
          const emaResult = computeEMA(series);

          // With gentle deltas (≤1.5kg), no points should be filtered
          expect(emaResult.length).toBe(values.length);

          const refValues = referenceEMA(values, EMA_ALPHA);

          for (let i = 0; i < emaResult.length; i++) {
            expect(emaResult[i].value).toBeCloseTo(refValues[i], 5);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test('EMA[0] equals the first input value', () => {
    fc.assert(
      fc.property(baseDateArb, gentleWeightArb(3), (baseDate, values) => {
        const series = buildWeightSeries(baseDate, values);
        const emaResult = computeEMA(series);
        expect(emaResult[0].value).toBeCloseTo(values[0], 10);
      }),
      { numRuns: 100 },
    );
  });

  test('EMA uses alpha=0.25', () => {
    expect(EMA_ALPHA).toBe(0.25);
  });
});

// ============================================================
// Property 10: Trend line minimum data points
// ============================================================

describe('Property 10: Trend line minimum data points', () => {
  /**
   * **Validates: Requirements 4.1.5**
   *
   * For any weight history with fewer than 3 entries, computeEMA returns empty array.
   * For any weight history with 3 or more entries (where no extreme fluctuations filter
   * them below 3), computeEMA returns array with length equal to the filtered input length.
   */
  test('fewer than 3 entries returns empty array', () => {
    fc.assert(
      fc.property(
        baseDateArb,
        fc.integer({ min: 0, max: 2 }),
        fc.float({ min: 50, max: 150, noNaN: true, noDefaultInfinity: true }),
        (baseDate, count, startWeight) => {
          const values: number[] = [];
          for (let i = 0; i < count; i++) {
            values.push(startWeight + i * 0.1);
          }
          const series = buildWeightSeries(baseDate, values);
          const result = computeEMA(series);
          expect(result).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('3 or more gentle entries returns array of same length', () => {
    fc.assert(
      fc.property(
        baseDateArb,
        fc.integer({ min: 3, max: 50 }).chain((n) =>
          gentleWeightArb(n).map((vals) => ({ n, vals })),
        ),
        (baseDate, { n, vals }) => {
          const series = buildWeightSeries(baseDate, vals);
          const result = computeEMA(series);
          expect(result.length).toBe(n);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('EMA_MIN_POINTS is 3', () => {
    expect(EMA_MIN_POINTS).toBe(3);
  });

  test('empty input returns empty array', () => {
    expect(computeEMA([])).toEqual([]);
  });

  test('exactly 3 points returns 3 EMA values', () => {
    const series = buildWeightSeries(new Date('2024-01-01'), [80, 80.5, 81]);
    const result = computeEMA(series);
    expect(result.length).toBe(3);
  });
});

// ============================================================
// Property 11: Weekly change from trend, not raw
// ============================================================

describe('Property 11: Weekly change from trend, not raw', () => {
  /**
   * **Validates: Requirements 4.1.6**
   *
   * For any weight history with at least 10 entries spanning at least 8 days,
   * computeWeeklyChange should return a value based on EMA series, not raw values.
   * Specifically, the returned value should equal
   * emaSeries[last].value - emaSeries[closest to 7 days ago].value.
   */
  test('weekly change equals EMA[last] - EMA[closest to 7 days ago]', () => {
    // Use a fixed valid base date range to avoid NaN date issues
    const validDateArb = fc.integer({ min: 0, max: 1500 }).map(
      (offset) => {
        const d = new Date('2020-01-01');
        d.setDate(d.getDate() + offset);
        return d;
      },
    );

    fc.assert(
      fc.property(
        validDateArb,
        gentleWeightArb(14),
        (baseDate, values) => {
          const series = buildWeightSeries(baseDate, values);
          const emaSeries = computeEMA(series);

          // With 14 gentle points spanning 14 days, we should have enough data
          expect(emaSeries.length).toBe(14);

          const weeklyChange = computeWeeklyChange(emaSeries);

          // Compute expected: find point closest to 7 days before last
          const latest = emaSeries[emaSeries.length - 1];
          const latestDate = new Date(latest.date);
          const targetDate = new Date(latestDate);
          targetDate.setDate(targetDate.getDate() - 7);

          let closestPoint: WeightPoint | null = null;
          let closestDiff = Infinity;
          for (const point of emaSeries) {
            const pointDate = new Date(point.date);
            const diffMs = Math.abs(
              pointDate.getTime() - targetDate.getTime(),
            );
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays < closestDiff) {
              closestDiff = diffDays;
              closestPoint = point;
            }
          }

          // The closest point should not be the latest point itself
          // (14 daily points means point at index 7 is exactly 7 days ago)
          if (closestPoint !== null && closestPoint.date !== latest.date) {
            expect(weeklyChange).not.toBeNull();
            const expected = latest.value - closestPoint.value;
            expect(weeklyChange!).toBeCloseTo(expected, 5);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test('weekly change is NOT based on raw values', () => {
    // Construct a series where raw and EMA diverge significantly
    // Raw: 80, 80, 80, 80, 80, 80, 80, 85 (big jump at end)
    // EMA will smooth the jump, so EMA-based change ≠ raw-based change
    const series = buildWeightSeries(new Date('2024-01-01'), [
      80, 80, 80, 80, 80, 80, 80, 85,
    ]);
    const emaSeries = computeEMA(series);
    const weeklyChange = computeWeeklyChange(emaSeries);

    // Raw change would be 85 - 80 = 5
    // EMA change should be much less due to smoothing
    if (weeklyChange !== null) {
      expect(Math.abs(weeklyChange)).toBeLessThan(5);
    }
  });

  test('returns null for series with fewer than 2 EMA points', () => {
    expect(computeWeeklyChange([])).toBeNull();
    expect(computeWeeklyChange([{ date: '2024-01-01', value: 80 }])).toBeNull();
  });
});

// ============================================================
// Unit tests: formatWeeklyChange
// ============================================================

describe('formatWeeklyChange', () => {
  test('null returns "—"', () => {
    expect(formatWeeklyChange(null, 'kg')).toBe('—');
    expect(formatWeeklyChange(null, 'lbs')).toBe('—');
  });

  test('negative change returns "↓" with absolute value', () => {
    expect(formatWeeklyChange(-0.3, 'kg')).toBe('↓0.3kg');
    expect(formatWeeklyChange(-1.0, 'kg')).toBe('↓1.0kg');
  });

  test('positive change returns "↑" with value', () => {
    expect(formatWeeklyChange(0.2, 'kg')).toBe('↑0.2kg');
    expect(formatWeeklyChange(1.5, 'kg')).toBe('↑1.5kg');
  });

  test('zero change returns "→"', () => {
    expect(formatWeeklyChange(0, 'kg')).toBe('→0.0kg');
  });

  test('lbs conversion multiplies by 2.20462', () => {
    // -1kg = -2.20462 lbs → "↓2.2lbs"
    expect(formatWeeklyChange(-1, 'lbs')).toBe('↓2.2lbs');
    // +1kg = +2.20462 lbs → "↑2.2lbs"
    expect(formatWeeklyChange(1, 'lbs')).toBe('↑2.2lbs');
  });
});
