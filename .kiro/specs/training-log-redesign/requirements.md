# Requirements Document: Training Log Redesign

## Introduction

A complete redesign of the training logging workflow, transforming the current modal-based `AddTrainingModal` into a full-screen "Active Workout" experience. The goal is to match or exceed the logging speed and intelligence of top fitness apps (Hevy, Strong, RP Strength, MacroFactor Workouts, Alpha Progression) while leveraging our unique nutrition integration advantage.

Core principle: **The logging loop must be so fast it becomes invisible — log a set in under 3 seconds.**

---

## User Problem

> "I dread logging my sets because the app makes it feel like homework. I have to remember what I did last time, manually type everything, and there's no feedback when I hit a PR. I end up just using a notes app or not tracking at all."

The current training logger is a modal overlay with no inline previous performance, no set completion confirmation, no auto-rest timer, no PR celebration, and no way to edit past sessions. It's functional but slow, and slow logging kills adherence. Every competitor shows you what you did last time right next to where you type — we don't. That's the gap.

---

## User Stories

1. **Primary — The Consistent Lifter**: As a lifter who trains 4-5x/week, I want to see my previous performance inline and tap a checkmark to confirm each set, so that I can log a full workout in under 2 minutes of total screen time.

2. **Secondary — The Template User**: As a lifter who follows a structured program, I want to save my workouts as reusable templates and start from them, so that I don't rebuild the same workout every session.

3. **Secondary — The PR Chaser**: As a lifter motivated by progress, I want to see a celebration banner when I hit a personal record, so that I feel rewarded and can track milestones.

4. **Edge Persona — The Backfiller**: As a lifter who sometimes forgets to log, I want to log workouts for past dates and edit previously saved sessions, so that my training history stays accurate.

5. **Edge Persona — The Superset Lifter**: As a lifter who uses supersets and drop sets, I want to tag set types and group exercises, so that my log reflects my actual training structure and volume calculations are correct.

---

## User Flow

### Entry Points to Active Workout

```
LogsScreen (Training tab)
  |-- FAB (+) --> Active Workout (empty, today's date)
  |-- Template card tap --> Active Workout (pre-populated from template)
  |-- "Copy Last Workout" --> Active Workout (pre-populated from last session)
  +-- Session card tap --> Session Detail View
                            +-- "Edit" --> Active Workout (edit mode, pre-populated)
```

### Core Logging Loop (per set)

```
1. User sees exercise card with Previous column showing last session's data
2. User taps Previous column value --> weight and reps auto-fill (OR types manually)
3. User adjusts weight/reps if needed (1-2 taps)
4. User taps Completion Checkmark
   |-- Set row highlights (completed state)
   |-- PR detection runs --> if PR found --> PR Banner animates in (auto-dismiss 3s)
   |-- Rest Timer auto-starts with progress ring
   |   |-- User can pause/resume, skip, or +/-15s
   |   +-- Timer completes --> notification sound + "Rest Complete" indicator
   +-- Next set row is focused for input
5. Repeat for all sets
6. User taps "+ Add Set" or moves to next exercise
```

### Finish Flow

```
1. User taps "Finish Workout" button
2. System validates: at least 1 completed set exists
   |-- No completed sets --> error toast "Complete at least one set"
   +-- Has completed sets --> continue
3. System shows finish summary: duration, total volume, exercises, PRs
4. Optional: "Save as Template?" prompt (if not from template)
5. User confirms --> session persisted --> navigate to LogsScreen
6. Session appears in history with PR indicators if applicable
```

### Drop-off Prevention

- **Mid-workout exit**: Confirmation dialog with "Keep Workout" / "Discard" because losing a half-logged workout is the #1 rage-quit trigger.
- **App backgrounded**: Duration timer continues via persisted start timestamp because lifters switch to music/messages constantly.
- **Empty set completion attempt**: Highlight missing fields instead of blocking because the user needs to see what's wrong, not just that something is wrong.
- **No previous data**: Show a dash in Previous column instead of hiding it because consistent layout prevents confusion.

---

## Premium Feel

