# Requirements Document

## Introduction

This spec addresses critical bug fixes and feature enhancements for HypertrophyOS. The core user problem: "I logged my workout and nutrition but nothing saved — now I don't trust the app with my data." Broken save flows destroy retention overnight. We fix those first, then layer on nutrition depth (micronutrients, water, fibre, meal plans) and UX polish (unit toggle, profile editability, rest timer placement).

**What we're NOT building (v1 scope):**
- Barcode scanning for food items
- AI-powered meal suggestions
- Social sharing of meal plans
- Nutrition goal setting / calorie targets
- Photo-based food logging
- Syncing with external nutrition apps (MyFitnessPal, etc.)

**Rollout strategy:** Bug fixes (Req 1-3) ship immediately behind no flag. New features (Req 4-8) ship behind a `nutrition_v2` feature flag with staged rollout. Existing nutrition entries remain fully readable regardless of flag state.

**Backward compatibility:** All new fields (`micro_nutrients`, `fibre_g`, `water_ml`) are optional on the backend. Users on older app versions continue to log macros-only entries without breakage. The `micro_nutrients` JSONB column already exists — no migration needed for core tracking.

## Glossary

- **Training_Modal**: The `AddTrainingModal` component for logging training sessions with exercises, sets, reps, and weights.
- **Nutrition_Modal**: The `AddNutritionModal` component for logging nutrition entries with macros and optional food search.
- **Bodyweight_Modal**: The `AddBodyweightModal` component for logging bodyweight.
- **Food_Search**: The debounced search feature within the Nutrition_Modal querying the food database API.
- **Profile_Screen**: The `ProfileScreen` component displaying user info, preferences, subscription, and account settings.
- **Rest_Timer**: The countdown timer overlay component shown between sets during training.
- **Unit_System**: The user preference stored in the Zustand store indicating metric (kg/cm) or imperial (lbs/ft) measurement units.
- **Nutrition_Entry**: A backend record containing date, macros (calories, protein, carbs, fat), optional micronutrients, and metadata.
- **Custom_Meal_Plan**: A user-created collection of multiple food items with aggregate nutritional data that can be saved, edited, and reused.
- **Meal_Favorite**: A saved nutritional snapshot that can be quickly re-logged.
- **Micronutrient**: Vitamins and minerals tracked as key-value pairs (e.g., vitamin_a_mcg, iron_mg).
- **Water_Intake**: Daily water consumption tracked in millilitres or glasses (1 glass = 250ml).
- **Fibre_Intake**: Daily dietary fibre tracked in grams as part of a nutrition entry.
- **API_Service**: The Axios-based HTTP client (`app/services/api.ts`) communicating with the FastAPI backend.
- **Conversion_Factor**: The constant 2.20462 used to convert between kg and lbs.

## Requirements

### Requirement 1: Fix Training Session Save

**User Story:** As a user, I want to save my training session without the screen going blank, so that my workout data is reliably persisted and I trust the app with my training log.

#### Acceptance Criteria

1. WHEN a user fills in valid exercise data and taps "Save Session", THE Training_Modal SHALL post the session to the backend and close the modal upon success.
2. WHEN the Training_Modal navigates to the exercise picker and returns, THE Training_Modal SHALL restore its previous state without losing entered data.
3. IF the backend returns an error during session save, THEN THE Training_Modal SHALL display an error alert and remain open with the user's data intact.
4. WHEN the Training_Modal closes after a successful save, THE Training_Modal SHALL call the onSuccess callback to refresh the parent screen's data.
5. WHILE the Training_Modal is submitting, THE Training_Modal SHALL disable the save button and show a loading indicator to prevent double-submission.

### Requirement 2: Fix Nutrition Entry Save

**User Story:** As a user, I want to save my nutrition entry successfully, so that my dietary intake is tracked and I can review it later.

#### Acceptance Criteria

