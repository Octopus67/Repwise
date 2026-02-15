/**
 * SessionDetailView Logic Tests
 *
 * Tests the pure helper functions used by SessionDetailView:
 * - calculateSessionWorkingVolume (mixed set types)
 * - calculateDurationSeconds (from start_time/end_time)
 * - isSetPR (PR badge logic)
 * - Legacy session handling (no start_time → duration hidden)
 */

import {
  calculateSessionWorkingVolume,
  calculateDurationSeconds,
  isSetPR,
} from '../../screens/training/sessionDetailHelpers';
import type { TrainingSessionResponse } from '../../types/training';

// ─── Helper: build a minimal session response ───────────────────────────────

function makeSession(
  overrides: Partial<TrainingSessionResponse> = {},
): TrainingSessionResponse {
  return {
    id: 'test-session-id',
    user_id: 'test-user-id',
    session_date: '2024-06-15',
    exercises: [],
    metadata: null,
    personal_records: [],
    start_time: null,
    end_time: null,
    created_at: '2024-06-15T14:00:00Z',
    updated_at: '2024-06-15T15:00:00Z',
    ...overrides,
  };
}

// ─── calculateSessionWorkingVolume ──────────────────────────────────────────

describe('calculateSessionWorkingVolume', () => {
  it('returns 0 for session with no exercises', () => {
    const session = makeSession({ exercises: [] });
    expect(calculateSessionWorkingVolume(session, 'metric')).toBe(0);
  });

  it('calculates volume correctly for normal sets (metric)', () => {
    const session = makeSession({
      exercises: [
        {
          exercise_name: 'Bench Press',
          sets: [
            { weight_kg: 80, reps: 8, rpe: null, set_type: 'normal' },
            { weight_kg: 80, reps: 8, rpe: null, set_type: 'normal' },
          ],
        },
      ],
    });
    // 80 * 8 + 80 * 8 = 1280
    expect(calculateSessionWorkingVolume(session, 'metric')).toBe(1280);
  });

  it('excludes warm-up sets from working volume', () => {
    const session = makeSession({
      exercises: [
        {
          exercise_name: 'Squat',
          sets: [
            { weight_kg: 40, reps: 10, rpe: null, set_type: 'warm-up' },
            { weight_kg: 60, reps: 5, rpe: null, set_type: 'warm-up' },
            { weight_kg: 100, reps: 5, rpe: 8, set_type: 'normal' },
            { weight_kg: 100, reps: 5, rpe: 9, set_type: 'normal' },
          ],
        },
      ],
    });
    // Only normal sets: 100*5 + 100*5 = 1000
    expect(calculateSessionWorkingVolume(session, 'metric')).toBe(1000);
  });

  it('includes drop-set and amrap sets in working volume', () => {
    const session = makeSession({
      exercises: [
        {
          exercise_name: 'Curl',
          sets: [
            { weight_kg: 20, reps: 10, rpe: null, set_type: 'normal' },
            { weight_kg: 15, reps: 12, rpe: null, set_type: 'drop-set' },
            { weight_kg: 10, reps: 20, rpe: null, set_type: 'amrap' },
          ],
        },
      ],
    });
    // 20*10 + 15*12 + 10*20 = 200 + 180 + 200 = 580
    expect(calculateSessionWorkingVolume(session, 'metric')).toBe(580);
  });

  it('converts to imperial for volume calculation', () => {
    const session = makeSession({
      exercises: [
        {
          exercise_name: 'Bench Press',
          sets: [
            { weight_kg: 100, reps: 1, rpe: null, set_type: 'normal' },
          ],
        },
      ],
    });
    // 100kg → 220.5 lbs (convertWeight rounds to 1 decimal)
    const volume = calculateSessionWorkingVolume(session, 'imperial');
    expect(volume).toBeCloseTo(220.5, 0);
  });

  it('handles mixed set types across multiple exercises', () => {
    const session = makeSession({
      exercises: [
        {
          exercise_name: 'Bench Press',
          sets: [
            { weight_kg: 20, reps: 10, rpe: null, set_type: 'warm-up' },
            { weight_kg: 80, reps: 5, rpe: null, set_type: 'normal' },
          ],
        },
        {
          exercise_name: 'Row',
          sets: [
            { weight_kg: 60, reps: 8, rpe: null, set_type: 'normal' },
            { weight_kg: 40, reps: 15, rpe: null, set_type: 'drop-set' },
          ],
        },
      ],
    });
    // Bench: 80*5 = 400 (warm-up excluded)
    // Row: 60*8 + 40*15 = 480 + 600 = 1080
    expect(calculateSessionWorkingVolume(session, 'metric')).toBe(1480);
  });

  it('treats sets with no set_type as normal (legacy)', () => {
    const session = makeSession({
      exercises: [
        {
          exercise_name: 'Deadlift',
          sets: [
            { weight_kg: 120, reps: 5, rpe: null },
          ],
        },
      ],
    });
    // No set_type → defaults to 'normal' → included
    expect(calculateSessionWorkingVolume(session, 'metric')).toBe(600);
  });
});

