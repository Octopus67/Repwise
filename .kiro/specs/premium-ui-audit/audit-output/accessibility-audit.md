# Accessibility Audit

## 1. Touch Target Audit

Minimum touch target: 44×44pt per Apple HIG and Material Design guidelines.

Effective touch area = element intrinsic size + padding + hitSlop.

| # | Component | File Path | Element | Intrinsic Size | Padding | hitSlop | Effective Touch Area | PASS/FAIL | Fix |
|---|-----------|-----------|---------|---------------|---------|---------|---------------------|-----------|-----|
| a | Tab bar icons | `app/navigation/BottomTabNavigator.tsx` | `TabSvgIcon` in `iconWrap` | SVG 22×22 | `iconWrap`: 32×28 container (centered) | None | 32×28pt (tab button itself is full tab width × 64pt height) | **PASS** — Tab buttons managed by `@react-navigation/bottom-tabs` fill the tab bar area (~25% width × 64pt height). The icon is 22×22 inside a 32×28 container, but the tappable area is the full tab button. | N/A |
| b | Modal close button | `app/components/common/ModalContainer.tsx` | `TouchableOpacity` close button | Icon 18×18 | `padding: 8` (inline style) | `hitSlop={8}` (all sides) | 18 + 8×2 + 8×2 = **50×50pt** | **PASS** | N/A |
| c | RestTimer gear icon | `app/components/training/RestTimer.tsx` | `TouchableOpacity` `gearBtn` | Icon 18×18 | `padding: spacing[1]` = 4px | None | 18 + 4×2 = **26×26pt** | **FAIL** | Increase padding to `spacing[3]` (12px) → 18+24=42pt, and add `hitSlop={4}` → 50pt. Or set `minWidth: 44, minHeight: 44` on `gearBtn`. |
| d | DateScroller day items | `app/components/dashboard/DateScroller.tsx` | `TouchableOpacity` `dayCell` | Text content ~20pt wide | `width: CELL_SIZE` = `(screenWidth - 32) / 7` ≈ 51pt on 390pt screen, `paddingVertical: spacing[2]` = 8px | None | ~51 × ~40pt (text height ~24 + padding 16) | **PASS** — Width ≈51pt on standard iPhone. Height depends on content but ~40pt with padding. Borderline on height for small screens. | Consider adding `minHeight: 44` to `dayCell` for safety. |
| e | ProgressRing tap targets | `app/components/common/ProgressRing.tsx` | `TouchableOpacity` on "Set targets" text | Text ~60pt wide | None explicit | None | Default size = 96×96 (ring container), but the tappable element is only the "Set targets" text inside `labelContainer`. Text is ~60×16pt. | **FAIL** — The "Set targets" `TouchableOpacity` has no padding or hitSlop. Effective area is just the text bounds (~60×16pt). | Wrap `TouchableOpacity` with `minHeight: 44, minWidth: 44` or add `hitSlop={12}` and `padding: spacing[2]`. |
| f | RPEPicker buttons | `app/components/training/RPEPicker.tsx` | `TouchableOpacity` `valueButton` | Text content | `width: 44, height: 44` explicit | None | **44×44pt** | **PASS** | N/A |
| g | SetTypeSelector options | `app/components/training/SetTypeSelector.tsx` | `TouchableOpacity` `pill` | Text ~20pt wide | `paddingHorizontal: spacing[2]` = 8px, `paddingVertical: spacing[0]` = 0px | None | `minWidth: 28`, height = text height (~16pt) + 0 padding = **~28×16pt** | **FAIL** | Add `minHeight: 44` to `pill` style, or increase `paddingVertical` to `spacing[3]` (12px) → height ≈ 16+24 = 40pt + add `hitSlop={4}`. |
| h | FilterPill components | `app/components/common/FilterPill.tsx` | `AnimatedTouchable` `pill` | Text content | `height: 32` explicit, `paddingHorizontal: spacing[4]` = 16px | None | Width ≈ text + 32px padding (PASS), Height = **32pt** | **FAIL** — Height 32pt < 44pt minimum. | Increase `height` to 44 in `pill` style, or add `hitSlop={{ top: 6, bottom: 6 }}` to reach 44pt effective. |
| i | Navigation header back buttons | `app/screens/exercise-picker/ExercisePickerScreen.tsx` | `TouchableOpacity` `backBtn` | Icon/text content | Depends on screen implementation | Varies | Varies by screen — ExercisePickerScreen has `accessibilityLabel="Go back"` with custom back button. Most screens use `headerShown: false` with no explicit back button (stack navigator default). | **PASS** (where present) — Default React Navigation back button meets 44pt. Custom implementations need verification per-screen. | Audit each custom back button for `minHeight: 44`. |

