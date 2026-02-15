# Implementation Plan: Training Day Rest Day Dashboard Indicator

## Overview

Strict sequential build order. Each step consumes only outputs from prior steps. No improvisation needed — every file path, function name, and test command is specified. Tests gate each phase before proceeding.

## Tasks

- [x] 1. Backend schema and pure extraction helper
  - [x] 1.1 Add `DayClassificationResponse` schema to `src/modules/training/schemas.py`
    - Add Pydantic model with fields: `is_training_day: bool`, `classification: str`, `muscle_groups: list[str]`, `source: str`
    - Place it after the existing `UserWorkoutTemplateResponse` class
    - _Requirements: 3.1_
    - _Risk: None — additive change to existing file_
  - [x] 1.2 Create `src/modules/training/day_classification.py` with pure helper and async service function
    - Create `_extract_muscle_groups(exercises_jsonb: list[list[dict]]) -> list[str]` — flattens exercise lists, calls `get_muscle_group()` for each, deduplicates, sorts alphabetically
    - Create `async def classify_day(db: AsyncSession, user_id: uuid.UUID, target_date: date) -> DayClassificationResponse` — implements the 3-step priority logic: check sessions → check templates with `scheduled_days` → default rest day
    - Import `get_muscle_group` from `exercise_mapping.py`, `TrainingSession` and `WorkoutTemplate` from `models.py`, `DayClassificationResponse` from `schemas.py`
    - Validate `scheduled_days` is a list of ints 0-6; skip malformed entries
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3_
    - _Risk: Route to `WorkoutTemplate.not_deleted()` — verify this mixin method exists on WorkoutTemplate (it does via SoftDeleteMixin)_

- [x] 2. Backend tests for service layer
  - [x]* 2.1 Write property tests in `tests/test_day_classification_properties.py`
    - **Property 5: Muscle group extraction matches mapping** — test `_extract_muscle_groups` with hypothesis-generated exercise lists
    - **Property 6: Muscle groups are deduplicated and sorted** — verify output invariant on random inputs
    - **Property 8: Templates without scheduled_days are ignored** — generate templates with/without the key, verify filtering
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 5.3**
    - Use `hypothesis` with `@settings(max_examples=100)`
    - Tag each test: `Feature: training-day-indicator, Property {N}: {title}`
  - [x]* 2.2 Write property tests requiring DB fixtures in `tests/test_day_classification_properties.py`
    - **Property 1: Session implies training day** — create session via fixture, call `classify_day`, assert training + source=session
    - **Property 2: No session and no template implies rest day** — empty DB for user/date, assert rest day
    - **Property 3: Template schedule implies training day** — create template with matching weekday, no session, assert training + source=template
    - **Property 4: Session takes priority over template** — create both, assert source=session
    - **Property 7: Multiple templates merge muscle groups** — create 2+ templates on same weekday, verify merged groups
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.1, 5.2**
    - Use existing `conftest.py` async DB fixtures
  - [x]* 2.3 Write unit tests for edge cases in `tests/test_day_classification_properties.py`
    - Test `_extract_muscle_groups` with empty exercise list → returns `[]`
    - Test `_extract_muscle_groups` with unknown exercise names → includes "Other"
    - Test `classify_day` with template whose `scheduled_days` contains out-of-range values → skipped gracefully
    - Test `classify_day` with template whose `metadata_` is `None` → skipped gracefully
    - _Requirements: 2.3, 5.3_

