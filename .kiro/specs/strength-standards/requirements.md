# Requirements Document

## Introduction

This feature adds estimated one-rep max (e1RM) calculation, e1RM trend tracking, strength standards classification, motivational milestones, and a personal strength leaderboard to Hypertrophy OS. Users can see their estimated 1RM for every exercise, track how it changes over time, understand where they rank against established strength standards, and receive motivational messages about upcoming milestones.

## Glossary

- **E1RM_Calculator**: The pure computation module that estimates a one-rep max from a given weight and rep count using established formulas (Epley, Brzycki, Lombardi).
- **Strength_Standards_Engine**: The module that classifies a user's e1RM into strength levels (beginner, intermediate, advanced, elite) based on bodyweight ratio thresholds for supported compound lifts.
- **Milestone_Generator**: The module that computes motivational milestone messages by comparing a user's current e1RM against the next strength level threshold.
- **Strength_Leaderboard**: The component that ranks a user's lifts by their strength level relative to standards, identifying strongest and weakest lifts.
- **Analytics_Service**: The existing backend service that computes training volume, strength progression, and muscle group frequency metrics.
- **TrendLineChart**: The existing frontend chart component used to render time-series data.
- **Strength_Level**: One of four tiers — beginner, intermediate, advanced, elite — defined by bodyweight multiplier thresholds per exercise.
- **Bodyweight_Ratio**: The ratio of a user's e1RM to their most recent bodyweight (e1RM / bodyweight_kg).
- **Supported_Lift**: A compound lift that has defined strength standard thresholds: barbell bench press, barbell back squat, conventional deadlift, overhead press, and barbell row.

## Requirements

### Requirement 1: Estimated 1RM Calculation

**User Story:** As a lifter, I want to see my estimated one-rep max for every completed set, so that I can gauge my true strength without needing to test a 1RM directly.

#### Acceptance Criteria

1. WHEN a set with weight_kg > 0 and reps between 1 and 30 is provided, THE E1RM_Calculator SHALL compute the Epley estimate as `weight_kg × (1 + reps / 30)`.
2. WHEN a set with weight_kg > 0 and reps between 1 and 30 is provided, THE E1RM_Calculator SHALL compute the Brzycki estimate as `weight_kg × 36 / (37 - reps)`.
3. WHEN a set with weight_kg > 0 and reps between 1 and 30 is provided, THE E1RM_Calculator SHALL compute the Lombardi estimate as `weight_kg × reps^0.10`.
4. WHEN reps equals 1, THE E1RM_Calculator SHALL return the weight_kg as the e1RM for all formulas.
5. WHEN reps is 0 or weight_kg is 0, THE E1RM_Calculator SHALL return 0 for all formulas.
6. WHEN reps exceeds 30, THE E1RM_Calculator SHALL still compute a result but flag the estimate as low confidence.
7. THE E1RM_Calculator SHALL use the Epley formula as the primary estimate and Brzycki as the secondary estimate.
8. WHEN multiple sets exist for an exercise in a session, THE Analytics_Service SHALL select the set with the highest Epley e1RM as the session best for that exercise.

### Requirement 2: e1RM Trend Tracking

**User Story:** As a lifter, I want to see how my estimated 1RM changes over time for each exercise, so that I can track my strength progression beyond just weight PRs.

#### Acceptance Criteria

1. THE Analytics_Service SHALL compute and return the best e1RM per exercise per session for a given date range.
2. WHEN a user requests e1RM history for an exercise, THE Analytics_Service SHALL return a time series of (date, e1RM_value) points sorted by date ascending.
3. WHEN no sessions contain the requested exercise in the date range, THE Analytics_Service SHALL return an empty list.
4. WHEN the e1RM trend chart is displayed, THE TrendLineChart SHALL render the e1RM time series with the existing chart styling and time range selector.
5. WHEN a user selects an exercise from the exercise picker on the analytics screen, THE Analytics_Service SHALL return e1RM data for that specific exercise.

### Requirement 3: Strength Standards Classification

**User Story:** As a lifter, I want to know where I rank against established strength standards, so that I can set meaningful goals and understand my progress relative to benchmarks.

#### Acceptance Criteria

