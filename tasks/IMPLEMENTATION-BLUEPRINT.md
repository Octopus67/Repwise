# Repwise Feature Expansion — Implementation Blueprint

> Final version | 2026-04-11
> Incorporates: judge verdicts, Beardsley deep dive, technical feasibility, TDEE analysis

---

## WHAT WE'RE BUILDING (11 Features)

| # | Feature | Priority | Technical Risk |
|---|---------|----------|---------------|
| 1 | Exercise Biomechanics Data (1,200 exercises) | P0 | Low (JSON additive) |
| 2 | Exercise Detail Screen (full redesign) | P0 | Low (new screen) |
| 3 | Progressive Overload Visualization | P0 | Low (frontend only) |
| 4 | Step Tracking → TDEE Engine | P1 | Medium (health packages) |
| 5 | Health Dashboard (HRV, HR, sleep) | P1 | Medium (health packages) |
| 6 | Pre/Post Workout Surveys | P1 | Low (modal + JSONB) |
| 7 | Unilateral & Isometric Tracking | P1 | Low (JSONB additive) |
| 8 | Per-Session Fatigue Heat Map | P1 | Low (reuse components) |
| 9 | Exercise Substitution Engine | P2 | Low (powered by biomechanics data) |
| 10 | Auto-Deload Detection | P2 | Low (analytics layer) |
| 11 | Volume Landmarks Overlay (MEV/MRV/MAV) | P2 | Low (reuse heat map) |

**NOT building:** Spotify (SDK incompatible), Discord bot (wrong moat), Voice logging (unreliable in gyms), Plates calculator (already exists), Workout folders (build when users ask), Workout versioning (niche).

---

## FEATURE 1: Exercise Biomechanics Data

### The Data Model

Current exercise JSON has 12 fields. We add 13 new fields:

```json
{
  "id": "barbell-bench-press",
  "name": "Barbell Bench Press",
  "muscle_group": "chest",
  "secondary_muscles": ["triceps", "shoulders"],
  "equipment": "barbell",
  "category": "compound",
  "image_url": "/static/exercises/Barbell_Bench_Press/0.jpg",
  "animation_url": "/static/exercises/Barbell_Bench_Press/1.jpg",
  "description": null,
  "instructions": ["Lie on a flat bench...", "..."],
  "tips": null,
  "is_mobility": false,

  "NEW FIELDS BELOW": "---",

  "movement_pattern": "push",
  "strength_curve": "bell_shaped",
  "primary_muscles": [
    { "muscle": "chest", "activation": 0.65, "loading_position": "stretched" },
    { "muscle": "triceps", "activation": 0.25, "loading_position": "mid_range" },
    { "muscle": "shoulders", "activation": 0.10, "loading_position": "stretched" }
  ],
  "stretch_hypertrophy": {
    "chest": "high",
    "triceps": "none",
    "shoulders": "uncertain"
  },
  "stimulus_to_fatigue": "good",
  "fatigue_rating": "moderate",
  "difficulty": "intermediate",
  "coaching_cues": [
    "Retract and depress scapulae before unracking",
    "Touch bar to lower chest, not neck",
    "Drive feet into floor for leg drive",
    "Control the eccentric — 2-3 second descent"
  ],
  "science_note": "Bell-shaped strength curve with peak difficulty at mid-range (upper arms horizontal). Pec major is loaded at a stretched position where it has good leverage for horizontal adduction — both active and passive tension contribute to hypertrophy. Triceps are loaded at mid-range; they cannot experience stretch-mediated hypertrophy regardless of exercise. The sternal fibers receive the most neural drive at the bottom due to their longer internal moment arm at that joint angle.",
  "best_paired_with": ["cable-crossover", "pec-deck"],
  "tempo_recommendation": "3-1-1-0",
  "primary_joint_action": "shoulder horizontal adduction + elbow extension"
}
```

### New Field Definitions

