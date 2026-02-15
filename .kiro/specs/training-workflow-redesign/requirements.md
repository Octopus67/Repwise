# Requirements Document: Training Workflow Redesign

## Introduction

A comprehensive redesign of the entire training workflow in HypertrophyOS, covering the exercise database, workout logging UX, exercise picker, active workout screen, template management, progressive overload intelligence, rest timer, exercise instruction/form guidance, and advanced training features (supersets, RPE/RIR, volume tracking). The goal is to close the gap with market leaders (Strong, Hevy, Alpha Progression) on logging speed while leveraging our unique backend intelligence (volume landmarks, periodization, PR detection, nutrition-training sync) to create the smartest training experience in the market.

Core principle: **Log a set in under 3 seconds. Show the user what to do next. Celebrate when they beat their best.**

## Glossary

- **Exercise_Database**: The backend data store containing all exercises with metadata including name, muscle group, equipment, category, images, animations, descriptions, and muscle activation data
- **Exercise_Record**: A single exercise entry in the Exercise_Database containing id, name, muscle_group, secondary_muscles, equipment, category, image_url, animation_url, description, instructions, and tips
- **Exercise_Picker**: The full-screen exercise selection interface with search, muscle group browsing, recent exercises, and exercise detail previews
- **Active_Workout_Screen**: The full-screen workout logging interface displaying exercises, sets, rest timer, duration timer, previous performance, and progressive overload suggestions
- **Set_Row**: A single row representing one set within an exercise card, containing set number, previous performance, weight input, reps input, RPE/RIR input, set type tag, and completion checkmark
- **Previous_Column**: An inline display in each Set_Row showing weight and reps from the most recent session for that exercise
- **Completion_Checkmark**: A tappable element on each Set_Row that marks the set as completed, triggering rest timer and PR detection
- **Rest_Timer**: A countdown timer with circular progress ring that auto-starts on set completion, supporting pause/resume, skip, and duration adjustment
- **Progress_Ring**: A circular SVG arc animation showing rest timer progress with color transitions
- **Duration_Timer**: A stopwatch at the top of the Active_Workout_Screen showing elapsed workout time
- **PR_Banner**: An animated celebration element displayed when a personal record is detected during the workout
- **Workout_Template**: A reusable workout blueprint storing exercises, sets, target weights/reps, and notes
- **Superset_Group**: Two or more exercises grouped together to be performed back-to-back with minimal rest
- **Progressive_Overload_Suggestion**: An inline recommendation showing the user what weight/reps to target based on recent performance trends
- **Volume_Indicator**: An inline display showing current weekly volume (sets) for a muscle group compared to the user's volume landmarks (MEV/MAV/MRV)
- **Exercise_Detail_Sheet**: A bottom sheet showing exercise instructions, animated demo, muscle activation diagram, form tips, and common mistakes
- **Unit_System**: The user's preferred weight unit (kg or lbs)
- **Set_Type**: Classification of a set: normal, warm-up, drop-set, or AMRAP
- **RPE**: Rate of Perceived Exertion (0-10 scale measuring how hard a set felt)
- **RIR**: Reps in Reserve (0-5+ scale measuring how many reps the user could have done before failure)
- **Session_Detail_View**: A read-only screen showing full details of a previously logged training session
- **Training_Session**: A persisted record of a completed workout

---

## Requirements

### Requirement 1: Exercise Database Expansion

**User Story:** As a lifter, I want access to a comprehensive exercise database with images and animations for every exercise, so that I can find any exercise I need and see how to perform it correctly.

#### Acceptance Criteria

1. THE Exercise_Database SHALL contain a minimum of 400 exercises covering all 13 muscle groups (chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, abs, traps, forearms, full_body)
2. WHEN an Exercise_Record is retrieved, THE Exercise_Database SHALL return the following fields: id, name, muscle_group, secondary_muscles (list), equipment, category (compound/isolation), image_url, animation_url, description, instructions (list of steps), and tips (list of form cues)
3. THE Exercise_Database SHALL provide a static image (image_url) for at least 95% of all exercises, hosted on a self-controlled CDN rather than external third-party repositories
4. THE Exercise_Database SHALL provide an animated demonstration (animation_url) for at least 50% of exercises, prioritizing the most commonly performed exercises
5. WHEN an Exercise_Record has no image_url, THE Exercise_Picker SHALL display a muscle-group-themed icon placeholder with the muscle group color
6. THE Exercise_Database SHALL include secondary_muscles data for each exercise (e.g., Bench Press: primary=chest, secondary=[triceps, shoulders])
7. THE Exercise_Database SHALL be sourced primarily from the wger open-source database, enriched with ExerciseDB animated GIFs where available, with all assets self-hosted
8. THE backend exercises API endpoint SHALL support filtering by muscle_group, equipment, and category query parameters
9. THE backend exercises API endpoint SHALL support full-text search across exercise name, description, and muscle group fields

