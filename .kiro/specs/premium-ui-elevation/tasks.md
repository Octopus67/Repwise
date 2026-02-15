# Premium UI Elevation — Revised Execution Plan

## Pre-Execution Audit

Existing infrastructure verified:
- `app/theme/tokens.ts` — colors, spacing, typography, radius, motion, elevation tokens exist. Missing: letterSpacing, RN-format shadows, spring configs, opacity scale.
- `app/hooks/usePressAnimation.ts` — uses `withTiming(0.97, { duration: 100 })`. Hardcoded values, no spring, no opacity change, no reduced-motion check.
- `app/hooks/useStaggeredEntrance.ts` — uses `withDelay` + `withTiming(300ms)`. Web fallback returns static style. Hardcoded 12px translateY, 60ms stagger.
- `app/components/common/Button.tsx` — 4 variants, uses `usePressAnimation`, has `getButtonStyles` exported for testing. No hover state, no letterSpacing, hardcoded shadow values.
- `app/components/common/Card.tsx` — 3 variants, uses `usePressAnimation` + `useStaggeredEntrance`. Single-layer shadow on raised. No hover state.
- 54 test suites, 590 frontend tests. 296 backend tests. All passing.

Key decisions:
1. Token changes are additive — no existing token renamed or removed. Zero breaking risk.
2. Hook upgrades are backward-compatible — existing call sites unchanged.
3. `shadows.glow` must be a function (not `as const`). Export separately as `glowShadow()`.
4. Name opacity tokens `opacityScale` to avoid collision with CSS `opacity` property.
5. Layered shadows in RN: only one shadow per View. Use nested Views only for Card raised + Modal.
6. Cut 8 items from original plan that require native modules or custom navigators (see "What Was Cut").

---

## Task 1: Extend Design Tokens
File: `app/theme/tokens.ts`

- [x] 1. Extend design tokens
  - [x] 1.1 Add `letterSpacing` tokens: tighter (-0.5), tight (-0.25), normal (0), wide (0.5)
  - [x] 1.2 Add `shadows` tokens in RN format: sm, md, lg (plain objects, `as const`)
  - [x] 1.3 Add `glowShadow(color, radius?, opacity?)` helper function (separate export)
  - [x] 1.4 Add `springs` animation configs: gentle, snappy, bouncy
  - [x] 1.5 Add `opacityScale` tokens: disabled (0.4), muted (0.6), subtle (0.08), hover (0.12)
  - [x] 1.6 Add all new exports to `theme` object

Risk: Naming collision with `opacity` CSS property. Mitigation: named `opacityScale`.
Rollback: Revert tokens.ts. No other file depends on new tokens yet.

**CHECKPOINT 1**: `npx jest --no-coverage` passes. `getDiagnostics` on tokens.ts — 0 errors.

---

## Task 2: Upgrade `usePressAnimation` Hook
File: `app/hooks/usePressAnimation.ts`

Depends on: Task 1 (springs token).

- [x] 2. Upgrade press animation hook
  - [x] 2.1 Import `springs` from tokens. Replace `withTiming(0.97, 100)` with `withSpring(0.97, springs.snappy)`
  - [x] 2.2 Add opacity animation: 0.9 on press, 1.0 on release
  - [x] 2.3 Add `useReducedMotion` check — skip animation if enabled (try/catch for older Reanimated)
  - [x] 2.4 Return same API: `{ animatedStyle, onPressIn, onPressOut }`

Risk: `useReducedMotion` may not exist in current Reanimated version. Mitigation: wrap in try/catch, default false.
Risk: Adding opacity to animatedStyle could conflict with components setting static opacity. Mitigation: only change during press (0.9→1.0), no conflict with static values.
Rollback: Revert hook file. Components fall back to no animation.

**CHECKPOINT 2**: `npx jest --no-coverage` passes. Manually verify Button press on web.

---

## Task 3: Create `useHoverState` Hook
File: `app/hooks/useHoverState.ts` (new)

- [x] 3. Create hover state hook for web
  - [x] 3.1 Returns `{ isHovered: boolean, hoverProps: object }`
  - [x] 3.2 Web: `onMouseEnter`/`onMouseLeave` handlers. Native: empty object (no-op)
  - [x] 3.3 Uses `useState` + `useMemo` for stable props reference

Risk: None — new file, no existing dependencies.
Rollback: Delete file.

**CHECKPOINT 3**: `npx jest --no-coverage` passes. `getDiagnostics` on new file — 0 errors.

---

## Task 4: Button Elevation
File: `app/components/common/Button.tsx`

Depends on: Tasks 1, 2, 3.

