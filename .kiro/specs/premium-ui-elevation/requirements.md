# Premium UI Elevation — Requirements

## User Problem
> "The app works, but it doesn't feel premium. It feels like a developer built it, not a designer. I want it to feel like Linear, Stripe, or Apple — where every pixel is intentional."

The app has solid functionality and a good token system, but the visual execution doesn't match the "Bloomberg Terminal × elite training brand" aspiration. Specific gaps: inconsistent interaction states, missing micro-animations, flat visual hierarchy, no layered shadows, browser-default form elements on web, no loading skeletons, abrupt state transitions.

## User Stories

### US-1: Consistent Interaction States
As a user, I want every tappable element to have clear hover, active, focus, and disabled states so the app feels responsive and intentional.
- Acceptance: Every Button, Card, TouchableOpacity, TextInput has 4 states defined
- Acceptance: Hover state on web shows subtle border/bg change within 100ms
- Acceptance: Active/pressed state scales to 0.97 with 100ms spring
- Acceptance: Disabled state uses 0.4 opacity + no pointer events
- Acceptance: Focus ring uses `colors.border.focus` (#06B6D4) with 2px offset

### US-2: Layered Depth System
As a user, I want the UI to have clear visual hierarchy through layered shadows and backgrounds so I can instantly understand what's foreground vs background.
- Acceptance: Cards use 2-layer shadows (inner glow + outer shadow)
- Acceptance: Modals have backdrop blur + overlay + card shadow
- Acceptance: Raised elements feel "lifted" with subtle shadow + border highlight
- Acceptance: No single-value box-shadows anywhere — all shadows are multi-layered

### US-3: Smooth Transitions
As a user, I want all state changes to animate smoothly so nothing feels jarring or instant.
- Acceptance: Page transitions use shared-element-like slide + fade (250ms)
- Acceptance: Modal open/close uses scale(0.95→1) + opacity(0→1) with spring easing
- Acceptance: Tab switches have crossfade (no hard cut)
- Acceptance: List items stagger-enter with 50ms delay between items
- Acceptance: All transitions respect `prefers-reduced-motion`

### US-4: Premium Typography
As a user, I want text to feel crafted — proper tracking, optical sizing, and consistent hierarchy.
- Acceptance: Headings use -0.02em letter-spacing (tighter tracking)
- Acceptance: Body text uses 0em tracking
- Acceptance: All numeric values use tabular-nums
- Acceptance: Font loading is handled (no FOUT/FOIT)
- Acceptance: Text truncation uses ellipsis, never clips mid-character

### US-5: Polished Form Elements
As a user, I want all inputs to feel custom-designed — no browser defaults visible.
- Acceptance: TextInput has custom focus ring, placeholder styling, clear button
- Acceptance: Sliders/scales have custom thumb and track
- Acceptance: Selection/highlight color matches brand (#06B6D4)
- Acceptance: Scrollbars on web are thin, dark, auto-hiding

### US-6: Loading & Empty States
As a user, I want to see elegant loading states instead of blank screens or spinners.
- Acceptance: Every async screen has a skeleton loading state (pulsing placeholder shapes)
- Acceptance: Empty states have illustration + message + CTA (already exists, verify consistency)
- Acceptance: Error states have retry button + helpful message
- Acceptance: Skeleton pulse uses `colors.bg.surfaceRaised` → `colors.bg.surface` animation

### US-7: Micro-Interactions
As a user, I want small delightful moments that make the app feel alive.
- Acceptance: Success actions show brief checkmark animation
- Acceptance: Number changes animate (count-up/down)
- Acceptance: Progress rings animate on mount (already exists, verify smoothness)
- Acceptance: Pull-to-refresh has custom animation (not default spinner)
- Acceptance: Tab bar icon has subtle bounce on tap

## Non-Functional Requirements

### NFR-1: Performance
- All animations run at 60fps (use Reanimated worklets, not JS thread)
- No layout thrashing from animation-triggered re-renders
- Skeleton screens render within 16ms of navigation

### NFR-2: Consistency
- Zero hardcoded color values outside tokens.ts
- Zero hardcoded spacing values outside the spacing scale
- Zero hardcoded border-radius values outside the radius scale
- Every component uses the same press animation pattern

### NFR-3: Accessibility
- All interactive elements have minimum 44px touch target
- Color contrast ratios meet WCAG AA (4.5:1 for text, 3:1 for large text)
- Focus order is logical
- Screen reader labels on all icons

### NFR-4: Cross-Platform
- Web: custom scrollbars, hover states, cursor changes
- iOS: SF Pro Display font, haptic feedback on key actions
- Android: Material ripple where appropriate, status bar theming

## What's Out of Scope (v1)
- Light mode (dark-first, light mode is a separate effort)
- Custom icon library (continue using SVG inline icons)
- Lottie animations (too heavy for v1)
- Custom fonts beyond Inter/SF Pro (already configured)
- Redesigning information architecture or navigation structure
