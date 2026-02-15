# Implementation Plan: Competitive Parity V1 — Revised (SDE3 Stress-Tested)

## Pre-flight Checklist

1. Confirm both servers run: backend on :8000 (`Application startup complete`), frontend on :8081 (bundle completes).
2. Confirm existing test suites green: `cd app && npx jest --config jest.config.js` (frontend), `/Users/manavmht/.local/share/mise/installs/python/3.12.4/bin/python -m pytest tests/ -x -q` (backend). STOP if any test fails — fix before proceeding.
3. Verify Alembic is configured: `alembic current` should show a revision. If Alembic is not set up (SQLite dev uses auto-create-all), skip migration steps and rely on `Base.metadata.create_all()` in `src/main.py` lifespan. Confirm which path applies before Task 1.
4. Install frontend dependencies needed across multiple features: `cd app && yarn add expo-camera expo-barcode-scanner expo-image-picker expo-file-system`. Verify no build errors with `npx expo start --web --clear`. Risk: expo-barcode-scanner may not work on web — acceptable, barcode scanning is mobile-only. Web fallback is text search.
5. No secrets or env vars needed for Open Food Facts API (no key required). USDA key already configured in `.env` as `USDA_API_KEY`. Verify: `grep USDA_API_KEY .env`.
6. Feature flag: All 8 features ship behind existing feature flag infrastructure. Insert `competitive_parity_v1` flag via admin API or direct DB insert after backend starts. Rollback for any task: `git revert` the commit(s). No schema changes require manual unwind if using create_all (additive columns only).

## Dependency Graph (Verified — No Circular Dependencies)

```
Phase 1 (Foundation — no cross-dependencies):
  Task 1: F8 Verified DB (schema migration) ─── unblocks Tasks 4, 7, 8
  Task 2: F4 Weight Trend (frontend-only) ─── unblocks Task 5

Phase 2 (Core features — depend on Phase 1):
  Task 4: F10 Recipe Builder ─── depends on Task 1 (total_servings column, source field)
  Task 5: F3 Coaching Tiers ─── depends on Task 2 (EMA for check-in card)

Phase 3 (Consumer features — depend on Phase 1+2):
  Task 7: F1 Barcode Scanner ─── depends on Task 1 (BarcodeCache model, source tagging)
  Task 8: F6 Meal Builder ─── depends on Tasks 1, 4 (source badges, recipes as items)

Phase 4 (Independent — no blockers):
  Task 10: F11 Deep Micros ─── extends existing JSONB, no model changes
  Task 11: F5 Progress Photos ─── fully independent new module
```

## Tasks

- [x] 1. Feature 8: Verified Food Database — Schema + Source Sorting
  - [x] 1.1 Add `source` (String(20), default='community', indexed), `barcode` (String(50), nullable, unique, indexed), `description` (Text, nullable), `total_servings` (Float, nullable, default=1.0) columns to `FoodItem` model in `src/modules/food_database/models.py`. Add `BarcodeCache` model (barcode unique+indexed, food_item_id FK, source_api, raw_response JSONB). If using Alembic: generate and run migration. If using create_all: restart backend to pick up new columns. Update existing seed data: items with `region != 'USDA'` get `source='verified'`, USDA-fetched items get `source='usda'`. Verify: `SELECT source, count(*) FROM food_items GROUP BY source` shows expected distribution.
    - Risk: Unique constraint on `barcode` may conflict if duplicate barcodes exist in seed data. Mitigation: seed data has no barcodes — column is nullable, constraint only applies to non-null values.
    - Rollback: Remove columns from model, restart backend.
    - _Requirements: 8.1.1, 8.1.5_
  - [x] 1.2 Modify `FoodDatabaseService.search()` in `src/modules/food_database/service.py`: add `case()` expression to ORDER BY that sorts by source priority (usda=0, verified=1, community=2, custom=3), then by name. Update `_fetch_and_cache_usda` to set `source='usda'` on cached items. Update `FoodItemCreate` and `FoodItemResponse` schemas in `src/modules/food_database/schemas.py` to include `source` (with Literal validation), `barcode`, `description`, `total_servings`. Ensure `source` is server-enforced: user-created items always get `source='custom'` regardless of client payload.
    - Risk: `case()` import from SQLAlchemy may differ between versions. Mitigation: use `from sqlalchemy import case` — verify against existing SQLAlchemy version in pyproject.toml.
    - Rollback: Revert search ordering to `FoodItem.name` only.
    - _Requirements: 8.1.3, 8.1.5_
  - [x] 1.3 Write property tests in `tests/test_food_source_properties.py`: (a) Property 18 — every FoodItem has source in {'usda','verified','community','custom'}, (b) Property 20 — search results are ordered by source priority then name.
    - **Property 18: Food source field integrity**
    - **Property 20: Source-priority search ordering**
    - **Validates: Requirements 8.1.1, 8.1.3, 8.1.5**
  - [x] 1.4 Create `app/components/nutrition/SourceBadge.tsx`: green checkmark (Ionicons `checkmark-circle`) for usda/verified, gray circle (`ellipse-outline`) for community/custom. Size prop (default 16). onPress shows tooltip via Alert or custom tooltip component. Integrate into food search result rows in `AddNutritionModal.tsx` — add `<SourceBadge source={item.source} />` next to food name.
    - Risk: None — additive UI change.
    - Rollback: Remove component and references.
    - _Requirements: 8.1.2, 8.1.4_
  - [x] 1.5 Write property test in `app/__tests__/components/SourceBadge.test.ts`: Property 19 — for any source value in the valid set, badge renders correct icon color (green for usda/verified, gray for community/custom).
    - **Property 19: Source-based badge rendering**
    - **Validates: Requirements 8.1.2**

