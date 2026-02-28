# Implementation Plan: Workout Logging Premium

## Stress-Test Audit Summary

**Issues found in original plan:**
1. **REORDER:** Bottom sheet library (`@gorhom/bottom-sheet`) not installed — Tasks 9.x would fail. Moved dependency install to Phase 0.
2. **REORDER:** `updateSetField` in `activeWorkoutSlice.ts` only accepts `'weight' | 'reps' | 'rpe'` — must update type union BEFORE adding RIR to store (Task 5.1 depends on type change).
3. **REORDER:** `ActiveWorkoutPayload` type doesn't include `rir` in set payload — must update BEFORE session submission wiring.
4. **GAP:** No feature flag for the new `ActiveWorkoutScreen`. Original plan ships it without a kill switch. Added feature flag creation as Step 1.
5. **GAP:** No `@gorhom/bottom-sheet` dependency. 4 components depend on it (ExercisePickerSheet, PlateCalculatorSheet, ExerciseHistorySheet, FinishConfirmationSheet).
6. **GAP:** Navigation wiring missing — `ActiveWorkoutScreen` not registered in any navigator. Need to add it to the stack navigator in `BottomTabNavigator.tsx` or a new training stack.
7. **GAP:** `OverloadSuggestion` schema already exists in `schemas.py` but no batch request/response schemas exist yet.
8. **GAP:** Crash recovery "Resume" alert exists in `App.tsx` but doesn't navigate to `ActiveWorkoutScreen` — just shows alert with no navigation action.
9. **CUT:** `ExerciseHistorySheet` (Task 9.3) is gold-plating for v1 — analytics endpoints exist but wiring a chart + PR timeline into a bottom sheet is 4+ hours of work with low retention impact. Deferred.
10. **CUT:** `SupersetBracket` visual component (Task 13.1) — superset logic already works in the store. Visual bracket is polish, not core. Deferred.
11. **CLARIFY:** "Wire navigation" (Task 12.2) was vague — specified exact navigator changes, screen registration, and param passing.
12. **RISK:** `OverloadSuggestionService._fetch_snapshots` scans up to 50 sessions per exercise. Batch endpoint calling this N times could be slow. Added note to batch at DB level.

## Tasks

═══════════════════════════════════════════════
PHASE 0: SETUP & PREREQUISITES
═══════════════════════════════════════════════

- [x] 1. Install bottom sheet dependency and verify build
  - Run `cd app && npx expo install @gorhom/bottom-sheet react-native-gesture-handler react-native-reanimated`
  - Verify `react-native-reanimated` is already installed (it is — Reanimated 4 per project steering). If version conflict, resolve.
  - Verify `react-native-gesture-handler` is already installed. If not, the install above adds it.
  - Run `cd app && npx expo start --port 8081` to verify the app still builds and launches without errors.
  - Files: `app/package.json` (M)
  - Depends on: none
  - Risk: 🟡 Medium — Reanimated version conflicts possible with Expo SDK 53
  - Rollback: `cd app && npm uninstall @gorhom/bottom-sheet` and revert package.json
  - Time: S
  - _No requirements — infrastructure prerequisite_

- [x] 2. Create feature flag `premium_workout_logger` in backend
  - Add a seed/migration that inserts a feature flag row: `flag_name='premium_workout_logger', is_enabled=False, description='Gates the new ActiveWorkoutScreen (workout-logging-premium spec)'`
  - This flag will gate the new screen. When OFF, the existing `AddTrainingModal` is used. When ON, the new `ActiveWorkoutScreen` is used.
  - File: `src/modules/feature_flags/seed_premium_workout.py` (C) — one-time script to insert the flag
  - Run: `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/python -m src.modules.feature_flags.seed_premium_workout`
  - Depends on: none
  - Risk: 🟢 Low
  - Rollback: Delete the flag row from the database
  - Time: S
  - _No requirements — infrastructure prerequisite_

