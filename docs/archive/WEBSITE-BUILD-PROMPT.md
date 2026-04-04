# Repwise Marketing Website — Complete Build Prompt

## YOUR MISSION

Build a stunning, conversion-optimized marketing website for **Repwise** — a science-based fitness app that combines hypertrophy training intelligence, comprehensive nutrition tracking, and adaptive coaching in one platform. The website must be dark-themed, animated, and designed to convert visitors into app downloads.

---

## ABOUT REPWISE

Repwise (internal codename: Hypertrophy OS) is a mobile fitness app targeting serious lifters (age 20-40) who want data-driven hypertrophy training + nutrition in a single app.

- **Domain:** repwise.app
- **Pricing:** Free tier + Premium at $9.99/mo or $79.99/yr (save 33%)
- **Trial:** 7-day free, no credit card required
- **Community:** Telegram — t.me/repwiseCommunity
- **Platforms:** iOS (App Store) + Android (Play Store)

### The Killer Differentiator

Repwise is the ONLY app combining hypertrophy science + full nutrition tracking + adaptive coaching. Competitors force users to buy 2-3 separate apps:
- RP Hypertrophy ($300/yr) + MacroFactor ($72/yr) = $372/yr
- Repwise = $80/yr (78% less, more features)

No other app has: WNS (Hypertrophy Units), SVG body heat maps, volume landmarks, fatigue engine, AND full nutrition with 3M+ food database, barcode scanning, micronutrient tracking, meal plans — all in one.

---

## TECH STACK (MANDATORY)

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 15** (App Router, `app/` directory) | SSR for SEO, React ecosystem |
| Styling | **Tailwind CSS v4** | Rapid development, dark theme |
| Animations | **Framer Motion** | Scroll-triggered, spring physics |
| Hosting | **Vercel** | Zero-config Next.js, edge CDN |
| Analytics | **PostHog** (already used in app) | Consistent tracking |
| Images | **Next.js Image** component | Optimized loading |
| Fonts | **Inter** (from Google Fonts via `next/font`) | Matches the app |
| Icons | **Lucide React** or **Heroicons** | Clean, consistent |
| TypeScript | **Yes, strict mode** | Type safety |

---

## DESIGN SYSTEM (MATCH THE APP EXACTLY)

### Colors

```
Background:
  base: #0A0E13
  surface: #12171F
  raised: #1A2029
  overlay: #232A35

Text:
  primary: #F1F5F9
  secondary: #94A3B8
  tertiary: #64748B
  inverse: #0F172A

Accent:
  primary: #06B6D4 (cyan — main brand color)
  primaryHover: #0891B2
  primaryMuted: rgba(6, 182, 212, 0.15)

Semantic:
  success: #22C55E
  error: #EF4444
  warning: #F59E0B

Premium:
  gold: #D4AF37
  goldMuted: rgba(212, 175, 55, 0.15)

Macro Colors (use in nutrition sections):
  calories: #06B6D4 (cyan)
  protein: #22C55E (green)
  carbs: #F59E0B (amber)
  fat: #EC4899 (pink)

Border:
  default: #1E293B
  subtle: #162032
  focus: #06B6D4
```

### Typography

```
Font: Inter (sans-serif)
Mono: JetBrains Mono (for data/numbers)

Sizes:
  hero: 64px (desktop) / 40px (mobile), font-weight 800
  h1: 48px / 32px, font-weight 700
  h2: 36px / 28px, font-weight 700
  h3: 24px / 20px, font-weight 600
  body: 16px / 16px, font-weight 400
  small: 14px, font-weight 400
  caption: 12px, font-weight 500

Line heights: 1.1 for headings, 1.6 for body
Letter spacing: -0.02em for headings, normal for body
Use tabular-nums for any numbers/stats
```

### Spacing & Layout

```
Grid: 8px base unit
Border radius: 8px (small), 12px (medium), 16px (large), 24px (cards)
Max content width: 1280px
Section padding: 120px vertical (desktop), 80px (mobile)
```

### Design Philosophy

