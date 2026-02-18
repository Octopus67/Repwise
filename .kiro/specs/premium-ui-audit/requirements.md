# Requirements Document — Premium UI/UX Audit

## Introduction

This spec defines a production-grade, pixel-level UI/UX audit of Hypertrophy OS — a React Native (Expo) fitness app combining adaptive nutrition tracking, training logging, coaching, and analytics across 4 main tabs (Dashboard, Log, Analytics, Profile) plus onboarding, auth, and modal flows.

The audit produces actionable findings, a complete design system specification, and a prioritized 8-week implementation roadmap. The business constraint: users are serious lifters paying $8.99–$14.99/month who compare this app against Apple Fitness+ ($9.99/mo), WHOOP ($30/mo), Oura ($5.99/mo), and RP Hypertrophy ($25/mo). Every spacing inconsistency, janky transition, and contrast failure erodes perceived value.

The codebase has a centralized token system (`app/theme/tokens.ts`) with colors, spacing (8px grid), typography (Inter/SF Pro/JetBrains Mono), radius, shadows, springs, and opacity scales. The audit must verify every component and screen actually uses these tokens consistently.

## Glossary

- **Audit_Engine**: The systematic process that walks the codebase file-by-file, extracts style values, compares against tokens, and produces findings
- **Screen_Inventory**: Complete catalog of all 25+ screens with 6 visual states each (default, empty, loading, error, interactive, overflow)
- **Component_Catalog**: Catalog of all ~60 reusable components across 18 component directories with variant/state/interaction documentation
- **Token_System**: The design primitives in `app/theme/tokens.ts` — colors (5 groups, 40+ values), spacing (11-step scale), typography (3 families, 4 weights, 8 sizes), radius (4 values), shadows (3 levels), springs (3 configs), opacity (4 levels)
- **Premium_Benchmark**: Reference apps — Apple Fitness+, WHOOP, Oura, Strava, Linear, Stripe Dashboard — used for gap analysis
- **Issue_Log**: Severity-categorized findings: Critical (breaks usability), High (degrades premium feel), Medium (attentive users notice), Low (final polish)
- **WCAG_AA**: Web Content Accessibility Guidelines level AA — 4.5:1 contrast for normal text, 3:1 for large text (≥18px bold or ≥24px regular)
- **Touch_Target**: Minimum 44×44pt tappable area per Apple HIG and Material Design guidelines
- **Design_System_Spec**: Single-source-of-truth document for all visual primitives and usage rules
- **Implementation_Roadmap**: 4-phase, 8-week plan with effort estimates referencing specific files

## Requirements

### Requirement 1: Screen Inventory and State Coverage Audit

**User Story:** As a product owner, I want every screen cataloged with all six visual states verified, so that I know exactly which screens have missing states that break the premium experience.

#### Acceptance Criteria

1. THE Audit_Engine SHALL catalog every screen in the app by walking these directories and files:
   - **Dashboard tab**: `app/screens/dashboard/DashboardScreen.tsx`
   - **Log tab**: `app/screens/logs/LogsScreen.tsx` (nutrition diary + training log combined)
   - **Analytics tab**: `app/screens/analytics/AnalyticsScreen.tsx`
   - **Profile tab**: `app/screens/profile/ProfileScreen.tsx`, `app/screens/profile/ProgressPhotosScreen.tsx`
   - **Auth**: `app/screens/auth/LoginScreen.tsx`, `app/screens/auth/RegisterScreen.tsx`, `app/screens/auth/ForgotPasswordScreen.tsx`
   - **Onboarding**: `app/screens/onboarding/OnboardingScreen.tsx`, `app/screens/onboarding/OnboardingWizard.tsx`, plus 6 step components in `app/screens/onboarding/steps/`
   - **Training flow**: `app/screens/training/ActiveWorkoutScreen.tsx`, `app/screens/training/SessionDetailScreen.tsx`, `app/screens/training/SessionDetailView.tsx`
   - **Nutrition flow**: `app/screens/nutrition/NutritionReportScreen.tsx`, `app/screens/nutrition/RecipeBuilderScreen.tsx`
   - **Exercise Picker**: `app/screens/exercise-picker/ExercisePickerScreen.tsx`
   - **Meal Prep**: `app/screens/meal-prep/MealPlanScreen.tsx`, `app/screens/meal-prep/PrepSundayFlow.tsx`, `app/screens/meal-prep/ShoppingListView.tsx`
   - **Secondary screens**: `app/screens/coaching/CoachingScreen.tsx`, `app/screens/community/CommunityScreen.tsx`, `app/screens/learn/LearnScreen.tsx`, `app/screens/learn/ArticleDetailScreen.tsx`, `app/screens/health/HealthReportsScreen.tsx`, `app/screens/founder/FounderStoryScreen.tsx`, `app/screens/reports/WeeklyReportScreen.tsx`
