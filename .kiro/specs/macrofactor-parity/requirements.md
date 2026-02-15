# Requirements Document

## Introduction

This specification covers 10 features that bring HypertrophyOS to competitive parity with MacroFactor, the leading calorie/macro tracking app. These features address a core retention problem: users who log food once often don't return because the current logging UX is too friction-heavy and the feedback loop (what did I eat? how am I doing?) is too slow.

**Customer Quote:** "I logged my meals for two days but stopped because I couldn't see what I'd eaten at a glance, and re-entering the same meals every day was tedious."

**What We're NOT Building (v1 scope):**
- Barcode/label scanner (requires camera permissions, third-party DB integration — separate spec)
- Lock screen widgets (platform-specific native modules — separate spec)
- Custom keyboard for serving sizes (low ROI relative to complexity)
- Timeline-based food log with hour-level summaries (meal slots are the 80/20 solution)
- Multi-paste for weekly meal planning (copy-day covers the primary use case)

**Rollout Strategy:** All 10 features ship behind a `macrofactor_parity` feature flag. Staged rollout: 10% → 25% → 50% → 100% over 2 weeks. Kill switch criteria: >5% drop in daily nutrition logging rate or >10% increase in crash rate.

**Success Metrics:**
- Primary: 7-day nutrition logging retention (% of users who log food on 5+ of 7 days)
- Primary: Average daily food entries per active user
- Guardrail: Existing training logging rate stays flat (±2%)

## Glossary

- **Dashboard**: The main screen (`DashboardScreen.tsx`) showing macro rings, today summary, quick actions, and featured articles.
- **Food_Diary**: The nutrition tab within the Logs screen (`LogsScreen.tsx`) displaying nutrition entries grouped by date.
- **Nutrition_Entry**: A single logged food item with calories, protein_g, carbs_g, fat_g, micro_nutrients, meal_name, entry_date, and created_at timestamp.
- **Meal_Slot**: A categorical grouping for food entries within a day — one of Breakfast, Lunch, Snack, or Dinner.
- **Quick_Add**: A simplified nutrition entry that accepts only calorie and optional macro values without food search.
- **Budget_Bar**: A persistent UI element showing remaining calories and macros relative to daily targets.
- **Date_Scroller**: A horizontal scrollable bar showing a week of dates with logging indicators.
- **TDEE**: Total Daily Energy Expenditure — estimated daily calorie burn derived from weight trends and calorie intake.
- **Expenditure_Trend**: A time-series visualization of estimated TDEE over multiple weeks.
- **Adherence_Neutral_Colors**: A color system that uses neutral tones (muted blue) instead of warning/negative colors when targets are exceeded, because shaming users for going over reduces logging consistency.
- **Weekly_Summary**: An aggregated view of 7-day nutrition data showing averages, totals, and adherence patterns.
- **Adaptive_Engine**: The existing backend module (`src/modules/adaptive/engine.py`) that computes caloric and macro targets from bodyweight history and activity level.
- **Nutrition_Service**: The backend service (`src/modules/nutrition/service.py`) handling CRUD for nutrition entries.
- **Theme_Tokens**: The design token system (`app/theme/tokens.ts`) defining colors, spacing, typography, and radii.

## Requirements

### Requirement 1: Meal-Slot Food Diary on Dashboard

**User Story:** As a user, I want to see today's food entries grouped by meal slot on the dashboard, so that I can quickly understand what I've eaten at each meal and identify where I have room to add more food.

**Why this matters:** The current dashboard shows "X meals logged" — a number with no context. Users can't see what they ate without navigating to the Logs screen. MacroFactor's per-meal breakdown is their #1 engagement driver because it answers "what should I eat next?" at a glance.

**Integration impact:** Replaces the `TodaySummaryRow` "meals logged" count with a richer meal-slot section. The macro rings, quick actions, streak indicator, and featured articles sections remain unchanged. The `loadDashboardData` function adds a meal_slot grouping step after fetching nutrition entries.