### Requirement 2: Exercise Picker Redesign

**User Story:** As a lifter, I want a fast, visual exercise picker with search, muscle group browsing, exercise images, and a detail preview, so that I can find and learn about exercises without leaving the workout flow.

#### Acceptance Criteria

1. WHEN the Exercise_Picker opens, THE Exercise_Picker SHALL display a sticky search bar, a "Recent" section (if the user has training history), and the muscle group grid below
2. WHEN a user types into the search bar, THE Exercise_Picker SHALL filter exercises by name with 300ms debounce and display results as Exercise_Cards with images
3. WHEN a user taps a muscle group tile, THE Exercise_Picker SHALL display exercises for that muscle group as a scrollable list of Exercise_Cards
4. THE Exercise_Card SHALL display the exercise image (or animated GIF if available), exercise name, equipment tag, category tag (compound/isolation), and primary muscle group
5. WHEN a user long-presses an Exercise_Card, THE Exercise_Picker SHALL display an Exercise_Detail_Sheet showing the animated demo, step-by-step instructions, muscle activation diagram, form tips, and common mistakes
6. WHEN a user taps an Exercise_Card, THE Exercise_Picker SHALL select the exercise and return to the Active_Workout_Screen
7. THE Exercise_Picker SHALL display exercise images as 48x48 circular thumbnails on each Exercise_Card, falling back to muscle-group-themed icon placeholders when no image is available
8. THE muscle group grid tiles SHALL display the exercise count for each muscle group
9. THE Exercise_Picker SHALL support filtering by equipment type (barbell, dumbbell, cable, machine, bodyweight, band, kettlebell, smith_machine) via filter chips below the search bar

### Requirement 3: Active Workout Screen Core

**User Story:** As a lifter who trains 4-5x/week, I want a full-screen workout logging experience with a duration timer and inline previous performance, so that I can log sets in under 3 seconds without navigating away.

#### Acceptance Criteria

1. WHEN a user initiates a new workout (via FAB, template, or copy-last), THE Active_Workout_Screen SHALL present a full-screen interface via push navigation
2. THE Active_Workout_Screen SHALL display the Duration_Timer at the top showing elapsed time in HH:MM:SS format using a monospace font
3. THE Duration_Timer SHALL continue counting accurately when the app is backgrounded, using the persisted start timestamp
4. THE Active_Workout_Screen SHALL display each exercise as a card containing the exercise name, exercise image thumbnail, and a table of Set_Rows
5. WHEN the user taps "Finish Workout" with at least one completed set, THE Active_Workout_Screen SHALL display a finish summary (duration, total volume, exercise count, PRs achieved) and persist the Training_Session
6. WHEN the user taps "Finish Workout" with zero completed sets, THE Active_Workout_Screen SHALL display an error toast and remain on the screen
7. WHEN the user attempts to leave with unsaved data, THE Active_Workout_Screen SHALL display a confirmation dialog with "Keep Workout" and "Discard" options
8. WHEN the app is killed mid-workout, THE Active_Workout_Screen SHALL persist the active workout state to local storage for recovery on next app open with a "Resume workout?" prompt
9. THE Active_Workout_Screen SHALL fetch previous performance data for all exercises in a single batched API call on workout start

### Requirement 4: Set Logging Speed (Inline Previous + Tap-to-Copy)

**User Story:** As a lifter, I want to see what I did last time right next to my current inputs and tap to copy those values, so that I can match or beat my previous performance in under 3 seconds per set.

#### Acceptance Criteria

