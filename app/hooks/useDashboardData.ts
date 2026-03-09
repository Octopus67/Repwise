import { useState, useRef, useCallback } from 'react';
import api from '../services/api';
import { useStore } from '../store';
import { useFeatureFlag } from './useFeatureFlag';
import { useHealthData } from './useHealthData';
import { useDailyTargets } from './useDailyTargets';
import { useHaptics } from './useHaptics';

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

const DATE_DEBOUNCE_MS = 300;

export interface Article {
  id: string;
  title: string;
  module_name: string;
  estimated_read_time_min: number;
}

export interface VolumeSummary {
  optimal: number;
  approachingMrv: number;
  total: number;
}

export interface NutritionEntryRaw {
  id: string;
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entry_date: string;
  created_at: string | null;
  micro_nutrients?: { water_ml?: number; fibre_g?: number } | null;
}

export interface DashboardData {
  calories: { value: number; target: number };
  protein: { value: number; target: number };
  carbs: { value: number; target: number };
  totalFat: number;
  nutritionEntries: NutritionEntryRaw[];
  trainingSessions: any[];
  workoutsCompleted: number;
  streak: number;
  articles: Article[];
  nutritionLogged: boolean;
  trainingLogged: boolean;
  loggedDates: Set<string>;
  weightHistory: { date: string; value: number }[];
  milestoneMessage: string | null;
  fatigueSuggestions: any[];
  readinessScore: number | null;
  readinessFactors: any[];
  recompMetrics: any;
  nudges: any[];
  volumeSummary: VolumeSummary | null;
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
};

