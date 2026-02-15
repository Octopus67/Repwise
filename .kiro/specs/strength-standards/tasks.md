# Implementation Plan: 1RM Estimator and Strength Standards

## Overview

Execution-ready plan ordered by dependency graph. Backend pure functions first (Layer 0), then composition (Layer 1-2), then API (Layer 3), then frontend (Layer 4). Each step builds on previous steps with no orphaned code. Tests are co-located with implementation.

## Tasks

- [x] 1. Implement e1RM calculator pure functions and tests
  - [x] 1.1 Create `src/modules/training/e1rm_calculator.py` with `E1RMResult` dataclass, `compute_e1rm()`, and `best_e1rm_for_exercise()`
    - Implement Epley: `weight_kg × (1 + reps / 30)`
    - Implement Brzycki: `weight_kg × 36 / (37 - reps)` with division-by-zero guard at reps=37 (fallback to Epley)
    - Implement Lombardi: `weight_kg × reps^0.10`
    - Handle edge cases: reps=1 returns weight_kg for all formulas; reps=0 or weight_kg=0 returns all zeros
    - Set `low_confidence=True` when reps > 30, `False` otherwise
    - `primary` field always equals Epley value
    - `best_e1rm_for_exercise` iterates sets, computes e1RM for each, returns the one with highest Epley value; returns None if no valid sets
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x]* 1.2 Write property tests in `tests/test_e1rm_properties.py`
    - **Property 1: e1RM Formula Correctness** — For any weight_kg > 0 and reps in [1, 30], verify Epley, Brzycki, Lombardi formulas and primary == Epley
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.7**
    - **Property 2: Low Confidence Flag** — For any weight_kg > 0, verify low_confidence matches reps > 30
    - **Validates: Requirements 1.6**
    - **Property 3: Best Set Selection Maximality** — For any non-empty list of valid sets, best_e1rm_for_exercise returns the max Epley e1RM
    - **Validates: Requirements 1.8**
    - Use Hypothesis with `@settings(max_examples=100)`
    - Include edge case unit tests: reps=0, reps=1, weight_kg=0, reps=37

- [x] 2. Implement strength standards and classification
  - [x] 2.1 Create `src/modules/training/strength_standards.py` with `StrengthLevel` enum, `STRENGTH_STANDARDS` dict, `StrengthClassification` dataclass, `classify_strength()`, `rank_by_strength()`, `get_supported_lifts()`
    - `classify_strength`: compute ratio = e1rm_kg / bodyweight_kg, find highest level whose threshold is met; raise ValueError for unsupported exercises
    - `rank_by_strength`: sort classifications by bodyweight_ratio descending
    - Thresholds: bench (0.5/1.0/1.5/2.0), squat (0.75/1.25/1.75/2.5), deadlift (1.0/1.5/2.0/3.0), OHP (0.35/0.65/1.0/1.4), row (0.4/0.75/1.1/1.5)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1_

  - [x] 2.2 Create `src/modules/training/milestone_generator.py` with `Milestone` dataclass and `generate_milestones()`
    - For non-elite: deficit_kg = (next_threshold_multiplier × bodyweight_kg) - e1rm_kg; message = "You're {deficit} away from {next_level} {exercise}"
    - For elite: deficit_kg = 0; message = "You've reached Elite {exercise}!"
    - Sort by deficit ascending (smallest first); omit UNKNOWN level classifications
    - Support metric/imperial unit formatting for deficit display
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x]* 2.3 Write property tests in `tests/test_strength_standards_properties.py`
    - **Property 5: Strength Standards Data Completeness** — For any exercise in SUPPORTED_LIFTS, all four levels exist with strictly ascending thresholds
    - **Validates: Requirements 3.1**
    - **Property 6: Strength Classification Correctness** — For any supported exercise, e1rm > 0, bodyweight > 0, returned level's threshold is met and next level's threshold is not
    - **Validates: Requirements 3.2**
    - **Property 7: Milestone Deficit and Message Correctness** — For any non-elite classification, deficit_kg equals expected value and message contains exercise name, next level, and deficit
    - **Validates: Requirements 4.1, 4.2**
    - **Property 8: Milestone Sorting by Deficit** — For any list of milestones, deficit_kg values are non-decreasing
    - **Validates: Requirements 4.5**
    - **Property 9: Leaderboard Sorting by Bodyweight Ratio** — For any list of classifications, rank_by_strength returns non-increasing bodyweight_ratio order
    - **Validates: Requirements 5.1**
    - Use Hypothesis with `@settings(max_examples=100)`
    - Include edge case unit tests: ratio exactly at beginner threshold, exactly at elite threshold, unsupported exercise ValueError

