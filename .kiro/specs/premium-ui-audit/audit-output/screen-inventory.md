# Screen Inventory and State Coverage Audit

## 1. Screen Catalog

All `.tsx` screen files under `app/screens/` (17 directories). The `app/screens/more/` directory is empty — skipped. Onboarding steps are sub-components of `OnboardingWizard`, not standalone screens.

### 6-State Legend

| State | Definition | Detection Method |
|-------|-----------|-----------------|
| Default | Renders with real data | Component returns JSX unconditionally |
| Empty | Shows `EmptyState` or equivalent when no data | Imports `EmptyState` or has zero-data branch |
| Loading | Shows `Skeleton` / `ActivityIndicator` while fetching | Imports `Skeleton` or has `isLoading` guard |
| Error | Shows error message with recovery action | Has error state + retry/back action |
| Interactive | Press/hover feedback on tappable elements | Uses `usePressAnimation`, `useHoverState`, or `activeOpacity` |
| Overflow | Handles long text / extreme values | Uses `numberOfLines`, truncation, or value clamping |

### Primary Tab Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|--------|
| DashboardScreen | `app/screens/dashboard/DashboardScreen.tsx` | Dashboard | ✅ | ⚠️ Partial | ✅ Skeleton | ❌ Silent catch | ✅ `useStaggeredEntrance`, `activeOpacity`, Haptics | ✅ `numberOfLines={1}` on milestone | SCREEN-001, SCREEN-002 |
| LogsScreen | `app/screens/logs/LogsScreen.tsx` | Log | ✅ | ✅ `EmptyState` (training tab) | ✅ `SkeletonCards` | ❌ Silent catch | ✅ `useStaggeredEntrance`, `activeOpacity`, `SwipeableRow` | ❌ No `numberOfLines` on entry names | SCREEN-003, SCREEN-004 |
| AnalyticsScreen | `app/screens/analytics/AnalyticsScreen.tsx` | Analytics | ✅ | ✅ `EmptyState` per chart | ✅ `ChartSkeleton` | ❌ Silent catch | ✅ `activeOpacity` on pills/tabs | ❌ No truncation on exercise pill text | SCREEN-005, SCREEN-006 |
| ProfileScreen | `app/screens/profile/ProfileScreen.tsx` | Profile | ✅ | ❌ No empty state | ❌ No skeleton | ❌ Silent catch | ✅ `useStaggeredEntrance`, `Button` | ❌ No truncation on display name | SCREEN-007, SCREEN-008, SCREEN-009 |

### Auth Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|--------|
| LoginScreen | `app/screens/auth/LoginScreen.tsx` | Auth | ✅ | N/A | ✅ `Button loading` | ✅ Error text + inline validation | ✅ `activeOpacity`, `hitSlop` | ❌ No max-length on email | — |
| RegisterScreen | `app/screens/auth/RegisterScreen.tsx` | Auth | ✅ | N/A | ✅ `Button loading` | ✅ Error text + inline validation | ✅ `activeOpacity`, `hitSlop` | ❌ No max-length on email | — |
| ForgotPasswordScreen | `app/screens/auth/ForgotPasswordScreen.tsx` | Auth | ✅ | N/A | ✅ `Button loading` | ✅ Error text + retry | ✅ `activeOpacity` | ✅ N/A | — |

### Training Flow Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|--------|
| ActiveWorkoutScreen | `app/screens/training/ActiveWorkoutScreen.tsx` | Log→Training | ✅ | ✅ Starts empty, add exercises | ❌ No skeleton on init | ❌ `Alert.alert` on save fail only | ✅ Haptics, `Pressable`, `TouchableOpacity` | ❌ No `numberOfLines` on exercise names | SCREEN-010, SCREEN-011 |
| SessionDetailScreen | `app/screens/training/SessionDetailScreen.tsx` | Log→Training | ✅ | N/A | ✅ `Skeleton` | ✅ Error view + "Go Back" button | ✅ `activeOpacity` | ❌ No truncation on exercise names | SCREEN-012 |
| SessionDetailView | `app/screens/training/SessionDetailView.tsx` | Log→Training | ✅ | N/A | ✅ `Skeleton` | ✅ Error view + "Go Back" button | ✅ `activeOpacity` | ❌ No truncation on exercise names | SCREEN-013 |

### Nutrition Flow Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|--------|
| NutritionReportScreen | `app/screens/nutrition/NutritionReportScreen.tsx` | Analytics→Nutrition | ✅ | ✅ Custom empty state | ✅ `ActivityIndicator` | ✅ Error banner + retry | ✅ `activeOpacity` on nutrient rows | ✅ `numberOfLines={1}` on food names | — |
| RecipeBuilderScreen | `app/screens/nutrition/RecipeBuilderScreen.tsx` | Log→Nutrition | ✅ | ✅ "Search and add ingredients" | ✅ `ActivityIndicator` on search/save | ✅ `Alert.alert` on failures | ✅ `activeOpacity` | ✅ `numberOfLines={1}` on food names | — |

### Exercise Picker

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|--------|
| ExercisePickerScreen | `app/screens/exercise-picker/ExercisePickerScreen.tsx` | Log→Training | ✅ | ✅ "No exercises match" + create custom | ✅ `ActivityIndicator` | ✅ Error view + retry | ✅ `activeOpacity`, `accessibilityRole` | ❌ No truncation on exercise names in list | SCREEN-014 |

