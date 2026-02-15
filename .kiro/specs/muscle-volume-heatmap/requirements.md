# Requirements Document

## Introduction

The Muscle Group Volume Tracker and Heat Map feature computes weekly training volume per muscle group from logged sessions, compares volume against evidence-based landmarks (MEV, MAV, MRV), and displays the results as an interactive SVG body diagram heat map. Users can identify undertrained, optimally trained, and overtrained muscle groups at a glance, drill down into per-muscle-group exercise details, and customize their volume landmarks.

## Glossary

- **Volume_Calculator**: The backend service that computes weekly effective sets per muscle group from logged training sessions
- **Landmark_Store**: The data layer that stores and retrieves volume landmark thresholds (MEV, MAV, MRV) per muscle group, including user customizations
- **Heat_Map_Renderer**: The frontend SVG component that renders front and back body diagrams with color-coded muscle groups
- **Drill_Down_Modal**: The modal overlay that displays detailed exercise, set, and volume data for a selected muscle group
- **Analytics_Integration**: The section/card within the existing AnalyticsScreen that hosts the heat map
- **MEV**: Minimum Effective Volume — the minimum number of weekly sets needed to stimulate growth for a muscle group
- **MAV**: Maximum Adaptive Volume — the upper range of optimal weekly sets for a muscle group
- **MRV**: Maximum Recoverable Volume — the maximum weekly sets a muscle group can recover from
- **RIR**: Reps In Reserve — how many more reps could have been performed; used to weight set effort
- **RPE**: Rate of Perceived Exertion — a 0–10 scale where RPE 10 means failure (RIR = 0)
- **Effective_Set**: A working set (non-warm-up) weighted by proximity to failure using the RIR adjustment factor
- **Volume_Status**: A categorical classification of a muscle group's weekly volume relative to its landmarks: "below_mev", "optimal", "approaching_mrv", or "above_mrv"
- **Week_Boundary**: An ISO 8601 week starting on Monday and ending on Sunday, used to aggregate volume

## Requirements

### Requirement 1: Weekly Volume Computation

**User Story:** As a user, I want the system to compute my weekly effective sets per muscle group from my logged training sessions, so that I can see how much volume each muscle group is receiving.

#### Acceptance Criteria

1. WHEN a user requests weekly volume data for a date range, THE Volume_Calculator SHALL aggregate all non-warm-up sets per muscle group per ISO week from logged training sessions within that range
2. WHEN computing effective sets, THE Volume_Calculator SHALL exclude sets where set_type equals "warm-up"
3. WHEN a set has an RPE value, THE Volume_Calculator SHALL compute the RIR-adjusted effort as: effort = 1.0 if RPE >= 8, effort = 0.75 if RPE >= 6 and RPE < 8, effort = 0.5 if RPE < 6
4. WHEN a set has no RPE value, THE Volume_Calculator SHALL count the set as 1.0 effective set
5. WHEN an exercise maps to a muscle group via the exercise mapping, THE Volume_Calculator SHALL attribute the computed effort to that muscle group
6. WHEN an exercise does not map to any known muscle group, THE Volume_Calculator SHALL attribute the effort to the "Other" group

### Requirement 2: Volume Landmarks

**User Story:** As a user, I want evidence-based volume landmarks (MEV, MAV, MRV) for each muscle group, so that I can understand whether my training volume is sufficient, optimal, or excessive.

#### Acceptance Criteria

1. THE Landmark_Store SHALL provide default MEV, MAV, and MRV values (in sets per week) for each muscle group: chest (10, 16, 22), back (10, 18, 24), shoulders (8, 16, 22), quads (8, 16, 22), hamstrings (6, 12, 18), glutes (4, 12, 18), biceps (6, 14, 20), triceps (6, 12, 18), calves (6, 12, 16), abs (4, 10, 16), traps (4, 10, 16), forearms (4, 8, 14)
2. WHEN a user customizes landmark values for a muscle group, THE Landmark_Store SHALL persist the custom values and use them instead of defaults for that user
3. WHEN returning landmarks for a user, THE Landmark_Store SHALL merge default values with any user-customized values, preferring user values where they exist
4. THE Landmark_Store SHALL validate that MEV < MAV < MRV for any landmark configuration
5. THE Landmark_Store SHALL validate that all landmark values are non-negative integers

### Requirement 3: Volume Status Classification

**User Story:** As a user, I want each muscle group classified by volume status relative to my landmarks, so that I can quickly identify undertrained and overtrained muscles.

#### Acceptance Criteria

1. WHEN weekly effective sets for a muscle group are below MEV, THE Volume_Calculator SHALL classify the Volume_Status as "below_mev"
2. WHEN weekly effective sets are at or above MEV and at or below MAV, THE Volume_Calculator SHALL classify the Volume_Status as "optimal"
3. WHEN weekly effective sets are above MAV and at or below MRV, THE Volume_Calculator SHALL classify the Volume_Status as "approaching_mrv"
4. WHEN weekly effective sets are above MRV, THE Volume_Calculator SHALL classify the Volume_Status as "above_mrv"
5. WHEN a muscle group has zero logged sets in a week, THE Volume_Calculator SHALL classify the Volume_Status as "below_mev"

### Requirement 4: Heat Map Visualization

**User Story:** As a user, I want to see an interactive body diagram heat map showing my muscle group volume status, so that I can visually assess my training balance.

#### Acceptance Criteria

