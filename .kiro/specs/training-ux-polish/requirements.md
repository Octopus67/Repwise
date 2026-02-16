# Requirements Document — Training UX Polish

## User Problem

> "I'm mid-set, sweating, phone in one hand — and I can't tell which sets I've done, the timer blocks my whole screen, and I have to scroll forever to hit Finish. Every extra tap costs me focus."

The Active Workout Screen has functional coverage but lacks the interaction polish that separates a tool you tolerate from one you trust. Completed sets look identical to pending ones. The rest timer hijacks the screen. The finish button hides below the fold. RPE and Type columns add noise for users who don't use them. These friction points compound across a 60-minute session into a death-by-a-thousand-cuts retention risk.

## User Stories

1. **Primary — Intermediate lifter (4×/week):** As a lifter mid-workout, I want completed sets visually distinct and a progress count per exercise, so that I never lose my place in a long session.
2. **Primary — Time-pressed lifter:** As a lifter resting between sets, I want to see my workout while the timer runs, so that I can review previous sets and plan my next weight without waiting for the timer to finish.
3. **Secondary — Data-driven lifter:** As a lifter who tracks RPE, I want RPE shown as color-coded badges only when I opt in, so that the interface stays clean for sessions where I skip RPE.
4. **Secondary — Template user:** As a lifter following a template, I want to skip or swap exercises without losing set structure, so that I can adapt to equipment availability without rebuilding my workout.
5. **Edge — First-time user:** As a new user logging my first workout, I want contextual hints instead of a permanent banner, so that I learn the interface without permanent screen clutter.

## User Flow

### Flow 1: Logging a Set (Happy Path)
1. User opens Active_Workout_Screen → sees exercise cards with clean set rows (no RPE/Type columns by default)
2. User taps weight field → enters value → keyboard auto-advances to reps field
3. User enters reps → taps "Done" → focus advances to next empty field or next set row
4. User taps completion checkbox → row gets background tint, exercise card shows "1/4 sets"
5. Rest timer appears as floating bar at bottom → user scrolls workout, reviews next exercise
6. Timer completes → bar shows "Rest Complete" → user taps next set

**Drop-off risk:** User can't find finish button on long workouts.
**Mitigation:** Sticky Finish_Bar always visible at bottom with mini summary.

### Flow 2: Swapping an Exercise
1. User long-presses or taps "..." on Exercise_Card → context menu shows "Swap Exercise"
2. Exercise picker opens, pre-filtered to same muscle group
3. User selects replacement → card updates exercise name, all set data preserved
4. User continues logging with no data loss

### Flow 3: Finishing a Workout
1. User taps "Finish Workout" on sticky Finish_Bar
2. Confirmation_Sheet slides up with full summary: exercises, sets, volume, duration
3. User optionally toggles "Save as Template"
4. User taps "Save" → session persists → navigates to session detail

## Premium Feel

- **Completed set tint:** Subtle `positiveSubtle` background fade-in (200ms) — not a harsh toggle, a gentle acknowledgment
- **Progress indicator:** "2/4 sets" with a mini progress bar segment, accent color fill
- **Rest timer bar:** Frosted glass effect (`bg.surfaceRaised` with blur), compact ring (40px) animating smoothly, slides up from bottom with spring animation
- **Keyboard advance:** Zero-delay focus transition, no flicker between fields
- **Exercise skip:** Opacity reduction to 0.4 with a subtle strikethrough on exercise name — clearly skipped, not broken
- **Confirmation sheet:** Workout summary with clean typography hierarchy, "Save as Template" as a toggle row (not a checkbox), smooth sheet presentation
- **Haptics:** Light impact on set completion (already exists), medium impact on exercise swap confirmation, selection haptic on drag-reorder
- **Empty states:** "Generate Warm-Up" button only appears when previous data exists — no dead buttons
- **Tooltips:** Appear once with a subtle fade-in, dismiss on tap anywhere, stored in AsyncStorage

## Integration Audit

