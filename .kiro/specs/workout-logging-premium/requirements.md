# Requirements Document

## Introduction

This specification defines the complete redesign of the workout logging experience — the active workout screen where users add exercises, log sets (reps/weight/RPE/RIR), use rest timers, and finish workouts. The goal is to transform the current developer-prototype-level screen into a premium, competition-beating experience across four layers: Speed (match Strong/Hevy at 2-3 taps per set), Intelligence (progressive overload suggestions, live volume tracking, PR detection), Experience (emotional design with visual feedback, floating rest timer, celebrations), and Advanced Features (supersets, plate calculator, crash recovery, warm-up generator). The redesign builds on the existing backend capabilities (PR detection, volume landmarks, batch previous performance API) while fundamentally rethinking the frontend interaction model.

## Glossary

- **Workout_Logger**: The active workout screen component where users log exercises and sets during a workout session
- **Set_Row**: A single row in the exercise card representing one set with fields for reps, weight, RPE/RIR, and set type
- **Rest_Timer_Bar**: A floating bar docked to the bottom of the workout screen showing a circular SVG progress ring countdown
- **Previous_Performance_Display**: Inline display of the user's most recent session data (weight × reps) next to each set row
- **Overload_Suggestion_Engine**: Backend service that computes progressive overload recommendations based on recent performance trends
- **Volume_Tracker**: Component displaying weekly muscle group set counts relative to volume landmarks (MAV range) during the workout
- **PR_Detector**: Existing backend service that identifies personal records when a session is saved
- **Plate_Calculator**: Utility that computes the plate breakdown per side for a given barbell weight
- **Warm_Up_Generator**: Utility that auto-suggests warm-up sets ramping to a target working weight
- **Crash_Recovery_Store**: AsyncStorage-based persistence layer that saves active workout state for recovery after app interruption
- **Exercise_Picker_Sheet**: Bottom sheet component for selecting exercises, replacing the current full-screen navigation
- **Finish_Confirmation_Sheet**: Bottom sheet shown before saving a workout, displaying a summary with total volume, PRs, and duration
- **Superset_Group**: A visual and logical grouping of two or more exercises that share a rest timer and are performed in alternation
- **Set_Entry**: Backend Pydantic schema representing a single set with reps, weight_kg, rpe, rir, and set_type fields
- **Unit_System**: User preference for metric (kg) or imperial (lbs) weight display, stored in profile preferences

## Requirements

### Requirement 1: Inline Previous Performance and Tap-to-Copy

**User Story:** As a lifter, I want to see what I did last session inline next to each set row and copy those values with one tap, so that I can log sets in 2-3 taps instead of 5-7.

#### Acceptance Criteria

1. WHEN an exercise is added to the Workout_Logger, THE Previous_Performance_Display SHALL fetch and show the previous session's weight × reps for each set inline next to the corresponding Set_Row
2. WHEN a user taps the Previous_Performance_Display values for a set, THE Workout_Logger SHALL auto-fill that Set_Row's weight and reps fields with the previous session's values
3. WHEN a workout is loaded from a template or "Copy Last Workout," THE Workout_Logger SHALL pre-fill all Set_Row weight and reps fields from the most recent session data for each exercise
4. IF no previous performance data exists for an exercise, THEN THE Previous_Performance_Display SHALL show a placeholder indicating no prior data is available
5. WHEN previous performance values are displayed, THE Previous_Performance_Display SHALL convert weight values to the user's preferred Unit_System before display

### Requirement 2: Per-Set Completion and Visual Feedback

**User Story:** As a lifter, I want to confirm each set with a single tap and see clear visual distinction between completed and uncompleted sets, so that I can track my progress through the workout at a glance.

#### Acceptance Criteria

1. WHEN a user taps the confirm button on a Set_Row, THE Workout_Logger SHALL mark that set as completed and apply a green background tint with a left border accent to the Set_Row
2. WHILE a Set_Row is uncompleted, THE Workout_Logger SHALL display the Set_Row with a muted/dimmed appearance
3. WHEN a set is marked as completed, THE Workout_Logger SHALL auto-start the Rest_Timer_Bar for that exercise
4. WHEN a set is completed, THE Workout_Logger SHALL update the per-exercise progress indicator to show the current count (e.g., "2/4 sets ●●○○")
5. WHEN a user taps a completed Set_Row's values, THE Workout_Logger SHALL allow inline editing without requiring the user to un-complete the set first

