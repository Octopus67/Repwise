# Bug Fixes & UI Polish Plan

## Critical Bugs (App-Breaking)

### 1. StreakIndicator crash — Dashboard unavailable
- **Root cause**: `require('lottie-react-native')` returns a module object `{ default: Component }`, not the component itself
- **File**: `app/components/dashboard/StreakIndicator.tsx:10`
- **Fix**: Change `LottieView = require('lottie-react-native')` → `LottieView = require('lottie-react-native').default`
- **Impact**: Dashboard completely broken — blocks all users

### 2. Nutrition modal X button not working
- **Root cause**: GestureDetector (Pan) wraps the close button on mobile. Sloppy taps with slight vertical movement get intercepted by the pan gesture instead of registering as a press
- **File**: `app/components/common/ModalContainer.tsx`
- **Fix**: Add `.activeOffsetY([-10, 10])` to the pan gesture so it only activates after 10px of vertical drag, giving taps more room
- **Impact**: Users trapped in nutrition modal

### 3. Production DB missing columns/constraints
- **Root cause**: Models updated but prod DB (Neon) never migrated
- **Fix**: Run ALTER TABLE statements on Neon:
  - `ALTER TABLE bodyweight_logs ADD CONSTRAINT uq_bodyweight_user_date UNIQUE (user_id, recorded_date);`
  - `ALTER TABLE training_sessions ADD COLUMN version INTEGER DEFAULT 1;`
- **Impact**: /users/bodyweight 500 errors, training sessions broken in prod

## UI Polish — Emoji Cleanup

### 4. Replace emojis with proper icons
- **Root cause**: 60 emoji occurrences across 30 files look cheap/unprofessional
- **Files**: See emoji audit (components/dashboard, components/training, screens/reports, etc.)
- **Fix**: Replace emojis with themed SF Symbol / MaterialCommunityIcons equivalents:
  - 🔥 → flame icon (streak)
  - 🏆 → trophy icon (PRs)
  - 💪 → dumbbell icon (workouts)
  - 💡 → lightbulb-outline icon (recommendations)
  - ⭐ → star icon (favorites)
  - ⚠️ → alert-circle icon (warnings)
  - ✅ → check-circle icon (success)
  - etc.
- **Impact**: App looks premium instead of cheap

## Analytics Improvements

### 5. Training volume chart — missing y-axis label
- **Root cause**: Y-axis renders tick values but no descriptive label
- **File**: `app/components/volume/VolumeTrendChart.tsx`
- **Fix**: Add rotated y-axis label "Sets / week" or "Volume (HU)" depending on data source
- **Impact**: Users can't understand what the chart numbers mean

### 6. Muscle volume heatmap — weak body diagram design
- **Root cause**: Current body silhouette is basic SVG with flat color fills
- **File**: `app/components/analytics/BodySilhouette.tsx`
- **Fix**: Redesign with gradient fills, better muscle group definition, premium color palette, glow effects for active groups
- **Impact**: Visual quality of analytics section

### 7. Volume tab — "Coming soon" behind feature flag
- **Root cause**: `volume_landmarks` feature flag is disabled
- **File**: `app/screens/analytics/AnalyticsScreen.tsx:575`
- **Fix**: Enable the feature flag (the feature is fully implemented)
- **Impact**: Users see "Coming soon" for a feature that's already built

## Weekly Report Improvements

### 8. Week display — shows "Week 13" without dates
- **Root cause**: UI only renders `Week {week}, {year}` — the `week_start`/`week_end` fields from API are never displayed
- **File**: `app/screens/reports/WeeklyReportScreen.tsx:163`
- **Fix**: Show date range alongside week number: "Week 15 · Apr 6 – Apr 12"
- **Impact**: Users don't know what dates "Week 13" refers to

### 9. Recommendations quality — too basic
- **Root cause**: Rule-based engine in `src/modules/reports/recommendations.py` generates generic recommendations
- **Current rules**: Volume vs MEV/MAV, nutrient score, compliance %, weight trend, PRs, logging consistency
- **Fix**: Enhance recommendations to be more holistic:
  - Add recovery-aware recommendations (soreness/stress/sleep data)
  - Add progressive overload suggestions (compare week-over-week)
  - Add periodization context (current block phase)
  - Make language more specific (e.g., "Increase chest volume by 2 sets — you're 3 sets below MEV" instead of generic "Consider increasing chest volume")
  - Add actionable next steps
- **Impact**: Recommendations feel generic and unhelpful
