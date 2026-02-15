# Implementation Plan: UX Redesign V1

## Overview

Production-hardened implementation plan. Strict dependency ordering — no step references anything not yet built. Each step is specific enough for a junior dev to execute without questions. Testing checkpoints gate forward progress. Rollback is per-step since all changes are frontend-only (git revert).

## Pre-flight

- All changes are frontend-only (React Native/Expo). No backend migrations, secrets, or permissions needed.
- Rollback for any step: `git revert` the commit(s) for that step. No database state to unwind.
- Feature flag: Not required for v1 (this is a full redesign, not an incremental feature). If partial rollout is desired later, wrap the new BottomTabNavigator in a feature flag check.
- Monitoring post-launch: Track screen render times via Expo's `Performance` API. Alert if Dashboard render exceeds 500ms. Track tab switch frequency to validate 4-tab adoption.

## Tasks

- [x] 1. Install Reanimated and verify Expo compatibility
  - [x] 1.1 Run `yarn add react-native-reanimated` (if not already installed). Verify `babel.config.js` includes `react-native-reanimated/plugin` as the last plugin. Run `yarn start --clear` to confirm no build errors on web and mobile.
    - Risk: Reanimated plugin conflicts with existing Babel config. Mitigation: Check existing babel.config.js first, add plugin only if missing.
    - _Requirements: 14.1, 15.1, 16.1_

