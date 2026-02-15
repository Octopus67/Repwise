# Onboarding Redesign — Competitive Research & Requirements

## Executive Summary

MacroFactor's onboarding is the gold standard in calorie tracking apps. It collects 12+ data points across a guided wizard, educates users along the way, and produces a personalized TDEE estimate + macro plan in ~10 minutes. Our current onboarding is a single-page form that collects 7 fields and feels like a medical intake form. This spec defines a redesigned onboarding that matches MacroFactor's depth while adding unique differentiators.

---

## Competitive Analysis: MacroFactor's Onboarding Flow

### What MacroFactor Collects (12 steps)

| Step | Data Point | Why It Matters |
|------|-----------|----------------|
| 1 | Gender (male/female) | BMR formula selection (Mifflin-St Jeor) |
| 2 | Birth date | Age → BMR calculation |
| 3 | Height | BMR calculation |
| 4 | Current weight | BMR + starting point for tracking |
| 5 | Body fat estimate (visual guide with reference photos) | Lean mass estimation → more accurate BMR |
| 6 | Exercise frequency (0-7+ sessions/week) | Activity multiplier for TDEE |
| 7 | Daily activity level (sedentary → highly active, measured in steps) | NEAT component of TDEE |
| 8 | Cardio experience (none/beginner/intermediate/advanced) | Refines activity multiplier |
| 9 | Lifting experience (none/beginner/intermediate/advanced) | Refines activity multiplier + protein recommendation |
| 10 | Goal (lose/maintain/gain) + target weight + rate | Calorie deficit/surplus calculation |
| 11 | Diet style (balanced/low-fat/low-carb/keto) | Macro split |
| 12 | Calorie floor (standard/low) | Safety guardrail for aggressive cuts |
| 13 | Training type | Adjusts protein recommendation |
| 14 | Calorie shifting preference (even/shifted) | Daily vs weekly calorie distribution |
| 15 | Protein preference | Final macro split |

### What MacroFactor Does Well
- Visual body fat estimation with reference photos (reduces guessing)
- Educational micro-lessons between steps ("Here's why we ask this...")
- Shows the calculated TDEE before asking for goal — user sees their baseline first
- Allows manual override if user knows their TDEE from prior tracking
- Calorie floor concept prevents dangerously low recommendations
- Animated characters add personality and reduce form fatigue
- Goal wizard shows projected timeline ("You'll reach 75kg by March 15")

### What MacroFactor Misses (Our Opportunity)
- No dietary restrictions/allergies collection (vegetarian, vegan, gluten-free, lactose intolerant)
- No meal timing preferences (intermittent fasting, number of meals per day)
- No sleep/stress assessment (affects cortisol → water retention → weight fluctuations)
- No prior dieting history ("Have you dieted before? How did it go?") — metabolic adaptation signal
- No food preference collection (cuisine preferences for better search defaults)
- No health conditions (PCOS, thyroid, diabetes) that affect metabolism
- No integration with wearables during onboarding (Apple Watch, Fitbit step data)
- No "why" question — understanding motivation improves coaching tone

---

## Our Redesigned Onboarding: Requirements

### Design Principles
1. **Progressive disclosure** — one question per screen, never overwhelming
2. **Education-first** — explain WHY each question matters before asking it
3. **Visual over text** — use illustrations, sliders, and visual selectors instead of text inputs where possible
4. **Instant feedback** — show how each answer changes the calculation in real-time
5. **Skip-friendly** — every non-essential question has a "Skip" option
6. **Resume-able** — persist progress so users can close and come back

### Flow: 8 Screens (expandable to 12 for power users)

#### Screen 1: Welcome + Goal Selection
- "What brings you here?" — emotional framing, not just "lose/gain/maintain"
- Options: "I want to lose fat", "I want to build muscle", "I want to eat healthier", "I want to maintain my physique"
- Each option has an illustration and a one-line description
- This maps to: cutting, bulking, maintaining, maintaining (with micro focus)

#### Screen 2: About You — Basics
- Sex (male/female/prefer not to say)
- Birth date (date picker, not text input)
- Height (slider with unit toggle kg/lbs, cm/ft-in)
- Current weight (large number input with unit toggle)
- All on one screen since they're fast to fill

#### Screen 3: Body Composition
- Body fat estimate with visual reference photos (6 images per sex showing 10%, 15%, 20%, 25%, 30%, 35%+)
- Slider that snaps to ranges
- "Not sure? That's okay — we'll refine this as you log" reassurance text
- Optional: waist measurement for more accurate estimate

