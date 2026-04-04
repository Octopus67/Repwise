# Repwise Website — UI & Animation Refactor Prompt

## YOUR MISSION

You have already built (or are building) the Repwise marketing website based on the original build prompt (`WEBSITE-BUILD-PROMPT.md`). Now your job is to **refactor every single UI component and section** to be visually jaw-dropping, futuristic, and polished to an Apple-level standard. The website should make visitors think: "Whoever built this is a world-class engineer." Every pixel, every animation, every transition must feel intentional and premium.

This is NOT about adding more content. The content and structure stay the same. This is about making every existing element **10x more beautiful** through animations, micro-interactions, visual effects, and obsessive attention to detail.

---

## REFERENCE SITES (Study These for Inspiration)

These are the gold standard for dark, premium, animated websites:

| Site | What to Study |
|------|--------------|
| **linear.app** | Gradient mesh hero, scroll-pinned sections, subtle glow effects, feature card animations |
| **vercel.com** | Grid dot backgrounds, gradient text, scroll-triggered reveals, particle effects |
| **raycast.com** | Glassmorphism cards, spotlight glow effects, keyboard-first animations |
| **resend.com** | Minimal dark, code-focused reveals, clean transitions |
| **warp.dev** | Terminal-aesthetic dark theme, cyan/green accents, command-line animations |
| **clerk.com** | Dark SaaS, gradient borders, smooth scroll sections |
| **stripe.com** | Gradient mesh backgrounds, animated illustrations, micro-interactions |

The Repwise website should feel like it belongs alongside these sites.

---

## CRITICAL: LIBRARY NAME

The library formerly known as "framer-motion" has been rebranded to **"motion"**. Use:
```typescript
import { motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence, useVelocity, useReducedMotion } from "motion/react";
```
NOT `from "framer-motion"`. Install: `npm install motion`

Use `LazyMotion` with `domAnimation` features for bundle optimization (~5KB savings).

---

## GLOBAL EFFECTS (Apply Across Entire Site)

### 1. Smooth Scroll
Install and configure **Lenis** for buttery smooth scrolling:
```typescript
// In root layout or a provider
import Lenis from "lenis";

useEffect(() => {
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  return () => lenis.destroy();
}, []);
```

### 2. Custom Cursor
A subtle custom cursor that:
- Is a small cyan dot (8px) with a larger trailing ring (32px) that follows with spring physics
- Scales up on hoverable elements (buttons, links, cards)
- Changes to a "view" label on images/mockups
- Hides on mobile (touch devices)
```typescript
// Use useMotionValue + useSpring for smooth follow
const cursorX = useMotionValue(0);
const cursorY = useMotionValue(0);
const springX = useSpring(cursorX, { stiffness: 500, damping: 28 });
const springY = useSpring(cursorY, { stiffness: 500, damping: 28 });
```

### 3. Page Transitions
Smooth route transitions using the **FrozenRouter pattern** for Next.js App Router:
- Wrap page content in `AnimatePresence mode="wait"`
- Key on the current route segment
- Exit: fade out + slight slide up (200ms)
- Enter: fade in + slight slide up (300ms)
- Use `FrozenRouter` to freeze `LayoutRouterContext` during exit animation so components don't unmount prematurely

### 4. Scroll Progress Indicator
A thin cyan line at the very top of the viewport that fills left-to-right as the user scrolls:
```typescript
const { scrollYProgress } = useScroll();
// <motion.div style={{ scaleX: scrollYProgress, transformOrigin: "left" }} />
```

### 5. Reduced Motion Support
Always check `useReducedMotion()` and provide static fallbacks. This is non-negotiable for accessibility.

---

## SECTION-BY-SECTION UI REFACTOR

### Hero Section — Make It Cinematic

