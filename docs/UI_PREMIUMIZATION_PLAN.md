# Repwise UI Premiumization Report

**Date:** April 5, 2026
**Perspective:** 20-year UI veteran, deep open-source knowledge
**Verdict:** Architecture A, Visual Polish C+, Delight Factor C → Target: A across the board

---

## The Core Problem

Repwise has excellent engineering under the hood — spring physics, haptics, accessibility, reduce-motion support, semantic color tokens. But the visual layer doesn't match. Users see:

- **Flat solid colors** where competitors show gradients
- **Opacity pulse skeletons** where competitors show shimmer sweeps
- **Text counters** where competitors show animated circular progress
- **Emoji trophies** where competitors show confetti explosions
- **Static body fat cards** where competitors show body silhouettes

The gap is 3 library installs and ~40 hours of focused visual work.

---

## The Body Animation Problem (Specifically)

### Current State
`BodyCompositionStep.tsx` shows a 2-column grid of text cards with tiny colored fill bars. No body illustration. No silhouette. No visual representation of what 15% vs 25% body fat looks like.

Meanwhile, the codebase HAS:
- `anatomicalPaths.ts` — full SVG body paths (front + back) with muscle regions
- `poseOverlayLogic.ts` — 4 SVG pose overlays (front-relaxed, front-double-bicep, side, back)
- `BodySilhouette.tsx` — working SVG body renderer with heat map coloring

**These assets exist but are ONLY used in the analytics heat map. They're never shown during onboarding or in the profile.**

### The Fix

**Phase 1: Body silhouettes in onboarding** (BodyCompositionStep)
- Show a gender-specific body silhouette that morphs as user selects different BF% ranges
- Use the existing `anatomicalPaths.ts` SVG paths
- Animate the silhouette's "fat layer" thickness using Reanimated interpolation
- Color the silhouette from lean (green tint) to higher BF% (neutral)
- Add smooth transition between selections (300ms spring)

**Phase 2: Body map on dashboard/volume**
- Replace the text-only VolumeLandmarksCard with a tappable body map
- Each muscle colored by volume status (green=optimal, yellow=below MEV, red=above MRV)
- Tap a muscle → drill into that muscle's volume details
- Animated color transitions when data updates

**Phase 3: Pose overlays in camera**
- The 4 SVG pose overlays exist but are never rendered
- Show semi-transparent pose guide when taking progress photos
- User selects pose type → overlay appears on camera preview
- Ensures consistent photo angles for accurate comparison

---

## Top 10 Highest-Impact Improvements (Ranked)

### 🥇 1. Circular Rest Timer with Pulse Animation
**Impact:** CRITICAL — users see this 20-50 times per workout
**Current:** Small floating text bar showing "2:34"
**Target:** Circular SVG progress ring with breathing pulse, color transitions (green→yellow→red)
**Implementation:**
- Reuse `ProgressRing.tsx` pattern (already in codebase)
- `useAnimatedProps` on SVG Circle `strokeDashoffset`
- Add `withRepeat(withSequence(withTiming(1.02), withTiming(1.0)))` for pulse
- Color interpolation via `interpolateColor`
- ~100 lines of code, 0 new dependencies

### 🥈 2. Confetti/Particle Celebrations
**Impact:** HIGH — emotional peak moments drive retention and sharing
**Current:** PR banner with emoji trophy 🏆, CelebrationModal with no particles
**Target:** Gold confetti burst on PRs, achievements, streak milestones
**Implementation:**
- Install `react-native-confetti-cannon` (lightweight, well-maintained)
- Wrap PR detection in `<ConfettiCannon count={50} origin={{x: width/2, y: 0}} />` 
- Add to CelebrationModal, PRCelebration, and streak milestone
- ~30 lines per integration point

### 🥉 3. Gradient Shimmer Skeletons
**Impact:** HIGH — loading states are the first thing users see
**Current:** Opacity pulse (0.3→1.0→0.3) — looks like a 2018 app
**Target:** Gradient sweep shimmer (like Instagram, Twitter, every modern app)
**Implementation:**
- Install `expo-linear-gradient`
- Replace opacity animation with a translating LinearGradient mask
- Or use `moti/skeleton` (drop-in replacement, 1 line change)
- ~20 lines to replace Skeleton component

### 4. Body Silhouettes in Onboarding
**Impact:** HIGH — first impression, sets premium expectation
**Current:** Text cards with tiny colored bars
**Target:** Gender-specific body silhouette that morphs with BF% selection
**Implementation:** Reuse `anatomicalPaths.ts` + Reanimated for morph transitions

