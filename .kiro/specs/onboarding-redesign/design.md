# PRD: Intelligent Onboarding Wizard — "Your Body, Your Plan"

## 1. User Problem

> "Every calorie tracker asks me the same boring questions, gives me a number, and expects me to trust it. I've been given 2,200 calories by three different apps and none of them worked. I don't know if the problem is me or the math. I just want something that actually understands MY body and tells me WHY it's recommending what it recommends."

The core pain is not data collection — it's **trust**. Users have been burned by generic TDEE calculators that spit out a number with zero explanation. MacroFactor partially solves this by adapting over time, but the initial onboarding still feels like a medical intake form. The first 5 minutes of any app determine whether a user becomes a 12-month subscriber or a day-1 uninstall.

**Sharpened problem**: Users don't trust calorie recommendations because they don't understand the math behind them, and they've never seen an app show its work.

---

## 2. User Stories

### Primary: The Motivated Beginner
> As a person who has never tracked macros before, I want the app to guide me through understanding my body's needs step by step, so that I feel confident in my daily targets and actually stick with tracking for more than a week.

### Secondary: The Experienced Tracker Switching Apps
> As someone who used MyFitnessPal for 2 years and knows my TDEE is roughly 2,400, I want to skip the basics and just set my targets quickly, so that I don't waste 10 minutes re-entering information I already know.

### Edge: The User with Dietary Restrictions
> As a vegetarian with lactose intolerance living in India, I want the app to know my food preferences from day one, so that search results show paneer and dal before chicken breast and whey protein.

### Edge: The Returning User
> As someone who downloaded the app 3 months ago, completed half the onboarding, and forgot about it, I want to pick up where I left off without starting over, so that I don't feel punished for being busy.

### Edge: The "Just Let Me In" User
> As an impatient person who hates setup wizards, I want to skip everything and start logging food immediately, so that I can explore the app before committing to a profile.

---

## 3. User Flow

### Entry Point
App launch → Auth (Login/Register) → Onboarding Wizard

### The "Out of the Box" Innovation: Show Your Work

Every competitor asks questions and produces a number. We ask questions, **show the math live**, and let the user see how each answer changes their plan. This is the core differentiator — transparency builds trust.

### Screen-by-Screen Flow

```
[Auth] → [S1: Intent] → [S2: Body] → [S3: Composition] → [S4: Lifestyle]
    → [S5: TDEE Reveal] → [S6: Goal] → [S7: Diet Style] → [S8: Food DNA]
    → [S9: Your Plan]
```

#### Screen 1: "What's Your Mission?" (Intent)
- Full-screen cards with illustrations, one per goal:
  - 🔥 "Lose fat and feel lighter"
  - 💪 "Build muscle and get stronger"
  - ⚖️ "Maintain and optimize"
  - 🧠 "Just eat healthier" (maps to maintain + micro focus)
- Single tap selection, auto-advances with a subtle slide transition
- **Drop-off prevention**: This is the easiest screen. One tap. No typing. Momentum starts here.
- **Because**: Emotional framing ("feel lighter") outperforms clinical framing ("caloric deficit") for activation. Source: Nir Eyal's Hook Model — the trigger must be emotional.

#### Screen 2: "About You" (Body Basics)
- Sex selector: two large pill buttons (Male / Female) + small "Prefer not to say" link below
- Birth date: scrollable month/year picker (not a calendar — faster)
- Height: horizontal slider with large number display, unit toggle (cm ↔ ft/in)
- Weight: large numeric keypad input with unit toggle (kg ↔ lbs)
- **All on one screen** because these are fast, low-friction inputs
- **Live sidebar**: A small "Your BMR" number appears in the corner and updates as they fill fields. This is the "show your work" moment — they see the number change as they type their weight.
- **Drop-off prevention**: Pre-fill sex from device profile if available. Auto-focus the first empty field. Progress bar shows 2/9.
- **Because**: Grouping related low-friction inputs reduces perceived effort. Splitting these into 4 screens (like MacroFactor) feels tedious.

#### Screen 3: "Your Body Composition" (Optional)
- Visual body fat estimator: 6 reference silhouettes per sex (10%, 15%, 20%, 25%, 30%, 35%+)
- User taps the one that looks closest — slider snaps to that range
- Below: "Not sure? Totally fine — we'll refine this as you log." with a Skip button
- **Innovation**: If they skip, we use the Navy body fat formula (waist + neck + height) as a fallback — but we DON'T ask for waist/neck measurements here. Instead, we use population averages by age/sex/BMI and show a confidence range: "We estimate 18-24% body fat based on your profile."
- **Live sidebar**: BMR updates to show lean mass-adjusted value
- **Because**: Body fat is the single biggest source of TDEE error. MacroFactor asks for it but most users guess wrong. Our confidence range is more honest and builds trust.

