# Requirements Document

## Introduction

The Weekly Intelligence Report feature auto-generates a comprehensive weekly report that combines training metrics, nutrition metrics, and body metrics into one digestible, shareable view. The report ends with 2–3 actionable, personalized recommendations. Users can view the current week's report, browse historical reports, and share a visually appealing summary card to social media or save it as an image.

## Glossary

- **Report_Service**: The backend service responsible for aggregating weekly data and computing the intelligence report.
- **Recommendation_Engine**: The subsystem within Report_Service that generates personalized, actionable text recommendations from the aggregated metrics.
- **Report_Screen**: The React Native screen that displays the full weekly intelligence report.
- **Report_Card**: A visually styled summary card component designed for sharing or saving as an image.
- **ISO_Week**: A week defined by the ISO 8601 standard (Monday through Sunday).
- **MEV**: Minimum Effective Volume — the minimum number of weekly sets per muscle group to stimulate growth.
- **Compliance_Percentage**: The percentage of days in a week where the user's intake was within 5% of their caloric target.
- **TDEE_Delta**: The difference between the user's current adaptive TDEE and the previous week's TDEE.
- **Weight_Trend**: The change in bodyweight from the start to the end of a given ISO week, computed from bodyweight log entries.

## Requirements

### Requirement 1: Weekly Training Metrics Aggregation

**User Story:** As a user, I want to see my weekly training metrics summarized, so that I can understand my training volume, PRs, and muscle group distribution at a glance.

#### Acceptance Criteria

1. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL compute total training volume (sum of reps × weight_kg across all sets) for that week.
2. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL compute training volume broken down by muscle group using the existing exercise-to-muscle-group mapping.
3. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL return the count of training sessions logged during that week.
4. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL return a list of personal records detected during that week.
5. WHEN a report is requested for a given ISO_Week and the user has no training sessions, THE Report_Service SHALL return zero for all training metrics and an empty list for personal records.

### Requirement 2: Weekly Nutrition Metrics Aggregation

**User Story:** As a user, I want to see my weekly nutrition metrics summarized, so that I can evaluate my dietary adherence and macro compliance.

#### Acceptance Criteria

1. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL compute the average daily caloric intake from days with logged nutrition entries.
2. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL compute the average daily protein, carbs, and fat intake from days with logged nutrition entries.
3. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL compute the Compliance_Percentage as the fraction of days where total caloric intake was within 5% of the user's caloric target.
4. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL compute the TDEE_Delta by comparing the most recent adaptive snapshot's target calories to the previous week's snapshot target calories.
5. WHEN a report is requested for a given ISO_Week and the user has no nutrition entries, THE Report_Service SHALL return zero for all nutrition metrics and a Compliance_Percentage of zero.
6. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL return the number of days with logged nutrition entries.

### Requirement 3: Weekly Body Metrics Aggregation

**User Story:** As a user, I want to see my weekly body metrics summarized, so that I can track my weight trend over the week.

#### Acceptance Criteria

1. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL compute the Weight_Trend as the difference between the last and first bodyweight log entries of that week.
2. WHEN a report is requested for a given ISO_Week, THE Report_Service SHALL return the start-of-week and end-of-week bodyweight values.
3. WHEN a report is requested for a given ISO_Week and the user has fewer than two bodyweight entries, THE Report_Service SHALL return null for the Weight_Trend.

### Requirement 4: Recommendation Engine

**User Story:** As a user, I want to receive 2–3 actionable recommendations based on my weekly data, so that I can make informed adjustments to my training and nutrition.

#### Acceptance Criteria

