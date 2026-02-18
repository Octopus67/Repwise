# Implementation Roadmap — Hypertrophy OS Premium UI/UX Audit

---

## Executive Summary

### Premium Score: 5.5 / 10

**Criteria**: 1–3 = MVP/functional only, 4–5 = decent but not premium, 6–7 = competitive with mid-tier apps, 8–9 = premium tier, 10 = best-in-class (Apple Fitness+ level).

**Score Breakdown**:
- Token compliance: 58% full, 42% partial → 6/10
- State coverage: 5/33 screens have all 6 states → 4/10
- Contrast compliance: 7/9 pairs pass WCAG AA → 7/10
- Animation consistency: 16 Reanimated vs 13 RN Animated → 5/10
- Touch target compliance: 5/9 elements pass 44pt → 5/10
- Benchmark gap: 10 significant gaps vs premium apps → 5/10
- Reduce-motion support: 0/9 animation files → 2/10

The app has a solid token system foundation and good structural patterns (Card variants, ModalContainer, usePressAnimation). The main gaps are: inconsistent token usage (42% partial compliance), animation library fragmentation (13 components on legacy RN Animated), zero reduce-motion support, and missing loading/error states on 6+ screens. Fixing the Critical and High issues in Phases 1–2 would raise the score to ~7/10.

---

### Top 5 Critical Issues

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | **text.muted fails WCAG AA** (COLOR-001, COLOR-002) | Captions and timestamps at 12–13px are illegible for low-vision users on dark backgrounds. Legal accessibility risk. | Change `#64748B` → `#7B8DA1` in `app/theme/tokens.ts`. Single token change, 0.5h. |
| 2 | **RestTimer gear icon 26×26pt** (A11Y-001) | During workouts with sweaty hands, users can't reliably tap the timer settings. Frustration at the most critical moment. | Add `minWidth: 44, minHeight: 44` to `gearBtn` style in `app/components/training/RestTimer.tsx`. 0.5h. |
| 3 | **SetTypeSelector pill ~28×16pt** (A11Y-002) | Set type pills are nearly untappable during active workouts. Users must precisely target a 28×16pt area. | Add `minHeight: 44` to `pill` style in `app/components/training/SetTypeSelector.tsx`. 0.5h. |
| 4 | **ProfileScreen missing loading/empty/error states** (SCREEN-007/008/009) | Profile tab — one of 4 primary tabs — shows "?" avatar and "—" email on load failure. No skeleton, no error recovery. | Add `Skeleton` loading + `EmptyState` + error banner in `app/screens/profile/ProfileScreen.tsx`. 4h. |
| 5 | **DashboardScreen missing error state** (SCREEN-002) | Dashboard silently shows stale/zero data when API fails. Users think the app is broken. | Add error banner with retry in `app/screens/dashboard/DashboardScreen.tsx`. 2h. |

---

### Top 10 Quick Wins (≤2h each)

| # | Win | File | Effort | Visual Impact |
|---|-----|------|--------|--------------|
| 1 | Fix text.muted contrast (WCAG AA) | `app/theme/tokens.ts` | 0.5h | All captions/timestamps become readable |
| 2 | Add tabular-nums to BudgetBar calorie display | `app/components/nutrition/BudgetBar.tsx` | 0.5h | Calorie numbers stop jittering on update |
| 3 | Add tabular-nums to ProgressRing center text | `app/components/common/ProgressRing.tsx` | 0.5h | Macro ring values stop shifting |
| 4 | Add glow to ProgressRing at ≥80% fill | `app/components/common/ProgressRing.tsx` | 1.5h | Rewarding visual moment on goal approach |
| 5 | Add letterSpacing.tight to screen titles | `app/screens/logs/LogsScreen.tsx`, `app/screens/analytics/AnalyticsScreen.tsx` | 0.5h | Typographic polish on every screen |
| 6 | Add section-level gaps to Dashboard top half | `app/screens/dashboard/DashboardScreen.tsx` | 1h | Dashboard feels breathable, not cramped |
| 7 | Fix RestTimer gear icon touch target | `app/components/training/RestTimer.tsx` | 0.5h | Timer settings reliably tappable during workouts |
| 8 | Fix SetTypeSelector touch target | `app/components/training/SetTypeSelector.tsx` | 0.5h | Set type selection works with sweaty fingers |
| 9 | Add reduce-motion to usePressAnimation | `app/hooks/usePressAnimation.ts` | 0.5h | Motion-sensitive users get static feedback |
| 10 | Add accessibilityLabel to ModalContainer close | `app/components/common/ModalContainer.tsx` | 0.5h | Screen readers announce close button in all 12+ modals |

