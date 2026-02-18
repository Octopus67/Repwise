# Requirements Document — Premium UI Implementation

## 1. User Problem

> "I open the app and it looks fine, but it doesn't feel like the $15/month apps I compare it to. Numbers jitter when they update, buttons are tiny when my hands are sweaty mid-set, half the screens just show nothing when loading, and if something fails I have no idea what happened. It feels like a beta."

The audit scored the app 5.5/10 on premium feel. The gap isn't functionality — it's polish. Users don't consciously notice tabular-nums or 44pt touch targets, but they feel the difference. Every jittery number, every missed loading state, every untappable button erodes trust. Premium apps earn retention through thousands of micro-decisions that say "someone cared about this." We're shipping 159 of those decisions.

## 2. User Stories

**Primary — Active Lifter (daily user, mid-workout):**
As a lifter mid-set with sweaty hands, I want all workout controls to be reliably tappable and animations to be smooth at 60fps, so that I never fumble a rest timer setting or miss a set type change during my session.

**Secondary — Nutrition Tracker (daily user, meal logging):**
As a nutrition tracker reviewing my daily intake, I want calorie and macro numbers to display with fixed-width digits and animated transitions, so that the dashboard feels stable and polished rather than jittery when values update.

**Edge Persona — Low-Vision / Motion-Sensitive User:**
As a user with low vision or motion sensitivity, I want all text to meet WCAG AA contrast, all animations to respect my OS reduce-motion setting, and all interactive elements to have proper accessibility labels, so that I can use the app comfortably without visual strain or disorientation.

**Edge Persona — New User (zero data):**
As a new user who just signed up, I want every screen to show a helpful empty state with a clear call-to-action instead of blank space or confusing placeholder data, so that I know exactly what to do next and don't think the app is broken.

**Edge Persona — Offline / Error User:**
As a user on a spotty gym WiFi connection, I want clear error messages with retry buttons when data fails to load, so that I can recover without force-quitting the app.

## 3. User Flow

This is not a single feature flow — it's a system-wide polish pass. The "flow" is every existing screen and interaction, made better. Key touchpoints:

**Workout Flow (highest stakes — user is mid-exercise):**
1. User opens ActiveWorkoutScreen → skeleton loads briefly → exercises appear with staggered entrance
2. User taps RestTimer gear icon (now 44pt target) → settings toggle animates via Reanimated (not LayoutAnimation)
3. Timer counts down with tabular-nums (no jitter) → completion triggers haptic + sound
4. User taps SetTypeSelector pill (now 44pt) → type changes smoothly
5. PR detected → PRBanner animates with `springs.bouncy` via Reanimated + haptic feedback
6. If API fails → error banner appears with retry (not silent failure)

**Dashboard Flow (first thing user sees daily):**
1. User opens app → DashboardScreen loads with skeleton placeholders
2. Data arrives → sections animate in with staggered entrance, section gaps feel breathable (spacing[6])
3. Calorie numbers update with tabular-nums (no layout shift), BudgetBar fill animates smoothly
4. ProgressRing at ≥80% shows glow effect → rewarding visual moment
5. If zero data → EmptyState with "Log your first meal" CTA
6. If API fails → error banner with retry action

**Drop-off prevention:**
- Loading states prevent "is it broken?" abandonment
- Error states with retry prevent "I'll try later" churn
- Touch targets prevent "I can't tap this" frustration during workouts
- Haptics provide confirmation that actions registered

## 4. Premium Feel

Premium for THIS feature means:

**Micro-interactions:** Every number uses tabular-nums. Every progress bar animates its fill. ProgressRing glows at ≥80%. PRBanner bounces with `springs.bouncy`. All on the UI thread via Reanimated — zero jank.

**Transitions:** All 13 RN Animated components migrate to Reanimated. LayoutAnimation calls migrate to Reanimated layout transitions. Spring presets from tokens (gentle/snappy/bouncy) — no inline configs.

**Loading states:** Every screen gets Skeleton placeholders. No more blank screens, no more ActivityIndicator spinners. The skeleton shapes match the content layout so users know what's coming.

**Empty states:** Every screen gets an EmptyState with icon + title + description + CTA. New users see guidance, not void.

**Error states:** Every primary tab gets an error banner with retry. Per-screen ErrorBoundary catches render crashes. No more silent failures.

**Haptics:** PR detection, timer completion, meal log success, workout finish — all get tactile confirmation. The app acknowledges your actions physically.

**Copy tone:** Not applicable — this is visual/interaction polish, not copy changes.

**What cheap looks like vs what we're shipping:**
- Cheap: numbers jitter on update → Premium: tabular-nums, zero layout shift
- Cheap: 26pt gear icon → Premium: 44pt touch target, sweaty-hand proof
- Cheap: blank screen on load → Premium: skeleton that matches content shape
- Cheap: silent API failure → Premium: error banner with retry
- Cheap: JS-thread animation jank → Premium: UI-thread Reanimated, 60fps

## 5. Integration Audit

Every change in this spec touches existing files. Here's the impact map:

**Token System (`app/theme/tokens.ts`) — 4 changes:**
- `colors.text.muted`: `#64748B` → `#7B8DA1`. All components using this token get better contrast automatically. No component changes needed. Because: WCAG AA compliance, legal risk reduction.
- Add `colors.semantic.caution` + `cautionSubtle`: New tokens. No existing behavior changes. RPEBadge will reference these instead of hardcoded hex. Because: token system completeness.
- Add `colors.border.highlight`: New token. Card raised variant will reference this. Because: eliminate hardcoded rgba.
- Add `typography.size['5xl'] = 64`: New token. RestTimer will reference this. Because: eliminate computed font size hack.

**Animation hooks (4 files) — reduce-motion addition:**
- `usePressAnimation.ts`, `useStaggeredEntrance.ts`, `useSkeletonPulse.ts`, `useCountingValue.ts`: Add `useReducedMotion()` check. When enabled, return static values. Existing behavior unchanged when reduce-motion is off. Because: accessibility compliance, zero risk to existing users.

**Training components (8 files) — Reanimated migration:**
- PRBanner, RestTimerRing, RestTimerV2, RestTimerBar, ExerciseDetailSheet, PreviousPerformance, OverloadSuggestionBadge, BodySilhouette: Replace RN Animated API with Reanimated equivalents. Visual output identical — same spring configs, same timing. Only the execution thread changes (JS → UI). Because: 60fps consistency, animation library unification.

**Screen files (10+ files) — state additions:**
- DashboardScreen, LogsScreen, AnalyticsScreen, ProfileScreen, CoachingScreen, CommunityScreen, LearnScreen, HealthReportsScreen, NutritionReportScreen, ActiveWorkoutScreen: Add loading/empty/error states. These are additive — they only appear in states that currently show nothing or stale data. Existing happy-path rendering is untouched. Because: user trust, new user onboarding, error recovery.

**Modal files (4 files) — ModalContainer migration:**
- RecoveryCheckinModal, FatigueBreakdownModal, UpgradeModal, CelebrationModal: Replace raw `<Modal>` with ModalContainer. Visual change: consistent backdrop, animation, close button, drag handle. Because: cohesive modal experience.

**Component files (15+ files) — token compliance:**
- Replace hardcoded hex/rgba/fontSize/fontWeight/borderRadius/spacing values with token references. Visual output identical — same values, just referenced from tokens. Because: maintainability, theme-ability.

**What stays untouched:**
- All business logic, API calls, data models, navigation structure, screen routing
- SwipeableRow animation (requires RN Animated for gesture-handler compatibility)
- BottomTabNavigator card interpolators (requires RN Animated for React Navigation — evaluation only)

## 6. Backward Compatibility

This is a client-side UI polish pass. There are no API changes, no data model changes, no new screens, no removed screens.

**Degraded experience for users who haven't updated:** They keep the current 5.5/10 experience. No breakage — this is purely additive polish.

**Feature flag consideration:** Not needed for most changes (token updates, tabular-nums, touch targets, accessibility labels). Consider a feature flag for:
- Reanimated migrations (in case of device-specific rendering issues)
- Per-screen ErrorBoundary (in case of unexpected error boundary triggers)

**Graceful failure:** If Reanimated is unavailable on a device, the existing RN Animated code paths should remain as fallbacks during the migration period. Each migration should be tested on both iOS and Android before removing the old code path.

## 7. Edge Cases

**Empty states — first-time use:** Every primary screen (Dashboard, Logs, Analytics, Profile) shows EmptyState with contextual CTA. Secondary screens (ProgressPhotos, ShoppingList, Community) also covered. Because: new users must never see a blank screen.

**No network:** Error states with retry buttons on all primary tabs. ErrorBoundary catches render crashes. Retry uses the same data-fetching function that the screen already has. Because: gym WiFi is unreliable.

**Interrupted flow:** Skeleton loading states handle slow connections gracefully — user sees content shape, not a spinner. If data arrives partially, the screen renders what it has. Because: perceived performance matters.

**Reduce-motion enabled:** All 4 animation hooks + 4 components check `useReducedMotion()`. When enabled: no spring animations, no staggered entrances, no skeleton pulsing, no modal slide-up. Static equivalents shown instead. Because: vestibular disorder accommodation.

**Large font scale (accessibility):** `maxFontSizeMultiplier={1.5}` on RestTimer, BudgetBar, ProgressRing numeric displays. `minHeight` instead of `height` on FilterPill, RPEPicker, RPEBadge. Because: prevent layout breakage at 200%+ font scale.

**CVD (color blindness):** MacroRingsRow gets text labels ("Protein", "Carbs", "Fat"). TrendLineChart secondary line gets `strokeDasharray`. Because: 8% of males have some form of CVD.

**Feature flag off:** If Reanimated migration flag is off, components use existing RN Animated code. No visual change, no crash.

## 8. Success Metrics

**Primary metrics:**
1. **Premium audit score**: 5.5/10 → ≥7.5/10 (re-audit after Phase 2 completion). Because: this is the direct measure of what we're fixing.
2. **WCAG AA compliance rate**: 7/9 color pairs passing → 9/9. Because: accessibility is non-negotiable and measurable.
3. **Animation library unification**: 16 Reanimated / 13 RN Animated → 27 Reanimated / 2 RN Animated (SwipeableRow + BottomTabNavigator exceptions). Because: 60fps consistency.