- [x] 3. Verify existing test suites pass (baseline)
  - Run backend: `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
  - Run frontend: `cd app && npx jest --passWithNoTests`
  - Both must pass with 0 failures. If any fail, fix before proceeding.
  - Depends on: Steps 1, 2
  - Risk: 🟢 Low
  - Time: S

🚦 CHECKPOINT 0: Prerequisites verified
  - Run: Backend tests pass, frontend tests pass, app builds with bottom-sheet installed
  - Verify: `@gorhom/bottom-sheet` in app/package.json, feature flag row exists
  - Gate: Zero test failures, app launches on simulator

═══════════════════════════════════════════════
PHASE 1: BACKEND — SCHEMA & API
═══════════════════════════════════════════════

- [x] 4. Add `rir` field to `SetEntry` schema
  - File: `src/modules/training/schemas.py` (M)
  - In `SetEntry` class, add: `rir: Optional[int] = Field(default=None, ge=0, le=5, description="Reps in Reserve (0-5)")`
  - In `PreviousPerformanceSetData` class, add: `rir: Optional[int] = None`
  - Verify: Existing sessions without `rir` still deserialize (field is Optional with default None).
  - Depends on: Step 3
  - Parallel: Can run alongside Step 5
  - Risk: 🟢 Low — additive, backward-compatible
  - Rollback: Remove the field; existing data unaffected (JSON column, not a DB migration)
  - Time: S
  - _Requirements: 7.1, 7.5_

- [x] 5. Add batch overload suggestion schemas to `src/modules/training/schemas.py`
  - File: `src/modules/training/schemas.py` (M)
  - Add `BatchOverloadRequest(BaseModel)` with `exercise_names: list[str] = Field(min_length=1, max_length=20)`
  - Add `BatchOverloadResponse(BaseModel)` with `suggestions: dict[str, Optional[OverloadSuggestion]]`
  - Note: `OverloadSuggestion` already exists in this file.
  - Depends on: Step 3
  - Parallel: Can run alongside Step 4
  - Risk: 🟢 Low
  - Rollback: Remove the two new classes
  - Time: S
  - _Requirements: 4.1, 4.2_

- [x] 6. Add `get_batch_suggestions` method to `OverloadSuggestionService`
  - File: `src/modules/training/overload_service.py` (M)
  - Add async method `get_batch_suggestions(self, user_id: UUID, exercise_names: list[str]) -> dict[str, OverloadSuggestion | None]`
  - Implementation: Fetch last 50 sessions ONCE (not per exercise). Loop through exercises, extract snapshots from the cached sessions, call `compute_suggestion` for each.
  - This avoids N separate DB queries — the current `_fetch_snapshots` scans 50 sessions per call. Batching at DB level is critical for performance.
  - Depends on: Steps 4, 5
  - Risk: 🟡 Medium — performance concern if user has many sessions; mitigated by single DB query
  - Rollback: Remove the method
  - Time: M
  - _Requirements: 4.1, 4.2_

- [x] 7. Add batch overload endpoint to router
  - File: `src/modules/training/router.py` (M)
  - Add `POST /training/exercises/batch-overload-suggestions` endpoint
  - Pattern: Follow existing `get_overload_suggestion` endpoint at line ~102. Use `Depends(get_db)` and `Depends(get_current_user)`.
  - Request body: `BatchOverloadRequest`. Response: `BatchOverloadResponse`.
  - Call `OverloadSuggestionService(db).get_batch_suggestions(user.id, request.exercise_names)`
  - Depends on: Step 6
  - Risk: 🟢 Low
  - Rollback: Remove the endpoint
  - Time: S
  - _Requirements: 4.1, 4.2_

- [x] 8. Write property tests for RIR field validation
  - File: `tests/test_workout_logging_premium_properties.py` (C)
  - **Property 10: RIR field validation and round-trip**
  - Test: `@given(rir=st.integers(0, 5))` → `SetEntry(reps=5, weight_kg=50, rir=rir)` succeeds
  - Test: `@given(rir=st.integers(-100, -1) | st.integers(6, 100))` → `SetEntry(reps=5, weight_kg=50, rir=rir)` raises `ValidationError`
  - Test: Round-trip: `SetEntry.model_validate_json(entry.model_dump_json())` produces equivalent entry
  - Depends on: Step 4
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 7.1, 7.5**

- [x] 9. Write property tests for overload suggestion invariants
  - File: `tests/test_overload_suggestion_properties.py` (C or M — file may already exist from prior specs)
  - **Property 7: Overload suggestion weight is always non-negative**
  - Generate: `@given(snapshots=st.lists(st.builds(_SessionSnapshot, weight_kg=st.floats(0, 500), reps=st.integers(1, 50), avg_rpe=st.floats(1, 10)), min_size=3, max_size=5))`
  - Assert: `result.suggested_weight_kg >= 0`
  - **Property 8: Overload suggestion confidence is always valid**
  - Assert: `result.confidence in {"high", "medium", "low"}`
  - Depends on: Step 6
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 4.3, 4.5**

🚦 CHECKPOINT 1: Backend schema and API solid
  - Run: `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
  - Verify: All tests pass including new property tests. Manually test batch endpoint via curl:
    `curl -X POST http://localhost:8000/training/exercises/batch-overload-suggestions -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"exercise_names": ["Bench Press", "Squat"]}'`
  - Gate: 0 test failures, batch endpoint returns 200 with suggestions dict

═══════════════════════════════════════════════
PHASE 2: FRONTEND — PURE UTILITY FUNCTIONS
═══════════════════════════════════════════════
(Parallelizable with Phase 1 after Step 3)

- [x] 10. Create plate calculator utility
  - File: `app/utils/plateCalculator.ts` (C)
  - Export `calculatePlates(targetWeightKg: number, barWeightKg?: number, unitSystem?: UnitSystem): PlateBreakdown`
  - Export interface `PlateBreakdown { barWeightKg: number; totalWeightKg: number; platesPerSide: Array<{ weightKg: number; count: number }>; achievableWeightKg: number; isExact: boolean; }`
  - Algorithm: Subtract bar (default 20kg). Divide by 2 for per-side weight. Greedy fill from largest plate down.
  - Metric plates: `[25, 20, 15, 10, 5, 2.5, 1.25]` kg. Imperial plates: `[20.4117, 15.876, 11.34, 4.536, 2.268, 1.134]` kg (converted from `[45, 35, 25, 10, 5, 2.5]` lbs).
  - Edge cases: weight <= bar → return `{ platesPerSide: [], achievableWeightKg: barWeightKg, isExact: true }`. Weight 0 → same.
  - Depends on: Step 3
  - Risk: 🟢 Low — pure math, no side effects
  - Rollback: Delete file
  - Time: S
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 11. Write property tests for plate calculator
  - File: `app/__tests__/utils/plateCalculator.test.ts` (C)
  - **Property 20: Plate calculator round-trip** — `fc.float({ min: 0, max: 500 })` → plates per side × 2 + bar = achievableWeightKg
  - **Property 21: Plate calculator minimum plates** — no combination with fewer total plates achieves the same weight
  - Unit tests: weight=0, weight=20 (bar only), weight=21.25 (bar+1.25), weight=200, weight=20.5 (impossible exact → nearest achievable)
  - Depends on: Step 10
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 14.1, 14.2, 14.3, 14.5**

