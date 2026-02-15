# Requirements Document

## Introduction

Recovery Readiness Score is a daily composite metric (0–100) that combines device health data (HRV, resting heart rate, sleep) with optional user-reported recovery signals (soreness, stress, sleep quality) to indicate how recovered a user is before training. In v1 the score is informational only — displayed on the dashboard as a circular gauge with color coding and contributing factor breakdown. Historical readiness scores are tracked and visualized on the analytics screen. The score does not modify training recommendations in v1.

## Glossary

- **Health_Data_Service**: The frontend service responsible for requesting permissions and reading HRV, resting heart rate, and sleep data from the device health store via expo-health-connect (Android) or react-native-health (iOS).
- **Recovery_Checkin_Service**: The backend service responsible for storing and retrieving user-reported recovery check-in data (soreness, stress, sleep quality).
- **Readiness_Engine**: The backend pure-function module responsible for computing the readiness score from health metrics and user-reported data.
- **Readiness_Score**: A numeric value from 0 to 100 representing overall recovery readiness, where higher values indicate greater recovery.
- **HRV_Baseline**: The user's rolling 30-day average HRV value, used as a personal reference point for daily HRV comparison.
- **Resting_HR_Baseline**: The user's rolling 30-day average resting heart rate, used as a personal reference point for daily comparison.
- **Recovery_Checkin**: A user-submitted set of subjective recovery signals: overall soreness (1–5), stress level (1–5), and perceived sleep quality (1–5).
- **Readiness_Gauge**: A circular gauge UI component on the dashboard that displays the readiness score with color coding (green 70–100, yellow 40–69, red 0–39).
- **Factor_Breakdown**: A UI component that shows the individual contribution of each input factor to the overall readiness score.

## Requirements

### Requirement 1: Health Data Permission and Access

**User Story:** As a user, I want the app to request permission to read my health data from Apple Health or Google Health Connect, so that my recovery score can incorporate objective physiological metrics.

#### Acceptance Criteria

1. WHEN the user opens the readiness feature for the first time, THE Health_Data_Service SHALL request read permissions for HRV, resting heart rate, and sleep duration from the device health store.
2. WHEN the user grants health data permissions, THE Health_Data_Service SHALL read the most recent HRV value, resting heart rate, and sleep duration for the current day.
3. WHEN the user denies health data permissions, THE Health_Data_Service SHALL proceed without health metrics and THE Readiness_Engine SHALL compute the score using only user-reported data.
4. IF the device health store returns no data for the current day, THEN THE Health_Data_Service SHALL attempt to read the most recent available value within the last 48 hours.
5. IF no health data is available within 48 hours, THEN THE Health_Data_Service SHALL report each unavailable metric as absent to the Readiness_Engine.

### Requirement 2: User-Reported Recovery Check-in

**User Story:** As a user, I want to quickly report my soreness, stress, and sleep quality, so that the readiness score reflects my subjective recovery state.

#### Acceptance Criteria

1. WHEN the user opens the recovery check-in, THE Recovery_Checkin_Service SHALL present three input fields: overall soreness (1–5 scale), stress level (1–5 scale), and perceived sleep quality (1–5 scale).
2. WHEN the user submits a recovery check-in, THE Recovery_Checkin_Service SHALL persist the check-in data with the user ID and the check-in date.
3. WHEN the user submits a second check-in for the same date, THE Recovery_Checkin_Service SHALL overwrite the previous check-in for that date.
4. THE Recovery_Checkin_Service SHALL allow the user to skip the check-in entirely, and THE Readiness_Engine SHALL compute the score using only available health data.
5. IF a check-in submission contains a value outside the 1–5 range for any field, THEN THE Recovery_Checkin_Service SHALL reject the submission and return a validation error.

### Requirement 3: Personal Baseline Computation

**User Story:** As a user, I want the readiness score to compare my daily metrics against my personal baselines, so that the score reflects my individual physiology rather than population averages.

#### Acceptance Criteria

