# Requirements Document

## Introduction

HypertrophyOS is experiencing user churn because new users land on an empty dashboard after registration with no guidance, nutrition logging requires tedious manual macro entry, there is no way to save and reuse meals, and training sessions only support logging one exercise at a time. This spec covers four Tier 1 retention features: an onboarding wizard, food search in nutrition logging, meal templates/favorites, and multi-exercise training program templates. The backend already has most of the data models and endpoints in place; the primary work is frontend screens, integration wiring, and a new onboarding orchestration endpoint.

## Glossary

- **Onboarding_Flow**: A multi-step setup wizard presented to newly registered users who have no profile, goals, or adaptive snapshot
- **Adaptive_Engine**: The pure computation module at `src/modules/adaptive/engine.py` that calculates caloric and macro targets from user metrics, goals, and bodyweight history
- **Adaptive_Snapshot**: A persisted record of computed caloric/macro targets stored in the `adaptive_snapshots` table
- **Food_Search**: A searchable food picker component that queries the existing `GET /api/v1/food/search` endpoint
- **Nutrition_Modal**: The bottom-sheet modal used to log daily nutrition entries (`AddNutritionModal.tsx`)
- **Meal_Favorite**: A saved nutrition entry snapshot in the `meal_favorites` table for quick one-tap reuse
- **Custom_Meal**: A user-created reusable meal definition stored in the `custom_meals` table
- **Training_Session**: A single workout session containing one or more exercises, stored in the `training_sessions` table with JSONB exercises array
- **Workout_Template**: A pre-built or user-saved collection of exercises that can be loaded into a new training session
- **Dashboard_Screen**: The main screen shown after authentication at `app/screens/dashboard/DashboardScreen.tsx`
- **Zustand_Store**: The global client state store at `app/store/index.ts`
- **Goal_Type**: One of `cutting`, `maintaining`, or `bulking` as defined in `src/shared/types.py`
- **Activity_Level**: One of `sedentary`, `light`, `moderate`, `active`, or `very_active`
- **Serving_Multiplier**: A numeric factor applied to a food item's base serving size to scale its macro values

## Requirements

### Requirement 1: Onboarding Detection and Routing

**User Story:** As a newly registered user, I want to be automatically guided through a setup wizard, so that I have personalized targets from my first session.

#### Acceptance Criteria

1. WHEN a user authenticates and has no UserGoal record, THE Onboarding_Flow SHALL be displayed instead of the Dashboard_Screen
2. WHEN a user authenticates and has an existing UserGoal record, THE Dashboard_Screen SHALL be displayed directly
3. WHEN the Onboarding_Flow is completed, THE Onboarding_Flow SHALL navigate the user to the Dashboard_Screen
4. IF the user force-closes the app during onboarding, THEN THE Onboarding_Flow SHALL resume from the last completed step on next launch
5. WHEN the user taps "Skip for now" during onboarding, THE Onboarding_Flow SHALL navigate to the Dashboard_Screen without persisting any onboarding data
6. WHILE the user has not completed onboarding, THE Dashboard_Screen SHALL display a persistent banner prompting the user to complete setup

### Requirement 2: Onboarding Goal Selection

**User Story:** As a new user, I want to select my fitness goal (bulk, cut, or maintain), so that the system can tailor my caloric targets.

#### Acceptance Criteria

1. WHEN the Onboarding_Flow reaches the goal step, THE Onboarding_Flow SHALL display three selectable options: bulking, cutting, and maintaining
2. WHEN the user selects a Goal_Type, THE Onboarding_Flow SHALL visually highlight the selected option and enable the next-step button
3. WHEN the user has not selected a Goal_Type, THE Onboarding_Flow SHALL keep the next-step button disabled

### Requirement 3: Onboarding Body Stats Input

**User Story:** As a new user, I want to enter my body measurements and activity level, so that the system can calculate accurate caloric targets.

#### Acceptance Criteria

1. WHEN the Onboarding_Flow reaches the body stats step, THE Onboarding_Flow SHALL display input fields for height (cm), weight (kg), body fat percentage, age, sex, and Activity_Level
2. WHEN the user submits body stats, THE Onboarding_Flow SHALL validate that height is between 100 and 250 cm, weight is between 30 and 300 kg, body fat percentage is between 3 and 60 (or omitted), age is between 13 and 120, and sex is one of "male" or "female"
3. IF the user enters values outside the valid ranges, THEN THE Onboarding_Flow SHALL display field-level validation errors and prevent progression
4. WHEN the user selects an Activity_Level, THE Onboarding_Flow SHALL accept only one of: sedentary, light, moderate, active, or very_active
5. WHEN valid body stats are submitted, THE Onboarding_Flow SHALL persist a UserMetric record via `POST /api/v1/user/metrics` and a UserGoal record via `PUT /api/v1/user/goals`

### Requirement 4: Onboarding Target Calculation

**User Story:** As a new user, I want to see my personalized caloric and macro targets after entering my stats, so that I understand my daily nutrition plan.

#### Acceptance Criteria

1. WHEN body stats and goal are submitted, THE Onboarding_Flow SHALL call the backend onboarding endpoint to generate an Adaptive_Snapshot
2. WHEN the Adaptive_Snapshot is returned, THE Onboarding_Flow SHALL display the computed target calories, protein (g), carbs (g), and fat (g)
3. WHEN the user confirms the targets, THE Onboarding_Flow SHALL mark onboarding as complete and navigate to the Dashboard_Screen
4. THE backend onboarding endpoint SHALL persist the UserMetric, UserGoal, UserProfile, and Adaptive_Snapshot in a single atomic transaction

### Requirement 5: Food Search in Nutrition Logging