| Field | Type | Values | Purpose |
|-------|------|--------|---------|
| `movement_pattern` | enum | push, pull, hinge, squat, lunge, carry, rotation, isolation | Movement classification |
| `strength_curve` | enum | ascending, descending, bell_shaped, flat | Where in ROM is hardest |
| `primary_muscles` | array | `[{muscle, activation (0-1), loading_position}]` | Weighted muscle involvement with WHERE each is loaded |
| `primary_muscles[].loading_position` | enum | stretched, mid_range, shortened | Per-muscle loading position |
| `stretch_hypertrophy` | object | `{muscle: high/moderate/low/none/uncertain}` | Per-muscle stretch-mediated hypertrophy potential |
| `stimulus_to_fatigue` | enum | excellent, good, moderate, poor | Overall SFR rating |
| `fatigue_rating` | enum | low, moderate, high | Recovery cost |
| `difficulty` | enum | beginner, intermediate, advanced | Skill requirement |
| `coaching_cues` | string[] | Free text | Key form cues |
| `science_note` | string | 5-7 lines | Beardsley-style biomechanics analysis |
| `best_paired_with` | string[] | Exercise IDs | Complementary exercises (different loading positions) |
| `tempo_recommendation` | string | "eccentric-pause-concentric-pause" | Suggested tempo |
| `primary_joint_action` | string | Free text | Joint actions involved |

### The Science Note Framework

Every `science_note` follows this structure (5-7 lines):

1. **Strength curve type + why** — "Bell-shaped curve because [external moment arm explanation]"
2. **Primary muscle loading** — "X is loaded at [position] where it has [good/poor] leverage for [joint action]"
3. **Stretch-mediated hypertrophy** — "X [can/cannot] experience stretch-mediated hypertrophy because [sarcomere/leverage reason]"
4. **Neuromechanical matching** — "At peak force, [muscle] has the longest moment arm, receiving the majority of neural drive"
5. **Practical implication** — "This makes it [excellent/good/poor] for [muscle] hypertrophy with [high/moderate/low] fatigue cost"

### Muscle-Specific Rules for Generating Science Notes

Based on the Beardsley deep dive, these are the RULES the research must follow:

**Quadriceps:** Sarcomeres reach descending limb ✅. Good leverage at stretch ✅. Deep ROM exercises are clearly superior. Science notes should emphasize full ROM.

**Pectoralis Major:** Sarcomeres reach descending limb ✅. Good leverage at stretch ✅. DB variations allow deeper stretch than barbell. Notes should distinguish sternal vs clavicular fiber activation by angle.

**Hamstrings:** Sarcomeres reach descending limb ✅. Moderate leverage at stretch ⚠️. Best at ~45° hip flexion, not extreme. RDLs and Nordics are gold standard. Notes must clarify that squats do NOT effectively train hamstrings (adductor magnus dominates).

**Glutes:** Sarcomeres reach descending limb ✅. POOR leverage at deep hip flexion ❌. Adductor magnus takes over in deep squats. Notes must state: "Hip thrusts load glutes where they have best leverage. Deep squats primarily train adductor magnus at the hip."

**Lats:** Uncertain descending limb ❓. POOR leverage overhead ❌. Moment arm approaches zero at full shoulder flexion. Notes must state: "Pullovers are NOT primarily a lat exercise. Rows are superior because peak force occurs where lats have good leverage (~30-50° shoulder flexion)."

**Biceps:** Do NOT reach descending limb ❌. Best trained at ~80-90° elbow flexion due to LEVERAGE (peak moment arm), not stretch. Notes must state: "Biceps do not experience stretch-mediated hypertrophy. They are best trained at moderate-to-long lengths because that's where they have their best leverage (peak internal moment arm at ~80-90° elbow flexion)."

**Triceps:** Do NOT reach descending limb ❌. Long head: best ACTIVATION at arms-by-sides (0° shoulder), but overhead may help via stretch mechanism (Maeo 2022). Notes must distinguish between heads and explain the paradox.

**Gastrocnemius:** Ascending limb only ❌. Needs stretched position NOT for passive tension but because active tension only exceeds hypertrophy threshold at longer lengths. Notes must explain this distinct mechanism.

**Soleus:** Spans full curve ✅. Good leverage ✅. Responds to stretched-position training. Seated calf raises are the primary soleus exercise.

**Deltoids:** Uncertain sarcomere data ❓. Train by region. Lateral delts may benefit from behind-body cable raises (longer muscle length with good leverage).

