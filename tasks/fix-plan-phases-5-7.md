# Tech Debt Fix Plan — Phases 5–7

## Phase 5: `any` Elimination

### Task 5.1: Remove `as any` Assertions (23 instances)

| Field | Detail |
|---|---|
| Root Cause | Developers bypassed TypeScript's type system during rapid prototyping with explicit `as any` casts |
| Fix | Replace each `as any` with the correct concrete type or a narrowing guard |
| Files | `crossPlatformAlert.ts:31`, `workoutSummaryFormatter.ts:14`, `calculateWeeklyStreak.ts:21`, `ArticleDetailScreen.tsx:116`, `ActiveWorkoutScreen.tsx:225`, `ProfileScreen.tsx:125`, `ProfileScreen.tsx:142`, `ExercisePickerScreen.tsx:45`, `ExercisePickerScreen.tsx:46`, `ExercisePickerScreen.tsx:129`, `ExercisePickerScreen.tsx:132`, `ExercisePickerScreen.tsx:149`, `ExercisePickerScreen.tsx:152`, `MicronutrientDashboardScreen.tsx:36`, `TrendLineChart.tsx:303`, `ProgressBar.tsx:43`, `ErrorBanner.tsx:55`, `FoodSearchPanel.tsx:187`, `MealPlanTab.tsx:49`, `ExpenditureTrendCard.tsx:96`, `store/index.ts:245`, `onboardingSlice.ts:173` |
| Steps | 1. For each file:line, inspect the value being cast and determine its actual type from context. 2. Define or import the correct type. 3. Replace `as any` with `as CorrectType` or remove the cast entirely if inference suffices. 4. Run `tsc --noEmit` to confirm no new errors. |
| Testing | Full `tsc --noEmit` pass; run unit tests for each modified module; manual smoke test for UI components (ExercisePickerScreen, ProfileScreen, ActiveWorkoutScreen) |
| Risk | Medium — incorrect type narrowing could introduce runtime errors in edge cases |
| Effort | 3–4 hours |
| Dependencies | None |

### Task 5.2: Type `useState<any>` Hooks (4 instances)

| Field | Detail |
|---|---|
| Root Cause | State variables initialized without generic type parameters, defaulting to `any` |
| Fix | Add explicit generic type to each `useState` call based on the data it holds |
| Files | `LogsScreen.tsx:92`, `LogsScreen.tsx:97`, `AnalyticsScreen.tsx:108`, `AnalyticsScreen.tsx:109` |
| Steps | 1. Trace each state variable's usage to determine its shape. 2. Define an interface if one doesn't exist. 3. Replace `useState<any>(...)` with `useState<ConcreteType>(...)`. |
| Testing | `tsc --noEmit`; unit tests for LogsScreen and AnalyticsScreen |
| Risk | Low — state types are locally scoped |
| Effort | 30 min |
| Dependencies | None |

### Task 5.3: Replace `Record<string, any>` (3 instances)

| Field | Detail |
|---|---|
| Root Cause | Generic object types used as catch-all for dynamic data shapes |
| Fix | Define typed interfaces for each record's actual shape |
| Files | `AddNutritionModal.tsx:34`, `BarcodeScanner.tsx:52`, `FoodSearchPanel.tsx:24` |
| Steps | 1. Inspect how each record is populated and consumed. 2. Create a specific interface (e.g., `NutritionEntry`, `BarcodeResult`, `FoodSearchResult`). 3. Replace `Record<string, any>` with the new interface. |
| Testing | `tsc --noEmit`; unit tests for each component |
| Risk | Low — contained to individual components |
| Effort | 1 hour |
| Dependencies | None |

### Task 5.4: Eliminate Remaining `:any` Annotations (~55 instances)

| Field | Detail |
|---|---|
| Root Cause | Parameters, return types, and variables annotated with `:any` across hooks and components |
| Fix | Replace each `:any` with the correct type derived from usage context |
| Files | `useDashboardData.ts` (10), `useHealthData.ts` (5), `useDashboardNavigation.ts` (3), `AnalyticsScreen.tsx` (10), `ActiveWorkoutScreen.tsx` (6), `DashboardScreen.tsx` (4), `AddNutritionModal.tsx` (5), +15 scattered across other files |
| Steps | 1. Run `grep -rn ': any' src/` to get full inventory. 2. Group by module. 3. For each, determine the correct type from call sites and data flow. 4. Replace and verify with `tsc --noEmit`. |
| Testing | `tsc --noEmit`; run full test suite; smoke test dashboard and analytics flows |
| Risk | Medium — hooks like `useDashboardData` and `useHealthData` are widely consumed; incorrect typing could cascade |
| Effort | 4–5 hours |
| Dependencies | Task 5.2 (useState types feed into hook return types) |

