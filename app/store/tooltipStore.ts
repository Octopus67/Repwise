/**
 * Tooltip State Store
 *
 * Zustand store with AsyncStorage persistence for one-time tooltip dismissals.
 * Tracks which tooltips have been dismissed so they are not shown again.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TooltipState {
  dismissed: Record<string, boolean>;
}

interface TooltipActions {
  dismiss: (id: string) => void;
  isDismissed: (id: string) => boolean;
}

export const useTooltipStore = create<TooltipState & TooltipActions>()(
  persist(
    (set, get) => ({
      dismissed: {},

      dismiss: (id: string) => {
        set((state) => ({
          dismissed: { ...state.dismissed, [id]: true },
        }));
      },

      isDismissed: (id: string): boolean => {
        return get().dismissed[id] ?? false;
      },
    }),
    {
      name: 'tooltip-state-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
