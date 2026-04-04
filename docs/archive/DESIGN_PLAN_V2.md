# Repwise — Post-Overhaul Design Plan (Approved Changes)

**Created:** 2026-03-20
**Status:** PLAN ONLY — Do not implement until reviewed
**Scope:** 8 approved items from independent analysis cross-reference

---

## Overview

8 approved changes ordered by dependency and severity:

- **Phase 0 — Quick Wins** (30 min each, zero risk): Sentry wiring, alert rules
- **Phase 1 — Infrastructure** (2-6 hours): APScheduler, native stack migration, dynamic text scaling
- **Phase 2 — Core Features** (3-5 days each): Simple Mode for WNS, Strong/Hevy CSV import
- **Phase 3 — Polish** (1-2 days): Optimistic updates

---

## Phase 0 — Quick Wins (1 hour total)

### P0-1: ErrorBoundary → Sentry Wiring

**Severity:** HIGH — crashes go unreported
**Effort:** 30 minutes
**Risk:** LOW — additive change

#### Root Cause
`app/components/common/ErrorBoundary.tsx` has `componentDidCatch` that only calls `console.error`. Sentry is initialized in App.tsx but ErrorBoundary doesn't report to it.

#### Fix
- File: `app/components/common/ErrorBoundary.tsx`
- In `componentDidCatch(error, errorInfo)`:
  ```typescript
  import * as Sentry from '@sentry/react-native';
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } },
    });
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }
  ```