- [x] 2. Feature 4: Weight Trend Smoothing — Frontend EMA (NO backend changes)
  - [x] 2.1 Create `app/utils/emaTrend.ts` exporting: `computeEMA(weights: WeightPoint[]): WeightPoint[]` (EMA_ALPHA=0.25, returns empty if <3 points, filters >2kg/day fluctuations), `computeWeeklyChange(emaSeries: WeightPoint[]): number | null` (returns EMA[last] - EMA[7 days ago], null if insufficient), `formatWeeklyChange(change: number | null, unit: 'kg'|'lbs'): string` (returns "↓0.3kg" / "↑0.2kg" / "→0.0kg" / "—").
    - Risk: EMA constants must match backend `src/modules/adaptive/engine.py` (EMA_ALPHA=0.25, EMA_WINDOW=7). Mitigation: hardcode same values, add comment referencing backend file.
    - Rollback: Delete file.
    - _Requirements: 4.1.2, 4.1.5, 4.1.6_
  - [x] 2.2 Write property tests in `app/__tests__/utils/emaTrend.test.ts`: Property 9 (EMA output matches reference for any sorted weight series ≥3 points), Property 10 (<3 points returns empty array, ≥3 returns array of same length), Property 11 (weekly change uses EMA values not raw).
    - **Property 9: Frontend EMA matches reference implementation**
    - **Property 10: Trend line minimum data points**
    - **Property 11: Weekly change from trend, not raw**
    - **Validates: Requirements 4.1.2, 4.1.5, 4.1.6**
  - [x] 2.3 Modify `app/screens/analytics/AnalyticsScreen.tsx`: fetch bodyweight history from existing `GET /api/user/bodyweight` endpoint, compute EMA client-side via `computeEMA()`, render two series on `TrendLineChart`: raw (dots, opacity 0.4) + EMA (solid line, `colors.primary`). If <3 data points, show raw only.
    - Risk: TrendLineChart may need a second `data` prop or overlay support. Mitigation: check existing TrendLineChart interface — if it only accepts one series, add a `secondarySeries` prop.
    - Rollback: Revert AnalyticsScreen.tsx.
    - _Requirements: 4.1.1_
  - [x] 2.4 Modify `app/screens/dashboard/DashboardScreen.tsx`: below the existing weight display, add "Trend: X.Xkg" (using latest EMA value) and weekly change badge ("↓0.3kg this week"). Add info icon (Ionicons `information-circle-outline`) with tooltip: "Trend weight smooths out daily fluctuations from water, sodium, and other factors." If no weight data, show nothing. If <3 points, show raw weight without "Trend:" prefix.
    - Risk: Dashboard is the most-visited screen — visual regressions break retention. Mitigation: keep existing weight display unchanged, add trend as supplementary info below it.
    - Rollback: Revert DashboardScreen.tsx.
    - _Requirements: 4.1.3, 4.1.4, 4.1.6_

- [x] 3. **CHECKPOINT — Phase 1 Complete**
  - Run full backend test suite: `/Users/manavmht/.local/share/mise/installs/python/3.12.4/bin/python -m pytest tests/ -x -q` — all must pass.
  - Run full frontend test suite: `cd app && npx jest --config jest.config.js` — all must pass.
  - Restart backend, verify food search returns items with `source` field populated.
  - Verify: search for "chicken" returns USDA items before community items.
  - Verify: dashboard shows trend weight if ≥3 bodyweight entries exist.
  - If any test fails: STOP. Fix before proceeding to Phase 2.

