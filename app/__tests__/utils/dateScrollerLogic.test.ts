import * as fc from 'fast-check';
import {
  getWeekDates,
  formatDayCell,
  getLoggedDatesSet,
} from '../../utils/dateScrollerLogic';

/**
 * Feature: macrofactor-parity, Properties 6, 7
 * Validates: Requirements 4.1, 4.4, 4.5
 */

// Arbitrary for valid ISO date strings within a reasonable range
const dateArb = fc
  .integer({ min: 0, max: 3650 })
  .map((offset) => {
    const d = new Date('2020-01-01T12:00:00Z');
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  });

describe('Property 6: Week generation produces 7 consecutive days starting from Monday', () => {
  /**
   * **Validates: Requirements 4.1, 4.5**
   */
  test('always returns exactly 7 dates', () => {
    fc.assert(
      fc.property(dateArb, (dateStr) => {
        const week = getWeekDates(dateStr);
        expect(week).toHaveLength(7);
      }),
      { numRuns: 100 },
    );
  });

  test('first date is always a Monday', () => {
    fc.assert(
      fc.property(dateArb, (dateStr) => {
        const week = getWeekDates(dateStr);
        const firstDay = new Date(week[0] + 'T12:00:00');
        // getDay() === 1 means Monday
        expect(firstDay.getDay()).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  test('dates are consecutive (each is exactly 1 day after the previous)', () => {
    fc.assert(
      fc.property(dateArb, (dateStr) => {
        const week = getWeekDates(dateStr);
        for (let i = 1; i < week.length; i++) {
          const prev = new Date(week[i - 1] + 'T12:00:00');
          const curr = new Date(week[i] + 'T12:00:00');
          const diffMs = curr.getTime() - prev.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          expect(diffDays).toBe(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('the reference date is always contained in the returned week', () => {
    fc.assert(
      fc.property(dateArb, (dateStr) => {
        const week = getWeekDates(dateStr);
        expect(week).toContain(dateStr);
      }),
      { numRuns: 100 },
    );
  });

  test('specific example: 2024-01-17 (Wednesday) → week starts 2024-01-15 (Monday)', () => {
    const week = getWeekDates('2024-01-17');
    expect(week[0]).toBe('2024-01-15');
    expect(week[6]).toBe('2024-01-21');
  });
});

describe('Property 7: Logged dates indicator matches entry dates', () => {
  /**
   * **Validates: Requirements 4.4**
   */
  test('logged dates set equals unique entry_date values', () => {
    const entryArb = fc.record({
      entry_date: fc.constantFrom(
        '2024-01-15',
        '2024-01-16',
        '2024-01-17',
        '2024-01-18',
        '2024-01-19',
      ),
    });

    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 0, maxLength: 30 }), (entries) => {
        const loggedDates = getLoggedDatesSet(entries);
        const expectedDates = new Set(entries.map((e) => e.entry_date));
        expect(loggedDates).toEqual(expectedDates);
      }),
      { numRuns: 100 },
    );
  });

  test('empty entries → empty set', () => {
    expect(getLoggedDatesSet([])).toEqual(new Set());
  });
});

describe('formatDayCell', () => {
  test('returns correct day name and number', () => {
    // 2024-01-15 is a Monday
    const cell = formatDayCell('2024-01-15');
    expect(cell.dayName).toBe('Mon');
    expect(cell.dayNumber).toBe(15);
  });

  test('Sunday returns Sun', () => {
    // 2024-01-21 is a Sunday
    const cell = formatDayCell('2024-01-21');
    expect(cell.dayName).toBe('Sun');
    expect(cell.dayNumber).toBe(21);
  });
});
