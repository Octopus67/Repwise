# Implementation Plan: Meal Prep Assistant

## Overview

Build the meal prep assistant following the dependency chain: DB migration → models → schemas → pure computation modules (with property tests) → service layer → router → frontend screens. Each layer is tested before the next begins.

## Tasks

- [ ] 1. Database migration and SQLAlchemy models
  - [ ] 1.1 Create Alembic migration for `meal_plans` and `meal_plan_items` tables
    - Create migration file with the SQL schema from the design document
    - Include indexes: `ix_meal_plans_user_id`, `ix_meal_plan_items_plan_id`
    - Include `deleted_at` column on `meal_plans` for soft-delete
    - _Requirements: 5.1_
  - [ ] 1.2 Create `src/modules/meal_plans/models.py` with `MealPlan` and `MealPlanItem` SQLAlchemy models
    - Follow existing patterns from `src/modules/meals/models.py`
    - `MealPlan` extends `SoftDeleteMixin, Base` with fields: `user_id`, `name`, `start_date`, `num_days`, `slot_splits` (JSONB), `weekly_calories`, `weekly_protein_g`, `weekly_carbs_g`, `weekly_fat_g`
    - `MealPlanItem` extends `Base` with fields: `plan_id`, `day_index`, `slot`, `food_item_id`, `scale_factor`, `calories`, `protein_g`, `carbs_g`, `fat_g`
    - Add `items` relationship on `MealPlan` with `selectin` loading and `cascade="all, delete-orphan"`
    - _Requirements: 5.1, 5.5_
  - [ ] 1.3 Create `src/modules/meal_plans/__init__.py`
    - Empty init file for the module
    - _Requirements: 5.1_

- [ ] 2. Pydantic schemas
  - [ ] 2.1 Create `src/modules/meal_plans/schemas.py`
    - `GeneratePlanRequest`: `slot_splits: dict[str, float] | None = None`, `num_days: int = Field(default=5, ge=1, le=7)`
    - `SavePlanRequest`: `name: str = Field(min_length=1, max_length=255)`, `days: list[DayPlanPayload]`
    - `DayPlanPayload`: `day_index: int`, `assignments: list[MealAssignmentPayload]`
    - `MealAssignmentPayload`: `slot: str`, `food_item_id: uuid.UUID`, `scale_factor: float = 1.0`, `calories: float`, `protein_g: float`, `carbs_g: float`, `fat_g: float`
    - `DuplicatePlanRequest`: `new_start_date: date`
    - `ScaleRecipeRequest`: `recipe_id: uuid.UUID`, `target_value: float = Field(gt=0)`, `target_macro: Literal["calories", "protein_g", "carbs_g", "fat_g"] = "calories"`
    - Response schemas: `MealPlanResponse`, `MealPlanItemResponse`, `MacroSummaryResponse`, `ShoppingItemResponse`, `ShoppingListResponse`, `ScaledRecipeResponse`, `ScaledIngredientResponse`, `GeneratedPlanResponse`
    - Follow patterns from `src/modules/meals/schemas.py`
    - _Requirements: 1.6, 2.3, 2.5, 3.1, 3.6, 5.1_

- [ ] 3. Checkpoint — Verify foundation
  - Ensure migration runs cleanly, models import without errors, schemas validate correctly. Ask the user if questions arise.

- [ ] 4. Pure computation: Recipe Scaler
  - [ ] 4.1 Create `src/modules/meal_plans/scaler.py`
    - Implement `IngredientInput`, `ScaledIngredient`, `ScaledRecipe` frozen dataclasses
    - Implement `compute_scale_factor(original_value, target_value)` — raises `ValueError` if original <= 0
    - Implement `scale_recipe(recipe_id, recipe_calories, recipe_protein_g, recipe_carbs_g, recipe_fat_g, ingredients, target_value, target_macro)` — computes factor from the specified macro, multiplies all quantities and macros by factor, returns new `ScaledRecipe`
    - No DB imports, no side effects
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [ ]* 4.2 Write property tests for Recipe Scaler
    - Create `tests/test_recipe_scaler_properties.py`
    - **Property 5: Scaling factor computation** — For any recipe with non-zero target macro and any positive target value, `compute_scale_factor` returns `target / original`
    - **Validates: Requirements 3.1, 3.4**
    - **Property 6: Scaling proportionality** — For any recipe and positive factor, all scaled quantities equal `original * factor` and all scaled macros equal `original_macro * factor`
    - **Validates: Requirements 3.2, 3.3**
    - **Property 7: Scaling immutability** — For any scaling operation, original `IngredientInput` list and macro values are unchanged after `scale_recipe` returns
    - **Validates: Requirements 3.6**
    - Use Hypothesis with `@settings(max_examples=100)`
    - Tag: `Feature: meal-prep-assistant, Property 5/6/7`
  - [ ]* 4.3 Write unit tests for Recipe Scaler edge cases
    - Test zero-calorie recipe raises `ValueError`
    - Test zero-protein recipe with `target_macro="protein_g"` raises `ValueError`
    - Test scaling 400 cal recipe to 500 cal → factor 1.25, all macros × 1.25
    - Test single-ingredient recipe
    - _Requirements: 3.5_

