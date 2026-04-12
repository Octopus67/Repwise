# Repwise Feature Implementation Plan — Top 5 Beardsley-Priority Features

> All 5 features cost $0/month. All leverage the biomechanics moat.
> Ordered by dependency: each phase builds on the previous.

---

## PHASE 1: Smart Progressive Overload Color Coding

> Tracked's most addictive feature, but BETTER — we weight by stimulus quality.
> Dependency: None. Pure frontend. Data already flows to SetRowPremium.

### Task 1.1: Add progression comparison logic

**Root Cause:** `SetRowPremium` receives `previousSet: { weightKg, reps }` but only displays it as text. No comparison happens.

**Implementation Steps:**
1. Create `app/utils/progressionLogic.ts` (~40 lines):
   ```
   getProgressionStatus(current: {weight: string, reps: string}, previous: {weightKg: number, reps: number} | null, unitSystem): 'progressed' | 'matched' | 'regressed' | 'no_data'
   ```
   - `progressed`: current weight > prev weight, OR same weight + more reps
   - `matched`: same weight AND same reps
   - `regressed`: less weight, OR same weight + fewer reps
   - `no_data`: no previous set to compare
   - Must handle unit conversion (lbs→kg) before comparing
   - Must handle empty strings (incomplete set = no_data)

2. Create `app/utils/progressionColors.ts` (~20 lines):
   - Map status → theme-aware background tint colors
   - `progressed` → `rgba(34, 197, 94, 0.08)` (subtle green)
   - `matched` → `rgba(234, 179, 8, 0.08)` (subtle yellow)
   - `regressed` → `rgba(239, 68, 68, 0.08)` (subtle red)
   - `no_data` → transparent

**Affected Files:**
- `app/utils/progressionLogic.ts` (NEW)
- `app/utils/progressionColors.ts` (NEW)

**Tests:** Unit tests for progressionLogic covering: empty strings, unit conversion, edge cases (0 weight, equal values, NaN).

**Risk:** LOW — new utility files, no existing code modified.

---

### Task 1.2: Apply color coding to SetRowPremium

**Implementation Steps:**
1. In `SetRowPremium.tsx`, import `getProgressionStatus` and `getProgressionColor`
2. After the set is `completed`, compute status by comparing current weight/reps vs `previousSet`
3. Apply the background color to the set row container
4. Only color completed sets — incomplete sets stay neutral
5. Add a small indicator dot (●) next to the set number showing the status color

**Affected Files:**
- `app/components/training/SetRowPremium.tsx` — add ~15 lines

**Risk:** MEDIUM — touches the most-used component in the app. Must not affect input performance.

---

### Task 1.3: Add progression summary to WorkoutSummaryScreen

**Implementation Steps:**
1. After workout completion, count how many exercises progressed vs regressed
2. Show: "You progressed on 4/6 exercises 💪" or "Maintained on all exercises"
3. Compute by comparing each exercise's best set vs previous session's best set

**Affected Files:**
- `app/screens/training/WorkoutSummaryScreen.tsx` — add ~20 lines
- May need to pass previous performance data to the summary screen

**Risk:** LOW — additive UI on a post-workout screen.

---

## PHASE 2: Exercise Substitution Engine

> Highest-value application of biomechanics data. $0/month.
> Dependency: Uses biomechanics fields from exercises_data.json (already populated).

### Task 2.1: Add substitution logic to backend

**Implementation Steps:**
1. Add `find_substitutes(exercise_id: str, available_equipment: list[str] | None = None, limit: int = 5)` to `src/modules/training/exercises.py`
2. Algorithm:
   - Find the source exercise
   - Filter candidates: same `muscle_group` (required), not mobility, not same exercise
   - Score each candidate (0-100):
     - Same `loading_position`: +30 points
     - Same `strength_curve`: +20 points
     - Same `category` (compound/isolation): +15 points
     - Same or better `stimulus_to_fatigue`: +15 points
     - Secondary muscles overlap (Jaccard similarity × 10): +10 points
     - Equipment match: +10 points
   - Sort by score descending, return top `limit`
