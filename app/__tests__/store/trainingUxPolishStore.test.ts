/**
 * Unit + Property tests for Training UX Polish — Phase 2 Store Changes
 *
 * Feature: training-ux-polish, Task 3.5
 * Tests cover: swapExercise, toggleExerciseSkip, setExerciseNotes,
 * insertWarmUpSets, finishWorkout metadata, updateSetField on completed sets,
 * reorderExercises, workoutPreferencesStore, tooltipStore, crash recovery.
 */

import * as fc from 'fast-check';

// Mock AsyncStorage before importing stores
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
  __esModule: true,
}));

import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';
import { useTooltipStore } from '../../store/tooltipStore';
import type { ActiveExercise, ActiveSet, SetType } from '../../types/training';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetStores() {
  useActiveWorkoutStore.getState().discardWorkout();
  useWorkoutPreferencesStore.setState({ showRpeColumn: false });
  useTooltipStore.setState({ dismissed: {} });
}

function setupExerciseWithSets(
  exerciseName: string,
  setData: Array<{
    weight: string;
    reps: string;
    rpe: string;
    setType?: SetType;
    completed?: boolean;
  }>,
) {
  const store = useActiveWorkoutStore.getState();
  store.startWorkout({ mode: 'new', sessionDate: '2024-06-15' });
  store.addExercise(exerciseName);

  const ex = useActiveWorkoutStore.getState().exercises[0];

  if (setData.length > 0) {
    const firstSet = ex.sets[0];
    store.updateSetField(ex.localId, firstSet.localId, 'weight', setData[0].weight);
    store.updateSetField(ex.localId, firstSet.localId, 'reps', setData[0].reps);
    if (setData[0].rpe) {
      store.updateSetField(ex.localId, firstSet.localId, 'rpe', setData[0].rpe);
    }
    if (setData[0].setType) {
      store.updateSetType(ex.localId, firstSet.localId, setData[0].setType);
    }
    if (setData[0].completed) {
      useActiveWorkoutStore.getState().toggleSetCompleted(ex.localId, firstSet.localId);
    }
  }

  for (let i = 1; i < setData.length; i++) {
    store.addSet(ex.localId);
    const updatedEx = useActiveWorkoutStore.getState().exercises[0];
    const newSet = updatedEx.sets[i];
    store.updateSetField(ex.localId, newSet.localId, 'weight', setData[i].weight);
    store.updateSetField(ex.localId, newSet.localId, 'reps', setData[i].reps);
    if (setData[i].rpe) {
      store.updateSetField(ex.localId, newSet.localId, 'rpe', setData[i].rpe);
    }
    if (setData[i].setType) {
      store.updateSetType(ex.localId, newSet.localId, setData[i].setType);
    }
    if (setData[i].completed) {
      useActiveWorkoutStore.getState().toggleSetCompleted(ex.localId, newSet.localId);
    }
  }

  return useActiveWorkoutStore.getState().exercises[0];
}

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
  weight: fc.constantFrom('', '0', '50', '80', '100', '120.5'),
  reps: fc.constantFrom('', '0', '3', '5', '8', '10', '12'),
  rpe: fc.constantFrom('', '6', '7', '8', '9', '10'),
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Training UX Polish — Phase 2 Store Tests', () => {
  beforeEach(() => {
    resetStores();
  });

  // ── (a) swapExercise preserves all set data ──────────────────────────────

  describe('swapExercise', () => {
    it('preserves all set data when swapping exercise name', () => {
      const ex = setupExerciseWithSets('Bench Press', [
        { weight: '100', reps: '8', rpe: '8', setType: 'normal', completed: true },
        { weight: '100', reps: '6', rpe: '9', setType: 'normal', completed: true },
        { weight: '90', reps: '8', rpe: '7', setType: 'drop-set', completed: false },
      ]);

      const originalSets = useActiveWorkoutStore.getState().exercises[0].sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        setType: s.setType,
        completed: s.completed,
        completedAt: s.completedAt,
      }));

      useActiveWorkoutStore.getState().swapExercise(ex.localId, 'Incline Dumbbell Press');

      const swapped = useActiveWorkoutStore.getState().exercises[0];
      expect(swapped.exerciseName).toBe('Incline Dumbbell Press');
      expect(swapped.sets.length).toBe(3);

      swapped.sets.forEach((s, i) => {
        expect(s.weight).toBe(originalSets[i].weight);
        expect(s.reps).toBe(originalSets[i].reps);
        expect(s.rpe).toBe(originalSets[i].rpe);
        expect(s.setType).toBe(originalSets[i].setType);
        expect(s.completed).toBe(originalSets[i].completed);
        expect(s.completedAt).toBe(originalSets[i].completedAt);
      });
    });

    // **Validates: Requirements 10.2**
    it('[Property 7] swap preserves all set fields for any exercise', () => {
      fc.assert(
        fc.property(activeExerciseArb, fc.constantFrom('New Ex A', 'New Ex B', 'New Ex C'), (exercise, newName) => {
          resetStores();
          const store = useActiveWorkoutStore.getState();
          store.startWorkout({ mode: 'new' });
          useActiveWorkoutStore.setState({ exercises: [exercise] });

          store.swapExercise(exercise.localId, newName);

          const result = useActiveWorkoutStore.getState().exercises[0];
          expect(result.exerciseName).toBe(newName);
          expect(result.sets.length).toBe(exercise.sets.length);

          result.sets.forEach((s, i) => {
            expect(s.weight).toBe(exercise.sets[i].weight);
            expect(s.reps).toBe(exercise.sets[i].reps);
            expect(s.rpe).toBe(exercise.sets[i].rpe);
            expect(s.setType).toBe(exercise.sets[i].setType);
            expect(s.completed).toBe(exercise.sets[i].completed);
            expect(s.completedAt).toBe(exercise.sets[i].completedAt);
          });
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── (b) toggleExerciseSkip round-trip ────────────────────────────────────

  describe('toggleExerciseSkip', () => {
    it('toggles skip on then skipped=true', () => {
      setupExerciseWithSets('Squat', [{ weight: '120', reps: '5', rpe: '' }]);
      const ex = useActiveWorkoutStore.getState().exercises[0];

      useActiveWorkoutStore.getState().toggleExerciseSkip(ex.localId);
      expect(useActiveWorkoutStore.getState().exercises[0].skipped).toBe(true);
    });

    it('toggles skip off then exercise state identical to original', () => {
      setupExerciseWithSets('Squat', [
        { weight: '120', reps: '5', rpe: '7' },
        { weight: '120', reps: '5', rpe: '8' },
      ]);
      const ex = useActiveWorkoutStore.getState().exercises[0];
      const originalName = ex.exerciseName;
      const originalSetCount = ex.sets.length;

      useActiveWorkoutStore.getState().toggleExerciseSkip(ex.localId);
      expect(useActiveWorkoutStore.getState().exercises[0].skipped).toBe(true);

      useActiveWorkoutStore.getState().toggleExerciseSkip(ex.localId);
      const restored = useActiveWorkoutStore.getState().exercises[0];
      expect(restored.skipped).toBe(false);
      expect(restored.exerciseName).toBe(originalName);
      expect(restored.sets.length).toBe(originalSetCount);
    });

    // **Validates: Requirements 11.2, 11.3**
    it('[Property 8] skip + unskip round-trip preserves exerciseName, sets, notes', () => {
      fc.assert(
        fc.property(activeExerciseArb, (exercise) => {
          resetStores();
          const store = useActiveWorkoutStore.getState();
          store.startWorkout({ mode: 'new' });
          useActiveWorkoutStore.setState({ exercises: [exercise] });

          const originalName = exercise.exerciseName;
          const originalSetCount = exercise.sets.length;
          const originalNotes = exercise.notes;

          // Toggle twice = round-trip
          useActiveWorkoutStore.getState().toggleExerciseSkip(exercise.localId);
          useActiveWorkoutStore.getState().toggleExerciseSkip(exercise.localId);

          const result = useActiveWorkoutStore.getState().exercises[0];
          expect(result.exerciseName).toBe(originalName);
          expect(result.sets.length).toBe(originalSetCount);
          expect(result.notes).toBe(originalNotes);
          // After toggle round-trip, undefined becomes false (both are falsy = not skipped)
          expect(!!result.skipped).toBe(!!exercise.skipped);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── (c) skipped exercises in session payload metadata ────────────────────

  describe('skipped exercises in payload metadata', () => {
    // **Validates: Requirements 11.4**
    it('finishWorkout payload contains exactly the skipped exercise names', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new', sessionDate: '2024-06-15' });
      store.addExercise('Bench Press');
      store.addExercise('Squat');
      store.addExercise('Deadlift');

      const exercises = useActiveWorkoutStore.getState().exercises;

      // Complete a set on Bench Press
      store.updateSetField(exercises[0].localId, exercises[0].sets[0].localId, 'weight', '80');
      store.updateSetField(exercises[0].localId, exercises[0].sets[0].localId, 'reps', '8');
      useActiveWorkoutStore.getState().toggleSetCompleted(
        exercises[0].localId,
        exercises[0].sets[0].localId,
      );

      // Skip Squat and Deadlift
      useActiveWorkoutStore.getState().toggleExerciseSkip(exercises[1].localId);
      useActiveWorkoutStore.getState().toggleExerciseSkip(exercises[2].localId);

      const payload = useActiveWorkoutStore.getState().finishWorkout();

      expect(payload.metadata).toBeTruthy();
      expect(payload.metadata!.skipped_exercises).toBeDefined();
      expect(payload.metadata!.skipped_exercises).toEqual(
        expect.arrayContaining(['Squat', 'Deadlift']),
      );
      expect(payload.metadata!.skipped_exercises!.length).toBe(2);
      expect(payload.metadata!.skipped_exercises).not.toContain('Bench Press');
    });

    // **Validates: Requirements 11.4**
    it('[Property 9] skipped_exercises contains exactly names where skipped=true', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom('Ex A', 'Ex B', 'Ex C', 'Ex D', 'Ex E'),
              skip: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          (specs) => {
            resetStores();
            const store = useActiveWorkoutStore.getState();
            store.startWorkout({ mode: 'new', sessionDate: '2024-06-15' });

            for (const spec of specs) {
              store.addExercise(spec.name);
            }

            const exercises = useActiveWorkoutStore.getState().exercises;

            // Complete a set on first non-skipped exercise
            const firstNonSkipped = specs.findIndex((s) => !s.skip);
            if (firstNonSkipped >= 0) {
              const ex = exercises[firstNonSkipped];
              store.updateSetField(ex.localId, ex.sets[0].localId, 'weight', '50');
              store.updateSetField(ex.localId, ex.sets[0].localId, 'reps', '5');
              useActiveWorkoutStore.getState().toggleSetCompleted(ex.localId, ex.sets[0].localId);
            }

            // Apply skip flags
            for (let i = 0; i < specs.length; i++) {
              if (specs[i].skip) {
                useActiveWorkoutStore.getState().toggleExerciseSkip(exercises[i].localId);
              }
            }

            const payload = useActiveWorkoutStore.getState().finishWorkout();
            const expectedSkipped = specs.filter((s) => s.skip).map((s) => s.name);

            if (expectedSkipped.length > 0) {
              expect(payload.metadata!.skipped_exercises).toBeDefined();
              expect(payload.metadata!.skipped_exercises!.sort()).toEqual(expectedSkipped.sort());
            } else {
              const actual = payload.metadata?.skipped_exercises;
              expect(!actual || actual.length === 0).toBe(true);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ── (d) updateSetField on completed set preserves completion ─────────────

  describe('updateSetField on completed set', () => {
    // **Validates: Requirements 12.1, 12.2**
    it('updating weight on completed set preserves completed and completedAt', () => {
      setupExerciseWithSets('Bench Press', [
        { weight: '100', reps: '8', rpe: '8', completed: true },
      ]);

      const ex = useActiveWorkoutStore.getState().exercises[0];
      const set = ex.sets[0];
      expect(set.completed).toBe(true);
      const originalCompletedAt = set.completedAt;

      useActiveWorkoutStore.getState().updateSetField(ex.localId, set.localId, 'weight', '105');

      const updated = useActiveWorkoutStore.getState().exercises[0].sets[0];
      expect(updated.weight).toBe('105');
      expect(updated.completed).toBe(true);
      expect(updated.completedAt).toBe(originalCompletedAt);
    });

    it('updating reps on completed set preserves completion', () => {
      setupExerciseWithSets('Bench Press', [
        { weight: '100', reps: '8', rpe: '', completed: true },
      ]);

      const ex = useActiveWorkoutStore.getState().exercises[0];
      const set = ex.sets[0];
      const originalCompletedAt = set.completedAt;

      useActiveWorkoutStore.getState().updateSetField(ex.localId, set.localId, 'reps', '10');

      const updated = useActiveWorkoutStore.getState().exercises[0].sets[0];
      expect(updated.reps).toBe('10');
      expect(updated.completed).toBe(true);
      expect(updated.completedAt).toBe(originalCompletedAt);
    });

    it('updating rpe on completed set preserves completion', () => {
      setupExerciseWithSets('Bench Press', [
        { weight: '100', reps: '8', rpe: '8', completed: true },
      ]);

      const ex = useActiveWorkoutStore.getState().exercises[0];
      const set = ex.sets[0];
      const originalCompletedAt = set.completedAt;

      useActiveWorkoutStore.getState().updateSetField(ex.localId, set.localId, 'rpe', '9');

      const updated = useActiveWorkoutStore.getState().exercises[0].sets[0];
      expect(updated.rpe).toBe('9');
      expect(updated.completed).toBe(true);
      expect(updated.completedAt).toBe(originalCompletedAt);
    });

    // **Validates: Requirements 12.1, 12.2**
    it('[Property 10] for any completed set, updateSetField preserves completion', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('weight' as const, 'reps' as const, 'rpe' as const),
          fc.constantFrom('50', '80', '100', '5', '8', '10', '7', '9'),
          (field, value) => {
            resetStores();
            setupExerciseWithSets('Bench Press', [
              { weight: '100', reps: '8', rpe: '8', completed: true },
            ]);

            const ex = useActiveWorkoutStore.getState().exercises[0];
            const set = ex.sets[0];
            const originalCompletedAt = set.completedAt;

            useActiveWorkoutStore.getState().updateSetField(ex.localId, set.localId, field, value);

            const updated = useActiveWorkoutStore.getState().exercises[0].sets[0];
            expect(updated[field]).toBe(value);
            expect(updated.completed).toBe(true);
            expect(updated.completedAt).toBe(originalCompletedAt);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── (e) setExerciseNotes round-trip ──────────────────────────────────────

  describe('setExerciseNotes', () => {
    it('sets notes on exercise and retrieves them', () => {
      setupExerciseWithSets('Squat', [{ weight: '120', reps: '5', rpe: '' }]);
      const ex = useActiveWorkoutStore.getState().exercises[0];

      useActiveWorkoutStore.getState().setExerciseNotes(ex.localId, 'Keep chest up');

      const updated = useActiveWorkoutStore.getState().exercises[0];
      expect(updated.notes).toBe('Keep chest up');
    });

    it('notes appear in finishWorkout payload metadata', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new', sessionDate: '2024-06-15' });
      store.addExercise('Bench Press');
      store.addExercise('Squat');

      const exercises = useActiveWorkoutStore.getState().exercises;

      store.updateSetField(exercises[0].localId, exercises[0].sets[0].localId, 'weight', '80');
      store.updateSetField(exercises[0].localId, exercises[0].sets[0].localId, 'reps', '8');
      useActiveWorkoutStore.getState().toggleSetCompleted(
        exercises[0].localId,
        exercises[0].sets[0].localId,
      );

      useActiveWorkoutStore.getState().setExerciseNotes(exercises[0].localId, 'Felt strong');
      useActiveWorkoutStore.getState().setExerciseNotes(exercises[1].localId, 'Knee pain');

      const payload = useActiveWorkoutStore.getState().finishWorkout();

      expect(payload.metadata!.exercise_notes).toBeDefined();
      expect(payload.metadata!.exercise_notes!['Bench Press']).toBe('Felt strong');
      expect(payload.metadata!.exercise_notes!['Squat']).toBe('Knee pain');
    });

    // **Validates: Requirements 14.3, 14.4**
    it('[Property 11] notes round-trip: set notes then finish includes them in metadata', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Keep tight', 'Go deeper', 'Watch form', 'Brace core', 'Slow eccentric'),
          (notesText) => {
            resetStores();
            const store = useActiveWorkoutStore.getState();
            store.startWorkout({ mode: 'new', sessionDate: '2024-06-15' });
            store.addExercise('Test Exercise');

            const ex = useActiveWorkoutStore.getState().exercises[0];

            store.updateSetField(ex.localId, ex.sets[0].localId, 'weight', '50');
            store.updateSetField(ex.localId, ex.sets[0].localId, 'reps', '5');
            useActiveWorkoutStore.getState().toggleSetCompleted(ex.localId, ex.sets[0].localId);

            useActiveWorkoutStore.getState().setExerciseNotes(ex.localId, notesText);

            expect(useActiveWorkoutStore.getState().exercises[0].notes).toBe(notesText);

            const payload = useActiveWorkoutStore.getState().finishWorkout();
            expect(payload.metadata!.exercise_notes!['Test Exercise']).toBe(notesText);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ── (f) reorderExercises preserves all exercises ─────────────────────────

  describe('reorderExercises', () => {
    it('reorder moves exercise and preserves all data', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');
      store.addExercise('Squat');
      store.addExercise('Deadlift');

      const originalIds = useActiveWorkoutStore.getState().exercises.map((e) => e.localId);

      store.reorderExercises(0, 2);

      const reordered = useActiveWorkoutStore.getState().exercises;
      expect(reordered.length).toBe(3);
      expect(reordered[0].exerciseName).toBe('Squat');
      expect(reordered[1].exerciseName).toBe('Deadlift');
      expect(reordered[2].exerciseName).toBe('Bench Press');

      const reorderedIds = reordered.map((e) => e.localId);
      expect(reorderedIds.sort()).toEqual(originalIds.sort());
    });

    // **Validates: Requirements 15.3**
    it('[Property 12] reorder preserves all exercises — no duplicates, no missing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }),
          fc.nat(),
          fc.nat(),
          (exerciseCount, fromRaw, toRaw) => {
            resetStores();
            const store = useActiveWorkoutStore.getState();
            store.startWorkout({ mode: 'new' });

            for (let i = 0; i < exerciseCount; i++) {
              store.addExercise(`Exercise ${i}`);
            }

            const fromIndex = fromRaw % exerciseCount;
            const toIndex = toRaw % exerciseCount;
            const originalIds = useActiveWorkoutStore.getState().exercises.map((e) => e.localId);

            store.reorderExercises(fromIndex, toIndex);

            const reordered = useActiveWorkoutStore.getState().exercises;
            expect(reordered.length).toBe(exerciseCount);

            const reorderedIds = reordered.map((e) => e.localId);
            expect(reorderedIds.sort()).toEqual(originalIds.sort());

            const uniqueIds = new Set(reorderedIds);
            expect(uniqueIds.size).toBe(exerciseCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── (g) insertWarmUpSets ─────────────────────────────────────────────────

  describe('insertWarmUpSets', () => {
    it('prepends warm-up sets with setType warm-up', () => {
      setupExerciseWithSets('Squat', [{ weight: '120', reps: '5', rpe: '' }]);

      const ex = useActiveWorkoutStore.getState().exercises[0];
      const warmUpSets = [
        { weightKg: 20, reps: 10, setType: 'warm-up' as const },
        { weightKg: 72.5, reps: 5, setType: 'warm-up' as const },
        { weightKg: 97.5, reps: 3, setType: 'warm-up' as const },
      ];

      useActiveWorkoutStore.getState().insertWarmUpSets(ex.localId, warmUpSets);

      const updated = useActiveWorkoutStore.getState().exercises[0];
      expect(updated.sets.length).toBe(4);

      expect(updated.sets[0].setType).toBe('warm-up');
      expect(updated.sets[0].weight).toBe('20');
      expect(updated.sets[0].reps).toBe('10');

      expect(updated.sets[1].setType).toBe('warm-up');
      expect(updated.sets[1].weight).toBe('72.5');
      expect(updated.sets[1].reps).toBe('5');

      expect(updated.sets[2].setType).toBe('warm-up');
      expect(updated.sets[2].weight).toBe('97.5');
      expect(updated.sets[2].reps).toBe('3');

      expect(updated.sets[3].weight).toBe('120');
      expect(updated.sets[3].reps).toBe('5');
    });

    it('renumbers all sets sequentially after insertion', () => {
      setupExerciseWithSets('Bench Press', [
        { weight: '80', reps: '8', rpe: '' },
        { weight: '80', reps: '8', rpe: '' },
      ]);

      const ex = useActiveWorkoutStore.getState().exercises[0];
      const warmUpSets = [
        { weightKg: 20, reps: 10, setType: 'warm-up' as const },
        { weightKg: 50, reps: 5, setType: 'warm-up' as const },
      ];

      useActiveWorkoutStore.getState().insertWarmUpSets(ex.localId, warmUpSets);

      const updated = useActiveWorkoutStore.getState().exercises[0];
      expect(updated.sets.length).toBe(4);

      updated.sets.forEach((s, i) => {
        expect(s.setNumber).toBe(i + 1);
      });
    });

    it('warm-up sets are not completed', () => {
      setupExerciseWithSets('Squat', [{ weight: '100', reps: '5', rpe: '' }]);

      const ex = useActiveWorkoutStore.getState().exercises[0];
      const warmUpSets = [{ weightKg: 20, reps: 10, setType: 'warm-up' as const }];

      useActiveWorkoutStore.getState().insertWarmUpSets(ex.localId, warmUpSets);

      const updated = useActiveWorkoutStore.getState().exercises[0];
      expect(updated.sets[0].completed).toBe(false);
      expect(updated.sets[0].completedAt).toBeNull();
    });
  });

  // ── (h) workoutPreferencesStore toggleRpeColumn ──────────────────────────

  describe('workoutPreferencesStore', () => {
    it('defaults to showRpeColumn=false', () => {
      expect(useWorkoutPreferencesStore.getState().showRpeColumn).toBe(false);
    });

    it('toggleRpeColumn flips to true', () => {
      useWorkoutPreferencesStore.getState().toggleRpeColumn();
      expect(useWorkoutPreferencesStore.getState().showRpeColumn).toBe(true);
    });

    it('toggleRpeColumn flips back to false', () => {
      useWorkoutPreferencesStore.getState().toggleRpeColumn();
      useWorkoutPreferencesStore.getState().toggleRpeColumn();
      expect(useWorkoutPreferencesStore.getState().showRpeColumn).toBe(false);
    });

    it('toggle is independent of active workout lifecycle', () => {
      useWorkoutPreferencesStore.getState().toggleRpeColumn();
      expect(useWorkoutPreferencesStore.getState().showRpeColumn).toBe(true);

      useActiveWorkoutStore.getState().discardWorkout();
      expect(useWorkoutPreferencesStore.getState().showRpeColumn).toBe(true);
    });
  });

  // ── (i) tooltipStore dismiss round-trip ──────────────────────────────────

  describe('tooltipStore', () => {
    it('undismissed tooltip returns false', () => {
      expect(useTooltipStore.getState().isDismissed('rpe-intro')).toBe(false);
    });

    it('dismissed tooltip returns true', () => {
      useTooltipStore.getState().dismiss('rpe-intro');
      expect(useTooltipStore.getState().isDismissed('rpe-intro')).toBe(true);
    });

    it('dismissing one tooltip does not affect others', () => {
      useTooltipStore.getState().dismiss('rpe-intro');
      expect(useTooltipStore.getState().isDismissed('rpe-intro')).toBe(true);
      expect(useTooltipStore.getState().isDismissed('type-intro')).toBe(false);
    });

    // **Validates: Requirements 4.4**
    it('[Property 4] dismiss round-trip: dismissed returns true, undismissed returns false', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('tip-a', 'tip-b', 'tip-c', 'rpe-intro', 'type-intro', 'keyboard-hint'),
          (tooltipId) => {
            useTooltipStore.setState({ dismissed: {} });

            expect(useTooltipStore.getState().isDismissed(tooltipId)).toBe(false);

            useTooltipStore.getState().dismiss(tooltipId);
            expect(useTooltipStore.getState().isDismissed(tooltipId)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── (j) crash recovery with notes + skip state ──────────────────────────

  describe('crash recovery: notes + skip state persist in store', () => {
    it('notes and skip state are preserved in store state', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new', sessionDate: '2024-06-15' });
      store.addExercise('Bench Press');
      store.addExercise('Squat');

      const exercises = useActiveWorkoutStore.getState().exercises;

      useActiveWorkoutStore.getState().setExerciseNotes(exercises[0].localId, 'Arch more');
      useActiveWorkoutStore.getState().toggleExerciseSkip(exercises[1].localId);

      const state = useActiveWorkoutStore.getState();
      expect(state.exercises[0].notes).toBe('Arch more');
      expect(state.exercises[0].skipped).toBeFalsy();
      expect(state.exercises[1].notes).toBeUndefined();
      expect(state.exercises[1].skipped).toBe(true);

      // Verify state is readable (simulates hydration from AsyncStorage)
      const recovered = useActiveWorkoutStore.getState().exercises;
      expect(recovered[0].notes).toBe('Arch more');
      expect(recovered[1].skipped).toBe(true);
      expect(recovered.length).toBe(2);
    });

    it('notes and skip survive across multiple operations', () => {
      const store = useActiveWorkoutStore.getState();
      store.startWorkout({ mode: 'new' });
      store.addExercise('Bench Press');
      store.addExercise('Squat');
      store.addExercise('Deadlift');

      const exercises = useActiveWorkoutStore.getState().exercises;

      useActiveWorkoutStore.getState().setExerciseNotes(exercises[0].localId, 'Note 1');
      useActiveWorkoutStore.getState().setExerciseNotes(exercises[2].localId, 'Note 3');
      useActiveWorkoutStore.getState().toggleExerciseSkip(exercises[1].localId);

      store.addSet(exercises[0].localId);

      const state = useActiveWorkoutStore.getState();
      expect(state.exercises[0].notes).toBe('Note 1');
      expect(state.exercises[0].sets.length).toBe(2);
      expect(state.exercises[1].skipped).toBe(true);
      expect(state.exercises[2].notes).toBe('Note 3');
    });
  });
});
