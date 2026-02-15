# Requirements Document

## Introduction

Add a lightweight visual indicator on the Hypertrophy OS dashboard showing whether the selected date is a training day or rest day. When it is a training day, display the muscle groups being trained. The indicator sits between the DateScroller and MacroRingsRow as a compact pill/badge. This feature is standalone and does not include calorie adjustment logic (handled by the nutrition-training-sync spec).

## Glossary

- **Dashboard**: The main screen of the app displaying macro rings, budget bar, date scroller, and today's summary.
- **Day_Classification_Service**: The backend service responsible for determining whether a given date is a training day or rest day for a user.
- **DayBadge**: The frontend React Native component that renders the training day or rest day indicator pill on the dashboard.
- **Training_Day**: A date on which the user has a logged training session or a scheduled workout template.
- **Rest_Day**: A date on which the user has no logged training session and no scheduled workout template.
- **Muscle_Group**: A body part category derived from exercises (e.g., chest, back, quads, shoulders) using the existing exercise-to-muscle-group mapping.
- **Workout_Template**: A user-created reusable workout blueprint with assigned exercises and optional day-of-week scheduling metadata.
- **Session**: A logged training session containing exercises, sets, and reps for a specific date.

## Requirements

### Requirement 1: Day Classification

**User Story:** As a user, I want to see whether a selected date is a training day or rest day, so that I can quickly understand my training schedule at a glance.

#### Acceptance Criteria

1. WHEN the user selects a date that has a logged training session, THE Day_Classification_Service SHALL classify that date as a Training_Day.
2. WHEN the user selects a date that has no logged training session and no scheduled Workout_Template, THE Day_Classification_Service SHALL classify that date as a Rest_Day.
3. WHEN the user selects a date that has no logged session but has a Workout_Template scheduled for that day of the week, THE Day_Classification_Service SHALL classify that date as a Training_Day.
4. WHEN a date has both a logged session and a scheduled template, THE Day_Classification_Service SHALL classify that date as a Training_Day using the logged session data.

### Requirement 2: Muscle Group Extraction

**User Story:** As a user, I want to see which muscle groups are being trained on a training day, so that I can understand the focus of the workout.

#### Acceptance Criteria

1. WHEN a date is classified as a Training_Day from a logged session, THE Day_Classification_Service SHALL extract unique Muscle_Group values from the session exercises using the exercise-to-muscle-group mapping.
2. WHEN a date is classified as a Training_Day from a scheduled Workout_Template, THE Day_Classification_Service SHALL extract unique Muscle_Group values from the template exercises using the exercise-to-muscle-group mapping.
3. WHEN an exercise name has no mapping entry, THE Day_Classification_Service SHALL categorize that exercise under the "Other" Muscle_Group.
4. THE Day_Classification_Service SHALL return Muscle_Group values as a deduplicated list sorted alphabetically.

### Requirement 3: Day Classification API Endpoint

**User Story:** As a frontend developer, I want a backend endpoint that returns the day classification and muscle groups for a given date, so that the DayBadge component can display accurate information.

#### Acceptance Criteria

1. THE Day_Classification_Service SHALL expose a GET endpoint that accepts a date parameter and returns the classification (training or rest) and a list of muscle groups.
2. WHEN the endpoint receives a valid date, THE Day_Classification_Service SHALL return a JSON response containing the classification type and muscle group list within 200ms under normal load.
3. IF the endpoint receives an invalid date format, THEN THE Day_Classification_Service SHALL return a 422 validation error with a descriptive message.
4. IF the endpoint is called without authentication, THEN THE Day_Classification_Service SHALL return a 401 unauthorized error.

### Requirement 4: Dashboard Badge Display

**User Story:** As a user, I want to see a compact badge on the dashboard indicating training day or rest day, so that the information is visible without extra navigation.

#### Acceptance Criteria

1. THE DayBadge SHALL render between the DateScroller component and the MacroRingsRow component on the dashboard.
2. WHEN the selected date is classified as a Training_Day, THE DayBadge SHALL display the text "Training Day" with an accent color style.
3. WHEN the selected date is classified as a Rest_Day, THE DayBadge SHALL display the text "Rest Day" with a muted color style.
4. WHEN the selected date is a Training_Day, THE DayBadge SHALL display the associated muscle groups as compact tags alongside the badge text.
5. WHILE the day classification data is loading, THE DayBadge SHALL display a skeleton placeholder matching the badge dimensions.
6. WHEN the user changes the selected date via the DateScroller, THE DayBadge SHALL update to reflect the classification of the newly selected date.

### Requirement 5: Template Schedule Detection

**User Story:** As a user who has workout templates with assigned days, I want the system to use my template schedule for future day classification, so that I can see upcoming training days.

#### Acceptance Criteria

1. WHEN a Workout_Template has day-of-week assignments stored in its metadata, THE Day_Classification_Service SHALL use those assignments to classify future dates.
2. WHEN multiple Workout_Templates are scheduled for the same day of the week, THE Day_Classification_Service SHALL merge the muscle groups from all scheduled templates into a single deduplicated list.
3. WHEN a Workout_Template has no day-of-week assignments in its metadata, THE Day_Classification_Service SHALL not use that template for schedule-based classification.
