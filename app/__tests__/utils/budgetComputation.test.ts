import * as fc from 'fast-check';
import {
  computeRemaining,
  computeProgressRatio,
  getOverTargetColor,
  MacroValues,
} from '../../utils/budgetComputation';
import { colors } from '../../theme/tokens';

/**
 * Feature: macrofactor-parity, Properties 3, 4, 5
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5, 10.1, 10.2
 */

const macroArb: fc.Arbitrary<MacroValues> = fc.record({
  calories: fc.float({ min: 0, max: 10000, noNaN: true }),
  protein_g: fc.float({ min: 0, max: 1000, noNaN: true }),
  carbs_g: fc.float({ min: 0, max: 1000, noNaN: true }),
  fat_g: fc.float({ min: 0, max: 1000, noNaN: true }),
});

describe('Property 3: Budget remaining equals target minus consumed', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   */
  test('remaining.X = target.X - consumed.X for all 4 macros', () => {
    fc.assert(
      fc.property(macroArb, macroArb, (targets, consumed) => {
        const remaining = computeRemaining(targets, consumed);
        expect(remaining.calories).toBeCloseTo(targets.calories - consumed.calories, 5);
        expect(remaining.protein_g).toBeCloseTo(targets.protein_g - consumed.protein_g, 5);
        expect(remaining.carbs_g).toBeCloseTo(targets.carbs_g - consumed.carbs_g, 5);
        expect(remaining.fat_g).toBeCloseTo(targets.fat_g - consumed.fat_g, 5);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 4: Over-target color selection', () => {
  /**
   * **Validates: Requirements 3.4, 10.1, 10.2**
   */
  test('returns overTarget color iff value > target', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.float({ min: 1, max: 10000, noNaN: true }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (value, target, standardColor) => {
          const result = getOverTargetColor(value, target, standardColor);
          if (value > target) {
            expect(result).toBe(colors.semantic.overTarget);
          } else {
            expect(result).toBe(standardColor);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 5: Progress ratio is clamped to [0, 1]', () => {
  /**
   * **Validates: Requirements 3.5**
   */
  test('progress ratio always in [0, 1] for positive target', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 50000, noNaN: true }),
        fc.float({ min: 1, max: 10000, noNaN: true }),
        (consumed, target) => {
          const ratio = computeProgressRatio(consumed, target);
          expect(ratio).toBeGreaterThanOrEqual(0);
          expect(ratio).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples: 0/100=0, 50/100=0.5, 200/100=1', () => {
    expect(computeProgressRatio(0, 100)).toBe(0);
    expect(computeProgressRatio(50, 100)).toBe(0.5);
    expect(computeProgressRatio(200, 100)).toBe(1);
  });

  test('target <= 0 returns 0', () => {
    expect(computeProgressRatio(100, 0)).toBe(0);
    expect(computeProgressRatio(100, -5)).toBe(0);
  });
});
