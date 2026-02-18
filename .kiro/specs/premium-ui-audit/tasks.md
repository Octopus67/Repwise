# Implementation Plan: Premium UI/UX Audit — Revised

## Overview

Execute a 9-phase systematic audit of the Hypertrophy OS codebase producing structured Markdown deliverables. This plan is reordered for correct dependency resolution, includes testing at every phase, adds risk mitigations, rollback procedures, and monitoring instrumentation.

## Pre-Execution Checklist

Before starting any task, verify:
- `app/theme/tokens.ts` exists and exports: `colors`, `spacing`, `typography`, `radius`, `shadows`, `springs`, `opacityScale`, `motion`, `letterSpacing`, `elevation`, `glowShadow`, `theme`
- `fast-check@^4.5.3` is installed in `app/package.json` devDependencies
- Jest is configured via `app/jest.config.js` with `ts-jest` preset, test match `**/__tests__/**/*.test.ts`
- No `test` script in package.json — run tests with `npx jest --config jest.config.js` from `app/` directory
- All 17 screen directories exist under `app/screens/` (analytics, auth, coaching, community, dashboard, exercise-picker, founder, health, learn, logs, meal-prep, nutrition, onboarding, profile, reports, training, more)
- All 18 component directories exist under `app/components/` (achievements, analytics, charts, coaching, common, dashboard, exercise-picker, learn, log, meal-prep, modals, nutrition, periodization, photos, premium, profile, reports, training)
- 7 hooks exist in `app/hooks/` (useCountingValue, useDailyTargets, useHealthData, useHoverState, usePressAnimation, useSkeletonPulse, useStaggeredEntrance)

## Dependency Graph

```
Step 1 (setup + token baseline)
  ├── Step 2 (screen inventory) ──┐
  └── Step 3 (component audit) ───┤
      ├── CHECKPOINT A ───────────┤
      ├── Step 4 (color audit) ───┤  (parallel-safe: 4, 5, 6 read different dimensions)
      ├── Step 5 (typography) ────┤
      └── Step 6 (spacing) ───────┤
          ├── CHECKPOINT B ───────┤
          ├── Step 7 (animation) ─┤  (depends on 2+3 for component catalog)
          │   └── CHECKPOINT C ───┤
          ├── Step 8 (benchmark) ─┤  (depends on 4-7 for findings)
          └── Step 9 (a11y) ──────┤  (depends on 4-7 for contrast/touch/motion data)
              └── CHECKPOINT D ───┤
              └── Step 10 (deliverables) ── Step 11 (final validation)
```

No circular dependencies. Steps 4/5/6 can run in parallel after Checkpoint A. Steps 8/9 can run in parallel after Checkpoint C.

## Tasks

- [x] 1. Environment setup and audit output structure
  - [x] 1.1 Create audit output directory `.kiro/specs/premium-ui-audit/audit-output/` with 11 empty Markdown files: `screen-inventory.md`, `component-catalog.md`, `color-audit.md`, `typography-audit.md`, `spacing-audit.md`, `animation-audit.md`, `benchmark-comparison.md`, `accessibility-audit.md`, `issue-log.md`, `design-system-spec.md`, `implementation-roadmap.md`. Verify each file is writable.
    - _Requirements: 9.1, 10.1_
    - _Risk: Directory creation fails if path is too long or permissions are wrong. Mitigation: Verify `.kiro/specs/premium-ui-audit/` exists first._
    - _Rollback: Delete the `audit-output/` directory._
  - [x] 1.2 Parse `app/theme/tokens.ts` and produce a complete token baseline document. For each top-level export, list every nested key and its value: `colors.*` (10 groups, 40+ values with hex/rgba), `spacing.*` (keys 0-16 mapping to 0-64px), `typography.*` (fontFamily with 3 families, weight with 4 values, size with 8 values, lineHeight with 3 values, numeric with fontVariant), `radius.*` (sm=8, md=12, lg=16, full=9999), `shadows.*` (sm/md/lg with shadowOffset/shadowRadius/shadowColor/shadowOpacity), `springs.*` (gentle/snappy/bouncy with damping/stiffness/mass), `opacityScale.*` (disabled/muted/subtle/hover), `motion.*` (duration with fast/default/slow, easing with default/in/out), `letterSpacing.*` (tighter/tight/normal/wide), `elevation.*` (none/sm/md/lg/button), `glowShadow` function signature. Write to `audit-output/token-baseline.md` (add this file to the output set). This document is the single reference for all subsequent phases.
    - _Requirements: 3.1, 4.1, 5.1, 9.1_
    - _Risk: tokens.ts has runtime-only values (e.g., `glowShadow` is a function, not a static value). Mitigation: Document the function signature and parameter types, not a computed value._
    - _Rollback: Delete `token-baseline.md` and re-parse._
  - [x] 1.3 Write unit tests for token baseline parsing: create `app/__tests__/audit/tokenBaseline.test.ts`. Test that: (a) `colors` object has exactly 10 top-level groups (bg, border, text, accent, semantic, premium, gradient, chart, macro, heatmap), (b) `spacing` has keys 0-16, (c) `typography.size` has 8 entries, (d) `springs` has exactly 3 presets (gentle, snappy, bouncy), (e) `radius` has 4 values. Run with `npx jest --config jest.config.js __tests__/audit/tokenBaseline.test.ts` from `app/`.
    - _Requirements: 3.1, 4.1, 5.1_
    - _Risk: Jest config may not resolve tokens.ts imports due to Expo/RN module resolution. Mitigation: Use `moduleNameMapper` in jest.config.js if needed, or test against a re-exported plain object._
    - _Rollback: Delete the test file._