- **Set completion**: Subtle haptic feedback (light impact) + row background color transition (0.2s ease) from default to completed state. Because tactile confirmation makes logging feel real.
- **PR Banner**: Scale-up animation from center with confetti particle effect (subtle, 1s duration). Because PRs are emotional moments and the app should celebrate with the user. Hevy does this well — we match it.
- **Rest Timer Progress Ring**: Smooth SVG arc animation at 60fps with color transition (green to yellow to red in final 10s). Because a janky timer feels broken.
- **Duration Timer**: Monospace font for the timer display to prevent layout shift as digits change. Because layout jitter is the cheapest-looking bug.
- **Template picker**: Cards with subtle shadow elevation and press-in scale animation (0.97x, 0.1s). Because flat lists feel like settings menus, not workout starters.
- **Loading states**: Skeleton placeholders for previous performance data while fetching. Because spinners feel slow, skeletons feel fast.
- **Empty states**: Illustrated empty state for first workout with clear CTA. Because a blank screen is a dead end.
- **Transitions**: Active Workout opens as a full-screen push navigation (not modal slide-up) because it signals "you're in a focused mode now."
- **Copy tone**: "You crushed it" on finish, not "Session saved successfully." Because we're a training partner, not a database.

---

## Integration Audit

| Existing Flow | What Changes | What Stays | Justification |
|---|---|---|---|
| `AddTrainingModal` | Replaced entirely by `ActiveWorkoutScreen` (full-screen push nav) | N/A — modal is removed | Modal constrains the UX; every competitor uses full-screen. No user will miss the modal. |
| `LogsScreen` training tab | Adds: session card tap to detail view, infinite scroll pagination, PR indicators on cards | Tab structure, nutrition tab, date grouping, swipe-to-delete, FAB position | Training tab gets richer but nutrition tab is untouched. Existing delete flow preserved. |
| `RestTimer` component | Rebuilt with: progress ring, pause/resume, +/-15s buttons, auto-start on set completion | Compound/isolation duration defaults, settings persistence, skip button | Current timer is functional but lacks pause and visual feedback. Rebuild is additive. |
| `PreviousPerformance` component | Moved inline into Set_Row as Previous column; batched API call replaces per-exercise calls | Data source (same backend endpoint, optimized) | Current component is a separate section below exercise name — inline is faster to read. |
| Exercise Picker navigation | Unchanged — still navigates to `ExercisePickerScreen` | Full picker flow, muscle group grid, search, recent exercises | Picker works well; no reason to change it in this phase. |
| Backend `TrainingSession` model | Extended with: `start_time`, `end_time`, `set_type` per set, `superset_groups` in metadata | `session_date`, `exercises`, `metadata`, soft delete, audit trail | Additive schema changes only. Existing sessions remain valid with null new fields. |
| Backend `WorkoutTemplate` | New model + CRUD endpoints for user-created templates | Existing 6 static templates still served | User templates are additive. Static templates become "System" category. |
| Backend PR detection | Unchanged — already detects PRs on session create | Detection logic, response schema | Frontend now surfaces what backend already returns. |
| `unitConversion.ts` | Used more extensively (set inputs, previous column, detail view) | All existing conversion functions | No changes to conversion logic, just more call sites. |
| Zustand store | Extended with: `activeWorkout` slice for in-progress workout state | All existing slices (auth, profile, subscription, etc.) | New slice is isolated. No existing state is modified. |

---

## Backward Compatibility

- **Existing sessions**: All previously logged sessions remain valid. New fields (`start_time`, `end_time`, `set_type`, `superset_groups`) default to `null` for old data. Session Detail View handles null gracefully (hides duration if no timestamps, shows "normal" if no set type).
- **API versioning**: New fields are optional in the `TrainingSessionCreate` schema. Old clients sending the current payload format continue to work without modification.
- **Static templates**: The 6 existing static templates remain available under a "System Templates" section. User-created templates appear in a separate "My Templates" section above.
- **Unit system**: Users who haven't set a preference default to `metric` (current behavior). No existing user sees a different unit without explicitly changing their preference.
- **LogsScreen**: The 7-day default view is replaced by paginated infinite scroll. Users see more data, not less. This is strictly additive — no data is hidden that was previously visible.

---

## Edge Cases

