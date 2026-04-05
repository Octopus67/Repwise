/**
 * useWorkoutData — Extracted from ActiveWorkoutScreen (P0-0)
 *
 * Handles all data fetching for the active workout:
 * - Previous performance (batch)
 * - Overload suggestions (batch)
 * - Weekly muscle volume
 * - Exercise list + muscle group map
 * - Recent exercises
 *
 * Pure refactor — zero behavior changes.
 */

import { useEffect, useState } from 'react';
import api from '../services/api';
import { usePreviousPerformanceBatch } from './queries/usePreviousPerformance';
import type { PreviousPerformanceData } from '../types/training';
import type { ActiveWorkoutState, ActiveWorkoutActions } from '../types/training';

function getWeekMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return getLocalDateString(monday);
}

interface UseWorkoutDataParams {
  store: ActiveWorkoutState & ActiveWorkoutActions;
}

export function useWorkoutData({ store }: UseWorkoutDataParams) {
  const [exerciseList, setExerciseList] = useState<string[]>([]);
  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [muscleGroupMap, setMuscleGroupMap] = useState<Record<string, string>>({});

  // ── Previous performance via TanStack Query ──
  const exerciseNames = store.exercises.map((e) => e.exerciseName).filter(Boolean);
  const uncachedNames = exerciseNames.filter((n) => !(n.toLowerCase() in store.previousPerformance));
  const { data: prevPerfData } = usePreviousPerformanceBatch(uncachedNames);

  // Sync query results into store
  useEffect(() => {
    if (prevPerfData && Object.keys(prevPerfData).length > 0) {
      store.setPreviousPerformance(prevPerfData);
    }
  }, [prevPerfData, store]);

  // ── Fetch overload suggestions + volume (still manual for now) ──

  useEffect(() => {
    const names = store.exercises.map((e) => e.exerciseName).filter(Boolean);
    if (names.length === 0) return;

    // Batch overload suggestions
    api.post('training/exercises/batch-overload-suggestions', { exercise_names: names.slice(0, 20) })
      .then(({ data }) => {
        if (data.suggestions) store.setOverloadSuggestions(data.suggestions);
      })
      .catch((err: unknown) => console.warn('[ActiveWorkout] overload suggestions fetch failed:', String(err)));

    // Weekly volume
    const monday = getWeekMonday();
    api.get('training/analytics/muscle-volume', { params: { week_start: monday } })
      .then(({ data }) => {
        if (Array.isArray(data)) store.setWeeklyVolumeData(data);
      })
      .catch((err: unknown) => console.warn('[ActiveWorkout] weekly volume fetch failed:', String(err)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.exercises.length]);

  // ── Fetch exercise list + muscle group map for picker and volume ──

  useEffect(() => {
    api.get('training/exercises')
      .then(({ data }) => {
        if (!Array.isArray(data)) return;
        setExerciseList(data.map((e: { name: string }) => e.name).filter(Boolean));
        const map: Record<string, string> = {};
        for (const ex of data) {
          if (ex.name && ex.muscle_group) map[ex.name] = ex.muscle_group;
        }
        setMuscleGroupMap(map);
      })
      .catch((err: unknown) => console.warn('[ActiveWorkout] exercise list fetch failed:', String(err)));

    // Recent exercises
    api.get('training/sessions', { params: { limit: 5 } })
      .then(({ data }) => {
        const sessions = data.items ?? data ?? [];
        const names = new Set<string>();
        for (const s of sessions) {
          for (const ex of s.exercises ?? []) {
            if (ex.exercise_name) names.add(ex.exercise_name);
          }
        }
        setRecentExercises(Array.from(names).slice(0, 10));
      })
      .catch((err: unknown) => console.warn('[ActiveWorkout] recent exercises fetch failed:', String(err)));
  }, []);

  return {
    exerciseList,
    recentExercises,
    muscleGroupMap,
  };
}
