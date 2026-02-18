# Animation and Micro-Interaction Audit — Hypertrophy OS

> Phase 6 audit: catalogs every animation pattern, flags library inconsistencies, audits loading/empty/error states, evaluates micro-interactions and haptic feedback.

---

## 1. Animation Pattern Catalog

### 1.1 Reanimated Animations (Project Standard)

| File | Animation Type | API | Config | Purpose |
|---|---|---|---|---|
| `hooks/usePressAnimation.ts` | spring | `withSpring` | `springs.snappy` (d:15, s:400, m:0.3) | Press feedback scale 1→0.97, opacity 1→0.9 |
| `hooks/useStaggeredEntrance.ts` | timing | `withTiming`+`withDelay` | 300ms, Easing.out, stagger 60ms | Entrance fade+slide, caps index 8 |
| `hooks/useSkeletonPulse.ts` | timing repeat | `withRepeat`+`withTiming` | 600ms, infinite, reverse | Loading pulse opacity 0.3→0.7 |
| `hooks/useCountingValue.ts` | timing | `withTiming`+`cancelAnimation` | 400ms, Easing.out | Animated number counting |
| `common/ProgressRing.tsx` | spring | `withSpring` | `springs.gentle` (d:20, s:200, m:0.5) | Ring fill strokeDashoffset |
| `common/ProgressBar.tsx` | timing | `withTiming` | 400ms, Easing.out | Bar fill width |
| `common/Skeleton.tsx` | timing repeat | `withRepeat`+`withTiming` | 600ms, infinite; web static 0.5 | Skeleton pulse 0.3→0.7 |
| `common/ModalContainer.tsx` | timing | `withTiming` | Mobile 250ms slide; Web 200ms scale | Modal entry/exit |
| `common/FilterPill.tsx` | timing+color | `withTiming`+`interpolateColor` | 150ms | Active/inactive toggle |
| `common/Button.tsx` | spring via hook | `usePressAnimation` | `springs.snappy` | Press feedback |
| `common/Card.tsx` | spring+entrance | `usePressAnimation`+`useStaggeredEntrance` | snappy/stagger | Press + entrance |
| `dashboard/QuickActionButton.tsx` | spring via hook | `usePressAnimation` | `springs.snappy` | Press feedback |
| `dashboard/StreakIndicator.tsx` | derived | `useDerivedValue` | — | Counting display |
| `profile/FeatureNavItem.tsx` | spring via hook | `usePressAnimation` | `springs.snappy` | Press feedback |
| `achievements/CelebrationModal.tsx` | layout anim | `FadeIn`, `ZoomIn` | Reanimated layout anims | Celebration entrance |
| `onboarding/OnboardingWizard.tsx` | timing | `withTiming` | 300ms, Easing.out | Progress bar fill |

### 1.2 RN Animated Animations (Legacy — Should Migrate)

| File | Animation Type | API | Config | Purpose |
|---|---|---|---|---|
| `training/PRBanner.tsx` | spring | `Animated.spring` | damping:12, stiffness:200 | PR celebration scale 0→1, 3s auto-dismiss |
| `training/RestTimerRing.tsx` | timing | `Animated.timing` | 300ms, nativeDriver:false | Ring arc strokeDashoffset |
| `training/RestTimerV2.tsx` | timing | `Animated.timing` | 300ms, nativeDriver:false | Ring arc (duplicates RestTimerRing) |
| `training/RestTimerBar.tsx` | spring | `Animated.spring` | d:20, s:200, m:0.5 | Slide-up entrance |
| `training/ExerciseDetailSheet.tsx` | spring+timing | `Animated.spring`+`Animated.timing` | spring default; timing 200ms | Bottom sheet slide |
| `training/PreviousPerformance.tsx` | timing loop | `Animated.loop`+`Animated.timing` | 600ms each direction | Custom skeleton pulse |
| `training/OverloadSuggestionBadge.tsx` | — | `Animated` import | — | Badge animation |
| `analytics/BodySilhouette.tsx` | timing | `Animated.timing` | 75ms, nativeDriver:true | Region press flash |
| `common/Tooltip.tsx` | timing | `Animated.timing` | 200ms, nativeDriver:true | Fade-in on show |
| `common/SwipeableRow.tsx` | gesture | `Animated` via gesture-handler | friction:2 | Swipe-to-delete |
| `navigation/BottomTabNavigator.tsx` | timing | `Animated`+`Easing` | push 250ms, pop 200ms | Screen transitions (slideFromRight) |
| `screens/ActiveWorkoutScreen.tsx` | timing | `Animated.timing` | 200ms, nativeDriver:false | Set row bg color tint on completion |
| `screens/ArticleDetailScreen.tsx` | timing | `Animated.timing` | 50ms, nativeDriver:false | Scroll progress bar |

