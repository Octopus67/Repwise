# Implementation Plan: Fatigue Detection and Smart Deload Suggestions

## Overview

Build a fatigue detection pipeline following strict dependency order: pure engine first, then schemas, then service, then router, then frontend. Tests are written immediately after each layer. No step references something that hasn't been built yet.

## Tasks

- [ ] 1. Implement fatigue engine — pure computation functions
  - [ ] 1.1 Create `src/modules/training/fatigue_engine.py` with dataclasses (`SetData`, `SessionExerciseData`, `ExerciseE1RM`, `RegressionSignal`, `FatigueScoreResult`, `DeloadSuggestion`, `FatigueConfig`) and `MRV_SETS_PER_WEEK` dict
    - Implement `compute_e1rm(weight_kg, reps)` using Epley formula: `weight * (1 + reps / 30)`. Return 0 when weight=0 or reps=0.
    - Implement `compute_best_e1rm_per_session(sessions)` — group by exercise name (case-insensitive, stripped), compute best e1RM per session per exercise, return dict keyed by normalized exercise name with values sorted by date.
    - Implement `detect_regressions(e1rm_series, min_consecutive=2)` — for each exercise, walk the sorted e1RM list and find the longest tail of consecutive declines >= min_consecutive. Use `exercise_mapping.get_muscle_group` for muscle group. Compute `decline_pct = (peak - current) / peak * 100`.
    - Implement `compute_nutrition_compliance(total_calories, target_calories)` — return `clamp(total / target, 0, 2.0)`. Return 1.0 if target <= 0.
    - Implement `compute_fatigue_score(muscle_group, regressions, weekly_sets, mrv_sets, weekly_frequency, nutrition_compliance, config)` — compute four normalized components per the formula in design, multiply weighted sum by 100, clamp to [0, 100].
    - Implement `generate_suggestions(scores, regressions, config)` — for each score > threshold, find the worst regression for that muscle group, build message string, return `DeloadSuggestion`.
    - Implement `get_fatigue_color(score)` — return green hex for 0-30, yellow for 31-60, red for 61-100.
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 6.2_

  - [ ]* 1.2 Write property-based tests in `tests/test_fatigue_properties.py`
    - Create Hypothesis strategies for `SetData` (reps 0-30, weight 0-300), `SessionExerciseData`, `ExerciseE1RM`, `FatigueConfig` (weights 0-1, threshold 0-100), `FatigueScoreResult`
    - **Property 1: e1RM Epley formula correctness** — for any weight>0 and reps>0, result equals weight*(1+reps/30); for weight=0 or reps=0, result is 0
    - **Validates: Requirements 1.1**
    - **Property 2: Regression detection from declining e1RM series** — generate random e1RM series, verify regressions are detected iff 2+ consecutive declines exist
    - **Validates: Requirements 1.2**
    - **Property 3: Fatigue score equals weighted sum** — verify score matches the formula for any valid inputs
    - **Validates: Requirements 2.1**
    - **Property 4: Fatigue score clamped to [0, 100]** — for any inputs including extreme config weights, score is in [0, 100]
    - **Validates: Requirements 2.2**
    - **Property 5: Nutrition component behavior** — None->0, >=0.8->0, <0.8->positive
    - **Validates: Requirements 2.3, 2.4**
    - **Property 6: Suggestion threshold property** — suggestions generated iff score > threshold
    - **Validates: Requirements 3.1**
    - **Property 7: Suggestion completeness** — every suggestion has all required non-empty fields
    - **Validates: Requirements 3.2**
    - **Property 8: Schema serialization round-trip** — serialize/deserialize FatigueAnalysisResponse produces equivalent object
    - **Validates: Requirements 4.3**
    - **Property 9: Fatigue color band mapping** — score 0-30 green, 31-60 yellow, 61-100 red
    - **Validates: Requirements 6.2**

  - [ ]* 1.3 Write unit tests in `tests/test_fatigue_unit.py`
    - Test `compute_e1rm(100, 10)` == 133.33, `compute_e1rm(0, 10)` == 0, `compute_e1rm(100, 0)` == 0
    - Test `compute_best_e1rm_per_session([])` returns empty dict
    - Test `detect_regressions` with single session returns no regression
    - Test `detect_regressions` with 3 declining sessions returns regression with correct consecutive_declines=2 and decline_pct
    - Test `compute_nutrition_compliance(0, 0)` returns 1.0 (division guard)
    - Test `compute_fatigue_score` with nutrition_compliance=None -> nutrition_component=0
    - Test `compute_fatigue_score` with nutrition_compliance=0.8 -> nutrition_component=0
    - Test `compute_fatigue_score` with mrv_sets=0 -> volume_component=0
    - Test `generate_suggestions` with all scores below threshold returns empty list
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.3_