export function useDashboardData() {
  const store = useStore();
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const setAdaptiveTargets = useStore((s) => s.setAdaptiveTargets);
  const { impact } = useHaptics();
  const healthData = useHealthData();
  const healthDataRef = useRef(healthData);
  healthDataRef.current = healthData;

  const [data, setData] = useState<DashboardData>(INITIAL_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateLoading, setDateLoading] = useState(false);

  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateAbortRef = useRef<AbortController | null>(null);

  const {
    effectiveTargets: syncTargets,
  } = useDailyTargets(selectedDate);

  const { enabled: volumeFlagEnabled } = useFeatureFlag('volume_landmarks');

  const loadDashboardData = useCallback(async (dateToLoad?: string, signal?: AbortSignal) => {
    try {
      const targetDate = dateToLoad ?? selectedDate;
      setError(null);

      const [nutritionRes, adaptiveRes, trainingRes, articlesRes, bwRes, streakRes] = await Promise.allSettled([
        api.get('nutrition/entries', { params: { start_date: targetDate, end_date: targetDate }, signal }),
        api.get('adaptive/snapshots', { params: { limit: 1 }, signal }),
        api.get('training/sessions', { params: { start_date: targetDate, end_date: targetDate, limit: 10 }, signal }),
        api.get('content/articles', { params: { limit: 5, status: 'published' }, signal }),
        api.get('users/bodyweight/history', { params: { limit: 90 }, signal }),
        api.get('achievements/streak', { signal }),
      ]);

      const updates: Partial<DashboardData> = {};

      // Nutrition
      if (nutritionRes.status === 'fulfilled') {
        const entries: NutritionEntryRaw[] = nutritionRes.value.data.items ?? [];
        updates.nutritionEntries = entries;
        const totals = entries.reduce(
          (acc, e: any) => ({
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
        // calories/protein/carbs values set below after adaptive
        updates.calories = { value: Math.round(totals.cal), target: 2400 };
        updates.protein = { value: Math.round(totals.pro), target: 180 };
        updates.carbs = { value: Math.round(totals.carb), target: 250 };
      }

      // Adaptive targets
      if (adaptiveRes.status === 'fulfilled') {
        const snap = adaptiveRes.value.data.items?.[0];
        if (snap) {
          if (updates.calories) updates.calories.target = Math.round(snap.target_calories);
          else updates.calories = { value: 0, target: Math.round(snap.target_calories) };
          if (updates.protein) updates.protein.target = Math.round(snap.target_protein_g);
          else updates.protein = { value: 0, target: Math.round(snap.target_protein_g) };
          if (snap?.target_carbs_g) {
            if (updates.carbs) updates.carbs.target = Math.round(snap.target_carbs_g);
            else updates.carbs = { value: 0, target: Math.round(snap.target_carbs_g) };
          }
          setAdaptiveTargets({
            calories: Math.round(snap.target_calories),
            protein_g: Math.round(snap.target_protein_g),
            carbs_g: Math.round(snap?.target_carbs_g ?? 250),
            fat_g: Math.round(snap?.target_fat_g ?? 65),
          });
        }
      }

      // Training
      if (trainingRes.status === 'fulfilled') {
        const sessions = trainingRes.value.data.items ?? [];
        updates.workoutsCompleted = sessions.length;
        updates.trainingLogged = sessions.length > 0;
        updates.trainingSessions = sessions;
      }

      // Articles
      if (articlesRes.status === 'fulfilled') {
        updates.articles = articlesRes.value.data.items ?? [];
      }

      // Bodyweight
      if (bwRes.status === 'fulfilled') {
        const logs = bwRes.value.data.items ?? [];
        updates.weightHistory = logs.map((l: any) => ({ date: l.recorded_date, value: l.weight_kg }));
      }

      // Streak
      if (streakRes.status === 'fulfilled' && streakRes.value.data?.current_streak != null) {
        updates.streak = streakRes.value.data.current_streak;
      } else {
        updates.streak = 0;
      }

      // Fire-and-forget: milestone
      if (isAborted(signal)) return;
      try {
        const { data: stdData } = await api.get('training/analytics/strength-standards', { signal });
        updates.milestoneMessage = stdData.milestones?.length > 0 ? stdData.milestones[0].message : null;
      } catch { updates.milestoneMessage = null; }

      // Fire-and-forget: weekly check-in
      if (isAborted(signal)) return;
      try {
        const checkinRes = await api.post('adaptive/weekly-checkin', {}, { signal });
        store.setWeeklyCheckin(checkinRes.data);
      } catch { /* non-critical */ }

      // Fire-and-forget: fatigue
      if (isAborted(signal)) return;
      try {
        const fatigueRes = await api.get('training/fatigue', { signal });
        updates.fatigueSuggestions = fatigueRes.data.suggestions ?? [];
      } catch { updates.fatigueSuggestions = []; }

      // Fire-and-forget: readiness
      if (isAborted(signal)) return;
      try {
        const readinessRes = await api.post('readiness/score', {
          hrv_ms: healthDataRef.current.hrv_ms,
          resting_hr_bpm: healthDataRef.current.resting_hr_bpm,
          sleep_duration_hours: healthDataRef.current.sleep_duration_hours,
        }, { signal });
        updates.readinessScore = readinessRes.data.score;
        updates.readinessFactors = readinessRes.data.factors ?? [];
      } catch {
        updates.readinessScore = null;
        updates.readinessFactors = [];
      }

      // Fire-and-forget: recomp
      if (isAborted(signal)) return;
      try {
        if (store.goals?.goalType === 'recomposition') {
          const recompRes = await api.get('recomp/metrics', { signal });
          updates.recompMetrics = recompRes.data;
        } else {
          updates.recompMetrics = null;
        }
      } catch { updates.recompMetrics = null; }

      // Fire-and-forget: nudges
      if (isAborted(signal)) return;
      try {
        const nudgesRes = await api.get('adaptive/nudges', { signal });
        updates.nudges = nudgesRes.data ?? [];
      } catch { updates.nudges = []; }

      // Fire-and-forget: volume
      if (isAborted(signal)) return;
      try {
        const volRes = await api.get('training/analytics/muscle-volume', { signal });
        const groups = volRes.data.muscle_groups ?? volRes.data ?? [];
        const optimal = groups.filter((g: any) => g.status === 'optimal').length;
        const approachingMrv = groups.filter((g: any) => g.status === 'approaching_mrv').length;
        updates.volumeSummary = groups.length > 0 ? { optimal, approachingMrv, total: groups.length } : null;
      } catch { updates.volumeSummary = null; }

      setData((prev) => ({ ...prev, ...updates }));
    } catch {
      setError('Unable to load dashboard data. Check your connection.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setDateLoading(false);
    }
  }, [selectedDate, store, setAdaptiveTargets]);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setDateLoading(true);
    impact('light');
    if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
    if (dateAbortRef.current) dateAbortRef.current.abort();
    const ac = new AbortController();
    dateAbortRef.current = ac;
    dateDebounceRef.current = setTimeout(() => {
      loadDashboardData(date, ac.signal);
    }, DATE_DEBOUNCE_MS);
  }, [loadDashboardData, setSelectedDate, impact]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData(selectedDate);
    impact('light');
  }, [loadDashboardData, selectedDate, impact]);

  const targets = syncTargets
    ? {
        calories: Math.round(syncTargets.calories),
        protein_g: Math.round(syncTargets.protein_g),
        carbs_g: Math.round(syncTargets.carbs_g),
        fat_g: Math.round(syncTargets.fat_g),
      }
    : store.adaptiveTargets ?? {
        calories: data.calories.target,
        protein_g: data.protein.target,
        carbs_g: data.carbs.target,
        fat_g: 65,
      };

  const consumed = {
    calories: data.calories.value,
    protein_g: data.protein.value,
    carbs_g: data.carbs.value,
    fat_g: data.totalFat,
  };

  return {
    data,
    setData,
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
  };
}
