# Implementation Plan: Weekly Intelligence Report

## Overview

Build a weekly intelligence report feature that aggregates training, nutrition, and body metrics into a single API response with personalized recommendations, rendered on a new frontend screen with share-to-image capability. No database migrations required — all data is computed from existing tables.

Execution follows the dependency chain: Schemas → Pure functions (MEV, Recommendations) → Service → Router → Frontend screen → Share card → Navigation wiring.

## Tasks

- [ ] 1. Create report module scaffolding and schemas
  - [ ] 1.1 Create `src/modules/reports/__init__.py`, `src/modules/reports/schemas.py`, and `src/modules/reports/mev_reference.py`
    - Define `TrainingMetrics`, `NutritionMetrics`, `BodyMetrics`, `WeeklyReportResponse` Pydantic models in `schemas.py` with all Field constraints (ge=0, le=100, max_length=3)
    - Define `ReportContext` dataclass in `schemas.py` for the recommendation engine input
    - Define `MEV_SETS` dictionary in `mev_reference.py` with per-muscle-group minimum effective volume values
    - Import `PersonalRecord` from `src.modules.training.analytics_schemas` (no circular dependency — analytics_schemas has no back-references)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.6, 3.1, 3.2, 4.1, 5.5, 9.2, 9.3_

  - [ ]* 1.2 Write property test for report serialization round-trip
    - **Property 11: Report serialization round-trip**
    - Use Hypothesis to generate random valid `WeeklyReportResponse` objects, serialize to JSON via `.model_dump_json()`, deserialize via `.model_validate_json()`, assert equality
    - **Validates: Requirements 9.1**

  - [ ]* 1.3 Write property test for schema validation rejects invalid data
    - **Property 12: Schema validation rejects invalid data**
    - Use Hypothesis to generate negative numeric values and oversized recommendation lists, assert `ValidationError` is raised
    - **Validates: Requirements 9.2, 9.3**

- [ ] 2. Implement RecommendationEngine (pure function, no DB)
  - [ ] 2.1 Create `src/modules/reports/recommendations.py`
    - Implement `generate_recommendations(ctx: ReportContext) -> list[str]` as a pure function
    - Implement rule evaluation in priority order: no-data → under-MEV → high compliance → low compliance → weight on track → weight off track → PR celebration → fallback
    - Ensure the function always returns exactly `min(3, max(2, len(matched_rules)))` recommendations, padding with fallback if fewer than 2 match
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 2.2 Write property test for recommendation count invariant
    - **Property 6: Recommendation count invariant**
    - Use Hypothesis to generate random valid `ReportContext` objects, call `generate_recommendations`, assert `2 <= len(result) <= 3`
    - **Validates: Requirements 4.1**

  - [ ]* 2.3 Write property test for under-MEV recommendation generation
    - **Property 7: Under-MEV recommendation generation**
    - Generate `ReportContext` with at least one muscle group below MEV, assert recommendations contain a string with the group name, set count, and MEV value
    - **Validates: Requirements 4.2**

  - [ ]* 2.4 Write property test for compliance-based recommendation correctness
    - **Property 8: Compliance-based recommendation correctness**
    - Generate `ReportContext` with `compliance_pct > 85`, assert positive reinforcement recommendation exists. Generate with `compliance_pct < 60`, assert consistency improvement recommendation exists
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 2.5 Write property test for weight-goal alignment recommendation
    - **Property 9: Weight-goal alignment recommendation**
    - Generate `ReportContext` with non-null `weight_trend` and `goal_type`, assert on-track message when directions match and adjustment message when they oppose
    - **Validates: Requirements 4.5, 4.6**

  - [ ]* 2.6 Write unit tests for recommendation edge cases
    - Test no-data fallback: `days_logged_training=0, days_logged_nutrition=0` produces encouragement recommendations (Requirement 4.7)
    - Test PR celebration: context with PRs produces a PR mention
    - Test maintaining goal with zero weight trend produces on-track message
    - _Requirements: 4.7_

- [ ] 3. Checkpoint — Schemas and RecommendationEngine
  - Ensure all tests from tasks 1.2, 1.3, 2.2–2.6 pass. Zero failures before proceeding. Run: `pytest tests/test_weekly_report_properties.py tests/test_weekly_report_unit.py -v`

