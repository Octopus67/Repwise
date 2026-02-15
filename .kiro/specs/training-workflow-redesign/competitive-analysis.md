# Training Workflow Redesign — Competitive Analysis

**Author:** Principal Product Manager Analysis (15 years shipping consumer products)  
**Date:** 2025  
**Scope:** Complete training workflow redesign — exercise database, workout logging UX, templates, progressive overload, rest timer, exercise instruction, and advanced training features

---

## Executive Summary

The training workflow is the heartbeat of any fitness app. After analyzing 7 direct competitors, 5 exercise database sources, and our own codebase, the verdict is clear: **our current training workflow is 2-3 generations behind market leaders**. The exercise database has ~155 exercises with broken/missing images from a GitHub repo that may go offline. The workout logging UX requires too many taps. There's no active workout screen worthy of the name. The exercise picker lacks images, instructions, and muscle maps. Progressive overload is invisible. The rest timer is a basic countdown with no visual ring.

The good news: our backend is already more sophisticated than most competitors (PR detection, volume landmarks, periodization, analytics). The problem is entirely in the frontend experience and exercise content layer.

**The strategic play:** Upgrade the exercise database to 400+ exercises with reliable images/animations, rebuild the workout logging UX to match Strong's speed (≤3 seconds per set), and surface the intelligence we already have (progressive overload suggestions, volume tracking, previous performance) inline during the workout.

**2025/2026 Market Update:** The market has shifted significantly. Strong now has 5M+ users (4.9 stars). Hevy has exploded to 9M+ athletes (4.9 stars) and is the fastest-growing app in the category. New entrants like SensAI (deep wearable integration with HRV/sleep/recovery), Setgraph (fastest logging + comprehensive analytics), Gymscore (computer vision form analysis), and Liftosaur (programmable routines via scripting language) are pushing the boundaries. The trend is clear: **speed + intelligence + personalization**. Pure logbooks (Strong) are losing ground to apps that combine fast logging with adaptive coaching. Our nutrition-training integration is a genuine moat that no competitor has cracked.

**ExerciseDB Update (2025):** ExerciseDB has expanded to 1,500+ exercises in their v1 dataset (free/open-source tier) and 11,000+ in their premium API. The v1 dataset includes animated GIFs, target muscles, equipment, and body parts — all freely available for integration. This is a game-changer for our exercise database expansion strategy.

---

## 1. COMPETITOR DEEP DIVE

### 1.1 Strong — The Speed King

**Exercise Database:**
- ~300 exercises, curated (not user-generated junk)
- Static images (start/end position photos) for most exercises
- No video demos in free tier; Pro adds some
- Custom exercise creation supported
- Source: Proprietary, hand-curated

**Workout Logging UX:**
- **2-3 taps to log a set** — the industry benchmark
- Previous performance shown inline next to current set inputs
- Tap previous values to auto-fill → adjust → checkmark = done
- Set completion via checkmark with subtle row highlight
- No RPE/RIR tracking (major gap for advanced lifters)
- Plate calculator built into weight input

**Template/Program Features:**
- Robust template system (create from scratch or save workout)
- Folder organization for templates
- No periodization or mesocycle support
- No AI generation

**Progressive Overload:**
- Shows previous performance inline (weight × reps)
- No suggestions or recommendations
- No trend visualization during workout
- PR detection with badge on session

**Rest Timer:**
- Auto-starts on set completion
- Configurable per exercise
- Basic countdown display (no progress ring)
- Notification when complete

**Exercise Instructions:**
- Minimal — name + muscle group + equipment
- No form cues, no common mistakes, no muscle activation maps
- Relies on user knowledge

**What They Get Right:** Speed. The logging loop is so fast it becomes invisible. That's why lifters stay.  
**What They Get Wrong:** Zero intelligence. It's a dumb logbook. No volume tracking, no progressive overload suggestions, no periodization, no nutrition integration.

---

### 1.2 Hevy — Strong's Social Challenger

**Exercise Database:**
- ~400+ exercises with images
- Animated GIF demos for many exercises (major differentiator)
- Custom exercise creation with muscle group tagging
- Source: Proprietary + community contributions

**Workout Logging UX:**
- Matches Strong's speed (2-3 taps per set)
- Previous performance inline with tap-to-copy
- RPE tracking supported (optional per set)
- Superset grouping with visual bracket
- Drop set and warm-up set tagging
- Reorder exercises via drag-and-drop