### Meal Prep Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|--------|
| MealPlanScreen | `app/screens/meal-prep/MealPlanScreen.tsx` | Profile→MealPrep | ✅ | ✅ Shows generate button when no plan | ✅ `ActivityIndicator` | ✅ Error text | ✅ `TouchableOpacity` | ❌ No truncation on food names | SCREEN-015 |
| PrepSundayFlow | `app/screens/meal-prep/PrepSundayFlow.tsx` | Profile→MealPrep | ✅ | ✅ Step-based, starts empty | ✅ `ActivityIndicator` | ✅ Error text | ✅ `TouchableOpacity` | ❌ No truncation | SCREEN-016 |
| ShoppingListView | `app/screens/meal-prep/ShoppingListView.tsx` | Profile→MealPrep | ✅ | ❌ No empty state for empty list | ✅ `ActivityIndicator` | ✅ Error text | ✅ `TouchableOpacity` | ❌ No truncation on item names | SCREEN-017, SCREEN-018 |

### Secondary Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|--------|
| CoachingScreen | `app/screens/coaching/CoachingScreen.tsx` | Secondary | ✅ | ✅ `EmptyState` for requests + sessions | ❌ No skeleton | ❌ Silent catch on load | ✅ `activeOpacity`, `Button` | ✅ `numberOfLines={2}` on goals | SCREEN-019, SCREEN-020 |
| CommunityScreen | `app/screens/community/CommunityScreen.tsx` | Secondary | ✅ | ❌ No empty state (static content) | ❌ No skeleton | ❌ Silent catch | ✅ `activeOpacity` | ❌ No truncation | SCREEN-021, SCREEN-022 |
| LearnScreen | `app/screens/learn/LearnScreen.tsx` | Secondary | ✅ | ✅ `EmptyState` with category pills | ❌ No skeleton | ❌ Silent catch | ✅ `useStaggeredEntrance`, `activeOpacity`, `FilterPill` | ✅ `numberOfLines={2}` on preview | SCREEN-023 |
| ArticleDetailScreen | `app/screens/learn/ArticleDetailScreen.tsx` | Secondary | ✅ | N/A | ✅ `ActivityIndicator` | ✅ Error view + retry | ✅ `activeOpacity`, `hitSlop` | ✅ Markdown renders naturally | — |
| HealthReportsScreen | `app/screens/health/HealthReportsScreen.tsx` | Secondary | ✅ | ✅ `EmptyState` | ❌ No skeleton | ❌ Silent catch | ✅ `activeOpacity`, `Button` | ❌ No truncation on marker names | SCREEN-024 |
| FounderStoryScreen | `app/screens/founder/FounderStoryScreen.tsx` | Secondary | ✅ | N/A (fallback content) | ✅ `ActivityIndicator` | ✅ Fallback content on error | ✅ `activeOpacity` | ❌ No truncation on timeline events | — |
| WeeklyReportScreen | `app/screens/reports/WeeklyReportScreen.tsx` | Secondary | ✅ | ✅ `EmptyState` | ✅ `Skeleton` | ✅ Error view + retry | ✅ `activeOpacity`, `hitSlop` | ❌ No truncation on recommendation text | — |
| ProgressPhotosScreen | `app/screens/profile/ProgressPhotosScreen.tsx` | Profile→Photos | ✅ | ✅ Custom empty state | ✅ `ActivityIndicator` | ✅ `Alert.alert` on error | ✅ `activeOpacity` | ❌ No truncation | — |

### Onboarding Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|--------|
| OnboardingScreen | `app/screens/onboarding/OnboardingScreen.tsx` | Onboarding | ✅ | N/A | ✅ `ActivityIndicator` (restoring) | ✅ API error text | ✅ `activeOpacity`, `Button` | ✅ Validation clamps values | — |
| OnboardingWizard | `app/screens/onboarding/OnboardingWizard.tsx` | Onboarding | ✅ | N/A | ❌ No skeleton (steps load instantly) | ❌ Delegated to steps | ✅ Reanimated progress bar, `activeOpacity` | ✅ N/A | — |

Onboarding steps (`app/screens/onboarding/steps/` — 11 files: BodyBasicsStep, BodyCompositionStep, BodyMeasurementsStep, DietStyleStep, FastTrackStep, FoodDNAStep, GoalStep, IntentStep, LifestyleStep, SummaryStep, TDEERevealStep) are sub-components of OnboardingWizard. They share the parent's loading/error handling and are not standalone screens.

### Stale Directory

`app/screens/more/` — empty directory, no files. Likely a stale placeholder.


---

## 2. Navigation Graph

Source: `app/navigation/BottomTabNavigator.tsx`

### 4 Stack Navigators

| Stack | Root Screen | Nested Screens |
|-------|------------|----------------|
| `DashboardStackScreen` | DashboardScreen | ExercisePicker, ActiveWorkout, WeeklyReport, ArticleDetail, Learn |
| `LogsStackScreen` | LogsScreen | ExercisePicker, ActiveWorkout, SessionDetail (→ SessionDetailView) |
| `AnalyticsStackScreen` | AnalyticsScreen | NutritionReport, WeeklyReport |
| `ProfileStackScreen` | ProfileScreen | Learn, ArticleDetail, Coaching, Community, FounderStory, HealthReports, ProgressPhotos, MealPlan, ShoppingList, PrepSunday |

### Screen Registrations (20 total across 4 stacks)

- Dashboard stack: 6 screens (DashboardHome, ExercisePicker, ActiveWorkout, WeeklyReport, ArticleDetail, Learn)
- Logs stack: 4 screens (LogsHome, ExercisePicker, ActiveWorkout, SessionDetail)
- Analytics stack: 3 screens (AnalyticsHome, NutritionReport, WeeklyReport)
- Profile stack: 11 screens (ProfileHome, Learn, ArticleDetail, Coaching, Community, FounderStory, HealthReports, ProgressPhotos, MealPlan, ShoppingList, PrepSunday)

### Custom Transition: `slideFromRight`

```typescript
function slideFromRight({ current, layouts }: StackCardInterpolationProps) {
  return {
    cardStyle: {
      transform: [{ translateX: current.progress.interpolate({ inputRange: [0, 1], outputRange: [layouts.screen.width * 0.3, 0] }) }],
      opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }),
    },
  };
}
```