1. THE Strength_Standards_Engine SHALL define bodyweight multiplier thresholds for each Supported_Lift at each Strength_Level (beginner, intermediate, advanced, elite).
2. WHEN a user's e1RM and bodyweight are provided for a Supported_Lift, THE Strength_Standards_Engine SHALL compute the Bodyweight_Ratio and classify the user into the appropriate Strength_Level.
3. WHEN a user's Bodyweight_Ratio falls below the beginner threshold, THE Strength_Standards_Engine SHALL classify the user as "beginner".
4. WHEN a user's Bodyweight_Ratio meets or exceeds the elite threshold, THE Strength_Standards_Engine SHALL classify the user as "elite".
5. WHEN no bodyweight data exists for the user, THE Strength_Standards_Engine SHALL return a classification of "unknown" with a message prompting the user to log bodyweight.
6. WHEN no e1RM data exists for a Supported_Lift, THE Strength_Standards_Engine SHALL omit that lift from the classification results.
7. THE Strength_Standards_Engine SHALL store strength standard thresholds as static configuration data, not in the database.

### Requirement 4: Milestone Notifications

**User Story:** As a lifter, I want motivational messages telling me how close I am to the next strength level, so that I stay motivated and have clear short-term goals.

#### Acceptance Criteria

1. WHEN a user's current e1RM for a Supported_Lift is below the next Strength_Level threshold, THE Milestone_Generator SHALL compute the weight deficit to the next level.
2. WHEN a milestone message is generated, THE Milestone_Generator SHALL format the message as "You're {deficit} away from {next_level} {exercise_name}" using the user's preferred unit system.
3. WHEN a user has reached the elite level for a Supported_Lift, THE Milestone_Generator SHALL generate a congratulatory message instead of a deficit message.
4. WHEN no bodyweight data exists, THE Milestone_Generator SHALL omit milestone messages for all lifts.
5. THE Milestone_Generator SHALL return milestone messages sorted by smallest deficit first, so the closest milestone appears first.

### Requirement 5: Personal Strength Leaderboard

**User Story:** As a lifter, I want to see which of my lifts are strongest and weakest relative to strength standards, so that I can identify imbalances and prioritize training.

#### Acceptance Criteria

1. THE Strength_Leaderboard SHALL rank all Supported_Lifts by the user's Bodyweight_Ratio in descending order.
2. WHEN displaying the leaderboard, THE Strength_Leaderboard SHALL show the exercise name, current e1RM, Bodyweight_Ratio, and Strength_Level for each lift.
3. WHEN a Supported_Lift has no e1RM data, THE Strength_Leaderboard SHALL display that lift with a "No data" indicator at the bottom of the ranking.
4. WHEN the user has data for at least two Supported_Lifts, THE Strength_Leaderboard SHALL visually highlight the strongest lift and the weakest lift with data.

### Requirement 6: Backend API

**User Story:** As a frontend developer, I want API endpoints for e1RM history and strength classification, so that the mobile app can display this data.

#### Acceptance Criteria

1. WHEN a GET request is made to the e1RM history endpoint with exercise_name, start_date, and end_date parameters, THE Analytics_Service SHALL return a list of e1RM data points for that exercise and date range.
2. WHEN a GET request is made to the strength standards endpoint, THE Analytics_Service SHALL return the user's strength classification for all Supported_Lifts along with milestone messages.
3. IF an unauthenticated request is made to any strength standards endpoint, THEN THE Analytics_Service SHALL return a 401 Unauthorized response.
4. IF an invalid date range is provided (start_date > end_date), THEN THE Analytics_Service SHALL return a 400 Bad Request response.

### Requirement 7: Frontend Integration

**User Story:** As a user, I want to see my e1RM data, strength standards, and milestones in the app, so that I can access this information during and after workouts.

#### Acceptance Criteria

1. WHEN viewing a training session detail, THE session detail view SHALL display the best e1RM for each exercise in that session.
2. WHEN viewing the analytics screen, THE analytics screen SHALL include an e1RM trend chart section with an exercise selector.
3. WHEN viewing the analytics screen, THE analytics screen SHALL include a strength standards card showing the user's classification for each Supported_Lift.
4. WHEN viewing the dashboard, THE dashboard SHALL display the most relevant milestone message (closest to next level).
5. WHEN the user has no bodyweight data, THE strength standards card SHALL display a prompt to log bodyweight instead of classification data.
