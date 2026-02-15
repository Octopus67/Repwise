# Log Screen Redesign — Requirements

## Overview
Redesign the "Log" tab from a flat chronological dump into a speed-optimized launchpad. The core principle: **every tap should move the user closer to logging food or starting a workout.** Favorites, templates, and history are means to that end — not destinations.

Informed by competitive analysis of Strong, Hevy, MacroFactor, RP Hypertrophy, Carbon Diet Coach, MyFitnessPal, and Cronometer. See `competitive-analysis.md` for full details.

## Key Design Decisions (from competitive analysis)
- Keep tab name as "Log" (not "Library") — matches user mental model and every competitor
- Nutrition tab: meal-slot view (not flat list) — matches MFP/Cronometer/Dashboard pattern
- Training tab: "Start Workout" as hero action — matches Strong/Hevy pattern
- Quick Re-log section uses behavioral data (frequency + recency), not just explicit favorites
- Minimize sections: 2-3 per tab max, not 4+ collapsible sections

---

## User Stories

### Requirement 1: Quick Re-log Section (Nutrition Tab)
**User Story:** As a user, I want to see foods I eat regularly at the top of the nutrition tab so I can re-log them in one tap without searching.

**Acceptance Criteria:**
- [ ] AC1: "Quick Re-log" row appears at the top of the Nutrition tab
- [ ] AC2: Shows 3-5 food items based on: logging frequency, recency, and time-of-day correlation
- [ ] AC3: Each item shows food name (truncated) and calorie count
- [ ] AC4: Tapping an item opens AddNutritionModal pre-filled with that food's macros and last-used serving size
- [ ] AC5: Row is horizontally scrollable if >3 items
- [ ] AC6: Falls back to explicit favorites (from `GET /meals/favorites`) if insufficient behavioral data
- [ ] AC7: Hidden entirely for brand-new users with no logging history

### Requirement 2: Meal-Slot Nutrition View
**User Story:** As a user, I want my daily nutrition entries grouped by meal (Breakfast/Lunch/Snack/Dinner) so I can see what I ate per meal, not just a flat list.

**Acceptance Criteria:**
- [ ] AC1: BudgetBar appears at the top showing remaining calories and macro breakdown
- [ ] AC2: Entries grouped into 4 meal slots: Breakfast, Lunch, Snack, Dinner
- [ ] AC3: Each slot shows slot name, total calories, and a "+" button to add food to that specific slot
- [ ] AC4: Slots are collapsible (tap header to toggle) with entries listed inside
- [ ] AC5: Empty slots show a subtle "+" add prompt (not a full empty state)
- [ ] AC6: Swipe-to-delete preserved on individual entries within slots
- [ ] AC7: Date navigator (‹ date ›) remains at the top, controlling which day is shown

### Requirement 3: Favorites & Copy Meals (Secondary Actions)
**User Story:** As a user, I want access to my explicit favorites and copy-meals functionality without them cluttering the primary view.

**Acceptance Criteria:**
- [ ] AC1: "Favorites" section appears below meal slots, collapsed by default if Quick Re-log is populated
- [ ] AC2: Favorites fetched from `GET /meals/favorites` API
- [ ] AC3: Each favorite shows name, calories, and a one-tap "Log" button
- [ ] AC4: CopyMealsBar accessible via a "More actions" row or overflow menu below favorites
- [ ] AC5: Empty state for favorites: "Star foods when logging to save them here"

### Requirement 4: Training Tab — Start Workout Hero Action
**User Story:** As a user, I want to start a workout immediately when I open the training tab, not browse through history first.

**Acceptance Criteria:**
- [ ] AC1: Large "Start Workout" button appears at the top of the Training tab
- [ ] AC2: Button offers two options: "Empty Workout" and "From Template" (if templates exist)
- [ ] AC3: Tapping "Empty Workout" navigates to ActiveWorkout with `{ mode: 'new' }`
- [ ] AC4: Tapping "From Template" shows a template picker (user templates first, then pre-built)
- [ ] AC5: If `training_log_v2` feature flag is off, falls back to AddTrainingModal

### Requirement 5: Training Tab — Templates Section
**User Story:** As a user, I want quick access to my workout templates so I can start a routine without rebuilding it each time.

**Acceptance Criteria:**
- [ ] AC1: "My Templates" section appears below the Start Workout button
- [ ] AC2: Shows user-created templates from `GET /training/user-templates`
- [ ] AC3: Each template shows name, exercise count, and a "Start" button
- [ ] AC4: Tapping "Start" navigates to ActiveWorkout pre-loaded with template exercises
- [ ] AC5: "Browse all templates →" link at bottom opens full template list (user + pre-built)
- [ ] AC6: Section hidden if user has no templates (pre-built templates accessible via Start Workout → From Template)

### Requirement 6: Training Tab — Session History
**User Story:** As a user, I want to see my recent training sessions so I can review past workouts and repeat them.

**Acceptance Criteria:**
- [ ] AC1: "Recent Sessions" section appears below templates
- [ ] AC2: Shows sessions in reverse chronological order with infinite scroll pagination
- [ ] AC3: Each session shows date, exercise count, and PR star indicator if applicable
- [ ] AC4: Tapping a session navigates to SessionDetail view
- [ ] AC5: Swipe-to-delete preserved on session cards
- [ ] AC6: No separate "Recent Workouts" section — history IS the recent workouts list

### Requirement 7: Collapsible Sections with Smart Defaults
**User Story:** As a user, I want sections to be collapsible so the screen doesn't feel overwhelming, with sensible defaults.

**Acceptance Criteria:**
- [ ] AC1: Each section header is tappable to collapse/expand
- [ ] AC2: Smart defaults: Quick Re-log always expanded, meal slots always expanded, favorites collapsed if Quick Re-log has items, history expanded
- [ ] AC3: Collapse state persists during session (not across app restarts)
- [ ] AC4: Collapsed sections show header with chevron indicator (▸/▾)
