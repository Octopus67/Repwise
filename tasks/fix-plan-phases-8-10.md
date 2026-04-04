# Tech Debt Fix Plan — Phases 8–10

> Depends on: Phases 4–5 completed first.
> Test baseline: 3,187 unit tests (Jest frontend, pytest backend) + 19 E2E Playwright specs.

---

## PHASE 8: FRONTEND PERFORMANCE

### 8.1 Decompose Large Components (>500 LOC)

- **Root Cause:** 13 components grew beyond 500 LOC, mixing concerns and hurting readability/testability.
- **Fix:** Extract focused sub-components from each.
- **Files:**
  - `AnalyticsScreen.tsx` (945 LOC) → `AnalyticsSummaryCard`, `AnalyticsChartSection`, `AnalyticsFilterBar`, `AnalyticsMetricRow`
  - `ActiveWorkoutScreen.tsx` (937 LOC) → `ActiveWorkoutHeader`, `ActiveSetRow`, `ActiveExerciseCard`, `RestTimerOverlay`, `WorkoutProgressBar`
  - `RecipeBuilderScreen.tsx` (851 LOC) → `RecipeIngredientList`, `RecipeMacroSummary`, `RecipeStepEditor`, `RecipeSearchBar`
  - `AddTrainingModal.tsx` (838 LOC) → `ExercisePickerList`, `SetInputRow`, `TrainingModalHeader`, `SupersetGroupView`
  - `LogsScreen.tsx` (834 LOC) → `LogDatePicker`, `LogEntryCard`, `LogFilterBar`, `LogSummaryRow`
  - `BodyStatsSection.tsx` (665 LOC) → `BodyStatCard`, `BodyStatChart`, `BodyStatInput`
  - `ExerciseCardPremium.tsx` (661 LOC) → `ExerciseCardHeader`, `ExerciseSetTable`, `ExerciseNotes`, `ExerciseHistoryMini`
  - `PlanEditFlow.tsx` (651 LOC) → `PlanDayEditor`, `PlanExerciseSlot`, `PlanWeekOverview`
  - `Icon.tsx` (647 LOC) → `IconSvgMap` (static lookup), `IconWrapper` (sizing/color)
  - `SessionDetailScreen.tsx` (553 LOC) → `SessionExerciseList`, `SessionSummaryHeader`, `SessionVolumeChart`
  - `BodyMeasurementsStep.tsx` (536 LOC) → `MeasurementInput`, `MeasurementPhotoUpload`, `MeasurementSummary`
  - `BarcodeScanner.tsx` (521 LOC) → `ScannerViewfinder`, `ScanResultOverlay`, `ManualEntryFallback`
  - `LearnScreen.tsx` (514 LOC) → `LearnCategoryList`, `LearnArticleCard`, `LearnSearchBar`
- **Steps:**
  1. For each component, identify distinct UI sections and state boundaries.
  2. Extract sub-components, passing props down (no new context/state management).
  3. Keep parent as orchestrator — sub-components are presentational where possible.
  4. Verify no behavior change via existing tests + visual spot-check.
- **Testing:** Existing Jest snapshot/unit tests must pass. Add unit tests for any sub-component with non-trivial logic.
- **Risk:** Medium — regressions from incorrect prop threading. Mitigate with incremental extraction (one component at a time).
- **Effort:** Large (3–4 days).
- **Dependencies:** None (can start immediately within Phase 8).

---

### 8.2 Add React.memo to Top Re-render Candidates

- **Root Cause:** Only 3 of 172 components are memoized (`RestDayCard`, `TodayWorkoutCard`, `ProgressRing`). List items and cards in `.map()` re-render on every parent state change.
- **Fix:** Wrap top 20 candidates with `React.memo`. Candidates (prioritized):
  1. `ExerciseCard` (rendered in `.map()` on workout screens)
  2. `SetRow` / `SetInputRow` (high-frequency re-render during active workout)
  3. `LogEntryCard` (list item in LogsScreen)
  4. `MealCard` (nutrition log lists)
  5. `IngredientRow` (recipe builder list)
  6. `ArticleCard` (learn screen list)
  7. `ExercisePickerItem` (modal list)
  8. `PlanDayCard` (plan overview list)
  9. `MuscleGroupBadge` (analytics repeated render)
  10. `MacroBar` (nutrition summary repeated)
  11. `StatCard` (dashboard grid)
  12. `WorkoutHistoryRow` (history list)
  13. `MicronutrientRow` (dashboard list)
  14. `BodyStatCard` (body stats list)
  15. `NotificationItem` (notification list)
  16. `LearnCategoryItem` (learn screen list)
  17. `PRBadge` (rendered in exercise history maps)
  18. `ProgressChart` (expensive SVG re-render)
  19. `CalendarDay` (calendar grid cell)
  20. `MeasurementRow` (body measurements list)
