# Repwise 11/10 UI Plan — FINAL (v3)

**Date:** April 5, 2026
**Philosophy:** Bloomberg Terminal precision + Peloton emotional peaks. Serious AND celebratory. Data-dense AND alive.
**Bundle impact:** ~230KB new dependencies
**Timeline:** 11 days

---

## What's Different From v2

| Change | Reasoning |
|--------|-----------|
| Gold particle burst replaces flat gold flash | A PR is the peak of a month of training. 15 gold particles in 0.4s = restrained but unmistakable. |
| 3 streak tiers (not 2) | 2 tiers means day-8 and day-365 look identical. 3 tiers give users a visible progression goal. |
| 3 Lottie assets (not 1) | Branded loader + empty state animation. The default ActivityIndicator screams "generic app." |
| GlassCard restored for messaging cards | Blur on data = bad. Blur on prompts/nudges/upsells = premium depth. |
| Custom display font added | Inter is on every app. General Sans/Satoshi for headings = instant brand identity. |
| Number count animations rolled out everywhere | `useCountingValue` already exists but is underused. Every number change should animate. |
| Abstract onboarding illustrations added | 10-step onboarding with just text fields = forgettable. Geometric animations = "precision instrument." |
| Skia still cut | SVG handles gradient rings. 3MB not justified. Revisit post-launch if needed. |
| Sound design deferred | Polarizing in gym environment. Ship haptics first, add sound as toggle post-launch. |

---

## Libraries: Final Final List