- Keep existing `console.error` and `onError` callback

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/components/common/ErrorBoundary.tsx` | MODIFY — add Sentry.captureException | LOW |

#### Testing
- Manual: Throw an error in a child component → verify it appears in Sentry dashboard
- Regression: Existing ErrorBoundary behavior (fallback UI, retry) unchanged

---

### P0-2: Sentry Alert Rules

**Severity:** HIGH — zero production visibility
**Effort:** 30 minutes
**Risk:** NONE — Sentry dashboard config only

#### Fix
Configure these 5 alert rules in Sentry dashboard (https://sentry.io):

1. **Webhook Failure Spike**: Alert when `webhook` tagged errors > 5 in 5 minutes
2. **500 Error Spike**: Alert when HTTP 500 events > 10 in 10 minutes
3. **Slow Response P95**: Alert when transaction p95 > 3 seconds for 5 minutes
4. **Redis Connection Error**: Alert when `redis` tagged errors > 0 in 1 minute
5. **Background Job Failure**: Alert when `job` tagged errors > 0 in 1 hour

#### Implementation
No code changes. Configure in Sentry dashboard → Alerts → Create Alert Rule.

For the alerts to work, add Sentry tags to key code paths:

- File: `src/modules/payments/router.py` — add `sentry_sdk.set_tag("component", "webhook")` in webhook handler
- File: `src/config/redis.py` — add `sentry_sdk.set_tag("component", "redis")` in connection error handler
- File: `src/jobs/*.py` — add `sentry_sdk.set_tag("component", "job")` in each job's main function

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/modules/payments/router.py` | MODIFY — add Sentry tag | LOW |
| `src/config/redis.py` | MODIFY — add Sentry tag | LOW |
| `src/jobs/permanent_deletion.py` | MODIFY — add Sentry tag | LOW |
| `src/jobs/cleanup_blacklist.py` | MODIFY — add Sentry tag | LOW |
| `src/jobs/trial_expiration.py` | MODIFY — add Sentry tag | LOW |
| `src/jobs/refresh_leaderboards.py` | MODIFY — add Sentry tag | LOW |
| `src/jobs/export_worker.py` | MODIFY — add Sentry tag | LOW |
| `src/jobs/cleanup_exports.py` | MODIFY — add Sentry tag | LOW |
| `src/jobs/workout_reminders.py` | MODIFY — add Sentry tag | LOW |

#### Testing
- Manual: Trigger a test error → verify Sentry alert fires
- No automated tests needed

---

## Phase 1 — Infrastructure (1-2 days total)

### P1-1: APScheduler for Background Jobs

**Severity:** HIGH — jobs currently have no scheduler
**Effort:** 2-4 hours
**Risk:** MEDIUM — touches app startup lifecycle

#### Root Cause
7 background jobs exist as standalone scripts but no scheduler runs them. They require external cron (Railway services at $5-10/mo extra) or manual execution.

#### Fix Approach: APScheduler In-Process

Run APScheduler inside the FastAPI process. Jobs execute in the same process as the web server, using Gunicorn's worker lifecycle.

#### Implementation Steps

**Step 1: Add dependency**
- File: `pyproject.toml` — add `"apscheduler>=3.10.0"`

**Step 2: Create scheduler module**
- File to create: `src/config/scheduler.py`
  ```python
  """In-process job scheduler using APScheduler.
  
  Runs background jobs alongside the FastAPI server.
  Only starts in the first Gunicorn worker (via worker_id check)
  to prevent duplicate job execution across workers.
  """
  from apscheduler.schedulers.asyncio import AsyncIOScheduler
  from apscheduler.triggers.cron import CronTrigger
  from apscheduler.triggers.interval import IntervalTrigger
  
  scheduler = AsyncIOScheduler()
  
  def configure_scheduler():
      """Register all background jobs."""
      # Import job functions
      from src.jobs.permanent_deletion import run_permanent_deletion
      from src.jobs.cleanup_blacklist import run_cleanup_blacklist
      from src.jobs.trial_expiration import run_trial_expiration
      from src.jobs.export_worker import run_export_worker
      from src.jobs.cleanup_exports import run_cleanup_exports
      from src.jobs.refresh_leaderboards import run_refresh_leaderboards
      from src.jobs.workout_reminders import run_workout_reminders
      
      scheduler.add_job(run_permanent_deletion, CronTrigger(hour=3), id="permanent_deletion")
      scheduler.add_job(run_cleanup_blacklist, CronTrigger(hour=4), id="cleanup_blacklist")
      scheduler.add_job(run_trial_expiration, CronTrigger(minute=0), id="trial_expiration")  # hourly
      scheduler.add_job(run_export_worker, IntervalTrigger(minutes=5), id="export_worker")
      scheduler.add_job(run_cleanup_exports, CronTrigger(hour=5), id="cleanup_exports")
      scheduler.add_job(run_refresh_leaderboards, IntervalTrigger(minutes=15), id="refresh_leaderboards")
      scheduler.add_job(run_workout_reminders, IntervalTrigger(hours=2), id="workout_reminders")
  ```

**Step 3: Wire into FastAPI lifespan**
- File: `src/main.py`
- In the `lifespan` async context manager:
  ```python
  # Only start scheduler in first worker to prevent duplicate execution
  import os
  worker_id = os.environ.get("GUNICORN_WORKER_ID", "0")
  if worker_id == "0":
      from src.config.scheduler import scheduler, configure_scheduler
      configure_scheduler()
      scheduler.start()
  ```
- In the shutdown phase: `scheduler.shutdown(wait=False)`

**Step 4: Ensure jobs are async-compatible**
- Each job file currently has `async def run_*()` with `asyncio.run()` in `__main__`
- APScheduler's `AsyncIOScheduler` can call async functions directly
- Refactor each job to export the async function WITHOUT `asyncio.run()` wrapper
- Keep `if __name__ == "__main__": asyncio.run(run_*())` for standalone execution

**Step 5: Worker ID detection for Gunicorn**
- Gunicorn doesn't set `GUNICORN_WORKER_ID` by default
- Create `src/config/gunicorn_conf.py`:
  ```python
  def post_worker_init(worker):
      import os
      os.environ["GUNICORN_WORKER_ID"] = str(worker.age)
  ```
- Update Dockerfile CMD to use: `--config src/config/gunicorn_conf.py`

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `pyproject.toml` | MODIFY — add apscheduler | LOW |
| `src/config/scheduler.py` | CREATE | LOW |
| `src/config/gunicorn_conf.py` | CREATE | LOW |
| `src/main.py` | MODIFY — wire scheduler into lifespan | MEDIUM |
| `Dockerfile` | MODIFY — add --config flag | LOW |
| `src/jobs/*.py` (7 files) | MODIFY — export async function | LOW |

#### Testing
- Manual: Start server → check logs for "Scheduler started" → wait for job trigger → verify job runs
- Verify: Only 1 worker runs the scheduler (check logs for worker ID)
- Regression: All API endpoints still work (scheduler doesn't block the event loop)

#### Ripple Effects
- Railway cron jobs become unnecessary (save $5-10/mo)
- Jobs still runnable standalone via `python -m src.jobs.X` for debugging

---

### P1-2: Native Stack Navigation Migration

**Severity:** MEDIUM — performance improvement
**Effort:** 1 day
**Risk:** MEDIUM — touches navigation, could cause visual regressions

#### Root Cause
Both `App.tsx` and `BottomTabNavigator.tsx` use `createStackNavigator` from `@react-navigation/stack` (JS-based animations). `@react-navigation/native-stack` uses native platform animations (UINavigationController on iOS, Fragment on Android) — faster transitions, lower memory.

#### Implementation Steps

**Step 1: Update App.tsx**
- Replace `import { createStackNavigator } from '@react-navigation/stack'` with `import { createNativeStackNavigator } from '@react-navigation/native-stack'`
- Replace `createStackNavigator()` with `createNativeStackNavigator()`
- Update screen options: `cardStyle` → `contentStyle`, `headerShown` stays the same
- Remove `cardStyleInterpolator` custom animations (native stack uses platform defaults)

**Step 2: Update BottomTabNavigator.tsx**
- Same import swap
- Same options migration
- Custom `slideFromRight` interpolator must be removed (native stack doesn't support JS-based card interpolators)
- Native stack provides platform-native slide transitions by default — this is actually better

**Step 3: Remove @react-navigation/stack dependency**
- File: `app/package.json` — remove `@react-navigation/stack`
- Run `npm install --legacy-peer-deps`

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/App.tsx` | MODIFY — swap stack navigator | MEDIUM |
| `app/navigation/BottomTabNavigator.tsx` | MODIFY — swap stack navigator | MEDIUM |
| `app/package.json` | MODIFY — remove @react-navigation/stack | LOW |

#### Testing
- Manual: Navigate through every screen → verify transitions work
- Manual: Test Android back button → verify still works
- Manual: Test iOS swipe-to-go-back → verify still works
- Manual: Test deep linking (if configured)
- Regression: Active workout back button protection still works

#### Gotchas
- `native-stack` doesn't support `transparentCard` or custom card interpolators
- Modal presentation is different: use `presentation: 'modal'` screen option
- `headerMode: 'screen'` doesn't exist in native-stack — headers are always per-screen

---

### P1-3: Dynamic Text Scaling

**Severity:** HIGH — App Store accessibility compliance
**Effort:** 1-2 days
**Risk:** LOW — additive, no behavior change

#### Root Cause
Zero `maxFontSizeMultiplier` or `allowFontScaling` usage in the codebase. When users enable large text in iOS/Android accessibility settings, text can overflow containers, break layouts, or become unreadable.

#### Fix Approach
Add `maxFontSizeMultiplier` to all Text components to cap scaling at 1.3x (130%). This allows accessibility scaling while preventing layout breakage.

#### Implementation Steps

**Step 1: Create a scaled Text component**
- File to create: `app/components/common/ScaledText.tsx`
  ```typescript
  import { Text, TextProps } from 'react-native';
  
  const DEFAULT_MAX_SCALE = 1.3;
  
  export function ScaledText({ maxFontSizeMultiplier = DEFAULT_MAX_SCALE, ...props }: TextProps) {
    return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />;
  }
  ```

**Step 2: Add maxFontSizeMultiplier to critical screens**
Rather than replacing every `<Text>` in the app (risky, 500+ occurrences), add `maxFontSizeMultiplier={1.3}` to Text components in these critical screens where layout breakage is most likely:
- `ActiveWorkoutScreen.tsx` — set rows, weight/reps inputs
- `DashboardScreen.tsx` — macro rings, stat cards
- `AddNutritionModal.tsx` — food search results, macro display
- `ExercisePickerScreen.tsx` — exercise list items
- `OnboardingWizard.tsx` — step content

**Step 3: Add to TextInput components**
- `TextInput` also supports `maxFontSizeMultiplier`
- Add to all TextInput components in workout logging (weight, reps, RPE inputs)

**Step 4: Test with large text**
- iOS: Settings → Accessibility → Display & Text Size → Larger Text → max slider
- Android: Settings → Accessibility → Font size → max
- Verify no text overflow or layout breakage on critical screens

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/components/common/ScaledText.tsx` | CREATE | LOW |
| `ActiveWorkoutScreen.tsx` | MODIFY — add maxFontSizeMultiplier | LOW |
| `DashboardScreen.tsx` | MODIFY — add maxFontSizeMultiplier | LOW |
| `AddNutritionModal.tsx` | MODIFY — add maxFontSizeMultiplier | LOW |
| `ExercisePickerScreen.tsx` | MODIFY — add maxFontSizeMultiplier | LOW |
| `OnboardingWizard.tsx` | MODIFY — add maxFontSizeMultiplier | LOW |

#### Testing
- Manual: Enable max text size on iOS/Android → navigate all critical screens
- Verify: No text overflow, no layout breakage, text is readable
- Regression: Normal text size still looks correct

---

## Phase 2 — Core Features (1-2 weeks total)

### P2-1: Simple Mode for WNS

**Severity:** HIGH — broadens appeal from niche to mainstream
**Effort:** 3-5 days
**Risk:** MEDIUM — touches core training UX

#### Root Cause
"Hypertrophy Units" means nothing to 95% of gym-goers. The WNS model is the app's differentiator but it's presented in a way only evidence-based lifters understand.

#### Fix Approach: Traffic Light System + Discovery Animation

**Simple Mode shows:**
- 🟢 "Enough stimulus" (HU ≥ MAV for the muscle)
- 🟡 "Getting close" (HU between MEV and MAV)
- 🔴 "Too much — consider stopping" (HU > MRV)
- Plain English: "Your chest got enough work today ✅" instead of "12.4 HU (above MAV)"

**Discovery mechanism:**
- After first workout completion, show a full-screen animated modal introducing Simple Mode
- Animation: traffic light filling up as muscles get worked
- CTA: "Turn on Smart Feedback" with toggle
- If user dismisses, show a subtle banner on next 2 workouts: "💡 Did you know? Repwise can tell you when you've done enough"
- Store dismissal count in AsyncStorage — stop after 3 dismissals

#### Implementation Steps

**Step 1: Add Simple Mode preference to store**
- File: `app/store/workoutPreferencesStore.ts`
- Add: `simpleMode: boolean` (default: `true` for new users)
- Add: `simpleModeDiscoveryDismissals: number` (default: 0)

**Step 2: Create traffic light components**
- File to create: `app/components/training/StimulusIndicator.tsx`
  - Props: `{ muscleGroup: string, currentHU: number, mev: number, mav: number, mrv: number }`
  - Renders: colored dot (🟢/🟡/🔴) + plain English message
  - When `simpleMode` is OFF: renders the existing HU number display instead

- File to create: `app/components/training/StimulusSummary.tsx`
  - Shows per-muscle traffic lights for the current workout
  - "Chest ✅ | Back ✅ | Shoulders 🟡 | Biceps ❌ not trained"

**Step 3: Create discovery modal**
- File to create: `app/components/training/SimpleModeDiscoveryModal.tsx`
  - Full-screen modal with Reanimated animation
  - Traffic light animation: empty → green → yellow → red as muscles fill
  - "Repwise tracks your training stimulus so you know exactly when you've done enough"
  - Toggle: "Turn on Smart Feedback"
  - "Maybe later" dismiss button
  - Shown after first workout completion (check `simpleModeDiscoveryDismissals`)

**Step 4: Add toggle to Preferences**
- File: `app/components/profile/PreferencesSection.tsx`
  - Add toggle: "Simple Mode" with description "Show traffic lights instead of Hypertrophy Units"
  - When toggled, update `workoutPreferencesStore.simpleMode`

**Step 5: Integrate into workout flow**
- File: `app/screens/training/WorkoutSummaryScreen.tsx`
  - After workout completion, check if `simpleModeDiscoveryDismissals < 3` and `!simpleMode`
  - If so, show `SimpleModeDiscoveryModal`
- File: `app/hooks/useWorkoutSave.ts` (or wherever volume data is displayed during workout)
  - When `simpleMode` is ON, render `StimulusIndicator` instead of raw HU numbers
  - When `simpleMode` is OFF, render existing HU display

**Step 6: Subtle reminder banner**
- File to create: `app/components/training/SimpleModeReminder.tsx`
  - Small dismissible banner: "💡 Turn on Smart Feedback to see when you've done enough"
  - Shown during workout if `simpleMode` is OFF and `dismissals < 3`
  - Tap → opens preferences, dismiss → increments counter

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/store/workoutPreferencesStore.ts` | MODIFY — add simpleMode | LOW |
| `app/components/training/StimulusIndicator.tsx` | CREATE | LOW |
| `app/components/training/StimulusSummary.tsx` | CREATE | LOW |
| `app/components/training/SimpleModeDiscoveryModal.tsx` | CREATE | LOW |
| `app/components/training/SimpleModeReminder.tsx` | CREATE | LOW |
| `app/components/profile/PreferencesSection.tsx` | MODIFY — add toggle | LOW |
| `app/screens/training/WorkoutSummaryScreen.tsx` | MODIFY — show discovery modal | MEDIUM |
| Workout volume display components | MODIFY — conditional rendering | MEDIUM |

#### Testing
- Manual: Complete first workout → verify discovery modal appears with animation
- Manual: Toggle Simple Mode ON → verify traffic lights replace HU numbers
- Manual: Toggle Simple Mode OFF → verify HU numbers return
- Manual: Dismiss discovery modal 3 times → verify it stops appearing
- Regression: WNS calculations unchanged (only display changes)

---

### P2-2: Import from Strong/Hevy CSV

**Severity:** HIGH — #1 acquisition blocker for competitor users
**Effort:** 3-5 days
**Risk:** HIGH — data integrity, exercise mapping, unit conversion

#### Research Summary (from Strong/Hevy CSV format analysis)

**Strong CSV columns:** Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps, Distance, Seconds, Notes, Workout Notes, RPE
**Hevy CSV columns:** title, start_time, end_time, description, exercise_title, superset_id, exercise_notes, set_index, set_type, weight_lbs, reps, distance_miles, duration_seconds, rpe

Key differences: date formats (ISO vs DD Mon YYYY), set indexing (1-based vs 0-based), weight units (ambiguous vs explicit), exercise naming (both use "Exercise (Equipment)" pattern).

#### Implementation Steps

**Step 1: Backend — CSV parser + import endpoint**

- File to create: `src/modules/import_data/__init__.py`
- File to create: `src/modules/import_data/parser.py`
  - `detect_format(header_row: list[str]) -> Literal["strong", "hevy", "fitnotes", "unknown"]`
    - Strong: has "Exercise Name" column
    - Hevy: has "exercise_title" column
    - FitNotes: has "Exercise" + "Category" columns
  - `parse_strong_csv(rows) -> list[ImportedWorkout]`
  - `parse_hevy_csv(rows) -> list[ImportedWorkout]`
  - `ImportedWorkout` dataclass: date, name, duration, exercises (list of ImportedExercise)
  - `ImportedExercise` dataclass: name, sets (list of ImportedSet)
  - `ImportedSet` dataclass: weight_kg, reps, rpe, set_type, notes
  - Handle: date parsing (3 formats), weight rounding (nearest 0.25), unit detection/conversion, floating point cleanup

- File to create: `src/modules/import_data/exercise_mapper.py`
  - Maps imported exercise names to Repwise exercise database
  - Fuzzy matching: normalize "Bench Press (Barbell)" → search for "bench press barbell"
  - Exact match first, then fuzzy match (Levenshtein distance or trigram similarity)
  - Unmapped exercises → create as custom exercises
  - Return mapping report: { matched: [...], created_as_custom: [...], ambiguous: [...] }

- File to create: `src/modules/import_data/service.py`
  - `import_workouts(user_id, file_content, format) -> ImportResult`
  - Parse CSV → map exercises → create TrainingSession records → detect PRs
  - Wrap in transaction — all or nothing
  - Return: sessions_imported, exercises_mapped, exercises_created, prs_detected

- File to create: `src/modules/import_data/router.py`
  - `POST /api/v1/import/workouts` — accepts multipart file upload
  - `POST /api/v1/import/preview` — parses CSV and returns preview (exercise mapping, session count) without saving
  - `GET /api/v1/import/formats` — returns supported formats

- File to create: `src/modules/import_data/schemas.py`
  - `ImportPreviewResponse`: session_count, exercise_mappings, unmapped_exercises, date_range
  - `ImportResultResponse`: sessions_imported, prs_detected, exercises_created

**Step 2: Frontend — Import screen + UX flow**

- File to create: `app/screens/settings/ImportDataScreen.tsx`
  - Step 1: Select source (Strong, Hevy, FitNotes) with app icons
  - Step 2: Instructions for exporting from the source app (with screenshots/links)
  - Step 3: File picker (expo-document-picker) to select CSV
  - Step 4: Preview — show "Found 127 workouts, 45 exercises (3 need manual mapping)"
  - Step 5: Exercise mapping review — show unmapped exercises with suggestions
  - Step 6: Import confirmation + progress bar
  - Step 7: Success screen with stats

- File to create: `app/components/import/ExerciseMappingCard.tsx`
  - Shows: imported exercise name → matched Repwise exercise (or "Create as custom")
  - User can tap to change the mapping
  - Dropdown/search for Repwise exercise database

- Add to navigation: `BottomTabNavigator.tsx` — add ImportDataScreen to Profile stack

**Step 3: Unit detection UX**

Strong CSV doesn't label weight units. Add a step in the import flow:
- "What unit system was your Strong data in?"
- Options: "Pounds (lbs)" / "Kilograms (kg)"
- Default based on user's Repwise unit preference

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/modules/import_data/` (5 files) | CREATE | MEDIUM |
| `src/main.py` | MODIFY — register import router | LOW |
| `app/screens/settings/ImportDataScreen.tsx` | CREATE | LOW |
| `app/components/import/ExerciseMappingCard.tsx` | CREATE | LOW |
| `app/navigation/BottomTabNavigator.tsx` | MODIFY — add import screen | LOW |

#### Testing
- New tests: `tests/test_import_parser.py` — parse real Strong/Hevy CSV samples
- New tests: `tests/test_exercise_mapper.py` — fuzzy matching accuracy
- New tests: `tests/test_import_service.py` — full import flow with transaction rollback on error
- Manual: Export from Strong → import into Repwise → verify all workouts appear correctly
- Manual: Export from Hevy → same verification
- Edge cases: empty CSV, CSV with only headers, CSV with 1000+ workouts, CSV with unknown exercises, CSV with mixed units

#### Gotchas
- Exercise name mapping is the #1 source of import bugs (Hevy reports 5-10 lost workouts per 900 due to mismatches)
- Strong CSV must be exported in English (non-English exercise names won't match)
- Floating point weight artifacts (185.00000000000003) must be rounded
- Large imports (1000+ sessions) should be processed async (queue via TanStack mutation)

---

## Phase 3 — Polish (1-2 days)

### P3-1: Optimistic Updates on Core Mutations

**Severity:** MEDIUM — UX polish, makes the app feel instant
**Effort:** 1-2 days
**Risk:** MEDIUM — must handle rollback correctly on failure

#### Root Cause
Current mutations wait for server response before updating UI. User sees a loading spinner for 200-500ms on every save. With optimistic updates, UI updates instantly and rolls back if the server rejects.

#### Implementation Steps

**Step 1: Optimistic workout save**
- File: `app/hooks/useWorkoutSave.ts`
- Add `onMutate` callback:
  ```typescript
  onMutate: async (params) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['sessions'] });
    // Snapshot previous value
    const previous = queryClient.getQueryData(['sessions']);
    // Optimistically add the new session to the cache
    queryClient.setQueryData(['sessions'], (old: any) => {
      if (!old) return old;
      return { ...old, sessions: [params.payload, ...old.sessions] };
    });
    return { previous };
  },
  onError: (err, params, context) => {
    // Rollback on error
    if (context?.previous) {
      queryClient.setQueryData(['sessions'], context.previous);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  },
  ```

**Step 2: Optimistic nutrition save**
- File: `app/components/modals/AddNutritionModal.tsx`
- Same pattern: `onMutate` adds entry to cache, `onError` rolls back, `onSettled` invalidates

**Step 3: Optimistic reaction toggle**
- File: `app/components/social/ReactionButton.tsx`
- Toggle reaction count immediately, rollback on error

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/hooks/useWorkoutSave.ts` | MODIFY — add onMutate/onError | MEDIUM |
| `app/components/modals/AddNutritionModal.tsx` | MODIFY — add onMutate/onError | MEDIUM |
| `app/components/social/ReactionButton.tsx` | MODIFY — add onMutate/onError | LOW |

#### Testing
- Manual: Save workout → verify UI updates instantly (no spinner)
- Manual: Turn off network → save workout → verify UI shows optimistic data → turn on network → verify sync
- Manual: Trigger server error → verify UI rolls back to previous state
- Regression: All save flows still work correctly

---

## Summary

| Phase | Items | Effort | Risk |
|-------|-------|--------|------|
| Phase 0 — Quick Wins | 2 items (Sentry wiring + alert tags) | 1 hour | LOW |
| Phase 1 — Infrastructure | 3 items (APScheduler, native stack, text scaling) | 2-3 days | MEDIUM |
| Phase 2 — Core Features | 2 items (Simple Mode, CSV import) | 1-2 weeks | MEDIUM-HIGH |
| Phase 3 — Polish | 1 item (optimistic updates) | 1-2 days | MEDIUM |
| **Total** | **8 items** | **~2-3 weeks** | |

### Dependency Graph
```
P0-1 (Sentry wiring) → P0-2 (alert tags need Sentry working)
P1-1 (APScheduler) — independent
P1-2 (Native stack) — independent
P1-3 (Text scaling) — independent
P2-1 (Simple Mode) — independent (but benefits from P1-3 text scaling)
P2-2 (CSV import) — independent
P3-1 (Optimistic updates) — depends on P0 mutations being stable
```

### New Dependencies to Install
| Package | Phase | Purpose |
|---------|-------|---------|
| `apscheduler>=3.10.0` | P1-1 | Background job scheduler |
| `expo-document-picker` | P2-2 | CSV file selection for import |

---

**END OF DESIGN PLAN**


---

## Addendum — SDE3 Audit Findings (20 Additions)

*Phase-by-phase audit from user, product, and engineering perspectives. 20 specific additions required.*

---

### Phase 0 Additions

**A1: Crash Recovery UX**
ErrorBoundary fallback must show "Something went wrong" with:
- "Try Again" button (re-renders the component tree)
- "Report Bug" button (opens email/form with device info)
- If crash happens mid-workout: attempt to recover workout state from Zustand MMKV persistence before showing fallback
- File: `app/components/common/ErrorBoundary.tsx`

**A2: Global Error Handler**
`componentDidCatch` only catches synchronous render errors. Add:
```typescript
// In App.tsx init
import { ErrorUtils } from 'react-native';
ErrorUtils.setGlobalHandler((error, isFatal) => {
  Sentry.captureException(error, { extra: { isFatal } });
});
```
Also add unhandled promise rejection tracking. Without this, ~40% of crashes go unreported.

**A3: Sentry Release/Environment Tagging**
Add to `Sentry.init()`: `release: Constants.expoConfig?.version`, `environment: __DEV__ ? 'development' : 'production'`. Without this, crash reports can't be tied to specific app versions.

---

### Phase 1-1 Additions (APScheduler)

**A4: Redis Lock for Leader Election (replaces worker.age)**
`worker.age` is NOT a stable worker ID. Replace with Redis advisory lock:
```python
async def try_acquire_scheduler_lock() -> bool:
    redis = await get_redis()
    if not redis: return False
    return await redis.set("scheduler_leader", worker_id, nx=True, ex=60)
```
Renew lock every 30s. If lock holder dies, another worker acquires it within 60s.

**A5: Job Overlap Protection**
Add `max_instances=1` and `coalesce=True` to every job:
```python
scheduler.add_job(run_refresh_leaderboards, IntervalTrigger(minutes=15),
                  id="refresh_leaderboards", max_instances=1, coalesce=True)
```

**A6: Graceful Shutdown**
Change `scheduler.shutdown(wait=False)` to `scheduler.shutdown(wait=True)` with a 10s timeout. Prevents mid-flight data corruption.

**A7: Job Health Endpoint**
Add `GET /api/v1/health/jobs` returning last-run timestamp and status for each job. Enables external monitoring.

**A8: Job Error Wrapper**
Wrap each job in a try/except that captures to Sentry with the `component: job` tag:
```python
async def safe_run(job_fn, job_name):
    try:
        sentry_sdk.set_tag("component", "job")
        sentry_sdk.set_tag("job_name", job_name)
        await job_fn()
    except Exception as e:
        sentry_sdk.capture_exception(e)
```

---

### Phase 1-2 Additions (Native Stack)

**A9: Scope as Full v6→v7 Navigation Upgrade**
This is NOT a drop-in swap. Required dependency upgrades:
- `@react-navigation/native` 6.x → 7.x
- `@react-navigation/native-stack` (add, currently not installed)
- `@react-navigation/bottom-tabs` 6.x → 7.x
- `@react-navigation/elements` (may need upgrade)

Budget: 2-3 days (not 1 day). Test every screen transition, modal, deep link, and back button behavior.

**A10: Feature Flag for Rollback**
Put behind PostHog flag `feature-native-stack`. If users report issues, disable flag to revert to JS stack without a new release. (Requires keeping both navigation setups temporarily.)

---

### Phase 1-3 Additions (Text Scaling)

**A11: Global Text Override**
Instead of per-component `maxFontSizeMultiplier`, override globally:
```typescript
// In App.tsx, before any render
import { Text, TextInput } from 'react-native';
Text.defaultProps = { ...Text.defaultProps, maxFontSizeMultiplier: 1.3 };
TextInput.defaultProps = { ...TextInput.defaultProps, maxFontSizeMultiplier: 1.3 };
```
This covers ALL Text components including those in third-party libraries.

---

### Phase 2-1 Additions (Simple Mode)

**A12: Volume Landmark Defaults**
When user hasn't configured landmarks, use literature-based defaults:
| Muscle | MEV (sets/wk) | MAV (sets/wk) | MRV (sets/wk) |
|--------|---------------|---------------|---------------|
| Chest | 8 | 14 | 20 |
| Back | 8 | 14 | 22 |
| Quads | 6 | 12 | 18 |
| Hamstrings | 4 | 10 | 16 |
| Shoulders | 6 | 14 | 22 |
| Biceps | 4 | 12 | 20 |
| Triceps | 4 | 10 | 16 |

Show subtle note: "Using recommended defaults — customize in Settings"

**A13: Persistent Help Button**
Add an ℹ️ button next to traffic lights that opens a bottom sheet explaining:
- 🟢 = "You've done enough for this muscle to grow"
- 🟡 = "Getting close — a few more sets would be ideal"
- 🔴 = "You've done a lot — more sets may hurt recovery"

**A14: First Workout Detection Flag**
Use `hasCompletedFirstManualWorkout: boolean` in Zustand store (not session count). Set to `true` only when user manually completes a workout (not on CSV import). Discovery modal triggers on this flag.

**A15: PostHog Analytics Events**
- `simple_mode_discovery_shown` — modal appeared
- `simple_mode_discovery_accepted` — user turned it on
- `simple_mode_discovery_dismissed` — user tapped "maybe later"
- `simple_mode_toggled` — toggled in preferences (with `enabled: true/false`)
- `stimulus_indicator_viewed` — traffic light rendered during workout

**A16: Put Behind Feature Flag**
`feature-simple-mode` in PostHog. Gradual rollout: 25% → 50% → 100%.

---

### Phase 2-2 Additions (CSV Import)

**A17: Async Processing for Large Imports**
If CSV has >100 sessions:
1. Upload CSV → store in R2/temp storage
2. Return `import_id` immediately
3. Process in background (APScheduler one-shot job or inline async task)
4. Frontend polls `GET /import/{import_id}/status` every 2s
5. Show progress bar: "Importing 127 of 500 workouts..."

**A18: Duplicate Detection**
Fingerprint: `hash(user_id + date + exercise_name + set_count + total_weight)`. Before import, check for existing sessions with matching fingerprints. Prompt: "23 workouts already exist — skip duplicates?"

**A19: Token-Based Exercise Matching**
Replace raw Levenshtein with:
1. Normalize: lowercase, strip parentheses, split into tokens
2. "Bench Press (Barbell)" → `{"barbell", "bench", "press"}`
3. "Barbell Bench Press" → `{"barbell", "bench", "press"}`
4. Jaccard similarity on token sets: `|A ∩ B| / |A ∪ B|` ≥ 0.8 = match
5. Batch-load all exercises once, match in memory (no N+1)

**A20: File Size Limit + Rate Limit**
- Max file size: 5MB (enforced at middleware level)
- Rate limit: 3 imports per user per hour
- Add to onboarding as optional step: "Coming from another app? Import your history"

---

### Cross-Cutting Addition

**A21: PostHog Analytics for ALL Features**
Every feature must ship with measurable events:

| Feature | Events |
|---------|--------|
| Simple Mode | discovery_shown, accepted, dismissed, toggled, indicator_viewed |
| CSV Import | import_started, format_detected, preview_shown, mapping_reviewed, import_completed, import_failed |
| Optimistic Updates | save_optimistic, save_confirmed, save_rolled_back |
| APScheduler | job_started, job_completed, job_failed (via Sentry tags) |

---

### Revised Effort Estimates

| Phase | Original | Revised |
|-------|----------|---------|
| Phase 0 | 1 hour | 2-3 hours (global error handler, recovery UX) |
| Phase 1-1 (APScheduler) | 2-4 hours | 4-6 hours (Redis lock, health endpoint, error wrapper) |
| Phase 1-2 (Native Stack) | 1 day | 2-3 days (full v6→v7 upgrade) |
| Phase 1-3 (Text Scaling) | 1-2 days | 4 hours (global override is simpler) |
| Phase 2-1 (Simple Mode) | 3-5 days | 4-6 days (defaults, help button, analytics, flag) |
| Phase 2-2 (CSV Import) | 3-5 days | 5-7 days (async processing, duplicate detection, token matching) |
| Phase 3-1 (Optimistic) | 1-2 days | 1-2 days (proper response objects, rollback toast) |
| **Total** | **~2-3 weeks** | **~3-4 weeks** |

---

**END OF ADDENDUM**