**Template/Program Features:**
- Template creation from scratch or from completed workout
- "Routines" with scheduled days (Mon = Push, Tue = Pull, etc.)
- Community-shared routines (social feature)
- No periodization or auto-progression

**Progressive Overload:**
- Previous performance inline
- PR detection with celebration animation (confetti + banner)
- Muscle group distribution chart (sets per muscle per week)
- Volume tracking per muscle group over time
- No auto-progression suggestions

**Rest Timer:**
- Auto-starts on set completion
- Circular progress ring with countdown
- Configurable per exercise type
- +15s / -15s adjustment buttons
- Notification sound on completion

**Exercise Instructions:**
- Animated GIF showing movement pattern
- Primary/secondary muscle groups listed
- Equipment required
- No detailed form cues or common mistakes

**What They Get Right:** Social accountability + animated exercise demos + PR celebrations. The emotional design is excellent.  
**What They Get Wrong:** No nutrition integration, no adaptive anything, no periodization. Still fundamentally a logbook with a social layer.

---

### 1.3 RP Hypertrophy — The Science App

**Exercise Database:**
- ~200+ exercises, science-curated
- No images/animations in the app (text descriptions only)
- Exercises organized by muscle group with volume recommendations
- Source: Dr. Mike Israetel's research team

**Workout Logging UX:**
- More taps than Strong/Hevy (4-5 per set)
- Collects additional data: pump quality (1-3), soreness (1-3), performance rating
- Previous performance shown but less prominent
- Set completion with performance feedback collection

**Template/Program Features:**
- **Mesocycle-based programming** — the killer feature
- Auto-generates workouts based on volume landmarks (MEV/MAV/MRV)
- Progressive overload built into the program (auto-increases volume week over week)
- Deload weeks auto-scheduled based on fatigue accumulation
- Customizable muscle group priorities

**Progressive Overload:**
- **Best in class** — the app IS progressive overload
- Volume landmarks per muscle group (MEV/MAV/MRV)
- Fatigue tracking via pump/soreness/performance ratings
- Auto-adjusts volume based on recovery signals
- Deload recommendations based on accumulated fatigue

**Rest Timer:**
- Basic countdown
- Configurable per exercise
- No visual ring or advanced controls

**Exercise Instructions:**
- Minimal in-app (exercise name + muscle group)
- Relies on external YouTube content from Dr. Mike
- No in-app form guidance

**What They Get Right:** The science. Volume landmarks, fatigue management, and auto-periodization are genuinely superior to everything else on the market.  
**What They Get Wrong:** UX is clunky, no images, $35/month, web-only (no offline), no nutrition integration (separate RP Diet app), steep learning curve.

---

### 1.4 JEFIT — The Exercise Encyclopedia

**Exercise Database:**
- **1,400+ exercises** — largest curated database in the market
- HD images (start/end position) for most exercises
- Animated demonstrations for many exercises
- Detailed instructions: steps, tips, common mistakes
- Muscle activation maps showing primary/secondary muscles
- Custom exercise creation
- Source: Proprietary, professionally photographed

**Workout Logging UX:**
- Slower than Strong/Hevy (4-5 taps per set)
- UI feels dated (Material Design v1 era)
- Previous performance available but not inline
- No tap-to-copy from previous

**Template/Program Features:**
- Large library of pre-built programs
- Community-shared programs
- Basic scheduling (assign workouts to days)
- No periodization or auto-progression

**Progressive Overload:**
- Body part statistics and progress charts
- PR tracking
- No inline suggestions during workout
- Historical charts for each exercise

**Rest Timer:**
- Basic countdown timer
- Configurable duration
- No visual ring

**Exercise Instructions:**
- **Best in class** — detailed step-by-step instructions
- HD images showing start/end positions
- Muscle activation maps (primary muscles highlighted on body diagram)
- Common mistakes listed
- Tips for proper form

**What They Get Right:** Exercise content depth. If you don't know how to do an exercise, JEFIT is the best resource.  
**What They Get Wrong:** The logging UX is slow and dated. The app feels like it was designed in 2015. Social features feel bolted on. No nutrition, no adaptive anything.

---

### 1.5 Fitbod — The AI Workout Generator

**Exercise Database:**
- ~400+ exercises with images
- Animated demonstrations
- Muscle group targeting with visual body map
- Source: Proprietary

**Workout Logging UX:**
- AI generates the workout — user just follows along
- 3-4 taps per set (slightly more than Strong due to AI suggestions)
- Swap exercise suggestions if equipment unavailable
- Previous performance shown