- [x] 12. Create volume aggregator utility
  - File: `app/utils/volumeAggregator.ts` (C)
  - Export `aggregateVolume(weeklyApiData: MuscleVolumeEntry[], activeExercises: ActiveExercise[], exerciseMuscleGroupMap: Record<string, string>): MuscleVolumeEntry[]`
  - Export interface `MuscleVolumeEntry { muscleGroup: string; currentSets: number; mavLow: number; mavHigh: number; }`
  - Logic: Start with API weekly data. For each active exercise with completed normal sets, look up muscle group from map, add completed set count to the corresponding entry.
  - Depends on: Step 3
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 13. Write property tests for volume aggregator
  - File: `app/__tests__/utils/volumeAggregator.test.ts` (C)
  - **Property 9: Volume aggregation combines weekly and active sets correctly**
  - Generate random weekly data and active exercises with fast-check. Verify aggregated count = API count + active completed normal sets per muscle group.
  - Depends on: Step 12
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 14. Create rest timer logic utilities
  - File: `app/utils/restTimerLogic.ts` (C)
  - Export `adjustTime(remaining: number, delta: number): number` — clamp result to >= 0
  - Export `getTimerColor(remaining: number, total: number): 'green' | 'yellow' | 'red'` — green when remaining > total/2, yellow when remaining > 10 && remaining <= total/2, red when remaining <= 10
  - Export `resolveRestDuration(exerciseName: string, exerciseOverrides: Record<string, number>, compoundDefault: number, isolationDefault: number, exerciseDb: Array<{name: string; category: string}>): number` — per-exercise override > compound/isolation default based on exercise category
  - Depends on: Step 3
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 8.3, 8.6, 8.7_

- [x] 15. Write property tests for rest timer logic
  - File: `app/__tests__/utils/restTimerLogic.test.ts` (C)
  - **Property 11:** `adjustTime(remaining, delta)` always >= 0 for any remaining >= 0
  - **Property 12:** `getTimerColor` returns correct color for all remaining/total combinations
  - **Property 13:** `resolveRestDuration` uses correct precedence (override > compound/isolation)
  - Depends on: Step 14
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 8.3, 8.6, 8.7, 17.5**

- [x] 16. Create weight stepper utility
  - File: `app/utils/weightStepper.ts` (C)
  - Export `stepWeight(currentKg: number, direction: 'up' | 'down', unitSystem: UnitSystem): number`
  - Metric: ±2.5 kg. Imperial: ±5 lbs (2.26796 kg). Floor at 0 for decrement.
  - Uses existing `convertWeight` from `app/utils/unitConversion.ts` for lbs→kg conversion.
  - Depends on: Step 3
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 3.1, 3.2_

- [x] 17. Write property tests for weight stepper
  - File: `app/__tests__/utils/weightStepper.test.ts` (C)
  - **Property 6:** Result always >= 0. Increment increases by correct step. Decrement decreases by correct step with floor 0.
  - Depends on: Step 16
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 3.1, 3.2**

- [x] 18. Create workout summary utility
  - File: `app/utils/workoutSummary.ts` (C)
  - Export `computeWorkoutSummary(exercises: ActiveExercise[]): { exerciseCount: number; setCount: number; totalVolumeKg: number; }`
  - exerciseCount = exercises where `skipped !== true`. setCount = sets where `completed === true`. totalVolumeKg = Σ(parseFloat(weight) × parseInt(reps)) for completed sets.
  - Depends on: Step 3
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 10.1, 10.2_

- [x] 19. Write property tests for workout summary
  - File: `app/__tests__/utils/workoutSummary.test.ts` (C)
  - **Property 15:** Counts and volume match manual calculation for any generated workout state.
  - Depends on: Step 18
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 10.1, 10.2**

- [x] 20. Create duration formatter utility
  - File: `app/utils/durationFormat.ts` (C)
  - Export `formatDuration(elapsedSeconds: number): string` — "MM:SS" when < 3600, "H:MM:SS" when >= 3600. Pad minutes and seconds with leading zeros.
  - Depends on: Step 3
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 9.2_

- [x] 21. Write property tests for duration formatter
  - File: `app/__tests__/utils/durationFormat.test.ts` (C)
  - **Property 14:** Format matches /^\d{1,2}:\d{2}$/ for < 3600s, /^\d+:\d{2}:\d{2}$/ for >= 3600s. Values are correct.
  - Depends on: Step 20
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 9.2**

🚦 CHECKPOINT 2: Frontend utilities solid
  - Run: `cd app && npx jest --passWithNoTests`
  - Verify: All new utility tests pass. All existing tests still pass.
  - Gate: 0 test failures

═══════════════════════════════════════════════
PHASE 3: FRONTEND — STORE ENHANCEMENTS
═══════════════════════════════════════════════

- [x] 22. Add `rir` field to `ActiveSet` type and update store
  - File: `app/types/training.ts` (M)
    - Add `rir: string;` to `ActiveSet` interface (after `rpe: string;`)
    - Update `updateSetField` signature: change `field: 'weight' | 'reps' | 'rpe'` to `field: 'weight' | 'reps' | 'rpe' | 'rir'` in `ActiveWorkoutActions`
    - Add `rir: number | null;` to the set payload in `ActiveWorkoutPayload.exercises[].sets[]`
  - File: `app/store/activeWorkoutSlice.ts` (M)
    - Update `makeEmptySet` to include `rir: ''`
    - `updateSetField` already uses `[field]: value` dynamic key — the type union change is sufficient
  - File: `app/utils/sessionEditConversion.ts` (M) — if `activeExercisesToPayload` exists here, add `rir: s.rir ? parseInt(s.rir, 10) : null` to the set mapping
  - Depends on: Steps 3, 4 (backend schema must accept rir first)
  - Risk: 🟢 Low — additive change, empty string default means no behavior change for existing flows
  - Rollback: Revert the 3 files
  - Time: S
  - _Requirements: 7.1, 7.5_

