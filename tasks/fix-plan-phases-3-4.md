# Fix Plan: Phases 3-4 (Type Safety & Code Deduplication)

> **Prerequisites:** Phases 1-2 must be complete before starting Phase 3. Phase 4 Task 4.1 depends on Task 3.3.
> **TypeScript strict mode is enabled.**

---

## Phase 3: Type Safety

---

### Task 3.1: Navigation Types
- **Root Cause:** 19 screens use `({navigation}: any)`, bypassing TypeScript's route/param checking entirely. This means typos in route names, missing params, and wrong param types are all silent failures.
- **Fix:** Create a centralized navigation type file with `RootStackParamList`, `BottomTabParamList`, and `AuthStackParamList` using `@react-navigation/native-stack` typed patterns. Replace all `any` navigation props with `NativeStackScreenProps<ParamList, 'RouteName'>`.
- **Files:**
  - `app/types/navigation.ts` (NEW)
  - `App.tsx:104,113,121,129,138`
  - `BottomTabNavigator.tsx:193,288`
  - `ActiveWorkoutScreen.tsx:82,290`
  - `WorkoutSummaryScreen.tsx:44`
  - `DashboardScreen.tsx:73`
  - `PrepSundayFlow.tsx:28`
  - `MealPlanScreen.tsx:31`
  - `ShoppingListView.tsx:24`
  - `NutritionReportScreen.tsx:145`
  - `YearInReviewScreen.tsx:23`
  - `MonthlyReportScreen.tsx:60`
  - `WeeklyReportScreen.tsx:98`
- **Steps:**
  1. Audit all `createNativeStackNavigator` / `createBottomTabNavigator` calls to catalog every route name and its expected params.
  2. Create `app/types/navigation.ts` exporting `RootStackParamList`, `BottomTabParamList`, `AuthStackParamList` with correct param shapes (use `undefined` for no-param routes).
  3. Export convenience types: `type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>` (same for other stacks).
  4. Update each navigator to use the typed param list generic: `createNativeStackNavigator<RootStackParamList>()`.
  5. Update all 19 screen components to use the typed screen props instead of `any`.
  6. Run `npx tsc --noEmit` — fix any param mismatches surfaced.
- **Testing:** `npx tsc --noEmit` passes. Manually navigate to each screen in dev build to confirm no runtime regressions.
- **Risk:** LOW — additive types, no runtime behavior change.
- **Effort:** 2 hours
- **Depends on:** Nothing (can start immediately within Phase 3)

---

### Task 3.2: Fix `catch(err: any)` → `catch(err: unknown)`
- **Root Cause:** 47 catch blocks (32 explicit `catch(err: any)` + 15 untyped `catch(err)` which default to `any` in strict mode) allow unsafe property access on error objects. A non-Error throw (e.g., string, null) would cause a secondary crash at `err.message`.
- **Fix:** Change all to `catch(err: unknown)` and add a type guard utility. Every catch block that accesses `.message` or other Error properties must narrow first.
- **Files:**
  - `app/utils/errors.ts` (NEW)
  - All screens, hooks, and components identified in the audit (47 locations across the codebase)
- **Steps:**
  1. Create `app/utils/errors.ts`:
     ```typescript
     export function getErrorMessage(err: unknown): string {
       if (err instanceof Error) return err.message;
       return String(err);
     }
     ```
  2. Global find: regex `catch\s*\(\s*(\w+)\s*(?::\s*any)?\s*\)` across `app/`.
  3. Replace each match with `catch(err: unknown)`.
  4. In each catch body, replace `err.message` with `getErrorMessage(err)`. For blocks that need the full Error object, add `if (err instanceof Error)` guard.
  5. Run `npx tsc --noEmit` — fix any remaining unsafe accesses.
- **Testing:** `npx tsc --noEmit` passes. Trigger error paths in dev (e.g., network off, invalid input) to confirm error messages still display correctly.
- **Risk:** LOW — catch blocks already handle errors; we're just narrowing the type.
- **Effort:** 2 hours
- **Depends on:** Nothing (can run in parallel with 3.1)

---

### Task 3.3: Reconcile Dangerous Type Inconsistencies (BUG RISK)
- **Root Cause:** Critical enums have divergent copies with DIFFERENT values:
  - `GoalType` — 4 copies: `onboardingCalculations.ts:5` uses `lose_fat/build_muscle/maintain/eat_healthier/recomposition`; `editPlanLogic.ts:21` uses `cutting/maintaining/bulking`; `GoalsSection.tsx:25`; `onboardingSlice.ts:8`. A goal saved as `"lose_fat"` will fail a `=== "cutting"` check silently.
  - `ActivityLevel` — 3 copies with different values across files.
  - `Sex` — 3 copies, `'other'` option missing in some, causing runtime exclusion bugs.
