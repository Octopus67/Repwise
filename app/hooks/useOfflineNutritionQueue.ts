import { useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { queryClient } from '../services/queryClient';
import api from '../services/api';
import { useToast, type ToastVariant } from '../contexts/ToastContext';

const QUEUE_KEY = '@repwise:offline_nutrition_queue_v1';
const MAX_QUEUE_SIZE = 100;

let processing = false;

/** Enqueue a nutrition entry for offline sync. Adds idempotency key. */
export async function enqueueNutritionEntry(payload: Record<string, unknown>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    if (queue.length >= MAX_QUEUE_SIZE) {
      queue.shift(); // Drop oldest entry
    }
    queue.push({ ...payload, _idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OfflineNutritionQueue] Failed to queue entry:', e);
  }
}

/** Process queued entries. Returns count of successfully synced entries. */
async function processQueue(showToast: (msg: string, type?: ToastVariant) => void): Promise<number> {
  if (processing) return 0;
  processing = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return 0;

    const queue: Array<Record<string, unknown>> = JSON.parse(raw);
    if (queue.length === 0) return 0;

    const remaining: Array<Record<string, unknown>> = [];
    let synced = 0;

    for (const entry of queue) {
      try {
        const { _idempotencyKey, ...payload } = entry;
        await api.post('nutrition/entries', payload);
        synced++;
      } catch {
        remaining.push(entry);
      }
    }

    if (remaining.length > 0) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(QUEUE_KEY);
    }

    if (synced > 0) {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showToast(`${synced} offline nutrition ${synced === 1 ? 'entry' : 'entries'} synced`, 'success');
    }
    return synced;
  } catch {
    return 0;
  } finally {
    processing = false;
  }
}

/** Hook: processes offline nutrition queue when network reconnects. Mount once at app level. */
export function useOfflineNutritionQueue() {
  const { showToast } = useToast();
  const process = useCallback(async () => {
    await processQueue(showToast);
  }, [showToast]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        process();
      }
    });
    return () => unsubscribe();
  }, [process]);
}