- **Files:** Each component's `.tsx` file — wrap default export with `React.memo()`.
- **Steps:**
  1. Profile with React DevTools to confirm re-render frequency.
  2. Wrap each candidate with `React.memo`.
  3. For components receiving object/array/callback props, add `useMemo`/`useCallback` at call site if needed.
  4. Re-profile to confirm render count reduction.
- **Testing:** All existing tests must pass. No new tests needed (behavioral parity).
- **Risk:** Low — `React.memo` is additive. Only risk is stale renders if props aren't properly compared (mitigated by profiling).
- **Effort:** Small (0.5 day).
- **Dependencies:** 8.1 (some candidates may be newly extracted sub-components).

---

### 8.3 Add Lazy Loading for Heavy Screens

- **Root Cause:** Zero usage of `React.lazy` — all screens loaded eagerly in the bundle, increasing startup time.
- **Fix:** Wrap heavy/infrequently-visited screens with `React.lazy` + `Suspense`.
- **Files:** Navigation config (e.g., `AppNavigator.tsx` or equivalent router file). Target screens:
  - `AnalyticsScreen`
  - `RecipeBuilderScreen`
  - `LearnScreen`
  - `ArticleDetailScreen`
  - `BarcodeScanner`
  - `MicronutrientDashboardScreen`
  - `BodyMeasurementsStep`
  - `PRHistoryScreen`
- **Steps:**
  1. Replace direct imports with `React.lazy(() => import('./ScreenName'))`.
  2. Wrap lazy components in `<Suspense fallback={<LoadingSpinner />}>`.
  3. Verify navigation transitions still work smoothly.
- **Testing:** E2E Playwright specs covering navigation to lazy-loaded screens. Manual test cold-start time improvement.
- **Risk:** Low — standard React pattern. Ensure fallback UI is acceptable.
- **Effort:** Small (0.5 day).
- **Dependencies:** None.

---

### 8.4 Extract Inline Styles to StyleSheet

- **Root Cause:** 93 inline `style={{...}}` objects across 90+ files cause new object allocation every render.
- **Fix:** Move to `StyleSheet.create()` at module scope.
- **Files:** `App.tsx`, `NotificationSettingsScreen.tsx`, `ArticleDetailScreen.tsx`, `LearnScreen.tsx`, `RegisterScreen.tsx`, `LoginScreen.tsx`, `EmailVerificationScreen.tsx`, +85 others.
- **Steps:**
  1. For each file, collect all inline `style={{...}}` usages.
  2. Create a `styles` const via `StyleSheet.create({...})` at bottom of file.
  3. Replace inline objects with `styles.xxx` references.
  4. For dynamic styles (depending on props/state), use array syntax: `[styles.base, { color: dynamicColor }]`.
- **Testing:** Existing snapshot tests will diff — update snapshots after visual verification. No behavioral change.
- **Risk:** Low — purely mechanical refactor. Risk of typos in style name mapping.
- **Effort:** Medium (1–2 days).
- **Dependencies:** None.

---

### 8.5 Migrate ScrollView+map to FlatList

- **Root Cause:** 230 `ScrollView` usages vs 38 `FlatList`. Lists rendered via `ScrollView` + `.map()` mount all items at once — poor performance for long lists.
- **Fix:** Replace `ScrollView` + `.map()` patterns with `FlatList` (or `SectionList` where grouped).
- **Files:** All files using `<ScrollView>{items.map(...)}</ScrollView>` pattern — prioritize lists with >20 potential items.
- **Steps:**
  1. Audit all 230 ScrollView usages; classify as list-rendering vs. layout-scrolling.
  2. For list-rendering cases, convert to `FlatList` with `renderItem`, `keyExtractor`, `getItemLayout` (where item height is fixed).
  3. Keep `ScrollView` for non-list scrollable content (forms, mixed layouts).
  4. Add `initialNumToRender` and `windowSize` props for very long lists.