3. Add FastAPI endpoint: `GET /training/exercises/{exercise_id}/substitutes?equipment=barbell,dumbbell&limit=5`

**Affected Files:**
- `src/modules/training/exercises.py` — add ~50 lines
- `src/modules/training/router.py` — add 1 endpoint (~15 lines)

**Tests:** Unit test for `find_substitutes` with known exercises (e.g., barbell bench press → should return DB bench, incline press, etc.)

**Risk:** LOW — new function, new endpoint. No existing code modified.

---

### Task 2.2: Add "Find Alternatives" to ExerciseDetailSheet

**Implementation Steps:**
1. Add a "Find Alternatives" button below the tags section
2. On tap, call the substitution API
3. Show results in a horizontal scroll of exercise cards
4. Each card shows: name, equipment badge, SFR rating, loading position
5. Tap a card → navigate to that exercise's detail OR swap in active workout

**Affected Files:**
- `app/components/training/ExerciseDetailSheet.tsx` — add button + results section (~30 lines)

**Risk:** LOW — additive UI in existing sheet.

---

### Task 2.3: Smart swap in active workout

**Implementation Steps:**
1. When user taps "swap exercise" during active workout, pre-filter the ExercisePicker by muscle group (already supported via `muscleGroup` nav param)
2. Add a "Recommended" section at the top of the picker showing substitution results
3. Sort recommended by similarity score

**Affected Files:**
- `app/screens/training/ActiveWorkoutScreen.tsx` — pass `muscleGroup` when navigating to picker for swap
- `app/screens/exercise-picker/ExercisePickerScreen.tsx` — add "Recommended" section when in swap mode

**Risk:** MEDIUM — modifies the exercise picker flow. Test swap → pick → return cycle.

---

## PHASE 3: Exercise Detail Screen with Muscle Activation Diagram

> The showroom for the biomechanics moat. Every screenshot is marketing.
> Dependency: Needs Exercise type to include biomechanics fields (Task 3.1).

### Task 3.1: Extend Exercise TypeScript type

**Root Cause:** `app/types/exercise.ts` has the original 12 fields. The JSON now has 20 fields. The frontend type doesn't include biomechanics fields.

**Implementation Steps:**
1. Add to `Exercise` interface:
   ```typescript
   coaching_cues: string[] | null;
   strength_curve: 'ascending' | 'descending' | 'bell_shaped' | 'flat' | null;
   loading_position: 'stretched' | 'mid_range' | 'shortened' | null;
   stretch_hypertrophy_potential: 'high' | 'moderate' | 'low' | 'none' | 'uncertain' | null;
   stimulus_to_fatigue: 'excellent' | 'good' | 'moderate' | 'poor' | null;
   fatigue_rating: 'low' | 'moderate' | 'high' | null;
   ```

**Affected Files:**
- `app/types/exercise.ts` — add 6 fields

**Risk:** LOW — additive type extension. All new fields are nullable.

---

### Task 3.2: Create ExerciseMuscleDiagram component

**Implementation Steps:**
1. Create `app/components/exercise/ExerciseMuscleDiagram.tsx` (~80 lines)
2. Reuse `BodySilhouette` from analytics
3. Convert exercise's `muscle_group` + `secondary_muscles` into a synthetic `volumeMap`:
   - Primary muscle: activation = 1.0 → maps to highest heat color
   - Secondary muscles: activation = 0.5 → maps to moderate heat color
4. Render front + back silhouettes side by side
5. Tap a region → tooltip showing muscle name + "Primary" or "Secondary"

**Affected Files:**
- `app/components/exercise/ExerciseMuscleDiagram.tsx` (NEW)

**Risk:** LOW — new component, reuses existing BodySilhouette.

---

### Task 3.3: Create BiomechanicsCard component

**Implementation Steps:**
1. Create `app/components/exercise/BiomechanicsCard.tsx` (~60 lines)
2. Show:
   - Strength curve badge (ascending/descending/bell/flat) with icon
   - Loading position badge (stretched/mid_range/shortened)
   - Stretch hypertrophy potential indicator
   - SFR rating (excellent/good/moderate/poor) with color
   - Fatigue rating