| Existing Flow | What Changes | What Stays |
|---|---|---|
| Set completion (haptics + PR detection + rest timer) | Adds background tint to row, adds progress counter to card header, rest timer changes from overlay to floating bar | Haptic feedback, PR detection logic, set validation logic unchanged |
| RestTimerOverlay (Phase 3b) | Replaced by Rest_Timer_Bar for default view; overlay available on tap-to-expand | RestTimerRing SVG component reused as-is in compact form |
| RPEPicker (Phase 3c) | RPE column hidden by default, shown via preference toggle, values displayed as colored badges | RPEPicker component itself unchanged, just conditionally rendered |
| SetTypeSelector | Type column hidden by default, revealed via long-press/swipe per row | SetTypeSelector component unchanged, just conditionally rendered |
| Info banner | Removed entirely | N/A — replaced by one-time tooltips |
| Finish/discard flow | Finish moves to sticky bar with confirmation sheet; discard moves to overflow menu | Save logic, API payload format unchanged |
| Previous performance display | Unchanged | copyPreviousToSet, formatPreviousPerformance unchanged |
| Superset grouping | Unchanged | createSuperset, removeSuperset unchanged |
| Crash recovery (AsyncStorage) | Extended to persist per-exercise notes, skip state, exercise order changes | Core persistence mechanism unchanged |
| OverloadSuggestionBadge / VolumeIndicatorPill (Phase 4) | Unchanged | Components and logic unchanged |

**Justification for breaking changes:**
- Rest timer overlay → floating bar: Users currently lose all workout visibility during rest. Every competitor (Strong, Hevy, Alpha) uses a non-blocking timer. This is the single highest-impact UX change.
- Info banner removal: Banner has zero interaction value after first session. Screen real estate is premium on mobile.
- Discard button relocation: Accidental discard is an unrecoverable data loss event. Moving to overflow menu adds one tap but eliminates catastrophic misclicks.

## Backward Compatibility

- All changes are frontend-only. No API contract changes.
- Per-exercise notes and skip state are added as optional fields in session metadata — existing sessions without these fields render normally.
- RPE/Type column visibility is controlled by local preferences (AsyncStorage). Existing users who already use RPE/Type see no change until they toggle the preference.
- Warm-up set generation is purely additive — inserts sets with type "warm-up" which the backend already supports.
- The `reorderExercises` action already exists in the store — drag-to-reorder just adds a UI gesture to invoke it.

## Edge Cases

| Edge Case | Behavior |
|---|---|
| First-time user, no previous data | No "Generate Warm-Up" button shown. Tooltips appear for RPE and Type on first interaction. |
| All sets completed in exercise | Progress shows "4/4 sets" with positive color. No auto-scroll triggered. |
| Rest timer active + user finishes workout | Rest timer bar dismissed, confirmation sheet shown. |
| Exercise swap with completed sets | All set data (including completion state) preserved. Exercise name updated. |
| Skip exercise then unskip | Full visual restoration. Set data untouched throughout. |
| Drag reorder during active rest timer | Reorder allowed. Rest timer bar stays docked, unaffected. |
| Copy from date with no sessions | Empty state message: "No sessions found for this date." |
| Network offline during save | Existing crash recovery handles this — data persisted in AsyncStorage. |
| RPE preference toggled mid-workout | RPE column appears/disappears immediately. Existing RPE values preserved in store. |
| Editing completed set value | Value updates in store. Completion state unchanged. No re-trigger of PR detection. |

## Success Metrics

1. **Primary — Set logging speed:** Median time from opening Active_Workout_Screen to completing first set decreases by ≥15% (keyboard auto-advance + cleaner layout).
2. **Primary — Session completion rate:** Percentage of started workouts that reach "Finish" increases by ≥5% (sticky finish bar + confirmation flow reduces abandonment).
3. **Guardrail — Accidental discard rate:** Discard events without subsequent re-creation decrease (overflow menu placement).

## Rollout Strategy

1. **Feature flags:** Each major change group behind a separate flag: `completed_set_visual`, `column_visibility`, `rest_timer_bar`, `sticky_finish_bar`, `keyboard_advance`, `exercise_actions`, `visual_hierarchy`.
2. **Staged rollout:** 10% → 25% → 50% → 100% over 2 weeks per flag group.
3. **Kill switch:** If session completion rate drops >2% for any cohort, revert that flag group immediately.
4. **A/B test:** Rest timer bar vs. overlay — measure "sets logged per minute during rest periods" to validate the hypothesis.

## What We're NOT Building (v1)

- **Superset-aware warm-up generation:** Warm-ups are per-exercise only. Superset warm-up sequencing is v2.
- **Cloud-synced preferences:** RPE/Type visibility preferences are local (AsyncStorage). Cross-device sync is out of scope.
- **Exercise swap history:** We don't track what was swapped from. If needed, that's a future analytics feature.
- **Animated drag-reorder with haptic detents:** v1 uses basic drag-and-drop. Spring-physics reorder animation is polish for v2.
- **Per-set notes:** Only per-exercise notes in v1. Per-set granularity adds too much UI complexity.
- **Rest timer customization per exercise:** Timer duration comes from existing logic. Per-exercise overrides are v2.

---

## Glossary

