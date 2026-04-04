import { computeAge } from '../store/onboardingSlice';
import type { OnboardingWizardState } from '../store/onboardingSlice';
import type { GoalType, ActivityLevel, Sex } from '../types/onboarding';
import { mapGoalTypeToBackend, mapActivityLevelToBackend } from '../types/onboarding';

export interface OnboardingCompletePayload {
  age_years: number;
  sex: Sex;
  weight_kg: number;
  height_cm: number;
  body_fat_pct: number | null;
  activity_level: ActivityLevel;
  exercise_sessions_per_week: number;
  exercise_types: string[];
  goal_type: GoalType;
  goal_rate_per_week: number;
  diet_style: 'balanced' | 'high_protein' | 'low_carb' | 'keto';
  protein_per_kg: number;
  dietary_restrictions: string[];
  allergies: string[];
  cuisine_preferences: string[];
  meal_frequency: number;
}

export function buildOnboardingPayload(store: OnboardingWizardState): OnboardingCompletePayload {
  const age_years = computeAge(store.birthYear, store.birthMonth);

  return {
    age_years,
    sex: store.sex ?? 'male',
    weight_kg: store.weightKg,
    height_cm: store.heightCm,
    body_fat_pct: store.bodyFatSkipped ? null : store.bodyFatPct,
    activity_level: mapActivityLevelToBackend(store.activityLevel),
    exercise_sessions_per_week: store.exerciseSessionsPerWeek,
    exercise_types: store.exerciseTypes,
    goal_type: mapGoalTypeToBackend(store.goalType ?? 'maintain'),
    goal_rate_per_week: store.rateKgPerWeek,
    diet_style: store.dietStyle,
    protein_per_kg: store.proteinPerKg,
    dietary_restrictions: store.dietaryRestrictions,
    allergies: store.allergies,
    cuisine_preferences: store.cuisinePreferences,
    meal_frequency: store.mealFrequency,
  };
}