2. WHEN documenting each screen, THE Audit_Engine SHALL verify the presence or absence of these six states: (a) default/loaded with real data, (b) empty state using `EmptyState` component from `app/components/common/EmptyState.tsx`, (c) loading skeleton using `Skeleton` component from `app/components/common/Skeleton.tsx`, (d) error state with recovery action, (e) interactive states (press via `usePressAnimation`, hover via `useHoverState`, focus ring using `colors.border.focus` #06B6D4), (f) overflow/edge-case (long text truncation, extreme values, zero values)
3. WHEN a screen is missing any of the six states, THE Audit_Engine SHALL log an issue with: the screen file path, the missing state name, severity (Critical if empty or error state missing on a primary tab screen, High otherwise), and a concrete implementation recommendation referencing existing patterns (e.g., "Add `SkeletonCards` pattern from `LogsScreen.tsx:56` for loading state")
4. THE Audit_Engine SHALL document the navigation graph by examining `app/navigation/BottomTabNavigator.tsx` — specifically the 4 stack navigators (`DashboardStackScreen`, `LogsStackScreen`, `AnalyticsStackScreen`, `ProfileStackScreen`), the `slideFromRight` custom transition, and all modal presentation points
5. WHEN documenting modal flows, THE Audit_Engine SHALL catalog every modal component in `app/components/modals/` (AddNutritionModal, AddTrainingModal, AddBodyweightModal, QuickAddModal, RecoveryCheckinModal) plus modals in other directories (CelebrationModal, DrillDownModal, FatigueBreakdownModal, BlockCreationModal, BlockTemplateModal, RecipeScalingModal, UpgradeModal) — recording for each: whether it uses `ModalContainer` from `app/components/common/ModalContainer.tsx`, entry animation type (slide-up on mobile with 250ms timing, scale on web with 200ms timing), backdrop dismissal behavior, and keyboard avoidance

### Requirement 2: Component-Level Design Consistency Audit

**User Story:** As a design lead, I want every component audited against the token system with hardcoded values flagged, so that the component library is unified and maintainable.

#### Acceptance Criteria

1. THE Audit_Engine SHALL audit every component across all 18 component directories (`app/components/achievements/`, `analytics/`, `charts/`, `coaching/`, `common/`, `dashboard/`, `exercise-picker/`, `learn/`, `log/`, `meal-prep/`, `modals/`, `nutrition/`, `periodization/`, `photos/`, `premium/`, `profile/`, `reports/`, `training/`) — totaling ~60 component files
2. WHEN auditing each component file, THE Audit_Engine SHALL grep for hardcoded style values — specifically: hex colors not from `colors.*`, numeric padding/margin not from `spacing.*`, fontSize not from `typography.size.*`, fontWeight not from `typography.weight.*`, borderRadius not from `radius.*`, and shadow values not from `shadows.*` — and flag each instance with file path, line number, the hardcoded value, and the correct token replacement
3. WHEN auditing the Button component (`app/components/common/Button.tsx`), THE Audit_Engine SHALL verify: all 4 variants (primary, secondary, ghost, danger) render correctly, `minHeight: 44` meets touch target requirement, padding uses `spacing[3]` vertical and `spacing[6]` horizontal, press animation uses `usePressAnimation` hook with snappy spring (damping:15, stiffness:400, mass:0.3), hover state uses `useHoverState` hook, disabled state applies `opacity: 0.4` from `opacityScale.disabled`, and loading state shows `ActivityIndicator`
4. WHEN auditing Card components (`app/components/common/Card.tsx`), THE Audit_Engine SHALL verify: flat variant uses `colors.bg.surface` + `colors.border.subtle`, raised variant uses `colors.bg.surfaceRaised` + `colors.border.default` + `shadows.md` + top border highlight `rgba(255,255,255,0.04)`, outlined variant uses transparent bg + `colors.border.default`, all variants use `spacing[4]` padding and `radius.md` borderRadius, press-enabled cards use `usePressAnimation`, and animated cards use `useStaggeredEntrance`
5. WHEN auditing interactive components, THE Audit_Engine SHALL verify that every `TouchableOpacity` and `Pressable` in the codebase either: (a) uses `usePressAnimation` for scale feedback, or (b) uses `activeOpacity={0.8}` as minimum feedback, or (c) has an explicit reason for no feedback (e.g., backdrop dismiss). Components missing press feedback SHALL be flagged as High severity
6. WHEN auditing the training component set (`app/components/training/` — 19 files including RestTimer, RestTimerV2, RestTimerRing, RestTimerBar, RestTimerOverlay, PRBanner, RPEBadge, RPEPicker, SetTypeSelector, etc.), THE Audit_Engine SHALL verify consistent styling patterns across the set and flag any component using `Animated` from react-native instead of `Animated` from react-native-reanimated (the PRBanner currently uses RN Animated while Card/Button use Reanimated — this inconsistency SHALL be flagged)
7. THE Audit_Engine SHALL produce a component specification table listing each component with: name, file path, variants, sizes, states (default/hover/press/disabled/loading/error), token compliance status, and specific issues found

### Requirement 3: Color System and Dark Mode Audit

**User Story:** As a designer, I want the color system evaluated for palette coherence, contrast compliance, and premium benchmark alignment, so that the dark-first visual identity is both accessible and competitive.

#### Acceptance Criteria

1. THE Audit_Engine SHALL extract and document the complete color inventory from `app/theme/tokens.ts`, organized by group:
   - **Backgrounds** (4): base `#0A0E13`, surface `#12171F`, surfaceRaised `#1A2029`, overlay `rgba(0,0,0,0.6)`
   - **Borders** (4): subtle `rgba(255,255,255,0.06)`, default `rgba(255,255,255,0.08)`, hover `rgba(255,255,255,0.12)`, focus `#06B6D4`
   - **Text** (4): primary `#F1F5F9`, secondary `#94A3B8`, muted `#64748B`, inverse `#0B0F14`
   - **Accent** (3): primary `#06B6D4`, primaryHover `#0891B2`, primaryMuted `rgba(6,182,212,0.12)`
   - **Semantic** (8): positive `#22C55E`, positiveSubtle, negative `#EF4444`, negativeSubtle, warning `#F59E0B`, warningSubtle, overTarget `#6B8FBF`, overTargetSubtle
   - **Premium** (2): gold `#D4AF37`, goldSubtle
   - **Gradient** (3): premiumCta `[#06B6D4, #0E7490]`, start, end
   - **Chart** (5): calories, positiveTrend, negativeDev, warningThreshold, neutral
   - **Macro** (8): calories `#06B6D4`, protein `#22C55E`, carbs `#F59E0B`, fat `#F472B6`, plus 4 subtle variants
   - **Heatmap** (7): untrained, belowMev, optimal, nearMrv, aboveMrv, silhouetteStroke, regionBorder + regionOpacity
2. WHEN checking WCAG AA contrast, THE Audit_Engine SHALL compute and report contrast ratios for these specific combinations:
   - `text.primary` (#F1F5F9) on `bg.base` (#0A0E13) — expected ~16:1
   - `text.primary` (#F1F5F9) on `bg.surface` (#12171F) — expected ~14:1
   - `text.secondary` (#94A3B8) on `bg.base` (#0A0E13) — must verify ≥4.5:1
   - `text.secondary` (#94A3B8) on `bg.surface` (#12171F) — must verify ≥4.5:1
   - `text.muted` (#64748B) on `bg.base` (#0A0E13) — likely fails 4.5:1, must verify
   - `text.muted` (#64748B) on `bg.surface` (#12171F) — likely fails 4.5:1, must verify
   - `accent.primary` (#06B6D4) on `bg.base` (#0A0E13) — must verify ≥4.5:1
   - `accent.primary` (#06B6D4) on `bg.surface` (#12171F) — must verify ≥4.5:1
   - `premium.gold` (#D4AF37) on `bg.surfaceRaised` (#1A2029) — used in PRBanner
3. WHEN a combination fails WCAG AA, THE Audit_Engine SHALL flag it with: the measured ratio, the required ratio, and a recommended replacement hex value that passes while maintaining the design intent
4. WHEN auditing the border opacity system (0.06 → 0.08 → 0.12), THE Audit_Engine SHALL verify that the three levels create visible hierarchy on the dark backgrounds — specifically testing whether `border.subtle` at 0.06 opacity is perceptible on `bg.surface` (#12171F) on typical mobile displays
5. WHEN auditing macro colors, THE Audit_Engine SHALL verify that calories (#06B6D4 cyan), protein (#22C55E green), carbs (#F59E0B amber), and fat (#F472B6 pink) are distinguishable under protanopia, deuteranopia, and tritanopia color vision simulations — these four colors appear simultaneously in MacroRingsRow and BudgetBar
6. THE Audit_Engine SHALL compare the color system against: WHOOP (dark charcoal base, strain green/red gradient), Apple Fitness+ (true black base, vibrant neon rings), Oura (deep navy, soft pastels), and Strava (white/dark toggle, orange energy accent) — identifying 3+ specific adoptable qualities per benchmark
7. WHEN auditing color usage across the codebase, THE Audit_Engine SHALL search for any hex color literals or `rgba()` values in `.tsx` files outside of `tokens.ts` that are not imported from the token system, and flag each as a token compliance violation

### Requirement 4: Typography System Audit

**User Story:** As a designer, I want the type system evaluated for scale consistency, numeric formatting, and premium hierarchy, so that text rendering is polished and competitive.

#### Acceptance Criteria

1. THE Audit_Engine SHALL document the complete type system from `app/theme/tokens.ts`:
   - **Families**: sans `Inter`, sansIOS `SF Pro Display`, mono `JetBrains Mono`
   - **Weights**: regular `400`, medium `500`, semibold `600`, bold `700`
   - **Sizes**: xs `12`, sm `13`, base `14`, md `16`, lg `18`, xl `20`, 2xl `24`, 3xl `32`
   - **Line heights**: tight `1.2`, normal `1.5`, relaxed `1.625`
   - **Letter spacing**: tighter `-0.5`, tight `-0.25`, normal `0`, wide `0.5`
   - **Numeric**: fontVariant `['tabular-nums', 'lining-nums']`
2. WHEN auditing heading hierarchy across screens, THE Audit_Engine SHALL verify that: screen titles consistently use the same size+weight+letterSpacing combination across DashboardScreen, LogsScreen, AnalyticsScreen, and ProfileScreen; section headers within screens use a consistent combination; and body text uses a consistent combination. Any deviation SHALL be flagged with file path and line number
3. WHEN auditing numeric displays, THE Audit_Engine SHALL verify that `typography.numeric.fontVariant` (tabular-nums) is applied to: calorie counts in BudgetBar, macro values in MacroRingsRow and MacroChip, weight/rep numbers in ActiveWorkoutScreen SetRow, timer display in RestTimer (currently `typography.size['3xl'] * 2` = 64px), streak counts in StreakIndicator, and all chart axis labels. Missing tabular-nums SHALL be flagged as High severity because layout shift during value changes looks janky
4. WHEN auditing text truncation, THE Audit_Engine SHALL verify that: exercise names in ExerciseCard and ActiveWorkoutScreen use `numberOfLines` with ellipsis, food names in AddNutritionModal use truncation, article titles in ArticleCardCompact use line clamping, and no truncated text overlaps adjacent elements
5. WHEN auditing font weight distribution, THE Audit_Engine SHALL verify that the 4-weight scale (400/500/600/700) creates sufficient visual hierarchy — specifically that there is clear differentiation between: primary data values (bold 700), labels and headers (semibold 600), secondary information (medium 500), and body/description text (regular 400)
6. THE Audit_Engine SHALL compare typography against Premium_Benchmark apps — specifically: Apple Fitness+ bold condensed headings with tight letter spacing, Linear's clean Inter usage with generous whitespace, WHOOP's data-dense numeric displays — and recommend specific improvements to the type ramp

### Requirement 5: Spacing and Layout System Audit

**User Story:** As a designer, I want the spacing system verified for 8px grid adherence, content density balance, and thumb-zone ergonomics, so that the app feels spatially consistent and comfortable.

#### Acceptance Criteria

1. THE Audit_Engine SHALL document the spacing scale from tokens: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64` (keys 0–16) and radius scale: sm `8`, md `12`, lg `16`, full `9999`
2. WHEN auditing screen-level layout, THE Audit_Engine SHALL verify that all four primary tab screens (Dashboard, Logs, Analytics, Profile) use identical horizontal padding — checking the `paddingHorizontal` value in each screen's root ScrollView or FlatList style. Any inconsistency SHALL be flagged as Medium severity
3. WHEN auditing content density, THE Audit_Engine SHALL evaluate these specific high-density areas:
   - DashboardScreen: MacroRingsRow (3 rings + calorie center) → BudgetBar → MealSlotDiary → TodaySummaryRow stack — is there sufficient breathing room between sections?
   - AnalyticsScreen: HeatMapCard → WeeklySummaryCard → ExpenditureTrendCard → StrengthLeaderboard stack — does the vertical rhythm feel consistent?
   - ActiveWorkoutScreen: exercise header → set rows → RPE picker → rest timer — is the training flow cramped or comfortable during a workout?
4. WHEN auditing visual hierarchy through spacing, THE Audit_Engine SHALL verify that: spacing between major screen sections uses `spacing[6]` (24px) or `spacing[8]` (32px), spacing between items within a section uses `spacing[3]` (12px) or `spacing[4]` (16px), and spacing within a component uses `spacing[2]` (8px) or `spacing[1]` (4px) — creating a clear 3-tier spacing hierarchy
5. WHEN auditing thumb-zone ergonomics, THE Audit_Engine SHALL verify: primary action buttons (add nutrition FAB, start workout, log set, finish workout via FinishBar) are positioned in the bottom 40% of the screen, the tab bar in BottomTabNavigator provides comfortable tap targets with adequate spacing between icons, and modal action buttons are reachable without stretching
6. THE Audit_Engine SHALL audit these specific spacing hotspots and report findings:
   - Gap between ProgressRing components in MacroRingsRow
   - Internal padding of BudgetBar container vs. its child elements
   - Spacing between MealSlotGroup sections in the meal diary
   - Gap between ExerciseCard items in ExercisePickerScreen
   - Padding inside RestTimer overlay container (`spacing[8]` = 32px currently)
   - Spacing between set rows in ActiveWorkoutScreen
   - Card-to-card gap in the Dashboard vertical scroll

### Requirement 6: Animation and Micro-Interaction Audit

**User Story:** As a product owner, I want every animation and interaction evaluated for timing, consistency, and premium feel, so that the app feels fluid and responsive like WHOOP or Apple Fitness+.

#### Acceptance Criteria

1. THE Audit_Engine SHALL catalog every animation pattern in the codebase:
   - **Screen transitions**: `slideFromRight` in BottomTabNavigator (custom `CardStyleInterpolators`), modal slide-up (250ms, `Easing.out`), web dialog scale (200ms, `Easing.out`)
   - **Entrance animations**: `useStaggeredEntrance` hook — 60ms stagger delay, 300ms duration, `Easing.out(Easing.ease)`, fade (0→1) + slide (12px→0), caps at index 8
   - **Press animations**: `usePressAnimation` hook — scale 1→0.97, opacity 1→0.9, snappy spring (damping:15, stiffness:400, mass:0.3)
   - **Skeleton pulses**: `Skeleton` component — opacity 0.3→0.7, 600ms duration, infinite repeat, web fallback static 0.5
   - **Progress ring fill**: `ProgressRing` — gentle spring (damping:20, stiffness:200, mass:0.5) on `strokeDashoffset`
   - **PR celebration**: `PRBanner` — RN `Animated.spring` (damping:12, stiffness:200), 3s auto-dismiss
   - **Rest timer**: `RestTimer` — `LayoutAnimation.Presets.easeInEaseOut` for settings panel toggle
   - **Tooltip**: `Tooltip` — RN `Animated.timing` 200ms fade-in
   - **Counting value**: `useCountingValue` hook
   - **Skeleton pulse**: `useSkeletonPulse` hook
2. WHEN auditing animation library consistency, THE Audit_Engine SHALL flag components using `Animated` from `react-native` (PRBanner, Tooltip, SwipeableRow) instead of `Animated` from `react-native-reanimated` (Card, Button, ModalContainer, ProgressRing, Skeleton, useStaggeredEntrance, usePressAnimation). Mixed animation libraries cause inconsistent frame rates and are a High severity issue
3. WHEN auditing spring configurations, THE Audit_Engine SHALL verify that the three spring presets are used for their intended purposes: `springs.gentle` (damping:20, stiffness:200, mass:0.5) for progress/value animations, `springs.snappy` (damping:15, stiffness:400, mass:0.3) for press/interaction feedback, `springs.bouncy` (damping:10, stiffness:300, mass:0.5) for celebratory/attention-grabbing animations. Any spring using custom values instead of presets SHALL be flagged
4. WHEN auditing loading states, THE Audit_Engine SHALL verify that every screen performing async data fetches shows skeleton loading — specifically checking: DashboardScreen (has `SkeletonCards` pattern?), LogsScreen (has `SkeletonCards` at line 56), AnalyticsScreen (has `ChartSkeleton` at line 63), ProfileScreen, CoachingScreen, CommunityScreen, LearnScreen, HealthReportsScreen. Missing skeleton states SHALL be flagged as High severity
5. WHEN auditing micro-interactions, THE Audit_Engine SHALL evaluate these specific moments:
   - **Set completion in ActiveWorkoutScreen**: What feedback does the user get when completing a set? Is there a checkmark animation, haptic, color change?
   - **PR detection**: PRBanner spring animation quality — does the scale-from-0 feel premium or jarring? Is the 3s auto-dismiss sufficient?
   - **Rest timer countdown**: Is the countdown number animated (counting down smoothly) or does it just swap integers? Is there a completion sound/haptic?
   - **Meal logging**: What happens after adding a nutrition entry via AddNutritionModal? Is there confirmation feedback?
   - **Swipe to delete**: SwipeableRow uses `friction: 2` — is the swipe resistance appropriate?
6. WHEN auditing haptic feedback, THE Audit_Engine SHALL search the codebase for haptic API calls (expo-haptics, ReactNative Vibration) and verify haptics are present for: button presses on primary actions, set completion, PR achievement, timer completion (RestTimer currently plays audio via expo-av but no haptic), destructive actions (delete via SwipeableRow). Missing haptics SHALL be flagged with specific implementation recommendations
7. WHEN auditing empty states, THE Audit_Engine SHALL verify that the `EmptyState` component (`app/components/common/EmptyState.tsx`) is used on every screen that can have zero data — specifically: LogsScreen with no entries, AnalyticsScreen with no training data, ProgressPhotosScreen with no photos, CommunityScreen with no posts, LearnScreen with no articles loaded. Each empty state SHALL have: an appropriate icon (48×48 container), descriptive title, helpful description, and an action button that resolves the empty state
8. WHEN auditing error states, THE Audit_Engine SHALL verify that `ErrorBoundary` (`app/components/common/ErrorBoundary.tsx`) wraps appropriate component trees, and that API error responses produce user-facing error messages with retry actions rather than silent failures or raw error text

### Requirement 7: Premium Benchmark Comparison

**User Story:** As a product owner, I want a gap analysis against 6 elite apps with specific implementable recommendations, so that I know exactly what visual qualities to adopt to justify $15/month pricing.

#### Acceptance Criteria

1. THE Audit_Engine SHALL compare Hypertrophy OS against these 6 benchmarks with specific visual dimensions:
   - **Apple Fitness+**: Activity rings (compare to MacroRingsRow/ProgressRing), vibrant neon-on-black palette (compare to cyan-on-dark-charcoal), bold SF Pro typography with tight letter spacing, celebration animations for goal completion
   - **WHOOP**: Dark data-dense layouts (compare to Dashboard density), strain/recovery gauges (compare to ReadinessGauge), premium dark palette with green/red semantic gradient, sleep/recovery data visualization
   - **Oura**: Minimal elegance with generous whitespace (compare to card spacing), ring visualization (compare to ProgressRing), soft pastel accents on dark, sleep score presentation
   - **Strava**: Social fitness feed (compare to CommunityScreen), segment performance charts (compare to TrendLineChart), orange energy accent, activity summary cards
   - **Linear**: Clean minimal SaaS (compare to overall information architecture), keyboard-first interactions, fast page transitions (compare to stack transitions), subtle hover states (compare to `useHoverState`)
   - **Stripe Dashboard**: Information density done right (compare to AnalyticsScreen), data tables with clear hierarchy, clean chart styling (compare to chart components), neutral palette with accent highlights
2. WHEN comparing each benchmark, THE Audit_Engine SHALL identify 3+ specific, implementable visual qualities with concrete guidance — not vague statements like "make it more premium" but specific recommendations like "Adopt Apple Fitness+ ring glow effect: add `glowShadow(color, 16, 0.4)` to ProgressRing when fill > 80%, using the existing `glowShadow` utility in tokens.ts"
3. WHEN comparing data visualization, THE Audit_Engine SHALL evaluate:
   - MacroRingsRow/ProgressRing vs. Apple Fitness+ activity rings: ring thickness, glow effects, label positioning, animation on fill
   - BodyHeatMap/BodySilhouette vs. WHOOP strain visualization: color gradient quality, region definition clarity, legend design
   - TrendLineChart vs. Strava performance charts: line smoothing, gradient fills, axis styling, tooltip design
   - BudgetBar progress track vs. premium progress bar patterns: track height (currently 6px), fill animation, overshoot visualization
4. WHEN comparing information density, THE Audit_Engine SHALL evaluate DashboardScreen's vertical card stack against Stripe Dashboard's grid layout — specifically: does the single-column scroll feel like a premium dashboard or a basic list? Should the Dashboard adopt a 2-column grid for macro rings + budget bar on larger devices?
5. THE Audit_Engine SHALL produce a ranked gap analysis: the top 10 visual qualities that most separate Hypertrophy OS from premium-tier apps, each with: the benchmark app demonstrating the quality, the current Hypertrophy OS state, the specific improvement needed, estimated implementation effort (hours), and the files/components affected

### Requirement 8: Accessibility Compliance Audit

**User Story:** As a product owner, I want the app evaluated against accessibility standards with every violation flagged, so that the app is usable by all users and meets platform guidelines.

#### Acceptance Criteria

1. WHEN auditing touch targets, THE Audit_Engine SHALL measure and verify 44×44pt minimum for these specific elements:
   - Tab bar icons in BottomTabNavigator (check `TabSvgIcon` sizing and tab button padding)
   - Modal close buttons (ModalContainer uses `hitSlop={8}` with `padding: 8` — verify total tappable area ≥ 44pt)
   - RestTimer gear icon (`styles.gearBtn` has `padding: spacing[1]` = 4px — likely fails 44pt minimum)
   - DateScroller day items
   - MacroRingsRow individual ring tap targets (ProgressRing `onTargetMissing` callback)
   - RPEPicker selection buttons
   - SetTypeSelector options
   - FilterPill components
   - Navigation header back buttons
2. WHEN a touch target is below 44×44pt, THE Audit_Engine SHALL flag it with: component name, file path, current measured size, and the specific fix (increase padding, add hitSlop, increase container size)
3. WHEN auditing color-only information, THE Audit_Engine SHALL verify that:
   - Macro colors in MacroRingsRow and BudgetBar have text labels ("Protein", "Carbs", "Fat") accompanying the color — not relying on color alone to distinguish macros
   - Semantic colors in BudgetBar (over-target blue `#6B8FBF`, positive green, negative red) have text reinforcement ("kcal over" / "kcal remaining")
   - Heatmap colors in BodyHeatMap have the HeatMapLegend component with text labels for each level
   - RPEBadge color coding has numeric RPE value displayed alongside the color
   - Chart trend lines in TrendLineChart are distinguishable by pattern (dash, dot) not just color
4. WHEN auditing Dynamic Type / text scaling, THE Audit_Engine SHALL verify that: the typography system uses relative sizing that scales with system font size preferences, layout does not break at 1.5x and 2x text scale, and critical numeric displays (calorie counts, macro values, timer) remain readable at increased sizes
5. WHEN auditing screen reader support, THE Audit_Engine SHALL verify that:
   - ProgressRing exposes `accessibilityLabel` with current value and target (e.g., "Protein: 120 of 150 grams, 80%")
   - BudgetBar exposes remaining calories as accessible value
   - BodyHeatMap/BodySilhouette SVG regions have accessibility labels for muscle groups
   - All icon-only buttons (gear, close, add, settings) have `accessibilityLabel` props
   - Navigation tab items announce their label and selected state
6. WHEN auditing motion sensitivity, THE Audit_Engine SHALL verify that `useStaggeredEntrance`, `usePressAnimation`, `useSkeletonPulse`, and ProgressRing animations check `AccessibilityInfo.isReduceMotionEnabled()` (or `useReducedMotion` from Reanimated) and skip or simplify animations when reduce-motion is enabled. The web fallback in `useStaggeredEntrance` (returns static style on web) is a good pattern — verify native has equivalent reduce-motion support

### Requirement 9: Design System Specification Deliverable

**User Story:** As a design lead, I want a complete design system spec produced from audit findings, so that the team has a single source of truth for all visual decisions going forward.

#### Acceptance Criteria

1. THE Audit_Engine SHALL produce a Design_System_Spec document containing these sections: Color Palette (current + recommended), Spacing Scale (usage rules), Border Radius (component mapping), Elevation/Shadows (usage contexts), Typography Ramp (complete hierarchy), Animation System (springs, timing, easing), Haptic Patterns, and Component Specifications
2. WHEN producing the color section, THE Audit_Engine SHALL include: every token value from `colors.*`, WCAG AA contrast ratios for all text/background combinations, any recommended color changes with before/after hex values and contrast ratios, and usage rules (e.g., "Use `colors.bg.surface` for card backgrounds, `colors.bg.surfaceRaised` for elevated/interactive cards, never use `colors.bg.base` inside a card")
3. WHEN producing the spacing section, THE Audit_Engine SHALL define: screen horizontal margin standard (which `spacing[N]` value), card internal padding standard, section-to-section gap standard, item-to-item gap standard, component internal gap standard — each with the token reference and pixel value
4. WHEN producing the typography section, THE Audit_Engine SHALL produce a complete type ramp table:
   - Screen title: size + weight + letterSpacing + lineHeight
   - Section header: size + weight + letterSpacing + lineHeight
   - Card title: size + weight + letterSpacing + lineHeight
   - Body text: size + weight + letterSpacing + lineHeight
   - Secondary/caption: size + weight + letterSpacing + lineHeight
   - Data value (numeric): size + weight + letterSpacing + lineHeight + fontVariant
   - Badge/tag label: size + weight + letterSpacing + textTransform
   - Mono/code: family + size + weight
5. WHEN producing the animation section, THE Audit_Engine SHALL define: which spring config to use for each interaction type (press → snappy, progress → gentle, celebration → bouncy), transition duration standards (fast 100ms for micro-feedback, default 200ms for state changes, slow 300ms for entrance animations), easing assignments, and stagger delay rules
6. THE Audit_Engine SHALL include a premium polish checklist of 50+ specific, actionable items organized by category (Color, Typography, Spacing, Animation, Components, Screens, Accessibility) — each item SHALL be a concrete task like "Add `fontVariant: typography.numeric.fontVariant` to calorie display in BudgetBar.tsx line 87" not a vague directive like "improve number formatting"

### Requirement 10: Prioritized Implementation Roadmap Deliverable

**User Story:** As a product owner, I want a phased 8-week roadmap with effort estimates tied to specific files, so that the team can systematically ship premium polish.

#### Acceptance Criteria

1. THE Audit_Engine SHALL produce an Implementation_Roadmap with 4 phases across 8 weeks, where each phase has: a theme, specific deliverables, effort estimate in engineering-hours, and a list of files to modify
2. WHEN producing the Issue_Log, THE Audit_Engine SHALL categorize every finding with:
   - **Severity**: Critical / High / Medium / Low
   - **Category**: Color, Typography, Spacing, Animation, Component, Screen, Accessibility
   - **File path(s)** affected
   - **Current state** (what it looks like now)
   - **Target state** (what it should look like)
   - **Effort estimate** in hours
   - **Phase assignment** (1–4)
3. WHEN producing Phase 1 (Weeks 1–2, "Foundation"), THE Audit_Engine SHALL prioritize: token system fixes (contrast failures, missing tokens), animation library unification (migrate PRBanner/Tooltip/SwipeableRow from RN Animated to Reanimated), and Critical touch target violations — targeting highest visual impact with lowest risk
4. WHEN producing Phase 2 (Weeks 3–4, "Component Polish"), THE Audit_Engine SHALL address: common component refinements (Button, Card, ModalContainer, EmptyState, Skeleton), missing loading/empty/error states on primary tab screens, and typography consistency fixes
5. WHEN producing Phase 3 (Weeks 5–6, "Screen-Level Premium"), THE Audit_Engine SHALL address: screen-specific spacing and density improvements, micro-interaction additions (set completion feedback, haptics, celebration polish), and data visualization upgrades (ring glow, chart styling, heatmap refinement)
6. WHEN producing Phase 4 (Weeks 7–8, "Final Polish"), THE Audit_Engine SHALL address: accessibility improvements (Dynamic Type, screen reader labels, reduce-motion), remaining Low severity items, and premium benchmark alignment items
7. THE Audit_Engine SHALL produce an executive summary containing:
   - **Premium Score**: 1–10 rating with defined criteria (1–3: MVP/functional, 4–5: decent but not premium, 6–7: competitive, 8–9: premium, 10: best-in-class)
   - **Top 5 Critical Issues**: Each with current state description, impact on premium perception, and fix description
   - **Top 10 Quick Wins**: Items achievable in ≤2 hours each that have outsized visual impact, with specific file paths and code changes
8. WHEN estimating effort, THE Audit_Engine SHALL reference specific files — e.g., "Migrate PRBanner.tsx from RN Animated to Reanimated: 2 hours — replace `Animated.spring` with `withSpring(1, springs.bouncy)`, replace `Animated.Value` with `useSharedValue`, replace `Animated.View` with Reanimated `Animated.View`"