- [ ] 5. Pure computation: Shopping List Engine
  - [ ] 5.1 Create `src/modules/meal_plans/shopping.py`
    - Implement `IngredientEntry`, `ShoppingItem`, `ShoppingList` frozen dataclasses
    - Implement `VALID_CATEGORIES`, `UNIT_CONVERSIONS`, `CATEGORY_MAP` constants
    - Implement `resolve_category(food_category)` — maps food category to shopping category via keyword matching, defaults to "other"
    - Implement `normalize_unit(quantity, unit, target_unit)` — converts using `UNIT_CONVERSIONS`, returns `None` if no conversion
    - Implement `consolidate_ingredients(all_ingredients)` — groups by name, combines same-unit items by summing quantity, attempts unit conversion for different-unit items, assigns category via `resolve_category`
    - No DB imports, no side effects
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 5.2 Write property tests for Shopping List Engine
    - Create `tests/test_shopping_list_properties.py`
    - **Property 8: Ingredient consolidation preserves totals** — For any list of ingredients with the same name and unit, the consolidated total quantity equals the sum of individual quantities
    - **Validates: Requirements 2.1, 2.2**
    - **Property 9: Shopping list structural invariants** — For any shopping list output, every item has non-empty name, quantity > 0, non-empty unit, and category in VALID_CATEGORIES
    - **Validates: Requirements 2.3, 2.5**
    - Use Hypothesis with `@settings(max_examples=100)`
    - Tag: `Feature: meal-prep-assistant, Property 8/9`
  - [ ]* 5.3 Write unit tests for Shopping List edge cases
    - Test empty ingredient list → empty shopping list
    - Test single ingredient → single item
    - Test two ingredients same name same unit → combined quantity
    - Test two ingredients same name different convertible units → combined in common unit
    - Test two ingredients same name unconvertible units → kept separate
    - _Requirements: 2.4_

- [ ] 6. Pure computation: Meal Plan Generator
  - [ ] 6.1 Create `src/modules/meal_plans/generator.py`
    - Implement `MacroSummary`, `MealSlotTarget`, `FoodCandidate`, `MealAssignment`, `DayPlan`, `GeneratedPlan` frozen dataclasses
    - Implement `DEFAULT_SLOT_SPLITS` constant
    - Implement `distribute_macros(daily_targets, slot_splits)` — validates splits sum to ~1.0 (tolerance 0.01), multiplies each macro by split percentage
    - Implement `compute_day_summary(assignments)` — sums all assignment macros
    - Implement `compute_weekly_summary(day_summaries)` — sums all daily summaries
    - Implement `generate_plan(daily_targets, candidates, slot_splits, num_days, tolerance)` — greedy assignment: sort candidates by `source_priority`, for each day/slot find closest candidate, scale if needed, mark unfilled if no match
    - No DB imports, no side effects
    - _Requirements: 1.2, 1.4, 1.5, 1.6, 4.6, 6.1, 6.2, 6.3_
  - [ ]* 6.2 Write property tests for Meal Plan Generator
    - Create `tests/test_meal_plan_generator_properties.py`
    - **Property 1: Macro distribution conservation** — For any valid daily targets and splits summing to 1.0, sum of all slot targets equals daily targets (tolerance 0.01)
    - **Validates: Requirements 1.2**
    - **Property 2: Daily macro summary equals sum of assignments** — For any list of MealAssignments, `compute_day_summary` returns the sum of each macro field
    - **Validates: Requirements 1.6, 6.1, 6.2**
    - **Property 3: Weekly macro summary equals sum of daily summaries** — For any list of MacroSummary, `compute_weekly_summary` returns the sum of each macro field
    - **Validates: Requirements 6.3**
    - **Property 10: Auto-fill priority ordering** — For any candidate pool with mixed source_priority values, `generate_plan` assigns lower-priority-number candidates first when multiple candidates are equally close to the slot target
    - **Validates: Requirements 4.6**
    - Use Hypothesis with `@settings(max_examples=100)`
    - Tag: `Feature: meal-prep-assistant, Property 1/2/3/10`
  - [ ]* 6.3 Write unit tests for Generator edge cases
    - Test empty candidate pool → all slots unfilled
    - Test single candidate, single day, single slot → assigned
    - Test splits not summing to 1.0 → ValueError
    - Test tolerance boundary: candidate at exactly 5% deviation → accepted
    - _Requirements: 1.4, 1.5_

