# Premium UI Implementation — Task Plan

> **159 audit issues · 7 phases · ~23 tasks**
> Refactored for correct dependency ordering, explicit risks, rollback plans, and testing gates.

---

## Pre-Execution Checklist

Before starting any task, verify the following:

- [x] **0.1 Environment verification**
  - [x] 0.1.1 Confirm `fast-check` v4.x is installed: run `cd app && npx jest --version` and verify `fast-check` resolves (`node -e "require('fast-check')"`)
  - [x] 0.1.2 Confirm Jest config works: run `cd app && npx jest --config jest.config.js --listTests` — must exit 0
  - [x] 0.1.3 Confirm Reanimated is available: run `node -e "require('react-native-reanimated')"` from `app/`
  - [x] 0.1.4 Confirm react-native-haptics (or expo-haptics) is installed: `node -e "require('expo-haptics')"` from `app/`
  - [x] 0.1.5 Run existing test suite baseline: `cd app && npx jest --config jest.config.js 2>&1 | tail -20` — record pass/fail counts
  _Requirements: Prerequisite for all phases_
  _Risk: Missing dependency blocks entire plan_
  _Mitigation: Install any missing package immediately; if Reanimated missing, skip Phase 3 Reanimated migrations and file blocker_
  _Rollback: N/A — read-only verification_

---

## Dependency Graph

```
Phase 0: Environment Verification
  │
Phase 1: Design Tokens & Foundation (no UI changes)
  │  ├─ 1.1 Token audit & consolidation
  │  ├─ 1.2 WCAG contrast property tests (validates 1.1)
  │  └─ 1.3 Token compliance snapshot
  │
Phase 2: Animation Infrastructure (depends on tokens from Phase 1)
  │  ├─ 2.1 reduce-motion hook audit
  │  ├─ 2.2 reduce-motion property tests (validates 2.1)
  │  ├─ 2.3 Spring config consolidation
  │  └─ 2.4 Duration constant extraction
  │
Phase 3: Shared Components (depends on tokens + animation infra)
  │  ├─ 3.1 Enhance ErrorBoundary (add fallback render prop)
  │  ├─ 3.2 Create ErrorBanner component
  │  ├─ 3.3 ErrorBoundary property tests (validates 3.1)
  │  ├─ 3.4 ProgressRing token + reduce-motion fixes
  │  ├─ 3.5 Card / EmptyState / Button token fixes
  │  └─ 3.6 PRBanner Reanimated migration
  │
  ├── CHECKPOINT A: Foundation complete ──────────────────
  │
Phase 4: Screen-Level Fixes — Batch 1 (depends on shared components)
  │  ├─ 4.1 DashboardScreen fixes
  │  ├─ 4.2 LogsScreen fixes
  │  ├─ 4.3 AnalyticsScreen fixes
  │  ├─ 4.4 NutritionReportScreen fixes
  │  └─ 4.5 ProfileScreen fixes
  │
  ├── CHECKPOINT B: Core screens complete ────────────────
  │
Phase 5: Screen-Level Fixes — Batch 2 (depends on shared components)
  │  ├─ 5.1 LearnScreen + ArticleDetailScreen fixes
  │  ├─ 5.2 CommunityScreen fixes
  │  ├─ 5.3 CoachingScreen fixes
  │  ├─ 5.4 HealthReportsScreen fixes
  │  ├─ 5.5 FounderStoryScreen fixes
  │  ├─ 5.6 Auth screens (Login + Register) fixes
  │  └─ 5.7 Onboarding screens fixes
  │
  ├── CHECKPOINT C: All screens complete ─────────────────
  │
Phase 6: Cross-Cutting Concerns
  │  ├─ 6.1 lineHeight fixes (specific file list)
  │  ├─ 6.2 letterSpacing token compliance
  │  ├─ 6.3 Reanimated migration — remaining hooks
  │  ├─ 6.4 Haptic feedback audit
  │  └─ 6.5 ErrorBoundary wrapping at navigation root
  │
  ├── CHECKPOINT D: Cross-cutting complete ───────────────
  │
Phase 7: Final Validation & Monitoring
       ├─ 7.1 Full regression test run
       ├─ 7.2 Visual snapshot review
       └─ 7.3 Monitoring instrumentation
```

---

## Phase 1: Design Tokens & Foundation

> Goal: Ensure the token system is complete, consistent, and WCAG-compliant before any component touches it.

- [x] 1.1 Audit and consolidate design tokens
  - [x] 1.1.1 Verify all token categories export from `app/theme/tokens.ts`: `colors`, `spacing`, `typography`, `radius`, `shadows`, `springs`, `opacityScale`, `motion`, `letterSpacing`, `elevation`, `glowShadow`, `theme`
  - [x] 1.1.2 Add any missing semantic color aliases (e.g., `colors.error`, `colors.warning`, `colors.success`) if not present
  - [x] 1.1.3 Ensure `spacing` scale covers 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 — add missing stops
  - [x] 1.1.4 Ensure `radius` scale covers `none(0)`, `sm(4)`, `md(8)`, `lg(12)`, `xl(16)`, `full(9999)`
  - [x] 1.1.5 Ensure `typography` presets include `lineHeight` for every `fontSize` entry (ratio ≥ 1.3)
  - [x] 1.1.6 Ensure `letterSpacing` tokens exist for `tight(-0.5)`, `normal(0)`, `wide(0.5)`, `wider(1)`
  - [x] 1.1.7 Consolidate any hardcoded color/spacing values found in shared components into token references (scan `app/components/common/*.tsx`)
  _Files: `app/theme/tokens.ts`, `app/components/common/*.tsx`_
  _Requirements: 1.1, 2.1, 3.1, 10.1–10.5_
  _Risk: Changing token values may shift existing UI_
  _Mitigation: Only ADD missing tokens; do not change existing values. Existing references remain stable._
  _Rollback: `git checkout app/theme/tokens.ts`_