---

## Phase 1: Foundation (Weeks 1–2)

**Theme**: Fix what's broken — WCAG compliance, critical touch targets, animation library unification, reduce-motion support.
**Total Effort**: ~40h

### Token System Fixes
- [ ] Fix text.muted contrast: `#64748B` → `#7B8DA1` (COLOR-001, COLOR-002) — `app/theme/tokens.ts` — 0.5h
- [ ] Add tabular-nums to all 9 numeric display components (TYPO-003, BENCH-001) — `app/components/nutrition/BudgetBar.tsx`, `app/components/common/ProgressRing.tsx`, `app/components/training/RestTimer.tsx`, `app/components/dashboard/StreakIndicator.tsx`, `app/components/analytics/ExpenditureTrendCard.tsx`, `app/screens/logs/LogsScreen.tsx`, `app/screens/analytics/AnalyticsScreen.tsx` — 3h
- [ ] Add `typography.size['5xl'] = 64` token for RestTimer (COMP-035) — `app/theme/tokens.ts`, `app/components/training/RestTimer.tsx` — 1h

### Animation Library Unification
- [ ] Migrate PRBanner to Reanimated with `springs.bouncy` (COMP-001, ANIM-001) — `app/components/training/PRBanner.tsx` — 2h
- [ ] Migrate RestTimerRing to Reanimated (COMP-002, ANIM-002) — `app/components/training/RestTimerRing.tsx` — 1.5h
- [ ] Migrate RestTimerV2 to Reanimated (COMP-003, ANIM-003) — `app/components/training/RestTimerV2.tsx` — 2h
- [ ] Migrate RestTimerBar to Reanimated with `springs.gentle` (COMP-004, ANIM-004) — `app/components/training/RestTimerBar.tsx` — 1h
- [ ] Migrate ExerciseDetailSheet to Reanimated (COMP-005, ANIM-005) — `app/components/training/ExerciseDetailSheet.tsx` — 2h
- [ ] Replace PreviousPerformance custom pulse with `useSkeletonPulse` (COMP-006, ANIM-006) — `app/components/training/PreviousPerformance.tsx` — 1h
- [ ] Migrate OverloadSuggestionBadge to Reanimated (COMP-007, ANIM-007) — `app/components/training/OverloadSuggestionBadge.tsx` — 1h
- [ ] Migrate BodySilhouette to Reanimated (COMP-008, ANIM-008) — `app/components/analytics/BodySilhouette.tsx` — 1h
- [ ] Migrate ActiveWorkoutScreen SetRow bg tint to Reanimated (ANIM-010) — `app/screens/training/ActiveWorkoutScreen.tsx` — 1h
- [ ] Use `springs.bouncy` preset in PRBanner (COMP-013) — `app/components/training/PRBanner.tsx` — 0.5h

### Critical Accessibility Fixes
- [ ] Fix RestTimer gear icon touch target to ≥44pt (A11Y-001) — `app/components/training/RestTimer.tsx` — 0.5h
- [ ] Fix SetTypeSelector pill touch target to ≥44pt (A11Y-002) — `app/components/training/SetTypeSelector.tsx` — 0.5h
- [ ] Fix FilterPill height from 32 to 44pt (A11Y-003) — `app/components/common/FilterPill.tsx` — 0.5h
- [ ] Fix ModalContainer close button to ≥44pt (COMP-015) — `app/components/common/ModalContainer.tsx` — 0.5h

