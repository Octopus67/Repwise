# Repwise Website Design Plan

**Domain:** repwise.app | **Hosting:** Vercel | **Company:** Octopus Labs
**Design DNA:** Bloomberg Terminal × modern fintech × elite training brand
**Theme:** Dark ONLY (no light mode toggle) | **Tagline:** Science-Based Fitness: Training + Nutrition in One App
**Reference Sites:** linear.app, vercel.com, raycast.com, resend.com, warp.dev, clerk.com, stripe.com

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 15** (App Router) | SSR for SEO, React ecosystem |
| Styling | **Tailwind CSS v4** | Rapid development, dark theme utilities |
| Animations | **motion** (`import from "motion/react"`) | Scroll-triggered, spring physics |
| Smooth Scroll | **Lenis** | Buttery smooth scrolling |
| Hosting | **Vercel** | Zero-config Next.js, edge CDN |
| Analytics | **PostHog** (cookieless mode) | No cookie banner needed |
| Images | **Next.js Image** component | Optimized loading |
| Fonts | **Inter** via `next/font`, **JetBrains Mono** for data | Matches the app |
| Icons | **Lucide React** | Clean, consistent |
| Language | **TypeScript** (strict mode) | Type safety |

> **CRITICAL:** Use `import { motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence, useReducedMotion } from "motion/react"` — NOT `"framer-motion"`. Use `LazyMotion` + `domAnimation` for bundle optimization.

---

## Phase 1: Information Architecture & Content Strategy

### 1.1 Sitemap

```
repwise.app/
├── / ........................ Homepage (conversion engine — 13 sections)
├── /features ................ Full feature breakdown (10 categories)
├── /pricing ................. Pricing + full comparison table
├── /about ................... Founder story + mission
├── /blog .................... MDX blog (categories: Training, Nutrition, Body Comp, Updates, Science)
│   └── /blog/[slug] ........ Individual post
├── /download ................ Smart platform redirect (iOS/Android/desktop)
├── /privacy ................. Privacy Policy
├── /terms ................... Terms of Service
└── /* ....................... 404 page
```

### 1.2 Content Hierarchy — Homepage (13 Sections)

| # | Section | Purpose | Key Element |
|---|---------|---------|-------------|
| 1 | Nav bar | Logo + links + CTA | Fixed, glassmorphism, transparent on hero |
| 2 | Hero | Hook + 3D phone + download CTA | Gradient mesh bg, word-by-word headline |
| 3 | Social proof bar | Trust signals (animated counters) | 300K+ foods, 27 micronutrients, 4 PR types |
| 4 | Problem section | Pain: "Stop Juggling 3 Apps" | 3-card collapse animation |
| 5 | Bento grid features | Core value props (6 glass cards) | SVG body heat map as hero card |
| 6 | How it works (3 steps) | Reduce friction | SVG path drawing, phone mockups |
| 7 | Science section | Credibility | Body heat map centerpiece, data viz |
| 8 | Full feature list | 60+ features, 10 categories | Expandable accordion |
| 9 | Competitor comparison | Why switch | Animated table rows |
| 10 | Testimonials | Social proof | 3D card fan carousel |
| 11 | Pricing | Convert | Floating cards, gold rotating border |
| 12 | Screenshot carousel | Visual proof | 3D arc perspective |
| 13 | FAQ | Objection handling | Layout animations |
| 14 | Final CTA | Last chance conversion | Aurora effect, particles |
| 15 | Footer | Links, legal, community | Gradient top border |

### 1.3 SEO Strategy

**Meta tags per page:**
- Homepage: `<title>Repwise — Science-Based Fitness: Training + Nutrition in One App</title>`
- Features: `<title>Features — Repwise</title>`
- Pricing: `<title>Pricing — Repwise</title>`
- About: `<title>About — Repwise</title>`
- Blog: `<title>Blog — Repwise</title>`
- Download: `<title>Download Repwise</title>`
- Privacy/Terms: `<title>Privacy Policy / Terms of Service — Repwise</title>`

**Structured data (JSON-LD):** `SoftwareApplication`, `Organization`, `BreadcrumbList`, `FAQPage`, `BlogPosting`

**Target keywords:** adaptive TDEE tracker, hypertrophy training app, macro tracking app, progressive overload tracker, volume landmarks, smart nutrition tracker, WNS hypertrophy units, body heat map fitness

**Technical SEO:** Canonical URLs, `robots.txt`, sitemap generation, OG + Twitter cards, `lang="en"`, semantic HTML5

### 1.4 Content Inventory

| Content | Status | Action |
|---------|--------|--------|
| Privacy Policy | ✅ Exists | Render with good typography |
| Terms of Service | ✅ Exists | Render with good typography |
| App icon | ✅ Exists | Nav + favicon |
| Hero headline options | ✅ In build prompt | Pick best or create new |
| Feature descriptions (60+) | ✅ In build prompt | Structured in constants.ts |
| Competitor comparison data | ✅ In build prompt | Structured in constants.ts |
| FAQ content (7 items) | ✅ In build prompt | Structured in constants.ts |
| Testimonials | ❌ Placeholder | Mark clearly as placeholders |
| App screenshots (10) | ❌ Placeholder | Colored rectangles with screen names |
| SVG body heat map | ❌ Needs creation | Front + back silhouette, color-coded |
| OG share image | ❌ Needs creation | 1200×630, dark bg + logo + screenshot |
| Blog posts (3-5) | ❌ Placeholder | MDX stubs |
| App Store badges | ❌ Need SVGs | Official badge SVGs |

---

## Phase 2: Visual Design System

### 2.1 Color System

| Token | Hex | Usage |
|-------|-----|-------|
| bg.base | `#0A0E13` | Page background |
| bg.surface | `#12171F` | Cards, sections with depth |
| bg.raised | `#1A2029` | Hover states, elevated cards |
| bg.overlay | `#232A35` | Modals, overlays |
| accent.primary | `#06B6D4` | CTAs, links, active states (7.4:1 AAA) |
| accent.primaryHover | `#0891B2` | Button/link hover (6.1:1 AA) |
| accent.primaryMuted | `rgba(6,182,212,0.15)` | Subtle accent backgrounds |
| text.primary | `#F1F5F9` | Headings, body (15.3:1 AAA) |
| text.secondary | `#94A3B8` | Captions, descriptions (7.1:1 AA) |
| text.tertiary | `#64748B` | Disabled, hints |
| text.inverse | `#0F172A` | Text on accent backgrounds |
| premium.gold | `#D4AF37` | Premium badge, pricing (6.8:1 AA) |
| premium.goldMuted | `rgba(212,175,55,0.15)` | Premium card backgrounds |
| semantic.success | `#22C55E` | Success, protein macro |
| semantic.error | `#EF4444` | Error, destructive |
| semantic.warning | `#F59E0B` | Warning, carbs macro |
| macro.* | cyan/green/amber/pink | Calorie/protein/carbs/fat rings |
| border.default | `#1E293B` | Card borders |
| border.subtle | `#162032` | Subtle separators |
| border.focus | `#06B6D4` | Focus rings (2px solid) |

**No light mode.** Dark aesthetic IS the brand.

#### Glow Effects

```typescript
export const glow = {
  cyan: "0 0 40px rgba(6, 182, 212, 0.3)",
  cyanIntense: "0 0 80px rgba(6, 182, 212, 0.4)",
  gold: "0 0 40px rgba(212, 175, 55, 0.3)",
  white: "0 0 30px rgba(255, 255, 255, 0.1)",
};
```

#### Gradient Presets

```typescript
export const gradients = {
  cyanToBlue: "linear-gradient(135deg, #06B6D4, #3B82F6)",
  cyanToPurple: "linear-gradient(135deg, #06B6D4, #8B5CF6)",
  goldShimmer: "linear-gradient(90deg, #D4AF37, #F5D77A, #D4AF37)",
  darkRadial: "radial-gradient(ellipse at center, rgba(6,182,212,0.08), transparent 70%)",
  meshBg: "radial-gradient(at 20% 30%, rgba(6,182,212,0.12) 0%, transparent 50%), radial-gradient(at 80% 70%, rgba(59,130,246,0.08) 0%, transparent 50%), radial-gradient(at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 50%)",
  ctaGradient: "linear-gradient(135deg, #06B6D4, #0E7490)",
};
```

#### Glassmorphism Presets

```typescript
export const glass = {
  light: "bg-white/[0.03] backdrop-blur-md border border-white/[0.06]",
  medium: "bg-white/[0.05] backdrop-blur-lg border border-white/[0.08]",
  heavy: "bg-white/[0.08] backdrop-blur-xl border border-white/[0.12]",
  cyan: "bg-cyan-500/[0.05] backdrop-blur-lg border border-cyan-500/[0.15]",
};
```

### 2.2 Typography Scale

**Font stack:** `Inter` via `next/font/google` | **Mono:** `JetBrains Mono` (`tabular-nums`)