### Task 5.5: Remove `Function` Type and Non-null Assertions (5 instances)

| Field | Detail |
|---|---|
| Root Cause | `Function` type is overly permissive; non-null assertions (`!`) suppress null checks unsafely |
| Fix | Replace `Function` with specific callable signature; replace `!` with proper null guards or optional chaining |
| Files | `App.tsx:282` (Function type), `periodizationUtils.ts:108` (non-null), `AchievementGrid.tsx:39` (non-null), `ExerciseDetailSheet.tsx:202` (non-null), `ExerciseDetailSheet.tsx:220` (non-null) |
| Steps | 1. For `App.tsx:282`, determine the callback signature and replace `Function` with `() => void` or appropriate typed signature. 2. For each `!` assertion, add a runtime null check or use optional chaining (`?.`). |
| Testing | `tsc --noEmit`; unit tests for periodizationUtils; manual test AchievementGrid and ExerciseDetailSheet |
| Risk | Low — non-null removal adds safety; Function replacement is straightforward |
| Effort | 30 min |
| Dependencies | None |

### Task 5.6: Type `any[]` Arrays (16 instances)

| Field | Detail |
|---|---|
| Root Cause | Arrays declared without element types, losing all type safety on access |
| Fix | Replace `any[]` with typed arrays based on actual element shapes |
| Files | `LogsScreen.tsx:92`, `LogsScreen.tsx:97`, `AnalyticsScreen.tsx:104`, `AnalyticsScreen.tsx:105`, `AnalyticsScreen.tsx:108`, `StartWorkoutCard.tsx:16`, `DrillDownModal.tsx:52`, `useDashboardData.ts:56`, `useDashboardData.ts:65`, `useDashboardData.ts:67`, `useDashboardData.ts:69`, `useDashboardNavigation.ts:6`, `useDashboardNavigation.ts:7`, `useHealthData.ts:151`, `useHealthData.ts:156`, `useHealthData.ts:161` |
| Steps | 1. For each array, trace what gets pushed/mapped into it. 2. Define element type (or reuse existing interfaces). 3. Replace `any[]` with `ConcreteType[]`. |
| Testing | `tsc --noEmit`; unit tests for hooks; smoke test LogsScreen and AnalyticsScreen |
| Risk | Medium — hooks are shared; element type mismatches will surface as compile errors (which is the goal) |
| Effort | 2–3 hours |
| Dependencies | Task 5.4 (hook `:any` fixes may define types reusable here) |

---

## Phase 6: Silent Error Handling

### Task 6.1: Add Backend Logging to Silent Catches (6 Python files)

| Field | Detail |
|---|---|
| Root Cause | Backend `except` blocks swallow exceptions without logging, making debugging impossible |
| Fix | Add `logger.exception()` or `logger.error()` to every silent catch block |
| Files | `user/service.py:520`, `food_database/router.py:73`, `usda_client.py:147`, `off_client.py:117`, `sharing/router.py:51`, `main.py:95` |
| Steps | 1. For each file:line, locate the `except` block. 2. Add `logger.exception("Context message", exc_info=True)` or `logger.error(f"...: {e}")`. 3. Ensure a logger is initialized at module level (`logger = logging.getLogger(__name__)`). |
| Testing | Trigger each error path in dev; verify log output appears; run existing backend tests |
| Risk | Low — additive change only |
| Effort | 1 hour |
| Dependencies | None |

### Task 6.2: Add Frontend Error States to Hooks (4 hooks)

| Field | Detail |
|---|---|
| Root Cause | Hooks silently catch fetch/processing errors and return default values, leaving the UI unaware of failures |
| Fix | Add `error` state to each hook's return value; set it in catch blocks |
| Files | `useHealthData.ts:93`, `useHealthData.ts:100`, `useHealthData.ts:110`, `notifications.ts:121`, `onboardingSlice.ts:117`, `onboardingSlice.ts:148`, `useTrial.ts:28` |
| Steps | 1. Add `const [error, setError] = useState<string \| null>(null)` to each hook. 2. In each catch block, call `setError(e.message)`. 3. Include `error` in the hook's return object. 4. Clear error on retry/refetch. |
| Testing | Unit test each hook with mocked failures; verify error state is populated; verify consuming components can read error |
| Risk | Medium — changes hook return type, requiring updates to all consumers |
| Effort | 2 hours |
| Dependencies | None |