### Reduce-Motion Support
- [ ] Add `useReducedMotion()` to usePressAnimation (A11Y-016) — `app/hooks/usePressAnimation.ts` — 0.5h
- [ ] Add `useReducedMotion()` to useStaggeredEntrance (A11Y-017) — `app/hooks/useStaggeredEntrance.ts` — 0.5h
- [ ] Add `useReducedMotion()` to useSkeletonPulse (A11Y-018) — `app/hooks/useSkeletonPulse.ts` — 0.5h
- [ ] Add `useReducedMotion()` to useCountingValue (A11Y-019) — `app/hooks/useCountingValue.ts` — 0.5h
- [ ] Add reduce-motion to ProgressRing (A11Y-020) — `app/components/common/ProgressRing.tsx` — 0.5h
- [ ] Add reduce-motion to PRBanner (A11Y-021) — `app/components/training/PRBanner.tsx` — 0.5h
- [ ] Add reduce-motion to Skeleton (A11Y-022) — `app/components/common/Skeleton.tsx` — 0.5h
- [ ] Add reduce-motion to ModalContainer (A11Y-023) — `app/components/common/ModalContainer.tsx` — 0.5h

### Critical Loading States
- [ ] Add Skeleton loading to ProfileScreen (ANIM-015) — `app/screens/profile/ProfileScreen.tsx` — 1.5h
- [ ] Add Skeleton loading to CoachingScreen (ANIM-016) — `app/screens/coaching/CoachingScreen.tsx` — 1.5h
- [ ] Add EmptyState to ProgressPhotosScreen (ANIM-025) — `app/screens/profile/ProgressPhotosScreen.tsx` — 1h

### Files Modified in Phase 1
`app/theme/tokens.ts`, `app/hooks/usePressAnimation.ts`, `app/hooks/useStaggeredEntrance.ts`, `app/hooks/useSkeletonPulse.ts`, `app/hooks/useCountingValue.ts`, `app/components/training/PRBanner.tsx`, `app/components/training/RestTimerRing.tsx`, `app/components/training/RestTimerV2.tsx`, `app/components/training/RestTimerBar.tsx`, `app/components/training/ExerciseDetailSheet.tsx`, `app/components/training/PreviousPerformance.tsx`, `app/components/training/OverloadSuggestionBadge.tsx`, `app/components/training/RestTimer.tsx`, `app/components/training/SetTypeSelector.tsx`, `app/components/analytics/BodySilhouette.tsx`, `app/components/common/FilterPill.tsx`, `app/components/common/ModalContainer.tsx`, `app/components/common/ProgressRing.tsx`, `app/components/common/Skeleton.tsx`, `app/components/nutrition/BudgetBar.tsx`, `app/components/dashboard/StreakIndicator.tsx`, `app/components/analytics/ExpenditureTrendCard.tsx`, `app/screens/training/ActiveWorkoutScreen.tsx`, `app/screens/logs/LogsScreen.tsx`, `app/screens/analytics/AnalyticsScreen.tsx`, `app/screens/profile/ProfileScreen.tsx`, `app/screens/coaching/CoachingScreen.tsx`, `app/screens/profile/ProgressPhotosScreen.tsx`


---

## Phase 2: Component Polish (Weeks 3–4)

**Theme**: Unify the system — token compliance, missing states on primary tabs, typography consistency, component refinements.
**Total Effort**: ~45h

### Primary Tab Screen States
- [ ] Add EmptyState to DashboardScreen (SCREEN-001) — `app/screens/dashboard/DashboardScreen.tsx` — 2h
- [ ] Add error banner with retry to DashboardScreen (SCREEN-002) — `app/screens/dashboard/DashboardScreen.tsx` — 2h
- [ ] Add EmptyState to LogsScreen nutrition tab (SCREEN-003) — `app/screens/logs/LogsScreen.tsx` — 1h
- [ ] Add error state with retry to LogsScreen (SCREEN-004) — `app/screens/logs/LogsScreen.tsx` — 1.5h
- [ ] Add error banner with retry to AnalyticsScreen (SCREEN-005) — `app/screens/analytics/AnalyticsScreen.tsx` — 1.5h
- [ ] Add EmptyState to ProfileScreen (SCREEN-007) — `app/screens/profile/ProfileScreen.tsx` — 0.5h
- [ ] Add error state with retry to ProfileScreen (SCREEN-009) — `app/screens/profile/ProfileScreen.tsx` — 1.5h