### Research Process for 1,200 Exercises

This is the hardest part. The approach:

**Phase A — Calibration (50 exercises)**
Take the 50 most common exercises across all muscle groups. For each:
1. Apply Beardsley's framework manually
2. Cross-reference with published EMG data where available
3. Verify against the muscle-specific rules above
4. Write the science note
5. Use these 50 as the "gold standard" for the LLM to learn the pattern

**Phase B — Systematic Generation (1,150 exercises)**
For each remaining exercise:
1. Classify by movement pattern and equipment
2. Determine strength curve from equipment type + joint mechanics
3. Apply muscle-specific rules from the classification table
4. Generate science note following the 5-line framework
5. Assign activation percentages based on compound/isolation + equipment

**Phase C — Verification Pass**
1. Spot-check 10% of generated data against EMG literature
2. Flag exercises where the analysis is uncertain
3. Have the independent judge review for internal consistency

### Files to Modify

**Backend:**
- `src/modules/training/exercises_data.json` — add 13 new fields to all 1,200 entries
- `src/modules/training/exercises.py` — update search to support new filters (movement_pattern, strength_curve, loading_position)
- `src/modules/training/schemas.py` — add response schemas for new fields

**Frontend:**
- `app/types/exercise.ts` — extend `Exercise` interface with new fields
- No API change needed — `GET /training/exercises` already returns raw JSON dicts

---

## FEATURE 2: Exercise Detail Screen

### Current Flow
```
ExercisePickerScreen → tap = add to workout
                     → long-press = ExerciseDetailSheet (bottom sheet)
```

### New Flow
```
ExercisePickerScreen → tap = open ExerciseDetailScreen (full page)
                     → ExerciseDetailScreen has "Add to Workout" button
                     → long-press = still opens quick-add (backward compat)
```

### Screen Sections

1. **Header** — Exercise name, equipment badge, difficulty badge, category badge
2. **Muscle Activation Diagram** — Two `BodySilhouette` components (front + back) colored by `primary_muscles[].activation`. Tap a region → tooltip: "Chest: 65% activation, loaded at stretched position"
3. **Biomechanics Card** — Visual indicators for:
   - Strength curve (ascending/descending/bell/flat) with a simple curve icon
   - Loading position per muscle (stretched/mid/shortened) with color dots
   - Stretch hypertrophy potential (high/moderate/low/none) per muscle
   - SFR rating (excellent/good/moderate/poor)
   - Fatigue rating (low/moderate/high)
4. **Science Note** — The 5-7 line Beardsley analysis in a card
5. **Coaching Cues** — Bulleted list of form tips
6. **Instructions** — Numbered step-by-step (existing data)
7. **Your History** — Line chart of weight × reps over time (fetch from session history)
8. **Personal Records** — PRs for this exercise
9. **Best Paired With** — Horizontal scroll of complementary exercise cards
10. **"Add to Workout" button** — Fixed at bottom

### Component Architecture

```
ExerciseDetailScreen.tsx (new, ~180 lines)
├── ExerciseMuscleDiagram.tsx (new, ~80 lines)
│   └── reuses BodySilhouette from analytics/
├── BiomechanicsCard.tsx (new, ~100 lines)
├── ScienceNoteCard.tsx (new, ~40 lines)
├── CoachingCuesCard.tsx (new, ~30 lines)
├── ExerciseHistoryChart.tsx (new, ~80 lines)
└── ExercisePRCard.tsx (new, ~40 lines)
```

### Muscle Diagram Implementation

The key insight: `BodySilhouette` already accepts a `volumeMap: Map<string, MuscleGroupVolume>`. For per-exercise activation, we create a synthetic `MuscleGroupVolume` from the exercise's `primary_muscles` array:

```typescript
// Convert exercise activation data to BodySilhouette format
function exerciseToVolumeMap(exercise: Exercise): Map<string, MuscleGroupVolume> {
  const map = new Map();
  for (const m of exercise.primary_muscles) {
    map.set(m.muscle, {
      muscle_group: m.muscle,
      effective_sets: m.activation * 10, // scale 0-1 to 0-10 for color mapping
      mev: 3, mrv: 10, mav: 7, // fixed landmarks for color scaling
      frequency: 0, volume_status: '',
    });
  }
  return map;
}
```

