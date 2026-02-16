# Training Workflow Redesign — Revised Implementation Plan

## Codebase Audit Summary (Pre-Execution)

**What already exists and MUST NOT be rebuilt:**
- `ActiveWorkoutScreen.tsx` (912 lines) — duration timer, set completion with haptics, RestTimerV2, PRBanner, superset grouping, previous performance display + copyPreviousToSet, set type selector, finish/discard flow, session date picker, notes, crash recovery via AsyncStorage, edit mode, template loading, copy-last-session
- `activeWorkoutSlice.ts` — full Zustand store with AsyncStorage persistence, all CRUD actions for exercises/sets/supersets
- `ExercisePickerScreen.tsx` — search with 300ms debounce, muscle group grid, recent exercises, exercise cards with images
- `TemplateService` — full CRUD for user templates (create, list, update, soft-delete)
- `VolumeCalculatorService` — weekly muscle volume with MEV/MAV/MRV landmarks
- `BatchPreviousPerformanceResolver` — batch fetch previous performance
- `PRDetector` — personal record detection on session creation
- `TrainingAnalyticsService` — volume trends, strength progression, e1RM history

**What does NOT exist and must be built:**
- Extended exercise schema (secondary_muscles, animation_url, instructions, tips, description)
- 400+ exercises (currently ~155)
- Self-hosted exercise images (currently GitHub-dependent)
- OverloadSuggestionService (backend)
- CustomExercise model + CRUD
- ExerciseDetailSheet (bottom sheet with instructions/animation)
- VolumeIndicatorPill (inline during workout)
- OverloadSuggestionBadge (inline during workout)
- RPE/RIR quick-select picker
- SVG progress ring for rest timer
- SessionDetailScreen (read-only session view)
- Equipment filter chips in exercise picker

**Missing dependency:** `@gorhom/bottom-sheet` — required for ExerciseDetailSheet. Must install before Phase E.

---

## Dependency Graph (Corrected)

```
Phase 0 (Baseline)
  │
  ├── Phase 1 (Exercise Schema Extension) ─── no UI deps, pure backend + types
  │     │
  │     ├── Phase 2 (Exercise Database Expansion) ─── depends on extended schema
  │     │     │
  │     │     ├── Phase 3a (Exercise Picker Enhancements) ─── depends on extended data
  │     │     ├── Phase 3b (Rest Timer SVG Ring) ─── independent, parallel with 3a
  │     │     └── Phase 3c (RPE/RIR Picker) ─── independent, parallel with 3a/3b
  │     │           │
  │     │     ── CHECKPOINT 1 ──
  │     │           │
  │     ├── Phase 4 (Intelligence Layer) ─── depends on Phase 1 schema + existing volume API
  │     │     │
  │     │     ── CHECKPOINT 2 ──
  │     │           │
  │     ├── Phase 5 (Exercise Detail Sheet) ─── depends on extended schema + npm install
  │     │     │
  │     ├── Phase 6 (Custom Exercises) ─── depends on Phase 1 schema, needs DB migration
  │     │     │
  │     │     ── CHECKPOINT 3 ──
  │     │           │
  │     └── Phase 7 (Session Detail Screen) ─── depends on extended exercise data
  │
  ── FINAL VALIDATION ──
```

Phases 3a, 3b, 3c are fully parallel (different files, no shared state).
Phase 4 depends on Phase 1 only (uses existing volume API, no Phase 2 dependency).
Phase 5 requires `@gorhom/bottom-sheet` install — do this in Phase 5 step 1.
Phase 6 requires Alembic migration — highest-risk phase for rollback.
Phase 7 is lowest risk (new read-only screen).

No circular dependencies.

---

## Phase 0: Baseline Verification

- [x] 0.1: Run `source .venv/bin/activate && python -m pytest tests/ -x -q` — record pass count (expect 921+). **Risk:** Python 3.9 `type | None` syntax error in test_adaptive_engine.py is pre-existing, ignore. **Rollback:** N/A.
- [x] 0.2: Run `npx jest --passWithNoTests` in project root — record pass count (expect 940+). **Risk:** Pre-existing timezone failures in activeWorkoutSlice.test.ts and paginationAndGrouping.test.ts, ignore. **Rollback:** N/A.
- [x] 0.3: Count exercises in `src/modules/training/exercises.py`: `python -c "from src.modules.training.exercises import EXERCISES; print(len(EXERCISES))"` — record count (expect ~155). Count exercises with `image_url is None`: `python -c "from src.modules.training.exercises import EXERCISES; print(sum(1 for e in EXERCISES if e.get('image_url') is None))"` — record count.
- [x] 0.4: Verify `app/types/exercise.ts` has exactly 6 fields: id, name, muscle_group, equipment, category, image_url. Confirm `secondary_muscles`, `animation_url`, `instructions`, `tips`, `description` do NOT exist yet.
- [x] 0.5: Git commit baseline: `git add -A && git commit -m "baseline before training-workflow-redesign"`

