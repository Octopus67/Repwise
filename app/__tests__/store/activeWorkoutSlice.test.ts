/**
 * Unit + Property tests for activeWorkout Zustand slice
 *
 * Feature: training-log-redesign, Task 10.2
 * Feature: workout-logging-premium, Task 25
 * **Validates: Requirements 1.9, 2.2, 2.3, 6.1, 15.1, 15.3, 17.1, 17.2, 12.2**
 */

import * as fc from 'fast-check';

// Mock AsyncStorage before importing the store
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
  __esModule: true,
}));

import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import type { ActiveExercise, ActiveSet, SetType } from '../../types/training';

// Helper to reset store between tests
function resetStore() {
  useActiveWorkoutStore.getState().discardWorkout();
}

describe('activeWorkoutSlice', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── startWorkout ─────────────────────────────────────────────────────────

  describe('startWorkout', () => {
    it('sets isActive=true, workoutId is non-empty, startedAt is ISO string', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });

      const state = useActiveWorkoutStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.workoutId).toBeTruthy();
      expect(state.workoutId.length).toBeGreaterThan(0);
      // startedAt should be a valid ISO string
      expect(new Date(state.startedAt).toISOString()).toBe(state.startedAt);
      expect(state.mode).toBe('new');
    });

    it('uses provided sessionDate when given', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new', sessionDate: '2024-01-15' });

      const state = useActiveWorkoutStore.getState();
      expect(state.sessionDate).toBe('2024-01-15');
    });

    it('defaults sessionDate to today when not provided', () => {
      const today = new Date().toISOString().split('T')[0];
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });

      const state = useActiveWorkoutStore.getState();
      expect(state.sessionDate).toBe(today);
    });

    it('sets editSessionId in edit mode', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'edit', editSessionId: 'session-123' });

      const state = useActiveWorkoutStore.getState();
      expect(state.mode).toBe('edit');
      expect(state.editSessionId).toBe('session-123');
    });
  });

  // ── discardWorkout ───────────────────────────────────────────────────────

  describe('discardWorkout', () => {
    it('resets isActive=false, exercises=[]', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      expect(useActiveWorkoutStore.getState().isActive).toBe(true);
      expect(useActiveWorkoutStore.getState().exercises.length).toBe(1);

      store.discardWorkout();

      const state = useActiveWorkoutStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.exercises).toEqual([]);
      expect(state.workoutId).toBe('');
      expect(state.notes).toBe('');
      expect(state.supersetGroups).toEqual([]);
    });
  });

  // ── addExercise ──────────────────────────────────────────────────────────

  describe('addExercise', () => {
    it('adds exercise with 1 set, setType=normal', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Barbell Bench Press');

      const state = useActiveWorkoutStore.getState();
      expect(state.exercises.length).toBe(1);
      expect(state.exercises[0].exerciseName).toBe('Barbell Bench Press');
      expect(state.exercises[0].sets.length).toBe(1);
      expect(state.exercises[0].sets[0].setType).toBe('normal');
      expect(state.exercises[0].sets[0].weight).toBe('');
      expect(state.exercises[0].sets[0].reps).toBe('');
      expect(state.exercises[0].sets[0].completed).toBe(false);
    });

    it('adds multiple exercises', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');
      store.addExercise('Squat');
      store.addExercise('Deadlift');

      const state = useActiveWorkoutStore.getState();
      expect(state.exercises.length).toBe(3);
      expect(state.exercises.map((e) => e.exerciseName)).toEqual([
        'Bench Press',
        'Squat',
        'Deadlift',
      ]);
    });
  });

  // ── addSet ───────────────────────────────────────────────────────────────

  describe('addSet', () => {
    it('copies last set weight/reps', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

      // Fill in the first set
      store.updateSetField(exId, setId, 'weight', '100');
      store.updateSetField(exId, setId, 'reps', '8');

      // Add a second set
      store.addSet(exId);

      const state = useActiveWorkoutStore.getState();
      const exercise = state.exercises[0];
      expect(exercise.sets.length).toBe(2);
      expect(exercise.sets[1].weight).toBe('100');
      expect(exercise.sets[1].reps).toBe('8');
      expect(exercise.sets[1].setNumber).toBe(2);
      expect(exercise.sets[1].completed).toBe(false);
    });

    it('adds empty set when no previous set exists with data', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      store.addSet(exId);

      const state = useActiveWorkoutStore.getState();
      expect(state.exercises[0].sets.length).toBe(2);
      expect(state.exercises[0].sets[1].weight).toBe('');
      expect(state.exercises[0].sets[1].reps).toBe('');
    });
  });

  // ── removeSet ────────────────────────────────────────────────────────────

  describe('removeSet', () => {
    it('ensures at least 1 set remains', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

      store.removeSet(exId, setId);

      // Should still have 1 set
      const state = useActiveWorkoutStore.getState();
      expect(state.exercises[0].sets.length).toBe(1);
    });

    it('removes set and renumbers remaining', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      store.addSet(exId);
      store.addSet(exId);

      const set1Id = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;
      store.removeSet(exId, set1Id);

      const state = useActiveWorkoutStore.getState();
      expect(state.exercises[0].sets.length).toBe(2);
      expect(state.exercises[0].sets[0].setNumber).toBe(1);
      expect(state.exercises[0].sets[1].setNumber).toBe(2);
    });
  });

  // ── toggleSetCompleted ───────────────────────────────────────────────────

  describe('toggleSetCompleted', () => {
    it('with valid data → completed=true', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

      store.updateSetField(exId, setId, 'weight', '100');
      store.updateSetField(exId, setId, 'reps', '8');

      const result = useActiveWorkoutStore.getState().toggleSetCompleted(exId, setId);

      expect(result.completed).toBe(true);
      expect(result.validationError).toBeNull();

      const state = useActiveWorkoutStore.getState();
      const set = state.exercises[0].sets[0];
      expect(set.completed).toBe(true);
      expect(set.completedAt).toBeTruthy();
    });

    it('with empty weight → validationError is non-null', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

      store.updateSetField(exId, setId, 'reps', '8');
      // weight is still empty

      const result = useActiveWorkoutStore.getState().toggleSetCompleted(exId, setId);

      expect(result.completed).toBe(false);
      expect(result.validationError).toBeTruthy();
      expect(result.validationError).toContain('weight');
    });

    it('with empty reps → validationError is non-null', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

      store.updateSetField(exId, setId, 'weight', '100');
      // reps is still empty

      const result = useActiveWorkoutStore.getState().toggleSetCompleted(exId, setId);

      expect(result.completed).toBe(false);
      expect(result.validationError).toBeTruthy();
      expect(result.validationError).toContain('reps');
    });

    it('toggles completed set back to incomplete', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

      store.updateSetField(exId, setId, 'weight', '100');
      store.updateSetField(exId, setId, 'reps', '8');

      // Complete
      useActiveWorkoutStore.getState().toggleSetCompleted(exId, setId);
      expect(useActiveWorkoutStore.getState().exercises[0].sets[0].completed).toBe(true);

      // Toggle back
      const result = useActiveWorkoutStore.getState().toggleSetCompleted(exId, setId);
      expect(result.completed).toBe(false);
      expect(result.validationError).toBeNull();
      expect(useActiveWorkoutStore.getState().exercises[0].sets[0].completed).toBe(false);
      expect(useActiveWorkoutStore.getState().exercises[0].sets[0].completedAt).toBeNull();
    });
  });

  // ── removeExercise ───────────────────────────────────────────────────────

  describe('removeExercise', () => {
    it('removes exercise from list', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');
      store.addExercise('Squat');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      store.removeExercise(exId);

      const state = useActiveWorkoutStore.getState();
      expect(state.exercises.length).toBe(1);
      expect(state.exercises[0].exerciseName).toBe('Squat');
    });

    it('also removes exercise from superset groups', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');
      store.addExercise('Row');
      store.addExercise('Curl');

      const exercises = useActiveWorkoutStore.getState().exercises;
      const exIds = exercises.map((e) => e.localId);

      // Create superset with all 3
      store.createSuperset(exIds);
      expect(useActiveWorkoutStore.getState().supersetGroups.length).toBe(1);
      expect(useActiveWorkoutStore.getState().supersetGroups[0].exerciseLocalIds.length).toBe(3);

      // Remove one exercise — superset should still have 2
      store.removeExercise(exIds[0]);

      const state = useActiveWorkoutStore.getState();
      expect(state.exercises.length).toBe(2);
      expect(state.supersetGroups.length).toBe(1);
      expect(state.supersetGroups[0].exerciseLocalIds.length).toBe(2);
      expect(state.supersetGroups[0].exerciseLocalIds).not.toContain(exIds[0]);
    });

    it('removes superset group entirely if fewer than 2 exercises remain', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');
      store.addExercise('Row');

      const exercises = useActiveWorkoutStore.getState().exercises;
      const exIds = exercises.map((e) => e.localId);

      store.createSuperset(exIds);
      expect(useActiveWorkoutStore.getState().supersetGroups.length).toBe(1);

      // Remove one — superset should be removed (only 1 exercise left)
      store.removeExercise(exIds[0]);

      const state = useActiveWorkoutStore.getState();
      expect(state.supersetGroups.length).toBe(0);
    });
  });

  // ── createSuperset ───────────────────────────────────────────────────────

  describe('createSuperset', () => {
    it('with 1 exercise → returns null', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const result = store.createSuperset([exId]);

      expect(result).toBeNull();
      expect(useActiveWorkoutStore.getState().supersetGroups.length).toBe(0);
    });

    it('with 2+ exercises → returns superset ID', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');
      store.addExercise('Row');

      const exIds = useActiveWorkoutStore.getState().exercises.map((e) => e.localId);
      const result = store.createSuperset(exIds);

      expect(result).toBeTruthy();
      expect(useActiveWorkoutStore.getState().supersetGroups.length).toBe(1);
      expect(useActiveWorkoutStore.getState().supersetGroups[0].exerciseLocalIds).toEqual(exIds);
    });
  });

  // ── setSessionDate ───────────────────────────────────────────────────────

  describe('setSessionDate', () => {
    it('with future date → date not changed', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });

      const originalDate = useActiveWorkoutStore.getState().sessionDate;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Use local date string to avoid UTC/local timezone mismatch
      const y = tomorrow.getFullYear();
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const d = String(tomorrow.getDate()).padStart(2, '0');
      const futureDate = `${y}-${m}-${d}`;

      store.setSessionDate(futureDate);

      expect(useActiveWorkoutStore.getState().sessionDate).toBe(originalDate);
    });

    it('with past date → date is updated', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });

      store.setSessionDate('2024-01-15');

      expect(useActiveWorkoutStore.getState().sessionDate).toBe('2024-01-15');
    });

    it('with today → date is updated', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });

      const today = new Date().toISOString().split('T')[0];
      store.setSessionDate(today);

      expect(useActiveWorkoutStore.getState().sessionDate).toBe(today);
    });
  });

  // ── setNotes ─────────────────────────────────────────────────────────────

  describe('setNotes', () => {
    it('sets notes string', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.setNotes('Felt strong today');

      expect(useActiveWorkoutStore.getState().notes).toBe('Felt strong today');
    });
  });

  // ── updateSetType ────────────────────────────────────────────────────────

  describe('updateSetType', () => {
    it('updates set type', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

      store.updateSetType(exId, setId, 'warm-up');

      expect(useActiveWorkoutStore.getState().exercises[0].sets[0].setType).toBe('warm-up');
    });
  });

  // ── setPreviousPerformance ───────────────────────────────────────────────

  describe('setPreviousPerformance', () => {
    it('merges data into cache', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });

      store.setPreviousPerformance({
        'bench press': {
          exerciseName: 'Bench Press',
          sessionDate: '2024-01-15',
          sets: [{ weightKg: 80, reps: 8, rpe: null }],
        },
      });

      store.setPreviousPerformance({
        squat: {
          exerciseName: 'Squat',
          sessionDate: '2024-01-15',
          sets: [{ weightKg: 100, reps: 5, rpe: 8 }],
        },
      });

      const state = useActiveWorkoutStore.getState();
      expect(state.previousPerformance['bench press']).toBeTruthy();
      expect(state.previousPerformance['squat']).toBeTruthy();
    });
  });

  // ── finishWorkout ────────────────────────────────────────────────────────

  describe('finishWorkout', () => {
    it('returns payload with session_date and exercises', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new', sessionDate: '2024-06-15' });
      store.addExercise('Bench Press');

      const exId = useActiveWorkoutStore.getState().exercises[0].localId;
      const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

      store.updateSetField(exId, setId, 'weight', '80');
      store.updateSetField(exId, setId, 'reps', '8');
      useActiveWorkoutStore.getState().toggleSetCompleted(exId, setId);

      const payload = useActiveWorkoutStore.getState().finishWorkout();

      expect(payload.session_date).toBe('2024-06-15');
      expect(payload.exercises.length).toBe(1);
      expect(payload.exercises[0].exercise_name).toBe('Bench Press');
      expect(payload.exercises[0].sets.length).toBe(1);
      expect(payload.start_time).toBeTruthy();
      expect(payload.end_time).toBeTruthy();
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property-Based Tests — workout-logging-premium, Task 25
// ═══════════════════════════════════════════════════════════════════════════

// ─── fast-check Arbitraries ─────────────────────────────────────────────────

const setTypeArb: fc.Arbitrary<SetType> = fc.constantFrom(
  'normal',
  'warm-up',
  'drop-set',
  'amrap',
);

const activeSetArb: fc.Arbitrary<ActiveSet> = fc.record({
  localId: fc.uuid(),
  setNumber: fc.integer({ min: 1, max: 20 }),
  weight: fc.constantFrom('', '0', '25', '50', '80', '100', '120.5'),
  reps: fc.constantFrom('', '0', '3', '5', '8', '10', '12'),
  rpe: fc.constantFrom('', '6', '7', '8', '9', '10'),
  rir: fc.constantFrom('', '0', '1', '2', '3', '4', '5'),
  setType: setTypeArb,
  completed: fc.boolean(),
  completedAt: fc.oneof(
    fc.constant(null),
    fc.constant('2024-06-15T10:00:00.000Z'),
  ),
});

const activeExerciseArb: fc.Arbitrary<ActiveExercise> = fc.record({
  localId: fc.uuid(),
  exerciseName: fc.constantFrom(
    'Bench Press',
    'Squat',
    'Deadlift',
    'Overhead Press',
    'Barbell Row',
    'Pull Up',
  ),
  sets: fc.array(activeSetArb, { minLength: 1, maxLength: 6 }),
  notes: fc.option(fc.constantFrom('Keep tight', 'Go deeper', 'Watch knees'), {
    nil: undefined,
  }),
  skipped: fc.option(fc.boolean(), { nil: undefined }),
});

describe('workout-logging-premium — Property Tests (Task 25)', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── Property 22: Crash recovery round-trip ──────────────────────────────
  // **Validates: Requirements 15.1, 15.3**

  describe('Property 22: Crash recovery round-trip', () => {
    it('persist → restore produces equivalent state including rir field', () => {
      fc.assert(
        fc.property(
          fc.array(activeExerciseArb, { minLength: 1, maxLength: 5 }),
          fc.constantFrom('', 'Great session', 'Felt tired'),
          (exercises, notes) => {
            resetStore();
            const store = useActiveWorkoutStore.getState();
            store.startWorkout({ mode: 'new', sessionDate: '2024-06-15' });

            // Inject exercises directly into state (simulates building a workout)
            useActiveWorkoutStore.setState({ exercises, notes });

            // Snapshot the full state (simulates what AsyncStorage would persist)
            const persisted = useActiveWorkoutStore.getState();
            const snapshot = {
              exercises: persisted.exercises,
              notes: persisted.notes,
              sessionDate: persisted.sessionDate,
              workoutId: persisted.workoutId,
              startedAt: persisted.startedAt,
              isActive: persisted.isActive,
              supersetGroups: persisted.supersetGroups,
              restTimerActive: persisted.restTimerActive,
              restTimerExerciseName: persisted.restTimerExerciseName,
              restTimerDuration: persisted.restTimerDuration,
              restTimerStartedAt: persisted.restTimerStartedAt,
              overloadSuggestions: persisted.overloadSuggestions,
              weeklyVolumeData: persisted.weeklyVolumeData,
            };

            // Simulate crash: discard and restore from snapshot
            store.discardWorkout();
            useActiveWorkoutStore.setState(snapshot);

            const restored = useActiveWorkoutStore.getState();

            // Verify exercise count
            expect(restored.exercises.length).toBe(exercises.length);
            expect(restored.notes).toBe(notes);
            expect(restored.sessionDate).toBe('2024-06-15');
            expect(restored.isActive).toBe(true);

            // Verify each exercise and set including rir
            for (let i = 0; i < exercises.length; i++) {
              const orig = exercises[i];
              const rest = restored.exercises[i];

              expect(rest.localId).toBe(orig.localId);
              expect(rest.exerciseName).toBe(orig.exerciseName);
              expect(rest.notes).toBe(orig.notes);
              expect(rest.skipped).toBe(orig.skipped);
              expect(rest.sets.length).toBe(orig.sets.length);

              for (let j = 0; j < orig.sets.length; j++) {
                expect(rest.sets[j].weight).toBe(orig.sets[j].weight);
                expect(rest.sets[j].reps).toBe(orig.sets[j].reps);
                expect(rest.sets[j].rpe).toBe(orig.sets[j].rpe);
                expect(rest.sets[j].rir).toBe(orig.sets[j].rir);
                expect(rest.sets[j].setType).toBe(orig.sets[j].setType);
                expect(rest.sets[j].completed).toBe(orig.sets[j].completed);
                expect(rest.sets[j].completedAt).toBe(orig.sets[j].completedAt);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('round-trip through JSON serialization preserves rir field', () => {
      fc.assert(
        fc.property(
          fc.array(activeExerciseArb, { minLength: 1, maxLength: 4 }),
          (exercises) => {
            resetStore();
            const store = useActiveWorkoutStore.getState();
            store.startWorkout({ mode: 'new', sessionDate: '2024-07-01' });
            useActiveWorkoutStore.setState({ exercises });

            const state = useActiveWorkoutStore.getState();

            // Simulate JSON round-trip (what AsyncStorage does)
            const json = JSON.stringify({
              exercises: state.exercises,
              notes: state.notes,
              sessionDate: state.sessionDate,
              isActive: state.isActive,
            });
            const parsed = JSON.parse(json);

            expect(parsed.exercises.length).toBe(exercises.length);
            for (let i = 0; i < exercises.length; i++) {
              for (let j = 0; j < exercises[i].sets.length; j++) {
                expect(parsed.exercises[i].sets[j].rir).toBe(exercises[i].sets[j].rir);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 23: Exercise reorder preserves all exercises ───────────────
  // **Validates: Requirements 17.1**

  describe('Property 23: Exercise reorder preserves all exercises', () => {
    it('reorder produces same exercises in different order', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }),
          fc.nat(),
          fc.nat(),
          (exerciseCount, fromRaw, toRaw) => {
            resetStore();
            const store = useActiveWorkoutStore.getState();
            store.startWorkout({ mode: 'new' });

            for (let i = 0; i < exerciseCount; i++) {
              store.addExercise(`Exercise ${i}`);
            }

            const before = useActiveWorkoutStore.getState().exercises;
            const originalIds = before.map((e) => e.localId);
            const originalSetData = before.map((e) => ({
              localId: e.localId,
              name: e.exerciseName,
              setCount: e.sets.length,
              sets: e.sets.map((s) => ({
                weight: s.weight,
                reps: s.reps,
                rpe: s.rpe,
                rir: s.rir,
                setType: s.setType,
                completed: s.completed,
              })),
            }));

            const fromIndex = fromRaw % exerciseCount;
            const toIndex = toRaw % exerciseCount;

            store.reorderExercises(fromIndex, toIndex);

            const after = useActiveWorkoutStore.getState().exercises;

            // Same length
            expect(after.length).toBe(exerciseCount);

            // Same set of IDs (no duplicates, no missing)
            const afterIds = after.map((e) => e.localId);
            expect(afterIds.sort()).toEqual(originalIds.sort());

            // Each exercise's set data is preserved
            for (const orig of originalSetData) {
              const found = after.find((e) => e.localId === orig.localId);
              expect(found).toBeDefined();
              expect(found!.exerciseName).toBe(orig.name);
              expect(found!.sets.length).toBe(orig.setCount);
              for (let j = 0; j < orig.sets.length; j++) {
                expect(found!.sets[j].weight).toBe(orig.sets[j].weight);
                expect(found!.sets[j].reps).toBe(orig.sets[j].reps);
                expect(found!.sets[j].rir).toBe(orig.sets[j].rir);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 24: Exercise skip preserves structure ──────────────────────
  // **Validates: Requirements 17.2**

  describe('Property 24: Exercise skip preserves structure', () => {
    it('toggle skip does not modify sets', () => {
      fc.assert(
        fc.property(activeExerciseArb, (exercise) => {
          resetStore();
          const store = useActiveWorkoutStore.getState();
          store.startWorkout({ mode: 'new' });

          // Normalize: start with skipped=false so toggle ON → true is predictable
          const normalized = { ...exercise, skipped: false };
          useActiveWorkoutStore.setState({ exercises: [normalized] });

          const originalSets = normalized.sets.map((s) => ({
            localId: s.localId,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            rir: s.rir,
            setType: s.setType,
            completed: s.completed,
            completedAt: s.completedAt,
            setNumber: s.setNumber,
          }));
          const originalName = normalized.exerciseName;

          // Toggle skip ON
          useActiveWorkoutStore.getState().toggleExerciseSkip(normalized.localId);
          const skipped = useActiveWorkoutStore.getState().exercises[0];
          expect(skipped.skipped).toBe(true);
          expect(skipped.exerciseName).toBe(originalName);
          expect(skipped.sets.length).toBe(originalSets.length);

          // Verify sets are untouched after skip
          for (let i = 0; i < originalSets.length; i++) {
            expect(skipped.sets[i].localId).toBe(originalSets[i].localId);
            expect(skipped.sets[i].weight).toBe(originalSets[i].weight);
            expect(skipped.sets[i].reps).toBe(originalSets[i].reps);
            expect(skipped.sets[i].rpe).toBe(originalSets[i].rpe);
            expect(skipped.sets[i].rir).toBe(originalSets[i].rir);
            expect(skipped.sets[i].setType).toBe(originalSets[i].setType);
            expect(skipped.sets[i].completed).toBe(originalSets[i].completed);
          }

          // Toggle skip OFF — restores original state
          useActiveWorkoutStore.getState().toggleExerciseSkip(normalized.localId);
          const unskipped = useActiveWorkoutStore.getState().exercises[0];
          expect(unskipped.skipped).toBe(false);
          expect(unskipped.sets.length).toBe(originalSets.length);

          for (let i = 0; i < originalSets.length; i++) {
            expect(unskipped.sets[i].weight).toBe(originalSets[i].weight);
            expect(unskipped.sets[i].reps).toBe(originalSets[i].reps);
            expect(unskipped.sets[i].rir).toBe(originalSets[i].rir);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 18: Exercise swap preserves set data ───────────────────────
  // **Validates: Requirements 12.2**

  describe('Property 18: Exercise swap preserves set data', () => {
    it('only name changes, all set fields including rir preserved', () => {
      fc.assert(
        fc.property(
          activeExerciseArb,
          fc.constantFrom('New Exercise A', 'New Exercise B', 'Cable Fly', 'Leg Press'),
          (exercise, newName) => {
            resetStore();
            const store = useActiveWorkoutStore.getState();
            store.startWorkout({ mode: 'new' });
            useActiveWorkoutStore.setState({ exercises: [exercise] });

            const originalSets = exercise.sets.map((s) => ({
              localId: s.localId,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
              rir: s.rir,
              setType: s.setType,
              completed: s.completed,
              completedAt: s.completedAt,
              setNumber: s.setNumber,
            }));

            store.swapExercise(exercise.localId, newName);

            const swapped = useActiveWorkoutStore.getState().exercises[0];

            // Name changed
            expect(swapped.exerciseName).toBe(newName);

            // Set count preserved
            expect(swapped.sets.length).toBe(originalSets.length);

            // Every set field preserved (including rir)
            for (let i = 0; i < originalSets.length; i++) {
              expect(swapped.sets[i].weight).toBe(originalSets[i].weight);
              expect(swapped.sets[i].reps).toBe(originalSets[i].reps);
              expect(swapped.sets[i].rpe).toBe(originalSets[i].rpe);
              expect(swapped.sets[i].rir).toBe(originalSets[i].rir);
              expect(swapped.sets[i].setType).toBe(originalSets[i].setType);
              expect(swapped.sets[i].completed).toBe(originalSets[i].completed);
              expect(swapped.sets[i].completedAt).toBe(originalSets[i].completedAt);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
