# Training Log Workflow — Critical UX Analysis

**Analyst perspective:** Industry-grade UX design review  
**Scope:** Active workout logging screen (screenshot provided) + full training workflow  
**Benchmark:** Strong, Hevy, Alpha Progression, RP Hypertrophy  

---

## Executive Summary

The current training log screen is functional but feels like a **developer prototype, not a product**. It exposes every data field simultaneously, lacks visual hierarchy, provides no contextual intelligence, and requires too many taps to complete the most common action (logging a set). Compared to Strong (2-3 taps/set) or Hevy (3 taps/set), this UI requires **5-7 taps per set** — a 2-3x friction multiplier that compounds across a 20+ set workout into minutes of wasted time.

The screen has the bones of a good training logger but needs a fundamental rethink of information density, interaction speed, and emotional feedback.

---

## 1. CRITICAL ISSUES (Ship-Blocking)

### 1.1 Set Logging Speed — The #1 Problem

**Current state:** Each set requires the user to manually type weight, reps, and RPE into three separate text inputs. There is no tap-to-copy from previous session, no increment/decrement controls, and no pre-filled suggestions.

**What competitors do:**
- Strong: Tap previous performance → auto-fills weight + reps → tap checkmark. Done in 2 taps.
- Hevy: Same pattern. Previous values shown inline. One tap to copy, one to confirm.
- Alpha Progression: Pre-fills from last session + shows overload suggestion. User adjusts if needed.

**Impact:** A typical workout has 15-25 sets. At 5-7 taps + keyboard interaction per set vs 2-3 taps, the user spends 3-5 extra minutes just on data entry. This is the single biggest reason users abandon training loggers.

**Recommendation:**
- Show previous session's weight × reps in a "Previous" column (already in the header but shows "—" for all sets)
- Make the Previous column tappable — one tap copies values into the current set
- Add a checkmark/confirm button per set row that marks it complete and auto-advances
- Pre-fill from last session by default when loading a template or repeat workout
- Add +/- stepper buttons on weight field (increment by 2.5kg/5lb)

### 1.2 No Visual Confirmation of Completed Sets

**Current state:** The screenshot shows green checkmarks and red X buttons on some sets, but there's no visual differentiation between a completed set and an in-progress one. Set row 1 of Barbell Front Squat has a green circle, but set row 2 looks identical in styling. The user can't scan the screen and instantly know "I've done 2 of 4 sets."

**What competitors do:**
- Strong: Completed sets get a green background tint. Uncompleted sets are gray.
- Hevy: Checkmark turns green, entire row gets subtle highlight.
- RP Hypertrophy: Completed sets collapse into a summary line.

**Recommendation:**
- Completed sets should have a distinct background color (subtle green tint or left border accent)
- Uncompleted sets should have a slightly dimmed/muted appearance
- Add a progress indicator per exercise: "2/4 sets" with a mini progress bar
- Consider auto-scrolling to the next uncompleted set after confirming one

### 1.3 The "Type" Column Is Confusing

**Current state:** There's a "Type" column header with values like "A" (green circle) and "N" (teal circle). The info banner at the top explains "Type = Normal, Warm-up, Drop-set, or AMRAP" but this is buried in small text that users will read once and forget.

**Problems:**
- Single-letter codes are not self-explanatory
- The color coding (green vs teal) has no legend
- Most users log normal sets 90%+ of the time — this column wastes horizontal space for a rarely-used feature
- The info banner is a crutch for bad affordance design

**Recommendation:**
- Default to "Normal" type and hide the column entirely for most users
- Make set type accessible via long-press or swipe on the set row (contextual action)
- When a non-normal type is selected, show a small badge/tag on that set row (e.g., "W" for warmup, "D" for drop)
- Remove the info banner — if you need a banner to explain your UI, the UI needs redesigning

### 1.4 RPE Column — Wrong Default Visibility

**Current state:** RPE is shown as a column for every set with a placeholder "—". Most recreational lifters don't use RPE. Even intermediate lifters only track RPE on working sets, not warmups.

**Impact:** Adds visual noise and cognitive load for the majority of users. Makes the set row feel cramped on smaller screens.

