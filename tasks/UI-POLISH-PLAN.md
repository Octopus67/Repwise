# Repwise Pre-Launch UI Fix Plan

> 10 fixes, 3 phases, ~3-4 hours total
> Ordered by severity. Each fix has exact code changes.

---

## PHASE 1: Critical — Set Row & Finish Bar (5 fixes)

### Fix 1.1: Flip opacity model (uncompleted=1.0, completed=muted)

**Root cause:** `rowUncompleted` has `opacity: 0.7`, making active inputs look disabled.
**File:** `app/components/training/SetRowPremium.tsx`

**Steps:**
1. Change `rowUncompleted` style: `opacity: 0.7` → remove opacity entirely (or set to 1.0)
2. Add `opacity: 0.85` to `rowCompleted` style (completed sets should be slightly muted)
3. The progression color tint (`getProgressionBg`) already provides visual feedback for completed sets

**Exact changes:**
```
rowUncompleted: {
  // Remove opacity: 0.7
},
rowCompleted: {
  backgroundColor: 'rgba(0, 255, 100, 0.08)',
  borderLeftWidth: 3,
  borderLeftColor: c.semantic.positive,
  opacity: 0.85,  // ADD: mute completed sets slightly
},
```

**Risk:** LOW — style-only change. Progression color override still applies on top.
**Test:** Visual verification on web + dark/light mode.

---

### Fix 1.2: Remove inline delete ✕ button (keep swipe-to-delete)

**Root cause:** ✕ button is 4px from checkmark ✓. Users will accidentally delete sets.
**File:** `app/components/training/SetRowPremium.tsx`

**Steps:**
1. Remove the entire `{/* Delete set button */}` JSX block (lines 368-378)
2. Remove `deleteBtn` and `deleteText` styles
3. Swipe-to-delete gesture remains (already well-implemented with threshold, spring animation, red reveal)

**Risk:** LOW — removing UI only. Store `removeSet` still works via swipe.
**Test:** Verify swipe-to-delete still works on web (mouse drag) and mobile.

---

### Fix 1.3: Add hitSlop to checkmark button

**Root cause:** Checkmark is 32×32 with no hitSlop. Primary action too small.
**File:** `app/components/training/SetRowPremium.tsx`

**Steps:**
1. Add `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` to the checkmark TouchableOpacity
   This brings the tap target to 48×48 (above 44×44 minimum)

**Risk:** NONE — additive prop.
**Test:** Tap the checkmark area on web/mobile.

---

### Fix 1.4: Fix Finish button contrast + safe area

**Root cause:** `finishText` uses `c.text.primary` which is dark-on-dark in some themes. No safe area inset.
**File:** `app/components/training/StickyFinishBar.tsx`

**Steps:**
1. Import `useSafeAreaInsets` from `react-native-safe-area-context`
2. Add `const insets = useSafeAreaInsets()` in the component
3. Change container style: `paddingBottom: insets.bottom` (add to the style array)
4. Change `finishText` color: `c.text.primary` → `'#FFFFFF'` (white text on accent bg always passes contrast)
5. Remove the inline `{ color: c.text.primary }` from the Text element

**Risk:** LOW — style changes only. Must verify on both iOS (home indicator) and Android.
**Test:** Visual verification on iPhone X+ simulator.

---

### Fix 1.5: Match weight and reps input styling

**Root cause:** Weight input is bold accent-colored, reps input is plain. Inconsistent.
**File:** `app/components/training/SetRowPremium.tsx`

**Steps:**
1. Apply the same `fontWeight: typography.weight.bold` and `fontSize: typography.size.md` to the reps input
2. Keep both using `c.text.primary` color (not accent — accent on weight was over-styled)
3. Change weight input: remove `color: c.accent.primary`, keep bold + size

**Exact changes to styles:**
```
// Remove weightInput override entirely, or normalize:
weightInput: {
  width: 56,
  fontSize: typography.size.md,
  fontWeight: typography.weight.bold,
  // Remove: color: c.accent.primary
},
// Add repsInput:
repsInput: {
  fontSize: typography.size.md,
  fontWeight: typography.weight.bold,
},
```