**⚠️ FINDING: Uses `Animated` from `react-native` (via `StackCardInterpolationProps` which uses RN Animated interpolation), NOT `react-native-reanimated`.** The `Animated` import at the top of the file is from `react-native`. The `Easing` import is also from `react-native`. This is an animation library inconsistency — the rest of the app standardizes on Reanimated.

- Push transition: `timing`, 250ms, `Easing.out(Easing.ease)`
- Pop transition: `timing`, 200ms, `Easing.inOut(Easing.ease)`

### Tab Bar Configuration

- 4 tabs: Home, Log, Analytics, Profile
- Tab bar height: 64px
- Active tint: `colors.accent.primary` (#06B6D4)
- Inactive tint: `colors.text.muted` (#64748B)
- Tab icons: Custom SVG via `TabSvgIcon` (22×22, strokeWidth 1.8)
- Active icon wrap: 32×28 with `colors.accent.primaryMuted` background, borderRadius 8
- Tab label: `typography.size.xs` (12px), `typography.weight.medium` (500)
- Tab bar background: `colors.bg.surface` (#12171F)
- Border top: `rgba(255,255,255,0.06)` — matches `colors.border.subtle`

### Modal Presentation Points

No explicit modal presentation via navigation — all modals are rendered inline as components within screens:
- DashboardScreen: UpgradeModal, AddNutritionModal, AddTrainingModal, AddBodyweightModal, QuickAddModal, MealBuilder, CelebrationModal, RecoveryCheckinModal
- LogsScreen: AddNutritionModal, AddTrainingModal
- AnalyticsScreen: FatigueBreakdownModal
- ProfileScreen: UpgradeModal

---

## 3. Modal Catalog

12 modal components across the codebase.

### Modals Using `ModalContainer` (Consistent Pattern)

| Modal | File Path | Uses ModalContainer | Entry Animation | Backdrop Dismissal | Keyboard Avoidance |
|-------|-----------|--------------------|-----------------|--------------------|---------------------|
| AddNutritionModal | `app/components/modals/AddNutritionModal.tsx` | ✅ Yes | Reanimated slide-up (mobile 250ms) / scale (web 200ms) via ModalContainer | ✅ Via ModalContainer `onClose` | ✅ Via ModalContainer + ScrollView `keyboardShouldPersistTaps` |
| AddTrainingModal | `app/components/modals/AddTrainingModal.tsx` | ✅ Yes | Reanimated via ModalContainer | ✅ Via ModalContainer | ✅ Via ModalContainer |
| AddBodyweightModal | `app/components/modals/AddBodyweightModal.tsx` | ✅ Yes | Reanimated via ModalContainer | ✅ Via ModalContainer | ✅ Via ModalContainer |
| QuickAddModal | `app/components/modals/QuickAddModal.tsx` | ✅ Yes | Reanimated via ModalContainer | ✅ Via ModalContainer | ✅ Via ModalContainer |
| DrillDownModal | `app/components/analytics/DrillDownModal.tsx` | ✅ Yes | Reanimated via ModalContainer | ✅ Via ModalContainer | N/A (read-only) |
| RecipeScalingModal | `app/components/meal-prep/RecipeScalingModal.tsx` | ✅ Yes | Reanimated via ModalContainer | ✅ Via ModalContainer | ✅ Via ModalContainer |
| BlockCreationModal | `app/components/periodization/BlockCreationModal.tsx` | ✅ Yes | Reanimated via ModalContainer | ✅ Via ModalContainer | ✅ Via ModalContainer + ScrollView |
| BlockTemplateModal | `app/components/periodization/BlockTemplateModal.tsx` | ✅ Yes | Reanimated via ModalContainer | ✅ Via ModalContainer | N/A (selection only) |

### Modals NOT Using `ModalContainer` (Inconsistent)

| Modal | File Path | Uses ModalContainer | Entry Animation | Backdrop Dismissal | Keyboard Avoidance | Issue |
|-------|-----------|--------------------|-----------------|--------------------|---------------------|-------|
| RecoveryCheckinModal | `app/components/modals/RecoveryCheckinModal.tsx` | ❌ Raw `<Modal>` | RN `animationType="slide"` (not Reanimated) | ✅ `onRequestClose` | ❌ None | SCREEN-025 |
| CelebrationModal | `app/components/achievements/CelebrationModal.tsx` | ❌ Raw `<Modal>` | RN `animationType="fade"` + Reanimated `FadeIn` on content | ✅ `Pressable` backdrop + `onRequestClose` | N/A | SCREEN-026 |
| FatigueBreakdownModal | `app/components/analytics/FatigueBreakdownModal.tsx` | ❌ Raw `<Modal>` | RN `animationType="slide"` (not Reanimated) | ✅ `onRequestClose` | N/A (read-only) | SCREEN-027 |
| UpgradeModal | `app/compityScreen, LearnScreen, HealthReportsScreen) |
| Screens missing overflow handling | 11 |
| Total SCREEN issues | 29 |
| Critical issues | 7 |
| High issues | 19 |
| Medium issues | 1 |
| Modals audited | 12 |
| Modals using ModalContainer | 8 (67%) |
| Modals using raw Modal | 4 (33%) |
ll 6 states | 5 (LoginScreen, RegisterScreen, ForgotPasswordScreen, NutritionReportScreen, ArticleDetailScreen) |
| Screens missing empty state | 5 (DashboardScreen partial, ProfileScreen, ShoppingListView, CommunityScreen, LogsScreen nutrition tab) |
| Screens missing loading state | 6 (ProfileScreen, CoachingScreen, CommunityScreen, LearnScreen, HealthReportsScreen, ActiveWorkoutScreen) |
| Screens missing error state | 8 (DashboardScreen, LogsScreen, AnalyticsScreen, ProfileScreen, CoachingScreen, Communnavigation/BottomTabNavigator.tsx` | `slideFromRight` uses `Animated` + `Easing` from `react-native` | Migrate to Reanimated `interpolate` for consistent frame rates. Note: `@react-navigation/stack` `CardStyleInterpolators` API uses RN Animated — may require `@react-navigation/native-stack` or custom Reanimated transition | 3 | 1 |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total screen files audited | 33 (25 screens + 2 onboarding containers + 6 onboarding steps noted) |
| Screens with a-------|-------|-----------|---------------|--------------|------------|-------|
| SCREEN-029 | High | screen-state | BottomTabNavigator slideFromRight uses RN Animated | `app/-------|---|---ent State | Target State | Effort (h) | Phase |
|----| Category | Title | File Path | Curr5 | 2 |

### Navigation Issue

| ID | Severity r` for consistent animation | 1.="slide"` | Migrate to `ModalContaine`<Modal>` with RN `animationType/components/premium/UpgradeModal.tsx` | Uses raw Modal not using ModalContainer | `appte | Upgrade `animationType="slide"` | Migrate to `ModalContainer` for consistent animation | 1 | 2 |
| SCREEN-028 | High | screen-stareen-state | FatigueBreakdownModal not using ModalContainer | `app/components/analytics/FatigueBreakdownModal.tsx` | Uses raw `<Modal>` with RN High | sc027 |
| SCREEN-alContainer may need extension | 2 | 3 |animation (scale + confetti), so Modnote: celebration modals may need custom ModalContainer` — eanimated `FadeIn` | Migrate to `w `<Modal>` with `animationType="fade"` + RtionModal.tsx` | Uses raomponents/achievements/Celebra | CelebrationModal not using ModalContainer | `app/ction | 1.5 | 2 |
| SCREEN-026 | Medium | screen-statentainer` for consistent Reanimated anima---|-----------|---------------|--------------|------------|-------|
| SCREEN-025 | High | screen-state | RecoveryCheckinModal not using ModalContainer | `app/components/modals/RecoveryCheckinModal.tsx` | Uses raw `<Modal>` with RN `animationType="slide"` | Migrate to `ModalCoitle | File Path | Current State | Target State | Effort (h) | Phase |
|----|----------|----------|----ry | TIssues

| ID | Severity | Catego1 | 3 |

### Modal Consistency rts` | Add `Skeleton` for report cards during load | tsScreen.tsx` | No skeleton during `loadRepo| `app/screens/health/HealthReportsScreen missing loading state  | High | screen-state | HealthRepor-024ards` | 1 | 3 |
| SCREENattern: `LogsScreen` `SkeletonCn` cards during initial load. Png initial article fetch | Add `Skeletoen missing error state | `app/screens/community/CommunityScreen.tsx` | Silent catch — uses defaults | Acceptable since defaults exist, but add subtle error indicator | 0.5 | 4 |
| SCREEN-023 | High | screen-state | LearnScreen missing loading state | `app/screens/learn/LearnScreen.tsx` | No skeleton duri-022 | High | screen-state | CommunityScre0.5 | 4 |
| SCREENused | are rity since defaults ding state — low prioadLinks` | Add brief loa` | No loading indicator during `los/community/CommunityScreen.tsx`app/screenmmunityScreen missing loading state | ate | Co| High | screen-sttry | 1 | 3 |
| SCREEN-021 leton during initial `loadData` | Add `Skeleton` components for request/session cards during load | 1.5 | 3 |
| SCREEN-020 | High | screen-state | CoachingScreen missing error state | `app/screens/coaching/CoachingScreen.tsx` | Silent catch on `loadData` | Add error banner with re
| SCREEN-019 | High | screen-state | CoachingScreen missing loading state | `app/screens/coaching/CoachingScreen.tsx` | No ske `numberOfLines={1}` to `itemName` style | 0.5 | 3 |es not truncated | Addtem nam | Ix`oppingListView.ts overflow handling | `app/screens/meal-prep/ShhoppingListView missing3 |
| SCREEN-018 | High | screen-state | Slength === 0` after loading | 1 | pping list has zero items | Add `EmptyState` when `items.ns/meal-prep/ShoppingListView.tsx` | No empty state when shoate | ShoppingListView missing empty state | `app/scree|
| SCREEN-017 | High | screen-stberOfLines` where needed | 0.5 | 3 SundayFlow.tsx` | No text truncation | Add `numing overflow handling | `app/screens/meal-prep/Prepreen-state | MealPlanScreen missing overflow handling | `app/screens/meal-prep/MealPlanScreen.tsx` | Food names not truncated in slot rows | Add `numberOfLines={1}` to `foodName` style | 0.5 | 3 |
| SCREEN-016 | High | screen-state | PrepSundayFlow misscomponent — verify it uses `numberOfLines` | 0.5 | 3 |
| SCREEN-015 | High | sceCard` ted | Handled by `Exercistsx` | Exercise names in list not truncacise-picker/ExercisePickerScreen.ow handling | `app/screens/exer ExercisePickerScreen missing overfl 3 |
| SCREEN-014 | High | screen-state |erOfLines={1}` to `exerciseName` style | 0.5 || Exercise names not truncated | Add `numbng | `app/screens/training/SessionDetailView.tsx` ng/ActiveWorkoutScreen.tsx` | Exercise names not truncated in exercise cards | Add `numberOfLines={1}` to exercise name text | 0.5 | 3 |
| SCREEN-012 | High | screen-state | SessionDetailScreen missing overflow handling | `app/screens/training/SessionDetailScreen.tsx` | Exercise names not truncated | Add `numberOfLines={1}` to `exerciseName` style | 0.5 | 3 |
| SCREEN-013 | High | screen-state | SessionDetailView missing overflow handli--|---------------|--------------|------------|-------|
| SCREEN-010 | High | screen-state | ActiveWorkoutScreen missing loading skeleton | `app/screens/training/ActiveWorkoutScreen.tsx` | No loading state during initial session/template fetch on mount | Add brief skeleton or spinner during `mode === 'edit'` or `mode === 'template'` initialization | 1 | 3 |
| SCREEN-011 | High | screen-state | ActiveWorkoutScreen missing overflow handling | `app/screens/trainiPath | Current State | Target State | Effort (h) | Phase |
|----|----------|----------|-------|---------| Category | Title | File rity 
| ID | Seve screens)
ry | Add error handling with retry for profile data fetch | 1.5 | 2 |

### High Issues (Missing states on non-prima — "sections handle empty state gracefully" but no user-facing errorsx` | Silent catch`app/screens/profile/ProfileScreen.ten missing error state | tate | ProfileScrel | screen-s09 | Criticaen` skeleton approach | 2 | 2 |
| SCREEN-0ing load. Pattern: `DashboardScreonents for profile card, plan panel, preferences durAdd `Skeleton` comp or loading indicator during initial data fetch | eens/profile/ProfileScreen.tsx` | No skeletonileScreen missing loading state | `app/scrREEN-008 | Critical | screen-state | Profll fetches fail | 2 | 2 |
| SCon loading state during `fetchAll`, show `EmptyState` if a" email | Add skelet| 0.5 | 3 |
| SCREEN-007 | Critical | screen-state | ProfileScreen missing empty state | `app/screens/profile/ProfileScreen.tsx` | No empty state when profile data fails to load — shows "?" avatar and "—ns/analytics/AnalyticsScreen.tsx` | Exercise pill text not truncated — long exercise names can overflow | Add `numberOfLines={1}` to exercise pill text or use `flexShrink` `app/screeling | ssing overflow handn-state | AnalyticsScreen mi
| SCREEN-006 | High | screewith retry when data fetch fails | 1.5 | 2 |te with retry. Pattern: `RefreshControl` already exists — add error banner above content | 1.5 | 2 |
| SCREEN-005 | Critical | screen-state | AnalyticsScreen missing error state | `app/screens/analytics/AnalyticsScreen.tsx` | All API errors silently caught in `loadAnalytics` | Add error banner 03 | High | screen-state | LogsScreen nutrition tab missing empty state | `app/screens/logs/LogsScreen.tsx` | Nutrition tab shows meal slots with "Add to [slot]" buttons but no `EmptyState` when zero entries for the day | Add `EmptyState` for nutrition tab when `todayEntries.length === 0`. Pattern: existing `EmptyState` on training tab | 1 | 2 |
| SCREEN-004 | Critical | screen-state | LogsScreen missing error state | `app/screens/logs/LogsScreen.tsx` | All API errors silently caught in `loadData` | Add error staomponent when all KPIs are zero (first-time user). Pattern: `EmptyState` from `app/components/common/EmptyState.tsx` with "Log your first meal" CTA | 2 | 2 |
| SCREEN-002 | Critical | screen-state | DashboardScreen missing error state | `app/screens/dashboard/DashboardScreen.tsx` | All API errors silently caught — dashboard shows stale/zero data with no user feedback | Add error banner with retry action when `loadDashboardData` fails. Pattern: error banner from `NutritionReportScreen.tsx` | 2 | 2 |
| SCREEN-0ty/Error missing on primary tabs)

| ID | Severity | Category | Title | File Path | Current State | Target State | Effort (h) | Phase |
|----|----------|----------|-------|-----------|---------------|--------------|------------|-------|
| SCREEN-001 | Critical | screen-state | DashboardScreen missing dedicated empty state | `app/screens/dashboard/DashboardScreen.tsx` | Articles section shows inline "No articles available right now" text; no `EmptyState` component for zero-data dashboard | Add `EmptyState` ceverity | Category | Title | File Path | Current State | Target State | Effort (h) | Phase`

### Critical Issues (EmpModalContainer` for consistency.

---

## 4. Issues — Missing State Coverage

### Issue Format
`ID | Sm react-native with inconsistent animation approaches. These 4 should be migrated to `odals use `ModalContainer` (consistent Reanimated animations). 4 modals use raw `<Modal>` fro"` (not Reanimated) | ✅ `onRequestClose` | ❌ None | SCREEN-028 |

**Summary**: 8 of 12 m/UpgradeModal.tsx` | ❌ Raw `<Modal>` | RN `animationType="slidets/premiumonen
| Default | Renders with real data | Component returns JSX unconditionally |
| Empty | Shows `EmptyState` or equivalent when no data | Imports `EmptyState` or has zero-data branch |
| Loading | Shows `Skeleton` / `ActivityIndicator` while fetching | Imports `Skeleton` or has `isLoading` guard |
| Error | Shows error message with recovery action | Has error state + retry/back action |
| Interactive | Press/hover feedback on tappable elements | Uses `usePressAnimation`, `useHoverState`, or `activeOpacity` |
| Overflow | Handles long text / extreme values | Uses `numberOfLines`, truncation, or value clamping |

### Primary Tab Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|
| DashboardScreen | `app/screens/dashboard/DashboardScreen.tsx` | Dashboard | ✅ | ⚠️ Partial | ✅ Skeleton | ❌ Silent catch | ✅ Staggered, Haptics | ✅ `numberOfLines` |
| LogsScreen | `app/screens/logs/LogsScreen.tsx` | Log | ✅ | ✅ Training tab only | ✅ SkeletonCards | ❌ Silent catch | ✅ Staggered, Swipe | ❌ No truncation |
| AnalyticsScreen | `app/screens/analytics/AnalyticsScreen.tsx` | Analytics | ✅ | ✅ Per chart | ✅ ChartSkeleton | ❌ Silent catch | ✅ activeOpacity | ❌ No truncation |
| ProfileScreen | `app/screens/profile/ProfileScreen.tsx` | Profile | ✅ | ❌ None | ❌ None | ❌ Silent catch | ✅ Staggered | ❌ No truncation |

### Auth Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|
| LoginScreen | `app/screens/auth/LoginScreen.tsx` | Auth | ✅ | N/A | ✅ Button loading | ✅ Error + validation | ✅ activeOpacity | ❌ |
| RegisterScreen | `app/screens/auth/RegisterScreen.tsx` | Auth | ✅ | N/A | ✅ Button loading | ✅ Error + validation | ✅ activeOpacity | ❌ |
| ForgotPasswordScreen | `app/screens/auth/ForgotPasswordScreen.tsx` | Auth | ✅ | N/A | ✅ Button loading | ✅ Error + retry | ✅ activeOpacity | ✅ |

### Training Flow

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|
| ActiveWorkoutScreen | `app/screens/training/ActiveWorkoutScreen.tsx` | Log→Training | ✅ | ✅ Add exercises | ❌ No skeleton | ❌ Alert only | ✅ Haptics, Pressable | ❌ |
| SessionDetailScreen | `app/screens/training/SessionDetailScreen.tsx` | Log→Training | ✅ | N/A | ✅ Skeleton | ✅ Error + back | ✅ activeOpacity | ❌ |
| SessionDetailView | `app/screens/training/SessionDetailView.tsx` | Log→Training | ✅ | N/A | ✅ Skeleton | ✅ Error + back | ✅ activeOpacity | ❌ |

### Nutrition Flow

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|
| NutritionReportScreen | `app/screens/nutrition/NutritionReportScreen.tsx` | Analytics | ✅ | ✅ Custom | ✅ ActivityIndicator | ✅ Banner + retry | ✅ activeOpacity | ✅ |
| RecipeBuilderScreen | `app/screens/nutrition/RecipeBuilderScreen.tsx` | Log | ✅ | ✅ Prompt | ✅ ActivityIndicator | ✅ Alert | ✅ activeOpacity | ✅ |

### Exercise Picker

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|
| ExercisePickerScreen | `app/screens/exercise-picker/ExercisePickerScreen.tsx` | Log | ✅ | ✅ + Create custom | ✅ ActivityIndicator | ✅ Error + retry | ✅ a11y roles | ❌ |

### Meal Prep

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|
| MealPlanScreen | `app/screens/meal-prep/MealPlanScreen.tsx` | Profile | ✅ | ✅ Generate btn | ✅ ActivityIndicator | ✅ Error text | ✅ TouchableOpacity | ❌ |
| PrepSundayFlow | `app/screens/meal-prep/PrepSundayFlow.tsx` | Profile | ✅ | ✅ Step-based | ✅ ActivityIndicator | ✅ Error text | ✅ TouchableOpacity | ❌ |
| ShoppingListView | `app/screens/meal-prep/ShoppingListView.tsx` | Profile | ✅ | ❌ None | ✅ ActivityIndicator | ✅ Error text | ✅ TouchableOpacity | ❌ |

### Secondary Screens

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|
| CoachingScreen | `app/screens/coaching/CoachingScreen.tsx` | Secondary | ✅ | ✅ EmptyState | ❌ None | ❌ Silent catch | ✅ activeOpacity | ✅ |
| CommunityScreen | `app/screens/community/CommunityScreen.tsx` | Secondary | ✅ | ❌ Static | ❌ None | ❌ Silent (defaults) | ✅ activeOpacity | ❌ |
| LearnScreen | `app/screens/learn/LearnScreen.tsx` | Secondary | ✅ | ✅ EmptyState | ❌ None | ❌ Silent catch | ✅ Staggered | ✅ |
| ArticleDetailScreen | `app/screens/learn/ArticleDetailScreen.tsx` | Secondary | ✅ | N/A | ✅ ActivityIndicator | ✅ Error + retry | ✅ activeOpacity | ✅ |
| HealthReportsScreen | `app/screens/health/HealthReportsScreen.tsx` | Secondary | ✅ | ✅ EmptyState | ❌ None | ❌ Silent catch | ✅ activeOpacity | ❌ |
| FounderStoryScreen | `app/screens/founder/FounderStoryScreen.tsx` | Secondary | ✅ | N/A | ✅ ActivityIndicator | ✅ Fallback content | ✅ activeOpacity | ❌ |
| WeeklyReportScreen | `app/screens/reports/WeeklyReportScreen.tsx` | Secondary | ✅ | ✅ EmptyState | ✅ Skeleton | ✅ Error + retry | ✅ activeOpacity | ❌ |
| ProgressPhotosScreen | `app/screens/profile/ProgressPhotosScreen.tsx` | Profile | ✅ | ✅ Custom | ✅ ActivityIndicator | ✅ Alert | ✅ activeOpacity | ❌ |

### Onboarding

| Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow |
|-------------|-----------|-----|---------|-------|---------|-------|-------------|----------|
| OnboardingScreen | `app/screens/onboarding/OnboardingScreen.tsx` | Onboarding | ✅ | N/A | ✅ ActivityIndicator | ✅ API error text | ✅ activeOpacity | ✅ |
| OnboardingWizard | `app/screens/onboarding/OnboardingWizard.tsx` | Onboarding | ✅ | N/A | ❌ Steps load instantly | ❌ Delegated to steps | ✅ Reanimated | ✅ |

Onboarding steps (11 files in `app/screens/onboarding/steps/`) are sub-components, not standalone screens. Stale directory: `app/screens/more/` is empty.


---

## 2. Navigation Graph

Source: `app/navigation/BottomTabNavigator.tsx`

### 4 Stack Navigators

| Stack | Root Screen | Nested Screens |
|-------|------------|----------------|
| DashboardStackScreen | DashboardScreen | ExercisePicker, ActiveWorkout, WeeklyReport, ArticleDetail, Learn |
| LogsStackScreen | LogsScreen | ExercisePicker, ActiveWorkout, SessionDetail |
| AnalyticsStackScreen | AnalyticsScreen | NutritionReport, WeeklyReport |
| ProfileStackScreen | ProfileScreen | Learn, ArticleDetail, Coaching, Community, FounderStory, HealthReports, ProgressPhotos, MealPlan, ShoppingList, PrepSunday |

### Screen Registrations: 24 total (6 + 4 + 3 + 11)

### Custom Transition: `slideFromRight`

Uses `Animated` + `Easing` from `react-native` (NOT Reanimated). Push: 250ms `Easing.out(Easing.ease)`. Pop: 200ms `Easing.inOut(Easing.ease)`. Translates X from 30% screen width to 0, opacity 0.95→1.

**⚠️ FINDING (SCREEN-029):** Animation library inconsistency — `slideFromRight` uses RN Animated while the rest of the app standardizes on Reanimated.

### Tab Bar

4 tabs: Home, Log, Analytics, Profile. Height 64px. Custom SVG icons (22×22). Active: `colors.accent.primary` with `primaryMuted` background wrap. Inactive: `colors.text.muted`. Border: `rgba(255,255,255,0.06)`.

### Modal Presentation

All modals rendered inline within screens (not via navigation). Dashboard renders 8 modals. Logs renders 2. Analytics renders 1. Profile renders 1.


---

## 3. Modal Catalog (12 modals)

### Using ModalContainer (8 — consistent Reanimated animations)

| Modal | File Path | Animation | Backdrop | Keyboard |
|-------|-----------|-----------|----------|----------|
| AddNutritionModal | `app/components/modals/AddNutritionModal.tsx` | Reanimated slide-up/scale | ✅ | ✅ |
| AddTrainingModal | `app/components/modals/AddTrainingModal.tsx` | Reanimated via MC | ✅ | ✅ |
| AddBodyweightModal | `app/components/modals/AddBodyweightModal.tsx` | Reanimated via MC | ✅ | ✅ |
| QuickAddModal | `app/components/modals/QuickAddModal.tsx` | Reanimated via MC | ✅ | ✅ |
| DrillDownModal | `app/components/analytics/DrillDownModal.tsx` | Reanimated via MC | ✅ | N/A |
| RecipeScalingModal | `app/components/meal-prep/RecipeScalingModal.tsx` | Reanimated via MC | ✅ | ✅ |
| BlockCreationModal | `app/components/periodization/BlockCreationModal.tsx` | Reanimated via MC | ✅ | ✅ |
| BlockTemplateModal | `app/components/periodization/BlockTemplateModal.tsx` | Reanimated via MC | ✅ | N/A |

### NOT Using ModalContainer (4 — inconsistent)

| Modal | File Path | Animation | Backdrop | Keyboard | Issue |
|-------|-----------|-----------|----------|----------|-------|
| RecoveryCheckinModal | `app/components/modals/RecoveryCheckinModal.tsx` | RN `animationType="slide"` | ✅ onRequestClose | ❌ | SCREEN-025 |
| CelebrationModal | `app/components/achievements/CelebrationModal.tsx` | RN fade + Reanimated FadeIn | ✅ Pressable backdrop | N/A | SCREEN-026 |
| FatigueBreakdownModal | `app/components/analytics/FatigueBreakdownModal.tsx` | RN `animationType="slide"` | ✅ onRequestClose | N/A | SCREEN-027 |
| UpgradeModal | `app/components/premium/UpgradeModal.tsx` | RN `animationType="slide"` | ✅ onRequestClose | ❌ | SCREEN-028 |


---

## 4. Issues — Missing State Coverage

### Critical (empty/error missing on primary tabs)

| ID | Severity | Category | Title | File Path | Current | Target | Effort | Phase |
|----|----------|----------|-------|-----------|---------|--------|--------|-------|
| SCREEN-001 | Critical | screen-state | DashboardScreen missing dedicated empty state | `app/screens/dashboard/DashboardScreen.tsx` | Inline "No articles" text only | Add `EmptyState` for zero-data first-time user | 2h | 2 |
| SCREEN-002 | Critical | screen-state | DashboardScreen missing error state | `app/screens/dashboard/DashboardScreen.tsx` | Silent catch, stale/zero data | Error banner with retry on `loadDashboardData` failure | 2h | 2 |
| SCREEN-003 | High | screen-state | LogsScreen nutrition tab missing empty state | `app/screens/logs/LogsScreen.tsx` | Meal slots shown but no EmptyState for zero entries | Add `EmptyState` when `todayEntries.length === 0` | 1h | 2 |
| SCREEN-004 | Critical | screen-state | LogsScreen missing error state | `app/screens/logs/LogsScreen.tsx` | Silent catch in `loadData` | Error banner with retry | 1.5h | 2 |
| SCREEN-005 | Critical | screen-state | AnalyticsScreen missing error state | `app/screens/analytics/AnalyticsScreen.tsx` | Silent catch in `loadAnalytics` | Error banner with retry | 1.5h | 2 |
| SCREEN-006 | High | screen-state | AnalyticsScreen overflow on exercise pills | `app/screens/analytics/AnalyticsScreen.tsx` | Long exercise names overflow pills | Add `numberOfLines={1}` or `flexShrink` | 0.5h | 3 |
| SCREEN-007 | Critical | screen-state | ProfileScreen missing empty state | `app/screens/profile/ProfileScreen.tsx` | Shows "?" avatar when data fails | Add skeleton + EmptyState fallback | 2h | 2 |
| SCREEN-008 | Critical | screen-state | ProfileScreen missing loading state | `app/screens/profile/ProfileScreen.tsx` | No skeleton during fetchAll | Add Skeleton components during load | 2h | 2 |
| SCREEN-009 | Critical | screen-state | ProfileScreen missing error state | `app/screens/profile/ProfileScreen.tsx` | Silent catch | Error handling with retry | 1.5h | 2 |

### High (non-primary screens + modals + navigation)

| ID | Severity | Category | Title | File Path | Current | Target | Effort | Phase |
|----|----------|----------|-------|-----------|---------|--------|--------|-------|
| SCREEN-010 | High | screen-state | ActiveWorkoutScreen missing loading skeleton | `app/screens/training/ActiveWorkoutScreen.tsx` | No loading on init | Skeleton during edit/template fetch | 1h | 3 |
| SCREEN-011 | High | screen-state | ActiveWorkoutScreen overflow | `app/screens/training/ActiveWorkoutScreen.tsx` | Exercise names not truncated | Add `numberOfLines={1}` | 0.5h | 3 |
| SCREEN-012 | High | screen-state | SessionDetailScreen overflow | `app/screens/training/SessionDetailScreen.tsx` | Exercise names not truncated | Add `numberOfLines={1}` | 0.5h | 3 |
| SCREEN-013 | High | screen-state | SessionDetailView overflow | `app/screens/training/SessionDetailView.tsx` | Exercise names not truncated | Add `numberOfLines={1}` | 0.5h | 3 |
| SCREEN-014 | High | screen-state | ExercisePickerScreen overflow | `app/screens/exercise-picker/ExercisePickerScreen.tsx` | Exercise names may overflow | Verify ExerciseCard truncation | 0.5h | 3 |
| SCREEN-015 | High | screen-state | MealPlanScreen overflow | `app/screens/meal-prep/MealPlanScreen.tsx` | Food names not truncated | Add `numberOfLines={1}` | 0.5h | 3 |
| SCREEN-016 | High | screen-state | PrepSundayFlow overflow | `app/screens/meal-prep/PrepSundayFlow.tsx` | No truncation | Add `numberOfLines` | 0.5h | 3 |
| SCREEN-017 | High | screen-state | ShoppingListView missing empty state | `app/screens/meal-prep/ShoppingListView.tsx` | No empty state for zero items | Add `EmptyState` | 1h | 3 |
| SCREEN-018 | High | screen-state | ShoppingListView overflow | `app/screens/meal-prep/ShoppingListView.tsx` | Item names not truncated | Add `numberOfLines={1}` | 0.5h | 3 |
| SCREEN-019 | High | screen-state | CoachingScreen missing loading | `app/screens/coaching/CoachingScreen.tsx` | No skeleton | Add Skeleton cards | 1.5h | 3 |
| SCREEN-020 | High | screen-state | CoachingScreen missing error | `app/screens/coaching/CoachingScreen.tsx` | Silent catch | Error banner + retry | 1h | 3 |
| SCREEN-021 | High | screen-state | CommunityScreen missing loading | `app/screens/community/CommunityScreen.tsx` | No loading indicator | Add brief loading state | 0.5h | 4 |
| SCREEN-022 | High | screen-state | CommunityScreen missing error | `app/screens/community/CommunityScreen.tsx` | Silent catch, uses defaults | Subtle error indicator | 0.5h | 4 |
| SCREEN-023 | High | screen-state | LearnScreen missing loading | `app/screens/learn/LearnScreen.tsx` | No skeleton on initial fetch | Add SkeletonCards | 1h | 3 |
| SCREEN-024 | High | screen-state | HealthReportsScreen missing loading | `app/screens/health/HealthReportsScreen.tsx` | No skeleton | Add Skeleton for report cards | 1h | 3 |
| SCREEN-025 | High | screen-state | RecoveryCheckinModal not using ModalContainer | `app/components/modals/RecoveryCheckinModal.tsx` | Raw `<Modal>` + RN slide | Migrate to ModalContainer | 1.5h | 2 |
| SCREEN-026 | Medium | screen-state | CelebrationModal not using ModalContainer | `app/components/achievements/CelebrationModal.tsx` | Raw `<Modal>` + mixed animation | Migrate to ModalContainer (may need custom extension) | 2h | 3 |
| SCREEN-027 | High | screen-state | FatigueBreakdownModal not using ModalContainer | `app/components/analytics/FatigueBreakdownModal.tsx` | Raw `<Modal>` + RN slide | Migrate to ModalContainer | 1h | 2 |
| SCREEN-028 | High | screen-state | UpgradeModal not using ModalContainer | `app/components/premium/UpgradeModal.tsx` | Raw `<Modal>` + RN slide | Migrate to ModalContainer | 1.5h | 2 |
| SCREEN-029 | High | screen-state | slideFromRight uses RN Animated | `app/navigation/BottomTabNavigator.tsx` | RN `Animated` + `Easing` | Migrate to Reanimated (may need native-stack) | 3h | 1 |

---

## Summary

| Metric | Count |
|--------|-------|
| Screen files audited | 33 |
| Screens with all 6 states | 5 |
| Missing empty state | 5 screens |
| Missing loading state | 6 screens |
| Missing error state | 8 screens |
| Missing overflow handling | 11 screens |
| Total SCREEN issues | 29 |
| Critical issues | 7 |
| High issues | 21 |
| Medium issues | 1 |
| Modals audited | 12 |
| Modals using ModalContainer | 8 (67%) |
| Modals using raw Modal | 4 (33%) |
| Total estimated effort | ~38 hours |
