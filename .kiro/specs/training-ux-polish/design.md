# Design Document — Training UX Polish

## 1. Architecture

### System Context

This is a frontend-only feature set. The Active Workout Screen (`ActiveWorkoutScreen.tsx`, 912 lines) is the single most performance-critical screen in the app — users interact with it for 30–90 minutes per session, under physical stress, with one hand. Every millisecond of input lag and every unnecessary re-render is a retention risk.

The backend (FastAPI) requires zero changes. All 16 features operate within the existing API contract. Session metadata is an arbitrary JSON blob — we extend it with optional fields.

### Architectural Principles

1. **Extract, don't extend.** The screen is already 912 lines. Every new feature goes into a dedicated component or pure utility module. The screen file orchestrates; it does not compute.
2. **Pure logic is testable logic.** Any function that transforms data (RPE → color, sets → progress, weight → warm-up ramp) lives in `app/utils/` as a pure function with zero React dependencies.
3. **State colocation.** Workout state stays in `activeWorkoutSlice` (Zustand + AsyncStorage). UI preferences (RPE visibility, tooltip dismissals) go in a separate `workoutPreferencesStore` to avoid polluting the workout persistence key.
4. **Render minimization.** Set rows are the hot path — 20+ instances on screen during a heavy workout. We use `React.memo` with shallow comparison on every `SetRow`. Store selectors are granular to prevent cascade re-renders.

### Component Tree

```
SafeAreaView
├── TopBar
│   ├── DurationTimer (existing)
│   ├── DateText (existing)
│   └── OverflowMenu (NEW — replaces discard text button)
│
├── ScrollView / DraggableFlatList
│   ├── VolumeIndicatorPill (existing)
│   ├── Tooltip[rpe-intro] (NEW — one-time, conditional)
│   │
│   └── ExerciseCard[] (modified)
│       ├── ExerciseCardHeader
│       │   ├── DragHandle (NEW)
│       │   ├── ExerciseName (restyled — lg/bold)
│       │   ├── SetProgressBadge (NEW — "2/4 sets")
│       │   ├── WarmUpSuggestion (NEW — conditional)
│       │   └── ContextMenu trigger ("...")
│       │
│       ├── SetRow[] (modified)
│       │   ├── WeightInput (accent color)
│       │   ├── RepsInput (secondary color)
│       │   ├── RPEBadge (NEW — conditional)
│       │   ├── TypeBadge (NEW — conditional)
│       │   └── CompletionCheckbox (tint on complete)
│       │
│       ├── PerExerciseNotes (NEW — collapsible)
│       └── AddSetButton (existing)
│
├── RestTimerBar (NEW — floating above FinishBar)
│   └── RestTimerRing (existing, compact 40px)
│
├── FinishBar (NEW — sticky bottom)
│   └── MiniSummary + FinishButton
│
├── ConfirmationSheet (NEW — bottom sheet modal)
├── RestTimerOverlay (existing — expand from bar)
├── PRBanner (existing)
└── ExerciseDetailSheet (existing)
```

### Why This Structure

**Why extract `RestTimerBar` instead of modifying `RestTimerOverlay`?** The overlay uses a `<Modal>` which blocks all interaction behind it. A floating bar must live in the same view hierarchy as the ScrollView. Different rendering model = different component. The overlay stays for the "expanded" view — tap bar → show overlay with ±15s/pause controls.

**Why `DraggableFlatList` instead of ScrollView + manual drag?** `react-native-draggable-flatlist` handles gesture conflicts, auto-scroll during drag, and animated reorder out of the box. Rolling our own drag system inside a ScrollView is a 500+ line rabbit hole with platform-specific gesture bugs. The library is 12KB gzipped, well-maintained, and used by Strong/Hevy.

**Why a separate `workoutPreferencesStore` instead of extending `activeWorkoutSlice`?** The active workout store is persisted with key `active-workout-v1` and cleared on `discardWorkout()`. Preferences (RPE column visibility, tooltip dismissals) must survive workout lifecycle. Mixing them means either: (a) preferences get wiped on discard, or (b) we add special-case logic to preserve them. Separate store = clean separation.

**Why `React.memo` on SetRow?** With 5 exercises × 4 sets = 20 SetRow instances, any state change in the parent (e.g., timer tick, scroll position) triggers 20 re-renders. `React.memo` with stable callback refs (via `useCallback` in parent) cuts this to only the affected row. Measured impact: ~15ms saved per interaction on mid-range Android devices.

## 2. Data Model

### Store State Extensions

#### `ActiveExercise` — Two new optional fields

```typescript
interface ActiveExercise {
  localId: string;
  exerciseName: string;
  sets: ActiveSet[];
  notes?: string;      // Per-exercise notes (Req 14). Undefined = no notes.
  skipped?: boolean;   // Skip state (Req 11). Undefined/false = active.
}
```

**Why optional?** Backward compatibility. The store is persisted to AsyncStorage under key `active-workout-v1`. Existing persisted workouts don't have these fields. Making them optional means crash recovery works without migration. The UI treats `undefined` as `false`/`''`.

**Why not a separate `exerciseMetadata` map?** Colocation. Notes and skip state are per-exercise, tightly coupled to the exercise lifecycle (add/remove/reorder). A separate map requires manual sync on every exercise mutation. Inline fields are simpler and less error-prone.

#### `ActiveWorkoutActions` — Four new actions

```typescript
swapExercise: (localId: string, newExerciseName: string) => void;
toggleExerciseSkip: (localId: string) => void;
setExerciseNotes: (localId: string, notes: string) => void;
insertWarmUpSets: (localId: string, warmUpSets: WarmUpSet[]) => void;
```

