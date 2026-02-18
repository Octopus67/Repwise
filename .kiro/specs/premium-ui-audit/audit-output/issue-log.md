# Issue Log — Hypertrophy OS Premium UI/UX Audit

> Compiled from all 8 audit phases. Each issue has: ID, severity, category, title, file path(s), current state, target state, effort estimate, roadmap phase, and requirement reference.
> Sorted by severity (Critical → High → Medium → Low), then by category.

---

## Summary Table — Issues by Severity × Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| SCREEN (Screen States) | 7 | 18 | 1 | 0 | 26 |
| COMP (Component) | 0 | 10 | 23 | 2 | 35 |
| COLOR (Color System) | 2 | 3 | 8 | 0 | 13 |
| TYPO (Typography) | 0 | 1 | 4 | 3 | 8 |
| SPACE (Spacing) | 0 | 2 | 10 | 0 | 12 |
| ANIM (Animation) | 0 | 17 | 13 | 0 | 30 |
| BENCH (Benchmark) | 0 | 5 | 5 | 0 | 10 |
| A11Y (Accessibility) | 2 | 9 | 14 | 0 | 25 |
| **Total** | **11** | **65** | **78** | **5** | **159** |

**Total Effort Estimate: ~195 hours**

---

## Critical Issues (11)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| SCREEN-001 | screen-state | DashboardScreen missing dedicated empty state | `app/screens/dashboard/DashboardScreen.tsx` | Articles section shows inline text; no `EmptyState` for zero-data dashboard | Add `EmptyState` component with "Log your first meal" CTA | 2 | 2 | 1.3 |
| SCREEN-002 | screen-state | DashboardScreen missing error state | `app/screens/dashboard/DashboardScreen.tsx` | All API errors silently caught — shows stale/zero data | Add error banner with retry action | 2 | 2 | 1.3 |
| SCREEN-004 | screen-state | LogsScreen missing error state | `app/screens/logs/LogsScreen.tsx` | All API errors silently caught in `loadData` | Add error state with retry | 1.5 | 2 | 1.3 |
| SCREEN-005 | screen-state | AnalyticsScreen missing error state | `app/screens/analytics/AnalyticsScreen.tsx` | All API errors silently caught in `loadAnalytics` | Add error banner with retry | 1.5 | 2 | 1.3 |
| SCREEN-007 | screen-state | ProfileScreen missing empty state | `app/screens/profile/ProfileScreen.tsx` | No empty state when profile data fails to load | Add skeleton on loading, `EmptyState` if fetch fails | 0.5 | 2 | 1.3 |
| SCREEN-008 | screen-state | ProfileScreen missing loading state | `app/screens/profile/ProfileScreen.tsx` | No skeleton or loading indicator | Add `Skeleton` components for profile sections | 2 | 2 | 1.3 |
| SCREEN-009 | screen-state | ProfileScreen missing error state | `app/screens/profile/ProfileScreen.tsx` | Silent catch — no user-facing error | Add error handling with retry | 1.5 | 2 | 1.3 |
| COLOR-001 | color | text.muted fails WCAG AA on bg.base | `app/theme/tokens.ts` | `#64748B` on `#0A0E13` = 4.06:1 | Replace with `#758599` → 4.72:1 | 0.5 | 1 | 3.2 |
| COLOR-002 | color | text.muted fails WCAG AA on bg.surface | `app/theme/tokens.ts` | `#64748B` on `#12171F` = 3.84:1 | Replace with `#7B8DA1` → 4.72:1 | 0.5 | 1 | 3.2 |
| A11Y-001 | accessibility | RestTimer gear icon touch target 26×26pt | `app/components/training/RestTimer.tsx` | `padding: spacing[1]` (4px) = 26×26pt | `minWidth: 44, minHeight: 44` or increase padding | 0.5 | 1 | 8.1 |
| A11Y-002 | accessibility | SetTypeSelector pill touch target ~28×16pt | `app/components/training/SetTypeSelector.tsx` | `paddingVertical: 0`, `minWidth: 28` = ~28×16pt | Add `minHeight: 44` to pill style | 0.5 | 1 | 8.1 |

---

## High Issues (65)