- **Testing:** Existing tests + manual scroll performance verification. E2E specs for key list screens.
- **Risk:** Medium — `FlatList` has different scroll behavior (e.g., `onEndReached`). Some layouts may need adjustment.
- **Effort:** Large (2–3 days).
- **Dependencies:** 8.1 (decomposed components are easier to convert).

---

### 8.6 Move Hardcoded Colors to Theme

- **Root Cause:** Color hex values hardcoded in logic files instead of referencing the theme system.
- **Fix:** Extract all hardcoded colors to theme constants and reference them.
- **Files:**
  - `muscleVolumeLogic.ts`
  - `sourceBadgeLogic.ts`
  - `readinessScoreLogic.ts`
  - `progressRingLogic.ts`
  - `fatigueColorMapping.ts`
  - `progressBarLogic.ts`
  - `PRHistoryScreen.tsx`
  - `MicronutrientDashboardScreen.tsx`
  - `SummaryStep.tsx`
- **Steps:**
  1. Audit each file for hardcoded hex/rgb values.
  2. Add semantic color tokens to the theme file (e.g., `colors.fatigue.high`, `colors.progress.complete`).
  3. Replace hardcoded values with theme references.
  4. Verify dark mode (if applicable) maps correctly.
- **Testing:** Snapshot tests will diff — update after visual verification. No behavioral change.
- **Risk:** Low — mechanical replacement. Ensure no color is missed.
- **Effort:** Small (0.5 day).
- **Dependencies:** None.

---

## PHASE 9: CLEANUP

### 9.1 Remove/Gate 53 console.log Statements in Production

- **Root Cause:** 53 `console.log` calls ship to production, leaking internal state to device logs and adding noise.
- **Fix:** Remove debug-only logs. For operationally useful logs, gate behind `__DEV__` check or a logger utility.
- **Files:** All frontend `.ts`/`.tsx` files containing `console.log`.
- **Steps:**
  1. Search all `console.log` occurrences in `app/` and `src/`.
  2. Classify each: remove (debug noise) vs. gate (`__DEV__` or logger wrapper).
  3. For gated logs, use a `logger.debug()` wrapper that no-ops in production.
  4. Verify no `console.log` remains ungated via ESLint rule `no-console`.
- **Testing:** All 3,187 tests must pass. Add ESLint `no-console: warn` rule to prevent regression.
- **Risk:** Low — removing logs has no behavioral impact.
- **Effort:** Small (0.5 day).
- **Dependencies:** None.

---

### 9.2 Resolve Remaining 3 TODOs

- **Root Cause:** 3 TODO comments represent deferred work that should be completed.
- **Fix:** Implement each.
- **Files & Details:**
  1. `activeWorkoutSlice.ts:11` — **Offline queue**: Implement offline action queue that buffers mutations when network is unavailable and replays on reconnect.
  2. `training/service.py:56` — **PR detection**: Implement personal record detection logic comparing current set against historical bests.
  3. `exercise_aliases.py:32` — **Exercise aliases**: Implement alias mapping so variant exercise names resolve to canonical entries.
- **Steps:**
  1. Implement offline queue in `activeWorkoutSlice` using Redux middleware or a dedicated queue slice.
  2. Implement PR detection in `training/service.py` — compare against max weight/reps per exercise.
  3. Implement alias lookup in `exercise_aliases.py` — dictionary-based canonical name resolution.
  4. Remove TODO comments after implementation.
- **Testing:** Add unit tests for each: offline queue replay, PR detection edge cases, alias resolution.
- **Risk:** Medium — new logic. PR detection and offline queue need careful edge-case handling.
- **Effort:** Medium (1–2 days).
- **Dependencies:** Phases 4–5 (earlier TODO resolutions).

---

### 9.3 Verify Non-Null Assertions Fixed (Phase 5.5)

- **Root Cause:** Phase 5.5 addressed non-null assertion (`!`) misuse. This task verifies completeness.
- **Fix:** Audit that all non-null assertions from Phase 5.5 are resolved with proper null checks.
- **Files:** All `.ts`/`.tsx` files previously flagged in Phase 5.5.
- **Steps:**
  1. Run `grep -rn '!\.' --include='*.ts' --include='*.tsx'` to find remaining non-null assertions.
  2. Cross-reference against Phase 5.5 fix list.
  3. For any remaining, add proper null guards (optional chaining, early returns, type narrowing).
  4. Run `tsc --noEmit` to confirm type safety.
