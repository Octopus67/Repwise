# Training UX Polish — Revised Implementation Plan

## Pre-Execution Audit

**What already exists (MUST NOT rebuild):**
- `ActiveWorkoutScreen.tsx` (912 lines) — duration timer, set completion with haptics, RestTimerOverlay, PRBanner, superset grouping, previous performance + copyPreviousToSet, set type selector, finish/discard flow, crash recovery via AsyncStorage, edit mode, template loading
- `activeWorkoutSlice.ts` — Zustand store with AsyncStorage persistence, all CRUD for exercises/sets/supersets, `reorderExercises` action
- `RestTimerOverlay.tsx` + `RestTimerRing.tsx` — SVG circular progress ring (Phase 3b complete)
- `RPEPicker.tsx` — quick-select RPE/RIR picker (Phase 3c complete)
- `OverloadSuggestionBadge.tsx` + `VolumeIndicatorPill.tsx` — intelligence layer (Phase 4 complete)
- `ExerciseDetailSheet.tsx` — bottom sheet with instructions/animation (Phase 5 complete)

**What must be built:** 16 UX improvements (see requirements.md). All frontend-only. No backend changes.

**Required npm install:** `react-native-draggable-flatlist` — install at Phase 7 task 7.5 only.
**No circular dependencies.** Chain: pure utils → types → stores → components → screen integration.

---

## Dependency Graph

```
Phase 0 (Baseline) → Phase 1 (Pure Utils) → CHECKPOINT A
  → Phase 2 (Types + Stores) → CHECKPOINT B
  → Phase 3 (UI Components) → CHECKPOINT C
  → Phase 4 (Visual Integration) ──┐
  → Phase 5 (Layout Integration) ──┤ parallel
  → CHECKPOINT D                   ┘
  → Phase 6 (Exercise Actions) ──┐
  → Phase 7 (Data Features)    ──┤ parallel
  → CHECKPOINT E                 ┘
  → Phase 8 (Final Validation)
```

---

## Tasks

- [x] 0. Baseline verification
  - [x] 0.1 Run `npx jest --passWithNoTests` — record pass count. **Risk:** Pre-existing failures in activeWorkoutSlice.test.ts timezone tests. **Mitigation:** Ignore known failures, record exact count. **Rollback:** N/A.
  - [x] 0.2 Run `source .venv/bin/activate && python -m pytest tests/ -x -q` — record pass count. **Risk:** Python 3.9 syntax errors in test_adaptive_engine.py. **Mitigation:** Ignore pre-existing. **Rollback:** N/A.
  - [x] 0.3 Verify `ActiveWorkoutScreen.tsx` exists and has duration timer, set completion, RestTimerOverlay import, PRBanner, superset grouping, previous performance display, crash recovery. Read the file and confirm these features are present. **Risk:** File may have been modified by another spec. **Mitigation:** If missing features, stop and reconcile with training-workflow-redesign spec.
  - [x] 0.4 Git commit baseline: `git add -A && git commit -m "baseline before training-ux-polish"`

