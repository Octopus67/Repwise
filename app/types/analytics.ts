/**
 * Canonical analytics types — single source of truth.
 *
 * Previously duplicated across:
 *   TrendPoint: filterByTimeRange, AnalyticsScreen, ReadinessTrendChart
 *   VolumeTrendPoint: VolumeTrendChart (was local TrendPoint with week/volume shape)
 *   TimeRange: filterByTimeRange, ExerciseHistoryScreen, AnalyticsScreen, MeasurementTrendChart
 *   MuscleGroupVolume: BodyHeatMap, BodySilhouette, HeatMapCard
 *   FatigueScore: FatigueHeatMapOverlay, FatigueBreakdownModal
 *   Classification: StrengthStandardsCard, StrengthLeaderboard
 */

export interface TrendPoint {
  date: string;
  value: number;
}

export interface VolumeTrendPoint {
  week: string;
  volume: number;
}

export type TimeRange = '7d' | '14d' | '30d' | '90d';

export interface MuscleGroupVolume {
  muscle_group: string;
  effective_sets: number;
  frequency: number;
  volume_status: string;
  mev: number;
  mav: number;
  mrv: number;
  /** WNS fields — present when engine='wns' */
  hypertrophy_units?: number;
  gross_stimulus?: number;
  atrophy_effect?: number;
}

export interface FatigueScore {
  muscle_group: string;
  score: number;
  regression_component: number;
  volume_component: number;
  frequency_component: number;
  nutrition_component: number;
}

export interface Classification {
  exercise_name: string;
  e1rm_kg: number;
  bodyweight_kg: number;
  bodyweight_ratio: number;
  level: string;
  next_level: string | null;
  next_level_threshold_kg: number | null;
}