**Template/Program Features:**
- **No templates** — AI generates every workout
- Considers: muscle recovery, available equipment, training history, goals
- Adapts based on what you've done recently
- Can't follow a fixed program (major limitation for structured lifters)

**Progressive Overload:**
- AI handles progression automatically
- Adjusts weight/reps based on performance trends
- Muscle recovery tracking (shows which muscles are fresh vs fatigued)
- No manual control over progression

**Rest Timer:**
- Auto-starts between sets
- Configurable duration
- Basic countdown

**Exercise Instructions:**
- Animated demos for each exercise
- Primary/secondary muscle groups shown on body map
- Step-by-step text instructions
- Video links for some exercises

**What They Get Right:** Zero-friction workout generation. Perfect for beginners who don't know what to do.  
**What They Get Wrong:** Advanced lifters hate it — you can't follow a specific program. The AI is a black box. No nutrition integration.

---

### 1.6 Alpha Progression — The European Challenger

**Exercise Database:**
- ~350+ exercises with images
- Animated GIF demos
- Muscle group mapping with visual body diagram
- Custom exercise creation
- Source: Proprietary

**Workout Logging UX:**
- Clean, modern UI (best visual design in the category)
- 2-3 taps per set (matches Strong)
- Previous performance inline
- RPE tracking with visual scale
- Superset support

**Progressive Overload:**
- **Auto-progression algorithm** — suggests weight/rep increases
- Based on performance trends and RPE data
- Volume tracking per muscle group
- Strength standards comparison (beginner → advanced)

**Rest Timer:**
- Circular progress ring
- Auto-start on set completion
- Configurable per exercise type
- +/- adjustment buttons

**Exercise Instructions:**
- Animated GIF demos
- Primary/secondary muscles highlighted
- Equipment alternatives suggested
- Brief form tips

**What They Get Right:** The best balance of speed + intelligence. Auto-progression suggestions are genuinely useful without being prescriptive.  
**What They Get Wrong:** Smaller user base means less community content. No nutrition integration. Limited analytics compared to RP.

---

### 1.7 GymStreak — The AI Workout Planner

**Exercise Database:**
- ~300+ exercises with animated demos
- 3D muscle activation visualizations (unique differentiator)
- Source: Proprietary

**Workout Logging UX:**
- AI-generated workouts with manual override
- 3-4 taps per set
- Previous performance shown
- RPE/RIR tracking

**Progressive Overload:**
- AI-driven progression
- Adapts based on performance and recovery
- Volume recommendations per muscle group

**Rest Timer:**
- Visual countdown with progress indicator
- Auto-start capability
- Configurable

**Exercise Instructions:**
- **3D animated muscle maps** — shows exactly which muscles activate during the movement
- Step-by-step instructions
- Form tips and common mistakes

**What They Get Right:** 3D muscle visualizations are genuinely impressive and educational.  
**What They Get Wrong:** AI workout generation has the same problem as Fitbod — advanced lifters want control. Smaller exercise database.

---

### 1.8 Setgraph — The Analytics-First Logger (New 2025)

**Exercise Database:**
- ~300+ exercises with images
- Focus on data quality over quantity
- Custom exercise creation

**Workout Logging UX:**
- Claims "fastest logging experience" in the category
- Optimized for set-by-set speed
- Previous performance inline
- Clean, minimal interface

**Progressive Overload:**
- Comprehensive analytics dashboard
- Volume tracking, strength trends, body composition
- PR detection and history

**What They Get Right:** Analytics depth rivals dedicated data tools. The logging speed claim is credible based on UX design.
**What They Get Wrong:** Smaller exercise database, less community, no nutrition integration.

---

### 1.9 SensAI — The Wearable-Integrated Coach (New 2025)

**Exercise Database:**
- Standard exercise library
- AI-generated workout suggestions

**Workout Logging UX:**
- Conversational AI coaching interface
- Adapts workout intensity based on real-time health data
- Natural language interaction

**Progressive Overload:**
- AI-driven adaptation based on HRV, sleep quality, recovery status
- Multi-device compatibility (Apple Watch, Garmin, Oura, Fitbit)
- Real-time adjustment during workout

**What They Get Right:** Deep wearable integration is genuinely novel. Adjusting training based on recovery signals (HRV, sleep) is the future.
**What They Get Wrong:** Requires wearable ecosystem buy-in. AI coaching can feel impersonal. No nutrition integration.

---

