# Implementation Plan: Product Polish V2

## Overview

Five product improvements implemented incrementally: unit conversion utilities first (dependency for all display features), then training analytics backend, PR detection, previous performance, charting upgrade, rest timer, and finally profile settings wiring. Backend (Python/FastAPI) and frontend (TypeScript/React Native) tasks are grouped by feature with tests as sub-tasks.

## Tasks

- [x] 1. Implement Unit Conversion Utility
  - [x] 1.1 Create `app/utils/unitConversion.ts` with pure conversion functions
    - `convertWeight(valueKg: number, to: 'metric' | 'imperial'): number` — multiply by 2.20462 for imperial, identity for metric
    - `convertHeight(valueCm: number, to: 'metric' | 'imperial'): { value: number; unit: string } | { feet: number; inches: number }` — divide by 2.54 for inches, then split into feet/inches
    - `formatWeight(valueKg: number, system: 'metric' | 'imperial'): string` — returns e.g. "80.0 kg" or "176.4 lbs"
    - `formatHeight(valueCm: number, system: 'metric' | 'imperial'): string` — returns e.g. "180 cm" or "5'11\""
    - `parseWeightInput(value: number, system: 'metric' | 'imperial'): number` — converts imperial input to kg for storage
    - Round weight conversions to 1 decimal place, height to nearest whole cm
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 5.7_
  - [x] 1.2 Write property tests for unit conversion (fast-check) in `app/__tests__/unitConversion.test.ts`
    - **Property 7: Weight conversion round-trip** — for any non-negative kg value, `parseWeightInput(convertWeight(v, 'imperial'), 'imperial')` ≈ v within 0.1 kg
    - **Validates: Requirements 5.1**
    - **Property 8: Height conversion round-trip** — for any positive cm value, converting to ft/in and back ≈ original within 1 cm
    - **Validates: Requirements 5.2**
    - **Property 12: Conversion rounding** — for any conversion, weight output has ≤1 decimal place, height cm output is integer
    - **Validates: Requirements 5.7**
    - **Property 10: Unit display formatting** — for any kg value and system, formatted string contains correct unit suffix and converted value
    - **Validates: Requirements 5.4**
    - **Property 11: Database metric invariant** — for any value input in any system, `parseWeightInput` returns kg
    - **Validates: Requirements 5.5, 5.6**
    - Minimum 100 iterations per property

- [x] 2. Extend Zustand store with unit system preference
  - [x] 2.1 Add `unitSystem: 'metric' | 'imperial'` field and `setUnitSystem` action to `app/store/index.ts`
    - Default to `'metric'`
    - Derive initial value from `profile.preferences?.unit_system` when profile loads in `setProfile` action
    - _Requirements: 5.3, 5.4_

- [x] 3. Implement Training Analytics Backend
  - [x] 3.1 Create `src/modules/training/analytics_schemas.py` with response models
    - `VolumeTrendPoint(date, total_volume: float)`
    - `StrengthProgressionPoint(date, exercise_name, best_weight_kg, best_reps, estimated_1rm: float | None)`
    - `MuscleGroupFrequency(muscle_group, week_start: date, session_count: int)`
    - `PersonalRecord(exercise_name, reps: int, new_weight_kg, previous_weight_kg: float | None)`
    - `PreviousPerformance(exercise_name, session_date, last_set_weight_kg, last_set_reps: int)`
    - _Requirements: 1.1, 2.1, 3.1, 4.3, 6.1_
  - [x] 3.2 Create `src/modules/training/exercise_mapping.py` with static mappings
    - `EXERCISE_MUSCLE_MAP: dict[str, str]` — maps lowercase exercise names to muscle groups (chest, back, shoulders, quadriceps, hamstrings, biceps, triceps, glutes, calves, core, other)
    - `COMPOUND_EXERCISES: set[str]` — set of compound exercise names for rest timer defaults
    - `get_muscle_group(exercise_name: str) -> str` — returns mapped group or "Other" for unknown exercises
    - `is_compound(exercise_name: str) -> bool` — returns True if exercise is in COMPOUND_EXERCISES
    - _Requirements: 3.2, 3.3, 8.2_
  - [x] 3.3 Create `src/modules/training/analytics_service.py` with `TrainingAnalyticsService` class
    - `get_volume_trend(user_id, start_date, end_date, muscle_group=None) -> list[VolumeTrendPoint]` — query training_sessions in date range, iterate exercises JSON, sum (reps × weight_kg) per set per session day. If muscle_group provided, filter exercises through `get_muscle_group()` before summing.
    - `get_strength_progression(user_id, exercise_name, start_date, end_date) -> list[StrengthProgressionPoint]` — query sessions containing exercise_name, for each session find the set with max (weight_kg × reps), optionally compute Epley e1RM = weight × (1 + reps/30).
    - `get_muscle_group_frequency(user_id, start_date, end_date) -> list[MuscleGroupFrequency]` — query sessions, map exercises to muscle groups, count distinct sessions per group per ISO week.
    - All queries filter by `deleted_at IS NULL` using `TrainingSession.not_deleted()`.
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1_
  - [x] 3.4 Write property tests for analytics service in `tests/test_training_analytics_properties.py`
    - **Property 1: Volume computation correctness** — for any list of training sessions, computed volume equals manual sum of (reps × weight_kg) across all sets
    - **Validates: Requirements 1.1**
    - **Property 2: Volume muscle group filtering** — for any sessions and muscle group filter, returned volume only includes exercises mapped to that group
    - **Validates: Requirements 1.3**
    - **Property 3: Strength progression best-set** — for any sessions with a given exercise, each point's best_weight_kg × best_reps equals the max product from that session
    - **Validates: Requirements 2.1**
    - **Property 4: Muscle group frequency** — for any sessions, session_count per group per week equals count of distinct sessions with exercises in that group
    - **Validates: Requirements 3.1**
    - **Property 5: Exercise mapping** — for any exercise in EXERCISE_MUSCLE_MAP, returns correct group; for any string not in map, returns "Other"
    - **Validates: Requirements 3.2, 3.3**
    - Use Hypothesis with `@given` strategies generating random ExerciseEntry and SetEntry lists
    - Minimum 100 iterations per property