- [x] 2. Phase 1 — Screen Inventory and State Coverage Audit
  - [x] 2.1 Walk every screen file under `app/screens/` (17 directories, ~38 files including onboarding steps). For each `.tsx` file: read the component function, identify conditional rendering branches (if/ternary on `loading`, `error`, `data.length === 0`, etc.), check for imports of `EmptyState` from `../components/common/EmptyState`, `Skeleton` from `../components/common/Skeleton`, `ErrorBoundary` from `../components/common/ErrorBoundary`. Record presence/absence of 6 states: default, empty, loading, error, interactive (uses `usePressAnimation` or `useHoverState`), overflow (has `numberOfLines` or handles extreme values). Write results to `audit-output/screen-inventory.md` as a Markdown table: Screen Name | File Path | Tab | Default | Empty | Loading | Error | Interactive | Overflow | Issues.
    - _Requirements: 1.1, 1.2, 1.3_
    - _Risk: Onboarding has 11 step files in `app/screens/onboarding/steps/` — these are sub-components, not standalone screens. Mitigation: Catalog them as "Onboarding Step" type, not full screens. They share the parent OnboardingScreen's loading/error states._
    - _Risk: `app/screens/more/` directory is empty. Mitigation: Note it as a stale directory, skip it._
    - _Rollback: Delete screen-inventory.md content and re-walk._
  - [x] 2.2 Document the navigation graph by reading `app/navigation/BottomTabNavigator.tsx`. Record: the 4 stack navigators (DashboardStackScreen, LogsStackScreen, AnalyticsStackScreen, ProfileStackScreen), the `slideFromRight` custom transition function (uses `Animated` from react-native + `Easing` — flag this as an animation library inconsistency), all screen registrations (16 screens imported), and modal presentation points. Write to `audit-output/screen-inventory.md` navigation section.
    - _Requirements: 1.4_
    - _Risk: BottomTabNavigator imports `Animated` from `react-native` (not Reanimated) for `slideFromRight`. This is a finding, not a blocker. Mitigation: Log it as ANIM issue in the navigation section._
    - _Rollback: Remove navigation section from screen-inventory.md._
  - [x] 2.3 Catalog every modal component. Read all 5 files in `app/components/modals/` (AddBodyweightModal, AddNutritionModal, AddTrainingModal, QuickAddModal, RecoveryCheckinModal) plus modals in other directories: `app/components/achievements/CelebrationModal.tsx`, `app/components/analytics/DrillDownModal.tsx`, `app/components/analytics/FatigueBreakdownModal.tsx`, `app/components/periodization/BlockCreationModal.tsx`, `app/components/periodization/BlockTemplateModal.tsx`, `app/components/meal-prep/RecipeScalingModal.tsx`, `app/components/premium/UpgradeModal.tsx`. For each: check if it imports `ModalContainer` from `../common/ModalContainer`, record entry animation type (check for `Animated.timing` with duration, `withTiming`, or `LayoutAnimation`), check backdrop dismissal (look for `onBackdropPress` or `onRequestClose`), check keyboard avoidance (look for `KeyboardAvoidingView` or `keyboardShouldPersistTaps`). Write to `audit-output/screen-inventory.md` modal catalog section.
    - _Requirements: 1.5_
    - _Risk: Some modals may not use ModalContainer (they might use raw `<Modal>` from react-native). Mitigation: Flag non-ModalContainer modals as consistency violations._
    - _Rollback: Remove modal section from screen-inventory.md._
  - [x] 2.4 For every screen where a state is marked absent in 2.1, create a corresponding issue entry. Format: `SCREEN-NNN | severity | screen-state | ScreenName missing [state] | file path | "No [state] implementation" | "Add [state] using [pattern] from [reference file]" | effort hours | phase`. Severity: Critical if empty or error state missing on primary tab screen (Dashboard, Logs, Analytics, Profile), High otherwise. Append all issues to a running issues list (will be compiled in Step 10).
    - _Requirements: 1.3_
    - _Risk: Over-counting issues if onboarding steps are treated as full screens. Mitigation: Only flag missing states on the parent OnboardingScreen, not individual steps._
    - _Rollback: Remove SCREEN-* issues from running list._

- [x] 3. Phase 2 — Component-Level Design Consistency Audit
  - [x] 3.1 Walk every component file across all 18 directories under `app/components/` (~115 files total). For each `.tsx` file: read the component's props/interface to identify variants (look for `variant` prop with union types) and states (look for `disabled`, `loading`, `error` props), read `StyleSheet.create` blocks and inline `style={}` objects, check every style value against token imports (flag hex colors not from `colors.*`, numeric padding/margin not from `spacing.*`, fontSize not from `typography.size.*`, fontWeight not from `typography.weight.*`, borderRadius not from `radius.*`, shadow values not from `shadows.*`), check for `usePressAnimation`/`useHoverState`/`useStaggeredEntrance` imports, identify animation library (check for `import { Animated } from 'react-native'` vs `import Animated from 'react-native-reanimated'`). Write results to `audit-output/component-catalog.md` as a table: Component | File Path | Category | Variants | States | Token Compliance (full/partial/none) | Hardcoded Values Count | Animation Library | Press Animation | Hover State | Issues.
    - _Requirements: 2.1, 2.2, 2.7_
    - _Risk: ~115 files is a large scope. Some files may be utility/helper files (e.g., `anatomicalPaths.ts`) not actual components. Mitigation: Only audit files that export a React component (check for JSX return or `React.FC` type). Skip pure data/utility files but note them._
    - _Risk: Inline styles using computed values (e.g., `spacing[3] + 2`) will be hard to detect as violations. Mitigation: Flag any arithmetic on token values as a potential violation for manual review._
    - _Rollback: Delete component-catalog.md content and re-walk._
  - [x] 3.2 Deep-audit foundation components. Read each file completely and verify against spec:
    - **Button** (`app/components/common/Button.tsx`): Verify 4 variants (primary, secondary, ghost, danger), `minHeight: 44` for touch target, padding uses `spacing[3]` vertical + `spacing[6]` horizontal, press animation uses `usePressAnimation` with snappy spring, hover uses `useHoverState`, disabled opacity is `opacityScale.disabled` (0.4), loading state shows `ActivityIndicator`.
    - **Card** (`app/components/common/Card.tsx`): Verify 3 variants (flat, raised, outlined), flat uses `colors.bg.surface` + `colors.border.subtle`, raised uses `colors.bg.surfaceRaised` + `colors.border.default` + `shadows.md` + top border highlight `rgba(255,255,255,0.04)`, outlined uses transparent bg + `colors.border.default`, all use `spacing[4]` padding + `radius.md`, press-enabled cards use `usePressAnimation`, animated cards use `useStaggeredEntrance`.
    - **ModalContainer** (`app/components/common/ModalContainer.tsx`): Verify mobile slide-up animation (250ms, `Easing.out`), web scale animation (200ms, `Easing.out`), backdrop uses `colors.bg.overlay` (`rgba(0,0,0,0.6)`), close button has adequate touch target (hitSlop + padding ≥ 44pt).
    - **EmptyState** (`app/components/common/EmptyState.tsx`): Verify icon container is 48×48, uses spacing tokens for internal layout.
    - Write detailed findings to `audit-output/component-catalog.md` foundation section.
    - _Requirements: 2.3, 2.4, 2.5_
    - _Risk: Button may not have exactly 4 variants — the actual code may differ from the design doc. Mitigation: Document what actually exists, flag deviations from spec as issues._
    - _Rollback: Remove foundation section from component-catalog.md._
  - [x] 3.3 Audit the training component set (`app/components/training/` — 20 files). Specifically: flag any component importing `Animated` from `react-native` instead of `react-native-reanimated` (known: PRBanner.tsx uses RN Animated). Verify consistent styling across RestTimer variants (RestTimer.tsx, RestTimerV2.tsx, RestTimerRing.tsx, RestTimerBar.tsx, RestTimerOverlay.tsx) — check they all use the same color tokens, spacing tokens, and typography tokens. Write findings to `audit-output/component-catalog.md` training section.
    - _Requirements: 2.6_
    - _Risk: RestTimerV2 may be a replacement for RestTimer, not a variant. Mitigation: Document the relationship and flag if both are actively used (dead code)._
    - _Rollback: Remove training section from component-catalog.md._
  - [x] 3.4 For every hardcoded value found in 3.1, every missing press feedback in 3.1, and every animation library inconsistency in 3.3, create issue entries: `COMP-NNN | severity | component | ComponentName [issue] | file path | current value | token replacement | effort | phase`. Hardcoded values = Medium severity. Missing press feedback = High. Animation library mismatch = High. Append to running issues list.
    - _Requirements: 2.2, 2.5, 2.6_
    - _Rollback: Remove COMP-* issues from running list._

