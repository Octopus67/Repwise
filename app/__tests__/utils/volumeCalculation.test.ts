import * as fc from 'fast-check';
import { calculateWorkingVolume } from '../../utils/volumeCalculation';
import type { ActiveExercise, SetType } from '../../types/training';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.2
 * **Validates: Requirements 6.3, 8.2**
 */

const setTypeArb: fc.Arbitrary<SetType> = fc.constantFrom('normal', 'warm-up', 'drop-set', 'amrap');

function makeSet(overrides: Partial<{
  weight: string; reps: string; setType: SetType; completed: boolean;
}> = {}) {
  return {
    localId: `set-${Math.random()}`,
    setNumber: 1,
    weight: overrides.weight ?? '0',
    reps: overrides.reps ?? '0',
    rpe: '',
    setType: overrides.setType ?? 'normal',
    completed: overrides.completed ?? false,
    completedAt: null,
  };
}

function makeExercise(sets: ReturnType<typeof makeSet>[]): ActiveExercise {
  return {
    localId: `ex-${Math.random()}`,
    exerciseName: 'Test Exercise',
    sets,
  };
}

describe('Volume Calculation Property Tests', () => {
  /**
   * Property: Working volume excludes warm-up sets.
   * Generate exercises with mixed set types; warm-up sets should not contribute.
   * **Validates: Requirements 6.3**
   */
  it('working volume excludes warm-up sets', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            weight: fc.float({ min: 1, max: 500, noNaN: true }),
            reps: fc.integer({ min: 1, max: 50 }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (setData) => {
          // Create exercises: all warm-up, all completed
          const warmupSets = setData.map((s) =>
            makeSet({ weight: String(s.weight), reps: String(s.reps), setType: 'warm-up', completed: true }),
          );
          const exercises = [makeExercise(warmupSets)];
          const volume = calculateWorkingVolume(exercises);
          return volume === 0;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Working volume only counts completed sets.
   * **Validates: Requirements 8.2**
   */
  it('working volume only counts completed sets', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            weight: fc.float({ min: 1, max: 500, noNaN: true }),
            reps: fc.integer({ min: 1, max: 50 }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (setData) => {
          // All sets are normal but NOT completed
          const incompleteSets = setData.map((s) =>
            makeSet({ weight: String(s.weight), reps: String(s.reps), setType: 'normal', completed: false }),
          );
          const exercises = [makeExercise(incompleteSets)];
          const volume = calculateWorkingVolume(exercises);
          return volume === 0;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Volume is always ≥ 0.
   * **Validates: Requirements 6.3, 8.2**
   */
  it('volume is always >= 0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(
            fc.record({
              weight: fc.float({ min: 0, max: 500, noNaN: true }),
              reps: fc.integer({ min: 0, max: 100 }),
              setType: setTypeArb,
              completed: fc.boolean(),
            }),
            { minLength: 0, maxLength: 5 },
          ),
          { minLength: 0, maxLength: 3 },
        ),
        (exerciseSets) => {
          const exercises = exerciseSets.map((sets) =>
            makeExercise(
              sets.map((s) =>
                makeSet({
                  weight: String(s.weight),
                  reps: String(s.reps),
                  setType: s.setType,
                  completed: s.completed,
                }),
              ),
            ),
          );
          const volume = calculateWorkingVolume(exercises);
          return volume >= 0;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