3. Use theme colors for badges

**Affected Files:**
- `app/components/exercise/BiomechanicsCard.tsx` (NEW)

**Risk:** LOW — new component.

---

### Task 3.4: Create ExerciseDetailScreen

**Implementation Steps:**
1. Create `app/screens/training/ExerciseDetailScreen.tsx` (~150 lines)
2. Sections (scrollable):
   - Header: name, equipment badge, category badge
   - Muscle diagram (Task 3.2)
   - Biomechanics card (Task 3.3)
   - Description (from exercise data)
   - Coaching cues (bulleted list)
   - Instructions (numbered list)
   - Tips (bulleted list)
   - "Add to Workout" button (fixed at bottom)
3. Register route in navigation: `ExerciseDetail: { exerciseId: string }`

**Affected Files:**
- `app/screens/training/ExerciseDetailScreen.tsx` (NEW)
- `app/navigation/BottomTabNavigator.tsx` — add route to relevant stacks

**Risk:** MEDIUM — new screen + navigation route. Test deep linking and back navigation.

---

### Task 3.5: Wire exercise picker to detail screen

**Implementation Steps:**
1. Change ExercisePickerScreen: tap → navigate to ExerciseDetailScreen (instead of immediately adding)
2. ExerciseDetailScreen has "Add to Workout" button that adds and navigates back
3. Long-press still opens the quick-add bottom sheet (backward compat)

**Affected Files:**
- `app/screens/exercise-picker/ExercisePickerScreen.tsx` — change onPress handler

**Risk:** MEDIUM — changes the primary exercise selection flow. Must preserve the quick-add path.

---

## PHASE 4: Step Tracking → TDEE Integration

> Free HealthKit/Health Connect APIs. Creates daily engagement on rest days.
> Dependency: Requires health package installation.

### Task 4.1: Install health packages and create step hook

**Implementation Steps:**
1. Install `expo-sensors` (includes Pedometer API) — works in Expo managed workflow
2. Create `app/hooks/useStepCount.ts` (~50 lines):
   - Use `Pedometer.getStepCountAsync(start, end)` for today's steps
   - Query on app open + every 5 minutes while active
   - Return `{ steps: number | null, loading: boolean, error: string | null }`
3. Add HealthKit/Health Connect entitlements to `app.json` for step data access

**Affected Files:**
- `app/hooks/useStepCount.ts` (NEW)
- `app/package.json` — add `expo-sensors`
- `app/app.json` — add health entitlements

**Risk:** MEDIUM — native module. Must test on physical devices. Expo Pedometer may not work on all Android devices.

---

### Task 4.2: Create StepCountCard dashboard widget

**Implementation Steps:**
1. Create `app/components/dashboard/StepCountCard.tsx` (~60 lines):
   - Show today's step count with animated counter
   - Daily goal (default 8,000, configurable)
   - Progress ring or bar
   - 7-day mini sparkline
2. Add to DashboardScreen

**Affected Files:**
- `app/components/dashboard/StepCountCard.tsx` (NEW)
- `app/screens/dashboard/DashboardScreen.tsx` — add card

**Risk:** LOW — additive dashboard widget.

---

### Task 4.3: Backend TDEE integration

**Implementation Steps:**
1. Add `avg_daily_steps: Optional[float] = None` to `AdaptiveInput` dataclass
2. Modify `_compute_tdee()`:
   ```python
   def _compute_tdee(bmr, activity_level, avg_daily_steps=None):
       if avg_daily_steps is not None and avg_daily_steps > 0:
           multiplier = min(1.9, max(1.2, 1.2 + (avg_daily_steps / 14286)))
           return bmr * multiplier
       return bmr * ACTIVITY_MULTIPLIERS[activity_level]
   ```
3. Add `avg_daily_steps` to `SnapshotRequest` schema
4. Frontend: POST step average when requesting TDEE recalculation

