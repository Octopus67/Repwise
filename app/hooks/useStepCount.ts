import { useState, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

interface StepCountResult {
  steps: number | null;
  loading: boolean;
  permissionDenied: boolean;
  unavailable: boolean;
}

/** Read today's step count from device pedometer. Refreshes on app foreground. */
export function useStepCount(): StepCountResult {
  const [steps, setSteps] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

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
    } catch {
      // Silently fail — steps are optional
      setSteps(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return { steps, loading, permissionDenied, unavailable };
}
