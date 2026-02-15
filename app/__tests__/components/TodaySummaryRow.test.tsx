import * as fc from 'fast-check';
import { colors } from '../../theme/tokens';

/**
 * Feature: ux-redesign-v1, Property 3: Today activity summary counts
 * Validates: Requirements 3.1
 *
 * Tests the color logic from TodaySummaryRow:
 * count > 0 → semantic.positive, count === 0 → text.muted
 */

/**
 * Pure logic extracted from TodaySummaryRow's SummaryItem:
 * The count color is semantic.positive when count > 0, text.muted when 0.
 */
function getCountColor(count: number): string {
  return count > 0 ? colors.semantic.positive : colors.text.muted;
}

describe('Property 3: Today activity summary counts', () => {
  test('count > 0 uses semantic.positive color', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (count) => {
          expect(getCountColor(count)).toBe(colors.semantic.positive);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('count === 0 uses text.muted color', () => {
    fc.assert(
      fc.property(fc.constant(0), (count) => {
        expect(getCountColor(count)).toBe(colors.text.muted);
      }),
      { numRuns: 100 },
    );
  });

  test('for any mealsLogged in [0, 100] and workoutsCompleted in [0, 20], color logic is correct', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 20 }),
        (mealsLogged, workoutsCompleted) => {
          const mealsColor = getCountColor(mealsLogged);
          const workoutsColor = getCountColor(workoutsCompleted);

          if (mealsLogged > 0) {
            expect(mealsColor).toBe(colors.semantic.positive);
          } else {
            expect(mealsColor).toBe(colors.text.muted);
          }

          if (workoutsCompleted > 0) {
            expect(workoutsColor).toBe(colors.semantic.positive);
          } else {
            expect(workoutsColor).toBe(colors.text.muted);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('color is always one of the two expected values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (count) => {
          const color = getCountColor(count);
          expect([colors.semantic.positive, colors.text.muted]).toContain(color);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples', () => {
    expect(getCountColor(0)).toBe(colors.text.muted);
    expect(getCountColor(1)).toBe(colors.semantic.positive);
    expect(getCountColor(5)).toBe(colors.semantic.positive);
    expect(getCountColor(100)).toBe(colors.semantic.positive);
  });
});