- [x] 1. Create pure logic utility modules (zero React dependencies)
  - [x] 1.1 Create `app/utils/rpeBadgeColor.ts` — export `getRpeBadgeColor(rpe: number): 'green'|'yellow'|'orange'|'red'|'none'` (6-7=green, 8=yellow, 9=orange, 10=red, else=none) and `shouldShowTypeBadge(setType: SetType): boolean` (returns true for non-normal). Import `SetType` from `app/types/training.ts`. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 1.2 Create `app/utils/setProgressCalculator.ts` — export `calculateSetProgress(sets: ActiveSet[]): { completed: number, total: number, allComplete: boolean }`. Import `ActiveSet` from `app/types/training.ts`. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 1.3 Create `app/utils/keyboardAdvanceLogic.ts` — export `getNextField(currentField: 'weight'|'reps'|'rpe', rpeEnabled: boolean, currentValues: {weight:string, reps:string, rpe:string}): 'weight'|'reps'|'rpe'|'next-row'|null`. Logic: find next empty field after current; if all filled return 'next-row'; never go backward. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 1.4 Create `app/utils/exerciseSwapLogic.ts` — export `swapExerciseName(exercise: ActiveExercise, newName: string): ActiveExercise`. Returns `{ ...exercise, exerciseName: newName }`. Guard: if `!newName.trim()` return original unchanged. Import `ActiveExercise` from `app/types/training.ts`. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 1.5 Create `app/utils/workoutSummaryFormatter.ts` — export `computeWorkoutSummary(exercises: ActiveExercise[], startedAt: string): WorkoutSummary` and `formatMiniSummary(summary: WorkoutSummary): string`. Skipped exercises excluded from counts. Format: "5 exercises · 18 sets · 45 min". **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 1.6 Create `app/utils/warmUpGenerator.ts` — export `generateWarmUpSets(workingWeightKg: number, barWeightKg?: number): WarmUpSet[]`. Default bar=20kg. Returns [] if working ≤ bar. Ramp: bar×10, 60%×5 (skip if ≤ bar), 80%×3 (skip if ≤ 60%). Round all weights to nearest 2.5kg. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 1.7 Write unit + property tests for ALL Phase 1 modules in `app/__tests__/utils/trainingUxPolish.test.ts`. Use fast-check for property tests. Tests MUST cover: (a) RPE badge color for values 5-11 including boundaries, (b) type badge visibility for all 4 set types, (c) set progress with empty array / all complete / none complete / mixed, (d) keyboard advance all field×rpeEnabled×value combinations, (e) exercise swap preserves all set data (Property 7), (f) workout summary excludes skipped exercises (Property 5), (g) warm-up generator monotonic weights + all < working weight + rounds to 2.5kg (Property 13), (h) warm-up returns [] when working ≤ bar. Run `npx jest app/__tests__/utils/trainingUxPolish.test.ts`. **Risk:** fast-check not installed. **Mitigation:** Check `package.json` for fast-check; if missing, `npm install --save-dev fast-check`. **Rollback:** Delete test file.

- [x] 2. **CHECKPOINT A** — All pure logic tests pass
  - Run `npx jest app/__tests__/utils/trainingUxPolish.test.ts` — all pass, 0 failures.
  - Run `npx jest` — full suite, no regressions from Phase 0 baseline count.
  - **Gate:** Do NOT proceed to Phase 2 until all Phase 1 tests pass.

- [x] 3. Extend types and stores
  - [x] 3.1 Extend `ActiveExercise` interface in `app/types/training.ts` — add `notes?: string` and `skipped?: boolean`. Both optional for backward compatibility with persisted AsyncStorage data. **Risk:** TypeScript strict mode may flag missing fields in test factories. **Mitigation:** Update test helpers to include defaults. **Rollback:** Revert type changes.
  - [x] 3.2 Add 4 new actions to `app/store/activeWorkoutSlice.ts`: `swapExercise(localId, newName)` using `swapExerciseName` from exerciseSwapLogic, `toggleExerciseSkip(localId)` flipping `skipped` boolean, `setExerciseNotes(localId, notes)` setting notes string, `insertWarmUpSets(localId, warmUpSets)` prepending warm-up ActiveSet objects with `setType: 'warm-up'` and renumbering all sets. Also update the `finishWorkout` payload builder to include `exercise_notes: Record<string,string>` and `skipped_exercises: string[]` in metadata. **Risk:** Modifying the store file that manages crash recovery persistence. **Mitigation:** New actions only — do not modify existing actions. New metadata fields are additive (backend accepts arbitrary metadata). Test crash recovery round-trip after changes. **Rollback:** Revert store file to pre-change state.
  - [x] 3.3 Create `app/store/workoutPreferencesStore.ts` — Zustand store with AsyncStorage persistence under key `workout-preferences-v1`. State: `showRpeColumn: boolean` (default false). Action: `toggleRpeColumn()`. Separate from activeWorkoutSlice to survive workout discard. **Risk:** AsyncStorage key collision. **Mitigation:** Use unique key `workout-preferences-v1`. **Rollback:** Delete file.
  - [x] 3.4 Create `app/store/tooltipStore.ts` — Zustand store with AsyncStorage persistence under key `tooltip-state-v1`. State: `dismissed: Record<string, boolean>`. Actions: `dismiss(id: string)`, selector `isDismissed(id: string): boolean`. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 3.5 Write unit + property tests for ALL Phase 2 store changes in `app/__tests__/store/trainingUxPolishStore.test.ts`. Tests MUST cover: (a) swapExercise preserves all set data (Property 7 via store), (b) toggleExerciseSkip round-trip preserves exercise state (Property 8), (c) skipped exercises appear in session payload metadata (Property 9), (d) updateSetField on completed set preserves completion state (Property 10 — verify existing behavior), (e) setExerciseNotes round-trip (Property 11), (f) reorderExercises preserves all exercises (Property 12 — verify existing action), (g) insertWarmUpSets prepends with correct setType and renumbers, (h) workoutPreferencesStore toggleRpeColumn persists, (i) tooltipStore dismiss round-trip (Property 4), (j) crash recovery: set notes + skip state → persist → hydrate → verify preserved. **Risk:** Store tests may need mock AsyncStorage. **Mitigation:** Use `jest.mock('@react-native-async-storage/async-storage')` (already mocked in existing test setup). **Rollback:** Delete test file.