### 1.3 LayoutAnimation Usage

| File | API | Config | Purpose |
|---|---|---|---|
| `training/RestTimer.tsx` | `LayoutAnimation.configureNext` | `Presets.easeInEaseOut` | Settings panel toggle |
| `log/CollapsibleSection.tsx` | `LayoutAnimation.configureNext` | `Presets.easeInEaseOut` | Section expand/collapse |
| `profile/AccountSection.tsx` | `LayoutAnimation.configureNext` | `Presets.easeInEaseOut` | Danger zone expand/collapse |

### 1.4 Summary Statistics

| Metric | Count |
|---|---|
| Reanimated components/hooks | 16 |
| RN Animated components | 13 |
| LayoutAnimation components | 3 |
| Total animated files | 32 |
| Spring animations (Reanimated) | 6 (all use token presets) |
| Spring animations (RN Animated) | 3 (PRBanner, RestTimerBar, ExerciseDetailSheet) |
| Timing animations (Reanimated) | 8 |
| Timing animations (RN Animated) | 8 |

---

## 2. Animation Library Consistency

### 2.1 RN Animated Components (HIGH — Should Migrate to Reanimated)

The project standard is `react-native-reanimated`. The following components use the legacy `Animated` from `react-native`, causing inconsistent frame rates (JS thread vs UI thread):

| Component | File | RN Animated API | Migration Target | Effort |
|---|---|---|---|---|
| PRBanner | `training/PRBanner.tsx` | `Animated.spring` (d:12, s:200) | `withSpring(1, springs.bouncy)` + `useSharedValue` | 2h |
| RestTimerRing | `training/RestTimerRing.tsx` | `Animated.timing` (300ms) | `withTiming` from reanimated | 1.5h |
| RestTimerV2 | `training/RestTimerV2.tsx` | `Animated.timing` (300ms) | `withTiming` from reanimated; compose RestTimerRing | 2h |
| RestTimerBar | `training/RestTimerBar.tsx` | `Animated.spring` (d:20, s:200, m:0.5) | `withSpring(0, springs.gentle)` + `useSharedValue` | 1h |
| ExerciseDetailSheet | `training/ExerciseDetailSheet.tsx` | `Animated.spring` + `Animated.timing` | `withSpring` + `withTiming` from reanimated | 2h |
| PreviousPerformance | `training/PreviousPerformance.tsx` | `Animated.loop` + `Animated.timing` | Replace with `useSkeletonPulse` hook or `Skeleton` component | 1h |
| OverloadSuggestionBadge | `training/OverloadSuggestionBadge.tsx` | `Animated` import | Migrate to reanimated | 1h |
| BodySilhouette | `analytics/BodySilhouette.tsx` | `Animated.timing` (75ms) | `withTiming` from reanimated | 1h |
| Tooltip | `common/Tooltip.tsx` | `Animated.timing` (200ms) | `withTiming` from reanimated | 0.5h |
| SwipeableRow | `common/SwipeableRow.tsx` | `Animated` via gesture-handler | Acceptable — gesture-handler requires RN Animated | 0h |
| BottomTabNavigator | `navigation/BottomTabNavigator.tsx` | `Animated` + `Easing` for `slideFromRight` | React Navigation requires RN Animated for card interpolators | 0h |
| ActiveWorkoutScreen | `screens/ActiveWorkoutScreen.tsx` | `Animated.timing` (200ms) for set row bg | `withTiming` + `useAnimatedStyle` from reanimated | 1h |
| ArticleDetailScreen | `screens/ArticleDetailScreen.tsx` | `Animated.timing` (50ms) for scroll progress | `withTiming` from reanimated | 0.5h |