### 5. Redesign Upgrade/Paywall Modal
**Impact:** HIGH — direct revenue impact
**Current:** Plain modal with text list, no hero, no gradient, no social proof
**Target:** Bottom sheet (use already-installed `@gorhom/bottom-sheet`) with:
- Lottie hero animation at top
- Gradient background
- Staggered feature list entrance
- Social proof ("Join 10,000+ lifters")
- Prominent CTA with gradient button
**Implementation:** Install `lottie-react-native`, redesign modal layout

### 6. Interactive Charts with Touch
**Impact:** MEDIUM-HIGH — makes data feel alive
**Current:** Static SVG polyline, no touch interaction
**Target:** Tap data point → animated tooltip, pan to scroll history
**Implementation:** Add PanGestureHandler, animated tooltip View following touch position

### 7. Drag-to-Reorder Exercises
**Impact:** MEDIUM-HIGH — expected pattern in premium workout apps
**Current:** ▲▼ buttons for reordering
**Target:** Long-press drag handles with haptic feedback
**Implementation:** `react-native-draggable-flatlist` (well-maintained, Reanimated-based)

### 8. Gradient Progress Rings
**Impact:** MEDIUM — daily visual, subtle but noticeable
**Current:** Solid color SVG stroke
**Target:** Gradient stroke (e.g., blue→purple for calories)
**Implementation:** SVG `<LinearGradient>` def inside the ring SVG, reference via `stroke="url(#gradient)"`

### 9. Glassmorphism Tab Bar
**Impact:** MEDIUM — modern visual trend, premium feel
**Current:** Solid background tab bar
**Target:** Translucent blur background with subtle border
**Implementation:** `expo-blur` BlurView as tab bar background

### 10. Animated Streak Indicator
**Impact:** LOW-MEDIUM — gamification/retention
**Current:** Static "🔥 5" text
**Target:** Animated flame icon, tier escalation (bronze→silver→gold at 7/30/100 days), pulse on increment
**Implementation:** Lottie flame animation or Reanimated scale/opacity sequence

---

## Libraries to Install

| Library | Size | Purpose | Priority |
|---------|------|---------|----------|
| `expo-linear-gradient` | 12KB | Gradients, shimmer skeletons | P0 |
| `react-native-confetti-cannon` | 8KB | PR/achievement celebrations | P0 |
| `lottie-react-native` | 45KB | Hero animations, celebrations, empty states | P0 |
| `expo-blur` | 15KB | Glassmorphism tab bar, modal backdrops | P1 |
| `moti` | 20KB | Declarative animations, skeleton shimmer | P1 |
| `react-native-draggable-flatlist` | 25KB | Exercise reorder | P1 |

**Already installed but underutilized:**
- `@gorhom/bottom-sheet` — should be used for paywall, not raw Modal
- `react-native-reanimated` — using ~30% of capabilities
- `react-native-svg` — no gradient defs on any SVG
- `react-native-gesture-handler` — no pan gestures on charts

---

## What NOT to Change (Already Premium)

- ✅ MacroRingsRow spring animations — best component in the app
- ✅ Set logging flow — fast, fluid, 3-tap completion
- ✅ Copy-previous-set with single tap
- ✅ Weight steppers with haptic feedback
- ✅ Staggered entrance animations throughout
- ✅ Reduce-motion accessibility support
- ✅ HU (Hard Units) system — unique differentiator
- ✅ Overload suggestions with one-tap apply
- ✅ Theme system with semantic color tokens
- ✅ Back navigation guard on active workout

---

## Implementation Priority

### Sprint 1 (Before Launch — 3 days)
1. Fix RegisterScreen crash (useMemo import) — 1 min
2. Fix Skeleton hooks violation — 30 min
3. Add logout/delete confirmation dialogs — 30 min
4. Add swipe-to-delete confirmation — 30 min
5. Install `expo-linear-gradient` + replace Skeleton shimmer — 2 hours
6. Install `react-native-confetti-cannon` + add to PRCelebration + CelebrationModal — 2 hours
7. Circular rest timer (reuse ProgressRing pattern) — 4 hours

### Sprint 2 (First Week — 5 days)
8. Body silhouettes in BodyCompositionStep — 8 hours
9. Redesign UpgradeModal with @gorhom/bottom-sheet + Lottie hero — 8 hours
10. Interactive chart tooltips — 4 hours
11. Gradient progress rings — 2 hours
12. ModalContainer safe area fix — 1 hour

### Sprint 3 (First Month)
13. Body muscle map on dashboard/volume — 12 hours
14. Drag-to-reorder exercises — 4 hours
15. Glassmorphism tab bar — 2 hours
16. Animated streak indicator — 2 hours
17. Pose overlays in camera — 4 hours
18. Photo comparison slider — 8 hours