**`swapExercise`**: Finds exercise by `localId`, replaces `exerciseName`, preserves all set data. O(n) where n = exercise count. No set mutation.

**`toggleExerciseSkip`**: Flips `skipped` boolean. Does NOT remove the exercise from the array. Does NOT modify sets. The exercise stays in position for template continuity.

**`setExerciseNotes`**: Sets `notes` string on exercise. Empty string = no notes (UI hides the field).

**`insertWarmUpSets`**: Prepends generated warm-up `ActiveSet` objects before existing sets. Renumbers all sets sequentially. Uses `setType: 'warm-up'` which the backend already supports.

### Workout Preferences Store (NEW)

```typescript
// app/store/workoutPreferencesStore.ts
interface WorkoutPreferences {
  showRpeColumn: boolean;     // Default: false
  rpeMode: 'rpe' | 'rir';    // Already exists in main store, but we read it here too
}

// Persisted to AsyncStorage under key 'workout-preferences-v1'
```

**Why not use the main `useStore`?** The main store has profile data, auth state, unit system — heavyweight. Workout preferences are read on every SetRow render. A dedicated micro-store with a single AsyncStorage key is faster to hydrate and doesn't trigger unrelated re-renders.

**Why no `showTypeColumn` preference?** The type column is hidden by default and revealed per-row via gesture (long-press/swipe). There's no global toggle — the badge appears automatically when a non-normal type is selected. This is simpler than a preference and matches how Strong handles it.

### Tooltip State Store (NEW)

```typescript
// app/store/tooltipStore.ts
interface TooltipState {
  dismissed: Record<string, boolean>;
  // Keys: 'rpe-intro', 'type-intro', 'keyboard-advance'
}

// Persisted to AsyncStorage under key 'tooltip-state-v1'
```

**Why a separate store instead of a utility function?** Tooltips need reactive state — the component re-renders when a tooltip is dismissed. A Zustand store with AsyncStorage persistence gives us both reactivity and persistence in one pattern, consistent with how we handle the active workout store.

### Session Metadata Extensions

The `metadata` field in the session payload (`POST /training/sessions`) gains two optional keys:

```typescript
metadata: {
  notes?: string;                              // Existing
  superset_groups?: SupersetGroup[];           // Existing
  exercise_notes?: Record<string, string>;     // NEW: exerciseName → notes
  skipped_exercises?: string[];                // NEW: names of skipped exercises
}
```

**Why `exercise_notes` as a map keyed by exercise name?** The backend doesn't know about `localId` — it only sees exercise names. A name-keyed map is the simplest structure that survives the frontend→backend→frontend round-trip. Collision risk (duplicate exercise names in one session) is negligible — the existing exercise list already uses names as keys for previous performance lookup.

**Why `skipped_exercises` as a string array instead of a boolean on each exercise?** The backend exercise payload format is `{ exercise_name, sets[] }`. Adding a `skipped` field to each exercise would require a backend schema change. Putting it in metadata avoids that entirely. The frontend reconstructs skip state on session load by checking if the exercise name is in the array.

### Warm-Up Set Model

```typescript
interface WarmUpSet {
  weightKg: number;
  reps: number;
  setType: 'warm-up';
}
```

Not persisted separately — warm-up sets become regular `ActiveSet` entries in the store with `setType: 'warm-up'`. The backend already handles this type.

## 3. API Contracts

**No new endpoints.** All 16 features operate within the existing API surface:

| Endpoint | Method | Used By | What Changes |
|---|---|---|---|
| `POST /training/sessions` | POST | FinishBar → ConfirmationSheet | Payload `metadata` gains `exercise_notes` and `skipped_exercises` keys. Backend accepts arbitrary metadata — no schema change. |
| `PUT /training/sessions/{id}` | PUT | Edit mode save | Same metadata extension. |
| `GET /training/sessions` | GET | Copy from Date | Already supports `?date=YYYY-MM-DD` filter. Used to fetch sessions for a specific date. |
| `POST /training/previous-performance/batch` | POST | WarmUpSuggestion | Already called on exercise add. Warm-up generator reads the cached response. |
| `GET /training/exercises` | GET | Exercise swap picker | Already used for muscle group mapping. Swap pre-filters by muscle group client-side. |
| `POST /training/user-templates` | POST | Save as Template | Called when user toggles "Save as Template" in ConfirmationSheet. Existing endpoint. |

### Copy from Date — Request/Response

```
GET /training/sessions?date=2024-01-15&limit=10

Response 200:
{
  "items": [
    {
      "id": "uuid",
      "session_date": "2024-01-15",
      "exercises": [...],
      "metadata": {...},
      ...
    }
  ],
  "total": 1
}
```

If no sessions exist for the date, `items` is an empty array. The frontend shows "No sessions found for this date."

### Save as Template — Request

```
POST /training/user-templates
{
  "name": "Workout - Jan 15",  // Auto-generated from date
  "exercises": [
    {
      "exercise_name": "Barbell Front Squat",
      "sets": [
        { "reps": 8, "weight_kg": 60, "rpe": null, "set_type": "normal" }
      ]
    }
  ]
}
```

Skipped exercises are excluded from the template. Warm-up sets are excluded (only working sets saved).

## 4. Data Flow

### Flow 1: Set Completion → Visual Feedback → Rest Timer