1. THE Heat_Map_Renderer SHALL display a front-view and back-view SVG body diagram with distinct regions for each muscle group
2. WHEN rendering a muscle group region, THE Heat_Map_Renderer SHALL color it based on Volume_Status: gray (#6B7280) for "below_mev", green (#22C55E) for "optimal", yellow (#EAB308) for "approaching_mrv", red (#EF4444) for "above_mrv"
3. WHEN the user taps a muscle group region on the heat map, THE Heat_Map_Renderer SHALL open the Drill_Down_Modal for that muscle group
4. THE Heat_Map_Renderer SHALL include a color legend mapping each color to its Volume_Status label
5. WHEN volume data is loading, THE Heat_Map_Renderer SHALL display a skeleton placeholder matching the body diagram dimensions
6. WHEN no training data exists for the selected week, THE Heat_Map_Renderer SHALL render all muscle groups in gray with a message indicating no data

### Requirement 5: Frequency Tracking

**User Story:** As a user, I want to see how many times per week each muscle group is trained alongside the set count, so that I can evaluate my training frequency distribution.

#### Acceptance Criteria

1. WHEN displaying muscle group data, THE Volume_Calculator SHALL compute the number of distinct training sessions per muscle group per week
2. WHEN presenting frequency data, THE Heat_Map_Renderer SHALL display the frequency and total effective sets in the format "{muscle_group}: {frequency}×/week, {sets} sets" (e.g., "Chest: 2×/week, 14 sets")
3. WHEN a muscle group has zero sessions in a week, THE Heat_Map_Renderer SHALL display "0×/week, 0 sets" for that muscle group

### Requirement 6: Drill-Down Detail

**User Story:** As a user, I want to tap a muscle group on the heat map and see all exercises, sets, and volume contributing to that group in the current week, so that I can understand exactly where my volume comes from.

#### Acceptance Criteria

1. WHEN the user taps a muscle group, THE Drill_Down_Modal SHALL display the muscle group name, total effective sets, Volume_Status label, and the MEV/MAV/MRV landmark values
2. WHEN listing exercises in the Drill_Down_Modal, THE Drill_Down_Modal SHALL show each exercise name, the number of working sets, and the summed effective sets for that exercise
3. WHEN listing sets for an exercise, THE Drill_Down_Modal SHALL show weight, reps, RPE (if available), and the computed effort contribution for each set
4. WHEN the user dismisses the Drill_Down_Modal, THE Drill_Down_Modal SHALL close and return focus to the heat map
5. IF no exercises exist for the selected muscle group in the current week, THEN THE Drill_Down_Modal SHALL display an empty state message indicating no training data

### Requirement 7: Analytics Screen Integration

**User Story:** As a user, I want the heat map to appear as a section on the existing Analytics screen, so that I can view it alongside my other training and nutrition analytics.

#### Acceptance Criteria

1. THE Analytics_Integration SHALL add a "Muscle Volume Heat Map" card/section to the AnalyticsScreen between the Training Volume and Strength Progression sections
2. WHEN the Analytics screen loads, THE Analytics_Integration SHALL fetch weekly volume data for the current ISO week
3. THE Analytics_Integration SHALL include week navigation controls allowing the user to view previous and next weeks
4. WHEN the user navigates to a different week, THE Analytics_Integration SHALL fetch and display volume data for the selected week
5. IF the selected week is the current week, THEN THE Analytics_Integration SHALL disable the "next week" navigation control

### Requirement 8: Backend API Endpoint

**User Story:** As a frontend developer, I want a backend API endpoint that returns weekly muscle group volume with landmark comparisons, so that the heat map can be rendered from structured data.

#### Acceptance Criteria

1. WHEN the frontend requests GET /training/analytics/muscle-volume with week_start query parameter, THE Volume_Calculator SHALL return a response containing weekly volume data for each muscle group
2. THE Volume_Calculator SHALL include in each muscle group response: muscle_group name, effective_sets count, frequency count, volume_status classification, and the applicable MEV, MAV, MRV landmark values
3. WHEN the week_start parameter is omitted, THE Volume_Calculator SHALL default to the current ISO week
4. IF the week_start parameter is not a valid Monday date, THEN THE Volume_Calculator SHALL return a 422 validation error with a descriptive message
5. WHEN the frontend requests GET /training/analytics/muscle-volume/{muscle_group}/detail with week_start parameter, THE Volume_Calculator SHALL return per-exercise breakdown with individual set data for that muscle group

### Requirement 9: Volume Landmark Customization API

**User Story:** As a user, I want to customize my volume landmarks through the API, so that I can adjust thresholds to match my training experience and recovery capacity.

#### Acceptance Criteria

1. WHEN the frontend sends PUT /training/analytics/volume-landmarks with a muscle group and custom MEV, MAV, MRV values, THE Landmark_Store SHALL persist the custom landmarks for the authenticated user
2. WHEN the frontend sends GET /training/analytics/volume-landmarks, THE Landmark_Store SHALL return the merged landmark configuration (defaults overridden by user customizations) for the authenticated user
3. IF the submitted landmark values violate MEV < MAV < MRV, THEN THE Landmark_Store SHALL return a 422 validation error
4. IF any submitted landmark value is negative, THEN THE Landmark_Store SHALL return a 422 validation error
5. WHEN the frontend sends DELETE /training/analytics/volume-landmarks/{muscle_group}, THE Landmark_Store SHALL remove the user's custom landmarks for that muscle group and revert to defaults

### Requirement 10: Volume Data Serialization

**User Story:** As a developer, I want the volume data to be serialized and deserialized consistently, so that data integrity is maintained between backend and frontend.

#### Acceptance Criteria

1. WHEN the backend serializes weekly volume data to JSON, THE Volume_Calculator SHALL produce a valid JSON response matching the defined schema
2. WHEN the frontend deserializes the JSON response, THE Analytics_Integration SHALL reconstruct equivalent volume data objects
3. FOR ALL valid volume data objects, serializing to JSON then deserializing SHALL produce an equivalent object (round-trip property)
