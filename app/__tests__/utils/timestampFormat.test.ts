import * as fc from 'fast-check';
import {
  formatEntryTime,
  sortEntriesChronologically,
} from '../../utils/timestampFormat';

/**
 * Feature: macrofactor-parity, Properties 10, 11
 * Validates: Requirements 5.1, 5.2
 */

describe('Property 10: Timestamp formatting produces valid time strings', () => {
  /**
   * **Validates: Requirements 5.1**
   */
  test('valid ISO datetime produces a non-empty string with hour and minute', () => {
    fc.assert(
      fc.property(
        fc.integer({
          min: new Date('2020-01-01').getTime(),
          max: new Date('2030-12-31').getTime(),
        }).map((ts) => new Date(ts)),
        (d) => {
          const iso = d.toISOString();
          const result = formatEntryTime(iso);
          expect(result.length).toBeGreaterThan(0);
          // Should contain a colon separating hour:minute
          expect(result).toMatch(/\d{1,2}:\d{2}/);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('null/undefined/empty returns empty string', () => {
    expect(formatEntryTime(null)).toBe('');
    expect(formatEntryTime(undefined)).toBe('');
    expect(formatEntryTime('')).toBe('');
  });

  test('invalid date string returns empty string', () => {
    expect(formatEntryTime('not-a-date')).toBe('');
  });
});

describe('Property 11: Entries within a meal slot are sorted chronologically', () => {
  /**
   * **Validates: Requirements 5.2**
   */
  test('sorted entries have non-decreasing created_at timestamps', () => {
    const entryArb = fc.record({
      id: fc.uuid(),
      created_at: fc
        .integer({
          min: new Date('2024-01-01').getTime(),
          max: new Date('2024-12-31').getTime(),
        })
        .map((ts) => new Date(ts).toISOString()),
    });

    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 0, maxLength: 20 }), (entries) => {
        const sorted = sortEntriesChronologically(entries);
        for (let i = 1; i < sorted.length; i++) {
          const prev = new Date(sorted[i - 1].created_at!).getTime();
          const curr = new Date(sorted[i].created_at!).getTime();
          expect(curr).toBeGreaterThanOrEqual(prev);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('entries without created_at go last', () => {
    const entries = [
      { id: '1', created_at: null },
      { id: '2', created_at: '2024-01-15T08:00:00Z' },
      { id: '3', created_at: '2024-01-15T06:00:00Z' },
    ];
    const sorted = sortEntriesChronologically(entries);
    expect(sorted[0].id).toBe('3');
    expect(sorted[1].id).toBe('2');
    expect(sorted[2].id).toBe('1');
  });

  test('does not mutate original array', () => {
    const entries = [
      { id: '1', created_at: '2024-01-15T10:00:00Z' },
      { id: '2', created_at: '2024-01-15T08:00:00Z' },
    ];
    const original = [...entries];
    sortEntriesChronologically(entries);
    expect(entries).toEqual(original);
  });
});