// ─── calculateDurationSeconds ───────────────────────────────────────────────

describe('calculateDurationSeconds', () => {
  it('calculates duration from start and end timestamps', () => {
    const result = calculateDurationSeconds(
      '2024-06-15T14:00:00Z',
      '2024-06-15T15:30:00Z',
    );
    // 1.5 hours = 5400 seconds
    expect(result).toBe(5400);
  });

  it('returns null when start_time is null', () => {
    expect(calculateDurationSeconds(null, '2024-06-15T15:00:00Z')).toBeNull();
  });

  it('returns null when end_time is null', () => {
    expect(calculateDurationSeconds('2024-06-15T14:00:00Z', null)).toBeNull();
  });

  it('returns null when both are null (legacy session)', () => {
    expect(calculateDurationSeconds(null, null)).toBeNull();
  });

  it('returns null for zero or negative duration', () => {
    // Same time
    expect(calculateDurationSeconds(
      '2024-06-15T14:00:00Z',
      '2024-06-15T14:00:00Z',
    )).toBeNull();

    // End before start
    expect(calculateDurationSeconds(
      '2024-06-15T15:00:00Z',
      '2024-06-15T14:00:00Z',
    )).toBeNull();
  });

  it('handles short workouts (< 1 minute)', () => {
    const result = calculateDurationSeconds(
      '2024-06-15T14:00:00Z',
      '2024-06-15T14:00:45Z',
    );
    expect(result).toBe(45);
  });
});

// ─── isSetPR ────────────────────────────────────────────────────────────────

describe('isSetPR (PR badge logic)', () => {
  const personalRecords = [
    {
      exercise_name: 'Bench Press',
      reps: 5,
      new_weight_kg: 100,
      previous_weight_kg: 95,
    },
    {
      exercise_name: 'Squat',
      reps: 3,
      new_weight_kg: 140,
      previous_weight_kg: null,
    },
  ];

  it('returns true when set matches a PR', () => {
    expect(isSetPR(personalRecords, 'Bench Press', 100, 5)).toBe(true);
  });

  it('returns true for PR with no previous weight', () => {
    expect(isSetPR(personalRecords, 'Squat', 140, 3)).toBe(true);
  });

  it('returns false when exercise name does not match', () => {
    expect(isSetPR(personalRecords, 'Deadlift', 100, 5)).toBe(false);
  });

  it('returns false when reps do not match', () => {
    expect(isSetPR(personalRecords, 'Bench Press', 100, 8)).toBe(false);
  });

  it('returns false when weight does not match', () => {
    expect(isSetPR(personalRecords, 'Bench Press', 95, 5)).toBe(false);
  });

  it('returns false for empty personal_records array', () => {
    expect(isSetPR([], 'Bench Press', 100, 5)).toBe(false);
  });

  it('returns false for undefined/null personal_records', () => {
    expect(isSetPR(undefined as any, 'Bench Press', 100, 5)).toBe(false);
    expect(isSetPR(null as any, 'Bench Press', 100, 5)).toBe(false);
  });

  it('matches within 0.01kg tolerance', () => {
    // 100.005 is within 0.01 of 100
    expect(isSetPR(personalRecords, 'Bench Press', 100.005, 5)).toBe(true);
    // 100.02 is outside tolerance
    expect(isSetPR(personalRecords, 'Bench Press', 100.02, 5)).toBe(false);
  });
});

// ─── Legacy session handling ────────────────────────────────────────────────

describe('Legacy session handling', () => {
  it('duration is null for legacy session without timestamps', () => {
    const session = makeSession({
      start_time: null,
      end_time: null,
    });
    const duration = calculateDurationSeconds(session.start_time, session.end_time);
    expect(duration).toBeNull();
  });

  it('volume still calculates for legacy session without set_type', () => {
    const session = makeSession({
      exercises: [
        {
          exercise_name: 'Bench Press',
          sets: [
            { weight_kg: 80, reps: 8, rpe: null },
            { weight_kg: 80, reps: 7, rpe: null },
          ],
        },
      ],
    });
    // No set_type → treated as normal → included in volume
    // 80*8 + 80*7 = 640 + 560 = 1200
    expect(calculateSessionWorkingVolume(session, 'metric')).toBe(1200);
  });
});
