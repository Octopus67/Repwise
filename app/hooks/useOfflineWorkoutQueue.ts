/**
 * useOfflineWorkoutQueue — Array-based offline queue for workout saves.
 *
 * When a workout save fails due to a network error, the payload is
 * persisted to AsyncStorage as an array. Multiple workouts can be queued.
 * On network reconnect, all queued workouts are retried in order.
 * Edit mode is preserved — edits use PUT, new sessions use POST.
 */

import { useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AxiosError } from 'axios';
import api from '../services/api';
import { queryClient } from '../services/queryClient';

const QUEUE_KEY = '@repwise:offline_workout_queue_v2';

interface QueuedWorkout {
  payload: Record<string, unknown>;
  isEdit: boolean;
  editSessionId?: string;
  queuedAt: string;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return !error.response;
  }
  return false;
}

/** Append a failed workout to the offline queue. */
export async function enqueueOfflineWorkout(
  payload: Record<string, unknown>,
  isEdit = false,
  editSessionId?: string,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedWorkout[] = raw ? JSON.parse(raw) : [];
    queue.push({ payload, isEdit, editSessionId, queuedAt: new Date().toISOString() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OfflineQueue] Failed to queue workout:', e);
  }
}

/** Process all queued offline workouts in order. Returns count of successful retries. */
export async function processOfflineQueue(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return 0;

    const queue: QueuedWorkout[] = JSON.parse(raw);
    if (queue.length === 0) return 0;

    let processed = 0;
    const remaining: QueuedWorkout[] = [];

    for (const item of queue) {
      try {
        if (item.isEdit && item.editSessionId) {
          await api.put(`training/sessions/${item.editSessionId}`, item.payload);
        } else {
          await api.post('training/sessions', item.payload);
        }
        processed++;
      } catch {
        remaining.push(item); // Keep failed items for next retry
      }
    }

    if (remaining.length > 0) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(QUEUE_KEY);
    }

    if (processed > 0) {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
    return processed;
  } catch {
    return 0;
  }
}

export { isNetworkError };

/**
 * Hook that listens for network reconnection and processes the offline queue.
 * Mount once at app level.
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
