/**
 * WNS (Weekly Net Stimulus) Volume Types
 *
 * Mirrors backend schemas in src/modules/training/volume_schemas.py.
 * When modifying types here, check the backend schema file for drift.
 */

export interface WNSLandmarks {
  mv: number;
  mev: number;
  mav_low: number;
  mav_high: number;
  mrv: number;
}

export interface WNSExerciseContribution {
  exercise_name: string;
  coefficient: number;
  sets_count: number;
  stimulating_reps_total: number;
  contribution_hu: number;
}

export interface WNSMuscleVolume {
  muscle_group: string;
  gross_stimulus: number;
  atrophy_effect: number;
  net_stimulus: number;
  hypertrophy_units: number;
  status: 'below_mev' | 'optimal' | 'approaching_mrv' | 'above_mrv';
  session_count: number;
  frequency: number;
  landmarks: WNSLandmarks;
  exercises: WNSExerciseContribution[];
  trend: Array<{ week: string; volume: number }>;
}

export interface WNSWeeklyResponse {
  week_start: string;
  week_end: string;
  muscle_groups: WNSMuscleVolume[];
  engine: 'wns' | 'legacy';
  landmark_descriptions: Record<string, string>;
}
