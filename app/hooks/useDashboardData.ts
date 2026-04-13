import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store';
import { useFeatureFlag } from './useFeatureFlag';
import { useDailyTargets } from './useDailyTargets';
import { useHaptics } from './useHaptics';
import { useDashboardQueries } from './queries/useDashboardQueries';
import { getLocalDateString } from '../utils/localDate';
import type { TrainingSessionResponse } from '../types/training';
import type { RecoveryFactor } from '../types/common';

const DATE_DEBOUNCE_MS = 300;

export type { Article } from '../types/common';
import type { Article } from '../types/common';

export interface VolumeSummary {
  optimal: number;
  approachingMrv: number;
  total: number;
}

export interface NutritionEntryRaw {
  id: string;
  meal_name: string;
  food_name?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entry_date: string;
  created_at: string | null;
  micro_nutrients?: { water_ml?: number; fibre_g?: number } | null;
}

export interface Challenge {
  id: string;
  challenge_type: string;
  title: string;
  description: string;
  target_value: number;
  current_value: number;
  completed: boolean;
}

export interface FatigueSuggestion {
  muscle_group: string;
  fatigue_score: number;
  top_regressed_exercise: string;
  decline_pct: number;
  decline_sessions: number;
  message: string;
  suggestion?: string;
  severity?: string;
}

export interface RecompMetrics {
  waist_trend: { slope_per_week: number; direction: string; data_points: number } | null;
  arm_trend: { slope_per_week: number; direction: string; data_points: number } | null;
  chest_trend: { slope_per_week: number; direction: string; data_points: number } | null;
  weight_trend: { slope_per_week: number; direction: string; data_points: number } | null;
  recomp_score: number | null;
  has_sufficient_data: boolean;
}

export interface Nudge {
  id: string;
  type: string;
  title: string;
  message: string;
  action: string;
}

export interface DashboardData {
  calories: { value: number; target: number };
  protein: { value: number; target: number };
  carbs: { value: number; target: number };
  totalFat: number;
  nutritionEntries: NutritionEntryRaw[];
  trainingSessions: TrainingSessionResponse[];
  workoutsCompleted: number;
  streak: number;
  articles: Article[];
  nutritionLogged: boolean;
  trainingLogged: boolean;
  loggedDates: Set<string>;
  weightHistory: { date: string; value: number }[];
  milestoneMessage: string | null;
  fatigueSuggestions: FatigueSuggestion[];
  readinessScore: number | null;
  readinessFactors: RecoveryFactor[];
  recompMetrics: RecompMetrics | null;
  nudges: Nudge[];
  volumeSummary: VolumeSummary | null;
  trainedDates: Set<string>;
  challenges: Challenge[];
}

const INITIAL_DATA: DashboardData = {
  calories: { value: 0, target: 2400 },
  protein: { value: 0, target: 180 },
  carbs: { value: 0, target: 250 },
  totalFat: 0,
  nutritionEntries: [],
  trainingSessions: [],
  workoutsCompleted: 0,
  streak: 0,
  articles: [],
  nutritionLogged: false,
  trainingLogged: false,
  loggedDates: new Set(),
  weightHistory: [],
  milestoneMessage: null,
  fatigueSuggestions: [],
  readinessScore: null,
  readinessFactors: [],
  recompMetrics: null,
  nudges: [],
  volumeSummary: null,
  trainedDates: new Set(),
  challenges: [],
};