### Modal Consistency
- [ ] Migrate RecoveryCheckinModal to ModalContainer (SCREEN-025) — `app/components/modals/RecoveryCheckinModal.tsx` — 1.5h
- [ ] Migrate FatigueBreakdownModal to ModalContainer (SCREEN-027) — `app/components/analytics/FatigueBreakdownModal.tsx` — 1h
- [ ] Migrate UpgradeModal to ModalContainer (SCREEN-028) — `app/components/premium/UpgradeModal.tsx` — 1h

### Token Compliance Fixes
- [ ] Replace hardcoded rgba overlays with `colors.bg.overlay` (COLOR-009, COMP-016, COMP-021, COMP-027) — Multiple files — 1.5h
- [ ] Replace hardcoded hex colors in exercise-picker (COLOR-004, COLOR-005, COMP-024) — `app/components/exercise-picker/*.tsx` — 1h
- [ ] Add `colors.semantic.caution` token for RPE orange (COLOR-008, COMP-022) — `app/theme/tokens.ts`, `app/components/training/RPEBadge.tsx` — 0.5h
- [ ] Replace hardcoded #FFFFFF in SwipeableRow (COLOR-006, COMP-025) — `app/components/common/SwipeableRow.tsx` — 0.25h
- [ ] Add purple token for achievements (COLOR-003, COLOR-007, COMP-023) — `app/theme/tokens.ts`, `app/screens/learn/LearnScreen.tsx`, `app/components/achievements/AchievementCard.tsx` — 0.5h
- [ ] Replace raw rgba border values with tokens (COLOR-010, COMP-034) — `app/screens/meal-prep/PrepSundayFlow.tsx`, `app/navigation/BottomTabNavigator.tsx`, `app/components/common/Card.tsx` — 0.5h
- [ ] Replace ModalContainer hardcoded fontSize with token (COMP-017) — `app/components/common/ModalContainer.tsx` — 0.25h
- [ ] Replace EmptyState hardcoded letterSpacing (COMP-018) — `app/components/common/EmptyState.tsx` — 0.25h
- [ ] Replace Button hardcoded opacity with token (COMP-019) — `app/components/common/Button.tsx` — 0.25h
- [ ] Replace BarcodeScanner hardcoded fontWeight/rgba (COMP-020, COMP-021) — `app/components/nutrition/BarcodeScanner.tsx` — 0.75h
- [ ] Replace FatigueBreakdownModal hardcoded fontSize (COMP-026) — `app/components/analytics/FatigueBreakdownModal.tsx` — 0.5h
- [ ] Add RestTimer font size token (TYPO-006) — `app/theme/tokens.ts`, `app/components/training/RestTimer.tsx` — 0.5h

### Animation Refinements
- [ ] Migrate Tooltip to Reanimated (COMP-009, ANIM-009) — `app/components/common/Tooltip.tsx` — 0.5h
- [ ] Migrate CollapsibleSection to Reanimated layout (COMP-010) — `app/components/log/CollapsibleSection.tsx` — 1h
- [ ] Migrate AccountSection to Reanimated layout (COMP-011) — `app/components/profile/AccountSection.tsx` — 1h
- [ ] Migrate RestTimer LayoutAnimation to Reanimated (COMP-012) — `app/components/training/RestTimer.tsx` — 1h
- [ ] Use `springs.gentle` token in RestTimerBar (COMP-014, ANIM-013) — `app/components/training/RestTimerBar.tsx` — 0.5h
- [ ] Use token preset in ExerciseDetailSheet spring (ANIM-014) — `app/components/training/ExerciseDetailSheet.tsx` — 0.5h
- [ ] Migrate ArticleDetailScreen to Reanimated (ANIM-011) — `app/screens/learn/ArticleDetailScreen.tsx` — 0.5h
- [ ] Use `springs.bouncy` preset in PRBanner (ANIM-012) — `app/components/training/PRBanner.tsx` — 0.5h