This reuses the ENTIRE existing heat map infrastructure without modification.

---

## FEATURE 3: Progressive Overload Visualization

### Data Flow (Already Exists)

```
ActiveWorkoutScreen mounts
  → useActiveWorkoutStore.loadPreviousPerformance(exercises)
  → API: GET /training/previous-performance?exercises=...
  → BatchPreviousPerformanceResolver returns { exercise_name: { sets: [...] } }
  → Stored in store.previousPerformance
  → Available in ActiveWorkoutBody → ExerciseCardPremium → SetRow
```

### What to Add (Frontend Only)

In `SetRow.tsx` (or equivalent set input component):
```typescript
// Compare current set vs previous
const prevSet = previousPerformance?.[exerciseName]?.sets?.[setIndex];
const status = getProgressionStatus(currentSet, prevSet);
// status: 'progressed' | 'matched' | 'regressed' | 'no_data'

// Color the set row background
const bgColor = {
  progressed: 'rgba(34, 197, 94, 0.1)',   // green tint
  matched: 'rgba(234, 179, 8, 0.1)',       // yellow tint
  regressed: 'rgba(239, 68, 68, 0.1)',     // red tint
  no_data: 'transparent',
}[status];
```

Progression logic:
```typescript
function getProgressionStatus(current, previous): ProgressionStatus {
  if (!previous) return 'no_data';
  if (current.weight_kg > previous.weight_kg) return 'progressed';
  if (current.weight_kg === previous.weight_kg && current.reps > previous.reps) return 'progressed';
  if (current.weight_kg === previous.weight_kg && current.reps === previous.reps) return 'matched';
  return 'regressed';
}
```

On `WorkoutSummaryScreen`, add a progression summary:
```
"You progressed on 4/6 exercises today 💪"
```

### Files to Modify
- `app/components/training/SetRow.tsx` (or equivalent) — add color coding
- `app/screens/training/WorkoutSummaryScreen.tsx` — add progression count
- `app/utils/progressionLogic.ts` — new utility for comparison

---

## FEATURE 4: Step Tracking → TDEE Engine

### Architecture

```
HealthKit / Health Connect
    ↓ (daily step count)
useStepCounter hook (frontend)
    ↓ (POST /health/steps)
daily_steps table (backend)
    ↓ (7-day rolling average)
AdaptiveInput.avg_daily_steps
    ↓
engine.py: _compute_tdee() uses steps instead of static enum
    ↓
Dynamic TDEE that adjusts with actual activity
```

### TDEE Integration (Option A — Dynamic Activity Multiplier)

In `src/modules/adaptive/engine.py`:

```python
# Current (static):
def _compute_tdee(bmr: float, activity_level: str) -> float:
    return bmr * ACTIVITY_MULTIPLIERS[activity_level]

# New (step-aware):
def _compute_tdee(bmr: float, activity_level: str, avg_daily_steps: float | None = None) -> float:
    if avg_daily_steps is not None and avg_daily_steps > 0:
        # Continuous function: maps steps to multiplier
        # Based on Tudor-Bompa & Cornacchia step-activity research
        multiplier = min(1.9, max(1.2, 1.2 + (avg_daily_steps / 14286)))
        # 0 steps = 1.2, 5000 = 1.55, 10000 = 1.9 (capped)
        return bmr * multiplier
    # Fallback to static enum
    return bmr * ACTIVITY_MULTIPLIERS[activity_level]
```

### New Backend Components
- `src/modules/health/models.py` — `DailySteps` table (user_id, date, step_count, source)
- `src/modules/health/router.py` — `POST /health/steps`, `GET /health/steps/summary`
- `src/modules/health/service.py` — 7-day rolling average calculation
- Modify `src/modules/adaptive/engine.py` — accept `avg_daily_steps` in `AdaptiveInput`
- Modify `src/modules/adaptive/service.py` — fetch step average before computing snapshot

### New Frontend Components
- `app/hooks/useStepCounter.ts` — read steps from HealthKit/Health Connect
- `app/components/dashboard/StepCountCard.tsx` — dashboard widget
- Install: `expo-sensors` (Pedometer), `react-native-health` (iOS), `expo-health-connect` (Android)

