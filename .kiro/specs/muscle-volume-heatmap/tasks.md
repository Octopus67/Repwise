# Implementation Plan: Muscle Group Volume Tracker and Heat Map

## Overview

Build the muscle group volume tracker and SVG heat map feature following the strict 7-phase dependency chain from the design document. Each phase depends only on artifacts from prior phases. Testing checkpoints gate progression.

## Tasks

- [ ] 1. Phase 1 — Data Layer: Schemas, DB Model, and Migration
  - [x] 1.1 Create volume schemas (`src/modules/training/volume_schemas.py`)
    - Define Pydantic models: `VolumeLandmark`, `MuscleGroupVolume`, `ExerciseVolumeDetail`, `SetDetail`, `MuscleGroupDetail`, `WeeklyVolumeResponse`, `LandmarkUpdateRequest`, `LandmarkConfigResponse`
    - All fields with proper `Field(ge=0)` constraints and descriptions
    - _Requirements: 8.1, 8.2, 10.1_
  - [x] 1.2 Create volume landmark DB model (`src/modules/training/volume_models.py`)
    - Define `UserVolumeLandmark` SQLAlchemy model with columns: id (UUID PK), user_id (FK → users.id, indexed), muscle_group (VARCHAR 50), mev (INT), mav (INT), mrv (INT), created_at, updated_at
    - Add unique constraint on (user_id, muscle_group)
    - _Requirements: 2.1, 2.2_
  - [ ] 1.3 Create Alembic migration for `user_volume_landmarks` table
    - Generate migration with `alembic revision --autogenerate`
    - Verify migration creates table with correct columns, FK, unique constraint, and index on user_id
    - _Requirements: 2.1_

- [ ] 2. Phase 2 — Pure Business Logic (no DB dependencies)
  - [ ] 2.1 Implement pure computation functions in `src/modules/training/volume_service.py`
    - Implement `compute_effort(rpe: float | None) -> float` static method with three-tier logic
    - Implement `classify_status(effective_sets: float, mev: int, mav: int, mrv: int) -> str` static method
    - Define `DEFAULT_LANDMARKS` constant dict with all 12 muscle groups and their (mev, mav, mrv) tuples
    - Implement `validate_week_start(week_start: date) -> date` helper that raises ValueError if not a Monday
    - _Requirements: 1.3, 1.4, 2.1, 3.1, 3.2, 3.3, 3.4, 8.4_
  - [ ]* 2.2 Write property tests for effort computation (Property 1)
    - **Property 1: Effort computation correctness**
    - Generate random RPE values in [0, 10] and None using Hypothesis
    - Verify correct tier returned for each range
    - **Validates: Requirements 1.3, 1.4**
  - [ ]* 2.3 Write property tests for status classification (Property 4)
    - **Property 4: Volume status classification correctness**
    - Generate random (effective_sets, mev, mav, mrv) tuples where 0 < mev < mav < mrv using Hypothesis
    - Verify correct status string for each range
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  - [ ]* 2.4 Write property test for week start validation (Property 10)
    - **Property 10: Week start validation**
    - Generate random dates using Hypothesis, verify Monday acceptance / non-Monday rejection
    - **Validates: Requirements 8.4**
  - [ ]* 2.5 Write unit tests for pure functions (`tests/test_muscle_volume_unit.py`)
    - Test `compute_effort` boundary values: RPE 0, 5.9, 6.0, 7.9, 8.0, 10.0, None
    - Test `classify_status` boundary values: sets = mev-1, mev, mav, mav+1, mrv, mrv+1
    - Test `DEFAULT_LANDMARKS` contains all 12 muscle groups with correct values
    - _Requirements: 1.3, 1.4, 2.1, 3.1-3.4_

- [ ] 3. Checkpoint — Phase 2 gate
  - Run `pytest tests/test_muscle_volume_properties.py tests/test_muscle_volume_unit.py -v`
  - Ensure all Property 1, 4, 10 tests and unit tests pass before proceeding
  - Ask the user if questions arise.

