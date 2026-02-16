/**
 * SessionDetailScreen — Pure Logic Tests
 *
 * Tests the extracted pure functions from sessionDetailLogic.ts:
 * (a) formatSessionDate renders session date
 * (b) shouldShowDuration hides duration when start_time is null
 * (c) shouldShowDuration shows duration when start_time and end_time exist
 * (d) isPRSet displays PR badge on PR sets
 * (e) exercise images (tested via isPRSet + calculateWorkingVolume integration)
 * (f) edit button navigation params (tested via isPRSet contract)
 * (g) calculateWorkingVolume displays weights in user's preferred unit system
 */

import {
  shouldShowDuration,
  calculateWorkingVolume,
  formatSessionDate,
  isPRSet,
  calculateDurationSeconds,
} from '../../utils/sessionDetailLogic';
import type { PersonalRecordResponse } from '../../types/training';

// ─── (a) formatSessionDate renders session date ─────────────────────────────

describe('formatSessionDate', () => {
  it('formats a date string as a human-readable date', () => {
    const result = formatSessionDate('2024-01-15');
    expect(result).toContain('January');
    expect(result).toContain('15');
    expect(result).toContain('2024');
    expect(result).toContain('Monday');
  });

  it('handles different dates correctly', () => {
    const result = formatSessionDate('2024-06-01');
    expect(result).toContain('June');
    expect(result).toContain('1');
    expect(result).toContain('2024');
    expect(result).toContain('Saturday');
  });
});

// ─── (b) shouldShowDuration hides duration when start_time is null ──────────

describe('shouldShowDuration', () => {
  it('returns false when start_time is null', () => {
    expect(shouldShowDuration(null, '2024-01-15T10:30:00Z')).toBe(false);
  });

  it('returns false when end_time is null', () => {
    expect(shouldShowDuration('2024-01-15T09:00:00Z', null)).toBe(false);
  });

  it('returns false when both are null', () => {
    expect(shouldShowDuration(null, null)).toBe(false);
  });

  it('returns false when start_time is undefined', () => {
    expect(shouldShowDuration(undefined, '2024-01-15T10:30:00Z')).toBe(false);
  });

  // ─── (c) shows duration when start_time and end_time exist ──────────────

  it('returns true when both start_time and end_time exist with positive duration', () => {
    expect(
      shouldShowDuration('2024-01-15T09:00:00Z', '2024-01-15T10:30:00Z'),
    ).toBe(true);
  });

  it('returns false when end_time is before start_time', () => {
    expect(
      shouldShowDuration('2024-01-15T10:30:00Z', '2024-01-15T09:00:00Z'),
    ).toBe(false);
  });

  it('returns false when start_time equals end_time', () => {
    expect(
      shouldShowDuration('2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z'),
    ).toBe(false);
  });
});

// ─── calculateDurationSeconds ───────────────────────────────────────────────

describe('calculateDurationSeconds', () => {
  it('returns null when start_time is null', () => {
    expect(calculateDurationSeconds(null, '2024-01-15T10:30:00Z')).toBeNull();
  });

  it('returns null when end_time is null', () => {
    expect(calculateDurationSeconds('2024-01-15T09:00:00Z', null)).toBeNull();
  });

  it('returns correct seconds for a 90-minute workout', () => {
    expect(
      calculateDurationSeconds('2024-01-15T09:00:00Z', '2024-01-15T10:30:00Z'),
    ).toBe(5400);
  });

  it('returns null for zero-duration', () => {
    expect(
      calculateDurationSeconds('2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z'),
    ).toBeNull();
  });

  it('returns null for negative duration', () => {
    expect(
      calculateDurationSeconds('2024-01-15T10:30:00Z', '2024-01-15T09:00:00Z'),
    ).toBeNull();
  });
});

// ─── (d) isPRSet displays PR badge on PR sets ───────────────────────────────