| Token | Desktop | Mobile | Weight | Line Height | Letter Spacing |
|-------|---------|--------|--------|-------------|----------------|
| hero | 64px | 40px | 800 | 1.1 | -0.02em |
| h1 | 48px | 32px | 700 | 1.15 | -0.02em |
| h2 | 36px | 28px | 700 | 1.2 | -0.02em |
| h3 | 24px | 20px | 600 | 1.3 | normal |
| body-lg | 18px | 16px | 400 | 1.6 | normal |
| body | 16px | 16px | 400 | 1.6 | normal |
| small | 14px | 14px | 400 | 1.5 | normal |
| caption | 12px | 12px | 500 | 1.4 | normal |
| mono | 14px | 14px | 400 | 1.5 | normal |

### 2.3 Spacing & Layout

- **Grid:** 8px base unit
- **Border radius:** 8px (sm), 12px (md), 16px (lg), 24px (cards)
- **Max content width:** 1280px centered
- **Section padding:** 120px vertical (desktop), 80px (mobile)

### 2.4 Spring Configs

```typescript
export const springs = {
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },   // buttons, hover
  smooth: { type: "spring" as const, stiffness: 100, damping: 20 },   // entrances
  bouncy: { type: "spring" as const, stiffness: 300, damping: 10 },   // celebrations
  gentle: { type: "spring" as const, stiffness: 50, damping: 15 },    // floating, breathing
  apple: { type: "spring" as const, stiffness: 170, damping: 26 },    // iOS default feel
};
```

### 2.5 Component Library

**Primary button:** `linear-gradient(135deg, #06B6D4, #0E7490)`, text `#0F172A` 16px/600, padding `14px 32px`, radius 12px. Hover: brightness(1.1), translateY(-1px), glow shadow. Min-height 48px.

**Secondary button:** Transparent, border 1px `#1E293B`, text `#F1F5F9`. Hover: bg `rgba(255,255,255,0.06)`.

**GlassCard:** `rgba(255,255,255,0.03)` + `backdrop-filter: blur(16px) saturate(180%)` + border `rgba(255,255,255,0.06)`, radius 24px. Hover: scale(1.02) spring, border brightens to `rgba(6,182,212,0.3)`, inner glow.

**Badge:** `rgba(6,182,212,0.15)` bg, `#06B6D4` text, pill shape.
**Premium badge:** `rgba(212,175,55,0.15)` bg, `#D4AF37` text.

**Navigation bar:** Transparent on hero → `backdrop-blur(12px)` + `bg.base/80%` on scroll. 64px height, fixed, z-50. Logo left, links center, CTA right. Mobile: hamburger → full-screen overlay.

### 2.6 Reusable Animation Components (`components/ui/`)

#### 1. `<AnimatedText>`
| Prop | Type | Description |
|------|------|-------------|
| `text` | string | Text content |
| `as` | `"h1"│"h2"│"p"` | HTML element |
| `animation` | `"words"│"chars"│"lines"` | Split mode |
| `delay` | number | Start delay |
| `className` | string | Styling |
Splits text, applies staggered entrance (fade + slideUp). Supports gradient shimmer after entrance.

#### 2. `<MagneticButton>`
| Prop | Type | Description |
|------|------|-------------|
| `children` | ReactNode | Button content |
| `strength` | `0-1` | Pull strength |
| `className` | string | Styling |
Follows cursor within ~100px proximity. Spring snap-back on leave. Scale 0.97 on press, 1.05 on hover. Particle burst on click (5-8 cyan dots).

#### 3. `<GlassCard>`
| Prop | Type | Description |
|------|------|-------------|
| `children` | ReactNode | Card content |
| `spotlight` | boolean | Cursor-following gradient |
| `className` | string | Styling |
Glassmorphism styling. Optional: radial gradient follows cursor at 6% opacity ("flashlight" effect). Hover: border brightens, subtle scale.

#### 4. `<AnimatedCounter>`
| Prop | Type | Description |
|------|------|-------------|
| `value` | number | Target value |
| `duration` | number | Animation duration |
| `prefix`/`suffix` | string | Display affixes |
Animates 0→value via `useMotionValue` (zero re-renders). Triggers on `whileInView`. Uses `tabular-nums` + JetBrains Mono.

#### 5. `<ParallaxSection>`
| Prop | Type | Description |
|------|------|-------------|
| `children` | ReactNode | Content |
| `speed` | number | Parallax multiplier |
Applies parallax offset via `useScroll` + `useTransform`.

#### 6. `<ScrollReveal>`
| Prop | Type | Description |
|------|------|-------------|
| `children` | ReactNode | Content |
| `direction` | `"up"│"down"│"left"│"right"` | Entrance direction |
| `delay` | number | Start delay |
Wraps content with scroll-triggered entrance. `whileInView` + `viewport: { once: true }`.

#### 7. `<PhoneMockup>`
| Prop | Type | Description |
|------|------|-------------|
| `screenshot` | string | Image source |
| `tilt` | boolean | Mouse-tracking 3D tilt |
| `float` | boolean | Gentle y-axis loop |
iPhone 15 Pro Space Black frame. Optional mouse-tracking via `useMotionValue`/`useTransform` with `transformPerspective: 1200`. Float: `y: [0, -12, 0]` over 4s. Reflection/shadow beneath. Cyan glow: `0 0 120px 40px rgba(6,182,212,0.15)`.

