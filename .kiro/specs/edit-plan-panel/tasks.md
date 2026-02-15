# Implementation Plan: Edit Plan Panel

## Overview

Replace `BodyStatsSection` and `GoalsSection` on ProfileScreen with a unified `EditPlanPanel`. This is a frontend-only change. The backend `POST /api/v1/users/recalculate` endpoint already exists.

Execution order: pure logic → property tests → verify → UI leaf components → orchestrator → ProfileScreen integration → unit tests → final verify.

**Pre-flight checks before starting**:
- Confirm `app/utils/unitConversion.ts` exports `formatWeight`, `formatHeight`, `parseWeightInput`, `cmToFtIn`, `ftInToCm`, `convertWeight`
- Confirm `app/store/index.ts` exports `useStore` with `setLatestMetrics`, `setGoals`, `setAdaptiveTargets` actions
- Confirm `app/services/api.ts` default export is an axios instance with `baseURL` ending in `/api/v1/`
- Confirm `fast-check` is in `package.json` devDependencies
- Confirm Jest is configured and `app/__tests__/` pattern works (see existing `app/__tests__/unitConversion.test.ts`)

## Tasks

- [x] 1. Create pure logic module `app/utils/editPlanLogic.ts`
  - [x] 1.1 Define TypeScript interfaces: `EditDraft`, `ValidationResult`, `SummaryFields`, `RecalculatePayload`
    - `EditDraft`: all form fields as strings except `activityLevel` (union of 5 levels) and `goalType` (union of 3 types). Fields: `weight`, `heightCm`, `heightFeet`, `heightInches`, `bodyFatPct`, `activityLevel`, `goalType`, `targetWeight`, `goalRate`
    - `ValidationResult`: `{ valid: boolean; errors: Partial<Record<keyof EditDraft, string>> }`
    - `SummaryFields`: 11 string fields (weight, height, bodyFat, activityLevel, goalType, targetWeight, goalRate, calories, protein, carbs, fat)
    - `RecalculatePayload`: `{ metrics: { weight_kg, height_cm, body_fat_pct?, activity_level }, goals: { goal_type, target_weight_kg?, goal_rate_per_week? } }`
    - Export all interfaces
    - _Requirements: 3.1, 4.1, 5.1_
    - **Risk**: Type mismatch with store shapes. **Mitigation**: Cross-reference `AppState` in `app/store/index.ts` — the `metrics` prop shape is `{ id, heightCm, weightKg, bodyFatPct, activityLevel, recordedAt }`, goals is `{ id, userId, goalType, targetWeightKg, goalRatePerWeek }`.
    - **Rollback**: Delete `editPlanLogic.ts`. No other files depend on it yet.

  - [x] 1.2 Implement `formatSummaryFields(metrics, goals, targets, unitSystem)` → `SummaryFields`
    - Import `formatWeight`, `formatHeight` from `unitConversion.ts`
    - Return "—" for any null/undefined source field
    - Activity level: map codes to labels (`sedentary` → "Sedentary", `light` → "Light", `moderate` → "Moderate", `active` → "Active", `very_active` → "Very Active")
    - Goal type: map codes to labels (`cutting` → "Cutting", `maintaining` → "Maintaining", `bulking` → "Bulking")
    - Goal rate: format with sign prefix and unit suffix (e.g., "+0.5 lbs/week"). Convert from kg/week to lbs/week if imperial (multiply by 2.20462)
    - Macro targets: round to integer, format as "2,150" for calories, "160g" for protein/carbs/fat
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
    - **Risk**: Locale-dependent number formatting (commas). **Mitigation**: Use `toLocaleString('en-US')` for calorie formatting or manual comma insertion. Keep it simple — `Math.round(cal).toLocaleString()`.
    - **Rollback**: Revert function body. Interfaces from 1.1 remain valid.

  - [x] 1.3 Implement `initializeDraft(metrics, goals, unitSystem)` → `EditDraft`
    - If metrics is null: empty strings for all numeric fields, activityLevel defaults to `'moderate'`
    - If goals is null: goalType defaults to `'maintaining'`, targetWeight and goalRate empty
    - Weight: `convertWeight(metrics.weightKg, unitSystem)` → string, no trailing zeros beyond 1 decimal
    - Height imperial: `cmToFtIn(metrics.heightCm)` → set `heightFeet` and `heightInches` as integer strings
    - Height metric: `Math.round(metrics.heightCm)` → string
    - Target weight: same conversion as weight
    - Goal rate: convert from kg/week to display unit (multiply by 2.20462 if imperial), round to 1 decimal
    - _Requirements: 3.1, 4.1, 2.2_
    - **Risk**: `convertWeight` returns a number, need to format as string without floating point artifacts. **Mitigation**: Use `.toFixed(1)` then strip trailing ".0" if desired, or just use the raw number's `.toString()`.
    - **Rollback**: Revert function body.

  - [x] 1.4 Implement `validateDraft(draft, unitSystem)` → `ValidationResult`
    - Weight: required, `parseFloat` must yield > 0. Error: "Enter a valid weight"
    - Height metric: `heightCm` required, must parse to > 0. Error: "Enter a valid height"
    - Height imperial: `heightFeet` required >= 0, `heightInches` required 0–11. Error: "Enter a valid height"
    - Body fat %: optional. If non-empty, must parse to number in [0, 100]. Error: "Must be between 0 and 100"
    - Target weight: optional. If non-empty, must parse to > 0. Skipped when goalType is `'maintaining'`. Error: "Enter a valid weight"
    - Goal rate: optional. If non-empty, must parse to a finite number. Skipped when goalType is `'maintaining'`. Error: "Enter a valid rate"
    - Return `{ valid: true, errors: {} }` when all checks pass
    - _Requirements: 6.2, 6.3, 6.4_
    - **Risk**: Edge case — user enters "0" for weight (falsy but parsed). **Mitigation**: Check `> 0` explicitly, not just truthiness.
    - **Rollback**: Revert function body.

  - [x] 1.5 Implement `buildRecalculatePayload(draft, unitSystem)` → `RecalculatePayload`
    - Weight: `parseWeightInput(parseFloat(draft.weight), unitSystem)` → `weight_kg`
    - Height imperial: `ftInToCm(parseInt(draft.heightFeet), parseInt(draft.heightInches))` → `height_cm`
    - Height metric: `Math.round(parseFloat(draft.heightCm))` → `height_cm`
    - Body fat: if `draft.bodyFatPct` non-empty, `parseFloat` → `body_fat_pct`; otherwise omit
    - Activity level: `draft.activityLevel` → `activity_level`
    - Goal type: `draft.goalType` → `goal_type`
    - Target weight: if non-empty AND goalType !== `'maintaining'`, `parseWeightInput(parseFloat(draft.targetWeight), unitSystem)` → `target_weight_kg`; otherwise omit
    - Goal rate: if non-empty AND goalType !== `'maintaining'`, convert to kg/week (divide by 2.20462 if imperial, round to 2 decimals) → `goal_rate_per_week`; otherwise omit
    - _Requirements: 5.1, 5.4, 5.5, 5.6_
    - **Risk**: Goal rate sign convention — cutting should be negative. **Mitigation**: The user enters the signed value. We pass it through as-is. The backend handles sign semantics.
    - **Rollback**: Revert function body.

