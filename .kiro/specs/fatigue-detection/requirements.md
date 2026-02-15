# Requirements Document

## Introduction

Fatigue Detection and Smart Deload Suggestions monitors performance trends across training sessions and proactively detects fatigue accumulation. The system tracks estimated one-rep max (e1RM) regression per exercise, computes per-muscle-group fatigue scores incorporating volume, frequency, and nutrition compliance, and generates actionable deload suggestions when fatigue thresholds are exceeded. Fatigue alerts surface on the dashboard and integrate with the existing analytics and muscle volume heat map views.

## Glossary

- **Fatigue_Detection_Service**: The backend service responsible for computing performance trends, fatigue scores, and deload suggestions from training session data.
- **e1RM**: Estimated one-rep max, calculated via the Epley formula: `weight_kg × (1 + reps / 30)`.
- **Performance_Regression**: A decline in the best-set e1RM for a given exercise across 2 or more consecutive training sessions.
- **Fatigue_Score**: A numeric value from 0 to 100 representing accumulated fatigue for a muscle group, where higher values indicate greater fatigue.
- **MRV**: Maximum Recoverable Volume — the upper volume landmark beyond which a muscle group cannot recover adequately.
- **Deload_Suggestion**: A proactive recommendation generated when a muscle group's fatigue score exceeds the configurable threshold.
- **Dashboard_Alert_Card**: A UI component on the dashboard screen that displays fatigue warnings for muscle groups with high fatigue scores.
- **Heat_Map_Overlay**: A visual layer on the muscle volume heat map that colors muscle groups by their fatigue score.
- **Nutrition_Compliance**: The ratio of actual caloric intake to the adaptive target over a rolling window, expressed as a percentage.

## Requirements

### Requirement 1: Performance Trend Tracking

**User Story:** As a lifter, I want the system to track my best set per exercise across sessions, so that I can see whether my strength is progressing or regressing.

#### Acceptance Criteria

1. WHEN a user has logged 2 or more training sessions containing the same exercise, THE Fatigue_Detection_Service SHALL compute the best-set e1RM for that exercise in each session using the Epley formula.
2. WHEN the best-set e1RM for an exercise declines for 2 or more consecutive sessions, THE Fatigue_Detection_Service SHALL flag that exercise as having a Performance_Regression.
3. WHEN an exercise has fewer than 2 sessions of history, THE Fatigue_Detection_Service SHALL report no regression status for that exercise.
4. THE Fatigue_Detection_Service SHALL only consider non-deleted training sessions when computing e1RM trends.

### Requirement 2: Fatigue Score Computation

**User Story:** As a lifter, I want a per-muscle-group fatigue score, so that I can understand which muscle groups are most fatigued and need recovery.

#### Acceptance Criteria

1. THE Fatigue_Detection_Service SHALL compute a Fatigue_Score for each muscle group as a weighted sum of: performance regression count, volume relative to MRV, and weekly training frequency.
2. THE Fatigue_Detection_Service SHALL clamp the Fatigue_Score to the range [0, 100].
3. WHEN Nutrition_Compliance data is available, THE Fatigue_Detection_Service SHALL incorporate a nutrition penalty into the Fatigue_Score, increasing the score when compliance falls below 80%.
4. WHEN Nutrition_Compliance data is unavailable, THE Fatigue_Detection_Service SHALL compute the Fatigue_Score using only training-based factors with no nutrition penalty.
5. THE Fatigue_Detection_Service SHALL use configurable weights for each factor in the fatigue score formula.

### Requirement 3: Deload Suggestion Generation

**User Story:** As a lifter, I want to receive a proactive suggestion when I should deload, so that I can avoid overtraining and optimize recovery.

#### Acceptance Criteria

1. WHEN a muscle group's Fatigue_Score exceeds the configurable threshold (default 70), THE Fatigue_Detection_Service SHALL generate a Deload_Suggestion for that muscle group.
2. THE Deload_Suggestion SHALL include the muscle group name, the current fatigue score, the percentage decline in e1RM for the most regressed exercise, and the number of sessions over which the decline occurred.
3. WHEN no muscle group's Fatigue_Score exceeds the threshold, THE Fatigue_Detection_Service SHALL return an empty list of suggestions.
4. IF the fatigue analysis endpoint receives an invalid user ID or date range, THEN THE Fatigue_Detection_Service SHALL return a descriptive error response.

### Requirement 4: Fatigue Analysis API

**User Story:** As a frontend developer, I want a single API endpoint that returns fatigue scores and deload suggestions, so that I can display fatigue data in the app.

#### Acceptance Criteria

1. THE Fatigue_Detection_Service SHALL expose a GET endpoint that accepts a user ID and a lookback window (default 28 days) and returns per-muscle-group fatigue scores and any active deload suggestions.
2. WHEN the endpoint is called, THE Fatigue_Detection_Service SHALL return the response within the same request cycle without requiring background jobs.
3. THE Fatigue_Detection_Service SHALL serialize the fatigue analysis response as JSON matching a defined Pydantic schema.

### Requirement 5: Dashboard Fatigue Alert

**User Story:** As a lifter, I want to see a fatigue warning on my dashboard when a muscle group is highly fatigued, so that I am alerted before my next workout.

#### Acceptance Criteria

1. WHEN the fatigue analysis returns one or more Deload_Suggestions, THE Dashboard_Alert_Card SHALL display a warning card showing the most fatigued muscle group and its suggestion text.
2. WHEN no Deload_Suggestions exist, THE Dashboard_Alert_Card SHALL not render on the dashboard.
3. WHEN the user taps the Dashboard_Alert_Card, THE Dashboard_Alert_Card SHALL navigate to the analytics screen for detailed fatigue data.

### Requirement 6: Analytics Fatigue Integration

**User Story:** As a lifter, I want to see fatigue scores on the analytics screen and heat map, so that I can visualize fatigue alongside my training volume data.

#### Acceptance Criteria

1. WHEN the analytics screen loads, THE Analytics_Screen SHALL fetch and display per-muscle-group fatigue scores alongside existing volume and strength data.
2. THE Heat_Map_Overlay SHALL color each muscle group on the heat map using a gradient from green (low fatigue, score 0-30) through yellow (moderate, 31-60) to red (high, 61-100).
3. WHEN a user taps a muscle group on the Heat_Map_Overlay, THE Analytics_Screen SHALL display the fatigue score breakdown showing individual factor contributions.