**Rollback:** N/A — this is the baseline.

---

## Phase 1: Exercise Schema Extension (Backend + Frontend Types)

> Pure schema changes. No data migration. No UI changes. Zero risk to existing functionality.
> Estimated effort: 0.5 day.

- [x] 1.1: In `src/modules/training/exercises.py`, add new fields to EVERY exercise dict with safe defaults. For each exercise, add: `"secondary_muscles": []`, `"description": None`, `"instructions": None`, `"tips": None`, `"animation_url": None`. Do NOT change existing fields (id, name, muscle_group, equipment, category, image_url). **Risk:** Large file edit (~155 exercises). **Mitigation:** Write a Python script `scripts/extend_exercise_schema.py` that reads the current EXERCISES list, adds defaults for missing fields, and writes back. Run it once. Verify with `python -c "from src.modules.training.exercises import EXERCISES; assert all('secondary_muscles' in e for e in EXERCISES)"`.

- [x] 1.2: Update `search_exercises()` in `exercises.py` to accept optional `equipment` and `category` filter params. Currently only accepts `query` and `muscle_group`. Add: `equipment: Optional[str] = None, category: Optional[str] = None`. Filter logic: if equipment provided, filter by `ex["equipment"] == equipment.lower()`; same for category. **Risk:** Breaking existing callers. **Mitigation:** New params are optional with None defaults — backward compatible. **Rollback:** Revert function signature.

- [x] 1.3: Update `GET /exercises/search` endpoint in `router.py` to pass new `equipment` and `category` query params to `search_exercises()`. Currently: `search_exercises(query=q, muscle_group=muscle_group)`. Change to: `search_exercises(query=q, muscle_group=muscle_group, equipment=equipment, category=category)`. Add `equipment: Optional[str] = Query(default=None)` and `category: Optional[str] = Query(default=None)` to endpoint params. **Risk:** None — additive. **Rollback:** Remove new params.

- [x] 1.4: Extend `app/types/exercise.ts` Exercise interface. Add: `secondary_muscles: string[]`, `description: string | null`, `instructions: string[] | null`, `tips: string[] | null`, `animation_url: string | null`, `is_custom?: boolean`. All new fields are nullable/optional — existing code that only reads the original 6 fields will not break. **Risk:** TypeScript strict mode may flag missing fields in test factories. **Mitigation:** Update any test helpers that create Exercise objects to include new fields with defaults. **Rollback:** Revert file.

- [x] 1.5: Write tests for Phase 1. Backend: In `tests/test_training_properties.py`, add tests: (a) every exercise in EXERCISES has all 11 fields (id, name, muscle_group, secondary_muscles, equipment, category, image_url, animation_url, description, instructions, tips), (b) `search_exercises(query="bench", equipment="barbell")` returns only barbell exercises, (c) `search_exercises(query="", muscle_group="chest", category="isolation")` returns only isolation chest exercises, (d) `secondary_muscles` is always a list (never None). Frontend: In `app/__tests__/utils/exerciseSchema.test.ts` (new file), add tests: (a) Exercise interface accepts all extended fields, (b) Exercise with only original 6 fields plus defaults is valid. Run both test suites. **Risk:** None. **Rollback:** Delete new test files.

**CHECKPOINT 1A:** Run `pytest tests/test_training_properties.py` — all pass. Run `npx jest app/__tests__/utils/exerciseSchema.test.ts` — all pass. Run full suites — no regressions. **Gate:** Do NOT proceed to Phase 2 until all Phase 1 tests pass.

---

## Phase 2: Exercise Database Expansion

> Estimated effort: 2-3 days.

