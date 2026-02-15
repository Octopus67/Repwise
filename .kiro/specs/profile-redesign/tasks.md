# Implementation Plan: Profile Redesign — SDE3 Stress-Tested

## Pre-flight Checklist

Before any code changes:

1. Confirm backend runs: `/Users/manavmht/.local/share/mise/installs/python/3.12.4/bin/python -c "import uvicorn; uvicorn.run('src.main:app', host='0.0.0.0', port=8000)"` — verify `Application startup complete`.
2. Confirm frontend runs: `cd app && npx expo start --web --clear` — verify bundle at `http://localhost:8081`.
3. Confirm test suites green: `cd app && npx jest --config jest.config.js` (642 tests), `/Users/manavmht/.local/share/mise/installs/python/3.12.4/bin/python -m pytest tests/ -x -q` (315 tests). STOP if any fail.
4. No database migrations needed — all tables exist. Zero schema changes.
5. No new dependencies needed — all packages already installed.
6. Rollback for any task: `git revert` the commit(s). No database state to unwind.

## Critical Dependency Discovery

**Age and sex are NOT persisted in the database.** They are passed transiently in `OnboardingCompleteRequest` and `SnapshotRequest` but never stored. The `compute_snapshot()` engine requires `age_years`, `sex`, and `training_load_score`. The recalculate endpoint MUST either:
- (a) Store age/sex in `user_profiles.preferences` JSONB during onboarding and read them back, OR
- (b) Require the client to re-supply them on every recalculation

**Decision: Option (a).** Store `age_years` and `sex` in `user_profiles.preferences` JSONB (no migration needed — JSONB is schemaless). Update onboarding to persist these. Recalculate reads them from profile. Training load defaults to 0 (acceptable for profile-driven recalculation — full training load computation is a separate feature).

## Dependency Graph

```
Task 1 (schemas) ─── no dependencies
Task 2 (persist age/sex) ─── depends on Task 1 (RecalculateRequest schema)
Task 3 (recalculate service method) ─── depends on Tasks 1, 2
Task 4 (recalculate route) ─── depends on Task 3
Task 5 (backend tests) ─── depends on Task 4
CHECKPOINT A ─── depends on Task 5

Task 6 (store extensions) ─── no backend dependency
Task 7 (height conversion utils) ─── no dependency
Task 8 (BodyStatsSection) ─── depends on Tasks 6, 7, CHECKPOINT A
Task 9 (GoalsSection) ─── depends on Tasks 6, CHECKPOINT A
Task 10 (PreferencesSection) ─── depends on Task 6
Task 11 (AccountSection) ─── no dependency
Tasks 8-11 are independent of each other — parallelize.
CHECKPOINT B ─── depends on Tasks 8-11

Task 12 (ProfileScreen rewrite) ─── depends on CHECKPOINT B
Task 13 (tests) ─── depends on Task 12
CHECKPOINT C ─── depends on Task 13
```

## Tasks

- [x] 1. Backend: Add recalculate schemas to `src/modules/user/schemas.py`
  - [x] 1.1 Add `RecalculateRequest` Pydantic model with `metrics: UserMetricCreate | None = None` and `goals: UserGoalSet | None = None`. Add `@model_validator(mode="after")` that raises ValueError if both are None. Import `model_validator` from pydantic.
  - [x] 1.2 Add `AdaptiveTargetResponse` Pydantic model with `calories: float`, `protein_g: float`, `carbs_g: float`, `fat_g: float`.
  - [x] 1.3 Add `RecalculateResponse` Pydantic model with `metrics: UserMetricResponse | None = None`, `goals: UserGoalResponse | None = None`, `targets: AdaptiveTargetResponse`.
    - Risk: Pydantic v2 `model_validator` syntax differs from v1. Mitigation: Follow existing `CopyEntriesRequest` in `src/modules/nutrition/schemas.py` which already uses `@model_validator(mode="after")`.
    - Rollback: Remove the 3 classes from schemas.py.
    - _Requirements: 9.1, 9.2_

- [x] 2. Backend: Persist age and sex in user profile preferences
  - [x] 2.1 Update `src/modules/onboarding/service.py` `complete_onboarding` method: after creating the profile, add `age_years` and `sex` to the profile's `preferences` JSONB. Specifically, after the `UserProfile` creation/update step, do: `profile.preferences = {**(profile.preferences or {}), 'age_years': data.age_years, 'sex': data.sex}` then `await self.db.flush()`.
    - Risk: Existing users who onboarded before this change won't have age/sex in preferences. Mitigation: The recalculate method will check for these and return a clear error message if missing, prompting the user to re-enter them via the Body Stats section.
    - Rollback: Revert onboarding service. Existing preferences JSONB is unaffected (additive key).
    - _Requirements: 2.2, 9.1_

