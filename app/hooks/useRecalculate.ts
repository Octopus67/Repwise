import { useRef, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useStore } from '../store';

const DEBOUNCE_MS = 500;

type MetricsPayload = Record<string, unknown>;
type GoalsPayload = Record<string, unknown>;

interface RecalculateRequest {
  metrics?: MetricsPayload;
  goals?: GoalsPayload;
}

interface PendingCall {
  resolve: () => void;
  reject: (err: unknown) => void;
}

/**
 * Debounced recalculate hook. Accumulates metrics/goals payloads and
 * fires a single API call after DEBOUNCE_MS of inactivity.
 *
 * Returns `recalculate(payload)` — a promise that resolves when the
 * batched API call completes (so EditableField can close edit mode).
 */
export function useRecalculate() {
  const store = useStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef<RecalculateRequest>({});
  const pendingRef = useRef<PendingCall[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flush = useCallback(async () => {
    const payload = { ...accumulatedRef.current };
    const waiters = [...pendingRef.current];
    accumulatedRef.current = {};
    pendingRef.current = [];

    try {
      const { data } = await api.post('users/recalculate', payload);

      if (mountedRef.current) {
        if (data.metrics) {
          store.setLatestMetrics({
            id: data.metrics.id,
            heightCm: data.metrics.height_cm,
            weightKg: data.metrics.weight_kg,
            bodyFatPct: data.metrics.body_fat_pct,
            activityLevel: data.metrics.activity_level,
            recordedAt: data.metrics.recorded_at,
          });
        }
        if (data.goals) {
          store.setGoals({
            id: data.goals.id,
            userId: data.goals.user_id,
            goalType: data.goals.goal_type,
            targetWeightKg: data.goals.target_weight_kg,
            goalRatePerWeek: data.goals.goal_rate_per_week,
          });
        }
        if (data.targets) {
          store.setAdaptiveTargets({
            calories: data.targets.calories,
            protein_g: data.targets.protein_g,
            carbs_g: data.targets.carbs_g,
            fat_g: data.targets.fat_g,
          });
        }
      }

      waiters.forEach((w) => w.resolve());
    } catch (err: unknown) {
      waiters.forEach((w) => w.reject(err));
    }
  }, [store]);

  const recalculate = useCallback(
    (payload: RecalculateRequest): Promise<void> => {
      // Merge: later values overwrite earlier ones per-key
      if (payload.metrics) {
        accumulatedRef.current.metrics = {
          ...accumulatedRef.current.metrics,
          ...payload.metrics,
        };
      }
      if (payload.goals) {
        accumulatedRef.current.goals = {
          ...accumulatedRef.current.goals,
          ...payload.goals,
        };
      }

      // Reset debounce timer
      if (timerRef.current) clearTimeout(timerRef.current);

      return new Promise<void>((resolve, reject) => {
        pendingRef.current.push({ resolve, reject });
        timerRef.current = setTimeout(flush, DEBOUNCE_MS);
      });
    },
    [flush],
  );

  return { recalculate };
}
