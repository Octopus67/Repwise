# Requirements Document

## Introduction

Replace the separate BodyStatsSection and GoalsSection on the ProfileScreen with a single unified "Edit My Plan" panel. The panel displays a read-only summary card when not editing, and opens a guided mini-wizard to collect body stats and goals in sequence. On save, it submits everything to `POST /users/recalculate` in one API call and reveals updated TDEE/macro targets.

## Glossary

- **Plan_Panel**: The unified UI component that replaces BodyStatsSection and GoalsSection on the ProfileScreen, displaying a summary card and providing access to the edit flow.
- **Summary_Card**: The read-only view within the Plan_Panel that shows current body stats, goals, and TDEE/macro targets at a glance.
- **Edit_Flow**: The guided multi-step sequence within the Plan_Panel that collects body stats and goals from the user.
- **Recalculate_Endpoint**: The `POST /api/v1/users/recalculate` backend endpoint that accepts `{ metrics, goals }` and returns `{ metrics, goals, targets }`.
- **TDEE_Targets**: The computed adaptive calorie and macronutrient targets (calories, protein, carbs, fat) returned by the Recalculate_Endpoint.
- **Unit_System**: The user's preferred measurement system (`metric` or `imperial`), stored in profile preferences and used for display conversion.
- **Body_Stats**: The set of physiological measurements: weight, height, body fat percentage, and activity level.
- **Goals**: The set of goal parameters: goal type (cutting/maintaining/bulking), target weight, and goal rate per week.

## Requirements

### Requirement 1: Summary Card Display

**User Story:** As a user, I want to see my current body stats, goals, and TDEE targets in a single summary card, so that I can quickly review my plan without navigating multiple sections.

#### Acceptance Criteria

1. WHEN the user has existing metrics, goals, and adaptive targets, THE Summary_Card SHALL display weight, height, body fat %, activity level, goal type, target weight, goal rate, and TDEE_Targets (calories, protein, carbs, fat) in a single card.
2. WHEN any optional field (body fat %, target weight, goal rate) has no value, THE Summary_Card SHALL display a dash ("—") for that field.
3. THE Summary_Card SHALL display weight values converted to the user's Unit_System (lbs for imperial, kg for metric).
4. THE Summary_Card SHALL display height values converted to the user's Unit_System (ft/in for imperial, cm for metric).
5. WHEN the user taps the "Edit My Plan" button on the Summary_Card, THE Plan_Panel SHALL open the Edit_Flow.

### Requirement 2: Empty State

**User Story:** As a new user with no metrics or goals, I want to see a clear call-to-action to set up my plan, so that I know how to get started.

#### Acceptance Criteria

1. WHEN the user has no existing metrics and no existing goals, THE Plan_Panel SHALL display an empty state with a descriptive message and a "Set Up My Plan" call-to-action button.
2. WHEN the user taps the "Set Up My Plan" button, THE Plan_Panel SHALL open the Edit_Flow with sensible default values (activity level: moderate, goal type: maintaining).
3. WHEN the user has metrics but no goals (or vice versa), THE Plan_Panel SHALL display the Summary_Card with available data and dashes for missing fields, along with the "Edit My Plan" button.

### Requirement 3: Edit Flow — Body Stats Step

**User Story:** As a user, I want to edit my body stats in a guided step, so that I can update my weight, height, body fat %, and activity level.

#### Acceptance Criteria

1. WHEN the Edit_Flow opens, THE Edit_Flow SHALL pre-fill all body stats fields with the user's current metric values converted to the user's Unit_System.
2. WHEN the user enters a weight value, THE Edit_Flow SHALL accept the value in the user's Unit_System and display the appropriate unit label (lbs or kg).
3. WHEN the user enters a height value in imperial mode, THE Edit_Flow SHALL provide separate feet and inches input fields.
4. WHEN the user enters a height value in metric mode, THE Edit_Flow SHALL provide a single centimeters input field.
5. THE Edit_Flow SHALL provide an activity level picker with options: Sedentary, Light, Moderate, Active, Very Active.
6. THE Edit_Flow SHALL allow body fat % to remain empty (optional field).

### Requirement 4: Edit Flow — Goals Step

