import * as fc from 'fast-check';
import { computeWorkoutSummary } from '../../utils/workoutSummary';
import type { ActiveExercise, ActiveSet } from '../../types/training';

const NUM_RUNS = 100;

// --- Generators ---

const setArb = fc.record({
  localId: fc.uuid(),
  setNumber: fc.integer({ min: 1, max: 20 }),
  weight: fc.oneof(fc.constant(''), fc.float({ min: 0, max: 500, noNaN: true }).map(String)),
  reps: fc.oneof(fc.constant(''), fc.integer({ min: 0, max: 100 }).map(String)),
  rpe: fc.constant(''),
  setType: fc.constant('normal' as const),
  completed: fc.boolean(),
  completedAt: fc.constant(null),
});

const exerciseArb = fc.record({
  localId: fc.uuid(),
  exerciseName: fc.string({ minLength: 1, maxLength: 30 }),
  sets: fc.array(setArb, { minLength: 0, maxLength: 8 }),
  notes: fc.constant(undefined),
  skipped: fc.oneof(fc.constant(undefined), fc.constant(false), fc.constant(true)),
});

/**
 * Property 15: Workout summary computation is accurate
 * **Validates: Requirements 10.1, 10.2**
 */
describe('Workout Summary Property Tests', () => {
  it('exerciseCount equals non-skipped exercises', () => {
    fc.assert(
      fc.property(
        fc.array(exerciseArb, { minLength: 0, maxLength: 10 }),
        (exercises) => {
          const result = computeWorkoutSummary(exercises as ActiveExercise[]);
          const expected = exercises.filter((e) => e.skipped !== true).length;
          return result.exerciseCount === expected;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('setCount equals completed sets across non-skipped exercises', () => {
    fc.assert(
      fc.property(
        fc.array(exerciseArb, { minLength: 0, maxLength: 10 }),
        (exercises) => {
          const result = computeWorkoutSummary(exercises as ActiveExercise[]);
          const expected = exercises
            .filter((e) => e.skipped !== true)
            .flatMap((e) => e.sets)
            .filter((s) => s.completed).length;
          return result.setCount === expected;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('totalVolumeKg matches manual calculation for completed sets', () => {
    fc.assert(
      fc.property(
        fc.array(exerciseArb, { minLength: 0, maxLength: 10 }),
        (exercises) => {
          const result = computeWorkoutSummary(exercises as ActiveExercise[]);
          const expected = exercises
            .filter((e) => e.skipped !== true)
            .flatMap((e) => e.sets)
            .filter((s) => s.completed)
            .reduce((sum, s) => {
              const w = parseFloat(s.weight) || 0;
              const r = parseInt(s.reps, 10) || 0;
              return sum + w * r;
            }, 0);
          return Math.abs(result.totalVolumeKg - expected) < 0.001;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('totalVolumeKg is always >= 0', () => {
    fc.assert(
      fc.property(
        fc.array(exerciseArb, { minLength: 0, maxLength: 10 }),
        (exercises) => {
          const result = computeWorkoutSummary(exercises as ActiveExercise[]);
          return result.totalVolumeKg >= 0;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
