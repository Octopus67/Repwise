# Repwise 11/10 UI Plan — REVISED (Post-Holistic Audit)

**Date:** April 5, 2026
**Key insight:** Repwise is a "Bloomberg Terminal for hypertrophy" — dark, data-dense, science-forward. The UI upgrades must feel **engineered and authoritative**, not playful or casual. Confetti and cartoon animations are wrong for this brand. Gold flashes, sharp haptics, and fluid data interactions are right.

---

## What Changed From v1

| v1 Plan | v2 Revision | Why |
|---------|-------------|-----|
| Install Skia (3MB) | **DROPPED** | SVG + LinearGradient handles 100% of use cases. 3MB for gradient rings is absurd. |
| Install victory-native-xl | **DROPPED** | Enhance existing SVG charts instead. Or use react-native-gifted-charts (80KB, no native deps). |
| 6 Lottie animations | **Reduced to 2** | Serious lifter app, not Duolingo. Reanimated for everything except streak flame. |
| Confetti on PRs | **Replaced with gold flash** | Confetti = birthday party. Gold flash + heavy haptic = "order filled" on a trading terminal. |
| GlassCard primitive | **KILLED** | Blur on data surfaces reduces readability. Bloomberg doesn't blur its data. |
| 4-tier streak system | **Reduced to 2 tiers** | Over-engineered for v1. |
| Missing: Layout animations | **ADDED** | Reanimated entering/exiting on list items. Highest ROI missed item. |
| Missing: Gesture expansion | **ADDED** | Long-press context menus, drag-to-reorder, swipe between days. |
| Missing: Shared element transitions | **ADDED** | Card-to-detail morphing. The Apple premium touch. |

**Revised bundle impact: ~217KB** (down from ~3.3MB — 93% smaller)

---

## Libraries: Final List

| Library | Action | Size | Purpose |
|---------|--------|------|---------|
| `expo-linear-gradient` | **INSTALL** | 12KB | Gradient buttons, shimmer skeletons, bar fills, tab indicators |
| `expo-blur` | **INSTALL** | 15KB | Modal backdrops only (NOT data cards) |
| `@shopify/flash-list` | **INSTALL** | 40KB | 5-10x faster lists for exercise picker, food log |
| `lottie-react-native` | **INSTALL** | 150KB | Streak flame animation only (1-2 assets max) |
| `@gorhom/bottom-sheet` | **Already installed** | 0 | Paywall redesign, action sheets |
| `expo-haptics` | **Already installed** | 0 | Wire to 15+ interactions |
| `react-native-reanimated` | **Already installed** | 0 | Layout animations, shared transitions, gold flash |
| `react-native-gesture-handler` | **Already installed** | 0 | Long-press, drag-to-reorder, swipe gestures |

**NOT installing:** Skia (3MB), victory-native-xl (needs Skia), react-native-confetti-cannon (wrong brand), moti (Reanimated is sufficient), zeego (future), burnt (custom toast is better for brand consistency)

---

## Phase Overview (Revised)

| Phase | Focus | Tasks | Hours | Key Principle |
|-------|-------|-------|-------|---------------|
| 1 | Foundation | 6 | 4-6h | Install libs, create primitives |
| 2 | Feel (Haptics + Motion) | 6 | 8-10h | Make every interaction tactile and fluid |
| 3 | Visual Upgrade | 5 | 6-8h | Gradients, shimmer, blur — the "premium layer" |
| 4 | Emotional Peaks | 4 | 4-6h | PR gold flash, streak flame, ring celebration |
| 5 | Data Comes Alive | 4 | 8-10h | Body map, chart interaction, layout animations |
| 6 | Premium Surfaces | 4 | 6-8h | Paywall redesign, onboarding body silhouettes |

---

## Phase 1: Foundation

### 1.1 Install 4 libraries
```bash
npx expo install expo-linear-gradient expo-blur @shopify/flash-list lottie-react-native
```
Add Lottie config plugin to app.json. Test with `npx expo start --clear`.
**Risk:** MEDIUM (native modules). Install one at a time.

### 1.2 Create `<GradientButton>` primitive
`app/components/common/GradientButton.tsx` — LinearGradient wrapper around TouchableOpacity. Scale animation (0.97) + haptic on press. Primary (gradient fill) and secondary (gradient border) variants.
**Risk:** NONE

### 1.3 Create `<ShimmerSkeleton>` replacement
`app/components/common/Skeleton.tsx` — Replace opacity pulse with LinearGradient shimmer sweep. Same props interface. Reanimated translateX animation.
**Risk:** LOW — same API, different visual.

### 1.4 Create haptics utility
`app/utils/haptics.ts` — Simple object with `.light()`, `.medium()`, `.heavy()`, `.success()`, `.error()`, `.selection()`. All with `.catch(() => {})`.
**Risk:** NONE

### 1.5 Add gradient token arrays to theme
`app/theme/tokens.ts` — Extend existing `colors.gradient` with array versions for LinearGradient `colors` prop.
**Risk:** NONE

### 1.6 Download 1-2 Lottie assets
`app/assets/animations/flame.json` — Animated flame for streak indicator. That's it. Everything else is Reanimated.
**Risk:** NONE