| Scenario | Behavior | Reasoning |
|---|---|---|
| First-ever workout (no history) | Previous column shows dashes for all exercises. Empty state on LogsScreen training tab with illustrated CTA. | New users need guidance, not blank screens. |
| No network during workout | Workout state is held in local Zustand store. Save attempt shows retry dialog. Duration timer continues. | Lifters are often in basements/garages with poor signal. Local state prevents data loss. |
| App killed mid-workout | On next app open, detect unsaved active workout in persisted store and prompt "Resume workout?" | Crash recovery is table stakes. Losing a 45-min workout is unforgivable. |
| Exercise with no previous data | Previous column shows dash. No tap-to-copy behavior. | Consistent layout; user types manually for new exercises. |
| User completes 0 sets and taps Finish | Show error toast "Complete at least one set to save." Finish button stays disabled until 1+ sets completed. | Prevent empty sessions from polluting history. |
| Editing a session that had PRs | Re-run PR detection on save. If edited values no longer qualify as PRs, remove PR badges. | PR integrity must be maintained. |
| Template with exercises not in database | Template stores exercise names as strings. If exercise name doesn't match database, still display it. | User-created templates may reference custom exercise names. |
| Superset with only 1 exercise | Prevent creation. Require minimum 2 exercises to form a superset. | A superset of 1 is just an exercise. |
| Very long workout (3+ hours) | Duration timer continues. No timeout. Session saves normally. | Powerlifters and marathon sessions are real use cases. |
| Past date conflicts with existing session | Allow multiple sessions per date. No conflict resolution needed. | Users may train twice in a day (AM/PM splits). |
| Unit system changed mid-workout | Apply on next workout start, not mid-workout. | Changing units mid-set would cause confusion and data entry errors. |

---

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| **Primary: Set logging speed** | Median time from set start to checkmark tap < 3 seconds | Client-side timing event from set row focus to checkmark tap |
| **Primary: Workout completion rate** | 85%+ of started workouts are finished (not discarded) | `sessions_created / workouts_started` ratio |
| **Primary: Training logging frequency** | 15% increase in sessions logged per active user per week | Backend session count per user, week-over-week |
| **Guardrail: Nutrition logging** | No decrease in nutrition entries per user | Backend nutrition entry count per user, week-over-week. Training changes must not cannibalize nutrition engagement. |

---

## Rollout Strategy

1. **Feature flag**: `training_log_v2` flag gates the new Active Workout Screen. Flag off = current `AddTrainingModal` behavior. Because we need a kill switch.
2. **Internal dogfood**: Ship to team accounts first (1 week). Because we catch the dumb bugs before users do.
3. **Staged rollout**: 10% → 25% → 50% → 100% over 3 weeks, monitoring completion rate and crash rate at each stage. Because gradual rollout limits blast radius.
4. **Kill switch criteria**: If workout completion rate drops below 70% OR crash rate exceeds 1% in the active workout flow, roll back to flag-off state immediately. Because trust is non-negotiable.
5. **A/B holdback**: Keep 5% of users on old flow for 4 weeks post-100% rollout to measure lift. Because we need causal evidence, not correlation.

---

## What We're NOT Building (v1 Scope Exclusions)

| Excluded Feature | Why |
|---|---|
| AI workout generation | Requires ML infrastructure and training data we don't have yet. Phase 2. |
| Mesocycle/periodization | Complex training programming that depends on the template system being mature. Phase 2. |
| Gym profiles (equipment per location) | Nice-to-have but not blocking the core logging experience. Phase 2. |
| Plate calculator | Useful but not core to logging speed. Phase 2. |
| Custom exercises (new exercise creation) | Requires backend schema changes to the exercise database. Phase 2. |
| Social features (workout sharing) | Engagement feature, not logging feature. Different initiative. |
| Apple Watch companion | Platform-specific work that doesn't improve the phone logging experience. Phase 2. |
| Offline mode (full offline-first) | Requires significant architecture changes (local DB, sync engine). We handle "poor signal" with local state + retry, but not true offline-first. Phase 2. |
| Auto-progression algorithm | Requires historical data analysis and ML. Depends on this phase shipping first. Phase 3. |
| RIR tracking (as alternative to RPE) | Small UX addition that can be added incrementally. Phase 1.5. |
| Exercise video/image demos | Content creation dependency. Not blocking logging. Phase 2. |
| Progress photos integration | Different feature area. Not blocking logging. |

