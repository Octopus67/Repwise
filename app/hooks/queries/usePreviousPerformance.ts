/**
 * usePreviousPerformance — TanStack Query hook for previous performance data (P1-3)
 *
 * Replaces manual api.post in useWorkoutData with cached useQuery.
 * Supports batch fetching for multiple exercise names.
 */

import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import type { PreviousPerformanceData } from '../../types/training';

const TEN_MIN = 1000 * 60 * 10;

export const prevPerfKeys = {
  all: ['prevPerf'] as const,
  batch: (names: string[]) => ['prevPerf', ...names.sort()] as const,
  single: (name: string) => ['prevPerf', name] as const,
};

function mapResult(val: {
  exercise_name: string;
  session_date: string;
  sets: Array<{ weight_kg: number; reps: number; rpe: number | null }>;
}): PreviousPerformanceData {
  return {
    exerciseName: val.exercise_name,
    sessionDate: val.session_date,
    sets: val.sets.map((s) => ({ weightKg: s.weight_kg, reps: s.reps, rpe: s.rpe })),
  };
}

/**
 * Batch fetch previous performance for multiple exercises.
 * Returns a map of lowercase exercise name → data | null.
 */
export function usePreviousPerformanceBatch(exerciseNames: string[]) {
  const names = exerciseNames.filter(Boolean);

  return useQuery<Record<string, PreviousPerformanceData | null>>({
    queryKey: prevPerfKeys.batch(names),
    queryFn: async () => {
      if (names.length === 0) return {};
      const { data } = await api.post('training/previous-performance/batch', {
        exercise_names: names.slice(0, 20),
      });
      if (!data.results) return {};
      const mapped: Record<string, PreviousPerformanceData | null> = {};
      for (const [key, val] of Object.entries(data.results)) {
        mapped[key.toLowerCase()] = val ? mapResult(val as Parameters<typeof mapResult>[0]) : null;
      }
      return mapped;
    },
    enabled: names.length > 0,
    staleTime: TEN_MIN,
  });
}