### Requirement 3: Weight Input Controls

**User Story:** As a lifter, I want stepper buttons on the weight field and auto-advancing keyboard focus, so that I can adjust weights quickly without excessive typing.

#### Acceptance Criteria

1. WHEN a user taps the increment button on a weight field, THE Workout_Logger SHALL increase the weight value by 2.5 kg (metric) or 5 lbs (imperial) based on the user's Unit_System preference
2. WHEN a user taps the decrement button on a weight field, THE Workout_Logger SHALL decrease the weight value by 2.5 kg (metric) or 5 lbs (imperial), with a minimum of 0
3. WHEN a user completes input in the reps field, THE Workout_Logger SHALL auto-advance keyboard focus to the weight field
4. WHEN a user completes input in the weight field and RPE/RIR is visible, THE Workout_Logger SHALL auto-advance keyboard focus to the RPE/RIR field
5. THE Workout_Logger SHALL display all weight values in the user's preferred Unit_System and store all values internally in kilograms

### Requirement 4: Progressive Overload Suggestions

**User Story:** As a lifter, I want to see science-based progressive overload suggestions inline during my workout, so that I know exactly what to aim for to keep progressing.

#### Acceptance Criteria

1. WHEN an exercise has sufficient previous performance history (at least 2 sessions), THE Overload_Suggestion_Engine SHALL compute and display an inline suggestion badge (e.g., "💡 Try 27.5kg × 10 (+2.5kg)")
2. THE Overload_Suggestion_Engine SHALL compute suggestions based on the user's recent performance trend across the last 3-5 sessions for that exercise
3. THE Overload_Suggestion_Engine SHALL produce suggested weights that are non-negative and align to standard plate increments (2.5 kg / 5 lbs minimum increment)
4. IF the user has only one previous session for an exercise, THEN THE Overload_Suggestion_Engine SHALL suggest maintaining the same weight with one additional rep
5. THE Overload_Suggestion_Engine SHALL include a confidence level (high, medium, low) with each suggestion based on data availability and trend consistency
6. WHEN overload suggestions are displayed, THE Overload_Suggestion_Engine SHALL convert suggested weights to the user's preferred Unit_System

### Requirement 5: Live Volume Tracking

**User Story:** As a lifter, I want to see my weekly muscle group volume during the workout, so that I can make informed decisions about how many sets to do.

#### Acceptance Criteria

1. WHILE a workout is in progress, THE Volume_Tracker SHALL display weekly set counts per muscle group as pills (e.g., "Chest: 8/16 sets this week (MAV: 14-18)")
2. WHEN a set is completed for an exercise, THE Volume_Tracker SHALL update the corresponding muscle group's set count in real time
3. THE Volume_Tracker SHALL include sets from previously completed sessions in the current week plus sets completed in the active workout
4. THE Volume_Tracker SHALL display the user's MAV (Maximum Adaptive Volume) range for each muscle group as a reference

### Requirement 6: PR Detection and Celebration

**User Story:** As a lifter, I want to be celebrated when I hit a personal record, so that I feel motivated and rewarded for my progress.

#### Acceptance Criteria

1. WHEN a workout is saved and the PR_Detector identifies a personal record, THE Workout_Logger SHALL display a confetti animation and a PR banner indicating the exercise, weight, and reps
2. WHEN a PR is detected, THE Finish_Confirmation_Sheet SHALL list all PRs achieved in the workout summary
3. THE PR_Detector SHALL detect PRs based on the highest weight at each rep count for each exercise across all historical sessions

### Requirement 7: RIR Field Addition

**User Story:** As an advanced lifter, I want to track Reps in Reserve (RIR) alongside RPE, so that I can use either intensity metric based on my preference.

#### Acceptance Criteria

1. THE Set_Entry schema SHALL include an optional `rir` field accepting integer values from 0 to 5
2. WHEN the user's preference is set to RIR mode, THE Workout_Logger SHALL display the RIR column instead of RPE in Set_Row inputs
3. WHEN the user's preference is set to RPE mode, THE Workout_Logger SHALL display the RPE column in Set_Row inputs
4. THE Workout_Logger SHALL hide RPE/RIR columns by default and show them as an opt-in per user preference
5. WHEN RIR data is submitted, THE Set_Entry SHALL store the rir value alongside other set data and persist it to the backend

### Requirement 8: Floating Rest Timer Bar

**User Story:** As a lifter, I want a floating rest timer that doesn't block my workout view, so that I can review my workout and prepare for the next set while resting.