1. WHEN a user fills in macro fields and taps "Save", THE Nutrition_Modal SHALL send a valid payload to the `POST /nutrition/entries` endpoint including the required `meal_name` field and `entry_date` field.
2. WHEN the Nutrition_Modal constructs the payload, THE Nutrition_Modal SHALL map the frontend date to the backend `entry_date` field and derive `meal_name` from the notes field or use a default value of "Quick entry".
3. IF the backend returns a validation error, THEN THE Nutrition_Modal SHALL display a descriptive error message and keep the form data intact.
4. WHEN a nutrition entry is saved successfully, THE Nutrition_Modal SHALL show the save-as-favorite prompt and call the onSuccess callback.
5. WHILE the Nutrition_Modal is submitting, THE Nutrition_Modal SHALL disable the save button and show a loading indicator.

### Requirement 3: Fix Food Search

**User Story:** As a user, I want to search for foods in the database, so that I can quickly log nutrition from known food items without manual macro entry.

#### Acceptance Criteria

1. WHEN a user types at least 2 characters in the search field, THE Food_Search SHALL send a debounced request (300ms) to `GET /food/search` with the query parameter `q`.
2. WHEN the food search API returns results, THE Food_Search SHALL display up to 10 matching food items with name, calories, protein, and serving info.
3. WHEN a user selects a food item from search results, THE Nutrition_Modal SHALL populate the macro fields with the selected food's nutritional data scaled by the serving multiplier.
4. IF the food search API returns an empty result set, THEN THE Food_Search SHALL display a "No results found — try a different term or enter macros manually" message.
5. IF the food search API returns an error, THEN THE Food_Search SHALL display a fallback message suggesting manual entry without blocking the form.
6. WHEN the food database contains zero seeded items, THE Food_Search SHALL handle the empty state gracefully and suggest manual entry.

### Requirement 4: Bodyweight Modal Unit Toggle

**User Story:** As a user, I want to log my bodyweight in my preferred unit (kg or lbs), so that I don't have to mentally convert every time I step on the scale.

#### Acceptance Criteria

1. WHEN the Bodyweight_Modal opens, THE Bodyweight_Modal SHALL read the user's Unit_System preference from the Zustand store and display the corresponding unit label.
2. WHEN the Unit_System is set to imperial, THE Bodyweight_Modal SHALL display "Weight (lbs)" and convert the entered value to kilograms (dividing by Conversion_Factor 2.20462) before sending to the API.
3. WHEN the Unit_System is set to metric, THE Bodyweight_Modal SHALL display "Weight (kg)" and send the entered value directly to the API without conversion.
4. THE Bodyweight_Modal SHALL include a toggle control allowing the user to switch between kg and lbs within the modal.
5. WHEN the user switches units within the modal, THE Bodyweight_Modal SHALL convert the currently entered numeric value to the new unit using the Conversion_Factor and update the displayed value rounded to one decimal place.

### Requirement 5: Micronutrient, Fibre, and Water Tracking

**User Story:** As a health-conscious user, I want to track micronutrients, fibre, and water intake alongside my macros, so that I have a complete picture of my daily nutrition.

#### Acceptance Criteria

1. THE Nutrition_Modal SHALL include a collapsible "Micronutrients" section below the macro fields with input fields for common vitamins and minerals (vitamin_a_mcg, vitamin_c_mg, vitamin_d_mcg, calcium_mg, iron_mg, zinc_mg, magnesium_mg, potassium_mg).
2. WHEN a user enters micronutrient values, THE Nutrition_Modal SHALL include them in the `micro_nutrients` JSON field of the nutrition entry payload.
3. THE Nutrition_Modal SHALL include a "Fibre (g)" field alongside the macro entry fields (calories, protein, carbs, fat).
4. WHEN a user enters a fibre value, THE Nutrition_Modal SHALL include it in the `micro_nutrients` field as the key `fibre_g`.
5. THE Nutrition_Modal SHALL include a "Water Intake" section with tappable glass icons where each glass represents 250ml.
6. WHEN a user taps a glass icon, THE Nutrition_Modal SHALL increment the water count by one glass and display the running total in both glasses and millilitres.
7. WHEN a user taps a filled glass icon, THE Nutrition_Modal SHALL decrement the water count by one glass to allow corrections.
8. WHEN a nutrition entry with micronutrients is saved, THE Nutrition_Entry backend SHALL persist the `micro_nutrients` JSONB field with all provided key-value pairs.
9. THE Nutrition_Modal SHALL serialize water intake as `water_ml` within the `micro_nutrients` JSON field.
10. WHEN the Micronutrients section is collapsed, THE Nutrition_Modal SHALL show a summary count of how many micronutrient fields have been filled in.