**User Story:** As a user logging nutrition, I want to search for foods from the database and auto-fill macros, so that I can log meals quickly without manual entry.

#### Acceptance Criteria

1. WHEN the Nutrition_Modal is opened, THE Nutrition_Modal SHALL display a search input field for querying the food database
2. WHEN the user types at least 2 characters in the search field, THE Nutrition_Modal SHALL query `GET /api/v1/food/search?q=<query>` and display matching results with name, calories, and protein per serving
3. WHEN the user selects a food item from search results, THE Nutrition_Modal SHALL auto-fill the calories, protein, carbs, and fat fields based on the item's per-serving values
4. WHEN a food item is selected, THE Nutrition_Modal SHALL display a Serving_Multiplier input defaulting to 1.0
5. WHEN the user changes the Serving_Multiplier, THE Nutrition_Modal SHALL recalculate all macro fields by multiplying the base per-serving values by the Serving_Multiplier
6. WHEN the user clears the search field, THE Nutrition_Modal SHALL hide search results and allow manual macro entry as before
7. IF the food search API returns an error, THEN THE Nutrition_Modal SHALL display an error message and allow the user to continue with manual entry
8. WHEN the user sets the Serving_Multiplier, THE Nutrition_Modal SHALL validate that the value is greater than 0 and at most 20

### Requirement 6: Meal Favorites

**User Story:** As a user, I want to save nutrition entries as favorites and log them with one tap, so that I can quickly re-log meals I eat regularly.

#### Acceptance Criteria

1. WHEN a nutrition entry is successfully logged, THE Nutrition_Modal SHALL offer an option to save the entry as a Meal_Favorite
2. WHEN the user saves a Meal_Favorite, THE Nutrition_Modal SHALL call `POST /api/v1/meals/favorites` with the nutritional snapshot data
3. WHEN the Nutrition_Modal is opened, THE Nutrition_Modal SHALL display a favorites section showing the user's saved Meal_Favorite records fetched from `GET /api/v1/meals/favorites`
4. WHEN the user taps a Meal_Favorite, THE Nutrition_Modal SHALL auto-fill all macro fields from the favorite's stored nutritional snapshot
5. WHEN the user long-presses a Meal_Favorite, THE Nutrition_Modal SHALL offer an option to remove the favorite via `DELETE /api/v1/meals/favorites/{id}`
6. THE Nutrition_Modal SHALL display a maximum of 50 Meal_Favorite records, ordered by most recently created first

### Requirement 7: Multi-Exercise Training Sessions

**User Story:** As a user logging training, I want to add multiple exercises to a single session, so that I can log a complete workout in one go.

#### Acceptance Criteria

1. WHEN the training modal is opened, THE training modal SHALL display an exercise list that supports adding multiple exercises
2. WHEN the user adds an exercise, THE training modal SHALL append a new exercise entry with fields for exercise name, and a dynamic list of sets (reps, weight, RPE)
3. WHEN the user adds a set to an exercise, THE training modal SHALL append a new set row with reps, weight (kg), and optional RPE fields
4. WHEN the user submits the session, THE training modal SHALL send all exercises and their sets in a single `POST /api/v1/training/sessions` request matching the existing ExerciseEntry schema
5. IF the user submits a session with zero exercises, THEN THE training modal SHALL display a validation error and prevent submission
6. WHEN the user removes an exercise from the list, THE training modal SHALL remove the exercise and re-index the remaining exercises
7. WHEN the user adds a set, THE training modal SHALL pre-fill the reps and weight fields with the values from the previous set in that exercise for convenience

### Requirement 8: Workout Templates

**User Story:** As a user, I want to start a training session from a pre-built template or copy a previous workout, so that I can save time setting up my exercises.

#### Acceptance Criteria

1. WHEN the training modal is opened, THE training modal SHALL display a template picker with pre-built workout templates (Push, Pull, Legs, Upper Body, Lower Body, Full Body)
2. WHEN the user selects a Workout_Template, THE training modal SHALL populate the exercise list with the template's exercises and default set configurations
3. WHEN the training modal is opened, THE training modal SHALL offer a "Copy Last Workout" option that loads the user's most recent Training_Session
4. WHEN the user selects "Copy Last Workout", THE training modal SHALL fetch the latest session from `GET /api/v1/training/sessions?limit=1` and populate the exercise list with its exercises and sets
5. WHEN a template or previous workout is loaded, THE training modal SHALL allow the user to modify exercises and sets before submitting
6. THE backend SHALL expose a `GET /api/v1/training/templates` endpoint that returns the list of pre-built Workout_Template definitions

### Requirement 9: Backend Onboarding Orchestration

**User Story:** As a developer, I want a single backend endpoint that orchestrates the entire onboarding flow, so that the frontend can complete onboarding in one API call with transactional safety.

#### Acceptance Criteria

1. THE backend SHALL expose a `POST /api/v1/onboarding/complete` endpoint that accepts goal type, body stats (height, weight, body fat, age, sex, activity level), and goal rate per week
2. WHEN the onboarding endpoint is called, THE backend SHALL create or update the UserProfile, persist a UserMetric snapshot, set the UserGoal, and generate an Adaptive_Snapshot in a single database transaction
3. WHEN the onboarding endpoint is called, THE backend SHALL invoke the Adaptive_Engine with the provided body stats and a single-entry bodyweight history derived from the submitted weight
4. IF any step in the onboarding transaction fails, THEN THE backend SHALL roll back all changes and return an error response
5. WHEN the onboarding endpoint is called for a user who already has a UserGoal, THE backend SHALL return a conflict error indicating onboarding is already complete
6. THE onboarding endpoint SHALL validate all input fields using the same constraints as the existing UserMetricCreate and UserGoalSet schemas