**Exceptions** (acceptable RN Animated usage):
- `SwipeableRow` — `react-native-gesture-handler`'s `Swipeable` requires RN Animated internally
- `BottomTabNavigator` — React Navigation's `StackCardInterpolationProps` requires RN Animated for `cardStyleInterpolator`

**Actionable migrations**: 11 components, ~13.5h total effort

### 2.2 LayoutAnimation Components (MEDIUM)

LayoutAnimation is a simpler API but runs on the JS thread and has limited control. Consider migrating to Reanimated layout animations for consistency:

| Component | File | Current | Migration | Effort |
|---|---|---|---|---|
| RestTimer | `training/RestTimer.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Reanimated `Layout` transition | 1h |
| CollapsibleSection | `log/CollapsibleSection.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Reanimated `Layout` transition | 1h |
| AccountSection | `profile/AccountSection.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Reanimated `Layout` transition | 1h |

### 2.3 Spring Preset Compliance

Token presets from `app/theme/tokens.ts`:
- **gentle**: damping:20, stiffness:200, mass:0.5 — for progress/value animations
- **snappy**: damping:15, stiffness:400, mass:0.3 — for press/interaction feedback
- **bouncy**: damping:10, stiffness:300, mass:0.5 — for celebratory/attention

| File | Spring Config | Matches Preset? | Issue |
|---|---|---|---|
| `usePressAnimation.ts` | `springs.snappy` | YES — token reference | — |
| `ProgressRing.tsx` | `springs.gentle` | YES — token reference | — |
| `PRBanner.tsx` | damping:12, stiffness:200 (inline) | NO — closest is `bouncy` (d:10, s:300, m:0.5) | MEDIUM — should use `springs.bouncy` for celebration |
| `RestTimerBar.tsx` | damping:20, stiffness:200, mass:0.5 (inline) | VALUES MATCH `gentle` but hardcoded | MEDIUM — should import `springs.gentle` |
| `ExerciseDetailSheet.tsx` | RN default spring config | NO — uses RN Animated defaults | MEDIUM — should use token preset |

**Compliant**: 2/5 spring animations use token references
**Non-compliant**: 3/5 use inline configs (1 custom, 2 matching but hardcoded)

---

## 3. Loading State Coverage (Skeleton Audit)

### 3.1 Screens with Async Data Fetching

| Screen | File | Has Skeleton Import | Loading Pattern | Status |
|---|---|---|---|---|
| DashboardScreen | `screens/dashboard/DashboardScreen.tsx` | YES | `Skeleton` component imported | PASS |
| LogsScreen | `screens/logs/LogsScreen.tsx` | YES | `Skeleton` component imported | PASS |
| AnalyticsScreen | `screens/analytics/AnalyticsScreen.tsx` | YES | `Skeleton` component imported | PASS |
| ProfileScreen | `screens/profile/ProfileScreen.tsx` | NO | No skeleton, no loading indicator | FAIL — HIGH |
| CoachingScreen | `screens/coaching/CoachingScreen.tsx` | NO | No skeleton; only `Button loading={submitting}` | FAIL — HIGH |
| CommunityScreen | `screens/community/CommunityScreen.tsx` | NO | No skeleton, no loading indicator | FAIL — HIGH |
| LearnScreen | `screens/learn/LearnScreen.tsx` | NO | No skeleton, no loading indicator | FAIL — HIGH |
| HealthReportsScreen | `screens/health/HealthReportsScreen.tsx` | NO | No skeleton, no loading indicator | FAIL — HIGH |
| NutritionReportScreen | `screens/nutrition/NutritionReportScreen.tsx` | NO | Uses `ActivityIndicator` (not Skeleton) | FAIL — HIGH |
| SessionDetailView | `screens/training/SessionDetailView.tsx` | YES | `Skeleton` component imported | PASS |
| SessionDetailScreen | `screens/training/SessionDetailScreen.tsx` | YES | `Skeleton` component imported | PASS |
| WeeklyReportScreen | `screens/reports/WeeklyReportScreen.tsx` | YES | `Skeleton` component imported | PASS |

**Summary**: 6/12 async screens have proper Skeleton loading. 6 screens missing (ProfileScreen, CoachingScreen, CommunityScreen, LearnScreen, HealthReportsScreen, NutritionReportScreen).

NutritionReportScreen uses `ActivityIndicator` instead of `Skeleton` — inconsistent with the project pattern.

---

## 4. Micro-Interaction Audit

### 4.1 Set Completion in ActiveWorkoutScreen

| Aspect | Finding | Quality |
|---|---|---|
| Visual feedback | `Animated.timing` (200ms) tints row bg from transparent → `colors.semantic.positiveSubtle` | GOOD — smooth color transition |
| Checkmark | Static `✓` text changes color from `colors.text.muted` → `colors.semantic.positive` | OK — no animation on checkmark itself |
| Haptic | `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on completion | GOOD |
| Auto-scroll | Scrolls to next uncompleted set after 100ms delay | GOOD |
| Rest timer | Auto-starts rest timer on set completion | GOOD |
| Animation library | Uses RN `Animated` (not Reanimated) for bg tint | ISSUE — inconsistent |