- [ ] 4. Implement WeeklyReportService
  - [ ] 4.1 Create `src/modules/reports/service.py`
    - Implement `WeeklyReportService.__init__(self, session: AsyncSession)`
    - Implement `get_weekly_report(self, user_id, year, week) -> WeeklyReportResponse`
    - Implement ISO week to date range conversion: `_iso_week_to_date_range(year, week) -> (date, date)` returning Monday–Sunday
    - Validate the requested week is not in the future; raise `HTTPException(400)` if so
    - Fetch training sessions via `TrainingAnalyticsService._fetch_sessions(user_id, week_start, week_end)` and compute total volume, volume by muscle group, sets by muscle group, and session count directly from raw session data
    - Detect PRs by comparing each exercise's best set weight to historical bests (reuse logic from existing `TrainingService`)
    - Fetch nutrition entries via `NutritionService.get_entries(user_id, DateRangeFilter(week_start, week_end), PaginationParams(limit=500))`
    - Compute avg daily calories, protein, carbs, fat from entries grouped by date
    - Compute compliance percentage: for each logged day, check if `|day_calories - target| / target <= 0.05`
    - Fetch latest 2 adaptive snapshots for TDEE delta computation
    - Fetch bodyweight logs for the week, compute start/end weight and trend
    - Fetch user goal for goal_type and goal_rate_per_week
    - Build `ReportContext` and call `generate_recommendations(ctx)`
    - Assemble and return `WeeklyReportResponse`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 5.3_

  - [ ]* 4.2 Write property test for training metrics aggregation
    - **Property 1: Training metrics aggregation correctness**
    - Generate random training session data (exercises with sets), pass to the training aggregation logic, verify total_volume = sum(reps × weight_kg), volume_by_muscle_group sums to total_volume, session_count = distinct dates
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 4.3 Write property test for nutrition metrics aggregation
    - **Property 2: Nutrition metrics aggregation correctness**
    - Generate random nutrition entries, pass to the nutrition aggregation logic, verify avg_calories = sum(calories) / distinct_dates, same for macros, days_logged = distinct dates
    - **Validates: Requirements 2.1, 2.2, 2.6**

  - [ ]* 4.4 Write property test for compliance percentage
    - **Property 3: Compliance percentage correctness**
    - Generate random daily calorie totals and a target, compute compliance manually, verify service produces the same result
    - **Validates: Requirements 2.3**

  - [ ]* 4.5 Write property test for TDEE delta
    - **Property 4: TDEE delta correctness**
    - Generate two random snapshot target_calories values, verify delta = current - previous. Generate single/zero snapshots, verify delta is null
    - **Validates: Requirements 2.4**

  - [ ]* 4.6 Write property test for body metrics aggregation
    - **Property 5: Body metrics aggregation correctness**
    - Generate 2+ random bodyweight entries sorted by date, verify start_weight = first, end_weight = last, trend = last - first
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 4.7 Write unit tests for service edge cases
    - Test empty training data returns zeroed metrics and empty PR list (Requirement 1.5)
    - Test empty nutrition data returns zeroed metrics and 0% compliance (Requirement 2.5)
    - Test <2 bodyweight entries returns null weight_trend (Requirement 3.3)
    - Test default-to-current-week when year/week omitted (Requirement 5.3)
    - _Requirements: 1.5, 2.5, 3.3, 5.3_

- [ ] 5. Implement Report Router and wire into app
  - [ ] 5.1 Create `src/modules/reports/router.py`
    - Define `router = APIRouter(prefix="/reports", tags=["reports"])`
    - Implement `GET /weekly` endpoint with optional `year: int` and `week: int` query params
    - Use `Depends(get_current_user_id)` for auth and `Depends(get_session)` for DB session (same pattern as existing routers)
    - Default to current ISO week when params omitted
    - Delegate to `WeeklyReportService.get_weekly_report()`
    - Add `track_feature_used(user_id, "weekly_report_viewed")` analytics call
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 5.2 Register router in `src/main.py`
    - Add `from src.modules.reports.router import router as reports_router`
    - Add `app.include_router(reports_router)` alongside existing router registrations
    - _Requirements: 5.1_

  - [ ]* 5.3 Write property test for future week rejection
    - **Property 10: Future week rejection**
    - Generate random future ISO weeks (year, week_number), call the validation logic, assert 400 error
    - **Validates: Requirements 5.4**

  - [ ]* 5.4 Write integration test for API endpoint
    - Test `GET /reports/weekly` with valid week returns 200 with correct schema structure (Requirement 5.2)
    - Test `GET /reports/weekly` without params returns current week (Requirement 5.3)
    - Test `GET /reports/weekly?year=2099&week=1` returns 400 (Requirement 5.4)
    - _Requirements: 5.2, 5.3, 5.4_