#### 8. `<GradientMesh>`
Background component with 3-4 animated radial gradients that slowly drift/morph. Colors: deep cyan, deep blue, subtle purple on `#0A0E13`. Dot grid overlay: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)` at 24px. Used in hero + final CTA.

#### 9. `<DrawPath>`
| Prop | Type | Description |
|------|------|-------------|
| `d` | string | SVG path data |
| `duration` | number | Draw duration |
SVG path that draws itself on scroll via `pathLength: 0→1` with `whileInView`.

#### 10. `<SpotlightCard>`
Like GlassCard but with a radial gradient that tracks mouse position within the card. `radial-gradient(600px circle at ${x}px ${y}px, rgba(6,182,212,0.06), transparent 40%)`. Very subtle flashlight effect.

### 2.7 Animation Performance Rules

| # | Rule |
|---|------|
| 1 | **Only animate `transform` and `opacity`** — GPU-composited. Never animate width/height/margin/padding. |
| 2 | **Use `will-change` sparingly** — only on actively animating elements. Remove after completion. |
| 3 | **Pause off-screen animations** — `IntersectionObserver` or `viewport: { once: true }`. Pause looping anims when not visible. |
| 4 | **Canvas for 50+ particles** — DOM particles fine for <20. Beyond that, Canvas 2D. |
| 5 | **`contain: layout`** — add to animated containers to prevent layout recalc propagation. |
| 6 | **Lazy load below-fold** — `next/dynamic` for heavy components (carousel, particles, 3D). |
| 7 | **Target Lighthouse 95+** — animations must not compromise performance. |
| 8 | **Test on mobile** — reduce particles, simplify 3D, disable custom cursor on touch. |
| 9 | **`useReducedMotion()`** — provide static fallbacks for all animations. Non-negotiable. |
| 10 | **Bundle size** — use `LazyMotion` + `domAnimation`. Don't import full motion bundle. |

---

## Phase 3: Page-by-Page Design Specifications

### Responsive Breakpoints
| Name | Width | Columns |
|------|-------|---------|
| Mobile | < 640px | 1 (stacked, hamburger nav, sticky bottom CTA) |
| Tablet | 640–1024px | 2 (adapted grids) |
| Desktop | > 1024px | 3–4 (full layout) |

---

### 3.1 Homepage

#### Section 1: Navigation Bar

**Content:** Logo (icon 32px + "Repwise" Inter 600 18px) | Links: Features, Pricing, Blog, About | CTA: "Download" cyan button (small)
**Mobile:** Hamburger → full-screen overlay, 48px touch targets.

**Animation specs:**
- Starts fully transparent over hero
- On scroll past hero: smooth transition to `backdrop-blur(12px)` + `bg-base/80` + bottom border appears
- Use `useScroll` + `useTransform` for smooth opacity transition (NOT binary toggle)
- Logo: subtle hover glow
- Nav links: underline slides in from left on hover (not instant appear)
- CTA: smaller `<MagneticButton>`
- Mobile hamburger: morphs ☰ → ✕ with SVG path animation

#### Section 2: Hero

**Content:**
- Headline: "Train Smarter. Eat Smarter. One App." (or alternatives: "The Science of Gains — In Your Pocket" / "Where Hypertrophy Science Meets Nutrition Intelligence")
- Subheadline: "The only app combining evidence-based training science, comprehensive nutrition tracking, and adaptive coaching. Built for lifters who want results, not guesswork."
- Primary CTA: "Start Free — 7 Days, No Card" (large cyan gradient `<MagneticButton>`)
- App Store + Play Store badges
- Below CTA: "Available on iOS and Android" in `text.secondary`
- Desktop: text left 60%, phone right 40%. Mobile: text centered, phone below.

**Animation specs:**

*Background:*
- `<GradientMesh>` with radial gradients: deep cyan `rgba(6,182,212,0.15)`, deep blue `rgba(59,130,246,0.08)`, subtle purple `rgba(139,92,246,0.05)` on `#0A0E13`
- Dot grid overlay: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)` at `background-size: 24px 24px`
- Faint horizontal scan lines (2% opacity)

*Headline:*
- `<AnimatedText animation="words">` — each word fades in + slides up, stagger 0.12s
- After all words: gradient shimmer (animated `background-position` on `bg-clip-text`)
- Faint cyan glow: `text-shadow: 0 0 40px rgba(6,182,212,0.3)`

*Subheadline:* Fades in 0.5s after headline completes (opacity + translateY)

*Phone Mockup:*
- `<PhoneMockup tilt float>` — 3D perspective responds to mouse position:
  ```
  rotateX = useTransform(mouseY, [-300, 300], [5, -5])
  rotateY = useTransform(mouseX, [-300, 300], [-5, 5])
  transformPerspective: 1200
  ```
- Float: `y: [0, -12, 0]` loop, duration 4s, repeat Infinity
- Cyan glow behind: `box-shadow: 0 0 120px 40px rgba(6,182,212,0.15)`
- Reflection/shadow beneath that moves with phone

*CTA Button:*
- `<MagneticButton strength={0.3}>` — follows cursor within 100px
- Animated rotating conic gradient border
- Hover: scale 1.05 + glow intensifies
- Click: scale 0.97 (spring stiffness 400, damping 17) + particle burst (5-8 cyan dots)

*App Store Badges:* Fade in with stagger after CTA. Hover: scale 1.05 + brightness.

*Timing Sequence:*
| Time | Event |
|------|-------|
| 0–0.5s | Background gradient mesh fades in |
| 0.3–1.2s | Headline words stagger in |
| 1.2–1.6s | Subheadline fades in |
| 0.8–1.5s | Phone mockup slides in from right (spring) |
| 1.5–2.0s | CTA + badges fade in |
| 2.0s+ | Gradient shimmer loops on headline |

#### Section 3: Social Proof Bar

**Content:** Stats with count-up animation:
- "300,000+" — Foods in Database
- "27" — Micronutrients Tracked
- "3,187+" — Tests Passing (replace with user count when available)
- "4" — Types of PR Detection

Numbers in JetBrains Mono bold, labels in `text.secondary` small. Placeholder slots for press logos. Mobile: 2×2 grid.

**Animation specs:**
- `<AnimatedCounter>` for each stat — 0→target via `useMotionValue` + `animate()` (zero re-renders)
- Trigger: `whileInView`, `viewport: { once: true }`
- Each stat staggers in (0.15s apart)
- `font-variant-numeric: tabular-nums`
- Subtle dividers: vertical line with gradient fade (transparent → white 30% → transparent)
- Entire bar: glassmorphism `glass.light` — `backdrop-blur(8px)` + `bg-white/[0.03]` + `border-white/[0.05]`

#### Section 4: The Problem

**Content:**
- Headline: "Stop Juggling 3 Apps"
- Left: 3 app cards (workout $30/yr + nutrition $72/yr + coaching $300/yr = $402/yr)
- Right: Repwise single card ($80/yr)
- Subtext: "Other apps make you choose between training science and nutrition tracking. Repwise gives you both — for 78% less."

**Animation specs:**
- 3 app cards physically present, slightly rotated/scattered
- On scroll into view: cards animate together, overlap, morph into single Repwise card
- Use `layout` animations for the morph effect
- Price tags on each card with strikethrough animation
- Final Repwise card: cyan border glow pulse (`glow.cyan` pulsing)
- Background: subtle radial gradient centered on Repwise card (`gradients.darkRadial`)

#### Section 5: Bento Grid Features

**Content:** Mixed card sizes (2×2, 2×1, 1×1) — 6 glassmorphism cards:
1. **(2×2 hero) Hypertrophy Science Engine** — "Train with science, not guesswork" — WNS, volume landmarks, fatigue engine. Visual: SVG body heat map
2. **(2×1) Smart Nutrition** — "3M+ foods. One scan away." — USDA + Open Food Facts, barcode, macros, 27 micros. Visual: macro ring mockup
3. **(1×1) Adaptive Coaching** — "Your AI nutrition coach" — TDEE, 4 coaching modes
4. **(1×1) Analytics** — "12 ways to visualize your progress" — charts, trends
5. **(1×1) Progress Photos** — "See the transformation" — side-by-side, overlays
6. **(1×1) Weekly Intelligence** — "Your weekly performance report" — cross-domain insights

**Animation specs:**

*Card base:* `<SpotlightCard>` with glassmorphism:
```css
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(16px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.06);
border-radius: 24px;
```

*Card hover:*
- Scale 1.02 (spring `springs.snappy`)
- Border brightens to `rgba(6,182,212,0.3)`
- Inner glow: `box-shadow: inset 0 0 60px rgba(6,182,212,0.05)`
- Cursor-following spotlight: `radial-gradient(600px circle at ${x}px ${y}px, rgba(6,182,212,0.06), transparent 40%)`

*Card entrance:* Staggered fade-up (staggerChildren: 0.1, spring `springs.smooth`). Internal content (icon, title, desc) also staggers after card appears.

*Body Heat Map card (2×2):*
- SVG muscle groups light up one by one in sequence
- Colors pulse gently (breathing effect, `springs.gentle`)
- On hover: heat map becomes more vivid/saturated
- This is the most visually striking element — must feel alive

*Feature icons:* Small icon in rounded square with themed gradient bg (cyan=science, green=nutrition, amber=analytics). Subtle float animation.

#### Section 6: How It Works (3 Steps)

**Content:** Horizontal 3-column (vertical mobile), numbered 01/02/03:
1. **"Set Your Goals"** — "11-step onboarding personalizes your TDEE, macros, and training targets." Icon: target
2. **"Train & Track"** — "Log workouts with real-time feedback. Scan food with one tap." Icon: dumbbell
3. **"See Results"** — "Analytics, weekly reports, and adaptive coaching evolve with you." Icon: chart

**Animation specs:**
- Large faded numbers (01/02/03): `text-[120px] opacity-[0.03]` → animate to `opacity-[0.06]` on scroll
- Connecting line: `<DrawPath>` SVG that draws itself on scroll (`pathLength: 0→1`, duration 1.5s, easeInOut)
- Each step icon: pulsing glow ring behind it (`glow.cyan` with breathing animation)
- Phone mockups slide in from alternating sides (left, right, left) using `<ScrollReveal direction>`
- Active step (in viewport): brighter styling; others dimmed

#### Section 7: Science Section

**Content:**
- Headline: "Built on Peer-Reviewed Exercise Science"
- Sub: "Not bro-science. Not AI-generated plans. Real hypertrophy research, implemented as software."
- Deep-dives: Hypertrophy Units (WNS), Volume Landmarks (MEV/MAV/MRV), Fatigue Engine (4-component), RPE/RIR Tracking
- Large SVG body heat map centerpiece with annotation callouts

**Animation specs:**

*Background:* Subtle topographic/contour line SVG pattern at 2-3% opacity. Or: animated grid pulsing outward from center.

*Body Heat Map (centerpiece):*
- Large SVG, centered
- Muscle groups fade from dark to heat color over 2s, staggered sequence
- Annotation lines draw themselves (`<DrawPath>`) from muscle groups to text labels
- Hover over muscle group: brightens + tooltip with volume data
- Ambient cyan glow behind entire SVG

*Feature cards (4):*
- Arranged around body map (2 left, 2 right on desktop)
- Each has small animated icon/illustration
- Connected to body map with faint dotted lines
- Scroll entrance: cards slide in from respective sides (`<ScrollReveal>`)

*Mini data visualizations:*
- Volume landmark bar: fills MEV → MAV → MRV with color transitions
- Fatigue gauge: animated needle
- RPE color scale: lights up segment by segment
- Should feel like real-time data, not static images

#### Section 8: Full Feature List (Accordion)

**Content:** 10 expandable sections with icon + count header:
1. **Workout Tracking** (14): Active workout logging, previous performance inline, set completion with haptic, 4-type PR detection with confetti, rest timer V2, progressive overload suggestions, superset grouping, warm-up generation, exercise swap, per-exercise notes, copy from date, custom exercises, templates, session history
2. **Hypertrophy Science** (6): WNS calculator, volume landmarks (MEV/MAV/MRV), fatigue engine, RPE/RIR tracking, strength standards, SVG body heat map
3. **Nutrition** (11): USDA + Open Food Facts, barcode scanner, macro rings, micronutrient dashboard (27), meal plans + shopping lists, food DNA profiling, dietary gap analysis, meal slot diary, copy meals, water tracking, quick add
4. **Analytics** (12): Calorie/protein trends, weekly macro averages, TDEE estimation, strength progression, heat map drill-down, fatigue scoring, strength standards, bodyweight trend (EMA), periodization calendar, readiness trend, volume landmarks, weekly intelligence report
5. **Body Composition** (5): Bodyweight logging with EMA, body measurements, Navy body fat calculator, progress photos with comparison, guided camera with pose overlays
6. **Adaptive Coaching** (6): TDEE calculation, weekly check-in, target adjustments, 4 coaching modes, recomp score, dashboard nudges
7. **Periodization** (3): Training blocks, block templates, calendar view
8. **Gamification** (5): 23 achievements, daily + weekly streaks, streak freezes, weekly challenges, shareable workout cards
9. **Education** (5): Article library (6 categories), search + filter, YouTube embeds, read time, HU explainer sheets
10. **Reports** (4): Weekly intelligence, monthly, year in review, health reports (blood test upload)

**Animation specs:**
- Smooth height animation using `layout` prop (NOT height: auto hack)
- The + icon rotates 45° to become × when open
- Content fades in + slides down with spring (`springs.smooth`)
- Active item: subtle left border in cyan
- Staggered entrance on scroll

#### Section 9: Competitor Comparison Table

**Content:**

| Feature | Repwise | Strong | Hevy | MacroFactor | RP Hypertrophy |
|---------|---------|--------|------|-------------|----------------|
| Hypertrophy science (WNS, volume landmarks, fatigue) | ✅ | ❌ | ❌ | ❌ | ✅ (simpler) |
| Full nutrition tracking | ✅ | ❌ | ❌ | ✅ | ❌ |
| Both in one app | ✅ | ❌ | ❌ | ❌ | ❌ |
| Adaptive coaching | ✅ | ❌ | ❌ | ✅ | ❌ |
| SVG body heat map | ✅ | ❌ | ❌ | ❌ | ❌ |
| Weekly intelligence reports | ✅ | ❌ | ❌ | ❌ | ❌ |
| Micronutrient tracking (27) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Barcode food scanning | ✅ | ❌ | ❌ | ✅ | ❌ |
| Progress photos | ✅ | ❌ | ✅ | ❌ | ❌ |
| Price (annual) | $80 | $30 | $50 | $72 | $300 |

Below: "RP + MacroFactor = $372/yr. Repwise = $80/yr. Same science. More features. One app."

**Animation specs:**
- Table rows stagger in on scroll (`<ScrollReveal>` per row)
- ✅ checkmarks: scale 0→1 with spring bounce (`springs.bouncy`)
- ❌ marks: fade in with subtle red flash
- Repwise column: highlighted background (subtle cyan tint)
- Header row: sticky within table scroll
- Mobile: horizontal scroll with Repwise column pinned/sticky
- Price row: competitor prices in strikethrough with red tint, Repwise price in bold cyan

#### Section 10: Testimonials

**Content:** Glassmorphism card carousel (3 visible desktop, 1 mobile, swipeable). Each: quote, name, avatar placeholder, stat highlight.
- "Finally an app that understands progressive overload isn't just adding weight. The volume landmarks changed how I program." — Alex M. · Powerlifter
- "The adaptive TDEE is scary accurate. I stopped guessing my calories after week 2." — Sarah K. · Physique Competitor
- "I've tried Strong, Hevy, and RP. Repwise is the first app that feels like it was built by someone who actually lifts." — James R. · Natural Bodybuilder
*(Mark clearly as placeholders)*

**Animation specs:**
- Cards in slight 3D perspective (card fan layout)
- Auto-rotating carousel with spring transitions (`springs.apple`)
- Each card: `<GlassCard>` with large faded cyan quote marks, gold star rating with animated fill, avatar with ring border
- Drag/swipe to navigate on mobile
- Dots indicator: active dot in cyan
- Cards entrance: fadeUp + scale(0.95→1), stagger

#### Section 11: Pricing

**Content:**
- Headline: "Start Free. Upgrade When You're Ready."
- Toggle: Monthly / Yearly (pill-style, default yearly)
- **Free (forever):** Workout logging, basic nutrition, dashboard, analytics, exercise library, learn articles. CTA: "Download Free" (secondary button)
- **Premium ($9.99/mo or $79.99/yr — save 33%):** Everything in Free + adaptive coaching, health reports, dietary gap analysis, micronutrient dashboard, advanced analytics, priority support. Gold border, "MOST POPULAR" badge. CTA: "Start 7-Day Free Trial" (gradient button)
- Below: "No credit card required for trial"

**Animation specs:**
- Cards: subtle floating animation (different phase per card, `springs.gentle`)
- Premium card:
  - Gold `#D4AF37` gradient border that slowly rotates (animated conic-gradient)
  - "MOST POPULAR" badge with shimmer animation (`gradients.goldShimmer` animated `background-position`)
  - Slightly elevated: larger shadow, scale 1.02 vs free card
  - Subtle gold radial gradient background