#### Screen 4: "Your Day" (Lifestyle)
- "What does a typical day look like?" — 4 illustrated cards:
  - 🪑 Desk job, mostly sitting
  - 🚶 On my feet part of the day
  - 🏃 Physically active job
  - ⚡ Very physical / athlete
- "How many times per week do you exercise?" — horizontal stepper (0 to 7+)
- "What kind?" — multi-select chips: Strength · Cardio · Sports · Yoga · Walking · None
- **Live sidebar**: Activity calories appear and add to the running TDEE total
- **Because**: Separating NEAT (daily activity) from EAT (exercise) produces a more accurate TDEE than a single "activity level" dropdown. MacroFactor does this; most others don't.

#### Screen 5: "Your Metabolism" (TDEE Reveal) — THE DIFFERENTIATOR
- Full-screen animated reveal of their daily energy expenditure
- **Stacked bar visualization**:
  ```
  ┌─────────────────────────────────┐
  │  BMR: 1,620 kcal                │ ████████████████
  │  Daily Activity: 420 kcal       │ █████
  │  Exercise: 280 kcal             │ ███
  │  Thermic Effect of Food: 230 kcal│ ██
  ├─────────────────────────────────┤
  │  TOTAL: 2,550 kcal/day         │
  └─────────────────────────────────┘
  ```
- Each bar animates in sequentially (0.3s stagger) with a count-up number
- Below: "This is how many calories your body burns every day. We'll refine this number as you log food and weight over the next 2 weeks."
- **Override option**: "I already know my TDEE" → tap to enter a custom number
- **Innovation that NO competitor does**: Tap any bar segment to see a plain-English explanation:
  - BMR: "This is what your body burns just to stay alive — breathing, heartbeat, brain function."
  - Activity: "This is the energy you burn from daily movement — walking, standing, fidgeting."
  - Exercise: "Based on 4 strength sessions per week."
  - TEF: "Your body burns ~10% of calories just digesting food."
- **Because**: This is the moment we earn trust. Every other app shows "2,550 kcal" and expects you to believe it. We show WHY it's 2,550. Users who understand the math are 3x more likely to trust the recommendation and stick with the plan. (Source: behavioral economics — transparency effect.)

#### Screen 6: "Your Goal" (Target Setting)
- Based on Screen 1 selection:
  - **Lose fat**: "How fast?" — slider from 0.25 to 1.0 kg/week
    - Green zone: 0.25-0.5 (recommended, sustainable)
    - Yellow zone: 0.5-0.75 (aggressive but doable)
    - Red zone: 0.75-1.0 (very aggressive, muscle loss risk)
  - **Build muscle**: slider from 0.1 to 0.5 kg/week with similar zones
  - **Maintain**: "What's your comfort range?" ±1-3 kg
- **Live calculation**: As slider moves, show:
  - Daily calorie budget (e.g., "2,050 kcal/day")
  - Projected date ("You'll reach 75 kg by March 22, 2026")
  - Weekly deficit/surplus ("That's a 500 kcal/day deficit")
- **Calorie floor**: If deficit pushes below 1,200 (women) or 1,500 (men), show a warning: "⚠️ This rate may be too aggressive. We recommend no lower than [floor] kcal/day."
- **Target weight input**: Optional — "I have a specific target" → numeric input
- **Because**: Real-time feedback on the slider prevents users from setting unrealistic goals. The color zones are a nudge, not a restriction. MacroFactor does this well; we match it and add the projected date inline (they show it on a separate summary screen).

#### Screen 7: "How You Like to Eat" (Diet Style)
- 4 visual cards:
  - ⚖️ Balanced (40C/30P/30F) — "Equal mix of everything"
  - 🥩 High Protein (30C/40P/30F) — "Extra protein for muscle"
  - 🥑 Low Carb (20C/30P/50F) — "Fewer carbs, more fat"
  - 🧈 Keto (5C/30P/65F) — "Very low carb, high fat"
- **Protein preference**: Slider from 1.4 to 2.6 g/kg with a highlighted "recommended" zone based on their goal + training type
  - Lose fat + strength training → recommend 2.0-2.4 g/kg
  - Build muscle → recommend 1.8-2.2 g/kg
  - Maintain → recommend 1.6-2.0 g/kg