---

## Glossary

- **Active_Workout_Screen**: The full-screen workout logging interface that replaces the current `AddTrainingModal`. Displays exercises, sets, rest timer, duration timer, and previous performance inline.
- **Set_Row**: A single row in the exercise card representing one set, containing fields for set number, previous performance, weight, reps, RPE/RIR, set type tag, and a completion checkmark.
- **Set_Type**: A tag on each set indicating its classification: `normal`, `warm-up`, `drop-set`, or `AMRAP`.
- **Completion_Checkmark**: A tappable checkbox on each Set_Row that marks the set as completed, triggering the rest timer and enabling PR detection.
- **Previous_Column**: An inline display column in each Set_Row showing the weight and reps from the user's most recent session for that exercise.
- **Rest_Timer**: A countdown timer with visual progress ring that auto-starts when a set is completed. Supports pause/resume, skip, per-exercise customization, and notification on completion.
- **Progress_Ring**: A circular SVG-based visual indicator showing rest timer progress as an animated arc that depletes over the countdown duration.
- **Duration_Timer**: A stopwatch displayed at the top of the Active_Workout_Screen showing elapsed workout time from session start.
- **PR_Banner**: A celebratory UI element (animated toast/banner) displayed when the system detects a personal record during the active workout.
- **PR_Type**: The category of personal record detected: `weight` (heaviest weight at a rep count), `reps` (most reps at a weight), `volume` (highest single-set volume), or `e1RM` (highest estimated one-rep max).
- **Session_Detail_View**: A read-only screen showing full details of a previously logged training session, including all exercises, sets, PRs achieved, duration, and notes.
- **Workout_Template**: A reusable workout blueprint storing exercises, set counts, target weights/reps, rest period preferences, and notes. Can be system-provided or user-created.
- **Superset_Group**: Two or more exercises visually grouped together with a shared bracket/indicator, intended to be performed back-to-back with minimal rest.
- **Unit_System**: The user's preferred weight unit — either `metric` (kg) or `imperial` (lbs). Stored in user preferences and applied globally to all weight displays and inputs.
- **Training_Session**: A persisted record of a completed workout containing session date, start/end timestamps, exercises with sets, metadata, and detected personal records.
- **LogsScreen**: The main screen displaying historical nutrition and training entries, organized by date with tab-based navigation.

---

## Requirements

### Requirement 1: Active Workout Screen

**User Story:** As a lifter who trains 4-5x/week, I want a full-screen workout logging experience with a duration timer, so that I can focus entirely on my training without the constraints of a modal overlay.

#### Acceptance Criteria

1. WHEN a user initiates a new workout (via FAB, template, or copy-last), THE Active_Workout_Screen SHALL present a full-screen interface via push navigation replacing the current modal overlay.
2. THE Active_Workout_Screen SHALL display the Duration_Timer at the top of the screen showing elapsed time since workout start in `HH:MM:SS` format using a monospace font.
3. THE Duration_Timer SHALL continue counting accurately when the app is backgrounded, using the persisted start timestamp for elapsed time calculation.
4. WHEN the user taps "Finish Workout" with at least one completed set, THE Active_Workout_Screen SHALL display a finish summary (duration, total volume, exercises count, PRs achieved), persist the Training_Session, and navigate back to the LogsScreen.
5. WHEN the user taps "Finish Workout" with zero completed sets, THE Active_Workout_Screen SHALL display an error toast "Complete at least one set to save" and remain on the screen.
6. WHEN the user taps "Discard Workout", THE Active_Workout_Screen SHALL prompt for confirmation and, upon confirmation, discard all data and navigate back to the LogsScreen.
7. WHEN the user has at least one completed set and attempts to leave without finishing, THE Active_Workout_Screen SHALL display a confirmation dialog with "Keep Workout" and "Discard" options.
8. THE Active_Workout_Screen SHALL persist the workout start timestamp and end timestamp (on finish) as part of the Training_Session metadata.
9. WHEN the app is killed mid-workout, THE Active_Workout_Screen SHALL persist the active workout state to local storage so it can be recovered on next app open with a "Resume workout?" prompt.

