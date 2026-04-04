/**
 * Onboarding step name → index mapping.
 * Use these constants instead of hardcoded numbers when referencing steps.
 */
export const ONBOARDING_STEPS = {
  INTENT: 1,
  BODY_BASICS: 2,
  BODY_MEASUREMENTS: 3,
  BODY_COMPOSITION: 4,
  LIFESTYLE: 5,
  TDEE_REVEAL: 6,
  GOAL: 7,
  DIET_STYLE: 8,
  FOOD_DNA: 9, // Temporarily skipped for v1 — see OnboardingWizard.tsx
  SUMMARY: 10,
} as const;

export type OnboardingStepName = keyof typeof ONBOARDING_STEPS;
export type OnboardingStepIndex = (typeof ONBOARDING_STEPS)[OnboardingStepName];

export const TOTAL_STEPS = Object.keys(ONBOARDING_STEPS).length;

/** Steps shown to user (excludes skipped FOOD_DNA) */
export const DISPLAY_TOTAL_STEPS = TOTAL_STEPS - 1;
