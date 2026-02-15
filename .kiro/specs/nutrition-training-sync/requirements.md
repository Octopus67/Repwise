# Requirements Document

## Introduction

The Nutrition-Training Sync Engine automatically adjusts daily calorie and macro targets based on training activity. It connects the existing adaptive TDEE engine with training session data to produce intelligent, day-specific nutrition targets. Training days receive higher calories (especially carbs for glycogen replenishment), while rest days receive maintenance or slight deficit targets. The system accounts for muscle group demands, session volume, and training phase to produce the most contextually accurate daily targets in the market.

## Glossary

- **Sync_Engine**: The backend service that computes daily adjusted calorie and macro targets by combining adaptive TDEE baseline data with training session data.
- **Baseline_Targets**: The weekly calorie and macro targets produced by the existing adaptive TDEE engine (`compute_snapshot`), representing the user's average daily needs.
- **Adjusted_Targets**: The daily calorie and macro targets produced by the Sync_Engine after applying training-day modifiers to the Baseline_Targets.
- **Training_Day**: A calendar day on which the user has logged a training session or has a scheduled session from a workout template.
- **Rest_Day**: A calendar day on which no training session is logged and none is scheduled.
- **Session_Volume**: The total mechanical work in a training session, calculated as the sum of (sets × reps × weight_kg) across all exercises.
- **Muscle_Group_Demand**: A classification of how glycogen-intensive a training session is, derived from the muscle groups trained (e.g., legs and compound movements have higher demand than upper-body isolation).
- **Volume_Multiplier**: A scaling factor derived from Session_Volume that increases or decreases the calorie adjustment relative to a reference volume.
- **Carb_Shift_Ratio**: The proportion of the calorie adjustment allocated to carbohydrates versus protein and fat.
- **Training_Phase**: The current periodization phase (accumulation, intensification, deload) that modulates overall calorie targets.
- **User_Override**: A manual override set by the user for a specific day's Adjusted_Targets, which takes precedence over the Sync_Engine computation.
- **Day_Classification**: The label assigned to a day (Training_Day or Rest_Day) along with metadata about why the classification was made.
- **Dashboard_Indicator**: A visual element on the frontend dashboard that displays the Day_Classification and explains the target adjustment.

## Requirements

### Requirement 1: Training Day vs Rest Day Detection

**User Story:** As a user, I want the system to automatically detect whether today is a training day or rest day, so that my calorie targets reflect my actual activity.

#### Acceptance Criteria

1. WHEN a user has logged a training session for a given date, THE Sync_Engine SHALL classify that date as a Training_Day.
2. WHEN a user has a scheduled session from a workout template for a given date and no session is logged, THE Sync_Engine SHALL classify that date as a Training_Day.
3. WHEN no training session is logged and no session is scheduled for a given date, THE Sync_Engine SHALL classify that date as a Rest_Day.
4. WHEN a date is classified as a Training_Day, THE Sync_Engine SHALL increase the Baseline_Targets calories by a configurable training-day surplus (default: +15% of Baseline_Targets calories).
5. WHEN a date is classified as a Rest_Day, THE Sync_Engine SHALL apply the Baseline_Targets calories with a configurable rest-day modifier (default: -5% of Baseline_Targets calories).
6. WHEN the Day_Classification changes for a date (e.g., a session is logged on a previously Rest_Day), THE Sync_Engine SHALL recompute the Adjusted_Targets for that date.

### Requirement 2: Muscle Group-Aware Carb Adjustment

**User Story:** As a user, I want my carb targets to be higher on leg days and high-volume compound sessions, so that I have adequate glycogen for demanding workouts.

#### Acceptance Criteria

1. THE Sync_Engine SHALL assign a Muscle_Group_Demand score to each training session based on the muscle groups trained.
2. WHEN a training session includes exercises targeting quads, hamstrings, or glutes, THE Sync_Engine SHALL assign a higher Muscle_Group_Demand score than sessions targeting only upper-body isolation groups.
3. WHEN a training session includes compound exercises, THE Sync_Engine SHALL increase the Muscle_Group_Demand score proportionally to the number of compound exercises.
4. WHEN computing Adjusted_Targets for a Training_Day, THE Sync_Engine SHALL allocate a larger proportion of the calorie surplus to carbohydrates for sessions with higher Muscle_Group_Demand scores (Carb_Shift_Ratio increases with demand).
5. WHEN computing Adjusted_Targets for a Training_Day, THE Sync_Engine SHALL maintain protein targets at or above the Baseline_Targets protein value regardless of Muscle_Group_Demand.

### Requirement 3: Volume-Based Calorie Scaling

**User Story:** As a user, I want my daily calorie target to scale with how much total volume I performed, so that higher-effort sessions are matched with more recovery fuel.

#### Acceptance Criteria

