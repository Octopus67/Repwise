# Repwise 11/10 UI Premiumization Plan

**Date:** April 5, 2026
**Goal:** Transform the app from "well-engineered" (8/10) to "jaw-dropping premium" (11/10)
**Approach:** Install 6 libraries, upgrade 15 components, add 30+ micro-interactions

---

## Library Installation Order

| # | Library | Purpose | Bundle Impact | Depends On |
|---|---------|---------|---------------|------------|
| 1 | `expo-linear-gradient` | Gradients everywhere | ~12KB | Nothing |
| 2 | `expo-blur` | Glassmorphism backdrops | ~15KB | Nothing |
| 3 | `lottie-react-native` | Celebration animations, animated icons | ~150KB | Nothing |
| 4 | `@shopify/flash-list` | 5-10x faster lists | ~40KB | Nothing |
| 5 | `@shopify/react-native-skia` | GPU rings, particles, shaders | ~3MB | Nothing |
| 6 | `victory-native-xl` | Interactive Skia-powered charts | ~80KB | Skia |

**Total bundle impact:** ~3.3MB (Skia is the big one — worth it for GPU rendering)

---

## Phase Overview

| Phase | Focus | Tasks | Est. Hours | Dependencies |
|-------|-------|-------|------------|--------------|
| 1: Foundation | Install libs, create primitives | 8 | 6-8h | None |
| 2: Core Interactions | Rest timer, macro rings, haptics | 5 | 8-10h | Phase 1 |
| 3: Celebration & Delight | Confetti, streaks, achievements | 5 | 6-8h | Phase 1 |
| 4: Premium Surfaces | Paywall, modals, skeletons | 5 | 6-8h | Phase 1 |
| 5: Data Visualization | Charts, body map, analytics | 4 | 8-10h | Phase 1 |
| 6: Onboarding & Polish | Body composition, TDEE, micro-interactions | 5 | 6-8h | Phase 1-3 |

---

## Phase 1: Foundation (Install libs + create reusable primitives)

### 1.1 Install all 6 libraries

**Implementation steps:**
```bash
cd app
npx expo install expo-linear-gradient expo-blur lottie-react-native @shopify/flash-list
npx expo install @shopify/react-native-skia
npm install victory-native-xl
```

**Ripple effects:** Skia requires an Expo config plugin. Add to `app.json`:
```json
"plugins": ["@shopify/react-native-skia"]
```
Lottie also needs a config plugin. EAS build required after install (dev client rebuild).

**Risk:** MEDIUM — native module installs can break builds. Test with `npx expo start` after each install.
**Testing:** `npx expo start --clear` succeeds, no red screen.

---

### 1.2 Create `<GradientButton>` primitive

**File:** `app/components/common/GradientButton.tsx` (new)
**Root cause:** Every CTA button is flat `backgroundColor: c.accent.primary`. No visual hierarchy between primary and secondary actions.

**Implementation:**
- Wrap `TouchableOpacity` with `LinearGradient` from `expo-linear-gradient`
- Use theme gradient tokens (`c.gradient.primary` → `[c.accent.primary, c.accent.secondary]`)
- Props: `title`, `onPress`, `loading`, `disabled`, `variant` ('primary' | 'secondary')
- Primary: gradient fill. Secondary: gradient border (transparent fill)
- Include press animation (scale 0.97 via Reanimated) + haptic feedback
- Include loading spinner state

**Ripple effects:** None — new component, opt-in usage.
**Risk:** NONE
**Testing:** Visual — render both variants in light/dark mode.

---

### 1.3 Create `<GlassCard>` primitive

**File:** `app/components/common/GlassCard.tsx` (new)
**Root cause:** All cards use flat `backgroundColor: c.bg.surface`. No depth or premium feel.

**Implementation:**
- `BlurView` from `expo-blur` as background with `intensity={20}` and `tint="dark"`
- Subtle border: `borderWidth: 1, borderColor: rgba(255,255,255,0.1)`
- `overflow: 'hidden'` + `borderRadius: radius.lg`
- Props: `children`, `style`, `intensity` (blur amount), `variant` ('glass' | 'frosted')

**Ripple effects:** None — new component.
**Risk:** LOW — BlurView can be expensive on low-end Android. Add `reducedTransparencyEnabled` fallback.
**Testing:** Visual on iOS + Android. Verify performance on older devices.

