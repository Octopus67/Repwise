# Implementation Plan: Recovery Readiness Score

## Overview

Phased implementation following the design dependency chain. Backend-first (pure engine → data layer → API), then frontend (utilities → components → wiring). Each phase gated by test checkpoints.

## Tasks

- [ ] 1. Environment setup and module scaffolding
  - [ ] 1.1 Install health data packages: run `npx expo install expo-health-connect react-native-health` and verify build compiles with `npx expo doctor`
    - Add expo-health-connect config plugin to `app.json` if needed
    - Add HealthKit entitlement for iOS in `app.json`
    - _Requirements: 1.1_
  - [ ] 1.2 Create backend module directory `src/modules/readiness/` with `__init__.py`
    - _Requirements: N/A (scaffolding)_

- [ ] 2. Readiness engine — pure computation functions
  - [ ] 2.1 Create `src/modules/readiness/readiness_engine.py` with all dataclasses and pure functions
    - Implement: `HealthMetrics`, `UserCheckin`, `Baselines`, `ReadinessWeights`, `FactorScore`, `ReadinessResult` dataclasses
    - Implement: `compute_baselines()` — arithmetic mean of up to 30 days, returns data_days counts
    - Implement: `normalize_hrv_factor()` — `clamp((current/baseline - 0.7) / 0.6, 0, 1)`, guard baseline ≤ 0 → return 0.5
    - Implement: `normalize_resting_hr_factor()` — `clamp((baseline/current - 0.85) / 0.3, 0, 1)`, guard current ≤ 0 → return 0.5
    - Implement: `normalize_sleep_duration()` — `clamp((hours - 4) / 4, 0, 1)`
    - Implement: `normalize_checkin_factor()` — `(5 - value) / 4` for soreness/stress
    - Implement: `normalize_sleep_quality()` — `(value - 1) / 4`
    - Implement: `redistribute_weights()` — proportional redistribution, present factors sum to 1.0
    - Implement: `compute_readiness()` — pure function, None score if all absent, clamped [0, 100]
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 2.2 Write property-based tests for readiness engine
    - **Property 1: Partial data produces valid results**
    - **Validates: Requirements 1.3, 2.4**
    - **Property 2: Baseline is arithmetic mean**
    - **Validates: Requirements 3.1, 3.2**
    - **Property 3: Normalization bounds [0, 1]**
    - **Validates: Requirements 4.6**
    - **Property 4: Weight redistribution preserves total**
    - **Validates: Requirements 4.3**
    - **Property 5: Score equals clamped weighted sum**
    - **Validates: Requirements 4.1, 4.4**
    - Use Hypothesis with `@settings(max_examples=200)`, bounded float strategies (`allow_nan=False, allow_infinity=False`)
    - _Requirements: 4.1, 4.3, 4.4, 4.6_

  - [ ]* 2.3 Write unit tests for readiness engine
    - Test all normalization functions with known values (baseline, above baseline, edge cases)
    - Test `compute_baselines` with empty history, <7 days, exactly 7 days, 30 days
    - Test `compute_readiness` with all factors present (exact score), all absent (None), mixed
    - Test default weights sum to 1.0
    - Test division-by-zero guards (baseline=0, current=0)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.5_

- [ ] 3. Checkpoint A — Engine tests pass
  - Run `pytest tests/test_readiness_properties.py tests/test_readiness_unit.py -v`
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Data layer and API
  - [ ] 4.1 Create SQLAlchemy models in `src/modules/readiness/readiness_models.py`
    - `RecoveryCheckin` model: user_id (FK), soreness, stress, sleep_quality (all Integer 1-5), checkin_date (Date)
    - Unique constraint on `(user_id, checkin_date)` for upsert
    - `ReadinessScore` model: user_id (FK), score (Integer nullable), score_date (Date), hrv_ms, resting_hr_bpm, sleep_duration_hours (all Float nullable), sleep_quality, soreness, stress (all Integer nullable), factors_json (JSONB)
    - Unique constraint on `(user_id, score_date)`, index on `(user_id, score_date DESC)`
    - _Requirements: 2.2, 2.3, 5.1_

  - [ ] 4.2 Create Pydantic schemas in `src/modules/readiness/readiness_schemas.py`
    - `HealthMetricsRequest`: hrv_ms (float|None, ge=0, le=300), resting_hr_bpm (float|None, ge=20, le=220), sleep_duration_hours (float|None, ge=0, le=24)
    - `CheckinRequest`: soreness, stress, sleep_quality (int, ge=1, le=5), checkin_date (date)
    - `CheckinResponse`, `FactorScoreResponse`, `ReadinessScoreResponse`, `ReadinessHistoryResponse`
    - _Requirements: 2.5, 5.4_

  - [ ]* 4.3 Write schema round-trip property test
    - **Property 7: Schema serialization round-trip**
    - **Validates: Requirements 5.4**
    - Add to `tests/test_readiness_properties.py`

  - [ ] 4.4 Create async service in `src/modules/readiness/readiness_service.py`
    - `submit_checkin()`: upsert using `(user_id, checkin_date)` unique constraint
    - `compute_score()`: fetch 30-day score history for baselines, fetch today's check-in, call engine, upsert score
    - `get_history()`: fetch scores in date range ordered by score_date DESC, validate start ≤ end
    - _Requirements: 2.2, 2.3, 4.1, 5.1, 5.2, 5.3_

  - [ ] 4.5 Create FastAPI router in `src/modules/readiness/readiness_router.py`
    - `POST /checkin` → 201, `POST /score` → 200, `GET /history` → 200
    - All endpoints require authentication via `get_current_user`
    - _Requirements: 2.1, 5.2_

  - [ ] 4.6 Wire router into `src/main.py`
    - Add `from src.modules.readiness.router import router as readiness_router`
    - Add `app.include_router(readiness_router, prefix="/api/v1/readiness", tags=["readiness"])`
    - Add `import src.modules.readiness.readiness_models` in lifespan block for SQLite table creation
    - Verify: `python -c "from src.main import app; print('OK')"`
    - _Requirements: N/A (wiring)_

  - [ ]* 4.7 Write integration tests in `tests/test_readiness_integration.py`
    - Test every endpoint: happy path, validation errors (422), unauthenticated (401)
    - Test check-in upsert: submit twice for same date, verify second overwrites
    - Test score computation: health+checkin, health-only, checkin-only, all-null
    - Test score with <7 days history (HRV factor absent)
    - Test history: happy path, empty range, start>end (422)
    - Test response schema validation for all endpoints
    - _Requirements: 2.2, 2.3, 2.5, 5.1, 5.2, 5.3_

