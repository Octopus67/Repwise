/**
 * Training UX Polish — Phase 1 Pure Utility Tests
 *
 * Unit tests + property-based tests (fast-check) for all Phase 1 utility modules.
 */

import * as fc from 'fast-check';
import { getRpeBadgeColor, shouldShowTypeBadge } from '../../utils/rpeBadgeColor';
import { calculateSetProgress } from '../../utils/setProgressCalculator';
import { getNextField, FieldName } from '../../utils/keyboardAdvanceLogic';
import { swapExerciseName } from '../../utils/exerciseSwapLogic';
import { computeWorkoutSummary, formatMiniSummary } from '../../utils/workoutSummaryFormatter';
import { generateWarmUpSets } from '../../utils/warmUpGenerator';
import type { SetType, ActiveSet, ActiveExercise } from '../../types/training';

// ─── Shared Arbitraries ─────────────────────────────────────────────────────

const activeSetArb = fc.record({
  localId: fc.string(),
  setNumber: fc.integer({ min: 1, max: 20 }),
  weight: fc.oneof(fc.constant(''), fc.integer({ min: 0, max: 500 }).map(String)),
  reps: fc.oneof(fc.constant(''), fc.integer({ min: 0, max: 100 }).map(String)),
  rpe: fc.oneof(fc.constant(''), fc.integer({ min: 1, max: 10 }).map(String)),
  setType: fc.constantFrom('normal', 'warm-up', 'drop-set', 'amrap') as fc.Arbitrary<SetType>,
  completed: fc.boolean(),
  completedAt: fc.oneof(fc.constant(null), fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map(d => {
    try { return d.toISOString(); } catch { return null; }
  }).filter((v): v is string => v !== null)),
});

const activeExerciseArb = fc.record({
  localId: fc.string(),
  exerciseName: fc.string({ minLength: 1 }),
  sets: fc.array(activeSetArb, { minLength: 0, maxLength: 10 }),
});

// ─── (a) RPE Badge Color ────────────────────────────────────────────────────