**Background:**
- Animated gradient mesh with 3-4 radial gradients that slowly drift and morph
- Colors: deep cyan `rgba(6,182,212,0.15)`, deep blue `rgba(59,130,246,0.08)`, subtle purple `rgba(139,92,246,0.05)` on the `#0A0E13` base
- Add a subtle dot grid overlay (like Vercel) using CSS: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)` with `background-size: 24px 24px`
- Faint horizontal scan lines for a futuristic feel (very subtle, 2% opacity)

**Headline Animation:**
- Split the headline into individual words
- Each word fades in + slides up with stagger (0.12s between words)
- Use `variants` with `staggerChildren`
- After all words appear, apply a subtle gradient shimmer across the text (animated `background-position` on `bg-clip-text`)
- The headline text should have a faint cyan glow: `text-shadow: 0 0 40px rgba(6,182,212,0.3)`

**Subheadline:**
- Fades in 0.5s after headline completes
- Slightly lighter animation (just opacity + translateY)

**Phone Mockup:**
- 3D perspective tilt that responds to mouse position:
```typescript
const mouseX = useMotionValue(0);
const mouseY = useMotionValue(0);
const rotateX = useTransform(mouseY, [-300, 300], [5, -5]);
const rotateY = useTransform(mouseX, [-300, 300], [-5, 5]);
// Apply with transformPerspective: 1200
```
- Floating animation: gentle `y: [0, -12, 0]` loop with `duration: 4, repeat: Infinity`
- Subtle reflection/shadow beneath the phone that moves with it
- A faint cyan glow behind the phone: `box-shadow: 0 0 120px 40px rgba(6,182,212,0.15)`
- The phone screen should show an actual app screenshot (or animated placeholder)

**CTA Button:**
- Magnetic effect: button subtly follows cursor when within 100px proximity
```typescript
// On mousemove within button container:
const dx = (cursorX - buttonCenterX) * 0.3;
const dy = (cursorY - buttonCenterY) * 0.3;
// Apply with useSpring for smooth snap-back on leave
```
- Gradient border that animates (rotating conic gradient)
- On hover: scale 1.05 + glow intensifies + gradient shifts
- On click: scale 0.97 (spring, stiffness: 400, damping: 17)
- Subtle particle burst on click (5-8 small cyan dots that fly outward and fade)

**App Store Badges:**
- Fade in with stagger after CTA
- Subtle hover: scale 1.05 + brightness increase

**Overall Hero Timing:**
1. Background gradient fades in (0-0.5s)
2. Headline words stagger in (0.3-1.2s)
3. Subheadline fades in (1.2-1.6s)
4. Phone mockup slides in from right with spring (0.8-1.5s)
5. CTA + badges fade in (1.5-2.0s)
6. Gradient shimmer starts on headline (2.0s+, loops)

---

### Social Proof Bar — Animated Counters

- Numbers animate from 0 to target using `useMotionValue` + `animate()` (zero re-renders)
- Trigger on `whileInView` with `viewport: { once: true }`
- Each stat staggers in (0.15s apart)
- Numbers use `font-variant-numeric: tabular-nums` and `JetBrains Mono` font
- Subtle dividers between stats: vertical line with gradient fade (transparent → white 30% → transparent)
- The entire bar has a very subtle glassmorphism: `backdrop-blur(8px)` + `bg-white/[0.03]` + `border-white/[0.05]`

---

### Problem Section — Collapse Animation

- The "3 apps" cards should be physically present, slightly rotated/scattered
- On scroll into view: the 3 cards animate together, overlap, and morph into the single Repwise card
- Use `layout` animations for the morph effect
- Price tags on each card with strikethrough animation
- The final Repwise card gets a cyan border glow pulse
- Background: subtle radial gradient centered on the Repwise card

---

### Bento Grid Features — Glassmorphism Cards

**Card Base Style:**
```css
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(16px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.06);
border-radius: 24px;
```

**Card Hover Effects:**
- Scale 1.02 with spring physics
- Border brightens: `rgba(6, 182, 212, 0.3)`
- Subtle inner glow: `box-shadow: inset 0 0 60px rgba(6,182,212,0.05)`
- A spotlight/gradient follows the cursor position within the card:
```typescript
// Track mouse position relative to card
// Apply radial-gradient at cursor position:
// background: radial-gradient(600px circle at ${x}px ${y}px, rgba(6,182,212,0.06), transparent 40%)
```

**Card Entrance:**
- Staggered fade-up with spring (staggerChildren: 0.1)
- Each card's internal content (icon, title, description) also staggers in after the card appears

**The Body Heat Map Card (hero card, 2x2):**
- The SVG body silhouette should animate: muscle groups light up one by one in sequence
- Colors pulse gently (breathing effect)
- On hover: the heat map becomes more vivid/saturated
- This is the most visually striking element — make it feel alive

**Feature Icons:**
- Each feature card has a small icon in a rounded square with a gradient background
- The gradient matches the feature's theme (cyan for science, green for nutrition, amber for analytics, etc.)
- Icons have a subtle float animation

---

### How It Works — Connected Steps

- Large faded numbers (01, 02, 03) behind each step — these should be in `text-[120px]` with `opacity-[0.03]` and animate to `opacity-[0.06]` on scroll
- Connecting line between steps: an SVG path that draws itself on scroll using `pathLength`:
```typescript
<motion.path
  d="M..."
  initial={{ pathLength: 0 }}
  whileInView={{ pathLength: 1 }}
  transition={{ duration: 1.5, ease: "easeInOut" }}