- [x] 2.1: Create `scripts/import_wger.py`. Script fetches exercises from wger public API (`https://wger.de/api/v2/exercise/?format=json&language=2&limit=500`), maps wger muscle categories to our 13 muscle groups, downloads SVG images from wger CDN, generates exercise dicts with all 11 fields. Output: writes updated EXERCISES list to `exercises.py`. **Risk:** wger API rate limiting or downtime. **Mitigation:** Cache API responses locally in `scripts/wger_cache/` so script is idempotent. **Rollback:** Revert `exercises.py` to Phase 1 version.

- [x] 2.2: Create `scripts/enrich_exercisedb.py`. Script downloads ExerciseDB v1 dataset (free, from exercisedb.dev), fuzzy-matches exercises by name (using difflib.SequenceMatcher, threshold 0.85), pulls animated GIF URLs for matched exercises, sets `animation_url` field. **Risk:** Name mismatches between databases. **Mitigation:** Log all matches with confidence scores, manually review matches below 0.90. **Rollback:** Set all `animation_url` back to None.

- [x] 2.3: Run import scripts. Execute `python scripts/import_wger.py` then `python scripts/enrich_exercisedb.py`. Verify: `python -c "from src.modules.training.exercises import EXERCISES; print(len(EXERCISES))"` returns >= 400. Verify: `python -c "from src.modules.training.exercises import EXERCISES; print(sum(1 for e in EXERCISES if e.get('image_url')))"` shows >= 95% have images. Verify: `python -c "from src.modules.training.exercises import EXERCISES; print(sum(1 for e in EXERCISES if e.get('animation_url')))"` shows >= 50% have animations. **Risk:** Exercise count or image coverage below target. **Mitigation:** Manually add missing exercises from free-exercise-db GitHub repo (800+ exercises, MIT license) as tertiary source.

- [x] 2.4: Replace `_IMG` base URL. Change from `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises` to a local path or CDN path. For v1, use relative paths that resolve to `static/exercises/` served by the backend. **Risk:** Broken image URLs. **Mitigation:** Write a validation script that checks every `image_url` resolves to an existing file. **Rollback:** Revert `_IMG` to original GitHub URL.

- [x] 2.5: Populate `secondary_muscles` for all exercises. For each exercise, set the secondary_muscles list based on exercise_mapping.py data and standard kinesiology (e.g., Bench Press: primary=chest, secondary=["triceps", "shoulders"]). **Risk:** Incorrect muscle mappings. **Mitigation:** Cross-reference with wger muscle data and ExerciseDB target/synergist data. **Rollback:** Set all secondary_muscles back to [].

- [x] 2.6: Write tests for Phase 2. In `tests/test_training_properties.py`, add: (a) exercise count >= 400, (b) all 13 muscle groups have >= 10 exercises each, (c) >= 95% of exercises have non-None image_url, (d) >= 90% have non-None animation_url, (e) no duplicate exercise IDs, (f) all exercise IDs are valid kebab-case strings. Run tests. **Risk:** None. **Rollback:** Delete new tests.

**CHECKPOINT 2A:** Run `pytest tests/test_training_properties.py` — all pass including new Phase 2 tests. Run `npx jest` — no regressions (frontend unchanged). Verify `GET /exercises` returns 400+ exercises with extended fields. **Gate:** Do NOT proceed to Phase 3 until exercise count >= 400 and image coverage >= 95, >= 90% have non-None animation_url.

---

## Phase 3a: Exercise Picker Enhancements

> Estimated effort: 1 day. Parallel with 3b, 3c.

- [x] 3a.1: Add equipment filter chips to `ExercisePickerScreen.tsx`. Below the search bar, add a horizontal ScrollView of filter chips: "All", "Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Band", "Kettlebell". Tapping a chip filters the exercise list by equipment type (client-side filter on the already-fetched exercise list). **Risk:** None — additive UI. **Rollback:** Remove filter chips.

- [x] 3a.2: Update `ExerciseCard.tsx` to show exercise image as 48x48 circular thumbnail. Currently shows emoji placeholder. Change: if `exercise.image_url` is non-null, render `Image` component with `borderRadius: 24`; else fall back to existing emoji placeholder. **Risk:** Image loading performance with 400+ exercises. **Mitigation:** Use `Image` with `resizeMode="cover"` and add a loading placeholder. **Rollback:** Revert ExerciseCard.

- [x] 3a.3: Add exercise count per muscle group on `MuscleGroupGrid.tsx` tiles. Each tile currently shows muscle group name + emoji. Add a small count badge showing number of exercises in that group (computed from the fetched exercise list). **Risk:** None — additive. **Rollback:** Remove count badge.