1. THE Set_Row SHALL display columns in this order: set number, Previous_Column, weight input, reps input, RPE/RIR input, Set_Type indicator, Completion_Checkmark
2. WHEN previous performance data exists, THE Previous_Column SHALL display the data in the format "{weight}{unit} × {reps}" using the user's preferred Unit_System
3. WHEN no previous performance data exists, THE Previous_Column SHALL display a dash character
4. WHEN a user taps the Previous_Column value, THE Active_Workout_Screen SHALL copy the previous weight and reps values into the current set's input fields
5. WHILE previous performance data is loading, THE Previous_Column SHALL display a skeleton placeholder
6. WHEN a user taps the Completion_Checkmark on a Set_Row with valid weight and reps, THE Active_Workout_Screen SHALL mark the set as completed with a visual state change (filled checkmark, row background color transition) and trigger haptic feedback
7. WHEN a user taps the Completion_Checkmark on a Set_Row with empty weight or reps, THE Active_Workout_Screen SHALL prevent completion and visually highlight the missing fields
8. WHEN a user taps a completed Completion_Checkmark, THE Active_Workout_Screen SHALL toggle the set back to incomplete state

### Requirement 5: Rest Timer with Visual Progress Ring

**User Story:** As a lifter, I want an automatic rest timer with a visual countdown ring, pause/resume, and adjustment controls after each set, so that I can maintain consistent rest periods.

#### Acceptance Criteria

1. WHEN a set is marked as completed, THE Rest_Timer SHALL auto-start with the configured duration for that exercise type
2. THE Rest_Timer SHALL display a Progress_Ring showing remaining time as a circular arc that animates smoothly
3. THE Rest_Timer SHALL display remaining time in M:SS format centered within the Progress_Ring
4. THE Progress_Ring SHALL transition color from green to yellow to red during the final 10 seconds
5. WHEN the user taps pause, THE Rest_Timer SHALL pause the countdown and Progress_Ring animation, and display a resume button
6. WHEN the user taps resume, THE Rest_Timer SHALL resume from where it was paused
7. WHEN the user taps skip, THE Rest_Timer SHALL immediately dismiss
8. WHEN the countdown reaches zero, THE Rest_Timer SHALL play a notification sound and display a "Rest Complete" indicator
9. WHEN the user taps +15s or -15s, THE Rest_Timer SHALL adjust the remaining duration by 15 seconds
10. THE Rest_Timer SHALL use configurable default durations: 180 seconds for compound exercises, 90 seconds for isolation exercises, adjustable per user preference

### Requirement 6: Progressive Overload Intelligence

**User Story:** As a lifter motivated by progress, I want to see suggestions for what weight and reps to target based on my recent performance, so that I can progressively overload without guessing.

#### Acceptance Criteria

1. WHEN an exercise has at least 3 previous sessions of data, THE Active_Workout_Screen SHALL display a Progressive_Overload_Suggestion below the exercise name showing a recommended weight and rep target
2. THE Progressive_Overload_Suggestion SHALL be calculated based on the user's recent performance trend (last 3-5 sessions) and the exercise category (compound exercises suggest smaller increments than isolation)
3. WHEN the user's recent RPE/RIR data indicates the previous weight was easy (RPE < 7 or RIR > 3), THE Progressive_Overload_Suggestion SHALL suggest increasing weight by the minimum increment (2.5kg for barbell, 1kg for dumbbell/cable)
4. WHEN the user's recent RPE/RIR data indicates the previous weight was hard (RPE > 9 or RIR < 1), THE Progressive_Overload_Suggestion SHALL suggest maintaining the same weight and reps
5. THE Progressive_Overload_Suggestion SHALL be dismissible and non-blocking — the user can ignore it and enter any values
6. WHEN a set is completed and the backend detects a personal record, THE Active_Workout_Screen SHALL display a PR_Banner with the PR type, exercise name, and new record value with a scale-up animation that auto-dismisses after 3 seconds

### Requirement 7: Volume Tracking During Workout

**User Story:** As a lifter following a hypertrophy program, I want to see my current weekly volume for each muscle group during my workout compared to my volume landmarks, so that I can make informed decisions about how many sets to do.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL display a Volume_Indicator for each exercise showing the current weekly set count for that exercise's primary muscle group
2. THE Volume_Indicator SHALL display the current sets relative to the user's volume landmarks in the format "Sets: {current}/{MAV}" with color coding (below MEV = red, between MEV and MAV = yellow, between MAV and MRV = green, above MRV = red)
3. WHEN the user completes a set, THE Volume_Indicator SHALL update in real-time to reflect the new total
4. THE Volume_Indicator SHALL use the existing volume landmarks API (MEV/MAV/MRV) already implemented in the backend

### Requirement 8: RPE and RIR Tracking

**User Story:** As an advanced lifter, I want to log RPE or RIR for each set, so that I can track training intensity and inform progressive overload decisions.