- [x] 3. Checkpoint — Backend pure functions
  - Ensure all tests pass (`pytest tests/test_e1rm_properties.py tests/test_strength_standards_properties.py -v`), ask the user if questions arise.

- [x] 4. Extend analytics service and add API endpoints
  - [x] 4.1 Add new response schemas to `src/modules/training/analytics_schemas.py`
    - Add `E1RMHistoryPoint`, `StrengthClassificationResponse`, `MilestoneResponse`, `StrengthStandardsResponse` Pydantic models
    - _Requirements: 6.1, 6.2_

  - [x] 4.2 Add `get_e1rm_history()` method to `TrainingAnalyticsService` in `src/modules/training/analytics_service.py`
    - Reuse existing `_fetch_sessions()` to get sessions in date range
    - For each session, find all sets for the target exercise, compute e1RM for each, pick the max Epley value
    - Return list of `E1RMHistoryPoint` sorted by date ascending
    - Return empty list if no matching sessions
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.3 Add `get_strength_standards()` method to `TrainingAnalyticsService` in `src/modules/training/analytics_service.py`
    - Fetch latest bodyweight from `bodyweight_logs` for the user
    - If no bodyweight: return `StrengthStandardsResponse(bodyweight_kg=None, classifications=[], milestones=[])`
    - For each supported lift: scan all user sessions (no date filter) to find the best e1RM ever
    - Classify each lift with `classify_strength()`, generate milestones with `generate_milestones()`
    - _Requirements: 3.2, 3.5, 3.6, 4.1, 4.4, 6.2_

  - [x] 4.4 Add API endpoints to `src/modules/training/router.py`
    - `GET /training/analytics/e1rm-history` — params: exercise_name, start_date, end_date; validate start_date <= end_date (return 400 if not); requires auth
    - `GET /training/analytics/strength-standards` — no params; requires auth; returns StrengthStandardsResponse
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 4.5 Write property test in `tests/test_e1rm_history_properties.py`
    - **Property 4: e1RM History Correctness and Ordering** — For any set of training sessions, e1RM history returns one point per session with correct max Epley e1RM, sorted by date ascending
    - **Validates: Requirements 2.1, 2.2**
    - Use Hypothesis with `@settings(max_examples=100)` and `db_session` fixture (same pattern as `test_training_analytics_properties.py`)
    - Include edge case: empty result when exercise not in any session; invalid date range returns 400

- [x] 5. Checkpoint — Backend API complete
  - Ensure all tests pass (`pytest tests/test_e1rm_properties.py tests/test_strength_standards_properties.py tests/test_e1rm_history_properties.py -v`), ask the user if questions arise.

