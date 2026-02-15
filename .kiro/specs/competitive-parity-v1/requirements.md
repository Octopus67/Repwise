# Requirements: Competitive Parity V1 — MacroFactor + Cronometer Gap Closure

## Overview

This document captures all 16 features identified in the competitive gap analysis against MacroFactor and Cronometer. Each feature is structured as a user story with acceptance criteria. Features are grouped by competitive source and tagged with effort/impact for prioritization.

---

## Feature 1: Barcode Scanner for Instant Food Logging

**Source:** MacroFactor parity | **Effort:** Medium | **Impact:** High | **Priority:** P0 — Table stakes

### User Stories

1.1 As a user logging packaged food, I want to scan a barcode so that nutritional data auto-populates without manual search.

### Acceptance Criteria

- 1.1.1 A barcode icon is visible in the food logging flow (AddNutritionModal search bar area)
- 1.1.2 Tapping the barcode icon opens the device camera with a barcode scanning overlay
- 1.1.3 On successful scan, the app queries Open Food Facts API (primary) and USDA (fallback) for nutritional data
- 1.1.4 Scanned food item displays with name, calories, protein, carbs, fat, and serving size for user confirmation
- 1.1.5 User can adjust serving size before saving the entry
- 1.1.6 Successfully scanned items are cached locally for instant re-scan on subsequent uses
- 1.1.7 If barcode is not found, the app shows "Not found — search manually or enter macros" with a fallback to text search
- 1.1.8 Scanning completes in under 3 seconds on average
- 1.1.9 Camera permission is requested only when the barcode feature is first used (not on app install)

---

## Feature 2: AI Photo Meal Logging

**Source:** MacroFactor parity | **Effort:** High | **Impact:** High | **Priority:** P1 — Differentiator

### User Stories

2.1 As a user eating a home-cooked or restaurant meal, I want to take a photo of my plate so that the app identifies ingredients and estimates macros automatically.

### Acceptance Criteria

- 2.1.1 A camera/photo icon is available in the food logging flow alongside search and barcode
- 2.1.2 User can take a new photo or select from gallery
- 2.1.3 User can optionally add a text description to guide the AI (e.g., "grilled chicken with brown rice")
- 2.1.4 The AI returns a list of identified food items with estimated quantities and macros
- 2.1.5 Each identified item is editable — user can adjust name, quantity, and macros before saving
- 2.1.6 User can remove incorrectly identified items or add missing ones manually
- 2.1.7 The photo is stored alongside the nutrition entry for future reference
- 2.1.8 Processing time is under 10 seconds with a loading indicator
- 2.1.9 If AI cannot identify the meal, it falls back to manual entry with the photo attached
- 2.1.10 AI photo logging uses at most $0.02 per request at scale (cost constraint)

---

## Feature 3: Adaptive Coaching Tiers (Coached / Collaborative / Manual)

**Source:** MacroFactor parity | **Effort:** Medium | **Impact:** Very High | **Priority:** P0 — Core differentiator (engine exists, needs surfacing)

### User Stories

3.1 As a user, I want to choose how much the app manages my nutrition targets so that I get the right level of guidance for my experience.

3.2 As a coached user, I want the app to automatically update my calorie and macro targets weekly based on my weight trend and intake data.

3.3 As a collaborative user, I want the app to suggest target changes that I can accept or modify before they take effect.

### Acceptance Criteria

- 3.1.1 User can select coaching mode during onboarding: Coached (default), Collaborative, or Manual
- 3.1.2 Coaching mode is changeable anytime from Profile/Settings
- 3.2.1 In Coached mode, the app recalculates targets every 7 days using the adaptive engine with the latest weight and intake data
- 3.2.2 A "Weekly Check-in" card appears on the dashboard after recalculation showing: new targets, weight trend summary, and progress toward goal
- 3.2.3 The check-in card explains why targets changed (e.g., "You lost 0.3kg this week — staying on track for your goal")
- 3.3.1 In Collaborative mode, the app shows a "Suggested Update" notification with proposed new targets
- 3.3.2 User can accept, modify, or dismiss the suggestion
- 3.3.3 In Manual mode, targets never auto-update; user manages everything
- 3.3.4 The adaptive engine uses at least 7 days of weight + intake data before making its first adjustment
- 3.3.5 If insufficient data exists (< 7 days), the check-in card shows "Log X more days for personalized recommendations"