- [x] 3a.4: Write tests. In `app/__tests__/components/ExercisePickerEnhancements.test.ts` (new file): (a) equipment filter reduces exercise list correctly, (b) exercise count per muscle group matches actual data, (c) ExerciseCard renders image when image_url is present, (d) ExerciseCard renders placeholder when image_url is null. **Risk:** None. **Rollback:** Delete test file.

---

## Phase 3b: Rest Timer SVG Ring

> Estimated effort: 1 day. Parallel with 3a, 3c.

- [x] 3b.1: Create `app/components/training/RestTimerRing.tsx`. Uses `react-native-svg` (already installed) to render a circular progress arc. Props: `durationSeconds`, `remainingSeconds`, `paused`. Visual: full circle = total duration, arc decreases as time passes. Color: green (>10s) → yellow (5-10s) → red (<=5s). Center text: remaining time in M:SS. **Risk:** SVG animation performance on low-end devices. **Mitigation:** Use `Animated` API for smooth transitions, avoid re-rendering entire SVG on each tick — only update the arc path. **Rollback:** Delete file.

- [x] 3b.2: Create `app/components/training/RestTimerOverlay.tsx`. Full-screen overlay wrapping RestTimerRing with controls: [-15s] [Pause/Resume] [+15s] [Skip]. Auto-starts countdown. Plays notification sound on completion (use `expo-av` Audio, already installed). Shows "Rest Complete" text when done. **Risk:** Sound playback on web vs native. **Mitigation:** Wrap sound in try/catch, degrade gracefully on web. **Rollback:** Delete file.

- [x] 3b.3: Replace `RestTimerV2` usage in `ActiveWorkoutScreen.tsx` with `RestTimerOverlay`. Find the `RestTimerV2` import and JSX usage, replace with `RestTimerOverlay`. Pass same props (duration, visible, onDismiss). **Risk:** Breaking existing rest timer flow. **Mitigation:** Keep RestTimerV2 file intact as fallback — only change the import in ActiveWorkoutScreen. **Rollback:** Revert import to RestTimerV2.

- [x] 3b.4: Write tests. In `app/__tests__/components/RestTimerRing.test.ts` (new file): (a) color is green when remaining > 10s, (b) color is yellow when 5-10s, (c) color is red when <= 5s, (d) pause stops countdown, (e) +15s/-15s adjusts remaining, (f) skip dismisses immediately. **Risk:** None. **Rollback:** Delete test file.

---

## Phase 3c: RPE/RIR Quick-Select Picker

> Estimated effort: 0.5 day. Parallel with 3a, 3b.

- [x] 3c.1: Create `app/components/training/RPEPicker.tsx`. A compact picker component that shows when user taps the RPE/RIR field in a set row. Two modes: RPE mode shows buttons [6] [7] [8] [9] [10]; RIR mode shows buttons [4+] [3] [2] [1] [0]. Tapping a value calls `onSelect(value)` and dismisses. **Risk:** None — new component. **Rollback:** Delete file.

- [x] 3c.2: Add RPE/RIR mode toggle to user preferences. In `app/store/index.ts`, add `rpeMode: 'rpe' | 'rir'` to the store state with default `'rpe'`. Add `setRpeMode` action. Persist via existing store persistence. **Risk:** Store schema change. **Mitigation:** New field with default — backward compatible with existing persisted state. **Rollback:** Remove field.

- [x] 3c.3: Integrate RPEPicker into ActiveWorkoutScreen. In the set row RPE field, replace the plain TextInput with a tappable field that opens RPEPicker. When RIR mode is active, convert RIR to RPE for storage (RIR 0 = RPE 10, RIR 1 = RPE 9, etc.). Display the value in the user's preferred mode. **Risk:** Modifying ActiveWorkoutScreen set row rendering. **Mitigation:** Only change the RPE input field — do not touch weight/reps/checkmark logic. **Rollback:** Revert RPE field to TextInput.

- [x] 3c.4: Write tests. In `app/__tests__/components/RPEPicker.test.ts` (new file): (a) RPE mode shows values 6-10, (b) RIR mode shows values 0-4+, (c) RIR 0 converts to RPE 10, (d) RIR 3 converts to RPE 7, (e) mode toggle persists. **Risk:** None. **Rollback:** Delete test file.

