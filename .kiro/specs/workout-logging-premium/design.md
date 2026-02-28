# Design Document: Workout Logging Premium

## Overview

This design transforms the workout logging screen from a developer prototype into a premium experience across four layers: Speed, Intelligence, Experience, and Advanced Features. The existing backend is already sophisticated (PR detection, overload suggestions, batch previous performance, volume landmarks, analytics). The `activeWorkoutSlice` Zustand store already supports crash recovery via AsyncStorage persistence, supersets, exercise swap, warm-up set insertion, previous performance copy, skip, notes, and reorder. The primary work is in the frontend UX layer — surfacing existing intelligence inline, replacing the modal-based logger with a full-screen active workout, and adding emotional design (floating rest timer, PR celebrations, visual set completion states).

### Key Design Decisions

| Decision | Chose | Considered | Reasoning |
|----------|-------|-----------|-----------|
| Workout screen architecture | Full-screen `ActiveWorkoutScreen` using existing `activeWorkoutSlice` | Rebuild from scratch, keep modal-based | Store already has all CRUD, persistence, supersets — just need the screen UI |
| Rest timer | Floating bar with SVG ring at bottom | Keep full-screen modal, inline between sets | Floating bar matches Strong/Hevy pattern, keeps workout scrollable |
| Exercise picker | Bottom sheet overlay | Keep full-screen navigation | Maintains workout context, reduces navigation friction |
| State management | Existing `activeWorkoutSlice` (Zustand + AsyncStorage persist) | New store, Redux | Already built with crash recovery, all CRUD ops, superset support |
| Overload suggestions | Batch fetch on workout load + existing `OverloadSuggestionService` | Real-time per-set calculation | Batch is efficient, service already exists with pure algorithm |
| Volume tracking | Frontend aggregation from weekly volume API + active sets | Real-time backend calculation | Reduces API calls, weekly volume endpoint already exists |
| RIR field | Add optional `rir` field to `SetEntry` schema | Compute from RPE, separate table | Direct field is simplest, backward-compatible (optional) |
| Plate calculator | Pure frontend utility | Backend endpoint | No server dependency needed, pure math |
| Warm-up generator | Pure frontend utility (already exists as `warmUpGenerator`) | Backend endpoint | Already implemented, pure math |
| Unit system | Display-only conversion using existing `unitConversion.ts` | Store in user's preferred unit | Existing pattern: store kg, convert for display |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ActiveWorkoutScreen                        │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │ Header   │ │ ExerciseCards│ │ FloatingRestTimerBar    │  │
│  │ (timer,  │ │ (set rows,  │ │ (SVG ring, +/-15s,     │  │
│  │  date)   │ │  prev perf, │ │  pause, color shift)   │  │
│  └──────────┘ │  overload   │ └─────────────────────────┘  │
│               │  badges,    │ ┌─────────────────────────┐  │
│               │  volume     │ │ StickyFinishBar         │  │
│               │  pills)     │ │ (summary, finish btn)   │  │
│               └──────────────┘ └─────────────────────────┘  │
│  ┌──────────────────────────┐ ┌─────────────────────────┐  │
│  │ ExercisePickerSheet      │ │ FinishConfirmationSheet │  │
│  │ (bottom sheet overlay)   │ │ (summary, save template)│  │
│  └──────────────────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│activeWorkoutSlice│ │ useStore (main) │ │ API Service     │
│(Zustand+Async   │ │ (unitSystem,    │ │ (batch prev     │
│ Storage persist) │ │  profile prefs) │ │  perf, overload,│
│                  │ │                 │ │  volume, submit)│
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────┐                    ┌─────────────────┐
│ AsyncStorage     │                    │ FastAPI Backend  │
│ (crash recovery) │                    │ (training module)│
└─────────────────┘                    └─────────────────┘
```

### Dependency Graph — Existing Modules Touched

| Module | Change Type | Description |
|--------|------------|-------------|
| `app/store/activeWorkoutSlice.ts` | Modify | Add `restTimerState`, `overloadSuggestions`, `volumeData` fields |
| `app/types/training.ts` | Modify | Add `rir` to `ActiveSet`, rest timer types, overload suggestion types |
| `src/modules/training/schemas.py` | Modify | Add `rir` field to `SetEntry` |
| `src/modules/training/overload_service.py` | Enhance | Add batch suggestion endpoint support |
| `app/components/training/RestTimer.tsx` | Replace | New `FloatingRestTimerBar` component |
| `app/components/modals/AddTrainingModal.tsx` | Deprecate | Replaced by `ActiveWorkoutScreen` |
| `app/screens/exercise-picker/ExercisePickerScreen.tsx` | Keep | Still used for full navigation; new `ExercisePickerSheet` wraps it as bottom sheet |
| `app/utils/unitConversion.ts` | No change | Used as-is for display conversion |
| `app/components/common/ProgressRing.tsx` | Reuse | Used for rest timer SVG ring |

## Components and Interfaces

### New Frontend Components

```
app/screens/training/ActiveWorkoutScreen.tsx    — Main workout screen
app/components/training/FloatingRestTimerBar.tsx — Floating timer bar
app/components/training/SetRowPremium.tsx        — Enhanced set row with completion, prev perf, stepper
app/components/training/ExerciseCardPremium.tsx  — Exercise card with progress dots, overload badge
app/components/training/OverloadBadge.tsx        — Inline overload suggestion display
app/components/training/VolumePills.tsx          — Weekly volume tracking pills
app/components/training/PRCelebration.tsx        — Confetti + banner animation
app/components/training/StickyFinishBar.tsx      — Sticky bottom bar with mini summary
app/components/training/FinishConfirmationSheet.tsx — Bottom sheet with workout summary
app/components/training/ExercisePickerSheet.tsx  — Bottom sheet exercise picker
app/components/training/PlateCalculatorSheet.tsx — Plate breakdown display
app/components/training/ExerciseHistorySheet.tsx — Exercise history bottom sheet
app/components/training/SupersetBracket.tsx      — Visual bracket for superset groups
app/utils/plateCalculator.ts                     — Pure plate calculation logic
app/utils/warmUpGenerator.ts                     — Already exists, reuse
app/utils/setCompletionLogic.ts                  — Already exists, reuse
app/utils/supersetLogic.ts                       — Already exists, reuse
app/utils/volumeAggregator.ts                    — Aggregate weekly volume + active sets
```

### Backend Changes

```
src/modules/training/schemas.py                  — Add rir field to SetEntry
src/modules/training/overload_service.py         — Add batch suggestion method
src/modules/training/router.py                   — Add batch overload endpoint
```

### Key Interfaces (TypeScript)

```typescript
// FloatingRestTimerBar props
interface FloatingRestTimerBarProps {
  durationSeconds: number;
  isActive: boolean;
  onComplete: () => void;
  onDismiss: () => void;
  exerciseName: string;
}