---

## Feature 4: Weight Trend Smoothing (EMA Visualization)

**Source:** MacroFactor parity | **Effort:** Low | **Impact:** High | **Priority:** P0 — Retention critical

### User Stories

4.1 As a user tracking weight, I want to see a smoothed trend line alongside my daily weigh-ins so that I understand my true trajectory without panicking over daily fluctuations.

### Acceptance Criteria

- 4.1.1 The weight chart on the Analytics screen shows two data series: raw daily weigh-ins (dots, reduced opacity) and EMA trend line (solid line, primary color)
- 4.1.2 The EMA uses alpha=0.25 and a 7-day window, matching the backend adaptive engine constants
- 4.1.3 The dashboard shows "Trend weight: X.Xkg" prominently next to the latest raw weight
- 4.1.4 A tooltip or info icon explains: "Trend weight smooths out daily fluctuations from water, sodium, and other factors"
- 4.1.5 The trend line requires at least 3 data points before rendering (shows raw only before that)
- 4.1.6 Weekly change is computed from the trend line, not raw values (e.g., "↓0.3kg this week" based on trend)

---

## Feature 5: Progress Photos with Side-by-Side Comparison

**Source:** MacroFactor parity | **Effort:** Medium | **Impact:** High | **Priority:** P1

### User Stories

5.1 As a user, I want to take and store progress photos at regular intervals so that I can visually track body composition changes over time.

5.2 As a user, I want to compare photos from different dates side-by-side so that I can see my transformation.

### Acceptance Criteria

- 5.1.1 A "Progress Photos" section is accessible from the Profile screen
- 5.1.2 User can take a new photo using the device camera or select from gallery
- 5.1.3 Photos are tagged with the capture date and current bodyweight (if available)
- 5.1.4 Photos are stored on-device with optional cloud backup (future)
- 5.1.5 A guided pose overlay (silhouette) helps users maintain consistent framing across photos
- 5.2.1 A comparison view allows selecting two dates and showing photos side-by-side
- 5.2.2 Photos are displayed at the same scale and alignment for accurate visual comparison
- 5.2.3 User can swipe through their photo timeline chronologically

---

## Feature 6: Multi-Item Meal Builder ("The Plate")

**Source:** MacroFactor parity | **Effort:** Medium | **Impact:** High | **Priority:** P1

### User Stories

6.1 As a user logging a multi-component meal, I want to add multiple food items to a staging area before committing so that I can build a complete meal in one session.

### Acceptance Criteria

- 6.1.1 When user taps "Log Food," a persistent meal builder opens (bottom sheet or full screen)
- 6.1.2 Each search/scan/quick-add appends an item to the meal list (not saved immediately)
- 6.1.3 Running macro totals (calories, protein, carbs, fat) update in real-time as items are added
- 6.1.4 User can remove individual items from the meal before saving
- 6.1.5 User can adjust serving sizes for each item in the meal
- 6.1.6 "Save Meal" commits all items as a batch with the same meal_name and timestamp
- 6.1.7 User can optionally save the meal combination as a "Favorite Meal" for one-tap re-logging
- 6.1.8 The meal builder supports mixing input methods (search + barcode + quick add in one session)

---

## Feature 7: Weekly Calorie/Macro Distribution (Day-Specific Targets)

**Source:** MacroFactor parity | **Effort:** Medium | **Impact:** Medium | **Priority:** P2

### User Stories

7.1 As an intermediate user doing carb cycling or training-day/rest-day splits, I want to set different calorie and macro targets for different days of the week.

### Acceptance Criteria