**User Story:** As a user, I want to edit my goals in a guided step, so that I can set my goal type, target weight, and goal rate.

#### Acceptance Criteria

1. WHEN the Edit_Flow advances to the goals step, THE Edit_Flow SHALL pre-fill goal fields with the user's current goal values.
2. THE Edit_Flow SHALL provide a goal type selector with options: Cutting, Maintaining, Bulking.
3. THE Edit_Flow SHALL allow target weight to remain empty (optional field).
4. THE Edit_Flow SHALL allow goal rate per week to remain empty (optional field).
5. WHEN the user selects "Maintaining" as goal type, THE Edit_Flow SHALL hide the target weight and goal rate fields since they are not applicable.

### Requirement 5: Save and Recalculate

**User Story:** As a user, I want to save my updated stats and goals in one action, so that my TDEE and macro targets are recalculated together.

#### Acceptance Criteria

1. WHEN the user taps "Save" in the Edit_Flow, THE Plan_Panel SHALL send a single POST request to the Recalculate_Endpoint with both metrics and goals payloads.
2. WHEN the Recalculate_Endpoint returns successfully, THE Plan_Panel SHALL update the Zustand store with the new metrics, goals, and TDEE_Targets.
3. WHEN the Recalculate_Endpoint returns successfully, THE Plan_Panel SHALL close the Edit_Flow and display the updated Summary_Card with the new TDEE_Targets prominently shown.
4. THE Plan_Panel SHALL convert user-entered weight values from the user's Unit_System to kilograms before sending to the Recalculate_Endpoint.
5. THE Plan_Panel SHALL convert user-entered height values from feet/inches to centimeters (when imperial) before sending to the Recalculate_Endpoint.
6. THE Plan_Panel SHALL convert user-entered goal rate values from the user's Unit_System to kg/week before sending to the Recalculate_Endpoint.

### Requirement 6: Error Handling

**User Story:** As a user, I want clear feedback when something goes wrong during save, so that I can retry or correct my input.

#### Acceptance Criteria

1. IF the Recalculate_Endpoint returns an error, THEN THE Plan_Panel SHALL display an inline error message and keep the Edit_Flow open with the user's entered values preserved.
2. IF the user enters an invalid weight (non-numeric or zero/negative), THEN THE Edit_Flow SHALL prevent submission and display a validation message.
3. IF the user enters an invalid height (non-numeric or zero/negative), THEN THE Edit_Flow SHALL prevent submission and display a validation message.
4. IF the user enters a body fat % outside the range 0–100, THEN THE Edit_Flow SHALL prevent submission and display a validation message.
5. WHILE the save request is in progress, THE Plan_Panel SHALL display a loading indicator and disable the save button to prevent duplicate submissions.

### Requirement 7: ProfileScreen Integration

**User Story:** As a user, I want the new plan panel to fit seamlessly into the existing profile screen layout, so that my experience remains consistent.

#### Acceptance Criteria

1. THE Plan_Panel SHALL replace both the BodyStatsSection and GoalsSection in the ProfileScreen layout.
2. THE Plan_Panel SHALL occupy the same position in the ProfileScreen section order: after the profile header card and before the preferences section.
3. THE Plan_Panel SHALL use the same Card component and design tokens (colors, spacing, typography) as other ProfileScreen sections.
4. THE Plan_Panel SHALL participate in the ProfileScreen's staggered entrance animation.
5. THE Plan_Panel SHALL preserve all other ProfileScreen sections (preferences, features, subscription, account) without modification.

### Requirement 8: Unit Conversion Correctness

**User Story:** As a user, I want weight and height values to convert correctly between display units and storage units, so that my data is accurate.

#### Acceptance Criteria

1. THE Plan_Panel SHALL use the existing `unitConversion.ts` utility functions (`formatWeight`, `formatHeight`, `parseWeightInput`, `cmToFtIn`, `ftInToCm`) for all unit conversions.
2. FOR ALL valid weight values in kg, converting to the display unit and back to kg SHALL produce a value within 0.1 kg of the original (round-trip property).
3. FOR ALL valid height values in cm, converting to ft/in and back to cm SHALL produce a value within 1 cm of the original (round-trip property).
