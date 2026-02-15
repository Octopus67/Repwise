import { hasMorePages } from '../../utils/pagination';
import { groupSessionsByDate } from '../../utils/sessionGrouping';
import { sessionHasPR } from '../../utils/sessionEditConversion';
import {
  isTrainingLogV2Enabled,
  setTrainingLogV2Flag,
} from '../../utils/featureFlags';
import type { TrainingSessionResponse } from '../../types/training';

/**
 * Unit tests for LogsScreen changes (tasks 18.1–18.5)
 * Validates: Requirements 7.6, 8.1, 12.1, 12.5
 *
 * Tests pure functions and feature flag logic used by LogsScreen.
 * Avoids React Native rendering — focuses on logic correctness.
 */

function makeSession(overrides: Partial<TrainingSessionResponse> = {}): TrainingSessionResponse {
  return {
    id: overrides.id ?? 'sess-1',
    user_id: 'user-1',
    session_date: overrides.session_date ?? '2024-06-15',
    exercises: overrides.exercises ?? [
      {
        exercise_name: 'Bench Press',
        sets: [{ reps: 8, weight_kg: 80, rpe: null }],
      },
    ],
    metadata: overrides.metadata ?? null,
    personal_records: overrides.personal_records ?? [],
    start_time: overrides.start_time ?? null,
    end_time: overrides.end_time ?? null,
    created_at: overrides.created_at ?? '2024-06-15T10:00:00Z',
    updated_at: overrides.updated_at ?? '2024-06-15T10:00:00Z',
  };
}

describe('LogsScreen logic', () => {
  describe('hasMorePages integration', () => {
    test('page 1 of 3 pages → true', () => {
      expect(hasMorePages(60, 1, 20)).toBe(true);
    });

    test('page 2 of 3 pages → true', () => {
      expect(hasMorePages(60, 2, 20)).toBe(true);
    });

    test('page 3 of 3 pages → false', () => {
      expect(hasMorePages(60, 3, 20)).toBe(false);
    });

    test('page 1 with fewer items than page size → false', () => {
      expect(hasMorePages(10, 1, 20)).toBe(false);
    });

    test('page 1 with exactly page size items → false', () => {
      expect(hasMorePages(20, 1, 20)).toBe(false);
    });

    test('0 total items → false', () => {
      expect(hasMorePages(0, 1, 20)).toBe(false);
    });
  });

  describe('groupSessionsByDate with real session data', () => {
    test('groups sessions by date descending', () => {
      const sessions = [
        makeSession({ id: 's1', session_date: '2024-06-15' }),
        makeSession({ id: 's2', session_date: '2024-06-14' }),
        makeSession({ id: 's3', session_date: '2024-06-15' }),
        makeSession({ id: 's4', session_date: '2024-06-13' }),
      ];

      const grouped = groupSessionsByDate(sessions);

      expect(grouped).toHaveLength(3);
      expect(grouped[0].date).toBe('2024-06-15');
      expect(grouped[0].sessions).toHaveLength(2);
      expect(grouped[1].date).toBe('2024-06-14');
      expect(grouped[1].sessions).toHaveLength(1);
      expect(grouped[2].date).toBe('2024-06-13');
      expect(grouped[2].sessions).toHaveLength(1);
    });

    test('returns empty array for no sessions', () => {
      expect(groupSessionsByDate([])).toEqual([]);
    });

    test('single session returns single group', () => {
      const sessions = [makeSession({ id: 's1', session_date: '2024-06-15' })];
      const grouped = groupSessionsByDate(sessions);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].date).toBe('2024-06-15');
      expect(grouped[0].sessions).toHaveLength(1);
    });

    test('multiple sessions on same date are grouped together', () => {
      const sessions = [
        makeSession({ id: 's1', session_date: '2024-06-15' }),
        makeSession({ id: 's2', session_date: '2024-06-15' }),
        makeSession({ id: 's3', session_date: '2024-06-15' }),
      ];
      const grouped = groupSessionsByDate(sessions);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].sessions).toHaveLength(3);
    });
  });

  describe('sessionHasPR', () => {
    test('returns true for session with personal_records', () => {
      const session = makeSession({
        personal_records: [
          {
            exercise_name: 'Bench Press',
            reps: 8,
            new_weight_kg: 85,
            previous_weight_kg: 80,
          },
        ],
      });
      expect(sessionHasPR(session)).toBe(true);
    });

    test('returns false for session with empty personal_records', () => {
      const session = makeSession({ personal_records: [] });
      expect(sessionHasPR(session)).toBe(false);
    });

    test('returns true for session with multiple PRs', () => {
      const session = makeSession({
        personal_records: [
          { exercise_name: 'Bench Press', reps: 8, new_weight_kg: 85, previous_weight_kg: 80 },
          { exercise_name: 'Squat', reps: 5, new_weight_kg: 140, previous_weight_kg: 135 },
        ],
      });
      expect(sessionHasPR(session)).toBe(true);
    });
  });

  describe('Feature flag: training_log_v2', () => {
    afterEach(() => {
      setTrainingLogV2Flag(false);
    });

    test('flag disabled by default → AddTrainingModal is used', () => {
      expect(isTrainingLogV2Enabled()).toBe(false);
    });

    test('flag can be enabled', () => {
      setTrainingLogV2Flag(true);
      expect(isTrainingLogV2Enabled()).toBe(true);
    });

    test('flag can be toggled back to disabled', () => {
      setTrainingLogV2Flag(true);
      expect(isTrainingLogV2Enabled()).toBe(true);
      setTrainingLogV2Flag(false);
      expect(isTrainingLogV2Enabled()).toBe(false);
    });
  });
});