/>
```
- Each step's icon has a pulsing glow ring behind it
- Phone mockups for each step slide in from alternating sides (left, right, left)
- The active step (in viewport) has brighter styling; others are dimmed

---

### Science Section — The Showstopper

This section should feel like entering a research lab. It's where Repwise's credibility lives.

**Background:**
- Subtle topographic/contour line pattern (SVG) with very low opacity (2-3%)
- Or: animated grid that subtly pulses outward from center

**Body Heat Map (Centerpiece):**
- Large SVG, centered, with muscle groups that animate in sequence
- Each muscle group fades from dark to its heat color over 2 seconds, staggered
- Annotation lines draw themselves from muscle groups to text labels
- On hover over a muscle group: it brightens + shows a tooltip with volume data
- The entire SVG has a subtle cyan ambient glow behind it

**Feature Deep-Dive Cards:**
- 4 cards arranged around the body heat map (2 left, 2 right on desktop)
- Each card has a small animated icon/illustration
- Cards connect to the body map with faint dotted lines
- Scroll-triggered entrance: cards slide in from their respective sides

**Data Visualizations:**
- Show mini animated charts within this section:
  - A volume landmark bar that fills to MEV → MAV → MRV with color transitions
  - A fatigue gauge that animates its needle
  - An RPE color scale that lights up segment by segment
- These should feel like real-time data, not static images

---

### Competitor Comparison Table — Clean & Impactful

- Table rows stagger in on scroll
- Checkmarks (✅) animate: scale from 0 → 1 with a spring bounce
- X marks (❌) fade in with a subtle red flash
- The Repwise column has a highlighted background (subtle cyan tint)
- Header row is sticky within the table scroll
- On mobile: horizontal scroll with the Repwise column pinned/sticky
- The price row at the bottom has the competitor prices in strikethrough with a red tint, Repwise price in bold cyan

---

### Testimonials — Floating Cards

- Cards arranged in a slight 3D perspective (like a card fan)
- Auto-rotating carousel with smooth spring transitions
- Each card has:
  - Glassmorphism background
  - Quote marks in large, faded cyan
  - Star rating with gold (#D4AF37) animated fill
  - Avatar with a subtle ring border
- Drag/swipe to navigate on mobile
- Dots indicator at bottom with active dot in cyan

---

### Pricing Section — Premium Feel

- Cards have a subtle floating animation (different phase for each card)
- The Premium card:
  - Gold (#D4AF37) gradient border that slowly rotates (animated conic-gradient)
  - "MOST POPULAR" badge with a shimmer animation
  - Slightly elevated (larger shadow, scale 1.02 vs free card)
  - Background has a very subtle gold radial gradient
- Monthly/Yearly toggle:
  - Smooth sliding pill animation
  - When switching: prices animate (counter from old to new value)
  - "Save 33%" badge bounces in when yearly is selected
- Feature list items check-mark animate in with stagger on card entrance
- CTA buttons: same magnetic + glow effect as hero CTA

---

### Screenshot Carousel — 3D Perspective

- Phone mockups arranged in a 3D arc (like a carousel in physical space)
- The center phone is largest and fully visible; side phones are smaller, rotated, and slightly faded
- Smooth spring-based transitions when navigating
- Auto-advance every 4 seconds with a progress bar under each phone
- On hover: pause auto-advance
- Swipe support on mobile
- Each phone has a subtle reflection below it (CSS gradient mask)
- Background: subtle radial glow behind the center phone

---

### FAQ — Smooth Accordions

- Each accordion item:
  - Smooth height animation using `layout` prop (NOT `height: auto` hack)
  - The + icon rotates 45° to become × when open
  - Content fades in + slides down with spring
  - Active item has a subtle left border in cyan
- Staggered entrance on scroll

---

### Final CTA — Grand Finale

- This section should feel like a crescendo
- Background: animated gradient that's more vivid than the rest of the page (deeper cyans, subtle purples)
- Headline: large, with the gradient shimmer text effect
- Floating particles (15-20 small cyan dots) drifting upward slowly (canvas-based, pause when off-screen)
- The CTA button here should be the largest and most prominent on the page
- App Store badges with a subtle glow
- A faint "aurora" effect: wide, blurred gradient bands that slowly shift

---

### Header — Transparent to Solid

- Starts fully transparent over the hero
- On scroll (past hero): transitions to `backdrop-blur(12px)` + `bg-base/80` + bottom border appears
- Use `useScroll` + `useTransform` for smooth opacity transition (not a binary toggle)
- Logo has a subtle hover animation (slight rotation or glow)
- Nav links: underline slides in from left on hover (not instant)
- CTA button in header: smaller version of the magnetic button
- Mobile hamburger: morphs from ☰ to ✕ with SVG path animation

---

### Footer — Clean & Minimal

- Subtle top border with gradient (transparent → cyan → transparent)
- Links have the same underline-slide hover effect
- Social icons: scale + glow on hover
- "Built with 💪 for serious lifters" tagline
- Subtle background: slightly lighter than page base (#0D1117)

---

## ANIMATION PERFORMANCE RULES (NON-NEGOTIABLE)

1. **Only animate `transform` and `opacity`** — these are GPU-composited (S-Tier). Never animate `width`, `height`, `margin`, `padding`.
2. **Use `will-change` sparingly** — only on elements that are actively animating. Remove after animation completes.
3. **Pause off-screen animations** — use `IntersectionObserver` or `viewport: { once: true }` for one-shot animations. For looping animations (particles, gradients), pause when not visible.
4. **Canvas for 50+ particles** — DOM particles are fine for <20 elements. Beyond that, use Canvas 2D.
5. **`contain: layout`** — add to animated containers to prevent layout recalculation propagation.
6. **Lazy load below-fold** — use `next/dynamic` for heavy animation components (carousel, particles, 3D effects).
7. **Target: Lighthouse 95+** on all metrics. Animations must not compromise performance.
8. **Test on mobile** — reduce particle counts, simplify 3D effects, disable custom cursor on touch devices.
9. **`useReducedMotion()`** — provide static, non-animated versions for users who prefer reduced motion.
10. **Bundle size** — use `LazyMotion` with `domAnimation` features. Don't import the full motion bundle.

---

## SPRING CONFIGS (Use Consistently)

```typescript
export const springs = {
  // For interactive elements (buttons, hover states)
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },

  // For entrance animations
  smooth: { type: "spring" as const, stiffness: 100, damping: 20 },

  // For playful elements (badges, celebrations)
  bouncy: { type: "spring" as const, stiffness: 300, damping: 10 },

  // For subtle movements (floating, breathing)
  gentle: { type: "spring" as const, stiffness: 50, damping: 15 },

  // Apple iOS default (for familiar feel)
  apple: { type: "spring" as const, stiffness: 170, damping: 26 },
};
```

---

## COLOR ENHANCEMENTS

Beyond the base design system, add these for the futuristic feel:

```typescript
// Glow effects
glow: {
  cyan: "0 0 40px rgba(6, 182, 212, 0.3)",
  cyanIntense: "0 0 80px rgba(6, 182, 212, 0.4)",
  gold: "0 0 40px rgba(212, 175, 55, 0.3)",
  white: "0 0 30px rgba(255, 255, 255, 0.1)",
}

