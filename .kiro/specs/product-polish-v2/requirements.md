# Requirements Document

## Introduction

This specification covers five strategic product improvements for the HypertrophyOS platform, identified through a PM audit. The improvements target training analytics, unit system flexibility, previous performance display during logging, a real charting library upgrade, and a configurable rest timer. Together these features address key retention drivers and user experience gaps in the current platform.

## Glossary

- **Training_Analytics_Service**: Backend service that computes training volume, strength progression, muscle group frequency, and personal records from training session data.
- **Unit_Conversion_Utility**: Frontend utility module that converts between metric (kg, cm) and imperial (lbs, inches, ft) measurement systems.
- **Unit_Preference**: A user-level setting stored in the `preferences` JSONB column of `user_profiles`, indicating whether the user prefers metric or imperial units.
- **Previous_Performance_Resolver**: Backend endpoint that retrieves the most recent training session containing a given exercise for a given user.
- **Chart_Component**: A React Native component backed by a real charting library (victory-native or react-native-chart-kit) that renders interactive line charts with tooltips and time range selectors.
- **Rest_Timer**: An in-app countdown timer that auto-starts after a set is logged during a training session, with configurable durations per exercise type.
- **PR_Detector**: A component of the Training Analytics Service that identifies when a user achieves a new personal record for an exercise (highest weight at a given rep count).
- **Set_Entry**: A single set within an exercise, containing reps, weight_kg, and optional rpe fields.
- **Exercise_Entry**: A single exercise within a training session, containing exercise_name and a list of Set_Entry objects.
- **Time_Range_Selector**: A UI control that allows the user to filter chart data by predefined periods (7 days, 14 days, 30 days, 90 days).

## Requirements

### Requirement 1: Training Volume Analytics

**User Story:** As a user, I want to see my total training volume over time, so that I can track whether my workload is progressing.

#### Acceptance Criteria

1. WHEN a user requests training volume analytics for a date range, THE Training_Analytics_Service SHALL compute total volume (sets × reps × weight_kg) per session and return a time series of daily volume values.
2. WHEN a user has no training sessions in the requested date range, THE Training_Analytics_Service SHALL return an empty time series with zero values.
3. THE Training_Analytics_Service SHALL support filtering volume by specific muscle group when a muscle group parameter is provided.

### Requirement 2: Strength Progression Charts

**User Story:** As a user, I want to see strength progression charts per exercise, so that I can visualize my improvement on specific lifts.

#### Acceptance Criteria

1. WHEN a user requests strength progression for a specific exercise, THE Training_Analytics_Service SHALL return a time series of the estimated one-rep max (e1RM) or best set (highest weight × reps) per session for that exercise.
2. WHEN a user has fewer than two sessions containing the requested exercise, THE Training_Analytics_Service SHALL return the available data points without interpolation.
3. THE Chart_Component SHALL render the strength progression data as an interactive line chart with tooltips showing date, weight, and reps.

### Requirement 3: Muscle Group Frequency Heatmap

**User Story:** As a user, I want to see a heatmap of how often I train each muscle group, so that I can identify imbalances in my program.

#### Acceptance Criteria

1. WHEN a user requests muscle group frequency data, THE Training_Analytics_Service SHALL compute the number of sessions per muscle group per week over the requested date range.
2. THE Training_Analytics_Service SHALL map exercise names to muscle groups using a predefined exercise-to-muscle-group mapping.
3. WHEN an exercise name does not exist in the mapping, THE Training_Analytics_Service SHALL categorize the exercise under an "Other" muscle group.

### Requirement 4: Personal Record Detection

**User Story:** As a user, I want to be notified when I achieve a personal record, so that I can celebrate my progress.

#### Acceptance Criteria

1. WHEN a training session is saved, THE PR_Detector SHALL compare each set against the user's historical best for that exercise at the same rep count.
2. WHEN a set exceeds the previous best weight for that exercise and rep count, THE PR_Detector SHALL flag the set as a new personal record.
3. WHEN a personal record is detected, THE PR_Detector SHALL return the PR data (exercise name, weight, reps, previous best weight) in the session save response.
4. IF no historical data exists for an exercise and rep count combination, THEN THE PR_Detector SHALL treat the first recorded set as the initial record without flagging a PR celebration.