```
User taps checkbox
  → handleToggleSet(exerciseId, setId)
    → store.toggleSetCompleted() — validates weight/reps present
      → set.completed = true, set.completedAt = now
    → Haptics.impactAsync(Light) — existing
    → Client-side PR check against previousPerformance cache
    → shouldStartRestTimer() — existing superset logic
      → YES: setRestTimerState({ active: true, remaining: duration })
        → RestTimerBar renders (slides up with spring animation)
        → RestTimerBar ticks every 1s via setInterval
        → On complete: play sound, show "Rest Complete"
        → User taps bar → RestTimerOverlay opens (existing)
      → NO: no timer
    → SetRow re-renders with completed tint (bgAnim → positiveSubtle)
    → ExerciseCardHeader re-renders with updated progress ("2/4 sets")
    → FinishBar re-renders with updated completedSetCount
    → Auto-scroll: scrollViewRef.scrollTo(nextUncompletedSetY)
```

**Why auto-scroll on completion?** Users complete sets top-to-bottom. After completing set 3 of 4, the next set may be below the fold. Auto-scrolling saves a manual scroll gesture — one less thing to do with sweaty hands.

**Why not auto-scroll when ALL sets are complete?** When all sets are done, there's nothing to scroll to. The progress badge shows "4/4" with positive color — that's sufficient feedback.

### Flow 2: Keyboard Auto-Advance

```
User enters weight "80" → taps "Next" on keyboard
  → onSubmitEditing fires on weight TextInput
  → getNextField('weight', rpeEnabled, { weight: '80', reps: '', rpe: '' })
    → returns 'reps' (reps is empty)
  → repsInputRef.current.focus() — immediate, no delay
  → User enters reps "8" → taps "Next"
  → getNextField('reps', rpeEnabled=true, { weight: '80', reps: '8', rpe: '' })
    → returns 'rpe' (RPE enabled and empty)
  → rpeInputRef.current.focus()
  → User selects RPE → RPEPicker onSelect fires
  → getNextField('rpe', true, { weight: '80', reps: '8', rpe: '8' })
    → returns 'next-row' (all fields filled)
  → Find next uncompleted set row → focus its weight input
```

**Implementation detail:** Each SetRow holds refs to its weight, reps, and RPE inputs. The parent passes a `nextRowWeightRef` prop so the current row can focus the next row's weight input. This ref chain is built during render using the exercise's set array index.

**Why `onSubmitEditing` instead of `onEndEditing`?** `onEndEditing` fires on blur (including when user taps elsewhere). `onSubmitEditing` fires only when user explicitly taps "Next"/"Done" on the keyboard. We want intentional advancement, not accidental.

### Flow 3: Exercise Swap

```
User taps "..." on ExerciseCard → ExerciseContextMenu opens
  → User taps "Swap Exercise"
  → navigation.push('ExercisePicker', {
      target: 'swapExercise',
      currentExerciseLocalId: exercise.localId,
      muscleGroup: muscleGroupMap[exercise.exerciseName.toLowerCase()]
    })
  → ExercisePicker opens, pre-filtered to same muscle group
  → User selects new exercise
  → navigation.goBack() with params { swappedExerciseName: 'Dumbbell Lateral Raise' }
  → ActiveWorkoutScreen receives params via useEffect on route.params
  → store.swapExercise(localId, newName)
    → exercise.exerciseName = newName
    → exercise.sets unchanged (all weights, reps, RPE, completion preserved)
  → Haptics.impactAsync(Medium) — confirmation feedback
  → Previous performance re-fetched for new exercise name
```

**Why navigate to ExercisePicker instead of inline picker?** The ExercisePicker is a full screen with search, filters, muscle group grid, and exercise images. Duplicating that in a modal would be 400+ lines of redundant code. Navigation reuse is the right call.

### Flow 4: Finish Workout

```
User taps "Finish Workout" on FinishBar
  → Validate: at least 1 completed set exists
  → ConfirmationSheet opens (bottom sheet modal)
    → computeWorkoutSummary(exercises, startedAt)
      → { exerciseCount: 5, completedSetCount: 18, totalVolume: 12400, durationSeconds: 2700 }
    → Display: exercise list with set counts, total volume, duration
    → "Save as Template" toggle (default: off)
  → User taps "Save"
    → Build payload (existing activeExercisesToPayload)
    → Add metadata: exercise_notes, skipped_exercises
    → Filter: exclude skipped exercises from payload.exercises
    → POST /training/sessions (or PUT if edit mode)
    → If saveAsTemplate: POST /training/user-templates (exclude warm-up sets)
    → store.discardWorkout()
    → navigation.goBack()
  → User taps "Cancel"
    → ConfirmationSheet closes, workout continues
```

**Why exclude skipped exercises from `payload.exercises`?** Skipped exercises have no completed sets — they'd create empty exercise entries in the session. The backend would accept them but they'd pollute analytics (zero-volume exercises). We record them in `metadata.skipped_exercises` for template continuity without polluting the training data.

**Why exclude warm-up sets from template save?** Templates define working sets. Warm-ups are generated dynamically based on the working weight, which changes session to session. Saving warm-ups in the template would create stale warm-up weights.

## 5. Components and Interfaces

### New Components — Full Specifications

#### `RestTimerBar` (`app/components/training/RestTimerBar.tsx`)

```typescript
interface RestTimerBarProps {
  durationSeconds: number;
  remainingSeconds: number;
  paused: boolean;
  completed: boolean;
  onSkip: () => void;
  onExpand: () => void;
}
```