#### Acceptance Criteria

1. WHEN a set is completed, THE Rest_Timer_Bar SHALL appear docked to the bottom of the Workout_Logger screen with a circular SVG progress ring
2. WHILE the Rest_Timer_Bar is active, THE Workout_Logger SHALL remain fully scrollable and interactive behind the timer
3. THE Rest_Timer_Bar SHALL provide +15s and -15s adjustment buttons to modify the remaining time
4. THE Rest_Timer_Bar SHALL provide pause and resume capability
5. WHEN the rest timer reaches zero, THE Rest_Timer_Bar SHALL trigger haptic feedback and an optional sound notification
6. WHILE the rest timer counts down, THE Rest_Timer_Bar SHALL transition its color from green (full time) through yellow (half time) to red (final 10 seconds)
7. THE Rest_Timer_Bar SHALL use the exercise-specific rest duration if configured, falling back to compound/isolation defaults from user preferences

### Requirement 9: Workout Duration Timer

**User Story:** As a lifter, I want to see how long my workout has been running, so that I can manage my time in the gym.

#### Acceptance Criteria

1. WHEN the first set is logged in a workout, THE Workout_Logger SHALL start a duration timer displayed in the header
2. WHILE a workout is in progress, THE Workout_Logger SHALL display the elapsed duration in MM:SS format (or HH:MM:SS for workouts exceeding 60 minutes)
3. WHEN a workout is saved, THE Workout_Logger SHALL record the start_time and end_time with the training session

### Requirement 10: Finish Workout Experience

**User Story:** As a lifter, I want a sticky finish button with a summary before saving, so that I can review my workout and optionally save it as a template.

#### Acceptance Criteria

1. THE Workout_Logger SHALL display a sticky "Finish Workout" bar at the bottom of the screen showing a mini summary (exercise count, set count, duration)
2. WHEN the user taps "Finish Workout," THE Finish_Confirmation_Sheet SHALL appear showing total volume, PRs hit, workout duration, and exercise breakdown
3. THE Finish_Confirmation_Sheet SHALL provide a "Save as Template" option that creates a user workout template from the completed workout
4. WHEN the user confirms the finish, THE Workout_Logger SHALL submit the session to the backend and display any PR celebrations

### Requirement 11: Superset and Circuit Grouping

**User Story:** As a lifter, I want to group exercises as supersets with visual brackets and shared rest timers, so that I can log superset workouts accurately.

#### Acceptance Criteria

1. WHEN a user activates the "Link as Superset" action on two or more exercises, THE Workout_Logger SHALL visually group them with a bracket or colored border connector
2. WHILE exercises are grouped as a Superset_Group, THE Rest_Timer_Bar SHALL fire only after the last exercise in the group is completed (not after each individual exercise)
3. WHEN a user removes an exercise from a Superset_Group, THE Workout_Logger SHALL dissolve the visual grouping if fewer than two exercises remain

### Requirement 12: Exercise Swap

**User Story:** As a lifter, I want to swap an exercise mid-workout while keeping my set structure, so that I can adapt my workout without re-entering data.

#### Acceptance Criteria

1. WHEN a user activates "Swap Exercise" on an exercise card, THE Workout_Logger SHALL open the Exercise_Picker_Sheet with a "similar exercises" filter based on the current exercise's muscle group
2. WHEN a new exercise is selected via swap, THE Workout_Logger SHALL replace the exercise name while preserving all existing set data (reps, weight, RPE/RIR, set type, completion state)

### Requirement 13: Warm-Up Set Auto-Generator

**User Story:** As a lifter, I want auto-generated warm-up sets for compound lifts, so that I can warm up properly without manually calculating ramp-up weights.

#### Acceptance Criteria

1. WHEN a user activates the warm-up generator for an exercise, THE Warm_Up_Generator SHALL produce warm-up sets ramping to the first working set's target weight (e.g., bar × 10, 60% × 5, 80% × 3)
2. THE Warm_Up_Generator SHALL produce warm-up weights that are non-negative and rounded to the nearest achievable plate increment
3. THE Warm_Up_Generator SHALL insert the generated warm-up sets before the existing working sets, each tagged with set_type "warm-up"
4. THE Warm_Up_Generator SHALL use the bar weight appropriate to the exercise (20 kg standard barbell by default)

### Requirement 14: Plate Calculator