**Recommendation:**
- Hide RPE column by default. Show it as an opt-in preference or per-exercise toggle.
- When enabled, use the RPEPicker component (already built per the tasks) instead of a raw text input
- For users who do track RPE, show it as a colored badge (green 6-7, yellow 8, orange 9, red 10) rather than a plain number

---

## 2. HIGH-SEVERITY ISSUES (Retention Impact)

### 2.1 No Rest Timer Integration in the Flow

**Current state:** The RestTimer component exists and auto-triggers when adding a set, but it appears as a full-screen modal overlay that completely obscures the workout. The user can't see their workout while resting.

**What competitors do:**
- Strong: Floating rest timer bar at bottom of screen. Workout remains visible.
- Hevy: Minimizable timer that docks to the top or bottom. User can scroll and review while resting.
- Alpha Progression: Inline timer between sets with circular progress.

**Recommendation:**
- Replace the full-screen modal with a floating/docked timer bar (top or bottom of screen)
- Show the timer as a circular SVG ring (RestTimerRing component already built per tasks) in a compact bar
- Allow the user to continue scrolling/reviewing their workout while the timer runs
- Add haptic feedback when timer completes (not just sound)

### 2.2 No Progressive Overload Feedback

**Current state:** Zero intelligence. The user logs weight and reps with no context about whether they're progressing, regressing, or plateauing. The "Previous" column exists in the header but shows "—" for every set.

**What competitors do:**
- RP Hypertrophy: Explicit overload targets per set based on mesocycle position
- Alpha Progression: "Try 82.5kg × 8" suggestion badges
- Hevy: PR badges when you hit a new personal record

**Impact:** This is the core value proposition of a hypertrophy-focused app. Without overload feedback, the app is just a dumb logbook competing against Strong (which does dumb logbook better).

**Recommendation:**
- Populate the "Previous" column with actual last-session data (the backend already has this via `previous_performance.py`)
- Add inline overload suggestion badges: "💡 Try 25kg × 12 (+2kg)"
- Show PR celebrations when the user beats their previous best (confetti animation, badge)
- Show volume tracking per muscle group during the workout: "Chest: 8/16 sets"

### 2.3 Exercise Name Entry Is Too Slow

**Current state:** The exercise name is entered via a "Tap to choose exercise" button that navigates to the ExercisePickerScreen. This is a full navigation event that closes the modal, opens a new screen, and then returns. The form state is preserved via a ref, but the context switch is jarring.

**What competitors do:**
- Strong: Inline search with instant results, no navigation
- Hevy: Bottom sheet with search + recent exercises + muscle group filter
- Alpha Progression: Inline autocomplete dropdown

**Recommendation:**
- Replace the full-screen navigation with a bottom sheet (the ExerciseDetailSheet pattern already exists)
- Show recent exercises at the top of the picker (last 10 used)
- Add muscle group quick-filter chips
- Keep the workout visible behind the sheet so the user maintains context

### 2.4 "Finish Workout" Button Placement

**Current state:** The "Finish Workout" button is a full-width teal button at the very bottom of the scroll view. The user must scroll past all exercises, past the notes field, to find it.

**Problems:**
- On a long workout (5+ exercises), the button is far below the fold
- No workout summary is shown before finishing (total volume, duration, PRs hit)
- No confirmation step — one tap and it's submitted
- "Finish Workout" and "Discard" are at opposite ends of the screen (Discard is top-right)

**Recommendation:**
- Make "Finish Workout" a sticky bottom bar that's always visible
- Show a mini summary in the bar: "5 exercises · 18 sets · 45 min"
- On tap, show a confirmation sheet with workout summary (total volume, PRs, duration) before saving
- Add "Save as Template" option in the confirmation sheet

### 2.5 No Workout Duration Tracking

**Current state:** There is no timer showing how long the workout has been running. No duration is recorded or displayed.

**What competitors do:** Every single competitor shows a running workout timer. It's table stakes.

**Recommendation:**
- Add a running timer in the header bar (next to the date)
- Auto-start when the first set is logged
- Save duration with the session
- Show duration in the session history cards

---

## 3. MEDIUM-SEVERITY ISSUES (Polish & Delight)

### 3.1 Visual Hierarchy Is Flat

**Current state:** Every element has roughly the same visual weight. Exercise names, set numbers, weight values, RPE values — they all use similar font sizes and colors. The dark theme makes everything blend together.