- [x] 4. Implement PR Detection
  - [x] 4.1 Create `src/modules/training/pr_detector.py` with `PRDetector` class
    - `detect_prs(user_id, exercises: list[ExerciseEntry]) -> list[PersonalRecord]` — for each set in each exercise, query historical best weight for that exercise+rep_count combo. If current weight > historical best, create PersonalRecord with exercise_name, reps, new_weight_kg, previous_weight_kg. If no history exists for that combo, skip (no PR flag).
    - `get_historical_bests(user_id, exercise_name) -> dict[int, float]` — query all non-deleted sessions for user, extract max weight_kg per rep count for the given exercise.
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 4.2 Integrate PR detection into `TrainingService.create_session()` in `src/modules/training/service.py`
    - After persisting the session, call `PRDetector.detect_prs()` with the session's exercises
    - Add `personal_records: list[PersonalRecord]` field to `TrainingSessionResponse` (default empty list)
    - Return detected PRs in the response
    - _Requirements: 4.3_
  - [x] 4.3 Write property tests for PR detection in `tests/test_pr_detection_properties.py`
    - **Property 6: PR detection correctness** — for any historical bests dict and new session exercises, a set is flagged as PR iff its weight_kg > historical best for that exercise+rep_count. Sets with no history are not flagged. Returned PR objects contain correct exercise_name, reps, new_weight_kg, previous_weight_kg.
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Use Hypothesis to generate random historical bests and new exercise entries
    - Minimum 100 iterations

- [x] 5. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Previous Performance Resolver
  - [x] 6.1 Create `src/modules/training/previous_performance.py` with `PreviousPerformanceResolver` class
    - `get_previous_performance(user_id, exercise_name) -> PreviousPerformance | None` — query training_sessions for user where exercises JSON contains exercise_name, order by session_date DESC, limit 1. Extract the last set from the matching exercise entry. Return PreviousPerformance or None.
    - Use SQLAlchemy JSON path operators or load and filter in Python for JSONB exercise_name matching.
    - _Requirements: 6.1, 6.4_
  - [x] 6.2 Write property tests for previous performance in `tests/test_previous_performance_properties.py`
    - **Property 13: Previous performance recency** — for any user with N sessions containing exercise X (N≥2), the resolver returns data from the session with the latest session_date, and the weight/reps match the last set of that exercise in that session.
    - **Validates: Requirements 6.1**
    - Minimum 100 iterations