// SetRowPremium props
interface SetRowPremiumProps {
  set: ActiveSet;
  setIndex: number;
  exerciseLocalId: string;
  previousSet: { weightKg: number; reps: number } | null;
  isCompleted: boolean;
  unitSystem: 'metric' | 'imperial';
  showRpeRir: boolean;
  rpeMode: 'rpe' | 'rir';
  onToggleComplete: () => void;
  onCopyPrevious: () => void;
  onUpdateField: (field: 'weight' | 'reps' | 'rpe', value: string) => void;
  onWeightStep: (direction: 'up' | 'down') => void;
}

// OverloadBadge props
interface OverloadBadgeProps {
  suggestion: {
    suggestedWeightKg: number;
    suggestedReps: number;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
  } | null;
  unitSystem: 'metric' | 'imperial';
}

// VolumePills props
interface VolumePillsProps {
  muscleVolumes: Array<{
    muscleGroup: string;
    currentSets: number;
    mavLow: number;
    mavHigh: number;
  }>;
}

// PlateCalculator input/output
interface PlateBreakdown {
  barWeightKg: number;
  totalWeightKg: number;
  platesPerSide: Array<{ weightKg: number; count: number }>;
  achievableWeightKg: number;
  isExact: boolean;
}
```

### Backend Schema Change

```python
# SetEntry — add rir field
class SetEntry(BaseModel):
    reps: int = Field(ge=0)
    weight_kg: float = Field(ge=0)
    rpe: Optional[float] = Field(default=None, ge=0, le=10)
    rir: Optional[int] = Field(default=None, ge=0, le=5)  # NEW
    set_type: str = Field(default="normal")