- [ ] 2. Checkpoint A — Verify engine correctness
  - Ensure all tests pass: `pytest tests/test_fatigue_properties.py tests/test_fatigue_unit.py -v`. Ask the user if questions arise.

- [ ] 3. Implement backend API layer
  - [ ] 3.1 Create `src/modules/training/fatigue_schemas.py` with Pydantic models
    - `FatigueScoreResponse` with fields: muscle_group (str), score (float, ge=0, le=100), regression_component, volume_component, frequency_component, nutrition_component (all float, ge=0)
    - `DeloadSuggestionResponse` with fields: muscle_group (str), fatigue_score (float, ge=0, le=100), top_regressed_exercise (str), decline_pct (float, ge=0), decline_sessions (int, ge=2), message (str)
    - `FatigueAnalysisResponse` with fields: scores (list[FatigueScoreResponse]), suggestions (list[DeloadSuggestionResponse]), lookback_days (int, ge=7, le=90), analyzed_at (datetime)
    - _Requirements: 4.1, 4.3_

  - [ ] 3.2 Create `src/modules/training/fatigue_service.py` with `FatigueService` class
    - Constructor takes `AsyncSession`
    - `analyze_fatigue(user_id, lookback_days=28)` method:
      - Query `TrainingSession` for user_id, session_date in [today - lookback_days, today], using `TrainingSession.not_deleted()`
      - Flatten each session's `exercises` JSONB into `SessionExerciseData` list
      - Call `compute_best_e1rm_per_session`, `detect_regressions`
      - Compute weekly set counts per muscle group (count all sets in the lookback window, group by `get_muscle_group`)
      - Compute weekly frequency per muscle group (count distinct session dates per muscle group, divide by weeks in window)
      - Query `NutritionEntry` for user_id in same date range, sum calories
      - Query latest `AdaptiveSnapshot` for user_id, get `target_calories`
      - Call `compute_nutrition_compliance`, then `compute_fatigue_score` per muscle group, then `generate_suggestions`
      - Return `FatigueAnalysisResponse`
    - _Requirements: 1.4, 4.1, 4.2_

  - [ ] 3.3 Create `src/modules/training/fatigue_router.py` with FastAPI router
    - `GET /training/fatigue` endpoint with `lookback_days` query param (default=28, ge=7, le=90)
    - Depends on `get_current_user_id` and `get_session` (existing auth/DB dependencies)
    - Instantiate `FatigueService`, call `analyze_fatigue`, return response
    - _Requirements: 4.1, 3.4_

  - [ ] 3.4 Wire fatigue router into `src/main.py`
    - Import `fatigue_router` from `src.modules.training.fatigue_router`
    - Add `app.include_router(fatigue_router.router)` alongside existing training router registration
    - _Requirements: 4.1_

  - [ ]* 3.5 Write integration tests in `tests/test_fatigue_integration.py`
    - Test happy path: seed DB with 4 training sessions (2 with declining bench press e1RM), nutrition entries, and an adaptive snapshot. Call `FatigueService.analyze_fatigue`. Verify response has scores for chest muscle group, regression detected, suggestion generated.
    - Test deleted sessions excluded: seed a deleted session, verify it doesn't affect scores.
    - Test no training data: call with user who has no sessions, verify empty scores and suggestions.
    - Test no nutrition data: call with user who has sessions but no nutrition entries, verify nutrition_component=0 for all groups.
    - Test router 422: call endpoint with lookback_days=3, verify 422 response.
    - Test router 401: call endpoint without auth token, verify 401 response.
    - _Requirements: 1.4, 3.4, 4.1, 4.2, 4.3_