- Monthly/Yearly toggle:
  - Smooth sliding pill animation
  - Prices animate via `<AnimatedCounter>` (counter from old→new value)
  - "Save 33%" badge bounces in when yearly selected (`springs.bouncy`)
- Feature list items: checkmark animate in with stagger on card entrance
- CTA buttons: `<MagneticButton>` with glow effect

#### Section 12: Screenshot Carousel

**Content:** 10 phone mockups (3D perspective): Dashboard, Active Workout, Nutrition/Macro Rings, Body Heat Map, Analytics Charts, Progress Photos, Weekly Report, Meal Plan, Micronutrient Dashboard, Onboarding. Placeholder: colored rectangles with screen names.

**Animation specs:**
- `<PhoneMockup>` arranged in 3D arc (carousel in physical space)
- Center phone: largest, fully visible. Side phones: smaller, rotated, slightly faded
- Spring-based transitions when navigating (`springs.apple`)
- Auto-advance every 4s with progress bar under each phone
- Hover: pause auto-advance
- Swipe on mobile
- Each phone: subtle reflection below (CSS gradient mask)
- Background: radial glow behind center phone (`gradients.darkRadial`)

#### Section 13: FAQ (with FAQPage schema)

**Content:**
1. "Is Repwise free?" → "Yes! Core features are free forever. Premium unlocks adaptive coaching, health reports, micronutrient tracking, and more for $9.99/mo or $79.99/yr."
2. "What makes Repwise different from Strong or Hevy?" → "Repwise is the only app combining hypertrophy science (volume landmarks, fatigue scoring, WNS) with full nutrition tracking (3M+ foods, barcode scanning, micronutrients) and adaptive coaching — all in one app."
3. "Does it work offline?" → "Core workout logging works offline. Nutrition search requires internet."
4. "Can I import data from other apps?" → "Yes! Import from Strong, Hevy, and other popular apps."
5. "What food databases do you use?" → "USDA FoodData Central (300K+) and Open Food Facts (3M+ with barcode)."
6. "Is my data secure?" → "Yes. Encrypted in transit and at rest. JWT auth with bcrypt hashing."
7. "What platforms are supported?" → "iOS and Android. Built with React Native."

**Animation specs:**
- Smooth height animation using `layout` prop
- + icon rotates 45° to × when open
- Content fades in + slides down (`springs.smooth`)
- Active item: cyan left border
- Staggered entrance on scroll

#### Section 14: Final CTA

**Content:**
- Headline: "Ready to Train Smarter?"
- Sub: "Join thousands of lifters who've upgraded their training with science."
- Large CTA: "Start Free — 7 Days, No Card"
- App Store + Play Store badges
- Telegram community link

**Animation specs:**
- Background: `<GradientMesh>` more vivid than rest of page (deeper cyans, subtle purples)
- Headline: `<AnimatedText>` with gradient shimmer
- Floating particles: 15-20 small cyan dots drifting upward (Canvas 2D, pause when off-screen)
- CTA: largest `<MagneticButton>` on the page
- App Store badges: subtle glow
- Aurora effect: wide, blurred gradient bands that slowly shift
- This section is the crescendo — most visually intense

#### Section 15: Footer

**Content:** 4-column grid: Product (Features, Pricing, Download), Legal (Privacy, Terms), Community (Telegram, Twitter/X, Instagram), Company (About, Blog). Bottom: © 2025 Octopus Labs · support@repwise.app. App Store + Play Store badges.

**Animation specs:**
- Subtle top border: gradient (transparent → cyan → transparent)
- Links: underline-slide hover effect (same as nav)
- Social icons: scale + glow on hover
- "Built with 💪 for serious lifters" tagline
- Background: slightly lighter than page base (`#0D1117`)

#### Sticky Elements
- Header: transparent on hero → glassmorphism on scroll
- Mobile: sticky bottom bar "Get Repwise Free" full-width cyan (appears after hero, hides when pricing visible)

**CTA Repetition Rule:** Every section must have a CTA. Minimum 6 CTAs on the page.