- [x] 3. Backend: Add `recalculate` method to `UserService` in `src/modules/user/service.py`
  - [x] 3.1 Add method `async def recalculate(self, user_id: uuid.UUID, data: RecalculateRequest) -> RecalculateResponse`:
    - Step 1: If `data.metrics` provided, call `self.log_metrics(user_id, data.metrics)` → store result as `new_metrics`
    - Step 2: If `data.goals` provided, call `self.set_goals(user_id, data.goals)` → store result as `new_goals`
    - Step 3: Fetch latest metrics: `SELECT * FROM user_metrics WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`
    - Step 4: Fetch current goals: `self.get_goals(user_id)`. If None and `data.goals` is None, use default: `GoalType.MAINTAINING`, `goal_rate_per_week=0.0`
    - Step 5: Fetch bodyweight history (last 90 days): `SELECT recorded_date, weight_kg FROM bodyweight_logs WHERE user_id = ? AND recorded_date >= (today - 90 days) ORDER BY recorded_date`. If empty, use `[(today, latest_metrics.weight_kg)]` as single entry.
    - Step 6: Fetch user profile to get `preferences.age_years` and `preferences.sex`. If either is missing, raise `ValidationError("Age and sex are required for recalculation. Please update your body stats.")`
    - Step 7: Build `AdaptiveInput(weight_kg=latest.weight_kg, height_cm=latest.height_cm, age_years=profile.preferences['age_years'], sex=profile.preferences['sex'], activity_level=ActivityLevel(latest.activity_level or 'moderate'), goal_type=GoalType(goals.goal_type), goal_rate_per_week=goals.goal_rate_per_week or 0.0, bodyweight_history=bw_history, training_load_score=0.0)`
    - Step 8: Call `compute_snapshot(adaptive_input)` → `output`
    - Step 9: Persist `AdaptiveSnapshot` row with all target fields and `input_parameters` JSONB
    - Step 10: Return `RecalculateResponse(metrics=new_metrics, goals=new_goals, targets=AdaptiveTargetResponse(calories=output.target_calories, protein_g=output.target_protein_g, carbs_g=output.target_carbs_g, fat_g=output.target_fat_g))`
    - Import: `from src.modules.adaptive.engine import AdaptiveInput, compute_snapshot`, `from src.modules.adaptive.models import AdaptiveSnapshot`, `from datetime import date, timedelta`
    - Risk: `compute_snapshot` is a pure function but requires all fields. If `height_cm` or `weight_kg` is None in latest metrics, it will fail. Mitigation: Validate that latest metrics has non-null height and weight before calling engine. Return 422 with clear message if missing.
    - Rollback: Remove the method. No data impact.
    - _Requirements: 2.2, 2.3, 3.2, 3.3, 9.1, 9.2_

- [x] 4. Backend: Add `POST /user/recalculate` route to `src/modules/user/router.py`
  - [x] 4.1 Add route: `@router.post("/recalculate", response_model=RecalculateResponse)` with `user: User = Depends(get_current_user)` and `service: UserService = Depends(_get_user_service)`. Body: `data: RecalculateRequest`. Calls `await service.recalculate(user.id, data)`.
    - Import `RecalculateRequest` and `RecalculateResponse` from schemas.
    - Risk: None — follows existing route patterns exactly.
    - Rollback: Remove the route.
    - _Requirements: 9.1, 9.2_

- [x] 5. Backend: Write tests for recalculate endpoint
  - [x] 5.1 Create `tests/test_recalculate_properties.py` with unit tests:
    - Test 1: POST with valid metrics → returns updated metrics + targets with calories > 0
    - Test 2: POST with valid goals → returns updated goals + targets
    - Test 3: POST with both metrics and goals → returns both + targets
    - Test 4: POST with both fields None → 422 validation error
    - Test 5: POST without auth → 401
    - Test 6: Existing endpoints (`GET /user/profile`, `POST /user/metrics`, `PUT /user/goals`) still work (regression)
    - Test 7: Recalculate with no bodyweight history → uses current weight as fallback, returns valid targets
    - Use existing `conftest.py` fixtures (`client`, `db_session`, `setup_database`)
    - _Requirements: 2.2, 3.2, 9.1, 9.2, 9.4_

