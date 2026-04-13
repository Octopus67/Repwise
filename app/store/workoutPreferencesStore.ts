/**
 * Workout Preferences Store
 *
 * Zustand store with AsyncStorage persistence for workout UI preferences.
 * Separate from activeWorkoutSlice so preferences survive workout discard.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WorkoutPreferencesState {
  showRpeColumn: boolean;
  showRpeRirTooltip: boolean;
  simpleMode: boolean;
  simpleModeDiscoveryCount: number;
  hasCompletedFirstManualWorkout: boolean;
  timerSoundEnabled: boolean;
  exerciseRestOverrides: Record<string, number>;
}

interface WorkoutPreferencesActions {
  toggleRpeColumn: () => void;
  dismissRpeRirTooltip: () => void;
  toggleSimpleMode: () => void;
  toggleTimerSound: () => void;
  setExerciseRestDefault: (exerciseName: string, seconds: number) => void;
  clearExerciseRestDefault: (exerciseName: string) => void;
}

export const useWorkoutPreferencesStore = create<
  WorkoutPreferencesState & WorkoutPreferencesActions
>()(
  persist(
    (set) => ({
      showRpeColumn: false,
      showRpeRirTooltip: true,
      simpleMode: false,
      simpleModeDiscoveryCount: 0,
      hasCompletedFirstManualWorkout: false,
      timerSoundEnabled: true,
      exerciseRestOverrides: {},

      toggleRpeColumn: () => {
        set((state) => ({ showRpeColumn: !state.showRpeColumn }));
      },

      dismissRpeRirTooltip: () => {
        set({ showRpeRirTooltip: false });
      },

      toggleSimpleMode: () => {
        set((state) => ({ simpleMode: !state.simpleMode }));
      },

      toggleTimerSound: () => set((s) => ({ timerSoundEnabled: !s.timerSoundEnabled })),

      setExerciseRestDefault: (name, seconds) => set((s) => ({
        exerciseRestOverrides: { ...s.exerciseRestOverrides, [name]: seconds },
      })),
      clearExerciseRestDefault: (name) => set((s) => {
        const { [name]: _, ...rest } = s.exerciseRestOverrides;
        return { exerciseRestOverrides: rest };
      }),
    }),
    {
      name: 'workout-preferences-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