- [ ] 7. Checkpoint — Verify all pure computation modules
  - Run all property tests and unit tests for scaler, shopping, and generator. All must pass. Ask the user if questions arise.

- [ ] 8. Service layer
  - [ ] 8.1 Create `src/modules/meal_plans/service.py` with `MealPlanService`
    - `generate_plan(user_id, slot_splits, num_days)`: fetch latest adaptive snapshot via existing `adaptive/service.py`, fetch candidates from `meals/service.py` (favorites priority 0, recent priority 1) and `food_database/service.py` (priority 2), call `generator.generate_plan()`. Raise `NotFoundError` if no snapshot.
    - `save_plan(user_id, plan, name)`: create `MealPlan` row + `MealPlanItem` rows from `GeneratedPlan`. Compute weekly summary and store on plan.
    - `get_plan(user_id, plan_id)`: load plan with items, scope to user, raise `NotFoundError` if missing.
    - `list_plans(user_id, pagination)`: query `MealPlan` filtered by user, ordered by `created_at` DESC, paginated.
    - `duplicate_plan(user_id, plan_id, new_start_date)`: load existing plan, create new `MealPlan` with same items but new `start_date` and new ID.
    - `delete_plan(user_id, plan_id)`: soft-delete via `SoftDeleteMixin` pattern.
    - `scale_recipe(recipe_id, target_value, target_macro)`: load recipe + ingredients from `food_database/service.py`, call `scaler.scale_recipe()`.
    - `get_shopping_list(user_id, plan_id)`: load plan items, for each item that is a recipe resolve its ingredients from food_database, build `IngredientEntry` list, call `shopping.consolidate_ingredients()`.
    - _Requirements: 1.1, 1.3, 2.1, 3.1, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 8.2 Write property tests for service-level properties
    - Create `tests/test_meal_plan_service_properties.py`
    - **Property 11: Plan history ordering** — For any user with multiple saved plans, `list_plans` returns them sorted by `created_at` descending
    - **Validates: Requirements 5.2**
    - **Property 12: Plan duplication preserves assignments** — For any saved plan, `duplicate_plan` produces a new plan with different ID/date but identical item assignments
    - **Validates: Requirements 5.4**
    - **Property 13: Meal plan serialization round-trip** — For any valid MealPlan, serializing to Pydantic response and back produces equivalent data
    - **Validates: Requirements 5.1, 5.3, 7.1, 7.2, 7.3**
    - Use Hypothesis with `@settings(max_examples=100)` and async test fixtures
    - Tag: `Feature: meal-prep-assistant, Property 11/12/13`
  - [ ]* 8.3 Write unit tests for service error paths
    - Test `generate_plan` with no adaptive snapshot → `NotFoundError`
    - Test `get_plan` with non-existent plan → `NotFoundError`
    - Test `delete_plan` sets `deleted_at`, plan excluded from `list_plans`
    - Test `scale_recipe` with non-existent recipe → `NotFoundError`
    - _Requirements: 1.1, 5.5_

- [ ] 9. API Router
  - [ ] 9.1 Create `src/modules/meal_plans/router.py`
    - Implement all 8 endpoints from the design document
    - Use `authorize` dependency for auth on all endpoints
    - Inject `MealPlanService` via `AsyncSession` dependency
    - Wire request schemas to service methods, return response schemas
    - Handle `ValueError` from scaler/generator as 400 responses
    - Handle `NotFoundError` as 404 responses
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 9.2 Register router in `src/main.py`
    - Add `from src.modules.meal_plans.router import router as meal_plans_router`
    - Add `app.include_router(meal_plans_router)`
    - _Requirements: 1.1_