- [ ] 4. Phase 3 — Storage Layer (LandmarkStore + VolumeCalculatorService)
  - [ ] 4.1 Implement LandmarkStore (`src/modules/training/landmark_store.py`)
    - `get_landmarks(user_id)`: query user_volume_landmarks, merge with DEFAULT_LANDMARKS, return dict[str, VolumeLandmark]
    - `set_landmark(user_id, muscle_group, mev, mav, mrv)`: validate mev < mav < mrv and all >= 0, upsert into user_volume_landmarks
    - `delete_landmark(user_id, muscle_group)`: delete row, return None
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ] 4.2 Implement VolumeCalculatorService (`src/modules/training/volume_service.py`)
    - `get_weekly_muscle_volume(user_id, week_start)`: fetch sessions for Mon-Sun, iterate exercises/sets, exclude warm-ups, compute effort, aggregate per muscle group, compute frequency, classify status using landmarks
    - `get_muscle_group_detail(user_id, muscle_group, week_start)`: same fetch but filter to one muscle group, return per-exercise breakdown with individual set data
    - Reuse `TrainingAnalyticsService._fetch_sessions` pattern for DB queries
    - Reuse `exercise_mapping.get_muscle_group` for muscle group lookup
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 5.1, 8.1, 8.5_
  - [ ]* 4.3 Write property test for volume aggregation (Property 2)
    - **Property 2: Volume aggregation correctness**
    - Generate random session data with known exercise-to-muscle-group mappings
    - Compute expected effective_sets and frequency with a simple reference implementation
    - Verify VolumeCalculatorService produces matching results
    - **Validates: Requirements 1.1, 1.5, 5.1**
  - [ ]* 4.4 Write property test for warm-up exclusion (Property 3)
    - **Property 3: Warm-up exclusion (metamorphic)**
    - Generate random sessions, compute volume, then add warm-up sets, recompute, verify no change
    - **Validates: Requirements 1.2**
  - [ ]* 4.5 Write property tests for landmark round-trip (Property 5)
    - **Property 5: Landmark customization round-trip**
    - Generate valid (muscle_group, mev, mav, mrv) tuples, set then get, verify equality
    - Verify non-customized groups return defaults
    - **Validates: Requirements 2.2, 2.3, 9.1, 9.2**
  - [ ]* 4.6 Write property test for landmark validation (Property 6)
    - **Property 6: Landmark validation rejects invalid configurations**
    - Generate invalid tuples (mev >= mav, mav >= mrv, negatives), verify rejection
    - **Validates: Requirements 2.4, 2.5, 9.3, 9.4**
  - [ ]* 4.7 Write property test for landmark deletion (Property 7)
    - **Property 7: Landmark deletion reverts to defaults**
    - Set custom landmark, delete, get, verify defaults restored
    - **Validates: Requirements 9.5**
  - [ ]* 4.8 Write property test for serialization round-trip (Property 11)
    - **Property 11: Volume data serialization round-trip**
    - Generate valid WeeklyVolumeResponse objects via Hypothesis, serialize to JSON, deserialize, verify equality
    - **Validates: Requirements 10.1, 10.2, 10.3**
  - [ ]* 4.9 Write unit tests for storage layer (`tests/test_muscle_volume_unit.py`)
    - Test empty sessions return all muscle groups with zero volume and "below_mev" status
    - Test detail endpoint returns 404 for unknown muscle group
    - Test landmark PUT returns 422 for mev >= mav
    - Test landmark DELETE followed by GET returns defaults
    - _Requirements: 3.5, 6.5, 9.3, 9.5_

- [ ] 5. Checkpoint — Phase 3 gate
  - Run `pytest tests/test_muscle_volume_properties.py tests/test_muscle_volume_unit.py -v`
  - Ensure all Properties 1-7, 10, 11 and all unit tests pass before proceeding
  - Ask the user if questions arise.