| Library | Size | Purpose |
|---------|------|---------|
| `expo-linear-gradient` | 12KB | Gradients: buttons, skeletons, bars, rings, tab indicators |
| `expo-blur` | 15KB | Modal backdrops, messaging card depth |
| `@shopify/flash-list` | 40KB | 5-10x faster lists |
| `lottie-react-native` | 150KB | Streak flame, branded loader, empty state |
| **Already installed:** `@gorhom/bottom-sheet`, `expo-haptics`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-svg` | 0KB | Bottom sheets, haptics, animations, gestures, SVG gradients |
| **Custom font:** General Sans (or Satoshi) | ~50KB | Display headings |
| **Total new** | **~267KB** | |

---

## 6 Phases, 35 Tasks

### Phase 1: Foundation (5h)
| # | Task | Files | Risk |
|---|------|-------|------|
| 1.1 | Install 4 libraries + custom font | package.json, app.json | MEDIUM |
| 1.2 | Create `<GradientButton>` | components/common/GradientButton.tsx (new) | NONE |
| 1.3 | Create `<ShimmerSkeleton>` | components/common/Skeleton.tsx (modify) | LOW |
| 1.4 | Create `<GlassCard>` for messaging cards | components/common/GlassCard.tsx (new) | LOW |
| 1.5 | Create haptics utility | utils/haptics.ts (new) | NONE |
| 1.6 | Add gradient arrays + display font to tokens | theme/tokens.ts (modify) | NONE |
| 1.7 | Download 3 Lottie assets (flame, loader, empty-barbell) | assets/animations/ (new) | NONE |

### Phase 2: Feel — Haptics + Motion (10h)
| # | Task | Files | Risk |
|---|------|-------|------|
| 2.1 | Wire haptics to 15+ interactions | 15+ files | NONE |
| 2.2 | Reanimated layout animations (entering/exiting on list items) | ActiveWorkoutBody, ExerciseCard, LogsScreen, FeedScreen | LOW |
| 2.3 | AnimatedPressable rollout (top 10 touchpoints) | 10 component files | LOW |
| 2.4 | Circular rest timer ring with pulse | FloatingRestTimerBar.tsx | MEDIUM |
| 2.5 | FlashList migration (3 heaviest lists) | ExercisePickerScreen, LogsScreen, FeedScreen | LOW |
| 2.6 | Gesture expansion (long-press, drag-reorder, swipe-days) | ActiveWorkoutBody, LogsScreen, ExerciseCard | MEDIUM |
| 2.7 | Roll out useCountingValue to ALL number displays | Dashboard, Analytics, Logs, Profile | LOW |

### Phase 3: Visual Layer (7h)
| # | Task | Files | Risk |
|---|------|-------|------|
| 3.1 | Gradient macro rings (SVG LinearGradient + completion celebration) | ProgressRing.tsx, MacroRingsRow.tsx | LOW |
| 3.2 | Shimmer skeleton rollout (replace opacity pulse globally) | Skeleton.tsx (already modified in 1.3) | LOW |
| 3.3 | Gradient CTA buttons (Start Workout, Log Food, Upgrade, Finish) | 8+ screens | LOW |
| 3.4 | Blur modal backdrops | ModalContainer.tsx | LOW |
| 3.5 | GlassCard on messaging cards (WeeklyCheckin, Nudge, UpgradeBanner, Recovery) | 4 card components | LOW |
| 3.6 | Premium badge gold shimmer sweep | PremiumBadge.tsx | NONE |
| 3.7 | Custom display font on all headings (H1, H2) | Typography tokens + screen headers | LOW |

### Phase 4: Emotional Peaks (6h)
| # | Task | Files | Risk |
|---|------|-------|------|
| 4.1 | PR gold particle burst (15 particles, 0.4s, Reanimated) + screen shake + heavy haptic | PRCelebration.tsx | LOW |
| 4.2 | Animated streak flame (Lottie) with 3 tiers (Building/Committed/Legendary) | StreakIndicator.tsx | LOW |
| 4.3 | Ring completion micro-celebration (scale pulse + glow + haptic) | ProgressRing.tsx | LOW |
| 4.4 | Workout complete enhancement (animated counters, staggered entrance, gold PR badges, blur backdrop) | WorkoutSummaryModal.tsx | LOW |
| 4.5 | Branded Lottie loading spinner (replace ActivityIndicator) | Loading states across app | LOW |

### Phase 5: Data Comes Alive (10h)
| # | Task | Files | Risk |
|---|------|-------|------|
| 5.1 | Body muscle map (tappable SVG, colored by volume, animated transitions) | BodyMuscleMap.tsx (new), Analytics volume tab | LOW |
| 5.2 | Enhanced charts (gradient area fill, draw-in animation, touch-to-scrub) | TrendLineChart.tsx | MEDIUM |
| 5.3 | Shared element transitions (exercise card → detail, muscle → volume detail) | Navigation config, 2-3 screen pairs | MEDIUM |
| 5.4 | Abstract onboarding illustrations (geometric Reanimated animations per step) | 5 onboarding step files | MEDIUM |

### Phase 6: Premium Surfaces (6h)
| # | Task | Files | Risk |
|---|------|-------|------|
| 6.1 | Paywall redesign (bottom sheet + blur + gradient CTA + staggered features) | UpgradeModal.tsx | MEDIUM |
| 6.2 | Body composition silhouettes in onboarding | BodyCompositionStep.tsx | MEDIUM |
| 6.3 | Animated tab indicator (sliding gradient pill) | LogsScreen, AnalyticsScreen | LOW |
| 6.4 | Pose overlay guides in camera | ProgressPhotosScreen.tsx | LOW |
| 6.5 | Empty state Lottie animation (barbell) | EmptyState.tsx | LOW |
| 6.6 | Custom toast notifications (replace Alert.alert for success) | New Toast component + 10+ screens | LOW |

---

## The Emotional Design Map

| Moment | What the user feels | What they see + feel |
|--------|---------------------|---------------------|
| **First open** | "This is different" | Custom font, shimmer loading, dark precision aesthetic |
| **Onboarding** | "This knows what it's doing" | Abstract geometric animations, smooth step transitions |
| **Dashboard load** | "My data, beautifully presented" | Gradient macro rings with spring animation, shimmer → data |
| **Log a set** | "Satisfying" | Scale press animation + haptic.success() + layout animation |
| **Complete a set** | "Progress" | Checkmark scale + haptic + ring fills slightly more |
| **Hit a PR** | "I AM A GOD" | Gold particle burst + screen shake + heavy haptic + gold banner |
| **Finish workout** | "Accomplished" | Animated stat counters + staggered PR badges + blur backdrop |
| **Rest timer** | "Controlled intensity" | Circular ring depleting + pulse at <10s + haptic at 0 |
| **View analytics** | "I understand my body" | Interactive charts with touch scrub + body muscle map |
| **Hit streak milestone** | "I'm unstoppable" | Flame tier upgrade + glow + haptic.success() |
| **Ring hits 100%** | "Target hit" | Scale pulse + glow shadow + haptic |
| **See upgrade prompt** | "This is worth paying for" | Bottom sheet + blur + gradient CTA + feature stagger |
| **Empty state** | "I want to fill this" | Animated barbell + encouraging copy + gradient CTA |

---

## Before → After (Complete)

| Element | Before (8/10) | After (11/10) |
|---------|---------------|---------------|
| Typography | Inter everywhere | General Sans headings + Inter body |
| Buttons | Flat solid color | Gradient fill + scale animation + haptic |
| Loading | Opacity pulse | Shimmer sweep + branded Lottie spinner |
| Modals | Flat rgba backdrop | Blur glassmorphism |
| Messaging cards | Flat surface | GlassCard with subtle blur depth |
| Data cards | Flat surface | Flat surface (unchanged — readability first) |
| Macro rings | Solid color, 96px | Gradient stroke, 112px, completion celebration |
| Rest timer | Text counter bar | Circular SVG ring with pulse + haptic |
| PR moment | Emoji trophy banner | Gold particle burst + screen shake + heavy haptic |
| Streak | Static text + icon | Animated Lottie flame, 3 tiers, gold glow |
| Charts | Static SVG polyline | Gradient fill, draw-in, touch-to-scrub |
| Volume data | Text/numbers | Tappable body muscle map |
| Lists | FlatList | FlashList (5-10x faster) |
| Gestures | Tap only | Long-press menus, drag-reorder, swipe nav |
| Transitions | Instant screen swap | Shared element morphing |
| Numbers | Instant swap | Animated counting (up/down) |
| Press feedback | activeOpacity 0.7 | Spring scale (0.97) + haptic |
| List items | Pop in/out | Animated entering/exiting |
| Onboarding | Text + form fields | Abstract geometric illustrations |
| Body fat step | Text cards | Animated body silhouettes |
| Paywall | Basic Modal | Bottom sheet + blur + gradient CTA |
| Empty states | Static icon | Animated Lottie barbell |
| Success feedback | Alert.alert() | Custom toast (slide-in, auto-dismiss) |
| Haptics | 2 files | 15+ interactions |
| App icon | Static | Static (animated deferred) |
| Widget | None | None (deferred, on roadmap) |