**Affected Files:**
- `src/modules/adaptive/engine.py` — modify `_compute_tdee` (~10 lines)
- `src/modules/adaptive/service.py` — pass steps to engine
- `src/modules/adaptive/schemas.py` — add field to request

**Tests:** Unit test for `_compute_tdee` with step data: 0 steps = 1.2, 5000 = ~1.55, 10000 = ~1.9.

**Risk:** MEDIUM — modifies the TDEE calculation. Must preserve fallback to static multiplier when no step data.

---

## PHASE 5: Biomechanics-Informed Progression Algorithms

> The killer feature. No competitor can replicate.
> Dependency: Needs biomechanics data (done) + overload service (exists).

### Task 5.1: Enhance overload service with biomechanics awareness

**Root Cause:** Current `overload_service.py` uses a simple RPE-based decision tree that's identical for every exercise. It doesn't consider strength curves, loading positions, or SFR.

**Implementation Steps:**
1. Load exercise biomechanics data in the overload service
2. Modify `compute_suggestion()` to use biomechanics:
   - **Ascending curve exercises** (squats, deadlifts): Progress via LOAD first (these exercises are designed for heavy loading)
   - **Bell-shaped curve exercises** (bench, curls): Progress via REPS first at same weight (mid-range loading benefits from time under tension)
   - **Flat curve exercises** (cables, machines): Progress via LOAD (constant tension = direct load progression)
   - **Descending curve exercises** (kickbacks, hip thrusts): Progress via REPS (shortened position benefits from metabolic stress)
   - **High SFR exercises**: Suggest higher volume (more sets) as progression
   - **Poor SFR exercises**: Suggest intensity (load/reps) over volume
   - **High fatigue exercises**: Suggest smaller increments
3. Update `reasoning` field to explain WHY: "Cable lateral raise has a flat strength curve — progress by adding 1kg (constant tension makes load progression effective)"

**Affected Files:**
- `src/modules/training/overload_service.py` — major enhancement (~60 lines added)
- `src/modules/training/exercises.py` — add `get_exercise_biomechanics(name)` helper

**Tests:** Unit tests for each strength curve type producing different progression strategies.

**Risk:** HIGH — modifies the core progression algorithm. Must preserve the RPE-based fallback for exercises without biomechanics data. A/B test if possible.

---

### Task 5.2: Update overload badge UI to show biomechanics reasoning

**Implementation Steps:**
1. Update `OverloadBadge.tsx` to show the biomechanics-informed reasoning
2. Add a small info icon that expands to show: "Based on [strength curve] and [SFR rating]"
3. Color the badge by confidence: green (biomechanics-informed), yellow (RPE-only fallback)

**Affected Files:**
- `app/components/training/OverloadBadge.tsx` — modify display (~15 lines)

**Risk:** LOW — UI-only change.

---

## EXECUTION ORDER

```
Phase 1 (Progressive Overload Color Coding)
  ├── Task 1.1: progressionLogic.ts + progressionColors.ts (NEW)
  ├── Task 1.2: SetRowPremium color coding
  └── Task 1.3: WorkoutSummaryScreen progression count

Phase 2 (Exercise Substitution Engine)
  ├── Task 2.1: Backend find_substitutes() + API endpoint
  ├── Task 2.2: ExerciseDetailSheet "Find Alternatives"
  └── Task 2.3: Smart swap in active workout

Phase 3 (Exercise Detail Screen)
  ├── Task 3.1: Extend Exercise TypeScript type
  ├── Task 3.2: ExerciseMuscleDiagram component (NEW)
  ├── Task 3.3: BiomechanicsCard component (NEW)
  ├── Task 3.4: ExerciseDetailScreen (NEW)
  └── Task 3.5: Wire picker → detail screen

Phase 4 (Step Tracking → TDEE)
  ├── Task 4.1: Install expo-sensors + useStepCount hook
  ├── Task 4.2: StepCountCard dashboard widget
  └── Task 4.3: Backend TDEE integration

Phase 5 (Biomechanics Progression Algorithms)
  ├── Task 5.1: Enhance overload service
  └── Task 5.2: Update overload badge UI
```

