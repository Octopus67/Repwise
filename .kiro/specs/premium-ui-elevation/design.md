# Premium UI Elevation — Design Document

## Design Philosophy

**Restraint over decoration.** Premium doesn't mean more — it means every detail is intentional. The goal is to make the existing UI feel like it was designed by a team that obsesses over craft. No new features, no layout changes — just elevating every visual detail from "good enough" to "world-class."

**Reference products:** Linear (interaction quality), Stripe (typography + spacing), Apple (depth + shadows), Vercel (minimalism), Arc Browser (color + personality), Raycast (speed + polish).

---

## 1. Token System Enhancements

### Current State
The token system in `app/theme/tokens.ts` is well-structured with colors, spacing, typography, radius, motion, and elevation. However:
- Elevation tokens are CSS box-shadow strings (not usable in React Native)
- No opacity tokens for consistent transparency
- No animation spring configs
- Missing `letterSpacing` tokens
- Missing `shadow` tokens in RN format (shadowColor/Offset/Opacity/Radius)

### Additions to tokens.ts

```typescript
// ─── Letter Spacing ──────────────────────────────────────────────────────────
export const letterSpacing = {
  tighter: -0.5,   // headings
  tight: -0.25,    // subheadings
  normal: 0,       // body
  wide: 0.5,       // labels, caps
} as const;

// ─── Shadows (React Native format) ──────────────────────────────────────────
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 0,
  }),
} as const;

// ─── Animation Configs ──────────────────────────────────────────────────────
export const springs = {
  gentle: { damping: 20, stiffness: 200, mass: 0.5 },
  snappy: { damping: 15, stiffness: 400, mass: 0.3 },
  bouncy: { damping: 10, stiffness: 300, mass: 0.5 },
} as const;

// ─── Opacity Scale ──────────────────────────────────────────────────────────
export const opacity = {
  disabled: 0.4,
  muted: 0.6,
  subtle: 0.08,
  hover: 0.12,
} as const;
```

---

## 2. Component Elevation Plan

### Phase 1: Foundation (tokens + global patterns)
These changes propagate to every component automatically.

| Change | Impact | Files |
|--------|--------|-------|
| Add letterSpacing, shadows, springs, opacity tokens | All components | `tokens.ts` |
| Update `usePressAnimation` hook to use spring config from tokens | Every pressable element | `hooks/usePressAnimation.ts` |
| Create `useHoverState` hook for web hover effects | All interactive elements on web | New hook |
| Standardize focus ring pattern | All focusable elements | Utility style |

### Phase 2: Core Components (12 common components)
These are used everywhere — polishing them has maximum leverage.

| Component | Current State | Elevation |
|-----------|--------------|-----------|
| **Button** | 4 variants, press animation, glow shadow on primary | Add hover state (web), tighter letter-spacing on label, loading skeleton, icon animation |
| **Card** | 3 variants, press + stagger animation | Add layered shadow (sm inner + md outer), hover border brightening on web, subtle gradient border on raised |
| **ProgressRing** | Animated SVG ring | Add glow effect on fill color, smoother spring animation, pulse on overshoot |
| **ProgressBar** | Basic bar | Add gradient fill, rounded ends, animated width transition |
| **EmptyState** | Emoji + text + CTA | Add subtle fade-in animation, illustration placeholder |
| **ModalContainer** | Basic overlay + card | Add backdrop blur, scale-in animation, layered shadow on card |
| **EditableField** | Text + edit mode | Add focus ring, smooth transition between view/edit modes |
| **Skeleton** | Exists | Verify pulse animation uses correct colors and timing |
| **FilterPill** | Chip selector | Add press scale, active state glow |
| **SwipeableRow** | Swipe actions | Add haptic feedback, smooth spring return |
| **SectionHeader** | Text header | Add letter-spacing, consistent sizing |
| **SetupBanner** | CTA banner | Add gradient background, press animation |

### Phase 3: Feature Components (38 remaining)
Grouped by visual similarity for batch updates.

**Cards & Display (12):** ExpenditureTrendCard, WeeklySummaryCard, ArticleCardCompact, TodaySummaryRow, MacroRingsRow, MealSlotDiary, MealSlotGroup, QuickActionButton, StreakIndicator, DateScroller, FeatureNavItem, PreviousPerformance
- Pattern: Apply Card elevation, consistent padding, hover states

**Inputs & Selectors (8):** SearchBar, CoachingModeSelector, WeeklyCheckinCard, TimeRangeSelector, CopyMealsBar, BudgetBar, WaterTracker, RestTimer
- Pattern: Custom focus rings, smooth value transitions, haptic feedback

**Modals (4):** AddNutritionModal, AddTrainingModal, AddBodyweightModal, QuickAddModal
- Pattern: Backdrop blur, scale-in animation, consistent close button, form field focus rings

**Nutrition (3):** BarcodeScanner, MealBuilder, SourceBadge
- Pattern: Consistent card styling, loading states

**Premium (3):** PremiumBadge, UpgradeBanner, UpgradeModal
- Pattern: Gold gradient accents, premium shadow treatment

**Charts (2):** TrendLineChart, TimeRangeSelector
- Pattern: Smooth data transitions, tooltip animations