- 7.1.1 Profile/Goals screen has a "Same every day" toggle (default: on)
- 7.1.2 When toggled off, 7 day cards appear where users can set per-day calorie and macro targets
- 7.1.3 The BudgetBar and dashboard automatically display the target for the selected date's day of week
- 7.1.4 The adaptive engine distributes weekly calorie budgets across days based on user-defined distribution
- 7.1.5 Weekly summary calculations account for varying daily targets (adherence = actual vs that day's target)
- 7.1.6 Presets are available: "Training/Rest" (auto-assigns based on logged training days), "Custom"

---

## Feature 8: Verified Food Database with Source Indicators

**Source:** MacroFactor parity | **Effort:** Low | **Impact:** Medium | **Priority:** P1

### User Stories

8.1 As a user searching for food, I want to see which entries are verified/lab-tested so that I can trust the nutritional data I'm logging.

### Acceptance Criteria

- 8.1.1 Each food item in the database has a `source` field: "usda", "verified", "community", or "custom"
- 8.1.2 Search results display a small badge next to each item: green checkmark for USDA/verified, gray for community/custom
- 8.1.3 USDA-sourced items are prioritized in search results (sorted by source quality, then relevance)
- 8.1.4 Tapping the badge shows a tooltip: "USDA verified — lab-tested nutritional data" or "Community submitted"
- 8.1.5 Existing seed data items are tagged as "verified"; USDA-fetched items are tagged as "usda"

---

## Feature 9: Onboarding Knowledge Check and Goal Calibration

**Source:** MacroFactor parity | **Effort:** Low | **Impact:** Medium | **Priority:** P2

### User Stories

9.1 As a new user, I want the app to understand my tracking experience level so that it provides the right amount of guidance.

9.2 As a new user, I want to set my preferred rate of weight change with education about what's realistic.

### Acceptance Criteria

- 9.1.1 Onboarding includes a "Tracking Experience" screen: None / Beginner / Intermediate / Advanced
- 9.1.2 Experience level sets the default coaching mode (None/Beginner → Coached, Intermediate → Collaborative, Advanced → Manual)
- 9.1.3 Experience level controls tooltip frequency and educational content density in the app
- 9.2.1 Onboarding includes a "Rate of Change" screen with a slider from conservative (0.25% BW/week) to aggressive (1% BW/week)
- 9.2.2 The slider shows educational context: "Conservative preserves more muscle" / "Aggressive may impact performance"
- 9.2.3 A "What to Expect" screen shows estimated timeline: "At your chosen rate, you'll reach your goal in approximately X weeks"
- 9.2.4 These preferences are stored and used by the adaptive engine for target calculations

---

## Feature 10: Recipe Builder with Nutritional Scaling

**Source:** MacroFactor parity | **Effort:** Medium | **Impact:** High | **Priority:** P0 — Backend exists, frontend-only

### User Stories

10.1 As a user who meal preps, I want to create recipes from individual ingredients so that I can log complex meals with one tap.

10.2 As a user logging a recipe, I want to specify how many servings I ate so that macros scale correctly.

### Acceptance Criteria

- 10.1.1 A "Create Recipe" option is accessible from the nutrition logging flow
- 10.1.2 User can name the recipe and add a description
- 10.1.3 User searches and adds ingredients with quantities (using the existing food search)
- 10.1.4 The app computes total nutrition and per-serving nutrition in real-time as ingredients are added
- 10.1.5 User specifies total number of servings the recipe makes
- 10.1.6 Saved recipes appear in food search results for quick re-logging
- 10.2.1 When logging a recipe, user can enter number of servings consumed (supports decimals, e.g., 1.5)
- 10.2.2 Macros scale proportionally based on servings consumed vs total servings
- 10.2.3 Recipes use the existing `RecipeIngredient` model and `aggregate_recipe_nutrition` backend function

---

## Feature 11: Deep Micronutrient Tracking (25+ Nutrients with RDA Bars)

**Source:** Cronometer parity | **Effort:** Medium | **Impact:** High | **Priority:** P1 — Premium differentiator

### User Stories

11.1 As a health-conscious user, I want to track 25+ micronutrients so that I can identify nutritional deficiencies.

11.2 As a user, I want to see how my daily intake compares to recommended daily allowances (RDA) so that I know which nutrients I'm lacking.

### Acceptance Criteria

- 11.1.1 Micronutrient tracking expands from 8 to at least 25 nutrients: all B vitamins (B1, B2, B3, B5, B6, B7, B9, B12), Vitamins A, C, D, E, K, Calcium, Iron, Zinc, Magnesium, Potassium, Selenium, Sodium, Phosphorus, Manganese, Copper, Omega-3, Omega-6, Cholesterol
- 11.1.2 USDA food data maps to the expanded nutrient set (USDA provides data for all 25+)
- 11.2.1 A "Nutrition Report" view shows horizontal progress bars for each tracked nutrient
- 11.2.2 Each bar shows current intake as % of RDA (age/sex-adjusted)
- 11.2.3 Color coding: green ≥80% RDA, yellow 50-79% RDA, red <50% RDA
- 11.2.4 The report distinguishes between nutrients from food vs supplements (when supplement tracking is available)
- 11.2.5 Users can tap any nutrient bar to see which foods contributed the most to that nutrient today

---

## Feature 12: Biometric Tracking Beyond Weight

**Source:** Cronometer parity | **Effort:** Medium | **Impact:** Medium | **Priority:** P2

### User Stories

12.1 As a user managing health conditions, I want to log biometrics like blood pressure, heart rate, and blood glucose so that I can correlate them with dietary changes.

### Acceptance Criteria

- 12.1.1 A "Biometrics" section in the Health Reports screen allows logging: blood pressure (systolic/diastolic), resting heart rate, blood glucose, body temperature
- 12.1.2 Each biometric has a time-series mini-chart showing trends over time
- 12.1.3 A "Lab Results" section allows manual entry of periodic blood work: cholesterol (HDL/LDL/total), HbA1c, triglycerides, vitamin D, B12, iron/ferritin
- 12.1.4 Biometric data is displayed alongside dietary trends for correlation (e.g., sodium intake vs blood pressure)
- 12.1.5 Body measurements tracking: chest, waist, hips, arms, thighs (with tape measure icon)

---

## Feature 13: Device & Wearable Integrations (Apple Health, Fitbit, Garmin)

**Source:** Cronometer parity | **Effort:** High | **Impact:** High | **Priority:** P1

### User Stories

13.1 As a user wearing a fitness tracker, I want my step count and active calories to sync automatically so that my TDEE estimation is more accurate.

13.2 As a user, I want my nutrition and weight data to sync to Apple Health so that all my health data is in one place.

### Acceptance Criteria

- 13.1.1 Apple Health integration reads: steps, active energy burned, resting heart rate, sleep duration
- 13.1.2 Synced activity data feeds into the adaptive engine for improved TDEE estimation
- 13.1.3 A "Connected Devices" section in Profile shows sync status and last sync time
- 13.2.1 Apple Health integration writes: nutrition entries (calories, macros), bodyweight
- 13.2.2 Sync is bidirectional and runs automatically on app open and every 30 minutes in background
- 13.2.3 User can enable/disable individual data types for read and write independently
- 13.2.4 Phase 2: Fitbit integration via REST API (server-side OAuth)
- 13.2.5 Phase 2: Garmin Connect integration via REST API

---

## Feature 14: Data Export and Professional Sharing

**Source:** Cronometer parity | **Effort:** Low | **Impact:** Medium | **Priority:** P2

### User Stories

14.1 As a user, I want to export my nutrition data as CSV so that I can analyze it in a spreadsheet or share it with my coach.

14.2 As a user working with a nutritionist, I want to share a read-only view of my diary so that my coach can review my intake without me sending screenshots.

### Acceptance Criteria

- 14.1.1 "Export Data" option in Profile/Settings
- 14.1.2 CSV export includes: date, meal_name, food_name, calories, protein_g, carbs_g, fat_g, micronutrients, entry_date, created_at
- 14.1.3 User can select a date range for export (default: last 30 days)
- 14.1.4 PDF summary report option with charts for weekly/monthly overview
- 14.2.1 "Share with Coach" generates a unique read-only link to a web dashboard
- 14.2.2 The shared dashboard shows: daily diary, macro trends, weight trend, weekly summaries
- 14.2.3 User can revoke the shared link at any time

---

## Feature 15: Supplement and Medication Tracking

**Source:** Cronometer parity | **Effort:** Medium | **Impact:** Medium | **Priority:** P2

### User Stories

15.1 As a user taking supplements, I want to log my daily vitamins and supplements so that my micronutrient report reflects my total intake (food + supplements).

### Acceptance Criteria

- 15.1.1 A "Supplements" section in the nutrition logging flow, separate from food
- 15.1.2 Pre-loaded supplement database: multivitamin, vitamin D (1000/2000/5000 IU), fish oil, creatine, whey protein, magnesium, zinc, B-complex, iron
- 15.1.3 User can create custom supplements with specific nutrient amounts
- 15.1.4 Logged supplement nutrients merge into daily micronutrient totals
- 15.1.5 The Nutrition Report distinguishes food-sourced vs supplement-sourced nutrients (stacked bars or separate colors)
- 15.1.6 "My Daily Stack" — user can save a set of supplements and log them all with one tap
- 15.1.7 Optional reminder notifications for supplement timing

---

## Feature 16: Fasting Timer and Time-Restricted Eating

**Source:** Cronometer parity | **Effort:** Low | **Impact:** Medium | **Priority:** P2

### User Stories

16.1 As a user practicing intermittent fasting, I want a built-in fasting timer so that I can track my fasting windows and eating windows.

### Acceptance Criteria

- 16.1.1 A "Fasting" card on the dashboard shows current fasting status (fasting/eating) with elapsed time
- 16.1.2 Presets available: 16:8, 18:6, 20:4, OMAD (23:1), Custom
- 16.1.3 Tap to start a fast → shows countdown timer with circular progress visualization
- 16.1.4 Logging food automatically ends the current fast (with confirmation prompt)
- 16.1.5 Fasting sessions are stored with start/end timestamps
- 16.1.6 A weekly fasting consistency chart shows adherence to the chosen protocol
- 16.1.7 Optional push notification: "Your eating window opens in 30 minutes"
- 16.1.8 Fasting streak counter (consecutive days meeting the fasting target)

---

## Priority Summary

| Priority | Features | Rationale |
|----------|----------|-----------|
| P0 | 1 (Barcode), 3 (Coaching Tiers), 4 (Weight Trend), 10 (Recipe Builder) | Table stakes or high-ROI with existing infrastructure |
| P1 | 2 (AI Photo), 5 (Progress Photos), 6 (Meal Builder), 8 (Verified DB), 11 (Deep Micros), 13 (Device Integration) | Strong differentiators, medium-high effort |
| P2 | 7 (Weekly Distribution), 9 (Onboarding Calibration), 12 (Biometrics), 14 (Data Export), 15 (Supplements), 16 (Fasting Timer) | Nice-to-have, lower urgency or niche audience |

---

## Suggested Implementation Order (Quarterly)

**Q1 Sprint (P0 — Ship first):**
- Feature 4: Weight Trend Smoothing (Low effort, high retention impact)
- Feature 10: Recipe Builder (Backend exists, frontend-only)
- Feature 3: Adaptive Coaching Tiers (Engine exists, needs UI + weekly cron)
- Feature 1: Barcode Scanner (Table stakes for activation)

**Q2 Sprint (P1 — Build moat):**
- Feature 8: Verified Food Database indicators
- Feature 6: Multi-Item Meal Builder
- Feature 11: Deep Micronutrient Tracking (25+ nutrients)
- Feature 5: Progress Photos

**Q3 Sprint (P1-P2 — Expand platform):**
- Feature 13: Apple Health Integration
- Feature 2: AI Photo Meal Logging
- Feature 9: Onboarding Calibration
- Feature 15: Supplement Tracking

**Q4 Sprint (P2 — Polish and differentiate):**
- Feature 16: Fasting Timer
- Feature 14: Data Export
- Feature 12: Biometric Tracking
- Feature 7: Weekly Calorie Distribution