- [x] 2. Write property tests in `app/__tests__/utils/editPlanLogic.test.ts`
  - [x] 2.1 Property test: Summary card renders all present fields (Property 1)
    - Generate arbitrary non-null metrics (weightKg 20–300, heightCm 100–250, bodyFatPct 1–50, activityLevel from 5 options), non-null goals (goalType from 3 options, targetWeightKg 30–200, goalRatePerWeek -2 to 2), non-null targets (calories 1000–5000, protein/carbs/fat 10–500), unitSystem from {metric, imperial}
    - Assert: every field in `SummaryFields` is not "—"
    - Assert: weight string contains the converted numeric value
    - **Property 1: Summary card renders all present fields**
    - **Validates: Requirements 1.1, 1.3, 1.4**

  - [x] 2.2 Property test: Null optional fields display as dash (Property 2)
    - Generate metrics/goals where optional fields (bodyFatPct, targetWeightKg, goalRatePerWeek) are randomly null
    - Assert: null fields produce "—", non-null fields produce non-dash strings
    - **Property 2: Null optional fields display as dash**
    - **Validates: Requirements 1.2**

  - [x] 2.3 Property test: Draft initialization round-trip (Property 3)
    - Generate valid metrics (weightKg 20–300, heightCm 100–250) and goals, and unitSystem
    - Call `initializeDraft` then `buildRecalculatePayload` on the result
    - Assert: `payload.metrics.weight_kg` within 0.1 kg of original `weightKg`
    - Assert: `payload.metrics.height_cm` within 1 cm of original `heightCm`
    - **Property 3: Draft initialization round-trip**
    - **Validates: Requirements 3.1, 4.1, 5.4, 5.5**

  - [x] 2.4 Property test: Payload builder produces well-formed output (Property 4)
    - Generate valid `EditDraft` with positive weight/height strings, valid activity level, valid goal type
    - Assert: `weight_kg > 0`, `height_cm > 0`, `activity_level` is one of 5 valid values, `goal_type` is one of 3 valid values
    - Assert: when goalType is `'maintaining'`, `target_weight_kg` and `goal_rate_per_week` are absent
    - **Property 4: Payload builder produces well-formed output**
    - **Validates: Requirements 5.1, 5.4, 5.5, 5.6**

  - [x] 2.5 Property test: Validation rejects invalid numeric inputs (Property 5)
    - Generate drafts with invalid weight (empty, "abc", "0", "-5"), invalid height, body fat outside [0,100]
    - Assert: `validateDraft` returns `valid: false` with appropriate error keys
    - **Property 5: Validation rejects invalid numeric inputs**
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [x] 2.6 Property test: Weight conversion round-trip (Property 6)
    - Generate weight in kg [20, 300]
    - Convert to imperial via `convertWeight`, back via `parseWeightInput`
    - Assert: result within 0.1 kg of original
    - **Property 6: Weight conversion round-trip**
    - **Validates: Requirements 8.2**

  - [x] 2.7 Property test: Height conversion round-trip (Property 7)
    - Generate height in cm [100, 250]
    - Convert via `cmToFtIn`, back via `ftInToCm`
    - Assert: result within 1 cm of original
    - **Property 7: Height conversion round-trip**
    - **Validates: Requirements 8.3**

