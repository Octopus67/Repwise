import * as fc from 'fast-check';
import { getComparisonColor } from '../../utils/comparisonColor';

/**
 * Feature: ux-redesign-v1, Property 13: Comparison color coding
 * Validates: Requirements 11.4
 */

describe('Property 13: Comparison color coding', () => {
  const POSITIVE = '#22C55E';
  const WARNING = '#F59E0B';
  const NEGATIVE = '#EF4444';
  const MUTED = '#64748B';

  test('target=0 → muted color', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        (actual) => {
          expect(getComparisonColor(actual, 0)).toBe(MUTED);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('[90,110]% → positive (green)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 90, max: 110 }),
        (target, pct) => {
          // Compute actual from target and desired percentage
          // actual/target*100 should round to pct
          const actual = Math.round((pct / 100) * target);
          const resultPct = Math.round((actual / target) * 100);
          // Only assert when the rounding lands in [90,110]
          if (resultPct >= 90 && resultPct <= 110) {
            expect(getComparisonColor(actual, target)).toBe(POSITIVE);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('[70,89]% or [111,130]% → warning (amber)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.oneof(
          fc.integer({ min: 70, max: 89 }),
          fc.integer({ min: 111, max: 130 }),
        ),
        (target, pct) => {
          const actual = Math.round((pct / 100) * target);
          const resultPct = Math.round((actual / target) * 100);
          if (
            (resultPct >= 70 && resultPct <= 89) ||
            (resultPct >= 111 && resultPct <= 130)
          ) {
            expect(getComparisonColor(actual, target)).toBe(WARNING);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('<70% or >130% → negative (red)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.oneof(
          fc.integer({ min: 0, max: 69 }),
          fc.integer({ min: 131, max: 300 }),
        ),
        (target, pct) => {
          const actual = Math.round((pct / 100) * target);
          const resultPct = Math.round((actual / target) * 100);
          if (resultPct < 70 || resultPct > 130) {
            expect(getComparisonColor(actual, target)).toBe(NEGATIVE);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples', () => {
    expect(getComparisonColor(100, 100)).toBe(POSITIVE);  // 100%
    expect(getComparisonColor(90, 100)).toBe(POSITIVE);   // 90%
    expect(getComparisonColor(110, 100)).toBe(POSITIVE);  // 110%
    expect(getComparisonColor(80, 100)).toBe(WARNING);    // 80%
    expect(getComparisonColor(120, 100)).toBe(WARNING);   // 120%
    expect(getComparisonColor(50, 100)).toBe(NEGATIVE);   // 50%
    expect(getComparisonColor(200, 100)).toBe(NEGATIVE);  // 200%
    expect(getComparisonColor(0, 0)).toBe(MUTED);         // target=0
  });
});