### Requirement 6: Profile Account Fields Editability

**User Story:** As a user, I want the account fields on my profile to look and feel interactive, so that I know I can update my information without guessing.

#### Acceptance Criteria

1. WHEN the Profile_Screen is in view mode, THE Profile_Screen SHALL display editable account fields (display name, timezone, preferred currency) with a visual affordance indicating they are tappable (e.g., subtle edit icon, underline, or different background).
2. WHEN a user taps an editable field, THE Profile_Screen SHALL enable inline editing for that field with a focused text input and a visible border using the `colors.border.focus` token.
3. WHEN a user modifies a field and confirms the edit, THE Profile_Screen SHALL persist the change via the `PUT /user/profile` endpoint and update the local Zustand store.
4. IF the profile update fails, THEN THE Profile_Screen SHALL display an error alert and revert the field to its previous value.
5. WHEN a field is in edit mode, THE Profile_Screen SHALL show save and cancel affordances for that field.

### Requirement 7: Rest Timer Relocation

**User Story:** As a user, I want to adjust my rest timer settings from within the training flow, so that I can fine-tune rest periods without leaving my workout.

#### Acceptance Criteria

1. THE Training_Modal SHALL include a rest timer settings affordance (gear icon or "⚙" button) near the rest timer overlay allowing users to adjust compound and isolation rest durations.
2. WHEN a user adjusts rest timer settings from the Training_Modal, THE Training_Modal SHALL persist the updated values to the user profile preferences via the `PUT /user/profile` endpoint.
3. THE Profile_Screen SHALL retain the rest timer preferences section so users can also configure settings outside of training.
4. WHEN the rest timer fires after a set is added, THE Rest_Timer SHALL use the most recently saved rest duration values from the user's profile preferences.
5. WHEN a user opens the rest timer settings from the Training_Modal, THE Training_Modal SHALL display the current compound and isolation rest values pre-filled from the profile preferences.

### Requirement 8: Custom Meal Plans

**User Story:** As a user who eats similar meals regularly, I want to create and reuse custom meal plans composed of multiple food items, so that I can log my go-to meals in one tap.

#### Acceptance Criteria

1. THE Nutrition_Modal SHALL include a "Meal Plans" tab or section that displays the user's saved custom meal plans.
2. WHEN a user taps "Create Meal Plan", THE Nutrition_Modal SHALL present a form to name the plan and add multiple food items (from Food_Search or manual entry) with individual serving sizes.
3. WHEN food items are added to a meal plan, THE Nutrition_Modal SHALL display a running total of aggregate calories, protein, carbs, and fat.
4. WHEN a meal plan is saved, THE Custom_Meal_Plan backend SHALL persist the plan with its name, constituent items, and aggregate nutritional data via the `POST /meals/custom` endpoint.
5. WHEN a user selects a saved meal plan from the list, THE Nutrition_Modal SHALL populate the macro fields with the plan's aggregate nutritional values and set the meal_name to the plan name.
6. WHEN a user taps a favorite icon on a meal plan, THE Meal_Favorite backend SHALL save the plan as a favorite for quick access via the `POST /meals/favorites` endpoint.
7. WHEN a user edits a saved meal plan, THE Custom_Meal_Plan backend SHALL update the plan definition without altering previously logged nutrition entries that referenced the plan.
8. WHEN a user deletes a meal plan, THE Custom_Meal_Plan backend SHALL soft-delete the plan so it remains recoverable.
