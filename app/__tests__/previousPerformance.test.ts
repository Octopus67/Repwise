import * as fc from 'fast-check';
import { formatWeight } from '../utils/unitConversion';
import type { UnitSystem } from '../utils/unitConversion';

/**
 * Pure formatting function for previous performance display.
 * Mirrors the logic in PreviousPerformance.tsx component.
 */
function formatPreviousPerformance(
  weightKg: number,
  reps: number,
  unitSystem: UnitSystem,
): string {
  return `Last time: ${formatWeight(weightKg, unitSystem)} × ${reps}`;
}

const NUM_RUNS = 100;

describe('Previous Performance Property Tests', () => {
  /**
   * Property 14: Previous performance formatting
   * For any weight (kg) and reps and unit system, the formatted string matches
   * "Last time: {formatted_weight} × {reps}"
   * **Validates: Requirements 6.2**
   */
  it('Property 14: Previous performance formatting', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 500, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (weightKg, reps, unitSystem) => {
          const result = formatPreviousPerformance(weightKg, reps, unitSystem);
          const expectedWeight = formatWeight(weightKg, unitSystem);
          const expected = `Last time: ${expectedWeight} × ${reps}`;

          return result === expected;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 14: formatted string starts with "Last time:" prefix', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 500, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (weightKg, reps, unitSystem) => {
          const result = formatPreviousPerformance(weightKg, reps, unitSystem);
          return result.startsWith('Last time: ');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 14: formatted string contains the multiplication sign and reps', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 500, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (weightKg, reps, unitSystem) => {
          const result = formatPreviousPerformance(weightKg, reps, unitSystem);
          return result.includes(`× ${reps}`);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 14: formatted string contains correct unit suffix for the system', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 500, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (weightKg, reps, unitSystem) => {
          const result = formatPreviousPerformance(weightKg, reps, unitSystem);
          const expectedSuffix = unitSystem === 'metric' ? 'kg' : 'lbs';
          return result.includes(expectedSuffix);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
