import * as fc from 'fast-check';
import { formatPreviousPerformance } from '../../utils/previousPerformanceFormat';
import type { PreviousPerformanceData } from '../../types/training';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.3
 * **Validates: Requirements 3.2, 3.3**
 */

const prevDataArb: fc.Arbitrary<PreviousPerformanceData> = fc.record({
  exerciseName: fc.string({ minLength: 1, maxLength: 50 }),
  sessionDate: fc.constant('2024-01-15'),
  sets: fc.array(
    fc.record({
      weightKg: fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true }),
      reps: fc.integer({ min: 1, max: 100 }),
      rpe: fc.option(fc.float({ min: Math.fround(1), max: Math.fround(10), noNaN: true }), { nil: null }),
    }),
    { minLength: 1, maxLength: 10 },
  ),
});

describe('Previous Performance Format Property Tests', () => {
  /**
   * Property: Null data returns "—"
   * **Validates: Requirements 3.3**
   */
  it('null data always returns "—"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (setIndex, unit) => {
          return formatPreviousPerformance(null, setIndex, unit) === '—';
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Valid data with metric unit returns string containing "kg"
   * **Validates: Requirements 3.2**
   */
  it('valid data with metric unit returns string containing "kg"', () => {
    fc.assert(
      fc.property(
        prevDataArb,
        (data) => {
          const result = formatPreviousPerformance(data, 0, 'metric');
          return result.includes('kg');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Valid data with imperial unit returns string containing "lbs"
   * **Validates: Requirements 3.2**
   */
  it('valid data with imperial unit returns string containing "lbs"', () => {
    fc.assert(
      fc.property(
        prevDataArb,
        (data) => {
          const result = formatPreviousPerformance(data, 0, 'imperial');
          return result.includes('lbs');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Out-of-bounds setIndex returns "—"
   * **Validates: Requirements 3.3**
   */
  it('out-of-bounds setIndex returns "—"', () => {
    fc.assert(
      fc.property(
        prevDataArb,
        fc.constantFrom('metric' as const, 'imperial' as const),
        (data, unit) => {
          const outOfBounds = data.sets.length;
          return formatPreviousPerformance(data, outOfBounds, unit) === '—';
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