**Recommendation:**
- Make exercise names larger and bolder — they're the primary anchor
- Make weight values the most prominent number in each set row (it's what users care about most)
- Use color to differentiate: weight in white/primary, reps in secondary, RPE in accent
- Add subtle dividers or spacing between exercises (current cards help but need more breathing room)

### 3.2 The Info Banner Is Wasted Space

**Current state:** A teal info banner at the top reads: "RPE = how hard the set felt (6 easy → 10 max effort) · Type = Normal, Warm-up, Drop-set, or AMRAP · Tap Previous to copy last session's values"

**Problems:**
- Takes up valuable screen real estate on every session
- Users read it once and then it's just noise
- The information should be discoverable contextually, not broadcast permanently

**Recommendation:**
- Remove the banner entirely
- Add contextual tooltips: first time a user taps RPE, show a one-time tooltip explaining the scale
- Add an onboarding walkthrough for first-time workout loggers (3-4 step coach marks)
- If any explanation is needed, put it in a collapsible "?" icon

### 3.3 "Discard" Button Styling

**Current state:** "Discard" is a red text link in the top-right corner. It's the same visual weight as the date in the top-center.

**Problems:**
- Destructive action should not be casually placed next to navigation elements
- No visual distinction between "Discard" (destructive) and "Mon, Feb 16" (informational)
- Easy to accidentally tap on smaller screens

**Recommendation:**
- Move "Discard" into a "..." overflow menu in the header
- Or make it a ghost button with a red border so it's clearly a destructive action
- Always show the confirmation dialog (which already exists in code)

### 3.4 No Superset/Circuit Support in the UI

**Current state:** Exercises are displayed as independent cards with no way to group them. Users doing supersets (alternating between two exercises) have no way to express this relationship.

**What competitors do:**
- Hevy: Drag to reorder + bracket notation for supersets
- Strong: Superset grouping with visual connector
- Alpha Progression: Circuit mode with rotation indicator

**Recommendation:**
- Add a "Link as Superset" action (long-press or drag) that visually brackets two exercises
- Show a visual connector (bracket or colored border) between superseted exercises
- Alternate rest timer behavior for supersets (rest after the pair, not after each exercise)

### 3.5 Notes Field Is an Afterthought

**Current state:** A single "Notes" text area at the bottom of the entire workout. No per-exercise notes.

**Recommendation:**
- Add per-exercise notes (collapsible, hidden by default)
- Move workout-level notes into the "Finish Workout" confirmation sheet
- Support voice-to-text for notes (gym users have sweaty hands)

### 3.6 No Keyboard Optimization

**Current state:** Standard numeric keyboard for weight/reps/RPE inputs. User must tap into each field individually.

**Recommendation:**
- Auto-advance focus: after entering reps, auto-focus moves to weight field, then RPE
- Add a custom numeric input bar with quick-select common values (e.g., 5, 8, 10, 12 for reps)
- "Done" button on keyboard should advance to next empty field, not dismiss keyboard

---

## 4. LOW-SEVERITY ISSUES (Nice-to-Have)

### 4.1 No Drag-to-Reorder Exercises
Users can't rearrange exercise order mid-workout. Add drag handles.

### 4.2 No Plate Calculator
When entering weight, show a plate breakdown (e.g., "2×20kg + 2×5kg + 2×1.25kg per side"). Strong and Hevy both have this.

### 4.3 No Unit Toggle
The screen shows "kg" but there's no way to switch to "lbs" inline. This should respect the user's profile preference and be toggleable.

### 4.4 No Warm-Up Set Generator
For compound lifts, auto-suggest warm-up sets ramping to the working weight (e.g., bar × 10, 60% × 5, 80% × 3).

### 4.5 No Session Photos
Users can't attach progress photos or form-check videos to a session.

---

## 5. USER FLOW GAPS

### 5.1 Flow: "I want to repeat last Tuesday's workout"
**Current:** Tap + → Log Training → Templates → Copy Last Workout → hope it was Tuesday's.  
**Problem:** "Copy Last Workout" only copies the most recent session, not a specific date's session.  
**Fix:** Add a calendar/history picker in the copy flow. "Copy from: [date picker or session list]"

### 5.2 Flow: "I want to swap an exercise mid-workout"
**Current:** Delete the exercise card → Add new exercise → re-enter all sets.  
**Problem:** Loses all set data. No "swap" concept.  
**Fix:** Add "Swap Exercise" action that preserves set structure (reps/weight) and just changes the exercise name. Show "similar exercises" suggestions.

### 5.3 Flow: "I want to see my progress on this exercise"
**Current:** No way to view history for a specific exercise from within the workout.  
**Problem:** User has to leave the workout, go to Analytics, find the exercise.  
**Fix:** Tap exercise name → show exercise detail sheet with history chart, PR timeline, and volume trend.

### 5.4 Flow: "I finished a set but want to edit it"
**Current:** Tap into the text field and retype.  
**Problem:** On a completed (green checkmark) set, the user has to un-complete it, edit, re-complete.  
**Fix:** Allow inline editing of completed sets without un-completing. Just tap the value to edit.

### 5.5 Flow: "I want to skip an exercise today"
**Current:** Delete the exercise card entirely.  
**Problem:** Deleting removes it from the template context. No "skipped" state.  
**Fix:** Add a "Skip" action that grays out the exercise but keeps it in the session for template continuity.

### 5.6 Flow: "My workout crashed / I accidentally closed the app"
**Current:** The code has `formStateRef` for preserving state across exercise picker navigation, but no persistent crash recovery.  
**Problem:** If the app crashes mid-workout, all data is lost.  
**Fix:** Persist active workout state to AsyncStorage on every set completion. Show "Resume workout?" on next app open. (This is already designed in the spec but not visible in the current screenshot's implementation.)

---

## 6. COMPETITIVE POSITIONING SUMMARY

| Capability | Strong | Hevy | Alpha Prog | Current State | Target |
|---|---|---|---|---|---|
| Taps per set | 2-3 | 2-3 | 3-4 | 5-7 | 2-3 |
| Previous performance | ✅ inline | ✅ inline | ✅ + suggestion | ❌ shows "—" | ✅ + suggestion |
| Rest timer UX | floating bar | minimizable | inline ring | full-screen modal | floating ring |
| PR celebration | ✅ badge | ✅ confetti | ✅ badge | ❌ none | ✅ confetti + badge |
| Exercise images | ❌ | ✅ GIF | ❌ | ❌ | ✅ GIF + SVG |
| Superset support | ✅ | ✅ | ✅ | ❌ | ✅ |
| Overload suggestions | ❌ | ❌ | ✅ | ❌ | ✅ |
| Crash recovery | ✅ | ✅ | ✅ | ❌ | ✅ |
| Workout duration | ✅ | ✅ | ✅ | ❌ | ✅ |
| Volume tracking | ❌ | ❌ | ✅ | ❌ | ✅ |

---

## 7. PRIORITY MATRIX

### Do First (Week 1-2) — Unblock retention
1. Populate "Previous" column with real data + tap-to-copy
2. Add completed-set visual state (background tint + progress count)
3. Replace full-screen rest timer with floating bar
4. Add workout duration timer
5. Remove info banner, hide RPE/Type columns by default

### Do Next (Week 3-4) — Match competitors
6. Overload suggestion badges
7. PR detection + celebration animation
8. Bottom sheet exercise picker (replace full-screen navigation)
9. Sticky "Finish Workout" bar with mini summary
10. Crash recovery via AsyncStorage persistence

### Do Later (Week 5-6) — Differentiate
11. Superset grouping UI
12. Per-exercise notes
13. Exercise swap (preserve sets)
14. Volume tracking pills during workout
15. Warm-up set generator

---

## 8. EMOTIONAL DESIGN GAPS

The current screen is **transactional** — it asks the user to input data and gives nothing back. Premium fitness apps create an emotional loop:

1. **Anticipation:** "Here's what you did last time. Can you beat it?" → Missing entirely
2. **Flow:** "Log this set in 2 taps and get back to lifting" → Currently 5-7 taps
3. **Celebration:** "New PR! You just squatted 25kg × 12 for the first time!" → Missing entirely
4. **Progress:** "You've added 10kg to your squat this month" → Missing entirely

Without this emotional loop, the app is a spreadsheet with a dark theme. The user has no reason to prefer it over a Notes app or a paper logbook.

---

*End of analysis. All recommendations are prioritized by retention impact and implementation feasibility based on the existing component architecture and backend capabilities.*