- [x] 4. Feature 10: Recipe Builder — Backend Service + API + Frontend Screen
  - [x] 4.1 Add `create_recipe()`, `list_user_recipes()`, `update_recipe()` methods to `FoodDatabaseService` in `src/modules/food_database/service.py`. `create_recipe`: creates FoodItem(is_recipe=True, source='custom', total_servings=N), creates RecipeIngredient rows, calls `aggregate_recipe_nutrition()` to compute totals, stores per-serving macros on FoodItem (denormalized). Prevent circular recipes (food_item_id != recipe_id). Add `RecipeCreateRequest` (name, description, total_servings>0, ingredients[]), `RecipeIngredientInput` (food_item_id, quantity>0, unit), `RecipeUpdateRequest` schemas to `src/modules/food_database/schemas.py`.
    - Risk: `aggregate_recipe_nutrition` already exists but may not handle the `total_servings` division. Mitigation: read the function first, extend if needed.
    - Rollback: Remove new methods and schemas.
    - _Requirements: 10.1.2, 10.1.3, 10.1.5, 10.2.3_
  - [x] 4.2 Add recipe CRUD endpoints to `src/modules/food_database/router.py`: POST `/api/food-database/recipes` (auth required, creates recipe), GET `/api/food-database/recipes` (user's recipes, paginated), GET `/api/food-database/recipes/{id}` (with ingredients + nutrition), PUT `/api/food-database/recipes/{id}` (owner only, recomputes nutrition), DELETE `/api/food-database/recipes/{id}` (soft delete). Ensure recipes appear in regular food search results (they're FoodItems with is_recipe=True).
    - Risk: None — follows existing router patterns.
    - Rollback: Remove endpoints.
    - _Requirements: 10.1.1, 10.1.6_
  - [x] 4.3 Write property tests in `tests/test_recipe_builder_properties.py`: Property 12 (recipe nutrition = sum of scaled ingredients / total_servings * servings_consumed, within float tolerance), Property 13 (created recipe appears in food search by exact name).
    - **Property 12: Recipe nutrition scaling**
    - **Property 13: Recipe searchability round-trip**
    - **Validates: Requirements 10.1.4, 10.1.6, 10.2.2**
  - [x] 4.4 Create `app/screens/nutrition/RecipeBuilderScreen.tsx` with 4-step state machine: NAMING (name + description + total servings) → ADDING_INGREDIENTS (food search reuse, quantity per ingredient, running total + per-serving display) → REVIEW (full list, edit/remove, adjust servings) → SAVED (confirmation, navigate back). Client-side nutrition computation: `total = Σ(ingredient.macro * quantity / serving_size)`, `perServing = total / totalServings`. Add navigation entry from AddNutritionModal ("Create Recipe" button).
    - Risk: Reusing food search component inside RecipeBuilder may cause navigation conflicts. Mitigation: use inline search (same pattern as AddTrainingModal exercise search) rather than navigating to a separate screen.
    - Rollback: Delete screen file.
    - _Requirements: 10.1.1, 10.1.2, 10.1.3, 10.1.4, 10.1.5_
  - [x] 4.5 Add recipe logging flow to `AddNutritionModal.tsx`: "Log Recipe" option in the modal that shows user's recipes (GET `/api/food-database/recipes`), serving count input (decimal, e.g., 1.5), macros scale as `perServing * servingsConsumed`. On save, POST to existing `/api/nutrition/entries` with `meal_name` set to recipe name.
    - Risk: None — uses existing nutrition entry endpoint.
    - Rollback: Remove recipe logging UI from modal.
    - _Requirements: 10.2.1, 10.2.2_