- [x] 4. Elevate Button component
  - [x] 4.1 Add `letterSpacing: letterSpacing.wide` to baseTextStyle
  - [x] 4.2 Replace hardcoded primary shadow with `...shadows.md`
  - [x] 4.3 Add hover state via `useHoverState`: border brightens to `colors.border.hover` when hovered
  - [x] 4.4 Update `getButtonStyles` tests if shadow values changed

Risk: `getButtonStyles` is exported and tested. Mitigation: update test expectations.
Rollback: Revert Button.tsx.

---

## Task 5: Card Elevation
File: `app/components/common/Card.tsx`

Depends on: Tasks 1, 3.

- [x] 5. Elevate Card component
  - [x] 5.1 Replace hardcoded raised shadow with `...shadows.md`
  - [x] 5.2 Add subtle top-edge highlight: `borderTopColor: 'rgba(255,255,255,0.04)'` on raised
  - [x] 5.3 Add hover state via `useHoverState`: border brightens when hovered + onPress
  - [x] 5.4 Remove unused `StyleSheet` import

Risk: `getCardStyles` is tested. Mitigation: update test expectations.
Rollback: Revert Card.tsx.

---

## Task 6: ModalContainer Elevation
File: `app/components/common/ModalContainer.tsx`

Depends on: Task 1 (shadows, springs).

- [ ] 6. Elevate ModalContainer
  - [ ] 6.1 Add scale-in animation: `useSharedValue(0.95)` → `withSpring(1, springs.gentle)`
  - [ ] 6.2 Add opacity animation: 0→1 on mount, 1→0 on close
  - [ ] 6.3 Web: add `backdropFilter: 'blur(8px)'` to overlay (Platform check)
  - [ ] 6.4 Apply `...shadows.lg` to modal card

Risk: Used by 4 modals. Mitigation: test each modal after change.
Rollback: Revert ModalContainer.tsx.

**CHECKPOINT 4**: `npx jest --no-coverage` passes. `getDiagnostics` on Button, Card, ModalContainer — 0 errors.

---

## Task 7: ProgressRing + ProgressBar Elevation
Files: `app/components/common/ProgressRing.tsx`, `app/components/common/ProgressBar.tsx`

Depends on: Task 1 (springs, glowShadow).

- [x] 7. Elevate progress components
  - [x] 7.1 ProgressRing: replace `withTiming(600ms)` with `withSpring(springs.gentle)`
  - [x] 7.2 ProgressRing: fix deprecated `rotation`/`origin` props → use `transform: [{ rotate }]`
  - [x] 7.3 ProgressBar: add animated width transition (withTiming 300ms)
  - [x] 7.4 ProgressBar: ensure fill borderRadius matches track

Rollback: Revert both files.

---

## Task 8: Remaining Core Components (7 files)
Files: EditableField, Skeleton, FilterPill, EmptyState, SectionHeader, SetupBanner, SwipeableRow

Depends on: Tasks 1, 2, 3.

- [x] 8. Elevate remaining core components
  - [x] 8.1 EditableField: add focus ring (`borderColor: colors.border.focus`) when editing
  - [x] 8.2 Skeleton: verify pulse colors (surfaceRaised→surface) and timing (1500ms)
  - [x] 8.3 FilterPill: ensure `usePressAnimation` + `useHoverState` applied
  - [x] 8.4 EmptyState: add `useStaggeredEntrance(0)` for fade-in
  - [x] 8.5 SectionHeader: add `letterSpacing: letterSpacing.tight`
  - [x] 8.6 SetupBanner: ensure press animation applied
  - [x] 8.7 SwipeableRow: no changes for v1 (defer haptics)

Rollback: Revert individual files.

**CHECKPOINT 5**: `npx jest --no-coverage` passes. `getDiagnostics` on all 9 core component files — 0 errors.

---

## Task 9: Feature Components — Cards & Display (12 files)
Files: ExpenditureTrendCard, WeeklySummaryCard, ArticleCardCompact, TodaySummaryRow, MacroRingsRow, MealSlotDiary, MealSlotGroup, QuickActionButton, StreakIndicator, DateScroller, FeatureNavItem, PreviousPerformance

Depends on: Tasks 4-5 (Button + Card patterns).

- [ ] 9. Elevate card/display components
  - [ ] 9.1 Apply shadow tokens to card-like containers
  - [ ] 9.2 Ensure `usePressAnimation` on all pressable elements
  - [ ] 9.3 Add `letterSpacing.tight` to heading text
  - [ ] 9.4 Ensure `fontVariant: ['tabular-nums']` on numeric displays

Rollback: Revert individual files.

---

## Task 10: Feature Components — Modals (4 files)
Files: AddNutritionModal, AddTrainingModal, AddBodyweightModal, QuickAddModal

Depends on: Task 6 (ModalContainer elevation).

