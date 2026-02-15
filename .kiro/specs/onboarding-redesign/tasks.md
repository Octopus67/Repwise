# Onboarding Redesign — Implementation Tasks

## Phase 1: Calculation Engine + Backend
- [x] 1. Calculation Engine — Pure Functions (`app/utils/onboardingCalculations.ts`)
  - [x] 1.1 computeBMR (Mifflin-St Jeor / Katch-McArdle)
  - [x] 1.2 computeNEAT (activity multipliers)
  - [x] 1.3 computeEAT (exercise energy)
  - [x] 1.4 computeTEF (thermic effect)
  - [x] 1.5 computeTDEEBreakdown (orchestrator)
  - [x] 1.6 computeCalorieBudget (deficit + floor)
  - [x] 1.7 computeMacroSplit (protein-first + diet style)
  - [x] 1.8 estimateBodyFat (BMI-based)
  - [x] 1.9 computeProjectedDate
  - [x] 1.10 getProteinRecommendation
- [x] 2. Calculation Engine Tests (`app/__tests__/utils/onboardingCalculations.test.ts`) — 44 tests
- [x] 3. Backend Schema Extension
  - [x] 3.1 Add optional Food DNA fields to OnboardingCompleteRequest
  - [x] 3.2 Store Food DNA in UserProfile.preferences JSONB
  - [x] 3.3 Verify no migration needed (JSONB extensible)
- [x] 4. Backend Tests for New Schema
  - [x] 4.1 Full new payload test
  - [x] 4.2 Old payload backward compat test
  - [x] 4.3 Partial new fields test
  - [x] 4.4 Preferences persistence test

## Phase 2: Food DNA Personalization
- [x] 5. Food DNA Search Personalization (`src/modules/food_database/service.py`)
  - [x] 5.1 _personalize_results method
  - [x] 5.2 Integrate into search() method
  - [x] 5.3 Load user preferences for personalization
- [x] 6. Food DNA Tests
  - [x] 6.1 Cuisine preference boosting
  - [x] 6.2 No preferences → unchanged ranking
  - [x] 6.3 Allergen demotion

## Phase 3: Wizard UI
- [x] 7. Wizard State Management (`app/store/onboardingSlice.ts`)
- [x] 8. Wizard Container Component (`app/screens/onboarding/OnboardingWizard.tsx`)
- [x] 9. Screen 1 — Intent Selection (`app/screens/onboarding/steps/IntentStep.tsx`)
- [x] 10. Screen 2 — Body Basics (`app/screens/onboarding/steps/BodyBasicsStep.tsx`)
- [x] 11. Screen 3 — Body Composition (`app/screens/onboarding/steps/BodyCompositionStep.tsx`)
- [x] 12. Screen 4 — Lifestyle (`app/screens/onboarding/steps/LifestyleStep.tsx`)
- [x] 13. Screen 5 — TDEE Reveal (`app/screens/onboarding/steps/TDEERevealStep.tsx`)
- [x] 14. Screen 6 — Goal Setting (`app/screens/onboarding/steps/GoalStep.tsx`)
- [x] 15. Screen 7 — Diet Style + Macros (`app/screens/onboarding/steps/DietStyleStep.tsx`)
- [x] 16. Screen 8 — Food DNA (`app/screens/onboarding/steps/FoodDNAStep.tsx`)
- [x] 17. Screen 9 — Summary + Launch (`app/screens/onboarding/steps/SummaryStep.tsx`)
- [x] 18. Fast Track Screen (`app/screens/onboarding/steps/FastTrackStep.tsx`)

## Phase 4: Integration
- [x] 19. Wire Into App.tsx (`app/App.tsx` — OnboardingWizard replaces OnboardingScreen)
- [x] 20. Integration Tests
  - [x] 20.1 Frontend: Wizard navigation (forward, back, skip, resume)
  - [x] 20.2 Frontend: Fast track flow (skip to targets, verify payload)
  - [x] 20.3 Frontend: All optional screens skipped → defaults applied
  - [x] 20.4 Backend: POST with full v2 payload → 201, all fields stored
  - [x] 20.5 Backend: POST with old v1 payload → 201, backward compat
  - [x] 20.6 Backend: Food search with preferences → personalized ranking
