# Design System Specification — Hypertrophy OS

> Single source of truth for all visual primitives and usage rules.
> Compiled from audit phases 3–8. All values reference `app/theme/tokens.ts`.

---

## 1. Color Palette

### 1.1 Backgrounds

| Token | Value | Usage Rule |
|-------|-------|-----------|
| `colors.bg.base` | `#0A0E13` | App root background, screen containers. Never use inside a card. |
| `colors.bg.surface` | `#12171F` | Card backgrounds (flat variant), modal sheets, tab bar, input fields. |
| `colors.bg.surfaceRaised` | `#1A2029` | Elevated cards (raised variant), skeleton placeholders, tooltips, popovers, input fields in modals. |
| `colors.bg.overlay` | `rgba(0,0,0,0.6)` | Modal/sheet backdrop. Use this token — do not hardcode rgba values. |

### 1.2 Borders

| Token | Value | Usage Rule |
|-------|-------|-----------|
| `colors.border.subtle` | `rgba(255,255,255,0.06)` | Flat card borders, section dividers, list separators. |
| `colors.border.default` | `rgba(255,255,255,0.08)` | Raised/outlined card borders, input field borders, secondary button borders. |
| `colors.border.hover` | `rgba(255,255,255,0.12)` | Hover state borders, active date cells, interactive element highlights. |
| `colors.border.focus` | `#06B6D4` | Focus ring for keyboard/accessibility navigation. Same as `accent.primary`. |

### 1.3 Text

| Token | Value | WCAG on bg.base | WCAG on bg.surface | Usage Rule |
|-------|-------|----------------|-------------------|-----------|
| `colors.text.primary` | `#F1F5F9` | 17.70:1 ✅ | 16.74:1 ✅ | Headings, data values, primary content. |
| `colors.text.secondary` | `#94A3B8` | 7.60:1 ✅ | 7.19:1 ✅ | Labels, descriptions, secondary info. |
| `colors.text.muted` | `#64748B` | 4.06:1 ❌ | 3.84:1 ❌ | Captions, timestamps. **Recommended: change to `#7B8DA1` for WCAG AA compliance.** Only use at ≥18pt bold if keeping current value. |
| `colors.text.inverse` | `#0B0F14` | — | — | Text on light/accent backgrounds (buttons, badges). |

### 1.4 Accent, Semantic, Premium, Gradient, Chart, Macro, Heatmap