---

## Phase 2: Feel (the biggest "premium" upgrade — zero visual changes, all tactile)

### 2.1 Wire haptics to 15+ interactions
Add `haptic.X()` calls across the app. This is the single highest-impact change for perceived quality.

| Interaction | Haptic | File |
|-------------|--------|------|
| Complete a set ✓ | `.success()` | ExerciseCardPremium |
| Finish workout | `.heavy()` | ActiveWorkoutScreen |
| PR detected | `.heavy()` | PRCelebration |
| Log food/bodyweight | `.success()` | AddNutritionModal, AddBodyweightModal |
| Tab switch | `.selection()` | BottomTabNavigator |
| Date scroller snap | `.selection()` | DateScroller |
| Swipe-to-delete reveal | `.light()` | SwipeableRow |
| Weight stepper +/- | `.light()` | ExerciseCardPremium |
| Timer complete | `.heavy()` | FloatingRestTimerBar |
| Pull-to-refresh trigger | `.light()` | DashboardScreen |
| Toggle switch | `.selection()` | Settings |
| Error/validation | `.error()` | Form submissions |

**Risk:** NONE — haptics fail silently.
**Testing:** Physical device only.

### 2.2 Reanimated Layout Animations (MISSING FROM v1 — highest ROI)
Add `entering` and `exiting` props to list items across the app.

```tsx
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';

// On every list item:
<Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(150)} layout={Layout.springify()}>
```

Apply to:
- Exercise cards in ActiveWorkoutBody (add/remove exercises)
- Set rows in ExerciseCardPremium (add/remove sets)
- Nutrition entries in LogsScreen (add/delete)
- Feed items in FeedScreen
- Achievement cards in CelebrationModal

**Risk:** LOW — Reanimated layout animations are stable in v3+.
**Testing:** Add exercise → verify it slides in. Delete → verify it slides out.

### 2.3 AnimatedPressable rollout (top 10 touchpoints)
Replace `TouchableOpacity` with scale animation (0.97) + haptic in:
QuickActionButton, tab bar items, "Finish" button, "Start Workout" card, macro ring taps, date pills, meal slot "Add" buttons, exercise picker results, settings rows, profile actions.
**Risk:** LOW

### 2.4 Circular Rest Timer Ring
Enhance `FloatingRestTimerBar.tsx` — add 40px SVG progress ring (reuse ProgressRing pattern). Color interpolation green→yellow→red. Breathing pulse at <10s. Haptic at 10s/5s/0s.
**Risk:** MEDIUM — high-frequency component. Keep old layout as fallback.

### 2.5 FlashList migration (3 heaviest lists)
Replace FlatList with FlashList in ExercisePickerScreen (800+ items), LogsScreen training tab, FeedScreen.
**Risk:** LOW — drop-in replacement.

### 2.6 Gesture expansion (MISSING FROM v1)
- **Long-press on exercise cards** → show context menu (reorder, superset, delete) using `react-native-gesture-handler` LongPressGestureHandler
- **Swipe between days** on LogsScreen → PanGestureHandler for horizontal day navigation
- **Drag-to-reorder exercises** in ActiveWorkoutBody → use Reanimated gesture-based reorder

**Risk:** MEDIUM — gesture interactions need careful tuning.
**Testing:** Manual on physical device.

---

## Phase 3: Visual Upgrade

### 3.1 Gradient Macro Rings
Add SVG `<LinearGradient>` to ProgressRing.tsx. Each macro gets its gradient from tokens. Ring completion: scale pulse (1.0→1.12→1.0) + glow shadow + `haptic.success()`. Make rings 112px (up from 96px).
**Risk:** LOW

### 3.2 Shimmer Skeleton rollout
Replace Skeleton.tsx internals with LinearGradient shimmer. Same props = zero migration. Every loading screen upgrades automatically.
**Risk:** LOW

### 3.3 Gradient CTA buttons
Replace flat accent buttons with GradientButton in: "Start Workout", "Log Food", "Upgrade", "Save", "Finish Workout". Keep flat buttons for secondary actions.
**Risk:** LOW

### 3.4 Blur modal backdrops
Add `BlurView` to ModalContainer.tsx backdrop. `intensity={30}`, `tint` based on theme. Fallback to rgba for old Android.
**Risk:** LOW — already have safe area fix in ModalContainer.

### 3.5 Premium Badge shimmer
Add gold gradient sweep animation to PremiumBadge.tsx. LinearGradient with animated translateX.
**Risk:** NONE

---

## Phase 4: Emotional Peaks (understated, authoritative — NOT playful)

### 4.1 PR Gold Flash (replaces confetti)
When PR is detected, render a full-screen overlay:
- Radial LinearGradient from center: `gold at 0% opacity → transparent`
- Animate opacity: `0 → 0.25 → 0` over 500ms
- Subtle screen shake: translateX `0 → -2 → 2 → -1 → 1 → 0` over 300ms
- `haptic.heavy()`
- Gold gradient border on the PR banner card

This feels like a Bloomberg "trade executed" confirmation — sharp, fast, authoritative.
**Risk:** NONE — overlay with pointerEvents="none".

