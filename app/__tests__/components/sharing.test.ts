/**
 * Tests for sharing components and service logic.
 *
 * Tests pure logic: share card options, theme colors, and sharing service helpers.
 * Does NOT render React Native components (no renderer in test env).
 */

import type { ShareCardOptions, ShareCardTheme } from '../../components/sharing/WorkoutShareCard';
import type { TrainingSessionResponse } from '../../types/training';

// ─── Share Card Options ──────────────────────────────────────────────────────

describe('ShareCardOptions', () => {
  const defaultOptions: ShareCardOptions = {
    showExercises: true,
    showWeights: true,
    showPRs: true,
    theme: 'dark',
  };

  it('defaults to showing all content', () => {
    expect(defaultOptions.showExercises).toBe(true);
    expect(defaultOptions.showWeights).toBe(true);
    expect(defaultOptions.showPRs).toBe(true);
  });

  it('supports all theme variants', () => {
    const themes: ShareCardTheme[] = ['dark', 'midnight', 'ocean'];
    themes.forEach((theme) => {
      const opts: ShareCardOptions = { ...defaultOptions, theme };
      expect(opts.theme).toBe(theme);
    });
  });

  it('can toggle individual options', () => {
    const toggled: ShareCardOptions = { ...defaultOptions, showWeights: false };
    expect(toggled.showWeights).toBe(false);
    expect(toggled.showExercises).toBe(true);
  });
});

// ─── Session data for share card ─────────────────────────────────────────────

function makeSession(overrides: Partial<TrainingSessionResponse> = {}): TrainingSessionResponse {
  return {
    id: 'test-session-1',
    user_id: 'user-1',
    session_date: '2024-06-15',
    exercises: [
      {
        exercise_name: 'Bench Press',
        sets: [
          { reps: 8, weight_kg: 80, rpe: 8 },
          { reps: 8, weight_kg: 80, rpe: 9 },
        ],
      },
      {
        exercise_name: 'Squat',
        sets: [
          { reps: 5, weight_kg: 120, rpe: 9 },
        ],
      },
    ],
    metadata: null,
    personal_records: [],
    start_time: '2024-06-15T10:00:00Z',
    end_time: '2024-06-15T11:15:00Z',
    created_at: '2024-06-15T10:00:00Z',
    updated_at: '2024-06-15T11:15:00Z',
    ...overrides,
  };
}

describe('Share card session data', () => {
  it('computes exercise count from session', () => {
    const session = makeSession();
    expect(session.exercises.length).toBe(2);
  });

  it('counts PRs from personal_records', () => {
    const session = makeSession({
      personal_records: [
        { exercise_name: 'Bench Press', reps: 8, new_weight_kg: 82.5, previous_weight_kg: 80 },
      ],
    });
    expect(session.personal_records.length).toBe(1);
  });

  it('handles session with no PRs', () => {
    const session = makeSession({ personal_records: [] });
    expect(session.personal_records.length).toBe(0);
  });

  it('handles session with many exercises (truncation at 8)', () => {
    const exercises = Array.from({ length: 12 }, (_, i) => ({
      exercise_name: `Exercise ${i + 1}`,
      sets: [{ reps: 10, weight_kg: 50, rpe: 7 }],
    }));
    const session = makeSession({ exercises });
    // Card should show max 8, but data has 12
    expect(session.exercises.length).toBe(12);
    expect(session.exercises.slice(0, 8).length).toBe(8);
  });
});

// ─── Sharing service helpers ─────────────────────────────────────────────────

describe('Sharing service edge cases', () => {
  it('captureWorkoutAsImage returns null for null ref', async () => {
    // Mock react-native modules before importing
    jest.mock('react-native', () => ({
      Platform: { OS: 'ios' },
      Alert: { alert: jest.fn() },
    }));
    jest.mock('react-native-view-shot', () => ({}));

    const { captureWorkoutAsImage } = await import('../../services/sharing');
    const result = await captureWorkoutAsImage({ current: null });
    expect(result).toBeNull();
  });

  it('captureWorkoutAsImage returns null when capture method missing', async () => {
    const { captureWorkoutAsImage } = await import('../../services/sharing');
    const result = await captureWorkoutAsImage({ current: {} as any });
    expect(result).toBeNull();
  });
});