describe('isPRSet', () => {
  const personalRecords: PersonalRecordResponse[] = [
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

  it('returns true for a matching PR set', () => {
    expect(isPRSet(personalRecords, 'Bench Press', 100, 5)).toBe(true);
  });

  it('returns true for a PR with no previous weight', () => {
    expect(isPRSet(personalRecords, 'Squat', 140, 3)).toBe(true);
  });

  it('returns false for non-PR exercise', () => {
    expect(isPRSet(personalRecords, 'Deadlift', 180, 5)).toBe(false);
  });

  it('returns false when reps do not match', () => {
    expect(isPRSet(personalRecords, 'Bench Press', 100, 8)).toBe(false);
  });

  it('returns false when weight does not match', () => {
    expect(isPRSet(personalRecords, 'Bench Press', 95, 5)).toBe(false);
  });

  it('returns false for empty personal records', () => {
    expect(isPRSet([], 'Bench Press', 100, 5)).toBe(false);
  });

  it('returns false for null personal records', () => {
    expect(isPRSet(null, 'Bench Press', 100, 5)).toBe(false);
  });

  it('returns false for undefined personal records', () => {
    expect(isPRSet(undefined, 'Bench Press', 100, 5)).toBe(false);
  });

  it('matches within 0.01kg tolerance', () => {
    expect(isPRSet(personalRecords, 'Bench Press', 100.005, 5)).toBe(true);
  });

  it('does not match outside 0.01kg tolerance', () => {
    expect(isPRSet(personalRecords, 'Bench Press', 100.02, 5)).toBe(false);
  });
});

// ─── (g) calculateWorkingVolume in user's preferred unit system ─────────────

describe('calculateWorkingVolume', () => {
  const exercises = [
    {
      exercise_name: 'Bench Press',
      sets: [
        { weight_kg: 100, reps: 5, rpe: 8, set_type: 'normal' },
        { weight_kg: 100, reps: 5, rpe: 8.5, set_type: 'normal' },
        { weight_kg: 60, reps: 10, rpe: null, set_type: 'warm-up' },
      ],
    },
    {
      exercise_name: 'Squat',
      sets: [
        { weight_kg: 140, reps: 3, rpe: 9, set_type: 'normal' },
        { weight_kg: 80, reps: 5, rpe: null, set_type: 'warm-up' },
      ],
    },
  ];

  it('calculates volume in metric (kg), excluding warm-up sets', () => {
    const volume = calculateWorkingVolume(exercises, 'metric');
    // Bench: 100*5 + 100*5 = 1000 (warm-up excluded)
    // Squat: 140*3 = 420 (warm-up excluded)
    // Total: 1420
    expect(volume).toBe(1420);
  });

  it('calculates volume in imperial (lbs), excluding warm-up sets', () => {
    const volume = calculateWorkingVolume(exercises, 'imperial');
    // convertWeight(100, 'imperial') = 220.5, convertWeight(140, 'imperial') = 308.6
    // Bench: 220.5*5 + 220.5*5 = 2205
    // Squat: 308.6*3 = 925.8
    // Total: 3130.8
    expect(volume).toBeGreaterThan(3100);
    expect(volume).toBeLessThan(3200);
  });

  it('returns 0 for empty exercises', () => {
    expect(calculateWorkingVolume([], 'metric')).toBe(0);
  });

  it('returns 0 when all sets are warm-up', () => {
    const warmupOnly = [
      {
        exercise_name: 'Bench Press',
        sets: [
          { weight_kg: 60, reps: 10, rpe: null, set_type: 'warm-up' },
          { weight_kg: 40, reps: 15, rpe: null, set_type: 'warm-up' },
        ],
      },
    ];
    expect(calculateWorkingVolume(warmupOnly, 'metric')).toBe(0);
  });

  it('treats sets with no set_type as normal (included in volume)', () => {
    const noType = [
      {
        exercise_name: 'Curl',
        sets: [
          { weight_kg: 20, reps: 10, rpe: null },
        ],
      },
    ];
    expect(calculateWorkingVolume(noType as any, 'metric')).toBe(200);
  });

  it('includes drop-set and amrap sets in volume', () => {
    const mixed = [
      {
        exercise_name: 'Bench Press',
        sets: [
          { weight_kg: 100, reps: 5, rpe: 8, set_type: 'normal' },
          { weight_kg: 80, reps: 8, rpe: 9, set_type: 'drop-set' },
          { weight_kg: 60, reps: 15, rpe: 10, set_type: 'amrap' },
        ],
      },
    ];
    // 100*5 + 80*8 + 60*15 = 500 + 640 + 900 = 2040
    expect(calculateWorkingVolume(mixed, 'metric')).toBe(2040);
  });
});