### Challenge
Background step counting on iOS is limited in Expo. Solution: read HISTORICAL step data from HealthKit on app open (HealthKit stores steps from Apple Watch / iPhone motion coprocessor regardless of our app). We don't need real-time counting — just query "how many steps today?" from HealthKit each time the app opens.

---

## FEATURE 5: Health Dashboard

### Un-stub useHealthData.ts

The hook already has the implementation commented out. It reads:
- HRV (HeartRateVariabilityRmssd) from HealthKit / Health Connect
- Resting Heart Rate from HealthKit / Health Connect
- Sleep Duration from HealthKit / Health Connect (SleepSession)

### New Health Screen

```
HealthScreen.tsx
├── StepCountCard (today's steps, 7-day trend, daily goal)
├── HRVCard (today's HRV, 7-day trend, readiness impact)
├── RestingHRCard (today's resting HR, trend)
├── SleepCard (last night's sleep duration, trend)
└── ReadinessScoreCard (composite score from all inputs)
```

### Feed Into Readiness Engine

Currently readiness is manual (RecoveryCheckinModal). With device data:
```
Device HRV + Resting HR + Sleep Duration + Manual Check-in
    ↓
Weighted composite readiness score
    ↓
Training recommendations (volume multiplier, exercise selection)
```

---

## FEATURE 6: Pre/Post Workout Surveys

### Pre-Workout (Expand Existing RecoveryCheckinModal)
Add fields: energy (1-5), motivation (1-5), soreness (1-5), sleep quality (1-5)

### Post-Workout (New Modal)
Fields: session RPE (1-10), pump quality (1-5), joint discomfort (1-5), overall satisfaction (1-5)

### Storage
Add to session JSONB (additive, no migration):
```json
{
  "pre_survey": { "energy": 4, "motivation": 5, "soreness": 2, "sleep_quality": 4 },
  "post_survey": { "session_rpe": 8, "pump": 4, "joint_discomfort": 1, "satisfaction": 5 }
}
```

---

## FEATURE 7: Unilateral & Isometric Tracking

### Schema Extension (Additive JSONB)

Current `SetEntry`:
```python
class SetEntry(BaseModel):
    reps: int
    weight_kg: float
    rpe: Optional[float]
    rir: Optional[int]
    set_type: str  # normal, warm-up, drop-set, amrap
```

New fields (all Optional, backward compatible):
```python
class SetEntry(BaseModel):
    reps: Optional[int] = None          # None for isometric
    weight_kg: float = 0
    rpe: Optional[float] = None
    rir: Optional[int] = None
    set_type: str = "normal"            # + "isometric", "unilateral"
    duration_seconds: Optional[int] = None  # for isometric holds
    side: Optional[str] = None          # "left", "right", None=bilateral
```

### Frontend Changes
- `SetRow.tsx` — show L/R toggle for unilateral exercises, show timer for isometric
- `IsometricTimer.tsx` — new component with start/stop + haptic feedback
- `ActiveWorkoutBody.tsx` — detect exercise type and show appropriate input mode

---

## FEATURE 8: Per-Session Fatigue Heat Map

### Implementation (Reuse Existing Components)

After workout completion, compute per-muscle volume from the session:

```typescript
function sessionToMuscleVolumes(session: CompletedSession, exerciseDB: Exercise[]): MuscleGroupVolume[] {
  const volumeByMuscle: Record<string, number> = {};

  for (const ex of session.exercises) {
    const exerciseData = exerciseDB.find(e => e.name === ex.exercise_name);
    const workingSets = ex.sets.filter(s => s.set_type !== 'warm-up').length;

    // Use primary_muscles activation weights if available
    if (exerciseData?.primary_muscles) {
      for (const m of exerciseData.primary_muscles) {
        volumeByMuscle[m.muscle] = (volumeByMuscle[m.muscle] || 0) + workingSets * m.activation;
      }
    } else {
      // Fallback: primary = 1.0, secondary = 0.5
      volumeByMuscle[exerciseData?.muscle_group || 'unknown'] =
        (volumeByMuscle[exerciseData?.muscle_group || 'unknown'] || 0) + workingSets;
      for (const sec of exerciseData?.secondary_muscles || []) {
        volumeByMuscle[sec] = (volumeByMuscle[sec] || 0) + workingSets * 0.5;
      }
    }
  }

  // Convert to MuscleGroupVolume[] for BodyHeatMap
  return Object.entries(volumeByMuscle).map(([muscle, sets]) => ({
    muscle_group: muscle,
    effective_sets: sets,
    frequency: 1,
    volume_status: '',
    mev: 3, mav: 7, mrv: 10, // session-level landmarks for color scaling
  }));
}
```