**Missing**: No scale/bounce animation on the checkmark button itself. Premium apps (Strong, RP Hypertrophy) animate the checkmark with a spring scale effect.

### 4.2 PR Detection via PRBanner

| Aspect | Finding | Quality |
|---|---|---|
| Spring config | `Animated.spring` with damping:12, stiffness:200 | ISSUE — custom config, not a token preset |
| Scale animation | Scale 0→1 (from center) | OK — but scale-from-zero can feel jarring vs scale 0.8→1 |
| Auto-dismiss | 3s timeout via `setTimeout` | OK — sufficient for reading 1-2 PR items |
| Haptic | NO haptic on PR detection | MISSING — should add `Haptics.notificationAsync(Success)` |
| Dismiss interaction | Tap overlay to dismiss | GOOD |
| Animation library | RN `Animated` (not Reanimated) | ISSUE — should migrate |

**Recommendation**: Use `springs.bouncy` for celebration feel. Add haptic. Consider scale 0.8→1 instead of 0→1 for less jarring entrance.

### 4.3 Rest Timer Countdown

| Aspect | Finding | Quality |
|---|---|---|
| Countdown display | Integer swap (not smooth interpolation) | OK — standard for timers |
| Ring animation | `Animated.timing` 300ms on strokeDashoffset per tick | GOOD — smooth ring progress |
| Completion sound | `expo-av` Audio.Sound plays `timer-done.mp3` | GOOD |
| Completion haptic | NO haptic on timer completion | MISSING — should add `Haptics.notificationAsync(Success)` |
| Color change | `getTimerColor(remaining)` — green→yellow→red | GOOD — semantic color feedback |
| Animation library | RN `Animated` for ring | ISSUE — should migrate to Reanimated |

### 4.4 Meal Logging Confirmation (AddNutritionModal)

| Aspect | Finding | Quality |
|---|---|---|
| Success message | Inline `"{calories} kcal logged ✓"` text with green color | GOOD — immediate feedback |
| Auto-clear | `setTimeout` clears message after 2s | OK |
| Haptic | NO haptic on successful log | MISSING |
| Animation | No animation on success message appearance | MISSING — should fade in |
| Save as favorite | Offered alongside success message | GOOD UX |

### 4.5 Swipe-to-Delete (SwipeableRow)