- [ ] 10. Elevate modal components
  - [ ] 10.1 Verify each uses ModalContainer (migrate if custom overlay)
  - [ ] 10.2 Add focus ring to TextInputs (`borderColor: colors.border.focus` on focus)
  - [ ] 10.3 Add stagger animation to search result lists

Risk: AddNutritionModal is 1811 lines. Mitigation: only touch styles, not logic.
Rollback: Revert individual files.

---

## Task 11: Feature Components — Remaining (22 files)
Files: All nutrition, analytics, charts, exercise-picker, premium, coaching, training, photos components.

Depends on: Tasks 4-8 (core patterns).

- [ ] 11. Elevate remaining feature components
  - [ ] 11.1 Nutrition (6): card elevation, loading states, press animations
  - [ ] 11.2 Analytics/Charts (4): card elevation, number animations
  - [ ] 11.3 Exercise Picker (5): press animations, grid stagger
  - [ ] 11.4 Premium (3): gold glow via `glowShadow(colors.premium.gold)`
  - [ ] 11.5 Coaching/Training/Photos (4): card elevation, press animations

Rollback: Revert individual files.

**CHECKPOINT 6**: `npx jest --no-coverage` passes. `getDiagnostics` on all modified files — 0 errors.

---

## Task 12: Screen-Level Polish (28 screens)
Files: All screen files.

Depends on: Tasks 4-11 (all component elevations).

- [ ] 12. Apply screen-level patterns
  - [ ] 12.1 Ensure SafeAreaView on all screens
  - [ ] 12.2 Standardize header spacing (spacing[6] top, spacing[4] bottom)
  - [ ] 12.3 Add skeleton loading states to Dashboard, Logs, Analytics, Profile
  - [ ] 12.4 Auth screens: add focus rings, loading button state

Rollback: Revert individual screen files.

---

## Task 13: Navigation Polish
File: `app/navigation/BottomTabNavigator.tsx`

Depends on: Task 1 (tokens).

- [ ] 13. Polish navigation
  - [ ] 13.1 Web: add translucent blur background to tab bar
  - [ ] 13.2 Verify stack transition timing (push 250ms, pop 200ms)
  - [ ] 13.3 Remove unused `React` and `Animated` imports
  - [ ] 13.4 Ensure consistent safe area padding

Rollback: Revert BottomTabNavigator.tsx.

---

## Task 14: Web-Specific Polish
File: `app/App.tsx` (inject web-only styles)

Depends on: All previous tasks.

- [ ] 14. Add web-specific CSS polish
  - [ ] 14.1 Custom scrollbar: thin (6px), dark track, auto-hiding
  - [ ] 14.2 Selection color: `::selection { background: rgba(6,182,212,0.3) }`
  - [ ] 14.3 Cursor: `pointer` on interactive elements

Rollback: Remove injected styles from App.tsx.

---

## Task 15: Final Audit + Tests

- [ ] 15. Final verification
  - [ ] 15.1 Run `npx jest --no-coverage` — all frontend tests pass
  - [ ] 15.2 Run pytest — all backend tests pass
  - [ ] 15.3 `getDiagnostics` on ALL modified files — 0 errors
  - [ ] 15.4 Write tests for `useHoverState` hook and token exports
  - [ ] 15.5 Visual audit: every screen on web

**FINAL CHECKPOINT**: All tests green. 0 diagnostics. Every screen verified.

---

## Rollback Plan

| If This Fails | Do This |
|---------------|---------|
| Task 1 (tokens) | Revert tokens.ts. No dependencies yet. |
| Task 2 (press hook) | Revert hook. Components get no animation. |
| Task 3 (hover hook) | Delete new file. |
| Tasks 4-8 (core) | Revert individual files. |
| Tasks 9-11 (feature) | Revert individual files. |
| Task 12 (screens) | Revert individual files. |
| Full rollback | `git checkout .` — all changes are frontend-only. |

## What Was Cut (Premature for v1)

| Cut | Reason |
|-----|--------|
| Pull-to-refresh custom animation | Requires native module workaround |
| Tab crossfade animation | Requires custom tab bar component |
| Shared element transitions | Requires react-native-shared-element |
| Haptic feedback on SwipeableRow | Needs gesture handler integration |
| Success checkmark animation | Requires Lottie (out of scope) |
| Error shake animation | Nice-to-have, defer to v2 |
| Parallax on push transition | Requires custom stack navigator |
| Icon bounce on tab tap | Requires custom tab bar |

## Monitoring (Post-Launch)

| Signal | Instrument | Alert |
|--------|-----------|-------|
| Animation frame drops | RN Performance Monitor | >5% below 60fps |
| JS thread blocking | Reanimated worklet ratio | Any animation on JS thread |
| Bundle size increase | expo export --dump-sourcemap | >50KB increase |
| Test regression | CI pipeline | Any failure |