- [x] 23. Add rest timer state fields to store
  - File: `app/types/training.ts` (M)
    - Add to `ActiveWorkoutState`: `restTimerActive: boolean; restTimerExerciseName: string; restTimerDuration: number; restTimerStartedAt: string | null;`
    - Add to `ActiveWorkoutActions`: `startRestTimer: (exerciseName: string, duration: number) => void; dismissRestTimer: () => void;`
  - File: `app/store/activeWorkoutSlice.ts` (M)
    - Add default state fields: `restTimerActive: false, restTimerExerciseName: '', restTimerDuration: 0, restTimerStartedAt: null`
    - Add `startRestTimer` action: sets `restTimerActive: true, restTimerExerciseName, restTimerDuration, restTimerStartedAt: new Date().toISOString()`
    - Add `dismissRestTimer` action: sets `restTimerActive: false, restTimerExerciseName: '', restTimerStartedAt: null`
    - Modify `toggleSetCompleted`: after successful completion (returned `completed: true`), call `startRestTimer` with the exercise name and resolved duration. Import `resolveRestDuration` from `app/utils/restTimerLogic.ts`.
  - Depends on: Steps 14, 22
  - Risk: 🟡 Medium — modifying toggleSetCompleted side effect; must not break existing completion logic
  - Rollback: Revert both files
  - Time: M
  - _Requirements: 8.1, 2.3_

- [x] 24. Add overload suggestions and volume data fields to store
  - File: `app/types/training.ts` (M)
    - Add to `ActiveWorkoutState`: `overloadSuggestions: Record<string, OverloadSuggestion | null>; weeklyVolumeData: MuscleVolumeEntry[];`
    - Add `OverloadSuggestion` type: `{ exercise_name: string; suggested_weight_kg: number; suggested_reps: number; reasoning: string; confidence: 'high' | 'medium' | 'low'; }`
    - Import `MuscleVolumeEntry` from `app/utils/volumeAggregator.ts`
    - Add to `ActiveWorkoutActions`: `setOverloadSuggestions: (data: Record<string, OverloadSuggestion | null>) => void; setWeeklyVolumeData: (data: MuscleVolumeEntry[]) => void;`
  - File: `app/store/activeWorkoutSlice.ts` (M)
    - Add default state: `overloadSuggestions: {}, weeklyVolumeData: []`
    - Add simple setter actions for both
  - Depends on: Steps 12, 22
  - Risk: 🟢 Low — additive state fields with setter actions
  - Rollback: Revert both files
  - Time: S
  - _Requirements: 4.1, 5.1_

- [x] 25. Write property tests for store enhancements
  - File: `app/__tests__/store/activeWorkoutSlice.test.ts` (M — file already exists)
  - **Property 22: Crash recovery round-trip** — start workout, add exercises/sets, persist, restore, verify equivalent state including new `rir` field
  - **Property 23: Exercise reorder preserves all exercises** — reorder produces same exercises in different order
  - **Property 24: Exercise skip preserves structure** — toggle skip doesn't modify sets
  - **Property 18: Exercise swap preserves set data** — only name changes, all set fields (including rir) preserved
  - Depends on: Steps 22, 23, 24
  - Risk: 🟢 Low
  - Time: M
  - **Validates: Requirements 15.1, 15.3, 17.1, 17.2, 12.2**

🚦 CHECKPOINT 3: Store enhancements solid
  - Run: `cd app && npx jest --passWithNoTests`
  - Verify: All store tests pass. Existing `activeWorkoutSlice.test.ts` tests still pass. New property tests pass.
  - Gate: 0 test failures, store rehydration from AsyncStorage works with new fields

═══════════════════════════════════════════════
PHASE 4: FRONTEND — UI COMPONENTS
═══════════════════════════════════════════════

- [x] 26. Create `SetRowPremium` component
  - File: `app/components/training/SetRowPremium.tsx` (C)
  - Props: `SetRowPremiumProps` (defined in design doc). Key props: `set`, `previousSet`, `isCompleted`, `unitSystem`, `showRpeRir`, `rpeMode`, `onToggleComplete`, `onCopyPrevious`, `onUpdateField`, `onWeightStep`.
  - Layout: `[#] [Previous: 80kg×8 ⬅] [Reps input] [Weight input with ±] [RPE/RIR input] [✓ checkmark]`
  - Completed state: green background tint (`rgba(0, 255, 100, 0.08)`), left border accent (3px `colors.semantic.positive`)
  - Uncompleted state: muted opacity (0.7)
  - Previous performance: show `previousSet.weightKg × previousSet.reps` in muted text. Tappable — calls `onCopyPrevious`.
  - Weight stepper: +/- buttons flanking the weight input. Call `onWeightStep('up'|'down')`.
  - Auto-advance: `onSubmitEditing` on reps → focus weight ref. Weight → focus RPE/RIR ref (if visible). RPE/RIR → call `onToggleComplete`.
  - RPE/RIR: conditionally rendered based on `showRpeRir` and `rpeMode` props. Hidden by default.
  - Follow project rules: `useCallback` declared before use, no temporal dead zone.
  - Depends on: Steps 16, 22
  - Risk: 🟡 Medium — complex component with many interactions; keyboard focus management is tricky in React Native
  - Rollback: Delete file
  - Time: L
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.5, 3.1, 3.2, 3.3, 3.4, 7.2, 7.3, 7.4, 18.2_