---

### 1.4 Create `<ShimmerSkeleton>` to replace current Skeleton

**File:** `app/components/common/ShimmerSkeleton.tsx` (new, replaces Skeleton.tsx)
**Root cause:** Current skeleton uses opacity pulse (0.3→0.7). Every modern app uses gradient shimmer sweep.

**Implementation:**
- `LinearGradient` with 3 stops: `[transparent, rgba(255,255,255,0.15), transparent]`
- Animate gradient position with Reanimated `translateX` from -width to +width
- `withRepeat(withTiming(..., { duration: 1200 }), -1)` for infinite loop
- Same props as current Skeleton (`width`, `height`, `borderRadius`, `variant`)
- Web fallback: keep current opacity pulse (LinearGradient may not work on web)

**Ripple effects:** Replace all `<Skeleton>` imports with `<ShimmerSkeleton>`. Or rename and keep backward compat.
**Risk:** LOW — visual-only change, same props interface.
**Testing:** Visual on all screens that show loading states (Dashboard, Analytics, Logs).

---

### 1.5 Create haptics utility wrapper

**File:** `app/utils/haptics.ts` (new, supplements existing useHaptics hook)
**Root cause:** `expo-haptics` is installed but only used in 2 files. Need a dead-simple API.

**Implementation:**
```typescript
import * as Haptics from 'expo-haptics';

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  selection: () => Haptics.selectionAsync().catch(() => {}),
};
```