**CHECKPOINT 1:** Run all new test files from 3a.4, 3b.4, 3c.4. Run `npx jest` — full suite passes. Run `pytest` — full suite passes. Manual smoke test: open exercise picker, verify filter chips and image thumbnails. Start workout, complete a set, verify new rest timer ring appears. Tap RPE field, verify picker appears. **Gate:** Do NOT proceed to Phase 4 until all Phase 3 tests pass.

---

## Phase 4: Intelligence Layer

> Estimated effort: 2-3 days.

- [x] 4.1: Create `src/modules/training/overload_service.py`. Class `OverloadSuggestionService` with method `async get_suggestion(user_id, exercise_name) -> Optional[OverloadSuggestion]`. Algorithm: fetch last 3-5 sessions for this exercise from DB, if < 3 return None, compute avg RPE, if avg RPE < 7 suggest weight increase (+2.5kg barbell, +1kg dumbbell — determine equipment from exercise_mapping), if RPE 7-9 suggest same weight +1 rep, if RPE > 9 suggest maintain. Return OverloadSuggestion with exercise_name, suggested_weight_kg, suggested_reps, reasoning string, confidence ("high"/"medium"/"low"). **Risk:** Incorrect suggestions for edge cases. **Mitigation:** Return None for any ambiguous case — suggestions are non-blocking. **Rollback:** Delete file.

- [x] 4.2: Add `OverloadSuggestion` Pydantic model to `schemas.py`. Fields: exercise_name (str), suggested_weight_kg (float), suggested_reps (int), reasoning (str), confidence (str). **Risk:** None — additive schema. **Rollback:** Remove model.

- [x] 4.3: Add `GET /exercises/{exercise_name}/overload-suggestion` endpoint to `router.py`. Requires auth. Calls OverloadSuggestionService. Returns OverloadSuggestion or 204 No Content if insufficient data. **Risk:** None — new endpoint. **Rollback:** Remove endpoint.

- [x] 4.4: Write backend tests. In `tests/test_overload_suggestion_properties.py` (new file): (a) returns None when < 3 sessions exist, (b) suggests weight increase when avg RPE < 7, (c) suggests rep increase when avg RPE 7-9, (d) suggests maintain when avg RPE > 9, (e) returns correct equipment-specific increment (2.5kg for barbell, 1kg for dumbbell), (f) confidence is "high" when 5+ sessions, "medium" when 3-4, (g) handles exercises with no RPE data (treat as RPE 7.5 default). **Risk:** None. **Rollback:** Delete test file.

- [x] 4.5: Create `app/components/training/OverloadSuggestionBadge.tsx`. Displays below exercise name in ActiveWorkoutScreen: "💡 Try {weight}{unit} × {reps} ({reasoning})". Dismissible via X button. Non-blocking — user can ignore. Fetches suggestion from `GET /exercises/{name}/overload-suggestion` on workout start. Shows skeleton while loading, nothing if no suggestion. **Risk:** None — new component. **Rollback:** Delete file.

- [x] 4.6: Create `app/components/training/VolumeIndicatorPill.tsx`. Displays above exercise card: "Chest: 12/16 sets" with color coding. Below MEV = red, MEV-MAV = yellow, MAV-MRV = green, above MRV = red. Fetches weekly volume from existing `GET /analytics/muscle-volume` endpoint on workout start. Updates count in real-time when sets are completed (local state increment, not re-fetch). **Risk:** Stale data if user has logged sets in another session today. **Mitigation:** Fetch fresh data on workout start — acceptable staleness for a single workout. **Rollback:** Delete file.

- [x] 4.7: Integrate OverloadSuggestionBadge and VolumeIndicatorPill into ActiveWorkoutScreen. Add OverloadSuggestionBadge below each exercise name. Add VolumeIndicatorPill above the exercise card list (one pill per unique muscle group in the workout). **Risk:** Modifying ActiveWorkoutScreen layout. **Mitigation:** Both are additive — inserted as new JSX elements, not replacing existing ones. **Rollback:** Remove the two JSX insertions.

- [x] 4.8: Write frontend tests. In `app/__tests__/components/IntelligenceLayer.test.ts` (new file): (a) OverloadSuggestionBadge renders suggestion text correctly, (b) OverloadSuggestionBadge renders nothing when no suggestion, (c) VolumeIndicatorPill shows correct color for below-MEV (red), (d) VolumeIndicatorPill shows green for MAV-MRV range, (e) VolumeIndicatorPill increments count on set completion, (f) RPE-to-suggestion mapping is correct. **Risk:** None. **Rollback:** Delete test file.