### 4.2 Animated Streak Flame
Replace static flame icon with Lottie `flame.json`. 2 tiers only:
- 1-6 days: small flame, default
- 7+ days: larger flame, gold glow via `glowShadow()`
Counting animation on the number.
**Risk:** LOW

### 4.3 Ring Completion Micro-celebration
When macro ring crosses 100%: scale pulse + glow + `haptic.success()`. Debounced (once per session). No Lottie, no confetti — just a crisp, satisfying moment.
**Risk:** LOW

### 4.4 Workout Complete Enhancement
WorkoutSummaryModal: animated stat counters (useCountingValue — already exists), staggered entrance (useStaggeredEntrance — already exists), gold PR badges, blur backdrop, `haptic.heavy()`. Zero new dependencies needed — all primitives already exist.
**Risk:** LOW

---

## Phase 5: Data Comes Alive

### 5.1 Body Muscle Map (signature feature)
New `app/components/volume/BodyMuscleMap.tsx`. Uses existing `anatomicalPaths.ts` + `BodySilhouette.tsx`. Colored by volume status (gray/yellow/green/orange/red). Tap muscle → navigate to detail. Animated color transitions via Reanimated `interpolateColor`. Pulsing glow on muscles needing attention.
**Risk:** LOW — uses existing SVG data.

### 5.2 Enhanced Charts (no rewrite — enhance existing)
Upgrade `TrendLineChart.tsx`:
- Add SVG `<LinearGradient>` area fill under the line
- Add Reanimated draw-in animation (strokeDashoffset from full → 0)
- Improve touch-to-scrub (already has touch handling — make tooltip follow finger smoothly)
- Add smooth data transition when switching time ranges

Zero new dependencies. All SVG + Reanimated.
**Risk:** MEDIUM — chart is used on 5+ screens. Test all.

### 5.3 Shared Element Transitions (MISSING FROM v1)
Use Reanimated v3 `SharedTransition` for:
- Exercise picker card → exercise detail screen
- Achievement grid item → achievement detail
- Muscle on body map → volume detail card

This is the "Apple premium" touch that separates good from great.
**Risk:** MEDIUM — shared transitions can be finicky. Start with 1 transition, expand if stable.

### 5.4 TDEE Reveal Gradient Bars
Replace flat bar colors with LinearGradient fills. Add brief "calculating..." loading state (1.5s) with animated dots before the reveal. Subtle glow behind the total number.
**Risk:** NONE

---

## Phase 6: Premium Surfaces

### 6.1 Paywall Redesign
Rewrite UpgradeModal with `@gorhom/bottom-sheet` (already installed!). Snap points ['65%', '90%']. BlurView backdrop. Gradient CTA button. Staggered feature list entrance. Social proof counter. Price comparison with savings badge.
**Risk:** MEDIUM — revenue-critical. Keep old modal as fallback.

### 6.2 Body Composition Silhouettes in Onboarding
Rewrite BodyCompositionStep with body silhouette SVG (existing anatomicalPaths). Animated transitions between BF% ranges. Gender-specific. Haptic on selection.
**Risk:** MEDIUM — onboarding step. Test full flow.

### 6.3 Animated Tab Indicator
Create `<AnimatedTabBar>` with Reanimated sliding gradient pill for Logs and Analytics tabs. `haptic.selection()` on switch.
**Risk:** LOW

### 6.4 Pose Overlay Guides in Camera
Activate existing SVG pose overlays in ProgressPhotosScreen camera. Semi-transparent overlay, pose type selector, toggle on/off.
**Risk:** LOW — assets already exist.

---

## What This Achieves (Before → After)

| Dimension | Before (8/10) | After (11/10) |
|-----------|---------------|---------------|
| **Tactile feel** | 2 files use haptics | 15+ interactions have haptics |
| **Motion** | Staggered entrance only | Layout animations on add/remove, shared transitions, spring press |
| **Loading** | Opacity pulse | Shimmer sweep gradient |
| **Buttons** | Flat solid color | Gradient fill with scale animation |
| **Modals** | Flat rgba backdrop | Blur glassmorphism |
| **Charts** | Static SVG polyline | Gradient fill, draw-in animation, touch scrub |
| **PR moment** | Emoji trophy banner | Gold flash + screen shake + heavy haptic |
| **Streak** | Static text + icon | Animated Lottie flame with glow tiers |
| **Rings** | Solid color SVG | Gradient stroke, completion celebration |
| **Rest timer** | Text counter bar | Circular progress ring with pulse |
| **Lists** | FlatList | FlashList (5-10x faster) |
| **Gestures** | Tap only | Long-press menus, drag-to-reorder, swipe navigation |
| **Transitions** | Instant screen swap | Shared element morphing |
| **Volume data** | Text/numbers | Tappable body muscle map |
| **Paywall** | Basic Modal | Bottom sheet with blur + gradient CTA |
| **Body fat** | Text cards | Animated body silhouettes |

**Total new bundle: ~217KB. Total effort: ~10 days. The app goes from "well-built" to "this feels like it was made by Apple's fitness team."**
