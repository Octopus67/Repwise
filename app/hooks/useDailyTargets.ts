import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface DailyTargetsData {
  date: string;
  day_classification: string;
  classification_reason: string;
  baseline: MacroTargets;
  adjusted: MacroTargets;
  override: MacroTargets | null;
  effective: MacroTargets;
  muscle_group_demand: number;
  volume_multiplier: number;
  training_phase: string;
  calorie_delta: number;
  explanation: string;
}

interface UseDailyTargetsResult {
  data: DailyTargetsData | null;
  effectiveTargets: MacroTargets | null;
  dayClassification: string | null;
  explanation: string | null;
  isOverride: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDailyTargets(selectedDate: string): UseDailyTargetsResult {
  const [data, setData] = useState<DailyTargetsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTargets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('adaptive/daily-targets', {
        params: { date: selectedDate },
      });
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to load daily targets');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  return {
    data,
    effectiveTargets: data?.effective ?? null,
    dayClassification: data?.day_classification ?? null,
    explanation: data?.explanation ?? null,
    isOverride: data?.override != null,
    isLoading,
    error,
    refetch: fetchTargets,
  };
}
