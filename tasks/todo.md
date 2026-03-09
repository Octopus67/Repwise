# Staff-Level Implementation Plan: 6 Feature Enhancements

**Created:** 2025-01-XX | **Status:** PLANNING
**Estimated Total Effort:** 18-22 hours across 4 phases

---

## Success Criteria

```json
{
  "functional": [
    "DashboardScreen.tsx reduced from 999 LOC to <200 LOC orchestrator",
    "AddNutritionModal.tsx reduced from 2002 LOC to <400 LOC with 6 sub-components",
    "Barcode scanner works on mobile (camera) and web (manual entry) via existing BarcodeScanner component",
    "Food search returns user-frequently-logged items first, with weighted scoring",
    "Warm-up sets auto-generate from previous performance history without requiring working weight input",
    "Combined fatigue + readiness score produces volume_multiplier (0.5-1.2) applied to training suggestions"
  ],
  "observable": [
    "DashboardScreen imports 3 custom hooks: useDashboardData, useDashboardModals, useDashboardNavigation",
    "AddNutritionModal renders FoodSearchPanel, ManualEntryForm, MealPlanTab, RecipeTab, BarcodePanel, ServingSelector",
    "Barcode scan → food lookup → macro population works end-to-end",
    "Searching 'chicken' returns user's most-logged chicken item first (if frequency > 0)",
    "Opening exercise card shows 'Generate Warm-Up' even before entering working weight",
    "Dashboard readiness badge shows combined recovery score with fatigue-adjusted label"
  ],
  "pass_fail": [
    "All existing tests pass (zero regressions)",
    "Each feature gated behind feature flag (safe rollback)",
    "No new TypeScript errors (tsc --noEmit passes)",
    "Backend: all pytest tests pass",
    "Each hook/component has at least 1 unit test"
  ]
}
```

---

## Dependency Graph

```
Phase 1 (Backend) ──→ Phase 2 (Frontend Refactors) ──→ Phase 3 (New Features) ──→ Phase 4 (Integration)
    │                      │                                │
    ├─ F4: food_frequency  ├─ F1: Dashboard hooks           ├─ F3: Barcode wiring
    ├─ F4: search ranking  ├─ F2: Modal decomposition       ├─ F5: Warm-up prediction
    ├─ F6: combined score  │                                ├─ F6: Frontend integration
    └─ Migration           │                                │
                           │                                │
```

**Critical path:** Phase 1 (backend) blocks Phase 3 (barcode + search ranking depend on backend).
Phase 2 (refactors) is independent — can run in parallel with Phase 1.

---

## Phase 1: Backend Foundation (effort: 4-5h)

### F4: Food Search ML Ranking — Backend

**What exists:** `FoodDatabaseService.search()` with FTS5 + LIKE fallback, source-tier ranking (usda > verified > community). No user frequency tracking.

- [x] **1.1** Create Alembic migration: `user_food_frequency` table (priority: high, effort: 30m)
  - Columns: `id (UUID PK)`, `user_id (UUID, indexed)`, `food_item_id (UUID, FK)`, `log_count (int, default 0)`, `last_logged_at (datetime)`, `created_at`
  - Unique constraint: `(user_id, food_item_id)`
  - 🟢 Risk: Low — additive schema change, no existing table affected
  - Rollback: `alembic downgrade -1`

- [x] **1.2** Add `UserFoodFrequency` SQLAlchemy model in `src/modules/food_database/models.py` (priority: high, effort: 15m)
  - Follow existing model patterns (Base, soft_delete mixin)
  - 🟢 Risk: Low

- [x] **1.3** Add frequency increment to `NutritionService.create_entry()` (priority: high, effort: 30m)
  - On successful nutrition entry creation, upsert `user_food_frequency` (increment `log_count`, update `last_logged_at`)
  - Use `INSERT ... ON CONFLICT DO UPDATE` pattern
  - 🟡 Risk: Medium — must not break existing nutrition logging if frequency table doesn't exist yet
  - Mitigation: Wrap in try/except, log warning on failure

- [x] **1.4** Modify `FoodDatabaseService.search()` to accept `user_id` and apply weighted ranking (priority: high, effort: 1h)
  - Scoring formula: `base_score + (frequency_weight * log(1 + log_count)) + (recency_weight * recency_decay)`
  - `frequency_weight = 0.3`, `recency_weight = 0.1`
  - Recency decay: `1.0 / (1 + days_since_last_log / 30)`
  - Left join `user_food_frequency` — zero-frequency items still appear
  - Feature flag: `food_search_ranking` — when disabled, use existing ranking
  - 🟡 Risk: Medium — must not degrade search latency (<500ms)
  - Rollback: Disable feature flag