- [ ] 2. Update design tokens
  - [x] 2.1 Update `app/theme/tokens.ts`: change `bg.base` to `#0A0E13`, `bg.surface` to `#12171F`, `bg.surfaceRaised` to `#1A2029`. Update `text.primary` to `#F1F5F9`, `text.secondary` to `#94A3B8`, `text.muted` to `#64748B`. Update `border.subtle` to `rgba(255,255,255,0.06)`. Add `border.hover: 'rgba(255,255,255,0.12)'`. Add `macro` color ramp object with calories (#06B6D4), protein (#22C55E), carbs (#F59E0B), fat (#F472B6) and their subtle (10% opacity) variants.
    - Risk: Existing components reference old color values by import. Mitigation: Token names are unchanged — only values change. All existing imports continue to work.
    - _Requirements: 5.1, 5.2, 5.3, 5.6_
  - [x] 2.2 Write property tests for tokens: (a) Property 7 — verify relative luminance of bg.base < bg.surface < bg.surfaceRaised by parsing hex to RGB and computing luminance. (b) Property 15 — verify all spacing values in the spacing object are members of {0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64}. Create `app/__tests__/utils/tokenValidation.test.ts` using `fast-check`.
    - **Property 7: Surface luminance hierarchy**
    - **Property 15: Spacing scale compliance**
    - **Validates: Requirements 5.1, 13.1**

- [ ] 3. Checkpoint — Verify token update doesn't break existing screens
  - Run `yarn test` to confirm existing tests pass. Visually verify the app still renders (colors will be slightly different but nothing should break). Ask the user if questions arise.

- [ ] 4. Create animation utility hooks
  - [x] 4.1 Create `app/hooks/useStaggeredEntrance.ts`: accepts `(index: number, staggerDelay = 60)`, returns Reanimated animated style with opacity (0→1) and translateY (12→0). Delay = `index * staggerDelay` for index < 8, else 0. Triggers on mount only (uses `useEffect` with empty deps + `isInitialLoad` ref). Falls back to static style `{opacity: 1, transform: [{translateY: 0}]}` on web if Reanimated is unavailable.
    - _Requirements: 15.1, 15.2_
  - [x] 4.2 Create `app/hooks/useCountingValue.ts`: accepts `(target: number, duration = 400)`, returns a Reanimated SharedValue that interpolates from previous value to target over duration ms using `withTiming`. On target change mid-animation, cancels current and starts from current interpolated value. Formula: `start + (end - start) * progress`.
    - _Requirements: 16.3_
  - [x] 4.3 Create `app/hooks/usePressAnimation.ts`: returns `{ animatedStyle, onPressIn, onPressOut }`. onPressIn sets scale to 0.97 via `withTiming(0.97, {duration: 100})`. onPressOut sets scale to 1.0 via `withTiming(1.0, {duration: 100})`.
    - _Requirements: 16.1_
  - [x] 4.4 Create `app/hooks/useSkeletonPulse.ts`: returns animated opacity style. Uses `withRepeat(withTiming(0.7, {duration: 600}), -1, true)` starting from `useSharedValue(0.3)`.
    - _Requirements: 17.1_
  - [x] 4.5 Write property tests for hooks: (a) Property 16 — for any index 0-20 and staggerDelay 10-200, verify delay = index * staggerDelay when index < 8, else 0. (b) Property 17 — for any start, end, progress in [0,1], verify interpolation = start + (end - start) * progress, and boundary values at 0 and 1. Create `app/__tests__/utils/staggerDelay.test.ts` and `app/__tests__/utils/countingInterpolation.test.ts` using `fast-check`.
    - **Property 16: Stagger delay calculation**
    - **Property 17: Counting interpolation**
    - **Validates: Requirements 15.2, 16.3**

- [ ] 5. Build new base components (no dependencies on each other)
  - [x] 5.1 Create `app/utils/progressRingLogic.ts`: pure functions `computeRingFill(value: number, target: number): { percentage: number, fillColor: string, isOvershoot: boolean, isMissing: boolean }` and `formatRingLabel(value: number, target: number, unit: string): { centerText: string, subText: string }`. When target=0: percentage=0, isMissing=true. When value>target: percentage=100, isOvershoot=true, fillColor=semantic.warning. Otherwise: percentage=round(value/target*100), fillColor=assigned color.
    - _Requirements: 2.4, 2.5, 2.6, 5.5_
  - [x] 5.2 Create `app/components/common/ProgressRing.tsx`: SVG circle with strokeDasharray=circumference, animated strokeDashoffset via Reanimated. Uses progressRingLogic for fill/color. Renders center value text (bold), sub text (muted). When isMissing: renders "Set targets" tappable text. Props: value, target, color, trackColor, size=96, strokeWidth=8, label, animated=true, onTargetMissing.
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 8.4_
  - [x] 5.3 Write property test for progress ring logic (Property 2): for any value in [0, 10000] and target in [0, 5000], verify computeRingFill returns correct percentage, color, and flags. Create `app/__tests__/utils/progressRingLogic.test.ts`.
    - **Property 2: Progress ring correctness**
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6, 5.5**
  - [x] 5.4 Create `app/utils/progressBarLogic.ts`: pure function `computeBarFill(value: number, target: number, color: string): { percentage: number, fillWidth: string, fillColor: string, label: string }`. percentage = min(round(value/target*100), 100). fillColor = semantic.warning when value > target, else assigned color. label = percentage + "%".
    - _Requirements: 11.1, 11.2_
  - [x] 5.5 Create `app/components/common/ProgressBar.tsx`: View with filled bar (animated width), track (10% opacity), and percentage label. Uses progressBarLogic. Props: value, target, color, trackColor, showPercentage=true, height=6.
    - _Requirements: 11.1, 11.2_
  - [x] 5.6 Write property test for progress bar logic (Property 12): for any value in [0, 10000] and target in [1, 5000], verify percentage, fillColor, and label. Create `app/__tests__/utils/progressBarLogic.test.ts`.
    - **Property 12: Progress bar correctness**
    - **Validates: Requirements 11.1, 11.2**
  - [x] 5.7 Create `app/components/common/EmptyState.tsx`: centered View with 48px icon (text.muted), title (16px semibold, text.secondary), description (14px, text.muted), optional primary Button (rendered only when actionLabel prop is non-empty). Props: icon, title, description, actionLabel?, onAction?, children?.
    - _Requirements: 8.1_
  - [x] 5.8 Write property test for EmptyState (Property 10): for any non-empty icon/title/description and optional actionLabel, verify rendered output contains title text, description text, and button iff actionLabel is non-empty. Create `app/__tests__/components/EmptyState.test.tsx`.
    - **Property 10: Empty state completeness**
    - **Validates: Requirements 8.1**
  - [x] 5.9 Create `app/components/common/Skeleton.tsx`: Reanimated.View with useSkeletonPulse opacity. Background: bg.surfaceRaised. Props: width, height, borderRadius=radius.sm, variant='rect'|'circle'. Circle variant sets borderRadius to height/2.
    - _Requirements: 17.1, 17.4_
  - [x] 5.10 Create `app/components/common/FilterPill.tsx`: TouchableOpacity with animated background color transition (150ms interpolateColor via Reanimated). Active: accent.primaryMuted bg, accent.primary border, accent.primary text. Inactive: bg.surface bg, border.subtle border, text.muted text. Height 32px, horizontal padding 16px, borderRadius full. Props: label, active, onPress.
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 5.11 Write property test for FilterPill (Property 11): for any boolean active state, verify computed background and border colors match spec. Create `app/__tests__/components/FilterPill.test.tsx`.
    - **Property 11: Filter pill state styling**
    - **Validates: Requirements 9.2, 9.3**
  - [x] 5.12 Create `app/components/common/SectionHeader.tsx`: View with title Text (18px, semibold, text.primary) and optional right-aligned action TouchableOpacity (14px, accent.primary). Margin: 24px top, 12px bottom. Props: title, action?: { label, onPress }.
    - _Requirements: 7.5, 13.3_
  - [x] 5.13 Create `app/components/common/ModalContainer.tsx`: wraps children in platform-adaptive container. Web: centered View (maxWidth 480, width '90%', vertically centered) with backdrop (rgba(0,0,0,0.6), backdropFilter blur 8px), scale entrance 0.95→1.0 (200ms). Mobile: bottom-aligned View (borderTopLeftRadius 16, borderTopRightRadius 16) with drag handle bar (36×4px, bg.surfaceRaised, centered), slide-up entrance. Props: visible, onClose, title, children.
    - _Requirements: 10.1, 10.2_

- [ ] 6. Update existing Button and Card components
  - [x] 6.1 Update `app/components/common/Button.tsx`: add `ghost` variant (transparent bg, no border, accent.primary text). Add usePressAnimation hook — wrap in Reanimated.View with animatedStyle, pass onPressIn/onPressOut to TouchableOpacity. Change disabled opacity from 0.5 to 0.4. Add box-shadow to primary variant: `shadowColor: '#06B6D4', shadowOffset: {width:0, height:2}, shadowOpacity: 0.25, shadowRadius: 8`. Ensure minHeight: 44 on base style. Add optional `icon` prop (ReactNode, rendered before title text).
    - Risk: Existing screens use Button — verify no visual regressions. Mitigation: Only additive changes (new variant, new prop). Existing variant styles are refined, not replaced.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 6.2 Write property test for Button (Property 8): for any variant in {primary, secondary, ghost, danger} and disabled in {true, false}, verify computed styles have minHeight >= 44 and disabled opacity <= 0.5. Create `app/__tests__/components/Button.test.tsx`.
    - **Property 8: Button variant style correctness**
    - **Validates: Requirements 6.1, 6.2, 6.4**
  - [x] 6.3 Update `app/components/common/Card.tsx`: add `variant` prop ('flat'|'raised'|'outlined', default 'flat'). Flat: bg.surface, border.subtle, no shadow. Raised: bg.surfaceRaised, border.default, md shadow. Outlined: transparent bg, border.default, no shadow. Add optional `onPress` prop with usePressAnimation. Add optional `animated` + `animationIndex` props that apply useStaggeredEntrance. Ensure padding=16, borderRadius=12 across all variants.
    - _Requirements: 7.1, 7.2_
  - [x] 6.4 Write property test for Card (Property 9): for any variant in {flat, raised, outlined}, verify padding=16, borderRadius=12, and backgroundColor matches variant spec. Create `app/__tests__/components/Card.test.tsx`.
    - **Property 9: Card variant style correctness**
    - **Validates: Requirements 7.1, 7.2**

- [ ] 7. Checkpoint — Run all tests, verify base components render
  - Run `yarn test`. All property tests and unit tests must pass. Visually verify Button ghost variant, Card variants, ProgressRing, ProgressBar, EmptyState, Skeleton, FilterPill, and ModalContainer render correctly in isolation (use a temporary test screen if needed). Ask the user if questions arise.

- [ ] 8. Build utility functions and composite components
  - [x] 8.1 Create `app/utils/greeting.ts`: export `getGreeting(displayName?: string | null, hour?: number): string`. If hour not provided, use `new Date().getHours()`. Returns "Good morning, {name}" / "Good afternoon, {name}" / "Good evening, {name}" when displayName is non-empty, else "Good morning" / "Good afternoon" / "Good evening". Morning: hour < 12. Afternoon: 12 ≤ hour < 17. Evening: hour ≥ 17.
    - _Requirements: 2.1_
  - [x] 8.2 Write property test for greeting (Property 1): for any string displayName (including empty, null, undefined) and hour in [0, 23], verify output contains displayName when non-empty, and is a valid time-based greeting otherwise. Create `app/__tests__/utils/greeting.test.ts`.
    - **Property 1: Greeting personalization**
    - **Validates: Requirements 2.1**
  - [x] 8.3 Create `app/utils/calculateStreak.ts`: export `calculateStreak(logDates: string[], today: string): number`. Deduplicates and sorts logDates. If today not in set, returns 0. Walks backwards from today counting consecutive dates (each date is exactly 1 day before the previous). Returns count.
    - _Requirements: 3.5_
  - [x] 8.4 Write property test for streak (Property 5): for any sorted array of unique ISO date strings and today string, verify streak equals consecutive day count ending at today. Edge cases: empty array → 0, today not in array → 0, single date matching today → 1. Create `app/__tests__/utils/calculateStreak.test.ts`.
    - **Property 5: Streak calculation**
    - **Validates: Requirements 3.5**
  - [x] 8.5 Create `app/utils/comparisonColor.ts`: export `getComparisonColor(actual: number, target: number): string`. Computes percentage = round(actual/target*100). Returns semantic.positive for [90,110], semantic.warning for [70,89] or [111,130], semantic.negative for <70 or >130. Target=0 returns semantic.muted.
    - _Requirements: 11.4_
  - [x] 8.6 Write property test for comparison color (Property 13): for any actual in [0, 10000] and target in [1, 5000], verify returned color matches the percentage range spec. Create `app/__tests__/utils/comparisonColor.test.ts`.
    - **Property 13: Comparison color coding**
    - **Validates: Requirements 11.4**
  - [x] 8.7 Create `app/components/dashboard/QuickActionButton.tsx`: Card (flat variant) with 4px left border in accentColor prop. 40px icon area (centered emoji). Label (13px, medium, text.secondary). Conditional checkmark badge (16px circle, semantic.positive bg, white "✓") positioned top-right when `completed` prop is true. Wraps in usePressAnimation. Props: icon, label, accentColor, completed, onPress.
    - _Requirements: 3.2, 3.3, 3.4_
  - [x] 8.8 Write property test for QuickActionButton badge (Property 4): for any boolean completed state, verify checkmark element is present iff completed is true. Create `app/__tests__/components/QuickActionButton.test.tsx`.
    - **Property 4: Quick action completion badge**
    - **Validates: Requirements 3.4**
  - [x] 8.9 Create `app/components/dashboard/StreakIndicator.tsx`: renders nothing when count=0. Otherwise: View with 🔥 Text + count Text (accent.primary, 16px, semibold). Count uses useCountingValue for animated transition. Props: count.
    - _Requirements: 3.5_
  - [x] 8.10 Create `app/components/dashboard/TodaySummaryRow.tsx`: horizontal View with two items. Each: emoji icon + count Text + label Text. Count color: semantic.positive when > 0, text.muted when 0. Label: 13px, text.secondary. Props: mealsLogged, workoutsCompleted.
    - _Requirements: 3.1_
  - [x] 8.11 Write property test for TodaySummaryRow (Property 3): for any mealsLogged in [0, 100] and workoutsCompleted in [0, 20], verify rendered output contains both count values as text. Create `app/__tests__/components/TodaySummaryRow.test.tsx`.
    - **Property 3: Today activity summary counts**
    - **Validates: Requirements 3.1**
  - [x] 8.12 Create `app/components/dashboard/MacroRingsRow.tsx`: horizontal View (flexDirection row, gap 12) with 3 ProgressRing components. Calories: macro.calories color, "kcal" label. Protein: macro.protein color, "g" label. Carbs: macro.carbs color, "g" label. Props: calories {value, target}, protein {value, target}, carbs {value, target}, onTargetMissing?.
    - _Requirements: 2.2_
  - [x] 8.13 Create `app/components/dashboard/ArticleCardCompact.tsx`: Card (flat variant), fixed width 200. 4px top border in category color (mapped from module_name). Title: 14px, semibold, max 2 lines (numberOfLines=2). Read time: 12px, text.muted. Arrow icon: "→" in text.muted, bottom-right. Props: article (id, title, module_name, estimated_read_time_min), onPress.
    - _Requirements: 4.1, 4.2_
  - [x] 8.14 Write property test for ArticleCardCompact (Property 6): for any article with non-empty title, module_name, and read time > 0, verify rendered output contains title text, module_name text, and read time value. Create `app/__tests__/components/ArticleCardCompact.test.tsx`.
    - **Property 6: Article card field completeness**
    - **Validates: Requirements 4.2, 9.4**
  - [x] 8.15 Create `app/components/profile/FeatureNavItem.tsx`: TouchableOpacity row with usePressAnimation. 24px emoji icon. Label (16px, medium, text.primary) + description (13px, text.muted) in a vertical stack. Chevron "›" (16px, text.muted) right-aligned. Props: icon, label, description, onPress.
    - _Requirements: 12.1, 12.2_

- [ ] 9. Checkpoint — Run all tests, verify composites render
  - Run `yarn test`. All 17 property tests and unit tests must pass. Ask the user if questions arise.

- [ ] 10. Rewrite DashboardScreen
  - [x] 10.1 Rewrite `app/screens/dashboard/DashboardScreen.tsx`: Replace entire screen layout. New layout top-to-bottom: (1) Header with getGreeting(profileName) + date + PremiumBadge. (2) MacroRingsRow with calories/protein/carbs from KPI state. (3) TodaySummaryRow with mealsLogged/workoutsCompleted counts. (4) StreakIndicator with streak count. (5) Quick Actions row: 3 QuickActionButtons (Nutrition/cyan, Training/emerald, Bodyweight/amber) with completed badges based on today's log counts. (6) Featured Articles: SectionHeader "Featured" + horizontal ScrollView of ArticleCardCompact items (omit section entirely if articles array is empty). Remove the old "Adaptive Targets" Card section. Add skeleton loading: show Skeleton components for rings, summary, and quick actions while data loads (use isLoading state). Add staggered entrance: wrap each section in Reanimated.View with useStaggeredEntrance(sectionIndex, 60). Data fetching: parallel Promise.allSettled for nutrition/entries (today), adaptive/snapshots (limit 1), training/sessions (today), content/articles (limit 5, published). Compute mealsLogged = nutrition entries count, workoutsCompleted = training sessions count. Compute streak via calculateStreak from all log dates. Use isInitialLoad ref to prevent re-triggering stagger on pull-to-refresh.
    - Risk: Large rewrite — potential for regressions in modal opening. Mitigation: Modals are separate components, only their trigger (onPress) changes.
    - _Requirements: 2.1, 2.2, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.4, 15.1, 17.1_
  - [x] 10.2 Write unit tests for DashboardScreen: verify greeting contains profile name, 3 progress rings render, today summary shows meal/workout counts, quick action buttons are present, skeleton shows during loading, featured section omitted when articles empty. Create `app/__tests__/screens/DashboardScreen.test.tsx`.
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.4, 17.1_

- [ ] 11. Rewrite ProfileScreen and consolidate More/Learn
  - [x] 11.1 Rewrite `app/screens/profile/ProfileScreen.tsx`: Reorganize into sections with SectionHeader components. (1) User Info Card: 64px avatar circle (accent.primaryMuted bg, first char of displayName or email uppercased), displayName (or "Set your name"), email, PremiumBadge if premium, Edit Profile button. (2) "Features" SectionHeader + 5 FeatureNavItems: Coaching (🎯, "AI-powered training guidance"), Community (💬, "Connect with other lifters"), Founder's Story (🏋️, "The story behind HypertrophyOS"), Health Reports (🩺, "Detailed health analysis"), Learn (📚, "Articles and educational content"). Each navigates to its screen via navigation.navigate. (3) "Preferences" SectionHeader + units toggle + rest timer inputs. (4) "Subscription" SectionHeader + status + upgrade CTA. (5) "Account" SectionHeader + logout + delete. Add staggered entrance for sections.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 1.5_
  - [x] 11.2 Write property test for profile user info (Property 14): for any displayName (including empty), email, and isPremium boolean, verify avatar initial is first char of (displayName if non-empty, else email) uppercased, and premium badge is present iff isPremium. Create `app/__tests__/screens/ProfileScreen.test.tsx`.
    - **Property 14: Profile user info rendering**
    - **Validates: Requirements 12.4**
  - [x] 11.3 Write unit tests for ProfileScreen: verify 5 FeatureNavItems render with correct labels, sections appear in correct order (User Info → Features → Preferences → Subscription → Account), premium badge conditional.
    - _Requirements: 12.1, 12.3_

- [ ] 12. Update LearnScreen, LogsScreen, and AnalyticsScreen
  - [x] 12.1 Update `app/screens/learn/LearnScreen.tsx`: Replace the category FlatList rendering to use FilterPill components in a horizontal FlatList (horizontal={true}, showsHorizontalScrollIndicator={false}). Replace the ListEmptyComponent with an EmptyState (icon "📚", title "No articles yet", description "Try a different category or check back later", children: FilterPill buttons for other categories). Add staggered entrance for article cards (40ms stagger, max 8). Keep existing article card rendering but ensure it shows category color strip (4px left border), title, read time, tags, and favorite toggle.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 8.4, 15.2_
  - [x] 12.2 Update `app/screens/logs/LogsScreen.tsx`: Replace the ListEmptyComponent for both nutrition and training tabs with EmptyState components. Nutrition empty: icon "🍽", title "No nutrition entries yet", description "Tap the + button to log your first meal", actionLabel "Log Nutrition", onAction opens AddNutritionModal. Training empty: icon "🏋", title "No training sessions yet", description "Tap the + button to log your first workout", actionLabel "Log Training", onAction opens AddTrainingModal. Add Skeleton loading (3 skeleton cards) while data loads. Add staggered entrance for entry cards.
    - _Requirements: 8.2, 15.2, 17.2_
  - [x] 12.3 Update `app/screens/analytics/AnalyticsScreen.tsx`: Add inline EmptyState within each chart Card when data array is empty (e.g., "Log bodyweight to see trends" for weight chart, "Log meals to see calorie trends" for calorie chart). Add dashed target reference line to TrendLineChart when targetLine prop is provided (1px, dashed, text.muted color). Update the ComparisonItem component to use getComparisonColor util for percentage color coding instead of inline ternary. Add Skeleton loading for chart areas.
    - _Requirements: 8.3, 11.3, 11.4, 17.3_
  - [x] 12.4 Write unit tests for LearnScreen: verify FilterPill components render horizontally, EmptyState shows when no articles, article cards contain required fields. Create `app/__tests__/screens/LearnScreen.test.tsx`.
    - _Requirements: 9.1, 8.4, 9.4_

- [ ] 13. Refactor modals to use ModalContainer
  - [x] 13.1 Refactor `app/components/modals/AddNutritionModal.tsx`: Replace the outer `<Modal><KeyboardAvoidingView><View style={styles.sheet}>` wrapper with `<ModalContainer visible={visible} onClose={handleClose} title="Log Nutrition">`. Move the favorites section (the `favoritesSection` block) to render before the search section in the ScrollView. Apply consistent input styling from tokens (bg.surfaceRaised, border.default, 12px padding, accent border on focus). Remove the old overlay/sheet styles (ModalContainer handles them).
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 13.2 Refactor `app/components/modals/AddTrainingModal.tsx`: Replace outer Modal wrapper with ModalContainer. Change `templatesOpen` initial state from `false` to `true` so templates section is expanded by default. Update set input fields: change `setInput` style to have minWidth 56, padding 12px horizontal, and centered text. Remove old overlay/sheet styles.
    - _Requirements: 10.1, 10.2, 10.4, 10.5_
  - [x] 13.3 Refactor `app/components/modals/AddBodyweightModal.tsx`: Replace outer Modal wrapper with ModalContainer. Remove old overlay/sheet styles.
    - _Requirements: 10.1, 10.2_

- [ ] 14. Checkpoint — Run all tests, verify screens and modals
  - Run `yarn test`. All tests must pass. Visually verify: Dashboard shows progress rings + today summary + quick actions + featured articles. Profile shows Features section with 5 items. Learn shows horizontal filter pills. Logs shows empty states. Analytics shows inline empty states. Modals render as centered dialog on web and bottom sheet on mobile. Ask the user if questions arise.

- [x] 15. Consolidate navigation — 4 tabs
  - [x] 15.1 Rewrite `app/navigation/BottomTabNavigator.tsx`: Remove `MoreStack`, `MoreStackScreen`, `LearnStack`, `LearnStackScreen` and their param list types. Remove `Tab.Screen` entries for "Learn" and "More". Rename "Dashboard" tab to "Home". Add to `ProfileStack`: `Learn` screen (LearnScreen), `ArticleDetail` screen, `Coaching` screen, `Community` screen, `FounderStory` screen, `HealthReports` screen. Update `ProfileStackParamList` to include these routes. Update `BottomTabParamList` to have exactly: Home, Log, Analytics, Profile. Update `TabSvgIcon` to handle "Home" instead of "Dashboard" and remove "Learn"/"More" cases. Add custom tab bar transition: wrap tab scenes in Animated.View with opacity crossfade (200ms). Add custom `cardStyleInterpolator` to all stack navigators: push slides from right (30% offset, 250ms ease-out), pop slides to right (200ms ease-in-out). Update tab bar style: height 64, paddingBottom 8, paddingTop 6, bg.surface background, 1px top border at rgba(255,255,255,0.06).
    - Risk: Navigation restructure can break deep links and screen references. Mitigation: Search codebase for all `navigation.navigate` calls referencing old route names and update them.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 14.1, 14.2, 14.3_
  - [x] 15.2 Update all `navigation.navigate` calls across the codebase that reference old route names: replace 'Dashboard' with 'Home' in any navigate calls. Update any references to 'MoreHome', 'LearnHome' to use Profile stack navigation instead.
    - _Requirements: 1.1, 1.5_
  - [x] 15.3 Write unit tests for navigation: verify BottomTabNavigator renders exactly 4 tabs with names ["Home", "Log", "Analytics", "Profile"]. Verify no tab named "More" or "Learn" exists. Verify ProfileStack contains routes for Learn, Coaching, Community, FounderStory, HealthReports. Create `app/__tests__/navigation/BottomTabNavigator.test.tsx`.
    - _Requirements: 1.1, 1.5, 1.6_

- [x] 16. Delete MoreScreen
  - [x] 16.1 Delete `app/screens/more/MoreScreen.tsx`. Remove any remaining imports of MoreScreen across the codebase. Verify no references to MoreScreen, MoreStack, or MoreStackParamList remain.
    - _Requirements: 1.6, 12.1_

- [x] 17. Spacing consistency audit
  - [x] 17.1 Audit all StyleSheet definitions in the redesigned/updated files (DashboardScreen, ProfileScreen, LearnScreen, LogsScreen, AnalyticsScreen, all new components) and fix any padding/margin values that are not in the Spacing_Scale set {0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64}. Ensure: 16px horizontal content padding on all screens, 24px top margin on SectionHeaders, 12px bottom margin on SectionHeaders, 12px gap between horizontal cards, 12px gap between vertical cards.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 18. Final checkpoint — Full test suite and visual verification
  - Run `yarn test`. All 17 property tests and all unit tests must pass. Visually verify the complete app flow: Home tab → Dashboard with rings, summary, streak, quick actions, featured articles. Log tab → Logs with empty states and skeleton loading. Analytics tab → charts with empty states and comparison colors. Profile tab → user info, Features (5 items), Preferences, Subscription, Account. Profile → Learn → article list with horizontal pills. Modals: centered on web, bottom sheet on mobile. Animations: stagger entrance, press feedback, ring fill, counting numbers. Ask the user if questions arise.

## Notes

- Rollback for any step: `git revert` the commit(s). No database state to unwind.
- All property tests use `fast-check` with minimum 100 iterations.
- Tag format for property tests: `Feature: ux-redesign-v1, Property {N}: {title}`
- No new backend endpoints required. The optional `GET user/streak` endpoint is consumed if available, with graceful fallback to 0.
- Use `yarn` for all dependency operations (not npm).
- Post-launch monitoring: Track Dashboard render time, tab switch frequency, and modal open/close latency via Expo Performance API.