- [ ] 6. Phase 4 — API Layer (Router Endpoints)
  - [ ] 6.1 Add volume analytics endpoints to `src/modules/training/router.py`
    - `GET /training/analytics/muscle-volume?week_start=YYYY-MM-DD` → calls VolumeCalculatorService.get_weekly_muscle_volume, defaults to current week if omitted, validates week_start is Monday
    - `GET /training/analytics/muscle-volume/{muscle_group}/detail?week_start=YYYY-MM-DD` → calls VolumeCalculatorService.get_muscle_group_detail
    - `GET /training/analytics/volume-landmarks` → calls LandmarkStore.get_landmarks
    - `PUT /training/analytics/volume-landmarks` → calls LandmarkStore.set_landmark with LandmarkUpdateRequest body
    - `DELETE /training/analytics/volume-landmarks/{muscle_group}` → calls LandmarkStore.delete_landmark, returns 204
    - All endpoints require authentication via `get_current_user` dependency
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ]* 6.2 Write integration tests for API endpoints
    - Test full flow: create training sessions → GET muscle-volume → verify computed values
    - Test landmark customization: PUT custom → GET muscle-volume → verify custom thresholds
    - Test drill-down consistency: GET summary → GET detail → verify sums match
    - Test week_start defaults to current week when omitted
    - Test 422 for non-Monday week_start
    - Test 404 for unknown muscle group in detail endpoint
    - _Requirements: 8.1-8.5, 9.1-9.5_

- [ ] 7. Checkpoint — Phase 4 gate
  - Run full backend test suite: `pytest tests/test_muscle_volume_properties.py tests/test_muscle_volume_unit.py -v`
  - Ensure all backend tests pass including integration tests
  - Ask the user if questions arise.

- [ ] 8. Phase 5 — Frontend Utilities (pure logic, no components)
  - [ ] 8.1 Create muscle volume logic utilities (`app/utils/muscleVolumeLogic.ts`)
    - `getStatusColor(status: string): string` — maps volume_status to hex color (#6B7280, #22C55E, #EAB308, #EF4444)
    - `formatFrequency(muscleGroup: string, frequency: number, sets: number): string` — returns "{muscleGroup}: {frequency}×/week, {sets} sets"
    - `getWeekStart(date: Date): string` — returns ISO Monday date string for the week containing the given date
    - `isCurrentOrFutureWeek(weekStart: string): boolean` — returns true if weekStart >= current week's Monday
    - `getAdjacentWeek(weekStart: string, direction: 'prev' | 'next'): string` — returns Monday of previous or next week
    - _Requirements: 4.2, 5.2, 7.3, 7.5_
  - [ ] 8.2 Create body SVG path data (`app/components/analytics/bodySvgPaths.ts`)
    - Define `MuscleRegion` interface: muscleGroup, view ('front' | 'back'), pathData (SVG d attribute), labelPosition ({x, y})
    - Export `BODY_REGIONS: MuscleRegion[]` with SVG paths for front view (chest, abs, quads, biceps, shoulders front, forearms front) and back view (back, traps, hamstrings, glutes, triceps, calves, shoulders rear)
    - Export `VIEWBOX` constant for the SVG viewBox dimensions
    - _Requirements: 4.1_
  - [ ]* 8.3 Write property tests for frontend utilities (`app/__tests__/utils/muscleVolumeLogic.test.ts`)
    - **Property 8: Volume status to color mapping** — generate random valid statuses, verify correct hex color
    - **Property 9: Frequency format string** — generate random names and non-negative integers, verify output contains all components
    - **Property 12: Week navigation disable logic** — generate random dates, verify isCurrentOrFutureWeek returns true iff date >= current week Monday
    - **Validates: Requirements 4.2, 5.2, 7.5**

- [ ] 9. Phase 6 — Frontend Components
  - [ ] 9.1 Create WeekNavigator component (`app/components/analytics/WeekNavigator.tsx`)
    - Left/right arrow buttons for week navigation
    - Display current week range (e.g., "Jan 15 – Jan 21")
    - Disable next button when isCurrentOrFutureWeek is true
    - Call onWeekChange with new weekStart string
    - _Requirements: 7.3, 7.4, 7.5_
  - [ ] 9.2 Create BodyHeatMap component (`app/components/analytics/BodyHeatMap.tsx`)
    - Render front and back SVG body diagrams using react-native-svg (Svg, Path, G, Text)
    - Map BODY_REGIONS to Path elements, fill color from getStatusColor
    - Wrap each Path in a pressable area that calls onMusclePress(muscleGroup)
    - Show Skeleton placeholder when isLoading is true
    - Show all gray regions with "No data" message when all volumes are zero
    - Include color legend with four status labels
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ] 9.3 Create DrillDownModal component (`app/components/analytics/DrillDownModal.tsx`)
    - Use existing ModalContainer pattern from the codebase
    - Display muscle group name, total effective sets, volume status badge, MEV/MAV/MRV values
    - Fetch detail data from GET /training/analytics/muscle-volume/{muscle_group}/detail on open
    - List exercises with working sets count and effective sets
    - Expandable exercise rows showing individual set data (weight, reps, RPE, effort)
    - Empty state when no exercises for the muscle group
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ] 9.4 Create HeatMapCard container (`app/components/analytics/HeatMapCard.tsx`)
    - Self-contained card that manages its own state and API calls
    - Compose WeekNavigator + BodyHeatMap + frequency summary list
    - Fetch weekly volume data on mount and on week change via GET /training/analytics/muscle-volume
    - Pass muscle volumes to BodyHeatMap, handle onMusclePress to open DrillDownModal
    - Display frequency summary below heat map using formatFrequency
    - Handle loading, error, and empty states
    - _Requirements: 5.2, 7.2, 7.4_
  - [ ]* 9.5 Write unit tests for frontend components (`app/__tests__/components/BodyHeatMap.test.ts`)
    - Test BodyHeatMap renders front and back view containers
    - Test tapping a muscle region calls onMusclePress with correct muscle group
    - Test loading state shows skeleton
    - Test empty data shows all gray regions
    - Test legend renders four status colors with labels
    - _Requirements: 4.1-4.6_
  - [ ]* 9.6 Write unit tests for DrillDownModal (`app/__tests__/components/DrillDownModal.test.ts`)
    - Test modal displays muscle group name and landmark values
    - Test modal lists exercises with set counts
    - Test empty state message when no exercises
    - Test dismiss calls onClose
    - _Requirements: 6.1-6.5_