- [x] 27. Create `ExerciseCardPremium` component
  - File: `app/components/training/ExerciseCardPremium.tsx` (C)
  - Props: `exercise: ActiveExercise`, `previousPerformance: PreviousPerformanceData | null`, `overloadSuggestion: OverloadSuggestion | null`, `unitSystem: UnitSystem`, `showRpeRir: boolean`, `rpeMode: 'rpe' | 'rir'`, `onSwap`, `onSkip`, `onGenerateWarmUp`, `onRemove`, `onAddSet`, `onRemoveSet`, `onReorder` (drag handle)
  - Exercise name: `typography.size.lg`, `typography.weight.bold` — larger than set row text
  - Progress indicator: "2/4 sets ●●○○" — count completed sets / total sets, render filled/empty dots
  - Overload badge: render `OverloadBadge` component below exercise name when suggestion exists
  - Action menu: "..." button → ActionSheet with: Swap Exercise, Skip, Generate Warm-Up, Add Note, Set Rest Timer, Remove
  - Per-exercise notes: collapsible `TextInput`, hidden by default, toggled from action menu
  - Skipped state: entire card at opacity 0.4, "SKIPPED" badge overlay
  - Drag handle: hamburger icon on left side for reorder (wired to drag gesture in parent)
  - Renders `SetRowPremium` for each set in `exercise.sets`
  - Depends on: Steps 26, 18
  - Risk: 🟡 Medium — large component; keep it as a composition of smaller pieces
  - Rollback: Delete file
  - Time: L
  - _Requirements: 2.4, 4.1, 12.1, 13.1, 17.1, 17.2, 17.4, 17.5, 18.1_

- [x] 28. Create `OverloadBadge` component
  - File: `app/components/training/OverloadBadge.tsx` (C)
  - Props: `suggestion: OverloadSuggestion | null`, `unitSystem: UnitSystem`, `onApply: () => void`
  - Render: "💡 Try 27.5kg × 10 (+2.5kg)" with confidence dot (green=high, yellow=medium, gray=low)
  - Convert weight to user's unit system using `convertWeight` from `unitConversion.ts`
  - Tappable: calls `onApply` which auto-fills the suggestion into the next uncompleted set
  - If suggestion is null, render nothing
  - Depends on: Step 24
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 4.1, 4.6_

- [x] 29. Create `VolumePills` component
  - File: `app/components/training/VolumePills.tsx` (C)
  - Props: `muscleVolumes: MuscleVolumeEntry[]`
  - Render: Horizontal `ScrollView` with pills. Each pill: "Chest: 8/16 (MAV: 14-18)"
  - Color coding: green background when `currentSets` within `[mavLow, mavHigh]`, yellow when `currentSets > mavHigh * 0.9`, red when `currentSets > mavHigh`
  - Depends on: Step 12
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 5.1, 5.4_

- [x] 30. Create `FloatingRestTimerBar` component
  - File: `app/components/training/FloatingRestTimerBar.tsx` (C)
  - Props: `durationSeconds: number`, `isActive: boolean`, `exerciseName: string`, `onComplete: () => void`, `onDismiss: () => void`
  - Layout: Absolute positioned at bottom of screen (above StickyFinishBar). Height ~80px.
  - Contains: Circular SVG progress ring (reuse `ProgressRing` pattern from `app/components/common/ProgressRing.tsx`), countdown text, exercise name, +15s/-15s buttons, pause/resume toggle, skip/dismiss button.
  - Internal state: `remaining` (countdown), `paused` (boolean). Uses `useEffect` interval for countdown.
  - Color: Uses `getTimerColor(remaining, durationSeconds)` from `restTimerLogic.ts` to set ring color.
  - Haptic: On completion, call `hapticNotification('success')` from existing `useHaptics` hook.
  - Sound: Reuse existing `timer-done.mp3` asset from `RestTimer.tsx`.
  - When `isActive` becomes false, hide the bar.
  - Depends on: Steps 14, 23
  - Risk: 🟡 Medium — timer accuracy, background state handling, layout positioning above finish bar
  - Rollback: Delete file
  - Time: M
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 31. Create `StickyFinishBar` component
  - File: `app/components/training/StickyFinishBar.tsx` (C)
  - Props: `exerciseCount: number`, `setCount: number`, `durationFormatted: string`, `onFinish: () => void`, `loading: boolean`
  - Layout: Absolute positioned at very bottom. Full width. Height ~60px.
  - Contains: Mini summary text "5 exercises · 18 sets · 45 min" and "Finish Workout" button.
  - Button: `disabled={loading}` per project rules. Teal background matching existing accent.
  - Depends on: Steps 18, 20
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 10.1_

