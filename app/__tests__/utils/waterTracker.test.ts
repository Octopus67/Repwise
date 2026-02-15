import * as fc from 'fast-check';
import { incrementGlasses, decrementGlasses } from '../../utils/waterLogic';

/**
 * Property 7: Water glass count invariant
 * Validates: Requirements 5.6, 5.7
 */
describe('Property 7: Water glass count invariant', () => {
  const MAX = 12;

  it('increment produces min(n+1, max)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (n) => {
        expect(incrementGlasses(n, MAX)).toBe(Math.min(n + 1, MAX));
      }),
      { numRuns: 200 },
    );
  });

  it('decrement produces max(n-1, 0)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (n) => {
        expect(decrementGlasses(n)).toBe(Math.max(n - 1, 0));
      }),
      { numRuns: 200 },
    );
  });

  it('increment then decrement returns original for 0 < n < max', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX - 1 }), (n) => {
        expect(decrementGlasses(incrementGlasses(n, MAX))).toBe(n);
      }),
      { numRuns: 200 },
    );
  });

  it('glass count is never negative after any sequence of decrements', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX }),
        fc.integer({ min: 1, max: 20 }),
        (start, decrements) => {
          let count = start;
          for (let i = 0; i < decrements; i++) {
            count = decrementGlasses(count);
          }
          expect(count).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('glass count never exceeds max after any sequence of increments', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX }),
        fc.integer({ min: 1, max: 20 }),
        (start, increments) => {
          let count = start;
          for (let i = 0; i < increments; i++) {
            count = incrementGlasses(count, MAX);
          }
          expect(count).toBeLessThanOrEqual(MAX);
        },
      ),
      { numRuns: 200 },
    );
  });
});