describe('getRpeBadgeColor', () => {
  it('returns none for RPE 5 (below range)', () => {
    expect(getRpeBadgeColor(5)).toBe('none');
  });

  it('returns green for RPE 6', () => {
    expect(getRpeBadgeColor(6)).toBe('green');
  });

  it('returns green for RPE 7', () => {
    expect(getRpeBadgeColor(7)).toBe('green');
  });

  it('returns yellow for RPE 8', () => {
    expect(getRpeBadgeColor(8)).toBe('yellow');
  });

  it('returns orange for RPE 9', () => {
    expect(getRpeBadgeColor(9)).toBe('orange');
  });

  it('returns red for RPE 10', () => {
    expect(getRpeBadgeColor(10)).toBe('red');
  });

  it('returns none for RPE 11 (above range)', () => {
    expect(getRpeBadgeColor(11)).toBe('none');
  });

  it('returns none for RPE 0', () => {
    expect(getRpeBadgeColor(0)).toBe('none');
  });

  // **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 8.4**
  // Property 3: RPE badge color mapping is correct
  it('Property 3: RPE in [6,10] never returns none', () => {
    fc.assert(
      fc.property(fc.integer({ min: 6, max: 10 }), (rpe) => {
        expect(getRpeBadgeColor(rpe)).not.toBe('none');
      }),
      { numRuns: 100 },
    );
  });

  it('Property 3: RPE outside [6,10] always returns none', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }).filter(n => n < 6 || n > 10),
        (rpe) => {
          expect(getRpeBadgeColor(rpe)).toBe('none');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── (b) Type Badge Visibility ──────────────────────────────────────────────

describe('shouldShowTypeBadge', () => {
  it('returns false for normal', () => {
    expect(shouldShowTypeBadge('normal')).toBe(false);
  });

  it('returns true for warm-up', () => {
    expect(shouldShowTypeBadge('warm-up')).toBe(true);
  });

  it('returns true for drop-set', () => {
    expect(shouldShowTypeBadge('drop-set')).toBe(true);
  });

  it('returns true for amrap', () => {
    expect(shouldShowTypeBadge('amrap')).toBe(true);
  });

  // **Validates: Requirements 2.3, 2.4**
  // Property 2: shouldShowTypeBadge returns true iff setType !== 'normal'
  it('Property 2: visible iff setType !== normal', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('normal', 'warm-up', 'drop-set', 'amrap') as fc.Arbitrary<SetType>,
        (setType) => {
          expect(shouldShowTypeBadge(setType)).toBe(setType !== 'normal');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── (c) Set Progress ───────────────────────────────────────────────────────

describe('calculateSetProgress', () => {
  it('returns zeros for empty array', () => {
    const result = calculateSetProgress([]);
    expect(result).toEqual({ completed: 0, total: 0, allComplete: false });
  });

  it('returns all complete when every set is completed', () => {
    const sets: ActiveSet[] = [
      { localId: '1', setNumber: 1, weight: '100', reps: '5', rpe: '', setType: 'normal', completed: true, completedAt: '2024-01-01T00:00:00Z' },
      { localId: '2', setNumber: 2, weight: '100', reps: '5', rpe: '', setType: 'normal', completed: true, completedAt: '2024-01-01T00:01:00Z' },
    ];
    const result = calculateSetProgress(sets);
    expect(result).toEqual({ completed: 2, total: 2, allComplete: true });
  });

  it('returns none complete when no sets are completed', () => {
    const sets: ActiveSet[] = [
      { localId: '1', setNumber: 1, weight: '', reps: '', rpe: '', setType: 'normal', completed: false, completedAt: null },
      { localId: '2', setNumber: 2, weight: '', reps: '', rpe: '', setType: 'normal', completed: false, completedAt: null },
    ];
    const result = calculateSetProgress(sets);
    expect(result).toEqual({ completed: 0, total: 2, allComplete: false });
  });

  it('returns mixed progress correctly', () => {
    const sets: ActiveSet[] = [
      { localId: '1', setNumber: 1, weight: '80', reps: '8', rpe: '7', setType: 'normal', completed: true, completedAt: '2024-01-01T00:00:00Z' },
      { localId: '2', setNumber: 2, weight: '', reps: '', rpe: '', setType: 'normal', completed: false, completedAt: null },
      { localId: '3', setNumber: 3, weight: '80', reps: '6', rpe: '9', setType: 'normal', completed: true, completedAt: '2024-01-01T00:02:00Z' },
    ];
    const result = calculateSetProgress(sets);
    expect(result).toEqual({ completed: 2, total: 3, allComplete: false });
  });

  // **Validates: Requirements 1.2, 1.4**
  // Property 1: completed count equals number of sets where completed===true,
  // total equals array length, allComplete iff all completed
  it('Property 1: set progress calculation is accurate', () => {
    fc.assert(
      fc.property(fc.array(activeSetArb, { minLength: 0, maxLength: 20 }), (sets) => {
        const result = calculateSetProgress(sets);
        const expectedCompleted = sets.filter(s => s.completed).length;

        expect(result.completed).toBe(expectedCompleted);
        expect(result.total).toBe(sets.length);

        if (sets.length === 0) {
          expect(result.allComplete).toBe(false);
        } else {
          expect(result.allComplete).toBe(expectedCompleted === sets.length);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── (d) Keyboard Advance ───────────────────────────────────────────────────

describe('getNextField', () => {
  // RPE disabled scenarios
  it('weight → reps when reps is empty (RPE off)', () => {
    expect(getNextField('weight', false, { weight: '80', reps: '', rpe: '' })).toBe('reps');
  });

  it('weight → next-row when reps is filled (RPE off)', () => {
    expect(getNextField('weight', false, { weight: '80', reps: '8', rpe: '' })).toBe('next-row');
  });

  it('reps → next-row when all filled (RPE off)', () => {
    expect(getNextField('reps', false, { weight: '80', reps: '8', rpe: '' })).toBe('next-row');
  });

  it('reps → null when weight is empty but no backward nav (RPE off)', () => {
    expect(getNextField('reps', false, { weight: '', reps: '8', rpe: '' })).toBe(null);
  });

  // RPE enabled scenarios
  it('weight → reps when reps is empty (RPE on)', () => {
    expect(getNextField('weight', true, { weight: '80', reps: '', rpe: '' })).toBe('reps');
  });

  it('weight → rpe when reps filled but rpe empty (RPE on)', () => {
    expect(getNextField('weight', true, { weight: '80', reps: '8', rpe: '' })).toBe('rpe');
  });

  it('weight → next-row when all filled (RPE on)', () => {
    expect(getNextField('weight', true, { weight: '80', reps: '8', rpe: '7' })).toBe('next-row');
  });

  it('reps → rpe when rpe is empty (RPE on)', () => {
    expect(getNextField('reps', true, { weight: '80', reps: '8', rpe: '' })).toBe('rpe');
  });

  it('reps → next-row when rpe is filled (RPE on)', () => {
    expect(getNextField('reps', true, { weight: '80', reps: '8', rpe: '7' })).toBe('next-row');
  });

  it('rpe → next-row when all filled (RPE on)', () => {
    expect(getNextField('rpe', true, { weight: '80', reps: '8', rpe: '7' })).toBe('next-row');
  });

  it('rpe → null when weight empty but no backward nav (RPE on)', () => {
    expect(getNextField('rpe', true, { weight: '', reps: '8', rpe: '7' })).toBe(null);
  });

  // **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
  // Property 6: getNextField never returns a field that already has a value;
  // returns 'next-row' when all applicable fields are filled
  it('Property 6: never returns a field that already has a value', () => {
    const fieldArb = fc.constantFrom('weight', 'reps', 'rpe') as fc.Arbitrary<FieldName>;
    const valueArb = fc.oneof(fc.constant(''), fc.integer({ min: 1, max: 500 }).map(String));

    fc.assert(
      fc.property(
        fieldArb,
        fc.boolean(),
        fc.record({ weight: valueArb, reps: valueArb, rpe: valueArb }),
        (currentField, rpeEnabled, values) => {
          const result = getNextField(currentField, rpeEnabled, values);

          // If result is a field name, that field must be empty
          if (result === 'weight' || result === 'reps' || result === 'rpe') {
            expect(values[result].trim()).toBe('');
          }

          // If all applicable fields are filled, result must be 'next-row'
          const fields: FieldName[] = rpeEnabled
            ? ['weight', 'reps', 'rpe']
            : ['weight', 'reps'];
          const allFilled = fields.every(f => values[f].trim() !== '');
          if (allFilled) {
            expect(result).toBe('next-row');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── (e) Exercise Swap ──────────────────────────────────────────────────────

describe('swapExerciseName', () => {
  it('changes exercise name', () => {
    const exercise: ActiveExercise = {
      localId: 'ex1',
      exerciseName: 'Bench Press',
      sets: [
        { localId: 's1', setNumber: 1, weight: '100', reps: '5', rpe: '8', setType: 'normal', completed: true, completedAt: '2024-01-01T00:00:00Z' },
      ],
    };
    const result = swapExerciseName(exercise, 'Incline Press');
    expect(result.exerciseName).toBe('Incline Press');
    expect(result.sets).toEqual(exercise.sets);
  });

  it('returns original when newName is empty', () => {
    const exercise: ActiveExercise = {
      localId: 'ex1',
      exerciseName: 'Squat',
      sets: [],
    };
    const result = swapExerciseName(exercise, '');
    expect(result).toBe(exercise);
  });

  it('returns original when newName is whitespace only', () => {
    const exercise: ActiveExercise = {
      localId: 'ex1',
      exerciseName: 'Squat',
      sets: [],
    };
    const result = swapExerciseName(exercise, '   ');
    expect(result).toBe(exercise);
  });

  // **Validates: Requirements 10.2**
  // Property 7: for any ActiveExercise with arbitrary sets, swapExerciseName
  // preserves all set data. Only exerciseName changes. Empty name guard returns original.
  it('Property 7: swap preserves all set data', () => {
    fc.assert(
      fc.property(
        activeExerciseArb,
        fc.string({ minLength: 1 }),
        (exercise, newName) => {
          const result = swapExerciseName(exercise, newName);

          if (!newName.trim()) {
            // Empty name guard: original returned unchanged
            expect(result).toBe(exercise);
          } else {
            expect(result.exerciseName).toBe(newName);
            expect(result.localId).toBe(exercise.localId);
            expect(result.sets.length).toBe(exercise.sets.length);

            for (let i = 0; i < exercise.sets.length; i++) {
              expect(result.sets[i].weight).toBe(exercise.sets[i].weight);
              expect(result.sets[i].reps).toBe(exercise.sets[i].reps);
              expect(result.sets[i].rpe).toBe(exercise.sets[i].rpe);
              expect(result.sets[i].setType).toBe(exercise.sets[i].setType);
              expect(result.sets[i].completed).toBe(exercise.sets[i].completed);
              expect(result.sets[i].completedAt).toBe(exercise.sets[i].completedAt);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── (f) Workout Summary ────────────────────────────────────────────────────

describe('computeWorkoutSummary & formatMiniSummary', () => {
  it('returns zero counts for empty exercises', () => {
    const result = computeWorkoutSummary([], new Date().toISOString());
    expect(result.exerciseCount).toBe(0);
    expect(result.completedSetCount).toBe(0);
    expect(result.totalVolumeKg).toBe(0);
  });

  it('excludes skipped exercises from counts', () => {
    const exercises = [
      {
        localId: 'e1',
        exerciseName: 'Squat',
        sets: [
          { localId: 's1', setNumber: 1, weight: '100', reps: '5', rpe: '', setType: 'normal' as SetType, completed: true, completedAt: '2024-01-01T00:00:00Z' },
        ],
      },
      {
        localId: 'e2',
        exerciseName: 'Bench',
        sets: [
          { localId: 's2', setNumber: 1, weight: '80', reps: '8', rpe: '', setType: 'normal' as SetType, completed: true, completedAt: '2024-01-01T00:01:00Z' },
        ],
        skipped: true,
      },
    ] as any[];

    const result = computeWorkoutSummary(exercises, new Date().toISOString());
    expect(result.exerciseCount).toBe(1);
    expect(result.completedSetCount).toBe(1);
  });

  it('formatMiniSummary contains all three values', () => {
    const summary = {
      exerciseCount: 5,
      completedSetCount: 18,
      totalVolumeKg: 12000,
      durationSeconds: 2700,
    };
    const formatted = formatMiniSummary(summary);
    expect(formatted).toContain('5');
    expect(formatted).toContain('18');
    expect(formatted).toContain('45');
  });

  // **Validates: Requirements 6.2**
  // Property 5: computeWorkoutSummary excludes skipped exercises from exerciseCount
  // and completedSetCount. formatMiniSummary contains all three values.
  it('Property 5: skipped exercises excluded, formatMiniSummary contains all values', () => {
    const exerciseWithSkipArb = fc.record({
      localId: fc.string(),
      exerciseName: fc.string({ minLength: 1 }),
      sets: fc.array(activeSetArb, { minLength: 0, maxLength: 5 }),
      skipped: fc.boolean(),
    });

    fc.assert(
      fc.property(
        fc.array(exerciseWithSkipArb, { minLength: 0, maxLength: 8 }),
        (exercises) => {
          const startedAt = new Date(Date.now() - 3600_000).toISOString(); // 1 hour ago
          const result = computeWorkoutSummary(exercises as any[], startedAt);

          const activeExercises = exercises.filter(e => !e.skipped);
          const expectedCompletedSets = activeExercises
            .flatMap(e => e.sets)
            .filter(s => s.completed).length;

          expect(result.exerciseCount).toBe(activeExercises.length);
          expect(result.completedSetCount).toBe(expectedCompletedSets);

          // formatMiniSummary contains all three values
          const formatted = formatMiniSummary(result);
          expect(formatted).toContain(String(result.exerciseCount));
          expect(formatted).toContain(String(result.completedSetCount));
          const mins = Math.floor(result.durationSeconds / 60);
          expect(formatted).toContain(String(mins));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── (g) Warm-Up Generator ──────────────────────────────────────────────────

describe('generateWarmUpSets', () => {
  it('generates warm-up sets for 100kg working weight', () => {
    const sets = generateWarmUpSets(100);
    expect(sets.length).toBeGreaterThanOrEqual(1);
    expect(sets.every(s => s.setType === 'warm-up')).toBe(true);
    expect(sets.every(s => s.weightKg > 0 && s.weightKg < 100)).toBe(true);
  });

  it('generates bar-only set for 25kg working weight (just above bar)', () => {
    const sets = generateWarmUpSets(25);
    expect(sets.length).toBeGreaterThanOrEqual(1);
    expect(sets[0].weightKg).toBe(20);
    expect(sets[0].reps).toBe(10);
  });

  it('generates correct ramp for 200kg working weight', () => {
    const sets = generateWarmUpSets(200);
    expect(sets.length).toBe(3); // bar, 60%, 80%
    expect(sets[0].weightKg).toBe(20);
    expect(sets[1].weightKg).toBe(120); // 200*0.6 = 120
    expect(sets[2].weightKg).toBe(160); // 200*0.8 = 160
  });

  // (h) Warm-up edge case: returns [] when working ≤ bar
  it('returns empty array when working weight equals bar weight', () => {
    expect(generateWarmUpSets(20)).toEqual([]);
  });

  it('returns empty array when working weight is less than bar weight', () => {
    expect(generateWarmUpSets(15)).toEqual([]);
  });

  it('returns empty array when working weight is 0', () => {
    expect(generateWarmUpSets(0)).toEqual([]);
  });

  it('returns empty array with custom bar weight when working ≤ bar', () => {
    expect(generateWarmUpSets(15, 15)).toEqual([]);
  });

  // **Validates: Requirements 16.2, 16.3**
  // Property 13: for any working weight > bar weight, generateWarmUpSets returns
  // array where all sets have setType 'warm-up', weights are monotonically
  // non-decreasing, all weights > 0 and < working weight, all weights are
  // multiples of 2.5, reps are monotonically non-increasing.
  it('Property 13: warm-up generator produces valid progressive ramp', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 21, max: 500 }), // working weight > default bar (20)
        (workingWeight) => {
          const sets = generateWarmUpSets(workingWeight);

          // Must produce at least one set
          expect(sets.length).toBeGreaterThanOrEqual(1);

          // All sets have setType 'warm-up'
          for (const s of sets) {
            expect(s.setType).toBe('warm-up');
          }

          // Weights are monotonically non-decreasing
          for (let i = 1; i < sets.length; i++) {
            expect(sets[i].weightKg).toBeGreaterThanOrEqual(sets[i - 1].weightKg);
          }

          // All weights > 0 and < working weight
          for (const s of sets) {
            expect(s.weightKg).toBeGreaterThan(0);
            expect(s.weightKg).toBeLessThan(workingWeight);
          }

          // All weights are multiples of 2.5
          for (const s of sets) {
            expect(s.weightKg % 2.5).toBeCloseTo(0, 10);
          }

          // Reps are monotonically non-increasing
          for (let i = 1; i < sets.length; i++) {
            expect(sets[i].reps).toBeLessThanOrEqual(sets[i - 1].reps);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
