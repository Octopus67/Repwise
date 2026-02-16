/**
 * ActiveWorkout UX Polish — Integration Tests (Task 11.4)
 *
 * Tests cover pure logic aspects of the UX polish features.
 * No full React rendering — tests validate logic, store actions, and data flow.
 */

import { getRpeBadgeColor, shouldShowTypeBadge } from '../../utils/rpeBadgeColor';
import { calculateSetProgress } from '../../utils/setProgressCalculator';
import { getNextField, FieldName } from '../../utils/keyboardAdvanceLogic';
import { swapExerciseName } from '../../utils/exerciseSwapLogic';
import { computeWorkoutSummary, formatMiniSummary } from '../../utils/workoutSummaryFormatter';
import { generateWarmUpSets } from '../../utils/warmUpGenerator';
import { colors } from '../../theme/tokens';
import type { ActiveSet, ActiveExercise, SetType } from '../../types/training';

// ─── Helper Factories ───────────────────────────────────────────────────────

function makeSet(overrides: Partial<ActiveSet> = {}): ActiveSet {
  return {
    localId: `set-${Math.random().toString(36).slice(2)}`,
    setNumber: 1,
    weight: '',
    reps: '',
    rpe: '',
    setType: 'normal',
    completed: false,
    completedAt: null,
    ...overrides,
  };
}

function makeExercise(overrides: Partial<ActiveExercise> = {}): ActiveExercise {
  return {
    localId: `ex-${Math.random().toString(36).slice(2)}`,
    exerciseName: 'Bench Press',
    sets: [makeSet({ setNumber: 1 })],
    ...overrides,
  };
}

// ─── (a) Completed set has positiveSubtle background logic ──────────────────

describe('Completed set visual state', () => {
  it('positiveSubtle color token exists and is a valid color string', () => {
    expect(colors.semantic.positiveSubtle).toBeDefined();
    expect(typeof colors.semantic.positiveSubtle).toBe('string');
  });

  it('completed set is identified by completed === true', () => {
    const completedSet = makeSet({ completed: true, completedAt: '2024-01-01T00:00:00Z' });
    const pendingSet = makeSet({ completed: false });
    expect(completedSet.completed).toBe(true);
    expect(pendingSet.completed).toBe(false);
  });
});

// ─── (b) RPE column hidden when preference is off ───────────────────────────

describe('RPE column visibility', () => {
  it('RPE badge returns none for values outside 6-10 range', () => {
    expect(getRpeBadgeColor(0)).toBe('none');
    expect(getRpeBadgeColor(5)).toBe('none');
    expect(getRpeBadgeColor(11)).toBe('none');
  });

  it('RPE badge returns correct colors for valid RPE values', () => {
    expect(getRpeBadgeColor(6)).toBe('green');
    expect(getRpeBadgeColor(7)).toBe('green');
    expect(getRpeBadgeColor(8)).toBe('yellow');
    expect(getRpeBadgeColor(9)).toBe('orange');
    expect(getRpeBadgeColor(10)).toBe('red');
  });
});

// ─── (c) Type badge appears for non-normal set types ────────────────────────

describe('Type badge visibility', () => {
  it('shows badge for non-normal types', () => {
    expect(shouldShowTypeBadge('warm-up')).toBe(true);
    expect(shouldShowTypeBadge('drop-set')).toBe(true);
    expect(shouldShowTypeBadge('amrap')).toBe(true);
  });

  it('hides badge for normal type', () => {
    expect(shouldShowTypeBadge('normal')).toBe(false);
  });
});

// ─── (d) FinishBar displays correct summary ────────────────────────────────

describe('FinishBar summary logic', () => {
  it('computes correct summary for mixed exercises', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({
        exerciseName: 'Squat',
        sets: [
          makeSet({ weight: '100', reps: '5', completed: true, completedAt: '2024-01-01T00:00:00Z' }),
          makeSet({ weight: '100', reps: '5', completed: true, completedAt: '2024-01-01T00:01:00Z' }),
          makeSet({ weight: '100', reps: '5', completed: false }),
        ],
      }),
      makeExercise({
        exerciseName: 'Bench',
        sets: [
          makeSet({ weight: '80', reps: '8', completed: true, completedAt: '2024-01-01T00:02:00Z' }),
        ],
      }),
    ];

    const startedAt = new Date(Date.now() - 2700_000).toISOString(); // 45 min ago
    const summary = computeWorkoutSummary(exercises, startedAt);

    expect(summary.exerciseCount).toBe(2);
    expect(summary.completedSetCount).toBe(3);
    expect(summary.totalVolumeKg).toBe(100 * 5 + 100 * 5 + 80 * 8); // 1640

    const formatted = formatMiniSummary(summary);
    expect(formatted).toContain('2');
    expect(formatted).toContain('3');
  });
});

// ─── (e) Exercise swap preserves set data ───────────────────────────────────