**Risk:** LOW — style-only.
**Test:** Visual verification.

---

## PHASE 2: High — Exercise Picker & Layout (3 fixes)

### Fix 2.1: Auto-focus exercise picker search

**Root cause:** User has to tap search bar every time they open the picker.
**File:** `app/components/exercise-picker/SearchBar.tsx`

**Steps:**
1. Add `autoFocus={true}` to the TextInput

**Risk:** NONE — single prop.
**Test:** Open exercise picker, verify keyboard appears immediately.

---

### Fix 2.2: Fix equipment tag underscore replacement

**Root cause:** `.replace('_', ' ')` only replaces first underscore. Literal bug.
**File:** `app/components/exercise-picker/ExerciseCard.tsx`

**Steps:**
1. Change `.replace('_', ' ')` → `.replace(/_/g, ' ')`

**Risk:** NONE — string operation fix.
**Test:** Check equipment names with multiple underscores render correctly.

---

### Fix 2.3: Collapse RPE+RIR into single intensity column

**Root cause:** RPE (44px) + RIR (44px) + gap = ~92px. Total row exceeds 375px on small screens.
**File:** `app/components/training/ExerciseCardPremium.tsx` + `app/components/training/SetRowPremium.tsx`

**Steps:**
1. In ExerciseCardPremium column headers: replace separate RPE/RIR headers with single "Intensity" header
2. In SetRowPremium: combine RPE and RIR into a single column that shows whichever the user has configured (RPE OR RIR, not both simultaneously)
3. If both are enabled, show RPE by default with a tap to toggle to RIR (or show as "RPE/RIR" stacked vertically in the same 44px column)
4. This saves ~48px of horizontal space, bringing the row under 375px

**Alternative simpler fix:** Add `flexShrink: 1` to the weight group and previous column so they compress on small screens instead of overflowing. This avoids changing the RPE/RIR UX.

**Risk:** MEDIUM — changes the set row layout. Must test on 375px and 430px screens.
**Test:** Resize browser to 375px width, verify no horizontal overflow.

---

## PHASE 3: Polish — Android Keyboard (1 fix)

### Fix 3.1: Fix Android KeyboardAvoidingView

**Root cause:** `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — Android gets no keyboard avoidance.
**File:** `app/screens/training/ActiveWorkoutBody.tsx`

**Steps:**
1. Change `undefined` → `'height'` for Android:
   `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`
2. Add `keyboardVerticalOffset` if needed (test on Android emulator)

**Risk:** LOW — platform-specific behavior change. iOS unchanged.
**Test:** Open workout on Android, tap a weight input, verify keyboard doesn't cover it.

---

## RISK MATRIX

| Fix | Risk | Reason |
|-----|------|--------|
| 1.1 (opacity flip) | LOW | Style-only |
| 1.2 (remove delete btn) | LOW | Removing UI, swipe still works |
| 1.3 (hitSlop) | NONE | Additive prop |
| 1.4 (finish bar) | LOW | Style + safe area |
| 1.5 (input styling) | LOW | Style-only |
| 2.1 (auto-focus) | NONE | Single prop |
| 2.2 (underscore) | NONE | String fix |
| 2.3 (RPE/RIR collapse) | MEDIUM | Layout change, needs testing |
| 3.1 (Android keyboard) | LOW | Platform-specific |

## FILES MODIFIED

| File | Fixes |
|------|-------|
| `app/components/training/SetRowPremium.tsx` | 1.1, 1.2, 1.3, 1.5 |
| `app/components/training/StickyFinishBar.tsx` | 1.4 |
| `app/components/exercise-picker/SearchBar.tsx` | 2.1 |
| `app/components/exercise-picker/ExerciseCard.tsx` | 2.2 |
| `app/components/training/ExerciseCardPremium.tsx` | 2.3 |
| `app/screens/training/ActiveWorkoutBody.tsx` | 3.1 |

Total: 6 files, ~50 lines changed.
