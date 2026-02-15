/**
 * Unit tests for activeWorkout Zustand slice
 *
 * Feature: training-log-redesign, Task 10.2
 * **Validates: Requirements 1.9, 2.2, 2.3, 6.1**
 */

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
      const futureDate = tomorrow.toISOString().split('T')[0];

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