### Requirement 2: Set Completion with Checkmark

**User Story:** As a lifter, I want to tap a checkmark to confirm each set with haptic feedback, so that I have a clear, satisfying record of what I actually completed.

#### Acceptance Criteria

1. THE Set_Row SHALL display a Completion_Checkmark as the rightmost element in the row.
2. WHEN a user taps the Completion_Checkmark on a Set_Row with valid weight and reps values, THE Active_Workout_Screen SHALL mark that set as completed with a visual state change (filled checkmark, row background color transition over 0.2s) and trigger haptic feedback.
3. WHEN a user taps the Completion_Checkmark on a Set_Row with empty weight or reps fields, THE Active_Workout_Screen SHALL prevent completion and visually highlight the missing fields with an error state.
4. WHEN a user taps a completed Completion_Checkmark, THE Active_Workout_Screen SHALL toggle the set back to incomplete state.
5. WHEN a set is marked as completed, THE Active_Workout_Screen SHALL trigger the Rest_Timer to auto-start.
6. WHEN a set is marked as completed, THE Active_Workout_Screen SHALL evaluate the set for personal records against historical data and display a PR_Banner if a record is detected.

### Requirement 3: Inline Previous Performance

**User Story:** As a lifter, I want to see what I did last time for each exercise right next to my current inputs and tap to copy those values, so that I can match or beat my previous performance without navigating away.

#### Acceptance Criteria

1. THE Set_Row SHALL display a Previous_Column between the set number and the weight input field, showing the weight and reps from the most recent session for that exercise.
2. WHEN previous performance data exists for an exercise, THE Previous_Column SHALL display the data in the format `{weight}{unit} x {reps}` using the user's preferred Unit_System.
3. WHEN no previous performance data exists for an exercise, THE Previous_Column SHALL display a dash character.
4. WHEN a user taps the Previous_Column value, THE Active_Workout_Screen SHALL copy the previous weight and reps values into the current set's input fields.
5. THE Active_Workout_Screen SHALL fetch previous performance data for all exercises in the workout in a single batched API call rather than one call per exercise.
6. WHILE previous performance data is loading, THE Previous_Column SHALL display a skeleton placeholder.

### Requirement 4: Rest Timer with Visual Progress Ring

**User Story:** As a lifter, I want an automatic rest timer with a visual countdown ring and pause/resume controls after each set, so that I can maintain consistent rest periods without watching a clock.

#### Acceptance Criteria

1. WHEN a set is marked as completed via the Completion_Checkmark, THE Rest_Timer SHALL auto-start with the configured duration for that exercise type (compound or isolation).
2. THE Rest_Timer SHALL display a Progress_Ring showing the remaining time as a circular arc that animates smoothly from full to empty.
3. THE Rest_Timer SHALL display the remaining time in `M:SS` format centered within the Progress_Ring.
4. THE Progress_Ring SHALL transition color from green to yellow to red during the final 10 seconds of the countdown.
5. WHEN the user taps a pause button on the Rest_Timer, THE Rest_Timer SHALL pause the countdown and the Progress_Ring animation, and display a resume button.
6. WHEN the user taps a resume button on the paused Rest_Timer, THE Rest_Timer SHALL resume the countdown from where it was paused.
7. WHEN the user taps a skip button, THE Rest_Timer SHALL immediately dismiss and stop the countdown.
8. WHEN the Rest_Timer countdown reaches zero, THE Rest_Timer SHALL play a notification sound and display a "Rest Complete" indicator.
9. WHEN the user taps a +15s or -15s button, THE Rest_Timer SHALL adjust the remaining duration by 15 seconds without restarting.
10. THE Rest_Timer SHALL use a default duration of 180 seconds for compound exercises and 90 seconds for isolation exercises, configurable per user preference.

### Requirement 5: Unit Preference Support