**Ripple effects:** None — new utility, opt-in.
**Risk:** NONE
**Testing:** Manual on physical device (haptics don't work in simulator).

---

### 1.6 Create Lottie animation assets directory

**File:** `app/assets/animations/` (new directory)
**Root cause:** No animation assets exist. Need Lottie JSON files for celebrations.

**Implementation:**
- Download from LottieFiles.com (free tier):
  - `confetti.json` — gold confetti burst (~15KB)
  - `fireworks.json` — fireworks for PRs (~20KB)
  - `flame.json` — animated flame for streaks (~8KB)
  - `checkmark.json` — success checkmark (~5KB)
  - `trophy.json` — trophy for achievements (~12KB)
  - `loading-dots.json` — premium loading indicator (~4KB)
- Place in `app/assets/animations/`

**Ripple effects:** None — assets only.
**Risk:** NONE — but verify Lottie JSON files render correctly with `lottie-react-native`.
**Testing:** Create a test screen that renders each animation.

---

### 1.7 Create `<AnimatedPressable>` primitive

**File:** `app/components/common/AnimatedPressable.tsx` (new)
**Root cause:** Current press feedback is `activeOpacity={0.7}` on TouchableOpacity. No scale animation, no haptic.

**Implementation:**
- Reanimated `useAnimatedStyle` with `withSpring` scale (1.0 → 0.96 → 1.0)
- Auto haptic on press (`haptic.light()`)
- Props: same as `Pressable` + `hapticStyle` ('light' | 'medium' | 'none')
- Respects `useReducedMotion()` — no scale if reduced motion enabled

**Ripple effects:** Gradually replace `TouchableOpacity` with `AnimatedPressable` across the app.
**Risk:** NONE — new component.
**Testing:** Visual + haptic on physical device.

---

### 1.8 Add gradient tokens to theme

**File:** `app/theme/tokens.ts` (modify)
**Root cause:** Gradient color arrays exist as strings but not as usable arrays for LinearGradient.

**Implementation:**
- Add to color tokens:
```typescript
gradientArrays: {
  primary: ['#6366F1', '#8B5CF6'],      // indigo → violet
  success: ['#10B981', '#34D399'],       // emerald
  warning: ['#F59E0B', '#FBBF24'],       // amber
  premium: ['#F59E0B', '#EF4444'],       // gold → red
  calories: ['#EF4444', '#F97316'],      // red → orange
  protein: ['#3B82F6', '#6366F1'],       // blue → indigo
  carbs: ['#F59E0B', '#F97316'],         // amber → orange
  fat: ['#EC4899', '#F43F5E'],           // pink → rose
}
```

**Ripple effects:** None — additive tokens.
**Risk:** NONE
**Testing:** N/A — data only.


---

## Phase 2: Core Interactions (the things users touch 50x per session)

### 2.1 Circular Rest Timer with Pulse Animation

**Files:** `app/components/training/FloatingRestTimerBar.tsx` (modify)
**Root cause:** Users see the rest timer 20-50 times per workout. Currently a small text bar. This is the #1 highest-impact visual change.

**Implementation:**
1. Add a 40px circular SVG progress ring to the left side of the floating bar
2. Reuse the `ProgressRing` pattern from `MacroRingsRow` — animated `strokeDashoffset`
3. Ring depletes as time counts down (full → empty)
4. Color interpolation: green (>50%) → yellow (25-50%) → red (<25%) via `interpolateColor`
5. Add breathing pulse: `withRepeat(withSequence(withTiming(1.03, {duration: 1000}), withTiming(1.0, {duration: 1000})), -1)` on the ring scale when <10s remaining
6. Add haptic feedback: `haptic.warning()` at 10s, `haptic.heavy()` at 0s
7. Optional: tap the ring to expand to full-screen circular timer view

**Ripple effects:** FloatingRestTimerBar layout changes — test on all screen sizes.
**Risk:** MEDIUM — this is a frequently-used component. Test thoroughly during workouts.
**Testing:** Manual — start workout, add rest timer, verify ring animates correctly, verify haptics fire.

---

### 2.2 Gradient Macro Rings

**Files:** `app/components/dashboard/MacroRingsRow.tsx` (modify), `app/components/dashboard/ProgressRing.tsx` (modify)
**Root cause:** Rings use flat solid colors. Gradient strokes are the premium standard (Apple Watch, MacroFactor).

**Implementation:**
1. In ProgressRing SVG, add `<Defs><LinearGradient id="ringGrad">` with 2 color stops from `gradientArrays`
2. Set ring `stroke="url(#ringGrad)"` instead of flat color
3. Add "ring complete" celebration: when fill crosses 100%, trigger:
   - Scale pulse: `withSequence(withSpring(1.15), withSpring(1.0))`
   - Haptic: `haptic.success()`
   - Brief glow shadow (use `glowShadow()` from tokens — already exists but unused)
4. Make rings slightly larger: 96px → 112px on dashboard
5. Add animated counting text inside rings (already exists via `useCountingValue`)

**Ripple effects:** Dashboard layout may need spacing adjustment for larger rings.
**Risk:** LOW — visual enhancement on existing component.
**Testing:** Visual — verify rings render correctly with 0%, 50%, 100%, 150% values. Verify gradient in light/dark mode.

---

### 2.3 Wire Haptics Across the App

**Files:** 15+ files across screens/ and components/
**Root cause:** `expo-haptics` installed but only used in 2 files. Zero tactile feedback on most interactions.

**Implementation — add `haptic.X()` calls to:**

| Interaction | Haptic | File |
|-------------|--------|------|
| Complete a set (checkmark tap) | `haptic.success()` | ExerciseCardPremium.tsx |
| Log food entry | `haptic.success()` | AddNutritionModal.tsx |
| Log bodyweight | `haptic.success()` | AddBodyweightModal.tsx |
| Finish workout | `haptic.heavy()` | ActiveWorkoutScreen.tsx |
| PR detected | `haptic.heavy()` | PRCelebration.tsx |
| Tab switch | `haptic.selection()` | BottomTabNavigator.tsx |
| Date scroller snap | `haptic.selection()` | DateScroller.tsx |
| Swipe-to-delete reveal | `haptic.light()` | SwipeableRow.tsx |
| Pull-to-refresh trigger | `haptic.light()` | DashboardScreen.tsx |
| Timer complete | `haptic.heavy()` | FloatingRestTimerBar.tsx |
| Weight stepper +/- | `haptic.light()` | ExerciseCardPremium.tsx |
| Toggle switch | `haptic.selection()` | Any Switch component |
| Achievement unlock | `haptic.success()` | CelebrationModal.tsx |
| Streak milestone | `haptic.success()` | StreakIndicator.tsx |
| Error/validation fail | `haptic.error()` | Form submissions |

**Ripple effects:** None — additive calls, no behavior change.
**Risk:** NONE — haptics fail silently (`.catch(() => {})`)
**Testing:** Manual on physical device. Verify each interaction feels right (not too aggressive).

---

### 2.4 AnimatedPressable Rollout (Top 10 Touchpoints)

**Files:** 10 component files
**Root cause:** `TouchableOpacity` with `activeOpacity={0.7}` feels flat. Scale animation + haptic feels premium.

**Implementation — replace `TouchableOpacity` with `AnimatedPressable` in:**
1. QuickActionButton (dashboard — 3 buttons)
2. Tab bar items (4 tabs)
3. Workout "Finish" button
4. "Start Workout" card
5. Macro ring tap targets
6. Date scroller day pills
7. Meal slot "Add" buttons
8. Exercise picker results
9. Settings toggle rows
10. Profile action buttons

**Ripple effects:** Visual change on press feedback. Verify no double-tap issues.
**Risk:** LOW — same behavior, different animation.
**Testing:** Visual — verify scale animation on each touchpoint.

---

### 2.5 FlashList Migration for Heavy Lists

**Files:** `app/screens/logs/LogsScreen.tsx`, `app/screens/training/ExercisePickerScreen.tsx`, `app/screens/social/FeedScreen.tsx`
**Root cause:** FlatList is adequate but FlashList is 5-10x faster for long lists. Exercise picker can have 800+ items.

**Implementation:**
1. Replace `import { FlatList }` with `import { FlashList }` from `@shopify/flash-list`
2. Add `estimatedItemSize={72}` prop (average row height)
3. Keep existing `renderItem`, `keyExtractor`, etc.
4. FlashList v2 is JS-only — no native module needed

**Ripple effects:** FlashList has slightly different scroll behavior. Test pull-to-refresh compatibility.
**Risk:** LOW — drop-in replacement with same API.
**Testing:** Scroll through 100+ items — verify smooth 60fps, no blank frames.

---

## Phase 3: Celebration & Delight (emotional peak moments)

### 3.1 Confetti on PR Achievement

**Files:** `app/components/training/PRCelebration.tsx` (modify)
**Root cause:** PR is the emotional peak of a workout. Currently shows a banner with emoji trophy. No confetti, no particles.

**Implementation:**
1. Import `LottieView` from `lottie-react-native`
2. When PR is detected, render `<LottieView source={require('../../assets/animations/confetti.json')} autoPlay loop={false} />`
3. Position as full-screen overlay with `pointerEvents="none"`
4. Add `haptic.heavy()` on PR detection
5. Add brief screen shake: `withSequence(withTiming(-3), withTiming(3), withTiming(-2), withTiming(2), withTiming(0))` on translateX
6. Gold gradient background on the PR banner card

**Ripple effects:** None — overlay, doesn't affect layout.
**Risk:** NONE
**Testing:** Manual — log a set that beats previous best, verify confetti plays.

---

### 3.2 Animated Streak Indicator

**Files:** `app/components/dashboard/StreakIndicator.tsx` (modify)
**Root cause:** Completely static flame icon + number. No visual excitement for a gamification element.

**Implementation:**
1. Replace static flame icon with Lottie animated flame (`flame.json`)
2. Add counting animation on the number (Reanimated `useCountingValue`)
3. Add tier system with visual escalation:
   - 1-6 days: small flame, default color
   - 7-29 days: medium flame, orange glow
   - 30-99 days: large flame, gold glow + `glowShadow()`
   - 100+ days: large flame + particle embers (Lottie)
4. Pulse animation when streak increments (scale 1.0 → 1.2 → 1.0)
5. `haptic.success()` when streak increments

**Ripple effects:** StreakIndicator size may change — verify Dashboard layout.
**Risk:** LOW
**Testing:** Visual — verify all 4 tiers render correctly.

---

### 3.3 Achievement Celebration Modal Upgrade

**Files:** `app/components/achievements/CelebrationModal.tsx` (modify)
**Root cause:** Basic zoom-in card with static icon. No delight.

**Implementation:**
1. Add Lottie `fireworks.json` as background animation
2. Add Lottie `trophy.json` as the achievement icon (animated)
3. Staggered text reveal: title → description → CTA button with 200ms delays
4. Gold gradient border on the achievement card
5. `haptic.success()` on modal appear
6. Add `expo-blur` BlurView as backdrop instead of flat rgba overlay
7. Dismiss with scale-down + fade-out animation

**Ripple effects:** None — modal overlay.
**Risk:** LOW
**Testing:** Manual — trigger an achievement, verify full animation sequence.

---

### 3.4 Ring Completion Celebration

**Files:** `app/components/dashboard/ProgressRing.tsx` (modify)
**Root cause:** When a macro ring hits 100%, nothing happens. This should be a micro-reward.

**Implementation:**
1. Track previous fill value with `useRef`
2. When fill crosses from <1.0 to >=1.0:
   - Scale pulse: `withSequence(withSpring(1.15), withSpring(1.0))`
   - Brief glow: animate shadow opacity from 0 → 0.8 → 0 over 600ms
   - Haptic: `haptic.success()`
   - Optional: small Lottie checkmark overlay (200ms)
3. Only trigger once per session (not on every re-render)

**Ripple effects:** None — visual only.
**Risk:** LOW — must debounce to prevent repeated triggers.
**Testing:** Log food that pushes calories to 100% → verify celebration fires once.

---

### 3.5 Workout Complete Celebration

**Files:** `app/screens/training/WorkoutSummaryModal.tsx` (modify)
**Root cause:** Finishing a workout should feel like an accomplishment. Currently just shows a summary card.

**Implementation:**
1. Add Lottie confetti as background on the summary modal
2. Animated stat counters (total volume, duration, sets) using `useCountingValue`
3. If PRs were hit, show gold PR badges with staggered entrance
4. `haptic.heavy()` on modal appear
5. Gradient "Share Workout" CTA button
6. BlurView backdrop

**Ripple effects:** None — modal overlay.
**Risk:** LOW
**Testing:** Manual — finish a workout, verify celebration sequence.


---

## Phase 4: Premium Surfaces (revenue-impacting screens)

### 4.1 Redesign UpgradeModal with Bottom Sheet + Blur

**Files:** `app/components/premium/UpgradeModal.tsx` (rewrite)
**Root cause:** Revenue screen uses basic `<Modal>`. `@gorhom/bottom-sheet` is installed but unused here. This is the screen that converts free users to paid.

**Implementation:**
1. Replace `<Modal>` with `<BottomSheet>` from `@gorhom/bottom-sheet`
2. Snap points: `['65%', '90%']` — peek shows hero + CTA, expand shows full feature list
3. `BlurView` backdrop with `intensity={40}`
4. Hero section: Lottie animation or gradient illustration at top
5. Feature list with staggered entrance animation (Reanimated `FadeInDown.delay(i * 100)`)
6. Gradient CTA button ("Start Free Trial" / "Upgrade Now")
7. Social proof: "Join 10,000+ lifters" with animated counter
8. Price comparison: monthly vs yearly with savings badge
9. `haptic.medium()` on CTA press

**Ripple effects:** UpgradeModal is used in Dashboard, Profile, and feature-gated screens. Test all entry points.
**Risk:** MEDIUM — revenue-critical screen. A/B test if possible.
**Testing:** Manual — verify all entry points open the bottom sheet correctly. Verify purchase flow still works.

---

### 4.2 Glassmorphic Modal Backdrops

**Files:** `app/components/common/ModalContainer.tsx` (modify)
**Root cause:** All modals use flat `rgba(0,0,0,0.6)` overlay. BlurView backdrop is the premium standard.

**Implementation:**
1. Replace the backdrop `View` with `BlurView` from `expo-blur`
2. `intensity={30}`, `tint="dark"` for dark mode, `tint="light"` for light mode
3. Keep `TouchableWithoutFeedback` on backdrop for dismiss
4. Fallback: if BlurView fails (old Android), fall back to current rgba overlay

**Ripple effects:** ALL modals using ModalContainer get the upgrade automatically (4+ modals).
**Risk:** LOW — BlurView is well-tested. Fallback handles edge cases.
**Testing:** Visual — open any modal, verify blur backdrop on iOS + Android.

---

### 4.3 Shimmer Skeleton Rollout

**Files:** Replace `<Skeleton>` usage across all screens
**Root cause:** Opacity pulse skeletons look dated. Shimmer sweep is the modern standard.

**Implementation:**
1. Create `ShimmerSkeleton` (Phase 1.4)
2. Update the export in `app/components/common/Skeleton.tsx` to use the new shimmer version
3. Keep the same props interface — zero changes needed in consuming files
4. The shimmer uses `expo-linear-gradient` + Reanimated translateX

**Ripple effects:** Every screen that shows loading states gets the upgrade automatically.
**Risk:** LOW — same props, different visual.
**Testing:** Visual — Dashboard loading, Analytics loading, Logs loading.

---

### 4.4 Premium Badge Shimmer

**Files:** `app/components/premium/PremiumBadge.tsx` (modify)
**Root cause:** Static gold badge. Premium users should see a living, breathing indicator of their status.

**Implementation:**
1. Add a shimmer sweep animation across the badge text/icon
2. `LinearGradient` with animated translateX (same pattern as ShimmerSkeleton but gold colors)
3. Subtle scale pulse every 5 seconds: `withDelay(5000, withRepeat(withSequence(withSpring(1.05), withSpring(1.0)), -1))`

**Ripple effects:** None — visual only.
**Risk:** NONE
**Testing:** Visual — verify shimmer on Dashboard header.

---

### 4.5 Native Toast Notifications (replace Alert.alert for success)

**Files:** Multiple — wherever `Alert.alert('Success', ...)` is used
**Root cause:** Success confirmations use blocking `Alert.alert()` dialogs. Native toasts are non-blocking and feel premium.

**Implementation:**
1. Create `app/utils/toast.ts` using Reanimated for a custom toast (or use `burnt` if we install it)
2. For now, create a simple `<Toast>` component:
   - Slides in from top with `withSpring`
   - Auto-dismisses after 2 seconds
   - Success (green), Error (red), Info (blue) variants
   - Haptic on appear
3. Replace `Alert.alert('Success', ...)` calls with `toast.success('Logged!')`
4. Keep `Alert.alert` for destructive confirmations (delete, logout)

**Ripple effects:** Changes success feedback pattern across the app. Must be consistent.
**Risk:** LOW — additive, doesn't remove Alert.alert for destructive actions.
**Testing:** Manual — log food, verify toast appears and auto-dismisses.

---

## Phase 5: Data Visualization (making data feel alive)

### 5.1 Interactive Charts with Skia

**Files:** `app/components/charts/TrendLineChart.tsx` (rewrite)
**Root cause:** Current charts are static SVG polylines. No touch interaction, no animations, no gradient fills.

**Implementation:**
1. Replace `react-native-svg` chart with `victory-native-xl` (Skia-powered)
2. Line chart with:
   - Animated draw-in on mount (line draws from left to right)
   - Gradient area fill under the line (transparent at top → accent color at bottom)
   - Touch-to-scrub: finger on chart shows crosshair + tooltip with exact value
   - Smooth transitions when switching time ranges (line morphs to new data)
3. Keep the same data interface (`DataPoint[]`) for backward compatibility
4. Fallback: if Skia not available (web), keep current SVG implementation

**Ripple effects:** All screens using TrendLineChart get the upgrade. Verify Analytics, Dashboard weight trend, Measurements.
**Risk:** MEDIUM — chart rewrite. Keep old component as fallback.
**Testing:** Visual — verify all chart types render correctly. Test with 0, 1, 5, 100 data points.

---

### 5.2 Body Muscle Map Visualization

**Files:** `app/components/volume/BodyMuscleMap.tsx` (new)
**Root cause:** Volume data is shown as text/numbers. A visual body map with colored muscles is the signature feature of premium fitness apps (RP Hypertrophy, Fitbod).

**Implementation:**
1. Use existing `anatomicalPaths.ts` SVG data (already in codebase!)
2. Create a tappable SVG body map (front + back views)
3. Each muscle region colored by volume status:
   - Gray: untrained
   - Yellow: below MEV
   - Green: optimal (MEV-MRV)
   - Orange: approaching MRV
   - Red: above MRV
4. Animated color transitions when data changes (Reanimated `interpolateColor`)
5. Tap a muscle → navigate to that muscle's VolumeLandmarksCard detail
6. Pulsing glow on muscles that need attention (below MEV or above MRV)
7. Place on Analytics volume tab AND Dashboard (mini version)

**Ripple effects:** New component, opt-in. Analytics volume tab layout changes.
**Risk:** LOW — additive component using existing SVG data.
**Testing:** Visual — verify all muscle groups render and color correctly. Test tap navigation.

---

### 5.3 Animated Bar Charts for TDEE/Macros

**Files:** `app/screens/onboarding/steps/TDEERevealStep.tsx` (modify)
**Root cause:** TDEE bars use flat colors with basic width animation. Gradient fills would match the premium feel.

**Implementation:**
1. Replace flat `backgroundColor` on bars with `LinearGradient`
2. Use `gradientArrays` from tokens (BMR=blue, NEAT=green, EAT=orange, TEF=purple)
3. Add subtle glow behind the total TDEE number
4. Add a brief "calculating..." state (1.5s) with Lottie loading animation before reveal

**Ripple effects:** None — onboarding screen only.
**Risk:** NONE
**Testing:** Visual — complete onboarding to TDEE step, verify gradient bars.

---

### 5.4 Weekly Training Calendar Enhancement

**Files:** `app/components/dashboard/WeeklyTrainingCalendar.tsx` (modify)
**Root cause:** Static circles with checkmarks. No animation, no streak visualization.

**Implementation:**
1. Add fill animation when today's circle transitions from empty → trained (scale + color fill)
2. Add streak fire badge next to the calendar ("🔥 5" with animated flame from Phase 3.2)
3. Trained days get a subtle gradient fill instead of flat accent color
4. Add week navigation arrows (← →) to see previous weeks

**Ripple effects:** Dashboard layout — verify spacing.
**Risk:** LOW
**Testing:** Visual — log a workout, verify today's circle animates.

---

## Phase 6: Onboarding & Final Polish

### 6.1 Body Composition Step with Silhouettes

**Files:** `app/screens/onboarding/steps/BodyCompositionStep.tsx` (rewrite)
**Root cause:** Shows text cards with tiny colored bars. No body visualization. This is where users form their first impression of the app's visual quality.

**Implementation:**
1. Replace card grid with a central body silhouette SVG (reuse `anatomicalPaths.ts`)
2. Silhouette changes appearance based on selected BF% range:
   - Low BF (8-15%): lean silhouette, muscle definition visible
   - Medium BF (15-25%): moderate silhouette
   - High BF (25-35%): fuller silhouette
3. Animated transition between selections (Reanimated `interpolate` on path data or opacity crossfade between 3 silhouette variants)
4. Gender-specific silhouettes (male/female based on earlier onboarding step)
5. Selection cards below the silhouette with animated highlight
6. Haptic feedback on selection

**Ripple effects:** Onboarding flow — verify step navigation still works.
**Risk:** MEDIUM — rewriting an onboarding step. Test full onboarding flow.
**Testing:** Manual — complete full onboarding, verify body composition step renders correctly for all BF% ranges.

---

### 6.2 Pose Overlay Guides in Camera

**Files:** `app/screens/profile/ProgressPhotosScreen.tsx` (modify), camera component
**Root cause:** 4 SVG pose overlay assets exist in `poseOverlayLogic.ts` but are NEVER rendered. Users take inconsistent photos.

**Implementation:**
1. When camera is active, show semi-transparent SVG pose overlay
2. User selects pose type (front relaxed, front double bicep, side, back)
3. Overlay scales to fit camera preview using existing `computeContainTransform()`
4. Toggle overlay on/off with a button

**Ripple effects:** Camera screen layout changes.
**Risk:** LOW — additive overlay.
**Testing:** Manual — open camera, verify overlay appears and aligns with body.

---

### 6.3 Animated Tab Indicator

**Files:** `app/screens/logs/LogsScreen.tsx`, `app/screens/analytics/AnalyticsScreen.tsx`
**Root cause:** Tab switching is instant with no sliding indicator. Every premium app has a sliding underline.

**Implementation:**
1. Create `<AnimatedTabBar>` component with Reanimated `useAnimatedStyle`
2. Sliding indicator: `translateX` animates to the selected tab's position via `withSpring`
3. Indicator is a gradient pill (using `LinearGradient`)
4. Haptic on tab switch (`haptic.selection()`)

**Ripple effects:** Logs and Analytics tab bars change. Verify layout.
**Risk:** LOW
**Testing:** Visual — switch tabs, verify smooth sliding animation.

---

### 6.4 Scroll-to-Top on Tab Tap

**Files:** `app/navigation/BottomTabNavigator.tsx` (modify)
**Root cause:** Standard iOS pattern — tapping the active tab scrolls to top. Missing in Repwise.

**Implementation:**
1. Add `tabPress` listener on each tab
2. If already on the active tab, call `scrollRef.current?.scrollTo({ y: 0, animated: true })`
3. Each screen exposes a scroll ref via context or forwarded ref

**Ripple effects:** Requires each screen to expose its scroll ref. Start with Dashboard and Logs.
**Risk:** LOW
**Testing:** Manual — tap active tab, verify scroll to top.

---

### 6.5 Micro-interaction Polish Pass

**Files:** Various (10+ files)
**Root cause:** Many small interactions lack visual feedback. This is the final polish pass.

**Implementation:**
| Interaction | Animation | File |
|-------------|-----------|------|
| Pull-to-refresh | Custom Lottie spinner instead of default | DashboardScreen |
| Empty state illustrations | Lottie animations instead of static icons | EmptyState.tsx |
| Toggle switches | Scale bounce on toggle | Settings screens |
| Input focus | Border color transition (gray → accent) | TextInput wrapper |
| Error banner appear | Slide-down with spring | ErrorBanner.tsx |
| Success state | Checkmark Lottie animation | Various |
| Loading button | Gradient shimmer on button while loading | GradientButton |
| Card entrance | Staggered fade-in (already exists, verify coverage) | All list screens |

**Ripple effects:** Visual-only changes across many files.
**Risk:** LOW — each is independent.
**Testing:** Visual regression check on key screens.

---

## Dependency Graph

```
Phase 1 (Foundation) ──→ Phase 2 (Core Interactions)
                     ──→ Phase 3 (Celebrations)
                     ──→ Phase 4 (Premium Surfaces)
                     ──→ Phase 5 (Data Viz)
                     ──→ Phase 6 (Onboarding & Polish)

Phase 2 + 3 ──→ Phase 6 (Polish uses haptics + celebrations from earlier phases)
Phase 5 ──→ Phase 6.1 (Body composition uses Skia if available)
```

All phases depend on Phase 1 (library installs + primitives). Phases 2-5 can run in parallel after Phase 1.

---

## Risk Matrix

| Task | Risk | Why | Mitigation |
|------|------|-----|------------|
| 1.1 Library installs | MEDIUM | Native modules can break builds | Install one at a time, test after each |
| 2.1 Rest timer | MEDIUM | High-frequency component | Keep old timer as fallback |
| 4.1 UpgradeModal rewrite | MEDIUM | Revenue-critical | A/B test, keep old modal as fallback |
| 5.1 Chart rewrite | MEDIUM | Used on 5+ screens | Keep old SVG chart as web fallback |
| 6.1 Body composition rewrite | MEDIUM | Onboarding step | Test full onboarding flow |
| Everything else | LOW-NONE | Additive changes, new components | N/A |

---

## Estimated Timeline

| Sprint | Phase | Days | Deliverable |
|--------|-------|------|-------------|
| 1 | Phase 1 (Foundation) | 2 | All libs installed, primitives created |
| 2 | Phase 2 (Core) + Phase 3 (Celebrations) | 3 | Rest timer, gradient rings, confetti, haptics |
| 3 | Phase 4 (Premium) + Phase 5 (Data Viz) | 3 | Paywall redesign, interactive charts, body map |
| 4 | Phase 6 (Polish) | 2 | Onboarding, tab animations, micro-interactions |
| **Total** | | **10 days** | **11/10 UI** |

---

## What This Achieves

| Before | After |
|--------|-------|
| Flat solid colors | Gradient accents everywhere |
| Opacity pulse skeletons | Shimmer sweep loading |
| Static emoji celebrations | Confetti + Lottie + haptics |
| Text rest timer | Circular progress ring with pulse |
| Flat modal backdrops | Glassmorphic blur |
| Basic `<Modal>` paywall | Bottom sheet with hero animation |
| Static charts | Interactive touch-to-scrub Skia charts |
| Text-only volume data | Tappable body muscle map |
| No haptic feedback | Haptics on 15+ interactions |
| Static streak indicator | Animated flame with tier system |
| Text cards for body fat | Animated body silhouettes |
| `activeOpacity={0.7}` | Spring scale + haptic on press |

**The app goes from "well-built indie app" to "this feels like it was made by a team of 20 at Apple."**
