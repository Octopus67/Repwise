import * as fc from 'fast-check';
import { getRestDuration, COMPOUND_EXERCISES } from '../utils/getRestDuration';

const NUM_RUNS = 100;

// Arbitraries
const compoundExerciseArb = fc.constantFrom(...Array.from(COMPOUND_EXERCISES));
const isolationExerciseArb = fc.string({ minLength: 1, maxLength: 30 }).filter(
  (name) => !COMPOUND_EXERCISES.has(name.toLowerCase().trim()),
);
const preferencesArb = fc.record({
  compound_seconds: fc.option(fc.integer({ min: 1, max: 600 }), { nil: undefined }),
  isolation_seconds: fc.option(fc.integer({ min: 1, max: 600 }), { nil: undefined }),
});

describe('Rest Timer Duration Selection Property Tests', () => {
  /**
   * Property 16: Rest timer duration selection
   * For any exercise name and preferences, returns custom duration if configured,
   * else default (180 compound / 90 isolation). Result is always a positive integer.
   * **Validates: Requirements 8.1, 8.2, 8.7**
   */
  it('Property 16: compound exercises use compound_seconds or default 180', () => {
    fc.assert(
      fc.property(
        compoundExerciseArb,
        fc.option(preferencesArb, { nil: undefined }),
        (exerciseName, prefs) => {
          const result = getRestDuration(exerciseName, prefs);

          // Result must be a positive number
          if (result <= 0) return false;

          // Should use custom compound duration if configured, else 180
          const expected = prefs?.compound_seconds ?? 180;
          return result === expected;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 16: isolation exercises use isolation_seconds or default 90', () => {
    fc.assert(
      fc.property(
        isolationExerciseArb,
        fc.option(preferencesArb, { nil: undefined }),
        (exerciseName, prefs) => {
          const result = getRestDuration(exerciseName, prefs);

          // Result must be a positive number
          if (result <= 0) return false;

          // Should use custom isolation duration if configured, else 90
          const expected = prefs?.isolation_seconds ?? 90;
          return result === expected;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 16: result is always a positive integer when preferences have integer values', () => {
    fc.assert(
      fc.property(
        fc.oneof(compoundExerciseArb, isolationExerciseArb),
        fc.option(
          fc.record({
            compound_seconds: fc.option(fc.integer({ min: 1, max: 600 }), { nil: undefined }),
            isolation_seconds: fc.option(fc.integer({ min: 1, max: 600 }), { nil: undefined }),
          }),
          { nil: undefined },
        ),
        (exerciseName, prefs) => {
          const result = getRestDuration(exerciseName, prefs);
          return result > 0 && Number.isInteger(result);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