**Exercise Picker (5):** ExerciseCard, MuscleGroupGrid, MuscleGroupIcon, RecentExercises, SearchBar
- Pattern: Grid animations, selection feedback, search focus

### Phase 4: Screens (28 screens)
Apply consistent patterns across all screens.

| Pattern | Screens Affected |
|---------|-----------------|
| Page enter animation (fade + slide up) | All 28 |
| Consistent header spacing | All 28 |
| Skeleton loading states | Dashboard, Logs, Analytics, Profile |
| Pull-to-refresh styling | Dashboard, Logs |
| Empty state design | All list screens |
| Scroll fade at top/bottom | All scrollable screens |

### Phase 5: Navigation & Global
| Change | Details |
|--------|---------|
| Tab bar | Add blur background, active indicator animation, icon bounce |
| Stack transitions | Refine slide + fade timing, add shared element hints |
| Status bar | Ensure light-content on all screens |
| Safe area | Consistent padding on all screens |

---

## 3. Interaction State Matrix

Every interactive element must implement ALL of these states:

| State | Visual Change | Timing |
|-------|--------------|--------|
| Default | Base styles | — |
| Hover (web) | Border brightens to `border.hover`, subtle bg shift | 150ms ease-out |
| Pressed | Scale 0.97, opacity 0.9 | 100ms spring |
| Focused | 2px ring in `border.focus` color, 2px offset | Instant |
| Disabled | Opacity 0.4, no pointer events | Instant |
| Loading | Skeleton pulse or spinner | — |

---

## 4. Shadow System

Replace all single-value shadows with layered shadows:

```
// Level 1: Subtle (cards, inputs)
shadow1: inner 0 1px 0 rgba(255,255,255,0.03) + outer 0 1px 3px rgba(0,0,0,0.2)

// Level 2: Medium (raised cards, dropdowns)
shadow2: inner 0 1px 0 rgba(255,255,255,0.05) + outer 0 4px 12px rgba(0,0,0,0.3)

// Level 3: High (modals, popovers)
shadow3: inner 0 1px 0 rgba(255,255,255,0.06) + outer 0 8px 24px rgba(0,0,0,0.4)

// Glow: Brand accent (primary buttons, active states)
glowCyan: 0 0 12px rgba(6,182,212,0.3)
glowGold: 0 0 12px rgba(212,175,55,0.3)
```

Note: React Native only supports a single shadow per View. For layered shadows, use nested Views (outer shadow View wrapping inner highlight View).

---

## 5. Typography Refinements

| Element | Current | Elevated |
|---------|---------|----------|
| Screen titles | 2xl/bold | 2xl/bold + letterSpacing.tighter (-0.5) |
| Section headers | md/semibold | md/semibold + letterSpacing.tight (-0.25) + uppercase option |
| Body text | base/regular | base/regular + lineHeight.relaxed (1.625) |
| Labels | sm/medium | sm/medium + letterSpacing.wide (0.5) + uppercase |
| Numbers | md/bold | md/bold + tabular-nums + letterSpacing.tight |
| Buttons | base/semibold | base/semibold + letterSpacing.wide (0.5) |

---

## 6. Animation Catalog

| Animation | Where Used | Config |
|-----------|-----------|--------|
| Press scale | All buttons, cards, chips | scale(0.97), spring: snappy |
| Stagger entrance | List items, grid items | translateY(8→0) + opacity(0→1), 50ms delay per item |
| Modal open | All modals | scale(0.95→1) + opacity(0→1), spring: gentle, 300ms |
| Modal close | All modals | scale(1→0.95) + opacity(1→0), 200ms ease-in |
| Tab switch | Bottom tabs | Crossfade opacity, 200ms |
| Progress fill | Rings, bars | withTiming 600ms, Easing.out |
| Number count | Calorie/macro displays | withTiming 400ms, Easing.out |
| Skeleton pulse | Loading states | opacity 0.3→0.7→0.3, 1500ms loop, ease-in-out |
| Success check | After save/log | scale(0→1.2→1) + opacity, 400ms spring |
| Shake error | Validation failure | translateX ±8px, 3 cycles, 300ms |

---

## 7. Pre-Ship Checklist

- [ ] Every interactive element has hover, active, focus, and disabled states
- [ ] All transitions use defined easing curves (no linear, no ease)
- [ ] All colors come from design tokens (no hardcoded hex values)
- [ ] All spacing uses the spacing scale (no arbitrary pixel values)
- [ ] All border-radius values are from the radius scale
- [ ] All shadows use the shadow system (no single-value shadows)
- [ ] All text follows the type scale with correct weights and tracking
- [ ] Scrollbars are custom styled (web)
- [ ] Selection color is branded (web)
- [ ] Focus rings are visible and beautiful
- [ ] Skeleton loading states exist for all async content
- [ ] Empty states are designed (not just blank space)
- [ ] Reduced motion preferences are respected
- [ ] No browser default form elements are visible
- [ ] All enter/exit animations are smooth
- [ ] The UI feels cohesive — like ONE designer made every screen

## What We're NOT Changing
- Layout structure (no moving elements around)
- Navigation architecture (same tabs, same stacks)
- Feature functionality (no new features)
- Information hierarchy (same content, same order)
- Color palette (same brand colors, just better application)