### SCREEN — High (18)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| SCREEN-003 | screen-state | LogsScreen nutrition tab missing empty state | `app/screens/logs/LogsScreen.tsx` | Nutrition tab shows meal slots but no `EmptyState` when zero entries | Add `EmptyState` for nutrition tab | 1 | 2 | 1.3 |
| SCREEN-006 | screen-state | AnalyticsScreen missing overflow handling | `app/screens/analytics/AnalyticsScreen.tsx` | Exercise pill text not truncated | Add `numberOfLines={1}` to exercise pill text | 0.5 | 3 | 1.2 |
| SCREEN-010 | screen-state | ActiveWorkoutScreen missing loading skeleton | `app/screens/training/ActiveWorkoutScreen.tsx` | No loading state during initial session fetch | Add brief skeleton during initialization | 1 | 3 | 1.2 |
| SCREEN-011 | screen-state | ActiveWorkoutScreen missing overflow handling | `app/screens/training/ActiveWorkoutScreen.tsx` | Exercise names not truncated | Add `numberOfLines={1}` to exercise name text | 0.5 | 3 | 1.2 |
| SCREEN-012 | screen-state | SessionDetailScreen missing overflow handling | `app/screens/training/SessionDetailScreen.tsx` | Exercise names not truncated | Add `numberOfLines={1}` | 0.5 | 3 | 1.2 |
| SCREEN-013 | screen-state | SessionDetailView missing overflow handling | `app/screens/training/SessionDetailView.tsx` | Exercise names not truncated | Add `numberOfLines={1}` | 0.5 | 3 | 1.2 |
| SCREEN-014 | screen-state | ExercisePickerScreen missing overflow handling | `app/screens/exercise-picker/ExercisePickerScreen.tsx` | Exercise names in list not truncated | Verify `ExerciseCard` uses `numberOfLines` | 0.5 | 3 | 1.2 |
| SCREEN-015 | screen-state | MealPlanScreen missing overflow handling | `app/screens/meal-prep/MealPlanScreen.tsx` | Food names not truncated | Add `numberOfLines={1}` to food name style | 0.5 | 3 | 1.2 |
| SCREEN-016 | screen-state | PrepSundayFlow missing overflow handling | `app/screens/meal-prep/PrepSundayFlow.tsx` | No text truncation | Add `numberOfLines` where needed | 0.5 | 3 | 1.2 |
| SCREEN-017 | screen-state | ShoppingListView missing empty state | `app/screens/meal-prep/ShoppingListView.tsx` | No empty state when list is empty | Add `EmptyState` when `items.length === 0` | 1 | 3 | 1.3 |
| SCREEN-018 | screen-state | ShoppingListView missing overflow handling | `app/screens/meal-prep/ShoppingListView.tsx` | Item names not truncated | Add `numberOfLines={1}` | 0.5 | 3 | 1.2 |
| SCREEN-019 | screen-state | CoachingScreen missing loading state | `app/screens/coaching/CoachingScreen.tsx` | No skeleton during initial load | Add `Skeleton` components | 1.5 | 3 | 1.2 |
| SCREEN-020 | screen-state | CoachingScreen missing error state | `app/screens/coaching/CoachingScreen.tsx` | Silent catch on `loadData` | Add error banner with retry | 1 | 3 | 1.3 |
| SCREEN-021 | screen-state | CommunityScreen missing loading state | `app/screens/community/CommunityScreen.tsx` | No loading indicator | Add brief loading state | 0.5 | 3 | 1.2 |
| SCREEN-022 | screen-state | CommunityScreen missing error state | `app/screens/community/CommunityScreen.tsx` | Silent catch — uses defaults | Add subtle error indicator | 0.5 | 3 | 1.3 |
| SCREEN-023 | screen-state | LearnScreen missing loading state | `app/screens/learn/LearnScreen.tsx` | No skeleton during article fetch | Add `Skeleton` pattern | 1 | 3 | 1.2 |
| SCREEN-024 | screen-state | HealthReportsScreen missing loading state | `app/screens/health/HealthReportsScreen.tsx` | No skeleton during `loadReports` | Add `Skeleton` for report cards | 1 | 3 | 1.2 |
| SCREEN-025 | screen-state | RecoveryCheckinModal not using ModalContainer | `app/components/modals/RecoveryCheckinModal.tsx` | Uses raw `<Modal>` with RN `animationType="slide"` | Migrate to `ModalContainer` | 1.5 | 2 | 1.5 |

### SCREEN — High (continued)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| SCREEN-027 | screen-state | FatigueBreakdownModal not using ModalContainer | `app/components/analytics/FatigueBreakdownModal.tsx` | Uses raw `<Modal>` with `animationType="slide"` | Migrate to `ModalContainer` | 1 | 2 | 1.5 |
| SCREEN-028 | screen-state | UpgradeModal not using ModalContainer | `app/components/premium/UpgradeModal.tsx` | Uses raw `<Modal>` with `animationType="slide"` | Migrate to `ModalContainer` | 1 | 2 | 1.5 |
| SCREEN-029 | screen-state | BottomTabNavigator slideFromRight uses RN Animated | `app/navigation/BottomTabNavigator.tsx` | `slideFromRight` uses `Animated` + `Easing` from react-native | Note: React Navigation requires RN Animated for card interpolators | 3 | 1 | 6.2 |

### COMP — High (10)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| COMP-001 | animation | PRBanner uses RN Animated instead of Reanimated | `app/components/training/PRBanner.tsx` | `Animated.spring` from react-native | Migrate to `withSpring` from reanimated using `springs.bouncy` | 2 | 1 | 2.6 |
| COMP-002 | animation | RestTimerRing uses RN Animated | `app/components/training/RestTimerRing.tsx` | `Animated.timing` from react-native | Migrate to `withTiming` from reanimated | 1.5 | 1 | 2.6 |
| COMP-003 | animation | RestTimerV2 uses RN Animated | `app/components/training/RestTimerV2.tsx` | `Animated.timing` from react-native | Migrate to Reanimated; compose RestTimerRing | 2 | 1 | 2.6 |
| COMP-004 | animation | RestTimerBar uses RN Animated | `app/components/training/RestTimerBar.tsx` | `Animated.spring` from react-native | Migrate to `withSpring` using `springs.gentle` | 1 | 1 | 2.6 |
| COMP-005 | animation | ExerciseDetailSheet uses RN Animated | `app/components/training/ExerciseDetailSheet.tsx` | `Animated.spring` + `Animated.timing` | Migrate to Reanimated | 2 | 1 | 2.6 |
| COMP-006 | animation | PreviousPerformance uses RN Animated for skeleton | `app/components/training/PreviousPerformance.tsx` | Custom `Animated.timing` pulse loop | Replace with `useSkeletonPulse` hook | 1 | 1 | 2.6 |
| COMP-007 | animation | OverloadSuggestionBadge uses RN Animated | `app/components/training/OverloadSuggestionBadge.tsx` | `Animated` from react-native | Migrate to Reanimated | 1 | 1 | 2.6 |
| COMP-008 | animation | BodySilhouette uses RN Animated | `app/components/analytics/BodySilhouette.tsx` | `Animated.timing` for region press | Migrate to Reanimated `withTiming` | 1 | 1 | 2.6 |
| COMP-013 | animation | PRBanner uses custom spring config | `app/components/training/PRBanner.tsx` | damping:12, stiffness:200 (no preset) | Use `springs.bouncy` for celebration | 0.5 | 1 | 6.3 |
| COMP-035 | consistency | RestTimer uses 64px font outside type scale | `app/components/training/RestTimer.tsx` | `fontSize: typography.size['3xl'] * 2` = 64px | Add `typography.size['5xl']` token or use `3xl` | 1 | 1 | 4.1 |

