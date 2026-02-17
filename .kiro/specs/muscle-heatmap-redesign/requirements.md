# Requirements Document

## Introduction

Redesign the Muscle Volume Heat Map component on the Analytics screen's Training tab. The current implementation uses blocky, stick-figure SVG outlines that are hard to read and lack visual distinction between muscle regions. The redesign replaces these with smooth, anatomical SVG body silhouettes (front and back views) with individually colorable muscle regions, a 5-tier heat map color gradient based on MEV/MRV volume landmarks, and tap-to-inspect detail interaction. This is a frontend-only visual upgrade — the existing data layer (`GET /training/analytics/muscle-volume`) and drill-down modal remain unchanged.

## Glossary

- **Heat_Map_Component**: The `BodyHeatMap` React Native component that renders front and back SVG body silhouettes with color-coded muscle regions based on training volume status.
- **Muscle_Region**: An individual SVG `<Path>` element representing a single muscle group (e.g., chest, quads) that can be independently filled with a color.
- **Volume_Status**: A categorical classification of a muscle group's weekly effective sets relative to its MEV and MRV landmarks. Possible values: `untrained`, `below_mev`, `optimal`, `approaching_mrv`, `above_mrv`.
- **MEV**: Minimum Effective Volume — the minimum number of weekly sets needed to stimulate growth for a muscle group.
- **MRV**: Maximum Recoverable Volume — the maximum number of weekly sets a muscle group can recover from.
- **Body_Silhouette**: A smooth, anatomically proportioned SVG outline of a human body used as the base layer beneath individual muscle region paths.
- **Color_Gradient**: The 5-tier color scale mapping volume status to fill colors for muscle regions.
- **Drill_Down_Modal**: The existing `DrillDownModal` component that displays detailed exercise-level data when a muscle region is tapped.
- **Design_Tokens**: The centralized theme values defined in `app/theme/tokens.ts` used for colors, spacing, typography, and other visual constants.

## Requirements

### Requirement 1: Anatomical SVG Body Silhouettes

**User Story:** As a user viewing the training analytics, I want to see smooth, anatomically proportioned body outlines (front and back views), so that I can quickly recognize muscle groups and interpret the heat map.

#### Acceptance Criteria

1. THE Heat_Map_Component SHALL render a front-view Body_Silhouette and a back-view Body_Silhouette side by side.
2. WHEN the Heat_Map_Component renders, THE Body_Silhouette SHALL display smooth, curved anatomical outlines resembling a human body (not blocky or stick-figure shapes).
3. THE Body_Silhouette SHALL use a subtle outline stroke that is visible against the dark background (`#0A0E13`) without overpowering the muscle region fills.
4. THE Heat_Map_Component SHALL label the front view as "Front" and the back view as "Back" above each silhouette.

### Requirement 2: Individual Muscle Region SVG Paths

**User Story:** As a user, I want each muscle group displayed as a distinct, separately colored region on the body silhouette, so that I can visually distinguish training volume across different muscles.

#### Acceptance Criteria

1. THE Heat_Map_Component SHALL render the following Muscle_Regions on the front view: chest, shoulders (front delts), biceps, forearms, abs, quads.
2. THE Heat_Map_Component SHALL render the following Muscle_Regions on the back view: back (lats and upper back), shoulders (rear delts), triceps, glutes, hamstrings, calves.
3. WHEN a Muscle_Region is rendered, THE Heat_Map_Component SHALL draw the region as a separate SVG path that fits anatomically within the Body_Silhouette.
4. WHEN adjacent Muscle_Regions are rendered, THE Heat_Map_Component SHALL maintain a visible boundary between regions using a thin stroke or gap.

### Requirement 3: Volume-Based Heat Map Color Gradient

**User Story:** As a user, I want muscle regions colored according to my training volume relative to MEV/MRV landmarks, so that I can instantly see which muscles are under-trained, optimally trained, or over-trained.

#### Acceptance Criteria

1. WHEN a Muscle_Region has zero effective sets, THE Heat_Map_Component SHALL fill the region with a gray/dark color indicating untrained status.
2. WHEN a Muscle_Region has effective sets below MEV, THE Heat_Map_Component SHALL fill the region with a green color indicating under-trained status.
3. WHEN a Muscle_Region has effective sets between MEV and MRV (inclusive), THE Heat_Map_Component SHALL fill the region with a cyan/teal color indicating optimal training status.
4. WHEN a Muscle_Region has effective sets approaching MRV (within 80-100% of MRV), THE Heat_Map_Component SHALL fill the region with an orange color indicating near-limit status.
5. WHEN a Muscle_Region has effective sets above MRV, THE Heat_Map_Component SHALL fill the region with a red color indicating over-trained status.
6. THE Heat_Map_Component SHALL display a legend mapping each Color_Gradient tier to its label (Untrained, Below MEV, Optimal, Near MRV, Above MRV).
7. THE Color_Gradient SHALL be defined using Design_Tokens so that colors are consistent with the app's theme system.

### Requirement 4: Tap-to-Inspect Muscle Detail

**User Story:** As a user, I want to tap on any muscle region to see detailed information about that muscle's training volume, so that I can make informed decisions about my programming.

#### Acceptance Criteria

1. WHEN a user taps a Muscle_Region, THE Heat_Map_Component SHALL invoke the existing Drill_Down_Modal displaying the muscle name, effective sets for the current week, and MEV/MRV landmark values.
2. WHEN a user taps a Muscle_Region, THE Heat_Map_Component SHALL provide visual feedback (brief opacity change) to confirm the tap was registered.
3. THE Heat_Map_Component SHALL maintain the same tap target area as the visible Muscle_Region path to ensure accurate touch interaction.

### Requirement 5: Color Mapping Function

**User Story:** As a developer, I want a pure function that maps volume data to heat map colors, so that the color logic is testable independently of the UI.

#### Acceptance Criteria

1. THE Color_Mapping function SHALL accept effective sets, MEV, and MRV as numeric inputs and return the corresponding Color_Gradient hex color.
2. WHEN effective sets equal zero, THE Color_Mapping function SHALL return the untrained color.
3. WHEN effective sets are greater than zero and less than MEV, THE Color_Mapping function SHALL return the below-MEV color.
4. WHEN effective sets are greater than or equal to MEV and less than or equal to MRV, THE Color_Mapping function SHALL return the optimal color.
5. WHEN effective sets are greater than 80% of MRV and less than or equal to MRV, THE Color_Mapping function SHALL return the approaching-MRV color.
6. WHEN effective sets are greater than MRV, THE Color_Mapping function SHALL return the above-MRV color.
7. IF MEV or MRV values are zero or negative, THEN THE Color_Mapping function SHALL return the untrained color as a safe fallback.

### Requirement 6: Responsive Layout and Dark Theme Integration

**User Story:** As a user on different device sizes, I want the heat map to scale properly and look native to the app's dark theme, so that the experience is consistent and polished.

#### Acceptance Criteria

1. THE Heat_Map_Component SHALL scale the SVG silhouettes proportionally to fit the available card width without cropping or distortion.
2. THE Heat_Map_Component SHALL use Design_Tokens for all colors, spacing, typography, and border radius values.
3. WHILE the app is in dark theme, THE Heat_Map_Component SHALL render the Body_Silhouette outline and Muscle_Region fills with sufficient contrast against the `#0A0E13` base background.