#### Screen 4: Activity Profile
- "How active is your day-to-day life?" — visual cards:
  - Desk job, mostly sitting (sedentary)
  - On my feet some of the day (lightly active)
  - Physically active job or lots of walking (moderately active)
  - Very physical job or athlete (highly active)
- "How many times per week do you exercise?" — horizontal number selector (0-7+)
- "What kind of exercise?" — multi-select chips: Strength training, Cardio, Sports, Yoga/Flexibility, None

#### Screen 5: Your Metabolism (TDEE Reveal)
- Show the calculated TDEE with a visual breakdown:
  - BMR (base metabolism): ~1600 kcal
  - Activity: ~400 kcal
  - Exercise: ~300 kcal
  - Total: ~2300 kcal/day
- "This is how many calories your body burns each day"
- Option to override: "I already know my TDEE" → manual input
- Educational note: "This is our best estimate. It will get more accurate as you log food and weight over the next 2 weeks."

#### Screen 6: Your Goal Details
- Based on Screen 1 selection:
  - **Lose fat**: Target weight + rate (0.25-1.0 kg/week slider) + projected date
  - **Build muscle**: Target weight + rate (0.1-0.5 kg/week) + projected date
  - **Maintain**: Target weight range (±2kg)
- Show daily calorie budget based on goal
- Calorie floor warning if deficit is too aggressive

#### Screen 7: Diet Preferences
- "How do you like to eat?" — visual cards:
  - Balanced (equal carbs/fat)
  - High protein (extra protein, moderate carbs/fat)
  - Low carb (reduced carbs, higher fat)
  - Keto (very low carb, high fat)
- Protein preference slider: 1.4 - 2.6 g/kg (with recommendation highlighted based on goal + training)
- Show final macro split as a pie chart that updates in real-time

#### Screen 8: Dietary Needs (Optional — "Personalize further")
- Dietary restrictions: Vegetarian, Vegan, Pescatarian, Gluten-free, Dairy-free, Halal, Kosher
- Allergies: Nuts, Shellfish, Soy, Eggs, Other
- Cuisine preferences: Indian, Mediterranean, East Asian, Latin American, American, European
- Meal frequency: 2, 3, 4, 5+ meals per day
- Intermittent fasting: Yes/No (if yes, eating window)
- These feed into food search ranking and meal suggestions

#### Screen 9: Summary + Start
- Beautiful summary card showing:
  - Daily calories: 2,100 kcal
  - Protein: 165g | Carbs: 230g | Fat: 70g
  - Goal: Lose 5kg by April 2026
  - Weekly rate: 0.5 kg/week
- "Your plan is ready" with a CTA button
- Option to go back and adjust any step

### Acceptance Criteria

1. User can complete onboarding in under 5 minutes
2. Every screen has a back button and progress indicator
3. State persists across app closes (localStorage/SecureStore)
4. TDEE calculation uses Mifflin-St Jeor with activity multiplier
5. Body fat visual guide shows 6 reference images per sex
6. Goal rate slider shows projected completion date in real-time
7. Macro split pie chart updates live as user adjusts preferences
8. Skip button available on screens 3, 4, 8 (non-essential)
9. Unit system (metric/imperial) toggle available on screen 2
10. All collected data is sent to backend via POST /api/v1/users/goals on completion
11. Onboarding can be re-entered from Profile settings to update goals
12. Dark theme consistent with rest of app

### What Makes Us Superior to MacroFactor

1. **Dietary restrictions + cuisine preferences** — MacroFactor doesn't collect these. We use them to rank food search results and suggest meals that match the user's actual eating habits.
2. **Visual TDEE breakdown** — MacroFactor shows a single number. We show the components (BMR + activity + exercise) so users understand their metabolism.
3. **Real-time macro pie chart** — as users adjust diet style and protein preference, the pie chart updates live. MacroFactor shows this after setup, not during.
4. **Projected timeline** — "You'll reach your goal by [date]" shown during goal setting, not after.
5. **Health-aware** — collecting dietary restrictions and allergies makes food logging less frustrating from day one.
6. **Faster** — 8 screens vs MacroFactor's 15+ steps. We group related questions on single screens.
7. **Resume-able** — MacroFactor loses progress if you close mid-setup. We persist to local storage.