- [x] 6. **CHECKPOINT A — Backend tests pass**
  - Run: `/Users/manavmht/.local/share/mise/installs/python/3.12.4/bin/python -m pytest tests/ -x -q` — ALL tests must pass (existing 315 + new).
  - Run: `curl -X POST http://localhost:8000/api/v1/user/recalculate -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"metrics": {"weight_kg": 80, "height_cm": 180, "activity_level": "moderate"}}'` — verify 200 with targets.
  - If any test fails: STOP. Fix before proceeding to frontend.

- [x] 7. Frontend: Extend Zustand store in `app/store/index.ts`
  - [x] 7.1 Add to `AppState`: `goals: { id: string; userId: string; goalType: string; targetWeightKg: number | null; goalRatePerWeek: number | null } | null` (default null), `latestMetrics: { id: string; heightCm: number | null; weightKg: number | null; bodyFatPct: number | null; activityLevel: string | null; recordedAt: string } | null` (default null).
  - [x] 7.2 Add to `AppActions`: `setGoals: (goals: AppState['goals']) => void`, `setLatestMetrics: (metrics: AppState['latestMetrics']) => void`.
  - [x] 7.3 Add implementations: `setGoals: (goals) => set({ goals })`, `setLatestMetrics: (metrics) => set({ latestMetrics: metrics })`.
  - [x] 7.4 Update `clearAuth` to also reset `goals: null, latestMetrics: null`.
    - Risk: TypeScript type additions. Mitigation: All new fields default to null — no existing code breaks.
    - Rollback: Remove the new fields and actions.
    - _Requirements: 2.1, 3.1, 9.3_

- [x] 8. Frontend: Add height conversion utilities to `app/utils/unitConversion.ts`
  - [x] 8.1 Add `cmToFtIn(cm: number): { feet: number; inches: number }` — `const totalInches = cm / 2.54; return { feet: Math.floor(totalInches / 12), inches: Math.round(totalInches % 12) }`.
  - [x] 8.2 Add `ftInToCm(feet: number, inches: number): number` — `return Math.round((feet * 12 + inches) * 2.54)`.
    - Risk: Rounding. `cmToFtIn(180)` → `{5, 11}`, `ftInToCm(5, 11)` → `180`. Tolerance ±1.5cm is acceptable.
    - Rollback: Remove the two functions.
    - _Requirements: 2.6, 3.5_