- [x] 7. Create Training Analytics Router
  - [x] 7.1 Create `src/modules/training/analytics_router.py` with FastAPI router
    - `GET /training/analytics/volume?start_date=&end_date=&muscle_group=` — calls `TrainingAnalyticsService.get_volume_trend()`, returns `list[VolumeTrendPoint]`
    - `GET /training/analytics/strength/{exercise_name}?start_date=&end_date=` — calls `get_strength_progression()`, returns `list[StrengthProgressionPoint]`
    - `GET /training/analytics/muscle-frequency?start_date=&end_date=` — calls `get_muscle_group_frequency()`, returns `list[MuscleGroupFrequency]`
    - `GET /training/previous-performance/{exercise_name}` — calls `PreviousPerformanceResolver.get_previous_performance()`, returns `PreviousPerformance | null`
    - All endpoints require authenticated user (use existing `get_current_user` dependency)
    - Validate start_date ≤ end_date, return 400 if invalid
    - _Requirements: 1.1, 2.1, 3.1, 6.1_
  - [x] 7.2 Register the analytics router in `src/main.py`
    - Import and include `analytics_router` with prefix `/training`
    - _Requirements: 1.1, 2.1, 3.1, 6.1_

- [x] 8. Implement Chart Components (Frontend)
  - [x] 8.1 Install `victory-native` and `react-native-svg` dependencies
    - Run `npx expo install victory-native react-native-svg`
    - _Requirements: 7.1_
  - [x] 8.2 Create `app/components/charts/TimeRangeSelector.tsx`
    - Segmented control with options: `['7d', '14d', '30d', '90d']`
    - Props: `selected: string`, `onSelect: (range: string) => void`
    - Style with `colors.bg.surfaceRaised`, `colors.accent.primary` for active segment, `colors.text.secondary` for inactive
    - _Requirements: 7.4_
  - [x] 8.3 Create `app/components/charts/TrendLineChart.tsx`
    - Props: `data: {date: string, value: number}[]`, `color: string`, `targetLine?: number`, `suffix?: string`, `emptyMessage?: string`
    - Use `VictoryLine` + `VictoryChart` + `VictoryAxis` + `VictoryTooltip` from victory-native
    - Show horizontal dashed line at `targetLine` value if provided using `VictoryLine` with dashed stroke
    - Show tooltip on press with date + value + suffix
    - If data is empty, render `emptyMessage` or "No data for this period" text
    - Use theme tokens: `colors.bg.surface` for chart background, `colors.text.muted` for axis labels, `colors.border.subtle` for grid
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 7.7_
  - [x] 8.4 Create `app/utils/filterByTimeRange.ts`
    - `filterByTimeRange(data: {date: string, value: number}[], range: '7d'|'14d'|'30d'|'90d'): {date: string, value: number}[]`
    - Parse range to number of days, filter points where date ≥ (today - days)
    - _Requirements: 7.5_
  - [x] 8.5 Write property tests for time range filtering in `app/__tests__/filterByTimeRange.test.ts`
    - **Property 15: Time range data filtering** — for any dataset and time range, filtered result contains only points within range and contains all such points
    - **Validates: Requirements 7.5**
    - Minimum 100 iterations with fast-check
  - [x] 8.6 Refactor `app/screens/analytics/AnalyticsScreen.tsx` to use new chart components
    - Replace `MiniChart` component with `TrendLineChart` for bodyweight, calorie, and protein trends
    - Add `TimeRangeSelector` at top of analytics section, default to '30d'
    - Pass `adaptiveTarget?.calories` as `targetLine` to calorie chart, `adaptiveTarget?.protein` to protein chart
    - Use `filterByTimeRange` to filter data before passing to charts
    - Add training volume chart section: fetch from `GET /training/analytics/volume` and render with `TrendLineChart`
    - Add strength progression section: exercise selector dropdown + `TrendLineChart`
    - Format all weight values through `formatWeight()` using store's `unitSystem`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 1.1, 2.1_