**CHECKPOINT 2:** Run `pytest tests/test_overload_suggestion_properties.py` — all pass. Run `npx jest app/__tests__/components/IntelligenceLayer.test.ts` — all pass. Run full suites — no regressions. Manual test: start workout with exercise that has 3+ sessions, verify overload suggestion appears. **Gate:** Do NOT proceed to Phase 5 until all Phase 4 tests pass.

---

## Phase 5: Exercise Detail Sheet

> Estimated effort: 1.5 days.

- [x] 5.1: Install `@gorhom/bottom-sheet`. Run `npm install @gorhom/bottom-sheet` in `app/` directory. Verify it installs without conflicts. This package requires `react-native-reanimated` (already installed) and `react-native-gesture-handler` (already installed). **Risk:** Version conflicts with existing reanimated/gesture-handler. **Mitigation:** Check peer dependency compatibility before installing. If conflicts, use a simple `Modal` with slide-up animation instead. **Rollback:** `npm uninstall @gorhom/bottom-sheet`.

- [x] 5.2: Create `app/components/training/ExerciseDetailSheet.tsx`. Bottom sheet (70% screen height) showing: animated GIF or static image at top, exercise name, muscle group / equipment / category tags, "Muscles Targeted" section (primary + secondary), "Instructions" section (numbered list from exercise.instructions), "Tips" section (bullet list from exercise.tips). Dismissible by swipe down or tap outside. If exercise has no instructions/tips, show image and muscle info only. **Risk:** Bottom sheet library issues. **Mitigation:** If @gorhom/bottom-sheet causes problems, fall back to a simple Modal with Animated.View slide-up. **Rollback:** Delete file.

- [x] 5.3: Integrate ExerciseDetailSheet into ActiveWorkoutScreen. When user taps exercise name or image in an exercise card, open ExerciseDetailSheet with that exercise's data. Requires fetching the full Exercise object (with instructions/tips) — either from the exercise cache or a quick lookup in the fetched exercise list. **Risk:** Exercise data not available if cache is empty. **Mitigation:** Fetch exercise list on workout start (already done for exercise picker) and cache in component state. **Rollback:** Remove tap handler.

- [x] 5.4: Add long-press preview to ExercisePickerScreen. When user long-presses an ExerciseCard, show ExerciseDetailSheet as a preview. **Risk:** None — additive gesture. **Rollback:** Remove long-press handler.

- [x] 5.5: Write tests. In `app/__tests__/components/ExerciseDetailSheet.test.ts` (new file): (a) renders instructions when available, (b) renders "No instructions available" when instructions is null, (c) renders primary and secondary muscles, (d) renders image when image_url present, (e) renders placeholder when no image. **Risk:** None. **Rollback:** Delete test file.

---

## Phase 6: Custom Exercises

> Estimated effort: 2 days. Highest rollback risk — DB migration.

- [x] 6.1: Create `CustomExercise` SQLAlchemy model. Add to `src/modules/training/models.py`: class CustomExercise with fields user_id (UUID, FK to users.id, indexed), name (String 200), muscle_group (String 50), secondary_muscles (JSONB, default []), equipment (String 50), category (String 20, default "compound"), notes (Text, nullable). Inherits SoftDeleteMixin + Base. **Risk:** DB migration required. **Mitigation:** Use Alembic autogenerate. **Rollback:** `alembic downgrade -1` to drop the table.

- [x] 6.2: Create Alembic migration. Run `alembic revision --autogenerate -m "add custom_exercises table"`. Review generated migration. Run `alembic upgrade head`. Verify table exists: `psql -c "SELECT * FROM custom_exercises LIMIT 0"`. **Risk:** Migration conflicts with other pending migrations. **Mitigation:** Run `alembic heads` first to check for multiple heads. **Rollback:** `alembic downgrade -1`.

- [x] 6.3: Add `CustomExerciseCreate` and `CustomExerciseResponse` schemas to `schemas.py`. CustomExerciseCreate: name (str, min 1, max 200), muscle_group (str), equipment (str), category (str, default "compound"), secondary_muscles (list[str], default []), notes (Optional[str]). CustomExerciseResponse: id (UUID), user_id (UUID), name, muscle_group, secondary_muscles, equipment, category, notes, is_custom (bool, always True), image_url (None), animation_url (None), created_at. **Risk:** None — additive. **Rollback:** Remove schemas.