### Requirement 5: Imperial/Metric Unit Toggle

**User Story:** As a user, I want to switch between metric and imperial units across the entire app, so that I can view data in my preferred measurement system.

#### Acceptance Criteria

1. THE Unit_Conversion_Utility SHALL convert weight values between kilograms and pounds (1 kg = 2.20462 lbs).
2. THE Unit_Conversion_Utility SHALL convert height values between centimeters and feet/inches (1 inch = 2.54 cm).
3. WHEN a user updates the Unit_Preference, THE system SHALL persist the preference in the `preferences` JSONB column of the `user_profiles` table.
4. WHEN displaying any weight or height value, THE system SHALL format the value according to the user's current Unit_Preference.
5. THE system SHALL store all values in metric (kg, cm) in the database regardless of the user's display preference.
6. WHEN a user inputs a value in imperial units, THE Unit_Conversion_Utility SHALL convert the value to metric before persisting to the database.
7. THE Unit_Conversion_Utility SHALL round converted weight values to one decimal place and converted height values to the nearest whole centimeter.

### Requirement 6: Previous Performance Display

**User Story:** As a user, I want to see my previous performance for each exercise while logging a training session, so that I can make informed decisions about my current workout.

#### Acceptance Criteria

1. WHEN a user begins logging an exercise in a training session, THE Previous_Performance_Resolver SHALL retrieve the most recent session containing that exercise for the user.
2. WHEN previous performance data is found, THE system SHALL display the last set data (weight and reps) inline next to the exercise input fields, formatted as "Last time: [weight] × [reps]".
3. WHEN no previous performance data exists for an exercise, THE system SHALL display "First time" next to the exercise input fields.
4. THE Previous_Performance_Resolver SHALL return the previous performance data within 500ms to avoid disrupting the logging flow.
5. WHEN displaying previous performance values, THE system SHALL format weight according to the user's Unit_Preference.

### Requirement 7: Real Charting Library Integration

**User Story:** As a user, I want interactive, professional-looking charts for my analytics data, so that I can better understand my trends.

#### Acceptance Criteria

1. THE Chart_Component SHALL render bodyweight trend data as an interactive line chart with data point tooltips.
2. THE Chart_Component SHALL render calorie trend data as an interactive line chart with a horizontal target line overlay.
3. THE Chart_Component SHALL render protein trend data as an interactive line chart with a horizontal target line overlay.
4. THE Chart_Component SHALL provide a Time_Range_Selector with options for 7 days, 14 days, 30 days, and 90 days.
5. WHEN a user selects a time range, THE Chart_Component SHALL filter the displayed data to the selected period.
6. THE Chart_Component SHALL use the existing HypertrophyOS dark theme color tokens for all chart styling.
7. WHEN a chart has no data for the selected time range, THE Chart_Component SHALL display a "No data for this period" message.

### Requirement 8: Rest Timer

**User Story:** As a user, I want a rest timer that starts automatically after I log a set, so that I can maintain consistent rest periods during my workout.

#### Acceptance Criteria

1. WHEN a user logs a set during a training session, THE Rest_Timer SHALL auto-start a countdown using the configured rest duration for that exercise type.
2. THE Rest_Timer SHALL use default rest durations of 180 seconds for compound exercises and 90 seconds for isolation exercises.
3. WHEN the Rest_Timer countdown reaches zero, THE Rest_Timer SHALL play a notification sound to alert the user.
4. THE Rest_Timer SHALL allow the user to dismiss or skip the timer at any point during the countdown.
5. WHEN the user dismisses the Rest_Timer, THE Rest_Timer SHALL stop the countdown and hide the timer display.
6. THE Rest_Timer SHALL display the remaining time in minutes and seconds format (e.g., "2:30").
7. WHERE a user has configured a custom rest duration for an exercise type, THE Rest_Timer SHALL use the custom duration instead of the default.
8. THE system SHALL persist custom rest duration preferences in the `preferences` JSONB column of the `user_profiles` table.
