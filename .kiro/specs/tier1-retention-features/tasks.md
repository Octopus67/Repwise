# Implementation Plan: Tier 1 Retention Features

## Overview

Implementation follows a backend-first approach: new backend endpoints first, then frontend screens and modal enhancements, then integration wiring. The existing backend modules (adaptive, food_database, meals, training, user) are leveraged heavily — most work is frontend and a new onboarding orchestration endpoint.

## Tasks

- [x] 1. Create backend onboarding module
  - [x] 1.1 Create `src/modules/onboarding/schemas.py` with `OnboardingCompleteRequest` and `OnboardingCompleteResponse` Pydantic models
    - `OnboardingCompleteRequest`: goal_type, height_cm, weight_kg, body_fat_pct (optional), age_years, sex, activity_level, goal_rate_per_week, display_name (optional)
    - `OnboardingCompleteResponse`: profile (UserProfileResponse), goals (UserGoalResponse), snapshot (SnapshotResponse)
    - Use same validation constraints as existing UserMetricCreate and UserGoalSet schemas
    - _Requirements: 9.1, 9.6_

  - [x] 1.2 Create `src/modules/onboarding/service.py` with `OnboardingService`
    - Implement `complete_onboarding(user_id, data)` method
    - Step 1: Check if user already has UserGoal → raise 409 ConflictError if so
    - Step 2: Create/update UserProfile with display_name
    - Step 3: Persist UserMetric snapshot (height, weight, body_fat, activity_level)
    - Step 4: Set UserGoal (goal_type, goal_rate_per_week)
    - Step 5: Build AdaptiveInput with single-entry bodyweight history from submitted weight, invoke `compute_snapshot()` from `src/modules/adaptive/engine.py`
    - Step 6: Persist AdaptiveSnapshot with input_parameters
    - All within caller's DB transaction for atomicity
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 4.4_

  - [x] 1.3 Create `src/modules/onboarding/router.py` with `POST /onboarding/complete` endpoint
    - Wire to OnboardingService, require authenticated user via `get_current_user`
    - Register router in `src/main.py` under prefix `/api/v1/onboarding`
    - _Requirements: 9.1_

  - [x] 1.4 Write property tests for onboarding in `tests/test_onboarding_properties.py`
    - **Property 2: Body stats validation accepts only in-range values**
    - **Validates: Requirements 3.2, 3.3**
    - **Property 3: Onboarding transaction atomicity**
    - **Validates: Requirements 4.4, 9.2, 9.4**
    - **Property 12: Onboarding snapshot reflects submitted body stats**
    - **Validates: Requirements 9.3**
    - **Property 13: Onboarding validation matches existing schema constraints**
    - **Validates: Requirements 9.6**

  - [x] 1.5 Write unit tests for onboarding in `tests/test_onboarding_unit.py`
    - Test happy path: valid input → all 4 records created, correct response shape
    - Test conflict: user with existing goals → 409
    - Test optional body_fat_pct: null value accepted
    - Test invalid inputs: out-of-range height, weight, age → 422
    - _Requirements: 9.1, 9.2, 9.5, 9.6_

- [x] 2. Create backend training templates
  - [x] 2.1 Create `src/modules/training/templates.py` with static workout template definitions
    - Define 6 templates: Push, Pull, Legs, Upper Body, Lower Body, Full Body
    - Each template: id (str), name, description, exercises list (ExerciseEntry-compatible dicts)
    - Add `WorkoutTemplateResponse` schema to `src/modules/training/schemas.py`
    - _Requirements: 8.1, 8.6_

  - [x] 2.2 Add template endpoints to `src/modules/training/router.py`
    - `GET /templates` → returns list of all WorkoutTemplateResponse
    - `GET /templates/{template_id}` → returns single template or 404
    - Add `get_templates()` and `get_template_by_id()` to TrainingService
    - _Requirements: 8.6_

  - [x] 2.3 Write property tests for training templates in `tests/test_training_template_properties.py`
    - **Property 9: Training session payload conforms to ExerciseEntry schema**
    - **Validates: Requirements 7.4**
    - **Property 10: Template loading populates correct exercises**
    - **Validates: Requirements 8.2**