- [x] 4. **CHECKPOINT B** — All store tests pass
  - Run `npx jest app/__tests__/store/trainingUxPolishStore.test.ts` — all pass.
  - Run `npx jest` — full suite, no regressions.
  - **Gate:** Do NOT proceed to Phase 3 until all store tests pass.

- [x] 5. Build standalone UI components (no ActiveWorkoutScreen modifications yet)
  - [x] 5.1 Create `app/components/training/RPEBadge.tsx` — pill-shaped badge, color from `getRpeBadgeColor()`. Renders nothing for rpe=0/NaN. Props: `rpeValue: number, mode: 'rpe'|'rir'`. 24px height, `radius.full`. Background = color at 12% opacity, text = full color. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 5.2 Create `app/components/training/TypeBadge.tsx` — pill badge showing W/D/A for non-normal set types. Only rendered when `shouldShowTypeBadge()` returns true. Props: `setType: SetType`. 20px height, `accent.primaryMuted` background. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 5.3 Create `app/components/common/Tooltip.tsx` — wraps anchor element, checks `tooltipStore.isDismissed(tooltipId)`, shows bubble on first render if not dismissed. Fade-in 200ms, dismiss on tap anywhere via `tooltipStore.dismiss()`. Props: `tooltipId: string, text: string, children: ReactNode`. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 5.4 Create `app/components/training/ExerciseContextMenu.tsx` — dropdown menu anchored to "..." button. Items: Swap Exercise, Skip/Unskip, Add/Edit Note, Generate Warm-Up (conditional on `hasPreviousPerformance`). Uses absolute-positioned View (not Modal). Props: `visible, isSkipped, hasNotes, hasPreviousPerformance, onSwap, onSkip, onUnskip, onAddNote, onGenerateWarmUp, onDismiss`. **Risk:** Z-index issues with rest timer bar. **Mitigation:** Set `zIndex: 100` on menu container. **Rollback:** Delete file.
  - [x] 5.5 Create `app/components/training/RestTimerBar.tsx` — floating bar, 56px height, docked above FinishBar. Contains compact RestTimerRing (40px — modify `RestTimerRing.tsx` to accept optional `size` prop, default 220), remaining time text, Skip button. Slides up with spring animation on mount. Tap bar → `onExpand()` to open full RestTimerOverlay. Props: `durationSeconds, remainingSeconds, paused, completed, onSkip, onExpand`. **Risk:** Modifying RestTimerRing.tsx (existing component). **Mitigation:** Only add optional `size` prop with default value — backward compatible. **Rollback:** Revert RestTimerRing.tsx, delete RestTimerBar.tsx.
  - [x] 5.6 Create `app/components/training/FinishBar.tsx` — sticky bottom bar, 72px height. Top line: mini summary from `formatMiniSummary()`. Bottom: "Finish Workout" button (or "Save Changes" in edit mode). Props: `exerciseCount, completedSetCount, elapsedSeconds, saving, isEditMode, onFinish`. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 5.7 Create `app/components/training/ConfirmationSheet.tsx` — Modal with `animationType="slide"`. Shows workout summary (exercise list with set counts, total volume, duration), "Save as Template" toggle (default off), Save + Cancel buttons. Props: `visible, exercises, startedAt, notes, unitSystem, onConfirm(saveAsTemplate: boolean), onCancel`. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 5.8 Create `app/components/training/WarmUpSuggestion.tsx` — small text button "Generate Warm-Up →". Only visible when `workingWeightKg > barWeightKg`. Calls `generateWarmUpSets()` on tap. Disappears after generating. Props: `workingWeightKg, barWeightKg, onGenerate(sets)`. **Risk:** None — new file. **Rollback:** Delete file.
  - [x] 5.9 Write component tests in `app/__tests__/components/trainingUxPolishComponents.test.ts`. Tests MUST cover: (a) RPEBadge renders correct color for each RPE value 6-10, renders nothing for 0, (b) TypeBadge renders W/D/A for warm-up/drop-set/amrap, renders nothing for normal, (c) Tooltip renders on first view, does not render after dismiss, (d) FinishBar displays formatted summary string, (e) ConfirmationSheet shows exercise list and Save as Template toggle, (f) RestTimerBar renders compact ring and remaining time, (g) ExerciseContextMenu shows correct items based on props. **Risk:** None. **Rollback:** Delete test file.