### COLOR — High (3)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| COLOR-011 | color | Macro colors fail CVD distinguishability under protanopia | `app/components/dashboard/MacroRingsRow.tsx`, `app/components/nutrition/BudgetBar.tsx` | 3/6 pairs fail ≥3:1 under protanopia simulation | Add text labels to all macro displays; consider pattern differentiation | 2 | 2 | 3.5 |
| COLOR-012 | color | Macro colors fail CVD distinguishability under deuteranopia | `app/components/dashboard/MacroRingsRow.tsx`, `app/components/nutrition/BudgetBar.tsx` | 3/6 pairs fail ≥3:1 under deuteranopia | Add text labels to all macro displays; consider pattern differentiation | 0 | 2 | 3.5 |
| COLOR-013 | color | Macro colors fail CVD distinguishability under tritanopia | `app/components/dashboard/MacroRingsRow.tsx`, `app/components/nutrition/BudgetBar.tsx` | 0/6 pairs pass ≥3:1 under tritanopia — all fail | Add pattern differentiation (dashed/dotted ring strokes) | 2 | 2 | 3.5 |

### TYPO — High (1)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| TYPO-003 | typography | Missing tabular-nums on all numeric displays | `app/components/nutrition/BudgetBar.tsx`, `app/components/common/ProgressRing.tsx`, `app/components/training/RestTimer.tsx`, `app/components/dashboard/StreakIndicator.tsx`, `app/components/analytics/ExpenditureTrendCard.tsx`, `app/screens/logs/LogsScreen.tsx`, `app/screens/analytics/AnalyticsScreen.tsx` | No `fontVariant` set on any numeric text in main app | Add `fontVariant: typography.numeric.fontVariant` to all 9 numeric components | 3 | 1 | 4.3 |

### SPACE — High (2)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| SPACE-010 | density | ActiveWorkoutScreen flat spacing hierarchy | `app/screens/training/ActiveWorkoutScreen.tsx` | All exercise cards separated by uniform `spacing[4]`; no visual grouping | Add `spacing[6]` gap before superset groups | 1.5 | 2 | 5.3 |
| SPACE-011 | thumb-zone | DashboardScreen Quick Actions not in thumb zone | `app/screens/dashboard/DashboardScreen.tsx` | Quick Action buttons in top 30% of scroll content | Consider FAB or sticky bottom quick-action bar | 3 | 3 | 5.5 |

### ANIM — High (17)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| ANIM-001 | animation-library | PRBanner uses RN Animated | `app/components/training/PRBanner.tsx` | `Animated.spring` from react-native | Migrate to `withSpring(1, springs.bouncy)` | 2 | 1 | 6.2 |
| ANIM-002 | animation-library | RestTimerRing uses RN Animated | `app/components/training/RestTimerRing.tsx` | `Animated.timing` from react-native | Migrate to `withTiming` from reanimated | 1.5 | 1 | 6.2 |
| ANIM-003 | animation-library | RestTimerV2 uses RN Animated | `app/components/training/RestTimerV2.tsx` | `Animated.timing` from react-native | Migrate to reanimated; compose RestTimerRing | 2 | 1 | 6.2 |
| ANIM-004 | animation-library | RestTimerBar uses RN Animated | `app/components/training/RestTimerBar.tsx` | `Animated.spring` from react-native | Migrate to `withSpring(0, springs.gentle)` | 1 | 1 | 6.2 |
| ANIM-005 | animation-library | ExerciseDetailSheet uses RN Animated | `app/components/training/ExerciseDetailSheet.tsx` | `Animated.spring` + `Animated.timing` | Migrate to reanimated | 2 | 1 | 6.2 |
| ANIM-006 | animation-library | PreviousPerformance custom skeleton | `app/components/training/PreviousPerformance.tsx` | Custom `Animated.loop` pulse | Replace with `useSkeletonPulse` hook | 1 | 1 | 6.2 |
| ANIM-007 | animation-library | OverloadSuggestionBadge uses RN Animated | `app/components/training/OverloadSuggestionBadge.tsx` | `Animated` from react-native | Migrate to reanimated | 1 | 1 | 6.2 |
| ANIM-008 | animation-library | BodySilhouette uses RN Animated | `app/components/analytics/BodySilhouette.tsx` | `Animated.timing` for region press | Migrate to `withTiming` from reanimated | 1 | 1 | 6.2 |
| ANIM-010 | animation-library | ActiveWorkoutScreen SetRow uses RN Animated | `app/screens/training/ActiveWorkoutScreen.tsx` | `Animated.timing` for bg tint | Migrate to `withTiming`+`useAnimatedStyle` | 1 | 1 | 6.2 |
| ANIM-015 | loading-state | ProfileScreen missing skeleton loading | `app/screens/profile/ProfileScreen.tsx` | No loading indicator | Add `Skeleton` import and loading state | 1.5 | 1 | 6.4 |
| ANIM-016 | loading-state | CoachingScreen missing skeleton loading | `app/screens/coaching/CoachingScreen.tsx` | No skeleton; only button loading | Add `Skeleton` import and loading state | 1.5 | 1 | 6.4 |
| ANIM-017 | loading-state | CommunityScreen missing skeleton loading | `app/screens/community/CommunityScreen.tsx` | No loading indicator | Add `Skeleton` import and loading state | 1.5 | 2 | 6.4 |
| ANIM-018 | loading-state | LearnScreen missing skeleton loading | `app/screens/learn/LearnScreen.tsx` | No loading indicator | Add `Skeleton` import and loading state | 1.5 | 2 | 6.4 |
| ANIM-019 | loading-state | HealthReportsScreen missing skeleton | `app/screens/health/HealthReportsScreen.tsx` | No loading indicator | Add `Skeleton` import and loading state | 1.5 | 2 | 6.4 |
| ANIM-020 | loading-state | NutritionReportScreen uses ActivityIndicator | `app/screens/nutrition/NutritionReportScreen.tsx` | `ActivityIndicator` (not Skeleton) | Replace with `Skeleton` for consistency | 1 | 2 | 6.4 |
| ANIM-025 | empty-state | ProgressPhotosScreen missing EmptyState | `app/screens/profile/ProgressPhotosScreen.tsx` | No empty state for zero photos | Add `EmptyState` with camera icon and CTA | 1 | 1 | 6.7 |
| ANIM-027 | error-state | No per-screen ErrorBoundary wrapping | All screens | Only app-root ErrorBoundary | Add ErrorBoundary per screen/tab | 3 | 2 | 6.8 |