**Edge cases:** First-time user with zero entries sees four empty meal slots with "+" buttons (encouraging first log). Offline/error state falls back to the existing "X meals logged" summary.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Dashboard SHALL display today's Nutrition_Entries grouped into four Meal_Slots: Breakfast, Lunch, Snack, and Dinner.
2. WHEN a Meal_Slot contains one or more Nutrition_Entries, THE Dashboard SHALL display the per-slot calorie subtotal and macro subtotals (protein_g, carbs_g, fat_g).
3. WHEN a Meal_Slot contains zero Nutrition_Entries, THE Dashboard SHALL display a "+" button that opens the AddNutritionModal pre-filled with that Meal_Slot name.
4. WHEN a user taps a populated Meal_Slot header, THE Dashboard SHALL expand or collapse the list of individual entries within that slot.
5. WHEN grouping entries into Meal_Slots, THE Dashboard SHALL assign entries based on the meal_name field: entries containing "breakfast" map to Breakfast, "lunch" to Lunch, "snack" to Snack, "dinner" to Dinner, and all others to Snack as the default slot.
6. WHEN the Meal_Slot diary is displayed, THE Dashboard SHALL show a running daily total of calories and macros across all slots at the top of the diary section.

### Requirement 2: Quick Add (Calorie-Only Entry)

**User Story:** As a user, I want to quickly log calories and optionally macros without searching for a food item, so that I can capture rough intake when I don't know the exact food or don't want to spend time searching.

**Why this matters:** The current AddNutritionModal requires filling 4 macro fields minimum. For a quick snack or eating out, users just want to log "~500 cal" and move on. Every second of friction in logging reduces the chance they log at all.

**Integration impact:** Adds a "Quick Add" button to the Dashboard quick actions row and a new tab/shortcut in AddNutritionModal. The existing food search, favorites, and meal plan flows remain unchanged.

**Edge cases:** User enters 0 or negative calories → validation error. User enters only calories with no macros → protein/carbs/fat default to 0. User enters calories > 10,000 → validation warning (likely typo).

#### Acceptance Criteria

1. WHEN a user taps the Quick_Add button on the Dashboard or in the AddNutritionModal, THE System SHALL present a minimal form with a calories field and optional protein_g, carbs_g, and fat_g fields.
2. WHEN a user submits a Quick_Add entry with only calories filled, THE Nutrition_Service SHALL create a Nutrition_Entry with the provided calories and zero values for protein_g, carbs_g, and fat_g.
3. WHEN a user submits a Quick_Add entry, THE System SHALL set the meal_name to "Quick add" and the entry_date to the currently viewed date.
4. IF a user submits a Quick_Add entry with a non-positive calorie value, THEN THE System SHALL reject the submission and display a validation message.
5. IF a user submits a Quick_Add entry with calories exceeding 10000, THEN THE System SHALL display a confirmation prompt asking the user to verify the value.

### Requirement 3: Remaining Budget Bar

**User Story:** As a user, I want to see how many calories and macros I have remaining for the day at a glance, so that I can plan my remaining meals without mental math.

**Why this matters:** The macro rings show progress but require interpreting percentages. A simple "X kcal remaining" with macro breakdown answers the question "how much can I still eat?" instantly. This is the single most-requested feature in calorie tracking apps.

**Integration impact:** New component rendered above the meal-slot diary on Dashboard and at the top of the Food_Diary in LogsScreen. Does not modify existing components — purely additive.

**Edge cases:** No adaptive targets set → Budget_Bar shows "Set targets in profile" link. Targets are 0 → Budget_Bar is hidden. Over target → shows negative remaining with neutral color (not red/warning).

#### Acceptance Criteria

