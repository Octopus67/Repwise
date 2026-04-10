/**
 * useDashboardQueries — TanStack Query wrapper for dashboard data fetching (P1-3)
 *
 * Replaces manual Promise.allSettled in useDashboardData with useQueries.
 * Each query has independent caching, retry, and stale management.
 */

import { useQueries, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { getWeekDates } from '../../utils/dateScrollerLogic';
import { useStore } from '../../store';

const FIVE_MIN = 1000 * 60 * 5;
const TEN_MIN = 1000 * 60 * 10;

// ── Query key factories ──────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  nutrition: (date: string) => ['dashboard', 'nutrition', date] as const,
  adaptive: () => ['dashboard', 'adaptive'] as const,
  training: (date: string) => ['dashboard', 'training', date] as const,
  weekTraining: (weekStart: string, weekEnd: string) => ['dashboard', 'weekTraining', weekStart, weekEnd] as const,
  articles: () => ['dashboard', 'articles'] as const,
  bodyweight: () => ['dashboard', 'bodyweight'] as const,
  streak: () => ['dashboard', 'streak'] as const,
  milestones: () => ['dashboard', 'milestones'] as const,
  weeklyCheckin: () => ['dashboard', 'weeklyCheckin'] as const,
  fatigue: () => ['dashboard', 'fatigue'] as const,
  recomp: () => ['dashboard', 'recomp'] as const,
  nudges: () => ['dashboard', 'nudges'] as const,
  volume: () => ['dashboard', 'volume'] as const,
  challenges: () => ['dashboard', 'challenges'] as const,
};

// ── Query definitions ────────────────────────────────────────────────────────

function buildQueries(date: string, goalType?: string) {
  const weekDates = getWeekDates(date);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  return [
    // Primary queries
    {
      queryKey: dashboardKeys.nutrition(date),
      queryFn: () => api.get('nutrition/entries', { params: { start_date: date, end_date: date } }).then(r => r.data.items ?? []),
      staleTime: FIVE_MIN,
    },
    {
      queryKey: dashboardKeys.adaptive(),
      queryFn: () => api.get('adaptive/snapshots', { params: { limit: 1 } }).then(r => r.data.items?.[0] ?? null),
      staleTime: TEN_MIN,
    },
    {
      queryKey: dashboardKeys.training(date),
      queryFn: () => api.get('training/sessions', { params: { start_date: date, end_date: date, limit: 10 } }).then(r => r.data.items ?? []),
      staleTime: FIVE_MIN,
    },
    {
      queryKey: dashboardKeys.articles(),
      queryFn: () => api.get('content/articles', { params: { limit: 5, status: 'published' } }).then(r => r.data.items ?? []),
      staleTime: TEN_MIN,
    },
    {
      queryKey: dashboardKeys.bodyweight(),
      queryFn: () => api.get('users/bodyweight/history', { params: { limit: 90 } }).then(r => r.data.items ?? []),
      staleTime: TEN_MIN,
    },
    {
      queryKey: dashboardKeys.streak(),
      queryFn: () => api.get('achievements/streak').then(r => r.data?.current_streak ?? 0),
      staleTime: FIVE_MIN,
    },
    {
      queryKey: dashboardKeys.weekTraining(weekStart, weekEnd),
      queryFn: () => api.get('training/sessions', { params: { start_date: weekStart, end_date: weekEnd, limit: 50 } }).then(r => r.data.items ?? []),
      staleTime: FIVE_MIN,
    },
    // Secondary queries
    {
      queryKey: dashboardKeys.milestones(),
      queryFn: () => api.get('training/analytics/strength-standards').then(r => r.data),
      staleTime: TEN_MIN,
    },
    {
      queryKey: dashboardKeys.weeklyCheckin(),
      queryFn: () => api.get('adaptive/weekly-checkin').then(r => r.data),
      staleTime: TEN_MIN,
    },
    {
      queryKey: dashboardKeys.fatigue(),
      queryFn: () => api.get('training/fatigue').then(r => r.data.suggestions ?? []),
      staleTime: TEN_MIN,
    },
    {
      queryKey: dashboardKeys.recomp(),
      queryFn: () => goalType === 'recomposition' ? api.get('recomp/metrics').then(r => r.data) : Promise.resolve(null),
      staleTime: TEN_MIN,
      enabled: goalType === 'recomposition',
    },
    {
      queryKey: dashboardKeys.nudges(),
      queryFn: () => api.get('adaptive/nudges').then(r => r.data ?? []),
      staleTime: FIVE_MIN,
    },
    {
      queryKey: dashboardKeys.volume(),
      queryFn: () => api.get('training/analytics/muscle-volume').then(r => {
        const groups = r.data.muscle_groups ?? r.data ?? [];
        if (groups.length === 0) return null;
        return {
          optimal: groups.filter((g: { status: string }) => g.status === 'optimal').length,
          approachingMrv: groups.filter((g: { status: string }) => g.status === 'approaching_mrv').length,
          total: groups.length,
        };
      }),
      staleTime: TEN_MIN,
    },
    {
      queryKey: dashboardKeys.challenges(),
      queryFn: () => api.get('challenges/current').then(r => r.data ?? []),
      staleTime: FIVE_MIN,
    },
  ];
}

// Query result indices (must match buildQueries order)
const Q = {
  NUTRITION: 0,
  ADAPTIVE: 1,
  TRAINING: 2,
  ARTICLES: 3,
  BODYWEIGHT: 4,
  STREAK: 5,
  WEEK_TRAINING: 6,
  MILESTONES: 7,
  WEEKLY_CHECKIN: 8,
  FATIGUE: 9,
  RECOMP: 10,
  NUDGES: 11,
  VOLUME: 12,
  CHALLENGES: 13,
} as const;

export function useDashboardQueries(date: string) {
  const goalType = useStore((s) => s.goals?.goalType);
  const queryClient = useQueryClient();

  const results = useQueries({ queries: buildQueries(date, goalType) });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
  const isFetching = results.some((r) => r.isFetching);

  // Per-section error states for inline error indicators (#17)
  const sectionErrors = {
    nutrition: results[Q.NUTRITION].isError,
    adaptive: results[Q.ADAPTIVE].isError,
    training: results[Q.TRAINING].isError,
    articles: results[Q.ARTICLES].isError,
    bodyweight: results[Q.BODYWEIGHT].isError,
    streak: results[Q.STREAK].isError,
    milestones: results[Q.MILESTONES].isError,
    fatigue: results[Q.FATIGUE].isError,
    volume: results[Q.VOLUME].isError,
    challenges: results[Q.CHALLENGES].isError,
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };

  const refetchSection = (index: number) => {
    results[index]?.refetch();
  };

  return {
    results,
    Q,
    isLoading,
    isError,
    isFetching,
    sectionErrors,
    refetch,
    refetchSection,
  };
}
