# Requirements Document

## Introduction

Body Recomposition Mode adds a specialized goal type to Hypertrophy OS for users pursuing simultaneous fat loss and muscle gain. Unlike cutting (calorie deficit) or bulking (calorie surplus), recomposition uses calorie cycling — a slight surplus on training days and a slight deficit on rest days — so the weekly average stays near maintenance. The feature tracks body composition changes through a combination of bodyweight, body measurements (waist, arms, chest), and progress photos, and surfaces a composite "Recomp Score" that quantifies whether the user is successfully losing fat while gaining muscle. Weekly check-in recommendations are tailored to the recomp context, providing actionable feedback based on measurement trends rather than scale weight alone.

## Glossary

- **Recomp_Mode**: The body recomposition goal type, selectable alongside cutting, bulking, and maintaining. When active, the Adaptive_Engine uses calorie cycling instead of flat caloric targets.
- **Adaptive_Engine**: The existing backend engine (`compute_snapshot` in `engine.py`) that computes caloric and macro targets based on user metrics, activity level, and goal type.
- **Sync_Engine**: The nutrition-training sync engine (`sync_engine.py`) that produces day-specific adjusted targets based on training activity. Recomp_Mode extends its calorie cycling logic.
- **Calorie_Cycling**: A nutrition strategy where training days receive a caloric surplus and rest days receive a caloric deficit, with the weekly average approximating maintenance TDEE.
- **Training_Day_Surplus**: The percentage above TDEE applied on training days in Recomp_Mode (default: +10%).
- **Rest_Day_Deficit**: The percentage below TDEE applied on rest days in Recomp_Mode (default: -10%).
- **Weekly_Calorie_Average**: The mean daily caloric intake across a 7-day period, expected to approximate maintenance TDEE under Recomp_Mode.
- **Recomp_Measurement**: A body measurement entry consisting of waist circumference, arm circumference, and chest circumference, recorded by the user.
- **Fat_Loss_Indicator**: The waist circumference trend over time. A decreasing trend indicates fat loss.
- **Muscle_Gain_Indicator**: The arm and chest circumference trends over time. An increasing trend indicates muscle gain.
- **Recomp_Score**: A composite numeric score (range -100 to +100) that combines the Fat_Loss_Indicator and Muscle_Gain_Indicator trends. Positive scores indicate successful recomposition.
- **Recomp_Dashboard_Card**: A frontend component on the dashboard that displays recomp-specific progress metrics including waist trend, arm trend, weight trend, and Recomp_Score.
- **Recomp_Checkin**: A weekly check-in recommendation tailored to recomp users, providing feedback based on measurement trends rather than scale weight alone.
- **Measurement_Trend**: The direction and magnitude of change in a body measurement over a configurable lookback window (default: 4 weeks), computed using linear regression slope.

## Requirements

### Requirement 1: Recomp Goal Mode Selection

**User Story:** As a user, I want to select "Body Recomposition" as my goal type, so that the system optimizes my nutrition for simultaneous fat loss and muscle gain.

#### Acceptance Criteria

1. THE Goal_Type enum SHALL include a "recomposition" value alongside "cutting", "maintaining", and "bulking".
2. WHEN a user selects Recomp_Mode during onboarding or in profile settings, THE system SHALL persist the goal type as "recomposition" in the UserGoal record.
3. WHEN a user selects Recomp_Mode, THE system SHALL set the goal_rate_per_week to 0.0 (maintenance weight target).
4. WHEN a user switches from Recomp_Mode to another goal type, THE system SHALL revert to flat caloric targets and clear any recomp-specific configuration.
5. WHEN a user switches to Recomp_Mode from another goal type, THE system SHALL initialize calorie cycling with default surplus (+10%) and deficit (-10%) percentages.

### Requirement 2: Calorie Cycling Engine

**User Story:** As a user in Recomp_Mode, I want my daily calorie targets to cycle between surplus and deficit based on whether I train, so that I fuel muscle growth on training days and promote fat loss on rest days.

#### Acceptance Criteria

1. WHILE the user goal is Recomp_Mode, WHEN a date is classified as a Training_Day, THE Adaptive_Engine SHALL compute the daily calorie target as TDEE multiplied by (1 + Training_Day_Surplus), where Training_Day_Surplus defaults to 0.10.
2. WHILE the user goal is Recomp_Mode, WHEN a date is classified as a Rest_Day, THE Adaptive_Engine SHALL compute the daily calorie target as TDEE multiplied by (1 + Rest_Day_Deficit), where Rest_Day_Deficit defaults to -0.10.
3. WHILE the user goal is Recomp_Mode, THE Adaptive_Engine SHALL compute the Weekly_Calorie_Average as the mean of the 7 most recent daily calorie targets.
4. WHILE the user goal is Recomp_Mode, THE Adaptive_Engine SHALL maintain protein targets at or above 2.0 g per kg of bodyweight on all days.
5. WHILE the user goal is Recomp_Mode, WHEN computing macro distribution for a Training_Day, THE Adaptive_Engine SHALL allocate a higher proportion of the surplus to carbohydrates (Carb_Shift_Ratio of 0.6) than to fat.
6. WHILE the user goal is Recomp_Mode, WHEN computing macro distribution for a Rest_Day, THE Adaptive_Engine SHALL allocate a higher proportion of calories to fat and protein, reducing carbohydrates proportionally.
7. THE Adaptive_Engine SHALL clamp daily calorie targets in Recomp_Mode to a minimum of 1200 kcal.