- [x] 9. Frontend: Build section components (Tasks 9-12 are independent — parallelize)
  - [x] 9.1 Create `app/components/profile/BodyStatsSection.tsx`
    - Props: `metrics: LatestMetrics | null`, `unitSystem: 'metric' | 'imperial'`
    - Display 4 fields: height (formatHeight), weight (formatWeight), body fat %, activity level
    - Each field uses `EditableField` component for inline editing
    - On save: `api.post('user/recalculate', { metrics: { height_cm, weight_kg, body_fat_pct, activity_level } })` → update store with `setLatestMetrics(response.metrics)` and `setAdaptiveTargets(response.targets)`
    - Show "Last updated: X days ago" from `metrics.recordedAt` using relative time
    - Show "View History" link → `navigation.navigate('MetricsHistory')` (existing screen)
    - Empty state when `metrics` is null: Card with text "Add your body stats to get personalized targets" and a CTA button that opens edit mode for all fields
    - Weight input: parse via `parseWeightInput(value, unitSystem)` before sending to API (always sends kg)
    - Height input: if imperial, show two fields (feet + inches), convert via `ftInToCm` before sending
    - Activity level: dropdown/picker with options from ActivityLevel enum: sedentary, light, moderate, active, very_active
    - Inline error on save failure: "Couldn't save. Check your connection."
    - Save button disabled while saving (prevent double-submit)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 9.2 Create `app/components/profile/GoalsSection.tsx`
    - Props: `goals: Goals | null`, `adaptiveTargets: AdaptiveTargets | null`, `unitSystem: 'metric' | 'imperial'`
    - Display: goal type (cutting/maintaining/bulking), target weight, goal rate (kg/week or lbs/week)
    - Goal type: 3-option selector (SegmentedControl or tappable pills)
    - Target weight: EditableField with unit conversion
    - Goal rate: EditableField with unit suffix
    - Below goal fields: divider + "Current Targets" header + 4 macro values (calories, protein, carbs, fat) from `adaptiveTargets`
    - On save: `api.post('user/recalculate', { goals: { goal_type, target_weight_kg, goal_rate_per_week } })` → update store with `setGoals(response.goals)` and `setAdaptiveTargets(response.targets)`
    - Empty state when `goals` is null: "Set your first goal" CTA
    - Inline error on save failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 9.3 Create `app/components/profile/PreferencesSection.tsx`
    - Props: `profile: UserProfile`, `unitSystem: 'metric' | 'imperial'`, `coachingMode: string`
    - 5 preference rows:
      1. Unit System — SegmentedControl (metric/imperial). On change: `api.put('user/profile', { preferences: { ...existing, unit_system: newSystem } })` → `store.setUnitSystem()` + `store.setProfile()`
      2. Timezone — display current value + "Change" button. Auto-detect via `Intl.DateTimeFormat().resolvedOptions().timeZone` on first load if null. On change: `api.put('user/profile', { timezone: value })` → `store.setProfile()`
      3. Region — display + editable. On change: `api.put('user/profile', { region: value })`
      4. Currency — display + editable. On change: `api.put('user/profile', { preferred_currency: value })`
      5. Coaching Mode — reuse existing `CoachingModeSelector` component. On change: `api.put('user/profile', { coaching_mode: mode })` → `store.setCoachingMode()` + `store.setProfile()`
    - NO rest timer controls (Requirement 8)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2_

  - [x] 9.4 Create `app/components/profile/AccountSection.tsx`
    - Log Out button (Button variant="secondary")
    - "Danger Zone" header (TouchableOpacity, collapsed by default)
    - When expanded: Delete Account button (Button variant="danger") with confirmation Alert
    - Expand animation: `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`
    - App version: `import Constants from 'expo-constants'; Constants.expoConfig?.version ?? '1.0.0'`
    - Internal state: `dangerZoneExpanded: boolean` (default false)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 10. **CHECKPOINT B — Section components compile and render**
  - Run: `getDiagnostics` on all 4 new component files — 0 errors.
  - Run: `cd app && npx jest --config jest.config.js` — all existing tests still pass.