### Task 6.3: Add User-Facing Feedback to Components (13 components)

| Field | Detail |
|---|---|
| Root Cause | Components catch errors silently — users see stale data or empty states with no explanation |
| Fix | Display error banners, toast notifications, or inline error messages when operations fail |
| Files | `FoodSearchPanel.tsx:81`, `FoodSearchPanel.tsx:95`, `FoodSearchPanel.tsx:106`, `AddNutritionModal.tsx:121`, `AddNutritionModal.tsx:127`, `AlignedComparison.tsx:70`, `AlignedComparison.tsx:77`, `RecoveryCheckinModal.tsx:86`, `RecipeTab.tsx:43`, `MealPlanTab.tsx:42`, `ExercisePickerScreen.tsx:95`, `MeasurementsScreen.tsx:43`, `AddTrainingModal.tsx:118`, `AddTrainingModal.tsx:143`, `UpgradeModal.tsx:102`, `PreviousPerformance.tsx:44`, `PreferencesSection.tsx:102`, `SummaryStep.tsx:136` |
| Steps | 1. For each catch block, add a `setError("User-friendly message")` call. 2. Render an `<ErrorBanner>` or toast when error state is set. 3. Add a retry action where appropriate. |
| Testing | Manual test each component's error path (disconnect network, mock API failures); verify user sees feedback |
| Risk | Medium — UI changes visible to users; messages must be clear and non-alarming |
| Effort | 3–4 hours |
| Dependencies | Task 6.2 (hooks expose error state that components consume) |

### Task 6.4: Document Intentional Silent Catches (12 instances)

| Field | Detail |
|---|---|
| Root Cause | Some catches are intentionally silent (haptics, analytics, timers, photos) but lack documentation explaining why |
| Fix | Add `// Intentional: <reason>` comments to each silent catch |
| Files | `useHaptics.ts:23`, `useHaptics.ts:41`, `useHaptics.ts:64`, `RestTimer.tsx:75`, `RestTimerV2.tsx:220`, `RestTimerOverlay.tsx:168`, `ProgressPhotoGrid.tsx:113`, `TrialExpirationModal.tsx:62`, `ProgressPhotosScreen.tsx:130`, `WeeklyReportScreen.tsx:127`, `analytics.ts:4`, `analytics.ts:21`, `analytics.ts:30` |
| Steps | 1. For each file:line, verify the catch is truly intentional (non-critical side effect). 2. Add a comment: `// Intentional: haptics failure is non-critical` (or similar). 3. Optionally add `console.debug()` for dev-mode visibility. |
| Testing | Code review only — no behavioral change |
| Risk | None |
| Effort | 30 min |
| Dependencies | None |

---

## Phase 7: Backend Quality

### Task 7.1: Extract Inline Data to JSON Files (28,024 LOC)

| Field | Detail |
|---|---|
| Root Cause | Massive Python files contain hardcoded exercise/seed data as inline dicts, bloating modules and making data updates error-prone |
| Fix | Extract data to JSON files; load at startup with `json.load()` |
| Files | `exercises.py` (20,968 LOC), `seed_data.py` (4,312 LOC), `global_seed_data.py` (2,743 LOC) |
| Steps | 1. Convert each Python dict/list to a JSON file (e.g., `data/exercises.json`). 2. Replace inline data with `json.load(open("data/exercises.json"))`. 3. Add JSON schema validation for each file. 4. Verify data integrity by comparing runtime values before/after. |
| Testing | Diff old vs new data at runtime (hash comparison); run all seed/migration scripts; full backend test suite |
| Risk | High — data corruption during extraction would break seeding and exercise lookup |
| Effort | 4–6 hours |
| Dependencies | None |

### Task 7.2: Add Python Return Type Annotations (492 functions)