// Gradient presets
gradients: {
  cyanToBlue: "linear-gradient(135deg, #06B6D4, #3B82F6)",
  cyanToPurple: "linear-gradient(135deg, #06B6D4, #8B5CF6)",
  goldShimmer: "linear-gradient(90deg, #D4AF37, #F5D77A, #D4AF37)",
  darkRadial: "radial-gradient(ellipse at center, rgba(6,182,212,0.08), transparent 70%)",
  meshBg: "radial-gradient(at 20% 30%, rgba(6,182,212,0.12) 0%, transparent 50%), radial-gradient(at 80% 70%, rgba(59,130,246,0.08) 0%, transparent 50%), radial-gradient(at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 50%)",
}

// Glassmorphism presets
glass: {
  light: "bg-white/[0.03] backdrop-blur-md border border-white/[0.06]",
  medium: "bg-white/[0.05] backdrop-blur-lg border border-white/[0.08]",
  heavy: "bg-white/[0.08] backdrop-blur-xl border border-white/[0.12]",
  cyan: "bg-cyan-500/[0.05] backdrop-blur-lg border border-cyan-500/[0.15]",
}
```

---

## REUSABLE ANIMATION COMPONENTS TO BUILD

Create these as shared components in `components/ui/`:

### 1. `<AnimatedText>`
- Props: `text`, `as` (h1/h2/p), `animation` ("words" | "chars" | "lines"), `delay`, `className`
- Splits text and applies staggered entrance animation
- Supports gradient shimmer after entrance

### 2. `<MagneticButton>`
- Props: `children`, `className`, `strength` (0-1)
- Follows cursor within proximity zone
- Spring snap-back on mouse leave
- Scale down on press, scale up on hover

### 3. `<GlassCard>`
- Props: `children`, `className`, `spotlight` (boolean)
- Glassmorphism styling
- Optional: cursor-following spotlight gradient
- Hover: border brightens, subtle scale

### 4. `<AnimatedCounter>`
- Props: `value`, `duration`, `prefix`, `suffix`
- Animates from 0 to value using `useMotionValue`
- Triggers on `whileInView`
- Uses tabular nums

### 5. `<ParallaxSection>`
- Props: `children`, `speed` (multiplier), `className`
- Applies parallax offset based on scroll position

### 6. `<ScrollReveal>`
- Props: `children`, `direction` ("up" | "down" | "left" | "right"), `delay`, `className`
- Wraps any content with scroll-triggered entrance animation
- Uses `whileInView` with `viewport: { once: true }`

### 7. `<PhoneMockup>`
- Props: `screenshot`, `className`, `tilt` (boolean), `float` (boolean)
- 3D phone frame with screenshot inside
- Optional: mouse-tracking tilt
- Optional: floating animation
- Reflection/shadow beneath

### 8. `<GradientMesh>`
- Background component with animated radial gradients
- Slow-drifting color blobs
- Used in hero and final CTA sections

### 9. `<DrawPath>`
- Props: `d` (SVG path), `className`, `duration`
- SVG path that draws itself on scroll using `pathLength`

### 10. `<SpotlightCard>`
- Like GlassCard but with a radial gradient that follows the mouse cursor within the card
- The gradient is very subtle (6-8% opacity) and creates a "flashlight" effect

---

## WHAT THE FINAL RESULT SHOULD FEEL LIKE

When someone visits repwise.app, they should experience:

1. **First 0-2 seconds**: Cinematic hero loads — gradient mesh fades in, headline words cascade in, phone mockup floats into position. They immediately feel "this is premium."

2. **Scrolling down**: Every section reveals itself with purpose. Nothing pops in jarringly. Elements slide, fade, and spring into place. The scroll feels buttery smooth (Lenis).

3. **Interacting**: Buttons feel magnetic. Cards respond to their cursor with spotlight effects. The custom cursor adds a layer of polish. Everything has spring physics — nothing feels linear or robotic.

4. **The Science Section**: This is the "wow" moment. The body heat map animates to life, annotation lines draw themselves, data visualizations pulse with simulated data. It feels like a mission control dashboard.

5. **The Pricing Section**: The premium card with its rotating gold border and shimmer badge makes the upgrade feel aspirational, not pushy.

6. **Overall impression**: "This website was built by someone who deeply understands both fitness AND engineering. If the website is this polished, the app must be incredible."

The website should feel like **Linear meets Stripe meets a premium fitness brand** — dark, data-rich, animated, and impossibly polished.

---

## PRIORITY ORDER

If you can't do everything at once, prioritize in this order:

1. Smooth scroll (Lenis) + page transitions
2. Hero section (gradient mesh, text animation, 3D phone, magnetic CTA)
3. Bento grid cards (glassmorphism, spotlight effect, stagger entrance)
4. Science section (body heat map animation, data viz)
5. Custom cursor
6. All other section animations
7. Screenshot carousel 3D
8. Particle effects in final CTA

---

## DO NOT

- Do NOT change the content, copy, or page structure from the original build prompt
- Do NOT add new sections or pages
- Do NOT use GSAP (stick to Motion + CSS for consistency and bundle size)
- Do NOT animate `width`, `height`, `margin`, or `padding` — only `transform` and `opacity`
- Do NOT use heavy WebGL/Three.js — CSS 3D transforms and Canvas 2D are sufficient
- Do NOT sacrifice Lighthouse scores for animations — if it drops below 90, simplify
- Do NOT forget `useReducedMotion()` fallbacks
- Do NOT use `"framer-motion"` imports — use `"motion/react"`