**User Story:** As a lifter, I want to see and enter weights in my preferred unit (kg or lbs), so that I can use the system that I'm familiar with.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL display all weight values in the user's configured Unit_System preference (kg or lbs).
2. THE Active_Workout_Screen SHALL display the unit label (kg or lbs) in the set header row.
3. WHEN a user enters a weight value, THE Active_Workout_Screen SHALL accept the value in the user's preferred Unit_System and convert to kg for backend storage.
4. THE Previous_Column SHALL display previous performance weights converted to the user's preferred Unit_System.
5. THE Session_Detail_View SHALL display all weights in the user's preferred Unit_System.
6. WHEN the user changes their Unit_System preference in profile settings, THE Active_Workout_Screen SHALL reflect the change on next workout start without affecting any in-progress workout.

### Requirement 6: Set Type Tags

**User Story:** As a lifter who uses warm-up sets, drop sets, and AMRAP sets, I want to tag each set with its type, so that my volume calculations are accurate and my training log reflects what I actually did.

#### Acceptance Criteria

1. THE Set_Row SHALL display a Set_Type indicator that defaults to `normal`.
2. WHEN a user taps the Set_Type indicator, THE Active_Workout_Screen SHALL present a picker with options: `normal`, `warm-up`, `drop-set`, `AMRAP`.
3. WHEN a set is tagged as `warm-up`, THE Active_Workout_Screen SHALL visually distinguish the row with muted styling and exclude the set from working volume calculations.
4. WHEN a set is tagged as `AMRAP`, THE Active_Workout_Screen SHALL visually distinguish the row with accent styling to indicate maximum effort.
5. THE Set_Type tag SHALL be persisted as part of the set data in the Training_Session.
6. THE Session_Detail_View SHALL display the Set_Type tag for each set.

### Requirement 7: PR Detection and Celebration UI

**User Story:** As a lifter motivated by progress, I want to see an animated celebration banner when I hit a personal record during my workout, so that I feel rewarded and can track my milestones.

#### Acceptance Criteria

1. WHEN a set is marked as completed and the backend detects a personal record, THE Active_Workout_Screen SHALL display a PR_Banner with the PR_Type and the new record value.
2. THE PR_Banner SHALL animate into view with a scale-up animation and auto-dismiss after 3 seconds, or dismiss immediately on tap.
3. THE PR_Banner SHALL display the PR_Type (weight PR, rep PR, volume PR, or e1RM PR), the exercise name, and the new record value in the user's preferred Unit_System.
4. WHEN multiple PRs are detected for a single set, THE PR_Banner SHALL display each PR in a combined banner.
5. THE Session_Detail_View SHALL display PR badges next to sets that achieved personal records.
6. THE LogsScreen training session cards SHALL display a PR indicator icon when a session contains personal records.

### Requirement 8: Session Detail View

**User Story:** As a lifter, I want to tap a logged session to see its full details including PRs and duration, so that I can review my performance and understand what I did in that workout.

#### Acceptance Criteria