### BENCH — High (5)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| BENCH-001 | benchmark | Missing tabular-nums on 9 numeric components | Multiple (see TYPO-003) | `fontVariant` not set on any numeric text | Add `fontVariant: typography.numeric.fontVariant` | 3 | 1 | 7.2 |
| BENCH-002 | benchmark | No glow effect on ProgressRing | `app/components/common/ProgressRing.tsx` | Flat SVG circles; `glowShadow` utility unused | Conditional glow at ≥80% fill | 1.5 | 2 | 7.2 |
| BENCH-003 | benchmark | BudgetBar progress fill has no animation | `app/components/nutrition/BudgetBar.tsx` | Width set directly — instant jump | Animated fill using Reanimated `withTiming` | 1.5 | 2 | 7.2 |
| BENCH-004 | benchmark | TrendLineChart missing gradient fill | `app/components/charts/TrendLineChart.tsx` | `<Polyline fill="none">` — bare line | Add gradient fill below line | 2 | 2 | 7.3 |
| BENCH-005 | benchmark | Letter spacing tokens never applied | Multiple screens/components | `letterSpacing.tight`/`tighter` exist but unused | Apply to titles, headers, hero numbers | 2 | 2 | 7.2 |

### A11Y — High (9)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| A11Y-003 | accessibility | FilterPill height 32pt below 44pt minimum | `app/components/common/FilterPill.tsx` | `height: 32` explicit | Change to `height: 44` or add `hitSlop` | 0.5 | 1 | 8.1 |
| A11Y-016 | accessibility | usePressAnimation lacks reduce-motion support | `app/hooks/usePressAnimation.ts` | No `useReducedMotion()` check | Add reduce-motion check, return static style | 0.5 | 1 | 8.6 |
| A11Y-017 | accessibility | useStaggeredEntrance lacks native reduce-motion | `app/hooks/useStaggeredEntrance.ts` | Web fallback but no native check | Add `useReducedMotion()` check | 0.5 | 1 | 8.6 |
| A11Y-018 | accessibility | useSkeletonPulse lacks reduce-motion support | `app/hooks/useSkeletonPulse.ts` | Infinite pulse with no reduce-motion check | Return static opacity 0.5 when enabled | 0.5 | 1 | 8.6 |
| A11Y-019 | accessibility | useCountingValue lacks reduce-motion support | `app/hooks/useCountingValue.ts` | Animated counting with no reduce-motion check | Snap to target value when enabled | 0.5 | 1 | 8.6 |
| A11Y-020 | accessibility | ProgressRing animation lacks reduce-motion | `app/components/common/ProgressRing.tsx` | Spring fill with no reduce-motion check | Set progress directly without spring | 0.5 | 1 | 8.6 |
| A11Y-021 | accessibility | PRBanner animation lacks reduce-motion | `app/components/training/PRBanner.tsx` | RN Animated.spring with no reduce-motion check | Show at scale=1 immediately | 0.5 | 1 | 8.6 |
| A11Y-022 | accessibility | Skeleton component lacks reduce-motion | `app/components/common/Skeleton.tsx` | Infinite pulse on native, static on web | Use static opacity 0.5 (same as web fallback) | 0.5 | 1 | 8.6 |
| A11Y-023 | accessibility | ModalContainer animation lacks reduce-motion | `app/components/common/ModalContainer.tsx` | Slide-up/scale with no reduce-motion check | Show modal immediately without animation | 0.5 | 1 | 8.6 |

---

## Medium Issues (78)

### SCREEN — Medium (1)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| SCREEN-026 | screen-state | CelebrationModal not using ModalContainer | `app/components/achievements/CelebrationModal.tsx` | Uses raw `<Modal>` with `animationType="fade"` + Reanimated `FadeIn` | Migrate to `ModalContainer` — may need custom extension | 2 | 3 | 1.5 |