## RISK MATRIX

| Task | Risk | Reason |
|------|------|--------|
| 1.2 (SetRow color) | MEDIUM | Most-used component, must not affect input perf |
| 2.3 (Smart swap) | MEDIUM | Modifies exercise picker flow |
| 3.4 (Detail screen) | MEDIUM | New screen + navigation route |
| 3.5 (Picker → detail) | MEDIUM | Changes primary selection flow |
| 4.1 (Health packages) | MEDIUM | Native module, device-dependent |
| 4.3 (TDEE integration) | MEDIUM | Modifies core TDEE calculation |
| 5.1 (Progression algo) | HIGH | Modifies core progression algorithm |

## TOTAL NEW FILES: ~12
## TOTAL MODIFIED FILES: ~10
## TOTAL NEW LINES: ~600-800
## MONTHLY COST: $0


---

## APPENDIX: Plan Audit Corrections (18 Findings)

> Independent audit found 6 critical blockers and 12 subtle bugs. All addressed below.

### PHASE 1 CORRECTIONS

**Finding 1 — Background color conflicts with completion tint**
`SetRowPremium` already has `styles.rowCompleted` with green background. Progression color must REPLACE it, not layer on top.
→ Fix: Use progression color AS the completed background. Green-tint for progressed, yellow for matched, red for regressed. Remove the existing static green `rowCompleted` style when progression data is available.

**Finding 2 — Unit conversion**
→ Fix: Use `parseWeightInput(parseFloat(current.weight), unitSystem)` to normalize to kg before comparing against `previousSet.weightKg`. Import from existing `app/utils/unitConversion.ts`.

**Finding 3 — Color flicker during mid-typing**
→ Fix: Only compute progression status when `set.completed === true`. While editing a completed set, freeze the color at the last-completed snapshot. Recompute only when the set is re-completed.

**Finding 4 — Warm-up sets show false regressions (HIGH)**
→ Fix: `getProgressionStatus()` must check `set.setType`. Only compare `'normal'` sets. Warm-up, drop-set, and AMRAP sets always return `'no_data'`.

**Finding 5 — WorkoutSummary has no previous performance data (HIGH)**
→ Fix: In `useWorkoutSave.ts`, capture `store.previousPerformance` BEFORE calling `store.discardWorkout()`. Pass it as a new nav param `previousPerformance` to WorkoutSummaryScreen.

### PHASE 2 CORRECTIONS

**Finding 6 — Exercise lookup by id vs name**
→ Fix: Endpoint accepts both: `GET /training/exercises/{identifier}/substitutes`. Look up by `id` first, then by `name` if not found.

**Finding 7 — Custom exercises have no biomechanics data**
→ Fix: When source exercise has no biomechanics fields, fall back to matching on muscle_group + equipment + category only. Return results with `confidence: 'low'`. Show UI hint.

**Finding 8 — Substitution cards in detail sheet**
→ Fix: Cards are compact (80px height), section is collapsible with "Show Alternatives" header. API call is lazy-loaded on section expand.

### PHASE 3 CORRECTIONS (CRITICAL)

**Finding 9+10 — 2-tap penalty breaks primary add flow (HIGH)**
→ Fix: **DO NOT change tap behavior.** Keep `onPress` = instant add (current behavior). Instead:
- Add an info icon (ℹ️) button on each exercise card in the picker
- Info icon tap → navigate to ExerciseDetailScreen
- Long-press → still opens ExerciseDetailSheet (backward compat)
- ExerciseDetailScreen has "Add to Workout" button for users who discover it via the info icon
- Swap mode (`target === 'swapExercise'`) is COMPLETELY UNTOUCHED

**Finding 11 — Route must be in BOTH stacks (HIGH — crash)**
→ Fix: Register `ExerciseDetail` screen in BOTH `DashboardStack` AND `LogsStack`. Add to both param list types.