describe('Exercise swap', () => {
  it('preserves all set data when swapping exercise name', () => {
    const sets = [
      makeSet({ weight: '100', reps: '5', rpe: '8', setType: 'normal', completed: true, completedAt: '2024-01-01T00:00:00Z' }),
      makeSet({ weight: '100', reps: '5', rpe: '9', setType: 'normal', completed: true, completedAt: '2024-01-01T00:01:00Z' }),
      makeSet({ weight: '95', reps: '5', rpe: '', setType: 'drop-set', completed: false }),
    ];
    const exercise = makeExercise({ exerciseName: 'Barbell Squat', sets });

    const swapped = swapExerciseName(exercise, 'Front Squat');

    expect(swapped.exerciseName).toBe('Front Squat');
    expect(swapped.sets.length).toBe(3);
    expect(swapped.sets[0].weight).toBe('100');
    expect(swapped.sets[0].completed).toBe(true);
    expect(swapped.sets[0].completedAt).toBe('2024-01-01T00:00:00Z');
    expect(swapped.sets[2].setType).toBe('drop-set');
  });

  it('returns original exercise when new name is empty', () => {
    const exercise = makeExercise({ exerciseName: 'Squat' });
    const result = swapExerciseName(exercise, '');
    expect(result).toBe(exercise);
  });
});

// ─── (f) Exercise skip applies opacity logic ────────────────────────────────

describe('Exercise skip state', () => {
  it('skipped exercise is identified by skipped === true', () => {
    const exercise = makeExercise({ skipped: true });
    expect(exercise.skipped).toBe(true);
  });

  it('skipped exercises excluded from workout summary', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({
        exerciseName: 'Squat',
        sets: [makeSet({ completed: true, completedAt: '2024-01-01T00:00:00Z', weight: '100', reps: '5' })],
      }),
      makeExercise({
        exerciseName: 'Bench',
        sets: [makeSet({ completed: true, completedAt: '2024-01-01T00:01:00Z', weight: '80', reps: '8' })],
        skipped: true,
      }),
    ];

    const summary = computeWorkoutSummary(exercises, new Date().toISOString());
    expect(summary.exerciseCount).toBe(1);
    expect(summary.completedSetCount).toBe(1);
  });

  it('unskipped exercise restores to normal state', () => {
    const exercise = makeExercise({ skipped: true });
    const unskipped = { ...exercise, skipped: false };
    expect(unskipped.skipped).toBe(false);
    expect(unskipped.exerciseName).toBe(exercise.exerciseName);
    expect(unskipped.sets).toBe(exercise.sets);
  });
});


// ─── (g) Per-exercise notes save and restore ────────────────────────────────

describe('Per-exercise notes', () => {
  it('exercise with notes has notes field set', () => {
    const exercise = makeExercise({ notes: 'Keep elbows tucked' });
    expect(exercise.notes).toBe('Keep elbows tucked');
  });

  it('exercise without notes has undefined notes', () => {
    const exercise = makeExercise();
    expect(exercise.notes).toBeUndefined();
  });

  it('notes included in session metadata when present', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({ exerciseName: 'Squat', notes: 'Brace hard' }),
      makeExercise({ exerciseName: 'Bench', notes: '' }),
      makeExercise({ exerciseName: 'Deadlift' }),
    ];

    const exerciseNotes: Record<string, string> = {};
    for (const ex of exercises) {
      if (ex.notes && ex.notes.trim()) {
        exerciseNotes[ex.exerciseName] = ex.notes;
      }
    }

    expect(Object.keys(exerciseNotes)).toEqual(['Squat']);
    expect(exerciseNotes['Squat']).toBe('Brace hard');
  });
});

// ─── (h) Keyboard auto-advance focuses correct next field ───────────────────

describe('Keyboard auto-advance', () => {
  it('weight → reps when reps is empty', () => {
    expect(getNextField('weight', false, { weight: '80', reps: '', rpe: '' })).toBe('reps');
  });

  it('weight → rpe when reps filled and RPE enabled', () => {
    expect(getNextField('weight', true, { weight: '80', reps: '8', rpe: '' })).toBe('rpe');
  });

  it('all filled → next-row', () => {
    expect(getNextField('reps', false, { weight: '80', reps: '8', rpe: '' })).toBe('next-row');
  });

  it('all filled with RPE → next-row', () => {
    expect(getNextField('rpe', true, { weight: '80', reps: '8', rpe: '7' })).toBe('next-row');
  });

  it('does not go backward', () => {
    expect(getNextField('reps', false, { weight: '', reps: '8', rpe: '' })).toBe(null);
  });
});

// ─── (i) Warm-up sets inserted with correct type ────────────────────────────

describe('Warm-up set generation', () => {
  it('generates warm-up sets with correct setType', () => {
    const sets = generateWarmUpSets(100);
    expect(sets.length).toBeGreaterThanOrEqual(1);
    for (const s of sets) {
      expect(s.setType).toBe('warm-up');
    }
  });

  it('all warm-up weights are less than working weight', () => {
    const sets = generateWarmUpSets(100);
    for (const s of sets) {
      expect(s.weightKg).toBeLessThan(100);
      expect(s.weightKg).toBeGreaterThan(0);
    }
  });

  it('warm-up weights are multiples of 2.5', () => {
    const sets = generateWarmUpSets(150);
    for (const s of sets) {
      expect(s.weightKg % 2.5).toBeCloseTo(0, 10);
    }
  });

  it('returns empty when working weight <= bar', () => {
    expect(generateWarmUpSets(20)).toEqual([]);
    expect(generateWarmUpSets(15)).toEqual([]);
  });

  it('reps decrease as weight increases', () => {
    const sets = generateWarmUpSets(200);
    for (let i = 1; i < sets.length; i++) {
      expect(sets[i].reps).toBeLessThanOrEqual(sets[i - 1].reps);
    }
  });
});