- [x] 4. CHECKPOINT A — Screen and Component inventory complete
  - **Gate criteria**: (1) `screen-inventory.md` contains a row for every `.tsx` file under `app/screens/` (excluding empty `more/` dir and non-screen utility files like `sessionDetailHelpers.ts`). (2) `component-catalog.md` contains a row for every React component `.tsx` file under `app/components/`. (3) Modal catalog has entries for all 12 known modals. (4) Navigation graph documents all 4 stack navigators and 16+ screen registrations. (5) All SCREEN-* and COMP-* issues have required fields (severity, file path, current state, target state, effort). (6) Run `npx jest --config jest.config.js __tests__/audit/` from `app/` — all token baseline tests pass.
  - **If gate fails**: Fix the specific gap before proceeding. Do not start Phases 3-5 with incomplete inventory — downstream phases reference the catalog.
  - _Rollback: If fundamentally broken, delete audit-output/ contents and restart from Step 1._

- [x] 5. Phase 3 — Color System Audit (can run parallel with Steps 6, 7 after Checkpoint A)
  - [x] 5.1 Extract the complete color inventory from the token baseline (Step 1.2). Write to `audit-output/color-audit.md` organized by the 10 groups from `colors.*`: Backgrounds (bg.base=#0A0E13, bg.surface=#12171F, bg.surfaceRaised=#1A2029, bg.overlay=rgba(0,0,0,0.6)), Borders (border.subtle=rgba(255,255,255,0.06), border.default=rgba(255,255,255,0.08), border.hover=rgba(255,255,255,0.12), border.focus=#06B6D4), Text (text.primary=#F1F5F9, text.secondary=#94A3B8, text.muted=#64748B, text.inverse=#0B0F14), Accent (accent.primary=#06B6D4, accent.primaryHover=#0891B2, accent.primaryMuted=rgba(6,182,212,0.12)), Semantic (8 values), Premium (2), Gradient (3), Chart (5), Macro (8), Heatmap (7+). For each color, search the codebase for usage locations using grep for the token path (e.g., `colors.bg.surface`).
    - _Requirements: 3.1_
    - _Risk: Some colors may be used via destructuring (`const { surface } = colors.bg`) making grep harder. Mitigation: Also search for the hex value directly to catch indirect usage._
    - _Rollback: Delete color-audit.md content._
  - [x] 5.2 Compute WCAG AA contrast ratios for the 9 specific text-on-background pairs from Requirement 3.2. Use the relative luminance formula: linearize each sRGB channel (if c ≤ 0.04045: c/12.92, else ((c+0.055)/1.055)^2.4), then L = 0.2126*R + 0.7152*G + 0.0722*B, ratio = (L1+0.05)/(L2+0.05) where L1 > L2. Report each pair: foreground token + hex | background token + hex | computed ratio | required ratio (4.5:1 for <18pt, 3:1 for ≥18pt bold or ≥24pt) | PASS/FAIL. For failures, compute a replacement hex that passes by adjusting lightness while preserving hue. Write to `audit-output/color-audit.md` contrast section.
    - _Requirements: 3.2, 3.3_
    - _Risk: Manual contrast computation is error-prone. Mitigation: Implement the formula in a test (Step 5.5) and cross-validate._
    - _Rollback: Remove contrast section._
  - [x] 5.3 Evaluate border opacity hierarchy: compute the effective RGB of `border.subtle` (rgba(255,255,255,0.06)) composited on `bg.surface` (#12171F), `border.default` (0.08) on same, `border.hover` (0.12) on same. Report whether the 3 levels create perceptible differences (ΔE > 1.0 between adjacent levels). Write to `audit-output/color-audit.md` border section.
    - _Requirements: 3.4_
    - _Rollback: Remove border section._
  - [x] 5.4 Search all `.tsx` files in `app/components/` and `app/screens/` for hardcoded hex color literals (regex: `#[0-9A-Fa-f]{3,8}` not inside a comment or string that references tokens.ts) and `rgba()` values not imported from tokens. Exclude `tokens.ts` itself. For each violation: record file path, line number, hardcoded value, and the correct token replacement. Write to `audit-output/color-audit.md` violations section.
    - _Requirements: 3.7_
    - _Risk: Some hex values are legitimate (e.g., inside SVG path data, or in test files). Mitigation: Exclude files in `__tests__/`, and skip hex values inside SVG `d=""` attributes or `fill`/`stroke` props that reference token variables._
    - _Rollback: Remove violations section._
  - [x] 5.5 Simulate color vision deficiency for the 4 macro colors: calories=#06B6D4, protein=#22C55E, carbs=#F59E0B, fat=#F472B6. Apply standard CVD simulation matrices for protanopia, deuteranopia, tritanopia. Compute pairwise contrast between all 6 pairs under each simulation. Flag any pair dropping below 3:1. Write to `audit-output/color-audit.md` CVD section.
    - _Requirements: 3.5_
    - _Rollback: Remove CVD section._
  - [x] 5.6 Compare color system against 4 benchmark apps. For each (WHOOP, Apple Fitness+, Oura, Strava): document 3+ specific adoptable qualities with concrete implementation guidance referencing existing tokens. Example: "WHOOP uses true black (#000000) as base vs HOS #0A0E13 — the slightly warm charcoal is actually better for eye comfort, keep it." Write to `audit-output/color-audit.md` benchmark section.
    - _Requirements: 3.6_
    - _Risk: Benchmark comparison is subjective. Mitigation: Label subjective assessments explicitly. Ground recommendations in measurable properties (contrast ratios, color count, palette size)._
    - _Rollback: Remove benchmark section._
  - [x] 5.7 Write property tests for color audit accuracy: create `app/__tests__/audit/colorAudit.test.ts`. Tests: (a) **Property 5 — WCAG Contrast Ratio Accuracy**: use fast-check to generate random RGB pairs, compute contrast ratio independently, verify the formula matches to ±0.1. (b) **Property 6 — Macro CVD Distinguishability**: verify the 4 macro colors maintain ≥3:1 pairwise contrast under each CVD simulation. (c) Unit test: verify white-on-black = 21:1, black-on-black = 1:1. Run with `npx jest --config jest.config.js __tests__/audit/colorAudit.test.ts`.
    - _Requirements: 3.2, 3.3, 3.5_
    - _Risk: fast-check may generate edge-case colors (all zeros, all 255) that expose floating-point precision issues. Mitigation: Use ±0.1 tolerance in assertions._
    - _Rollback: Delete test file._
  - [x] 5.8 Create COLOR-* issue entries for: every WCAG contrast failure (Critical severity), every hardcoded color violation (Medium), every CVD distinguishability failure (High). Append to running issues list.
    - _Requirements: 3.2, 3.3, 3.5, 3.7_
    - _Rollback: Remove COLOR-* issues._

- [x] 6. Phase 4 — Typography System Audit (can run parallel with Steps 5, 7 after Checkpoint A)
  - [x] 6.1 Document the complete type system from the token baseline. Write to `audit-output/typography-audit.md`: families (sans=Inter, sansIOS=SF Pro Display, mono=JetBrains Mono), weights (regular=400, medium=500, semibold=600, bold=700), sizes (xs=12, sm=13, base=14, md=16, lg=18, xl=20, 2xl=24, 3xl=32), lineHeights (tight=1.2, normal=1.5, relaxed=1.625), letterSpacing (tighter=-0.5, tight=-0.25, normal=0, wide=0.5), numeric fontVariant=['tabular-nums','lining-nums'].
    - _Requirements: 4.1_
    - _Rollback: Delete typography-audit.md content._
  - [x] 6.2 Audit heading hierarchy: read the 4 primary tab screens (DashboardScreen.tsx, LogsScreen.tsx, AnalyticsScreen.tsx, ProfileScreen.tsx) and extract the screen title style — the exact `fontSize`, `fontWeight`, `letterSpacing`, `color` values used. Verify all 4 use identical values. Do the same for section headers (look for `SectionHeader` component usage or inline section title styles) and body text. Flag any deviation with file path and line number. Write to `audit-output/typography-audit.md` hierarchy section.
    - _Requirements: 4.2_
    - _Risk: Screens may use different patterns for titles (some inline, some via SectionHeader component). Mitigation: Check both patterns._
    - _Rollback: Remove hierarchy section._
  - [x] 6.3 Search all screen and component files for numeric display components. Specifically check: BudgetBar.tsx (calorie counts), MacroRingsRow.tsx (macro values), ActiveWorkoutScreen.tsx (weight/rep numbers in set rows), RestTimer.tsx (timer display — currently `typography.size['3xl'] * 2` = 64px), StreakIndicator.tsx (streak counts), TrendLineChart.tsx (axis labels), ExpenditureTrendCard.tsx (TDEE values). For each, verify the style includes `fontVariant: ['tabular-nums', 'lining-nums']` or references `typography.numeric.fontVariant`. Flag missing tabular-nums as High severity. Write to `audit-output/typography-audit.md` numeric section.
    - _Requirements: 4.3_
    - _Risk: Some numeric displays may use a wrapper component that applies fontVariant. Mitigation: Trace the style chain — if a parent component applies it, the child is compliant._
    - _Rollback: Remove numeric section._
  - [x] 6.4 Audit text truncation: check ExerciseCard.tsx, ActiveWorkoutScreen.tsx (exercise names), AddNutritionModal.tsx (food names), ArticleCardCompact.tsx (article titles) for `numberOfLines` with `ellipsizeMode`. Check that truncated text doesn't overlap adjacent elements (look for `flex: 1` or `flexShrink: 1` on the text container). Audit text case conventions: verify section headers use consistent casing across screens. Write to `audit-output/typography-audit.md` truncation section.
    - _Requirements: 4.4, 4.5_
    - _Rollback: Remove truncation section._
  - [x] 6.5 Compare typography against benchmarks: Apple Fitness+ (bold condensed headings, tight letter spacing), Linear (clean Inter usage, generous whitespace), WHOOP (data-dense numeric displays with monospace alignment). Recommend specific improvements. Write to `audit-output/typography-audit.md` benchmark section.
    - _Requirements: 4.6_
    - _Rollback: Remove benchmark section._
  - [x] 6.6 Write property tests: create `app/__tests__/audit/typographyAudit.test.ts`. Tests: (a) **Property 12 — Heading Hierarchy Consistency**: import the 4 primary tab screen files, extract title style objects, assert fontSize/fontWeight/letterSpacing are identical across all 4. (b) **Property 11 — Tabular Nums**: for a list of known numeric display components, verify their style includes tabular-nums fontVariant. Run tests.
    - _Requirements: 4.2, 4.3_
    - _Risk: Importing screen components in a Node test environment will fail (React Native components). Mitigation: Test against extracted style objects or StyleSheet definitions, not rendered components. Parse the source files as text and extract style values with regex._
    - _Rollback: Delete test file._
  - [x] 6.7 Create TYPO-* issue entries for: heading inconsistencies (Medium), missing tabular-nums (High), truncation gaps (Medium), case convention violations (Low). Append to running issues list.
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
    - _Rollback: Remove TYPO-* issues._

- [x] 7. Phase 5 — Spacing and Layout System Audit (can run parallel with Steps 5, 6 after Checkpoint A)
  - [x] 7.1 Document the spacing scale from token baseline: keys 0-16 mapping to 0,4,8,12,16,20,24,32,40,48,64 px. Document radius scale: sm=8, md=12, lg=16, full=9999. Write to `audit-output/spacing-audit.md` scale section.
    - _Requirements: 5.1_
    - _Rollback: Delete spacing-audit.md content._
  - [x] 7.2 Audit screen-level horizontal padding: read the root container style (ScrollView or FlatList `contentContainerStyle`, or root View `style`) of DashboardScreen.tsx, LogsScreen.tsx, AnalyticsScreen.tsx, ProfileScreen.tsx. Extract `paddingHorizontal` value. Verify all 4 use the same `spacing[N]` token. Flag inconsistencies as Medium severity. Write to `audit-output/spacing-audit.md` margins section.
    - _Requirements: 5.2_
    - _Risk: Some screens may use `paddingLeft`/`paddingRight` separately instead of `paddingHorizontal`. Mitigation: Check both patterns._
    - _Rollback: Remove margins section._
  - [x] 7.3 Evaluate content density on 3 high-density screens: (a) DashboardScreen — measure gaps between MacroRingsRow, BudgetBar, MealSlotDiary, TodaySummaryRow. (b) AnalyticsScreen — measure gaps between HeatMapCard, WeeklySummaryCard, ExpenditureTrendCard, StrengthLeaderboard. (c) ActiveWorkoutScreen — measure gaps between exercise header, set rows, RPE picker, rest timer. Verify 3-tier spacing hierarchy: section gaps = spacing[6-8] (24-32px), item gaps = spacing[3-4] (12-16px), component internal = spacing[1-2] (4-8px). Write to `audit-output/spacing-audit.md` density section.
    - _Requirements: 5.3, 5.4_
    - _Rollback: Remove density section._
  - [x] 7.4 Audit specific spacing hotspots from Requirement 5.6: MacroRingsRow ring gaps, BudgetBar internal padding, MealSlotGroup section spacing, ExerciseCard item gaps in ExercisePickerScreen, RestTimer overlay padding (currently `spacing[8]`=32px), set row spacing in ActiveWorkoutScreen, Dashboard card-to-card gaps. For each: record current value, whether it uses a token, and whether it follows the spacing scale. Write to `audit-output/spacing-audit.md` hotspots section.
    - _Requirements: 5.6_
    - _Rollback: Remove hotspots section._
  - [x] 7.5 Evaluate thumb-zone ergonomics: check positioning of primary action buttons — add nutrition FAB (if exists), start workout button, log set button, finish workout via FinishBar.tsx, tab bar sizing in BottomTabNavigator. Verify primary actions are in bottom 40% of screen. Check modal action button reachability. Write to `audit-output/spacing-audit.md` ergonomics section.
    - _Requirements: 5.5_
    - _Rollback: Remove ergonomics section._
  - [x] 7.6 Write property test: create `app/__tests__/audit/spacingAudit.test.ts`. Test **Property 13 — Screen Horizontal Padding Consistency**: parse the 4 primary tab screen source files, extract paddingHorizontal values, assert they are identical. Run tests.
    - _Requirements: 5.2_
    - _Rollback: Delete test file._
  - [x] 7.7 Create SPACE-* issue entries for: padding inconsistencies (Medium), spacing scale violations (Medium), density problems (High on ActiveWorkoutScreen, Medium elsewhere), thumb-zone violations (High). Append to running issues list.
    - _Requirements: 5.2, 5.3, 5.5, 5.6_
    - _Rollback: Remove SPACE-* issues._

- [x] 8. CHECKPOINT B — Color, Typography, and Spacing audits complete
  - **Gate criteria**: (1) `color-audit.md` has all 10 color groups documented, 9 contrast ratios computed, violations listed, CVD analysis complete, benchmark section written. (2) `typography-audit.md` has type system documented, heading hierarchy audited across 4 screens, numeric displays checked, truncation audited. (3) `spacing-audit.md` has scale documented, screen margins audited, density evaluated on 3 screens, hotspots checked, ergonomics assessed. (4) Run `npx jest --config jest.config.js __tests__/audit/` from `app/` — all tests pass (tokenBaseline + colorAudit + typographyAudit + spacingAudit). (5) All COLOR-*, TYPO-*, SPACE-* issues have required fields.
  - **If gate fails**: Fix specific gaps. Do not proceed to animation audit or benchmark comparison with incomplete color/typography/spacing data — those phases reference these findings.
  - _Rollback: If a phase is fundamentally flawed, delete that phase's output file and re-execute that step only._

- [x] 9. Phase 6 — Animation and Micro-Interaction Audit (depends on Steps 2+3 for component catalog)
  - [x] 9.1 Catalog all animation patterns by searching the codebase. Search for: (a) Reanimated imports — `useSharedValue`, `withSpring`, `withTiming`, `withDelay`, `useAnimatedStyle`, `useAnimatedProps` from `react-native-reanimated`. (b) RN Animated imports — `Animated.timing`, `Animated.spring`, `Animated.Value`, `LayoutAnimation` from `react-native`. For each occurrence: record file path, animation type (spring/timing/layout), library (reanimated/rn-animated), config values (damping/stiffness/mass for springs, duration/easing for timing), and purpose (press feedback, entrance, loading, progress, celebration, transition). Write to `audit-output/animation-audit.md` catalog section.
    - _Requirements: 6.1_
    - _Risk: `BottomTabNavigator.tsx` imports `Animated` from `react-native` for `slideFromRight` — this is a known inconsistency from Step 2.2. Mitigation: Include it in the catalog, cross-reference with the navigation finding._
    - _Rollback: Delete animation-audit.md content._
  - [x] 9.2 Flag animation library inconsistencies: list all components using RN `Animated` (known from Step 3: PRBanner.tsx, Tooltip.tsx, SwipeableRow.tsx, BottomTabNavigator.tsx slideFromRight). Flag each as High severity with specific migration guidance (e.g., "Replace `Animated.spring` with `withSpring(targetValue, springs.bouncy)`, replace `Animated.Value` with `useSharedValue`, replace `Animated.View` with Reanimated `Animated.View`"). Verify spring preset compliance: search for `withSpring` calls using inline config objects `{ damping: N, stiffness: N }` instead of referencing `springs.gentle`/`springs.snappy`/`springs.bouncy` from tokens. Write to `audit-output/animation-audit.md` consistency section.
    - _Requirements: 6.2, 6.3_
    - _Rollback: Remove consistency section._
  - [x] 9.3 Audit loading state coverage: for each screen that performs async data fetching (check for `useEffect` with API calls, `useDailyTargets`, `useHealthData`, or `fetch`/`axios` usage), verify it imports and renders `Skeleton` or a skeleton pattern before data is available. Check: DashboardScreen, LogsScreen, AnalyticsScreen, ProfileScreen, CoachingScreen, CommunityScreen, LearnScreen, HealthReportsScreen, NutritionReportScreen. Flag missing skeleton states as High severity. Write to `audit-output/animation-audit.md` loading section.
    - _Requirements: 6.4_
    - _Rollback: Remove loading section._
  - [x] 9.4 Evaluate micro-interactions at 5 key moments: (a) Set completion in ActiveWorkoutScreen — search for checkmark animation, haptic call (`Haptics.impactAsync` or `Haptics.notificationAsync`), color change on completion. (b) PR detection via PRBanner — examine spring config, scale animation, auto-dismiss timing (3s), haptic. (c) Rest timer countdown in RestTimer.tsx — check if countdown is animated (smooth interpolation) or integer swap, check for completion sound (expo-av) and haptic. (d) Meal logging confirmation after AddNutritionModal dismiss — check for toast/feedback. (e) Swipe-to-delete in SwipeableRow — check friction value, gesture feedback. Search entire codebase for `expo-haptics` imports and `Haptics.` calls — document every haptic usage point and every missing haptic. Write to `audit-output/animation-audit.md` micro-interactions and haptics sections.
    - _Requirements: 6.5, 6.6_
    - _Risk: Haptic calls may be in utility functions or hooks, not directly in components. Mitigation: Search for `from 'expo-haptics'` across entire codebase, then trace usage._
    - _Rollback: Remove micro-interactions and haptics sections._
  - [x] 9.5 Audit empty state and error state coverage: verify `EmptyState` component is used on screens that can have zero data — LogsScreen (no entries), AnalyticsScreen (no training data), ProgressPhotosScreen (no photos), CommunityScreen (no posts), LearnScreen (no articles). For each EmptyState usage, verify it has: icon (48×48 container), title, description, action button. Verify `ErrorBoundary` wrapping on appropriate component trees. Check API error handling patterns — do screens show user-facing error messages with retry, or silent failures? Write to `audit-output/animation-audit.md` states section.
    - _Requirements: 6.7, 6.8_
    - _Rollback: Remove states section._
  - [x] 9.6 Write property tests: create `app/__tests__/audit/animationAudit.test.ts`. Tests: (a) **Property 10 — Spring Preset Compliance**: parse source files containing `withSpring`, verify config objects match one of the 3 presets from tokens. (b) **Property 14 — Skeleton Loading Coverage**: for a list of async screens, verify they import Skeleton or a skeleton pattern. (c) **Property 15 — Empty State Coverage**: for a list of data-list screens, verify they import EmptyState. Run tests.
    - _Requirements: 6.3, 6.4, 6.7_
    - _Rollback: Delete test file._
  - [x] 9.7 Create ANIM-* issue entries for: animation library mismatches (High), spring preset violations (Medium), missing skeleton states (High), missing haptics (Medium), missing empty states (High on primary tabs, Medium on secondary), missing error states (High). Append to running issues list.
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
    - _Rollback: Remove ANIM-* issues._

- [x] 10. CHECKPOINT C — All 6 analysis phases complete
  - **Gate criteria**: (1) All 6 audit documents are complete: screen-inventory.md, component-catalog.md, color-audit.md, typography-audit.md, spacing-audit.md, animation-audit.md. (2) Run full test suite: `npx jest --config jest.config.js __tests__/audit/` — all tests pass. (3) Issue counts are tracked: total SCREEN-* + COMP-* + COLOR-* + TYPO-* + SPACE-* + ANIM-* issues. (4) Every issue has all required fields.
  - **If gate fails**: Fix gaps before proceeding. Benchmark comparison and accessibility audit reference findings from all 6 phases.
  - _Rollback: Re-execute the failing phase only._

- [x] 11. Phase 7 — Premium Benchmark Comparison (depends on Steps 5-9 for findings; can run parallel with Step 12)
  - [x] 11.1 Compare Hypertrophy OS against 6 benchmark apps across visual dimensions from Phases 3-6. For each benchmark (Apple Fitness+, WHOOP, Oura, Strava, Linear, Stripe Dashboard): identify 3+ specific implementable visual qualities, provide concrete implementation guidance referencing existing HOS components and tokens, estimate effort in hours. Write to `audit-output/benchmark-comparison.md` with per-benchmark sections. Each recommendation must be specific: "Adopt Apple Fitness+ ring glow: add `glowShadow(colors.macro.protein, 16, 0.4)` to ProgressRing when fill > 80%" — not "make rings look better."
    - _Requirements: 7.1, 7.2_
    - _Risk: Benchmark comparison is inherently subjective. Mitigation: Ground every recommendation in a measurable property (contrast ratio, animation duration, spacing value, color count) and label subjective assessments._
    - _Rollback: Delete benchmark-comparison.md content._
  - [x] 11.2 Compare data visualization: MacroRingsRow/ProgressRing vs Apple Fitness+ activity rings (ring thickness, glow, labels, fill animation), BodyHeatMap/BodySilhouette vs WHOOP strain visualization (gradient quality, region clarity, legend), TrendLineChart vs Strava performance charts (line smoothing, gradient fills, axis styling — note HOS uses victory-native), BudgetBar progress track vs premium patterns (track height currently 6px, fill animation, overshoot visualization). Write to `audit-output/benchmark-comparison.md` data-viz section.
    - _Requirements: 7.3_
    - _Rollback: Remove data-viz section._
  - [x] 11.3 Compare information density: DashboardScreen vertical card stack vs Stripe Dashboard grid layout. Evaluate single-column scroll vs 2-column grid potential for tablets/larger phones. Write to `audit-output/benchmark-comparison.md` density section.
    - _Requirements: 7.4_
    - _Rollback: Remove density section._
  - [x] 11.4 Produce ranked top-10 gap analysis: the 10 visual qualities that most separate HOS from premium-tier apps. Each entry: rank | benchmark app | quality | current HOS state | target state | implementation guide (specific files + code changes) | effort hours. Write to `audit-output/benchmark-comparison.md` gap analysis section.
    - _Requirements: 7.5_
    - _Rollback: Remove gap analysis section._
  - [x] 11.5 Create BENCH-* issue entries for each of the top-10 gaps. Severity: High for top 5, Medium for 6-10. Append to running issues list.
    - _Requirements: 7.5_
    - _Rollback: Remove BENCH-* issues._

- [x] 12. Phase 8 — Accessibility Compliance Audit (depends on Steps 5-9 for contrast/touch/motion data; can run parallel with Step 11)
  - [x] 12.1 Measure touch targets for all interactive elements from Requirement 8.1. For each element, compute effective touch area = element size + padding + hitSlop. Specific elements: (a) Tab bar icons in BottomTabNavigator — check `TabSvgIcon` sizing and tab button padding. (b) Modal close buttons in ModalContainer — `hitSlop={8}` + `padding: 8` = verify ≥44pt. (c) RestTimer gear icon — `padding: spacing[1]` = 4px — likely fails. (d) DateScroller day items. (e) ProgressRing tap targets. (f) RPEPicker buttons. (g) SetTypeSelector options. (h) FilterPill components. (i) Navigation header back buttons. Flag any below 44×44pt with: component name, file path, current size, specific fix (increase padding, add hitSlop, increase container). Write to `audit-output/accessibility-audit.md` touch targets section.
    - _Requirements: 8.1, 8.2_
    - _Risk: Touch target calculation requires knowing the element's intrinsic size, which depends on content. Mitigation: Use minHeight/minWidth if set, otherwise estimate from padding + typical content size. Flag uncertain measurements._
    - _Rollback: Delete accessibility-audit.md content._
  - [x] 12.2 Audit color-only information: verify macro colors in MacroRingsRow and BudgetBar have text labels ("Protein", "Carbs", "Fat"), semantic colors in BudgetBar have text reinforcement ("kcal over"/"kcal remaining"), heatmap colors have HeatMapLegend with text labels, RPEBadge has numeric value alongside color, chart trend lines in TrendLineChart are distinguishable by pattern (dash/dot) not just color. Write to `audit-output/accessibility-audit.md` color section.
    - _Requirements: 8.3_
    - _Rollback: Remove color section._
  - [x] 12.3 Audit screen reader support: search for `accessibilityLabel` props on icon-only buttons (close, gear, add, settings icons), custom controls (ProgressRing, BudgetBar, BodyHeatMap/BodySilhouette SVG regions), and navigation elements. Flag missing labels. Check Dynamic Type support: verify typography uses values that can scale with system font size preferences (not hardcoded pixel values that ignore accessibility settings). Write to `audit-output/accessibility-audit.md` screen reader and text scaling sections.
    - _Requirements: 8.4, 8.5_
    - _Rollback: Remove screen reader section._
  - [x] 12.4 Audit reduce-motion support: check `usePressAnimation.ts`, `useStaggeredEntrance.ts`, `useSkeletonPulse.ts`, `useCountingValue.ts`, `ProgressRing.tsx`, `PRBanner.tsx` for `AccessibilityInfo.isReduceMotionEnabled()` or `useReducedMotion` from Reanimated. Note that `useStaggeredEntrance` has a web fallback (returns static style on web) — verify native has equivalent reduce-motion support. Write to `audit-output/accessibility-audit.md` motion section.
    - _Requirements: 8.6_
    - _Rollback: Remove motion section._
  - [x] 12.5 Write property tests: create `app/__tests__/audit/accessibilityAudit.test.ts`. Tests: (a) **Property 16 — Touch Target Minimum**: for known small-target components (RestTimer gear, FilterPill), parse source and verify padding + hitSlop ≥ 44. (b) **Property 18 — Accessibility Label Coverage**: for a list of icon-only button components, verify they have `accessibilityLabel` prop. (c) **Property 19 — Reduce-Motion Support**: for each animation hook file, verify it contains `isReduceMotionEnabled` or `useReducedMotion`. Run tests.
    - _Requirements: 8.1, 8.5, 8.6_
    - _Rollback: Delete test file._
  - [x] 12.6 Create A11Y-* issue entries for: touch target violations (Critical if on ActiveWorkoutScreen, High otherwise), missing accessibility labels (Medium), missing reduce-motion support (High), color-only information (Medium), Dynamic Type issues (Medium). Append to running issues list.
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6_
    - _Rollback: Remove A11Y-* issues._

- [x] 13. CHECKPOINT D — All 8 audit phases complete
  - **Gate criteria**: (1) All 8 audit documents complete: screen-inventory.md, component-catalog.md, color-audit.md, typography-audit.md, spacing-audit.md, animation-audit.md, benchmark-comparison.md, accessibility-audit.md. (2) Run full test suite: `npx jest --config jest.config.js __tests__/audit/` — all tests pass (tokenBaseline + colorAudit + typographyAudit + spacingAudit + animationAudit + accessibilityAudit). (3) Total issue count across all categories is tracked. (4) Every issue has all required fields: id, severity, category, title, description, currentState, targetState, filePaths, effortHours, phase, requirementRef. (5) No issue references a file that doesn't exist.
  - **If gate fails**: Fix gaps. Do not synthesize deliverables with incomplete or inconsistent data.
  - _Rollback: Re-execute the failing phase._

- [x] 14. Phase 9 — Synthesize Deliverables
  - [x] 14.1 Compile the Issue Log (`audit-output/issue-log.md`): collect ALL issues from Steps 2.4, 3.4, 5.8, 6.7, 7.7, 9.7, 11.5, 12.6. Assign unique sequential IDs within each category (SCREEN-001, COMP-001, COLOR-001, TYPO-001, SPACE-001, ANIM-001, BENCH-001, A11Y-001). Verify each issue has all required fields. Sort by severity (Critical → High → Medium → Low), then by category. Include summary table: count by severity × category. Include total effort estimate in hours.
    - _Requirements: 10.2_
    - _Risk: Issue IDs may collide if numbering restarts per category. Mitigation: Use category prefix + 3-digit sequential number._
    - _Rollback: Delete issue-log.md and re-compile._
  - [x] 14.2 Produce the Design System Spec (`audit-output/design-system-spec.md`). Compile from Phases 3-6 into sections: (1) Color Palette — every token with hex, usage rule, WCAG contrast ratios, recommended changes. (2) Spacing Scale — usage rules per tier (section/item/component). (3) Border Radius — component mapping (which components use which radius). (4) Elevation/Shadows — usage contexts (flat cards vs raised cards vs modals). (5) Typography Ramp — complete hierarchy table with 8 roles (screen title, section header, card title, body, caption, data value, badge, mono). (6) Animation System — spring usage rules (press→snappy, progress→gentle, celebration→bouncy), timing standards (fast 100ms, default 200ms, slow 300ms), easing assignments. (7) Haptic Patterns — trigger points and feedback types. (8) Component Specifications — per-component variant/state/spacing documentation for Button, Card, ModalContainer, EmptyState, ProgressRing, BudgetBar, RestTimer. (9) Premium Polish Checklist — 50+ actionable items organized by category (Color, Typography, Spacing, Animation, Components, Screens, Accessibility), each with specific file/line reference.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
    - _Risk: The 50+ item checklist may be hard to reach if the audit found fewer issues. Mitigation: Include both "fix existing issues" items AND "add missing features" items (e.g., "Add backdrop blur to tab bar", "Add haptic to set completion")._
    - _Rollback: Delete design-system-spec.md and re-compile._
  - [x] 14.3 Produce the Implementation Roadmap (`audit-output/implementation-roadmap.md`). Organize Issue Log items into 4 phases:
    - **Phase 1 (Weeks 1-2, "Foundation")**: All Critical severity issues + High severity token fixes (contrast failures, animation library unification for PRBanner/Tooltip/SwipeableRow/BottomTabNavigator, critical touch target violations like RestTimer gear icon). Theme: "Fix what's broken."
    - **Phase 2 (Weeks 3-4, "Component Polish")**: Remaining High severity issues — common component refinements (Button/Card/ModalContainer/EmptyState), missing loading/empty/error states on primary tab screens, typography consistency fixes (heading hierarchy, tabular-nums). Theme: "Unify the system."
    - **Phase 3 (Weeks 5-6, "Screen-Level Premium")**: Medium severity issues — spacing/density improvements, micro-interaction additions (set completion haptic, PR celebration polish, rest timer haptic), data visualization upgrades (ring glow, chart styling). Theme: "Add the premium feel."
    - **Phase 4 (Weeks 7-8, "Final Polish")**: Low severity issues + remaining Medium — accessibility improvements (Dynamic Type, screen reader labels, reduce-motion), benchmark alignment items, remaining polish. Theme: "Ship it."
    - Each phase: theme, deliverables list, total effort estimate in hours, complete file list.
    - Verify: Phase 1 contains only Critical+High. Phase 4 contains only Low+Medium. Phases 2-3 contain remaining High+Medium.
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.6_
    - _Risk: Phase 1 may be overloaded if there are many Critical issues. Mitigation: If Phase 1 exceeds 40 hours, split into Phase 1a (Critical only) and Phase 1b (High foundation)._
    - _Rollback: Delete implementation-roadmap.md and re-compile._
  - [x] 14.4 Produce the Executive Summary at the top of `audit-output/implementation-roadmap.md`:
    - **Premium Score**: 1-10 rating. Criteria: 1-3 = MVP/functional only, 4-5 = decent but not premium, 6-7 = competitive with mid-tier apps, 8-9 = premium tier, 10 = best-in-class (Apple Fitness+ level). Score based on: token compliance %, state coverage %, contrast compliance %, animation consistency %, touch target compliance %, benchmark gap count.
    - **Top 5 Critical Issues**: Each with current state, impact on premium perception, and specific fix with file paths.
    - **Top 10 Quick Wins**: Items achievable in ≤2 hours each with outsized visual impact. Each with: file path, specific code change, effort estimate, visual impact description.
    - Verify: every effort estimate references at least one specific file path in `app/`.
    - _Requirements: 10.7, 10.8_
    - _Rollback: Remove executive summary section._
  - [x] 14.5 Write property tests for deliverable structural completeness: create `app/__tests__/audit/deliverables.test.ts`. Tests: (a) **Property 20 — Issue Log Completeness**: parse issue-log.md, verify every issue has all required fields (id, severity, category, title, filePaths non-empty, effortHours > 0, phase 1-4, requirementRef). (b) **Property 21 — Phase-Severity Alignment**: verify Phase 1 issues are Critical/High only, Phase 4 are Low/Medium only. (c) **Property 22 — Effort Estimate File Reference**: verify every roadmap item with effort references a file path starting with `app/`. (d) **Property 24 — Premium Polish Checklist Count**: parse design-system-spec.md, count checklist items, verify ≥ 50. (e) **Property 4 — Token Round-Trip**: parse token-baseline.md and design-system-spec.md, verify every token from baseline appears in the spec. Run tests.
    - _Requirements: 9.1, 9.6, 10.2, 10.3-10.6, 10.8_
    - _Risk: Parsing Markdown in tests is fragile. Mitigation: Use simple regex patterns for table rows and checklist items. Don't over-engineer the parser._
    - _Rollback: Delete test file._
  - [x] 14.6 Cross-validate issue counts: verify the total issue count in issue-log.md matches the sum of issues referenced across all 8 audit documents. Verify no duplicate IDs. Verify every issue ID referenced in the roadmap exists in the issue log.
    - _Requirements: 10.2_
    - _Rollback: Fix discrepancies in issue-log.md._

- [x] 15. CHECKPOINT E — Final validation
  - **Gate criteria**: (1) All 12 output files exist in `audit-output/`: token-baseline.md, screen-inventory.md, component-catalog.md, color-audit.md, typography-audit.md, spacing-audit.md, animation-audit.md, benchmark-comparison.md, accessibility-audit.md, issue-log.md, design-system-spec.md, implementation-roadmap.md. (2) Run full test suite: `npx jest --config jest.config.js __tests__/audit/` — ALL tests pass (tokenBaseline + colorAudit + typographyAudit + spacingAudit + animationAudit + accessibilityAudit + deliverables). (3) Issue log has no duplicate IDs. (4) Every issue in the roadmap exists in the issue log. (5) Phase-severity alignment is correct. (6) Premium polish checklist has ≥50 items. (7) Executive summary has premium score, top 5, top 10. (8) Every effort estimate references a file path. (9) All 10 requirements from requirements.md are covered (trace each requirement to at least one issue or finding).
  - **If gate fails**: Fix the specific gap. This is the final quality gate — do not declare the audit complete until all criteria pass.
  - **Deliverables ready for user review**: issue-log.md, design-system-spec.md, implementation-roadmap.md (with executive summary).

## Monitoring and Post-Audit Instrumentation

Since this is an audit producing documents (not a runtime system), "monitoring" means tracking the implementation of audit findings:

1. **Issue Resolution Tracking**: The implementation-roadmap.md uses checkbox format (`- [ ]` items). As fixes are implemented, check them off. Track: total issues, resolved issues, resolution rate per phase.
2. **Token Compliance Regression**: After implementing Phase 1 fixes, re-run the hardcoded color search (Step 5.4) to verify no new violations were introduced. Consider adding a CI lint rule: `grep -rn '#[0-9A-Fa-f]\{6\}' app/components/ app/screens/ --include='*.tsx' | grep -v tokens.ts | grep -v __tests__` should return 0 results.
3. **Contrast Ratio Regression**: After implementing color fixes, re-run the WCAG contrast computation (Step 5.2) to verify all pairs now pass.
4. **Test Suite as Regression Gate**: The `__tests__/audit/` test suite should be run in CI after any token or style change to catch regressions. Add to `.github/workflows/ci.yml`: `npx jest --config app/jest.config.js app/__tests__/audit/`.

## Removed from Original Plan (Cut Waste)

1. **Removed separate "Checkpoint — Screen and Component inventory complete" as a standalone task** — merged into Checkpoint A with concrete gate criteria.
2. **Removed vague "Ask the user if questions arise" from checkpoints** — replaced with specific gate criteria and failure actions.
3. **Removed optional property test tasks as separate sub-tasks** — integrated tests directly into each phase (Steps 1.3, 5.7, 6.6, 7.6, 9.6, 12.5, 14.5) as required, not optional. Every phase ships with tests.
4. **Removed "Checkpoint — All 8 audit phases complete" as a separate task** — merged into Checkpoint D with concrete criteria.
5. **Removed duplicate issue logging** — original plan had issues scattered across phases with no clear compilation step. Now each phase creates typed issues (SCREEN-*, COMP-*, etc.) and Step 14.1 compiles them all.

## Notes

- Each task references specific requirements for traceability
- 5 checkpoints (A, B, C, D, E) ensure incremental validation with concrete gate criteria
- Tests are required at every phase, not optional — 7 test files total in `app/__tests__/audit/`
- The audit is a codebase walkthrough producing Markdown documents — no runtime app execution required
- Property tests use `fast-check` (installed as devDependency) with Jest
- All findings reference specific file paths and token values for actionability
- Rollback plan for every step: delete the output and re-execute that step only
- No step references output from a later step — dependency chain is strictly forward