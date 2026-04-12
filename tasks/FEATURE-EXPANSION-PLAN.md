# Repwise Feature Expansion Plan — Tracked-Inspired + Biomechanics

> Generated: 2026-04-11 | Based on competitive analysis of Tracked.gg + Beardsley biomechanics research

---

## PART 1: Exercise Biomechanics & Science-Based Writeups

### The Vision
Every exercise in Repwise gets a science-based profile that no other app offers. Not generic "this works your chest" — but WHERE in the range of motion the muscle is loaded, what TYPE of hypertrophy it stimulates, and how it fits into a complete program. This is Chris Beardsley's methodology applied to all 1,200 exercises.

### New Exercise Schema Fields

```
Current fields: id, name, muscle_group, secondary_muscles, equipment, category,
                image_url, animation_url, description, instructions, tips, is_mobility

New fields to add:
├── description          (populate all 1,200 — currently 0% filled)
├── tips                 (populate all 1,200 — currently 0% filled)
├── movement_pattern     enum: push, pull, hinge, squat, lunge, carry, rotation, isolation
├── strength_curve       enum: ascending, descending, bell_shaped, flat
├── muscle_loading_position  enum: stretched, mid_range, shortened
├── primary_joint_action     text: "hip extension", "elbow flexion", etc.
├── stretch_hypertrophy_potential  enum: high, moderate, low, none
├── stimulus_to_fatigue_ratio      enum: excellent, good, moderate, poor
├── fatigue_profile      enum: low, moderate, high
├── primary_muscles      array of { muscle: string, activation: float (0-1), loading_position: enum }
├── secondary_muscles    upgrade from flat list → array of { muscle: string, activation: float (0-1) }
├── resistance_profile_notes  text: science-based explanation of WHY this exercise loads where it does
├── best_paired_with     array of exercise IDs (complementary exercises at different muscle lengths)
├── difficulty_level     enum: beginner, intermediate, advanced
├── tempo_recommendation text: e.g., "3-1-1-0" or "controlled eccentric"
└── coaching_cues        array of strings: ["drive through heels", "chest up", ...]
```

### Muscle Activation Visualization
The body diagram system already exists (`BodySilhouette.tsx`, `anatomicalPathsV2.ts`, `frontRegions.ts`, `backRegions.ts`). Currently used only for volume heat maps on the analytics screen.

**New usage:** Show per-exercise muscle activation on the exercise detail screen.
- Reuse `BodySilhouette` component with exercise-specific activation data
- Color intensity = activation level (0.0 = gray, 1.0 = deep red/green)
- Show front + back views side by side
- Tap a muscle region → tooltip showing "Chest: 65% activation, loaded at stretched position"

### The Beardsley Writeup System

For each exercise, generate a structured science writeup:

```
## Barbell Bench Press

**Strength Curve:** Bell-shaped (hardest at mid-range when upper arms are horizontal)
**Target Loading:** Pectoralis major loaded at stretched position (shoulder horizontally
abducted + flexed). Triceps loaded at mid-range. Anterior deltoid loaded at stretched position.

**Hypertrophy Profile:**
- Pectoralis major: Both transverse + longitudinal growth. Sarcomeres reach descending
  limb → stretch-mediated hypertrophy is active. High passive tension from titin at the
  bottom of the press.
- Triceps: Transverse growth only. Triceps sarcomeres do NOT reach the descending limb
  regardless of exercise choice.
- Anterior deltoid: Moderate stretch stimulus.

**Neuromechanical Matching:** At the bottom position (peak difficulty), the sternal
fibers of pec major have the longest internal moment arm for horizontal adduction →
they receive the majority of the neural drive. The clavicular head contributes more
as the arms move toward the midline.

**Stimulus-to-Fatigue Ratio:** Good. The stretched-position loading increases calcium
ion-related fatigue, but the bilateral barbell setup allows high absolute loads with
good stability.

**Best Paired With:** Cable crossover (loads pec at shortened position) or pec deck
(loads at mid-range) to cover the full length-tension spectrum.
```

### Research Approach
This CANNOT be done from LLM training data alone. The methodology:

1. **Phase 1 — Framework calibration:** Use Beardsley's published analyses (squat, deadlift, bench, curl, calf raise, etc.) as ground truth to calibrate the LLM's understanding
2. **Phase 2 — Systematic generation:** For each of the 14 muscle groups, apply the framework:
   - Identify the joint action
   - Determine external moment arm pattern for each equipment type
   - Map peak force point to muscle length
   - Check internal moment arm (neuromechanical matching)
   - Assess sarcomere operating range (from literature)
   - Classify strength curve and loading position
3. **Phase 3 — Expert review:** Flag exercises where the analysis is uncertain. These need manual verification against published EMG data or biomechanics literature.
4. **Phase 4 — Populate:** Write the structured data + prose writeup for all 1,200 exercises

### Files to Modify
- `src/modules/training/exercises_data.json` — add new fields to all 1,200 exercises
- `src/modules/training/exercises.py` — update search/filter to support new fields
- `src/modules/training/schemas.py` — add new response fields
- `app/screens/exercise-picker/ExerciseDetailSheet.tsx` → expand into full `ExerciseDetailScreen.tsx`
- New: `app/components/exercise/ExerciseMuscleDiagram.tsx` — reuse BodySilhouette with per-exercise data
- New: `app/components/exercise/BiomechanicsCard.tsx` — strength curve + loading position visualization
- New: `app/components/exercise/ScienceWriteup.tsx` — the Beardsley-style analysis card

---

## PART 2: Step Tracking & Health Dashboard

### Current State
- `useHealthData.ts` is fully stubbed (returns null for everything)
- No health packages installed
- No step count anywhere in the app
- Recovery score is API-driven (manual check-in only)

### What to Build

**Step Counter Widget on Dashboard**
- Install `expo-sensors` (Pedometer API) for real-time step counting
- Install `react-native-health` (iOS) and `expo-health-connect` (Android) for historical data
- New dashboard card showing: today's steps, daily goal, streak
- Pull step data from HealthKit/Health Connect (like Tracked does)
- Merge device pedometer + health platform data (avoid double-counting)

**Health Data Integration (complete the stub)**
- Enable HRV reading from Apple Health / Health Connect
- Enable resting heart rate reading
- Enable sleep duration reading
- Feed real device data into the readiness engine (currently manual-only)
- Show health metrics on a dedicated Health screen (`app/screens/health/` exists but is empty)

### Files to Modify/Create
- `app/hooks/useHealthData.ts` — un-stub, implement platform-specific health reads
- `app/hooks/useStepCounter.ts` — new hook for real-time pedometer
- `app/components/dashboard/StepCountCard.tsx` — new dashboard widget
- `app/screens/health/HealthScreen.tsx` — new screen showing HRV, HR, sleep, steps
- `app/package.json` — add `expo-sensors`, `react-native-health`, `expo-health-connect`
- `app/app.json` — add HealthKit entitlements, Health Connect permissions
- `src/modules/readiness/` — update to accept device health data alongside manual check-in

---

## PART 3: Voice Set Logging

### What Tracked Does
- Speak to log sets: "135 pounds, 8 reps, RPE 8"
- Voice actions for navigation: "start rest timer", "next exercise"
- Correction sheet for fixing transcription mistakes

### What to Build
- Use `expo-speech-recognition` or `@react-native-voice/voice` for speech-to-text
- Floating mic button during active workout
- Parse spoken input into structured set data (weight, reps, RPE)
- Confirmation toast before committing the set
- Voice commands: "log set", "start timer", "next exercise", "finish workout"

### Files to Create
- `app/hooks/useVoiceTracking.ts` — speech recognition + NLP parsing
- `app/components/training/VoiceFAB.tsx` — floating action button for mic
- `app/components/training/VoiceConfirmSheet.tsx` — confirmation bottom sheet
- `app/utils/voiceParser.ts` — parse "135 for 8 at RPE 8" into { weight: 135, reps: 8, rpe: 8 }

---

## PART 4: Plates Calculator

### What to Build
- Input a target weight → shows which plates to load on each side of the bar
- Configurable bar weight (45lb/20kg standard, or custom)
- Configurable available plates (user sets what plates their gym has)
- Accessible from active workout screen (quick action button)

### Files to Create
- `app/components/training/PlatesCalculator.tsx` — the calculator UI
- `app/utils/platesCalculator.ts` — greedy algorithm for plate selection
- `app/store/` — add plate inventory to user preferences