- [x] 6. **CHECKPOINT C** — All component tests pass
  - Run `npx jest app/__tests__/components/trainingUxPolishComponents.test.ts` — all pass.
  - Run `npx jest` — full suite, no regressions.
  - Verify `getDiagnostics` on all new component files — zero TypeScript errors.
  - **Gate:** Do NOT proceed to Phase 4/5 until all component tests pass.

- [x] 7. Integrate into ActiveWorkoutScreen — Visual state and column visibility (Phase 4)
  - [x] 7.1 Remove info banner from `ActiveWorkoutScreen.tsx`. Find the `infoHint` / info banner JSX section and delete it. Add `<Tooltip tooltipId="rpe-intro" text="RPE measures how hard a set felt (6=easy, 10=max)">` wrapping the RPE header cell. Add `<Tooltip tooltipId="type-intro" text="Long-press a set row to change type (warm-up, drop, AMRAP)">` wrapping the first set row on first render. **Risk:** Removing wrong JSX section. **Mitigation:** Search for the exact banner text "RPE = how hard" to locate it. **Rollback:** Revert ActiveWorkoutScreen.tsx.
  - [x] 7.2 Modify SetRow rendering for completed set visual state. Apply `colors.semantic.positiveSubtle` background tint on completed rows (verify existing `bgAnim` does this — if not, add `backgroundColor` conditional). Conditionally render RPE column based on `workoutPreferencesStore.showRpeColumn`. Replace inline RPE text with `RPEBadge` component when RPE is enabled. Hide Type column by default; show `TypeBadge` inline when `setType !== 'normal'`. Add long-press gesture on SetRow to reveal SetTypeSelector for that row. **Risk:** Modifying the hot-path SetRow component (20+ instances). **Mitigation:** Wrap SetRow in `React.memo` with shallow comparison. Only change rendering logic, not state mutation logic. **Rollback:** Revert SetRow changes.
  - [x] 7.3 Add set progress indicator to exercise card header. Import `calculateSetProgress()`. Compute "2/4 sets" display next to exercise name. Show with `colors.semantic.positive` accent when `allComplete`. **Risk:** None — additive JSX. **Rollback:** Remove progress indicator JSX.
  - [x] 7.4 Apply visual hierarchy improvements. Exercise names: `typography.size.lg` + `typography.weight.bold`. Weight values in SetRow: `colors.accent.primary` + `typography.weight.semibold`. Rep values: `colors.text.secondary`. Increase `marginBottom` on exercise cards from `spacing[3]` to `spacing[4]`. **Risk:** Visual regression on existing elements. **Mitigation:** Only change style values, not layout structure. **Rollback:** Revert style changes.