1. THE Readiness_Engine SHALL compute the HRV_Baseline as the arithmetic mean of the user's daily HRV values over the most recent 30 days of available data.
2. THE Readiness_Engine SHALL compute the Resting_HR_Baseline as the arithmetic mean of the user's daily resting heart rate values over the most recent 30 days of available data.
3. WHEN fewer than 7 days of HRV data are available, THE Readiness_Engine SHALL treat the HRV factor as absent and exclude the HRV component from the score.
4. WHEN fewer than 7 days of resting heart rate data are available, THE Readiness_Engine SHALL treat the resting HR factor as absent and exclude the resting HR component from the score.
5. THE Readiness_Engine SHALL recompute baselines each time a readiness score is requested, using the latest available data.

### Requirement 4: Readiness Score Computation

**User Story:** As a user, I want a single readiness score that combines all available recovery signals, so that I can quickly assess my recovery state at a glance.

#### Acceptance Criteria

1. THE Readiness_Engine SHALL compute the Readiness_Score as a weighted composite of up to six factors: HRV trend (vs HRV_Baseline), resting HR trend (vs Resting_HR_Baseline), sleep duration, sleep quality (user-reported), soreness (user-reported), and stress (user-reported).
2. THE Readiness_Engine SHALL use the following default weights: HRV trend 0.25, resting HR trend 0.15, sleep duration 0.20, sleep quality 0.15, soreness 0.15, stress 0.10.
3. WHEN one or more factors are absent, THE Readiness_Engine SHALL redistribute the absent factors' weights proportionally among the remaining present factors.
4. THE Readiness_Engine SHALL clamp the final Readiness_Score to the integer range [0, 100].
5. WHEN all factors are absent, THE Readiness_Engine SHALL return a null score indicating insufficient data.
6. THE Readiness_Engine SHALL normalize each factor to a 0–1 scale before applying weights, where 1.0 represents optimal recovery and 0.0 represents poor recovery.
7. THE Readiness_Engine SHALL compute the readiness score as a pure function with no side effects: given identical inputs, the output SHALL be identical.

### Requirement 5: Readiness Score Persistence and History

**User Story:** As a user, I want my daily readiness scores saved, so that I can track my recovery trends over time.

#### Acceptance Criteria

1. WHEN a readiness score is computed, THE Recovery_Checkin_Service SHALL persist the score along with the individual factor values, the date, and the user ID.
2. THE Recovery_Checkin_Service SHALL expose a GET endpoint that returns readiness score history for a user within a specified date range.
3. WHEN the history endpoint is called with an invalid date range (start after end), THE Recovery_Checkin_Service SHALL return a validation error.
4. THE Recovery_Checkin_Service SHALL serialize the readiness history response as JSON matching a defined Pydantic schema.

### Requirement 6: Dashboard Readiness Gauge

**User Story:** As a user, I want to see my readiness score on the dashboard as a visual gauge, so that I can assess my recovery state before deciding on today's workout.

#### Acceptance Criteria

1. WHEN a readiness score is available for the current day, THE Readiness_Gauge SHALL display the score as a circular gauge with the numeric value centered inside.
2. THE Readiness_Gauge SHALL color the gauge arc green for scores 70–100, yellow for scores 40–69, and red for scores 0–39.
3. WHEN no readiness score is available for the current day, THE Readiness_Gauge SHALL display a prompt inviting the user to complete a recovery check-in.
4. WHEN the user taps the Readiness_Gauge, THE Dashboard SHALL open the recovery check-in modal.
5. THE Factor_Breakdown SHALL display below the gauge showing each contributing factor's name and its normalized value.

### Requirement 7: Analytics Readiness Trend

**User Story:** As a user, I want to see my readiness score trend on the analytics screen, so that I can identify patterns in my recovery over time.

#### Acceptance Criteria

1. WHEN the analytics screen loads, THE Analytics_Screen SHALL fetch and display readiness scores for the selected date range as a line chart.
2. THE Analytics_Screen SHALL color-code data points on the readiness trend chart using the same color bands as the Readiness_Gauge (green 70–100, yellow 40–69, red 0–39).
3. WHEN fewer than 2 readiness scores exist in the selected range, THE Analytics_Screen SHALL display an empty state message indicating insufficient data for a trend.