- **Fix:** Create a single canonical `app/types/onboarding.ts` with one source of truth for each enum. Add a mapping layer if the domain genuinely needs two representations (e.g., user-facing vs. calculation-facing).
- **Files:**
  - `app/types/onboarding.ts` (NEW)
  - `src/modules/onboarding/onboardingCalculations.ts:5`
  - `src/modules/onboarding/editPlanLogic.ts:21`
  - `app/components/GoalsSection.tsx:25`
  - `src/modules/onboarding/onboardingSlice.ts:8`
  - All files defining/using `ActivityLevel` (3 locations)
  - All files defining/using `Sex` (3 locations)
- **Steps:**
  1. Catalog every variant of `GoalType`, `ActivityLevel`, and `Sex` — document exact values in each file.
  2. Determine canonical values. For `GoalType`: if `lose_fat` and `cutting` represent the same concept, pick one and create a migration/mapping. If they're genuinely different domains, create `UserGoalType` vs `CalculationGoalType` with an explicit converter.
  3. Create `app/types/onboarding.ts` with the canonical types.
  4. Update all 4 `GoalType` consumers to import from canonical file. Add mapping function if two representations are needed.
  5. Update all 3 `ActivityLevel` consumers.
  6. Update all 3 `Sex` consumers — ensure `'other'` is present in the canonical type.
  7. Run `npx tsc --noEmit`.
  8. Search codebase for string literals matching old enum values to catch any hardcoded comparisons.
- **Testing:** `npx tsc --noEmit` passes. Test onboarding flow end-to-end: set goal → verify calculations use correct value → verify edit plan reflects correct goal. Test all 3 Sex options including 'other'.
- **Risk:** HIGH — These are active bugs. Mismatched enums mean calculations may silently use wrong formulas. Careful mapping is critical.
- **Effort:** 4 hours
- **Depends on:** Nothing (can start in parallel, but should be reviewed carefully before Phase 4)

---

## Phase 4: Code Deduplication

---

### Task 4.1: Canonical Type Files
- **Root Cause:** 29 types are duplicated across 72 locations. Each copy drifts independently — fields get added to one copy but not others, causing subtle bugs when components expect different shapes for the same concept.
- **Fix:** Create canonical type files per domain and update all consumers to import from them.
- **Files:**
  - `app/types/nutrition.ts` (NEW) — `FoodItem` (6 copies), `NutritionEntry` (3), `Macros` (4), `MacroTargets` (2), `MacroValues` (2), `MealFavorite` (2)
  - `app/types/analytics.ts` (NEW) — `TrendPoint` (4), `TimeRange` (4), `MuscleGroupVolume` (3), `FatigueScore` (2), `Classification` (2)
  - `app/types/common.ts` (NEW) — `ValidationResult` (3), `ComparisonSideProps` (2), `DayPlan` (2), `RecoveryFactor` (2), `PhotoMeta` (2), `PhotoPathMap` (2), `Article` (2)
  - `app/types/training.ts` (UPDATE) — add `PreviousPerformanceData` (2), `TimerState` (2)
  - Consumer files requiring import updates (all locations where duplicates currently exist):
    - **FoodItem (6):** All screens/components/hooks that define or inline a FoodItem type
    - **NutritionEntry (3):** Nutrition tracking screens and slices
    - **Macros (4):** Macro calculation utils, nutrition screens, meal builder
    - **MacroTargets (2):** Onboarding calculations, nutrition dashboard
    - **MacroValues (2):** Macro scaling utils, meal plan logic
    - **MealFavorite (2):** Meal plan screen, favorites component
    - **TrendPoint (4):** All analytics/report screens
    - **TimeRange (4):** Analytics screens, report generators
    - **MuscleGroupVolume (3):** Volume tracking logic, muscle group grid, reports
    - **FatigueScore (2):** Recovery screens, fatigue calculation utils
    - **Classification (2):** Strength standards, leaderboard
    - **ValidationResult (3):** Form validation across onboarding, settings, meal builder
    - **ComparisonSideProps (2):** Comparison UI components
    - **DayPlan (2):** Meal plan screen, prep flow
    - **RecoveryFactor (2):** Recovery screens, dashboard
    - **PhotoMeta (2), PhotoPathMap (2):** Photo/progress screens
    - **Article (2):** Article list, article detail
    - **PreviousPerformanceData (2):** Active workout, workout summary
    - **TimerState (2):** Timer component, active workout screen
- **Steps:**
  1. For each type, diff all copies to find the superset of fields. The canonical version must be the union of all fields (with optional markers where not all consumers need every field).
  2. Create `app/types/nutrition.ts` with all 6 nutrition types.
  3. Create `app/types/analytics.ts` with all 5 analytics types.
  4. Create `app/types/common.ts` with all 7 common types.
  5. Update `app/types/training.ts` with 2 additional types.
  6. For each of the 72 consumer locations: remove the local type definition, add `import { TypeName } from 'app/types/<domain>'`.
  7. Run `npx tsc --noEmit` after each domain file to catch shape mismatches incrementally.
  8. Create `app/types/index.ts` barrel export for convenience.