export function useDashboardData() {
  const setWeeklyCheckin = useStore((s) => s.setWeeklyCheckin);
  const adaptiveTargets = useStore((s) => s.adaptiveTargets);
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const setAdaptiveTargets = useStore((s) => s.setAdaptiveTargets);
  const { impact } = useHaptics();

  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateLoading, setDateLoading] = useState(false);

  // Reset selectedDate when app resumes and the calendar date has changed
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const today = getLocalDateString();
        if (selectedDate !== today) {
          setSelectedDate(today);
        }
      }
    });
    return () => sub.remove();
  }, [selectedDate, setSelectedDate]);

  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    effectiveTargets: syncTargets,
  } = useDailyTargets(selectedDate);

  const { enabled: volumeFlagEnabled } = useFeatureFlag('volume_landmarks');

  // ── TanStack Query integration ─────────────────────────────────────────
  const { results, Q, isLoading: queryLoading, isError: queryError, isFetching, sectionErrors, refetch: invalidateAll, refetchSection } = useDashboardQueries(selectedDate);

  // Derive DashboardData from query results (pure computation — no side effects)
  const derivedData = useMemo<DashboardData>(() => {
    if (queryLoading) return INITIAL_DATA;

    const updates: Partial<DashboardData> = {};

    // Nutrition
    const nutritionData = results[Q.NUTRITION].data as NutritionEntryRaw[] | undefined;
    if (nutritionData) {
      const entries = nutritionData;
      updates.nutritionEntries = entries;
      const totals = entries.reduce(
        (acc, e) => ({
          cal: acc.cal + (e.calories ?? 0),
          pro: acc.pro + (e.protein_g ?? 0),
          carb: acc.carb + (e.carbs_g ?? 0),
          fat: acc.fat + (e.fat_g ?? 0),
        }),
        { cal: 0, pro: 0, carb: 0, fat: 0 },
      );
      updates.totalFat = Math.round(totals.fat);
      updates.nutritionLogged = entries.length > 0;
      const dates = new Set<string>();
      entries.forEach((e) => { if (e.entry_date) dates.add(e.entry_date); });
      updates.loggedDates = dates;
      updates.calories = { value: Math.round(totals.cal), target: 2400 };
      updates.protein = { value: Math.round(totals.pro), target: 180 };
      updates.carbs = { value: Math.round(totals.carb), target: 250 };
    }

    // Adaptive targets
    const snap = results[Q.ADAPTIVE].data as Record<string, number> | null | undefined;
    if (snap) {
      if (updates.calories) updates.calories.target = Math.round(snap.target_calories);
      else updates.calories = { value: 0, target: Math.round(snap.target_calories) };
      if (updates.protein) updates.protein.target = Math.round(snap.target_protein_g);
      else updates.protein = { value: 0, target: Math.round(snap.target_protein_g) };
      if (snap.target_carbs_g) {
        if (updates.carbs) updates.carbs.target = Math.round(snap.target_carbs_g);
        else updates.carbs = { value: 0, target: Math.round(snap.target_carbs_g) };
      }
    }

    // Training
    const sessions = results[Q.TRAINING].data as TrainingSessionResponse[] | undefined;
    if (sessions) {
      updates.workoutsCompleted = sessions.length;
      updates.trainingLogged = sessions.length > 0;
      updates.trainingSessions = sessions;
    }

    // Week training
    const weekSessions = results[Q.WEEK_TRAINING].data as Array<{ session_date?: string }> | undefined;
    if (weekSessions) {
      const dates = new Set<string>();
      weekSessions.forEach((s) => { if (s.session_date) dates.add(s.session_date); });
      updates.trainedDates = dates;
    }

    // Articles
    const articles = results[Q.ARTICLES].data as Article[] | undefined;
    if (articles) updates.articles = articles;

    // Bodyweight
    const bwLogs = results[Q.BODYWEIGHT].data as Array<{ recorded_date: string; weight_kg: number }> | undefined;
    if (bwLogs) {
      updates.weightHistory = bwLogs.map((l) => ({ date: l.recorded_date, value: l.weight_kg }));
    }

    // Streak
    const streak = results[Q.STREAK].data as number | undefined;
    updates.streak = streak ?? 0;

    // Milestones
    const milestoneData = results[Q.MILESTONES].data as { milestones?: Array<{ message: string }> } | undefined;
    updates.milestoneMessage = milestoneData?.milestones?.length ? milestoneData.milestones[0].message : null;

    // Fatigue
    updates.fatigueSuggestions = (results[Q.FATIGUE].data as FatigueSuggestion[] | undefined) ?? [];

    // Recomp
    updates.recompMetrics = (results[Q.RECOMP].data as RecompMetrics | undefined) ?? null;

    // Nudges
    updates.nudges = (results[Q.NUDGES].data as Nudge[] | undefined) ?? [];

    // Volume
    updates.volumeSummary = (results[Q.VOLUME].data as VolumeSummary | undefined) ?? null;

    // Challenges
    updates.challenges = (results[Q.CHALLENGES].data as Challenge[] | undefined) ?? [];

    return { ...INITIAL_DATA, ...updates };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queryLoading,
    results[Q.NUTRITION].data, results[Q.ADAPTIVE].data, results[Q.TRAINING].data,
    results[Q.ARTICLES].data, results[Q.BODYWEIGHT].data, results[Q.STREAK].data,
    results[Q.WEEK_TRAINING].data, results[Q.MILESTONES].data, results[Q.FATIGUE].data,
    results[Q.RECOMP].data, results[Q.NUDGES].data, results[Q.VOLUME].data,
    results[Q.CHALLENGES].data,
  ]);

  // Side effects: sync adaptive targets + weekly checkin to store (only when data changes)
  const adaptiveSnap = results[Q.ADAPTIVE].data as Record<string, number> | null | undefined;
  const checkinData = results[Q.WEEKLY_CHECKIN].data;
  useEffect(() => {
    if (adaptiveSnap) {
      setAdaptiveTargets({
        calories: Math.round(adaptiveSnap.target_calories),
        protein_g: Math.round(adaptiveSnap.target_protein_g),
        carbs_g: Math.round(adaptiveSnap.target_carbs_g ?? 250),
        fat_g: Math.round(adaptiveSnap.target_fat_g ?? 65),
      });
    }
    if (checkinData) setWeeklyCheckin(checkinData);
  }, [adaptiveSnap, checkinData, setAdaptiveTargets, setWeeklyCheckin]);

  // Sync query errors to local error state
  useEffect(() => {
    if (queryError) setError('Unable to load dashboard data. Check your connection.');
    else setError(null);
  }, [queryError]);

  // Legacy loadDashboardData — now just invalidates queries
  const loadDashboardData = useCallback((_dateToLoad?: string, _signal?: AbortSignal) => {
    invalidateAll();
  }, [invalidateAll]);

  // Per-section refetch helpers for inline error retry (#17)
  const refetchBySection = useMemo(() => ({
    nutrition: () => refetchSection(Q.NUTRITION),
    training: () => refetchSection(Q.TRAINING),
    articles: () => refetchSection(Q.ARTICLES),
    bodyweight: () => refetchSection(Q.BODYWEIGHT),
    milestones: () => refetchSection(Q.MILESTONES),
    fatigue: () => refetchSection(Q.FATIGUE),
    volume: () => refetchSection(Q.VOLUME),
    challenges: () => refetchSection(Q.CHALLENGES),
    streak: () => refetchSection(Q.STREAK),
  }), [refetchSection, Q]);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setDateLoading(true);
    impact('light');
    // Debounce rapid date changes
    if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
    dateDebounceRef.current = setTimeout(() => {
      // Query will auto-refetch when selectedDate changes
      setDateLoading(false);
    }, DATE_DEBOUNCE_MS);
  }, [setSelectedDate, impact]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateAll();
    // Wait a tick for queries to start refetching, then clear refreshing when done
    setTimeout(() => setRefreshing(false), 1000);
    impact('light');
  }, [invalidateAll, impact]);

  const isLoading = queryLoading;

  const targets = syncTargets
    ? {
        calories: Math.round(syncTargets.calories),
        protein_g: Math.round(syncTargets.protein_g),
        carbs_g: Math.round(syncTargets.carbs_g),
        fat_g: Math.round(syncTargets.fat_g),
      }
    : adaptiveTargets ?? {
        calories: derivedData.calories.target,
        protein_g: derivedData.protein.target,
        carbs_g: derivedData.carbs.target,
        fat_g: 65,
      };

  const consumed = {
    calories: derivedData.calories.value,
    protein_g: derivedData.protein.value,
    carbs_g: derivedData.carbs.value,
    fat_g: derivedData.totalFat,
  };

  return {
    data: derivedData,
    setData: () => {}, // no-op — data is now derived
    isLoading,
    error,
    setError,
    refreshing,
    dateLoading,
    handleDateSelect,
    handleRefresh,
    loadDashboardData,
    targets,
    consumed,
    volumeFlagEnabled,
    selectedDate,
    sectionErrors,
    refetchBySection,
  };
}