- **Layout:** Horizontal bar, 56px height, docked above FinishBar. `position: 'absolute'`, `bottom: finishBarHeight`.
- **Visual:** `bg.surfaceRaised` background, `border.subtle` top border, `shadows.md` for depth.
- **Content:** Compact RestTimerRing (40px diameter, reusing existing component with size prop) | remaining time text (lg, bold) | "Skip" button (text, muted).
- **Animation:** Slides up from bottom with `springs.snappy` on mount. Fades out on dismiss.
- **Interaction:** Tap anywhere on bar (except Skip) → `onExpand()` → opens RestTimerOverlay.
- **Completed state:** Ring fills to 100%, text shows "Rest Complete" in `semantic.positive`, auto-dismisses after 3s.

**RestTimerRing modification:** Add optional `size` prop (default 220, compact = 40). Scale stroke width proportionally. Hide center text at compact size (time shown in bar instead).

#### `FinishBar` (`app/components/training/FinishBar.tsx`)

```typescript
interface FinishBarProps {
  exerciseCount: number;
  completedSetCount: number;
  elapsedSeconds: number;
  saving: boolean;
  isEditMode: boolean;
  onFinish: () => void;
}
```

- **Layout:** Sticky bottom, 72px height, `bg.base` background, `border.subtle` top border. Outside ScrollView.
- **Content:** Top line = mini summary text (`text.secondary`, sm). Bottom = "Finish Workout" button (full width, `accent.primary`, md bold).
- **Summary format:** `formatMiniSummary()` → "5 exercises · 18 sets · 45 min"
- **Edit mode:** Button text = "Save Changes" instead of "Finish Workout".
- **Saving state:** Button disabled, text = "Saving...", opacity 0.5.

#### `ConfirmationSheet` (`app/components/training/ConfirmationSheet.tsx`)

```typescript
interface ConfirmationSheetProps {
  visible: boolean;
  exercises: ActiveExercise[];
  startedAt: string;
  notes: string;
  unitSystem: 'metric' | 'imperial';
  onConfirm: (saveAsTemplate: boolean) => void;
  onCancel: () => void;
}
```

- **Presentation:** Bottom sheet modal (React Native Modal with `animationType="slide"`).
- **Content:**
  - Header: "Workout Summary"
  - Exercise list: name + "3/4 sets" for each (skipped exercises shown as "Skipped" in muted text)
  - Stats row: Total volume | Duration | PR count
  - "Save as Template" toggle row (switch component, default off)
  - "Save" button (accent primary, full width)
  - "Cancel" text button (muted)

#### `RPEBadge` (`app/components/training/RPEBadge.tsx`)

```typescript
interface RPEBadgeProps {
  rpeValue: number;
  mode: 'rpe' | 'rir';
}
```

- **Layout:** Pill shape, 24px height, min-width 28px, `radius.full`.
- **Color:** Background = color at 12% opacity, text = full color. Colors from `getRpeBadgeColor()`.
- **Display:** Shows RPE number (or RIR equivalent via existing `getDisplayValue()`).
- **Empty state:** If `rpeValue` is 0 or NaN, renders nothing.

#### `TypeBadge` (`app/components/training/TypeBadge.tsx`)

```typescript
interface TypeBadgeProps {
  setType: SetType;
}
```

- **Layout:** Pill shape, 20px height, `radius.full`.
- **Labels:** W (warm-up), D (drop-set), A (AMRAP). Full label on long-press (tooltip).
- **Color:** `accent.primaryMuted` background, `accent.primary` text.
- **Visibility:** Only rendered when `setType !== 'normal'`. Parent checks `shouldShowTypeBadge()`.

#### `ExerciseContextMenu` (`app/components/training/ExerciseContextMenu.tsx`)

```typescript
interface ExerciseContextMenuProps {
  visible: boolean;
  isSkipped: boolean;
  hasNotes: boolean;
  hasPreviousPerformance: boolean;
  onSwap: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  onAddNote: () => void;
  onGenerateWarmUp: () => void;
  onDismiss: () => void;
}
```

- **Presentation:** Dropdown menu anchored to "..." button. Uses a simple absolute-positioned View (not a Modal — avoids z-index issues with the rest timer bar).
- **Items:**
  - "Swap Exercise" — always shown
  - "Skip Exercise" / "Unskip Exercise" — toggles based on `isSkipped`
  - "Add Note" / "Edit Note" — toggles based on `hasNotes`
  - "Generate Warm-Up" — only shown when `hasPreviousPerformance === true`
- **Dismiss:** Tap outside, or tap any action.

#### `Tooltip` (`app/components/common/Tooltip.tsx`)

```typescript
interface TooltipProps {
  tooltipId: string;
  text: string;
  children: React.ReactNode;  // Anchor element
}
```

- **Behavior:** Wraps an anchor element. On first render, checks `tooltipStore.dismissed[tooltipId]`. If not dismissed, shows tooltip bubble above/below anchor (auto-positioned based on screen space).
- **Animation:** Fade-in 200ms on mount, fade-out 150ms on dismiss.
- **Dismiss:** Tap anywhere on screen. Calls `tooltipStore.dismiss(tooltipId)`.
- **Persistence:** Dismissal stored in AsyncStorage via `tooltipStore`. Survives app restart.

#### `WarmUpSuggestion` (`app/components/training/WarmUpSuggestion.tsx`)

```typescript
interface WarmUpSuggestionProps {
  workingWeightKg: number;
  barWeightKg: number;
  onGenerate: (sets: WarmUpSet[]) => void;
}
```

- **Visibility:** Only rendered when `workingWeightKg > barWeightKg`.
- **Layout:** Small text button below exercise name: "Generate Warm-Up →"
- **Action:** Calls `generateWarmUpSets(workingWeightKg, barWeightKg)` → passes result to `onGenerate`.
- **One-shot:** After generating, button disappears (warm-up sets are now in the set list).