**Finding 12 — BodySilhouette needs mev/mrv for color mapping**
→ Fix: Create `ExerciseMuscleDiagram` that passes synthetic `MuscleGroupVolume` with fixed landmarks: `effective_sets: activation * 10, mev: 0, mrv: 10, mav: 5`. This maps activation 1.0 → "at MRV" color, 0.5 → "mid-range" color. Document the magic numbers.

### PHASE 4 CORRECTIONS

**Finding 13 — iOS motion permission missing (HIGH — crash)**
→ Fix: Add to `app.json`:
```json
"infoPlist": { "NSMotionUsageDescription": "Repwise uses motion data to track your daily steps for TDEE calculation." }
```
Add Android permission: `"ACTIVITY_RECOGNITION"`.

**Finding 14 — Permission denied handling**
→ Fix: `useStepCount` must:
1. Check `Pedometer.isAvailableAsync()` first
2. Request permission via `Pedometer.requestPermissionsAsync()`
3. On denied → return `{ steps: null, permissionDenied: true }` → StepCountCard shows "Enable in Settings"
4. On unavailable → return `{ steps: null, unavailable: true }` → hide StepCountCard entirely

**Finding 15 — Timer leaks on background**
→ Fix: Use `AppState` listener to fetch on foreground resume. `setInterval` for 5-min polling with cleanup in `useEffect` return. iOS suspends the timer automatically.

### PHASE 5 CORRECTIONS (CRITICAL)

**Finding 16 — Biomechanics vs RPE interaction undefined (HIGH)**
→ Fix: Define the interaction matrix explicitly:

| RPE Range | Ascending Curve | Bell-Shaped | Flat | Descending |
|-----------|----------------|-------------|------|------------|
| < 7 (easy) | +weight (aligned) | +reps (bio overrides) | +weight (aligned) | +reps (bio overrides) |
| 7-9 (moderate) | +small weight (bio overrides) | +reps (aligned) | +reps (aligned) | +reps (aligned) |
| > 9 (hard) | MAINTAIN | MAINTAIN | MAINTAIN | MAINTAIN |

RPE > 9 is a SAFETY GATE — never increase regardless of curve. Biomechanics determines the progression AXIS when RPE allows it.

**Finding 17 — Custom exercise fallback**
→ Fix: `get_exercise_biomechanics(name)` returns `None` for custom exercises. `compute_suggestion()` checks for `None` and falls back to pure RPE logic.

**Finding 18 — A/B testing via PostHog**
→ Fix: Create PostHog feature flag `biomechanics_progression` with variants `control`/`treatment`. Pass flag to backend overload endpoint. ~10 lines of code.

---

## REVISED TASK LIST (incorporating all corrections)

### Phase 1 (revised):
- 1.1: `progressionLogic.ts` — add setType filter, unit conversion via `parseWeightInput`
- 1.2: `SetRowPremium.tsx` — replace `rowCompleted` bg with progression color, only when `completed === true`
- 1.3: `useWorkoutSave.ts` — capture `previousPerformance` before discard, pass to WorkoutSummary
- 1.3b: `WorkoutSummaryScreen.tsx` — read previousPerformance from nav params, show progression count

### Phase 3 (revised):
- 3.5: **DO NOT change onPress.** Add info icon (ℹ️) to exercise cards instead. Keep tap = add.
- 3.4: Register ExerciseDetail in BOTH DashboardStack AND LogsStack
- 3.2: Use synthetic MuscleGroupVolume with fixed landmarks (activation × 10, mev=0, mrv=10)

### Phase 4 (revised):
- 4.1: Add `NSMotionUsageDescription` + `ACTIVITY_RECOGNITION` to app.json
- 4.1b: `useStepCount` — add `isAvailableAsync()` check, permission request, denied/unavailable states
- 4.2: `StepCountCard` — handle permissionDenied (show settings link) and unavailable (hide card)

### Phase 5 (revised):
- 5.1: Implement the RPE × biomechanics interaction matrix (RPE > 9 = safety gate)
- 5.1b: `get_exercise_biomechanics()` returns None for custom exercises → RPE fallback
- 5.1c: PostHog feature flag `biomechanics_progression` for A/B testing
