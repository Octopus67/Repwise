import * as fc from 'fast-check';
import { canCompleteSet, hasUnsavedData, copyPreviousToSet } from '../../utils/setCompletionLogic';
import { parseWeightInput } from '../../utils/unitConversion';
import type { ActiveSet, ActiveExercise, PreviousPerformanceData } from '../../types/training';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.5
 * **Validates: Requirements 2.2, 2.3, 1.7, 3.4**
 */

function makeSet(overrides: Partial<ActiveSet> = {}): ActiveSet {
  return {
    localId: 'set-1',
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

describe('Set Completion Logic Property Tests', () => {
  /**
   * Property: Set with empty weight → valid=false
   * **Validates: Requirements 2.3**
   */
  it('set with empty weight is invalid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (reps) => {
          const set = makeSet({ weight: '', reps: String(reps) });
          const result = canCompleteSet(set);
          return result.valid === false && result.errors.includes('weight');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Set with empty reps → valid=false
   * **Validates: Requirements 2.3**
   */
  it('set with empty reps is invalid', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true }),
        (weight) => {
          const set = makeSet({ weight: String(weight), reps: '' });
          const result = canCompleteSet(set);
          return result.valid === false && result.errors.includes('reps');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Set with valid weight and reps → valid=true
   * **Validates: Requirements 2.2**
   */
  it('set with valid weight and reps is valid', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        (weight, reps) => {
          const set = makeSet({ weight: String(weight), reps: String(reps) });
          const result = canCompleteSet(set);
          return result.valid === true && result.errors.length === 0;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: hasUnsavedData returns false for empty exercises array
   * **Validates: Requirements 1.7**
   */
  it('hasUnsavedData returns false for empty exercises array', () => {
    expect(hasUnsavedData([])).toBe(false);
  });

  /**
   * Property: copyPreviousToSet round-trip — copy then parse back to kg within 0.1kg
   * **Validates: Requirements 3.4**
   */
  it('copyPreviousToSet round-trip preserves weight within 0.1kg', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 300, noNaN: true }),
        fc.integer({ min: 1, max: 50 }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (weightKg, reps, unit) => {
          const roundedKg = Math.round(weightKg * 10) / 10;
          const prevData: PreviousPerformanceData = {
            exerciseName: 'Test',
            sessionDate: '2024-01-15',
            sets: [{ weightKg: roundedKg, reps, rpe: null }],
          };
          const copied = copyPreviousToSet(prevData, 0, unit);
          const parsedBack = parseWeightInput(parseFloat(copied.weight), unit);
          return Math.abs(parsedBack - roundedKg) <= 0.1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
