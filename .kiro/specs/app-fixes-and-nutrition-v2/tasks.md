# Implementation Plan: App Fixes and Nutrition V2 — Revised

## Pre-flight Checklist

Before any code changes:

1. Confirm backend runs: `python -c "import uvicorn; uvicorn.run('src.main:app', host='0.0.0.0', port=8000)"` — verify `Application startup complete` in logs.
2. Confirm frontend runs: `cd app && npx expo start --web --clear` — verify bundle completes at `http://localhost:8081`.
3. Confirm test suites green: `cd app && npx jest --config jest.config.js` (frontend), `python -m pytest tests/ -x -q` (backend).
4. Confirm food database is seeded: `curl http://localhost:8000/api/v1/food/search?q=chicken` — should return items. If empty, run seed: `python -c "from src.modules.food_database.seed_data import seed_food_database; import asyncio; asyncio.run(seed_food_database())"`.
5. Confirm `micro_nutrients` JSONB column exists on `nutrition_entries`, `custom_meals`, `meal_favorites` tables. No migration needed — column already exists in models.
6. Feature flag: No flag needed for bug fixes (Tasks 1-3). New features (Tasks 5-9) ship without flag for v1 — all new fields are optional, backward compatible.

Rollback for any task: `git revert` the commit(s). No database schema changes to unwind.

## Tasks