### Loading State Additions
- [ ] Add Skeleton to CommunityScreen (ANIM-017) — `app/screens/community/CommunityScreen.tsx` — 1.5h
- [ ] Add Skeleton to LearnScreen (ANIM-018) — `app/screens/learn/LearnScreen.tsx` — 1.5h
- [ ] Add Skeleton to HealthReportsScreen (ANIM-019) — `app/screens/health/HealthReportsScreen.tsx` — 1.5h
- [ ] Replace ActivityIndicator with Skeleton in NutritionReportScreen (ANIM-020) — `app/screens/nutrition/NutritionReportScreen.tsx` — 1h
- [ ] Add EmptyState to CommunityScreen (ANIM-026) — `app/screens/community/CommunityScreen.tsx` — 1h
- [ ] Add per-screen ErrorBoundary wrapping (ANIM-027) — All tab screens — 3h

### Benchmark Visual Upgrades
- [ ] Add glow effect to ProgressRing at ≥80% fill (BENCH-002) — `app/components/common/ProgressRing.tsx` — 1.5h
- [ ] Add animated fill to BudgetBar (BENCH-003) — `app/components/nutrition/BudgetBar.tsx` — 1.5h
- [ ] Add gradient fill to TrendLineChart (BENCH-004) — `app/components/charts/TrendLineChart.tsx` — 2h
- [ ] Apply letterSpacing to titles and hero numbers (BENCH-005) — Multiple files — 2h

### Accessibility Labels
- [ ] Add accessibilityLabel to ModalContainer close (A11Y-007) — `app/components/common/ModalContainer.tsx` — 0.5h
- [ ] Add accessibilityLabel to RestTimer gear (A11Y-008) — `app/components/training/RestTimer.tsx` — 0.25h
- [ ] Add accessibilityLabel to ProgressRing (A11Y-009) — `app/components/common/ProgressRing.tsx` — 0.5h
- [ ] Add accessibilityLabel to BudgetBar (A11Y-010) — `app/components/nutrition/BudgetBar.tsx` — 0.5h
- [ ] Add macro name labels to MacroRingsRow (A11Y-005) — `app/components/dashboard/MacroRingsRow.tsx` — 1h
- [ ] Fix ProgressRing "Set targets" touch target (A11Y-004) — `app/components/common/ProgressRing.tsx` — 0.5h
- [ ] Fix tab bar iconWrap size (SPACE-012) — `app/navigation/BottomTabNavigator.tsx` — 1h
- [ ] Add CVD pattern differentiation to macro displays (COLOR-011/012/013) — `app/components/dashboard/MacroRingsRow.tsx`, `app/components/nutrition/BudgetBar.tsx` — 2h

### Spacing Fix
- [ ] Add section-level gaps to ActiveWorkoutScreen (SPACE-010) — `app/screens/training/ActiveWorkoutScreen.tsx` — 1.5h

---

## Phase 3: Screen-Level Premium (Weeks 5–6)

**Theme**: Add the premium feel — spacing/density improvements, micro-interactions, data visualization upgrades.
**Total Effort**: ~40h

### Spacing & Density
- [ ] Add section-level gaps to Dashboard top half (SPACE-001, SPACE-008, BENCH-006) — `app/screens/dashboard/DashboardScreen.tsx` — 1h
- [ ] Increase AnalyticsScreen section gaps to spacing[6] (SPACE-002, SPACE-009) — `app/screens/analytics/AnalyticsScreen.tsx` — 0.5h
- [ ] Replace hardcoded borderRadius in DashboardScreen (SPACE-003) — `app/screens/dashboard/DashboardScreen.tsx` — 0.5h
- [ ] Replace hardcoded gap/fontSize in DashboardScreen (SPACE-004) — `app/screens/dashboard/DashboardScreen.tsx` — 0.5h
- [ ] Fix BudgetBar progress track values (SPACE-005) — `app/components/nutrition/BudgetBar.tsx` — 0.5h
- [ ] Fix ExerciseCard hardcoded spacing (SPACE-006) — `app/components/exercise-picker/ExerciseCard.tsx` — 0.5h
- [ ] Fix ActiveWorkoutScreen set input values (SPACE-007) — `app/screens/training/ActiveWorkoutScreen.tsx` — 1h
- [ ] Replace hardcoded borderRadius in RecipeScalingModal (COMP-028) — `app/components/meal-prep/RecipeScalingModal.tsx` — 0.25h
- [ ] Replace hardcoded padding in AddTrainingModal (COMP-029) — `app/components/modals/AddTrainingModal.tsx` — 0.25h
- [ ] Remove MealBuilder fallback color (COMP-030) — `app/components/nutrition/MealBuilder.tsx` — 0.25h
- [ ] Fix BudgetBar hardcoded borderRadius (COMP-031) — `app/components/nutrition/BudgetBar.tsx` — 0.5h