#### Global Effects (Applied Across Entire Site)

**1. Smooth Scroll (Lenis):**
```typescript
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
```

**2. Custom Cursor:**
- Small cyan dot (8px) + larger trailing ring (32px) following with spring physics
- Scales up on hoverable elements (buttons, links, cards)
- Changes to "view" label on images/mockups
- Hidden on mobile/touch devices
```typescript
const cursorX = useMotionValue(0);
const cursorY = useMotionValue(0);
const springX = useSpring(cursorX, { stiffness: 500, damping: 28 });
const springY = useSpring(cursorY, { stiffness: 500, damping: 28 });
```

**3. Page Transitions:**
- FrozenRouter pattern for Next.js App Router
- `AnimatePresence mode="wait"` keyed on route segment
- Exit: fade out + slight slide up (200ms)
- Enter: fade in + slight slide up (300ms)

**4. Scroll Progress Indicator:**
- Thin cyan line at top of viewport, fills left→right as user scrolls
```typescript
const { scrollYProgress } = useScroll();
// <motion.div style={{ scaleX: scrollYProgress, transformOrigin: "left" }} />
```

**5. Reduced Motion:** Always check `useReducedMotion()`. Provide static fallbacks. Non-negotiable.

---

### 3.2 Features Page (`/features`)
- Hero: "Everything You Need. Nothing You Don't."
- 10 sections, one per feature category (same as Section 8 accordion)
- Alternating layout: text left/mockup right, then flip
- `<PhoneMockup>` per section, `<ScrollReveal>` entrance
- Detailed bullet list per category
- Sticky side navigation (desktop) showing current section
- Final CTA at bottom

### 3.3 Pricing Page (`/pricing`)
- Same pricing cards as homepage Section 11 (larger format)
- Full feature comparison table (every feature, grouped, Free vs Premium)
- Pricing-specific FAQ
- Competitor comparison (same table as Section 9)
- CTA: "Start Free Trial"

### 3.4 About Page (`/about`)
- Founder story (mirror FounderStoryScreen from app)
- Mission: "Make evidence-based fitness accessible to every serious lifter"
- The problem being solved
- Team section (solo builder)
- Tech credibility: "3,187+ automated tests", "Built with TypeScript, React Native, FastAPI"
- Telegram community link

### 3.5 Blog (`/blog`)
- Grid layout of blog post cards
- Categories: Training, Nutrition, Body Composition, App Updates, Science
- MDX support, author info, publish date, read time
- Related posts at bottom. Start with 3-5 placeholder posts.

### 3.6 Download Page (`/download`)
- Smart redirect: detect platform (iOS/Android/desktop)
- Mobile: auto-redirect to store (with fallback buttons)
- Desktop: both store badges + QR code ("Scan to download")

### 3.7 Legal Pages (`/privacy`, `/terms`)
- Single-column prose, max-width 720px centered
- Page title, last updated date. Render existing markdown.
- Typography: body 16px/1.7, h2 24px/600, h3 20px/600
- Sidebar TOC on desktop (sticky, auto-generated from h2s)

### 3.8 Error Pages

#### 404 Page (`not-found.tsx`)
- "404" in hero size, `accent.primary`, JetBrains Mono
- "This page skipped leg day." in body-lg, `text.secondary`
- CTA: secondary button → homepage. Centered, min-height 60vh.
- Proper meta tags (`noindex`)

#### Error Boundary (`error.tsx`)
- `'use client'` component — catches client-side errors
- Friendly message: "Something went wrong." with `text.primary`
- "Try Again" button that calls `reset()`
- Log error to PostHog/Sentry — never expose stack traces to user