"Bloomberg Terminal × modern fintech × elite training brand"
- Dark-first with layered depth (base → surface → raised)
- Glassmorphism for feature cards (frosted glass effect with subtle borders)
- Cyan accent pops against the dark background
- Data-rich but not cluttered — institutional, trustworthy, engineered
- Spring-based animations (match the app's Reanimated feel)

---

## PAGES TO BUILD

### Page 1: Homepage (MOST IMPORTANT — build this first)

The homepage is the conversion engine. It must have these sections IN THIS ORDER:

#### Section 1: Hero
- Bold headline. Options (pick the best or create your own):
  - "Train Smarter. Eat Smarter. One App."
  - "The Science of Gains — In Your Pocket"
  - "Where Hypertrophy Science Meets Nutrition Intelligence"
- Subheadline: "The only app combining evidence-based training science, comprehensive nutrition tracking, and adaptive coaching. Built for lifters who want results, not guesswork."
- 3D floating phone mockup showing the app dashboard (dark UI with cyan accents). Use a CSS 3D transform with perspective to create the floating/tilted effect. Use a placeholder phone frame with a screenshot inside.
- App Store + Play Store badges side by side (use official badge SVGs)
- Primary CTA button: "Start Free — 7 Days, No Card" (cyan background, large, rounded)
- Below CTA: "Available on iOS and Android" in secondary text
- Subtle animated gradient or particle effect in the background (keep it performant)
- The hero should feel premium, dark, and cinematic

#### Section 2: Social Proof Bar
- Horizontal bar with key stats, separated by subtle dividers:
  - "300,000+ Foods in Database"
  - "27 Micronutrients Tracked"
  - "3,187+ Tests Passing" (or replace with user count when available)
  - "4 Types of PR Detection"
- Use a subtle surface background (#12171F)
- Numbers should animate (count up) when scrolled into view
- Logos of any press/media mentions (placeholder slots for now)

#### Section 3: The Problem
- Headline: "Stop Juggling 3 Apps"
- Show the pain visually:
  - Left side: 3 app cards (workout app $30/yr + nutrition app $72/yr + coaching app $300/yr = $402/yr) — shown as cluttered, expensive, disconnected
  - Right side: Repwise single card ($80/yr) — clean, unified, everything in one
- Subtext: "Other apps make you choose between training science and nutrition tracking. Repwise gives you both — for 78% less."
- This section should have a subtle animation: the 3 cards collapse/merge into the single Repwise card on scroll

#### Section 4: Feature Showcase (Bento Grid)
- Use a bento grid layout (mixed card sizes — some 2x1, some 1x1, one 2x2)
- 6 feature cards with glassmorphism effect:

**Card 1 (2x2 — largest, hero card): Hypertrophy Science Engine**
- "Train with science, not guesswork"
- WNS (Hypertrophy Units) calculator
- Volume landmarks per muscle (MEV/MAV/MRV)
- Fatigue engine with 4-component scoring
- Visual: SVG body heat map (this is the most visually striking feature — show front + back silhouette with color-coded muscle regions)

**Card 2 (2x1): Smart Nutrition**
- "3M+ foods. One scan away."
- Dual database: USDA (300K+) + Open Food Facts (3M+)
- Barcode scanner
- Macro rings (calories cyan, protein green, carbs amber, fat pink)
- 27 micronutrient tracking
- Visual: Macro ring progress UI mockup

**Card 3 (1x1): Adaptive Coaching**
- "Your AI nutrition coach"
- TDEE calculation + weekly check-ins
- 4 coaching modes
- Target adjustments based on your data
- Visual: Coaching suggestion card mockup

**Card 4 (1x1): Analytics**
- "12 ways to visualize your progress"
- Strength progression charts
- Body composition trends
- Periodization calendar
- Visual: Chart/graph mockup

**Card 5 (1x1): Progress Photos**
- "See the transformation"
- Side-by-side comparison
- Pose overlays for consistency
- Timeline view
- Visual: Before/after comparison mockup

**Card 6 (1x1): Weekly Intelligence**
- "Your weekly performance report"
- Cross-domain insights (training + nutrition + body)
- Actionable recommendations
- Visual: Report card mockup

Each card should:
- Have a glassmorphism background (rgba white with blur)
- Subtle border (#1E293B)
- Fade-up animation on scroll (Framer Motion)
- Hover effect: slight scale + glow

#### Section 5: How It Works
- 3-step horizontal layout (vertical on mobile):
  1. **"Set Your Goals"** — "11-step onboarding personalizes your TDEE, macros, and training targets" — icon: target/crosshair
  2. **"Train & Track"** — "Log workouts with real-time feedback. Scan food with one tap. See previous performance inline." — icon: dumbbell
  3. **"See Results"** — "Analytics, weekly reports, and adaptive coaching evolve with you" — icon: chart trending up
- Each step has a number (01, 02, 03) in large faded text behind it
- Connecting line/dots between steps (animated on scroll)
- Phone mockup below each step showing the relevant screen

#### Section 6: The Science Section
- Headline: "Built on Peer-Reviewed Exercise Science"
- Subheadline: "Not bro-science. Not AI-generated plans. Real hypertrophy research, implemented as software."
- Feature deep-dives:
  - **Hypertrophy Units (WNS):** "We quantify your muscle-building stimulus with Weighted Number of Sets — accounting for exercise selection, proximity to failure, and volume load."
  - **Volume Landmarks:** "Know exactly when you're doing too little (below MEV), hitting the sweet spot (MAV), or risking overtraining (above MRV) — for every muscle group."
  - **Fatigue Engine:** "4-component fatigue scoring: strength regression (35%), volume load (30%), training frequency (20%), and nutrition compliance (15%). Know when to push and when to recover."
  - **RPE/RIR Tracking:** "Rate of Perceived Exertion and Reps in Reserve — color-coded, with built-in education so you learn to auto-regulate."
- Visual: Large SVG body heat map as the centerpiece, with annotation callouts pointing to different muscle groups
- Background: subtle grid pattern or topographic lines (scientific feel)

#### Section 7: Full Feature List
- Expandable/accordion sections for each of the 10 categories:
  1. **Workout Tracking** (14 features): Active workout logging, previous performance inline, set completion with haptic feedback, 4-type PR detection with confetti, rest timer V2 (floating bar + ring animation), progressive overload suggestions, superset grouping, warm-up set generation, exercise swap (same muscle group), per-exercise notes, copy from date, custom exercises, workout templates, session history
  2. **Hypertrophy Science** (6): WNS calculator, volume landmarks (MEV/MAV/MRV), fatigue engine, RPE/RIR tracking, strength standards, SVG body heat map
  3. **Nutrition** (11): USDA + Open Food Facts databases, barcode scanner, macro tracking with rings, micronutrient dashboard (27 nutrients), meal plans with shopping lists, food DNA profiling, dietary gap analysis, meal slot diary, copy meals, water tracking, quick add
  4. **Analytics** (12 types): Calorie/protein trends, weekly macro averages, TDEE estimation, exercise strength progression, body heat map drill-down, fatigue scoring, strength standards, bodyweight trend (EMA smoothed), periodization calendar, readiness trend, volume landmarks, weekly intelligence report
  5. **Body Composition** (5): Bodyweight logging with EMA trend, body measurements, Navy body fat calculator, progress photos with comparison, guided camera with pose overlays
  6. **Adaptive Coaching** (6): TDEE calculation, weekly check-in, target adjustments, 4 coaching modes (Manual/Coached/Collaborative/Recomp), recomp score, dashboard nudges
  7. **Periodization** (3): Training blocks (accumulation/intensification/deload/peak), block templates, calendar view
  8. **Gamification** (5): 23 achievements across 4 categories, daily + weekly streaks, streak freezes, weekly challenges, shareable workout cards (3 themes + QR code)
  9. **Education** (5): Article library (Hypertrophy/Nutrition/Programming/Recovery/Recomp/Supplements), search + filter, YouTube embeds, read time estimates, HU explainer sheets
  10. **Reports** (4): Weekly intelligence report, monthly report, year in review, health reports (blood test upload)
- Each category header shows the count and has an icon
- Expand to see bullet list of features

#### Section 8: Competitor Comparison
- Headline: "Why Lifters Switch to Repwise"
- Comparison table:

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

- Use checkmarks (cyan) and X marks (muted red) with the table styled on a surface card
- Below table: "RP + MacroFactor = $372/yr. Repwise = $80/yr. Same science. More features. One app."

#### Section 9: Testimonials
- Headline: "What Lifters Are Saying"
- Card carousel (3 visible on desktop, 1 on mobile)
- Each card: quote, name, photo (placeholder avatar for now), stat ("Lost 12kg in 16 weeks" / "Hit 5 PRs in first month")
- Use placeholder testimonials for now — mark them clearly as placeholders to be replaced
- Glassmorphism card style

#### Section 10: Pricing
- Headline: "Start Free. Upgrade When You're Ready."
- Two cards side by side:

**Free (forever)**
- Workout logging
- Basic nutrition tracking
- Dashboard
- Analytics
- Exercise library
- Learn articles
- CTA: "Download Free"

**Premium ($9.99/mo or $79.99/yr — save 33%)**
- Everything in Free, plus:
- Adaptive coaching
- Health reports
- Dietary gap analysis
- Micronutrient dashboard
- Advanced analytics
- Priority support
- Gold accent border (#D4AF37)
- CTA: "Start 7-Day Free Trial"
- Badge: "MOST POPULAR"

- Toggle between monthly/yearly pricing
- Below cards: "No credit card required for trial"

#### Section 11: App Screenshots Carousel
- Full-width horizontal scroll carousel
- 8-10 phone mockups showing key screens:
  1. Dashboard
  2. Active Workout
  3. Nutrition / Macro Rings
  4. Body Heat Map
  5. Analytics Charts
  6. Progress Photos
  7. Weekly Report
  8. Meal Plan
  9. Micronutrient Dashboard
  10. Onboarding
- Use 3D perspective phone frames
- Auto-scroll with pause on hover
- Use placeholder screenshots (solid colored rectangles with screen names) until real screenshots are provided

#### Section 12: FAQ
- Accordion-style Q&A:
  1. "Is Repwise free?" → "Yes! Core features are free forever. Premium unlocks adaptive coaching, health reports, micronutrient tracking, and more for $9.99/mo or $79.99/yr."
  2. "What makes Repwise different from Strong or Hevy?" → "Repwise is the only app combining hypertrophy science (volume landmarks, fatigue scoring, WNS) with full nutrition tracking (3M+ foods, barcode scanning, micronutrients) and adaptive coaching — all in one app."
  3. "Does it work offline?" → "Core workout logging works offline. Nutrition search requires internet for the food database."
  4. "Can I import data from other apps?" → "Yes! Repwise supports importing workout history from Strong, Hevy, and other popular apps."
  5. "What food databases do you use?" → "USDA FoodData Central (300,000+ foods) and Open Food Facts (3,000,000+ products with barcode support)."
  6. "Is my data secure?" → "Yes. All data is encrypted in transit and at rest. We use JWT authentication with bcrypt password hashing."
  7. "What platforms are supported?" → "iOS and Android. Built with React Native for a native experience on both platforms."
- Use structured data (FAQ schema) for SEO

#### Section 13: Final CTA
- Dark section with subtle gradient
- Headline: "Ready to Train Smarter?"
- Subheadline: "Join thousands of lifters who've upgraded their training with science."
- Large CTA: "Start Free — 7 Days, No Card"
- App Store + Play Store badges
- Telegram community link: "Join our community on Telegram"

#### Sticky Elements
- **Header:** Logo (left) + nav links (Features, Pricing, Blog, About) + "Download" CTA button (right, cyan)
- **Mobile:** Sticky bottom bar with "Get Repwise Free" button (full width, cyan)
- Header should be transparent on hero, then get a backdrop-blur background on scroll

---

### Page 2: Features Page (`/features`)

- Hero: "Everything You Need. Nothing You Don't."
- 10 sections, one per feature category (same categories as Section 7 above)
- Each section: full-width, alternating layout (text left/mockup right, then text right/mockup left)
- Phone mockup for each section showing the relevant screen
- Detailed bullet list of every feature in that category
- Scroll-triggered fade-in animations
- Sticky side navigation showing which section you're in (desktop only)
- Final CTA at bottom

### Page 3: Pricing Page (`/pricing`)

- Same pricing cards as homepage Section 10 but larger
- Full feature comparison table (every feature, grouped by category, with Free vs Premium columns)
- FAQ specific to pricing
- "Compare with competitors" section (same table as homepage Section 8)
- Money-back guarantee badge (if applicable)
- CTA: "Start Free Trial"

### Page 4: About / Our Story (`/about`)

- Founder story (the app has a FounderStoryScreen — mirror that content)
- Mission: "Make evidence-based fitness accessible to every serious lifter"
- The problem we're solving
- Team section (even if solo — show the builder)
- Tech credibility: "3,187+ automated tests", "Built with TypeScript, React Native, FastAPI"
- Telegram community link

### Page 5: Blog (`/blog`)

- Grid layout of blog post cards
- Categories: Training, Nutrition, Body Composition, App Updates, Science
- Individual post pages with MDX support
- Author info, publish date, read time
- Related posts at bottom
- Newsletter signup (optional)
- Start with 3-5 placeholder posts

### Page 6: Download (`/download`)

- Smart redirect: detect platform (iOS/Android/desktop) and show appropriate store link
- Desktop: show both store badges + QR code that links to the app
- Mobile: auto-redirect to appropriate store (with fallback buttons)
- "Scan to download" QR code for desktop visitors

### Page 7: Legal Pages

- `/privacy` — Privacy Policy
- `/terms` — Terms of Service
- Clean, readable layout with table of contents sidebar
- Placeholder content (mark as needing legal review)

---

## ANIMATIONS & INTERACTIONS (Framer Motion)

```typescript
// Scroll-triggered fade up (use for most sections)
const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: "easeOut" }
};

// Staggered children (use for feature grids, stats)
const staggerContainer = {
  whileInView: { transition: { staggerChildren: 0.1 } }
};

// Counter animation for stats (Social Proof section)
// Animate numbers from 0 to target value over 2 seconds

// 3D phone mockup hover
const phoneHover = {
  whileHover: { rotateY: -5, rotateX: 5, scale: 1.02 },
  transition: { type: "spring", stiffness: 300, damping: 20 }
};

// Parallax scroll effect for background elements
// Use useScroll + useTransform from Framer Motion

// Hero background: subtle animated gradient or floating particles
// Keep it performant — no heavy canvas animations
```

---

## RESPONSIVE BREAKPOINTS

```
Mobile: < 640px (single column, stacked layout)
Tablet: 640px - 1024px (2 columns where appropriate)
Desktop: > 1024px (full layout)

Mobile-specific:
- Hamburger menu
- Sticky bottom CTA bar
- Single-column bento grid
- Swipeable carousels
- Reduced animation (respect prefers-reduced-motion)
```

---

## SEO REQUIREMENTS

- Every page needs: unique title, meta description, Open Graph tags, Twitter card tags
- Homepage title: "Repwise — Science-Based Fitness: Training + Nutrition in One App"
- Structured data: SoftwareApplication schema on homepage, FAQ schema on FAQ sections
- Sitemap generation (Next.js built-in)
- robots.txt
- Canonical URLs
- Alt text on all images
- Semantic HTML (proper heading hierarchy, landmarks)

---

## PERFORMANCE TARGETS

- Lighthouse score: 95+ on all metrics
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Use Next.js Image for all images
- Lazy load below-fold sections
- Preload Inter font
- Minimize JavaScript bundle (code split per page)

---

## FILE STRUCTURE

```
repwise-website/
├── app/
│   ├── layout.tsx          # Root layout (fonts, metadata, analytics)
│   ├── page.tsx            # Homepage
│   ├── features/
│   │   └── page.tsx
│   ├── pricing/
│   │   └── page.tsx
│   ├── about/
│   │   └── page.tsx
│   ├── blog/
│   │   ├── page.tsx        # Blog listing
│   │   └── [slug]/
│   │       └── page.tsx    # Individual post
│   ├── download/
│   │   └── page.tsx
│   ├── privacy/
│   │   └── page.tsx
│   └── terms/
│       └── page.tsx
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── MobileNav.tsx
│   │   └── StickyMobileCTA.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── GlassCard.tsx
│   │   ├── Badge.tsx
│   │   ├── Accordion.tsx
│   │   ├── Toggle.tsx
│   │   └── PhoneMockup.tsx
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
│       ├── AnimatedCounter.tsx
│       ├── SectionWrapper.tsx  # Handles fade-in + max-width + padding
│       └── BodyHeatMap.tsx     # SVG body silhouette component
├── lib/
│   ├── constants.ts        # Colors, URLs, feature lists
│   ├── animations.ts       # Framer Motion variants
│   └── metadata.ts         # SEO metadata helpers
├── content/
│   └── blog/               # MDX blog posts
├── public/
│   ├── images/
│   │   ├── screenshots/    # App screenshots (placeholder)
│   │   ├── mockups/        # Phone mockup frames
│   │   └── icons/          # Feature icons
│   ├── badges/
│   │   ├── app-store.svg
│   │   └── play-store.svg
│   └── og-image.png        # Open Graph image
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## CONSTANTS FILE (lib/constants.ts)

Include all of these as structured data:

```typescript
export const BRAND = {
  name: "Repwise",
  tagline: "Science-Based Fitness: Training + Nutrition in One App",
  domain: "repwise.app",
  telegram: "https://t.me/repwiseCommunity",
  appStore: "#", // placeholder
  playStore: "#", // placeholder
};

export const PRICING = {
  monthly: 9.99,
  yearly: 79.99,
  yearlySavings: "33%",
  trialDays: 7,
  competitorTotal: 372, // RP + MacroFactor
  savings: "78%",
};

export const STATS = [
  { value: 300000, suffix: "+", label: "Foods in Database" },
  { value: 27, label: "Micronutrients Tracked" },
  { value: 4, label: "Types of PR Detection" },
  { value: 60, suffix: "+", label: "Features" },
];

// ... all feature lists, FAQ items, comparison data, etc.
```

---

## CRITICAL REQUIREMENTS

1. **Dark theme ONLY** — no light mode toggle needed. The dark aesthetic IS the brand.
2. **Cyan (#06B6D4) is the primary accent** — use it for all CTAs, links, highlights, and data visualization accents.
3. **Every section must have a CTA** — either "Start Free Trial" or App Store badges. Strong.app repeats their CTA 6+ times. Do the same.
4. **Mobile-first** — most fitness app users will visit on mobile. The mobile experience must be flawless.
5. **Performance over flash** — animations should enhance, not slow down. Respect `prefers-reduced-motion`. Target 95+ Lighthouse.
6. **Placeholder-ready** — use clear placeholder markers for: app screenshots, testimonials, press logos, download links. These will be replaced with real assets later.
7. **The body heat map SVG is the visual hero** — it's unique to Repwise and no competitor has it. Feature it prominently in the hero area and science section.
8. **Conversion-focused copy** — every headline should address a pain point or promise a benefit. No generic "Welcome to our app" copy.
9. **App Store badges must be on every page** — in the header CTA, hero, pricing section, and footer at minimum.
10. **Semantic HTML + accessibility** — proper heading hierarchy, ARIA labels, keyboard navigation, focus states, color contrast ratios.

---

## WHAT SUCCESS LOOKS LIKE

When someone lands on this website, they should:
1. Immediately understand what Repwise does (within 3 seconds)
2. Feel that it's premium and trustworthy (dark, polished, data-rich)
3. Understand why it's better than using Strong + MyFitnessPal separately
4. See the science credibility (WNS, volume landmarks, fatigue engine)
5. Find the download button easily (repeated CTAs, sticky elements)
6. Be convinced by the price comparison ($80 vs $372)
7. Feel confident starting a free trial (no credit card, 7 days)

Build this website to be the kind of landing page that makes people think "this app was built by someone who actually lifts."
