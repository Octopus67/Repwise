# Implementation Plan: Body Recomposition Mode

## Overview

Implements the body recomposition goal mode with calorie cycling, measurement tracking, recomp score computation, and recomp-specific dashboard/check-in UI. Follows the strict dependency chain from the design: enum/migration → pure engine → models/schemas → adaptive extension → service → router → frontend.

## Tasks

- [ ] 1. Foundation: GoalType enum, feature flag, DB migration, and audit
  - [ ] 1.1 Audit all GoalType usage sites across the codebase
    - Grep for `GoalType`, `GOAL_OFFSETS`, `PROTEIN_MULTIPLIERS`, `goal_type`, and any switch/match/if branching on goal values
    - Produce a list of every file and line that must handle `RECOMPOSITION`
    - _Requirements: 1.1_
  - [ ] 1.2 Extend GoalType enum and update all usage sites
    - Add `RECOMPOSITION = "recomposition"` to `GoalType` in `src/shared/types.py`
    - Add `GoalType.RECOMPOSITION: 0.0` to `GOAL_OFFSETS` in `src/modules/adaptive/engine.py`
    - Add `GoalType.RECOMPOSITION: 2.0` to `PROTEIN_MULTIPLIERS` in `src/modules/adaptive/engine.py`
    - Update Pydantic schema validators, frontend goal constants, and any other sites from the audit
    - _Requirements: 1.1, 1.2_
  - [ ] 1.3 Create Alembic migration for `recomp_measurements` table
    - Table: id (UUID PK), user_id (FK to users), recorded_date (DATE), waist_cm (FLOAT nullable), arm_cm (FLOAT nullable), chest_cm (FLOAT nullable), created_at, updated_at
    - Index: (user_id, recorded_date)
    - CHECK constraint: at least one of waist_cm, arm_cm, chest_cm is NOT NULL
    - Seed `recomp_mode_enabled` feature flag (default: False)
    - _Requirements: 3.1, 3.4_
  - [ ]* 1.4 Write unit tests for GoalType exhaustiveness
    - Verify `compute_snapshot` works with `GoalType.RECOMPOSITION` (produces maintenance baseline)
    - Verify all GoalType dict lookups handle RECOMPOSITION without KeyError
    - Verify existing adaptive engine tests still pass
    - _Requirements: 1.1_

- [ ] 2. Checkpoint — Verify foundation
  - Ensure migration runs and rolls back cleanly
  - Ensure all existing test suites pass with the new enum value
  - Ensure feature flag is seeded

- [ ] 3. Pure recomp engine — trend and score computation
  - [ ] 3.1 Implement `compute_trend()` in `src/modules/recomp/engine.py`
    - Create `src/modules/recomp/__init__.py`
    - Create `src/modules/recomp/engine.py` with `MeasurementPoint`, `TrendResult` dataclasses
    - Implement `compute_trend(points) -> TrendResult | None` using least-squares linear regression
    - Handle edge cases: <2 points → None, all-same-date → slope=0.0/direction="stable"
    - Direction thresholds: <-0.05 → "decreasing", >0.05 → "increasing", else → "stable"
    - _Requirements: 4.1, 4.2, 4.5_
  - [ ]* 3.2 Write property tests for trend computation
    - **Property 9: Linear regression trend correctness**
    - **Validates: Requirements 4.1, 4.2, 4.5**
  - [ ] 3.3 Implement `compute_recomp_score()` in `src/modules/recomp/engine.py`
    - Add `RecompMetricsInput`, `RecompMetricsOutput` dataclasses
    - Implement lookback window filtering (only include measurements within N days of max date)
    - Compute fat_loss_indicator = -waist_slope, muscle_gain_indicator = avg(arm_slope, chest_slope)
    - Normalize with tanh(value/scale_factor), scale_factor: 0.5 for fat loss, 0.3 for muscle gain
    - Score = clamp(50*normalized_fat_loss + 50*normalized_muscle_gain, -100, 100)
    - If either indicator is None: score=None, has_sufficient_data=False
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ]* 3.4 Write property tests for score computation
    - **Property 10: Recomp Score formula and clamping**
    - **Validates: Requirements 4.3, 4.4**
  - [ ]* 3.5 Write property test for lookback window filtering
    - **Property 11: Lookback window filtering**
    - **Validates: Requirements 4.6**