- [ ] 4. Checkpoint B — Verify backend end-to-end
  - Ensure all tests pass: `pytest tests/test_fatigue_properties.py tests/test_fatigue_unit.py tests/test_fatigue_integration.py -v`. Ask the user if questions arise.

- [ ] 5. Implement frontend fatigue utilities and dashboard integration
  - [ ] 5.1 Create `app/utils/fatigueColorMapping.ts`
    - Export `getFatigueColor(score: number): string` — returns '#4CAF50' for 0-30, '#FFC107' for 31-60, '#F44336' for 61-100
    - Export `getFatigueLabel(score: number): string` — returns 'Low', 'Moderate', or 'High'
    - _Requirements: 6.2_

  - [ ]* 5.2 Write frontend tests for color mapping in `app/__tests__/utils/fatigueColorMapping.test.ts`
    - Test boundary values: 0, 30, 31, 60, 61, 100
    - Test label mapping matches color bands
    - _Requirements: 6.2_

  - [ ] 5.3 Create `app/components/dashboard/FatigueAlertCard.tsx`
    - Props: `suggestions: DeloadSuggestionResponse[]`, `onPress: () => void`
    - If suggestions is empty, return null (don't render)
    - Sort suggestions by fatigue_score descending, display the top one
    - Show muscle group name, decline percentage, suggestion message
    - Use warning color scheme (yellow/red based on score via `getFatigueColor`)
    - Wrap in TouchableOpacity that calls onPress (navigates to analytics)
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 5.4 Write frontend tests for FatigueAlertCard in `app/__tests__/components/FatigueAlertCard.test.ts`
    - Test renders with one suggestion: card visible, shows muscle group and message
    - Test renders with empty suggestions: returns null
    - Test onPress callback fires when tapped
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 5.5 Wire FatigueAlertCard into DashboardScreen.tsx
    - Add fatigue state: `const [fatigueSuggestions, setFatigueSuggestions] = useState([])`
    - In `loadDashboardData`, add `api.get('training/fatigue')` to the `Promise.allSettled` call. On success, set suggestions from `response.data.suggestions`. On failure, silently degrade (empty array).
    - Render `<FatigueAlertCard suggestions={fatigueSuggestions} onPress={() => navigation.navigate('Analytics')} />` after the WeeklyCheckinCard section.
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6. Implement analytics fatigue integration
  - [ ] 6.1 Create `app/components/analytics/FatigueBreakdownModal.tsx`
    - Props: `visible: boolean`, `score: FatigueScoreResponse | null`, `onClose: () => void`
    - Display four horizontal bars for regression, volume, frequency, nutrition components
    - Show overall score with color from `getFatigueColor`
    - _Requirements: 6.3_

  - [ ] 6.2 Create `app/components/analytics/FatigueHeatMapOverlay.tsx`
    - Props: `scores: FatigueScoreResponse[]`, `onMuscleGroupPress: (muscleGroup: string) => void`
    - Render a list/grid of muscle groups, each colored by `getFatigueColor(score)`
    - Show score number and label on each muscle group
    - Tapping a muscle group calls `onMuscleGroupPress` with the muscle group name
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 6.3 Wire fatigue data into AnalyticsScreen.tsx
    - Add fatigue state: `const [fatigueScores, setFatigueScores] = useState([])`
    - Add breakdown modal state: `const [selectedFatigueGroup, setSelectedFatigueGroup] = useState(null)`
    - In `loadAnalytics`, add `api.get('training/fatigue')` call. On success, set scores. On failure, silently degrade.
    - Add "Muscle Fatigue" section after Training Volume section with `<FatigueHeatMapOverlay>` component
    - Add `<FatigueBreakdownModal>` that opens when a muscle group is tapped
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 7. Final checkpoint — Full regression
  - Ensure all backend tests pass: `pytest -v`
  - Ensure all frontend tests pass: `npx jest`
  - Ask the user if questions arise.