- [ ] 6. Checkpoint — Full backend
  - Ensure all backend tests pass: `pytest tests/test_weekly_report_properties.py tests/test_weekly_report_unit.py tests/test_weekly_report_integration.py -v`. Zero failures before proceeding to frontend.

- [ ] 7. Implement WeeklyReportScreen
  - [ ] 7.1 Create `app/screens/reports/WeeklyReportScreen.tsx`
    - Implement screen that fetches `GET /reports/weekly?year={y}&week={w}` on mount
    - Implement week selector with left/right arrow buttons; compute ISO week from selected date; disable forward arrow when at current week
    - Render four sections: Training (total volume, volume by muscle group as horizontal bars, session count, PR list), Nutrition (avg calories vs target, avg macros, compliance %, TDEE delta), Body (start/end weight, weight trend), Recommendations (list of recommendation strings)
    - Implement skeleton loading state using existing `Skeleton` component for each section while data loads
    - Implement empty state per section using existing `EmptyState` component when section data is zero/null
    - Implement loading indicator overlay when switching weeks (same pattern as `DashboardScreen` date loading)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 7.2 Write Jest tests for WeeklyReportScreen
    - Test screen renders all four section headers (Training, Nutrition, Body, Recommendations)
    - Test week selector disables forward navigation at current week
    - Test skeleton placeholders render during loading state
    - Test empty state messages render when section data is null/zero
    - Test week change triggers new API fetch
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.1, 8.2, 8.3, 8.4_

- [ ] 8. Implement ReportCard and share functionality
  - [ ] 8.1 Create `app/components/reports/ReportCard.tsx`
    - Implement a fixed-height `View` wrapped in `react-native-view-shot`'s `ViewShot` ref
    - Display: week label ("Week {n}, {year}"), total volume, session count, compliance %, weight trend, top recommendation
    - Style with app's dark theme tokens; optimize dimensions for social media sharing (1080×1080 or 1080×1350)
    - _Requirements: 7.1, 7.2_

  - [ ] 8.2 Add share and save functionality to WeeklyReportScreen
    - Add share button in screen header
    - On share tap: capture `ViewShot` ref as PNG URI, invoke `Share.share({ url: imageUri })` via React Native's Share API
    - On save tap: capture image, request photo library permission, save via `MediaLibrary.saveToLibraryAsync()` or equivalent
    - Handle errors: show toast on capture failure, show alert on permission denial
    - Add analytics: `track_event(user_id, "report.shared")` on success, `track_event(user_id, "report.share_failed")` on failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.3 Write Jest tests for ReportCard and share flow
    - Test ReportCard renders all key metrics (volume, sessions, compliance, weight trend, recommendation)
    - Test share button triggers capture ref
    - Test error handling shows toast on capture failure
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 9. Wire navigation entry points
  - [ ] 9.1 Register WeeklyReport route in navigation stack
    - Add `WeeklyReport` screen to the app's navigation stack in `app/App.tsx` or the relevant navigator file
    - _Requirements: 6.5_

  - [ ] 9.2 Add entry point in AnalyticsScreen
    - Add a "Weekly Report" link/button in `app/screens/analytics/AnalyticsScreen.tsx`, styled like the existing "Nutrition Report" link
    - Navigate to `WeeklyReport` on press
    - _Requirements: 6.5_

  - [ ] 9.3 Add entry point in DashboardScreen
    - Add a "Weekly Report" card or button in `app/screens/dashboard/DashboardScreen.tsx` in the summary section area
    - Navigate to `WeeklyReport` on press
    - _Requirements: 6.5_

- [ ] 10. Final checkpoint
  - Ensure all tests pass: backend property tests, backend unit tests, backend integration tests, frontend Jest tests. Run `pytest tests/test_weekly_report_*.py -v` and `npx jest --testPathPattern=WeeklyReport --run`. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No database migrations required — all data computed from existing tables
- Rollback is code-only: remove `include_router` from `main.py` and route from navigator to fully disable the feature
- Property tests validate universal correctness; unit tests validate specific examples and edge cases
- `react-native-view-shot` is a new frontend dependency required for the share card feature
- Post-launch: monitor `GET /reports/weekly` P99 latency (alert >2s) and error rate (alert >5%)