### COMP — Medium (23)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| COMP-009 | animation | Tooltip uses RN Animated | `app/components/common/Tooltip.tsx` | `Animated.timing` for fade-in | Migrate to Reanimated `withTiming` | 0.5 | 2 | 2.6 |
| COMP-010 | animation | CollapsibleSection uses LayoutAnimation | `app/components/log/CollapsibleSection.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout animations | 1 | 2 | 2.6 |
| COMP-011 | animation | AccountSection uses LayoutAnimation | `app/components/profile/AccountSection.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout animations | 1 | 2 | 2.6 |
| COMP-012 | animation | RestTimer uses LayoutAnimation | `app/components/training/RestTimer.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout animations | 1 | 2 | 2.6 |
| COMP-014 | animation | RestTimerBar hardcodes springs.gentle values | `app/components/training/RestTimerBar.tsx` | Inline damping:20, stiffness:200, mass:0.5 | Import and use `springs.gentle` token | 0.5 | 2 | 6.3 |
| COMP-015 | component | ModalContainer close button below 44pt | `app/components/common/ModalContainer.tsx` | hitSlop=8 + padding=8 + icon=18 = ~34pt | Increase hitSlop to 13 or padding to 13 | 0.5 | 2 | 8.1 |
| COMP-016 | token | ModalContainer hardcoded backdrop rgba | `app/components/common/ModalContainer.tsx` | `'rgba(0,0,0,0.6)'` | Use `colors.bg.overlay` | 0.25 | 2 | 3.7 |
| COMP-017 | token | ModalContainer hardcoded title fontSize | `app/components/common/ModalContainer.tsx` | `fontSize: 18` | Use `typography.size.lg` | 0.25 | 2 | 4.1 |
| COMP-018 | token | EmptyState hardcoded letterSpacing | `app/components/common/EmptyState.tsx` | `letterSpacing: -0.25` | Use `letterSpacing.tight` | 0.25 | 2 | 4.1 |
| COMP-019 | token | Button hardcoded disabled opacity | `app/components/common/Button.tsx` | `opacity: 0.4` | Use `opacityScale.disabled` | 0.25 | 2 | 2.3 |
| COMP-020 | token | BarcodeScanner hardcoded fontWeight ×5 | `app/components/nutrition/BarcodeScanner.tsx` | `fontWeight: '600'`, `'700'` | Use `typography.weight.semibold`, `.bold` | 0.5 | 2 | 2.2 |
| COMP-021 | token | BarcodeScanner hardcoded rgba overlays ×3 | `app/components/nutrition/BarcodeScanner.tsx` | `rgba(0,0,0,0.6)` | Use `colors.bg.overlay` | 0.25 | 2 | 3.7 |
| COMP-022 | token | RPEBadge uses non-token orange color | `app/components/training/RPEBadge.tsx` | `#F97316` + `rgba(249,115,22,0.12)` | Add `colors.semantic.caution` tokens | 0.5 | 2 | 2.2 |
| COMP-023 | token | AchievementCard hardcoded purple | `app/components/achievements/AchievementCard.tsx` | `#8B5CF6` | Add `colors.semantic.volume` token | 0.5 | 2 | 2.2 |
| COMP-024 | token | Exercise picker hardcoded #2563EB, #FFFFFF | `app/components/exercise-picker/*.tsx` | `#2563EB` fallback, `#FFFFFF` | Use `colors.accent.primary`, `colors.text.primary` | 1 | 2 | 2.2 |
| COMP-025 | token | SwipeableRow hardcoded #FFFFFF | `app/components/common/SwipeableRow.tsx` | `color: '#FFFFFF'` | Use `colors.text.primary` | 0.25 | 2 | 2.2 |
| COMP-026 | token | FatigueBreakdownModal hardcoded fontSize | `app/components/analytics/FatigueBreakdownModal.tsx` | `fontSize: 20`, `fontSize: 40` | Use `typography.size.xl`, `typography.size['3xl']` | 0.5 | 2 | 4.1 |
| COMP-027 | token | Multiple components hardcoded rgba overlays | Various (ConfirmationSheet, RPEPicker, CelebrationModal, PreferencesSection) | Various `rgba(0,0,0,0.X)` | Use `colors.bg.overlay` or add variants | 1 | 2 | 3.7 |
| COMP-028 | token | RecipeScalingModal hardcoded borderRadius | `app/components/meal-prep/RecipeScalingModal.tsx` | `borderRadius: 16`, `8` | Use `radius.lg`, `radius.sm` | 0.25 | 3 | 5.1 |
| COMP-029 | token | AddTrainingModal hardcoded padding | `app/components/modals/AddTrainingModal.tsx` | `padding: 12` | Use `spacing[3]` | 0.25 | 3 | 5.1 |
| COMP-030 | token | MealBuilder hardcoded #ef4444 fallback | `app/components/nutrition/MealBuilder.tsx` | `colors.semantic.negative ?? '#ef4444'` | Remove fallback — token always defined | 0.25 | 3 | 3.7 |
| COMP-031 | token | BudgetBar hardcoded borderRadius 3 | `app/components/nutrition/BudgetBar.tsx` | `borderRadius: 3` | Add `radius.xs` token or use computed | 0.5 | 3 | 5.1 |
| COMP-034 | token | Card raised variant hardcoded rgba highlight | `app/components/common/Card.tsx` | `borderTopColor: 'rgba(255,255,255,0.04)'` | Add `colors.border.highlight` token | 0.5 | 2 | 3.7 |