---

## PART 5: Workout Folders & Organization

### What to Build
- Folder system for organizing workout templates
- Create, rename, delete, reorder folders
- Drag-and-drop workouts between folders
- "Uncategorized" default folder
- Folder icons/colors for visual distinction

### Files to Modify/Create
- `src/modules/training/models.py` — add WorkoutFolder model
- `src/modules/training/router.py` — CRUD endpoints for folders
- `app/screens/training/WorkoutListScreen.tsx` — add folder UI with collapsible sections
- `app/components/training/FolderHeader.tsx` — folder row with expand/collapse

---

## PART 6: Unilateral & Isometric Tracking

### Unilateral Tracking
- Per-limb set logging (left/right)
- Auto limb sorting (alternate L/R)
- Imbalance detection (flag if one side is consistently weaker)
- Schema change: sets need a `limb` field (null = bilateral, "left"/"right" = unilateral)

### Isometric Tracking
- Time-based sets (hold duration instead of reps)
- Schema change: sets need a `duration_seconds` field
- Timer UI for isometric holds (start/stop with haptic feedback)
- History shows hold times instead of reps

### Files to Modify
- `src/modules/training/schemas.py` — add `limb` and `duration_seconds` to set schema
- `src/modules/training/models.py` — update TrainingSession JSONB structure
- `app/screens/training/ActiveWorkoutBody.tsx` — add limb toggle + isometric timer
- `app/components/training/SetRow.tsx` — show L/R indicator, show duration for isometric
- `app/components/training/IsometricTimer.tsx` — new timer component

---

## PART 7: Workout Versioning

### What to Build
- Track changes to workout templates over time
- When user modifies a template (add/remove/reorder exercises), create a new version
- Version history viewable: "v1: 4 exercises, v2: added lateral raises, v3: swapped RDL for leg curl"
- Diff view between versions

### Files to Modify/Create
- `src/modules/training/models.py` — add WorkoutTemplateVersion model
- `src/modules/training/service.py` — version creation on template modification
- `app/components/training/VersionHistory.tsx` — version list with diff

---

## PART 8: Progressive Overload Visualization ("Stay in the Green")

### What Tracked Does
- Green border on exercises where you're progressing
- Color-coded set comparison (green = beat previous, red = regressed, yellow = matched)
- Net progression statistics in session summary

### What Repwise Should Do
- During active workout: color-code each set vs previous session
  - Green: beat previous (more weight OR more reps at same weight)
  - Yellow: matched previous
  - Red: regressed
- Green glow/border on exercise cards where ALL sets progressed
- Post-workout summary: "You progressed on 4/6 exercises today"
- Weekly progression rate on analytics screen

### Files to Modify
- `app/screens/training/ActiveWorkoutBody.tsx` — add color coding to set inputs
- `app/components/training/SetRow.tsx` — compare vs previous session data
- `app/screens/training/WorkoutSummaryScreen.tsx` — add progression summary
- `app/hooks/usePreviousPerformance.ts` — fetch previous session data for comparison
- `src/modules/training/previous_performance.py` — already exists, may need enhancement

---

## PART 9: Pre/Post Workout Surveys

### Current State
- Recovery check-in modal exists (pre-workout readiness)
- No post-workout survey

### What to Add
- **Pre-workout:** Expand recovery check-in with: energy level, motivation, soreness, sleep quality (1-5 scales)
- **Post-workout:** New survey capturing: session RPE, pump quality, joint discomfort, overall satisfaction
- Store survey data alongside session
- Use survey data in coaching recommendations and readiness engine
- Trend charts for survey responses over time

### Files to Modify/Create
- `app/components/modals/PostWorkoutSurvey.tsx` — new modal
- `src/modules/training/schemas.py` — add survey fields to session
- `src/modules/readiness/` — consume survey data in readiness scoring

---

## PART 10: Spotify / Music Integration