```

### New API Endpoint

```
POST /training/exercises/batch-overload-suggestions
Request: { "exercise_names": ["Bench Press", "Squat", ...] }
Response: { "suggestions": { "Bench Press": { ... } | null, "Squat": { ... } | null } }
```

## Data Models

### Modified: SetEntry (Backend)

| Field | Type | Constraints | Change |
|-------|------|------------|--------|
| reps | int | >= 0 | Existing |
| weight_kg | float | >= 0 | Existing |
| rpe | Optional[float] | 0-10 | Existing |
| rir | Optional[int] | 0-5 | **NEW** |
| set_type | str | normal, warm-up, drop-set, amrap | Existing |

The `rir` field is optional and defaults to `None`. Existing sessions without RIR data remain valid — full backward compatibility.

### Modified: ActiveSet (Frontend)

| Field | Type | Change |
|-------|------|--------|
| localId | string | Existing |
| setNumber | number | Existing |
| weight | string | Existing |
| reps | string | Existing |
| rpe | string | Existing |
| rir | string | **NEW** — empty string default |
| setType | SetType | Existing |
| completed | boolean | Existing |
| completedAt | string \| null | Existing |

### Modified: ActiveWorkoutState (Frontend Store)

| Field | Type | Change |
|-------|------|--------|
| restTimerActive | boolean | **NEW** |
| restTimerExerciseName | string | **NEW** |
| restTimerDuration | number | **NEW** |
| restTimerStartedAt | string \| null | **NEW** |
| overloadSuggestions | Record<string, OverloadSuggestion \| null> | **NEW** |
| weeklyVolumeData | MuscleVolumeEntry[] | **NEW** |

### Plate Calculator Data (Pure Frontend)

Standard plate sets:
- Metric: [25, 20, 15, 10, 5, 2.5, 1.25] kg
- Imperial: [45, 35, 25, 10, 5, 2.5] lbs
- Default bar weight: 20 kg / 45 lbs

### Warm-Up Generator Data (Already Exists)

Ramp pattern: bar × 10 → 60% × 5 → 80% × 3 → working weight

### Volume Aggregation

Weekly volume = sets from `GET /training/analytics/muscle-volume?week_start=<monday>` + completed sets in active workout (counted by exercise → muscle group mapping).



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Previous performance resolver returns correct historical data

*For any* user with training sessions and any exercise name, the batch previous performance resolver SHALL return the most recent session's set data for that exercise, or null if no session contains that exercise.

**Validates: Requirements 1.1**

### Property 2: Copy previous fills set with correct values

*For any* exercise with previous performance data and any set index within the previous data range, calling `copyPreviousToSet` SHALL set the set's weight to the previous set's weight_kg and reps to the previous set's reps.

**Validates: Requirements 1.2**

### Property 3: Template pre-fill uses previous performance data

*For any* workout template and corresponding previous performance data, loading the template SHALL produce exercises where each set's weight and reps match the previous session's values for that exercise.

**Validates: Requirements 1.3**

### Property 4: Unit conversion is consistent and reversible

*For any* non-negative weight value in kg, converting to imperial and back to metric SHALL produce a value within 0.1 kg of the original. *For any* weight and unit system, `convertWeight` SHALL return a non-negative value.

**Validates: Requirements 1.5, 3.5, 4.6, 14.6**

### Property 5: Set completion toggle and progress count

*For any* exercise with N sets where M are completed, the progress count SHALL equal "M/N". Toggling a set's completion SHALL increment or decrement M by exactly 1.

**Validates: Requirements 2.1, 2.4**

### Property 6: Weight stepper produces valid values

*For any* non-negative weight value and unit system (metric: 2.5 kg step, imperial: 5 lbs step), incrementing SHALL increase by exactly the step amount, and decrementing SHALL decrease by the step amount with a floor of 0 (result is always >= 0).

**Validates: Requirements 3.1, 3.2**

### Property 7: Overload suggestion weight is always non-negative

*For any* list of 3+ session snapshots with non-negative weights and any equipment type, `compute_suggestion` SHALL return a suggestion with `suggested_weight_kg >= 0`.

**Validates: Requirements 4.3**

### Property 8: Overload suggestion confidence is always valid

*For any* valid suggestion returned by `compute_suggestion`, the confidence field SHALL be one of "high", "medium", or "low".

**Validates: Requirements 4.5**

### Property 9: Volume aggregation combines weekly and active sets correctly

*For any* weekly volume data (set counts per muscle group from API) and any active workout state with completed sets, the aggregated volume for each muscle group SHALL equal the API count plus the number of completed normal sets in the active workout for exercises mapping to that muscle group.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 10: RIR field validation and round-trip

*For any* integer value 0-5, creating a `SetEntry` with that `rir` value SHALL succeed. *For any* value outside 0-5 or non-integer, creation SHALL fail validation. *For any* valid SetEntry with rir, serializing to JSON and deserializing SHALL produce an equivalent SetEntry.

**Validates: Requirements 7.1, 7.5**

### Property 11: Rest timer adjustment respects floor

*For any* remaining time >= 0, adding 15 seconds SHALL increase remaining by 15, and subtracting 15 seconds SHALL decrease remaining by 15 with a floor of 0 (result is always >= 0).

**Validates: Requirements 8.3**

### Property 12: Rest timer color follows gradient rules

*For any* remaining time and total duration where remaining <= total, the color SHALL be green when remaining > total/2, yellow when remaining > 10 and remaining <= total/2, and red when remaining <= 10.

**Validates: Requirements 8.6**

### Property 13: Rest duration resolution uses correct precedence

*For any* exercise with an optional per-exercise rest override, compound default, and isolation default, the resolved duration SHALL be: (1) per-exercise override if set, else (2) compound default if exercise is compound, else (3) isolation default.

**Validates: Requirements 8.7, 17.5**

### Property 14: Duration formatting is correct

*For any* elapsed time in seconds >= 0, the formatted string SHALL be "MM:SS" when < 3600 seconds, or "H:MM:SS" when >= 3600 seconds, where the values correctly represent the elapsed time.

**Validates: Requirements 9.2**

### Property 15: Workout summary computation is accurate

*For any* workout state with exercises and sets, the summary SHALL report: exercise count = number of non-skipped exercises, set count = number of completed sets, total volume = sum of (weight_kg × reps) for all completed sets.

**Validates: Requirements 10.1, 10.2**

### Property 16: Superset creation requires 2+ exercises and dissolution on removal

*For any* list of exercise local IDs, `createSuperset` SHALL return a group only when 2+ valid IDs are provided. *For any* superset group, removing an exercise such that fewer than 2 remain SHALL dissolve the group.

**Validates: Requirements 11.1, 11.3**

### Property 17: Superset rest timer fires only after last exercise

*For any* superset group with N exercises, the rest timer SHALL trigger only when the last exercise in the group has a set completed, not after intermediate exercises.

**Validates: Requirements 11.2**

### Property 18: Exercise swap preserves all set data

*For any* exercise with sets (including completed sets with weight, reps, RPE, RIR, set_type, and completion state), swapping the exercise name SHALL change only the exercise name — all set data SHALL remain identical.

**Validates: Requirements 12.2**

### Property 19: Warm-up generator produces valid ramp

*For any* target working weight > bar weight, the warm-up generator SHALL produce sets where: (a) all weights are >= bar weight, (b) all weights are <= target weight, (c) weights are non-decreasing, (d) all weights are rounded to achievable plate increments, (e) all sets have set_type "warm-up", (f) sets are inserted before working sets.

**Validates: Requirements 13.1, 13.2, 13.3**

### Property 20: Plate calculator round-trip

*For any* target weight >= bar weight, the plate calculator's output plates (summed per side × 2 + bar weight) SHALL equal the achievable weight. The achievable weight SHALL be <= target weight and the closest achievable weight using available plates.

**Validates: Requirements 14.1, 14.2, 14.5**

### Property 21: Plate calculator uses minimum plates

*For any* achievable weight, the plate breakdown SHALL use the minimum number of individual plates. No plate combination with fewer total plates SHALL produce the same weight.

**Validates: Requirements 14.3**

### Property 22: Crash recovery round-trip

*For any* active workout state, persisting to AsyncStorage and restoring SHALL produce an equivalent state (all exercises, sets, completion states, notes, superset groups, and timestamps preserved).

**Validates: Requirements 15.1, 15.3**

### Property 23: Exercise reorder preserves all exercises

*For any* list of exercises and any valid (fromIndex, toIndex) pair, reordering SHALL produce a list containing exactly the same exercises (same local IDs, same set data) in a different order, with length unchanged.

**Validates: Requirements 17.1**

### Property 24: Exercise skip preserves structure

*For any* exercise in a workout, toggling skip SHALL set the `skipped` flag without removing the exercise or modifying its sets, and toggling again SHALL restore the original state.

**Validates: Requirements 17.2**

## Error Handling

| Scenario | Detection | Handling | User Experience |
|----------|-----------|---------|----------------|
| Batch previous performance API fails | Network error / timeout | Catch in fetch, show sets without previous data | Sets display without "Previous" column; user can still log manually |
| Overload suggestion API fails | Network error / 5xx | Catch in fetch, hide suggestion badge | No suggestion badge shown; workout logging unaffected |
| Volume tracking API fails | Network error / timeout | Show only active workout sets, no weekly data | Volume pills show "? sets" for weekly data |
| Session save fails (network) | API error response | Show error banner with retry button; keep workout state | "Failed to save. Tap to retry." — workout data preserved in store |
| Session save fails (validation) | 422 response | Show specific validation error | "Invalid data: [field]. Please check and try again." |
| Crash recovery state corrupted | JSON parse error on restore | Clear corrupted state, start fresh | No resume prompt; user starts new workout |
| AsyncStorage full | Write error on persist | Log warning, continue without persistence | Workout continues but crash recovery unavailable |
| Exercise not found in database | Missing from exercise list | Allow free-text exercise name | User can type custom exercise name |
| Plate calculator with 0 or negative weight | Input validation | Show "Bar only" for weight <= bar weight | Clear message, no error |
| Warm-up generator with weight <= bar | Input validation | Return empty warm-up set list | No warm-up sets generated; user informed |
| Duplicate set completion tap | Debounce / state check | Ignore if already completed | No visual change on double-tap |
| App backgrounded during rest timer | AppState listener | Continue timer in background, haptic on return | Timer continues; haptic fires when timer completes |
| Token expiration during workout | 401 response interceptor | Refresh token automatically; retry failed request | Transparent to user; existing auth interceptor handles this |
| Concurrent modification (two devices) | Last-write-wins on session save | Server accepts latest submission | Most recent save wins; no conflict UI needed for MVP |

## Testing Strategy

### Testing Framework

- **Backend**: pytest + Hypothesis (property-based testing)
- **Frontend**: Jest + fast-check (property-based testing)
- **Minimum 100 iterations** per property-based test

### Property-Based Tests (Backend — Hypothesis)

Each property test references its design document property number.

| Test | Property | Library | File |
|------|----------|---------|------|
| Overload suggestion non-negative weight | Property 7 | Hypothesis | `tests/test_overload_suggestion_properties.py` |
| Overload suggestion valid confidence | Property 8 | Hypothesis | `tests/test_overload_suggestion_properties.py` |
| RIR field validation round-trip | Property 10 | Hypothesis | `tests/test_workout_logging_premium_properties.py` |
| Previous performance resolver correctness | Property 1 | Hypothesis | `tests/test_previous_performance_properties.py` |

### Property-Based Tests (Frontend — fast-check)

| Test | Property | Library | File |
|------|----------|---------|------|
| Unit conversion consistency | Property 4 | fast-check | `app/__tests__/utils/unitConversion.test.ts` |
| Weight stepper valid values | Property 6 | fast-check | `app/__tests__/utils/weightStepper.test.ts` |
| Volume aggregation correctness | Property 9 | fast-check | `app/__tests__/utils/volumeAggregator.test.ts` |
| Rest timer adjustment floor | Property 11 | fast-check | `app/__tests__/utils/restTimerLogic.test.ts` |
| Rest timer color gradient | Property 12 | fast-check | `app/__tests__/utils/restTimerLogic.test.ts` |
| Rest duration resolution | Property 13 | fast-check | `app/__tests__/utils/restDurationResolver.test.ts` |
| Duration formatting | Property 14 | fast-check | `app/__tests__/utils/durationFormat.test.ts` |
| Workout summary computation | Property 15 | fast-check | `app/__tests__/utils/workoutSummary.test.ts` |
| Superset creation/dissolution | Property 16 | fast-check | `app/__tests__/utils/supersetLogic.test.ts` |
| Exercise swap preserves data | Property 18 | fast-check | `app/__tests__/utils/exerciseSwapLogic.test.ts` |
| Warm-up generator valid ramp | Property 19 | fast-check | `app/__tests__/utils/warmUpGenerator.test.ts` |
| Plate calculator round-trip | Property 20 | fast-check | `app/__tests__/utils/plateCalculator.test.ts` |
| Plate calculator minimum plates | Property 21 | fast-check | `app/__tests__/utils/plateCalculator.test.ts` |
| Crash recovery round-trip | Property 22 | fast-check | `app/__tests__/store/activeWorkoutSlice.test.ts` |
| Exercise reorder preserves all | Property 23 | fast-check | `app/__tests__/store/activeWorkoutSlice.test.ts` |
| Exercise skip preserves structure | Property 24 | fast-check | `app/__tests__/store/activeWorkoutSlice.test.ts` |

### Unit Tests

| Area | Key Tests | File |
|------|-----------|------|
| Plate calculator edge cases | Bar only, impossible weight, zero weight | `app/__tests__/utils/plateCalculator.test.ts` |
| Warm-up generator edge cases | Weight = bar, very heavy weight, non-barbell | `app/__tests__/utils/warmUpGenerator.test.ts` |
| Set completion validation | Missing reps, missing weight, valid set | `app/__tests__/utils/setCompletionLogic.test.ts` |
| Overload with 1 session | Returns maintain suggestion | `tests/test_overload_suggestion_properties.py` |
| RIR schema validation | Values 0-5 valid, -1 and 6 invalid | `tests/test_workout_logging_premium_properties.py` |
| Superset rest timer trigger | Fires after last exercise only | `app/__tests__/utils/supersetRestTrigger.test.ts` |

### What Is NOT Worth Testing

- Visual styling (green tint, muted appearance, typography sizes) — these are CSS/StyleSheet concerns verified by visual review
- Navigation flow (bottom sheet opening, screen transitions) — verified by manual testing
- Haptic feedback and sound — platform-specific, verified manually
- Confetti animation rendering — visual, verified manually
- Keyboard focus auto-advance — React Native ref management, verified manually