| Aspect | Finding | Quality |
|---|---|---|
| Friction | `friction: 2` on Swipeable | OK — standard resistance |
| Overshoot | `overshootRight: false` | GOOD — prevents over-pull |
| Delete action | Red background with "Delete" text | GOOD — clear destructive action |
| Haptic | NO haptic on swipe threshold or delete | MISSING |
| Animation library | RN `Animated` via gesture-handler | ACCEPTABLE — gesture-handler requires it |
| Web fallback | Renders children without swipe on web | GOOD |

---

## 5. Haptic Feedback Audit

### 5.1 Current Haptic Usage

| Location | File | Haptic Call | Trigger |
|---|---|---|---|
| Set completion | `ActiveWorkoutScreen.tsx` | `Haptics.impactAsync(Light)` | Set toggled complete |
| Exercise swap | `ActiveWorkoutScreen.tsx` | `Haptics.impactAsync(Medium)` | Exercise swapped |
| Quick actions | `DashboardScreen.tsx` | `Haptics?.impactAsync?.(Light)` | Quick action button tap |
| Barcode scan | `BarcodeScanner.tsx` | `Haptics.impactAsync(Medium)` | Barcode detected |

**Total**: 4 haptic usage points across entire codebase.

### 5.2 Missing Haptics

| Moment | File | Recommended Haptic | Severity |
|---|---|---|---|
| PR detection | `training/PRBanner.tsx` | `Haptics.notificationAsync(Success)` | MEDIUM |
| Rest timer completion | `training/RestTimer.tsx` / `RestTimerOverlay.tsx` | `Haptics.notificationAsync(Success)` | MEDIUM |
| Meal logging success | `modals/AddNutritionModal.tsx` | `Haptics.impactAsync(Light)` | MEDIUM |
| Swipe-to-delete threshold | `common/SwipeableRow.tsx` | `Haptics.impactAsync(Medium)` | LOW |
| Workout finish | `ActiveWorkoutScreen.tsx` (save) | `Haptics.notificationAsync(Success)` | MEDIUM |
| Tab bar switch | `BottomTabNavigator.tsx` | `Haptics.selectionAsync()` | LOW |
| Button press (primary) | `common/Button.tsx` | `Haptics.impactAsync(Light)` | LOW |
| Modal dismiss | `common/ModalContainer.tsx` | `Haptics.impactAsync(Light)` | LOW |

---

## 6. Empty State and Error State Coverage

### 6.1 EmptyState Component Usage

| Screen | File | Has EmptyState Import | Data Type | Status |
|---|---|---|---|---|
| LogsScreen | `screens/logs/LogsScreen.tsx` | YES | Nutrition entries + training logs | PASS |
| AnalyticsScreen | `screens/analytics/AnalyticsScreen.tsx` | YES | Training analytics data | PASS |
| ProgressPhotosScreen | `screens/profile/ProgressPhotosScreen.tsx` | NO | Progress photos | FAIL — HIGH |
| CommunityScreen | `screens/community/CommunityScreen.tsx` | NO | Community posts | FAIL — MEDIUM (secondary screen) |
| LearnScreen | `screens/learn/LearnScreen.tsx` | YES | Articles | PASS |
| CoachingScreen | `screens/coaching/CoachingScreen.tsx` | YES | Coaching data | PASS |
| HealthReportsScreen | `screens/health/HealthReportsScreen.tsx` | YES | Health reports | PASS |
| WeeklyReportScreen | `screens/reports/WeeklyReportScreen.tsx` | YES | Weekly reports | PASS |

**Missing EmptyState**: ProgressPhotosScreen (HIGH — Profile tab), CommunityScreen (MEDIUM — secondary)

### 6.2 ErrorBoundary Coverage

| Location | File | Wraps | Status |
|---|---|---|---|
| App root | `App.tsx` | Entire app tree | PASS — catches top-level crashes |
| Individual screens | — | — | FAIL — no per-screen ErrorBoundary wrapping |

**Finding**: ErrorBoundary only wraps at the app root level. Individual screens do not have ErrorBoundary wrappers, meaning a crash in one screen takes down the entire app UI rather than showing a localized error state.

### 6.3 API Error Handling Patterns