### COLOR — Medium (8)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| COLOR-003 | color | Hardcoded purple #8B5CF6 in LearnScreen | `app/screens/learn/LearnScreen.tsx:55` | `'#8B5CF6'` for Supplements category | Add `colors.category.supplements` token | 0.5 | 2 | 3.7 |
| COLOR-004 | color | Hardcoded blue #2563EB fallback in exercise-picker | `app/components/exercise-picker/RecentExercises.tsx:27`, `ExerciseCard.tsx:32`, `ExerciseDetailSheet.tsx:113` | `'#2563EB'` as fallback | Add `colors.chart.defaultGroup` token | 0.5 | 2 | 3.7 |
| COLOR-005 | color | Hardcoded #FFFFFF in exercise-picker components | `app/components/exercise-picker/MuscleGroupIcon.tsx:11`, `RecentExercises.tsx:28`, `MuscleGroupGrid.tsx:41` | `'#FFFFFF'` for icon color | Use `colors.text.primary` | 0.5 | 2 | 3.7 |
| COLOR-006 | color | Hardcoded #FFFFFF in SwipeableRow | `app/components/common/SwipeableRow.tsx:67` | `'#FFFFFF'` for delete text | Use `colors.text.primary` | 0.25 | 2 | 3.7 |
| COLOR-007 | color | Hardcoded purple #8B5CF6 in AchievementCard | `app/components/achievements/AchievementCard.tsx:18` | `'#8B5CF6'` for volume achievement | Add shared purple token | 0.25 | 2 | 3.7 |
| COLOR-008 | color | Hardcoded orange #F97316 + rgba in RPEBadge | `app/components/training/RPEBadge.tsx:14` | `'#F97316'` and `'rgba(249,115,22,0.12)'` | Add `colors.semantic.caution` tokens | 0.5 | 2 | 3.7 |
| COLOR-009 | color | Inconsistent overlay opacities across modals | Multiple (FatigueBreakdownModal, RPEPicker, ConfirmationSheet, CelebrationModal, PreferencesSection, DashboardScreen) | 6 different rgba(0,0,0,X) values (0.3–0.7) | Standardize on `colors.bg.overlay` or add variants | 1 | 2 | 3.7 |
| COLOR-010 | color | Raw rgba border/bg values instead of tokens | `PrepSundayFlow.tsx:180`, `BottomTabNavigator.tsx:285`, `Card.tsx:41` | Hardcoded `rgba(255,255,255,0.06)` and `0.04` | Use `colors.border.subtle`; add `colors.border.highlight` | 0.5 | 2 | 3.7 |

### TYPO — Medium (4)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| TYPO-001 | typography | Screen title inconsistency — Dashboard/Profile have no title | `app/screens/dashboard/DashboardScreen.tsx`, `app/screens/profile/ProfileScreen.tsx` | No screen title text | Add `xl/semibold` title matching Logs/Analytics | 1 | 3 | 4.2 |
| TYPO-002 | typography | No letterSpacing on headings | All screen/section headers | `letterSpacing: undefined` | Apply `letterSpacing.tight` to titles, `tighter` to hero numbers | 2 | 3 | 4.2 |
| TYPO-004 | typography | Missing text truncation on user-generated text | `app/screens/training/ActiveWorkoutScreen.tsx`, `app/screens/logs/LogsScreen.tsx` | No `numberOfLines` | Add `numberOfLines={1}` with flex handling | 1 | 3 | 4.4 |
| TYPO-006 | typography | RestTimer uses computed font size (3xl × 2) | `app/components/training/RestTimer.tsx` | `fontSize: typography.size['3xl'] * 2` (64px) | Add `typography.size['5xl'] = 64` token | 0.5 | 2 | 4.1 |

### SPACE — Medium (10)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| SPACE-001 | spacing | DashboardScreen top sections lack section-level gaps | `app/screens/dashboard/DashboardScreen.tsx` | Animated.View sections have no explicit gaps | Add `marginBottom: spacing[6]` to section wrappers | 1 | 3 | 5.3 |
| SPACE-002 | spacing | AnalyticsScreen section gaps use spacing[5] | `app/screens/analytics/AnalyticsScreen.tsx` | `sectionTitle.marginTop: spacing[5]` (20px) | Change to `spacing[6]` (24px) | 0.5 | 3 | 5.3 |
| SPACE-003 | spacing | DashboardScreen hardcoded borderRadius values | `app/screens/dashboard/DashboardScreen.tsx` | `borderRadius: 12`, `borderRadius: 8` | Use `radius.md`, `radius.sm` | 0.5 | 3 | 5.1 |
| SPACE-004 | spacing | DashboardScreen hardcoded gap and fontSize | `app/screens/dashboard/DashboardScreen.tsx` | `gap: 16`, `fontSize: 13`, `fontSize: 14` | Use `spacing[4]`, `typography.size.sm`, `typography.size.base` | 0.5 | 3 | 5.1 |
| SPACE-005 | spacing | BudgetBar hardcoded progress track values | `app/components/nutrition/BudgetBar.tsx` | `height: 6`, `borderRadius: 3`, `marginBottom: 2` | Define track height constant; use `spacing[1]` | 0.5 | 3 | 5.6 |
| SPACE-006 | spacing | ExerciseCard hardcoded spacing values | `app/components/exercise-picker/ExerciseCard.tsx` | `marginTop: 4`, `paddingVertical: 2` | Use `spacing[1]` | 0.5 | 3 | 5.6 |
| SPACE-007 | spacing | ActiveWorkoutScreen set input hardcoded values | `app/screens/training/ActiveWorkoutScreen.tsx` | Platform-specific padding, hardcoded borderRadius | Use `spacing[1]`, define constants | 1 | 3 | 5.6 |
| SPACE-008 | density | DashboardScreen top-half density | `app/screens/dashboard/DashboardScreen.tsx` | No section-level gaps between major content blocks | Add `spacing[6]` marginTop to BudgetBar and MealSlotDiary | 1 | 3 | 5.3 |
| SPACE-009 | density | AnalyticsScreen slightly tight section separation | `app/screens/analytics/AnalyticsScreen.tsx` | `marginTop: spacing[5]` (20px) | Increase to `spacing[6]` (24px) | 0.5 | 3 | 5.3 |
| SPACE-012 | thumb-zone | Tab bar iconWrap below 44pt minimum | `app/navigation/BottomTabNavigator.tsx` | `iconWrap: { width: 32, height: 28 }` | Increase to 44×44 or add hitSlop | 1 | 2 | 5.5 |