- [x] 6. Implement frontend e1RM calculator and session display
  - [x] 6.1 Create `app/utils/e1rmCalculator.ts` with `computeE1RM(weightKg: number, reps: number): number`
    - Epley formula: `weight × (1 + reps / 30)`; returns weight when reps=1; returns 0 when reps=0 or weight=0
    - Add `bestE1RMForExercise(sets: Array<{weight_kg: number, reps: number}>): number | null` — returns highest e1RM or null if no valid sets
    - _Requirements: 1.1, 1.4, 1.5, 1.8_

  - [ ]* 6.2 Write unit tests in `app/__tests__/utils/e1rmCalculator.test.ts`
    - Test formula correctness for known values (e.g., 100kg × 5 reps = 116.67 Epley)
    - Test edge cases: reps=0, reps=1, weight=0, empty sets array
    - Test bestE1RMForExercise picks the max
    - _Requirements: 1.1, 1.4, 1.5, 1.8_

  - [x] 6.3 Add e1RM display to session detail view
    - In the session detail component, for each exercise, call `bestE1RMForExercise` on its sets
    - Display "Est. 1RM: {value}" next to exercise name, formatted with `formatWeight` from `unitConversion.ts`
    - Only show when e1RM is non-null (at least one valid set)
    - _Requirements: 7.1_

- [x] 7. Implement analytics screen e1RM trend and strength standards
  - [x] 7.1 Add e1RM trend chart section to `app/screens/analytics/AnalyticsScreen.tsx`
    - Add state for `e1rmTrend` data and `selectedE1RMExercise`
    - Add exercise selector pills (same pattern as existing strength progression section)
    - Call `GET /training/analytics/e1rm-history` with selected exercise and time range
    - Render with existing `TrendLineChart`, suffix from unit system
    - Place after the existing Strength Progression section
    - _Requirements: 2.4, 2.5, 7.2_

  - [x] 7.2 Create `app/components/analytics/StrengthStandardsCard.tsx`
    - Fetch data from `GET /training/analytics/strength-standards`
    - For each classification: show exercise name, level badge (color-coded), bodyweight ratio, progress bar from current level to next level
    - When `bodyweight_kg` is null: show "Log your bodyweight to see strength standards" with icon
    - When no e1RM data for a lift: show "No data" in muted text
    - _Requirements: 3.2, 3.5, 3.6, 7.3, 7.5_

  - [x] 7.3 Create `app/components/analytics/StrengthLeaderboard.tsx`
    - Accept classifications array as prop
    - Sort by bodyweight_ratio descending (lifts with data first, "No data" lifts at bottom)
    - Highlight top lift (strongest) with accent color, bottom lift with data (weakest) with warning color
    - Show exercise name, e1RM, ratio, level for each row
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 7.4 Integrate StrengthStandardsCard and StrengthLeaderboard into AnalyticsScreen
    - Add "Strength Standards" section title and StrengthStandardsCard after e1RM trend chart
    - Add "Strength Leaderboard" section title and StrengthLeaderboard after standards card
    - Pass classifications data from standards card to leaderboard
    - _Requirements: 7.2, 7.3_

- [x] 8. Add milestone banner to dashboard
  - [x] 8.1 Add milestone banner to `app/screens/dashboard/DashboardScreen.tsx`
    - Fetch strength standards data on mount (same endpoint as analytics)
    - Display first milestone message (closest to next level) in a compact Card
    - Show exercise icon, milestone message text, and a chevron to navigate to analytics
    - Hide banner when no milestones available (no bodyweight or all elite)
    - _Requirements: 4.1, 4.2, 4.3, 7.4_

- [x] 9. Final checkpoint — Full feature verification
  - Ensure all backend tests pass: `pytest tests/test_e1rm_properties.py tests/test_strength_standards_properties.py tests/test_e1rm_history_properties.py -v`
  - Ensure all frontend tests pass: `npx jest app/__tests__/utils/e1rmCalculator.test.ts`
  - Verify no TypeScript errors in new/modified frontend files
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No database migrations needed — all data derived from existing tables
- Backend pure functions (steps 1-2) have zero dependencies on DB and can be tested in isolation
- Frontend e1RM calculator (step 6.1) mirrors backend Epley formula — keep in sync
- Rollback: revert new files + additions to analytics_service.py, router.py, AnalyticsScreen.tsx, DashboardScreen.tsx
- Post-launch monitoring: track p95 latency on new endpoints, alert on > 500ms for e1rm-history, > 800ms for strength-standards