- [x] 8. Integrate into ActiveWorkoutScreen — Layout changes (Phase 5, parallel with Phase 4)
  - [x] 8.1 Replace rest timer overlay with floating bar. Add local state: `restTimerState: { active, remaining, paused, completed, duration }`. On set completion, instead of showing RestTimerOverlay directly, set `restTimerState.active = true`. Render `RestTimerBar` above FinishBar when active. Manage countdown via `setInterval` in local state. On bar tap → set `expandedTimerVisible = true` → show existing `RestTimerOverlay`. Clear timer state before showing ConfirmationSheet. **Risk:** Timer interval leak on unmount. **Mitigation:** Clear interval in `useEffect` cleanup. **Risk:** RestTimerOverlay still imported — ensure it's only rendered when `expandedTimerVisible`. **Rollback:** Revert to direct RestTimerOverlay rendering.
  - [x] 8.2 Replace bottom finish button with FinishBar + ConfirmationSheet. Remove existing `bottomBar` / `finishBtn` from ScrollView. Add `FinishBar` as a component outside ScrollView (sticky bottom). Wire: FinishBar `onFinish` → validate ≥1 completed set → show ConfirmationSheet. ConfirmationSheet `onConfirm(saveAsTemplate)` → build payload with `exercise_notes` + `skipped_exercises` in metadata → POST /training/sessions → if `saveAsTemplate` also POST /training/user-templates (exclude warm-up sets and skipped exercises) → `store.discardWorkout()` → `navigation.goBack()`. **Risk:** Breaking existing finish flow. **Mitigation:** Keep existing `handleFinish` logic intact, just move the trigger from inline button to FinishBar. **Rollback:** Revert to inline finish button.
  - [x] 8.3 Move discard button to overflow menu. Replace `discardText` button in header with "..." icon (`<Icon name="more" />`). Create simple overflow menu (absolute-positioned View) with "Discard Workout" action. Keep existing confirmation Alert on discard. **Risk:** Accidental removal of discard functionality. **Mitigation:** Verify discard still works via the overflow menu path. **Rollback:** Revert header to inline discard button.

- [x] 9. **CHECKPOINT D** — Visual + layout integration verified
  - Run `npx jest` — full suite, no regressions.
  - Run `getDiagnostics` on `ActiveWorkoutScreen.tsx` — zero TypeScript errors.
  - Manual verification: (a) completed set has background tint, (b) RPE column hidden by default, (c) info banner gone, (d) rest timer shows as floating bar, (e) finish bar sticky at bottom, (f) discard in overflow menu.
  - **Gate:** Do NOT proceed to Phase 6/7 until checkpoint passes.

- [x] 10. Integrate exercise actions into ActiveWorkoutScreen (Phase 6)
  - [x] 10.1 Add ExerciseContextMenu to exercise card header. Add "..." button next to exercise name. On tap → show ExerciseContextMenu. Wire "Swap Exercise" → `navigation.push('ExercisePicker', { target: 'swapExercise', currentExerciseLocalId, muscleGroup })`. Handle swap result via `useEffect` on `route.params` → `store.swapExercise(localId, newName)` → `Haptics.impactAsync('medium')` → re-fetch previous performance for new exercise. **Risk:** ExercisePicker doesn't support `target: 'swapExercise'` param. **Mitigation:** ExercisePicker already has a `target` param — add 'swapExercise' handling that returns the selected exercise name via route params instead of calling `addExercise`. **Rollback:** Remove context menu and swap handling.
  - [x] 10.2 Implement exercise skip/unskip. Wire "Skip Exercise" / "Unskip Exercise" in context menu to `store.toggleExerciseSkip(localId)`. Apply visual skip state: `opacity: 0.4` on exercise card, strikethrough on exercise name (`textDecorationLine: 'line-through'`). Ensure skipped exercises stay in layout. Ensure `computeWorkoutSummary` excludes skipped exercises (already handled in Phase 1). **Risk:** None — additive. **Rollback:** Remove skip visual state and context menu item.
  - [x] 10.3 Implement inline editing of completed sets. Verify that tapping weight/reps on a completed SetRow makes the field editable without changing `completed` or `completedAt`. The existing `updateSetField` action should already preserve completion state — verify this by reading the store action code. If it does reset completion, add a guard: `if (field !== 'completed' && field !== 'completedAt')` in the update logic. **Risk:** Existing behavior may already work. **Mitigation:** Read the code first, only modify if needed. **Rollback:** Revert any store changes.
  - [x] 10.4 Add per-exercise notes. Add collapsible TextInput below each exercise card, hidden by default. Add notes icon in exercise header — tap toggles visibility. Wire to `store.setExerciseNotes(localId, text)`. Set `maxLength={500}` on TextInput. **Risk:** None — additive. **Rollback:** Remove notes UI.
  - [x] 10.5 Implement keyboard auto-advance. Add refs for weight, reps, RPE TextInputs in each SetRow. Wire `onSubmitEditing` on each input to call `getNextField()` and focus the appropriate ref. Parent passes `nextRowWeightRef` prop to enable cross-row advancement. Set `returnKeyType="next"` on weight/reps, `returnKeyType="done"` on last field (reps if RPE disabled, RPE if enabled). **Risk:** Ref chain complexity with 20+ rows. **Mitigation:** Refs are O(1) access, built during render via set array index. **Rollback:** Remove ref chain and onSubmitEditing handlers.

