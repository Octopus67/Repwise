# Implementation Plan: Nutrition-Training Sync Engine

## Overview

Build the sync engine as a pure computation module + service layer + API endpoints + frontend integration. The implementation follows the existing pattern: pure functions in `sync_engine.py`, async service in `sync_service.py`, FastAPI routes in `router.py`, and React Native component updates.

## Tasks

- [ ] 1. Add TrainingPhase enum and sync engine data structures
  - [x] 1.1 Add `TrainingPhase` enum to `src/shared/types.py`
    - Add `ACCUMULATION`, `INTENSIFICATION`, `DELOAD`, `NONE` values
    - _Requirements: 4.1_
  - [x] 1.2 Create `src/modules/adaptive/sync_engine.py` with data classes and constants
    - Define `SessionExercise`, `DailyTargetInput`, `DailyTargetOutput` frozen dataclasses
    - Define constants: `DEFAULT_TRAINING_SURPLUS_PCT = 0.15`, `DEFAULT_REST_MODIFIER_PCT = -0.05`, `VOLUME_MULTIPLIER_MIN = 0.7`, `VOLUME_MULTIPLIER_MAX = 1.5`, `MIN_FAT_G = 20.0`, `PHASE_ACCUMULATION_BONUS = 0.05`
    - Define muscle group demand weights dict and compound bonus cap
    - _Requirements: 1.4, 1.5, 2.1, 3.5, 4.1_

- [x] 2. Implement pure computation functions in sync_engine.py
  - [x] 2.1 Implement `compute_muscle_group_demand(exercises: list[SessionExercise]) -> float`
    - Sum per-group weights for each unique muscle group in the session
    - Add compound bonus (0.03 per compound exercise, capped at 0.15)
    - Clamp result to [0.0, 1.0]
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Implement `compute_volume_multiplier(session_volume: float, rolling_avg_volume: float) -> float`
    - Return 1.0 if either value is 0
    - Compute ratio and clamp to [0.7, 1.5]
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - [x] 2.3 Implement `compute_session_volume(exercises: list[SessionExercise]) -> float`
    - Sum total_volume across all exercises
    - _Requirements: 3.1_
  - [x] 2.4 Implement `compute_daily_targets(input: DailyTargetInput) -> DailyTargetOutput`
    - Orchestrate all steps: classification, demand score, volume multiplier, calorie adjustment, phase modifier, macro distribution, explanation string
    - Enforce protein >= baseline, carbs >= 50g, fat >= 20g floors
    - _Requirements: 1.4, 1.5, 2.4, 2.5, 3.1, 4.2, 4.3, 4.4_
  - [ ]* 2.5 Write property tests for sync engine pure functions
    - **Property 1: Day classification correctness** — _Validates: Requirements 1.1, 1.2, 1.3_
    - **Property 2: Training day increases calories, rest day decreases** — _Validates: Requirements 1.4, 1.5_
    - **Property 3: Leg sessions have higher demand than upper-body isolation** — _Validates: Requirements 2.2_
    - **Property 4: Adding compound exercises never decreases demand** — _Validates: Requirements 2.3_
    - **Property 5: Higher demand produces higher carb proportion** — _Validates: Requirements 2.4_
    - **Property 6: Protein never drops below baseline** — _Validates: Requirements 2.5_
    - **Property 7: Session volume computation correctness** — _Validates: Requirements 3.1_
    - **Property 8: Volume multiplier proportional and clamped** — _Validates: Requirements 3.2, 3.3, 3.4, 3.5_
    - **Property 9: Phase modifier correctness** — _Validates: Requirements 4.2, 4.3, 4.4_
  - [ ]* 2.6 Write unit tests for sync engine edge cases
    - Test: empty exercise list returns rest-day-like output
    - Test: all-compound session hits compound bonus cap
    - Test: zero rolling average volume returns multiplier 1.0
    - Test: deload phase zeroes out surplus
    - Test: carbs and fat floor enforcement
    - _Requirements: 2.1, 3.2, 4.3_

- [x] 3. Checkpoint — Ensure all sync engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create data model and schemas for daily target overrides
  - [x] 4.1 Create `DailyTargetOverride` SQLAlchemy model in `src/modules/adaptive/models.py`
    - Add table `daily_target_overrides` with user_id, target_date, calories, protein_g, carbs_g, fat_g
    - Add unique index on (user_id, target_date)
    - _Requirements: 5.4_
  - [x] 4.2 Add Pydantic schemas to `src/modules/adaptive/schemas.py`
    - Add `DailyTargetResponse`, `OverrideCreate`, `OverrideResponse` schemas
    - DailyTargetResponse includes: date, day_classification, classification_reason, baseline, adjusted, override, effective, muscle_group_demand, volume_multiplier, training_phase, calorie_delta, explanation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.1_
  - [ ]* 4.3 Write property test for JSON serialization round-trip
    - **Property 11: JSON serialization round-trip** — _Validates: Requirements 8.1, 8.2_