- [ ] 10. Checkpoint — Phase 6 gate
  - Run frontend tests: `npx jest app/__tests__/utils/muscleVolumeLogic.test.ts app/__tests__/components/BodyHeatMap.test.ts app/__tests__/components/DrillDownModal.test.ts --run`
  - Ensure all frontend property tests (Properties 8, 9, 12) and component unit tests pass
  - Ask the user if questions arise.

- [ ] 11. Phase 7 — Analytics Screen Integration
  - [ ] 11.1 Integrate HeatMapCard into AnalyticsScreen (`app/screens/analytics/AnalyticsScreen.tsx`)
    - Import HeatMapCard component
    - Add "Muscle Volume Heat Map" section title and HeatMapCard between the Training Volume and Strength Progression sections
    - No other changes to AnalyticsScreen
    - _Requirements: 7.1, 7.2_

- [ ] 12. Final Checkpoint — All tests pass
  - Run full backend test suite: `pytest tests/test_muscle_volume_properties.py tests/test_muscle_volume_unit.py -v`
  - Run full frontend test suite: `npx jest app/__tests__/utils/muscleVolumeLogic.test.ts app/__tests__/components/BodyHeatMap.test.ts app/__tests__/components/DrillDownModal.test.ts --run`
  - Ensure all tests pass end-to-end
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints gate progression — do not proceed until all tests pass
- Property tests validate universal correctness properties (min 100 iterations each)
- Unit tests validate specific examples, boundary cases, and error conditions
- All new backend code is in new files — rollback is safe file deletion + router revert
- All new frontend code is in new component files — rollback is safe file deletion + AnalyticsScreen revert