- [x] 9. Implement Previous Performance Display (Frontend)
  - [x] 9.1 Create `app/components/training/PreviousPerformance.tsx`
    - Props: `exerciseName: string`
    - On mount, fetch `GET /training/previous-performance/{exerciseName}` from API
    - If data returned: display `"Last time: {formatWeight(weight, unitSystem)} × {reps}"` using `formatWeight` from unitConversion utility and `unitSystem` from store
    - If no data (null response): display `"First time"` in `colors.text.muted`
    - Show loading skeleton while fetching (simple pulsing text placeholder)
    - _Requirements: 6.2, 6.3, 6.5_
  - [x] 9.2 Write property tests for previous performance formatting in `app/__tests__/previousPerformance.test.ts`
    - **Property 14: Previous performance formatting** — for any weight (kg) and reps and unit system, the formatted string matches "Last time: {formatted_weight} × {reps}"
    - **Validates: Requirements 6.2**
    - Minimum 100 iterations with fast-check
  - [x] 9.3 Integrate `PreviousPerformance` into `app/components/modals/AddTrainingModal.tsx`
    - Below each exercise name input field, render `<PreviousPerformance exerciseName={exercise.exercise_name} />`
    - Only render when exercise_name is non-empty
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 10. Implement Rest Timer
  - [x] 10.1 Create `app/utils/formatTimer.ts`
    - `formatTimer(seconds: number): string` — returns "M:SS" format (e.g., 150 → "2:30", 5 → "0:05")
    - _Requirements: 8.6_
  - [x] 10.2 Write property tests for timer formatting in `app/__tests__/formatTimer.test.ts`
    - **Property 17: Timer display formatting** — for any non-negative integer seconds, output matches /^\d+:\d{2}$/ and minutes × 60 + parsed seconds equals input
    - **Validates: Requirements 8.6**
    - Minimum 100 iterations with fast-check
  - [x] 10.3 Create `app/utils/getRestDuration.ts`
    - `getRestDuration(exerciseName: string, preferences: {compound_seconds?: number, isolation_seconds?: number} | undefined): number`
    - If exercise is compound (check via lowercase match against a `COMPOUND_EXERCISES` set mirroring backend): use `preferences?.compound_seconds ?? 180`
    - If isolation: use `preferences?.isolation_seconds ?? 90`
    - _Requirements: 8.1, 8.2, 8.7_
  - [x] 10.4 Write property tests for rest duration selection in `app/__tests__/getRestDuration.test.ts`
    - **Property 16: Rest timer duration selection** — for any exercise name and preferences, returns custom duration if configured, else default (180 compound / 90 isolation). Result is always a positive integer.
    - **Validates: Requirements 8.1, 8.2, 8.7**
    - Minimum 100 iterations with fast-check
  - [x] 10.5 Create `app/components/training/RestTimer.tsx`
    - Props: `durationSeconds: number`, `visible: boolean`, `onDismiss: () => void`, `onComplete: () => void`
    - Use `useEffect` + `setInterval` for countdown (1s tick)
    - Display remaining time using `formatTimer()`
    - When countdown reaches 0: call `onComplete()`, play notification sound via `expo-av` Audio API
    - "Skip" button calls `onDismiss()` and stops the interval
    - Style: semi-transparent overlay (`colors.bg.overlay`), large countdown text in `colors.accent.primary`, skip button in `colors.text.secondary`
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6_
  - [x] 10.6 Integrate rest timer into `app/components/modals/AddTrainingModal.tsx`
    - After a set is logged (user taps "Add Set" or equivalent), auto-show `RestTimer` with duration from `getRestDuration(exerciseName, preferences?.rest_timer)`
    - Read `preferences.rest_timer` from store profile
    - On dismiss or complete, hide the timer
    - _Requirements: 8.1, 8.7_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Add Unit Preference Toggle to Profile
  - [x] 12.1 Add unit system toggle to `app/screens/profile/ProfileScreen.tsx`
    - Add a new `SettingsRow` in the Account card with label "Units" and a toggle/segmented control switching between "Metric (kg/cm)" and "Imperial (lbs/ft)"
    - On change: call `PUT /user/profile` with `{ preferences: { ...existing, unit_system: newValue } }`, then call `store.setUnitSystem(newValue)`
    - Read current value from `store.unitSystem`
    - _Requirements: 5.3, 5.4_
  - [x] 12.2 Add rest timer preference settings to `app/screens/profile/ProfileScreen.tsx`
    - Add "Rest Timer" section below Units with two numeric inputs: "Compound rest (seconds)" and "Isolation rest (seconds)"
    - Default display values: 180 and 90
    - On save: call `PUT /user/profile` with `{ preferences: { ...existing, rest_timer: { compound_seconds, isolation_seconds } } }`
    - _Requirements: 8.7, 8.8_
  - [x] 12.3 Write property tests for preference persistence in `tests/test_preference_persistence_properties.py`
    - **Property 9: Preference persistence round-trip** — for any valid unit_system or rest_timer preference, PUT then GET returns equivalent values
    - **Validates: Requirements 5.3, 8.8**
    - Use Hypothesis, minimum 100 iterations

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property tests are required for comprehensive coverage
- All backend data is stored in metric (kg, cm) — conversion is display-only on the frontend
- The `victory-native` library requires `react-native-svg` as a peer dependency
- Exercise-to-muscle-group mapping is static and extensible; unknown exercises default to "Other"
- Property tests use Hypothesis (Python) and fast-check (TypeScript) with minimum 100 iterations each
- Each property test references its design document property number for traceability
