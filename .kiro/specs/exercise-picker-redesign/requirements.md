# Requirements Document

## Introduction

Redesign the exercise selection experience in HypertrophyOS from a small inline dropdown within the training modal (`AddTrainingModal.tsx`) to a premium, full-page exercise browser screen. The new experience should provide two discovery paths — text search and muscle group browsing — with rich exercise cards featuring image placeholders, equipment tags, and category labels. The goal is to match the polish of premium fitness apps (Hevy, Strong, JEFIT) while integrating seamlessly with the existing training session logging flow.

## Glossary

- **Exercise_Picker**: The new full-page screen that allows users to browse and search exercises
- **Training_Modal**: The existing `AddTrainingModal` component used to log training sessions
- **Muscle_Group_Grid**: A visual grid or horizontally scrollable row of muscle group tiles with icons, used to filter exercises by body part
- **Exercise_Card**: A list item in the Exercise_Picker displaying an exercise's image placeholder, name, equipment, and category
- **Search_Bar**: A sticky text input at the top of the Exercise_Picker for real-time exercise name filtering
- **Muscle_Group**: One of the 13 body-part categories (chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, abs, traps, forearms, full_body)
- **Image_Placeholder**: An emoji-based icon with a colored background representing a muscle group, used until real exercise images are available
- **Exercise_Data**: The backend exercise record containing id, name, muscle_group, equipment, category, and image_url fields

## Requirements

### Requirement 1: Full-Page Exercise Picker Navigation

**User Story:** As a user logging a training session, I want tapping the exercise name field to open a dedicated full-page screen, so that I have more space to browse and discover exercises.

#### Acceptance Criteria

1. WHEN a user taps the exercise name field in the Training_Modal, THE Exercise_Picker SHALL open as a full-page screen using stack navigation
2. WHEN the Exercise_Picker opens, THE Exercise_Picker SHALL display a sticky Search_Bar at the top and the Muscle_Group_Grid below it
3. WHEN a user taps the back button on the Exercise_Picker, THE Exercise_Picker SHALL close and return to the Training_Modal without selecting an exercise
4. WHEN a user selects an exercise from the Exercise_Picker, THE Exercise_Picker SHALL close and return the selected exercise name to the Training_Modal's exercise name field

### Requirement 2: Exercise Search

**User Story:** As a user, I want to search exercises by name in real time, so that I can quickly find a specific exercise I have in mind.

#### Acceptance Criteria

1. WHEN a user types into the Search_Bar, THE Exercise_Picker SHALL filter the displayed exercises to those whose names contain the search text (case-insensitive)
2. WHEN the search text is cleared, THE Exercise_Picker SHALL restore the default view showing the Muscle_Group_Grid
3. WHEN search results are returned, THE Exercise_Picker SHALL display each result as an Exercise_Card
4. THE Search_Bar SHALL debounce input by 300 milliseconds before triggering a search request

### Requirement 3: Muscle Group Browsing

**User Story:** As a user, I want to browse exercises by muscle group using visual tiles, so that I can discover exercises for a specific body part.

#### Acceptance Criteria

1. WHEN the Exercise_Picker opens with no active search, THE Muscle_Group_Grid SHALL display all 13 muscle groups as tappable tiles with emoji icons and labels
2. WHEN a user taps a muscle group tile, THE Exercise_Picker SHALL display a filtered list of exercises belonging to that muscle group
3. WHEN viewing a filtered muscle group list, THE Exercise_Picker SHALL display the muscle group name as a section header
4. WHEN viewing a filtered muscle group list, THE user SHALL be able to tap a back or clear action to return to the Muscle_Group_Grid

### Requirement 4: Exercise Card Display

**User Story:** As a user, I want each exercise to show its image, name, equipment, and category, so that I can make an informed selection.

#### Acceptance Criteria

1. THE Exercise_Card SHALL display the exercise name, an Image_Placeholder, an equipment tag, and a category tag (compound or isolation)
2. THE Image_Placeholder SHALL render an emoji icon on a colored background corresponding to the exercise's muscle group
3. WHEN the Exercise_Data includes a non-empty image_url, THE Exercise_Card SHALL display the remote image instead of the Image_Placeholder

### Requirement 5: Exercise Data Model Extension

**User Story:** As a developer, I want the exercise data model to include an image_url field, so that real exercise images can be added later without code changes.

#### Acceptance Criteria

