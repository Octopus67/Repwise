/**
 * Apple Watch communication bridge.
 * Requires: react-native-watch-connectivity (install separately)
 * Requires: npx expo prebuild (can't use Expo Go)
 *
 * The Watch app itself is native SwiftUI — see ios/Repwise-Watch/
 * This hook handles the React Native side of the communication.
 */
import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

interface WatchModule {
  watchEvents: { on: (event: string, cb: (msg: Record<string, unknown>) => void) => { remove: () => void } };
  updateApplicationContext: (ctx: Record<string, unknown>) => Promise<void>;
}

let watchModule: WatchModule | null = null;

async function getWatchModule() {
  if (Platform.OS !== 'ios') return null;
  if (watchModule) return watchModule;
  try {
    watchModule = await import('react-native-watch-connectivity');
    return watchModule;
  } catch {
    return null;
  }
}

export function useWatch() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let unsubscribe: (() => void) | undefined;

    getWatchModule().then((mod) => {
      if (!mod) return;
      const sub = mod.watchEvents.on('message', (message: Record<string, unknown>) => {
        if (message.action === 'logSet') {
          if (__DEV__) console.log('[Watch] Set logged:', message);
        }
      });
      unsubscribe = () => sub.remove();
    }).catch(() => {});

    return () => unsubscribe?.();
  }, []);

  const syncWorkoutState = useCallback(async (state: {
    exerciseName: string;
    setNumber: number;
    previousWeight?: number;
    previousReps?: number;
  }) => {
    const mod = await getWatchModule();
    if (!mod) return;
    try {
      await mod.updateApplicationContext(state);
    } catch (e) {
      console.warn('[Watch] Failed to sync state:', e);
    }
  }, []);

  const syncRestTimer = useCallback(async (endTime: number, duration: number) => {
    const mod = await getWatchModule();
    if (!mod) return;
    try {
      await mod.updateApplicationContext({ timerEnd: endTime, timerDuration: duration });
    } catch (e) {
      console.warn('[Watch] Failed to sync timer:', e);
    }
  }, []);

  return { syncWorkoutState, syncRestTimer };
}