- **Live pie chart**: Updates in real-time as they select diet style and adjust protein
  - Shows grams AND percentages: "Protein: 165g (32%) · Carbs: 210g (41%) · Fat: 62g (27%)"
- **Because**: The live pie chart makes abstract macro ratios tangible. MacroFactor shows this AFTER setup; we show it DURING, so the user feels ownership of their plan.

#### Screen 8: "Your Food DNA" (Preferences — Optional)
- "Help us personalize your food search" — warm, optional framing
- **Dietary identity**: Chips — Vegetarian · Vegan · Pescatarian · Eggetarian · No restrictions
- **Allergies/Intolerances**: Chips — Dairy · Gluten · Nuts · Soy · Eggs · Shellfish · None
- **Cuisine preferences**: "What do you eat most?" — multi-select with flags:
  - 🇮🇳 Indian · 🌍 Mediterranean · 🇯🇵 East Asian · 🇲🇽 Latin American · 🇺🇸 American · 🇪🇺 European · 🌏 Southeast Asian
- **Meal frequency**: "How many meals do you eat?" — stepper (2-6)
- **Skip button** prominent — "You can set this up later in Settings"
- **Because**: This is the data NO competitor collects. It feeds directly into food search ranking (Indian vegetarian user sees paneer before chicken), meal suggestions, and recipe recommendations. This is our moat — personalization from minute one.

#### Screen 9: "Your Plan" (Summary + Launch)
- Beautiful summary card with all key numbers:
  ```
  ┌─────────────────────────────────┐
  │  🎯 Your Daily Targets          │
  │                                 │
  │  Calories: 2,050 kcal           │
  │  Protein:  165g                 │
  │  Carbs:    210g                 │
  │  Fat:      62g                  │
  │                                 │
  │  Goal: Lose 5 kg by Mar 22     │
  │  Rate: 0.5 kg/week             │
  │  TDEE: 2,550 kcal/day          │
  └─────────────────────────────────┘
  ```
- "Edit any section" — each row is tappable to jump back to that screen
- **CTA**: "Start Your Journey" — large, primary button
- Confetti animation on tap (subtle, 1 second)
- **Because**: The summary is the contract. The user sees exactly what they signed up for. The edit links prevent "I wish I'd changed that" regret that causes immediate settings-diving.

### Fast Track for Experienced Users
- On Screen 1, add a small link: "I know my numbers — skip to targets"
- This jumps to a single screen with: Calories, Protein, Carbs, Fat inputs + Goal type
- Saves in 30 seconds
- **Because**: The "Just Let Me In" persona is real. 15-20% of users in calorie tracking apps are switchers who already know their macros. Forcing them through 9 screens is disrespectful of their time.

---

## 4. Premium Feel

| Element | Implementation | Because |
|---------|---------------|---------|
| Screen transitions | Horizontal slide with spring physics (react-native-reanimated) | Feels like turning pages in a book, not clicking through a form |
| Progress indicator | Thin animated bar at top (not dots) | Dots feel clinical. A filling bar feels like progress |
| Number animations | Count-up animation on TDEE reveal (useCountingValue hook — already exists) | Static numbers feel dead. Animated numbers feel alive and earned |
| Haptics | Light impact on card selection, medium on TDEE reveal | Tactile confirmation that "yes, you chose this" |
| Loading states | Skeleton pulse on TDEE calculation (already have useSkeletonPulse) | Never show a spinner. Skeletons feel faster |
| Empty states | N/A — onboarding has no empty states by design | |
| Copy tone | Warm, second-person, no jargon. "Your body burns..." not "BMR is..." | We're a coach, not a textbook |
| Error states | Inline validation with gentle copy: "Hmm, that weight seems off — double check?" | Never "Invalid input" |
| Skip affordance | Ghost button, never primary. "You can do this later" not "Skip" | "Skip" feels like you're missing out. "Later" feels like a choice |

---

## 5. Integration Audit

| Existing Flow | What Changes | What Stays |
|---------------|-------------|------------|
| `App.tsx` routing | Onboarding now shows the new wizard instead of old `OnboardingScreen` | Auth flow, token management, session restore — all untouched |
| `OnboardingScreen.tsx` (current) | Replaced entirely by new multi-screen wizard | File kept for backward compat but not rendered |
| `POST /api/v1/users/goals` | Payload expanded with new fields (dietary_restrictions, cuisine_prefs, meal_frequency) | Existing fields (goal_type, height_cm, weight_kg, etc.) unchanged |
| `POST /api/v1/onboarding/complete` | New endpoint that accepts the full onboarding payload | Existing goal endpoint still works for profile edits |
| Zustand store | `needsOnboarding` flag behavior unchanged | All other store slices untouched |
| Dashboard | No changes — dashboard reads from the same goal/profile data | |
| Food search | Search ranking now considers `cuisine_preferences` and `dietary_restrictions` from user profile | Search API contract unchanged — ranking is server-side |