- **Active_Workout_Screen**: The full-screen workout logging interface (`ActiveWorkoutScreen.tsx`) where users log sets, weights, reps, RPE, and set types during a training session.
- **Set_Row**: A single row within an exercise card representing one set, containing fields for weight, reps, RPE, set type, and a completion checkbox.
- **Exercise_Card**: A card component within the Active_Workout_Screen that groups all Set_Rows for a single exercise, displaying the exercise name and controls.
- **Rest_Timer_Overlay**: The current full-screen modal overlay (`RestTimerOverlay.tsx`) that displays the RestTimerRing during rest periods.
- **Rest_Timer_Bar**: A new floating/docked bar at the bottom of the Active_Workout_Screen that shows a compact rest timer without obscuring the workout view.
- **Rest_Timer_Ring**: The existing SVG circular progress component (`RestTimerRing.tsx`) that visually depicts countdown progress.
- **Finish_Bar**: A sticky bottom bar always visible on the Active_Workout_Screen showing a mini workout summary and a "Finish Workout" button.
- **Confirmation_Sheet**: A bottom sheet displayed when the user taps "Finish Workout" showing a full workout summary before saving.
- **RPE_Badge**: A colored badge displaying the RPE value with color coding: green (6–7), yellow (8), orange (9), red (10).
- **Type_Badge**: A small badge shown on a Set_Row only when the set type is non-normal (warm-up, drop-set, AMRAP).
- **Overflow_Menu**: A "..." menu in the Active_Workout_Screen header providing secondary actions like discard workout.
- **Keyboard_Auto_Advance**: Behavior where focus automatically moves from weight → reps → RPE fields within a Set_Row, and "Done" advances to the next empty field.
- **Exercise_Swap**: An action that replaces the exercise on an Exercise_Card while preserving existing set structure and data.
- **Exercise_Skip**: An action that visually grays out an Exercise_Card, marking it as skipped while keeping it in the session for template continuity.
- **Warm_Up_Generator**: A feature that auto-suggests warm-up sets for compound lifts based on the working weight.
- **Active_Workout_Store**: The Zustand store (`activeWorkoutSlice.ts`) managing in-progress workout state with AsyncStorage persistence.
- **Tooltip**: A one-time contextual hint shown to first-time users explaining a feature, dismissed permanently after viewing.

---

## Requirements

### Requirement 1: Completed Set Visual State

**User Story:** As a lifter mid-workout, I want completed sets visually distinct and a progress count per exercise, so that I never lose my place in a long session.

#### Acceptance Criteria

1. WHEN a Set_Row is marked as completed, THE Active_Workout_Screen SHALL apply a distinct background tint to that Set_Row to visually differentiate it from uncompleted sets.
2. WHEN at least one set in an Exercise_Card is completed, THE Active_Workout_Screen SHALL display a progress indicator on the Exercise_Card showing the count of completed sets out of total sets (e.g., "2/4 sets").
3. WHEN a set is completed and additional uncompleted sets exist below it, THE Active_Workout_Screen SHALL auto-scroll to bring the next uncompleted Set_Row into view.
4. WHEN all sets in an Exercise_Card are completed, THE Active_Workout_Screen SHALL display the progress indicator as fully complete with a positive color accent.

### Requirement 2: Type Column Hidden by Default

**User Story:** As a lifter, I want the set type column hidden unless I need it, so that the set row stays clean and uncluttered.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL hide the Type column from Set_Rows by default.
2. WHEN a user long-presses or swipes on a Set_Row, THE Active_Workout_Screen SHALL reveal the set type selector for that specific Set_Row.
3. WHEN a non-normal set type is selected for a Set_Row, THE Active_Workout_Screen SHALL display a Type_Badge on that Set_Row indicating the selected type.
4. WHEN a set type is changed back to normal, THE Active_Workout_Screen SHALL remove the Type_Badge from that Set_Row.

### Requirement 3: RPE Column Hidden by Default

**User Story:** As a lifter who tracks RPE, I want RPE shown as color-coded badges only when I opt in, so that the interface stays clean for sessions where I skip RPE.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL hide the RPE column from Set_Rows by default.
2. WHEN the user enables RPE display via a preference toggle, THE Active_Workout_Screen SHALL show RPE as colored RPE_Badges on each Set_Row.
3. WHEN an RPE value of 6 or 7 is set, THE RPE_Badge SHALL display with a green color.
4. WHEN an RPE value of 8 is set, THE RPE_Badge SHALL display with a yellow color.
5. WHEN an RPE value of 9 is set, THE RPE_Badge SHALL display with an orange color.
6. WHEN an RPE value of 10 is set, THE RPE_Badge SHALL display with a red color.
7. WHEN RPE display is disabled, THE Active_Workout_Screen SHALL not show RPE values on Set_Rows.