1. WHEN a user taps a training session card on the LogsScreen, THE LogsScreen SHALL navigate to the Session_Detail_View for that session.
2. THE Session_Detail_View SHALL display the session date, workout duration (if available), and total working volume (excluding warm-up sets).
3. THE Session_Detail_View SHALL display each exercise with all sets, including weight (in user's Unit_System), reps, RPE/RIR, and Set_Type tags.
4. THE Session_Detail_View SHALL display PR badges next to sets that achieved personal records.
5. THE Session_Detail_View SHALL display session notes if present in metadata.
6. THE Session_Detail_View SHALL provide an "Edit" button that navigates to the Active_Workout_Screen in edit mode pre-populated with the session data.
7. WHEN a session has no duration data (legacy session), THE Session_Detail_View SHALL hide the duration field rather than showing zero.

### Requirement 9: Session Editing

**User Story:** As a lifter who sometimes makes mistakes or forgets to log data, I want to edit a previously logged session, so that my training history stays accurate.

#### Acceptance Criteria

1. WHEN a user taps "Edit" on the Session_Detail_View, THE Active_Workout_Screen SHALL open in edit mode pre-populated with the session's existing exercise and set data.
2. WHEN editing a session, THE Active_Workout_Screen SHALL allow modification of exercises, sets (weight, reps, RPE/RIR, Set_Type), and notes.
3. WHEN editing a session, THE Active_Workout_Screen SHALL allow adding new exercises and sets, or removing existing ones.
4. WHEN the user saves an edited session, THE Active_Workout_Screen SHALL persist the changes via the update API endpoint with an audit trail of what changed.
5. WHEN the user cancels editing with unsaved changes, THE Active_Workout_Screen SHALL prompt for confirmation before discarding changes.
6. WHEN a session is edited, THE Active_Workout_Screen SHALL re-evaluate personal records for the modified sets and update PR badges accordingly.

### Requirement 10: Past Date Logging

**User Story:** As a lifter who sometimes forgets to log on the day of training, I want to log workouts for previous dates, so that my training history is complete.

#### Acceptance Criteria

1. WHEN starting a new workout, THE Active_Workout_Screen SHALL default the session date to today.
2. THE Active_Workout_Screen SHALL display a tappable date field near the top of the screen that opens a date picker.
3. WHEN the user selects a past date from the date picker, THE Active_Workout_Screen SHALL set the session date to the selected date.
4. THE Active_Workout_Screen SHALL prevent selection of future dates in the date picker.
5. WHEN a workout is saved with a past date, THE Training_Session SHALL be persisted with the selected date as the session_date.

### Requirement 11: User-Created Templates

**User Story:** As a lifter who follows a structured program, I want to save my current workout as a reusable template and manage my templates, so that I can quickly start the same workout next time.

#### Acceptance Criteria

1. WHEN a user taps "Save as Template" during the finish flow or from the Active_Workout_Screen menu, THE Active_Workout_Screen SHALL prompt for a template name and optional description.
2. THE Workout_Template SHALL store the exercise list, set counts per exercise, target weights, target reps, and notes.
3. WHEN a user starts a workout from a Workout_Template, THE Active_Workout_Screen SHALL pre-populate exercises and sets from the template with the stored target values.
4. THE template picker SHALL display user-created templates in a "My Templates" section above system-provided templates in a "System Templates" section.
5. WHEN a user long-presses a user-created template in the template picker, THE Active_Workout_Screen SHALL offer options to edit or delete the template.
6. THE Workout_Template SHALL be persisted to the backend via a new CRUD API and associated with the user's account.
7. WHEN a user edits a user-created template, THE Active_Workout_Screen SHALL allow modification of the template name, description, exercises, and set configurations.

### Requirement 12: Infinite History with Pagination

**User Story:** As a lifter, I want to browse my complete training history beyond the last 7 days, so that I can review past performance and track long-term progress.

#### Acceptance Criteria

1. THE LogsScreen training tab SHALL load training sessions using paginated API calls with a default page size of 20.
2. WHEN the user scrolls to the bottom of the training session list, THE LogsScreen SHALL automatically fetch the next page of sessions.
3. WHILE additional pages are being fetched, THE LogsScreen SHALL display a loading indicator at the bottom of the list.
4. WHEN all sessions have been loaded (total count reached), THE LogsScreen SHALL stop requesting additional pages.
5. THE LogsScreen SHALL group sessions by date with date headers, regardless of how many pages have been loaded.
6. THE LogsScreen SHALL support pull-to-refresh to reload the latest sessions from the first page.

### Requirement 13: Superset Grouping

**User Story:** As a lifter who uses supersets, I want to group exercises together with visual indicators and smart rest timer behavior, so that my training log reflects my actual workout structure.

#### Acceptance Criteria

1. WHEN a user selects two or more exercises and taps "Group as Superset", THE Active_Workout_Screen SHALL visually group the exercises with a shared colored bracket indicator.
2. THE Superset_Group SHALL display a visual connector (colored vertical bar) linking the grouped exercises.
3. WHEN a user completes a set in a Superset_Group exercise that is not the last exercise in the group, THE Active_Workout_Screen SHALL auto-scroll to the next exercise in the superset rather than starting the Rest_Timer.
4. WHEN the last exercise in a Superset_Group has a set completed, THE Active_Workout_Screen SHALL start the Rest_Timer.
5. WHEN a user taps "Ungroup" on a Superset_Group, THE Active_Workout_Screen SHALL remove the visual grouping and restore individual exercise rest timer behavior.
6. THE Superset_Group data SHALL be persisted as part of the Training_Session metadata.
7. THE Active_Workout_Screen SHALL require a minimum of 2 exercises to form a Superset_Group.