- [ ] 10. Checkpoint — Verify full backend
  - Run all tests (property + unit) for the meal_plans module. Verify router registration. Ask the user if questions arise.

- [ ] 11. Frontend utility logic
  - [ ] 11.1 Create `app/utils/mealPrepLogic.ts`
    - `computeScaleFactor(original: number, target: number): number` — throws if original <= 0
    - `scaleIngredients(ingredients: Ingredient[], factor: number): ScaledIngredient[]`
    - `computeDaySummary(assignments: MealAssignment[]): MacroSummary`
    - `computeWeeklySummary(daySummaries: MacroSummary[]): MacroSummary`
    - Define TypeScript interfaces: `MacroSummary`, `MealAssignment`, `Ingredient`, `ScaledIngredient`
    - _Requirements: 3.1, 3.2, 6.1, 6.3_
  - [ ]* 11.2 Write unit tests for `mealPrepLogic.ts`
    - Create `app/__tests__/utils/mealPrepLogic.test.ts`
    - Test `computeScaleFactor` with known values and zero-value error
    - Test `scaleIngredients` proportionality
    - Test `computeDaySummary` sums correctly
    - Test `computeWeeklySummary` sums correctly
    - _Requirements: 3.1, 6.1, 6.3_

- [ ] 12. Frontend screens
  - [ ] 12.1 Create `app/screens/meal-prep/MealPlanScreen.tsx`
    - Day-by-day card layout using existing `Card` component
    - Each day card shows meal slots with item name, calories, and macro badges
    - Per-day macro summary row at bottom of each card
    - Weekly summary header with macro rings (reuse `MacroRingsRow`)
    - Actions: "Generate Plan" button calls POST `/api/meal-plans/generate`, "Save Plan" calls POST `/api/meal-plans/save`, "Shopping List" navigates to ShoppingListView
    - Loading and error states
    - _Requirements: 1.6, 5.1_
  - [ ] 12.2 Create `app/screens/meal-prep/ShoppingListView.tsx`
    - Collapsible sections grouped by category (produce, protein, dairy, grains, pantry, other)
    - Each item shows name, quantity, unit
    - Local checkbox state for marking purchased (not persisted)
    - Fetches from GET `/api/meal-plans/{plan_id}/shopping-list`
    - _Requirements: 2.3, 2.5_
  - [ ] 12.3 Create `app/components/meal-prep/RecipeScalingModal.tsx`
    - Modal with target value input and macro type selector
    - Real-time preview using `mealPrepLogic.ts` functions
    - Confirm button calls POST `/api/meal-plans/scale-recipe`
    - Shows original vs scaled macros side-by-side
    - Uses existing `ModalContainer` component
    - _Requirements: 3.1, 3.2, 3.3, 3.6_
  - [ ] 12.4 Create `app/screens/meal-prep/PrepSundayFlow.tsx`
    - Multi-step flow with 5 steps: day selection → slot config → auto-fill → macro review → confirm
    - Step 1: Checkbox list of days (default Mon-Fri)
    - Step 2: Slot count per day (default 4: breakfast, lunch, dinner, snack)
    - Step 3: Auto-filled slots from favorites/recent, tap to swap
    - Step 4: Per-day macro bars + weekly totals vs targets using `mealPrepLogic.ts`
    - Step 5: Confirm → calls save + shopping list generation
    - Back/forward navigation between steps
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 13. Navigation wiring
  - [ ] 13.1 Add MealPlanScreen to navigation
    - Add meal prep tab or entry point in `app/navigation/BottomTabNavigator.tsx` or as a sub-screen accessible from the nutrition section
    - Add navigation types for all new screens
    - _Requirements: 4.1_

- [ ] 14. Final checkpoint — Full integration verification
  - Run all backend property tests and unit tests. Run all frontend tests. Verify navigation works. Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 3, 7, 10, and 14 ensure incremental validation
- Pure computation modules (tasks 4-6) have zero DB dependencies and can be tested in isolation
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- Rollback: remove `src/modules/meal_plans/`, its router registration in `main.py`, frontend screens, and run `alembic downgrade -1`