| Field | Detail |
|---|---|
| Root Cause | Functions lack return type hints, reducing IDE support and static analysis effectiveness |
| Fix | Add `-> ReturnType` annotations to all unannotated functions |
| Files | All Python files in `src/modules/` — run `grep -rn 'def ' --include='*.py' \| grep -v '\->'` to get full list |
| Steps | 1. Run mypy or pyright to identify unannotated functions. 2. For each, determine return type from `return` statements. 3. Add annotation. 4. Run `mypy --strict` incrementally per module. |
| Testing | `mypy` pass on each modified file; existing test suite |
| Risk | Low — additive annotations only; no runtime behavior change |
| Effort | 6–8 hours |
| Dependencies | None |

### Task 7.3: Fix f-string SQL Injection Risk

| Field | Detail |
|---|---|
| Root Cause | Raw f-strings used in SQL query construction, creating injection vectors |
| Fix | Replace f-string interpolation with parameterized queries |
| Files | `food_database/service.py:283` |
| Steps | 1. Identify the f-string SQL at line 283. 2. Replace with parameterized query using `?` or `%s` placeholders. 3. Pass values as a tuple to the execute method. |
| Testing | Unit test with malicious input strings; verify query still returns correct results; run food_database test suite |
| Risk | Low — parameterized queries are strictly safer; logic is equivalent |
| Effort | 30 min |
| Dependencies | None |

### Task 7.4: Fix Exception Detail Leaking to Clients

| Field | Detail |
|---|---|
| Root Cause | Raw exception messages returned in HTTP responses, exposing internal details (stack traces, file paths) |
| Fix | Return generic error messages to clients; log full details server-side |
| Files | `payments/router.py:61`, `meal_plans/router.py:49`, `meal_plans/router.py:174` |
| Steps | 1. In each `except` block, replace `detail=str(e)` with a generic message like `detail="An error occurred. Please try again."`. 2. Add `logger.exception(...)` before the response. |
| Testing | Trigger each error path; verify response contains generic message; verify logs contain full exception |
| Risk | Low — improves security; no functional change |
| Effort | 30 min |
| Dependencies | Task 6.1 (backend logging patterns) |

### Task 7.5: Add Foreign Key Index

| Field | Detail |
|---|---|
| Root Cause | Foreign key column lacks an index, causing slow joins and lookups |
| Fix | Add a database index on the FK column |
| Files | `sharing/models.py:19` |
| Steps | 1. Identify the FK column at line 19. 2. Add `index=True` to the column definition (or create an Alembic migration with `op.create_index`). 3. Run migration. |
| Testing | Run migration on dev DB; verify index exists with `EXPLAIN` on a join query; benchmark before/after |
| Risk | Low — additive schema change; no data modification |
| Effort | 30 min |
| Dependencies | None |

### Task 7.6: Replace USDA DEMO_KEY with Config Variable

| Field | Detail |
|---|---|
| Root Cause | Hardcoded `DEMO_KEY` used for USDA API, which has severe rate limits and will fail in production |
| Fix | Move API key to environment variable with `DEMO_KEY` as fallback |
| Files | `usda_client.py:110` |
| Steps | 1. Replace hardcoded key with `os.environ.get("USDA_API_KEY", "DEMO_KEY")`. 2. Add `USDA_API_KEY` to `.env.example`. 3. Document in README. |
| Testing | Test with and without env var set; verify DEMO_KEY fallback works; verify real key works |
| Risk | Low — fallback preserves current behavior |
| Effort | 15 min |
| Dependencies | None |

### Task 7.7: Split Oversized Backend Files (6 files)

| Field | Detail |
|---|---|
| Root Cause | Service files have grown beyond maintainable size, mixing concerns and making navigation difficult |
| Fix | Split each file into focused sub-modules grouped by domain responsibility |
| Files | `food_database/service.py` (996 LOC), `training/router.py` (707 LOC), `coaching_service.py` (586 LOC), `auth/service.py` (538 LOC), `user/service.py` (521 LOC), `achievements/engine.py` (497 LOC) |
| Steps | 1. For each file, identify logical groupings (e.g., CRUD vs. business logic vs. validation). 2. Extract groups into sub-modules (e.g., `food_database/search.py`, `food_database/crud.py`). 3. Re-export from `__init__.py` to preserve import paths. 4. Update all internal imports. 5. Verify no circular imports. |
| Testing | Full backend test suite; verify all imports resolve; run the app end-to-end |
| Risk | High — import path changes can break consumers; circular import risk |
| Effort | 6–8 hours |
| Dependencies | Tasks 7.1–7.6 (complete other backend fixes first to avoid merge conflicts) |