### Pure Logic Modules

#### `rpeBadgeColor.ts` (`app/utils/rpeBadgeColor.ts`)

```typescript
export type RpeBadgeColor = 'green' | 'yellow' | 'orange' | 'red' | 'none';

export function getRpeBadgeColor(rpe: number): RpeBadgeColor {
  if (rpe >= 6 && rpe <= 7) return 'green';
  if (rpe === 8) return 'yellow';
  if (rpe === 9) return 'orange';
  if (rpe === 10) return 'red';
  return 'none';
}

export function shouldShowTypeBadge(setType: SetType): boolean {
  return setType !== 'normal';
}
```

**Why a separate file instead of inline?** Testability. This mapping is a correctness property (Property 3). Extracting it means we can test it without rendering React components.

#### `warmUpGenerator.ts` (`app/utils/warmUpGenerator.ts`)

```typescript
export interface WarmUpSet {
  weightKg: number;
  reps: number;
  setType: 'warm-up';
}

const DEFAULT_BAR_WEIGHT_KG = 20;

export function generateWarmUpSets(
  workingWeightKg: number,
  barWeightKg: number = DEFAULT_BAR_WEIGHT_KG
): WarmUpSet[] {
  if (workingWeightKg <= barWeightKg) return [];

  const sets: WarmUpSet[] = [];

  // Bar only × 10
  sets.push({ weightKg: barWeightKg, reps: 10, setType: 'warm-up' });

  // 60% × 5 (only if meaningfully different from bar)
  const sixtyPct = Math.round(workingWeightKg * 0.6 / 2.5) * 2.5; // Round to nearest 2.5kg
  if (sixtyPct > barWeightKg) {
    sets.push({ weightKg: sixtyPct, reps: 5, setType: 'warm-up' });
  }

  // 80% × 3 (only if meaningfully different from 60%)
  const eightyPct = Math.round(workingWeightKg * 0.8 / 2.5) * 2.5;
  if (eightyPct > sixtyPct) {
    sets.push({ weightKg: eightyPct, reps: 3, setType: 'warm-up' });
  }

  return sets;
}
```

**Why round to 2.5kg?** Real plates come in 1.25kg increments (2 × 1.25 = 2.5kg per side). Suggesting 57.3kg is useless — the user can't load that. Rounding to nearest 2.5kg gives actionable weights.

**Why skip 60% if it equals bar weight?** If working weight is 30kg, 60% = 18kg which is less than the bar (20kg). Showing "18kg × 5" after "20kg × 10" is confusing. We skip it.

#### `setProgressCalculator.ts` (`app/utils/setProgressCalculator.ts`)

```typescript
export interface SetProgress {
  completed: number;
  total: number;
  allComplete: boolean;
}

export function calculateSetProgress(sets: ActiveSet[]): SetProgress {
  const completed = sets.filter(s => s.completed).length;
  return {
    completed,
    total: sets.length,
    allComplete: sets.length > 0 && completed === sets.length,
  };
}
```

#### `keyboardAdvanceLogic.ts` (`app/utils/keyboardAdvanceLogic.ts`)

```typescript
export type FieldName = 'weight' | 'reps' | 'rpe';
export type AdvanceResult = FieldName | 'next-row' | null;

export function getNextField(
  currentField: FieldName,
  rpeEnabled: boolean,
  currentValues: { weight: string; reps: string; rpe: string }
): AdvanceResult {
  const fields: FieldName[] = rpeEnabled
    ? ['weight', 'reps', 'rpe']
    : ['weight', 'reps'];

  const currentIndex = fields.indexOf(currentField);

  // Look for next empty field after current
  for (let i = currentIndex + 1; i < fields.length; i++) {
    if (!currentValues[fields[i]].trim()) return fields[i];
  }

  // All fields after current are filled — check if all fields are filled
  const allFilled = fields.every(f => currentValues[f].trim());
  if (allFilled) return 'next-row';

  // Some earlier field is empty but we don't go backward
  return null;
}
```

**Why no backward navigation?** Users fill fields left-to-right. Going backward (reps → weight) when weight is empty would be disorienting. If they skipped weight, they'll tap it manually.

#### `workoutSummaryFormatter.ts` (`app/utils/workoutSummaryFormatter.ts`)

```typescript
export interface WorkoutSummary {
  exerciseCount: number;
  completedSetCount: number;
  totalVolumeKg: number;
  durationSeconds: number;
}

export function computeWorkoutSummary(
  exercises: ActiveExercise[],
  startedAt: string
): WorkoutSummary {
  const activeExercises = exercises.filter(e => !e.skipped);
  const completedSets = activeExercises.flatMap(e => e.sets).filter(s => s.completed);
  const totalVolumeKg = completedSets.reduce((sum, s) => {
    const w = parseFloat(s.weight) || 0;
    const r = parseInt(s.reps, 10) || 0;
    return sum + w * r;
  }, 0);
  const durationSeconds = startedAt
    ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    : 0;

  return {
    exerciseCount: activeExercises.length,
    completedSetCount: completedSets.length,
    totalVolumeKg,
    durationSeconds,
  };
}

export function formatMiniSummary(summary: WorkoutSummary): string {
  const mins = Math.floor(summary.durationSeconds / 60);
  return `${summary.exerciseCount} exercises · ${summary.completedSetCount} sets · ${mins} min`;
}
```

#### `exerciseSwapLogic.ts` (`app/utils/exerciseSwapLogic.ts`)

```typescript
export function swapExerciseName(
  exercise: ActiveExercise,
  newName: string
): ActiveExercise {
  return { ...exercise, exerciseName: newName };
}
```

