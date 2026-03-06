import { computeAge } from '../store/onboardingSlice';
import type { OnboardingWizardState } from '../store/onboardingSlice';

export interface OnboardingCompletePayload {
  age_years: number;
  sex: 'male' | 'female';
  weight_kg: number;
  height_cm: number;
  body_fat_pct: number | null;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  exercise_sessions_per_week: number;
  exercise_types: string[];
  goal_type: 'cutting' | 'maintaining' | 'bulking' | 'recomposition';
  goal_rate_per_week: number;
  diet_style: 'balanced' | 'high_protein' | 'low_carb' | 'keto';
  protein_per_kg: number;
  dietary_restrictions: string[];
  allergies: string[];
  cuisine_preferences: string[];
  meal_frequency: number;
}

type FrontendGoalType = 'lose_fat' | 'build_muscle' | 'maintain' | 'eat_healthier' | 'recomposition';
type BackendGoalType = 'cutting' | 'maintaining' | 'bulking' | 'recomposition';
type FrontendActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active' | 'very_highly_active';
type BackendActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export function mapGoalTypeToBackend(frontend: FrontendGoalType): BackendGoalType {
  const map: Record<FrontendGoalType, BackendGoalType> = {
    'lose_fat': 'cutting',
    'build_muscle': 'bulking',
    'maintain': 'maintaining',
    'eat_healthier': 'maintaining',
    'recomposition': 'recomposition',
  };
  return map[frontend] || 'maintaining';
}

export function mapActivityLevelToBackend(frontend: FrontendActivityLevel): BackendActivityLevel {
  const map: Record<FrontendActivityLevel, BackendActivityLevel> = {
    'sedentary': 'sedentary',
    'lightly_active': 'light',
    'moderately_active': 'moderate',
    'highly_active': 'very_active',
    'very_highly_active': 'very_active',
  };
  return map[frontend] || 'moderate';
}

export function buildOnboardingPayload(store: OnboardingWizardState): OnboardingCompletePayload {
  const age_years = computeAge(store.birthYear, store.birthMonth);

  return {
    age_years,
    sex: store.sex,
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