#### Global Error (`global-error.tsx`)
- `'use client'` component — catches root layout errors (rare but critical)
- Minimal styled page (can't rely on root layout CSS)
- "Something went wrong" + "Reload" button
- Log error to monitoring

### 3.9 Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| JavaScript disabled | Page content still visible (SSR/SSG), animations don't break layout |
| Slow connection (3G) | Content loads progressively, no blank screens, skeleton states |
| Browser back/forward | Page transitions work correctly, scroll position restored |
| Deep link to section (/#pricing) | Smooth scroll to section after page load |
| Blog post doesn't exist | 404 page (not a crash) |
| Empty blog (no posts yet) | Graceful empty state, not a blank page |
| Very long blog post title | Truncated properly in cards, full in detail page |
| Special characters in blog content | Properly escaped, no XSS |
| Multiple rapid form submissions | Rate limited, button disabled after first submit |
| Form submission with JS disabled | Graceful degradation (show message or redirect) |
| Print stylesheet | Clean print layout for blog posts and legal pages |
| Right-to-left text | Not required, but don't break if someone pastes RTL text |
| Very wide/narrow viewports | No horizontal scroll at any width from 320px to 4K |
| iOS Safari quirks | 100vh fix (use `dvh`), safe area insets, rubber band scroll |
| Dark reader extension | Don't fight it, but verify it doesn't break layout |

### 3.10 Accessibility (WCAG AA)

| Requirement | Implementation |
|-------------|---------------|
| Color contrast | All text ≥ 4.5:1 (verified in §2.1) |
| Focus indicators | 2px solid `#06B6D4` outline, 2px offset |
| Keyboard nav | Full tab order, Enter/Space, Escape to close |
| Screen readers | Semantic HTML5, `aria-label` on icon buttons, `alt` on images |
| Skip link | "Skip to main content" visually hidden until focused |
| Touch targets | Min 48×48px |
| Reduced motion | `prefers-reduced-motion` → disable transforms, keep opacity fades at 150ms |
| Font scaling | All `rem`, respects zoom to 200% |
| Language | `<html lang="en">` |
| Heading hierarchy | Strict h1→h2→h3, single h1 per page |

#### Automated Accessibility Checks
- Run `axe-core` on every page (via browser extension or CI) — zero violations at AA level
- Zero "serious" or "critical" issues

#### Manual Accessibility Checks

| Check | How | Target |
|-------|-----|--------|
| Keyboard navigation | Tab through entire page | Every interactive element reachable, logical order |
| Focus indicators | Tab through page | 2px solid cyan outline visible on every focusable element |
| Screen reader | VoiceOver (macOS) or NVDA | All content announced correctly, no "unlabeled button" |
| Color contrast | Chrome DevTools | All text ≥ 4.5:1 ratio |
| Skip link | Tab on page load | "Skip to main content" link appears, works |
| Heading hierarchy | HeadingsMap extension | Strict h1→h2→h3, single h1 per page |
| Alt text | Check every `<img>` | Descriptive alt text, decorative images have `alt=""` |
| Touch targets | Test on mobile | All buttons/links ≥ 48x48px |
| Reduced motion | Enable `prefers-reduced-motion` in OS | All animations disabled or reduced to simple fades |
| Zoom | Browser zoom to 200% | No content overflow, no horizontal scroll |
| Language | Check `<html>` tag | `lang="en"` present |
| Animation pattern | Every animation component | `useReducedMotion()` check with static fallback |

---

## Phase 4: Interaction Design & Micro-interactions

### 4.1 Scroll Animations

| Element | Animation | Trigger |
|---------|-----------|---------|
| Section titles | `<AnimatedText animation="words">` fadeUp + stagger | viewport -100px, once |
| Feature cards | `<SpotlightCard>` fadeUp + stagger 0.1s (`springs.smooth`) | viewport, once |
| How-it-works steps | fadeUp + stagger, `<DrawPath>` connecting line | viewport, once |
| Problem section | 3 cards collapse → 1 via `layout` animations | scroll-triggered |
| Phone mockups | `<ParallaxSection>` + `<PhoneMockup tilt float>` | continuous |
| Stats numbers | `<AnimatedCounter>` 0→value | viewport 30%, once |
| Testimonial cards | fadeUp + scale(0.95→1), stagger | viewport, once |
| Bento grid | `<SpotlightCard>` stagger 0.1s, internal content sub-stagger | viewport, once |
| Comparison rows | stagger in, ✅ spring bounce, ❌ red flash | viewport, once |
| FAQ items | `layout` height animation, icon rotation | on toggle |
| Body heat map | Muscle groups light up sequentially, breathing pulse | viewport, once + continuous |
| Science data viz | Bar fills, gauge needle, RPE segments | viewport, once |

### 4.2 Hover States

| Element | Effect | Physics |
|---------|--------|---------|
| `<MagneticButton>` | Follows cursor within 100px, scale 1.05, glow intensifies | `springs.snappy` |
| `<MagneticButton>` click | Scale 0.97 + particle burst (5-8 cyan dots) | stiffness 400, damping 17 |
| `<GlassCard>` / `<SpotlightCard>` | Scale 1.02, border → `rgba(6,182,212,0.3)`, cursor spotlight | `springs.snappy` |
| Feature card | translateY(-2px), border brightens, shadow deepens | 200ms |
| `<PhoneMockup>` | 3D tilt tracking mouse (rotateX/Y ±5deg, scale 1.02) | `springs.snappy` |
| Nav link | Underline slides in from left | 150ms |
| Pricing card | translateY(-4px), shadow deepens | 200ms |
| Body heat map muscle | Brightens + tooltip with volume data | 150ms |
| Social icon | Scale + glow | `springs.snappy` |
| Secondary button | bg `rgba(255,255,255,0.06)` | 200ms |

### 4.3 Hero Timing Sequence (0–2s)

| Time | Event |
|------|-------|
| 0–0.5s | `<GradientMesh>` fades in (opacity 0→1) |
| 0.3–1.2s | Headline words stagger in (0.12s per word, fadeUp) |
| 1.2–1.6s | Subheadline fades in (opacity + translateY) |
| 0.8–1.5s | Phone mockup slides in from right (spring) |
| 1.5–2.0s | CTA button + App Store badges fade in |
| 2.0s+ | Gradient shimmer loops on headline text |

### 4.4 Loading & Font Strategy

- Font loading: `next/font` for Inter (swap), JetBrains Mono (optional)
- Images: Next.js Image with blur placeholder
- Hero image: `priority` prop
- Below-fold: lazy load via `next/dynamic`
- Skeleton: shimmer on hero during load

### 4.5 Mobile-Specific Interactions

| Interaction | Behavior |
|-------------|----------|
| Sticky CTA bar | Appears after hero (>100vh), fixed bottom, "Get Repwise Free" full-width cyan. Hides when pricing visible. |
| Hamburger menu | Full-screen overlay, stacked links, 48px touch targets. ☰→✕ SVG morph. |
| Custom cursor | Hidden on touch devices |
| Testimonial carousel | Drag/swipe, snap points |
| Screenshot carousel | Swipe, auto-scroll pauses on touch |
| Comparison table | Horizontal scroll, Repwise column pinned/sticky |
| Pricing toggle | Pill-style, 48px height |
| Accordion | Tap to expand, `layout` height animation |
| Particles (Final CTA) | Reduced count on mobile |
| 3D effects | Simplified on mobile (no mouse tracking) |

### 4.6 The Experience (What It Should Feel Like)

1. **First 0–2s:** Cinematic hero — gradient mesh fades in, headline words cascade, phone floats into position. Immediate "this is premium" feeling.
2. **Scrolling:** Every section reveals with purpose. Nothing pops jarringly. Elements slide, fade, spring into place. Buttery smooth (Lenis).
3. **Interacting:** Buttons feel magnetic. Cards respond to cursor with spotlight. Custom cursor adds polish. Everything has spring physics — nothing linear or robotic.
4. **Science Section:** The "wow" moment. Body heat map animates to life, annotation lines draw, data viz pulses. Feels like mission control.
5. **Pricing:** Premium card with rotating gold border and shimmer badge makes upgrade feel aspirational, not pushy.
6. **Overall:** "This website was built by someone who deeply understands both fitness AND engineering. If the website is this polished, the app must be incredible." Feels like **Linear meets Stripe meets a premium fitness brand**.

### 4.7 Cross-Browser Testing Matrix

| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | Latest 2 | P0 |
| Safari | Latest 2 (macOS + iOS) | P0 |
| Firefox | Latest 2 | P1 |
| Edge | Latest 2 | P1 |
| Samsung Internet | Latest | P2 |
| Safari (iOS 15+) | Latest 3 | P0 (most mobile users) |

### 4.8 Device Testing Matrix

| Device | Width | What to Check |
|--------|-------|--------------|
| iPhone SE | 375px | Smallest supported width, all content visible, touch targets 48px |
| iPhone 14/15 | 390px | Primary mobile experience, safe area insets |
| iPhone 14/15 Pro Max | 430px | Large phone, verify layout scales |
| iPad | 768px | Tablet layout, 2-column grids |
| iPad Pro | 1024px | Tablet/desktop breakpoint |
| 1280px laptop | 1280px | Primary desktop experience |
| 1920px monitor | 1920px | Full desktop, verify max-width constraints |
| 2560px+ ultrawide | 2560px+ | No content stretching, centered layout |

**Per-device verification checklist:**
1. No horizontal scroll at any viewport width
2. All text readable (no truncation, no overflow)
3. All images load and are properly sized
4. All animations play smoothly (no jank)
5. All interactive elements work (buttons, accordions, carousels, forms)
6. Navigation works (hamburger on mobile, full nav on desktop)
7. Sticky elements don't overlap content
8. Footer is always at bottom (even on short pages)
9. Custom cursor hidden on touch devices
10. App Store badges link to correct stores

---

## Phase 5: Technical Implementation Spec

### 5.1 File Structure

```
repwise-website/
├── app/
│   ├── layout.tsx              # Root layout (fonts, metadata, analytics, Lenis, custom cursor)
│   ├── page.tsx                # Homepage
│   ├── not-found.tsx           # 404 — "This page skipped leg day."
│   ├── error.tsx               # Client-side error boundary ('use client')
│   ├── global-error.tsx        # Root layout error boundary ('use client')
│   ├── sitemap.ts              # Dynamic sitemap generation
│   ├── robots.ts               # Robots.txt generation
│   ├── opengraph-image.tsx     # Default OG image via @vercel/og
│   ├── features/page.tsx
│   ├── pricing/page.tsx
│   ├── about/page.tsx
│   ├── blog/
│   │   ├── page.tsx            # Blog listing
│   │   └── [slug]/
│   │       ├── page.tsx        # Individual post (MDX)
│   │       └── opengraph-image.tsx  # Per-post dynamic OG image
│   ├── download/page.tsx
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   └── api/
│       ├── contact/route.ts    # Contact form (POST)
│       └── newsletter/route.ts # Newsletter signup (POST)
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── MobileNav.tsx
│   │   ├── StickyMobileCTA.tsx
│   │   ├── CustomCursor.tsx
│   │   ├── ScrollProgress.tsx
│   │   ├── PageTransition.tsx
│   │   └── SmoothScrollProvider.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── MagneticButton.tsx
│   │   ├── GlassCard.tsx
│   │   ├── SpotlightCard.tsx
│   │   ├── AnimatedText.tsx
│   │   ├── AnimatedCounter.tsx
│   │   ├── ParallaxSection.tsx
│   │   ├── ScrollReveal.tsx
│   │   ├── PhoneMockup.tsx
│   │   ├── GradientMesh.tsx
│   │   ├── DrawPath.tsx
│   │   ├── Badge.tsx
│   │   ├── Accordion.tsx
│   │   ├── Toggle.tsx
│   │   └── Card.tsx
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── SocialProof.tsx
│   │   ├── ProblemSection.tsx
│   │   ├── BentoFeatures.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── ScienceSection.tsx
│   │   ├── FullFeatureList.tsx
│   │   ├── ComparisonTable.tsx
│   │   ├── Testimonials.tsx
│   │   ├── Pricing.tsx
│   │   ├── ScreenshotCarousel.tsx
│   │   ├── FAQ.tsx
│   │   └── FinalCTA.tsx
│   └── shared/
│       ├── AppStoreBadges.tsx
│       ├── SectionWrapper.tsx
│       ├── BodyHeatMap.tsx
│       └── StructuredData.tsx  # JSON-LD component
├── lib/
│   ├── constants.ts
│   ├── animations.ts
│   ├── metadata.ts
│   └── env.ts                  # Environment variable validation (@t3-oss/env-nextjs)
├── content/blog/               # MDX blog posts
├── public/
│   ├── images/ (screenshots/, mockups/, icons/)
│   ├── badges/ (app-store.svg, play-store.svg)
│   └── og-image.png
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

### 5.2 Dependencies

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "motion": "latest",
    "lenis": "latest",
    "lucide-react": "latest",
    "posthog-js": "latest",
    "zod": "latest",
    "@upstash/ratelimit": "latest",
    "@upstash/redis": "latest",
    "resend": "latest",
    "@vercel/og": "latest",
    "schema-dts": "latest"
  },
  "devDependencies": {
    "@t3-oss/env-nextjs": "latest",
    "@next/bundle-analyzer": "latest"
  }
}
```

> Use `LazyMotion` + `domAnimation` features in root layout for ~5KB bundle savings.

### 5.3 next.config.ts Hardening

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SECURITY
  poweredByHeader: false,
  reactStrictMode: true,

  // IMAGES
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year for immutable assets
  },

  // SEO REDIRECTS
  async redirects() {
    return [
      { source: "/privacy-policy", destination: "/privacy", permanent: true },
      { source: "/tos", destination: "/terms", permanent: true },
      { source: "/terms-of-service", destination: "/terms", permanent: true },
      { source: "/features/:path*", destination: "/features", permanent: false },
    ];
  },

  // SECURITY HEADERS (set here, NOT in middleware — preserves static caching on Vercel)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://us.i.posthog.com https://us.posthog.com",
              "frame-src 'self' https://www.youtube.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // POSTHOG REVERSE PROXY (avoid ad blockers)
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
};