- [x] 3. Checkpoint — Pure logic verification
  - Run `npx jest app/__tests__/utils/editPlanLogic.test.ts --run` and ensure all property tests pass
  - Run `npx jest app/__tests__/unitConversion.test.ts --run` to confirm no regressions in existing conversion tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Build `PlanSummaryCard` component
  - [x] 4.1 Create `app/components/profile/PlanSummaryCard.tsx`
    - Props: `metrics` (same shape as store's `latestMetrics`), `goals` (same shape as store's `goals`), `adaptiveTargets` (same shape as store's `adaptiveTargets`), `unitSystem`, `onEdit: () => void`
    - Call `formatSummaryFields` from `editPlanLogic.ts` to get all display strings
    - Layout: section title "My Plan", then two rows of label-value pairs (body stats row: weight, height, body fat, activity; goals row: goal type, target weight, goal rate), then TDEE targets grid (4-column: calories, protein, carbs, fat using `colors.macro.*` tokens), then "Edit My Plan" `Button` calling `onEdit`
    - Use existing `Card` component as wrapper, `Icon` for section icon, `Button` for CTA
    - All values that are "—" render as muted text
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
    - **Risk**: Layout breaks on small screens. **Mitigation**: Use `flexWrap: 'wrap'` on the label-value rows. The macro grid already uses `flex: 1` per item (same pattern as existing `GoalsSection`'s `MacroTargets`).
    - **Rollback**: Delete `PlanSummaryCard.tsx`. No other files reference it yet.

- [x] 5. Build `PlanEditFlow` component with step sub-components
  - [x] 5.1 Create `app/components/profile/PlanEditFlow.tsx` with `BodyStatsStep` and `GoalsStep` as internal sub-components
    - Props: `metrics`, `goals`, `unitSystem`, `onSave: (result: { metrics, goals, targets }) => void`, `onCancel: () => void`
    - Local state: `draft` (via `initializeDraft`), `currentStep` (0 or 1), `saving` (boolean), `error` (string | null), `fieldErrors` (from `validateDraft`)
    - Step 0 — `BodyStatsStep`: weight input with unit label (lbs/kg), height input (ft+in for imperial, cm for metric), body fat % input (optional, placeholder "optional"), activity level picker (5 pill-style `TouchableOpacity` options). Display field-level errors under each field.
    - Step 1 — `GoalsStep`: goal type picker (3 pill-style options), target weight input (hidden when maintaining), goal rate input (hidden when maintaining). Display field-level errors.
    - "Next" button on step 0 → advance to step 1
    - "Back" button on step 1 → return to step 0
    - "Cancel" link on both steps → call `onCancel`
    - "Save" button on step 1: call `validateDraft(draft, unitSystem)`. If invalid, set `fieldErrors` and navigate to the step containing the first error. If valid, call `buildRecalculatePayload(draft, unitSystem)`, POST to `api.post('users/recalculate', payload)`. On success: map snake_case response to camelCase, call `onSave({ metrics, goals, targets })`. On error: set `error` message, keep form open with draft preserved.
    - While `saving`: disable Save button, show `ActivityIndicator`, prevent double-tap
    - Import `api` from `../../services/api`, import `initializeDraft`, `validateDraft`, `buildRecalculatePayload` from `../../utils/editPlanLogic`
    - _Requirements: 3.1–3.6, 4.1–4.5, 5.1–5.6, 6.1, 6.5_
    - **Risk**: Snake-to-camel mapping on API response is error-prone. **Mitigation**: Map explicitly field-by-field (same pattern as existing `BodyStatsSection.handleSave`). Do NOT use a generic transformer.
    - **Risk**: Validation errors on step 0 while user is on step 1. **Mitigation**: On validation failure, set `currentStep` to 0 if the first error key is a body stats field (weight, heightCm, heightFeet, heightInches, bodyFatPct).
    - **Rollback**: Delete `PlanEditFlow.tsx`. No other files reference it yet.

- [x] 6. Build `EditPlanPanel` orchestrator and integrate into ProfileScreen
  - [x] 6.1 Create `app/components/profile/EditPlanPanel.tsx`
    - Props: `metrics`, `goals`, `adaptiveTargets`, `unitSystem` (same shapes as store slices)
    - Local state: `editing: boolean`
    - When `!editing` AND both `metrics` and `goals` are null: render `EmptyState` with icon `<Icon name="target" .../>`, title "My Plan", description "Set up your body stats and goals to get personalized targets", actionLabel "Set Up My Plan", onAction sets `editing = true`
    - When `!editing` AND at least one of metrics/goals exists: render `PlanSummaryCard` with `onEdit` setting `editing = true`
    - When `editing`: render `PlanEditFlow` with `onSave` callback that calls `useStore`'s `setLatestMetrics`, `setGoals`, `setAdaptiveTargets` and sets `editing = false`; `onCancel` sets `editing = false`
    - _Requirements: 2.1, 2.2, 2.3, 7.1_
    - **Risk**: Store import pattern. **Mitigation**: Use `const store = useStore()` inside the component (same pattern as `ProfileScreen`).
    - **Rollback**: Delete `EditPlanPanel.tsx`.

  - [x] 6.2 Update `app/screens/profile/ProfileScreen.tsx` to replace BodyStatsSection + GoalsSection with EditPlanPanel
    - Remove imports: `BodyStatsSection`, `GoalsSection`
    - Add import: `EditPlanPanel` from `../../components/profile/EditPlanPanel`
    - Remove the two `Animated.View` blocks wrapping `bodyStatsAnim` + `BodyStatsSection` and `goalsAnim` + `GoalsSection`
    - Add single `Animated.View` with `planPanelAnim = useStaggeredEntrance(1, 60)` rendering `<EditPlanPanel metrics={store.latestMetrics} goals={store.goals} adaptiveTargets={store.adaptiveTargets} unitSystem={store.unitSystem} />`
    - Renumber staggered entrance indices: header=0, planPanel=1, preferences=2, features=3, subscription=4, account=5 (was 0–6, now 0–5)
    - Remove unused `bodyStatsAnim` and `goalsAnim` variables
    - Verify: `PreferencesSection`, `AccountSection`, Features, Subscription sections remain untouched
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
    - **Risk**: Breaking other ProfileScreen functionality (logout, display name edit, subscription). **Mitigation**: Only touch the two `Animated.View` blocks and their imports. Do not modify `handleLogout`, `handleSaveDisplayName`, `fetchAll`, or any other section.
    - **Risk**: `fetchAll` in `useEffect` still fetches metrics/goals/targets separately — this is correct and must remain. The EditPlanPanel reads from the store, which `fetchAll` populates.
    - **Rollback**: `git checkout app/screens/profile/ProfileScreen.tsx`. Re-add `BodyStatsSection` and `GoalsSection` imports and blocks.

- [x] 7. Checkpoint — Integration verification
  - Run `npx jest app/__tests__/ --run` to ensure no regressions across all frontend tests
  - Manually verify (or ask user to verify): ProfileScreen renders with the new EditPlanPanel, other sections (preferences, features, subscription, account) are unaffected
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Write unit tests for component behavior
  - [x] 8.1 Write unit tests in `app/__tests__/components/EditPlanPanel.test.ts`
    - Test: empty state renders "Set Up My Plan" CTA when both metrics and goals are null
    - Test: summary card renders all fields when full data provided
    - Test: summary card shows dashes for partial data (metrics only, goals only)
    - Test: "Maintaining" goal type hides target weight and goal rate fields in edit flow
    - Test: imperial mode shows ft/in height fields; metric mode shows single cm field
    - Test: save button is disabled and shows ActivityIndicator while saving
    - Test: inline error message displayed when API call rejects (mock `api.post` to reject with Error)
    - Test: successful save closes edit flow and returns to summary view (mock `api.post` to resolve with valid response)
    - _Requirements: 2.1, 2.3, 4.5, 6.1, 6.5_
    - **Risk**: Mocking `api.post` and `useStore`. **Mitigation**: Use `jest.mock('../../services/api')` and `jest.mock('../../store')` — same pattern as existing test files in `app/__tests__/`.

- [x] 9. Final checkpoint — Full test suite
  - Run `npx jest --run` to ensure all tests pass across the entire frontend test suite
  - Confirm no TypeScript errors: `npx tsc --noEmit`
  - Ensure all tests pass, ask the user if questions arise.

## Dependency Graph

```
1.1 (interfaces) → 1.2, 1.3, 1.4, 1.5 (all functions depend on interfaces)
1.2–1.5 (functions) → 2.1–2.7 (property tests depend on functions)
2.* (tests) → 3 (checkpoint)
1.2 (formatSummaryFields) → 4.1 (PlanSummaryCard calls it)
1.3, 1.4, 1.5 (init/validate/build) → 5.1 (PlanEditFlow calls them)
4.1, 5.1 → 6.1 (EditPlanPanel renders both)
6.1 → 6.2 (ProfileScreen imports EditPlanPanel)
6.2 → 7 (integration checkpoint)
6.1 → 8.1 (unit tests target EditPlanPanel)
8.1 → 9 (final checkpoint)
```

No circular dependencies. Each step only references artifacts from prior steps.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The API path is `users/recalculate` (plural) — the axios instance baseURL already includes `/api/v1/`
- No backend changes needed. The recalculate endpoint already accepts `{ metrics, goals }` and returns `{ metrics, goals, targets }`
- The old `BodyStatsSection.tsx` and `GoalsSection.tsx` files are NOT deleted — they become dead code. Clean up in a follow-up PR to keep this change reversible.
- Property tests use `fast-check` with `numRuns: 100` minimum, matching existing test patterns in `app/__tests__/unitConversion.test.ts`
- Snake-to-camel response mapping must be done explicitly field-by-field (not with a generic transformer) to match existing patterns