**User Story:** As a lifter, I want to see the plate breakdown for my barbell weight, so that I can load the bar correctly without mental math.

#### Acceptance Criteria

1. WHEN a user activates the Plate_Calculator from a weight input field, THE Plate_Calculator SHALL display the plate breakdown per side for the entered weight
2. THE Plate_Calculator SHALL subtract the bar weight (default 20 kg / 45 lbs) and divide the remainder equally between two sides
3. THE Plate_Calculator SHALL use standard plate sizes (25, 20, 15, 10, 5, 2.5, 1.25 kg or 45, 35, 25, 10, 5, 2.5 lbs) and select the minimum number of plates
4. IF the entered weight is less than the bar weight, THEN THE Plate_Calculator SHALL display "Bar only" with no additional plates
5. IF the entered weight cannot be achieved exactly with available plates, THEN THE Plate_Calculator SHALL display the nearest achievable weight and the plate breakdown for that weight
6. THE Plate_Calculator SHALL display weights in the user's preferred Unit_System

### Requirement 15: Crash Recovery

**User Story:** As a lifter, I want my workout to be recoverable if the app crashes or I accidentally close it, so that I never lose workout data mid-session.

#### Acceptance Criteria

1. WHEN a set is completed or any workout state changes, THE Crash_Recovery_Store SHALL persist the entire active workout state to AsyncStorage
2. WHEN the app opens and the Crash_Recovery_Store contains an interrupted workout, THE Workout_Logger SHALL display a "Resume workout?" prompt
3. WHEN the user chooses to resume, THE Workout_Logger SHALL restore the full workout state including all exercises, sets, completion states, and elapsed duration
4. WHEN the user chooses to discard, THE Crash_Recovery_Store SHALL clear the persisted state
5. THE Crash_Recovery_Store SHALL clear the persisted state after a workout is successfully saved

### Requirement 16: Exercise History Access

**User Story:** As a lifter, I want to view my history for a specific exercise without leaving the workout, so that I can make informed decisions about my current sets.

#### Acceptance Criteria

1. WHEN a user taps an exercise name in the Workout_Logger, THE Workout_Logger SHALL open an exercise detail bottom sheet showing a history chart, PR timeline, and volume trend
2. THE exercise detail bottom sheet SHALL display data from the user's historical training sessions for that exercise

### Requirement 17: Additional Workout Management Features

**User Story:** As a lifter, I want to reorder exercises, skip exercises, copy from specific dates, and add per-exercise notes, so that I have full control over my workout structure.

#### Acceptance Criteria

1. WHEN a user drags an exercise card, THE Workout_Logger SHALL reorder exercises in the workout according to the drag position
2. WHEN a user activates "Skip" on an exercise, THE Workout_Logger SHALL gray out the exercise card while preserving the template structure
3. WHEN a user activates "Copy from date," THE Workout_Logger SHALL present a calendar or session history picker allowing selection of a specific past workout to copy
4. WHEN a user activates per-exercise notes, THE Workout_Logger SHALL show a collapsible text input on the exercise card, hidden by default
5. WHEN a user activates per-exercise rest timer customization, THE Workout_Logger SHALL allow overriding the global compound/isolation rest duration for that specific exercise

### Requirement 18: Visual Hierarchy and UI Polish

**User Story:** As a lifter, I want a clean, visually hierarchical workout screen that makes the most important information prominent, so that I can focus on lifting rather than deciphering the UI.

#### Acceptance Criteria

1. THE Workout_Logger SHALL display exercise names with larger, bolder typography than other text elements
2. THE Workout_Logger SHALL display weight values as the most prominent number in each Set_Row using primary color and larger font size
3. THE Workout_Logger SHALL remove the info banner and replace explanatory content with contextual first-time tooltips
4. THE Workout_Logger SHALL hide RPE/RIR and set type columns by default, accessible via user preference or contextual actions

### Requirement 19: Exercise Picker as Bottom Sheet

**User Story:** As a lifter, I want to pick exercises from a bottom sheet without leaving the workout screen, so that I maintain context and flow.

#### Acceptance Criteria

1. WHEN a user taps to add or change an exercise, THE Exercise_Picker_Sheet SHALL appear as a bottom sheet overlay on the Workout_Logger
2. THE Exercise_Picker_Sheet SHALL display recent exercises at the top, followed by muscle group filters and search
3. WHILE the Exercise_Picker_Sheet is open, THE Workout_Logger SHALL remain partially visible behind the sheet to maintain context