- [ ] 4. Pure recomp engine — calorie cycling computation
  - [ ] 4.1 Implement `compute_recomp_daily_targets()` in `src/modules/recomp/engine.py`
    - Add `RecompDailyInput`, `RecompDailyOutput` dataclasses
    - Training day: TDEE × 1.10, carb_shift_ratio=0.6, protein floor=2.0 g/kg
    - Rest day: TDEE × 0.90, reduced carbs, protein floor=2.0 g/kg
    - Minimum calorie clamp at 1200 kcal
    - Floor carbs at 50g, floor fat at 20g
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [ ]* 4.2 Write property tests for calorie cycling
    - **Property 1: Recomp calorie cycling applies correct day-specific modifier**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 4.3 Write property test for weekly average
    - **Property 2: Recomp weekly calorie average approximates maintenance**
    - **Validates: Requirements 2.3**
  - [ ]* 4.4 Write property test for protein floor
    - **Property 3: Recomp protein floor invariant**
    - **Validates: Requirements 2.4**
  - [ ]* 4.5 Write property test for carb allocation
    - **Property 4: Training days have higher carb allocation than rest days**
    - **Validates: Requirements 2.5, 2.6**
  - [ ]* 4.6 Write property test for minimum calorie clamp
    - **Property 5: Recomp minimum calorie clamp**
    - **Validates: Requirements 2.7**

- [ ] 5. Pure recomp engine — check-in logic
  - [ ] 5.1 Implement `compute_recomp_checkin()` in `src/modules/recomp/engine.py`
    - Add `RecompCheckinInput`, `RecompCheckinOutput` dataclasses
    - Decision tree with strict priority: insufficient data → weight dropping fast → weight gaining fast → recomp working → waist increasing → default
    - All branches include recomp_score from metrics
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 5.2 Write property test for check-in decision tree
    - **Property 12: Recomp check-in decision tree correctness**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

- [ ] 6. Checkpoint — Verify pure engine
  - Ensure all property tests (1-5, 9-12) pass
  - Ensure all unit tests for edge cases pass
  - Pure engine is complete with zero DB dependencies

- [ ] 7. Data models and schemas
  - [ ] 7.1 Create `src/modules/recomp/models.py` with RecompMeasurement SQLAlchemy model
    - Fields: user_id (FK), recorded_date, waist_cm, arm_cm, chest_cm
    - Index on (user_id, recorded_date)
    - _Requirements: 3.1, 3.4_
  - [ ] 7.2 Create `src/modules/recomp/schemas.py` with all Pydantic schemas
    - `RecompMeasurementCreate` with at-least-one validator and gt=0 constraints
    - `RecompMeasurementResponse`, `TrendResponse`, `RecompMetricsResponse`, `RecompCheckinResponse`
    - _Requirements: 3.2, 3.3, 7.1_
  - [ ]* 7.3 Write property tests for validation and serialization
    - **Property 6: Measurement validation — at least one field, all positive**
    - **Validates: Requirements 3.2, 3.3**
  - [ ]* 7.4 Write property test for JSON round-trip
    - **Property 13: Recomp metrics JSON round-trip**
    - **Validates: Requirements 7.1, 7.2**

- [ ] 8. Sync engine extension for recomp calorie cycling
  - [ ] 8.1 Extend sync engine to handle recomp goal type
    - In `src/modules/adaptive/sync_engine.py`: when `goal_type == RECOMPOSITION`, override surplus to +10%, deficit to -10%, carb_shift_ratio to 0.6, protein floor to 2.0 g/kg
    - If sync engine doesn't exist yet, skip this step — standalone `compute_recomp_daily_targets()` from Step 4 handles it
    - Verify existing sync engine tests still pass
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

- [ ] 9. Service layer
  - [ ] 9.1 Implement `RecompService` in `src/modules/recomp/service.py`
    - `log_measurement()`: validate user is in recomp mode, persist to DB
    - `get_measurements()`: query by user_id + date range, return sorted ASC
    - `get_recomp_metrics()`: fetch measurements + bodyweight from DB, call `compute_recomp_score()`, return
    - `get_weekly_checkin()`: compute metrics, compute weight change from bodyweight_logs, call `compute_recomp_checkin()`, return
    - _Requirements: 3.1, 3.5, 4.1, 4.2, 4.3, 6.1_
  - [ ]* 9.2 Write property tests for service persistence
    - **Property 7: Measurement persistence round-trip**
    - **Validates: Requirements 3.1, 3.4**
  - [ ]* 9.3 Write property test for date range query
    - **Property 8: Measurement date range query returns sorted results within range**
    - **Validates: Requirements 3.5**
  - [ ]* 9.4 Write integration tests for service layer
    - Full lifecycle: log measurements over 4 weeks → get_recomp_metrics → verify score
    - Check-in flow: populate data → get_weekly_checkin → verify recommendation
    - Error cases: user not in recomp mode, no bodyweight data, empty measurements
    - _Requirements: 3.1, 3.5, 4.1, 6.1_

