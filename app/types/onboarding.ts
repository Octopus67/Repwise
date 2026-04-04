/**
 * Canonical onboarding-related types — single source of truth.
 *
 * Backend enum values live in src/shared/types.py.
 * All frontend files MUST import from here instead of defining local copies.
 */

// ─── Backend-canonical enums (match src/shared/types.py exactly) ─────────────

/** Goal types accepted by the backend API. */
export type GoalType = 'cutting' | 'maintaining' | 'bulking' | 'recomposition';

/** Activity levels accepted by the backend API. */
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

/** Biological sex accepted by the backend API. */
export type Sex = 'male' | 'female' | 'other';

// ─── Onboarding-wizard enums (richer set for UX, mapped to backend on submit) ─

/** Goal types shown during onboarding — mapped to GoalType before API calls. */
export type OnboardingGoalType = 'lose_fat' | 'build_muscle' | 'maintain' | 'eat_healthier' | 'recomposition';

/** Activity levels shown during onboarding — mapped to ActivityLevel before API calls. */
export type OnboardingActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active' | 'very_highly_active';

/** Sex options shown during onboarding (includes 'other' for BMR averaging). */
export type OnboardingSex = 'male' | 'female' | 'other';

/** Diet style — same values in backend and frontend. */
export type DietStyle = 'balanced' | 'high_protein' | 'low_carb' | 'keto';

/** Exercise types — same values in backend and frontend. */
export type ExerciseType = 'strength' | 'cardio' | 'sports' | 'yoga' | 'walking';

// ─── Mapping helpers ─────────────────────────────────────────────────────────

const GOAL_TYPE_MAP: Record<OnboardingGoalType, GoalType> = {
  lose_fat: 'cutting',
  build_muscle: 'bulking',
  maintain: 'maintaining',
  eat_healthier: 'maintaining',
  recomposition: 'recomposition',
};

const ACTIVITY_LEVEL_MAP: Record<OnboardingActivityLevel, ActivityLevel> = {
  sedentary: 'sedentary',
  lightly_active: 'light',
  moderately_active: 'moderate',
  highly_active: 'active',
  very_highly_active: 'very_active',
};

export function mapGoalTypeToBackend(frontend: OnboardingGoalType): GoalType {
  return GOAL_TYPE_MAP[frontend] ?? 'maintaining';
}

export function mapActivityLevelToBackend(frontend: OnboardingActivityLevel): ActivityLevel {
  return ACTIVITY_LEVEL_MAP[frontend] ?? 'moderate';
}
