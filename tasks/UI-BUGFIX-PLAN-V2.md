# Repwise Comprehensive Bug Fix & Edge Case Plan

> Based on manual testing + deep code audit 2026-04-12
> 28 issues found across 4 categories

---

## PHASE 1: Critical — Workout Summary Zero Volume [BLOCKING]

### Bug 1.1: Summary shows 0 sets, 0 volume after completing workout
**Root cause:** `store.finishWorkout()` resets store to empty BEFORE summary is computed.
**Fix:** In `useWorkoutSave.ts`, snapshot `store.exercises` before calling `finishWorkout()`. Compute `exerciseBreakdown` and `computeWorkoutSummary()` from the snapshot.
**Files:** `app/hooks/useWorkoutSave.ts`
**Risk:** HIGH — core save path. Test with E2E.

---

## PHASE 2: High — Broken Features

### Bug 2.1: Link Superset does nothing
**Root cause:** `ActiveWorkoutBody.tsx` never passes `onLinkSuperset`/`onUnlinkSuperset` to `ExerciseCardPremium`. The optional chaining `onLinkSuperset?.()` silently no-ops.
**Fix:** Wire the callbacks. Investigate `activeWorkoutSlice.ts` for `createSuperset`/`removeSuperset` to understand the expected flow (may need a second-exercise selection UI).
**Files:** `app/screens/training/ActiveWorkoutBody.tsx`
**Risk:** MEDIUM — superset store logic exists but may be incomplete.

### Bug 2.2: ℹ info icon invisible on web
**Root cause:** Uses raw Unicode `ℹ` (U+2139) instead of an icon component. Doesn't render in some web fonts.
**Fix:** Replace with `<Ionicons name="information-circle-outline" size={18} />`.
**Files:** `app/components/exercise-picker/ExerciseCard.tsx`
**Risk:** NONE.

### Bug 2.3: Two inconsistent exercise pickers
**Root cause:** "Add Exercise" uses `ExercisePickerSheet` (simple bottom sheet, flat text list). "Swap Exercise" uses `ExercisePickerScreen` (full screen, muscle groups, equipment filters, rich cards).
**Fix:** Replace the bottom sheet with navigation to `ExercisePickerScreen` for "Add Exercise" too.
**Files:** `app/screens/training/ActiveWorkoutScreen.tsx`
**Risk:** LOW — the full picker already supports add-exercise flow.

---

## PHASE 3: Double-Tap & Re-Click Guards

### Bug 3.1: Save as Template — no double-tap guard
**Root cause:** `handleSaveAsTemplate` in `useWorkoutSave.ts` has no `savingRef` or loading state. Double-tap creates duplicate templates.
**Fix:** Add `templateSavingRef` guard.
**Files:** `app/hooks/useWorkoutSave.ts`

### Bug 3.2: Start Workout — double-tap pushes two screens
**Root cause:** `navigation.push('ActiveWorkout')` has no guard. Rapid taps push duplicate screens.
**Fix:** Add ref guard: `if (startingRef.current) return; startingRef.current = true;`
**Files:** `app/hooks/useDashboardNavigation.ts`

### Bug 3.3: Add to Workout (ExerciseDetail) — double-tap adds twice
**Root cause:** `handleAdd` calls `addExercise()` then `goBack()`. Double-tap adds exercise twice before goBack fires.
**Fix:** Add ref guard: `if (addedRef.current) return; addedRef.current = true;`
**Files:** `app/screens/training/ExerciseDetailScreen.tsx`

### Bug 3.4: Coaching Accept/Modify/Dismiss — no loading guard
**Root cause:** Three API calls with no disabled state on buttons.
**Fix:** Add loading state per action.
**Files:** `app/screens/dashboard/DashboardScreen.tsx`

### Bug 3.5: Save as Favorite — missing disabled prop
**Root cause:** `savingFavorite` state exists but `disabled={savingFavorite}` not on the button.
**Fix:** Add `disabled={savingFavorite}` to the TouchableOpacity.
**Files:** `app/components/modals/AddNutritionModal.tsx`

---

## PHASE 4: Tab Switch & State Edge Cases