- **Testing:** TypeScript compilation with zero errors. Existing test suite passes.
- **Risk:** Low — verification task.
- **Effort:** Small (0.25 day).
- **Dependencies:** Phase 5.5 completed.

---

## PHASE 10: VERIFICATION & DOCUMENTATION

### 10.1 Document 12 Intentional Silent Catches with JSDoc

- **Root Cause:** 12 `catch` blocks intentionally swallow errors (e.g., optional analytics, graceful degradation) but lack documentation explaining why.
- **Fix:** Add JSDoc comments to each explaining the rationale.
- **Files:** 12 files containing intentional silent catches (identified in earlier audit).
- **Steps:**
  1. For each silent catch, add a JSDoc block above the try-catch:
     ```ts
     /** @silent-catch Reason: <explanation of why swallowing is intentional> */
     ```
  2. Verify no accidental silent catches remain undocumented.
- **Testing:** No behavioral change. Code review only.
- **Risk:** None.
- **Effort:** Small (0.25 day).
- **Dependencies:** None.

---

### 10.2 Full Regression Test Suite

- **Root Cause:** All prior phases introduced changes that need full regression validation.
- **Fix:** Run complete test suite and fix any failures.
- **Files:** All test files.
- **Steps:**
  1. Run frontend Jest suite: `npx jest --runInBand` — expect 3,187 passing.
  2. Run backend pytest suite: `pytest` — all passing.
  3. Run 19 E2E Playwright specs: `npx playwright test`.
  4. Fix any failures introduced by Phases 8–9.
  5. Update snapshots where visual changes are expected and verified.
- **Testing:** This IS the testing task. Target: 0 failures across all suites.
- **Risk:** Medium — earlier phases may have introduced subtle regressions.
- **Effort:** Medium (1 day including fixes).
- **Dependencies:** Phases 8–9 complete.

---

### 10.3 TypeScript Strict Mode Verification

- **Root Cause:** Need to confirm all TypeScript changes maintain strict compliance.
- **Fix:** Run `tsc --noEmit` and resolve any errors.
- **Files:** `tsconfig.json` + all `.ts`/`.tsx` files.
- **Steps:**
  1. Run `npx tsc --noEmit`.
  2. Target: 0 errors.
  3. Fix any type errors introduced in Phases 8–9.
- **Testing:** Compiler output = 0 errors.
- **Risk:** Low.
- **Effort:** Small (0.25 day).
- **Dependencies:** Phases 8–9 complete.

---

### 10.4 Python mypy Verification

- **Root Cause:** Need to confirm all Python changes maintain type safety.
- **Fix:** Run `mypy` and resolve any errors.
- **Files:** All `.py` files in backend.
- **Steps:**
  1. Run `mypy .` from backend root.
  2. Target: 0 errors (or match pre-existing baseline).
  3. Fix any type errors introduced in Phase 9.2.
- **Testing:** mypy output = 0 new errors.
- **Risk:** Low.
- **Effort:** Small (0.25 day).
- **Dependencies:** Phase 9.2 complete.

---

### 10.5 Update Tech Debt Tracking Document

- **Root Cause:** The tech debt tracking document needs to reflect all 371 items resolved across Phases 1–10.
- **Fix:** Mark all items as resolved with phase references.
- **Files:** Tech debt tracking document (e.g., `tasks/tech-debt-tracker.md` or equivalent).
- **Steps:**
  1. For each of the 371 tracked items, mark status as ✅ Resolved.
  2. Add phase reference (e.g., "Fixed in Phase 8.1").
  3. Add completion date.
  4. Write summary section with before/after metrics.
  5. Archive as baseline for future debt tracking.
- **Testing:** Document review — all 371 items accounted for.
- **Risk:** None.
- **Effort:** Small (0.5 day).
- **Dependencies:** All phases complete.

---

## Summary

| Phase | Tasks | Total Effort | Key Risk |
|-------|-------|-------------|----------|
| 8 — Frontend Performance | 6 | ~8–11 days | Component decomposition regressions |
| 9 — Cleanup | 3 | ~2–3 days | New logic in TODO implementations |
| 10 — Verification & Docs | 5 | ~2–3 days | Regression failures from earlier phases |
| **Total** | **14** | **~12–17 days** | |