### 1.10 Liftosaur — The Programmer's Gym App (New 2025)

**Exercise Database:**
- Standard exercise library
- Custom exercise creation

**Workout Logging UX:**
- Built-in scripting language (Liftoscript) for custom progression logic
- Pre-built routines with auto-progression and deloads
- Clean, functional interface

**Progressive Overload:**
- **Programmable progression** — users can code their own progression rules
- Pre-built programs handle progressions and deloads automatically
- Extremely flexible for advanced lifters

**What They Get Right:** Infinite flexibility for power users. The scripting approach is unique and appeals to developer-lifters.
**What They Get Wrong:** Steep learning curve. Not accessible to casual users. Niche audience.

---

## 2. EXERCISE DATABASE SOURCES ANALYSIS

### 2.1 Current State: Free Exercise DB (GitHub)

Our current source: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises`

**Problems:**
- ~155 exercises in our database, many with `image_url: None` (~30% missing images)
- Images are static JPGs hosted on a personal GitHub repo — **single point of failure**
- No animations, no muscle maps, no form instructions
- Image quality is inconsistent (some are photos, some are illustrations)
- Repo could go offline or change URLs at any time
- No licensing clarity for commercial use

### 2.2 Available Exercise Database APIs & Sources

| Source | Exercises | Images | Animations | API | License | Cost |
|--------|-----------|--------|------------|-----|---------|------|
| **wger Exercise Database** | ~400 | ✅ SVG illustrations | ❌ | REST API (open) | AGPL-3.0 | Free |
| **ExerciseDB (RapidAPI)** | 1,500+ (v1 free) / 11,000+ (premium) | ✅ Animated GIFs | ✅ GIFs | REST API | Open-source (v1) / Commercial (premium) | Free (v1) / $10-100/mo (premium) |
| **MuscleWiki** | ~500 | ✅ Videos | ✅ Videos | Scraping only | CC-BY-SA | Free (scraping) |
| **Free Exercise DB (GitHub)** | ~800 | ✅ Static JPGs | ❌ | None (static files) | MIT | Free |
| **ACE Exercise Library** | ~300 | ✅ Photos | ❌ | None (web only) | Proprietary | N/A |
| **JEFIT Database** | 1,400+ | ✅ HD photos | ✅ Some | None (proprietary) | Proprietary | N/A |

### 2.3 Recommended Strategy: Hybrid Approach

**Primary: wger Exercise Database (open source)**
- 400+ exercises with SVG illustrations
- Open API with proper REST endpoints
- AGPL-3.0 license (fine for our use — we're not distributing the database as a standalone product)
- Muscle group mapping, equipment tags, exercise descriptions
- Active community maintaining the data
- Self-hostable if needed

**Secondary: ExerciseDB v1 Dataset (free, open-source)**
- 1,500+ exercises with animated GIF demonstrations
- Free v1 dataset — no monthly cost (previously $10/mo)
- Animated GIFs are the single biggest UX upgrade we can make
- Use as enrichment layer: match our exercises to ExerciseDB by name, pull GIF URLs
- Cache GIFs in our CDN to avoid runtime API dependency
- Premium tier (11,000+ exercises) available at $10-100/mo if needed later

**Tertiary: Custom content for gaps**
- Commission illustrations/animations for exercises not covered by wger or ExerciseDB
- Focus on popular exercises first (bench press, squat, deadlift, etc.)
- Use AI-generated exercise descriptions for form cues

**Migration plan:**
1. Map current 155 exercises to wger IDs (name matching + manual review)
2. Expand to 400+ exercises using wger as primary source
3. Enrich with ExerciseDB animated GIFs where available
4. Self-host all images/GIFs in our CDN (no runtime dependency on external APIs)
5. Add exercise descriptions, muscle activation data, and form tips from wger
6. Build admin tool for ongoing exercise database management

---

## 3. FEATURE-BY-FEATURE COMPETITIVE MATRIX

### 3.1 Workout Logging Speed (Taps Per Set)

| App | Taps to Log a Set | Previous Performance | Tap-to-Copy | Auto-fill |
|-----|-------------------|---------------------|-------------|-----------|
| **Strong** | 2-3 | ✅ Inline | ✅ | ✅ From previous |
| **Hevy** | 2-3 | ✅ Inline | ✅ | ✅ From previous |
| **Alpha Progression** | 2-3 | ✅ Inline | ✅ | ✅ + suggestions |
| **Fitbod** | 3-4 | ✅ | Partial | ✅ AI-generated |
| **GymStreak** | 3-4 | ✅ | Partial | ✅ AI-generated |
| **RP Hypertrophy** | 4-5 | ✅ | ❌ | ✅ From program |
| **JEFIT** | 4-5 | ✅ (not inline) | ❌ | ❌ |
| **HypertrophyOS (current)** | 5-7 | ✅ (separate section) | ❌ | ❌ |
| **HypertrophyOS (target)** | **2-3** | ✅ Inline | ✅ | ✅ From previous |

### 3.2 Exercise Database Depth

| App | Exercise Count | Images | Animations | Muscle Maps | Instructions | Custom Exercises |
|-----|---------------|--------|------------|-------------|-------------|-----------------|
| **JEFIT** | 1,400+ | ✅ HD | ✅ Some | ✅ Body diagram | ✅ Detailed | ✅ |
| **ExerciseDB** | 1,300+ | ✅ | ✅ GIFs | ❌ | ❌ | N/A |
| **Hevy** | 400+ | ✅ | ✅ GIFs | ❌ | Minimal | ✅ |
| **Fitbod** | 400+ | ✅ | ✅ | ✅ Body map | ✅ | ❌ |
| **Alpha Progression** | 350+ | ✅ | ✅ GIFs | ✅ | ✅ Brief | ✅ |
| **Strong** | 300+ | ✅ Static | ❌ | ❌ | Minimal | ✅ |
| **GymStreak** | 300+ | ✅ | ✅ 3D | ✅ 3D | ✅ | ❌ |
| **RP Hypertrophy** | 200+ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **HypertrophyOS (current)** | ~155 | ⚠️ Partial | ❌ | ❌ | ❌ | ❌ |
| **HypertrophyOS (target)** | **400+** | ✅ | ✅ GIFs | ✅ SVG | ✅ | ✅ |

### 3.3 Advanced Training Features

| Feature | Strong | Hevy | RP | JEFIT | Fitbod | Alpha | GymStreak | HOS Current | HOS Target |
|---------|--------|------|-----|-------|--------|-------|-----------|-------------|------------|
| Superset support | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ⚠️ Basic | ✅ |
| Drop set tagging | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Warm-up set tagging | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AMRAP tagging | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| RPE tracking | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| RIR tracking | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Volume per muscle | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Progressive overload suggestions | ❌ | ❌ | ✅ | ❌ | ✅ AI | ✅ | ✅ AI | ❌ | ✅ |
| Periodization | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Volume landmarks (MEV/MAV/MRV) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Nutrition integration | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 4. CURRENT STATE GAPS (HONEST ASSESSMENT)

### 4.1 Exercise Database — Critical Gaps

1. **Only ~155 exercises** — competitors have 300-1,400+
2. **~30% missing images** (image_url is None for ~45 exercises)
3. **Images from unreliable source** — personal GitHub repo, could disappear
4. **No animated demonstrations** — Hevy, Alpha, GymStreak all have GIFs
5. **No exercise instructions** — no form cues, no common mistakes, no tips
6. **No muscle activation data** — no primary/secondary muscle mapping beyond basic muscle_group
7. **No custom exercise creation** — users can't add exercises not in our database
8. **No exercise alternatives/substitutions** — if user doesn't have equipment, no suggestions

### 4.2 Workout Logging UX — Critical Gaps

1. **5-7 taps per set** vs Strong/Hevy's 2-3 — we're 2-3x slower
2. **Previous performance not inline** — shown as separate component below exercise name, not next to set inputs
3. **No tap-to-copy from previous** — user must manually type values
4. **Modal-based logging** — competitors use full-screen; we already have ActiveWorkoutScreen but it's behind a feature flag
5. **No auto-fill from previous workout** — when starting from template, weights are 0
6. **No plate calculator** — Strong has this, useful for barbell exercises

### 4.3 Rest Timer — Moderate Gaps

1. **No visual progress ring** — just a countdown number
2. **No pause/resume** — can only skip
3. **No +/-15s adjustment** — fixed duration only
4. **No per-exercise customization** — only compound vs isolation
5. **No color transition** (green → yellow → red)

### 4.4 Template System — Moderate Gaps

1. **Static templates only** — 6 pre-built, no user creation (user templates exist but UX is basic)
2. **No program scheduling** — can't assign templates to days of the week
3. **No progressive overload built into templates** — templates don't auto-increase weights
4. **No template sharing** — can't share with friends or community

### 4.5 Progressive Overload — Major Gap

1. **No inline suggestions during workout** — "Last time you did 80kg × 8, try 82.5kg × 8"
2. **No auto-progression algorithm** — Alpha Progression does this well
3. **Volume tracking exists but not surfaced during workout** — user has to go to analytics
4. **No "beat your last" indicators** — no visual cue that you should try to improve

---

## 5. STRATEGIC RECOMMENDATIONS

### 5.1 Priority Tier: P0 — Ship or Die

These are table-stakes features that every serious competitor has. Without them, we lose users in the first workout.

1. **Expand exercise database to 400+ with reliable images** — Use wger as primary source, enrich with ExerciseDB GIFs
2. **Inline previous performance with tap-to-copy** — Match Strong/Hevy's pattern exactly
3. **2-3 tap set logging** — Previous → tap to copy → adjust → checkmark
4. **Rest timer with progress ring** — Circular SVG arc, pause/resume, +/-15s, color transition
5. **Exercise images in picker and during workout** — Animated GIFs where available, static images as fallback

### 5.2 Priority Tier: P1 — Competitive Differentiation

These features put us ahead of Strong/Hevy and closer to RP/Alpha Progression.

6. **Progressive overload suggestions** — "Try 82.5kg × 8 (2.5kg increase)" based on recent trend
7. **RIR tracking** (alongside RPE) — RP and GymStreak have this, Strong/Hevy don't
8. **Exercise instructions with muscle activation** — Form cues, common mistakes, primary/secondary muscles
9. **Superset/circuit visual grouping** — Bracket indicator, shared rest timer
10. **Custom exercise creation** — Let users add exercises not in our database
11. **Volume tracking surfaced during workout** — "12 sets for chest this week (MAV: 14-18)"

### 5.3 Priority Tier: P2 — Moat Features (Nobody Else Has)

These leverage our unique nutrition + training integration.

12. **Nutrition-aware training suggestions** — "You're in a 500 kcal deficit, consider reducing volume by 20%"
13. **Training-aware nutrition targets** — "Leg day detected, protein target increased to 200g"
14. **Integrated workout + nutrition daily summary** — Single view showing both sides
15. **Auto-progression algorithm** — Based on performance trends, RPE/RIR data, and recovery signals

---

## 6. EXERCISE DATABASE MIGRATION PLAN

### Phase 1: Foundation (This Redesign)
- Map current 155 exercises to wger database IDs
- Import additional exercises from wger to reach 400+
- Self-host all exercise images in our CDN
- Add exercise descriptions and muscle activation data from wger
- Add `secondary_muscles`, `description`, `instructions`, `animation_url` fields to exercise schema

### Phase 2: Enrichment (Post-Launch)
- Integrate ExerciseDB animated GIFs for top 200 exercises
- Add muscle activation SVG diagrams (primary/secondary highlighting)
- Commission custom content for gaps
- Build admin tool for exercise database management

### Phase 3: User Content (Future)
- Custom exercise creation by users
- Exercise substitution suggestions based on available equipment
- Community-contributed exercise tips and form cues

---

## 7. KEY METRICS

| Metric | Current | Target | Benchmark (Best-in-Class) |
|--------|---------|--------|--------------------------|
| Exercises in database | ~155 | 400+ | 1,400 (JEFIT) |
| Exercises with images | ~110 (~70%) | 400+ (100%) | 100% (all competitors) |
| Exercises with animations | 0 | 200+ (50%) | 400+ (Hevy) |
| Taps per set | 5-7 | 2-3 | 2-3 (Strong/Hevy) |
| Workout completion rate | Unknown | 85%+ | ~80% (industry avg) |
| Set logging speed | Unknown | <3 seconds | <3 seconds (Strong) |
| Template usage rate | Unknown | 50%+ | ~40% (Hevy) |

---

## 8. CONCLUSION

The training workflow redesign is the single highest-leverage change we can make to the app. Our backend already has features that competitors charge $35/month for (volume landmarks, periodization, PR detection, analytics). The gap is entirely in the frontend experience and exercise content layer.

The strategy is clear:
1. **Match Strong/Hevy on speed** — 2-3 taps per set, inline previous performance, tap-to-copy
2. **Match JEFIT on content** — 400+ exercises with images, instructions, muscle maps
3. **Beat everyone on intelligence** — Progressive overload suggestions, volume tracking during workout, nutrition-training integration

We're not building a logbook. We're building the smartest training partner in the market.