Then pass to existing `<BodyHeatMap muscleVolumes={sessionVolumes} />` on WorkoutSummaryScreen.

---

## FEATURE 9: Exercise Substitution Engine

Powered by biomechanics data from Feature 1.

### Logic
Given an exercise, find substitutes that:
1. Target the same primary muscle
2. Load it at the same position (stretched/mid/shortened)
3. Have similar or better SFR
4. Use different equipment (for when gym is busy)

```python
def find_substitutes(exercise_id: str, available_equipment: list[str] = None) -> list[Exercise]:
    exercise = get_exercise(exercise_id)
    primary = exercise['primary_muscles'][0]  # highest activation muscle

    candidates = [e for e in get_all_exercises() if
        e['id'] != exercise_id and
        any(m['muscle'] == primary['muscle'] and
            m['loading_position'] == primary['loading_position']
            for m in e.get('primary_muscles', [])) and
        (available_equipment is None or e['equipment'] in available_equipment)
    ]

    # Sort by SFR rating
    return sorted(candidates, key=lambda e: SFR_ORDER.get(e.get('stimulus_to_fatigue', 'moderate'), 2))[:5]
```

### Frontend
- "Find Alternatives" button on ExerciseDetailScreen
- Shows 3-5 substitutes with equipment badges
- Tap to swap in active workout

---

## FEATURE 10: Auto-Deload Detection

### Logic
Track progressive overload data across sessions. When regression is detected across 2+ consecutive sessions for 3+ exercises, suggest a deload.

```python
def check_deload_needed(user_id: str, recent_sessions: list) -> bool:
    regression_count = 0
    for exercise in get_tracked_exercises(recent_sessions[-2:]):
        if exercise_regressed(exercise, recent_sessions):
            regression_count += 1
    return regression_count >= 3
```

### Frontend
- Banner on dashboard: "Performance declining across multiple exercises. Consider a deload week."
- Link to deload protocol (reduce volume by 40-60%, maintain intensity)

---

## FEATURE 11: Volume Landmarks Overlay

### What It Is
On the weekly analytics heat map, show MEV/MRV/MAV numbers per muscle group. "You're at 18 sets for chest this week (approaching MRV of 20)."

### Implementation
The data already exists — `MuscleGroupVolume` has `mev`, `mav`, `mrv`, `effective_sets`. Just need a UI overlay on the existing heat map that shows the numbers when you tap a muscle region.

Enhance `DrillDownModal.tsx` to show:
```
Chest: 18 sets this week
├── MEV: 10 sets (minimum for growth)
├── MAV: 16 sets (optimal range)
├── MRV: 20 sets (maximum recoverable)
└── Status: ⚠️ Approaching MRV — consider reducing next week
```

---

## EXECUTION PHASES

### Phase 1: Biomechanics Foundation (Features 1, 2, 3, 8)
- Research and populate exercise data for all 1,200 exercises
- Build exercise detail screen with muscle diagram
- Add progressive overload color-coding
- Add per-session fatigue heat map
- **All frontend-heavy, no migrations, no new dependencies**

### Phase 2: Intelligence Layer (Features 4, 5, 6)
- Install health packages, un-stub health data
- Build step tracking → TDEE integration
- Build health screen
- Add pre/post workout surveys
- **Requires new dependencies (health packages)**

### Phase 3: Training Completeness (Features 7, 9, 10, 11)
- Add unilateral/isometric tracking
- Build exercise substitution engine
- Add auto-deload detection
- Add volume landmarks overlay
- **Schema extensions (additive JSONB), no migrations**