- [x] 5. Feature 3: Adaptive Coaching Tiers — Backend + Frontend
  - [x] 5.1 Add `coaching_mode` column (String(20), default='coached') to user profile model in `src/modules/user/models.py`. Add `CoachingSuggestion` model to `src/modules/adaptive/models.py` with fields: user_id (FK), snapshot_id (FK), status ('pending'|'accepted'|'modified'|'dismissed'), proposed macros (4 floats), modified macros (4 nullable floats), explanation (Text), resolved_at. Index on (user_id, status). If using Alembic: generate migration. If using create_all: restart backend. Add schemas to `src/modules/adaptive/schemas.py`: `WeeklyCheckinResponse`, `MacroTargets`, `MacroModifications`, `CoachingSuggestionResponse`.
    - Risk: Adding column to user_profiles may conflict with existing profile queries. Mitigation: column has a default value, existing queries are unaffected.
    - Rollback: Remove column and model.
    - _Requirements: 3.1.1, 3.3.1_
  - [x] 5.2 Create `src/modules/adaptive/coaching_service.py` with `CoachingService` class. Core method `generate_weekly_checkin(user_id)`: (1) load user profile for coaching_mode, (2) load last 14 days bodyweight + 7 days nutrition, (3) if <7 bodyweight entries return insufficient_data response with days_remaining, (4) build AdaptiveInput and call existing `compute_snapshot()`, (5) compare with previous snapshot, (6) generate explanation via `_generate_explanation()` (template: weight direction + target change + progress assessment), (7) based on mode: coached=auto-persist+update targets, collaborative=create pending CoachingSuggestion, manual=return info-only. Idempotency: if snapshot already created today, return it. Add `accept_suggestion()`, `modify_suggestion()`, `dismiss_suggestion()` methods.
    - Risk: `compute_snapshot()` requires specific `AdaptiveInput` fields. Mitigation: read `src/modules/adaptive/engine.py` to verify required fields match what we can construct from user profile + bodyweight + nutrition data.
    - Rollback: Delete coaching_service.py.
    - _Requirements: 3.2.1, 3.2.2, 3.2.3, 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.5_
  - [x] 5.3 Add coaching endpoints to `src/modules/adaptive/router.py`: POST `/api/adaptive/weekly-checkin` (triggers check-in), GET `/api/adaptive/suggestions` (pending suggestions), POST `/api/adaptive/suggestions/{id}/accept`, POST `/api/adaptive/suggestions/{id}/modify` (body: MacroModifications with calories≥1200), POST `/api/adaptive/suggestions/{id}/dismiss`. All require JWT auth.
    - Risk: None — follows existing router patterns.
    - Rollback: Remove endpoints.
    - _Requirements: 3.2.1, 3.3.1, 3.3.2_
  - [x] 5.4 Write property tests in `tests/test_coaching_tier_properties.py`: Property 5 (coached mode with ≥7 days data produces non-null targets with calories≥1200), Property 6 (check-in response contains weight_trend, explanation with "lost"/"gained"/"maintained"), Property 7 (manual mode returns current targets unchanged, no CoachingSuggestion created), Property 8 (<7 days returns has_sufficient_data=false with correct days_remaining).
    - **Property 5: Coached mode weekly recalculation**
    - **Property 6: Check-in card completeness**
    - **Property 7: Manual mode target invariance**
    - **Property 8: Insufficient data handling**
    - **Validates: Requirements 3.2.1, 3.2.2, 3.2.3, 3.3.3, 3.3.4, 3.3.5**
  - [x] 5.5 Create `app/components/coaching/WeeklyCheckinCard.tsx`: appears on dashboard when weeklyCheckin is available. Coached mode: shows new targets + explanation + "Got it" dismiss. Collaborative mode: shows proposed targets + accept/modify/dismiss buttons. Modify button opens inline editor with MacroTargets fields (calories min 1200). Insufficient data: "Log X more days for personalized recommendations" with progress bar (count/7). Manual mode: not shown.
    - Risk: Dashboard already has many components — adding another card may cause scroll performance issues. Mitigation: lazy-render the card only when weeklyCheckin is non-null.
    - Rollback: Remove component.
    - _Requirements: 3.2.2, 3.2.3, 3.3.1, 3.3.5_
  - [x] 5.6 Create `app/components/coaching/CoachingModeSelector.tsx`: three-option radio group (Coached: "App manages your targets weekly" / Collaborative: "App suggests, you decide" / Manual: "You set everything"). Add to onboarding flow (new step after goal selection, before body stats) and Profile/Settings screen. Add `coachingMode` and `weeklyCheckin` to Zustand store with `setCoachingMode()` and `setWeeklyCheckin()` actions. On dashboard load, call POST `/api/adaptive/weekly-checkin` and store result.
    - Risk: Adding a step to onboarding may break existing onboarding tests. Mitigation: update `tests/test_onboarding_properties.py` and `app/__tests__/screens/` onboarding tests.
    - Rollback: Remove component, revert onboarding and store changes.
    - _Requirements: 3.1.1, 3.1.2_

