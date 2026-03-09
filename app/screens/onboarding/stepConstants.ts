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
  SMART_TRAINING: 7,
  GOAL: 8,
  DIET_STYLE: 9,
  FOOD_DNA: 10,
  SUMMARY: 11,
} as const;

export type OnboardingStepName = keyof typeof ONBOARDING_STEPS;
export type OnboardingStepIndex = (typeof ONBOARDING_STEPS)[OnboardingStepName];

export const TOTAL_STEPS = Object.keys(ONBOARDING_STEPS).length;