1. WHEN a report is generated, THE Recommendation_Engine SHALL produce between 2 and 3 text recommendations.
2. WHEN a muscle group's weekly set count is below its MEV threshold, THE Recommendation_Engine SHALL generate a recommendation to increase volume for that muscle group, citing the current set count and the MEV value.
3. WHEN the user's Compliance_Percentage exceeds 85%, THE Recommendation_Engine SHALL generate a positive reinforcement recommendation acknowledging the compliance rate.
4. WHEN the user's Compliance_Percentage is below 60%, THE Recommendation_Engine SHALL generate a recommendation to improve nutritional consistency.
5. WHEN the Weight_Trend aligns with the user's goal direction (losing weight during a cut, gaining during a bulk), THE Recommendation_Engine SHALL generate a recommendation confirming the user is on track, citing the weekly weight change and goal.
6. WHEN the Weight_Trend opposes the user's goal direction, THE Recommendation_Engine SHALL generate a recommendation suggesting a caloric adjustment.
7. WHEN the user has no training data and no nutrition data for the week, THE Recommendation_Engine SHALL generate recommendations encouraging the user to start logging.

### Requirement 5: Report API Endpoint

**User Story:** As a frontend client, I want a single API endpoint to retrieve the weekly intelligence report, so that the report screen can fetch all data in one request.

#### Acceptance Criteria

1. THE Report_Service SHALL expose a GET endpoint that accepts a user ID and an ISO_Week identifier (year and week number).
2. WHEN the endpoint is called with a valid ISO_Week, THE Report_Service SHALL return a JSON response containing training metrics, nutrition metrics, body metrics, and recommendations.
3. WHEN the endpoint is called without an ISO_Week parameter, THE Report_Service SHALL default to the current ISO week.
4. IF the requested ISO_Week is in the future, THEN THE Report_Service SHALL return a 400 error with a descriptive message.
5. THE Report_Service SHALL serialize the report response as a JSON object matching the WeeklyReportResponse schema.

### Requirement 6: Report Screen

**User Story:** As a user, I want a dedicated screen to view my weekly intelligence report, so that I can review all my weekly metrics in one place.

#### Acceptance Criteria

1. WHEN the user navigates to the Report_Screen, THE Report_Screen SHALL fetch and display the current week's report.
2. THE Report_Screen SHALL display four sections: Training, Nutrition, Body, and Recommendations.
3. WHEN the report data is loading, THE Report_Screen SHALL display skeleton placeholders for each section.
4. WHEN the report contains no data for a section, THE Report_Screen SHALL display an appropriate empty state message for that section.
5. THE Report_Screen SHALL be accessible from both the analytics screen and the dashboard.

### Requirement 7: Shareable Report Card

**User Story:** As a user, I want to generate a shareable summary card from my weekly report, so that I can share my progress on social media or save it as an image.

#### Acceptance Criteria

1. WHEN the user taps a share button on the Report_Screen, THE Report_Card SHALL render a visually styled summary containing key metrics (total volume, session count, compliance percentage, weight trend, and top recommendation).
2. WHEN the Report_Card is generated, THE Report_Card SHALL be capturable as an image using React Native's view-to-image capability.
3. WHEN the user confirms sharing, THE Report_Screen SHALL invoke the platform's native share sheet with the captured image.
4. WHEN the user taps a save button, THE Report_Screen SHALL save the captured image to the device's photo library.

### Requirement 8: Historical Reports

**User Story:** As a user, I want to browse my past weekly reports, so that I can track my progress over time.

#### Acceptance Criteria

1. THE Report_Screen SHALL provide a week selector allowing the user to navigate to previous ISO weeks.
2. WHEN the user selects a different week, THE Report_Screen SHALL fetch and display the report for that week.
3. THE Report_Screen SHALL prevent the user from selecting a future week.
4. WHEN navigating between weeks, THE Report_Screen SHALL display a loading indicator while the new report is being fetched.

### Requirement 9: Report Data Serialization

**User Story:** As a developer, I want the report data to be serializable to and from JSON, so that it can be transmitted over the API and cached reliably.

#### Acceptance Criteria

1. FOR ALL valid WeeklyReportResponse objects, serializing to JSON and then deserializing SHALL produce an equivalent object (round-trip property).
2. THE WeeklyReportResponse schema SHALL validate that all numeric fields are non-negative.
3. THE WeeklyReportResponse schema SHALL validate that the recommendations list contains between 0 and 3 items.