- [x] 3. Checkpoint — Backend service tests
  - Run `pytest tests/test_day_classification_properties.py -v`. All tests must pass before proceeding.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend API route
  - [x] 4.1 Add `/day-classification` GET endpoint to `src/modules/training/router.py`
    - Import `classify_day` from `day_classification.py` and `DayClassificationResponse` from `schemas.py`
    - Register route BEFORE `/sessions/{session_id}` to avoid FastAPI path conflict (string "day-classification" would be parsed as UUID)
    - Endpoint: `GET /day-classification?date=YYYY-MM-DD`, requires auth via `get_current_user`, returns `DayClassificationResponse`
    - _Requirements: 3.1, 3.3, 3.4_
    - _Risk: Route ordering — if placed after `{session_id}`, requests will 422. Mitigation: integration test verifies 200 response._
  - [ ]* 4.2 Write integration tests for the endpoint
    - Test `GET /training/day-classification?date=2024-01-15` with a session fixture → 200, `is_training_day=true`, correct muscle groups
    - Test `GET /training/day-classification?date=2024-01-16` with no data → 200, `is_training_day=false`, empty groups
    - Test `GET /training/day-classification?date=invalid` → 422
    - Test `GET /training/day-classification` without auth → 401
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. Checkpoint — Backend fully tested
  - Run `pytest tests/ -k "day_classification" -v`. All tests must pass.
  - Run `pytest tests/ -k "training" --tb=short` to verify no regressions in existing training tests.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend utility and component
  - [x] 6.1 Create `app/utils/dayClassificationLogic.ts`
    - Implement `formatMuscleGroup(raw: string): string` — splits on `_`, title-cases each word, joins with space
    - Implement `formatMuscleGroups(groups: string[]): string[]` — maps `formatMuscleGroup` over the array
    - _Requirements: 2.1, 2.2_
  - [x] 6.2 Create `app/components/dashboard/DayBadge.tsx`
    - Props: `isTrainingDay: boolean`, `muscleGroups: string[]`, `isLoading: boolean`
    - Loading state: render `<Skeleton width={200} height={32} borderRadius={16} />`
    - Training day: accent-colored pill with `<Icon name="dumbbell" />`, "Training Day" text, muscle group chips
    - Rest day: muted pill with `<Icon name="moon" />`, "Rest Day" text
    - Use existing `colors`, `spacing`, `typography`, `radius` from `../../theme/tokens`
    - Use existing `Skeleton` from `../common/Skeleton`
    - Use existing `Icon` from `../common/Icon`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Frontend tests
  - [x]* 7.1 Write tests for utility in `app/__tests__/utils/dayClassificationLogic.test.ts`
    - Test `formatMuscleGroup("quads")` → `"Quads"`
    - Test `formatMuscleGroup("full_body")` → `"Full Body"`
    - Test `formatMuscleGroup("Other")` → `"Other"`
    - Test `formatMuscleGroups(["chest", "back"])` → `["Chest", "Back"]`
    - Test `formatMuscleGroups([])` → `[]`
    - _Requirements: 2.1, 2.2_
  - [x]* 7.2 Write tests for DayBadge in `app/__tests__/components/DayBadge.test.ts`
    - Test renders "Training Day" when `isTrainingDay=true`
    - Test renders "Rest Day" when `isTrainingDay=false`
    - Test renders muscle group tags when `muscleGroups` is non-empty
    - Test renders no muscle group tags when `muscleGroups` is empty
    - Test renders skeleton when `isLoading=true`
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 8. Checkpoint — Frontend component tests
  - Run `npx jest --run app/__tests__/utils/dayClassificationLogic.test.ts app/__tests__/components/DayBadge.test.ts`. All tests must pass before dashboard integration.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Dashboard integration
  - [x] 9.1 Integrate DayBadge into `app/screens/dashboard/DashboardScreen.tsx`
    - Add imports for `DayBadge` and `formatMuscleGroups`
    - Add `dayClassification` state and `dayClassLoading` state
    - Add `dayBadgeAnim` via `useStaggeredEntrance(2, 60)` — shift all subsequent animation indices up by 1 (ringsAnim → 3, budgetAnim → 4, mealSlotAnim → 5, summaryAnim → 6, quickActionsAnim → 7, featuredAnim → 8)
    - Add `api.get('training/day-classification', { params: { date: targetDate } })` to the `Promise.allSettled` array in `loadDashboardData`
    - Process the day classification response; on failure, leave default rest-day state (graceful degradation)
    - Set `dayClassLoading` to true at start and false in finally block of `loadDashboardData`
    - Render `<Animated.View style={dayBadgeAnim}><DayBadge ... /></Animated.View>` between DateScroller and MacroRingsRow sections
    - _Requirements: 4.1, 4.6_
    - _Risk: Staggered entrance index shift could break existing animations. Mitigation: visual QA + existing DashboardScreen test._

- [x] 10. Final checkpoint — Full integration
  - Run `pytest tests/ -k "day_classification" -v` — all backend tests pass
  - Run `npx jest --run app/__tests__/utils/dayClassificationLogic.test.ts app/__tests__/components/DayBadge.test.ts app/__tests__/screens/DashboardScreen.test.tsx` — all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No database migrations needed — uses existing JSONB metadata column
- No new dependencies — uses existing `hypothesis` (Python) and `jest` (TypeScript)
- Route ordering in `router.py` is critical — `/day-classification` must be registered before `/sessions/{session_id}`
- Rollback: fully additive feature, revert by deleting new files and reverting DashboardScreen.tsx edits
