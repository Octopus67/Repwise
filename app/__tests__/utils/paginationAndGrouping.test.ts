import * as fc from 'fast-check';
import { hasMorePages } from '../../utils/pagination';
import { groupSessionsByDate } from '../../utils/sessionGrouping';
import { isValidSessionDate } from '../../utils/dateValidation';
import type { TrainingSessionResponse } from '../../types/training';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.9
 * **Validates: Requirements 12.1, 12.5, 10.4**
 */

describe('Pagination Property Tests', () => {
  /**
   * Property: hasMorePages returns false when currentPage * pageSize >= totalCount
   * **Validates: Requirements 12.1**
   */
  it('hasMorePages returns false when currentPage * pageSize >= totalCount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (totalCount, currentPage, pageSize) => {
          const result = hasMorePages(totalCount, currentPage, pageSize);
          if (currentPage * pageSize >= totalCount) {
            return result === false;
          }
          return result === true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Session Grouping Property Tests', () => {
  /**
   * Property: groupSessionsByDate returns groups sorted descending by date
   * **Validates: Requirements 12.5**
   */
  it('groupSessionsByDate returns groups sorted descending', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            user_id: fc.uuid(),
            session_date: fc.integer({ min: 1, max: 28 }).map(
              (day) => `2024-01-${String(day).padStart(2, '0')}`,
            ),
            exercises: fc.constant([]),
            metadata: fc.constant(null),
            personal_records: fc.constant([]),
            start_time: fc.constant(null),
            end_time: fc.constant(null),
            created_at: fc.constant('2024-01-15T10:00:00Z'),
            updated_at: fc.constant('2024-01-15T10:00:00Z'),
          }) as fc.Arbitrary<TrainingSessionResponse>,
          { minLength: 0, maxLength: 20 },
        ),
        (sessions) => {
          const groups = groupSessionsByDate(sessions);
          // Verify descending order
          for (let i = 1; i < groups.length; i++) {
            if (groups[i - 1].date < groups[i].date) return false;
          }
          // Verify all sessions are accounted for
          const totalSessions = groups.reduce((sum, g) => sum + g.sessions.length, 0);
          return totalSessions === sessions.length;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Date Validation Property Tests', () => {
  /**
   * Property: isValidSessionDate rejects tomorrow
   * **Validates: Requirements 10.4**
   */
  it('isValidSessionDate rejects tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Use local date string to avoid UTC/local timezone mismatch
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${y}-${m}-${d}`;
    expect(isValidSessionDate(tomorrowStr)).toBe(false);
  });

  /**
   * Property: isValidSessionDate accepts today
   * **Validates: Requirements 10.4**
   */
  it('isValidSessionDate accepts today', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    expect(isValidSessionDate(todayStr)).toBe(true);
  });

  /**
   * Property: isValidSessionDate accepts past dates
   * **Validates: Requirements 10.4**
   */
  it('isValidSessionDate accepts past dates', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3650 }),
        (daysAgo) => {
          const past = new Date();
          past.setDate(past.getDate() - daysAgo);
          const dateStr = past.toISOString().split('T')[0];
          return isValidSessionDate(dateStr) === true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: isValidSessionDate rejects future dates
   * **Validates: Requirements 10.4**
   */
  it('isValidSessionDate rejects future dates', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 365 }),
        (daysAhead) => {
          const future = new Date();
          future.setDate(future.getDate() + daysAhead);
          const dateStr = future.toISOString().split('T')[0];
          return isValidSessionDate(dateStr) === false;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