- [x] 1.2 WCAG contrast property tests
  - [x] 1.2.1 Create `app/__tests__/tokens/contrastCompliance.test.ts`
  - [x] 1.2.2 Property: for every `(foreground, background)` pair in the theme's text/surface combinations, WCAG 2.1 AA contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text
  - [x] 1.2.3 Property: for every interactive element color against its background, contrast ratio ≥ 3:1
  - [x] 1.2.4 Use `fast-check` `fc.constantFrom(...)` over all color token pairs
  _Files: `app/__tests__/tokens/contrastCompliance.test.ts`_
  _Requirements: 1.2, 11.1_
  _Risk: Tests may reveal existing contrast failures_
  _Mitigation: Log failures as known issues; fix in 1.1 if trivial, else file follow-up ticket_
  _Rollback: Delete test file_

- [x] 1.3 Token compliance snapshot
  - [x] 1.3.1 Create `app/__tests__/tokens/tokenSnapshot.test.ts` — snapshot test that exports all token keys and values
  - [x] 1.3.2 This catches unintended token changes in future PRs
  _Files: `app/__tests__/tokens/tokenSnapshot.test.ts`_
  _Requirements: 1.1_
  _Risk: Snapshot may be brittle if tokens change frequently_
  _Mitigation: Use key-only snapshot (not values) for shape stability; value snapshot for regression_
  _Rollback: Delete test file_

---

### ✅ Phase 1 Gate
- `npx jest --config jest.config.js app/__tests__/tokens/` passes
- No new lint errors in `app/theme/tokens.ts`
- Token file exports all 12 categories listed in 1.1.1

---

## Phase 2: Animation Infrastructure

> Goal: Ensure all animations respect reduce-motion, use shared spring configs, and have named duration constants.

