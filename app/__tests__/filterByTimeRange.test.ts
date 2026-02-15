import * as fc from 'fast-check';
import { filterByTimeRange } from '../utils/filterByTimeRange';

const NUM_RUNS = 100;

const TIME_RANGES = ['7d', '14d', '30d', '90d'] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

/** Generate a date string (YYYY-MM-DD) within ±180 days of today. */
const dateArb = fc.integer({ min: -180, max: 30 }).map((offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
});

/** Generate a trend point with a date and numeric value. */
const trendPointArb = fc.record({
  date: dateArb,
  value: fc.float({ min: 0, max: 10000, noNaN: true }),
});

/** Generate a dataset of trend points. */
const datasetArb = fc.array(trendPointArb, { minLength: 0, maxLength: 50 });

/** Generate a time range. */
const rangeArb = fc.constantFrom(...TIME_RANGES);

describe('filterByTimeRange Property Tests', () => {
  /**
   * Property 15: Time range data filtering
   * For any dataset and time range, filtered result contains only points within range
   * and contains all such points from the original dataset.
   * **Validates: Requirements 7.5**
   */
  it('Property 15: filtered result contains only points within the selected range', () => {
    fc.assert(
      fc.property(datasetArb, rangeArb, (data, range) => {
        const filtered = filterByTimeRange(data, range);
        const days = RANGE_DAYS[range];
        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);

        // Every point in the filtered result must be within range
        for (const point of filtered) {
          const pointDate = new Date(point.date + 'T00:00:00');
          if (pointDate < cutoff) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 15: filtered result contains all points that are within range', () => {
    fc.assert(
      fc.property(datasetArb, rangeArb, (data, range) => {
        const filtered = filterByTimeRange(data, range);
        const days = RANGE_DAYS[range];
        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);

        // Count how many original points should be in range
        const expectedCount = data.filter((point) => {
          const pointDate = new Date(point.date + 'T00:00:00');
          return pointDate >= cutoff;
        }).length;

        return filtered.length === expectedCount;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 15: filtered result preserves original point values', () => {
    fc.assert(
      fc.property(datasetArb, rangeArb, (data, range) => {
        const filtered = filterByTimeRange(data, range);

        // Every filtered point must exist in the original data (same date and value)
        for (const fp of filtered) {
          const found = data.some((dp) => dp.date === fp.date && dp.value === fp.value);
          if (!found) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
