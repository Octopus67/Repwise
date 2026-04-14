import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import api from '../services/api';

const DEFAULT_STEP_GOAL = 8000;

interface StepCountResult {
  steps: number | null;
  stepGoal: number;
  setStepGoal: (goal: number) => void;
  loading: boolean;
  permissionDenied: boolean;
  unavailable: boolean;
}

/** Format today's date as YYYY-MM-DD in local timezone */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Read today's step count from device pedometer. Refreshes on app foreground. */
export function useStepCount(): StepCountResult {
  const [steps, setSteps] = useState<number | null>(null);
  const [stepGoal, setStepGoalState] = useState(DEFAULT_STEP_GOAL);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // Track last synced step count to debounce POSTs
  const lastSyncedSteps = useRef<number | null>(null);

  // Ref to track current stepGoal without causing fetchSteps re-creation
  const stepGoalRef = useRef(stepGoal);
  stepGoalRef.current = stepGoal;

  // Fire-and-forget sync to backend
  const syncToBackend = useCallback((stepCount: number, goal: number) => {
    api.post('steps/sync', { date: todayLocal(), step_count: stepCount, step_goal: goal }).catch(() => {
      // Best-effort — don't break the UI
    });
  }, []);

  // Fetch persisted goal from backend on mount
  useEffect(() => {
    api.get<{ items: Array<{ step_goal: number; date: string }> }>('steps/history', { params: { limit: 1 } })
      .then(({ data }) => {
        if (data.items.length > 0) {
          setStepGoalState(data.items[0].step_goal);
        }
      })
      .catch(() => {
        // Best-effort — use default goal
      });
  }, []);

  const fetchSteps = useCallback(async () => {
    if (Platform.OS === 'web') {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setUnavailable(true);
        setLoading(false);
        return;
      }

      const { status } = await Pedometer.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const result = await Pedometer.getStepCountAsync(startOfDay, now);
      setSteps(result.steps);

      // Debounce: only sync if step count changed
      if (result.steps !== lastSyncedSteps.current) {
        lastSyncedSteps.current = result.steps;
        syncToBackend(result.steps, stepGoalRef.current);
      }
    } catch {
      // Silently fail — steps are optional
      setSteps(null);
    } finally {
      setLoading(false);
    }
  }, [syncToBackend]);

  // Allow external goal updates (from UI prompt)
  const setStepGoal = useCallback((goal: number) => {
    setStepGoalState(goal);
    syncToBackend(steps ?? 0, goal);
  }, [steps, syncToBackend]);

  useEffect(() => {
    fetchSteps();

    // Refresh on app foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') fetchSteps();
    });

    // Poll every 5 minutes while active
    const interval = setInterval(fetchSteps, 5 * 60 * 1000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [fetchSteps]);

  return { steps, stepGoal, setStepGoal, loading, permissionDenied, unavailable };
}