### Summary

| Status | Count | Components |
|--------|-------|------------|
| **FAIL** | 4 | RestTimer gear icon, ProgressRing "Set targets", SetTypeSelector pill, FilterPill |
| **PASS** | 5 | Tab bar icons, Modal close button, DateScroller day items, RPEPicker buttons, Navigation back buttons |
| **Borderline** | 1 | DateScroller height on small screens |

### Critical Failures

1. **RestTimer gear icon** — 26×26pt on ActiveWorkoutScreen (used during workouts with sweaty hands). Critical severity.
2. **SetTypeSelector pill** — ~28×16pt, extremely small. Used in set rows during active workout. Critical severity.
3. **FilterPill** — 32pt height. Used in ExercisePickerScreen and other filter UIs. High severity.
4. **ProgressRing "Set targets"** — ~60×16pt text-only tap target. High severity.


## 2. Color-Only Information Audit

Requirement: Information conveyed by color must also be conveyed through text, icons, or patterns (WCAG 1.4.1 Use of Color).

### 2.1 Macro Colors in MacroRingsRow

**File**: `app/components/dashboard/MacroRingsRow.tsx`

MacroRingsRow renders 4 `ProgressRing` components with labels: `"kcal"`, `"g"`, `"g"`, `"g"`.

**Finding**: The rings use distinct colors (calories=#06B6D4, protein=#22C55E, carbs=#F59E0B, fat=#F472B6) but the `label` prop passed to ProgressRing is only `"kcal"` or `"g"` — it does NOT include the macro name ("Protein", "Carbs", "Fat"). The `formatRingLabel` function in `progressRingLogic.ts` generates `subText` from the label prop.

**Verdict**: **FAIL** — The rings rely on color alone to distinguish protein/carbs/fat. All three show `"g"` as the sub-label. A color-blind user cannot tell which ring is which.

**Fix**: Pass descriptive labels: `label="Protein"`, `label="Carbs"`, `label="Fat"` instead of `"g"`. Update `formatRingLabel` to show "120g Protein" format.

### 2.2 Macro Colors in BudgetBar

**File**: `app/components/nutrition/BudgetBar.tsx`

BudgetBar renders `MacroChip` components with explicit text labels: `label="Protein"`, `label="Carbs"`, `label="Fat"`.

**Verdict**: **PASS** — Each macro has a text label alongside its color-coded value.

### 2.3 Semantic Colors in BudgetBar

**File**: `app/components/nutrition/BudgetBar.tsx`

The calorie remaining/over state uses:
- Color: `colors.semantic.overTarget` (blue) when over, `colors.accent.primary` (cyan) when under
- Text: `"kcal over"` or `"kcal remaining"` displayed via `calorieLabel`

**Verdict**: **PASS** — Text reinforcement ("kcal over" / "kcal remaining") accompanies the color change.

### 2.4 Heatmap Colors in BodyHeatMap

**File**: `app/components/analytics/BodyHeatMap.tsx` + `app/components/analytics/HeatMapLegend.tsx`

BodyHeatMap renders `HeatMapLegend` which shows 5 color swatches with text labels: "Untrained", "Below MEV", "Optimal", "Near MRV", "Above MRV".

**Verdict**: **PASS** — Legend provides text labels for each color level.

**Note**: The SVG muscle regions in `BodySilhouette` use color fills without text labels on the regions themselves. Users must cross-reference the legend. This is acceptable for a heatmap visualization but could be improved with tooltips on tap.

### 2.5 RPEBadge Color Coding

**File**: `app/components/training/RPEBadge.tsx`

RPEBadge displays a numeric value (`display` variable) alongside the color-coded pill. Colors: green (RPE 6-7), yellow (RPE 8), orange (RPE 9), red (RPE 10).

**Verdict**: **PASS** — Numeric RPE/RIR value is always displayed alongside the color.

### 2.6 Chart Trend Lines in TrendLineChart

**File**: `app/components/charts/TrendLineChart.tsx`

TrendLineChart supports:
- Primary data: solid `Polyline` (or dots if `primaryAsDots=true`)
- Secondary data: solid `Polyline` with `secondaryColor`
- Target line: dashed line (`strokeDasharray="6,4"`)

**Finding**: The target line uses a dashed pattern (distinguishable by pattern). However, primary and secondary data lines are both solid `Polyline` elements differentiated only by color. When `primaryAsDots=true`, the primary renders as dots and secondary as a line — this provides pattern differentiation.

**Verdict**: **PARTIAL PASS** — Target line has dash pattern (good). Primary vs secondary lines rely on color alone when both are solid lines. When `primaryAsDots=true`, pattern differentiation exists.

**Fix**: Add `strokeDasharray` to secondary line (e.g., `"4,3"` for short dashes) to ensure pattern differentiation regardless of `primaryAsDots` setting.

### Summary

| Element | Has Text/Pattern Reinforcement | Status |
|---------|-------------------------------|--------|
| MacroRingsRow ring labels | No — all show "g" without macro name | **FAIL** |
| BudgetBar macro chips | Yes — "Protein", "Carbs", "Fat" labels | PASS |
| BudgetBar calorie status | Yes — "kcal over" / "kcal remaining" | PASS |
| HeatMapLegend | Yes — text labels per level | PASS |
| RPEBadge | Yes — numeric value displayed | PASS |
| TrendLineChart primary vs secondary | Partial — only when primaryAsDots=true | **PARTIAL** |
| TrendLineChart target line | Yes — dashed pattern | PASS |


## 3. Screen Reader Support Audit

### 3.1 Icon-Only Button Accessibility Labels

Searched all `.tsx` files for icon-only buttons (buttons with only an `Icon` component and no visible text) and checked for `accessibilityLabel` props.

| Component | File Path | Icon | Has accessibilityLabel | Status |
|-----------|-----------|------|----------------------|--------|
| ModalContainer close button | `app/components/common/ModalContainer.tsx` | `close` icon | **No** | **FAIL** |
| RestTimer gear button | `app/components/training/RestTimer.tsx` | `gear` icon | **No** | **FAIL** |
| ExercisePickerScreen back button | `app/screens/exercise-picker/ExercisePickerScreen.tsx` | Back arrow | **Yes** — `accessibilityLabel="Go back"` | PASS |
| SearchBar clear button | `app/components/exercise-picker/SearchBar.tsx` | Close icon | **Yes** — `accessibilityLabel="Clear search"` | PASS |
| RestTimerBar expand button | `app/components/training/RestTimerBar.tsx` | Timer icon | **Yes** — `accessibilityLabel="Expand rest timer"` | PASS |
| RestTimerBar skip button | `app/components/training/RestTimerBar.tsx` | Skip text | **Yes** — `accessibilityLabel="Skip rest timer"` | PASS |
| ExerciseDetailSheet dismiss | `app/components/training/ExerciseDetailSheet.tsx` | Backdrop | **Yes** — `accessibilityLabel="Close exercise details"` | PASS |

**Key Failures**:
- **ModalContainer close button** — Used in ALL 12+ modals across the app. No `accessibilityLabel`. Screen readers will announce nothing meaningful for this button.
- **RestTimer gear button** — No `accessibilityLabel`. Screen readers cannot identify this as "Settings" or "Timer settings".

### 3.2 Custom Control Accessibility

| Component | File Path | Has Accessible Value | Status |
|-----------|-----------|---------------------|--------|
| ProgressRing | `app/components/common/ProgressRing.tsx` | **No** `accessibilityLabel` — does not expose current value, target, or percentage to screen readers | **FAIL** |
| BudgetBar | `app/components/nutrition/BudgetBar.tsx` | **No** `accessibilityLabel` — remaining calories and macro values not exposed as accessible values | **FAIL** |
| BodySilhouette SVG regions | `app/components/analytics/BodySilhouette.tsx` | **No** `accessibilityLabel` on SVG `Path` elements for muscle groups | **FAIL** |
| BodyHeatMap | `app/components/analytics/BodyHeatMap.tsx` | **No** `accessibilityLabel` on the container — volume status not exposed | **FAIL** |
| DateScroller day cells | `app/components/dashboard/DateScroller.tsx` | **No** `accessibilityLabel` — date, selected state, and logged status not announced | **FAIL** |
| MacroRingsRow | `app/components/dashboard/MacroRingsRow.tsx` | **No** `accessibilityLabel` on container — macro summary not exposed | **FAIL** |
| SetTypeSelector | `app/components/training/SetTypeSelector.tsx` | **No** `accessibilityLabel` — current set type not announced | **FAIL** |
| RPEPicker buttons | `app/components/training/RPEPicker.tsx` | **No** `accessibilityLabel` on individual value buttons | **FAIL** |
| FilterPill | `app/components/common/FilterPill.tsx` | **No** `accessibilityLabel` — filter name and active state not announced | **FAIL** |

### 3.3 Navigation Tab Accessibility

**File**: `app/navigation/BottomTabNavigator.tsx`

The tab navigator uses `@react-navigation/bottom-tabs` which provides built-in accessibility support:
- Tab items automatically get `accessibilityLabel` from the tab name
- Selected state is announced via `accessibilityState`
- `tabBarTestID` is set for each tab

**Verdict**: **PASS** — React Navigation handles tab accessibility automatically.

### 3.4 Components with Good Accessibility

Several components already have proper accessibility support:
- `CoachingModeSelector` — `accessibilityRole="radio"`, `accessibilityState`, `accessibilityLabel`
- `WeeklyCheckinCard` — All buttons have `accessibilityRole="button"` and `accessibilityLabel`
- `CollapsibleSection` — `accessibilityRole="button"`, `accessibilityState={{ expanded }}`
- `StartWorkoutCard` — All buttons have `accessibilityLabel`
- `ExerciseCard` — `accessibilityLabel` with exercise details
- `MuscleGroupGrid` — `accessibilityLabel` with exercise count
- `AchievementCard` — `accessibilityLabel` with unlock status
- `TimeRangeSelector` — `accessibilityLabel` and `accessibilityState`
- `PreferencesSection` segments — `accessibilityRole`, `accessibilityState`, `accessibilityLabel`

## 4. Dynamic Type / Text Scaling Audit

### 4.1 Typography System Analysis

**File**: `app/theme/tokens.ts`

The typography system uses fixed pixel values:
```
sizes: xs=12, sm=13, base=14, md=16, lg=18, xl=20, 2xl=24, 3xl=32
```

These are static `fontSize` values in `StyleSheet.create` blocks. React Native on iOS respects Dynamic Type only when using `allowFontScaling` (default `true` on `<Text>`), which multiplies the fixed fontSize by the system scale factor.

**Finding**: The app does NOT explicitly disable `allowFontScaling`, so React Native's default behavior allows text to scale with system settings. However:

1. **No `maxFontSizeMultiplier` set** — At 2x system scale, `3xl` (32px) becomes 64px, which could break layouts (especially RestTimer countdown at `3xl * 2 = 64px` base → 128px at 2x scale).
2. **No layout testing at increased scale** — Fixed-height containers (`FilterPill height: 32`, `RPEPicker valueButton: 44×44`, `RPEBadge height: 24`) will clip text at increased font sizes.
3. **Numeric displays** — Calorie counts, macro values, and timer displays in fixed-width containers will overflow at increased scale.

**Verdict**: **PARTIAL** — Text scaling works by default via React Native, but no explicit support for preventing layout breakage at large scales. Fixed-height containers will clip.

**Fix**: 
- Add `maxFontSizeMultiplier={1.5}` to critical numeric displays (timer, calorie counts)
- Replace fixed `height` with `minHeight` on interactive elements
- Test layouts at 1.5x and 2x system font scale


## 5. Reduce-Motion Support Audit

Requirement: Animation hooks and animated components must check `AccessibilityInfo.isReduceMotionEnabled()` (React Native) or `useReducedMotion()` (Reanimated) and skip/simplify animations when reduce-motion is enabled.

**Codebase search**: Searched all `.ts` and `.tsx` files for `isReduceMotionEnabled`, `useReducedMotion`, `reduceMotion`, `ReduceMotion` — **zero matches found**.

### Per-File Analysis

| File | Animation Type | Checks Reduce-Motion | Status | Impact |
|------|---------------|---------------------|--------|--------|
| `app/hooks/usePressAnimation.ts` | Spring scale+opacity on press (Reanimated `withSpring`) | **No** | **FAIL** | Every interactive element using this hook animates regardless of user preference |
| `app/hooks/useStaggeredEntrance.ts` | Fade+slide entrance (Reanimated `withTiming` + `withDelay`) | **No** — Has web fallback (static style on web) but NO native reduce-motion check | **FAIL** | All list items animate on mount even with reduce-motion enabled |
| `app/hooks/useSkeletonPulse.ts` | Infinite opacity pulse (Reanimated `withRepeat` + `withTiming`) | **No** | **FAIL** | Skeleton loading pulses indefinitely, can cause discomfort for motion-sensitive users |
| `app/hooks/useCountingValue.ts` | Animated number counting (Reanimated `withTiming`) | **No** | **FAIL** | Numbers animate from old to new value instead of snapping |
| `app/components/common/ProgressRing.tsx` | Spring fill animation (Reanimated `withSpring`) | **No** | **FAIL** | Ring fill animates on every value change |
| `app/components/training/PRBanner.tsx` | Spring scale-from-zero (RN `Animated.spring`) | **No** | **FAIL** | PR celebration banner scales in with spring animation |
| `app/components/common/Skeleton.tsx` | Infinite opacity pulse (Reanimated `withRepeat`) | **No** — Has web fallback (static opacity 0.5) but NO native reduce-motion check | **FAIL** | Same as useSkeletonPulse — infinite animation |
| `app/components/common/ModalContainer.tsx` | Slide-up / scale entrance (Reanimated `withTiming`) | **No** | **FAIL** | Modal open/close always animates |
| `app/components/common/FilterPill.tsx` | Color interpolation (Reanimated `withTiming`) | **No** | **FAIL** | Active/inactive state transition always animates |

### Summary

**All 9 animation files/hooks checked: 0 out of 9 support reduce-motion.**

The `useStaggeredEntrance` hook has a web fallback pattern (`Platform.OS === 'web'` → return static style) that could serve as a template for reduce-motion support. The same pattern should be applied for native:

```typescript
// Recommended pattern for all animation hooks:
import { useReducedMotion } from 'react-native-reanimated';

export function usePressAnimation() {
  const reduceMotion = useReducedMotion();
  
  // If reduce-motion is enabled, return static style with no-op handlers
  if (reduceMotion) {
    return {
      animatedStyle: { transform: [{ scale: 1 }], opacity: 1 },
      onPressIn: () => {},
      onPressOut: () => {},
    };
  }
  
  // ... existing animation logic
}
```

### Severity Assessment

This is a **High severity** accessibility issue. Users who enable "Reduce Motion" in iOS Settings or Android Accessibility settings expect animations to be minimized. The complete absence of reduce-motion support means:
- Motion-sensitive users may experience discomfort
- Users with vestibular disorders cannot use the app comfortably
- Fails WCAG 2.3.3 (Animation from Interactions) at AAA level


## 6. Issue Log — A11Y Issues

| ID | Severity | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Requirement |
|----|----------|----------|-------|---------|---------------|--------------|------------|-------|-------------|
| A11Y-001 | Critical | accessibility | RestTimer gear icon touch target 26×26pt | `app/components/training/RestTimer.tsx` | `padding: spacing[1]` (4px) on gear icon = 26×26pt effective | `minWidth: 44, minHeight: 44` or `padding: spacing[4]` + `hitSlop={4}` for ≥44pt | 0.5 | 1 | Req 8.1 |
| A11Y-002 | Critical | accessibility | SetTypeSelector pill touch target ~28×16pt | `app/components/training/SetTypeSelector.tsx` | `paddingVertical: spacing[0]` (0px), `minWidth: 28` = ~28×16pt | Add `minHeight: 44` to pill style or `paddingVertical: spacing[3]` (12px) | 0.5 | 1 | Req 8.1 |
| A11Y-003 | High | accessibility | FilterPill height 32pt below 44pt minimum | `app/components/common/FilterPill.tsx` | `height: 32` explicit | Change to `height: 44` or `minHeight: 44`, or add `hitSlop={{ top: 6, bottom: 6 }}` | 0.5 | 1 | Req 8.1 |
| A11Y-004 | High | accessibility | ProgressRing "Set targets" text-only tap target | `app/components/common/ProgressRing.tsx` | TouchableOpacity wraps text only (~60×16pt) | Add `minHeight: 44, minWidth: 44` to TouchableOpacity or add `hitSlop={12}` | 0.5 | 2 | Req 8.1 |
| A11Y-005 | Medium | accessibility | MacroRingsRow rings lack macro name labels | `app/components/dashboard/MacroRingsRow.tsx` | Labels are "kcal", "g", "g", "g" — color is only differentiator | Pass `label="Protein"`, `label="Carbs"`, `label="Fat"` and update formatRingLabel | 1.0 | 2 | Req 8.3 |
| A11Y-006 | Medium | accessibility | TrendLineChart primary vs secondary lines color-only | `app/components/charts/TrendLineChart.tsx` | Both primary and secondary use solid Polyline, differentiated by color only | Add `strokeDasharray="4,3"` to secondary Polyline for pattern differentiation | 0.5 | 3 | Req 8.3 |
| A11Y-007 | Medium | accessibility | ModalContainer close button missing accessibilityLabel | `app/components/common/ModalContainer.tsx` | No `accessibilityLabel` on close TouchableOpacity (affects all 12+ modals) | Add `accessibilityLabel="Close modal"` and `accessibilityRole="button"` | 0.5 | 2 | Req 8.5 |
| A11Y-008 | Medium | accessibility | RestTimer gear button missing accessibilityLabel | `app/components/training/RestTimer.tsx` | No `accessibilityLabel` on gear icon button | Add `accessibilityLabel="Timer settings"` and `accessibilityRole="button"` | 0.25 | 2 | Req 8.5 |
| A11Y-009 | Medium | accessibility | ProgressRing missing accessibilityLabel with value/target | `app/components/common/ProgressRing.tsx` | No accessible value exposed for screen readers | Add `accessibilityLabel={`${label}: ${value} of ${target}, ${percentage}%`}` to container | 0.5 | 2 | Req 8.5 |
| A11Y-010 | Medium | accessibility | BudgetBar missing accessibilityLabel | `app/components/nutrition/BudgetBar.tsx` | No accessible summary of remaining calories/macros | Add `accessibilityLabel` with remaining calories summary to container | 0.5 | 2 | Req 8.5 |
| A11Y-011 | Medium | accessibility | BodySilhouette SVG regions missing accessibilityLabel | `app/components/analytics/BodySilhouette.tsx` | SVG Path elements for muscle groups have no accessibility labels | Add `accessibilityLabel` with muscle group name and volume status to each region | 1.0 | 3 | Req 8.5 |
| A11Y-012 | Medium | accessibility | DateScroller day cells missing accessibilityLabel | `app/components/dashboard/DateScroller.tsx` | No `accessibilityLabel` on day cell TouchableOpacity | Add `accessibilityLabel={`${dayName} ${dayNumber}, ${isSelected ? 'selected' : ''} ${isLogged ? 'has entries' : ''}`}` | 0.5 | 3 | Req 8.5 |
| A11Y-013 | Medium | accessibility | SetTypeSelector missing accessibilityLabel | `app/components/training/SetTypeSelector.tsx` | No `accessibilityLabel` announcing current set type | Add `accessibilityLabel={`Set type: ${SET_TYPE_LABELS[value]}`}` | 0.25 | 3 | Req 8.5 |
| A11Y-014 | Medium | accessibility | RPEPicker buttons missing accessibilityLabel | `app/components/training/RPEPicker.tsx` | No `accessibilityLabel` on individual value buttons | Add `accessibilityLabel={`${mode === 'rpe' ? 'RPE' : 'RIR'} ${getLabel(value)}`}` | 0.25 | 3 | Req 8.5 |
| A11Y-015 | Medium | accessibility | FilterPill missing accessibilityLabel | `app/components/common/FilterPill.tsx` | No `accessibilityLabel` with filter name and active state | Add `accessibilityLabel={`${label} filter, ${active ? 'active' : 'inactive'}`}` | 0.25 | 3 | Req 8.5 |
| A11Y-016 | High | accessibility | usePressAnimation lacks reduce-motion support | `app/hooks/usePressAnimation.ts` | No check for `useReducedMotion()` — animates regardless of user preference | Add `useReducedMotion()` check, return static style when enabled | 0.5 | 1 | Req 8.6 |
| A11Y-017 | High | accessibility | useStaggeredEntrance lacks native reduce-motion support | `app/hooks/useStaggeredEntrance.ts` | Has web fallback but no native reduce-motion check | Add `useReducedMotion()` check, return `STATIC_STYLE` when enabled (same as web fallback) | 0.5 | 1 | Req 8.6 |
| A11Y-018 | High | accessibility | useSkeletonPulse lacks reduce-motion support | `app/hooks/useSkeletonPulse.ts` | Infinite pulse animation with no reduce-motion check | Add `useReducedMotion()` check, return static opacity 0.5 when enabled | 0.5 | 1 | Req 8.6 |
| A11Y-019 | High | accessibility | useCountingValue lacks reduce-motion support | `app/hooks/useCountingValue.ts` | Animated number counting with no reduce-motion check | Add `useReducedMotion()` check, snap to target value immediately when enabled | 0.5 | 1 | Req 8.6 |
| A11Y-020 | High | accessibility | ProgressRing animation lacks reduce-motion support | `app/components/common/ProgressRing.tsx` | Spring fill animation with no reduce-motion check | Add `useReducedMotion()` check, set progress directly without spring when enabled | 0.5 | 1 | Req 8.6 |
| A11Y-021 | High | accessibility | PRBanner animation lacks reduce-motion support | `app/components/training/PRBanner.tsx` | RN Animated.spring scale animation with no reduce-motion check | Add `AccessibilityInfo.isReduceMotionEnabled()` check, show at scale=1 immediately | 0.5 | 1 | Req 8.6 |
| A11Y-022 | High | accessibility | Skeleton component lacks reduce-motion support | `app/components/common/Skeleton.tsx` | Infinite pulse on native, static on web — no native reduce-motion check | Add `useReducedMotion()` check, use static opacity 0.5 (same as web fallback) | 0.5 | 1 | Req 8.6 |
| A11Y-023 | High | accessibility | ModalContainer animation lacks reduce-motion support | `app/components/common/ModalContainer.tsx` | Slide-up/scale animations with no reduce-motion check | Add `useReducedMotion()` check, show modal immediately without animation | 0.5 | 1 | Req 8.6 |
| A11Y-024 | Medium | accessibility | Dynamic Type — no maxFontSizeMultiplier on critical displays | `app/components/training/RestTimer.tsx`, `app/components/nutrition/BudgetBar.tsx`, `app/components/common/ProgressRing.tsx` | No `maxFontSizeMultiplier` set — large system font scale may break fixed-height layouts | Add `maxFontSizeMultiplier={1.5}` to critical numeric Text components | 1.0 | 3 | Req 8.4 |
| A11Y-025 | Medium | accessibility | Fixed-height containers clip text at increased font scale | `app/components/common/FilterPill.tsx`, `app/components/training/RPEPicker.tsx`, `app/components/training/RPEBadge.tsx` | `height: 32` (FilterPill), `height: 44` (RPEPicker), `height: 24` (RPEBadge) — text clips at 1.5x+ scale | Replace `height` with `minHeight` to allow text expansion | 1.0 | 3 | Req 8.4 |

### Issue Summary

| Severity | Count | Categories |
|----------|-------|------------|
| Critical | 2 | Touch targets on ActiveWorkoutScreen (RestTimer gear, SetTypeSelector) |
| High | 9 | Touch target (FilterPill), reduce-motion (8 files) |
| Medium | 14 | Accessibility labels (9), color-only info (2), Dynamic Type (2), touch target (1) |
| **Total** | **25** | |

### Effort Summary

| Phase | Issue Count | Total Effort (h) |
|-------|------------|-------------------|
| Phase 1 (Foundation) | 10 | 5.0h |
| Phase 2 (Component Polish) | 6 | 3.25h |
| Phase 3 (Screen-Level Premium) | 9 | 5.25h |
| **Total** | **25** | **13.5h** |