- [x] 3. Checkpoint — Backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create OnboardingScreen frontend
  - [x] 4.1 Create `app/screens/onboarding/OnboardingScreen.tsx` with multi-step wizard
    - Step 1 — Goal Selection: Three large selectable cards (bulking, cutting, maintaining), next button disabled until selection
    - Step 2 — Body Stats: Form inputs for height_cm, weight_kg, body_fat_pct (optional), age, sex picker, activity_level picker
    - Step 3 — Results: Display computed target_calories, protein_g, carbs_g, fat_g with "Get Started" button
    - Progress indicator showing current step (1/3, 2/3, 3/3)
    - "Skip for now" link on each step
    - Client-side validation: height [100,250], weight [30,300], body_fat [3,60], age [13,120]
    - On submit: call `POST /api/v1/onboarding/complete`, display results, confirm to finish
    - Persist current step to AsyncStorage for resume-on-force-close
    - Use dark theme tokens from `app/theme/tokens.ts`
    - _Requirements: 1.1, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

  - [x] 4.2 Update `app/App.tsx` for onboarding detection and routing
    - After auth restore, fetch `GET /api/v1/user/goals`
    - If goals is null → show OnboardingScreen
    - If goals exists → show BottomTabNavigator
    - Add `onComplete` and `onSkip` callbacks
    - Add `onboardingSkipped` and `needsOnboarding` to Zustand store in `app/store/index.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 4.3 Add SetupBanner component to DashboardScreen
    - Create `app/components/common/SetupBanner.tsx` — persistent banner shown when user has no goals
    - Add to top of DashboardScreen when `needsOnboarding` or no goals detected
    - Tapping banner navigates to OnboardingScreen
    - _Requirements: 1.6_

- [x] 5. Enhance AddNutritionModal with food search and favorites
  - [x] 5.1 Add food search functionality to `app/components/modals/AddNutritionModal.tsx`
    - Add search input at top of modal
    - Debounce search queries at 300ms, minimum 2 characters
    - Query `GET /api/v1/food/search?q=<query>` and display results (name, calories, protein per serving)
    - On item select: auto-fill calories, protein_g, carbs_g, fat_g from item's per-serving values
    - Add Serving_Multiplier input (default 1.0, validated > 0 and ≤ 20)
    - Recalculate macros on multiplier change: base_value × multiplier
    - Clear search → hide results, allow manual entry
    - Handle API errors gracefully with error message, fallback to manual entry
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 5.2 Add favorites section to `app/components/modals/AddNutritionModal.tsx`
    - Fetch favorites on modal open: `GET /api/v1/meals/favorites?limit=50`
    - Display horizontal scrollable list of favorites (name, calories)
    - Tap favorite → auto-fill all macro fields from stored snapshot
    - Long-press favorite → confirm dialog → `DELETE /api/v1/meals/favorites/{id}`
    - After successful nutrition log, show "Save as Favorite" button
    - On save: `POST /api/v1/meals/favorites` with nutritional snapshot
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.3 Write property tests for serving multiplier scaling
    - **Property 5: Serving multiplier scales macros linearly**
    - **Validates: Requirements 5.5**
    - Implement as a pure function test (no UI): `scaleMacros(foodItem, multiplier)` returns correct values
    - Test in `tests/test_onboarding_properties.py` or a new `tests/test_nutrition_scaling_properties.py`

- [x] 6. Enhance AddTrainingModal with multi-exercise and templates
  - [x] 6.1 Rewrite `app/components/modals/AddTrainingModal.tsx` for multi-exercise support
    - Replace single-exercise form with dynamic exercise list
    - Each exercise: name input + expandable set list (reps, weight_kg, optional RPE)
    - "Add Exercise" button appends new empty exercise
    - "Add Set" button on each exercise appends new set row, pre-filled from previous set values
    - Swipe-to-delete or remove button on exercises
    - Client-side validation: at least 1 exercise, each exercise needs name + at least 1 set
    - On submit: build `TrainingSessionCreate` payload with all exercises, `POST /api/v1/training/sessions`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 6.2 Add template picker and copy-last-workout to training modal
    - Fetch templates on modal open: `GET /api/v1/training/templates`
    - Display collapsible template picker section with template cards (name, description)
    - On template select: populate exercise list with template's exercises and default sets
    - "Copy Last Workout" button: fetch `GET /api/v1/training/sessions?limit=1`, populate exercise list
    - All loaded exercises/sets are editable before submission
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 7. Checkpoint — Full integration test
  - Ensure all tests pass, ask the user if questions arise.
  - Verify onboarding flow end-to-end: register → onboarding → dashboard with targets
  - Verify nutrition modal: search → select → adjust serving → log → save favorite → reuse favorite
  - Verify training modal: select template → modify exercises → submit session

## Notes

- All tasks including tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The backend modules (food_database, meals, training, user, adaptive) already have full CRUD — no changes needed to existing endpoints