- [ ] 10. API router and wiring
  - [ ] 10.1 Create `src/modules/recomp/router.py` with 4 endpoints
    - POST `/recomp/measurements` — log measurement (auth + flag + goal check)
    - GET `/recomp/measurements` — get measurements by date range (auth + flag + goal check)
    - GET `/recomp/metrics` — get recomp progress metrics (auth + flag + goal check)
    - GET `/recomp/checkin` — get weekly check-in (auth + flag + goal check)
    - Each endpoint: auth required → feature flag check (403) → goal type check (400) → delegate to service
    - _Requirements: 3.1, 3.5, 4.1, 6.1_
  - [ ] 10.2 Wire recomp router into `src/main.py`
    - Add `recomp_router` to app includes
    - _Requirements: 3.1_
  - [ ]* 10.3 Write integration tests for API endpoints
    - Happy path: each endpoint returns correct status (200/201)
    - Feature flag off → 403 for all endpoints
    - Wrong goal type → 400 for all endpoints
    - Invalid measurement payload → 422
    - Missing snapshot → 400 for metrics/checkin
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 6.1_

- [ ] 11. Checkpoint — Verify backend complete
  - Ensure all 13 correctness properties pass
  - Ensure all integration tests pass
  - Ensure all existing test suites pass (no regressions)
  - Ensure all error scenarios return correct HTTP status codes

- [ ] 12. Frontend — Goal selection
  - [ ] 12.1 Add recomp goal option to onboarding and profile
    - In `app/screens/onboarding/steps/IntentStep.tsx`: add "Body Recomposition" option with explanation text
    - In `app/components/profile/GoalsSection.tsx`: add "Body Recomposition" option
    - When selected: set `goal_type: "recomposition"`, `goal_rate_per_week: 0.0`
    - _Requirements: 1.2, 1.3, 1.5_
  - [ ]* 12.2 Write unit tests for goal selection
    - IntentStep renders recomp option
    - GoalsSection renders recomp option
    - Selecting recomp sets correct goal_type and goal_rate_per_week
    - _Requirements: 1.2, 1.3_

- [ ] 13. Frontend — RecompDashboardCard component
  - [ ] 13.1 Create `app/components/dashboard/RecompDashboardCard.tsx`
    - Accept `RecompMetricsResponse` as prop
    - Display waist trend (down=green, up=red), arm trend (up=green, down=red), weight trend (stable=neutral)
    - Display Recomp Score with color indicator (positive=green, negative=red, near-zero=neutral)
    - Show "Log measurements" prompt when `has_sufficient_data === false`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 13.2 Write unit tests for RecompDashboardCard
    - Renders all trend directions correctly
    - Score color mapping (positive/negative/neutral)
    - Insufficient data prompt shown/hidden
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 14. Frontend — Dashboard and check-in integration
  - [ ] 14.1 Integrate RecompDashboardCard into DashboardScreen
    - In `app/screens/dashboard/DashboardScreen.tsx`: conditionally fetch `GET /recomp/metrics` when `goal_type === "recomposition"`
    - Render `RecompDashboardCard` with response data
    - Do NOT fetch or render for non-recomp users
    - _Requirements: 5.1_
  - [ ] 14.2 Integrate recomp check-in into WeeklyCheckinCard
    - In `app/components/coaching/WeeklyCheckinCard.tsx`: when `goal_type === "recomposition"`, fetch `GET /recomp/checkin`
    - Render recomp-specific content: recommendation text, Recomp Score, measurement trends
    - _Requirements: 6.1, 6.2, 6.6_
  - [ ]* 14.3 Write unit tests for dashboard and check-in integration
    - DashboardScreen renders RecompDashboardCard only when goal_type === "recomposition"
    - DashboardScreen does NOT render RecompDashboardCard for other goal types
    - WeeklyCheckinCard renders recomp content for recomp users
    - WeeklyCheckinCard renders standard content for non-recomp users
    - _Requirements: 5.1, 6.1_

- [ ] 15. Final checkpoint — Verify all tests pass
  - Run full backend test suite: `pytest tests/ -v`
  - Run full frontend test suite: `npx jest --run`
  - Verify all 13 correctness properties pass
  - Verify all integration tests pass
  - Verify zero regressions in existing tests
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each layer boundary
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The pure engine (Steps 3-6) has zero DB dependencies and can be tested in isolation
- Step 8 (sync engine extension) is conditional on the nutrition-training-sync feature being merged