### Requirement 4: Info Banner Removal

**User Story:** As a new user logging my first workout, I want contextual hints instead of a permanent banner, so that I learn the interface without permanent screen clutter.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL not display a permanent info banner about RPE or set types.
2. WHEN a user interacts with the RPE feature for the first time, THE Active_Workout_Screen SHALL display a one-time Tooltip explaining RPE usage.
3. WHEN a user interacts with the set type feature for the first time, THE Active_Workout_Screen SHALL display a one-time Tooltip explaining set types.
4. WHEN a Tooltip is dismissed, THE Active_Workout_Screen SHALL persist the dismissal so the Tooltip is not shown again.

### Requirement 5: Rest Timer as Floating Bar

**User Story:** As a lifter resting between sets, I want to see my workout while the timer runs, so that I can review previous sets and plan my next weight without waiting for the timer to finish.

#### Acceptance Criteria

1. WHEN a rest timer is active, THE Active_Workout_Screen SHALL display a Rest_Timer_Bar docked at the bottom of the screen instead of a full-screen overlay.
2. WHILE the Rest_Timer_Bar is visible, THE Active_Workout_Screen SHALL remain scrollable and interactive behind the bar.
3. THE Rest_Timer_Bar SHALL display a compact Rest_Timer_Ring, the remaining time, and skip/dismiss controls.
4. WHEN the user taps the Rest_Timer_Bar, THE Active_Workout_Screen SHALL expand the timer to a larger view with adjust controls (±15s, pause/resume).
5. WHEN the rest timer completes, THE Rest_Timer_Bar SHALL play the completion sound and display a "Rest Complete" indicator.

### Requirement 6: Sticky Finish Workout Bottom Bar

**User Story:** As a lifter, I want the finish button always accessible, so that I can end my workout without scrolling to the bottom of a long session.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL display a sticky Finish_Bar at the bottom of the screen that remains visible regardless of scroll position.
2. THE Finish_Bar SHALL display a mini workout summary showing exercise count, total sets completed, and elapsed duration (e.g., "5 exercises · 18 sets · 45 min").
3. WHEN the user taps the "Finish Workout" button on the Finish_Bar, THE Active_Workout_Screen SHALL display a Confirmation_Sheet with a full workout summary before saving.
4. THE Confirmation_Sheet SHALL include a "Save as Template" option allowing the user to save the current workout structure as a reusable template.
5. WHEN the user confirms in the Confirmation_Sheet, THE Active_Workout_Screen SHALL save the session and navigate away.

### Requirement 7: Discard Button Safety

**User Story:** As a lifter, I want the discard action protected from accidental taps, so that I do not lose workout data by mistake.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL not display the discard action as a prominent standalone button in the header.
2. THE Active_Workout_Screen SHALL place the discard action inside an Overflow_Menu accessible via a "..." icon in the header.
3. WHEN the user selects discard from the Overflow_Menu, THE Active_Workout_Screen SHALL display a confirmation alert before discarding the workout.

### Requirement 8: Visual Hierarchy Improvements

**User Story:** As a lifter, I want the most important data (exercise names, weights) to stand out visually, so that I can scan my workout quickly.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL render exercise names in the Exercise_Card header with larger and bolder typography than other text elements.
2. THE Active_Workout_Screen SHALL render weight values in Set_Rows with the primary accent color and prominent font weight.
3. THE Active_Workout_Screen SHALL render rep values in Set_Rows with the secondary text color.
4. THE Active_Workout_Screen SHALL render RPE_Badges with the accent color scheme defined in Requirement 3.
5. THE Active_Workout_Screen SHALL apply increased vertical spacing between Exercise_Cards to create clear visual separation.

### Requirement 9: Keyboard Auto-Advance

**User Story:** As a lifter, I want the keyboard to automatically move between fields, so that I can log sets quickly without tapping each field manually.

#### Acceptance Criteria

1. WHEN the user finishes entering a weight value and the reps field is empty, THE Active_Workout_Screen SHALL automatically advance focus to the reps field in the same Set_Row.
2. WHEN the user finishes entering a reps value and RPE display is enabled and the RPE field is empty, THE Active_Workout_Screen SHALL automatically advance focus to the RPE field in the same Set_Row.
3. WHEN the user taps "Done" on the keyboard and the current Set_Row has empty fields, THE Active_Workout_Screen SHALL advance focus to the next empty field in the same Set_Row.
4. WHEN the user taps "Done" on the keyboard and all fields in the current Set_Row are filled, THE Active_Workout_Screen SHALL advance focus to the weight field of the next uncompleted Set_Row.