1. WHEN a training session is logged, THE Sync_Engine SHALL compute the Session_Volume as the sum of (reps × weight_kg) for each set across all exercises.
2. THE Sync_Engine SHALL compute a Volume_Multiplier by comparing the Session_Volume to a rolling 4-week average session volume for the user.
3. WHEN the Session_Volume exceeds the rolling average by more than 20%, THE Sync_Engine SHALL scale the training-day calorie surplus upward proportionally (Volume_Multiplier > 1.0).
4. WHEN the Session_Volume is below the rolling average by more than 20%, THE Sync_Engine SHALL scale the training-day calorie surplus downward proportionally (Volume_Multiplier < 1.0).
5. THE Sync_Engine SHALL clamp the Volume_Multiplier between 0.7 and 1.5 to prevent extreme adjustments.

### Requirement 4: Training Phase Alignment

**User Story:** As a user, I want my calorie targets to reflect my current training phase, so that accumulation phases support growth and deload weeks avoid unnecessary surplus.

#### Acceptance Criteria

1. THE Sync_Engine SHALL accept a Training_Phase parameter with values: accumulation, intensification, deload, or none.
2. WHILE the Training_Phase is accumulation, THE Sync_Engine SHALL add a phase bonus of +5% to the Adjusted_Targets calories.
3. WHILE the Training_Phase is deload, THE Sync_Engine SHALL reduce the Adjusted_Targets calories to Baseline_Targets (removing any training-day surplus).
4. WHILE the Training_Phase is intensification or none, THE Sync_Engine SHALL apply no phase modifier to the Adjusted_Targets calories.

### Requirement 5: User Override

**User Story:** As a user, I want to manually override the auto-adjusted targets for any day, so that I remain in control of my nutrition.

#### Acceptance Criteria

1. WHEN a user sets a User_Override for a specific date, THE Sync_Engine SHALL return the User_Override values as the Adjusted_Targets for that date.
2. WHEN a User_Override exists for a date, THE Sync_Engine SHALL include the original computed Adjusted_Targets alongside the override in the API response so the user can see what the system recommended.
3. WHEN a user removes a User_Override for a date, THE Sync_Engine SHALL revert to the computed Adjusted_Targets for that date.
4. THE Sync_Engine SHALL persist User_Override values per user per date.

### Requirement 6: Adjusted Targets API

**User Story:** As a frontend developer, I want a single API endpoint that returns today's adjusted targets with full context, so that the dashboard can display accurate information.

#### Acceptance Criteria

1. WHEN the API endpoint is called with a date parameter, THE Sync_Engine SHALL return the Adjusted_Targets (calories, protein_g, carbs_g, fat_g) for that date.
2. WHEN the API endpoint is called, THE Sync_Engine SHALL include the Day_Classification (Training_Day or Rest_Day) and the reason for the classification in the response.
3. WHEN the API endpoint is called, THE Sync_Engine SHALL include the Baseline_Targets, the Volume_Multiplier, the Muscle_Group_Demand score, and the Training_Phase in the response.
4. WHEN the API endpoint is called and a User_Override exists for the requested date, THE Sync_Engine SHALL include both the override values and the computed values in the response.
5. IF the Baseline_Targets are unavailable (no adaptive snapshot exists), THEN THE Sync_Engine SHALL return an error indicating that the user must generate an adaptive snapshot first.

### Requirement 7: Dashboard Integration

**User Story:** As a user, I want the dashboard to show my adjusted targets for today with a clear indicator of whether it's a training day or rest day, so that I understand why my targets differ from my baseline.

#### Acceptance Criteria

1. WHEN the DashboardScreen loads, THE Dashboard_Indicator SHALL display the Day_Classification label (Training Day or Rest Day) alongside the Adjusted_Targets.
2. WHEN the Adjusted_Targets differ from the Baseline_Targets, THE Dashboard_Indicator SHALL show a brief explanation of the adjustment (e.g., "Leg day +180 kcal").
3. WHEN the BudgetBar renders, THE BudgetBar SHALL use the Adjusted_Targets instead of the Baseline_Targets for progress calculation.
4. WHEN the MacroRingsRow renders, THE MacroRingsRow SHALL use the Adjusted_Targets instead of the Baseline_Targets for ring fill calculation.
5. WHEN a User_Override is active for the displayed date, THE Dashboard_Indicator SHALL show a visual marker indicating manual override is active.

### Requirement 8: Adjusted Targets Serialization

**User Story:** As a developer, I want the adjusted targets response to be serializable and deserializable without data loss, so that caching and persistence work correctly.

#### Acceptance Criteria

1. THE Sync_Engine SHALL serialize Adjusted_Targets responses to JSON format.
2. FOR ALL valid Adjusted_Targets responses, serializing to JSON and then deserializing SHALL produce an equivalent object (round-trip property).
