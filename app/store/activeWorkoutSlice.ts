/**
 * Active Workout Zustand Store
 *
 * Standalone Zustand store (NOT merged into main useStore) for managing
 * in-progress workout state. Persisted to AsyncStorage for crash recovery.
 *
 * This store does NOT import from the main useStore to avoid circular
 * dependencies. The screen component passes unitSystem as a parameter
 * where needed.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ActiveWorkoutState,
  ActiveWorkoutActions,
  ActiveExercise,
  ActiveSet,
  SetType,
  ActiveWorkoutPayload,
  PreviousPerformanceData,
} from '../types/training';

import { canCompleteSet } from '../utils/setCompletionLogic';
import {
  createSupersetGroup,
  removeSupersetGroup,
} from '../utils/supersetLogic';
import { activeExercisesToPayload } from '../utils/sessionEditConversion';
import { isValidSessionDate } from '../utils/dateValidation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeEmptySet(setNumber: number): ActiveSet {
  return {
    localId: generateId(),
    setNumber,
    weight: '',
    reps: '',
    rpe: '',
    setType: 'normal',
    completed: false,
    completedAt: null,
  };
}

const defaultState: ActiveWorkoutState = {
  workoutId: '',
  mode: 'new',
  editSessionId: null,
  sessionDate: '',
  startedAt: '',
  exercises: [],
  supersetGroups: [],
  notes: '',
  sourceTemplateId: null,
  previousPerformance: {},
  previousPerformanceLoading: false,
  isActive: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useActiveWorkoutStore = create<ActiveWorkoutState & ActiveWorkoutActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      // ── Lifecycle ────────────────────────────────────────────────────────

      startWorkout: (params) => {
        const today = new Date().toISOString().split('T')[0];
        set({
          workoutId: generateId(),
          mode: params.mode,
          editSessionId: params.editSessionId ?? null,
          sessionDate: params.sessionDate ?? today,
          startedAt: new Date().toISOString(),
          exercises: params.templateExercises ?? [],
          supersetGroups: [],
          notes: '',
          sourceTemplateId: null,
          previousPerformance: {},
          previousPerformanceLoading: false,
          isActive: true,
        });
      },

      discardWorkout: () => {
        set({ ...defaultState });
      },

      finishWorkout: () => {
        const state = get();
        // Build payload — uses metric conversion (unitSystem passed externally
        // by the screen; here we default to 'metric' since the store doesn't
        // know the user's preference. The screen should call
        // activeExercisesToPayload directly with the correct unitSystem.)
        const exercisePayload = activeExercisesToPayload(state.exercises, 'metric');

        const supersetGroupsPayload = state.supersetGroups.map((sg) => ({
          id: sg.id,
          exercise_names: sg.exerciseLocalIds.map((lid) => {
            const ex = state.exercises.find((e) => e.localId === lid);
            return ex?.exerciseName ?? '';
          }),
        }));

        const payload: ActiveWorkoutPayload = {
          session_date: state.sessionDate,
          exercises: exercisePayload,
          start_time: state.startedAt || null,
          end_time: new Date().toISOString(),
          metadata: {
            ...(state.notes ? { notes: state.notes } : {}),
            ...(supersetGroupsPayload.length > 0
              ? { superset_groups: supersetGroupsPayload }
              : {}),
          },
        };

        return payload;
      },

      // ── Exercise CRUD ────────────────────────────────────────────────────

      addExercise: (name: string) => {
        const newExercise: ActiveExercise = {
          localId: generateId(),
          exerciseName: name,
          sets: [makeEmptySet(1)],
        };
        set((state) => ({
          exercises: [...state.exercises, newExercise],
        }));
      },

      removeExercise: (localId: string) => {
        set((state) => ({
          exercises: state.exercises.filter((e) => e.localId !== localId),
          supersetGroups: state.supersetGroups
            .map((sg) => ({
              ...sg,
              exerciseLocalIds: sg.exerciseLocalIds.filter((id) => id !== localId),
            }))
            .filter((sg) => sg.exerciseLocalIds.length >= 2),
        }));
      },

      reorderExercises: (fromIndex: number, toIndex: number) => {
        set((state) => {
          const exercises = [...state.exercises];
          const [moved] = exercises.splice(fromIndex, 1);
          if (moved) exercises.splice(toIndex, 0, moved);
          return { exercises };
        });
      },

      // ── Set CRUD ─────────────────────────────────────────────────────────

      addSet: (exerciseLocalId: string) => {
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.localId !== exerciseLocalId) return ex;
            const lastSet = ex.sets[ex.sets.length - 1];
            const newSet: ActiveSet = {
              localId: generateId(),
              setNumber: ex.sets.length + 1,
              weight: lastSet?.weight ?? '',
              reps: lastSet?.reps ?? '',
              rpe: '',
              setType: 'normal',
              completed: false,
              completedAt: null,
            };
            return { ...ex, sets: [...ex.sets, newSet] };
          }),
        }));
      },

      removeSet: (exerciseLocalId: string, setLocalId: string) => {
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.localId !== exerciseLocalId) return ex;
            if (ex.sets.length <= 1) return ex; // keep at least 1 set
            const filtered = ex.sets
              .filter((s) => s.localId !== setLocalId)
              .map((s, i) => ({ ...s, setNumber: i + 1 }));
            return { ...ex, sets: filtered };
          }),
        }));
      },

      updateSetField: (
        exerciseLocalId: string,
        setLocalId: string,
        field: 'weight' | 'reps' | 'rpe',
        value: string,
      ) => {
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.localId !== exerciseLocalId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) =>
                s.localId === setLocalId ? { ...s, [field]: value } : s,
              ),
            };
          }),
        }));
      },

      updateSetType: (
        exerciseLocalId: string,
        setLocalId: string,
        setType: SetType,
      ) => {
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.localId !== exerciseLocalId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) =>
                s.localId === setLocalId ? { ...s, setType } : s,
              ),
            };
          }),
        }));
      },

      toggleSetCompleted: (
        exerciseLocalId: string,
        setLocalId: string,
      ): { completed: boolean; validationError: string | null } => {
        const state = get();
        const exercise = state.exercises.find((e) => e.localId === exerciseLocalId);
        const setItem = exercise?.sets.find((s) => s.localId === setLocalId);

        if (!exercise || !setItem) {
          return { completed: false, validationError: 'Set not found' };
        }

        // If already completed, toggle back to incomplete
        if (setItem.completed) {
          set({
            exercises: state.exercises.map((ex) => {
              if (ex.localId !== exerciseLocalId) return ex;
              return {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.localId === setLocalId
                    ? { ...s, completed: false, completedAt: null }
                    : s,
                ),
              };
            }),
          });
          return { completed: false, validationError: null };
        }

        // Validate before completing
        const validation = canCompleteSet(setItem);
        if (!validation.valid) {
          return {
            completed: false,
            validationError: `Missing: ${validation.errors.join(', ')}`,
          };
        }

        // Mark as completed
        set({
          exercises: state.exercises.map((ex) => {
            if (ex.localId !== exerciseLocalId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) =>
                s.localId === setLocalId
                  ? { ...s, completed: true, completedAt: new Date().toISOString() }
                  : s,
              ),
            };
          }),
        });
        return { completed: true, validationError: null };
      },

      // ── Superset CRUD ────────────────────────────────────────────────────

      createSuperset: (exerciseLocalIds: string[]): string | null => {
        const group = createSupersetGroup(exerciseLocalIds);
        if (!group) return null;
        set((state) => ({
          supersetGroups: [...state.supersetGroups, group],
        }));
        return group.id;
      },

      removeSuperset: (supersetId: string) => {
        set((state) => ({
          supersetGroups: removeSupersetGroup(state.supersetGroups, supersetId),
        }));
      },

      // ── Previous Performance ─────────────────────────────────────────────

      setPreviousPerformance: (
        data: Record<string, PreviousPerformanceData | null>,
      ) => {
        set((state) => ({
          previousPerformance: { ...state.previousPerformance, ...data },
        }));
      },

      copyPreviousToSet: (exerciseLocalId: string, setLocalId: string) => {
        const state = get();
        const exercise = state.exercises.find((e) => e.localId === exerciseLocalId);
        if (!exercise) return;

        const key = exercise.exerciseName.toLowerCase();
        const prevData = state.previousPerformance[key];
        if (!prevData) return;

        const setIndex = exercise.sets.findIndex((s) => s.localId === setLocalId);
        if (setIndex < 0 || setIndex >= prevData.sets.length) return;

        const prevSet = prevData.sets[setIndex];
        // Store weight as-is in kg (the screen converts for display)
        set({
          exercises: state.exercises.map((ex) => {
            if (ex.localId !== exerciseLocalId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) =>
                s.localId === setLocalId
                  ? {
                      ...s,
                      weight: String(prevSet.weightKg),
                      reps: String(prevSet.reps),
                    }
                  : s,
              ),
            };
          }),
        });
      },

      // ── Metadata ─────────────────────────────────────────────────────────

      setSessionDate: (date: string) => {
        if (!isValidSessionDate(date)) return;
        set({ sessionDate: date });
      },

      setNotes: (notes: string) => {
        set({ notes });
      },
    }),
    {
      name: 'active-workout-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