- [x] 32. Create `FinishConfirmationSheet` bottom sheet
  - File: `app/components/training/FinishConfirmationSheet.tsx` (C)
  - Uses `@gorhom/bottom-sheet` `BottomSheet` component.
  - Props: `visible: boolean`, `summary: WorkoutSummary`, `prs: PersonalRecordResponse[]`, `onConfirm: () => void`, `onSaveAsTemplate: () => void`, `onCancel: () => void`
  - Content: Total volume (formatted in user's unit system), PRs list, duration, exercise breakdown, "Save as Template" toggle/button, Confirm/Cancel buttons.
  - Depends on: Steps 1 (bottom-sheet installed), 18
  - Risk: 🟡 Medium — first use of @gorhom/bottom-sheet in codebase; may need GestureHandlerRootView wrapper
  - Rollback: Delete file
  - Time: M
  - _Requirements: 10.2, 10.3, 10.4_

- [x] 33. Create `ExercisePickerSheet` bottom sheet
  - File: `app/components/training/ExercisePickerSheet.tsx` (C)
  - Uses `@gorhom/bottom-sheet` with snap points `['75%', '95%']`.
  - Content: Search input at top, recent exercises section (last 10 used — fetch from API), muscle group filter chips, exercise list (reuse existing exercise search API `GET /training/exercises/search?q=`).
  - On select: calls `onSelect(exerciseName: string)` prop and closes sheet.
  - Depends on: Step 1 (bottom-sheet installed)
  - Risk: 🟡 Medium — integrating search + filters in a bottom sheet; keyboard handling inside sheets can be tricky
  - Rollback: Delete file
  - Time: M
  - _Requirements: 19.1, 19.2, 19.3_

- [x] 34. Create `PlateCalculatorSheet` bottom sheet
  - File: `app/components/training/PlateCalculatorSheet.tsx` (C)
  - Uses `@gorhom/bottom-sheet` with snap point `['40%']`.
  - Props: `weightKg: number`, `unitSystem: UnitSystem`, `visible: boolean`, `onClose: () => void`
  - Content: Visual plate layout. Each plate as a colored rectangle with weight label. Shows "per side" breakdown. Uses `calculatePlates` from `plateCalculator.ts`.
  - If `!isExact`, show "Nearest achievable: X kg" note.
  - Depends on: Steps 1, 10
  - Risk: 🟢 Low
  - Rollback: Delete file
  - Time: S
  - _Requirements: 14.1, 14.6_

- [x] 35. Create `PRCelebration` overlay component
  - File: `app/components/training/PRCelebration.tsx` (C)
  - Props: `prs: PersonalRecordResponse[]`, `visible: boolean`, `onDismiss: () => void`
  - Full-screen overlay with confetti animation (use `react-native-reanimated` for particle system or a simple animated View pattern).
  - Shows PR banner: "🏆 New PR! Bench Press 80kg × 8"
  - Auto-dismisses after 3 seconds via `setTimeout`, or on tap.
  - If multiple PRs, show them stacked.
  - Depends on: Step 3
  - Risk: 🟡 Medium — animation complexity; keep it simple for v1 (animated opacity + scale, not full particle confetti)
  - Rollback: Delete file
  - Time: M
  - _Requirements: 6.1, 6.2_

🚦 CHECKPOINT 4: Components render correctly
  - Run: `cd app && npx jest --passWithNoTests`
  - Verify: All tests pass. Manually verify each component renders in isolation (create a temporary test screen if needed).
  - Gate: 0 test failures, components render without crashes

═══════════════════════════════════════════════
PHASE 5: FRONTEND — SCREEN ASSEMBLY & NAVIGATION
═══════════════════════════════════════════════

- [x] 36. Create `ActiveWorkoutScreen`
  - File: `app/screens/training/ActiveWorkoutScreen.tsx` (C)
  - This is the main screen that assembles all components from Phase 4.
  - **Header:** Workout date (from `useActiveWorkoutStore().sessionDate`), duration timer (uses `formatDuration` + `useEffect` interval counting from `startedAt`), overflow menu ("..." with Discard option — shows confirmation Alert before calling `discardWorkout()`).
  - **Body:** `ScrollView` with `keyboardShouldPersistTaps="handled"`.
    - `VolumePills` at top (data from `weeklyVolumeData` store field).
    - List of `ExerciseCardPremium` components. Each wired to store actions: `updateSetField`, `toggleSetCompleted`, `addSet`, `removeSet`, `removeExercise`, `swapExercise`, `toggleExerciseSkip`, `setExerciseNotes`, `insertWarmUpSets`, `copyPreviousToSet`.
    - "Add Exercise" button at bottom → opens `ExercisePickerSheet`.
  - **Bottom overlay stack** (absolute positioned, bottom-up): `StickyFinishBar` (always visible) → `FloatingRestTimerBar` (visible when `restTimerActive`).
  - **On mount:** Fetch batch previous performance (`POST /training/exercises/batch-previous-performance`), batch overload suggestions (`POST /training/exercises/batch-overload-suggestions`), weekly volume (`GET /training/analytics/muscle-volume`). Store results via `setPreviousPerformance`, `setOverloadSuggestions`, `setWeeklyVolumeData`.
  - **Finish flow:** StickyFinishBar `onFinish` → open `FinishConfirmationSheet` → on confirm → call `finishWorkout()` to get payload → `POST /training/sessions` → on success with PRs → show `PRCelebration` → clear store → navigate back.
  - **Save as Template:** In FinishConfirmationSheet, "Save as Template" → prompt for name → `POST /training/user-templates` with exercises from the workout.
  - **Feature flag gate:** Read `premium_workout_logger` flag. If OFF, this screen should not be navigable (handled in Step 37).
  - Depends on: Steps 26-35 (all components), Steps 22-24 (store), Steps 10-20 (utilities)
  - Risk: 🔴 High — largest single file; many integrations. Keep it as a thin orchestrator that delegates to child components.
  - Rollback: Delete file, revert navigation changes
  - Time: XL
  - _Requirements: 1.1, 1.3, 2.1, 3.3, 3.4, 4.1, 5.1, 8.1, 9.1, 9.2, 9.3, 10.1, 17.3, 18.3_

- [x] 37. Wire navigation — register ActiveWorkoutScreen and add entry points
  - File: `app/navigation/BottomTabNavigator.tsx` (M) — or the stack navigator that contains training screens
  - Register `ActiveWorkoutScreen` in the stack navigator with route name `'ActiveWorkout'`.
  - Add `ActiveWorkoutScreenParams` to the navigator's param list type.
  - File: `app/screens/dashboard/DashboardScreen.tsx` (M)
  - The "Start Workout" / "Log Training" button: check feature flag `premium_workout_logger`. If ON → navigate to `'ActiveWorkout'` with `{ mode: 'new' }`. If OFF → open existing `AddTrainingModal`.
  - File: `app/App.tsx` (M)
  - Update crash recovery "Resume" alert: the "Resume" button should navigate to `'ActiveWorkout'` with `{ mode: 'new' }` (the store already has the state). Currently the Resume button does nothing — it just dismisses the alert.
  - Depends on: Step 36
  - Risk: 🟡 Medium — navigation wiring touches multiple files; must not break existing flows when flag is OFF
  - Rollback: Revert all 3 files
  - Time: M
  - _Requirements: 1.3, 15.2, 15.3, 15.4_

- [x] 38. Wire session submission and PR celebration flow
  - File: `app/screens/training/ActiveWorkoutScreen.tsx` (M)
  - On FinishConfirmationSheet confirm:
    1. Call `finishWorkout()` → get `ActiveWorkoutPayload`
    2. `POST /training/sessions` with payload (use `api.post('training/sessions', payload)`)
    3. On success: check `response.data.personal_records` array. If non-empty → show `PRCelebration` with PRs.
    4. On success: check `response.data.newly_unlocked` for achievements.
    5. Call `discardWorkout()` to clear store (which also clears AsyncStorage persistence).
    6. Navigate back to dashboard.
    7. On error: show error banner with retry. Do NOT clear store — preserve workout data.
  - "Save as Template" flow: `api.post('training/user-templates', { name, exercises: payload.exercises })`
  - Depends on: Steps 36, 37
  - Risk: 🟡 Medium — error handling must preserve workout state on failure
  - Rollback: Revert file
  - Time: M
  - _Requirements: 10.4, 15.5, 6.1_

- [x] 39. Wire warm-up generator into ExerciseCardPremium action menu
  - File: `app/components/training/ExerciseCardPremium.tsx` (M)
  - "Generate Warm-Up" action: get first working set's weight (first set where `setType === 'normal'` and `weight !== ''`). Call `generateWarmUpSets(parseFloat(weight), 20)` from existing `warmUpGenerator.ts`. Call `insertWarmUpSets(exercise.localId, warmUpSets)` store action.
  - If no working set has weight entered, show Alert: "Enter a working weight first."
  - Depends on: Step 27 (ExerciseCardPremium exists)
  - Risk: 🟢 Low — existing utility and store action, just wiring
  - Rollback: Remove the menu item
  - Time: S
  - _Requirements: 13.1, 13.3, 13.4_

- [x] 40. Write property tests for warm-up generator
  - File: `app/__tests__/utils/warmUpGenerator.test.ts` (C or M)
  - **Property 19: Warm-up generator produces valid ramp**
  - `fc.float({ min: 21, max: 300 })` for working weight. All generated weights >= 20 (bar), non-decreasing, all tagged "warm-up".
  - Edge case: working weight = 20 (bar) → empty array. Working weight = 22.5 → only bar × 10.
  - Depends on: Step 39
  - Risk: 🟢 Low
  - Time: S
  - **Validates: Requirements 13.1, 13.2, 13.3**

🚦 CHECKPOINT 5: Feature works end-to-end
  - Run: `cd app && npx jest --passWithNoTests` AND `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
  - Verify: All tests pass. On simulator: enable feature flag → tap "Start Workout" → add exercise → log sets with tap-to-copy → see overload badge → complete sets (green tint) → rest timer floats → finish workout → see summary sheet → confirm → PR celebration if applicable → back to dashboard.
  - Gate: Full happy path works on simulator. Feature flag OFF = old modal still works.

═══════════════════════════════════════════════
PHASE 6: INTEGRATION, EDGE CASES & POLISH
═══════════════════════════════════════════════

- [x] 41. Handle GestureHandlerRootView wrapper for bottom sheets
  - `@gorhom/bottom-sheet` requires `GestureHandlerRootView` as an ancestor. Check if `App.tsx` or `SafeAreaProvider` already wraps with it. If not:
  - File: `app/App.tsx` (M) — wrap the root `SafeAreaProvider` content with `<GestureHandlerRootView style={{ flex: 1 }}>`.
  - Import from `react-native-gesture-handler`.
  - Depends on: Step 37
  - Risk: 🟡 Medium — wrapping root can affect gesture handling in other screens; test thoroughly
  - Rollback: Remove the wrapper
  - Time: S

- [x] 42. Handle edge case: app backgrounded during rest timer
  - File: `app/components/training/FloatingRestTimerBar.tsx` (M)
  - Use `AppState` listener from `react-native`. On `active` (foreground): calculate elapsed time since `restTimerStartedAt`, subtract from duration, update `remaining`.
  - This ensures the timer stays accurate even if the app was backgrounded for 30 seconds.
  - Depends on: Step 30
  - Risk: 🟢 Low
  - Rollback: Remove AppState listener
  - Time: S
  - _Requirements: 8.1_

- [x] 43. Handle edge case: crash recovery navigation
  - File: `app/App.tsx` (M)
  - Current "Resume" button in the crash recovery Alert does nothing. Update it to:
    - If feature flag ON: navigate to `ActiveWorkout` screen (the store already has the persisted state).
    - If feature flag OFF: show the old `AddTrainingModal` pre-filled from store data (or just discard — the old modal doesn't support resume).
  - This requires a navigation ref. Use `React.createRef<NavigationContainerRef>()` and pass to `NavigationContainer`. Then `navigationRef.current?.navigate('ActiveWorkout')` in the Alert handler.
  - Depends on: Step 37
  - Risk: 🟡 Medium — navigation ref timing; the navigator may not be mounted when the alert fires. Use the existing 500ms delay + verify navigator is ready.
  - Rollback: Revert to current no-op Resume button
  - Time: M
  - _Requirements: 15.2, 15.3_

- [x] 44. Verify backward compatibility
  - Manually test: Create a training session via the OLD `AddTrainingModal` (feature flag OFF). Verify it saves correctly with no `rir` field. Verify the session appears in logs. Verify analytics still work.
  - Manually test: Create a training session via the NEW `ActiveWorkoutScreen` (feature flag ON) with RIR values. Verify it saves. Verify the old modal can still display sessions that have RIR data (it should just ignore the field).
  - Depends on: Step 38
  - Risk: 🟡 Medium — data format compatibility
  - Time: M

- [x] 45. Accessibility pass
  - All interactive elements in new components must have `accessibilityLabel` and `accessibilityRole`.
  - SetRowPremium: checkmark button → `accessibilityLabel="Complete set {n}"`, `accessibilityRole="button"`
  - Weight stepper: `accessibilityLabel="Increase weight"` / `"Decrease weight"`
  - OverloadBadge: `accessibilityLabel="Overload suggestion: Try {weight} times {reps}"`
  - FloatingRestTimerBar: timer → `accessibilityLabel="Rest timer: {remaining} seconds"`, `accessibilityRole="timer"`
  - Depends on: Steps 26-35
  - Risk: 🟢 Low
  - Time: S

🚦 CHECKPOINT 6: Production-ready
  - Run: Full test suite (backend + frontend). All pass.
  - Verify: Feature flag ON → full flow works. Feature flag OFF → old flow works unchanged. Crash recovery navigates correctly. Timer survives backgrounding. Backward compatibility confirmed.
  - Gate: Ready for code review.

═══════════════════════════════════════════════
POST-LAUNCH MONITORING
═══════════════════════════════════════════════

| What to Monitor | How | Alert Threshold | Action If Triggered |
|----------------|-----|-----------------|---------------------|
| Error rate (batch-overload-suggestions) | Backend logging / Sentry | > 1% of requests | Investigate; endpoint returns empty suggestions on failure (graceful degradation) |
| Latency (batch-overload-suggestions) | Backend metrics | p99 > 500ms | Review query plan; add index on session_date if needed |
| Crash rate (ActiveWorkoutScreen) | Sentry / Expo crash reports | Any increase > 0.1% | Disable feature flag `premium_workout_logger` immediately |
| Workout completion rate | Analytics (sessions saved / workouts started) | < 70% after 72h | Review UX friction points; check for submission errors |
| AsyncStorage persistence failures | Error logging in store | > 0.5% of set completions | Investigate storage limits; add cleanup for old persisted states |
| Feature adoption | Analytics (ActiveWorkoutScreen views / total workout starts) | < 20% eligible users after 72h | Review discoverability; check feature flag rollout percentage |
| Existing feature regression (AddTrainingModal) | Test suite + session creation metrics | Any degradation in old flow | Disable feature flag; investigate |
| REST timer accuracy | User reports / analytics | Timer drift > 2 seconds | Review AppState handling; check interval cleanup |

═══════════════════════════════════════════════
DEFERRED TO V2
═══════════════════════════════════════════════

| Item | Why Deferred | Effort Saved | When to Revisit |
|------|-------------|-------------|-----------------|
| ExerciseHistorySheet (Req 16) | Gold-plating — chart + PR timeline in bottom sheet is 4+ hrs; low retention impact vs speed/intelligence features | L (4+ hrs) | After launch metrics confirm users want in-workout history |
| SupersetBracket visual component | Superset logic already works in store; visual bracket is polish. Users can still create/use supersets without the bracket UI | M (2-3 hrs) | v2 sprint after core flow is stable |
| Drag-to-reorder with react-native-draggable-flatlist | Store action `reorderExercises` exists; drag UX requires new dependency + complex gesture handling | L (4+ hrs) | v2 — manual reorder via action menu is sufficient for v1 |
| "Copy from specific date" calendar picker (Req 17.3) | "Copy Last Workout" covers 80% of use cases; date picker adds complexity | M (2-3 hrs) | When user feedback requests it |
| Custom numeric keyboard bar | Nice-to-have for quick value selection (5, 8, 10, 12 for reps); standard keyboard works fine | M (2-3 hrs) | v2 polish sprint |
| Voice-to-text for notes | Platform-specific complexity; sweaty gym hands is a real problem but low priority vs core logging speed | L (4+ hrs) | v2 or v3 |
| 3D muscle activation maps | Requires 3D assets and rendering library; GymStreak differentiator but not core to logging | XL (8+ hrs) | When exercise database expansion is complete |
| Confetti particle system | v1 uses simple animated opacity + scale for PR celebration; full particle confetti is polish | M (2-3 hrs) | v2 polish sprint |

═══════════════════════════════════════════════
PLAN SUMMARY
═══════════════════════════════════════════════

Total steps: 45
Total phases: 7 (Phase 0-6)
Total checkpoints: 7
Estimated total time: 8-10 days (1 developer) / 5-6 days (2 developers — backend + frontend parallel after Phase 0)
Critical path: Phase 0 → Phase 1 (backend) → Phase 3 (store, needs backend schema) → Phase 4 → Phase 5 → Phase 6
Parallel path: Phase 2 (frontend utilities) can run alongside Phase 1
PR strategy: 3 PRs recommended:
  - PR 1: Phases 0-1 (backend schema + API + feature flag)
  - PR 2: Phases 2-3 (frontend utilities + store enhancements)
  - PR 3: Phases 4-6 (UI components + screen + integration)
New test count: ~20 property-based tests + ~15 unit tests
Backend changes: 2 files modified (schemas.py, router.py), 1 file modified (overload_service.py), 1 test file created
Frontend changes: ~15 new files (components + utilities), 4 files modified (types, store, App.tsx, navigator)

## Notes

- Tasks marked with `*` are property-based test tasks (optional for faster MVP but recommended)
- The existing `activeWorkoutSlice` already handles: crash recovery (AsyncStorage persist), supersets, exercise swap, warm-up insertion, previous performance copy, skip, notes, and reorder — these just need UI wiring
- Backend changes are minimal: RIR field addition and batch overload endpoint
- Feature flag `premium_workout_logger` is the kill switch — OFF = invisible, old flow unchanged
- `@gorhom/bottom-sheet` is the only new dependency; all other libraries are already installed