See `audit-output/token-baseline.md` for complete values. Key usage rules:
- **Accent**: `accent.primary` (#06B6D4) for CTAs, links, active states. `accent.primaryMuted` for subtle backgrounds.
- **Semantic**: `positive` for success, `negative` for errors/danger, `warning` for caution, `overTarget` for budget overshoot.
- **Premium**: `premium.gold` for PRBanner, UpgradeBanner, PremiumBadge. `goldSubtle` for backgrounds.
- **Macro**: Always pair with text labels — do not rely on color alone (CVD compliance).

### 1.5 Recommended Changes

| Token | Current | Recommended | Reason |
|-------|---------|-------------|--------|
| `colors.text.muted` | `#64748B` | `#7B8DA1` | WCAG AA compliance (4.72:1 on bg.surface) |
| *(new)* `colors.bg.surfaceElevated` | — | `#222833` | 4th surface level for tooltips/popovers (WHOOP pattern) |
| *(new)* `colors.semantic.caution` | — | `#F97316` | Orange RPE color currently hardcoded |
| *(new)* `colors.border.highlight` | — | `rgba(255,255,255,0.04)` | Card raised top border highlight |

---

## 2. Spacing Scale

### 2.1 Scale Values

| Key | Value (px) | Tier | Usage Rule |
|-----|-----------|------|-----------|
| `spacing[0]` | 0 | — | Reset only |
| `spacing[1]` | 4 | Internal | Tight gaps: icon-to-text, set row padding, tag padding |
| `spacing[2]` | 8 | Internal | Component internal padding, small gaps within a component |
| `spacing[3]` | 12 | Item | Item gaps within sections, card-to-card in same group, button vertical padding |
| `spacing[4]` | 16 | Item | Card padding (all sides), screen horizontal padding, standard gap |
| `spacing[5]` | 20 | — | Rarely used. Prefer `spacing[4]` or `spacing[6]`. |
| `spacing[6]` | 24 | Section | Section dividers, major content block separation |
| `spacing[8]` | 32 | Section | Large section gaps, overlay container padding |
| `spacing[10]` | 40 | — | Large spacing (rare) |
| `spacing[12]` | 48 | — | Scroll overscroll bottom padding |
| `spacing[16]` | 64 | — | Maximum spacing (rare) |

### 2.2 3-Tier Hierarchy Rules

| Tier | Token Range | When to Use |
|------|------------|-------------|
| **Section** | `spacing[6]`–`spacing[8]` (24–32px) | Between major screen sections (e.g., MacroRingsRow → MealSlotDiary) |
| **Item** | `spacing[3]`–`spacing[4]` (12–16px) | Between items within a section (e.g., card-to-card, row-to-row) |
| **Internal** | `spacing[1]`–`spacing[2]` (4–8px) | Within a component (e.g., icon-to-text, label-to-value) |

### 2.3 Screen Horizontal Margin Standard

All 4 primary tab screens use `padding: spacing[4]` (16px) on the root ScrollView/FlatList. This is the standard — all new screens must match.

---

## 3. Border Radius

| Token | Value | Component Mapping |
|-------|-------|------------------|
| `radius.sm` | 8px | Badges, chips, tabs, FilterPill, small tags, DateScroller active indicator |
| `radius.md` | 12px | Cards (all variants), inputs, EditableField, date loading overlay |
| `radius.lg` | 16px | Button (uses lg, not md), large cards, modals, RecipeScalingModal |
| `radius.full` | 9999px | Circles (avatars, ring containers), pills, FAB, progress track |

---

## 4. Elevation / Shadows

| Token | Usage Context |
|-------|--------------|
| `shadows.sm` | Subtle elevation: small badges, floating indicators |
| `shadows.md` | Card raised variant, modal content, floating tooltips, primary buttons |
| `shadows.lg` | High-elevation elements: popovers, dropdown menus |
| `elevation.*` | Web-only box-shadow equivalents (none/sm/md/lg/button) |
| `glowShadow(color, radius, opacity)` | Colored glow effect. Use on ProgressRing at ≥80% fill. |

---

## 5. Typography Ramp

### 5.1 Complete Hierarchy Table

| Role | Size Token | Weight Token | Letter Spacing | Line Height | Font Variant | Example |
|------|-----------|-------------|---------------|-------------|-------------|---------|
| Screen title | `typography.size.xl` (20) | `typography.weight.semibold` (600) | `letterSpacing.tight` (-0.25) | `lineHeight.tight` (1.2) | — | "Logs", "Analytics" |
| Section header | `typography.size.lg` (18) | `typography.weight.semibold` (600) | `letterSpacing.tight` (-0.25) | `lineHeight.tight` (1.2) | — | "Quick Log", "Featured" |
| Card title | `typography.size.md` (16) | `typography.weight.semibold` (600) | — | `lineHeight.tight` (1.2) | — | Card heading text |
| Body text | `typography.size.base` (14) | `typography.weight.regular` (400) | — | `lineHeight.normal` (1.5) | — | Descriptions, paragraphs |
| Secondary/caption | `typography.size.sm` (13) / `xs` (12) | `typography.weight.medium` (500) | — | `lineHeight.normal` (1.5) | — | Timestamps, metadata |
| Data value (numeric) | `typography.size.md`–`3xl` | `typography.weight.bold` (700) | `letterSpacing.tighter` (-0.5) | `lineHeight.tight` (1.2) | `typography.numeric.fontVariant` | Calorie counts, timer |
| Badge/tag label | `typography.size.xs` (12) | `typography.weight.medium` (500) | `letterSpacing.wide` (0.5) | — | — | "PRO", "NEW" |
| Mono/code | `typography.fontFamily.mono` | `typography.weight.regular` (400) | — | `lineHeight.normal` (1.5) | — | Timer display, data IDs |

### 5.2 Font Families

| Token | Value | Platform |
|-------|-------|---------|
| `typography.fontFamily.sans` | Inter | Cross-platform primary |
| `typography.fontFamily.sansIOS` | SF Pro Display | iOS system font |
| `typography.fontFamily.mono` | JetBrains Mono | Monospace for data |

---

## 6. Animation System

### 6.1 Spring Presets

| Preset | Config | Usage Rule |
|--------|--------|-----------|
| `springs.gentle` | damping:20, stiffness:200, mass:0.5 | Progress fills (ProgressRing, ProgressBar), value animations, entrance slides |
| `springs.snappy` | damping:15, stiffness:400, mass:0.3 | Press feedback (`usePressAnimation`), interaction response, toggle switches |
| `springs.bouncy` | damping:10, stiffness:300, mass:0.5 | Celebrations (PRBanner), attention-grabbing (achievement unlock), completion pulse |

**Rule**: Never use inline spring configs. Always reference `springs.*` from tokens.

### 6.2 Timing Standards

| Duration | Token | Usage |
|----------|-------|-------|
| 100ms | `motion.duration.fast` | Micro-interactions: hover feedback, color toggle |
| 200ms | `motion.duration.default` | Standard transitions: modal open/close, state changes, tooltip fade |
| 300ms | `motion.duration.slow` | Entrance animations: staggered list items, screen transitions |

### 6.3 Easing Assignments

| Easing | Token | Usage |
|--------|-------|-------|
| `Easing.out(Easing.ease)` | `motion.easing.out` | Entrance animations (elements appearing) |
| `Easing.in(Easing.ease)` | `motion.easing.in` | Exit animations (elements leaving) |
| `Easing.inOut(Easing.ease)` | `motion.easing.default` | State transitions, layout changes |

### 6.4 Stagger Rules

- `useStaggeredEntrance`: 60ms stagger delay, 300ms duration, caps at index 8
- Apply to list items, card grids, dashboard sections
- Must check `useReducedMotion()` and return static style when enabled

### 6.5 Animation Library Standard

**Reanimated** (`react-native-reanimated`) is the project standard. All new animations must use Reanimated. Exceptions:
- `SwipeableRow` — `react-native-gesture-handler` requires RN Animated
- `BottomTabNavigator` — React Navigation card interpolators require RN Animated

---

## 7. Haptic Patterns

| Trigger | Haptic Type | File |
|---------|------------|------|
| Set completion | `Haptics.impactAsync(Light)` | `ActiveWorkoutScreen.tsx` ✅ |
| Exercise swap | `Haptics.impactAsync(Medium)` | `ActiveWorkoutScreen.tsx` ✅ |
| Quick action tap | `Haptics.impactAsync(Light)` | `DashboardScreen.tsx` ✅ |
| Barcode scan | `Haptics.impactAsync(Medium)` | `BarcodeScanner.tsx` ✅ |
| PR detection | `Haptics.notificationAsync(Success)` | `PRBanner.tsx` ❌ Missing |
| Timer completion | `Haptics.notificationAsync(Success)` | `RestTimer.tsx` ❌ Missing |
| Macro goal (100%) | `Haptics.notificationAsync(Success)` | `ProgressRing.tsx` ❌ Missing |
| Meal log success | `Haptics.impactAsync(Light)` | `AddNutritionModal.tsx` ❌ Missing |
| Workout finish | `Haptics.notificationAsync(Success)` | `ActiveWorkoutScreen.tsx` ❌ Missing |

---

## 8. Component Specifications

### 8.1 Button (`app/components/common/Button.tsx`)

| Property | Value |
|----------|-------|
| Variants | `primary`, `secondary`, `ghost`, `danger` |
| Min height | 44px (touch target) |
| Padding | vertical: `spacing[3]` (12), horizontal: `spacing[6]` (24) |
| Border radius | `radius.lg` (16) |
| Press animation | `usePressAnimation` → `springs.snappy` (scale 0.97, opacity 0.9) |
| Hover state | `useHoverState` → `colors.border.hover` |
| Disabled | `opacityScale.disabled` (0.4) |
| Loading | `ActivityIndicator` replaces label |
| Letter spacing | `letterSpacing.wide` (0.5) |
| Shadow (primary) | `shadows.md` |

### 8.2 Card (`app/components/common/Card.tsx`)

| Variant | Background | Border | Shadow | Extra |
|---------|-----------|--------|--------|-------|
| flat | `colors.bg.surface` | `colors.border.subtle` | none | — |
| raised | `colors.bg.surfaceRaised` | `colors.border.default` | `shadows.md` | Top border highlight `rgba(255,255,255,0.04)` |
| outlined | transparent | `colors.border.default` | none | — |

All variants: `spacing[4]` padding, `radius.md` borderRadius, `usePressAnimation` when pressable, `useStaggeredEntrance` when animated.

### 8.3 ModalContainer (`app/components/common/ModalContainer.tsx`)

| Property | Mobile | Web |
|----------|--------|-----|
| Entry animation | Slide-up, 250ms, `Easing.out` | Scale 0.95→1, 200ms, `Easing.out` |
| Backdrop | `colors.bg.overlay` | Same |
| Close button | Icon 18px + hitSlop + padding ≥ 44pt total | Same |
| Title | `typography.size.lg`, `typography.weight.semibold` | Same |
| Drag handle | `radius.full`, `colors.bg.surfaceRaised` | Hidden |

### 8.4 EmptyState (`app/components/common/EmptyState.tsx`)

| Property | Value |
|----------|-------|
| Icon container | 48×48px |
| Icon color | `colors.text.muted` |
| Title | `typography.size.md`, `typography.weight.semibold` |
| Description | `typography.size.sm`, `colors.text.muted` |
| Action button | Standard `Button` component |
| Spacing | `spacing[8]` top, `spacing[6]` between icon and title, `spacing[3]` between title and description |

### 8.5 ProgressRing (`app/components/common/ProgressRing.tsx`)

| Property | Value |
|----------|-------|
| Default size | 96px |
| Stroke width | 8px (consider increasing to 10) |
| Track color | Macro subtle variant (0.10 opacity) |
| Fill animation | `springs.gentle` |
| Center text | `typography.size.md`, `typography.weight.bold`, `typography.numeric.fontVariant` |
| Glow (recommended) | `glowShadow(color, 16, 0.4)` at ≥80% fill |

### 8.6 BudgetBar (`app/components/nutrition/BudgetBar.tsx`)

| Property | Value |
|----------|-------|
| Container padding | `spacing[4]` |
| Progress track height | 6px (recommend 8px = `spacing[2]`) |
| Fill animation | Recommended: `withTiming` 400ms (currently static) |
| Calorie text | `typography.size['2xl']`, `typography.weight.bold`, `typography.numeric.fontVariant` |
| Macro chips | Text labels required (CVD compliance) |

### 8.7 RestTimer (`app/components/training/RestTimer.tsx`)

| Property | Value |
|----------|-------|
| Container padding | `spacing[8]` (32px) |
| Countdown font | 64px (needs `typography.size['5xl']` token) |
| Timer color | Semantic gradient: green → yellow → red |
| Completion | Sound (expo-av) + haptic (recommended) |
| Settings toggle | LayoutAnimation (recommend Reanimated) |
| Gear button | Must be ≥44pt touch target |


---

## 9. Premium Polish Checklist

50+ actionable items organized by category. Each item references a specific file.

### Color (8 items)

- [ ] 1. Update `colors.text.muted` from `#64748B` to `#7B8DA1` for WCAG AA compliance — `app/theme/tokens.ts`
- [ ] 2. Add `colors.semantic.caution` token (`#F97316`) for orange RPE — `app/theme/tokens.ts`
- [ ] 3. Add `colors.semantic.cautionSubtle` token (`rgba(249,115,22,0.12)`) — `app/theme/tokens.ts`
- [ ] 4. Add `colors.border.highlight` token (`rgba(255,255,255,0.04)`) for Card raised top border — `app/theme/tokens.ts`
- [ ] 5. Add `colors.bg.surfaceElevated` (`#222833`) as 4th surface level — `app/theme/tokens.ts`
- [ ] 6. Replace hardcoded `#FFFFFF` with `colors.text.primary` in exercise-picker components — `app/components/exercise-picker/MuscleGroupIcon.tsx`, `MuscleGroupGrid.tsx`, `RecentExercises.tsx`
- [ ] 7. Standardize overlay opacities to `colors.bg.overlay` across all modals — `app/components/analytics/FatigueBreakdownModal.tsx`, `training/ConfirmationSheet.tsx`, `training/RPEPicker.tsx`
- [ ] 8. Replace hardcoded `rgba(255,255,255,0.06)` with `colors.border.subtle` — `app/screens/meal-prep/PrepSundayFlow.tsx`, `app/navigation/BottomTabNavigator.tsx`

### Typography (8 items)

- [ ] 9. Add `fontVariant: typography.numeric.fontVariant` to BudgetBar `calorieNumber` and `macroValue` styles — `app/components/nutrition/BudgetBar.tsx`
- [ ] 10. Add `fontVariant: typography.numeric.fontVariant` to ProgressRing `centerText` style — `app/components/common/ProgressRing.tsx`
- [ ] 11. Add `fontVariant: typography.numeric.fontVariant` to RestTimer `countdown` style — `app/components/training/RestTimer.tsx`
- [ ] 12. Add `fontVariant: typography.numeric.fontVariant` to StreakIndicator `count` style — `app/components/dashboard/StreakIndicator.tsx`
- [ ] 13. Add `fontVariant: typography.numeric.fontVariant` to ExpenditureTrendCard `tdeeValue` style — `app/components/analytics/ExpenditureTrendCard.tsx`
- [ ] 14. Apply `letterSpacing: letterSpacing.tight` to screen titles in LogsScreen and AnalyticsScreen — `app/screens/logs/LogsScreen.tsx`, `app/screens/analytics/AnalyticsScreen.tsx`
- [ ] 15. Apply `letterSpacing: letterSpacing.tight` to SectionHeader title — `app/components/common/SectionHeader.tsx`
- [ ] 16. Apply `letterSpacing: letterSpacing.tighter` to hero numbers (RestTimer countdown, TDEE value, BudgetBar calorie) — `app/components/training/RestTimer.tsx`, `app/components/analytics/ExpenditureTrendCard.tsx`, `app/components/nutrition/BudgetBar.tsx`

### Spacing (7 items)

- [ ] 17. Add `marginBottom: spacing[6]` to Dashboard QuickActions and MacroRingsRow wrappers — `app/screens/dashboard/DashboardScreen.tsx`
- [ ] 18. Change AnalyticsScreen `sectionTitle.marginTop` from `spacing[5]` to `spacing[6]` — `app/screens/analytics/AnalyticsScreen.tsx`
- [ ] 19. Replace hardcoded `borderRadius: 12` with `radius.md` in DashboardScreen — `app/screens/dashboard/DashboardScreen.tsx`
- [ ] 20. Replace hardcoded `gap: 16` with `spacing[4]` in DashboardScreen — `app/screens/dashboard/DashboardScreen.tsx`
- [ ] 21. Replace hardcoded `marginTop: 4` with `spacing[1]` in ExerciseCard — `app/components/exercise-picker/ExerciseCard.tsx`
- [ ] 22. Replace hardcoded `padding: 12` with `spacing[3]` in AddTrainingModal — `app/components/modals/AddTrainingModal.tsx`
- [ ] 23. Add `spacing[6]` gap before superset groups in ActiveWorkoutScreen — `app/screens/training/ActiveWorkoutScreen.tsx`

### Animation (9 items)

- [ ] 24. Migrate PRBanner from RN Animated to Reanimated with `springs.bouncy` — `app/components/training/PRBanner.tsx`
- [ ] 25. Migrate RestTimerRing from RN Animated to Reanimated — `app/components/training/RestTimerRing.tsx`
- [ ] 26. Migrate RestTimerV2 from RN Animated to Reanimated — `app/components/training/RestTimerV2.tsx`
- [ ] 27. Migrate RestTimerBar from RN Animated to Reanimated with `springs.gentle` — `app/components/training/RestTimerBar.tsx`
- [ ] 28. Migrate ExerciseDetailSheet from RN Animated to Reanimated — `app/components/training/ExerciseDetailSheet.tsx`
- [ ] 29. Replace PreviousPerformance custom pulse with `useSkeletonPulse` hook — `app/components/training/PreviousPerformance.tsx`
- [ ] 30. Add animated fill to BudgetBar using Reanimated `withTiming` (400ms) — `app/components/nutrition/BudgetBar.tsx`
- [ ] 31. Add glow effect to ProgressRing at ≥80% fill using `glowShadow` — `app/components/common/ProgressRing.tsx`
- [ ] 32. Add completion pulse animation to ProgressRing at 100% fill — `app/components/common/ProgressRing.tsx`

### Components (6 items)

- [ ] 33. Migrate RecoveryCheckinModal to use ModalContainer — `app/components/modals/RecoveryCheckinModal.tsx`
- [ ] 34. Migrate FatigueBreakdownModal to use ModalContainer — `app/components/analytics/FatigueBreakdownModal.tsx`
- [ ] 35. Migrate UpgradeModal to use ModalContainer — `app/components/premium/UpgradeModal.tsx`
- [ ] 36. Replace Button hardcoded `opacity: 0.4` with `opacityScale.disabled` — `app/components/common/Button.tsx`
- [ ] 37. Replace ModalContainer hardcoded `fontSize: 18` with `typography.size.lg` — `app/components/common/ModalContainer.tsx`
- [ ] 38. Replace EmptyState hardcoded `letterSpacing: -0.25` with `letterSpacing.tight` — `app/components/common/EmptyState.tsx`

### Screens (6 items)

- [ ] 39. Add `EmptyState` to DashboardScreen for zero-data state — `app/screens/dashboard/DashboardScreen.tsx`
- [ ] 40. Add error banner with retry to DashboardScreen — `app/screens/dashboard/DashboardScreen.tsx`
- [ ] 41. Add `Skeleton` loading to ProfileScreen — `app/screens/profile/ProfileScreen.tsx`
- [ ] 42. Add error state with retry to ProfileScreen — `app/screens/profile/ProfileScreen.tsx`
- [ ] 43. Add `Skeleton` loading to CoachingScreen — `app/screens/coaching/CoachingScreen.tsx`
- [ ] 44. Add per-screen ErrorBoundary wrapping to all tab screens — `app/screens/dashboard/DashboardScreen.tsx`, `app/screens/logs/LogsScreen.tsx`, `app/screens/analytics/AnalyticsScreen.tsx`, `app/screens/profile/ProfileScreen.tsx`

### Accessibility (10 items)

- [ ] 45. Increase RestTimer gear icon touch target to ≥44pt — `app/components/training/RestTimer.tsx`
- [ ] 46. Increase SetTypeSelector pill touch target to ≥44pt — `app/components/training/SetTypeSelector.tsx`
- [ ] 47. Increase FilterPill height from 32 to 44pt — `app/components/common/FilterPill.tsx`
- [ ] 48. Add `useReducedMotion()` check to `usePressAnimation` — `app/hooks/usePressAnimation.ts`
- [ ] 49. Add `useReducedMotion()` check to `useStaggeredEntrance` — `app/hooks/useStaggeredEntrance.ts`
- [ ] 50. Add `useReducedMotion()` check to `useSkeletonPulse` — `app/hooks/useSkeletonPulse.ts`
- [ ] 51. Add `useReducedMotion()` check to `useCountingValue` — `app/hooks/useCountingValue.ts`
- [ ] 52. Add `accessibilityLabel="Close modal"` to ModalContainer close button — `app/components/common/ModalContainer.tsx`
- [ ] 53. Add `accessibilityLabel` with value/target/percentage to ProgressRing — `app/components/common/ProgressRing.tsx`
- [ ] 54. Add macro name labels ("Protein", "Carbs", "Fat") to MacroRingsRow rings — `app/components/dashboard/MacroRingsRow.tsx`

### Data Visualization (4 items)

- [ ] 55. Add gradient fill below trend line in TrendLineChart — `app/components/charts/TrendLineChart.tsx`
- [ ] 56. Replace inline tooltip with floating card in TrendLineChart — `app/components/charts/TrendLineChart.tsx`
- [ ] 57. Add `strokeDasharray` to secondary line in TrendLineChart for CVD — `app/components/charts/TrendLineChart.tsx`
- [ ] 58. Add ring overshoot visualization to ProgressRing when fill > 100% — `app/components/common/ProgressRing.tsx`

### Haptics (5 items)

- [ ] 59. Add `Haptics.notificationAsync(Success)` on PR detection — `app/components/training/PRBanner.tsx`
- [ ] 60. Add `Haptics.notificationAsync(Success)` on rest timer completion — `app/components/training/RestTimer.tsx`
- [ ] 61. Add `Haptics.notificationAsync(Success)` on macro goal completion (100%) — `app/components/common/ProgressRing.tsx`
- [ ] 62. Add `Haptics.impactAsync(Light)` on meal log success — `app/components/modals/AddNutritionModal.tsx`
- [ ] 63. Add `Haptics.notificationAsync(Success)` on workout finish — `app/screens/training/ActiveWorkoutScreen.tsx`

**Total: 63 actionable items**