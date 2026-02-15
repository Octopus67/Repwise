# Requirements Document

## Introduction

Enhance the existing Hypertrophy OS progress photos feature with guided pose overlays, lighting consistency reminders, a horizontal timeline slider for browsing progress chronologically, and auto-alignment for side-by-side comparison. These are UX improvements layered on top of the current photo capture and comparison flow. No AI body composition estimation in v1.

## Glossary

- **Camera_Preview**: The live camera viewfinder displayed when the user initiates photo capture via expo-image-picker or a custom camera view.
- **Pose_Overlay**: A semi-transparent silhouette image rendered on top of the Camera_Preview to guide the user into a consistent body position.
- **Pose_Type**: One of four supported poses — front_relaxed, front_double_bicep, side, or back.
- **Lighting_Reminder**: A dismissible card shown before the camera opens, advising the user on consistent lighting conditions.
- **Timeline_Slider**: A horizontal, scrollable component that displays all progress photos in chronological order, replacing the current grid-based comparison view.
- **Auto_Alignment**: An image processing step that detects the vertical center of the body in two photos and adjusts position and scale so they align visually for comparison.
- **Photo_Metadata**: The server-side record for a progress photo (id, capture_date, bodyweight_kg, pose_type, notes, alignment_data).
- **Alignment_Data**: A JSON object stored per photo containing body center x/y coordinates and a scale factor, used for auto-alignment during comparison.

## Requirements

### Requirement 1: Pose Type Selection

**User Story:** As a user, I want to select a pose type before capturing a progress photo, so that I can maintain consistency across photo sessions.

#### Acceptance Criteria

1. WHEN the user initiates photo capture, THE Pose_Selector SHALL display the four supported Pose_Type options (front_relaxed, front_double_bicep, side, back) before opening the Camera_Preview.
2. WHEN the user selects a Pose_Type, THE System SHALL store the selected Pose_Type in the Photo_Metadata for that capture session.
3. IF the user does not select a Pose_Type, THEN THE System SHALL default to front_relaxed.

### Requirement 2: Guided Pose Overlay

**User Story:** As a user, I want to see a silhouette overlay on the camera preview matching my selected pose, so that I can position my body consistently across sessions.

#### Acceptance Criteria

1. WHEN the Camera_Preview is active and a Pose_Type is selected, THE Pose_Overlay SHALL display a semi-transparent silhouette corresponding to the selected Pose_Type.
2. THE Pose_Overlay SHALL render at 30% opacity so the user can see both the silhouette guide and the live camera feed.
3. WHEN the user changes the Pose_Type during an active Camera_Preview, THE Pose_Overlay SHALL update to the newly selected silhouette within 200ms.
4. THE Pose_Overlay SHALL scale proportionally to the Camera_Preview dimensions without distortion.

### Requirement 3: Lighting Consistency Reminder

**User Story:** As a user, I want to receive a brief reminder about consistent lighting before taking a progress photo, so that my photos are comparable over time.

#### Acceptance Criteria

1. WHEN the user initiates photo capture, THE Lighting_Reminder SHALL display a card with guidance text before the Camera_Preview opens.
2. THE Lighting_Reminder SHALL include the following guidance: use the same room, same time of day, and prefer natural light.
3. WHEN the user dismisses the Lighting_Reminder, THE System SHALL open the Camera_Preview with the selected Pose_Overlay.
4. WHERE the user enables a "Don't show again" preference, THE System SHALL skip the Lighting_Reminder on subsequent captures.
5. THE System SHALL persist the "Don't show again" preference in local storage.

### Requirement 4: Expanded Pose Type Schema

**User Story:** As a developer, I want the backend to support the expanded set of pose types, so that the new guided overlay poses are properly stored and validated.

#### Acceptance Criteria

1. THE Photo_Metadata pose_type field SHALL accept the values: front_relaxed, front_double_bicep, side, and back.
2. WHEN a photo is created with the legacy pose_type value "front", THE System SHALL treat it as equivalent to "front_relaxed" for display and filtering purposes.
3. THE System SHALL validate that pose_type is one of the accepted values before persisting Photo_Metadata.

### Requirement 5: Timeline Slider

**User Story:** As a user, I want to swipe through my progress photos chronologically on a horizontal timeline, so that I can easily browse my transformation over time.

#### Acceptance Criteria

1. WHEN the user navigates to the progress photos screen, THE Timeline_Slider SHALL display all photos sorted by capture_date in ascending order.
2. THE Timeline_Slider SHALL allow horizontal swiping to scroll through photos one at a time.
3. WHEN the user swipes to a photo, THE Timeline_Slider SHALL display the capture date and bodyweight (if available) below the photo.
4. WHEN the user performs a pinch gesture on the Timeline_Slider, THE System SHALL enter comparison mode showing two photos side-by-side.
5. WHEN the Timeline_Slider contains photos of multiple Pose_Types, THE System SHALL provide a filter to show only photos of a selected Pose_Type.

### Requirement 6: Auto-Alignment for Comparison

**User Story:** As a user, I want my comparison photos to be automatically aligned by body position, so that visual differences reflect actual physical changes rather than framing inconsistencies.

#### Acceptance Criteria

1. WHEN two photos are displayed in comparison mode, THE Auto_Alignment SHALL detect the vertical center of the body in each photo and align them horizontally.
2. WHEN two photos have different apparent body scales, THE Auto_Alignment SHALL adjust the scale of the smaller-appearing body to match the larger one.
3. THE Auto_Alignment SHALL store computed Alignment_Data (center coordinates and scale factor) in Photo_Metadata so alignment is computed once and reused.
4. IF the Auto_Alignment cannot detect a body center in a photo, THEN THE System SHALL fall back to center-aligned display without scaling adjustments.
5. WHEN Alignment_Data is already present in Photo_Metadata, THE System SHALL reuse the stored values instead of recomputing.

### Requirement 7: Photo Metadata Serialization

**User Story:** As a developer, I want Photo_Metadata including alignment data to serialize and deserialize correctly, so that data integrity is maintained across client-server communication.

#### Acceptance Criteria

1. THE System SHALL serialize Photo_Metadata (including Alignment_Data) to JSON for API responses.
2. THE System SHALL deserialize Photo_Metadata JSON payloads into valid Photo_Metadata objects on the client.
3. FOR ALL valid Photo_Metadata objects, serializing then deserializing SHALL produce an equivalent object (round-trip property).