### ANIM — Medium (13)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| ANIM-009 | animation-library | Tooltip uses RN Animated | `app/components/common/Tooltip.tsx` | `Animated.timing` 200ms fade | Migrate to `withTiming` from reanimated | 0.5 | 2 | 6.2 |
| ANIM-011 | animation-library | ArticleDetailScreen uses RN Animated | `app/screens/learn/ArticleDetailScreen.tsx` | `Animated.timing` for scroll progress | Migrate to reanimated | 0.5 | 2 | 6.2 |
| ANIM-012 | spring-preset | PRBanner uses custom spring config | `app/components/training/PRBanner.tsx` | damping:12, stiffness:200 (no preset) | Use `springs.bouncy` for celebration | 0.5 | 2 | 6.3 |
| ANIM-013 | spring-preset | RestTimerBar hardcodes gentle values | `app/components/training/RestTimerBar.tsx` | Inline d:20, s:200, m:0.5 | Import and use `springs.gentle` token | 0.5 | 2 | 6.3 |
| ANIM-014 | spring-preset | ExerciseDetailSheet uses RN default spring | `app/components/training/ExerciseDetailSheet.tsx` | RN Animated default spring config | Use appropriate token preset | 0.5 | 2 | 6.3 |
| ANIM-021 | haptics | PRBanner missing haptic on PR detection | `app/components/training/PRBanner.tsx` | No haptic | Add `Haptics.notificationAsync(Success)` | 0.5 | 3 | 6.6 |
| ANIM-022 | haptics | RestTimer missing haptic on completion | `app/components/training/RestTimer.tsx` | Sound only, no haptic | Add `Haptics.notificationAsync(Success)` | 0.5 | 3 | 6.6 |
| ANIM-023 | haptics | AddNutritionModal missing haptic on log | `app/components/modals/AddNutritionModal.tsx` | No haptic on success | Add `Haptics.impactAsync(Light)` | 0.5 | 3 | 6.6 |
| ANIM-024 | haptics | Workout finish missing haptic | `app/screens/training/ActiveWorkoutScreen.tsx` | No haptic on save | Add `Haptics.notificationAsync(Success)` | 0.5 | 3 | 6.6 |
| ANIM-026 | empty-state | CommunityScreen missing EmptyState | `app/screens/community/CommunityScreen.tsx` | No empty state for zero posts | Add `EmptyState` with community icon | 1 | 2 | 6.7 |
| ANIM-028 | layout-anim | RestTimer uses LayoutAnimation | `app/components/training/RestTimer.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout transitions | 1 | 3 | 6.2 |
| ANIM-029 | layout-anim | CollapsibleSection uses LayoutAnimation | `app/components/log/CollapsibleSection.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout transitions | 1 | 3 | 6.2 |
| ANIM-030 | layout-anim | AccountSection uses LayoutAnimation | `app/components/profile/AccountSection.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout transitions | 1 | 3 | 6.2 |

### BENCH — Medium (5)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| BENCH-006 | benchmark | Dashboard top sections lack section-level gaps | `app/screens/dashboard/DashboardScreen.tsx`, `app/screens/analytics/AnalyticsScreen.tsx` | 0px section gaps; `spacing[5]` instead of `spacing[6]` | Add `marginBottom: spacing[6]` to section wrappers | 1 | 3 | 7.2 |
| BENCH-007 | benchmark | TrendLineChart tooltip is flat inline view | `app/components/charts/TrendLineChart.tsx` | Inline `<View>` below chart, no elevation | Floating card with `shadows.md` near selected point | 2 | 3 | 7.3 |
| BENCH-008 | benchmark | 11 components use RN Animated instead of Reanimated | Multiple training/analytics/common components | 13 files use RN `Animated` (JS thread) | Migrate all to Reanimated | 11.5 | 2 | 7.2 |
| BENCH-009 | benchmark | Missing haptic feedback at 5+ key moments | Multiple (PRBanner, RestTimer, ProgressRing, AddNutritionModal, ActiveWorkoutScreen) | Only 4 haptic points in codebase | Add haptics at achievement/completion moments | 2 | 3 | 7.2 |
| BENCH-010 | benchmark | Single-column Dashboard wastes space on large devices | `app/screens/dashboard/DashboardScreen.tsx` | Fixed single-column regardless of device width | Responsive 2-column on devices ≥ 428pt | 6 | 3 | 7.4 |

### A11Y — Medium (14)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| A11Y-004 | accessibility | ProgressRing "Set targets" text-only tap target | `app/components/common/ProgressRing.tsx` | ~60×16pt text-only | Add `minHeight: 44` or `hitSlop={12}` | 0.5 | 2 | 8.1 |
| A11Y-005 | accessibility | MacroRingsRow rings lack macro name labels | `app/components/dashboard/MacroRingsRow.tsx` | Labels are "kcal", "g", "g", "g" — color only | Pass `label="Protein"`, `label="Carbs"`, `label="Fat"` | 1.0 | 2 | 8.3 |
| A11Y-006 | accessibility | TrendLineChart lines color-only differentiation | `app/components/charts/TrendLineChart.tsx` | Primary and secondary both solid Polyline | Add `strokeDasharray` to secondary line | 0.5 | 3 | 8.3 |
| A11Y-007 | accessibility | ModalContainer close button missing accessibilityLabel | `app/components/common/ModalContainer.tsx` | No `accessibilityLabel` (affects all 12+ modals) | Add `accessibilityLabel="Close modal"` | 0.5 | 2 | 8.5 |
| A11Y-008 | accessibility | RestTimer gear button missing accessibilityLabel | `app/components/training/RestTimer.tsx` | No `accessibilityLabel` | Add `accessibilityLabel="Timer settings"` | 0.25 | 2 | 8.5 |
| A11Y-009 | accessibility | ProgressRing missing accessibilityLabel | `app/components/common/ProgressRing.tsx` | No accessible value exposed | Add `accessibilityLabel` with value/target/percentage | 0.5 | 2 | 8.5 |
| A11Y-010 | accessibility | BudgetBar missing accessibilityLabel | `app/components/nutrition/BudgetBar.tsx` | No accessible summary | Add `accessibilityLabel` with remaining calories | 0.5 | 2 | 8.5 |
| A11Y-011 | accessibility | BodySilhouette SVG regions missing accessibilityLabel | `app/components/analytics/BodySilhouette.tsx` | No labels on SVG Path elements | Add `accessibilityLabel` per muscle group | 1.0 | 3 | 8.5 |
| A11Y-012 | accessibility | DateScroller day cells missing accessibilityLabel | `app/components/dashboard/DateScroller.tsx` | No `accessibilityLabel` on day cells | Add label with date, selected state, logged status | 0.5 | 3 | 8.5 |
| A11Y-013 | accessibility | SetTypeSelector missing accessibilityLabel | `app/components/training/SetTypeSelector.tsx` | No `accessibilityLabel` | Add label with current set type | 0.25 | 3 | 8.5 |
| A11Y-014 | accessibility | RPEPicker buttons missing accessibilityLabel | `app/components/training/RPEPicker.tsx` | No `accessibilityLabel` on value buttons | Add label with RPE/RIR value | 0.25 | 3 | 8.5 |
| A11Y-015 | accessibility | FilterPill missing accessibilityLabel | `app/components/common/FilterPill.tsx` | No `accessibilityLabel` with filter name/state | Add label with name and active state | 0.25 | 3 | 8.5 |
| A11Y-024 | accessibility | No maxFontSizeMultiplier on critical displays | `app/components/training/RestTimer.tsx`, `app/components/nutrition/BudgetBar.tsx`, `app/components/common/ProgressRing.tsx` | No `maxFontSizeMultiplier` — large scale may break layouts | Add `maxFontSizeMultiplier={1.5}` to critical numeric Text | 1.0 | 3 | 8.4 |
| A11Y-025 | accessibility | Fixed-height containers clip text at increased scale | `app/components/common/FilterPill.tsx`, `app/components/training/RPEPicker.tsx`, `app/components/training/RPEBadge.tsx` | `height: 32/44/24` — text clips at 1.5x+ | Replace `height` with `minHeight` | 1.0 | 3 | 8.4 |

---

## Low Issues (5)

| ID | Category | Title | File(s) | Current State | Target State | Effort (h) | Phase | Req |
|----|----------|-------|---------|---------------|--------------|------------|-------|-----|
| COMP-032 | token | Dot/circle borderRadius hardcoded | Multiple files | `borderRadius: N` where N=width/2 | Acceptable for circle pattern; consider `radius.full` | 0 | — | 2.2 |
| COMP-033 | token | Emoji fontSize hardcoded | PRBanner, LightingReminder, PoseSelector | Hardcoded fontSize for emoji | Platform-dependent; low priority | 0 | — | 2.2 |
| TYPO-005 | typography | Hardcoded font sizes in DashboardScreen | `app/screens/dashboard/DashboardScreen.tsx` | `fontSize: 13`, `fontSize: 14` | `typography.size.sm`, `typography.size.base` | 0.5 | 4 | 4.1 |
| TYPO-007 | typography | Line height tokens defined but never used | All screens/components | No explicit `lineHeight` in styles | Apply `lineHeight.tight` to headings, `lineHeight.normal` to body | 2 | 4 | 4.5 |
| TYPO-008 | typography | Letter spacing tokens defined but never used | All screens/components | No explicit `letterSpacing` in styles | Apply per benchmark recommendations | 2 | 4 | 4.5 |

---

## Cross-Reference Notes

Several issues overlap across categories (deduplicated in the implementation roadmap):
- **BENCH-001 ↔ TYPO-003**: Both address missing tabular-nums — single work item
- **BENCH-005 ↔ TYPO-002/TYPO-008**: Both address unused letter spacing — single work item
- **BENCH-006 ↔ SPACE-001/SPACE-002/SPACE-008**: Dashboard section gaps — single work item
- **BENCH-008 ↔ ANIM-001 through ANIM-010 ↔ COMP-001 through COMP-008**: Animation library migration — single work item
- **BENCH-009 ↔ ANIM-021 through ANIM-024**: Missing haptics — single work item

After deduplication, the unique work items total approximately **159 issues** with **~195 hours** of estimated effort.