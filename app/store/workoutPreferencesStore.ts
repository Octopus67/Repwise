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
}

interface WorkoutPreferencesActions {
  toggleRpeColumn: () => void;
}

export const useWorkoutPreferencesStore = create<
  WorkoutPreferencesState & WorkoutPreferencesActions
>()(
  persist(
    (set) => ({
      showRpeColumn: false,

      toggleRpeColumn: () => {
        set((state) => ({ showRpeColumn: !state.showRpeColumn }));
      },
    }),
    {
      name: 'workout-preferences-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
