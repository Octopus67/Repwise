import * as fc from 'fast-check';

import { generateWarmUpSets, WarmUpSet } from '../../utils/warmUpGenerator';

/**
 * Property 19: Warm-up generator produces valid ramp
 *
 * For any target working weight > bar weight, the warm-up generator SHALL produce sets where:
 * (a) all weights are >= bar weight (20 kg)
 * (b) weights are non-decreasing
 * (c) all sets have set_type "warm-up"
 *
 * Edge cases:
 * - working weight = 20 (bar) → empty array
 * - working weight = 22.5 → only bar × 10
 *
 * **Validates: Requirements 13.1, 13.2, 13.3**
 */

const BAR_WEIGHT = 20;

describe('Property 19: Warm-up generator produces valid ramp', () => {
  it('all generated weights >= bar weight (20 kg), non-decreasing, all tagged warm-up', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 21, max: 300, noNaN: true }),
        (workingWeight: number) => {
          const sets = generateWarmUpSets(workingWeight, BAR_WEIGHT);

          // Must produce at least one warm-up set
          expect(sets.length).toBeGreaterThanOrEqual(1);

          for (const set of sets) {
            // (a) all weights >= bar weight
            expect(set.weightKg).toBeGreaterThanOrEqual(BAR_WEIGHT);

            // (c) all tagged warm-up
            expect(set.setType).toBe('warm-up');

            // reps must be positive
            expect(set.reps).toBeGreaterThan(0);
          }

          // (b) weights are non-decreasing
          for (let i = 1; i < sets.length; i++) {
            expect(sets[i].weightKg).toBeGreaterThanOrEqual(sets[i - 1].weightKg);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('working weight = bar weight → empty array', () => {
    const sets = generateWarmUpSets(BAR_WEIGHT, BAR_WEIGHT);
    expect(sets).toEqual([]);
  });

  it('working weight < bar weight → empty array', () => {
    const sets = generateWarmUpSets(15, BAR_WEIGHT);
    expect(sets).toEqual([]);
  });

  it('working weight = 22.5 → only bar × 10', () => {
    const sets = generateWarmUpSets(22.5, BAR_WEIGHT);
    expect(sets.length).toBe(1);
    expect(sets[0].weightKg).toBe(BAR_WEIGHT);
    expect(sets[0].reps).toBe(10);
    expect(sets[0].setType).toBe('warm-up');
  });

  it('all warm-up weights are rounded to 2.5 kg plate increments', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 21, max: 300, noNaN: true }),
        (workingWeight: number) => {
          const sets = generateWarmUpSets(workingWeight, BAR_WEIGHT);

          for (const set of sets) {
            // Weight should be a multiple of 2.5 (plate increment)
            const remainder = (set.weightKg * 10) % 25; // multiply by 10 to avoid float issues
            expect(remainder).toBeCloseTo(0, 5);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