### Bug 4.1: No workout-in-progress indicator on tab bar
**Root cause:** `useActiveWorkoutStore` is imported in BottomTabNavigator but `isActive` is only used in the crash handler, not for any visual indicator.
**Fix:** Add a pulsing dot badge on the Home tab when `isActive === true`.
**Files:** `app/navigation/BottomTabNavigator.tsx`

### Bug 4.2: Rest timer has no global indicator
**Root cause:** `FloatingRestTimerBar` only renders inside `ActiveWorkoutScreen`. Timer completion sound/haptic fires on other tabs but no visual.
**Fix:** Add a mini rest timer indicator to the tab bar or as a global overlay when `restTimerActive === true` and user is not on ActiveWorkoutScreen.
**Files:** `app/navigation/BottomTabNavigator.tsx` or `app/App.tsx`

### Bug 4.3: Orphaned crash recovery code
**Root cause:** `workout_crash_recovery` is written to AsyncStorage in ErrorBoundary but NEVER read back. Dead code.
**Fix:** Remove the write (Zustand persist already handles crash recovery). Or implement the read path.
**Files:** `app/navigation/BottomTabNavigator.tsx`

---

## PHASE 5: Error Feedback & Silent Failures

### Bug 5.1: Toast component built but never used
**Root cause:** `app/components/common/Toast.tsx` exists with full animation/haptic support but zero consumers. App uses blocking `Alert.alert()` for everything.
**Fix:** Create a `useToast` hook/context and replace success `Alert.alert()` calls with non-blocking toasts. Start with: bodyweight log success, recipe log success, delete confirmations.
**Files:** New `app/hooks/useToast.tsx` or `app/contexts/ToastContext.tsx`, then update consumers.

### Bug 5.2: ExerciseDetailScreen silent catch
**Root cause:** `catch { /* ignore */ }` — API failure shows "Exercise not found" instead of error state.
**Fix:** Add error state with retry button.
**Files:** `app/screens/training/ExerciseDetailScreen.tsx`

### Bug 5.3: MealBuilder no success feedback
**Root cause:** Multi-item meal save just closes the modal silently.
**Fix:** Show toast "Meal logged successfully" on save.
**Files:** `app/components/nutrition/MealBuilder.tsx`

### Bug 5.4: No delete success feedback (5 flows)
**Root cause:** All delete operations (nutrition entry, training session, export, photo, favorite) have confirmation dialogs but no success feedback after deletion.
**Fix:** Add toast "Deleted" after each successful delete.
**Files:** Multiple screens in logs, settings, photos.

### Bug 5.5: ExerciseHistory/PRHistory/SessionDetail — no retry button
**Root cause:** These screens set error state but don't show a retry button.
**Fix:** Add retry button to error states.
**Files:** `app/screens/training/ExerciseHistoryScreen.tsx`, `PRHistoryScreen.tsx`, `SessionDetailScreen.tsx`

---

## PHASE 6: Dead Code Cleanup

### Bug 6.1: ExerciseContextMenu.tsx is dead code
**Root cause:** Defined but never imported. The actual menu is inline in `ExerciseCardPremium.tsx`.
**Fix:** Delete the file.
**Files:** `app/components/training/ExerciseContextMenu.tsx` (DELETE)

### Bug 6.2: workout_crash_recovery write is orphaned
(Same as 4.3 — addressed there)

---

## EXECUTION ORDER

| Phase | Tasks | Severity | Est. Files |
|-------|-------|----------|-----------|
| 1 | 1.1 (zero volume) | CRITICAL | 1 |
| 2 | 2.1-2.3 (broken features) | HIGH | 3 |
| 3 | 3.1-3.5 (double-tap guards) | HIGH | 5 |
| 4 | 4.1-4.3 (tab switch states) | MEDIUM | 2 |
| 5 | 5.1-5.5 (error feedback) | MEDIUM | 8+ |
| 6 | 6.1 (dead code) | LOW | 1 |

## RISK MATRIX

| Task | Risk | Reason |
|------|------|--------|
| 1.1 (zero volume) | HIGH | Core workout save path |
| 2.1 (superset) | MEDIUM | Store logic may be incomplete |
| 2.3 (picker unification) | LOW | Full picker already supports add flow |
| 3.2 (start workout guard) | LOW | Additive ref guard |
| 4.1 (tab badge) | LOW | Additive UI |
| 5.1 (toast system) | MEDIUM | New context/hook + multiple consumers |
