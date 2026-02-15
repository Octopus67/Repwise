# Requirements Document

## Introduction

The Meal Prep Assistant enables users to generate weekly meal prep plans based on their adaptive macro targets, consolidate ingredients into a shopping list, scale recipes to hit exact macro targets, and plan an entire week of meals in a single guided session ("Prep Sunday" mode). The feature integrates with the existing adaptive TDEE engine, recipe builder, and food database.

## Glossary

- **Meal_Plan_Generator**: The backend service that creates 5-day meal plans from macro targets, recipes, and food items
- **Shopping_List_Engine**: The component that consolidates and groups ingredients from a meal plan into a categorized shopping list
- **Recipe_Scaler**: The component that proportionally adjusts all ingredient quantities in a recipe to hit a specific calorie or macro target
- **Prep_Sunday_Flow**: The guided frontend flow for planning a full week of meals in one session
- **Meal_Slot**: A named position in a day's plan (breakfast, lunch, dinner, snack)
- **Macro_Targets**: The user's daily calorie, protein, carb, and fat targets from the adaptive engine
- **Meal_Plan**: A saved collection of meal slot assignments across multiple days
- **Ingredient_Category**: A grouping label for shopping list items (produce, protein, dairy, grains, pantry, other)

## Requirements

### Requirement 1: Weekly Meal Plan Generation

**User Story:** As a user, I want to generate a 5-day meal plan based on my weekly macro targets, so that I can plan my nutrition in advance without manual calculation.

#### Acceptance Criteria

1. WHEN a user requests a meal plan, THE Meal_Plan_Generator SHALL retrieve the user's current Macro_Targets from the adaptive engine
2. WHEN generating a meal plan, THE Meal_Plan_Generator SHALL distribute daily Macro_Targets across Meal_Slots (breakfast, lunch, dinner, snack) using configurable percentage splits
3. WHEN assigning meals to Meal_Slots, THE Meal_Plan_Generator SHALL select recipes and food items from the user's favorites, recent entries, and the food database
4. WHEN a meal plan is generated, THE Meal_Plan_Generator SHALL produce a plan where each day's total macros are within 5% of the daily Macro_Targets
5. IF the Meal_Plan_Generator cannot find recipes or food items to satisfy a Meal_Slot within tolerance, THEN THE Meal_Plan_Generator SHALL mark that slot as unfilled and include a reason
6. WHEN a meal plan is generated, THE Meal_Plan_Generator SHALL return the plan with per-slot and per-day macro summaries

### Requirement 2: Shopping List Consolidation

**User Story:** As a user, I want a consolidated shopping list from my meal plan, so that I can buy exactly what I need for the week.

#### Acceptance Criteria

1. WHEN a shopping list is requested for a Meal_Plan, THE Shopping_List_Engine SHALL aggregate all ingredients across all days and Meal_Slots
2. WHEN aggregating ingredients, THE Shopping_List_Engine SHALL combine identical ingredients by summing their quantities
3. WHEN presenting the shopping list, THE Shopping_List_Engine SHALL group items by Ingredient_Category (produce, protein, dairy, grains, pantry, other)
4. WHEN an ingredient appears in multiple recipes with different units, THE Shopping_List_Engine SHALL convert to a common unit before summing
5. THE Shopping_List_Engine SHALL display each item with its total quantity and unit

### Requirement 3: Recipe Scaling

**User Story:** As a user, I want to scale a recipe to hit a specific calorie or macro target, so that I can fit any recipe into my meal plan.

#### Acceptance Criteria

1. WHEN a user requests scaling a recipe to a target calorie value, THE Recipe_Scaler SHALL compute a scaling factor as target_calories divided by original_calories
2. WHEN a scaling factor is computed, THE Recipe_Scaler SHALL multiply all ingredient quantities by that factor
3. WHEN a recipe is scaled, THE Recipe_Scaler SHALL recalculate all macro values (protein, carbs, fat) proportionally
4. IF a user requests scaling to a specific macro target (protein, carbs, or fat), THEN THE Recipe_Scaler SHALL compute the scaling factor from that macro instead of calories
5. IF the original recipe has zero calories or zero of the target macro, THEN THE Recipe_Scaler SHALL return an error indicating the recipe cannot be scaled
6. THE Recipe_Scaler SHALL preserve the original recipe and return the scaled version as a separate object

### Requirement 4: Prep Sunday Mode

**User Story:** As a user, I want a guided flow to plan my entire week of meals in one session, so that I can efficiently batch-plan my nutrition.

#### Acceptance Criteria

1. WHEN a user starts Prep Sunday mode, THE Prep_Sunday_Flow SHALL present a day selection step where the user picks which days to plan (default: Monday through Friday)
2. WHEN days are selected, THE Prep_Sunday_Flow SHALL present a meal slot configuration step where the user chooses how many Meal_Slots per day
3. WHEN configuring Meal_Slots, THE Prep_Sunday_Flow SHALL auto-fill slots from the user's favorites and recent meals
4. WHEN all slots are configured, THE Prep_Sunday_Flow SHALL display a macro review screen showing per-day and weekly macro totals compared to Macro_Targets
5. WHEN the user confirms the plan, THE Prep_Sunday_Flow SHALL save the Meal_Plan and generate the shopping list
6. WHEN auto-filling slots, THE Prep_Sunday_Flow SHALL prioritize favorites first, then recent meals, then food database items

### Requirement 5: Meal Plan Persistence

**User Story:** As a user, I want to save and reuse my meal plans, so that I can repeat plans that worked well.

#### Acceptance Criteria

1. WHEN a user saves a Meal_Plan, THE system SHALL persist the plan with a name, creation date, and all Meal_Slot assignments
2. WHEN a user views plan history, THE system SHALL return saved plans ordered by creation date descending
3. WHEN a user selects a saved Meal_Plan, THE system SHALL load the full plan with all slot assignments and macro summaries
4. WHEN a user duplicates a saved Meal_Plan, THE system SHALL create a new plan with the same slot assignments but a new date range
5. WHEN a user deletes a saved Meal_Plan, THE system SHALL soft-delete the plan so it can be recovered

### Requirement 6: Macro Distribution Accuracy

**User Story:** As a user, I want my meal plan to accurately reflect my macro targets, so that I can trust the plan supports my fitness goals.

#### Acceptance Criteria

1. THE Meal_Plan_Generator SHALL compute daily macro totals by summing the macros of all items assigned to that day's Meal_Slots
2. WHEN computing macro totals for scaled recipes, THE Meal_Plan_Generator SHALL use the scaled macro values
3. THE Meal_Plan_Generator SHALL compute weekly macro totals by summing all daily totals across the plan

### Requirement 7: Data Serialization

**User Story:** As a developer, I want meal plan data to be reliably serialized and deserialized, so that plans are stored and retrieved without data loss.

#### Acceptance Criteria

1. WHEN a Meal_Plan is saved, THE system SHALL serialize the plan to JSON for storage
2. WHEN a Meal_Plan is loaded, THE system SHALL deserialize the JSON back into a Meal_Plan object
3. FOR ALL valid Meal_Plan objects, serializing then deserializing SHALL produce an equivalent object (round-trip property)