- [x] 6.4: Create `src/modules/training/custom_exercise_service.py`. CRUD: create_custom_exercise, list_user_custom_exercises, update_custom_exercise, delete_custom_exercise. The list method returns exercises formatted to match the standard Exercise dict shape (so they merge seamlessly with system exercises). **Risk:** None — new service. **Rollback:** Delete file.

- [x] 6.5: Add endpoints to `router.py`: `POST /exercises/custom` (create), `GET /exercises/custom` (list user's custom exercises), `PUT /exercises/custom/{id}` (update), `DELETE /exercises/custom/{id}` (soft-delete). All require auth. **Risk:** None — new endpoints. **Rollback:** Remove endpoints.

- [x] 6.6: Update `GET /exercises` endpoint to merge system exercises + user's custom exercises. If user is authenticated, fetch their custom exercises and append to the system list. If not authenticated, return system exercises only. **Risk:** Breaking unauthenticated exercise listing. **Mitigation:** Make auth optional on this endpoint (use `get_current_user_optional` dependency). **Rollback:** Revert endpoint.

- [x] 6.7: Add "Create Custom Exercise" to ExercisePickerScreen. When search returns 0 results, show a "Create Custom Exercise" button at the bottom. Tapping opens a form: name (required), primary muscle group (required, picker from 13 groups), equipment (required, picker from 8 types), category (optional, default compound), secondary muscles (optional, multi-select), notes (optional). On save, POST to `/exercises/custom`, then select the newly created exercise. **Risk:** Form validation edge cases. **Mitigation:** Validate name non-empty, muscle_group from allowed list, equipment from allowed list. **Rollback:** Remove button and form.

- [ ] 6.8: Write tests. Backend: In `tests/test_custom_exercise_properties.py` (new file): (a) create custom exercise returns 201 with correct fields, (b) list returns only current user's exercises, (c) update changes name, (d) soft-delete removes from list, (e) merged exercise list includes custom exercises, (f) custom exercise has is_custom=True. Frontend: In `app/__tests__/components/CustomExerciseForm.test.ts` (new file): (a) form validates required fields, (b) form submits correct payload, (c) "Create Custom Exercise" appears when search has 0 results. **Risk:** None. **Rollback:** Delete test files.

**CHECKPOINT 3:** Run `pytest tests/test_custom_exercise_properties.py` — all pass. Run `npx jest` — all pass. Verify: create a custom exercise via API, then `GET /exercises` includes it. **Gate:** Do NOT proceed to Phase 7 until custom exercise CRUD works end-to-end.

---

## Phase 7: Session Detail Screen

> Estimated effort: 1 day. Lowest risk — new read-only screen.

- [x] 7.1: Create `app/screens/training/SessionDetailScreen.tsx`. Read-only view showing: session date, workout duration (if start_time and end_time exist, else hidden), total working volume (sum of weight × reps for non-warm-up sets), each exercise with all sets (weight in user's unit, reps, RPE/RIR, set type tag), PR badges on sets that were personal records, session notes, exercise image thumbnails next to exercise names. **Risk:** None — new screen. **Rollback:** Delete file.

- [x] 7.2: Add "Edit" button to SessionDetailScreen. Tapping navigates to ActiveWorkoutScreen in edit mode: `navigation.push('ActiveWorkout', { mode: 'edit', sessionId })`. This flow already works — ActiveWorkoutScreen already supports edit mode. **Risk:** None — uses existing edit mode. **Rollback:** Remove button.

- [x] 7.3: Wire SessionDetailScreen into navigation. In LogsScreen training tab, when user taps a session card, navigate to SessionDetailScreen instead of (or in addition to) the current behavior. Add SessionDetailScreen to the navigation stack. **Risk:** Breaking existing session tap behavior. **Mitigation:** Check current behavior first — if it already navigates to SessionDetail, just update the screen. If it doesn't navigate anywhere, add the navigation. **Rollback:** Revert navigation change.

- [x] 7.4: Write tests. In `app/__tests__/screens/SessionDetailScreen.test.ts` (new file): (a) renders session date, (b) hides duration when start_time is null, (c) shows duration when start_time and end_time exist, (d) displays PR badge on PR sets, (e) displays exercise images, (f) edit button navigates to ActiveWorkout with correct params, (g) displays weights in user's preferred unit system. **Risk:** None. **Rollback:** Delete test file.

---

## FINAL VALIDATION

- [-] FINAL.1: Run `pytest tests/` — full backend suite passes, no regressions from Phase 0 baseline count
- [-] FINAL.2: Run `npx jest` — full frontend suite passes, no regressions from Phase 0 baseline count
- [-] FINAL.3: Verify exercise count: `GET /exercises` returns >= 400 exercises
- [ ] FINAL.4: Verify image coverage: >= 95% of exercises have non-null image_url
- [ ] FINAL.5: Verify animation coverage: >= 90% of exercises have non-null animation_url
- [ ] FINAL.6: End-to-end smoke test: Start workout from template → log 3 exercises → use tap-to-copy → complete sets → verify rest timer ring → verify overload suggestion → tap exercise name for detail sheet → finish workout → view session detail → edit session
- [ ] FINAL.7: Git commit: `git add -A && git commit -m "feat: training workflow redesign — 400+ exercises, SVG rest timer, overload suggestions, volume tracking, exercise detail sheet, custom exercises, session detail"`

---

## ROLLBACK PLAN

| Phase | If it fails... | Do this... |
|-------|---------------|------------|
| 1 (Schema Extension) | Revert `exercises.py` and `exercise.ts` — additive fields only |
| 2 (DB Expansion) | Revert `exercises.py` to Phase 1 version (155 exercises with extended schema) |
| 3a (Picker) | Remove filter chips and image changes from ExercisePickerScreen |
| 3b (Rest Timer) | Revert ActiveWorkoutScreen import to RestTimerV2 |
| 3c (RPE Picker) | Revert RPE field to TextInput in ActiveWorkoutScreen |
| 4 (Intelligence) | Remove OverloadSuggestionBadge and VolumeIndicatorPill JSX from ActiveWorkoutScreen; delete new backend service |
| 5 (Detail Sheet) | Delete ExerciseDetailSheet; `npm uninstall @gorhom/bottom-sheet` |
| 6 (Custom Exercises) | `alembic downgrade -1` to drop custom_exercises table; remove endpoints and service |
| 7 (Session Detail) | Delete SessionDetailScreen; revert navigation |
| Full rollback | `git revert HEAD` |

---

## MONITORING (Post-Launch)

| Signal | What to Watch | Alert Threshold |
|--------|--------------|-----------------|
| Exercise API latency | P99 for `GET /exercises` with 400+ exercises | > 500ms (was ~100ms with 155) |
| Image load failures | 4xx/5xx on exercise image URLs | > 5% failure rate |
| Overload suggestion errors | 5xx on `GET /exercises/{name}/overload-suggestion` | Any 5xx |
| Custom exercise creation | Error rate on `POST /exercises/custom` | > 2% error rate |
| Rest timer crashes | JS errors in RestTimerRing/RestTimerOverlay | Any unhandled exception |
| Workout completion rate | % of started workouts that reach "Finish" | Drop > 10% week-over-week |
| Exercise picker load time | Time from open to exercises rendered | > 2s P95 |

---

## EFFORT SUMMARY

| Phase | Days | Risk | Shippable Independently? |
|-------|------|------|--------------------------|
| 0: Baseline | 0.5 | None | N/A |
| 1: Schema Extension | 0.5 | Low | Yes |
| 2: DB Expansion | 2-3 | Medium (data quality) | Yes |
| 3a: Picker Enhancements | 1 | Low | Yes |
| 3b: Rest Timer Ring | 1 | Low | Yes |
| 3c: RPE Picker | 0.5 | Low | Yes |
| 4: Intelligence Layer | 2-3 | Medium (new service) | Yes |
| 5: Exercise Detail Sheet | 1.5 | Medium (npm dep) | Yes |
| 6: Custom Exercises | 2 | High (DB migration) | Yes |
| 7: Session Detail | 1 | Low | Yes |
| **Total** | **12-14** | | |

Note: Total reduced from original 19-23 days because the codebase audit revealed ActiveWorkoutScreen, activeWorkoutSlice, ExercisePickerScreen, TemplateService, and VolumeCalculatorService already exist with most features implemented. The original plan had significant redundancy with existing code.