- [x] **1.5** Add `user_id` parameter to food search router endpoint (priority: high, effort: 15m)
  - Pass `current_user.id` to `service.search()` when authenticated
  - Backward compatible: unauthenticated searches use existing ranking

### F6: Fatigue/Readiness Combined Score — Backend

**What exists:** Separate `readiness_engine.py` (score 0-100) and `fatigue_engine.py` (per-muscle fatigue scores). No combined score. `sync_engine.py` has `volume_multiplier` (0.7-1.5) based on session volume only.

- [x] **1.6** Create `src/modules/readiness/combined_score.py` — pure function (priority: high, effort: 1h)
  - Input: `readiness_score: Optional[int]`, `fatigue_scores: list[FatigueScoreResult]`, `config: CombinedConfig`
  - Output: `CombinedRecoveryResult(score: int, volume_multiplier: float, label: str, factors: list)`
  - Formula: `combined = readiness_weight * readiness + (1 - readiness_weight) * (100 - avg_fatigue)`
  - `readiness_weight = 0.6` (readiness matters more than fatigue)
  - `volume_multiplier = 0.5 + (combined / 100) * 0.7` → range [0.5, 1.2]
  - Labels: ≥70 "Ready to Push", ≥40 "Train Smart", <40 "Recovery Day"
  - Guard: If readiness is None, use fatigue-only mode (weight=0.0 for readiness)
  - 🟢 Risk: Low — pure function, no DB
  - Rollback: N/A (unused until wired)

- [x] **1.7** Add `/readiness/combined` endpoint in `readiness_router.py` (priority: medium, effort: 30m)
  - Calls existing `readiness_service.get_score()` + `fatigue_service.analyze_fatigue()`
  - Passes results to `compute_combined_recovery()`
  - Feature flag: `combined_readiness` — returns 404 when disabled
  - 🟢 Risk: Low — new endpoint, no existing behavior changed

- [x] **1.8** Seed feature flags: `food_search_ranking`, `combined_readiness`, `predictive_warmup` (priority: medium, effort: 15m)
  - Add to existing seed script pattern in `scripts/`
  - Default: disabled (safe rollout)

### 🚦 Phase 1 Checkpoint

**Pass criteria:**
- [x] `alembic upgrade head` succeeds
- [x] `pytest tests/ -x` — all existing tests pass
- [x] New endpoint `/readiness/combined` returns valid JSON (manual curl test)
- [x] Food search with `user_id` returns results without error
- [x] Feature flags seeded and queryable

**STOP condition:** Any migration failure or existing test regression → fix before proceeding.

---

## Phase 2: Frontend Refactors (effort: 5-6h) — PARALLEL with Phase 1

### F1: DashboardScreen Refactor

**What exists:** 999 LOC god component with ~30 useState calls, 10+ API calls in `loadDashboardData`, 8 modal visibility states, inline weight trend computation.

- [x] **2.1** Extract `useDashboardData` hook (priority: high, effort: 1.5h)
  - File: `app/hooks/useDashboardData.ts`
  - Moves: ALL data-fetching logic (`loadDashboardData`), all KPI state (`calories`, `protein`, `carbs`, `workoutsCompleted`, `streak`, `articles`, `nutritionEntries`, `trainingSessions`, `loggedDates`, `weightHistory`, `milestoneMessage`, `fatigueSuggestions`, `readinessScore`, `readinessFactors`, `recompMetrics`, `nudges`, `volumeSummary`), loading/error/refreshing state, date debounce logic
  - Returns: `{ data, isLoading, error, refreshing, dateLoading, handleDateSelect, handleRefresh }`
  - `data` is a typed object: `DashboardData { calories, protein, carbs, totalFat, nutritionEntries, trainingSessions, ... }`
  - 🟡 Risk: Medium — many state interdependencies
  - Mitigation: Extract as-is first, optimize later. Keep same API call pattern.
  - Rollback: Revert single file

- [x] **2.2** Extract `useDashboardModals` hook (priority: high, effort: 45m)
  - File: `app/hooks/useDashboardModals.ts`
  - Moves: ALL modal visibility states (`showUpgrade`, `showNutrition`, `showTraining`, `showBodyweight`, `showQuickAdd`, `showMealBuilder`, `showCheckin`, `prefilledMealName`)
  - Returns: `{ modals, openNutrition, openTraining, openBodyweight, openQuickAdd, openMealBuilder, openCheckin, openUpgrade, closeAll }`
  - 🟢 Risk: Low — pure state, no logic dependencies

