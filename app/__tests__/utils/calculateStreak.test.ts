import * as fc from 'fast-check';
import { calculateStreak } from '../../utils/calculateStreak';

/**
 * Feature: ux-redesign-v1, Property 5: Streak calculation
 * Validates: Requirements 3.5
 */

/** Helper: generate an ISO date string from a base offset in days from 2024-01-01. */
function dateFromDayOffset(offset: number): string {
  const base = new Date('2024-01-01T00:00:00Z');
  base.setUTCDate(base.getUTCDate() + offset);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Helper: generate consecutive ISO date strings ending at dayOffset. */
function consecutiveDates(endOffset: number, count: number): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(dateFromDayOffset(endOffset - i));
  }
  return dates;
}

describe('Property 5: Streak calculation', () => {
  test('empty array → 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (dayOffset) => {
          const today = dateFromDayOffset(dayOffset);
          expect(calculateStreak([], today)).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('today not in array → 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 2, max: 30 }),
        (dayOffset, gap) => {
          const today = dateFromDayOffset(dayOffset);
          const dates = [dateFromDayOffset(dayOffset - gap)];
          expect(calculateStreak(dates, today)).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('single date matching today → 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (dayOffset) => {
          const today = dateFromDayOffset(dayOffset);
          expect(calculateStreak([today], today)).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('consecutive dates ending at today → count equals length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 1000 }),
        fc.integer({ min: 1, max: 30 }),
        (dayOffset, streakLength) => {
          const today = dateFromDayOffset(dayOffset);
          const dates = consecutiveDates(dayOffset, streakLength);
          expect(calculateStreak(dates, today)).toBe(streakLength);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('gap before recent streak only counts recent portion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 1000 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (dayOffset, recentStreak, gapDays, olderStreak) => {
          const today = dateFromDayOffset(dayOffset);
          const recentDates = consecutiveDates(dayOffset, recentStreak);
          const olderEnd = dayOffset - recentStreak - gapDays;
          const olderDates = consecutiveDates(olderEnd, olderStreak);
          const allDates = [...olderDates, ...recentDates];
          expect(calculateStreak(allDates, today)).toBe(recentStreak);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('duplicate dates are handled correctly', () => {
    const today = '2024-06-15';
    const dates = ['2024-06-13', '2024-06-14', '2024-06-14', '2024-06-15', '2024-06-15'];
    expect(calculateStreak(dates, today)).toBe(3);
  });
});