export default nextConfig;
```

**Config verification checklist:**
1. `eslint.ignoreDuringBuilds` is FALSE (never skip linting)
2. `output` is NOT `'export'` (need SSR for /download redirect)
3. No unstable `experimental` flags
4. `images.remotePatterns` locked to domains you control (no open proxy)
5. Security headers target: A+ on securityheaders.com
6. CSP doesn't break PostHog, YouTube embeds, or Motion animations

### 5.4 API Route Specs

#### Contact Form (`app/api/contact/route.ts`)
- Zod validation: `name` (string, 2-100 chars), `email` (valid email), `message` (string, 10-2000 chars)
- Rate limiting: 3 requests per IP per hour (Upstash `@upstash/ratelimit` + `@upstash/redis`)
- Honeypot: hidden `website` field — if filled, silently return 200 (bot trap)
- Time check: reject if submitted < 3s after page load (bot detection)
- Email delivery via Resend (log to console in dev)
- Sanitize all input: strip HTML tags, trim whitespace, enforce length limits
- Status codes: 200 (success), 400 (validation), 429 (rate limit), 500 (server error)
- Never expose internal error details to client

#### Newsletter Signup (`app/api/newsletter/route.ts`)
- Zod validation: `email` (valid email format only)
- Rate limiting: 5 requests per IP per hour
- Honeypot field (same pattern as contact)
- Store in Resend audience (or log in dev)
- Duplicate email: return 200 regardless (don't reveal if email exists)
- Status codes: 200 (success), 400 (invalid email), 429 (rate limit)

#### Download Redirect (`app/download/page.tsx`)
- Detect platform from User-Agent: iOS → App Store, Android → Play Store, Desktop → show page
- Bots/crawlers → serve the page (don't redirect)
- In-app browsers (Instagram, Facebook, Twitter) → special handling
- Fallback: if detection fails, show download page with both badges + QR code

#### All API Routes — Shared Rules
- Every handler wrapped in try/catch with specific error types (ZodError, etc.)
- Consistent JSON response shape: `{ success: boolean, message?: string, errors?: object }`
- Request body size limited (reject > 10KB)
- Content-Type validation (reject non-JSON for POST routes)
- No sensitive data in responses (no stack traces, no internal paths)

### 5.5 SEO Hardening

#### Sitemap (`app/sitemap.ts`)
- Use Next.js built-in sitemap generation (NOT next-sitemap package)
- Include all pages: `/`, `/features`, `/pricing`, `/about`, `/blog`, `/download`, `/privacy`, `/terms`
- Include all blog posts dynamically from MDX files
- `changeFrequency`: homepage=weekly, blog=weekly, others=monthly
- `priority`: homepage=1.0, features/pricing=0.8, blog=0.7, others=0.5
- `lastModified` from file system timestamps or git commit dates

#### Robots.txt (`app/robots.ts`)
- Allow all crawlers on all pages
- Disallow `/api/*`
- Sitemap: `https://repwise.app/sitemap.xml`

#### Structured Data (JSON-LD)

| Page | Schema Type | Key Fields |
|------|------------|------------|
| Homepage | `SoftwareApplication` + `Organization` + `FAQPage` | name, description, operatingSystem, applicationCategory, offers, aggregateRating |
| Blog post | `BlogPosting` + `BreadcrumbList` | headline, datePublished, dateModified, author, image, description |
| Pricing | `SoftwareApplication` with `offers` | price, priceCurrency, availability |
| All pages | `BreadcrumbList` | Proper breadcrumb chain |

Use `schema-dts` for type safety. Render as `<script type="application/ld+json">` in page head. Validate with Google Rich Results Test.

#### Meta Tag Checklist (every page)
1. `<title>` — unique, 50-60 chars, includes "Repwise"
2. `<meta name="description">` — unique, 150-160 chars, includes primary keyword
3. `<meta property="og:title">` — same as title or slightly different
4. `<meta property="og:description">` — same as description
5. `<meta property="og:image">` — 1200×630, unique per page if possible
6. `<meta property="og:url">` — canonical URL
7. `<meta property="og:type">` — "website" or "article" for blog
8. `<meta name="twitter:card">` — "summary_large_image"
9. `<link rel="canonical">` — self-referencing canonical URL
10. `<html lang="en">`

#### OG Image Generation
- Default: `app/opengraph-image.tsx` using `@vercel/og` `ImageResponse`
- Blog posts: `app/blog/[slug]/opengraph-image.tsx` — dynamic with post title + category + date
- Size: 1200×630, dark bg + logo + tagline + app screenshot
- Validate with opengraph.xyz

#### Canonical URL Strategy
- Every page has self-referencing canonical
- No trailing slashes (enforce consistently)
- No duplicate content (www vs non-www, http vs https — Vercel handles)

### 5.6 Environment Variables

```typescript
// lib/env.ts — validate at build time
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    RESEND_API_KEY: z.string().startsWith("re_"),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith("phc_"),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
    NEXT_PUBLIC_APP_STORE_URL: z.string().url(),
    NEXT_PUBLIC_PLAY_STORE_URL: z.string().url(),
  },
  runtimeEnv: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_APP_STORE_URL: process.env.NEXT_PUBLIC_APP_STORE_URL,
    NEXT_PUBLIC_PLAY_STORE_URL: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
  },
});
```

**Rules:**
- Server-only secrets NEVER have `NEXT_PUBLIC_` prefix
- Never commit `.env.local` to git
- Use Vercel environment settings for production/preview
- All env vars validated at build time — build fails if missing/invalid

### 5.7 Performance Budget

#### Lighthouse Targets (95+ on ALL metrics, ALL pages)

| Page | Performance | Accessibility | Best Practices | SEO |
|------|------------|---------------|----------------|-----|
| `/` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| `/features` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| `/pricing` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| `/about` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| `/blog` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| `/blog/[slug]` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| `/download` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| `/privacy` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| `/terms` | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |

#### Core Web Vitals

| Metric | Target | How |
|--------|--------|-----|
| LCP | < 2.5s | Hero image `priority` + `placeholder="blur"`, preload fonts via `next/font` |
| INP | < 200ms | No heavy JS on main thread, defer PostHog, lazy load below-fold |
| CLS | < 0.1 | Explicit width/height on all images, `font-display: swap` via next/font, no layout shifts from animations |

#### Image Optimization Rules
1. ALL images use `next/image` (never raw `<img>`)
2. Hero image: `priority={true}`, `placeholder="blur"`, correct `sizes` attribute
3. Below-fold images: `loading="lazy"` (default)
4. Formats: AVIF with WebP fallback (configured in next.config.ts)
5. No images larger than necessary — check rendered size vs source size
6. SVGs: inline for small icons, `next/image` for complex SVGs
7. OG image: pre-generated, not on-demand (avoid cold start latency)

#### Font Optimization
```typescript
// Inter: display 'swap' (critical — body text)
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
// JetBrains Mono: display 'optional' (non-critical — data numbers only)
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], display: "optional", variable: "--font-mono" });
```

#### Bundle Size Rules
- No page > 100KB JS (check `next build` output)
- Use `@next/bundle-analyzer` to identify large deps
- `motion`: `LazyMotion` + `domAnimation` only (NOT full bundle)
- `lucide-react`: import individual icons, not entire package
- PostHog: loaded async, NOT in critical path
- Lenis: verify tree-shaken properly

#### Caching Strategy

| Resource | Cache Header | Notes |
|----------|-------------|-------|
| Static pages (/, /features, etc.) | `s-maxage=86400, stale-while-revalidate` | Vercel CDN caches, revalidate daily |
| Blog posts | `s-maxage=86400, stale-while-revalidate` | Rebuild on deploy |
| Static assets (JS, CSS, images) | `immutable, max-age=31536000` | Content-hashed filenames |
| API routes | `no-store` | Never cache form submissions |
| Sitemap | `s-maxage=86400` | Regenerate daily |

**Additional optimization strategies:**
- Code splitting per page (App Router automatic)
- `next/dynamic` for heavy animation components (carousel, particles, 3D)
- `contain: layout` on animated containers
- Canvas 2D for 50+ particles (DOM fine for <20)
- `will-change` only on actively animating elements
- Pause off-screen looping animations via IntersectionObserver

### 5.8 Analytics (PostHog)

**Setup:**
- Initialize in `instrumentation-client.ts` (Next.js 15 convention)
- Cookieless mode: `persistence: 'memory'` (no cookie banner needed)
- Reverse proxy via Next.js rewrites: `/ingest/*` → `https://us.i.posthog.com/*`
- Load async — NOT in critical rendering path
- Do NOT track PII (no email, no name in events)

**Tracked events:**

| Event | Properties |
|-------|-----------|
| `page_view` | Automatic with PostHog React |
| `cta_click` | `location`: hero / pricing / final / sticky / header |
| `pricing_toggle` | `plan`: monthly / yearly |
| `store_link_click` | `platform`: ios / android |
| `community_link_click` | — |
| `faq_expand` | `question`: question text |
| `feature_accordion_expand` | `category`: category name |
| `screenshot_carousel_interact` | — |
| `contact_form_submit` | `success`: boolean |
| `newsletter_signup` | `success`: boolean |
| `download_redirect` | `platform`: detected platform |
| `blog_post_view` | `slug`, `category` |

**Error monitoring:** Sentry or PostHog error tracking — capture unhandled exceptions, promise rejections, console.error. Alert on > 5 occurrences in 1 hour.

**Uptime monitoring:** Vercel Analytics (Web Vitals) + external uptime monitor for `/`, `/features`, `/pricing`, `/blog`.

### 5.9 Constants File Structure (`lib/constants.ts`)

```typescript
import { springs, glow, gradients, glass } from "./animations";

export const BRAND = {
  name: "Repwise",
  tagline: "Science-Based Fitness: Training + Nutrition in One App",
  domain: "repwise.app",
  telegram: "https://t.me/repwiseCommunity",
  appStore: "#", playStore: "#",
  support: "support@repwise.app",
};

export const PRICING = {
  monthly: 9.99, yearly: 79.99, yearlySavings: "33%",
  trialDays: 7, competitorTotal: 372, savings: "78%",
};

export const STATS = [
  { value: 300000, suffix: "+", label: "Foods in Database" },
  { value: 27, label: "Micronutrients Tracked" },
  { value: 4, label: "Types of PR Detection" },
  { value: 60, suffix: "+", label: "Features" },
];

// Also exports: FEATURES, COMPARISON_DATA, FAQ_ITEMS,
// TESTIMONIALS, NAV_LINKS, FOOTER_LINKS
```

### 5.10 Deployment (Vercel)

- `main` → production (`repwise.app`), PRs → preview URLs
- Custom domain: `repwise.app` → Vercel
- Cache: static 1yr immutable, HTML revalidate
- Redirects configured in next.config.ts (see §5.3)

### 5.11 Implementation Priority Order

| Priority | What | Why |
|----------|------|-----|
| 1 | next.config.ts hardening + security headers | Foundation — must be right from day 1 |
| 2 | Lenis smooth scroll + page transitions | Foundation feel |
| 3 | Hero (gradient mesh, text animation, 3D phone, magnetic CTA) | First impression |
| 4 | Bento grid (glassmorphism, spotlight, stagger) | Core value prop |
| 5 | Science section (heat map animation, data viz) | Credibility wow |
| 6 | Custom cursor | Polish layer |
| 7 | All other section animations | Complete experience |
| 8 | API routes (contact, newsletter) with hardening | Forms working |
| 9 | SEO (sitemap, robots, structured data, OG images) | Discoverability |
| 10 | Screenshot carousel 3D | Visual proof |
| 11 | Particle effects in final CTA | Finishing touch |
| 12 | Performance audit + bundle optimization | Ship quality |

---

## Phase 6: Visual Assets

### 6.1 Required Screenshots (Placeholder Until Real)

| # | Screen | Used In |
|---|--------|---------|
| 1 | Dashboard (TDEE ring, macro bars) | Hero, OG image |
| 2 | Active Workout (sets, reps, PR badge) | How It Works step 2, Carousel |
| 3 | Nutrition / Macro Rings | Bento card 2, Carousel |
| 4 | Body Heat Map | Bento card 1, Science, Carousel |
| 5 | Analytics Charts | Bento card 4, Carousel |
| 6 | Progress Photos | Bento card 5, Carousel |
| 7 | Weekly Report | Bento card 6, Carousel |
| 8 | Meal Plan | Carousel |
| 9 | Micronutrient Dashboard | Carousel |
| 10 | Onboarding | Carousel |

All dark mode. Placeholder: colored rectangles with screen names.

### 6.2 Phone Mockup Specs
- Device: iPhone 15 Pro, Space Black
- Screenshot: 1179×2556 (3x), rendered 300–600px
- CSS 3D perspective, drop shadow `0 24px 48px rgba(0,0,0,0.5)`
- Export WebP quality 85

### 6.3 SVG Body Heat Map
- Front + back silhouette, color-coded muscle regions
- Interactive: hover/tap for muscle group details
- Used in: Hero, Bento card 1, Science section, Features page
- **Signature visual** — unique to Repwise

### 6.4 OG Image (1200×630)
- Background `#0A0E13`, logo + name + tagline left, dashboard screenshot right (40% opacity fade), cyan gradient line bottom
- Generated dynamically via `@vercel/og` for blog posts (title + category + date)

### 6.5 Favicon
- Source: `app/assets/icon.png`
- Generate: 16×16, 32×32 ICO + 180×180 apple-touch + 192×192 android-chrome + SVG

---

## Appendix A: Quick Reference

### Color Cheat Sheet
```
Background:  #0A0E13 → #12171F → #1A2029 → #232A35
Accent:      #06B6D4 (cyan) — CTAs, links, focus, data viz
Text:        #F1F5F9 / #94A3B8 / #64748B
Premium:     #D4AF37 (gold)
Macros:      cyan / green / amber / pink
Borders:     #1E293B / #162032 / #06B6D4 (focus)
Glow:        cyan 0 0 40px, cyanIntense 0 0 80px, gold 0 0 40px
```

### Copy Cheat Sheet
```
Hero:        "Train Smarter. Eat Smarter. One App."
Sub:         "The only app combining evidence-based training science..."
CTA primary: "Start Free — 7 Days, No Card"
CTA final:   "Ready to Train Smarter?"
Problem:     "Stop Juggling 3 Apps"
Science:     "Built on Peer-Reviewed Exercise Science"
Pricing:     "Start Free. Upgrade When You're Ready."
404:         "This page skipped leg day."
Killer stat: "RP + MacroFactor = $372/yr. Repwise = $80/yr."
```

### Critical Design Rules
1. **Dark theme ONLY** — no light mode
2. **Cyan `#06B6D4` is primary accent** — all CTAs, links, highlights
3. **Every section has a CTA** — minimum 6 on homepage
4. **Body heat map SVG is the visual hero** — feature prominently
5. **Mobile-first** — most users on mobile
6. **Performance over flash** — 95+ Lighthouse, respect reduced motion
7. **Glassmorphism for feature cards** — frosted glass with subtle borders
8. **App Store badges on every page** — header, hero, pricing, footer minimum
9. **Placeholder-ready** — clear markers for screenshots, testimonials, press logos
10. **Conversion-focused copy** — every headline addresses pain or promises benefit
11. **`motion/react` only** — never `framer-motion`
12. **Lenis for smooth scroll** — buttery feel across entire site
13. **Spring physics everywhere** — nothing linear or robotic
14. **Custom cursor on desktop** — cyan dot + trailing ring
15. **Reference standard:** linear.app, vercel.com, raycast.com, stripe.com

---

## Appendix B: Pre-Deployment Checklist

### Build Verification Commands
```bash
next build          # Zero errors, zero warnings
next lint           # Zero ESLint errors
tsc --noEmit        # Zero TypeScript errors
```

### Full Pre-Deployment Checklist

| # | Check | Tool/Command | Pass Criteria |
|---|-------|-------------|---------------|
| 1 | TypeScript | `tsc --noEmit` | Zero errors |
| 2 | ESLint | `next lint` | Zero errors, zero warnings |
| 3 | Build | `next build` | Successful, no warnings |
| 4 | Bundle size | Build output | No page > 100KB JS |
| 5 | Lighthouse (local) | Chrome DevTools | 95+ all metrics, all pages |
| 6 | Links | `linkinator` or similar | Zero broken links |
| 7 | Accessibility | `axe-core` | Zero AA violations |
| 8 | Security headers | securityheaders.com | A+ rating |
| 9 | Structured data | Google Rich Results Test | Valid, no errors |
| 10 | OG images | opengraph.xyz | Correct for all pages |
| 11 | Mobile | Chrome DevTools device mode | No issues at 375px |
| 12 | Forms | Manual test | Submit, rate limit, validation all work |
| 13 | 404 page | Visit /nonexistent | Custom 404 renders correctly |
| 14 | Sitemap | Visit /sitemap.xml | All pages listed, valid XML |
| 15 | Robots | Visit /robots.txt | Correct directives |
| 16 | Canonical URLs | Check each page source | Self-referencing, correct |
| 17 | Console | Chrome DevTools | Zero errors, zero warnings |
| 18 | Network | Chrome DevTools | No failed requests, no mixed content |

### PostHog Event Tracking Verification
Verify each event fires correctly in PostHog dashboard:
`page_view`, `cta_click`, `pricing_toggle`, `store_link_click`, `community_link_click`, `faq_expand`, `feature_accordion_expand`, `screenshot_carousel_interact`, `contact_form_submit`, `newsletter_signup`, `download_redirect`, `blog_post_view`