**Guardrail metrics:**
- **App crash rate**: Must not increase after Reanimated migrations. Monitored per-component.
- **Screen load time (P50/P95)**: Must not regress after adding Skeleton loading states. Skeletons add perceived performance but must not add actual latency.
- **Existing test suite**: All current Jest tests must continue passing. No regressions.

## 9. Rollout Strategy

**Phase 1 (Weeks 1-2) — Foundation:** Ship token fixes, touch targets, reduce-motion, and Reanimated migrations together. These are low-risk, high-impact. Token changes propagate automatically. Touch target and reduce-motion changes are purely additive. Reanimated migrations are 1:1 replacements.

**Phase 2 (Weeks 3-4) — Component Polish:** Ship screen states (loading/empty/error), modal migrations, remaining token compliance, and benchmark visual upgrades. Screen states are additive (only appear in currently-broken states). Modal migrations change visual presentation but not functionality.

**Phase 3 (Weeks 5-6) — Screen-Level Premium:** Ship spacing/density improvements, haptics, typography polish, data visualization upgrades, remaining accessibility labels. These are refinements on top of the foundation.

**Phase 4 (Weeks 7-8) — Final Polish:** Ship remaining low-priority items, global lineHeight/letterSpacing application, BottomTabNavigator evaluation.

**Kill switch criteria:** If crash rate increases >0.1% on any screen after a phase ships, revert that phase's Reanimated migrations immediately. Token changes and accessibility fixes are never reverted.

**Testing gate:** Each phase must pass all existing Jest tests + new tests for added states before shipping.

## 10. What We're NOT Building (v1 Scope)

- **No new screens or features.** This is polish, not functionality. Because: scope creep kills polish initiatives.
- **No responsive 2-column Dashboard layout.** Listed as BENCH-010 (6h effort, Phase 3). Deferred to v2 because: high complexity, low ROI relative to other items, requires extensive device testing.
- **No BottomTabNavigator Reanimated migration.** Evaluation only. React Navigation card interpolators require RN Animated. Because: breaking navigation is unacceptable risk.
- **No dark/light theme toggle.** Token system supports it structurally, but we're not building the toggle UI. Because: out of audit scope.
- **No custom font loading changes.** Inter and JetBrains Mono are already loaded. Because: font infrastructure is fine.
- **No emoji fontSize standardization.** COMP-032/033 are Low priority and platform-dependent. Because: near-zero user impact.
- **No circle borderRadius refactoring.** COMP-032 is acceptable as-is. Because: `borderRadius: width/2` is the standard circle pattern.


---

## Glossary

- **Token_System**: The centralized design token definitions in `app/theme/tokens.ts` that provide colors, typography, spacing, radius, motion, shadows, and spring presets for the entire app.
- **Reanimated**: `react-native-reanimated` — the project-standard animation library that runs animations on the UI thread for 60fps performance.
- **RN_Animated**: The legacy `Animated` API from `react-native` that runs animations on the JS thread. Being phased out.
- **WCAG_AA**: Web Content Accessibility Guidelines level AA — requires 4.5:1 contrast ratio for normal text and 3:1 for large text (≥18pt bold or ≥24pt).
- **Reduce_Motion**: The OS-level accessibility setting (`useReducedMotion()` from Reanimated) that indicates the user prefers minimal animation.
- **Skeleton**: The `app/components/common/Skeleton.tsx` loading placeholder component that shows pulsing shapes while content loads.
- **EmptyState**: The `app/components/common/EmptyState.tsx` component that shows an icon, title, description, and optional CTA when a screen has no data.
- **ModalContainer**: The `app/components/common/ModalContainer.tsx` standardized modal wrapper with consistent backdrop, animation, close button, and drag handle.
- **ErrorBoundary**: A React error boundary component that catches render errors and shows a fallback UI with retry capability.
- **Touch_Target**: The minimum tappable area for interactive elements, required to be ≥44×44pt per Apple HIG and WCAG 2.5.5.
- **CVD**: Color Vision Deficiency — conditions (protanopia, deuteranopia, tritanopia) where users cannot distinguish certain color pairs.
- **Tabular_Nums**: The `fontVariant: ['tabular-nums', 'lining-nums']` CSS/RN property that gives each digit equal width, preventing layout jitter when numbers change.
- **Haptics**: Tactile feedback via `expo-haptics` triggered at key interaction moments (PR detection, timer completion, etc.).
- **Spring_Preset**: Predefined spring animation configurations in `springs.gentle`, `springs.snappy`, and `springs.bouncy` from the Token_System.

---

## Requirements

### Requirement 1: WCAG Color Contrast Compliance

**User Story:** As a user with low vision, I want all text to meet WCAG AA contrast ratios, so that I can read captions, timestamps, and muted text on dark backgrounds without straining.

#### Acceptance Criteria