- [x] 2.1 Reduce-motion hook audit
  - [x] 2.1.1 Verify `app/hooks/useReduceMotion.ts` exists and returns `AccessibilityInfo.isReduceMotionEnabled()` (or Reanimated's `useReducedMotion`)
  - [x] 2.1.2 Audit every animation hook for reduce-motion gating. Files to check:
    - `app/hooks/useStaggeredEntrance.ts`
    - `app/hooks/useFadeIn.ts` (if exists)
    - `app/hooks/useSlideIn.ts` (if exists)
    - `app/components/common/ProgressRing.tsx` (animated ring)
    - `app/components/premium/PRBanner.tsx` (spring animation)
    - `app/components/training/RestTimer.tsx` (countdown animation)
    - `app/components/charts/TrendLineChart.tsx` (chart entrance)
    - `app/components/dashboard/DateScroller.tsx` (scroll animation)
  - [x] 2.1.3 For each file: if `reduceMotion` is true, animation `duration` must be `0` or animation must be skipped entirely. Add gating where missing.
  - [x] 2.1.4 Verify `useStaggeredEntrance.ts` uses `STATIC_STYLE` constant when reduce-motion is active (already implemented — confirm, don't duplicate)
  _Files: `app/hooks/useReduceMotion.ts`, `app/hooks/useStaggeredEntrance.ts`, all files listed in 2.1.2_
  _Requirements: 2.1, 2.2, 5.1–5.4_
  _Risk: Disabling animations may cause layout jumps if components depend on animated values for positioning_
  _Mitigation: When reduce-motion is true, set animated values to their FINAL state (not 0), so layout is stable_
  _Rollback: `git checkout` on each modified hook file_

- [x] 2.2 Reduce-motion property tests
  - [x] 2.2.1 Create `app/__tests__/animation/reduceMotion.test.ts`
  - [x] 2.2.2 Property: for every animation hook, when `reduceMotion=true`, the returned style has `duration: 0` or `opacity: 1` (final state)
  - [x] 2.2.3 Property: for every animation hook, when `reduceMotion=false`, the returned style has `duration > 0`
  - [x] 2.2.4 Use `fast-check` `fc.boolean()` for reduce-motion flag, `fc.constantFrom(...)` over hook names
  _Files: `app/__tests__/animation/reduceMotion.test.ts`_
  _Requirements: 2.1, 2.2_
  _Risk: Mocking Reanimated in Jest can be fragile_
  _Mitigation: Use Reanimated's official Jest mock setup (`jest-setup.js` with `setUpTests()`)_
  _Rollback: Delete test file_

- [x] 2.3 Spring config consolidation
  - [x] 2.3.1 Audit all spring configs across the codebase. Known locations:
    - `app/theme/tokens.ts` → `springs.gentle`, `springs.snappy` (etc.)
    - `app/components/premium/PRBanner.tsx` → inline `{damping: 12, stiffness: 200}`
    - `app/components/common/ProgressRing.tsx` → `springs.gentle`
    - Any other inline `{damping, stiffness, mass}` objects
  - [x] 2.3.2 Replace every inline spring config with a reference to `springs.*` from tokens
  - [x] 2.3.3 If PRBanner's `{damping:12, stiffness:200}` doesn't match any existing spring preset, add `springs.banner` to tokens
  _Files: `app/theme/tokens.ts`, `app/components/premium/PRBanner.tsx`, any file with inline spring configs_
  _Requirements: 5.3, 5.4_
  _Risk: Changing spring params alters animation feel_
  _Mitigation: Match the new token value exactly to the existing inline value — no behavioral change_
  _Rollback: `git checkout` on modified files_

- [x] 2.4 Duration constant extraction
  - [x] 2.4.1 Scan for hardcoded duration values (e.g., `300`, `200`, `150` in animation calls)
  - [x] 2.4.2 Add named constants to `app/theme/tokens.ts` → `motion.duration.fast(150)`, `motion.duration.normal(300)`, `motion.duration.slow(500)` if not already present
  - [x] 2.4.3 Replace hardcoded durations with token references
  _Files: `app/theme/tokens.ts`, files found in scan_
  _Requirements: 5.2_
  _Risk: Changing duration values alters animation timing_
  _Mitigation: Match constants exactly to existing hardcoded values_
  _Rollback: `git checkout` on modified files_

---

### ✅ Phase 2 Gate
- `npx jest --config jest.config.js app/__tests__/animation/` passes
- No inline spring configs remain (grep: `damping.*stiffness` returns only `tokens.ts`)
- No hardcoded duration numbers in animation calls (grep: `duration:\s*\d+` returns only `tokens.ts`)

---

## Phase 3: Shared Components

> Goal: Fix/enhance shared components that screens depend on. Must complete before screen-level work.

- [x] 3.1 Enhance ErrorBoundary with configurable fallback
  - [x] 3.1.1 In `app/components/common/ErrorBoundary.tsx`: add an optional `fallback` render prop of type `(error: Error, retry: () => void) => ReactNode`
  - [x] 3.1.2 If `fallback` prop is provided, render it instead of the hardcoded fallback UI
  - [x] 3.1.3 If `fallback` prop is NOT provided, keep existing hardcoded fallback (backward compatible)
  - [x] 3.1.4 Add `onError?: (error: Error, errorInfo: ErrorInfo) => void` callback prop for error reporting
  - [x] 3.1.5 Ensure retry mechanism (state reset) still works with custom fallback
  _Files: `app/components/common/ErrorBoundary.tsx`_
  _Requirements: 4.1, 17.1_
  _Risk: Changing class component props may break existing usage_
  _Mitigation: All new props are optional — zero breaking changes. Existing callsites unchanged._
  _Rollback: `git checkout app/components/common/ErrorBoundary.tsx`_

- [x] 3.2 Create ErrorBanner component
  - [x] 3.2.1 Create `app/components/common/ErrorBanner.tsx`
  - [x] 3.2.2 Props: `message: string`, `onRetry?: () => void`, `onDismiss?: () => void`, `variant?: 'error' | 'warning' | 'info'`
  - [x] 3.2.3 Use `colors.error` / `colors.warning` / `colors.info` from tokens for background tint
  - [x] 3.2.4 Use `spacing.md(12)` padding, `radius.md(8)` border radius
  - [x] 3.2.5 Include retry button (if `onRetry` provided) and dismiss X (if `onDismiss` provided)
  - [x] 3.2.6 Animate entrance with `useFadeIn` or equivalent, gated by reduce-motion
  - [x] 3.2.7 Accessibility: `accessibilityRole="alert"`, `accessibilityLiveRegion="assertive"`
  _Files: `app/components/common/ErrorBanner.tsx`_
  _Requirements: 4.2, 15.1, 16.1_
  _Risk: New component — no existing code to break_
  _Mitigation: N/A — additive only_
  _Rollback: Delete `app/components/common/ErrorBanner.tsx`_

- [x] 3.3 ErrorBoundary property tests
  - [x] 3.3.1 Create `app/__tests__/components/ErrorBoundary.test.ts`
  - [x] 3.3.2 Property: for any error thrown by a child, ErrorBoundary catches it and renders fallback (never crashes parent)
  - [x] 3.3.3 Property: after retry (state reset), if child no longer throws, normal UI renders
  - [x] 3.3.4 Property: custom `fallback` render prop receives the correct `error` object and a working `retry` function
  - [x] 3.3.5 Property: `onError` callback is invoked with `(error, errorInfo)` when an error is caught
  - [x] 3.3.6 Use `fast-check` `fc.string()` for error messages, `fc.boolean()` for whether custom fallback is provided
  _Files: `app/__tests__/components/ErrorBoundary.test.ts`_
  _Requirements: 4.1, 4.3_
  _Risk: Testing class component error boundaries in Jest requires careful setup_
  _Mitigation: Use `react-test-renderer` or `@testing-library/react-native` with error boundary test patterns_
  _Rollback: Delete test file_

- [x] 3.4 ProgressRing token + reduce-motion fixes
  - [x] 3.4.1 In `app/components/common/ProgressRing.tsx`: replace any hardcoded colors with `colors.*` tokens
  - [x] 3.4.2 Replace any hardcoded spacing/sizing with `spacing.*` tokens
  - [x] 3.4.3 Ensure `withSpring` call uses `springs.gentle` from tokens (verify — may already be correct)
  - [x] 3.4.4 Add reduce-motion gating: if reduce-motion enabled, set animated progress value directly (no spring)
  - [x] 3.4.5 Verify `accessibilityRole="progressbar"` and `accessibilityValue` are set
  _Files: `app/components/common/ProgressRing.tsx`, `app/utils/progressRingLogic.ts`_
  _Requirements: 6.1, 6.2, 2.1_
  _Risk: Changing ProgressRing animation may cause visual regression_
  _Mitigation: Only change the reduce-motion path; normal path unchanged_
  _Rollback: `git checkout app/components/common/ProgressRing.tsx`_

- [x] 3.5 Card / EmptyState / Button token compliance
  - [x] 3.5.1 `app/components/common/Card.tsx`: replace hardcoded `borderRadius`, `padding`, `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation` with `radius.*`, `spacing.*`, `shadows.*` / `elevation.*` tokens
  - [x] 3.5.2 `app/components/common/EmptyState.tsx`: replace hardcoded colors, spacing, font sizes with tokens. Ensure illustration has `accessibilityLabel`.
  - [x] 3.5.3 `app/components/common/Button.tsx`: replace hardcoded `borderRadius`, `paddingHorizontal`, `paddingVertical`, colors with tokens. Ensure `accessibilityRole="button"` and `accessibilityState={{disabled}}` when disabled.
  - [x] 3.5.4 `app/components/common/EditableField.tsx`: replace hardcoded styles with tokens
  - [x] 3.5.5 `app/components/common/ModalContainer.tsx`: replace hardcoded overlay opacity, border radius, padding with tokens (`opacityScale.*`, `radius.*`, `spacing.*`)
  _Files: `app/components/common/Card.tsx`, `app/components/common/EmptyState.tsx`, `app/components/common/Button.tsx`, `app/components/common/EditableField.tsx`, `app/components/common/ModalContainer.tsx`_
  _Requirements: 4.5–4.10, 10.1–10.5, 11.1_
  _Risk: Changing shared component styles affects every screen_
  _Mitigation: Token values match existing hardcoded values — visual output identical. Run snapshot tests if they exist._
  _Rollback: `git checkout app/components/common/`_

- [x] 3.6 PRBanner Reanimated migration
  - [x] 3.6.1 In `app/components/premium/PRBanner.tsx`: replace `import { Animated } from 'react-native'` with `import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated'`
  - [x] 3.6.2 Convert `Animated.spring` call to Reanimated `withSpring` using `springs.banner` token (from 2.3.3)
  - [x] 3.6.3 Convert `Animated.View` to Reanimated `Animated.View`
  - [x] 3.6.4 Add reduce-motion gating
  - [x] 3.6.5 Verify banner still renders correctly (manual or snapshot test)
  _Files: `app/components/premium/PRBanner.tsx`_
  _Requirements: 7.1, 5.1_
  _Risk: Reanimated migration may break if component uses RN Animated APIs not available in Reanimated_
  _Mitigation: Test in isolation first. PRBanner is a simple spring — low complexity migration._
  _Rollback: `git checkout app/components/premium/PRBanner.tsx`_

---

### ✅ CHECKPOINT A: Foundation Complete
**Gate criteria — ALL must pass:**
- [ ] `npx jest --config jest.config.js` — all existing tests still pass (compare to baseline from 0.1.5)
- [ ] `npx jest --config jest.config.js app/__tests__/tokens/` — all token tests pass
- [ ] `npx jest --config jest.config.js app/__tests__/animation/` — all animation tests pass
- [ ] `npx jest --config jest.config.js app/__tests__/components/ErrorBoundary.test.ts` — passes
- [ ] `grep -r "damping.*stiffness" app/ --include="*.tsx" --include="*.ts" | grep -v tokens | grep -v node_modules | grep -v __tests__` — returns 0 results
- [ ] `ErrorBanner.tsx` exists and exports correctly
- [ ] No TypeScript errors: `npx tsc --noEmit` from `app/` (or equivalent)

**If gate fails:** Do NOT proceed to Phase 4. Fix failing items first.

---

## Phase 4: Screen-Level Fixes — Batch 1 (Core Screens)

> Goal: Fix token compliance, spacing, typography, accessibility, and error states on the 5 most-used screens.
> All tasks in this phase are independent of each other and CAN run in parallel.

- [x] 4.1 DashboardScreen fixes
  - [x] 4.1.1 `app/screens/dashboard/DashboardScreen.tsx`: replace all hardcoded `color`, `fontSize`, `fontWeight`, `marginTop/Bottom/Left/Right`, `padding*`, `borderRadius` with token references
  - [x] 4.1.2 `app/components/dashboard/MacroRingsRow.tsx`: replace hardcoded styles with tokens; ensure ProgressRing usage passes `accessibilityValue`
  - [x] 4.1.3 `app/components/dashboard/DateScroller.tsx`: replace hardcoded styles with tokens; add reduce-motion gating to scroll animation
  - [x] 4.1.4 Add `ErrorBanner` import and render in error state (when data fetch fails)
  - [x] 4.1.5 Ensure all `Text` components have `lineHeight` set (via typography tokens)
  - [x] 4.1.6 Ensure all touchable elements have minimum 44x44pt hit area
  _Files: `app/screens/dashboard/DashboardScreen.tsx`, `app/components/dashboard/MacroRingsRow.tsx`, `app/components/dashboard/DateScroller.tsx`_
  _Requirements: 8.1–8.5, 10.1, 11.1, 15.1, 22.1_
  _Risk: Dashboard is highest-traffic screen — visual regression is high impact_
  _Mitigation: Token values match existing hardcoded values. Run existing DashboardScreen tests after changes._
  _Rollback: `git checkout app/screens/dashboard/ app/components/dashboard/`_

- [x] 4.2 LogsScreen fixes
  - [x] 4.2.1 `app/screens/logs/LogsScreen.tsx`: replace hardcoded styles with tokens
  - [x] 4.2.2 Add `ErrorBanner` for error states
  - [x] 4.2.3 Ensure `lineHeight` on all `Text` components
  - [x] 4.2.4 Ensure minimum 44x44pt touch targets
  - [x] 4.2.5 Verify `EmptyState` usage has `accessibilityLabel` on illustration
  _Files: `app/screens/logs/LogsScreen.tsx`_
  _Requirements: 9.1–9.3, 10.1, 11.1, 15.1, 22.1_
  _Risk: Low — LogsScreen is simpler than Dashboard_
  _Mitigation: Token swap only_
  _Rollback: `git checkout app/screens/logs/LogsScreen.tsx`_

- [x] 4.3 AnalyticsScreen fixes
  - [x] 4.3.1 `app/screens/analytics/AnalyticsScreen.tsx`: replace hardcoded styles with tokens
  - [x] 4.3.2 `app/components/analytics/ExpenditureTrendCard.tsx`: replace hardcoded styles with tokens
  - [x] 4.3.3 `app/components/charts/TrendLineChart.tsx`: add reduce-motion gating to chart entrance animation; replace hardcoded styles
  - [x] 4.3.4 Add `ErrorBanner` for error states
  - [x] 4.3.5 Ensure `lineHeight` and `letterSpacing` on all `Text` components
  _Files: `app/screens/analytics/AnalyticsScreen.tsx`, `app/components/analytics/ExpenditureTrendCard.tsx`, `app/components/charts/TrendLineChart.tsx`_
  _Requirements: 12.1–12.4, 10.1, 11.1, 22.1_
  _Risk: Chart animations are complex — reduce-motion gating must not break chart rendering_
  _Mitigation: When reduce-motion, render chart at final state (all data points visible, no entrance animation)_
  _Rollback: `git checkout app/screens/analytics/ app/components/analytics/ app/components/charts/`_

- [x] 4.4 NutritionReportScreen fixes
  - [x] 4.4.1 `app/screens/nutrition/NutritionReportScreen.tsx`: replace hardcoded styles with tokens
  - [x] 4.4.2 `app/components/nutrition/BudgetBar.tsx`: replace hardcoded styles with tokens
  - [x] 4.4.3 `app/components/nutrition/CopyMealsBar.tsx`: replace hardcoded styles with tokens
  - [x] 4.4.4 `app/components/nutrition/WaterTracker.tsx`: replace hardcoded styles with tokens
  - [x] 4.4.5 Add `ErrorBanner` for error states
  - [x] 4.4.6 Ensure `lineHeight` on all `Text` components
  _Files: `app/screens/nutrition/NutritionReportScreen.tsx`, `app/components/nutrition/BudgetBar.tsx`, `app/components/nutrition/CopyMealsBar.tsx`, `app/components/nutrition/WaterTracker.tsx`_
  _Requirements: 13.1–13.3, 10.1, 11.1, 22.1_
  _Risk: Nutrition components are data-dense — spacing changes may cause overflow_
  _Mitigation: Use `flexShrink` and `numberOfLines` where text may overflow after spacing changes_
  _Rollback: `git checkout app/screens/nutrition/ app/components/nutrition/`_

- [x] 4.5 ProfileScreen fixes
  - [x] 4.5.1 `app/screens/profile/ProfileScreen.tsx`: replace hardcoded styles with tokens
  - [x] 4.5.2 `app/components/profile/AccountSection.tsx`: replace hardcoded styles with tokens
  - [x] 4.5.3 `app/components/profile/PreferencesSection.tsx`: replace hardcoded styles with tokens
  - [x] 4.5.4 `app/components/profile/GoalsSection.tsx`: replace hardcoded styles with tokens
  - [x] 4.5.5 `app/components/profile/BodyStatsSection.tsx`: replace hardcoded styles with tokens
  - [x] 4.5.6 `app/screens/profile/ProgressPhotosScreen.tsx`: replace hardcoded styles with tokens
  - [x] 4.5.7 `app/components/photos/PhotoComparison.tsx`: replace hardcoded styles with tokens
  - [x] 4.5.8 Add `ErrorBanner` for error states where data loading occurs
  - [x] 4.5.9 Ensure `lineHeight` on all `Text` components
  _Files: `app/screens/profile/ProfileScreen.tsx`, `app/components/profile/*.tsx`, `app/screens/profile/ProgressPhotosScreen.tsx`, `app/components/photos/PhotoComparison.tsx`_
  _Requirements: 14.1–14.5, 10.1, 11.1, 22.1_
  _Risk: Profile has many sub-sections — easy to miss a hardcoded value_
  _Mitigation: Use grep to verify no hardcoded color hex values remain after changes_
  _Rollback: `git checkout app/screens/profile/ app/components/profile/ app/components/photos/`_

---

### ✅ CHECKPOINT B: Core Screens Complete
**Gate criteria — ALL must pass:**
- [ ] `npx jest --config jest.config.js` — all tests pass (including new + existing)
- [ ] `grep -rn "color:\s*['\"]#" app/screens/dashboard/ app/screens/logs/ app/screens/analytics/ app/screens/nutrition/ app/screens/profile/ --include="*.tsx"` — returns 0 results (no hardcoded hex colors)
- [ ] Each of the 5 screens imports and renders `ErrorBanner` in at least one error path
- [ ] No TypeScript errors

**If gate fails:** Fix before proceeding to Phase 5.

---

## Phase 5: Screen-Level Fixes — Batch 2 (Secondary Screens)

> Goal: Apply the same token compliance, accessibility, and error state fixes to remaining screens.
> All tasks in this phase are independent of each other and CAN run in parallel.

- [x] 5.1 LearnScreen + ArticleDetailScreen fixes
  - [x] 5.1.1 `app/screens/learn/LearnScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.1.2 `app/screens/learn/ArticleDetailScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.1.3 Add `ErrorBanner` for error states (article load failure)
  - [x] 5.1.4 Ensure `lineHeight` on all `Text` components
  - [x] 5.1.5 Ensure minimum 44x44pt touch targets on article cards
  _Files: `app/screens/learn/LearnScreen.tsx`, `app/screens/learn/ArticleDetailScreen.tsx`_
  _Requirements: 18.1–18.3, 10.1, 11.1, 22.1_
  _Risk: Low — content screens with simple layouts_
  _Mitigation: Token swap only_
  _Rollback: `git checkout app/screens/learn/`_

- [x] 5.2 CommunityScreen fixes
  - [x] 5.2.1 `app/screens/community/CommunityScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.2.2 Add `ErrorBanner` for error states
  - [x] 5.2.3 Ensure `lineHeight` on all `Text` components
  - [x] 5.2.4 Ensure minimum 44x44pt touch targets
  _Files: `app/screens/community/CommunityScreen.tsx`_
  _Requirements: 19.1–19.2, 10.1, 11.1, 22.1_
  _Risk: Low_
  _Mitigation: Token swap only_
  _Rollback: `git checkout app/screens/community/CommunityScreen.tsx`_

- [x] 5.3 CoachingScreen fixes
  - [x] 5.3.1 `app/screens/coaching/CoachingScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.3.2 `app/components/coaching/CoachingModeSelector.tsx`: replace hardcoded styles with tokens
  - [x] 5.3.3 `app/components/coaching/WeeklyCheckinCard.tsx`: replace hardcoded styles with tokens
  - [x] 5.3.4 Add `ErrorBanner` for error states
  - [x] 5.3.5 Ensure `lineHeight` on all `Text` components
  _Files: `app/screens/coaching/CoachingScreen.tsx`, `app/components/coaching/CoachingModeSelector.tsx`, `app/components/coaching/WeeklyCheckinCard.tsx`_
  _Requirements: 20.1–20.3, 10.1, 11.1, 22.1_
  _Risk: Low_
  _Mitigation: Token swap only_
  _Rollback: `git checkout app/screens/coaching/ app/components/coaching/`_

- [x] 5.4 HealthReportsScreen fixes
  - [x] 5.4.1 `app/screens/health/HealthReportsScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.4.2 Add `ErrorBanner` for error states
  - [x] 5.4.3 Ensure `lineHeight` on all `Text` components
  _Files: `app/screens/health/HealthReportsScreen.tsx`_
  _Requirements: 21.1–21.2, 10.1, 11.1, 22.1_
  _Risk: Low_
  _Mitigation: Token swap only_
  _Rollback: `git checkout app/screens/health/HealthReportsScreen.tsx`_

- [x] 5.5 FounderStoryScreen fixes
  - [x] 5.5.1 `app/screens/founder/FounderStoryScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.5.2 Ensure `lineHeight` on all `Text` components
  - [x] 5.5.3 Ensure images have `accessibilityLabel`
  _Files: `app/screens/founder/FounderStoryScreen.tsx`_
  _Requirements: 23.1, 10.1, 11.1, 22.1_
  _Risk: Low — static content screen_
  _Mitigation: Token swap only_
  _Rollback: `git checkout app/screens/founder/FounderStoryScreen.tsx`_

- [x] 5.6 Auth screens fixes
  - [x] 5.6.1 `app/screens/auth/LoginScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.6.2 `app/screens/auth/RegisterScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.6.3 Ensure form inputs have `accessibilityLabel` and `accessibilityHint`
  - [x] 5.6.4 Ensure error messages use `ErrorBanner` component
  - [x] 5.6.5 Ensure `lineHeight` on all `Text` components
  - [x] 5.6.6 Ensure minimum 44x44pt touch targets on buttons and links
  _Files: `app/screens/auth/LoginScreen.tsx`, `app/screens/auth/RegisterScreen.tsx`_
  _Requirements: 16.1–16.3, 10.1, 11.1, 22.1_
  _Risk: Auth screens are critical path — visual regression blocks sign-up_
  _Mitigation: Token values match existing values. Test login flow manually after changes._
  _Rollback: `git checkout app/screens/auth/`_

- [x] 5.7 Onboarding screens fixes
  - [x] 5.7.1 `app/screens/onboarding/OnboardingScreen.tsx`: replace hardcoded styles with tokens
  - [x] 5.7.2 `app/screens/onboarding/steps/BodyBasicsStep.tsx`: replace hardcoded styles with tokens
  - [x] 5.7.3 `app/screens/onboarding/steps/BodyMeasurementsStep.tsx`: replace hardcoded styles with tokens
  - [x] 5.7.4 `app/screens/onboarding/steps/DietStyleStep.tsx`: replace hardcoded styles with tokens
  - [x] 5.7.5 `app/screens/onboarding/steps/IntentStep.tsx`: replace hardcoded styles with tokens
  - [x] 5.7.6 `app/screens/onboarding/steps/LifestyleStep.tsx`: replace hardcoded styles with tokens
  - [x] 5.7.7 `app/screens/onboarding/steps/TDEERevealStep.tsx`: replace hardcoded styles with tokens; add reduce-motion gating to reveal animation
  - [x] 5.7.8 Ensure `lineHeight` on all `Text` components across all steps
  - [x] 5.7.9 Ensure minimum 44x44pt touch targets on all step navigation buttons
  _Files: `app/screens/onboarding/OnboardingScreen.tsx`, `app/screens/onboarding/steps/*.tsx`_
  _Requirements: 17.1–17.5, 10.1, 11.1, 22.1_
  _Risk: Onboarding is critical for new user conversion — visual regression is high impact_
  _Mitigation: Token values match existing values. Run existing onboarding tests after changes._
  _Rollback: `git checkout app/screens/onboarding/`_

---

### ✅ CHECKPOINT C: All Screens Complete
**Gate criteria — ALL must pass:**
- [ ] `npx jest --config jest.config.js` — all tests pass
- [ ] `grep -rn "color:\s*['\"]#" app/screens/ --include="*.tsx"` — returns 0 results (no hardcoded hex colors in any screen)
- [ ] `grep -rn "fontSize:\s*\d" app/screens/ --include="*.tsx"` — returns 0 results (all font sizes via tokens)
- [ ] Every screen file imports from `app/theme/tokens` (or a re-export)
- [ ] No TypeScript errors

**If gate fails:** Fix before proceeding to Phase 6.

---

## Phase 6: Cross-Cutting Concerns

> Goal: Address issues that span multiple files — lineHeight, letterSpacing, remaining Reanimated migrations, haptics, and ErrorBoundary wrapping.

- [x] 6.1 lineHeight fixes — specific file list
  > Every `Text` component must have `lineHeight` set via typography tokens. This task catches any files missed in Phases 4-5.
  - [x] 6.1.1 Run: `grep -rn "fontSize" app/components/ app/screens/ --include="*.tsx" -l` to get full file list
  - [x] 6.1.2 For each file: ensure every `fontSize` usage is paired with a `lineHeight` (ratio ≥ 1.3x). Known files requiring attention:
    - `app/components/premium/UpgradeModal.tsx`
    - `app/components/premium/UpgradeBanner.tsx`
    - `app/components/premium/PremiumBadge.tsx`
    - `app/components/modals/AddTrainingModal.tsx`
    - `app/components/modals/AddNutritionModal.tsx`
    - `app/components/modals/AddBodyweightModal.tsx`
    - `app/components/modals/QuickAddModal.tsx`
    - `app/components/training/RestTimer.tsx`
    - `app/components/exercise-picker/ExerciseCard.tsx`
    - `app/components/exercise-picker/MuscleGroupGrid.tsx`
    - `app/components/exercise-picker/MuscleGroupIcon.tsx`
    - `app/screens/exercise-picker/ExercisePickerScreen.tsx`
    - `app/screens/nutrition/RecipeBuilderScreen.tsx`
  - [x] 6.1.3 Replace raw `fontSize` + `lineHeight` pairs with typography preset references where possible
  _Files: All files listed in 6.1.2 plus any found by grep in 6.1.1_
  _Requirements: 22.1–22.3_
  _Risk: Changing lineHeight may cause text to overflow containers_
  _Mitigation: Use `numberOfLines` + `ellipsizeMode` where containers have fixed height. Test on small screen (iPhone SE) dimensions._
  _Rollback: `git checkout` on modified files_

- [x] 6.2 letterSpacing token compliance
  - [x] 6.2.1 Run: `grep -rn "letterSpacing" app/components/ app/screens/ --include="*.tsx" -l` to find all files using letterSpacing
  - [x] 6.2.2 Replace any hardcoded `letterSpacing` numeric values with `letterSpacing.*` token references
  - [x] 6.2.3 Add `letterSpacing.wide` to section headers and `letterSpacing.tight` to large display numbers where appropriate
  _Files: Files found by grep_
  _Requirements: 22.2, 10.1_
  _Risk: Low — letterSpacing changes are subtle_
  _Mitigation: Token values match existing hardcoded values_
  _Rollback: `git checkout` on modified files_

- [x] 6.3 Reanimated migration — remaining hooks and components
  > PRBanner was migrated in 3.6. This task covers remaining RN Animated → Reanimated migrations.
  - [x] 6.3.1 Run: `grep -rn "from 'react-native'" app/hooks/ app/components/ --include="*.ts" --include="*.tsx" | grep "Animated"` to find remaining RN Animated imports
  - [x] 6.3.2 For each file found: migrate `Animated.*` to Reanimated equivalents
  - [x] 6.3.3 Known candidates:
    - `app/hooks/useStaggeredEntrance.ts` — verify already uses Reanimated (may already be correct)
    - `app/components/training/RestTimer.tsx` — migrate countdown animation
    - `app/components/charts/TrendLineChart.tsx` — migrate chart entrance
    - `app/components/dashboard/DateScroller.tsx` — migrate scroll animation (if not already Reanimated)
  - [x] 6.3.4 For each migration: add reduce-motion gating if not already present
  - [x] 6.3.5 For each migration: use spring tokens from `springs.*` instead of inline configs
  _Files: Files found by grep + known candidates_
  _Requirements: 7.1–7.8_
  _Risk: Reanimated migration can break animations if API differences are missed (e.g., `Animated.event` vs `useAnimatedScrollHandler`)_
  _Mitigation: Migrate one file at a time. Test each file individually before moving to next. Keep git commits per-file for easy revert._
  _Rollback: `git checkout` on the specific file that broke. Each migration is independent._

- [x] 6.4 Haptic feedback audit
  - [x] 6.4.1 Identify all user interactions that should have haptic feedback:
    - Button presses (primary actions): `app/components/common/Button.tsx`
    - Tab switches: `app/navigation/BottomTabNavigator.tsx`
    - Modal open/close: `app/components/common/ModalContainer.tsx`
    - Workout completion: `app/components/training/RestTimer.tsx` (timer end)
    - PR achievement: (if applicable)
  - [x] 6.4.2 Add `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` (or equivalent) to each interaction
  - [x] 6.4.3 Gate haptics behind a `useHaptics()` hook that checks user preference and platform support
  - [x] 6.4.4 Ensure haptics are NOT triggered during reduce-motion mode
  _Files: `app/hooks/useHaptics.ts` (create), files listed in 6.4.1_
  _Requirements: 13.4 (partial), 6.3_
  _Risk: Haptics on every button press may feel excessive_
  _Mitigation: Use `Light` impact for most interactions, `Medium` only for significant events (workout complete, PR). User can disable via preference._
  _Rollback: `git checkout` on modified files + delete `app/hooks/useHaptics.ts`_

- [x] 6.5 ErrorBoundary wrapping at navigation root
  - [x] 6.5.1 In `app/App.tsx`: verify ErrorBoundary wraps the navigation container (root level)
  - [x] 6.5.2 If not present: add `<ErrorBoundary onError={reportToAnalytics}>` around the root navigator
  - [x] 6.5.3 In `app/navigation/BottomTabNavigator.tsx`: wrap each tab screen in an ErrorBoundary with tab-specific fallback
  - [x] 6.5.4 Ensure the `onError` callback logs to analytics (or console.error as placeholder)
  _Files: `app/App.tsx`, `app/navigation/BottomTabNavigator.tsx`_
  _Requirements: 17.1, 4.1_
  _Risk: ErrorBoundary at root may catch errors that should propagate (e.g., auth errors)_
  _Mitigation: Use `onError` callback to distinguish error types. Auth errors should be handled by auth flow, not ErrorBoundary._
  _Rollback: `git checkout app/App.tsx app/navigation/BottomTabNavigator.tsx`_

---

### ✅ CHECKPOINT D: Cross-Cutting Complete
**Gate criteria — ALL must pass:**
- [ ] `npx jest --config jest.config.js` — all tests pass
- [ ] `grep -rn "from 'react-native'" app/hooks/ app/components/ --include="*.ts" --include="*.tsx" | grep "Animated"` — returns 0 results (all Animated migrated to Reanimated)
- [ ] `grep -rn "letterSpacing:\s*[-]?\d" app/components/ app/screens/ --include="*.tsx"` — returns 0 results (all letterSpacing via tokens)
- [ ] ErrorBoundary wraps root navigator in `App.tsx`
- [ ] ErrorBoundary wraps each tab in `BottomTabNavigator.tsx`
- [ ] No TypeScript errors

**If gate fails:** Fix before proceeding to Phase 7.

---

## Phase 7: Final Validation & Monitoring

> Goal: Full regression, visual review, and instrumentation for post-launch observability.

- [x] 7.1 Full regression test run
  - [x] 7.1.1 Run: `cd app && npx jest --config jest.config.js --verbose 2>&1 | tee test-results.txt`
  - [x] 7.1.2 Compare pass/fail counts to baseline from 0.1.5
  - [x] 7.1.3 If any NEW failures: triage and fix before merge
  - [x] 7.1.4 Run: `cd app && npx tsc --noEmit` — must exit 0
  - [x] 7.1.5 Run property tests specifically: `cd app && npx jest --config jest.config.js --testPathPattern="__tests__/(tokens|animation|components/ErrorBoundary)" --verbose`
  _Files: N/A — test execution only_
  _Requirements: All_
  _Risk: Flaky tests may cause false failures_
  _Mitigation: Re-run failed tests in isolation. If flaky, document and exclude from gate (with ticket to fix)._
  _Rollback: N/A — read-only_

- [x] 7.2 Visual snapshot review
  - [x] 7.2.1 If snapshot tests exist: run `npx jest --config jest.config.js -u` to update snapshots, then review diff
  - [x] 7.2.2 If no snapshot tests: manually verify these 5 critical screens on iOS and Android simulators:
    - DashboardScreen
    - LogsScreen
    - ProfileScreen
    - LoginScreen
    - OnboardingScreen (first step)
  - [x] 7.2.3 Document any visual discrepancies as known issues or fix immediately
  _Files: N/A — manual/visual verification_
  _Requirements: All_
  _Risk: Visual regressions may not be caught by unit tests_
  _Mitigation: This task IS the mitigation — explicit visual review step_
  _Rollback: N/A — review only_

- [x] 7.3 Monitoring instrumentation
  - [x] 7.3.1 Add error tracking to ErrorBoundary `onError` callback:
    - Log `error.message`, `error.stack`, `componentStack` from `errorInfo`
    - Include screen name (from navigation state) in error payload
    - Send to analytics service (or `console.error` as placeholder if analytics not yet integrated)
  - [x] 7.3.2 Add performance markers for animation frame drops:
    - In `useStaggeredEntrance`: log if animation takes >500ms (potential jank)
    - In `ProgressRing`: log if spring animation takes >1s to settle
  - [x] 7.3.3 Add token compliance lint rule (optional, for CI):
    - Create `app/.eslintrc.overrides.js` (or equivalent) with custom rule that warns on hardcoded `color: '#...'` in `.tsx` files
    - Or document the grep commands from checkpoints as a CI script
  - [x] 7.3.4 Document post-launch metrics to track:
    - ErrorBoundary catch rate (errors per session)
    - Animation frame drop rate (% of animations with dropped frames)
    - Reduce-motion adoption rate (% of users with reduce-motion enabled)
    - Screen load time (time from navigation to first render)
  _Files: `app/components/common/ErrorBoundary.tsx`, `app/hooks/useStaggeredEntrance.ts`, `app/components/common/ProgressRing.tsx`_
  _Requirements: 25.1 (monitoring)_
  _Risk: Performance logging may itself cause performance issues_
  _Mitigation: Use `__DEV__` guard for verbose logging; production logging is fire-and-forget with no blocking_
  _Rollback: `git checkout` on modified files_

---

### ✅ FINAL GATE: Ready to Merge
**ALL must pass:**
- [ ] Full test suite passes (7.1)
- [ ] No TypeScript errors (7.1.4)
- [ ] All property tests pass (7.1.5)
- [ ] Visual review completed with no P0 regressions (7.2)
- [ ] ErrorBoundary monitoring is active (7.3.1)
- [ ] Zero hardcoded hex colors in screen files
- [ ] Zero hardcoded fontSize in screen files
- [ ] Zero inline spring configs outside tokens.ts
- [ ] Zero RN Animated imports (all migrated to Reanimated)
- [ ] All ErrorBanner integrations render correctly in error states

---

## Deferred to v2

The following items were evaluated and intentionally deferred:

1. **BottomTabNavigator redesign evaluation** (was Task 24.1) — Requires UX research and A/B testing framework. Not a token/polish issue. File ticket for v2 with decision framework: measure tab switch frequency, compare with drawer navigation benchmarks, decide based on data.

2. **Custom ESLint plugin for token enforcement** (7.3.3 is optional placeholder) — Full lint rule requires AST visitor for StyleSheet.create patterns. Defer to v2; grep-based CI check is sufficient for now.

3. **Animated layout transitions between screens** — Requires `react-native-screens` native module configuration and navigation library integration. Out of scope for UI polish pass.

---

## Summary

| Phase | Tasks | Parallel? | Depends On |
|-------|-------|-----------|------------|
| 0 | 1 (env check) | N/A | Nothing |
| 1 | 3 (tokens) | 1.2 + 1.3 parallel after 1.1 | Phase 0 |
| 2 | 4 (animation) | 2.2 after 2.1; 2.3 + 2.4 parallel | Phase 1 |
| 3 | 6 (components) | 3.2 + 3.4 + 3.5 parallel; 3.3 after 3.1; 3.6 after 2.3 | Phase 1 + 2 |
| 4 | 5 (core screens) | ALL parallel | Phase 3 |
| 5 | 7 (secondary screens) | ALL parallel | Phase 3 |
| 6 | 5 (cross-cutting) | 6.1 + 6.2 parallel; 6.3 sequential per-file; 6.4 + 6.5 parallel | Phase 4 + 5 |
| 7 | 3 (validation) | 7.1 first, then 7.2 + 7.3 parallel | Phase 6 |
| **Total** | **34 tasks** | | |