1. THE Exercise_Data SHALL include an image_url field (string, nullable) alongside the existing id, name, muscle_group, equipment, and category fields
2. WHEN image_url is null or empty, THE system SHALL fall back to the emoji-based Image_Placeholder for that exercise's muscle group
3. THE backend exercises endpoint SHALL return the image_url field in the exercise response payload

### Requirement 6: Visual Design and Theme Consistency

**User Story:** As a user, I want the exercise picker to match the dark premium aesthetic of HypertrophyOS, so that the experience feels cohesive and polished.

#### Acceptance Criteria

1. THE Exercise_Picker SHALL use the existing dark theme tokens from the design token system (colors, spacing, typography, radius)
2. THE Muscle_Group_Grid tiles SHALL each have a distinct background color to visually differentiate muscle groups
3. THE Exercise_Picker SHALL use smooth transitions when navigating between the grid view and filtered exercise lists
4. THE Exercise_Card layout SHALL provide adequate spacing and visual hierarchy to feel premium and uncluttered

### Requirement 7: Recently Used Exercises

**User Story:** As a user who repeats similar workouts, I want to see my recently used exercises at the top of the picker, so that I can quickly re-select exercises without searching every time.

#### Acceptance Criteria

1. WHEN the Exercise_Picker opens with no active search or muscle group filter, THE Exercise_Picker SHALL display a "Recent" section above the Muscle_Group_Grid showing the user's last 10 distinct exercises used in training sessions
2. WHEN the user has no previous training sessions, THE Exercise_Picker SHALL omit the "Recent" section and show only the Muscle_Group_Grid
3. WHEN a user taps a recently used exercise, THE Exercise_Picker SHALL select it and return to the Training_Modal with the exercise name filled in
4. THE "Recent" section SHALL display exercises as compact horizontal scrollable cards with the exercise name and muscle group icon

### Requirement 8: Search and Filter Combination

**User Story:** As a user, I want to search within a selected muscle group, so that I can narrow down exercises efficiently.

#### Acceptance Criteria

1. WHILE a muscle group filter is active, WHEN a user types into the Search_Bar, THE Exercise_Picker SHALL filter results by both the active muscle group and the search text
2. WHEN the search text is cleared while a muscle group filter is active, THE Exercise_Picker SHALL show all exercises for the active muscle group
3. WHEN the muscle group filter is cleared while search text is present, THE Exercise_Picker SHALL show search results across all muscle groups

### Requirement 9: Muscle Group Tile Exercise Count

**User Story:** As a user, I want to see how many exercises are available in each muscle group, so that I can set expectations before browsing.

#### Acceptance Criteria

1. THE Muscle_Group_Grid tiles SHALL display the count of exercises available in each muscle group alongside the emoji icon and label

### Requirement 10: Keyboard and Interaction Polish

**User Story:** As a user, I want the exercise picker to handle keyboard and touch interactions smoothly, so that the experience feels responsive and intentional.

#### Acceptance Criteria

1. WHEN a user scrolls the exercise list while the keyboard is open, THE Exercise_Picker SHALL dismiss the keyboard automatically
2. WHEN a user taps an exercise to select it, THE Exercise_Card SHALL display a brief visual highlight before navigating back to the Training_Modal
3. THE Search_Bar SHALL display a result count indicator (e.g., "12 exercises") when search results or a muscle group filter is active

### Requirement 11: Performance and Responsiveness

**User Story:** As a user, I want the exercise picker to feel fast and responsive, so that it does not interrupt my workout logging flow.

#### Acceptance Criteria

1. WHEN the Exercise_Picker opens, THE Exercise_Picker SHALL display the Muscle_Group_Grid within 200 milliseconds
2. WHEN search results are returned from the API, THE Exercise_Picker SHALL render the exercise list without visible jank or frame drops
3. THE Exercise_Picker SHALL use FlatList or equivalent virtualized list for rendering exercise results to handle the full 151+ exercise dataset efficiently

### Requirement 12: Accessibility

**User Story:** As a user with accessibility needs, I want the exercise picker to be usable with screen readers and keyboard navigation, so that I can select exercises regardless of ability.

#### Acceptance Criteria

1. THE Exercise_Picker SHALL provide accessible labels for all interactive elements including the Search_Bar, muscle group tiles, Exercise_Cards, and the back button
2. THE Muscle_Group_Grid tiles SHALL include accessibility roles and labels describing the muscle group name
3. THE Exercise_Card SHALL announce the exercise name, equipment, and category when focused by a screen reader