- [x] 11. Frontend: Rewrite ProfileScreen at `app/screens/profile/ProfileScreen.tsx`
  - [x] 11.1 Complete rewrite of ProfileScreen:
    - On mount: parallel fetch via `Promise.allSettled`:
      - `api.get('user/profile')` → `store.setProfile(mapped)`
      - `api.get('user/metrics/history', { params: { limit: 1 } })` → `store.setLatestMetrics(items[0] mapped)` (map snake_case to camelCase)
      - `api.get('user/goals')` → `store.setGoals(mapped)` (map snake_case to camelCase)
      - `api.get('adaptive/snapshots', { params: { limit: 1 } })` → `store.setAdaptiveTargets(mapped)`
    - Render 7 sections with `useStaggeredEntrance(index, 60)`:
      1. ProfileHeader: avatar initial, EditableField for display name, read-only email, PremiumBadge, member-since from `profile.created_at`
      2. BodyStatsSection (new component)
      3. GoalsSection (new component)
      4. PreferencesSection (new component)
      5. FeaturesNavigation: 6 FeatureNavItem components (Coaching, Community, Founder's Story, Health Reports, Learn, Progress Photos) — same as current
      6. SubscriptionSection: compact status + renewal date + upgrade button — same pattern as current
      7. AccountSection (new component)
    - Remove ALL rest timer state: `compoundRest`, `isolationRest`, `savingPrefs`, `handleSaveRestTimer`
    - Remove rest timer TextInputs and Save Rest Timer button from render
    - Keep: `handleSaveDisplayName`, `handleLogout`, `handleDeleteAccount` (move delete into AccountSection), `handleUnitToggle` (move into PreferencesSection), `handleCoachingModeChange` (move into PreferencesSection)
    - Risk: Large rewrite. Mitigation: Each section is a separate component — if one breaks, others still render. Feature flag can revert to old screen.
    - Rollback: `git revert` the ProfileScreen commit.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 6.1, 6.2, 6.3, 8.1, 8.2_

- [x] 12. Frontend: Write tests for ProfileScreen and sections
  - [x] 12.1 Update `app/__tests__/screens/ProfileScreen.test.tsx`:
    - Keep existing avatar initial PBT tests (Property 1)
    - Keep existing premium badge tests
    - Update structure tests: 6 feature nav items (already correct), 7 sections (was 5)
    - Add: rest timer validation tests REMOVED (rest timer no longer on profile)
    - Add: display name validation tests (keep existing)
    - Add: body stats field validation — weight > 0, height > 0, body_fat 0-100
    - Add: goals field validation — goal_type in {cutting, maintaining, bulking}
    - Add: recalculate payload builder tests — verify correct shape for metrics-only, goals-only, and both
    - Add: unit conversion round-trip for height (cmToFtIn → ftInToCm within ±1.5cm)
    - Add: timezone auto-detect fallback to UTC
    - Add: danger zone collapsed by default
    - _Requirements: 1.1, 2.1, 2.7, 3.1, 3.6, 4.1, 7.3, 7.4, 7.5, 8.1_

- [x] 13. **CHECKPOINT C — Full regression**
  - Run: `cd app && npx jest --config jest.config.js` — ALL frontend tests pass.
  - Run: `/Users/manavmht/.local/share/mise/installs/python/3.12.4/bin/python -m pytest tests/ -x -q` — ALL backend tests pass.
  - Manual verification:
    1. Profile loads with all 7 sections visible
    2. Body Stats shows current metrics (or empty state for new user)
    3. Edit weight → save → TDEE targets update in Goals section
    4. Edit goal type → save → macro targets update
    5. Change unit system → weight/height display updates immediately
    6. Timezone shows auto-detected value
    7. Rest timer inputs are GONE from profile
    8. Danger Zone is collapsed, expands on tap, delete shows confirmation
    9. Log Out works
    10. All existing screens (Dashboard, Logs, Analytics) still work

## What Was Cut From Original Plan

- ~~Feature flag check in ProfileScreen~~ — Premature for v1. Ship directly. If rollback needed, git revert.
- ~~Property test for recalculation consistency (comparing service output vs direct engine call)~~ — The service method is 30 lines of orchestration. Unit tests on the endpoint cover this. Property test adds complexity without proportional value for v1.
- ~~Property test for RecalculateRequest validation~~ — Covered by unit test (both-None → 422). Property test is overkill for a 3-line validator.
- ~~Property test for unit conversion round-trip~~ — Already covered by existing `app/__tests__/unitConversion.test.ts` (Properties 7, 8). Adding cmToFtIn/ftInToCm tests to the existing file is sufficient.
- ~~Number transition animation on target values~~ — Nice-to-have polish. Not blocking v1 functionality. Can add in a follow-up.
- ~~ProfileScreenLegacy component~~ — Feature flag + legacy component is over-engineering for a team of one. Git revert is the rollback.

## What Was Added vs Original Plan

- **Task 2: Persist age/sex** — Critical gap. Without this, the recalculate endpoint cannot call `compute_snapshot()` because it requires `age_years` and `sex` which were never stored in the DB.
- **Explicit snake_case → camelCase mapping** in store updates — The API returns `snake_case` but the store uses `camelCase`. Every `setLatestMetrics` and `setGoals` call must map fields.
- **Fallback for missing age/sex** — Users who onboarded before Task 2 won't have age/sex in preferences. The recalculate endpoint returns a clear error prompting them to re-enter.
- **Training load hardcoded to 0** — Acceptable for profile-driven recalculation. Full training load computation requires analyzing recent training sessions, which is a separate feature.
- **Activity level dropdown** — The original plan said "EditableField" for activity level, but it's an enum with 5 values. Needs a picker/dropdown, not a text input.

## Parallelization Opportunities

- Tasks 1.1, 1.2, 1.3 are independent schema additions — execute in parallel
- Tasks 7 and 8 (store + utils) are independent of backend — can start after CHECKPOINT A
- Tasks 9.1, 9.2, 9.3, 9.4 are independent components — execute in parallel
- Task 12 (tests) can be written in parallel with Task 11 (screen rewrite) if test file uses extracted pure functions

## Monitoring Post-Launch

- Track: `POST /user/recalculate` call rate per day (new metric — baseline is 0)
- Track: `POST /user/recalculate` error rate (alert if > 5%)
- Track: `POST /user/recalculate` p99 latency (alert if > 2s)
- Track: body stats update rate (% of active users updating stats per month — primary success metric)
- Track: profile screen load time (alert if > 800ms — 4 parallel API calls)
- Guardrail: existing `PUT /user/profile` call rate stays flat (±5%) — ensures preferences still work
- Guardrail: `POST /user/metrics` call rate increases (body stats edits from profile)
- Guardrail: onboarding completion rate stays flat (±1%)
