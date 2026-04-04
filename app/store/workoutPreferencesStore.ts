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
}

interface WorkoutPreferencesActions {
  toggleRpeColumn: () => void;
  dismissRpeRirTooltip: () => void;
  toggleSimpleMode: () => void;
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

      toggleRpeColumn: () => {
        set((state) => ({ showRpeColumn: !state.showRpeColumn }));
      },

      dismissRpeRirTooltip: () => {
        set({ showRpeRirTooltip: false });
      },

      toggleSimpleMode: () => {
        set((state) => ({ simpleMode: !state.simpleMode }));
      },
    }),
    {
      name: 'workout-preferences-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