1. WHEN the Token_System defines `colors.text.muted`, THE Token_System SHALL set the value to `#7B8DA1` which achieves ≥4.5:1 contrast ratio against both `colors.bg.base` (#0A0E13) and `colors.bg.surface` (#12171F). Because: current value #64748B fails at 4.06:1 and 3.84:1 respectively — legal accessibility risk.
2. WHEN the Token_System is updated, THE Token_System SHALL include a `colors.semantic.caution` token (#F97316) and `colors.semantic.cautionSubtle` token (rgba(249,115,22,0.12)) for RPE orange displays. Because: RPEBadge currently hardcodes these values outside the token system.
3. WHEN the Token_System is updated, THE Token_System SHALL include a `colors.border.highlight` token (rgba(255,255,255,0.04)) for Card raised variant top border. Because: Card.tsx currently hardcodes this rgba value.

### Requirement 2: Hardcoded Color Elimination

**User Story:** As a developer, I want all color values to reference Token_System tokens, so that the design system is the single source of truth and future theme changes propagate consistently.

#### Acceptance Criteria

1. WHEN rendering overlay backdrops, THE components SHALL use `colors.bg.overlay` instead of hardcoded `rgba(0,0,0,X)` values across FatigueBreakdownModal, RPEPicker, ConfirmationSheet, CelebrationModal, PreferencesSection, BarcodeScanner, and ModalContainer. Because: 6 different opacity values (0.3–0.7) exist across modals — standardizing on the token ensures consistency.
2. WHEN rendering exercise-picker components, THE components SHALL use `colors.accent.primary` instead of hardcoded `#2563EB` and `colors.text.primary` instead of hardcoded `#FFFFFF` in MuscleGroupIcon, MuscleGroupGrid, RecentExercises, and ExerciseCard. Because: these hardcoded values diverge from the token palette.
3. WHEN rendering SwipeableRow delete text, THE SwipeableRow SHALL use `colors.text.primary` instead of hardcoded `#FFFFFF`. Because: token compliance.
4. WHEN rendering RPEBadge colors, THE RPEBadge SHALL use `colors.semantic.caution` and `colors.semantic.cautionSubtle` instead of hardcoded `#F97316` and `rgba(249,115,22,0.12)`. Because: these colors should be themeable.
5. WHEN rendering border/highlight values, THE components SHALL use `colors.border.subtle` or `colors.border.highlight` instead of hardcoded `rgba(255,255,255,0.04)` and `rgba(255,255,255,0.06)` in PrepSundayFlow, BottomTabNavigator, and Card. Because: border tokens exist but aren't used.
6. WHEN rendering achievement-related purple, THE components SHALL use a shared purple token instead of hardcoded `#8B5CF6` in LearnScreen and AchievementCard. Because: duplicate hardcoded values are a maintenance risk.

### Requirement 3: Tabular Numerics for Numeric Displays

**User Story:** As a user tracking nutrition and training data, I want numeric displays to use fixed-width digits, so that numbers do not jitter or shift layout when values change in real-time.

#### Acceptance Criteria

1. WHEN displaying numeric values, THE BudgetBar SHALL apply `fontVariant: typography.numeric.fontVariant` to calorie number and macro value text styles. Because: calorie counts change frequently and jitter is visible.
2. WHEN displaying numeric values, THE ProgressRing SHALL apply `fontVariant: typography.numeric.fontVariant` to center text style. Because: macro ring values update on every food log.
3. WHEN displaying numeric values, THE RestTimer SHALL apply `fontVariant: typography.numeric.fontVariant` to countdown text style. Because: the timer updates every second — jitter is most noticeable here.
4. WHEN displaying numeric values, THE StreakIndicator SHALL apply `fontVariant: typography.numeric.fontVariant` to count text style.
5. WHEN displaying numeric values, THE ExpenditureTrendCard SHALL apply `fontVariant: typography.numeric.fontVariant` to TDEE value text style.
6. WHEN displaying numeric values, THE LogsScreen SHALL apply `fontVariant: typography.numeric.fontVariant` to all inline numeric text styles.
7. WHEN displaying numeric values, THE AnalyticsScreen SHALL apply `fontVariant: typography.numeric.fontVariant` to all inline numeric text styles.

### Requirement 4: Typography Token Compliance

**User Story:** As a developer, I want all font sizes, weights, letter spacing, and line heights to reference Token_System tokens, so that typography is consistent across the app and maintainable from a single source.

#### Acceptance Criteria

1. WHEN the Token_System defines typography sizes, THE Token_System SHALL include a `typography.size['5xl']` token with value 64 for the RestTimer countdown display. Because: RestTimer currently computes `typography.size['3xl'] * 2` which is a hack.
2. WHEN rendering the RestTimer countdown, THE RestTimer SHALL use `typography.size['5xl']` instead of the computed `typography.size['3xl'] * 2`.
3. WHEN rendering text, THE ModalContainer SHALL use `typography.size.lg` instead of hardcoded `fontSize: 18` for the title.
4. WHEN rendering text, THE EmptyState SHALL use `letterSpacing.tight` instead of hardcoded `letterSpacing: -0.25`.
5. WHEN rendering text, THE BarcodeScanner SHALL use `typography.weight.semibold` and `typography.weight.bold` instead of hardcoded `fontWeight: '600'` and `'700'`.
6. WHEN rendering text, THE FatigueBreakdownModal SHALL use `typography.size.xl` and `typography.size['3xl']` instead of hardcoded `fontSize: 20` and `fontSize: 40`.
7. WHEN rendering the disabled state, THE Button SHALL use `opacityScale.disabled` instead of hardcoded `opacity: 0.4`. Because: the token exists specifically for this purpose.
8. WHEN rendering screen titles, THE DashboardScreen and ProfileScreen SHALL display screen titles using `typography.size.xl` and `typography.weight.semibold` matching LogsScreen and AnalyticsScreen. Because: 2 of 4 primary tabs lack screen titles — inconsistency.
9. WHEN rendering headings, THE components SHALL apply `letterSpacing.tight` to screen titles and section headers, and `letterSpacing.tighter` to hero numbers (RestTimer countdown, TDEE value, BudgetBar calorie). Because: letter spacing tokens exist but are never applied.
10. WHEN rendering text in DashboardScreen, THE DashboardScreen SHALL use `typography.size.sm` and `typography.size.base` instead of hardcoded `fontSize: 13` and `fontSize: 14`.
11. WHEN rendering line heights, THE components SHALL apply `lineHeight.tight` (1.2) to headings and `lineHeight.normal` (1.5) to body text across all screens. Because: lineHeight tokens are defined but never used.
12. WHEN rendering user-generated text (exercise names, food names, item names), THE components SHALL apply `numberOfLines` truncation across ActiveWorkoutScreen, LogsScreen, SessionDetailScreen, SessionDetailView, ExercisePickerScreen, MealPlanScreen, PrepSundayFlow, and ShoppingListView. Because: long text currently overflows and breaks layouts.

### Requirement 5: Spacing and Density Token Compliance

**User Story:** As a user, I want consistent spacing between screen sections, so that the app feels breathable and premium rather than cramped or inconsistent.

#### Acceptance Criteria

1. WHEN rendering the DashboardScreen, THE DashboardScreen SHALL use `spacing[6]` (24px) gaps between major sections (QuickActions, MacroRingsRow, BudgetBar, MealSlotDiary). Because: currently 0px section gaps — dashboard feels cramped.
2. WHEN rendering the AnalyticsScreen, THE AnalyticsScreen SHALL use `spacing[6]` (24px) for section title marginTop instead of `spacing[5]` (20px). Because: 4px difference aligns with the 3-tier spacing hierarchy.
3. WHEN rendering border radius values, THE DashboardScreen SHALL use `radius.md` and `radius.sm` instead of hardcoded `borderRadius: 12` and `borderRadius: 8`.
4. WHEN rendering gap values, THE DashboardScreen SHALL use `spacing[4]` instead of hardcoded `gap: 16`.
5. WHEN rendering the BudgetBar progress track, THE BudgetBar SHALL use token-based values for height and borderRadius instead of hardcoded `height: 6`, `borderRadius: 3`, `marginBottom: 2`.
6. WHEN rendering ExerciseCard spacing, THE ExerciseCard SHALL use `spacing[1]` instead of hardcoded `marginTop: 4` and `paddingVertical: 2`.
7. WHEN rendering ActiveWorkoutScreen, THE ActiveWorkoutScreen SHALL use `spacing[6]` gap before superset groups and token-based values for set input padding and borderRadius. Because: flat spacing hierarchy makes exercise groups indistinguishable.
8. WHEN rendering RecipeScalingModal, THE RecipeScalingModal SHALL use `radius.lg` and `radius.sm` instead of hardcoded `borderRadius: 16` and `borderRadius: 8`.
9. WHEN rendering AddTrainingModal, THE AddTrainingModal SHALL use `spacing[3]` instead of hardcoded `padding: 12`.
10. WHEN rendering MealBuilder, THE MealBuilder SHALL remove the `?? '#ef4444'` fallback since `colors.semantic.negative` is always defined. Because: unnecessary fallback suggests the token might not exist.
11. WHEN rendering the tab bar, THE BottomTabNavigator SHALL ensure iconWrap dimensions meet the 44×44pt minimum Touch_Target. Because: current 32×28pt is below minimum.


### Requirement 6: Animation Library Unification

**User Story:** As a user, I want all animations to run at 60fps on the UI thread, so that the app feels smooth and responsive during workouts and data entry — not janky from JS-thread bottlenecks.

#### Acceptance Criteria

1. WHEN animating PRBanner, THE PRBanner SHALL use Reanimated `withSpring` with `springs.bouncy` preset instead of RN_Animated `Animated.spring`. Because: celebration animation should be the smoothest in the app.
2. WHEN animating RestTimerRing, THE RestTimerRing SHALL use Reanimated `withTiming` instead of RN_Animated `Animated.timing`.
3. WHEN animating RestTimerV2, THE RestTimerV2 SHALL use Reanimated instead of RN_Animated.
4. WHEN animating RestTimerBar, THE RestTimerBar SHALL use Reanimated `withSpring` with `springs.gentle` preset instead of RN_Animated `Animated.spring`.
5. WHEN animating ExerciseDetailSheet, THE ExerciseDetailSheet SHALL use Reanimated instead of RN_Animated `Animated.spring` and `Animated.timing`.
6. WHEN showing loading state in PreviousPerformance, THE PreviousPerformance SHALL use the `useSkeletonPulse` hook instead of a custom RN_Animated pulse loop. Because: reuse existing hook, eliminate custom animation code.
7. WHEN animating OverloadSuggestionBadge, THE OverloadSuggestionBadge SHALL use Reanimated instead of RN_Animated.
8. WHEN animating BodySilhouette region press, THE BodySilhouette SHALL use Reanimated `withTiming` instead of RN_Animated `Animated.timing`.
9. WHEN animating ActiveWorkoutScreen SetRow background tint, THE ActiveWorkoutScreen SHALL use Reanimated `withTiming` and `useAnimatedStyle` instead of RN_Animated `Animated.timing`.
10. WHEN animating Tooltip fade, THE Tooltip SHALL use Reanimated `withTiming` instead of RN_Animated `Animated.timing`.
11. WHEN animating CollapsibleSection expand/collapse, THE CollapsibleSection SHALL use Reanimated layout animations instead of `LayoutAnimation.Presets.easeInEaseOut`. Because: LayoutAnimation is global and can cause unexpected side effects.
12. WHEN animating AccountSection expand/collapse, THE AccountSection SHALL use Reanimated layout animations instead of `LayoutAnimation.Presets.easeInEaseOut`.
13. WHEN animating RestTimer settings toggle, THE RestTimer SHALL use Reanimated layout animations instead of `LayoutAnimation.Presets.easeInEaseOut`.
14. WHEN animating ArticleDetailScreen scroll progress, THE ArticleDetailScreen SHALL use Reanimated instead of RN_Animated `Animated.timing`.
15. WHEN using spring configurations, THE PRBanner SHALL use `springs.bouncy` preset instead of inline `damping:12, stiffness:200`. Because: token presets ensure consistency.
16. WHEN using spring configurations, THE RestTimerBar SHALL import and use `springs.gentle` preset instead of inline `damping:20, stiffness:200, mass:0.5`.
17. WHEN using spring configurations, THE ExerciseDetailSheet SHALL use an appropriate Spring_Preset instead of RN Animated default spring config.

### Requirement 7: Reduce-Motion Accessibility

**User Story:** As a user with motion sensitivity or vestibular disorder, I want all animations to respect my OS reduce-motion setting, so that I can use the app without experiencing discomfort or disorientation.

#### Acceptance Criteria

1. WHEN Reduce_Motion is enabled, THE usePressAnimation hook SHALL return a static style (no scale/opacity animation). Because: press feedback is the most frequent animation — must respect preference.
2. WHEN Reduce_Motion is enabled, THE useStaggeredEntrance hook SHALL return a static fully-visible style (no entrance animation).
3. WHEN Reduce_Motion is enabled, THE useSkeletonPulse hook SHALL return a static opacity of 0.5 (no pulsing animation). Because: infinite pulse is the most disorienting for motion-sensitive users.
4. WHEN Reduce_Motion is enabled, THE useCountingValue hook SHALL snap immediately to the target value (no counting animation).
5. WHEN Reduce_Motion is enabled, THE ProgressRing SHALL set progress directly without spring animation.
6. WHEN Reduce_Motion is enabled, THE PRBanner SHALL show at scale=1 immediately without spring animation.
7. WHEN Reduce_Motion is enabled, THE Skeleton component SHALL use static opacity 0.5 (matching the web fallback behavior).
8. WHEN Reduce_Motion is enabled, THE ModalContainer SHALL show the modal immediately without slide-up or scale animation.

### Requirement 8: Touch Target Compliance

**User Story:** As a user working out with sweaty hands, I want all interactive elements to have ≥44×44pt touch targets, so that I can reliably tap buttons and controls during active workouts without frustration.

#### Acceptance Criteria

1. WHEN rendering the RestTimer gear icon, THE RestTimer SHALL ensure the gear button has a minimum touch target of 44×44pt via `minWidth: 44, minHeight: 44` or equivalent padding/hitSlop. Because: current 26×26pt is 65% below minimum — most critical touch target failure.
2. WHEN rendering SetTypeSelector pills, THE SetTypeSelector SHALL ensure each pill has a minimum height of 44pt. Because: current ~28×16pt is nearly untappable during workouts.
3. WHEN rendering FilterPill, THE FilterPill SHALL use `minHeight: 44` instead of `height: 32`. Because: 32pt is below the 44pt minimum.
4. WHEN rendering the ModalContainer close button, THE ModalContainer SHALL ensure the close button has a total touch target of ≥44×44pt via increased hitSlop or padding. Because: current ~34pt (hitSlop=8 + padding=8 + icon=18) is below minimum.
5. WHEN rendering the ProgressRing "Set targets" text, THE ProgressRing SHALL ensure the tap target has a minimum height of 44pt via `minHeight: 44` or `hitSlop`. Because: current ~60×16pt text-only target is too small vertically.
6. WHEN rendering fixed-height containers, THE FilterPill, RPEPicker, and RPEBadge SHALL use `minHeight` instead of `height` to prevent text clipping at increased font scale. Because: fixed heights clip text at 1.5x+ font scale.

### Requirement 9: Screen Loading States

**User Story:** As a user, I want to see skeleton loading placeholders while screen data loads, so that I understand the app is working and know what content to expect — not staring at a blank screen.

#### Acceptance Criteria

1. WHEN ProfileScreen is loading data, THE ProfileScreen SHALL display Skeleton components for profile sections instead of showing "?" avatar and "—" email. Because: Profile is a primary tab — blank loading is unacceptable.
2. WHEN CoachingScreen is loading data, THE CoachingScreen SHALL display Skeleton components for coaching sections.
3. WHEN CommunityScreen is loading data, THE CommunityScreen SHALL display Skeleton components or a loading indicator.
4. WHEN LearnScreen is loading articles, THE LearnScreen SHALL display Skeleton components for article cards.
5. WHEN HealthReportsScreen is loading reports, THE HealthReportsScreen SHALL display Skeleton components for report cards.
6. WHEN NutritionReportScreen is loading, THE NutritionReportScreen SHALL display Skeleton components instead of ActivityIndicator. Because: ActivityIndicator is generic — Skeleton matches the content shape.
7. WHEN ActiveWorkoutScreen is initializing a session, THE ActiveWorkoutScreen SHALL display a brief skeleton during initialization.

### Requirement 10: Screen Empty States

**User Story:** As a new user with no data, I want every screen to show a helpful empty state with a clear call-to-action, so that I know exactly what to do next and don't think the app is broken.

#### Acceptance Criteria

1. WHEN DashboardScreen has no data, THE DashboardScreen SHALL display an EmptyState component with a "Log your first meal" CTA. Because: Dashboard is the first screen — blank = "is this broken?"
2. WHEN LogsScreen nutrition tab has zero entries, THE LogsScreen SHALL display an EmptyState for the nutrition tab.
3. WHEN ProfileScreen has no profile data, THE ProfileScreen SHALL display an EmptyState.
4. WHEN ProgressPhotosScreen has zero photos, THE ProgressPhotosScreen SHALL display an EmptyState with a camera icon and CTA.
5. WHEN CommunityScreen has zero posts, THE CommunityScreen SHALL display an EmptyState with a community icon.
6. WHEN ShoppingListView has zero items, THE ShoppingListView SHALL display an EmptyState when `items.length === 0`.

### Requirement 11: Screen Error States

**User Story:** As a user experiencing network issues at the gym, I want clear error messages with retry options, so that I can recover from failures without force-quitting the app.

#### Acceptance Criteria

1. WHEN DashboardScreen API calls fail, THE DashboardScreen SHALL display an error banner with a retry action instead of silently showing stale/zero data. Because: silent failure = user thinks app is broken.
2. WHEN LogsScreen `loadData` fails, THE LogsScreen SHALL display an error state with a retry action.
3. WHEN AnalyticsScreen `loadAnalytics` fails, THE AnalyticsScreen SHALL display an error banner with a retry action.
4. WHEN ProfileScreen data fetch fails, THE ProfileScreen SHALL display an error state with a retry action.
5. WHEN CoachingScreen `loadData` fails, THE CoachingScreen SHALL display an error banner with a retry action.
6. WHEN CommunityScreen data fetch fails, THE CommunityScreen SHALL display a subtle error indicator.
7. WHEN a render error occurs in any tab screen, THE ErrorBoundary SHALL catch the error and display a fallback UI with retry capability, wrapping DashboardScreen, LogsScreen, AnalyticsScreen, and ProfileScreen individually. Because: one screen crash should not take down the entire app.

### Requirement 12: Modal Consistency

**User Story:** As a user, I want all modals to have consistent animation, backdrop, close button, and drag handle behavior, so that the app feels cohesive and predictable.

#### Acceptance Criteria

1. WHEN displaying RecoveryCheckinModal, THE RecoveryCheckinModal SHALL use ModalContainer instead of raw `<Modal>` with RN `animationType="slide"`. Because: ModalContainer provides consistent backdrop, animation, close button, and drag handle.
2. WHEN displaying FatigueBreakdownModal, THE FatigueBreakdownModal SHALL use ModalContainer instead of raw `<Modal>` with `animationType="slide"`.
3. WHEN displaying UpgradeModal, THE UpgradeModal SHALL use ModalContainer instead of raw `<Modal>` with `animationType="slide"`.
4. WHEN displaying CelebrationModal, THE CelebrationModal SHALL use ModalContainer instead of raw `<Modal>` with `animationType="fade"`. Because: even though it uses Reanimated FadeIn internally, the outer Modal wrapper should be ModalContainer for consistency.

### Requirement 13: Accessibility Labels

**User Story:** As a screen reader user, I want all interactive and informational elements to have descriptive accessibility labels, so that I can navigate and understand the app without visual cues.

#### Acceptance Criteria

1. WHEN rendering the ModalContainer close button, THE ModalContainer SHALL include `accessibilityLabel="Close modal"`. Because: this affects all 12+ modals in the app.
2. WHEN rendering the RestTimer gear button, THE RestTimer SHALL include `accessibilityLabel="Timer settings"`.
3. WHEN rendering ProgressRing, THE ProgressRing SHALL include an `accessibilityLabel` that communicates the current value, target, and percentage (e.g., "Protein: 85 of 150 grams, 57%").
4. WHEN rendering BudgetBar, THE BudgetBar SHALL include an `accessibilityLabel` that communicates remaining calories (e.g., "1,200 of 2,000 calories remaining").
5. WHEN rendering MacroRingsRow, THE MacroRingsRow SHALL pass macro name labels ("Protein", "Carbs", "Fat") to each ring instead of relying on color alone. Because: color-only identification fails for CVD users and screen reader users.
6. WHEN rendering BodySilhouette SVG regions, THE BodySilhouette SHALL include `accessibilityLabel` per muscle group region.
7. WHEN rendering DateScroller day cells, THE DateScroller SHALL include `accessibilityLabel` with date, selected state, and logged status.
8. WHEN rendering SetTypeSelector, THE SetTypeSelector SHALL include `accessibilityLabel` with the current set type.
9. WHEN rendering RPEPicker buttons, THE RPEPicker SHALL include `accessibilityLabel` with the RPE/RIR value.
10. WHEN rendering FilterPill, THE FilterPill SHALL include `accessibilityLabel` with filter name and active state.
11. WHEN rendering critical numeric displays, THE RestTimer, BudgetBar, and ProgressRing SHALL include `maxFontSizeMultiplier={1.5}` to prevent layout breakage at large font scales.

### Requirement 14: CVD (Color Vision Deficiency) Support

**User Story:** As a user with color vision deficiency, I want macro nutrient displays to be distinguishable without relying solely on color, so that I can accurately read my nutrition data.

#### Acceptance Criteria

1. WHEN displaying macro rings in MacroRingsRow, THE MacroRingsRow SHALL include text labels ("Protein", "Carbs", "Fat") alongside each ring so that macros are identifiable without color. Because: 3/6 color pairs fail ≥3:1 under protanopia, 3/6 under deuteranopia, 0/6 pass under tritanopia.
2. WHEN displaying macro bars in BudgetBar, THE BudgetBar SHALL include text labels for each macro segment.
3. WHEN rendering TrendLineChart with multiple lines, THE TrendLineChart SHALL use `strokeDasharray` on the secondary line to differentiate it from the primary line without relying on color alone.

### Requirement 15: Benchmark Visual Upgrades

**User Story:** As a user, I want premium visual polish comparable to top fitness apps (WHOOP, MacroFactor, Apple Fitness+), so that the app feels high-quality and rewarding to use daily.

#### Acceptance Criteria

1. WHEN ProgressRing fill reaches ≥80%, THE ProgressRing SHALL display a glow effect using `glowShadow(color, 16, 0.4)`. Because: rewarding visual moment as user approaches goal — WHOOP and Apple Fitness+ both do this.
2. WHEN BudgetBar progress changes, THE BudgetBar SHALL animate the fill width using Reanimated `withTiming` (400ms) instead of instant jumps. Because: animated fills feel alive — static fills feel broken.
3. WHEN rendering TrendLineChart, THE TrendLineChart SHALL display a gradient fill below the trend line. Because: gradient fills add depth — bare lines look unfinished.
4. WHEN a user taps a data point on TrendLineChart, THE TrendLineChart SHALL display a floating tooltip card with `shadows.md` near the selected point instead of a flat inline view. Because: floating tooltips are the standard in premium data visualization.
5. WHEN rendering Dashboard Quick Actions, THE DashboardScreen SHALL position quick action buttons in the thumb zone (lower portion of scroll content) for ergonomic access. Because: current top-30% placement requires reaching.

### Requirement 16: Haptic Feedback

**User Story:** As a user, I want tactile feedback at key interaction moments, so that the app feels responsive and rewarding — confirming my actions physically.

#### Acceptance Criteria

1. WHEN a personal record is detected, THE PRBanner SHALL trigger `Haptics.notificationAsync(Success)`. Because: PR is the most rewarding moment in the app — it deserves physical confirmation.
2. WHEN the rest timer completes, THE RestTimer SHALL trigger `Haptics.notificationAsync(Success)`. Because: timer completion is a cue to start the next set — haptic ensures user notices even if not looking.
3. WHEN a meal is successfully logged, THE AddNutritionModal SHALL trigger `Haptics.impactAsync(Light)`. Because: lightweight confirmation that the log was saved.
4. WHEN a workout is finished and saved, THE ActiveWorkoutScreen SHALL trigger `Haptics.notificationAsync(Success)`. Because: workout completion is a milestone moment.

### Requirement 17: Navigation Polish

**User Story:** As a developer, I want to evaluate whether the BottomTabNavigator `slideFromRight` transition can be migrated to Reanimated, so that navigation animations are consistent with the rest of the app.

#### Acceptance Criteria

1. WHEN evaluating the BottomTabNavigator, THE developer SHALL assess whether React Navigation card interpolators can use Reanimated instead of RN_Animated, and implement the migration if feasible without breaking navigation behavior. Because: React Navigation may require RN Animated for card interpolators — this needs investigation before committing.