- [ ] 5. Checkpoint B — Full backend tests pass
  - Run `pytest -v` (full backend suite)
  - Ensure all tests pass including existing tests (zero regressions), ask the user if questions arise.

- [ ] 6. Frontend utilities and health data hook
  - [ ] 6.1 Create `app/utils/readinessScoreLogic.ts` with `getReadinessColor()` and `getReadinessLabel()`
    - Green (#4CAF50) for 70-100, yellow (#FFC107) for 40-69, red (#F44336) for 0-39
    - Labels: Good / Moderate / Low
    - _Requirements: 6.2_

  - [ ]* 6.2 Write tests for readiness score logic in `app/__tests__/utils/readinessScoreLogic.test.ts`
    - **Property 6: Color band mapping**
    - **Validates: Requirements 6.2**
    - Test boundary values: 0, 39, 40, 69, 70, 100
    - Test labels match colors

  - [ ] 6.3 Create `app/hooks/useHealthData.ts` — health data integration hook
    - Platform-branched: `expo-health-connect` on Android, `react-native-health` on iOS
    - Request permissions on first call
    - Read HRV, resting HR, sleep duration for today; fallback to last 48h if today unavailable
    - Return null values on permission denial or data unavailability
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 7. Frontend components
  - [ ] 7.1 Create `app/components/modals/RecoveryCheckinModal.tsx`
    - Three stepper/slider inputs: soreness (1-5), stress (1-5), sleep quality (1-5)
    - Submit button posts to `POST /readiness/checkin` with `checkin_date` = today
    - On success: close modal, trigger score recomputation
    - Designed for <10 second completion
    - _Requirements: 2.1, 2.4_

  - [ ] 7.2 Create `app/components/dashboard/ReadinessGauge.tsx`
    - Circular gauge using SVG (same pattern as existing `ProgressRing`)
    - Color-coded arc using `getReadinessColor()`
    - Numeric score centered inside gauge
    - Factor breakdown displayed below gauge (list of factor names + normalized values)
    - Empty state: prompt to complete check-in when score is null
    - Tappable: opens `RecoveryCheckinModal`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 7.3 Wire ReadinessGauge and RecoveryCheckinModal into `app/screens/dashboard/DashboardScreen.tsx`
    - Add `useHealthData()` hook call
    - Fetch readiness score via `POST /readiness/score` with health metrics on dashboard load
    - Display `ReadinessGauge` between header and macro rings sections
    - Wrap in try/catch — render nothing on API error (fire-and-forget pattern)
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ] 7.4 Create `app/components/analytics/ReadinessTrendChart.tsx`
    - Wraps existing `TrendLineChart` component
    - Fetches readiness history via `GET /readiness/history`
    - Color-coded data points per readiness band
    - Empty state when <2 data points
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 7.5 Wire ReadinessTrendChart into `app/screens/analytics/AnalyticsScreen.tsx`
    - Add "Readiness Trend" section with `ReadinessTrendChart`
    - Wrap in try/catch — render empty state on error
    - _Requirements: 7.1_

  - [ ]* 7.6 Write frontend component tests
    - `app/__tests__/components/ReadinessGauge.test.ts`: renders with score, empty state when null, correct color, factor breakdown, tap opens modal
    - `app/__tests__/components/RecoveryCheckinModal.test.ts`: three inputs rendered, submit calls API with correct payload, close button
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 8. Checkpoint C — Frontend tests pass
  - Run `npx jest --testPathPattern=readiness` and `npx jest` (full frontend suite)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Final checkpoint — Full regression
  - Run `pytest -v` + `npx jest` (full backend + frontend)
  - Ensure zero regressions across entire codebase, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation — do not proceed past a checkpoint with failures
- Property tests validate universal correctness properties (7 properties)
- Unit tests validate specific examples, edge cases, and failure modes
- Integration tests validate every HTTP handler, status code, and auth path
- Backend is fully additive (new files + 2 lines in main.py) — rollback = revert commit
- Frontend gracefully degrades if API is unavailable (try/catch, empty states)