### Screen State Completions
- [ ] Add overflow handling to AnalyticsScreen (SCREEN-006) — `app/screens/analytics/AnalyticsScreen.tsx` — 0.5h
- [ ] Add loading skeleton to ActiveWorkoutScreen (SCREEN-010) — `app/screens/training/ActiveWorkoutScreen.tsx` — 1h
- [ ] Add overflow handling to ActiveWorkoutScreen (SCREEN-011) — `app/screens/training/ActiveWorkoutScreen.tsx` — 0.5h
- [ ] Add overflow handling to SessionDetailScreen (SCREEN-012) — `app/screens/training/SessionDetailScreen.tsx` — 0.5h
- [ ] Add overflow handling to SessionDetailView (SCREEN-013) — `app/screens/training/SessionDetailView.tsx` — 0.5h
- [ ] Add overflow handling to ExercisePickerScreen (SCREEN-014) — `app/screens/exercise-picker/ExercisePickerScreen.tsx` — 0.5h
- [ ] Add overflow handling to MealPlanScreen (SCREEN-015) — `app/screens/meal-prep/MealPlanScreen.tsx` — 0.5h
- [ ] Add overflow handling to PrepSundayFlow (SCREEN-016) — `app/screens/meal-prep/PrepSundayFlow.tsx` — 0.5h
- [ ] Add EmptyState to ShoppingListView (SCREEN-017) — `app/screens/meal-prep/ShoppingListView.tsx` — 1h
- [ ] Add overflow handling to ShoppingListView (SCREEN-018) — `app/screens/meal-prep/ShoppingListView.tsx` — 0.5h
- [ ] Add Skeleton to CoachingScreen (SCREEN-019) — `app/screens/coaching/CoachingScreen.tsx` — 1.5h
- [ ] Add error state to CoachingScreen (SCREEN-020) — `app/screens/coaching/CoachingScreen.tsx` — 1h
- [ ] Add Skeleton to LearnScreen (SCREEN-023) — `app/screens/learn/LearnScreen.tsx` — 1h
- [ ] Add Skeleton to HealthReportsScreen (SCREEN-024) — `app/screens/health/HealthReportsScreen.tsx` — 1h
- [ ] Migrate CelebrationModal to ModalContainer (SCREEN-026) — `app/components/achievements/CelebrationModal.tsx` — 2h

### Micro-Interactions & Haptics
- [ ] Add haptic to PRBanner (ANIM-021) — `app/components/training/PRBanner.tsx` — 0.5h
- [ ] Add haptic to RestTimer completion (ANIM-022) — `app/components/training/RestTimer.tsx` — 0.5h
- [ ] Add haptic to AddNutritionModal success (ANIM-023) — `app/components/modals/AddNutritionModal.tsx` — 0.5h
- [ ] Add haptic to workout finish (ANIM-024) — `app/screens/training/ActiveWorkoutScreen.tsx` — 0.5h
- [ ] Migrate RestTimer LayoutAnimation (ANIM-028) — `app/components/training/RestTimer.tsx` — 1h
- [ ] Migrate CollapsibleSection LayoutAnimation (ANIM-029) — `app/components/log/CollapsibleSection.tsx` — 1h
- [ ] Migrate AccountSection LayoutAnimation (ANIM-030) — `app/components/profile/AccountSection.tsx` — 1h

### Typography Polish
- [ ] Add screen titles to Dashboard and Profile (TYPO-001) — `app/screens/dashboard/DashboardScreen.tsx`, `app/screens/profile/ProfileScreen.tsx` — 1h
- [ ] Apply letterSpacing to headings (TYPO-002) — All screen/section headers — 2h
- [ ] Add text truncation to user-generated text (TYPO-004) — `app/screens/training/ActiveWorkoutScreen.tsx`, `app/screens/logs/LogsScreen.tsx` — 1h

