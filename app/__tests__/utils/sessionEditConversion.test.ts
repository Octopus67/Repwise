import * as fc from 'fast-check';
import {
  sessionResponseToActiveExercises,
  activeExercisesToPayload,
  sessionHasPR,
  formatPRBanner,
} from '../../utils/sessionEditConversion';
import type {
  TrainingSessionResponse,
  PersonalRecordResponse,
} from '../../types/training';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.7
 * **Validates: Requirements 9.1, 9.4, 7.3, 7.6**
 */

const setEntryArb = fc.record({
  reps: fc.integer({ min: 1, max: 50 }),
  weight_kg: fc.float({ min: Math.fround(0.1), max: Math.fround(300), noNaN: true }).map((v) => Math.round(v * 10) / 10),
  rpe: fc.option(fc.float({ min: Math.fround(1), max: Math.fround(10), noNaN: true }), { nil: null }),
  set_type: fc.constantFrom('normal', 'warm-up', 'drop-set', 'amrap'),
});

const exerciseEntryArb = fc.record({
  exercise_name: fc.string({ minLength: 1, maxLength: 40 }),
  sets: fc.array(setEntryArb, { minLength: 1, maxLength: 5 }),
});

const sessionResponseArb: fc.Arbitrary<TrainingSessionResponse> = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  session_date: fc.constant('2024-01-15'),
  exercises: fc.array(exerciseEntryArb, { minLength: 1, maxLength: 4 }),
  metadata: fc.constant(null),
  personal_records: fc.constant([]),
  start_time: fc.constant(null),
  end_time: fc.constant(null),
  created_at: fc.constant('2024-01-15T10:00:00Z'),
  updated_at: fc.constant('2024-01-15T10:00:00Z'),
});

const prArb: fc.Arbitrary<PersonalRecordResponse> = fc.record({
  exercise_name: fc.string({ minLength: 1, maxLength: 40 }),
  reps: fc.integer({ min: 1, max: 20 }),
  new_weight_kg: fc.float({ min: Math.fround(1), max: Math.fround(300), noNaN: true }),
  previous_weight_kg: fc.option(fc.float({ min: Math.fround(1), max: Math.fround(300), noNaN: true }), { nil: null }),
});

describe('Session Edit Conversion Property Tests', () => {
  /**
   * Property: Round-trip — sessionResponseToActiveExercises then activeExercisesToPayload
   * produces weights within 0.1kg of original.
   * **Validates: Requirements 9.1**
   */
  it('round-trip conversion preserves weights within 0.1kg', () => {
    fc.assert(
      fc.property(
        sessionResponseArb,
        fc.constantFrom('metric' as const, 'imperial' as const),
        (session, unit) => {
          const active = sessionResponseToActiveExercises(session, unit);
          // Mark all sets as completed (payload only includes completed sets)
          for (const ex of active) {
            for (const set of ex.sets) {
              set.completed = true;
            }
          }
          const payload = activeExercisesToPayload(active, unit);

          // Compare each exercise/set weight
          for (let i = 0; i < session.exercises.length; i++) {
            const origSets = session.exercises[i].sets;
            const payloadSets = payload[i].sets;
            for (let j = 0; j < origSets.length; j++) {
              const diff = Math.abs(payloadSets[j].weight_kg - origSets[j].weight_kg);
              if (diff > 0.1) return false;
            }
          }
          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: sessionHasPR returns true when personal_records is non-empty
   * **Validates: Requirements 7.6**
   */
  it('sessionHasPR returns true when personal_records is non-empty', () => {
    fc.assert(
      fc.property(
        fc.array(prArb, { minLength: 1, maxLength: 5 }),
        (prs) => {
          const session: TrainingSessionResponse = {
            id: 'test-id',
            user_id: 'user-id',
            session_date: '2024-01-15',
            exercises: [],
            metadata: null,
            personal_records: prs,
            start_time: null,
            end_time: null,
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z',
          };
          return sessionHasPR(session) === true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: sessionHasPR returns false when personal_records is empty
   */
  it('sessionHasPR returns false when personal_records is empty', () => {
    const session: TrainingSessionResponse = {
      id: 'test-id',
      user_id: 'user-id',
      session_date: '2024-01-15',
      exercises: [],
      metadata: null,
      personal_records: [],
      start_time: null,
      end_time: null,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    };
    expect(sessionHasPR(session)).toBe(false);
  });

  /**
   * Property: formatPRBanner returns object with non-empty exerciseName and value
   * **Validates: Requirements 7.3**
   */
  it('formatPRBanner returns object with non-empty exerciseName and value', () => {
    fc.assert(
      fc.property(
        prArb,
        fc.constantFrom('metric' as const, 'imperial' as const),
        (pr, unit) => {
          const result = formatPRBanner(pr, unit);
          return (
            result.exerciseName.length > 0 &&
            result.value.length > 0 &&
            result.type.length > 0
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