### Requirement 3: Recomp Body Measurements Tracking

**User Story:** As a user in Recomp_Mode, I want to log waist, arm, and chest measurements, so that the system can track my body composition changes beyond scale weight.

#### Acceptance Criteria

1. WHEN a user logs a Recomp_Measurement, THE system SHALL persist the waist circumference (cm), arm circumference (cm), and chest circumference (cm) with the recording date.
2. WHEN a user logs a Recomp_Measurement, THE system SHALL accept partial entries where at least one measurement field is provided.
3. WHEN a Recomp_Measurement is logged, THE system SHALL validate that all provided circumference values are positive numbers.
4. THE system SHALL store Recomp_Measurement entries in an append-only fashion, preserving historical data.
5. WHEN the API endpoint for Recomp_Measurements is called with a date range, THE system SHALL return all measurements within that range sorted by date ascending.

### Requirement 4: Recomp Progress Metrics Computation

**User Story:** As a user in Recomp_Mode, I want to see separate progress metrics for fat loss and muscle gain, so that I can understand whether recomposition is working.

#### Acceptance Criteria

1. WHEN at least 2 waist measurements exist within the lookback window, THE system SHALL compute the Fat_Loss_Indicator as the linear regression slope of waist circumference over time.
2. WHEN at least 2 arm or chest measurements exist within the lookback window, THE system SHALL compute the Muscle_Gain_Indicator as the average of the linear regression slopes of arm and chest circumference over time.
3. THE system SHALL compute the Recomp_Score as: `50 × normalized_fat_loss + 50 × normalized_muscle_gain`, where normalized_fat_loss is positive when waist is shrinking and normalized_muscle_gain is positive when arm/chest are growing.
4. THE system SHALL clamp the Recomp_Score to the range [-100, +100].
5. IF fewer than 2 measurements exist for any indicator, THEN THE system SHALL return null for that indicator and mark the Recomp_Score as insufficient data.
6. THE system SHALL use a configurable lookback window (default: 28 days) for trend computation.

### Requirement 5: Recomp Dashboard Card

**User Story:** As a user in Recomp_Mode, I want a dashboard card showing my recomp-specific progress, so that I can quickly see whether I'm losing fat and gaining muscle.

#### Acceptance Criteria

1. WHILE the user goal is Recomp_Mode, WHEN the DashboardScreen loads, THE Recomp_Dashboard_Card SHALL be displayed on the dashboard.
2. WHEN the Recomp_Dashboard_Card renders, THE Recomp_Dashboard_Card SHALL display the waist trend direction and magnitude (e.g., "Waist: -0.5 cm/week").
3. WHEN the Recomp_Dashboard_Card renders, THE Recomp_Dashboard_Card SHALL display the arm trend direction and magnitude (e.g., "Arms: +0.3 cm/week").
4. WHEN the Recomp_Dashboard_Card renders, THE Recomp_Dashboard_Card SHALL display the weight trend direction (e.g., "Weight: stable").
5. WHEN the Recomp_Dashboard_Card renders, THE Recomp_Dashboard_Card SHALL display the Recomp_Score with a visual indicator (positive = green, negative = red, near-zero = neutral).
6. IF insufficient measurement data exists, THEN THE Recomp_Dashboard_Card SHALL display a prompt encouraging the user to log measurements.

### Requirement 6: Recomp Weekly Check-in Recommendations

**User Story:** As a user in Recomp_Mode, I want weekly check-in recommendations tailored to recomposition, so that I receive actionable advice based on my measurement trends.

#### Acceptance Criteria

1. WHILE the user goal is Recomp_Mode, WHEN a weekly check-in is triggered, THE Recomp_Checkin SHALL generate a recommendation based on the Fat_Loss_Indicator, Muscle_Gain_Indicator, and weight trend.
2. WHEN the waist trend is decreasing and arm/chest trends are increasing, THE Recomp_Checkin SHALL generate a positive message indicating recomposition is working (e.g., "Waist down 0.5cm, arms up 0.3cm — recomp is working").
3. WHEN the weight trend is decreasing faster than 0.5 kg/week, THE Recomp_Checkin SHALL recommend increasing training day calories.
4. WHEN the weight trend is increasing faster than 0.5 kg/week, THE Recomp_Checkin SHALL recommend decreasing rest day calories.
5. WHEN measurement data is insufficient for trend computation, THE Recomp_Checkin SHALL prompt the user to log body measurements.
6. THE Recomp_Checkin SHALL include the current Recomp_Score in the check-in response.

### Requirement 7: Recomp Metrics Serialization

**User Story:** As a developer, I want the recomp metrics response to be serializable and deserializable without data loss, so that caching and persistence work correctly.

#### Acceptance Criteria

1. THE system SHALL serialize Recomp_Score responses and Recomp_Measurement entries to JSON format.
2. FOR ALL valid Recomp metrics responses, serializing to JSON and then deserializing SHALL produce an equivalent object (round-trip property).