1. WHEN the Food_Diary or Dashboard is displayed, THE Budget_Bar SHALL show the remaining calories calculated as (target_calories - consumed_calories).
2. WHEN the Food_Diary or Dashboard is displayed, THE Budget_Bar SHALL show remaining protein_g, carbs_g, and fat_g calculated as (target - consumed) for each macro.
3. WHEN a Nutrition_Entry is added or deleted, THE Budget_Bar SHALL update its values within the same render cycle without requiring a page refresh.
4. WHEN consumed calories exceed target calories, THE Budget_Bar SHALL display the overage as a negative remaining value using Adherence_Neutral_Colors.
5. THE Budget_Bar SHALL display a linear progress indicator showing the ratio of consumed_calories to target_calories, clamped between 0% and 100%.
6. IF no adaptive targets exist for the user, THEN THE Budget_Bar SHALL display a prompt to complete onboarding or set targets in profile settings.

### Requirement 4: Horizontal Date Scroller on Dashboard

**User Story:** As a user, I want to quickly navigate between days on the dashboard, so that I can review past days' nutrition and plan ahead without leaving the main screen.

**Why this matters:** Currently, viewing a different day's data requires navigating to the Logs screen and scrolling through date-grouped entries. A date scroller on the dashboard makes day-switching a single tap, which is critical for users who review yesterday's intake every morning.

**Integration impact:** New component inserted between the header and macro rings on Dashboard. The `loadDashboardData` function is parameterized to accept a date instead of always using today. All downstream components (macro rings, meal slots, budget bar) react to the selected date.

**Edge cases:** Future dates → show empty state with "Plan ahead" messaging. Dates older than 90 days → scroller stops (matches existing data retention). Rapid date switching → debounce API calls to prevent flooding.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Date_Scroller SHALL display the current week (Monday through Sunday) with today highlighted.
2. WHEN a user taps a date in the Date_Scroller, THE Dashboard SHALL reload all nutrition data, meal slots, and budget bar for the selected date.
3. WHEN a user swipes the Date_Scroller horizontally, THE Date_Scroller SHALL navigate to the previous or next week.
4. WHEN a date has at least one Nutrition_Entry logged, THE Date_Scroller SHALL display a small dot indicator below that date.
5. THE Date_Scroller SHALL display each day using a two-line format: abbreviated day name (Mon, Tue) on the first line and day number on the second line.
6. WHEN a user rapidly switches dates (more than 2 taps within 500ms), THE Dashboard SHALL debounce API calls and only fetch data for the last selected date.

### Requirement 5: Food Entry Timestamps

**User Story:** As a user, I want to see the time each food entry was logged, so that I can understand my eating patterns throughout the day and identify timing-related habits.

**Why this matters:** Timestamps transform a flat list of foods into a timeline. Users can see "I ate lunch at 3pm — that's why I was starving by dinner." The backend already stores `created_at` — this is purely a frontend display change.

**Integration impact:** Adds timestamp display to Nutrition_Entry cards in both LogsScreen and the new Dashboard meal-slot view. No backend changes required — `created_at` is already returned in API responses.

**Edge cases:** Entries copied from another day have the copy timestamp, not the original — this is correct behavior (shows when the copy was made). Entries with null created_at (legacy data) → hide timestamp gracefully.

#### Acceptance Criteria

1. WHEN displaying a Nutrition_Entry in the Food_Diary or Meal_Slot view, THE System SHALL show the entry's created_at timestamp formatted as a localized short time (e.g., "8:30 AM").
2. WHEN multiple Nutrition_Entries exist within the same Meal_Slot, THE System SHALL sort them in ascending chronological order by created_at.
3. WHEN a Nutrition_Entry has a null or missing created_at value, THE System SHALL omit the timestamp display for that entry without affecting other entries.

### Requirement 6: Copy Previous Day's Meals

**User Story:** As a user, I want to copy all meals from a previous day to today, so that I can quickly log repeated meals without re-entering each one individually.

**Why this matters:** Many fitness-focused users eat similar meals daily (meal prep). Re-logging the same 5-6 items every day is the #1 reason users abandon calorie tracking after week 1. "Copy Yesterday" reduces a 3-minute task to a single tap.