### Requirement 10: Exercise Swap

**User Story:** As a lifter following a template, I want to swap an exercise mid-workout without losing my set data, so that I can adapt to equipment availability without rebuilding my workout.

#### Acceptance Criteria

1. WHEN the user selects "Swap Exercise" on an Exercise_Card, THE Active_Workout_Screen SHALL open the exercise picker.
2. WHEN a new exercise is selected from the picker, THE Active_Workout_Screen SHALL replace the exercise name on the Exercise_Card while preserving all existing set data (weights, reps, RPE, completion state).
3. THE exercise picker SHALL display similar exercise suggestions based on the same muscle group as the exercise being swapped.

### Requirement 11: Exercise Skip State

**User Story:** As a lifter following a template, I want to skip an exercise without deleting it, so that my template structure is preserved for future sessions.

#### Acceptance Criteria

1. WHEN the user selects "Skip Exercise" on an Exercise_Card, THE Active_Workout_Screen SHALL visually gray out the Exercise_Card and all its Set_Rows.
2. WHILE an exercise is in the skipped state, THE Active_Workout_Screen SHALL keep the Exercise_Card in the session layout and include it in the saved session metadata.
3. WHEN the user selects "Unskip Exercise" on a skipped Exercise_Card, THE Active_Workout_Screen SHALL restore the Exercise_Card to its normal visual state.
4. WHEN the session is saved, THE Active_Workout_Store SHALL mark skipped exercises in the session payload so they are excluded from volume calculations but preserved in the template.

### Requirement 12: Inline Editing of Completed Sets

**User Story:** As a lifter, I want to correct values on completed sets without toggling completion, so that fixing a typo is quick and seamless.

#### Acceptance Criteria

1. WHEN the user taps a weight or reps value on a completed Set_Row, THE Active_Workout_Screen SHALL make that field editable without changing the set's completion state.
2. WHEN the user finishes editing a value on a completed Set_Row, THE Active_Workout_Screen SHALL update the value in the Active_Workout_Store while keeping the set marked as completed.

### Requirement 13: Copy from Specific Date

**User Story:** As a lifter, I want to copy sets from any past session, so that I can replicate a workout from a specific training day.

#### Acceptance Criteria

1. WHEN the user selects "Copy from Date" on the Active_Workout_Screen, THE Active_Workout_Screen SHALL display a date picker or session history list.
2. WHEN the user selects a past session, THE Active_Workout_Screen SHALL populate the current workout with the exercises and set data from the selected session.
3. IF no sessions exist for the selected date, THEN THE Active_Workout_Screen SHALL display a message indicating no sessions are available for that date.

### Requirement 14: Per-Exercise Notes

**User Story:** As a lifter, I want to add notes to individual exercises, so that I can record cues, pain notes, or technique reminders per movement.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL provide a collapsible notes field on each Exercise_Card, hidden by default.
2. WHEN the user taps a notes icon on an Exercise_Card, THE Active_Workout_Screen SHALL expand the per-exercise notes field for editing.
3. WHEN the session is saved, THE Active_Workout_Store SHALL include per-exercise notes in the session payload.
4. WHEN a session with per-exercise notes is loaded for editing, THE Active_Workout_Screen SHALL restore and display the saved per-exercise notes.

### Requirement 15: Drag-to-Reorder Exercises

**User Story:** As a lifter, I want to rearrange exercise order mid-workout, so that I can adapt my session flow based on equipment availability or energy levels.

#### Acceptance Criteria

1. THE Active_Workout_Screen SHALL display a drag handle on each Exercise_Card.
2. WHEN the user long-presses and drags an Exercise_Card, THE Active_Workout_Screen SHALL allow reordering the exercise within the session.
3. WHEN an exercise is reordered, THE Active_Workout_Store SHALL update the exercise order and persist the change.

### Requirement 16: Warm-Up Set Generator

**User Story:** As a lifter, I want auto-suggested warm-up sets for compound lifts, so that I can ramp up safely without manually calculating warm-up weights.

#### Acceptance Criteria

1. WHEN the user adds a compound exercise with a known working weight from previous performance, THE Active_Workout_Screen SHALL offer a "Generate Warm-Up" action.
2. WHEN the user activates "Generate Warm-Up", THE Active_Workout_Screen SHALL insert warm-up sets before the working sets with a progressive ramp (e.g., bar only × 10, 60% × 5, 80% × 3).
3. THE generated warm-up sets SHALL have their set type automatically set to "warm-up".
4. WHEN no previous performance data exists for the exercise, THE Active_Workout_Screen SHALL not offer the "Generate Warm-Up" action.