- **Testing:** `npx tsc --noEmit` passes with zero errors. Spot-check key flows: nutrition logging, analytics reports, workout tracking, photo progress.
- **Risk:** MED — Large surface area (72 files). Shape mismatches between copies may require adding optional fields. Do one domain at a time to limit blast radius.
- **Effort:** 6 hours
- **Depends on:** Task 3.3 (canonical onboarding types must exist first so `GoalType`/`ActivityLevel`/`Sex` aren't re-duplicated)

---

### Task 4.2: Shared Utility Functions
- **Root Cause:** 12 functions are duplicated across 26 locations. Some copies have diverged (e.g., `getTimerColor` uses different thresholds in its two copies — one may be wrong). Bugs fixed in one copy don't propagate to others.
- **Fix:** Create shared utility modules per domain. For divergent implementations, determine correct behavior and unify (or parameterize).
- **Files:**
  - `app/utils/formatting.ts` (NEW) — `formatDate`, `formatMuscle`, `formatExerciseName`, `formatPreviousPerformance`
  - `app/utils/color.ts` (NEW) — `hexToRgba`, `getStatusColor`, `getTimerColor`
  - `app/utils/nutrition.ts` (NEW) — `scaleMacros`
  - `app/utils/training.ts` (NEW) — `calculateWorkingVolume`, `computeWorkoutSummary`, `computeWeeklySummary`, `getStatusLabel`
  - Consumer files requiring import updates:
    - `formatDate` (3): `src/modules/periodization/periodizationUtils.ts:61`, `NutritionReportScreen.tsx:39`, `GoalStep.tsx:27`
    - `hexToRgba` (2): `app/components/MuscleGroupGrid.tsx:14`, `app/components/ExerciseCard.tsx:16`
    - `formatMuscle` (2): `src/modules/wns/wnsRecommendations.ts:58`, `app/components/WorkoutSummaryModal.tsx:45`
    - `formatExerciseName` (2): `app/components/StrengthStandardsCard.tsx:29`, `app/components/StrengthLeaderboard.tsx:30`
    - `scaleMacros` (2): `src/modules/nutrition/macroScaling.ts:16`, `src/modules/nutrition/mealBuilderLogic.ts:42`
    - `getStatusLabel` (3): `src/modules/volume/muscleVolumeLogic.ts:63`, `src/modules/micro/microDashboardLogic.ts:20`, `WeeklyReportScreen.tsx:80`
    - `calculateWorkingVolume` (2): both volume calculation consumers
    - `computeWorkoutSummary` (2): workout summary consumers
    - `formatPreviousPerformance` (2): previous performance display consumers
    - `getStatusColor` (2): status color consumers
    - `getTimerColor` (2): timer color consumers — **DIVERGENT, needs reconciliation**
    - `computeWeeklySummary` (2): weekly summary consumers
- **Steps:**
  1. For each function, diff all copies. Flag divergent implementations (known: `getTimerColor` has different thresholds).
  2. For `getTimerColor`: determine which thresholds are correct (or if both are valid for different contexts). If context-dependent, parameterize: `getTimerColor(seconds: number, thresholds?: { warn: number; danger: number })`.
  3. Create `app/utils/formatting.ts` with `formatDate`, `formatMuscle`, `formatExerciseName`, `formatPreviousPerformance`.
  4. Create `app/utils/color.ts` with `hexToRgba`, `getStatusColor`, `getTimerColor`.
  5. Create `app/utils/nutrition.ts` with `scaleMacros`.
  6. Create `app/utils/training.ts` with `calculateWorkingVolume`, `computeWorkoutSummary`, `computeWeeklySummary`, `getStatusLabel`.
  7. For each of the 26 consumer locations: remove the local function, add import from shared util.
  8. Run `npx tsc --noEmit` after each util file.
- **Testing:** `npx tsc --noEmit` passes. Unit test each shared util function (especially `getTimerColor` with both threshold sets, `scaleMacros` with edge cases). Verify formatting outputs match previous behavior in UI.
- **Risk:** MED — `getTimerColor` divergence is a known risk; wrong unification could change UX. `scaleMacros` handles nutrition math — must preserve precision.
- **Effort:** 4 hours
- **Depends on:** Task 4.1 (shared utils may reference canonical types from 4.1, e.g., `Macros` in `scaleMacros`)

---

## Summary

| Task | Description | Risk | Effort | Depends On |
|------|-------------|------|--------|------------|
| 3.1 | Navigation Types | LOW | 2h | — |
| 3.2 | catch(err: unknown) | LOW | 2h | — |
| 3.3 | Reconcile Enum Inconsistencies | HIGH | 4h | — |
| 4.1 | Canonical Type Files | MED | 6h | 3.3 |
| 4.2 | Shared Utility Functions | MED | 4h | 4.1 |

**Total estimated effort:** 18 hours

**Execution order:** 3.1 + 3.2 + 3.3 (parallel) → 4.1 → 4.2
