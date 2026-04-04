/**
 * Canonical common types — single source of truth.
 *
 * Previously duplicated across:
 *   ValidationResult: customExerciseValidation, editPlanLogic, measurementValidation
 *   DayPlan: PrepSundayFlow, MealPlanScreen
 *   RecoveryFactor: RecoveryInsightCard, useRecoveryScore
 *   Article: LearnScreen, useDashboardData
 */

import type { MealAssignment } from '../utils/mealPrepLogic';

export interface ValidationResult<E extends string = string> {
  valid: boolean;
  errors: Partial<Record<E, string>>;
}

export interface DayPlan {
  day_index: number;
  assignments: MealAssignment[];
  unfilled_slots: string[];
}

export interface RecoveryFactor {
  name: string;
  value: number;
  source: string;
}

export interface Article {
  id: string;
  title: string;
  module_name?: string;
  content_markdown?: string;
  tags?: string[];
  is_premium?: boolean;
  estimated_read_time_min: number;
  published_at?: string;
}