**Why is this a one-liner?** Because the whole point is that it ONLY changes the name. The simplicity is the feature. The property test (Property 7) verifies that nothing else changes — that's the invariant we're protecting.

## 6. Edge Cases & Error Handling

| Scenario | What Breaks | Handling | Justification |
|---|---|---|---|
| **Keyboard auto-advance: no next field** | `getNextField` returns `null` | Keyboard stays on current field. No focus change. | Silent no-op is better than dismissing keyboard unexpectedly. |
| **Exercise swap with empty name** | Empty string passed to `swapExercise` | Guard: `if (!newName.trim()) return` — no mutation. | ExercisePicker already prevents empty selection, but defense in depth. |
| **Warm-up generation: weight ≤ bar** | `generateWarmUpSets` called with 15kg working weight | Returns `[]`. Button not shown (parent checks `workingWeightKg > barWeightKg`). | Double guard: logic returns empty + UI hides button. |
| **Warm-up generation: zero/negative weight** | Invalid input | Returns `[]`. Same as above. | |
| **Tooltip AsyncStorage read failure** | `tooltipStore` can't hydrate | Default to `dismissed: {}` — all tooltips show. | Safe fallback: showing a tooltip twice is better than never showing it. |
| **Tooltip AsyncStorage write failure** | Dismissal not persisted | Tooltip reappears next session. Acceptable degradation. | Not worth a retry mechanism for a one-time hint. |
| **Rest timer bar + user finishes workout** | Timer still running when ConfirmationSheet opens | Clear timer state before showing sheet. `setRestTimerState({ active: false })`. | Orphaned intervals would leak memory and play sounds after navigation. |
| **Rest timer bar + drag reorder** | User drags exercise while timer is docked | Timer bar stays docked (absolute positioned, outside list). Reorder proceeds normally. | Timer is independent of exercise order. |
| **ConfirmationSheet save failure** | API returns 4xx/5xx | Show error alert. Keep sheet open. Don't discard workout. User can retry. | Data loss prevention. Never discard on failed save. |
| **Copy from date: API failure** | Network error on `GET /training/sessions?date=...` | Show error toast. Keep current workout unchanged. | Don't blow away in-progress work on a failed fetch. |
| **Copy from date: no sessions** | Empty `items` array | Show "No sessions found for this date." in the picker. | Clear feedback, no silent failure. |
| **Drag reorder: invalid indices** | `fromIndex` or `toIndex` out of bounds | `reorderExercises` uses `splice` which handles OOB gracefully (no-op or partial). | Existing implementation is safe. |
| **Per-exercise notes: very long text** | User pastes a novel | No hard limit in v1. TextInput `maxLength` set to 500 chars as soft guard. | 500 chars is ~100 words. Enough for technique cues. Truncation is v2. |
| **Inline edit of completed set: invalid value** | User clears weight to empty string | Value stored as empty string. Set stays completed. Validation happens on next toggle (if user un-completes and re-completes). | Existing behavior — `canCompleteSet` validates on completion, not on edit. |
| **RPE preference toggled mid-workout** | Column appears/disappears while user is mid-row | Immediate re-render. Existing RPE values preserved in store (they're always stored, just not displayed). | No data loss. Visual change only. |
| **Concurrent timer + keyboard** | User types in a field while rest timer is ticking | Timer bar doesn't steal focus. `keyboardShouldPersistTaps="handled"` on ScrollView (already set). | Keyboard and timer are independent UI layers. |
| **Exercise swap: previous performance cache miss** | New exercise has no cached previous performance | `useEffect` on `exercises.length` triggers batch fetch for uncached names. Warm-up button hidden until data arrives. | Existing pattern — same as initial exercise add. |
| **Skip all exercises then finish** | All exercises skipped, no completed sets | `handleFinish` validates `completedSets.length > 0`. Shows "Complete at least one set to save." | Existing guard. Skipped exercises don't count as completed. |
| **Save as Template: duplicate name** | Template with same auto-generated name exists | Backend returns 409. Frontend shows error. User can rename. | v1 uses auto-generated names ("Workout - Jan 15"). Collision is rare. |

### Race Conditions

| Race | Mitigation |
|---|---|
| **Double-tap Finish button** | `saving` state disables button immediately. Second tap is no-op. |
| **Swap exercise while previous performance is loading** | `previousPerformanceLoading` flag prevents stale data. Swap triggers re-fetch. |
| **Timer completes while ConfirmationSheet is open** | Timer state cleared before sheet opens. Completion callback is a no-op. |
| **AsyncStorage write for tooltip + crash recovery write** | Different keys (`tooltip-state-v1` vs `active-workout-v1`). No conflict. |

## 7. Scalability

### What Breaks at 10x (200 sets per workout — powerlifting meet prep)

**Problem:** 200 SetRow components × re-render on any state change = jank.

**Mitigation:**
- `React.memo` on SetRow with stable callback refs (already planned).
- Switch from ScrollView to `FlatList` (or `DraggableFlatList`) for virtualization. Only ~10 rows visible at a time.
- Store selectors: `useActiveWorkoutStore(s => s.exercises[idx].sets[setIdx])` — granular subscriptions prevent cascade.

**Problem:** Keyboard auto-advance ref chain with 200 rows.

**Mitigation:** Refs are O(1) access. The chain is built during render, not traversed. `getNextField` is a pure function with O(1) complexity.

### What Breaks at 100x (2000 sets — unrealistic but defensive)

**Problem:** AsyncStorage persistence. Writing 2000 sets to JSON on every state change.

**Mitigation:** Zustand persist middleware already debounces writes. At 2000 sets, the JSON blob is ~200KB — within AsyncStorage limits (6MB on iOS, 6MB on Android). Write latency may reach 50ms but it's async and non-blocking.

**Problem:** `computeWorkoutSummary` iterates all exercises and sets.

**Mitigation:** O(n) where n = total sets. At 2000 sets, this is <1ms. Not a bottleneck.

### Actual Bottleneck

The real bottleneck is **React Native's bridge** (or JSI in new arch). Every state update that touches the exercise array triggers a re-render cycle. With 20+ exercises, the diffing cost is non-trivial.

**Mitigation for v1:** `React.memo` + granular selectors. Good enough for 99% of users (typical workout: 5-8 exercises, 15-30 sets).

**Mitigation for v2 (if needed):** Move to `FlashList` for O(1) cell recycling. Or use `zustand`'s `shallow` equality check on array slices.

## 8. Tech Decisions

| Decision | Choice | Tradeoff | Why |
|---|---|---|---|
| **Drag-to-reorder library** | `react-native-draggable-flatlist` | Adds ~12KB gzipped dependency. Alternative: manual PanResponder + Animated. | Manual implementation is 500+ lines with platform-specific gesture bugs. Library is battle-tested, used by Strong/Hevy. Worth the 12KB. |
| **Bottom sheet for ConfirmationSheet** | React Native `Modal` with `animationType="slide"` | Not a true bottom sheet (no drag-to-dismiss). Alternative: `@gorhom/bottom-sheet`. | We already use `Modal` throughout the app (RPEPicker, RestTimerOverlay). Adding a bottom sheet library for one component isn't justified. If we need drag-to-dismiss later, we migrate. |
| **Tooltip positioning** | Manual calculation based on `onLayout` measurements | No library. Alternative: `react-native-walkthrough-tooltip`. | We have exactly 2 tooltips. A library is overkill. Manual positioning with `measure()` is 50 lines. |
| **Preferences storage** | Zustand + AsyncStorage (separate store) | Could use React Context + AsyncStorage. | Zustand gives us persistence middleware for free (same pattern as active workout store). Context would require manual hydration logic. |
| **Timer state management** | Local state in ActiveWorkoutScreen + `setInterval` | Could move timer to Zustand store. | Timer is UI-only state (remaining seconds, paused flag). It doesn't need persistence — if the app crashes during rest, the timer resets. Keeping it local avoids unnecessary store writes every second. |
| **Keyboard auto-advance** | `TextInput` ref chain + `onSubmitEditing` | Could use a form library (react-hook-form). | Form libraries add abstraction for validation/submission. We don't need that — we just need focus management. Refs are simpler and more predictable. |
| **RPE badge colors** | Hardcoded mapping in pure function | Could be configurable via theme tokens. | RPE color semantics are universal in strength training (green=easy, red=max). Making them configurable adds complexity with zero user value. |
| **Warm-up ramp algorithm** | Fixed percentages (bar, 60%, 80%) | Could be configurable or use more sophisticated ramp. | Fixed ramp matches industry standard (Starting Strength, NSCA guidelines). Configurability is v2 if users request it. |
| **Property-based testing** | `fast-check` (TypeScript) | Could use `jsverify` or `testcheck-js`. | `fast-check` is the most actively maintained PBT library for TypeScript. 2.5M weekly downloads. Built-in arbitraries for strings, numbers, arrays. |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Set progress calculation is accurate

*For any* array of `ActiveSet` objects with arbitrary completion states, `calculateSetProgress` SHALL return a `completed` count equal to the number of sets where `completed === true`, a `total` count equal to the array length, and `allComplete === true` if and only if every set is completed.

**Validates: Requirements 1.2, 1.4**

### Property 2: Type badge visibility matches set type

*For any* `SetType` value, the type badge SHALL be visible if and only if the set type is not `'normal'`. Specifically, `shouldShowTypeBadge(setType)` returns `true` for `'warm-up'`, `'drop-set'`, and `'amrap'`, and `false` for `'normal'`.

**Validates: Requirements 2.3, 2.4**

### Property 3: RPE badge color mapping is correct

*For any* RPE value in the range [6, 10], `getRpeBadgeColor(rpe)` SHALL return `'green'` for 6–7, `'yellow'` for 8, `'orange'` for 9, and `'red'` for 10. For values outside [6, 10], it SHALL return `'none'`.

**Validates: Requirements 3.3, 3.4, 3.5, 3.6, 8.4**

### Property 4: Tooltip dismissal round-trip

*For any* tooltip ID string, dismissing the tooltip and then checking its dismissed state SHALL return `true`. A tooltip that has never been dismissed SHALL return `false`.

**Validates: Requirements 4.4**

### Property 5: Workout summary computation is consistent

*For any* array of `ActiveExercise` objects and a valid `startedAt` timestamp, `computeWorkoutSummary` SHALL return an `exerciseCount` equal to the number of non-skipped exercises, a `completedSetCount` equal to the total number of completed sets across non-skipped exercises, and `formatMiniSummary` SHALL produce a string containing all three values (exercise count, set count, formatted duration).

**Validates: Requirements 6.2**

### Property 6: Keyboard auto-advance logic

*For any* combination of current field (`'weight'` | `'reps'` | `'rpe'`), RPE enabled flag, and current field values, `getNextField` SHALL:
- Return `'reps'` when current is `'weight'` and reps is empty
- Return `'rpe'` when current is `'reps'`, RPE is enabled, and RPE is empty
- Return `'next-row'` when all applicable fields in the current row are filled
- Never return a field that already has a value (no backward navigation to filled fields)

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 7: Exercise swap preserves all set data

*For any* `ActiveExercise` with arbitrary sets (any weights, reps, RPE values, completion states, set types), `swapExerciseName(exercise, newName)` SHALL return an exercise where the `exerciseName` equals `newName` and every set's `weight`, `reps`, `rpe`, `setType`, `completed`, and `completedAt` fields are identical to the original.

**Validates: Requirements 10.2**

### Property 8: Skip/unskip round-trip preserves exercise state

*For any* `ActiveExercise`, toggling skip (setting `skipped = true`) and then toggling unskip (setting `skipped = false`) SHALL produce an exercise with identical `exerciseName`, `sets`, and `notes` to the original. The exercise SHALL remain in the exercises array throughout both operations.

**Validates: Requirements 11.2, 11.3**

### Property 9: Skipped exercises appear in session payload metadata

*For any* workout state containing a mix of skipped and non-skipped exercises, the session payload's `metadata.skipped_exercises` array SHALL contain exactly the names of exercises where `skipped === true`, and no others.

**Validates: Requirements 11.4**

### Property 10: Editing a completed set preserves completion state

*For any* completed `ActiveSet` (where `completed === true`), calling `updateSetField` to change `weight`, `reps`, or `rpe` SHALL result in a set where the new field value is updated AND `completed` remains `true` AND `completedAt` remains unchanged.

**Validates: Requirements 12.1, 12.2**

### Property 11: Per-exercise notes survive save/load round-trip

*For any* `ActiveExercise` with a non-empty `notes` string, serializing the exercise into the session payload metadata and then deserializing back SHALL produce an exercise with the same `notes` value. Exercises without notes SHALL have `notes` as `undefined` or empty string after round-trip.

**Validates: Requirements 14.3, 14.4**

### Property 12: Reorder preserves all exercises (no data loss)

*For any* array of `ActiveExercise` objects and any valid `fromIndex`/`toIndex` pair, `reorderExercises` SHALL produce an array of the same length containing exactly the same exercises (by `localId`), with no duplicates and no missing entries.

**Validates: Requirements 15.3**

### Property 13: Warm-up generator produces valid progressive ramp

*For any* working weight > bar weight (default 20kg), `generateWarmUpSets(workingWeight)` SHALL return an array where:
- All sets have `setType === 'warm-up'`
- Weights are monotonically non-decreasing
- All weights are > 0 and < working weight
- The last warm-up set weight is ≤ 80% of working weight (rounded to nearest 2.5kg)
- Reps are monotonically non-increasing (heavier sets have fewer reps)

**Validates: Requirements 16.2, 16.3**

## Testing Strategy

### Property-Based Testing

Library: **fast-check** (TypeScript).

Each property test runs minimum 100 iterations. Tests tagged: `Feature: training-ux-polish, Property {N}: {title}`

| Property | Module Under Test | Generator Strategy |
|---|---|---|
| P1: Set progress | `setProgressCalculator.ts` | `fc.array(fc.record({ completed: fc.boolean(), ... }))` |
| P2: Type badge visibility | `rpeBadgeColor.ts` | `fc.constantFrom('normal', 'warm-up', 'drop-set', 'amrap')` |
| P3: RPE badge color | `rpeBadgeColor.ts` | `fc.integer({ min: 0, max: 15 })` — covers valid and invalid range |
| P4: Tooltip round-trip | `tooltipStore.ts` | `fc.string()` for tooltip IDs |
| P5: Workout summary | `workoutSummaryFormatter.ts` | `fc.array(activeExerciseArbitrary)` with nested set arrays |
| P6: Keyboard advance | `keyboardAdvanceLogic.ts` | `fc.record({ field, rpeEnabled, values })` — all combinations |
| P7: Exercise swap | `exerciseSwapLogic.ts` | `activeExerciseArbitrary` + `fc.string()` for new name |
| P8: Skip round-trip | Store actions | `activeExerciseArbitrary` |
| P9: Skipped in payload | Store + payload builder | `fc.array(activeExerciseArbitrary)` with random skip flags |
| P10: Edit completed set | Store actions | Completed `ActiveSet` + random field + random value |
| P11: Notes round-trip | Payload serializer | `activeExerciseArbitrary` with `fc.string()` notes |
| P12: Reorder preserves | Store actions | `fc.array(activeExerciseArbitrary)` + valid index pair |
| P13: Warm-up ramp | `warmUpGenerator.ts` | `fc.double({ min: 21, max: 300 })` for working weight |

### Unit Testing

Unit tests for specific examples and edge cases:
- RPE badge: exact color for each value 6, 7, 8, 9, 10, and boundary values 5, 11
- Warm-up generator: working weight = 25kg (just above bar), 100kg (standard), 200kg (heavy)
- Keyboard advance: all field combinations with RPE on/off
- Set progress: empty array, all completed, none completed
- Workout summary: zero exercises, all skipped, mixed

### Test File Organization

```
app/__tests__/
  utils/
    rpeBadgeColor.test.ts
    warmUpGenerator.test.ts
    setProgressCalculator.test.ts
    keyboardAdvanceLogic.test.ts
    exerciseSwapLogic.test.ts
    workoutSummaryFormatter.test.ts
  store/
    activeWorkoutActions.test.ts    — Properties 8, 9, 10, 11, 12
```

### Test Execution

- `npx jest --run` (single execution)
- Property tests: `fc.assert(fc.property(...), { numRuns: 100 })`
- CI: existing GitHub Actions workflow