- [x] 6. **CHECKPOINT — Phase 2 Complete**
  - Run full backend test suite — all must pass.
  - Run full frontend test suite — all must pass.
  - Restart both servers.
  - Verify: POST `/api/food-database/recipes` creates a recipe, GET returns it, recipe appears in food search.
  - Verify: POST `/api/adaptive/weekly-checkin` returns a valid response (may be insufficient_data if <7 days of weight data — that's correct).
  - Verify: coaching mode selector renders in Profile/Settings.
  - If any test fails: STOP. Fix before proceeding to Phase 3.

- [x] 7. Feature 1: Barcode Scanner — Backend Lookup Chain + Frontend Camera
  - [x] 7.1 Create `src/modules/food_database/off_client.py`: async function `get_product_by_barcode(barcode: str) -> dict | None`. GET `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`. Parse `product.nutriments` for: energy-kcal_100g → calories, proteins_100g → protein_g, carbohydrates_100g → carbs_g, fat_100g → fat_g. Parse `product.product_name` → name, `product.serving_size` → serving_size (default 100g if missing). 5-second timeout via httpx.AsyncClient. Return None on 404, timeout, or missing required fields.
    - Risk: Open Food Facts API may be slow or down. Mitigation: 5s timeout, fallback to USDA. OFF has 99.9% uptime historically.
    - Rollback: Delete file.
    - _Requirements: 1.1.3_
  - [x] 7.2 Create `src/modules/food_database/barcode_service.py` with `BarcodeService` class. `lookup_barcode(barcode)`: (1) SELECT from barcode_cache WHERE barcode=? — if hit, return cached FoodItem, (2) call `off_client.get_product_by_barcode()` — if hit, create FoodItem(source='off', barcode=barcode), insert into barcode_cache, return, (3) call `search_usda_foods(barcode)` as UPC fallback — if hit, create FoodItem(source='usda', barcode=barcode), insert into barcode_cache, return, (4) return BarcodeResponse(found=False). Add `BarcodeResponse` schema (found: bool, food_item: FoodItemResponse | None, source: str | None).
    - Risk: Concurrent scans of same barcode may cause unique constraint violation on barcode_cache. Mitigation: catch IntegrityError, re-query cache (another request already cached it).
    - Rollback: Delete file.
    - _Requirements: 1.1.3, 1.1.6, 1.1.7_
  - [x] 7.3 Add barcode endpoint to `src/modules/food_database/router.py`: GET `/api/food-database/barcode/{barcode}` returning `BarcodeResponse`. JWT auth required. Validate barcode format: 8-14 digits (covers EAN-8, EAN-13, UPC-A, UPC-E).
    - Risk: None — follows existing router patterns.
    - Rollback: Remove endpoint.
    - _Requirements: 1.1.3_
  - [x] 7.4 Write property tests in `tests/test_barcode_properties.py`: Property 1 (fallback chain: if OFF returns None, USDA is called; if both None, found=False), Property 2 (any returned food_item has non-null name, calories≥0, protein_g≥0, carbs_g≥0, fat_g≥0, serving_size>0), Property 4 (after successful lookup, second lookup for same barcode returns from cache without external API call).
    - **Property 1: Barcode lookup fallback chain**
    - **Property 2: Barcode result completeness**
    - **Property 4: Barcode cache round-trip**
    - **Validates: Requirements 1.1.3, 1.1.4, 1.1.6**
  - [x] 7.5 Create `app/components/nutrition/BarcodeScanner.tsx`: (1) check camera permission via `Camera.getCameraPermissionsAsync()`, request if undetermined, show "Enable in Settings" if denied, (2) render `BarCodeScanner` from expo-barcode-scanner with semi-transparent overlay and centered scan area, (3) on scan: debounce 2s (ignore duplicate scans), vibrate via Haptics, close camera, call GET `/api/food-database/barcode/{barcode}`, (4) if found: show confirmation card with food name, macros, serving adjuster (multiplier input), "Add" button, (5) if not found: show "Not found — search manually" with button to switch to text search. Props: `onFoodSelected(item: FoodItem, multiplier: number)`, `onClose()`.
    - Risk: expo-barcode-scanner does NOT work on web (no camera access in Expo web). Mitigation: hide barcode icon on web platform (`Platform.OS === 'web'`). Web users use text search only.
    - Rollback: Delete component.
    - _Requirements: 1.1.1, 1.1.2, 1.1.4, 1.1.5, 1.1.7, 1.1.9_
  - [x] 7.6 Integrate barcode scanner into `app/components/modals/AddNutritionModal.tsx`: add barcode icon button (Ionicons `barcode-outline`) in the search bar area, right side. Tapping opens BarcodeScanner as a modal overlay. On food selected, populate the nutrition form with the scanned item's data. Hide barcode button on web.
    - Risk: AddNutritionModal is already complex. Mitigation: BarcodeScanner is a self-contained component — integration is just a button + modal toggle + callback.
    - Rollback: Remove barcode button and modal toggle.
    - _Requirements: 1.1.1_
  - [x] 7.7 Write property test in `tests/test_macro_scaling_properties.py`: Property 3 (for any food item and any positive multiplier m, scaled macros satisfy |scaled.X - base.X * m| < 0.01 for each macro). This property is shared across barcode serving adjustment, recipe scaling, and meal builder.
    - **Property 3: Macro scaling proportionality**
    - **Validates: Requirements 1.1.5, 6.1.5, 10.2.1, 10.2.2**

- [x] 8. Feature 6: Multi-Item Meal Builder ("The Plate")
  - [x] 8.1 Add `create_entries_batch(user_id, entries, meal_name)` method to `NutritionService` in `src/modules/nutrition/service.py`: atomically creates multiple NutritionEntry rows with same meal_name and entry_date. All-or-nothing — if any fails, none persist. Add `BatchEntryCreate` schema (meal_name, entry_date, entries[] with max 50 items). Add POST `/api/nutrition/entries/batch` endpoint to `src/modules/nutrition/router.py`. JWT auth required.
    - Risk: Large batch (50 items) in single transaction may be slow on SQLite. Mitigation: 50 is the hard cap. Typical meal is 3-8 items.
    - Rollback: Remove method, schema, and endpoint.
    - _Requirements: 6.1.6_
  - [x] 8.2 Create `app/components/nutrition/MealBuilder.tsx`: bottom sheet (80% height) with local `useReducer` state (NOT Zustand — transient state). Components: MealNameInput (default based on time of day: before 11am="Breakfast", 11am-2pm="Lunch", 2pm-5pm="Snack", after 5pm="Dinner"), RunningTotalsBar (sticky, shows calories|P|C|F sum), MealItemList (FlatList with MealItemRow: food name, serving multiplier adjuster min 0.1, scaled macros, remove button), AddItemButton (opens food search / barcode scanner / quick add — reuses existing components), SaveMealButton (calls batch API), SaveAsFavoriteButton (calls existing POST `/api/meals/favorites`). Running totals = Σ(item.macro * servingMultiplier) for each macro.
    - Risk: Bottom sheet may conflict with existing modal patterns. Mitigation: use `ModalContainer` wrapper (already exists in codebase) or a simple `Modal` with `animationType="slide"`.
    - Rollback: Delete component.
    - _Requirements: 6.1.1, 6.1.2, 6.1.3, 6.1.4, 6.1.5, 6.1.7, 6.1.8_
  - [x] 8.3 Wire meal builder into nutrition logging flow: in DashboardScreen and LogsScreen, change "Log Food" button to open MealBuilder instead of AddNutritionModal directly. MealBuilder's AddItemButton opens AddNutritionModal (for single item search/scan) or QuickAddModal. On "Save Meal", call POST `/api/nutrition/entries/batch`. On "Save as Favorite", call existing meals API. Keep AddNutritionModal accessible for single-item quick logging (e.g., from QuickAdd button).
    - Risk: Changing the primary logging entry point is high-risk for existing users. Mitigation: keep both paths available — MealBuilder for multi-item, existing modal for single-item quick add.
    - Rollback: Revert DashboardScreen and LogsScreen to use AddNutritionModal directly.
    - _Requirements: 6.1.6, 6.1.7_
  - [x] 8.4 Write property tests in `app/__tests__/components/MealBuilder.test.ts`: Property 14 (after adding N items, list length=N and running totals = Σ scaled macros), Property 15 (removing item at index i results in length N-1, totals decreased by removed item's macros).
    - **Property 14: Meal builder state consistency**
    - **Property 15: Meal builder item removal**
    - **Validates: Requirements 6.1.2, 6.1.3, 6.1.4**
  - [x] 8.5 Write property tests in `tests/test_meal_builder_properties.py`: Property 16 (batch save creates exactly N entries with same meal_name and entry_date), Property 17 (saving as favorite and re-logging produces entries with matching macros).
    - **Property 16: Meal builder batch save**
    - **Property 17: Favorite meal round-trip**
    - **Validates: Requirements 6.1.6, 6.1.7**

- [x] 9. **CHECKPOINT — Phase 3 Complete**
  - Run full backend test suite — all must pass.
  - Run full frontend test suite — all must pass.
  - Restart both servers.
  - Verify: barcode scan (on mobile or via manual GET `/api/food-database/barcode/5901234123457`) returns a food item or found=false.
  - Verify: meal builder opens, items can be added, running totals update, batch save creates entries.
  - Verify: barcode icon hidden on web platform.
  - If any test fails: STOP. Fix before proceeding to Phase 4.

- [x] 10. Feature 11: Deep Micronutrient Tracking — Expand Nutrients + RDA Report
  - [x] 10.1 Add missing nutrient IDs to `NUTRIENT_MAP` in `src/modules/food_database/usda_client.py`: pantothenic_acid_mg (B5, USDA ID 1170), biotin_mcg (B7, ID 1176), omega_3_g (ID 1404), omega_6_g (ID 1405). Verify existing mappings cover: vitamin_a, vitamin_c, vitamin_d, vitamin_e, vitamin_k, thiamin, riboflavin, niacin, vitamin_b6, folate, vitamin_b12, calcium, iron, zinc, magnesium, potassium, selenium, sodium, phosphorus, manganese, copper, cholesterol, fibre. Total: 27 nutrients.
    - Risk: USDA nutrient IDs may have changed. Mitigation: verify against USDA FoodData Central API docs (https://fdc.nal.usda.gov/api-guide.html).
    - Rollback: Remove added mappings.
    - _Requirements: 11.1.2_
  - [x] 10.2 Expand `MICRO_FIELDS` in `app/utils/microNutrientSerializer.ts` from 8 to 27 entries. Each entry: `{ key, label, unit, group }` where group is 'vitamins' | 'minerals' | 'fatty_acids' | 'other'. Full list: Vitamins A, C, D, E, K, B1-B12 (thiamin, riboflavin, niacin, pantothenic_acid, B6, biotin, folate, B12), Minerals (calcium, iron, zinc, magnesium, potassium, selenium, sodium, phosphorus, manganese, copper), Fatty Acids (omega_3, omega_6), Other (cholesterol, fibre). Update `serializeMicroNutrients()` to handle all 27 fields. Ensure backward compatibility — existing entries with only 8 fields still work.
    - Risk: Expanding the fields array may break existing tests that assert on field count. Mitigation: update `app/__tests__/utils/microNutrientSerializer.test.ts` to expect 27 fields.
    - Rollback: Revert to 8-field version.
    - _Requirements: 11.1.1_
  - [x] 10.3 Create `app/utils/rdaValues.ts`: export `RDA_TABLE` (Record<string, { male: Record<AgeBracket, number>, female: Record<AgeBracket, number> }>) for all 27 nutrients. Age brackets: '19-30', '31-50', '51+'. Values from NIH Office of Dietary Supplements. Export `getAgeBracket(age: number): AgeBracket`, `getRDA(key, sex, age): number`, `computeRDAPercentage(intake, rda): number` (returns 0 if rda≤0), `rdaColor(percentage): 'green'|'yellow'|'red'` (≥80=green, ≥50=yellow, <50=red).
    - Risk: RDA values must be accurate — incorrect values undermine trust. Mitigation: cross-reference NIH DRI tables, add source comments in code.
    - Rollback: Delete file.
    - _Requirements: 11.2.2, 11.2.3_
  - [x] 10.4 Write property tests in `app/__tests__/utils/rdaValues.test.ts`: Property 23 (for any nutrient key in RDA_TABLE, any sex, any age 19-99: getRDA returns ≥0, computeRDAPercentage with intake=RDA returns 100%, rdaColor(100)='green', rdaColor(50)='yellow', rdaColor(49)='red').
    - **Property 23: RDA percentage computation and color coding**
    - **Validates: Requirements 11.2.2, 11.2.3**
  - [x] 10.5 Write property tests: (a) in `app/__tests__/utils/microNutrientSerializer.test.ts` — Property 21 (MICRO_FIELDS has exactly 27 entries, each with non-empty key/label/unit/group), (b) in `tests/test_micronutrient_expansion_properties.py` — Property 22 (NUTRIENT_MAP covers all 27 keys from MICRO_FIELDS), Property 24 (for any set of nutrition entries, nutrient contribution percentages sum to 100% per nutrient).
    - **Property 21: Expanded nutrient set coverage**
    - **Property 22: USDA nutrient mapping completeness**
    - **Property 24: Nutrient contribution breakdown invariant**
    - **Validates: Requirements 11.1.1, 11.1.2, 11.2.5**
  - [x] 10.6 Create `app/screens/nutrition/NutritionReportScreen.tsx`: header with date selector (reuse DateScroller or simple date picker), grouped sections (Vitamins, Minerals, Fatty Acids, Other) using SectionList. Each nutrient row: label, horizontal progress bar (width = min(percentage, 100)%), intake value + unit, "X% of RDA" text, color-coded (green/yellow/red). Tap to expand: show top 5 contributing foods for that nutrient (computed from day's entries). Empty state: "Log food to see your nutrition report." Wire into navigation: add "Nutrition Report" button on Analytics screen and/or dashboard.
    - Risk: 27 nutrient rows may cause scroll performance issues. Mitigation: use SectionList with `getItemLayout` for fixed-height rows. Lazy-load contribution breakdowns on expand.
    - Rollback: Delete screen file.
    - _Requirements: 11.2.1, 11.2.2, 11.2.3, 11.2.5_

- [x] 11. Feature 5: Progress Photos — New Backend Module + Frontend Screen
  - [x] 11.1 Create `src/modules/progress_photos/` module with 4 files: `__init__.py`, `models.py` (ProgressPhoto with SoftDeleteMixin: user_id FK, capture_date Date, bodyweight_kg Float nullable, pose_type String(20) default 'front', notes Text nullable; index on (user_id, capture_date)), `schemas.py` (PhotoCreate: capture_date, bodyweight_kg optional, pose_type pattern ^(front|side|back)$, notes optional; PhotoResponse), `service.py` (ProgressPhotoService: create — auto-fills bodyweight_kg from latest BodyweightLog if not provided, list — ordered by capture_date ASC, get, delete — soft delete), `router.py` (POST `/api/progress-photos`, GET list with pagination + pose_type filter, GET by id, DELETE). If using Alembic: generate migration. If using create_all: restart backend.
    - Risk: New module must be registered in `src/main.py`. Mitigation: add `from src.modules.progress_photos.router import router as progress_photos_router` and `app.include_router(progress_photos_router)` in main.py.
    - Rollback: Delete module directory, remove router registration.
    - _Requirements: 5.1.2, 5.1.3, 5.1.4, 5.2.3_
  - [x] 11.2 Register progress photos router in `src/main.py`: import and include router with prefix `/api/progress-photos` and tag `progress-photos`.
    - Risk: None — additive.
    - Rollback: Remove import and include_router line.
    - _Requirements: 5.1.1_
  - [x] 11.3 Write property tests in `tests/test_progress_photo_properties.py`: Property 25 (created photo has capture_date matching input, bodyweight_kg auto-filled from latest log if not provided, pose_type in valid set), Property 26 (listing photos returns them in chronological order by capture_date).
    - **Property 25: Progress photo metadata tagging**
    - **Property 26: Progress photo chronological ordering**
    - **Validates: Requirements 5.1.3, 5.2.3**
  - [x] 11.4 Create `app/screens/profile/ProgressPhotosScreen.tsx`: grid view (2 columns) of photos sorted chronologically. Capture button: ActionSheet with "Take Photo" (expo-camera) / "Choose from Gallery" (expo-image-picker). On capture: compress to 80% JPEG, max 2048px dimension, save to `${FileSystem.documentDirectory}progress_photos/${uuid}.jpg`. POST metadata to `/api/progress-photos`. Store local mapping `{ photoId: serverUUID, fileUri: localPath }` in AsyncStorage key `progress_photo_paths`. Display: load photo from local fileUri, overlay date + weight badge. If local file missing (cleared cache): show placeholder with "Photo unavailable" text.
    - Risk: expo-image-picker and expo-camera already installed in pre-flight. expo-file-system needed for local storage. Mitigation: included in pre-flight dependency install.
    - Rollback: Delete screen file.
    - _Requirements: 5.1.1, 5.1.2, 5.1.4, 5.1.5, 5.2.3_
  - [x] 11.5 Create `app/components/photos/PhotoComparison.tsx`: side-by-side view with two date pickers (left/right). Each loads the photo for selected date from local storage. Same-scale rendering (both images use same width, maintain aspect ratio). Swipe left/right on either side to navigate to adjacent photo dates. Empty state per side: "No photo for this date."
    - Risk: Loading two full-resolution images simultaneously may cause memory pressure on low-end devices. Mitigation: use compressed versions (already 80% JPEG, max 2048px).
    - Rollback: Delete component.
    - _Requirements: 5.2.1, 5.2.2, 5.2.3_
  - [x] 11.6 Add "Progress Photos" navigation entry on Profile screen: card/button linking to `ProgressPhotosScreen`. Add screen to navigation stack.
    - Risk: None — additive UI.
    - Rollback: Remove navigation entry.
    - _Requirements: 5.1.1_

- [x] 12. **FINAL CHECKPOINT — Full Integration Verification**
  - Run full backend test suite: `/Users/manavmht/.local/share/mise/installs/python/3.12.4/bin/python -m pytest tests/ -x -q` — all must pass.
  - Run full frontend test suite: `cd app && npx jest --config jest.config.js` — all must pass.
  - Restart both servers.
  - Manual verification checklist (10 items):
    1. Food search shows source badges (green checkmark for USDA/verified items)
    2. Dashboard shows trend weight + weekly change (if ≥3 bodyweight entries)
    3. Analytics weight chart shows raw dots + EMA trend line
    4. Recipe builder: create recipe with 3 ingredients, verify per-serving macros, log 1.5 servings
    5. Weekly check-in card appears on dashboard (or shows "Log X more days" if insufficient data)
    6. Coaching mode selector works in Profile/Settings
    7. Barcode scan returns food item (test with any packaged food barcode, or via API: GET `/api/food-database/barcode/0049000006346`)
    8. Meal builder: add 3 items, verify running totals, save meal, verify 3 entries created
    9. Nutrition report shows 27 nutrients with RDA bars and color coding
    10. Progress photos: take photo, verify it appears in grid, compare two dates side-by-side
  - Verify no regressions in existing nutrition, training, bodyweight, and profile flows.

## Rollback Plan Summary

| Phase | If it fails... | Undo |
|-------|---------------|------|
| Phase 1 (F8+F4) | `git revert` commits. Remove source/barcode columns from model, restart. Delete emaTrend.ts. | No data loss — columns are additive. |
| Phase 2 (F10+F3) | `git revert` commits. Remove coaching_mode column, delete coaching_service.py, delete RecipeBuilderScreen. | Coaching suggestions table can be dropped safely (no user data yet). |
| Phase 3 (F1+F6) | `git revert` commits. Remove barcode_cache table, delete off_client.py, barcode_service.py, BarcodeScanner.tsx, MealBuilder.tsx. | Barcode cache is ephemeral — safe to drop. |
| Phase 4 (F11+F5) | `git revert` commits. Revert MICRO_FIELDS to 8 entries, delete rdaValues.ts, NutritionReportScreen, progress_photos module. | Progress photos metadata table can be dropped (no user data yet). Local photos remain on device. |

## Monitoring Post-Launch

- Track: barcode scan success rate (found=true / total scans) — alert if <60%
- Track: weekly check-in completion rate (users who see check-in card / coached users) — alert if <80%
- Track: recipe creation rate (recipes created per week per active user)
- Track: meal builder usage (batch saves per day / total nutrition entries per day)
- Track: nutrition report views per active user per week
- Track: progress photo uploads per week
- Alert: if food search latency exceeds 2s p95 (source sorting regression)
- Alert: if barcode lookup latency exceeds 8s p95 (API timeout cascade)
- Alert: if batch nutrition entry error rate exceeds 2%
- Alert: if weekly check-in error rate exceeds 5%
- Guardrail: existing nutrition entry creation rate stays flat (±5%) — new features shouldn't break existing logging

## What Was Reordered vs Original Plan

- Moved dependency install to pre-flight (was scattered across tasks)
- Moved Alembic/create_all verification to pre-flight (was implicit)
- Grouped tasks by phase with explicit dependency verification at each checkpoint
- Moved macro scaling property test (Property 3) to Feature 1 (barcode) since it's shared across features — test it once, early

## What Was Cut

- ~~Separate migration tasks~~ — consolidated into model change tasks (migration is a sub-step, not a standalone task)
- ~~Guided pose overlay SVG~~ — deferred to v2. Simple camera capture is sufficient for v1. Overlay adds complexity without blocking the core feature.

## What Was Added

- Pre-flight dependency install for ALL features (prevents mid-sprint blockers)
- Alembic vs create_all decision point in pre-flight
- Platform-specific notes (barcode hidden on web)
- Idempotency requirement for weekly check-in
- Concurrent barcode scan race condition handling
- Memory pressure mitigation for photo comparison
- Explicit rollback plan per phase
- Monitoring and alerting post-launch