**Integration impact:** Adds "Copy Yesterday" and "Copy from Date" buttons to the Food_Diary header area. Creates a new backend endpoint `POST /nutrition/entries/copy` that duplicates entries. Existing entry creation, deletion, and update flows remain unchanged.

**Edge cases:** Copying to a day that already has entries → appends (doesn't replace). Source day has 0 entries → show "No entries found" message. Copying 20+ entries → show loading indicator. Network failure mid-copy → partial copy is acceptable (entries are independent).

#### Acceptance Criteria

1. WHEN a user taps "Copy Yesterday" on the Food_Diary, THE Nutrition_Service SHALL duplicate all non-deleted Nutrition_Entries from yesterday to the currently viewed date, preserving meal_name, calories, protein_g, carbs_g, fat_g, and micro_nutrients.
2. WHEN a user taps "Copy from Date" on the Food_Diary, THE System SHALL present a date picker, and THE Nutrition_Service SHALL duplicate all non-deleted Nutrition_Entries from the selected date to the currently viewed date.
3. WHEN entries are copied, THE Nutrition_Service SHALL assign new unique IDs and set entry_date to the target date for each copied entry.
4. IF the source date has zero Nutrition_Entries, THEN THE System SHALL display a message indicating no entries were found to copy.
5. WHEN entries are being copied, THE System SHALL display a loading indicator and disable the copy buttons until the operation completes.

### Requirement 7: Swipe-to-Delete on Food Entries

**User Story:** As a user, I want to swipe left on a food entry to delete it, so that I can remove incorrect entries quickly without navigating through a confirmation dialog.

**Why this matters:** The current delete flow requires long-press → Alert.alert → tap "Delete". That's 3 interactions for a common action. Swipe-to-delete is a platform convention that users expect. Reducing friction on corrections keeps users logging.

**Integration impact:** Replaces the `TouchableOpacity` + `handleDeleteNutrition` Alert pattern in LogsScreen with a swipeable row component. The underlying `api.delete` call and soft-delete behavior remain unchanged.

**Edge cases:** Accidental swipe → the delete button is revealed but not triggered (requires explicit tap). Swipe on training entries → same pattern applies for consistency. Swipe while scrolling → gesture conflict resolved by requiring horizontal swipe threshold.

#### Acceptance Criteria

1. WHEN a user swipes left on a Nutrition_Entry in the Food_Diary, THE System SHALL reveal a delete action button.
2. WHEN a user taps the revealed delete button, THE Nutrition_Service SHALL soft-delete the entry and THE Food_Diary SHALL remove it from the list with a slide-out animation.
3. WHEN a user swipes left on a Nutrition_Entry, THE System SHALL display the delete action with a red background and a trash icon.
4. WHEN a swipe gesture is less than 30% of the row width, THE System SHALL snap the row back to its original position without revealing the delete button.

### Requirement 8: Weekly Nutrition Summary

**User Story:** As a user, I want to see a 7-day nutrition summary on the analytics screen, so that I can identify patterns and trends beyond a single day and understand my weekly consistency.

**Why this matters:** Single-day views create anxiety ("I went over today!"). Weekly views normalize variance ("I averaged 2100 kcal/day this week, right on target"). This reframes the user's relationship with their data from daily judgment to weekly patterns.

**Integration impact:** New section added to AnalyticsScreen between the existing "Calorie Trend" and "Protein Trend" cards. Uses the same nutrition data already fetched by `loadAnalytics`. No new API endpoints required — computed client-side from existing data.

**Edge cases:** 0 days logged → show encouraging empty state. 1 day logged → show that day's data with "Log more days to see weekly patterns" message. Some days missing → calculate averages only from days with data, show count of logged days.

#### Acceptance Criteria

1. WHEN the Analytics screen loads, THE Weekly_Summary section SHALL display the average daily calories and average daily macros (protein_g, carbs_g, fat_g) for the past 7 days, calculated only from days that have at least one Nutrition_Entry.
2. WHEN the Analytics screen loads, THE Weekly_Summary section SHALL identify and display the best adherence day (closest to calorie target) and worst adherence day (furthest from calorie target) within the past 7 days.
3. WHEN the Analytics screen loads, THE Weekly_Summary section SHALL display the total water intake in milliliters for the past 7 days.
4. WHEN fewer than 2 days have logged Nutrition_Entries in the past 7 days, THE Weekly_Summary section SHALL display a message encouraging the user to log more consistently.
5. THE Weekly_Summary SHALL display the number of days with logged entries out of 7 (e.g., "5 of 7 days logged").

### Requirement 9: Expenditure Trend (TDEE Estimation)

**User Story:** As a user, I want to see my estimated TDEE over time, so that I can understand how my metabolism is adapting to my diet and training and make informed decisions about calorie targets.

**Why this matters:** This is MacroFactor's core moat — showing users their actual metabolic rate rather than a formula estimate. Even a simplified version (formula-based from weight trend + intake) provides massive value because it answers "are my calories actually right for my goal?"

**Integration impact:** New card on AnalyticsScreen. Requires a new backend endpoint or client-side computation that combines bodyweight history (already fetched) with nutrition data (already fetched). The existing Adaptive_Engine's EMA computation can be reused for weight trend calculation.

**Edge cases:** < 14 days of data → show "X more days needed" with progress indicator. Missing bodyweight data for some days → interpolate from nearest available points. Missing nutrition data for some days → exclude those days from average calorie calculation.

#### Acceptance Criteria

1. WHEN the Analytics screen loads and at least 14 days of both bodyweight and nutrition data exist, THE Expenditure_Trend card SHALL display the estimated TDEE as a trend line.
2. THE Expenditure_Trend calculation SHALL use the formula: TDEE = average_daily_calories + (weight_change_kg × 7700 / number_of_days), where weight_change_kg is derived from the bodyweight EMA trend over the calculation window.
3. WHEN fewer than 14 days of combined bodyweight and nutrition data exist, THE Expenditure_Trend card SHALL display a message indicating insufficient data and the number of additional days of logging needed.
4. THE Expenditure_Trend card SHALL recalculate using a rolling 28-day window, updating the displayed value each time the Analytics screen loads.
5. WHEN displaying the Expenditure_Trend, THE System SHALL show the current TDEE estimate as a prominent number alongside the trend line chart.

### Requirement 10: Adherence-Neutral Color System

**User Story:** As a user, I want the app to use neutral colors when I exceed my targets, so that I feel encouraged to keep logging rather than shamed for going over.

**Why this matters:** MacroFactor's retention is 2x industry average partly because they never use red/warning colors for over-target states. Research shows that shame-based feedback reduces logging consistency by 30-40%. Neutral colors communicate "you're tracking, that's what matters" instead of "you failed today."

**Integration impact:** Modifies `Theme_Tokens` to add a new `overTarget` color. Updates `ProgressRing` component to use the new color when value > target. Updates `Budget_Bar` (new component) to use the new color for negative remaining. Does NOT change any existing positive/neutral/on-track color behaviors.

**Backward compatibility:** Users on older app versions see the existing color system. The new colors only apply when the `macrofactor_parity` feature flag is enabled. No existing visual behavior changes for users who haven't updated.

#### Acceptance Criteria

1. WHEN a macro ring (calories, protein, carbs) exceeds 100% of its target, THE ProgressRing component SHALL use a muted blue overflow color instead of warning or negative semantic colors.
2. WHEN the Budget_Bar shows a negative remaining value, THE Budget_Bar SHALL use the same muted blue overflow color.
3. THE Theme_Tokens SHALL define a new color token `colors.semantic.overTarget` with a muted blue value that is visually distinct from both positive and negative semantic colors.
4. WHEN the adherence-neutral colors are applied, THE System SHALL preserve all existing positive (on-track) and neutral (no data) color behaviors unchanged.
