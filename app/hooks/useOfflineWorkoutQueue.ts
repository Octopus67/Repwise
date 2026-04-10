/**
 * useOfflineWorkoutQueue — Minimal offline queue for workout saves.
 *
 * When a workout save fails due to a network error, the payload is
 * persisted to AsyncStorage. On network reconnect, the queued workout
 * is retried automatically.
 *
 * Deferred: offline queue planned for v2 — this is the v2 implementation.
 */

import { useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AxiosError } from 'axios';
import api from '../services/api';
import { queryClient } from '../services/queryClient';

const QUEUE_KEY = '@repwise:offline_workout_queue';

function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return !error.response; // No response = network error
  }
  return false;
}

/** Save a failed workout payload to AsyncStorage for later retry. */
export async function enqueueOfflineWorkout(payload: Record<string, unknown>): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(payload));
    console.log('[OfflineQueue] Workout queued for retry');
  } catch (e) {
    console.error('[OfflineQueue] Failed to queue workout:', e);
  }
}

/** Process any queued offline workout. Returns true if a workout was retried. */
export async function processOfflineQueue(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return false;

    const payload = JSON.parse(raw) as Record<string, unknown>;
    await api.post('training/sessions', payload);
    await AsyncStorage.removeItem(QUEUE_KEY);
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    console.log('[OfflineQueue] Queued workout saved successfully');
    return true;
  } catch (e) {
    console.warn('[OfflineQueue] Retry failed, keeping in queue:', e);
    return false;
  }
}

/** Check if an error is a network error suitable for offline queueing. */
export { isNetworkError };

/**
 * Hook that listens for network reconnection and processes the offline queue.
 * Mount once at app level (e.g., in App.tsx or root navigator).
 */
export function useOfflineWorkoutQueue() {
  const processQueue = useCallback(async () => {
    await processOfflineQueue();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        processQueue();
      }
    });
    return () => unsubscribe();
  }, [processQueue]);
}
