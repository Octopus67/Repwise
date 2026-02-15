# Requirements Document

## Introduction

The Periodization Calendar adds a visual planning tool to Hypertrophy OS that lets users define training blocks, view mesocycle phases on a calendar, align nutrition phases with training phases, and plan deload weeks. This feature bridges the gap between session-level logging and program-level planning, giving users a bird's-eye view of their training periodization without requiring full auto-programming.

## Glossary

- **Training_Block**: A user-defined period of training with a name, phase type, and date range (e.g., "Hypertrophy Block — 6 weeks").
- **Phase_Type**: The classification of a training block's intent. One of: accumulation, intensification, deload, peak.
- **Mesocycle**: A medium-term training cycle typically spanning 3–6 weeks, composed of one or more training blocks.
- **Deload_Week**: A planned recovery week with reduced training volume and/or intensity.
- **Nutrition_Phase**: The nutritional strategy aligned with a training phase (e.g., bulk, cut, maintenance).
- **Block_Template**: A pre-built training block configuration that users can apply to quickly set up common periodization patterns.
- **Calendar_View**: The visual weekly calendar component displaying training blocks, sessions, and nutrition alignment.
- **Session_Dot**: A visual indicator on the calendar representing a logged training session on a given date.
- **Phase_Color**: A distinct color assigned to each phase type for visual differentiation on the calendar.

## Requirements

### Requirement 1: Training Block Creation

**User Story:** As a user, I want to create training blocks with a name, phase type, and date range, so that I can define the structure of my training program.

#### Acceptance Criteria

1. WHEN a user submits a new training block with a name, phase type, start date, and end date, THE Training_Block_Service SHALL persist the block and return the created resource.
2. WHEN a user submits a training block where the end date is before the start date, THE Training_Block_Service SHALL reject the request with a validation error.
3. WHEN a user submits a training block with a phase type not in the allowed set (accumulation, intensification, deload, peak), THE Training_Block_Service SHALL reject the request with a validation error.
4. WHEN a user submits a training block that overlaps with an existing block's date range, THE Training_Block_Service SHALL reject the request with a conflict error.
5. THE Training_Block_Service SHALL store each training block with a name (1–100 characters), phase type, start date, end date, and optional nutrition phase.

### Requirement 2: Training Block Management

**User Story:** As a user, I want to update and delete my training blocks, so that I can adjust my periodization plan as my goals evolve.

#### Acceptance Criteria

1. WHEN a user updates a training block's fields, THE Training_Block_Service SHALL persist the changes and return the updated resource.
2. WHEN a user updates a training block to create an overlap with another existing block, THE Training_Block_Service SHALL reject the update with a conflict error.
3. WHEN a user deletes a training block, THE Training_Block_Service SHALL soft-delete the block so it remains recoverable.
4. WHEN a user requests their training blocks, THE Training_Block_Service SHALL return only non-deleted blocks owned by that user, ordered by start date ascending.

### Requirement 3: Calendar View

**User Story:** As a user, I want to see a visual calendar showing my training blocks color-coded by phase, so that I can understand my periodization at a glance.

#### Acceptance Criteria

1. WHEN the Calendar_View renders, THE Calendar_View SHALL display weeks as rows with each week color-coded by its corresponding training block's Phase_Color.
2. WHEN a week falls within a training block, THE Calendar_View SHALL display the block name and phase type label for that week.
3. WHEN the current date falls within a displayed week, THE Calendar_View SHALL visually highlight that week as the active week.
4. WHEN training sessions exist on dates within the calendar range, THE Calendar_View SHALL display Session_Dots on the corresponding dates.
5. WHEN no training blocks exist, THE Calendar_View SHALL display an empty state prompting the user to create a training block.

### Requirement 4: Nutrition Phase Alignment

**User Story:** As a user, I want to see how my nutrition targets align with my training phases, so that I can ensure my diet supports my training goals.

#### Acceptance Criteria

1. WHEN a training block has an associated nutrition phase, THE Calendar_View SHALL display a nutrition phase indicator alongside the training phase color.
2. WHEN a user assigns a nutrition phase (bulk, cut, maintenance) to a training block, THE Training_Block_Service SHALL persist the nutrition phase association.
3. WHEN displaying a training block with a nutrition phase, THE Calendar_View SHALL show the nutrition phase label (e.g., "Bulk", "Cut", "Maintenance") within the block's calendar row.

### Requirement 5: Deload Week Planning

**User Story:** As a user, I want to mark specific weeks as deload weeks, so that I can plan recovery into my training program.

#### Acceptance Criteria

1. WHEN a user creates a training block with phase type "deload", THE Calendar_View SHALL render that block with a distinct deload visual style.
2. WHEN displaying the calendar, THE Calendar_View SHALL visually distinguish deload blocks from other phase types using a unique Phase_Color and pattern.
3. WHEN a user has consecutive training blocks totaling more than 4 weeks without a deload, THE Calendar_View SHALL display a suggestion indicator recommending deload placement.

### Requirement 6: Block Templates

**User Story:** As a user, I want to apply pre-built block templates, so that I can quickly set up common periodization patterns without manual configuration.

#### Acceptance Criteria

1. WHEN a user requests available block templates, THE Block_Template_Service SHALL return a list of pre-defined templates with name, description, and phase sequence.
2. WHEN a user applies a block template with a chosen start date, THE Block_Template_Service SHALL generate the corresponding training blocks with correct phase types and date ranges.
3. WHEN a user applies a block template that would overlap with existing blocks, THE Block_Template_Service SHALL reject the application with a conflict error.
4. THE Block_Template_Service SHALL include at minimum these templates: "4-week hypertrophy + 1-week deload", "6-week strength block", "8-week hypertrophy mesocycle", and "3-week peaking block".

### Requirement 7: Training Block Serialization

**User Story:** As a developer, I want training block data to be correctly serialized and deserialized, so that data integrity is maintained across API boundaries.

#### Acceptance Criteria

1. THE Training_Block_Service SHALL serialize training block objects to JSON for API responses.
2. THE Training_Block_Service SHALL deserialize JSON payloads into valid training block objects for persistence.
3. FOR ALL valid training block objects, serializing then deserializing SHALL produce an equivalent object (round-trip property).