#### Acceptance Criteria

1. THE Set_Row SHALL include an RPE/RIR input field that supports both RPE (0-10) and RIR (0-5+) scales
2. WHEN a user taps the RPE/RIR field, THE Active_Workout_Screen SHALL display a quick-select picker with common values (RPE: 6, 7, 8, 9, 10; RIR: 0, 1, 2, 3, 4+)
3. THE user SHALL be able to toggle between RPE and RIR modes in workout settings, with the selected mode persisted as a user preference
4. WHEN RPE mode is active, THE Set_Row SHALL display RPE values; WHEN RIR mode is active, THE Set_Row SHALL display RIR values
5. THE RPE/RIR value SHALL be persisted as part of the set data in the Training_Session (RPE stored natively, RIR converted to RPE for storage: RIR 0 = RPE 10, RIR 1 = RPE 9, etc.)

### Requirement 9: Superset and Circuit Support

**User Story:** As a lifter who uses supersets and circuits, I want to group exercises together with a visual indicator and shared rest timer, so that my training log reflects my actual workout structure.

#### Acceptance Criteria

1. WHEN a user selects two or more exercises and taps "Create Superset", THE Active_Workout_Screen SHALL visually group the exercises with a bracket indicator and shared label (e.g., "Superset A")
2. WHEN exercises are in a Superset_Group, THE Active_Workout_Screen SHALL display them in an alternating pattern: Exercise A Set 1 → Exercise B Set 1 → Rest → Exercise A Set 2 → Exercise B Set 2 → Rest
3. WHEN the last exercise in a Superset_Group has a set completed, THE Rest_Timer SHALL auto-start (rest between rounds, not between exercises within the superset)
4. WHEN a user taps "Remove Superset" on a grouped set of exercises, THE Active_Workout_Screen SHALL ungroup the exercises back to individual exercise cards
5. THE Superset_Group data SHALL be persisted in the Training_Session metadata so it can be displayed in the Session_Detail_View
6. THE Active_Workout_Screen SHALL prevent creation of a Superset_Group with fewer than 2 exercises

### Requirement 10: Exercise Instructions and Form Guidance

**User Story:** As a lifter who wants to learn proper form, I want to access exercise instructions, animated demos, and muscle activation diagrams without leaving my workout, so that I can perform exercises safely and effectively.

#### Acceptance Criteria

1. WHEN a user taps the exercise name or image in an exercise card on the Active_Workout_Screen, THE Active_Workout_Screen SHALL display an Exercise_Detail_Sheet as a bottom sheet overlay
2. THE Exercise_Detail_Sheet SHALL display: the exercise animation (if available) or static image, step-by-step instructions, primary and secondary muscles targeted, equipment required, form tips, and common mistakes
3. THE Exercise_Detail_Sheet SHALL display a muscle activation diagram showing primary muscles in a highlight color and secondary muscles in a muted color on a body silhouette SVG
4. WHEN the Exercise_Record has no instructions or tips, THE Exercise_Detail_Sheet SHALL display the exercise image and muscle group information only
5. THE Exercise_Detail_Sheet SHALL be dismissible by swiping down or tapping outside, returning focus to the workout without losing any set data

### Requirement 11: Template and Program Management

**User Story:** As a lifter who follows a structured program, I want to create, edit, and organize workout templates with smart defaults, so that I can start my workouts quickly with the right exercises pre-loaded.

#### Acceptance Criteria