- [x] 11. Integrate data features into ActiveWorkoutScreen (Phase 7, parallel with Phase 6)
  - [x] 11.1 Implement copy from specific date. Add "Copy from Date" option in the overflow menu (alongside Discard). On tap → show date picker (use existing date picker pattern from session date selector). On date select → `GET /training/sessions?date=YYYY-MM-DD&limit=10`. If sessions found → show session list → user selects → populate current workout with exercises and sets. If no sessions → show "No sessions found for this date." toast. If API error → show error toast, keep current workout unchanged. **Risk:** Overwriting in-progress workout data. **Mitigation:** Show confirmation "Replace current exercises?" before populating. **Rollback:** Remove overflow menu item and copy logic.
  - [x] 11.2 Implement warm-up set generator. Wire `WarmUpSuggestion` component in exercise card header. Show only when previous performance exists for the exercise (check `previousPerformanceData` cache). On generate → `generateWarmUpSets(workingWeight, barWeight)` → `store.insertWarmUpSets(localId, sets)`. Button disappears after generating (warm-up sets now in set list). **Risk:** None — additive. **Rollback:** Remove WarmUpSuggestion from exercise card.
  - [x] 11.3 Add auto-scroll on set completion. After set completion callback, find next uncompleted set row using `exercises.flatMap(e => e.sets).findIndex(s => !s.completed)`. Use `scrollViewRef.scrollTo({ y: targetY, animated: true })` or FlatList `scrollToIndex()`. Skip auto-scroll when all sets are complete. **Risk:** Incorrect scroll position calculation. **Mitigation:** Use `onLayout` to measure set row positions. **Rollback:** Remove auto-scroll logic.
  - [x] 11.4 Write integration tests in `app/__tests__/screens/ActiveWorkoutUxPolish.test.ts`. Tests MUST cover: (a) completed set has positiveSubtle background, (b) RPE column hidden when preference is off, (c) RPE column visible with colored badges when preference is on, (d) type badge appears for non-normal set types, (e) info banner is absent, (f) FinishBar displays correct summary, (g) ConfirmationSheet opens on finish tap, (h) exercise swap preserves set data, (i) exercise skip applies opacity + strikethrough, (j) per-exercise notes save and restore, (k) keyboard auto-advance focuses correct next field, (l) warm-up sets inserted with correct type. **Risk:** Complex test setup for ActiveWorkoutScreen. **Mitigation:** Use existing test patterns from `app/__tests__/components/AddTrainingModal.test.ts`. **Rollback:** Delete test file.
  - [x] 11.5 Install `react-native-draggable-flatlist`: run `npm install react-native-draggable-flatlist` in project root. Verify no peer dependency conflicts. Replace exercise list ScrollView in ActiveWorkoutScreen with DraggableFlatList. Add drag handle (≡ icon) to each exercise card header. Wire `onDragEnd` to existing `store.reorderExercises(fromIndex, toIndex)`. **Risk:** Peer dependency conflict with react-native-reanimated or gesture-handler. **Mitigation:** Check compatibility before installing. If conflicts, defer drag-to-reorder to v2 and skip this task. **Rollback:** `npm uninstall react-native-draggable-flatlist`, revert to ScrollView.