### Data Visualization
- [ ] Add floating tooltip to TrendLineChart (BENCH-007) — `app/components/charts/TrendLineChart.tsx` — 2h
- [ ] Add haptics at key moments (BENCH-009) — Multiple files — 2h
- [ ] Add strokeDasharray to TrendLineChart secondary line (A11Y-006) — `app/components/charts/TrendLineChart.tsx` — 0.5h

### Accessibility
- [ ] Add accessibilityLabel to BodySilhouette regions (A11Y-011) — `app/components/analytics/BodySilhouette.tsx` — 1h
- [ ] Add accessibilityLabel to DateScroller cells (A11Y-012) — `app/components/dashboard/DateScroller.tsx` — 0.5h
- [ ] Add accessibilityLabel to SetTypeSelector (A11Y-013) — `app/components/training/SetTypeSelector.tsx` — 0.25h
- [ ] Add accessibilityLabel to RPEPicker (A11Y-014) — `app/components/training/RPEPicker.tsx` — 0.25h
- [ ] Add accessibilityLabel to FilterPill (A11Y-015) — `app/components/common/FilterPill.tsx` — 0.25h
- [ ] Add maxFontSizeMultiplier to critical displays (A11Y-024) — `app/components/training/RestTimer.tsx`, `app/components/nutrition/BudgetBar.tsx`, `app/components/common/ProgressRing.tsx` — 1h
- [ ] Replace fixed height with minHeight (A11Y-025) — `app/components/common/FilterPill.tsx`, `app/components/training/RPEPicker.tsx`, `app/components/training/RPEBadge.tsx` — 1h

### Thumb-Zone
- [ ] Improve Dashboard Quick Actions positioning (SPACE-011) — `app/screens/dashboard/DashboardScreen.tsx` — 3h
- [ ] Responsive grid layout for large devices (BENCH-010) — `app/screens/dashboard/DashboardScreen.tsx` — 6h

---

## Phase 4: Final Polish (Weeks 7–8)

**Theme**: Ship it — remaining Low severity items, final accessibility, benchmark alignment.
**Total Effort**: ~10h

### Remaining Screen States
- [ ] Add loading state to CommunityScreen (SCREEN-021) — `app/screens/community/CommunityScreen.tsx` — 0.5h
- [ ] Add error indicator to CommunityScreen (SCREEN-022) — `app/screens/community/CommunityScreen.tsx` — 0.5h

### Typography Final Polish
- [ ] Replace hardcoded font sizes in DashboardScreen (TYPO-005) — `app/screens/dashboard/DashboardScreen.tsx` — 0.5h
- [ ] Apply lineHeight tokens globally (TYPO-007) — All screens/components — 2h
- [ ] Apply letterSpacing tokens per benchmark recommendations (TYPO-008) — All screens/components — 2h

### Navigation
- [ ] Evaluate BottomTabNavigator slideFromRight migration (SCREEN-029) — `app/navigation/BottomTabNavigator.tsx` — 3h (if feasible with React Navigation)

### Low Priority Token Fixes
- [ ] Audit circle borderRadius patterns (COMP-032) — Multiple files — 0h (acceptable)
- [ ] Audit emoji fontSize patterns (COMP-033) — Multiple files — 0h (acceptable)

---

## Effort Summary

| Phase | Weeks | Theme | Effort (h) | Issues Addressed |
|-------|-------|-------|-----------|-----------------|
| 1 | 1–2 | Foundation | ~40h | 11 Critical + 34 High |
| 2 | 3–4 | Component Polish | ~45h | 31 High + 30 Medium |
| 3 | 5–6 | Screen-Level Premium | ~40h | Remaining High + Medium |
| 4 | 7–8 | Final Polish | ~10h | Low + remaining Medium |
| **Total** | **8 weeks** | | **~135h** | **159 issues** |

Note: Total effort is ~135h after deduplication of overlapping issues (BENCH ↔ TYPO, BENCH ↔ ANIM, etc.). The raw issue-log total of ~195h includes duplicated effort across categories.