1. WHEN a user taps "Save as Template" during the finish flow, THE Active_Workout_Screen SHALL prompt for a template name and save the current workout structure (exercises, set counts, target weights/reps) as a Workout_Template
2. WHEN a user starts a workout from a Workout_Template, THE Active_Workout_Screen SHALL pre-populate exercises and sets with the template values, using the most recent actual performance for weights when available (not the template's static weights)
3. THE template management screen SHALL allow users to create templates from scratch, edit existing templates, reorder exercises within a template, and delete templates
4. THE template picker SHALL display user-created templates in a "My Templates" section above system-provided templates in a "System Templates" section
5. WHEN a user has more than 5 templates, THE template picker SHALL support search and filtering by name
6. THE Workout_Template SHALL store exercise names, set counts, target reps, target weights, rest durations, and optional notes per exercise

### Requirement 12: Session Detail and Editing

**User Story:** As a lifter, I want to view full details of past sessions and edit them if I made mistakes, so that my training history stays accurate.

#### Acceptance Criteria

1. WHEN a user taps a training session card on the LogsScreen, THE LogsScreen SHALL navigate to the Session_Detail_View
2. THE Session_Detail_View SHALL display: session date, workout duration (if available), total working volume (excluding warm-up sets), each exercise with all sets (weight, reps, RPE/RIR, Set_Type), PR badges, and session notes
3. THE Session_Detail_View SHALL display exercise images next to exercise names
4. WHEN a user taps "Edit" on the Session_Detail_View, THE Active_Workout_Screen SHALL open in edit mode pre-populated with the session data
5. WHEN the user saves an edited session, THE Active_Workout_Screen SHALL re-evaluate personal records and update PR badges accordingly
6. WHEN a session has no duration data (legacy session), THE Session_Detail_View SHALL hide the duration field

### Requirement 13: Custom Exercise Creation

**User Story:** As a lifter who performs exercises not in the database, I want to create custom exercises with muscle group and equipment tags, so that I can log my complete workout accurately.

#### Acceptance Criteria

1. WHEN a user searches for an exercise that returns no results, THE Exercise_Picker SHALL display a "Create Custom Exercise" option
2. WHEN creating a custom exercise, THE Exercise_Picker SHALL require: exercise name, primary muscle group (from the 13 standard groups), and equipment type
3. WHEN creating a custom exercise, THE Exercise_Picker SHALL optionally accept: secondary muscle groups, category (compound/isolation), and notes
4. THE custom exercise SHALL be stored as a user-specific Exercise_Record and appear in future searches and the "Recent" section
5. THE custom exercise SHALL use the muscle-group-themed icon placeholder since no image is available

### Requirement 14: Unit System Support

**User Story:** As a lifter, I want to see and enter weights in my preferred unit (kg or lbs) throughout the entire training workflow, so that I use the system I am familiar with.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL display all weight values in the user's configured Unit_System preference
2. THE Active_Workout_Screen SHALL display the unit label in the set header row
3. WHEN a user enters a weight value, THE Active_Workout_Screen SHALL accept the value in the user's preferred Unit_System and convert to kg for backend storage
4. THE Previous_Column SHALL display previous performance weights converted to the user's preferred Unit_System
5. THE Session_Detail_View SHALL display all weights in the user's preferred Unit_System
6. THE Progressive_Overload_Suggestion SHALL display suggested weights in the user's preferred Unit_System

### Requirement 15: Past Date Logging

**User Story:** As a lifter who sometimes forgets to log on the day of training, I want to log workouts for previous dates, so that my training history is complete.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL default the session date to today when starting a new workout
2. THE Active_Workout_Screen SHALL display a tappable date field that opens a date picker
3. WHEN the user selects a past date, THE Active_Workout_Screen SHALL set the session date to the selected date
4. THE Active_Workout_Screen SHALL prevent selection of future dates

### Requirement 16: Backend Exercise Schema Extension

**User Story:** As a developer, I want the exercise data model to support rich content fields, so that the frontend can display instructions, animations, and muscle activation data.

#### Acceptance Criteria

1. THE Exercise_Record schema SHALL include the following fields: id (string), name (string), muscle_group (string), secondary_muscles (list of strings), equipment (string), category (string), image_url (string, nullable), animation_url (string, nullable), description (string, nullable), instructions (list of strings, nullable), tips (list of strings, nullable)
2. THE backend exercises search endpoint SHALL support filtering by equipment type and category in addition to the existing name and muscle_group filters
3. THE backend exercises endpoint SHALL return all Exercise_Record fields in the response payload
4. WHEN image_url or animation_url is null, THE frontend SHALL fall back to the muscle-group-themed icon placeholder

### Requirement 17: Exercise Database Serialization

**User Story:** As a developer, I want the exercise database to be serializable to and from JSON, so that exercises can be imported, exported, and cached reliably.

#### Acceptance Criteria

1. THE Exercise_Record SHALL be serializable to JSON format containing all fields (id, name, muscle_group, secondary_muscles, equipment, category, image_url, animation_url, description, instructions, tips)
2. THE Exercise_Record SHALL be deserializable from JSON format, producing an equivalent Exercise_Record object (round-trip property: serialize then deserialize produces an equivalent object)
3. WHEN deserializing an Exercise_Record with missing optional fields (image_url, animation_url, description, instructions, tips), THE system SHALL default those fields to null without error
4. THE Exercise_Database export endpoint SHALL produce valid JSON containing all exercises that can be re-imported without data loss