### What to Build
- Spotify Connect API integration
- Mini player widget during active workout (play/pause/skip)
- No need to build a full music player — just remote control
- Requires Spotify Premium (free tier doesn't support remote control)

### Files to Create
- `app/services/spotify.ts` — Spotify Web API client
- `app/components/training/MiniPlayer.tsx` — floating mini player during workout
- `app/hooks/useSpotify.ts` — auth + playback control hook

---

## PART 11: Muscle Fatigue Heat Map (Post-Workout)

### Current State
- Volume heat map exists on analytics screen (weekly aggregate)
- No per-session fatigue visualization

### What to Build
- After completing a workout, show a body diagram colored by which muscles were hit THIS session
- Use the existing `BodySilhouette` + `BodyHeatMap` components
- Color intensity based on: sets × relative intensity for each muscle group
- Include secondary muscles (weighted by activation percentage from new exercise schema)
- Show on `WorkoutSummaryScreen` after finishing a session

### Files to Modify
- `app/screens/training/WorkoutSummaryScreen.tsx` — add fatigue heat map section
- `app/utils/sessionFatigueLogic.ts` — new utility to compute per-muscle fatigue from session data
- Reuse `BodyHeatMap` component with session-specific data

---

## PART 12: Exercise Detail Screen (Full Redesign)

### Current State
- `ExerciseDetailSheet` — a bottom sheet with basic info (name, muscle group, equipment, instructions)
- No muscle diagram, no biomechanics, no history integration

### What to Build
- Full-screen exercise detail page (not a bottom sheet)
- Sections:
  1. **Header:** Exercise name, equipment badge, difficulty badge
  2. **Muscle Diagram:** Body silhouette with activation colors (from Part 1 data)
  3. **Biomechanics Card:** Strength curve type, loading position, stretch hypertrophy potential
  4. **Science Writeup:** The Beardsley-style analysis (from Part 1)
  5. **Instructions:** Step-by-step with coaching cues
  6. **Tips:** Common mistakes and fixes
  7. **Your History:** Chart of weight/reps over time for this exercise
  8. **Personal Records:** PRs for this exercise
  9. **Best Paired With:** Complementary exercises
  10. **Video/Animation:** Exercise demonstration

### Files to Create/Modify
- `app/screens/training/ExerciseDetailScreen.tsx` — new full screen
- `app/components/exercise/ExerciseMuscleDiagram.tsx`
- `app/components/exercise/BiomechanicsCard.tsx`
- `app/components/exercise/ScienceWriteup.tsx`
- `app/components/exercise/ExerciseHistoryChart.tsx`
- `app/navigation/` — add route for exercise detail

---

## PART 13: Competitor Data Import Enhancement

### Current State
- Import from Strong, Hevy, FitNotes (CSV) already exists

### What to Add
- Import from Tracked (when they have export)
- Import from JEFIT
- Import from Apple Health workout data
- Better exercise mapping UI (fuzzy match + manual override)
- Import progress photos from other apps (if exported)

---

## PART 14: Discord Bot / Community Integration

### What to Build
- Repwise Discord bot for community engagement
- Slash commands: `/pr` (show PRs), `/workout` (share last workout), `/streak` (show streak)
- Webhook notifications: PR alerts, streak milestones
- Community challenges via Discord

---

## EXECUTION ORDER (Suggested)

### Wave 1 — Highest Impact, Foundation Work
1. **Exercise Biomechanics Data** (Part 1) — this is the differentiator. Populate all 1,200 exercises.
2. **Exercise Detail Screen Redesign** (Part 12) — the UI to display the biomechanics data
3. **Progressive Overload Visualization** (Part 8) — "stay in the green" equivalent
4. **Step Tracking** (Part 2) — quick win, high visibility on dashboard

### Wave 2 — Workout Experience
5. **Plates Calculator** (Part 4) — small effort, high utility
6. **Unilateral & Isometric Tracking** (Part 6) — schema changes best done early
7. **Muscle Fatigue Heat Map** (Part 11) — reuses existing components
8. **Pre/Post Workout Surveys** (Part 9) — data collection for coaching

### Wave 3 — Organization & Power Features
9. **Workout Folders** (Part 5) — organizational improvement
10. **Workout Versioning** (Part 7) — template evolution tracking
11. **Voice Set Logging** (Part 3) — high effort but unique

### Wave 4 — Ecosystem
12. **Health Dashboard** (Part 2 continued) — HRV, HR, sleep integration
13. **Spotify Integration** (Part 10) — nice-to-have
14. **Competitor Import Enhancement** (Part 13) — migration funnel
15. **Discord Bot** (Part 14) — community engagement