- [x] 5. Implement sync engine service layer
  - [x] 5.1 Create `src/modules/adaptive/sync_service.py` with `SyncEngineService` class
    - Implement `get_daily_targets(user_id, target_date)`: fetch latest snapshot, training sessions, scheduled templates, rolling avg volume, override; build DailyTargetInput; call compute_daily_targets; assemble response
    - Implement `_classify_day(user_id, target_date)`: check training_sessions table then workout_templates for the date
    - Implement `_get_rolling_avg_volume(user_id, end_date, weeks=4)`: query last 4 weeks of sessions, compute average session volume
    - Implement `_build_session_exercises(exercises_json)`: convert raw JSON exercises to SessionExercise list using exercise_mapping
    - Return error if no adaptive snapshot exists
    - _Requirements: 1.1, 1.2, 1.3, 3.2, 6.1, 6.2, 6.3, 6.5_
  - [x] 5.2 Implement override methods in `SyncEngineService`
    - `set_override(user_id, target_date, data)`: upsert into daily_target_overrides
    - `remove_override(user_id, target_date)`: delete from daily_target_overrides
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 5.3 Write property test for override round-trip
    - **Property 10: Override round-trip** — _Validates: Requirements 5.1, 5.3_
  - [ ]* 5.4 Write unit tests for service layer
    - Test: missing snapshot returns appropriate error
    - Test: override values appear in response alongside computed values
    - Test: removing override reverts to computed targets
    - _Requirements: 5.2, 6.4, 6.5_

- [x] 6. Add API endpoints
  - [x] 6.1 Add daily targets endpoints to `src/modules/adaptive/router.py`
    - `GET /adaptive/daily-targets?date={date}&training_phase={phase}` — returns DailyTargetResponse
    - `POST /adaptive/daily-targets/override` — sets override for a date
    - `DELETE /adaptive/daily-targets/override?date={date}` — removes override
    - All endpoints require JWT authentication via `get_current_user`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 5.1, 5.3_
  - [ ]* 6.2 Write unit tests for API endpoints
    - Test: GET returns 200 with correct response shape
    - Test: GET returns 400 when no snapshot exists
    - Test: POST override returns 201
    - Test: DELETE override returns 204
    - _Requirements: 6.1, 6.5_

- [x] 7. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend: Create DayIndicator component and hook
  - [x] 8.1 Create `app/hooks/useDailyTargets.ts` custom hook
    - Fetch `GET /adaptive/daily-targets?date={selectedDate}` on date change
    - Return: effectiveTargets, dayClassification, explanation, isOverride, isLoading, error
    - _Requirements: 6.1, 7.1_
  - [x] 8.2 Create `app/components/dashboard/DayIndicator.tsx`
    - Display pill/badge with "Training Day" or "Rest Day" label
    - Show explanation text (e.g., "Leg day · +180 kcal · Volume 1.2×")
    - Show override indicator icon when User_Override is active
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 9. Frontend: Integrate adjusted targets into DashboardScreen
  - [x] 9.1 Update `app/screens/dashboard/DashboardScreen.tsx`
    - Use `useDailyTargets` hook to fetch adjusted targets for selectedDate
    - Pass `effectiveTargets` to BudgetBar and MacroRingsRow instead of raw adaptive snapshot targets
    - Render DayIndicator component between DateScroller and MacroRingsRow
    - Fall back to adaptive snapshot targets if daily-targets endpoint fails
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 9.2 Write frontend tests
    - Test: DayIndicator renders "Training Day" when classification is training_day
    - Test: DayIndicator renders "Rest Day" when classification is rest_day
    - Test: DayIndicator shows override marker when override is active
    - _Requirements: 7.1, 7.5_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The pure computation module (`sync_engine.py`) has zero database dependencies and can be tested in isolation
- Property tests validate universal correctness; unit tests cover specific edge cases and error conditions
- The frontend changes are minimal — BudgetBar and MacroRingsRow already accept target props, only the data source changes
- Training phase is passed as a query parameter for now; it will be auto-detected when the periodization calendar feature ships