| Screen | Error Handling | Quality |
|---|---|---|
| DashboardScreen | `try/catch` with `Alert.alert` | OK — shows error but no retry |
| LogsScreen | `try/catch` with error state | GOOD — shows error UI |
| AnalyticsScreen | `try/catch` with error state | GOOD |
| NutritionReportScreen | `try/catch` with error state string | OK — shows error text |
| ActiveWorkoutScreen | `try/catch` with `Alert.alert` | OK — shows alert |
| CoachingScreen | `try/catch` with `Alert.alert` | OK — no retry action |

**Pattern**: Most screens use `Alert.alert` for errors rather than inline error states with retry buttons. This is functional but not premium — inline error states with retry are the standard for premium apps.

---

## 7. ANIM-* Issue Log

| ID | Severity | Category | Title | File(s) | Current | Target | Effort (h) | Phase |
|---|---|---|---|---|---|---|---|---|
| ANIM-001 | High | animation-library | PRBanner uses RN Animated | `training/PRBanner.tsx` | `Animated.spring` from react-native | Migrate to `withSpring(1, springs.bouncy)` from reanimated | 2 | 1 |
| ANIM-002 | High | animation-library | RestTimerRing uses RN Animated | `training/RestTimerRing.tsx` | `Animated.timing` from react-native | Migrate to `withTiming` from reanimated | 1.5 | 1 |
| ANIM-003 | High | animation-library | RestTimerV2 uses RN Animated | `training/RestTimerV2.tsx` | `Animated.timing` from react-native | Migrate to reanimated; compose RestTimerRing | 2 | 1 |
| ANIM-004 | High | animation-library | RestTimerBar uses RN Animated | `training/RestTimerBar.tsx` | `Animated.spring` from react-native | Migrate to `withSpring(0, springs.gentle)` | 1 | 1 |
| ANIM-005 | High | animation-library | ExerciseDetailSheet uses RN Animated | `training/ExerciseDetailSheet.tsx` | `Animated.spring` + `Animated.timing` | Migrate to reanimated | 2 | 1 |
| ANIM-006 | High | animation-library | PreviousPerformance custom skeleton | `training/PreviousPerformance.tsx` | Custom `Animated.loop` pulse | Replace with `useSkeletonPulse` hook | 1 | 1 |
| ANIM-007 | High | animation-library | OverloadSuggestionBadge uses RN Animated | `training/OverloadSuggestionBadge.tsx` | `Animated` from react-native | Migrate to reanimated | 1 | 1 |
| ANIM-008 | High | animation-library | BodySilhouette uses RN Animated | `analytics/BodySilhouette.tsx` | `Animated.timing` for region press | Migrate to `withTiming` from reanimated | 1 | 1 |
| ANIM-009 | Medium | animation-library | Tooltip uses RN Animated | `common/Tooltip.tsx` | `Animated.timing` 200ms fade | Migrate to `withTiming` from reanimated | 0.5 | 2 |
| ANIM-010 | High | animation-library | ActiveWorkoutScreen SetRow uses RN Animated | `screens/ActiveWorkoutScreen.tsx` | `Animated.timing` for bg tint | Migrate to `withTiming`+`useAnimatedStyle` | 1 | 1 |
| ANIM-011 | Medium | animation-library | ArticleDetailScreen uses RN Animated | `screens/ArticleDetailScreen.tsx` | `Animated.timing` for scroll progress | Migrate to reanimated | 0.5 | 2 |
| ANIM-012 | Medium | spring-preset | PRBanner uses custom spring config | `training/PRBanner.tsx` | damping:12, stiffness:200 (no preset) | Use `springs.bouncy` for celebration | 0.5 | 2 |
| ANIM-013 | Medium | spring-preset | RestTimerBar hardcodes gentle values | `training/RestTimerBar.tsx` | Inline d:20, s:200, m:0.5 | Import and use `springs.gentle` token | 0.5 | 2 |
| ANIM-014 | Medium | spring-preset | ExerciseDetailSheet uses RN default spring | `training/ExerciseDetailSheet.tsx` | RN Animated default spring config | Use appropriate token preset | 0.5 | 2 |
| ANIM-015 | High | loading-state | ProfileScreen missing skeleton loading | `screens/profile/ProfileScreen.tsx` | No loading indicator | Add `Skeleton` import and loading state | 1.5 | 1 |
| ANIM-016 | High | loading-state | CoachingScreen missing skeleton loading | `screens/coaching/CoachingScreen.tsx` | No skeleton; only button loading | Add `Skeleton` import and loading state | 1.5 | 1 |
| ANIM-017 | High | loading-state | CommunityScreen missing skeleton loading | `screens/community/CommunityScreen.tsx` | No loading indicator | Add `Skeleton` import and loading state | 1.5 | 2 |
| ANIM-018 | High | loading-state | LearnScreen missing skeleton loading | `screens/learn/LearnScreen.tsx` | No loading indicator | Add `Skeleton` import and loading state | 1.5 | 2 |
| ANIM-019 | High | loading-state | HealthReportsScreen missing skeleton | `screens/health/HealthReportsScreen.tsx` | No loading indicator | Add `Skeleton` import and loading state | 1.5 | 2 |
| ANIM-020 | High | loading-state | NutritionReportScreen uses ActivityIndicator | `screens/nutrition/NutritionReportScreen.tsx` | `ActivityIndicator` (not Skeleton) | Replace with `Skeleton` for consistency | 1 | 2 |
| ANIM-021 | Medium | haptics | PRBanner missing haptic on PR detection | `training/PRBanner.tsx` | No haptic | Add `Haptics.notificationAsync(Success)` | 0.5 | 3 |
| ANIM-022 | Medium | haptics | RestTimer missing haptic on completion | `training/RestTimer.tsx` | Sound only, no haptic | Add `Haptics.notificationAsync(Success)` | 0.5 | 3 |
| ANIM-023 | Medium | haptics | AddNutritionModal missing haptic on log | `modals/AddNutritionModal.tsx` | No haptic on success | Add `Haptics.impactAsync(Light)` | 0.5 | 3 |
| ANIM-024 | Medium | haptics | Workout finish missing haptic | `screens/ActiveWorkoutScreen.tsx` | No haptic on save | Add `Haptics.notificationAsync(Success)` | 0.5 | 3 |
| ANIM-025 | High | empty-state | ProgressPhotosScreen missing EmptyState | `screens/profile/ProgressPhotosScreen.tsx` | No empty state for zero photos | Add `EmptyState` with camera icon and CTA | 1 | 1 |
| ANIM-026 | Medium | empty-state | CommunityScreen missing EmptyState | `screens/community/CommunityScreen.tsx` | No empty state for zero posts | Add `EmptyState` with community icon | 1 | 2 |
| ANIM-027 | High | error-state | No per-screen ErrorBoundary wrapping | All screens | Only app-root ErrorBoundary | Add ErrorBoundary per screen/tab for localized recovery | 3 | 2 |
| ANIM-028 | Medium | layout-anim | RestTimer uses LayoutAnimation | `training/RestTimer.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout transitions | 1 | 3 |
| ANIM-029 | Medium | layout-anim | CollapsibleSection uses LayoutAnimation | `log/CollapsibleSection.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout transitions | 1 | 3 |
| ANIM-030 | Medium | layout-anim | AccountSection uses LayoutAnimation | `profile/AccountSection.tsx` | `LayoutAnimation.Presets.easeInEaseOut` | Consider Reanimated layout transitions | 1 | 3 |

### Issue Summary

| Category | High | Medium | Total |
|---|---|---|---|
| Animation library mismatch | 9 | 2 | 11 |
| Spring preset violations | 0 | 3 | 3 |
| Missing skeleton loading | 6 | 0 | 6 |
| Missing haptics | 0 | 4 | 4 |
| Missing empty states | 1 | 1 | 2 |
| Missing error states | 1 | 0 | 1 |
| LayoutAnimation migration | 0 | 3 | 3 |
| **Total** | **17** | **13** | **30** |

**Total estimated effort**: ~35h