- [ ] 1. Fix Nutrition Entry save payload (highest priority — blocks all nutrition flows)
  - [x] 1.1 Fix `handleSubmit` in `app/components/modals/AddNutritionModal.tsx` to send correct field names
    - In `handleSubmit` function (~line 155), change the `api.post('nutrition/entries', {...})` payload:
      - Replace `date: new Date().toISOString().split('T')[0]` with `entry_date: new Date().toISOString().split('T')[0]`
      - Add `meal_name: notes.trim() || 'Quick entry'` as the first field in the payload object
      - Keep existing `calories`, `protein_g`, `carbs_g`, `fat_g` fields unchanged
      - Keep the conditional `notes` spread unchanged (it's metadata, not the required `meal_name`)
    - Risk: Backend `NutritionEntryCreate` schema requires `meal_name` (min_length=1) and `entry_date` (date type). If either is missing or malformed, backend returns 422. Mitigation: The default "Quick entry" ensures non-empty, and ISO date split always produces valid date.
    - Rollback: Revert the single file change. No data corruption possible — entries that failed to save never reached the DB.
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 1.2 Write property test for nutrition payload construction (Property 1)
    - Create `app/__tests__/utils/nutritionPayload.test.ts`
    - Export a pure function `buildNutritionPayload(calories: number, protein: number, carbs: number, fat: number, notes: string): object` from a new file `app/utils/nutritionPayload.ts`
    - Property: for any macro values (fc.float({min:0, max:10000})) and any notes string (fc.string()), the returned object always has `meal_name` (non-empty string) and `entry_date` (matches /^\d{4}-\d{2}-\d{2}$/)
    - Run: `cd app && npx jest --config jest.config.js --testPathPattern="nutritionPayload"` — must pass
    - **Property 1: Nutrition payload always contains required fields**
    - **Validates: Requirements 2.1, 2.2**

- [ ] 2. Fix Food Search response handling
  - [x] 2.1 Fix food search response parsing in `app/components/modals/AddNutritionModal.tsx`
    - In `handleSearchChange` callback (~line 100), inside the `setTimeout` async block, change:
      - `setSearchResults(res.data.items ?? [])` → `const items = res.data?.items ?? res.data ?? []; setSearchResults(Array.isArray(items) ? items : []);`
    - After `setSearchResults`, add: if `items.length === 0 && !searchError`, set a new state `setSearchEmpty(true)` (add `const [searchEmpty, setSearchEmpty] = useState(false)` to state declarations)
    - In the render section, after `searchResults` list, add: `{searchEmpty && searchResults.length === 0 && !searchLoading && <Text style={styles.emptyText}>No results found — try a different term or enter macros manually</Text>}` with `emptyText` style: `{ color: colors.text.muted, fontSize: typography.size.sm, marginTop: spacing[1], textAlign: 'center' }`
    - Reset `searchEmpty` to false when `searchQuery` changes or results arrive
    - Risk: Backend returns `PaginatedResult` with `items` array. If backend is down, the catch block already handles it. If food DB is empty, this now shows a helpful message instead of nothing.
    - Rollback: Revert file. No data impact.
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_
  - [x] 2.2 Write property tests for scaleMacros and search display cap (Properties 2, 3, 14)
    - Create `app/__tests__/utils/foodSearch.test.ts`
    - Property 2: Import `scaleMacros` from `AddNutritionModal`. For any food item macros and positive multiplier m, verify each output macro equals `base * m`.
    - Property 3: For any array of length N, `items.slice(0, 10)` has length `min(N, 10)`.
    - Property 14: For any string, search triggers only when `trimmed.length >= 2`.
    - Run: `cd app && npx jest --config jest.config.js --testPathPattern="foodSearch"` — must pass
    - **Property 2: Macro scaling is multiplicative**
    - **Property 3: Search results capped at 10**
    - **Property 14: Search trigger threshold**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 3. Fix Training Modal save — eliminate blank screen
  - [x] 3.1 Fix `AddTrainingModal` state management in `app/components/modals/AddTrainingModal.tsx`
    - Remove `const [modalVisible, setModalVisible] = useState(false)` (line ~47)
    - Remove `useEffect(() => { setModalVisible(visible); }, [visible])` (lines ~56-58)
    - Replace `<ModalContainer visible={modalVisible}` with `<ModalContainer visible={visible}` in the render return
    - Add `const formStateRef = useRef({ exercises, notes })` to preserve form state across exercise picker navigation
    - In the exercise picker navigation callback (~line 180), before calling `onClose()`, save state: `formStateRef.current = { exercises, notes }`
    - On modal re-open (add `useEffect` on `visible` becoming true), restore: `if (formStateRef.current) { setExercises(formStateRef.current.exercises); setNotes(formStateRef.current.notes); }`
    - Remove unused imports: `KeyboardAvoidingView`, `Platform` (already flagged by linter)
    - Risk: The exercise picker navigation pattern temporarily closes the modal. If the parent doesn't re-open it, data is lost. Mitigation: The `useRef` preserves state, and the `onSelect`/`onCancel` callbacks in the navigation params trigger parent to re-open.
    - Rollback: Revert file. Training sessions that were already saved are unaffected.
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  - [x] 3.2 Write unit tests for Training Modal submit flow
    - Create `app/__tests__/components/AddTrainingModal.test.ts`
    - Test 1: `handleSubmit` constructs payload with `session_date`, `exercises` array (each with `exercise_name`, `sets` array), optional `metadata.notes`
    - Test 2: Validation rejects empty exercise name, empty sets, missing reps/weight
    - Test 3: Loading state prevents double-submission (test the `loading` guard in handleSubmit)
    - Inline the `validate()` function from the modal for testing (it's a pure function)
    - Run: `cd app && npx jest --config jest.config.js --testPathPattern="AddTrainingModal"` — must pass
    - _Requirements: 1.1, 1.3, 1.5_

- [ ] 4. **CHECKPOINT — Bug fixes verified**
  - Run full frontend test suite: `cd app && npx jest --config jest.config.js` — all tests must pass
  - Run full backend test suite: `python -m pytest tests/ -x -q` — all tests must pass
  - Manual verification (3 flows):
    1. Open Nutrition modal → fill macros → tap Save → entry appears in Logs tab (no error alert)
    2. Open Nutrition modal → type "chicken" in search → results appear within 1 second
    3. Open Training modal → add exercise → add set → tap Save Session → modal closes, session appears in Logs tab (no blank screen)
  - If any flow fails: STOP. Debug before proceeding. Do not continue to feature work with broken save flows.

- [ ] 5. Add unit conversion functions for bodyweight toggle
  - [x] 5.1 Extend `app/utils/unitConversion.ts` with bidirectional conversion helpers
    - The file already has `convertWeight(valueKg, to)` and `KG_TO_LBS = 2.20462`. Add:
    - `export function kgToLbs(kg: number): number { return Math.round(kg * KG_TO_LBS * 10) / 10; }`
    - `export function lbsToKg(lbs: number): number { return Math.round((lbs / KG_TO_LBS) * 10) / 10; }`
    - `export function parseWeightToKg(value: number, unit: 'kg' | 'lbs'): number { return unit === 'lbs' ? lbsToKg(value) : value; }`
    - Note: `convertWeight` already exists but takes `(valueKg, toSystem)`. The new functions are simpler helpers for the modal toggle.
    - Risk: Rounding to 1 decimal means kg→lbs→kg may differ by ±0.1. This is acceptable for bodyweight logging.
    - Rollback: Revert file. Additive change — existing functions untouched.
    - _Requirements: 4.2, 4.3_
  - [x] 5.2 Write property tests for unit conversion (Properties 4, 5)
    - Create `app/__tests__/utils/weightConversion.test.ts`
    - Property 4: For any weight > 0 and unit, `parseWeightToKg(weight, 'kg')` === weight, `parseWeightToKg(weight, 'lbs')` === `weight / 2.20462` (within 0.1 tolerance)
    - Property 5: For any weight > 0, `lbsToKg(kgToLbs(weight))` is within 0.1 of `weight`
    - Run: `cd app && npx jest --config jest.config.js --testPathPattern="weightConversion"` — must pass
    - **Property 4: Weight conversion correctness**
    - **Property 5: Unit toggle round-trip**
    - **Validates: Requirements 4.2, 4.3, 4.5**
  - [x] 5.3 Update `app/components/modals/AddBodyweightModal.tsx` with unit toggle
    - Import `useStore` from `../../store` and `kgToLbs`, `lbsToKg`, `parseWeightToKg` from `../../utils/unitConversion`
    - Add state: `const unitSystem = useStore((s) => s.unitSystem); const [unit, setUnit] = useState<'kg' | 'lbs'>(unitSystem === 'imperial' ? 'lbs' : 'kg');`
    - Add toggle function: when switching kg→lbs, convert current value via `kgToLbs`; lbs→kg via `lbsToKg`. Update both `weight` and `unit` state.
    - Add a `SegmentedControl` component (copy the one from ProfileScreen or extract to shared) next to the "Weight" label
    - In `handleSubmit`, change `weight_kg: Number(weight)` to `weight_kg: parseWeightToKg(Number(weight), unit)` — always sends kg to API
    - Update label from hardcoded "Weight (kg)" to `Weight (${unit})`
    - Risk: User enters value, toggles unit, value converts. If they toggle back, rounding may shift by 0.1. Acceptable for bodyweight.
    - Rollback: Revert file. No data impact — API always receives kg.
    - _Requirements: 4.1, 4.4, 4.5_

- [ ] 6. Add micronutrient, fibre, and water tracking to Nutrition Modal
  - [x] 6.1 Create `app/components/nutrition/WaterTracker.tsx` — glass-based water intake component
    - Props: `glasses: number`, `onIncrement: () => void`, `onDecrement: () => void`, `maxGlasses?: number` (default 12)
    - Render a row of glass icons (💧 filled, ○ empty). Tapping empty → increment, tapping filled → decrement.
    - Display: `"{glasses} glasses ({glasses * 250}ml)"` below the icons
    - Enforce: `glasses >= 0` (decrement at 0 is no-op), `glasses <= maxGlasses` (increment at max is no-op)
    - Style: horizontal ScrollView if > 8 glasses, using token colors
    - Risk: None — pure presentational component with no API calls.
    - Rollback: Delete file.
    - _Requirements: 5.5, 5.6, 5.7_
  - [x] 6.2 Write property test for water glass count invariant (Property 7)
    - Create `app/__tests__/utils/waterTracker.test.ts`
    - Export pure functions `increment(n, max)` and `decrement(n)` from `app/utils/waterLogic.ts`
    - Property 7: For any n >= 0, `increment(n, 12)` === `min(n+1, 12)`, `decrement(n)` === `max(n-1, 0)`. Increment then decrement returns original. Count is never negative.
    - Run: `cd app && npx jest --config jest.config.js --testPathPattern="waterTracker"` — must pass
    - **Property 7: Water glass count invariant**
    - **Validates: Requirements 5.6, 5.7**
  - [x] 6.3 Create `app/utils/microNutrientSerializer.ts` — serialization logic for micro_nutrients JSONB
    - Export `serializeMicroNutrients(micros: Record<string, string>, fibreG: string, waterGlasses: number): Record<string, number>`
    - Converts string inputs to floats, filters out empty/zero values, adds `fibre_g` and `water_ml: glasses * 250`
    - Export `countFilledFields(micros: Record<string, string>): number` — counts non-empty, non-zero entries
    - Export `MICRO_FIELDS` constant array: `[{key: 'vitamin_a_mcg', label: 'Vitamin A (mcg)'}, ...]` (8 fields from design doc)
    - Risk: None — pure functions.
    - Rollback: Delete file.
    - _Requirements: 5.2, 5.4, 5.9, 5.10_
  - [x] 6.4 Write property tests for serialization and field count (Properties 6, 9)
    - Create `app/__tests__/utils/microNutrientSerializer.test.ts`
    - Property 6: For any combination of micro values, fibre, and water glasses, serialized object contains all non-zero micros, `fibre_g`, and `water_ml === glasses * 250`
    - Property 9: For any set of micro inputs (some empty, some filled), `countFilledFields` equals count of non-empty non-zero values
    - Run: `cd app && npx jest --config jest.config.js --testPathPattern="microNutrientSerializer"` — must pass
    - **Property 6: Micronutrient, fibre, and water serialization**
    - **Property 9: Filled micronutrient field count**
    - **Validates: Requirements 5.2, 5.4, 5.9, 5.10**
  - [x] 6.5 Integrate micronutrient section, fibre field, and WaterTracker into AddNutritionModal
    - Add state: `fibre`, `waterGlasses`, `microNutrients` (Record<string, string>), `microExpanded` (boolean, default false)
    - Add collapsible "Micronutrients" section after macro fields: TouchableOpacity header showing "Micronutrients ({countFilledFields(microNutrients)} filled)" that toggles `microExpanded`
    - When expanded: render MICRO_FIELDS as TextInput rows (2 per row, numeric keyboard)
    - Add "Fibre (g)" TextInput in the macro row (after fat field)
    - Add WaterTracker component below fibre
    - In `handleSubmit`, add to payload: `micro_nutrients: serializeMicroNutrients(microNutrients, fibre, waterGlasses)` (only if any values are non-empty)
    - Risk: Adding fields to the modal increases scroll length. Mitigation: Micronutrients are collapsed by default — most users won't see them unless they expand.
    - Rollback: Revert AddNutritionModal changes. Delete WaterTracker and serializer files.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.9, 5.10_
  - [x] 6.6 Write backend property test for micronutrient persistence round-trip (Property 8)
    - Create `tests/test_micronutrient_persistence.py`
    - Use hypothesis to generate random `micro_nutrients` dicts (keys from MICRO_FIELDS + fibre_g + water_ml, values as positive floats)
    - Create nutrition entry via test client with generated micro_nutrients, retrieve it, verify the returned `micro_nutrients` dict matches
    - Uses existing `conftest.py` fixtures (`client`, `db_session`, `setup_database`)
    - Run: `python -m pytest tests/test_micronutrient_persistence.py -x -q` — must pass
    - **Property 8: Micronutrient persistence round-trip**
    - **Validates: Requirements 5.8**

- [ ] 7. **CHECKPOINT — Nutrition enhancements verified**
  - Run full frontend test suite: `cd app && npx jest --config jest.config.js` — all tests must pass
  - Run full backend test suite: `python -m pytest tests/ -x -q` — all tests must pass
  - Manual verification:
    1. Open Nutrition modal → fill macros + fibre → expand Micronutrients → fill 2 fields → collapse → see "2 filled" summary → Save → entry persists
    2. Open Nutrition modal → tap water glasses → see count increment → Save → verify `micro_nutrients.water_ml` in DB
    3. Open Bodyweight modal → see unit matches profile preference → toggle to lbs → value converts → Save → verify `weight_kg` in DB is in kg

- [ ] 8. Improve profile field editability
  - [x] 8.1 Create `app/components/common/EditableField.tsx` and update ProfileScreen
    - Create `EditableField` component with props: `label`, `value`, `onSave: (newValue: string) => Promise<void>`, `editable?: boolean` (default true), `inputType?: 'text' | 'picker'`
    - View mode: value Text + pencil icon (✏️, 14px, text.muted) on the right. Entire row is TouchableOpacity.
    - Edit mode: TextInput with `colors.border.focus` border + Save (primary, small) and Cancel (ghost, small) buttons below
    - Saving mode: ActivityIndicator replacing Save button
    - Error: Alert + revert to previous value
    - Read-only mode (editable=false): value Text + lock icon (🔒, 14px, text.muted). No TouchableOpacity.
    - Update ProfileScreen: Replace the current display name section with EditableField. Add EditableField for timezone and preferred_currency (if those fields exist in the profile API). Keep email as read-only EditableField.
    - Risk: Profile API `PUT /user/profile` may not accept all fields. Mitigation: Check `UserProfileUpdate` schema for accepted fields before adding EditableField for each.
    - Rollback: Revert ProfileScreen and delete EditableField component.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9. Relocate rest timer settings to training modal
  - [x] 9.1 Add inline rest timer settings panel to Training Modal
    - In `app/components/training/RestTimer.tsx`, add optional `onSettingsChange?: (compound: number, isolation: number) => void` prop
    - Add a gear icon button (⚙️) in the top-right of the RestTimer overlay
    - When tapped, slide in a settings panel below the countdown with two TextInput fields: "Compound rest (s)" and "Isolation rest (s)", pre-filled from current values
    - Add "Save" button that calls `onSettingsChange` with the new values
    - In `AddTrainingModal.tsx`, pass `onSettingsChange` handler that calls `api.put('user/profile', { preferences: { ...existingPrefs, rest_timer: { compound_seconds, isolation_seconds } } })` and updates the Zustand store
    - Keep existing Profile > Preferences rest timer section unchanged — both locations write to the same `preferences.rest_timer` object
    - Risk: Two places to edit the same setting could cause confusion. Mitigation: Both read from and write to the same store/API field, so they're always in sync.
    - Rollback: Revert RestTimer and AddTrainingModal changes.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Implement custom meal plans
  - [x] 10.1 Create `app/utils/mealPlanLogic.ts` — pure functions for meal plan aggregation
    - Export `aggregateMealPlan(items: MealPlanItem[]): { calories: number, protein_g: number, carbs_g: number, fat_g: number }`
    - Each item has `{ name, calories, protein_g, carbs_g, fat_g, serving_multiplier }`. Aggregate = sum of `field * serving_multiplier` for each item.
    - Export `MealPlanItem` type
    - Risk: None — pure function.
    - Rollback: Delete file.
    - _Requirements: 8.3_
  - [x] 10.2 Write property test for meal plan aggregate nutrition (Property 10)
    - Create `app/__tests__/utils/mealPlanLogic.test.ts`
    - Property 10: For any list of items with macros and multipliers, aggregate calories === sum of `item.calories * item.serving_multiplier`
    - Run: `cd app && npx jest --config jest.config.js --testPathPattern="mealPlanLogic"` — must pass
    - **Property 10: Meal plan aggregate nutrition**
    - **Validates: Requirements 8.3**
  - [x] 10.3 Add meal plan tab/section to AddNutritionModal
    - Add tab state: `activeTab: 'quick' | 'mealPlans'` (default 'quick')
    - Add tab selector at top of modal (two FilterPill components or a SegmentedControl)
    - "Quick Log" tab: existing macro entry form (unchanged)
    - "Meal Plans" tab: list of saved plans (fetched via `GET /meals/custom`) + "Create New Plan" button
    - Plan creation form: name TextInput + item list (add via food search or manual entry) + running aggregate display via `aggregateMealPlan` + Save button calling `POST /meals/custom` with `{ name, calories, protein_g, carbs_g, fat_g, micro_nutrients: { _plan_items: items } }`
    - Plan selection: tap a saved plan → populate macro fields with plan's aggregate values, set `notes` to plan name, switch to Quick Log tab
    - Favorite icon on each plan: calls `POST /meals/favorites` with plan data
    - Edit: tap edit icon → re-open creation form with plan data pre-filled → `PUT /meals/custom/{id}`
    - Delete: long-press or swipe → confirm alert → `DELETE /meals/custom/{id}` (soft-delete)
    - Risk: This is the largest single task. The meal plan creation form is complex (multi-item with search). Mitigation: Start with manual-entry-only items for v1, add food-search-based items as a follow-up if time permits.
    - Rollback: Revert AddNutritionModal changes, delete mealPlanLogic.ts.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [x] 10.4 Write backend property tests for meal plan CRUD (Properties 11, 12, 13)
    - Create `tests/test_meal_plan_properties.py`
    - Property 11: Create meal plan via API, retrieve, verify name and macros match
    - Property 12: Create plan, log nutrition entry referencing it, edit plan macros, verify original entry unchanged
    - Property 13: Create plan, delete, verify `deleted_at` is set, verify excluded from normal GET queries
    - Uses existing `conftest.py` fixtures
    - Run: `python -m pytest tests/test_meal_plan_properties.py -x -q` — must pass
    - **Property 11: Meal plan save round-trip**
    - **Property 12: Meal plan edit does not alter logged entries**
    - **Property 13: Meal plan soft-delete is recoverable**
    - **Validates: Requirements 8.4, 8.7, 8.8**

- [ ] 11. **FINAL CHECKPOINT — Full regression**
  - Run full frontend test suite: `cd app && npx jest --config jest.config.js` — all tests must pass (expect ~170+ tests)
  - Run full backend test suite: `python -m pytest tests/ -x -q` — all tests must pass
  - Manual verification (complete flow):
    1. Register/login → Dashboard loads with greeting, rings, quick actions
    2. Tap Nutrition quick action → fill macros + fibre + 3 water glasses + 2 micronutrients → Save → entry appears in Logs
    3. Tap Training quick action → add exercise via picker → add 3 sets → Save Session → session appears in Logs (no blank screen)
    4. Tap Bodyweight quick action → toggle to lbs → enter 176 → Save → verify DB has ~79.8 kg
    5. Go to Nutrition modal → Meal Plans tab → Create plan with 2 items → Save → plan appears in list → tap plan → macros populate → Save as entry
    6. Profile → edit display name inline → Save → name updates
    7. Training modal → add set → rest timer fires → tap gear → change compound rest to 120s → Save → next rest timer uses 120s
  - If any flow fails: fix before declaring done.

## Dependency Graph

```
Task 1 (Nutrition save fix) ─── no dependencies
Task 2 (Food search fix) ────── no dependencies
Task 3 (Training save fix) ──── no dependencies
Task 4 (Checkpoint) ──────────── depends on 1, 2, 3
Task 5 (Unit conversion) ────── depends on 4 (bug fixes must be green)
Task 6 (Micronutrients) ─────── depends on 4 (nutrition save must work first)
  └─ 6.1-6.4 (WaterTracker + serializer) ── no cross-deps
  └─ 6.5 (integrate into modal) ──────────── depends on 6.1, 6.3, and Task 1 (fixed payload)
  └─ 6.6 (backend test) ─────────────────── no frontend deps
Task 7 (Checkpoint) ──────────── depends on 5, 6
Task 8 (Profile editability) ── depends on 4 (no modal deps)
Task 9 (Rest timer) ─────────── depends on 4 (training modal must work)
Task 10 (Meal plans) ────────── depends on 4 (nutrition save must work), 6.3 (serializer for micro_nutrients)
Task 11 (Final checkpoint) ──── depends on all
```

## Parallelization Opportunities

- Tasks 1, 2, 3 are fully independent — execute in parallel
- Tasks 5, 6.1-6.4, 8, 9 are independent after checkpoint 4 — execute in parallel
- Task 6.5 must wait for 6.1 + 6.3 + Task 1
- Task 10 must wait for checkpoint 4 + Task 6.3

## Monitoring Post-Launch

- Alert if `POST /nutrition/entries` error rate exceeds 5% (was 100% before fix)
- Alert if `POST /training/sessions` error rate exceeds 5%
- Alert if `GET /food/search` p99 latency exceeds 2 seconds
- Track: nutrition entries created per day (should increase after save fix)
- Track: training sessions created per day (should increase after blank screen fix)
- Track: `micro_nutrients` field fill rate (new metric — baseline is 0%)
- Track: water glass usage (new metric — count of entries with `water_ml > 0`)
- Track: custom meal plan creation rate (new metric)
- Track: bodyweight entries with imperial unit (new metric — count where frontend sent lbs conversion)

## What Was Cut From Original Plan

- ~~Feature flag for nutrition_v2~~: All new fields are optional JSONB. No flag needed — backward compatible by design.
- ~~Database migration~~: `micro_nutrients` JSONB column already exists on all relevant tables. No migration.
- ~~Barcode scanning, AI meal suggestions, photo logging~~: Explicitly out of scope per requirements.
- ~~Separate EditableField tests~~: The component is simple enough that ProfileScreen integration tests cover it.

## What Was Added vs Original Plan

- Pre-flight checklist with food database seed verification
- Explicit `buildNutritionPayload` pure function extraction (testable without React)
- `microNutrientSerializer.ts` extraction (testable without React)
- `mealPlanLogic.ts` extraction (testable without React)
- `waterLogic.ts` extraction (testable without React)
- Dependency graph with parallelization opportunities
- Monitoring metrics for post-launch validation
- Manual verification steps at each checkpoint
