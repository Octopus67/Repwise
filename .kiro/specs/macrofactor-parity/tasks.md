# Implementation Plan: MacroFactor Parity — Revised

## Pre-flight Checklist

1. Confirm both servers run: backend on :8000 (`Application startup complete`), frontend on :8081 (bundle completes).
2. Confirm existing test suites green: `cd app && npx jest --config jest.config.js` (frontend), `python -m pytest tests/ -x -q` (backend).
3. Install missing dependency: `cd app && yarn add react-native-gesture-handler@^2.14.0`. Verify no build errors with `npx expo start --web --clear`.
4. No database migrations needed — all features use existing `nutrition_entries` table columns (`meal_name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `micro_nutrients`, `entry_date`, `created_at`).
5. Feature flag: Insert `macrofactor_parity` flag via admin API or direct DB insert after backend starts. All new UI components check this flag before rendering. Fallback: existing UI renders unchanged.
6. Rollback for any task: `git revert` the commit(s). No schema changes to unwind.

## Tasks

- [x] 1. Foundation: Theme token + Zustand store extensions
  - [x] 1.1 Add adherence-neutral `overTarget` color to `app/theme/tokens.ts`
    - Add `overTarget: '#6B8FBF'` and `overTargetSubtle: 'rgba(107,143,191,0.15)'` to `colors.semantic` object
    - Risk: None — additive change, no existing code references these tokens yet.
    - Rollback: Remove the two lines.
    - _Requirements: 10.3_
  - [x] 1.2 Extend Zustand store with `selectedDate` and `adaptiveTargets`
    - In `app/store/index.ts`, add to `AppState`: `selectedDate: string` (default `new Date().toISOString().split('T')[0]`), `adaptiveTargets: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null` (default null)
    - Add actions: `setSelectedDate(date: string)`, `setAdaptiveTargets(targets)`
    - Risk: Other components read from store — ensure no naming conflicts. Mitigation: grep for `selectedDate` and `adaptiveTargets` in codebase first.
    - Rollback: Remove the new fields and actions.
    - _Requirements: 4.2_

- [x] 2. Foundation: Pure utility functions (all new files, no cross-dependencies)
  - [x] 2.1 Create `app/utils/mealSlotLogic.ts` — meal slot assignment and grouping
    - Export `MealSlotName` type: `'Breakfast' | 'Lunch' | 'Snack' | 'Dinner'`
    - Export `assignMealSlot(mealName: string): MealSlotName` — lowercase includes check: "breakfast" → Breakfast, "lunch" → Lunch, "dinner" → Dinner, else Snack
    - Export `groupEntriesBySlot(entries)` — groups entries into 4 slots, computes per-slot calorie/macro subtotals
    - Export `computeSlotTotals(entries)` — sums all entries' calories/protein/carbs/fat
    - Risk: None — pure functions, no imports from React Native.
    - Rollback: Delete file.
    - _Requirements: 1.1, 1.2, 1.5, 1.6_
  - [x] 2.2 Write property tests for meal slot logic (Properties 1, 2)
    - Create `app/__tests__/utils/mealSlotLogic.test.ts`
    - Property 1: `assignMealSlot` always returns one of the 4 slot names, deterministically
    - Property 2: Grouping preserves total calories/macros (sum of slot subtotals === sum of all entries)
    - **Property 1: Meal slot assignment is total and deterministic**
    - **Property 2: Slot grouping preserves calorie and macro totals**
    - **Validates: Requirements 1.1, 1.2, 1.5, 1.6**
  - [x] 2.3 Create `app/utils/budgetComputation.ts` — remaining budget and progress ratio
    - Export `computeRemaining(targets, consumed)` — returns `{ calories, protein_g, carbs_g, fat_g }` where each = target - consumed
    - Export `computeProgressRatio(consumed, target)` — returns `Math.min(Math.max(consumed / target, 0), 1)` (clamped [0,1])
    - Export `getOverTargetColor(value, target, standardColor)` — returns `colors.semantic.overTarget` if value > target, else standardColor
    - Risk: None — pure functions.
    - Rollback: Delete file.
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 10.1, 10.2_
  - [x] 2.4 Write property tests for budget computation (Properties 3, 4, 5)
    - Create `app/__tests__/utils/budgetComputation.test.ts`
    - Property 3: remaining = target - consumed for all 4 macros
    - Property 4: overTarget color returned iff value > target
    - Property 5: progress ratio always in [0, 1]
    - **Property 3: Budget remaining equals target minus consumed**
    - **Property 4: Over-target color selection**
    - **Property 5: Progress ratio is clamped to [0, 1]**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5, 10.1, 10.2**
  - [x] 2.5 Create `app/utils/dateScrollerLogic.ts` — week generation and logged dates
    - Export `getWeekDates(referenceDate: string)` — returns array of 7 ISO date strings (Mon-Sun) for the week containing referenceDate
    - Export `formatDayCell(date: string)` — returns `{ dayName: 'Mon', dayNumber: 15 }`
    - Export `getLoggedDatesSet(entries)` — returns `Set<string>` of unique entry_date values
    - Risk: None — pure functions.
    - Rollback: Delete file.
    - _Requirements: 4.1, 4.4, 4.5_
  - [x] 2.6 Write property tests for date scroller logic (Properties 6, 7)
    - Create `app/__tests__/utils/dateScrollerLogic.test.ts`
    - Property 6: `getWeekDates` always returns 7 consecutive dates starting from Monday
    - Property 7: `getLoggedDatesSet` matches unique entry_date values
    - **Property 6: Week generation produces 7 consecutive days starting from Monday**
    - **Property 7: Logged dates indicator matches entry dates**
    - **Validates: Requirements 4.1, 4.4, 4.5**
  - [x] 2.7 Create `app/utils/timestampFormat.ts` — entry time formatting and sorting
    - Export `formatEntryTime(createdAt: string)` — returns localized short time (e.g., "8:30 AM") from ISO datetime string. Returns empty string if null/undefined.
    - Export `sortEntriesChronologically(entries)` — sorts by created_at ascending
    - Risk: None — pure functions.
    - Rollback: Delete file.
    - _Requirements: 5.1, 5.2_
  - [x] 2.8 Create `app/utils/quickAddValidation.ts` — quick add input validation
    - Export `validateQuickAdd(calories: number)` — returns `{ valid: true }` if calories > 0 and <= 10000, `{ valid: false, error: 'message' }` if <= 0, `{ valid: true, needsConfirmation: true }` if > 10000
    - Risk: None — pure function.
    - Rollback: Delete file.
    - _Requirements: 2.4, 2.5_
  - [x] 2.9 Create `app/utils/weeklySummary.ts` — 7-day nutrition aggregation
    - Export `computeWeeklySummary(entries, targetCalories)` — groups entries by date, computes avg calories/macros from days WITH data only, finds best/worst adherence days, sums water_ml, counts daysLogged
    - Risk: None — pure function.
    - Rollback: Delete file.
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - [x] 2.10 Create `app/utils/tdeeEstimation.ts` — TDEE computation from weight + calorie data
    - Export `computeTDEEEstimate(weightHistory, caloriesByDate, windowDays = 28)` — requires >= 14 days of both weight and calorie data. Uses EMA for weight trend (port constants from `src/modules/adaptive/engine.py`: EMA_ALPHA = 0.25, EMA_WINDOW = 7). Formula: TDEE = avgDailyCalories + (weightChangeKg * 7700 / windowDays). Returns null if insufficient data.
    - Risk: EMA constants must match backend. Mitigation: hardcode same values (0.25 alpha, 7-day window).
    - Rollback: Delete file.
    - _Requirements: 9.1, 9.2, 9.4_
  - [x] 2.11 Write property tests for remaining utilities (Properties 8-15)
    - Create test files for: timestampFormat (Property 10, 11), quickAddValidation (Property 9), weeklySummary (Properties 13, 14), tdeeEstimation (Property 15)
    - Run: `cd app && npx jest --config jest.config.js --testPathPattern="(mealSlotLogic|budgetComputation|dateScrollerLogic|timestampFormat|quickAddValidation|weeklySummary|tdeeEstimation)"` — all must pass
    - **Validates: Requirements 2.4, 5.1, 5.2, 8.1, 8.2, 8.3, 8.5, 9.1, 9.2, 9.4**

- [x] 3. **CHECKPOINT — All utility tests pass**
  - Run full frontend test suite: `cd app && npx jest --config jest.config.js` — all tests must pass
  - Verify no regressions in existing tests
  - If any test fails: STOP. Fix before proceeding.

- [x] 4. Backend: Copy entries endpoint
  - [x] 4.1 Add `CopyEntriesRequest` schema to `src/modules/nutrition/schemas.py`
    - Add class with `source_date: date`, `target_date: date`, and `@model_validator` that rejects same source/target date
    - Risk: Pydantic v2 model_validator syntax. Mitigation: follow existing validator patterns in codebase.
    - Rollback: Remove the class.
    - _Requirements: 6.3_
  - [x] 4.2 Add `copy_entries_from_date` method to `src/modules/nutrition/service.py`
    - Fetches all non-deleted entries for source_date, creates copies with new UUIDs and target_date, flushes in single transaction
    - Risk: Large copy (30+ entries) could be slow. Mitigation: cap at 100 entries (existing pagination limit).
    - Rollback: Remove the method.
    - _Requirements: 6.1, 6.3_
  - [x] 4.3 Add `POST /nutrition/entries/copy` route to `src/modules/nutrition/router.py`
    - JWT auth via `get_current_user`, returns list of created entries
    - Risk: None — follows existing route patterns.
    - Rollback: Remove the route.
    - _Requirements: 6.1, 6.2_
  - [x] 4.4 Write backend property test for copy entries (Property 12)
    - Create `tests/test_copy_entries_properties.py`
    - Property 12: Copied entries have new IDs, target_date, and identical macros/micro_nutrients
    - Also test: copy from empty date returns [], copy with same source/target returns 422
    - Run: `python -m pytest tests/test_copy_entries_properties.py -x -q` — must pass
    - **Property 12: Copied entries preserve nutritional data with new identity**
    - **Validates: Requirements 6.1, 6.3**

- [x] 5. **CHECKPOINT — Backend tests pass**
  - Run full backend test suite: `python -m pytest tests/ -x -q` — all tests must pass
  - Verify copy endpoint works: manual curl test with valid auth token

- [x] 6. Components: Build new UI components (all independent, can parallelize)
  - [x] 6.1 Build `app/components/dashboard/DateScroller.tsx`
    - Horizontal FlatList with week pagination, day cells showing abbreviated name + number, dot indicator for logged dates, highlighted selected date
    - Props: `selectedDate`, `onDateSelect`, `loggedDates: Set<string>`
    - Swipe left/right navigates weeks. Tap calls `onDateSelect`.
    - Risk: FlatList horizontal pagination can be tricky on web. Mitigation: use ScrollView with pagingEnabled as fallback.
    - Rollback: Delete file.
    - _Requirements: 4.1, 4.3, 4.4, 4.5_
  - [x] 6.2 Build `app/components/nutrition/BudgetBar.tsx`
    - Shows remaining calories (large number) + macro breakdown (protein/carbs/fat remaining)
    - Linear progress bar (consumed/target ratio, clamped [0,1])
    - Over-target: negative remaining in `overTarget` color, progress bar at 100%
    - No targets: shows "Set targets in profile" prompt
    - Props: `consumed`, `targets`
    - Risk: None — pure presentational component.
    - Rollback: Delete file.
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 10.2_
  - [x] 6.3 Build `app/components/dashboard/MealSlotDiary.tsx` and `MealSlotGroup.tsx`
    - MealSlotDiary: groups entries into 4 slots using `groupEntriesBySlot`, renders MealSlotGroup for each
    - MealSlotGroup: expandable section with slot name + calorie subtotal header, list of entry rows with timestamps, "+" button for empty slots
    - Props: `entries`, `onAddToSlot(slotName)`
    - Risk: Expandable sections need state management. Mitigation: local `expandedSlots` state set.
    - Rollback: Delete files.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  - [x] 6.4 Build `app/components/modals/QuickAddModal.tsx`
    - Minimal form: calories (required), protein/carbs/fat (optional, default 0)
    - Validation via `validateQuickAdd`
    - On submit: POST to `nutrition/entries` with `meal_name: "Quick add"`, `entry_date: selectedDate`
    - Props: `visible`, `onClose`, `onSuccess`, `targetDate`
    - Risk: None — follows existing modal patterns.
    - Rollback: Delete file.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 6.5 Build `app/components/common/SwipeableRow.tsx`
    - Uses `react-native-gesture-handler` Swipeable component
    - Swipe left reveals red delete button with trash icon
    - Swipe < 30% threshold snaps back
    - Tap delete button calls `onDelete` prop
    - Slide-out animation on delete (200ms)
    - Props: `children`, `onDelete`
    - Risk: `react-native-gesture-handler` must be installed (Task 0 pre-flight). Web compatibility: Swipeable may not work on web — fallback to existing Alert-based delete.
    - Rollback: Delete file.
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 6.6 Build `app/components/nutrition/CopyMealsBar.tsx`
    - "Copy Yesterday" button + "Copy from Date" button (with date picker)
    - Calls `POST /nutrition/entries/copy` with source/target dates
    - Loading state, success callback, error alert
    - Props: `targetDate`, `onCopyComplete`
    - Risk: Date picker on web may need a fallback (TextInput with date format). Mitigation: use simple TextInput with YYYY-MM-DD format for v1.
    - Rollback: Delete file.
    - _Requirements: 6.1, 6.2, 6.4, 6.5_
  - [x] 6.7 Build `app/components/analytics/WeeklySummaryCard.tsx`
    - Displays: avg daily calories/macros, best/worst adherence days, total water, days logged count
    - Uses `computeWeeklySummary` from utility
    - Shows "Log more days" message if < 2 days logged
    - Props: `entries`, `targetCalories`
    - Risk: None — pure presentational.
    - Rollback: Delete file.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 6.8 Build `app/components/analytics/ExpenditureTrendCard.tsx`
    - Displays: TDEE estimate as prominent number + trend line via TrendLineChart
    - Uses `computeTDEEEstimate` from utility
    - Shows "X more days needed" if insufficient data
    - Props: `weightHistory`, `caloriesByDate`
    - Risk: TrendLineChart may need adjustment for TDEE data format. Mitigation: reuse existing TrendPoint interface.
    - Rollback: Delete file.
    - _Requirements: 9.1, 9.3, 9.5_

- [x] 7. **CHECKPOINT — Components render without errors**
  - Run `getDiagnostics` on all new component files
  - Run frontend test suite: `cd app && npx jest --config jest.config.js` — all tests must pass
  - Visually verify: import each component in a temporary test screen to confirm it renders

- [x] 8. Integration: Wire components into existing screens
  - [x] 8.1 Integrate DateScroller + MealSlotDiary + BudgetBar + QuickAdd into DashboardScreen
    - Add DateScroller between header and macro rings
    - Replace `TodaySummaryRow` meals count with MealSlotDiary (keep workouts count and streak)
    - Add BudgetBar above meal slots
    - Add QuickAdd button (⚡) to quick actions row
    - Parameterize `loadDashboardData` to accept `selectedDate` from store instead of hardcoded `today`
    - Add debounced date switching (300ms) with AbortController for API calls
    - Store nutrition entries in state for MealSlotDiary consumption
    - Risk: This is the largest integration task. Dashboard is the most-visited screen — regressions here break retention. Mitigation: keep existing UI as fallback behind feature flag check.
    - Rollback: Revert DashboardScreen.tsx to previous version.
    - _Requirements: 1.1-1.6, 2.1, 3.1-3.6, 4.1-4.6_
  - [x] 8.2 Integrate SwipeableRow + CopyMealsBar + timestamps into LogsScreen
    - Wrap nutrition entry cards in SwipeableRow (replace Alert-based delete)
    - Add CopyMealsBar to nutrition tab header area
    - Add timestamp display (`formatEntryTime(entry.created_at)`) to each entry card
    - Add BudgetBar at top of nutrition tab
    - Risk: SwipeableRow may conflict with ScrollView gestures. Mitigation: test on both web and mobile; fall back to existing delete on web.
    - Rollback: Revert LogsScreen.tsx.
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 7.1-7.4_
  - [x] 8.3 Integrate WeeklySummaryCard + ExpenditureTrendCard into AnalyticsScreen
    - Add WeeklySummaryCard between calorie and protein trend sections
    - Add ExpenditureTrendCard after existing charts
    - Pass existing nutrition data (calorieTrend) and bodyweight data (weightTrend) to new components
    - Risk: None — additive, doesn't modify existing charts.
    - Rollback: Revert AnalyticsScreen.tsx.
    - _Requirements: 8.1-8.5, 9.1-9.5_
  - [x] 8.4 Update ProgressRing to use adherence-neutral overflow color
    - In `app/utils/progressRingLogic.ts`, change `const SEMANTIC_WARNING = '#F59E0B'` to `const OVERFLOW_COLOR = '#6B8FBF'` (the new overTarget token)
    - This changes the ring color when value > target from orange to muted blue
    - Risk: Visual change affects all progress rings. Mitigation: the new color is intentionally neutral — tested for WCAG AA contrast.
    - Rollback: Revert the constant back to `#F59E0B`.
    - _Requirements: 10.1, 10.4_

- [x] 9. **CHECKPOINT — Full integration works**
  - Run full frontend test suite: `cd app && npx jest --config jest.config.js` — all tests must pass
  - Run full backend test suite: `python -m pytest tests/ -x -q` — all tests must pass
  - Manual verification:
    1. Dashboard: date scroller shows current week, tapping a day reloads data
    2. Dashboard: meal slots show today's entries grouped by Breakfast/Lunch/Snack/Dinner
    3. Dashboard: budget bar shows remaining calories and macros
    4. Dashboard: Quick Add button opens minimal form, logs entry
    5. Logs: swipe left on entry reveals delete button
    6. Logs: "Copy Yesterday" copies entries to today
    7. Logs: timestamps show on each entry
    8. Analytics: weekly summary card shows 7-day averages
    9. Analytics: TDEE card shows estimate (or "X more days needed")
    10. Progress rings use muted blue for overflow instead of orange

- [x] 10. **FINAL — Full regression**
  - Run all test suites (frontend + backend)
  - Verify no regressions in existing nutrition, training, bodyweight, and profile flows
  - Verify feature flag toggle: disable `macrofactor_parity` → all new UI hidden, existing UI renders

## Dependency Graph

```
Task 1 (tokens + store) ─── no dependencies
Task 2 (utilities) ──────── depends on Task 1.1 (overTarget color used in budgetComputation)
Task 3 (checkpoint) ─────── depends on 1, 2
Task 4 (backend copy) ───── no frontend dependencies, can run parallel with Task 2
Task 5 (checkpoint) ─────── depends on 4
Task 6 (components) ─────── depends on Tasks 1, 2 (utilities), and Task 4 (CopyMealsBar needs copy endpoint)
Task 7 (checkpoint) ─────── depends on 6
Task 8 (integration) ────── depends on ALL previous tasks
Task 9 (checkpoint) ─────── depends on 8
Task 10 (final) ─────────── depends on 9
```

## Parallelization Opportunities

- Tasks 1.1 and 1.2 are independent — execute in parallel
- All Task 2 subtasks (2.1-2.10) are independent new files — execute in parallel
- Task 4 (backend) is independent from Task 2 (frontend utilities) — execute in parallel
- All Task 6 subtasks (6.1-6.8) are independent new files — execute in parallel
- Task 8 subtasks touch different screens — 8.1 (Dashboard), 8.2 (Logs), 8.3 (Analytics), 8.4 (ProgressRing) can run in parallel

## What Was Cut From Original Plan

- ~~Feature flag granularity per feature~~ — Single flag for all 10 features. 1024 possible states is untestable.
- ~~Quick add backend property test (Property 8)~~ — Quick add uses the existing `POST /nutrition/entries` endpoint with `meal_name="Quick add"`. No new backend logic to test.
- ~~Separate timestamp property tests~~ — Timestamp formatting is trivial (`new Date(str).toLocaleTimeString()`). Unit tests cover it.
- ~~react-native-gesture-handler installation as a task~~ — Moved to pre-flight checklist. Must be done before any code.

## What Was Added vs Original Plan

- Pre-flight checklist with `react-native-gesture-handler` installation (blocker for SwipeableRow)
- Explicit dependency graph with parallelization map
- Risk assessment per task with mitigations
- Rollback instructions per task
- Manual verification steps at each checkpoint
- Web fallback notes for gesture-based features

## Monitoring Post-Launch

- Track: 7-day nutrition logging retention (% of users logging 5+ of 7 days) — primary success metric
- Track: average daily food entries per active user — should increase with Quick Add and Copy
- Track: date scroller usage (% of dashboard loads that switch dates)
- Track: Quick Add usage rate (% of nutrition entries with meal_name="Quick add")
- Track: Copy Yesterday usage rate (POST /nutrition/entries/copy calls per day)
- Track: swipe-to-delete usage vs old Alert-based delete
- Alert: if nutrition entry creation rate drops >5% after launch (regression signal)
- Alert: if dashboard render time exceeds 800ms (new components adding latency)
- Alert: if `POST /nutrition/entries/copy` error rate exceeds 2%
- Guardrail: training logging rate stays flat (±2%) — new features shouldn't cannibalize training engagement