---

## 6. Backward Compatibility

- **Existing users who already onboarded**: See no change. Their `needsOnboarding` is `false`, wizard never shows.
- **Users mid-onboarding on old version**: Old `OnboardingScreen` still exists in the codebase. If they somehow hit it, it still works and submits to the same endpoint.
- **New users on old app version**: Get the old onboarding. No breakage.
- **Backend**: New onboarding fields are all optional in the API schema. Old clients that don't send `dietary_restrictions` or `cuisine_preferences` simply get default behavior (no food search personalization).
- **Degraded experience**: If the new wizard fails to load (JS error), `App.tsx` catches the error boundary and falls back to the old `OnboardingScreen`.

---

## 7. Edge Cases

| Scenario | Behavior |
|----------|----------|
| User closes app mid-wizard | State persisted to localStorage/SecureStore. On reopen, resume from last completed screen. |
| User has no network during onboarding | All screens work offline (pure client-side calculation). Only Screen 9 "Start" requires network to POST goals. Show retry if POST fails. |
| User enters weight of 0 or 999 | Inline validation: "Please enter a weight between 20 and 300 kg" |
| User is under 16 | Allow onboarding but show: "This app is designed for adults. Consult a healthcare provider for personalized nutrition advice." |
| User selects "Prefer not to say" for sex | Use average of male/female BMR formulas. Note: "For the most accurate results, selecting male or female helps us calculate your metabolism more precisely." |
| Feature flag off | Old `OnboardingScreen` renders. Zero impact on existing users. |
| User skips all optional screens | Defaults applied: 22% body fat (population average), no dietary restrictions, no cuisine preferences, 3 meals/day. Plan still generates correctly. |
| User goes back from Screen 9 to Screen 2 and changes weight | All downstream calculations (BMR, TDEE, calories, macros) recalculate automatically. Summary on Screen 9 reflects the change. |

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Onboarding completion rate** | >80% of users who start Screen 1 reach Screen 9 | Funnel analytics (PostHog) |
| **Time to first food log** | <24 hours after onboarding completion | Event: `first_food_logged` timestamp minus `onboarding_completed` timestamp |
| **Day-7 retention** | >45% (industry average for fitness apps is ~25%) | Cohort analysis |
| **Guardrail: Existing user churn** | <0.5% increase in existing user churn rate | Compare churn rate 2 weeks before vs 2 weeks after launch |

---

## 9. Rollout Strategy

1. **Week 1**: Ship behind feature flag `onboarding_v2`. Internal team + 5 beta testers.
2. **Week 2**: Enable for 10% of new signups. Monitor completion rate and drop-off by screen.
3. **Week 3**: If completion rate >75%, expand to 50%. If any screen has >30% drop-off, investigate and fix.
4. **Week 4**: 100% of new signups. Old onboarding code stays in codebase for 90 days as fallback.
5. **Kill switch**: Feature flag can be toggled off in <1 minute via backend config. All new users immediately get old onboarding.

---

## 10. What We're NOT Building (v1)

| Out of Scope | Why |
|-------------|-----|
| Apple Health / Fitbit integration during onboarding | Adds complexity and permission prompts that increase drop-off. Ship as a post-onboarding prompt on the dashboard instead. |
| AI-powered body fat estimation from photos | Cool but unreliable, privacy-sensitive, and adds 2+ weeks of development. Visual reference guide is sufficient for v1. |
| Meal plan generation from onboarding data | Onboarding collects preferences; meal planning is a separate feature. Don't conflate setup with ongoing coaching. |
| Sleep/stress assessment | Interesting data but not actionable in v1. No feature consumes this data yet. Add when we build the wellness module. |
| Prior dieting history ("Have you dieted before?") | Useful for metabolic adaptation modeling but our adaptive engine doesn't use this signal yet. Add when the engine supports it. |
| Animated mascot characters (like MacroFactor) | Nice-to-have but adds design cost without measurable retention impact. Our "show your work" TDEE reveal IS the personality. |
| Multi-language support | English only for v1. Localization is a platform concern, not a feature concern. |
| Wearable step data import | Same as Apple Health — post-onboarding integration, not during. |
