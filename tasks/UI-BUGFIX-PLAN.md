# Repwise UI Bug Fix Plan — User-Reported Issues

> Based on manual testing session 2026-04-12
> Every bug traced to root cause with exact fix

---

## BUG 1: Workout Summary Shows Zero Volume / Zero Sets [CRITICAL]

**What user sees:** After completing a set and finishing a workout, the summary shows "0 sets, 0 volume" even though sets were completed.

**Root cause:** In `app/hooks/useWorkoutSave.ts`, `handleConfirmFinish()` calls `store.finishWorkout(unitSystem)` which RESETS the store to defaults (empty exercises). Then `computeWorkoutSummary(store.exercises)` and `exerciseBreakdown` are computed from the already-empty store.

```
store.finishWorkout()  →  store.exercises = []  →  computeWorkoutSummary([]) = zero everything
```

**Fix:** Snapshot `store.exercises` BEFORE calling `finishWorkout()`:
```typescript
const exercisesSnapshot = [...store.exercises];  // capture before reset
const payload = store.finishWorkout(unitSystem);  // this resets the store
// ... compute from snapshot, not store:
const exerciseBreakdown = buildBreakdown(exercisesSnapshot);
const currentSummary = computeWorkoutSummary(exercisesSnapshot);
```

**Affected files:** `app/hooks/useWorkoutSave.ts`
**Risk:** HIGH — touches the workout save path. Must verify the snapshot contains the same data that `finishWorkout` uses internally.
**Tests:** Existing E2E test "Test 6: Finish workout" should catch this if it checks summary values.

---

## BUG 2: Link Superset Does Nothing [HIGH]

**What user sees:** Tapping "Link Superset" in the exercise action menu silently closes the menu with no effect.

**Root cause:** `ActiveWorkoutBody.tsx` renders `ExerciseCardPremium` but NEVER passes `onLinkSuperset` or `onUnlinkSuperset` props. The store has `createSuperset()` and `removeSuperset()` methods, and the UI has the buttons, but the wiring between them is missing.

In `ExerciseCardPremium.tsx`:
```typescript
case 'link-superset': onLinkSuperset?.(); break;  // onLinkSuperset is undefined → no-op
```

**Fix:** Wire the superset callbacks in `ActiveWorkoutBody.tsx`:
```typescript
<ExerciseCardPremium
  onLinkSuperset={() => store.startSupersetLinking(exercise.localId)}
  onUnlinkSuperset={() => store.removeSuperset(exercise.localId)}
  // ... existing props
/>
```

This requires understanding the superset linking flow — does it need a second exercise selection? Check `activeWorkoutSlice.ts` for `createSuperset` to understand the expected UX.

**Affected files:** `app/screens/training/ActiveWorkoutBody.tsx`, potentially `app/store/activeWorkoutSlice.ts`
**Risk:** MEDIUM — superset logic exists in store but may be incomplete. Need to verify the full flow.

---

## BUG 3: Two Different Exercise Pickers with Inconsistent UX [MEDIUM]

**What user sees:** "Add Exercise" during a workout opens a simple bottom sheet (flat list, text-only). "Swap Exercise" opens a full-screen picker with muscle group grid, equipment filters, and rich exercise cards. The UX is inconsistent.

**Root cause:** Two completely separate components:
1. `ExercisePickerSheet.tsx` — `@gorhom/bottom-sheet`, flat string list, used by "Add Exercise" button
2. `ExercisePickerScreen.tsx` — full navigation screen, muscle group grid + equipment filters + ExerciseCard, used by "Swap Exercise"

**Fix options:**
- **Option A (recommended):** Replace the bottom sheet picker with navigation to the full `ExercisePickerScreen` for "Add Exercise" too. This gives a consistent experience with muscle groups, equipment filters, and the info icon.
- **Option B:** Enhance the bottom sheet to match the full picker (add muscle group filter, equipment chips). More work, less consistent.

**Affected files:** `app/screens/training/ActiveWorkoutScreen.tsx` — change the "Add Exercise" handler to navigate to `ExercisePickerScreen` instead of opening `ExercisePickerSheet`
**Risk:** LOW — the full picker already supports the add-exercise flow via `target: 'activeWorkout'`.

---

## BUG 4: ℹ Info Icon Not Visible on Web [MEDIUM]

**What user sees:** No info icon visible on exercise rows in the picker.

**Root cause:** The icon uses a raw Unicode character `ℹ` (U+2139) rendered as `<Text>`. This character may not render visibly in all web browser fonts. The rest of the app uses icon components (Feather/Ionicons), not raw Unicode.

**Fix:** Replace the Unicode character with a proper icon from the app's icon library:
```tsx
// Before:
<Text style={[styles.infoIcon, { color: c.accent.primary }]}>ℹ</Text>

// After:
<Ionicons name="information-circle-outline" size={18} color={c.accent.primary} />
```

**Affected files:** `app/components/exercise-picker/ExerciseCard.tsx`
**Risk:** NONE.

---

## BUG 5: ExerciseContextMenu.tsx is Dead Code [LOW]

**What it is:** `app/components/training/ExerciseContextMenu.tsx` defines a 5-option context menu but is NEVER imported anywhere. The actual menu lives inline inside `ExerciseCardPremium.tsx`.

**Fix:** Delete `ExerciseContextMenu.tsx`. It's dead code that causes confusion.

**Affected files:** `app/components/training/ExerciseContextMenu.tsx` (DELETE)
**Risk:** NONE — zero imports.

---

## BUG 6: Exercise Breakdown on Summary Also Empty [CRITICAL — Same Root Cause as Bug 1]

**What user sees:** The exercise breakdown section on the workout summary is empty or shows wrong data.

**Root cause:** Same as Bug 1 — `exerciseBreakdown` is computed from `store.exercises` after `finishWorkout()` resets the store.

**Fix:** Same fix as Bug 1 — compute from the snapshot.

---

## BUG 7: PR Shows But Volume Doesn't [MEDIUM]

**What user sees:** Personal records are detected correctly (shows "New PR!") but volume/sets show zero.

**Root cause:** PRs are computed by the BACKEND from the saved session data (the API response includes PRs). Volume/sets are computed LOCALLY from the store — which is already empty. The backend has the correct data; the frontend summary computation is broken.

**Fix:** Same fix as Bug 1. Alternatively, use the API response for summary data instead of computing locally.

---

## EXECUTION ORDER

### Phase 1: Critical — Workout Summary Zero Volume (Bugs 1, 6, 7)
1. Fix `useWorkoutSave.ts` — snapshot exercises before `finishWorkout()`
2. Verify summary shows correct volume, sets, and exercise breakdown

### Phase 2: High — Link Superset (Bug 2)
1. Investigate `activeWorkoutSlice.ts` superset flow
2. Wire `onLinkSuperset`/`onUnlinkSuperset` in `ActiveWorkoutBody.tsx`
3. Test the full superset linking flow

### Phase 3: Medium — Consistent Exercise Picker (Bug 3)
1. Replace bottom sheet picker with navigation to full `ExercisePickerScreen`
2. Verify add-exercise flow works from active workout

### Phase 4: Medium — Info Icon Visibility (Bug 4)
1. Replace Unicode `ℹ` with Ionicons icon
2. Verify visibility on web

### Phase 5: Low — Dead Code Cleanup (Bug 5)
1. Delete `ExerciseContextMenu.tsx`