- [x] 12. **CHECKPOINT E** — All integration tests pass
  - Run `npx jest app/__tests__/screens/ActiveWorkoutUxPolish.test.ts` — all pass.
  - Run `npx jest` — full suite, no regressions from Phase 0 baseline.
  - Run `source .venv/bin/activate && python -m pytest tests/ -x -q` — no backend regressions.
  - **Gate:** Do NOT ship until all tests pass.

- [x] 13. Final validation
  - [x] 13.1 Run full frontend test suite: `npx jest` — all pass, no regressions from Phase 0 count.
  - [x] 13.2 Run full backend test suite: `python -m pytest tests/ -x -q` — all pass (backend unchanged, but verify no accidental modifications).
  - [x] 13.3 Run `getDiagnostics` on all modified files: `ActiveWorkoutScreen.tsx`, `activeWorkoutSlice.ts`, `RestTimerRing.tsx`, `app/types/training.ts`, `app/store/index.ts`. Zero TypeScript errors.
  - [x] 13.4 Git commit: `git add -A && git commit -m "training-ux-polish: all 16 UX improvements"`

---

## Rollback Plan

| Phase | If It Fails | Undo |
|-------|-------------|------|
| Phase 1 (Pure utils) | Tests fail | Delete new files in `app/utils/`. No other files touched. |
| Phase 2 (Types + stores) | Store corruption / crash recovery broken | Revert `app/types/training.ts`, `activeWorkoutSlice.ts`. Delete new store files. Run `npx jest` to verify clean state. |
| Phase 3 (UI components) | Component render errors | Delete new component files. No screen files touched yet. |
| Phase 4 (Visual integration) | ActiveWorkoutScreen broken | `git checkout -- app/screens/training/ActiveWorkoutScreen.tsx`. All Phase 4 changes are in this one file. |
| Phase 5 (Layout integration) | Finish flow broken / timer leak | Same as Phase 4 — revert ActiveWorkoutScreen.tsx. RestTimerRing.tsx: revert `size` prop addition. |
| Phase 6 (Exercise actions) | Swap/skip/notes broken | Revert ActiveWorkoutScreen.tsx. ExercisePicker changes: revert if swap target handling was added. |
| Phase 7 (Data features) | Drag library conflict | `npm uninstall react-native-draggable-flatlist`. Revert ActiveWorkoutScreen.tsx to pre-Phase 7. |
| Any phase | Full rollback | `git stash` or `git checkout -- .` to revert all uncommitted changes. Baseline commit from Phase 0 is the safe point. |

## Monitoring (Post-Launch)

| Metric | Instrument | Alert Threshold |
|--------|-----------|-----------------|
| Session completion rate | Track `POST /training/sessions` success count / `ActiveWorkout` screen open count | Drop > 2% week-over-week |
| Accidental discard rate | Track discard events (existing analytics) | Increase > 50% after launch (overflow menu should reduce this) |
| Rest timer bar interaction | Track bar tap (expand) vs skip vs auto-dismiss | If expand rate < 5%, bar may be too small — increase tap target |
| Crash recovery success | Track "Resume workout?" prompt shown vs accepted | Accept rate < 50% indicates data corruption |
| AsyncStorage write latency | Measure `activeWorkoutSlice` persist duration | > 100ms indicates payload too large |
| SetRow render time | React DevTools profiler on SetRow component | > 16ms per render (frame budget) indicates memo failure |

## Effort Summary

| Phase | Estimated Effort | Risk Level |
|-------|-----------------|------------|
| Phase 0: Baseline | 0.5 hours | None |
| Phase 1: Pure utils + tests | 3-4 hours | Low |
| Phase 2: Types + stores + tests | 4-5 hours | Medium (store modification) |
| Phase 3: UI components + tests | 4-5 hours | Low |
| Phase 4: Visual integration | 3-4 hours | Medium (ActiveWorkoutScreen modification) |
| Phase 5: Layout integration | 4-5 hours | High (rest timer + finish flow) |
| Phase 6: Exercise actions | 4-5 hours | Medium (swap navigation) |
| Phase 7: Data features + integration tests | 4-5 hours | Medium (drag library install) |
| Phase 8: Final validation | 1 hour | None |
| **Total** | **~28-34 hours (4-5 days)** | |