- [x] **2.3** Extract `useDashboardNavigation` hook (priority: medium, effort: 30m)
  - File: `app/hooks/useDashboardNavigation.ts`
  - Moves: `handleArticlePress`, `handleAddToSlot`, `handleQuickAction`, navigation callbacks for TodayWorkoutCard/FatigueAlertCard/etc.
  - Takes: `navigation`, `modals` (from useDashboardModals), `impact` (from useHaptics)
  - Returns: `{ handleArticlePress, handleAddToSlot, handleQuickAction, workoutCardHandlers }`
  - 🟢 Risk: Low

- [x] **2.4** Rewrite `DashboardScreen.tsx` as thin orchestrator (priority: high, effort: 45m)
  - Import and compose the 3 hooks
  - JSX stays in DashboardScreen (it's the view layer)
  - Target: <200 LOC for the component function body (excluding styles)
  - Verify: All existing dashboard behavior preserved
  - 🟡 Risk: Medium — must verify no subtle state timing issues
  - Rollback: Git revert

### F2: AddNutritionModal Decomposition

**What exists:** 2002 LOC monolith with food search, manual entry, meal plans, recipes, barcode scanning, serving options, micronutrients, water tracking — all in one component.

- [x] **2.5** Extract `FoodSearchPanel` component (priority: high, effort: 1h)
  - File: `app/components/nutrition/FoodSearchPanel.tsx`
  - Moves: search state (`searchQuery`, `searchResults`, `searchLoading`, `searchError`, `searchEmpty`), `handleSearchChange`, `handleSelectFood`, debounce logic, search results list rendering
  - Props: `{ onFoodSelected: (item: FoodItem) => void, onBarcodePress: () => void }`
  - 🟡 Risk: Medium — debounce ref cleanup must be correct

- [x] **2.6** Extract `ManualEntryForm` component (priority: high, effort: 45m)
  - File: `app/components/nutrition/ManualEntryForm.tsx`
  - Moves: manual macro inputs (`calories`, `protein`, `carbs`, `fat`, `notes`), micronutrient expansion, fibre, water tracker
  - Props: `{ values, onChange, onSubmit, loading }`
  - 🟢 Risk: Low

- [x] **2.7** Extract `ServingSelector` component (priority: medium, effort: 30m)
  - File: `app/components/nutrition/ServingSelector.tsx`
  - Moves: `servingOptions`, `selectedServing`, `servingMultiplier`, `handleServingChange`, `handleMultiplierChange`, `applyServingToFood`
  - Props: `{ food: FoodItem, onMacrosChanged: (macros) => void }`
  - 🟢 Risk: Low

- [x] **2.8** Extract `MealPlanTab` component (priority: medium, effort: 30m)
  - File: `app/components/nutrition/MealPlanTab.tsx`
  - Moves: custom meals state, plan creation, `handleSelectPlan`, `handleFavoritePlan`, `handleDeletePlan`, plan item CRUD
  - 🟢 Risk: Low

- [x] **2.9** Extract `RecipeTab` component (priority: medium, effort: 30m)
  - File: `app/components/nutrition/RecipeTab.tsx`
  - Moves: `userRecipes`, `selectedRecipe`, `recipeServings`, recipe logging logic
  - 🟢 Risk: Low

- [x] **2.10** Rewrite `AddNutritionModal.tsx` as orchestrator (priority: high, effort: 45m)
  - Tab navigation + state coordination between sub-components
  - Target: <400 LOC
  - Shared state lifted to modal level: `selectedFood`, `activeTab`, macro values (passed down)
  - 🟡 Risk: Medium — state flow between tabs must be preserved
  - Rollback: Git revert

### 🚦 Phase 2 Checkpoint

**Pass criteria:**
- [x] `npx tsc --noEmit` — zero TypeScript errors
- [x] Dashboard renders identically (visual regression check)
- [x] All nutrition modal flows work: search → select → log, manual entry, meal plan, recipe, barcode
- [x] Existing frontend tests pass
- [x] DashboardScreen.tsx component body < 200 LOC
- [x] AddNutritionModal.tsx < 400 LOC

**STOP condition:** Any TypeScript error or broken modal flow → fix before proceeding.

---

## Phase 3: New Feature Implementation (effort: 6-7h)

### F3: Barcode Scanner Integration

**What exists:** `BarcodeScanner.tsx` (fully functional camera scanner), `barcode_service.py` (cache → OFF → USDA chain), `barcodeUtils.ts` (validation helpers), `resolveScannerMode()`. The scanner is already imported in AddNutritionModal but the wiring between scan result → form population has edge cases.

- [x] **3.1** Wire barcode scan result into decomposed `FoodSearchPanel` (priority: high, effort: 45m)
  - After F2 decomposition, ensure `BarcodePanel` (extracted from AddNutritionModal's barcode state) properly calls `onFoodSelected` with scanned item
  - Handle manual barcode entry (web) via existing `handleManualBarcodeEntry`
  - Feature flag: `camera_barcode_scanner` (already exists)
  - 🟢 Risk: Low — mostly wiring existing code
  - Rollback: Feature flag disable

- [x] **3.2** Add barcode scan history to `FoodSearchPanel` (priority: low, effort: 30m)
  - Show last 5 scanned items as quick-select chips above search
  - Store in AsyncStorage: `barcode_scan_history`
  - 🟢 Risk: Low — additive UI

### F4: Food Search ML Ranking — Frontend

- [x] **3.3** Update `FoodSearchPanel` to pass auth context to search API (priority: high, effort: 15m)
  - The backend now uses `user_id` from auth token — no frontend change needed for the API call itself
  - Add visual indicator: "⭐ Frequently logged" badge on items with `frequency > 0`
  - 🟢 Risk: Low

- [x] **3.4** Add frequency tracking call on successful nutrition log (priority: high, effort: 15m)
  - Already handled by backend (step 1.3) — verify the flow works end-to-end
  - 🟢 Risk: Low

### F5: Warm-Up Generation UX — Predictive from History

**What exists:** `generateWarmUpSets(workingWeightKg)` — requires working weight. `WarmUpSuggestion` component requires `workingWeightKg` prop. `PreviousPerformanceData` is already fetched per exercise in `ActiveWorkoutScreen`.

- [x] **3.5** Extend `generateWarmUpSets` to accept optional `previousBestWeight` (priority: high, effort: 30m)
  - New signature: `generateWarmUpSets(workingWeightKg?: number, options?: { previousBestWeight?: number, barWeightKg?: number })`
  - If `workingWeightKg` is undefined but `previousBestWeight` exists, use `previousBestWeight` as the working weight
  - If neither exists, return empty array
  - Backward compatible — existing callers unaffected
  - Feature flag: `predictive_warmup`
  - 🟢 Risk: Low — pure function extension

- [x] **3.6** Update `WarmUpSuggestion` to use previous performance data (priority: high, effort: 45m)
  - New optional prop: `previousBestWeight?: number`
  - When `workingWeightKg` is not yet entered but `previousBestWeight` exists:
    - Show "Generate Warm-Up (based on last session)" button
    - Generate sets using `previousBestWeight`
  - When user enters working weight, switch to using that
  - 🟡 Risk: Medium — must not show stale data
  - Mitigation: Clear prediction when exercise changes

- [x] **3.7** Wire `previousPerformance` data to `WarmUpSuggestion` in `ExerciseCardPremium` (priority: high, effort: 30m)
  - `ExerciseCardPremium` already receives `previousPerformance` prop
  - Extract `best_weight_kg` from previous performance data
  - Pass to `WarmUpSuggestion` as `previousBestWeight`
  - 🟢 Risk: Low — data already available

### F6: Fatigue/Readiness Integration — Frontend

- [x] **3.8** Create `useRecoveryScore` hook (priority: high, effort: 45m)
  - File: `app/hooks/useRecoveryScore.ts`
  - Calls `/readiness/combined` endpoint (from step 1.7)
  - Returns: `{ score, volumeMultiplier, label, factors, isLoading }`
  - Caches result for current session (avoid re-fetching on every screen focus)
  - Feature flag: `combined_readiness`
  - Fallback: When flag disabled, return existing separate readiness score
  - 🟢 Risk: Low

- [x] **3.9** Update `DashboardScreen` readiness badge to show combined score (priority: medium, effort: 30m)
  - Replace inline readiness display with `useRecoveryScore` hook
  - Show: "Recovery: 72/100 — Ready to Push" with color-coded badge
  - Show volume multiplier as subtle indicator: "Volume: 0.9×"
  - 🟢 Risk: Low — additive UI change behind flag

- [x] **3.10** Create `RecoveryInsightCard` component (priority: medium, effort: 45m)
  - File: `app/components/dashboard/RecoveryInsightCard.tsx`
  - Replaces separate readiness badge + fatigue alert card with unified card
  - Shows: combined score gauge, top 3 factors, volume recommendation
  - Tappable → opens `RecoveryCheckinModal`
  - 🟡 Risk: Medium — replaces two existing UI elements
  - Mitigation: Feature flag — old UI when disabled

### 🚦 Phase 3 Checkpoint

**Pass criteria:**
- [ ] Barcode scan → food selection → macro population works on mobile
- [ ] Manual barcode entry works on web
- [ ] Food search returns frequently-logged items with visual indicator
- [ ] Warm-up generates from previous performance when no working weight entered
- [ ] Combined recovery score displays on dashboard
- [ ] All feature flags default to disabled (safe rollout)
- [ ] `npx tsc --noEmit` passes
- [ ] `pytest tests/ -x` passes

**STOP condition:** Any feature breaks existing functionality → disable flag and fix.

---

## Phase 4: Integration Testing & Polish (effort: 3-4h)

- [x] **4.1** Write unit tests for `useDashboardData` hook (priority: high, effort: 30m)
  - Test: data loading, error handling, date switching, refresh
  - Mock API calls

- [x] **4.2** Write unit tests for `combined_score.py` (priority: high, effort: 30m)
  - Test: edge cases (None readiness, empty fatigue, all-zero scores)
  - Test: volume_multiplier bounds [0.5, 1.2]
  - Test: label thresholds

- [x] **4.3** Write unit tests for extended `generateWarmUpSets` (priority: high, effort: 20m)
  - Test: previousBestWeight fallback
  - Test: backward compatibility (existing callers)

- [x] **4.4** Write unit tests for `UserFoodFrequency` upsert logic (priority: high, effort: 20m)
  - Test: first log creates entry, subsequent logs increment
  - Test: concurrent upsert safety

- [x] **4.5** Write integration test for food search ranking (priority: medium, effort: 30m)
  - Test: user with frequency data gets personalized results
  - Test: user without frequency data gets default ranking

- [x] **4.6** End-to-end smoke test: full dashboard flow (priority: high, effort: 30m)
  - Load dashboard → date switch → log food → log training → verify updates
  - Verify no console errors or warnings

- [x] **4.7** Performance validation (priority: medium, effort: 30m)
  - Dashboard load time: <2s on 3G (measure with React DevTools)
  - Food search latency: <500ms (existing test)
  - No unnecessary re-renders (React.memo where needed)

- [x] **4.8** Feature flag rollout plan (priority: high, effort: 15m)
  - Document flag names and enable order:
    1. `food_search_ranking` — enable first (lowest risk)
    2. `predictive_warmup` — enable second
    3. `combined_readiness` — enable third (most visible)
    4. `camera_barcode_scanner` — already exists, verify still works

### 🚦 Phase 4 Checkpoint (FINAL)

**Pass criteria:**
- [x] ALL existing tests pass (zero regressions)
- [x] ALL new tests pass
- [x] `npx tsc --noEmit` — zero errors
- [x] `pytest tests/ -x` — all pass
- [x] Each feature works independently behind its flag
- [x] Each feature can be disabled without affecting others
- [x] No console errors in development mode
- [x] Dashboard loads in <2s

**STOP condition:** Any test failure → fix before declaring done.

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Dashboard refactor breaks state timing | 🟡 Medium | Extract as-is first, test each hook independently |
| Food search ranking degrades latency | 🟡 Medium | LEFT JOIN + index on user_food_frequency(user_id, food_item_id), feature flag |
| AddNutritionModal decomposition breaks tab state | 🟡 Medium | Lift shared state to parent, test each tab flow |
| Combined score endpoint adds dashboard latency | 🟢 Low | Single endpoint replaces 2 separate calls (net improvement) |
| Warm-up prediction shows stale data | 🟢 Low | Clear on exercise change, use latest session data |
| Migration conflicts with other branches | 🟢 Low | Use timestamp-based migration naming |

## Monitoring Requirements

- **Dashboard load time:** Track via `console.time('dashboard-load')` in dev, Sentry performance in prod
- **Food search latency:** Existing `test_latency_under_200ms` test + backend logging
- **Barcode lookup success rate:** Log `source` field from `BarcodeResponse` (cache/off/usda/miss)
- **Feature flag usage:** Existing feature flag audit logging
- **Combined score computation time:** Backend logging in endpoint handler

## Rollback Procedures

| Feature | Rollback Method |
|---------|----------------|
| F1: Dashboard refactor | Git revert (single commit per hook extraction) |
| F2: Modal decomposition | Git revert (single commit per component extraction) |
| F3: Barcode wiring | Disable `camera_barcode_scanner` flag |
| F4: Food search ranking | Disable `food_search_ranking` flag + revert search query |
| F5: Warm-up prediction | Disable `predictive_warmup` flag |
| F6: Combined recovery | Disable `combined_readiness` flag |
| Migration | `alembic downgrade -1` |
