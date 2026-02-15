# Onboarding UX Polish V2 — PM Design Critique & Spec

## Executive Summary

Four screens in the onboarding wizard have UX issues that create friction, confusion, or feel cheap. This document diagnoses each problem, explains why it matters for retention, and specifies the fix with enough detail for a junior dev to execute without questions.

---

## Issue 1: Birth Year — Raw TextInput feels like a form, not an app

### Current State
Birth year is a plain `TextInput` with placeholder "1998". User types 4 digits manually.

### Problem
- Typing a year on a numeric keyboard is error-prone (typos, partial input like "199")
- It feels like filling out a government form, not using a premium fitness app
- No visual feedback until all 4 digits are entered
- Users born in December 1999 vs January 2000 have a 1-year age difference that matters for BMR — but we only capture year, not month

### Fix: Scrollable Year Picker
Replace the TextInput with a scrollable drum/wheel picker (vertical scroll list) showing years from `currentYear - 13` down to `currentYear - 100`. Default position: `currentYear - 25` (age 25).

Because we already have `birthMonth` in the store (currently unused in BodyBasicsStep), add a month picker too — a horizontal row of 12 pill buttons (Jan–Dec). This improves age accuracy for BMR calculation.

**Why this matters**: Birth year is the first input after sex selection. If it feels clunky, the user's first impression of the wizard is "this is a prototype." A smooth scroll picker signals "this app was built with care."

**Implementation**:
- Use a `FlatList` with `snapToInterval` for the year picker (vertical, centered selection with opacity fade on non-selected items)
- 12 horizontal pill buttons for month (same pattern as sex selector)
- Store updates: `updateField('birthYear', year)`, `updateField('birthMonth', month)`
- Default scroll position: year = `currentYear - 25`, month = current month
- Visual: selected year is large + accent color, adjacent years fade to muted

---

## Issue 2: Height & Weight — TextInput is the wrong input for continuous values

### Current State
Height and weight are plain `TextInput` fields with numeric keyboard. User types a number.

### Problem
- Typing "170" on a phone keyboard requires 3 taps with no visual context of where that falls in a range
- No sense of "am I tall or short for my age?" — just a cold number
- Imperial conversion is confusing (user types total inches, sees conversion hint below)
- The unit toggle button is small and easy to miss
- Weight input has no guardrails — user could type 999 and only get a validation error on submit

### Fix: Scrollable Scale with Visual Feedback
Replace both TextInputs with horizontal scrollable ruler/scale components.

**Height scale**:
- Horizontal ruler with tick marks every 1 cm (or 1 inch in imperial)
- Center indicator line (accent color) shows current selection
- Large number display above: "170 cm" or "5'7""
- Range: 100–250 cm (or 3'3"–8'2")
- Snap to nearest whole number
- Unit toggle pill at top right (same as current, but more prominent)

**Weight scale**:
- Same horizontal ruler pattern
- Tick marks every 0.5 kg (or 1 lb in imperial)
- Large number display: "70.0 kg" or "154.3 lbs"
- Range: 30–300 kg (or 66–661 lbs)
- Snap to nearest 0.1 kg (or 0.1 lb)

**Why this matters**: Scrollable scales are the industry standard for fitness apps (MyFitnessPal, Noom, MacroFactor all use them). A TextInput for weight feels like a medical intake form. A scale feels like a premium tool. The tactile scroll also gives users a sense of where they fall in the range, which builds engagement.

**Implementation**:
- Create a reusable `ScrollScale` component: `<ScrollScale min={100} max={250} step={1} value={170} onChange={...} unit="cm" />`
- Uses `ScrollView` with `horizontal`, `snapToInterval={tickWidth}`, `onMomentumScrollEnd` to compute selected value
- Tick marks rendered as thin `View` elements, every 5th/10th tick is taller
- Selected value displayed prominently above the scale
- Haptic feedback on each tick snap (if expo-haptics available)

---

## Issue 3: Body Composition — No visual references, no education

### Current State
6 text-only cards in a 2×3 grid. Each shows a percentage range and a one-line description like "Very lean, visible abs." No images, no explanation of what body fat % actually means.

### Problem
- Most users don't know their body fat percentage. The descriptions help, but without visual references, users are guessing
- "Average, soft midsection" vs "Above average body fat" — these are subjective and could mean different things to different people
- No educational context: what IS body fat %? Why does it matter? Users who don't understand the concept will either skip (losing data quality) or pick randomly (wrong data)
- The skip path is good, but the primary path needs to be more engaging

### Fix: Visual Body Silhouettes + Educational Tooltip

**Visual references**:
- Replace text-only cards with cards that include a simple body silhouette illustration for each range
- Use emoji-based or SVG-based body outlines (not photos — photos create body image issues)
- Male silhouettes for male/other, female silhouettes for female
- Each silhouette shows approximate body shape at that BF% range
- Since we can't ship real SVG illustrations in v1, use a simple approach: colored body outline with a "fill level" indicator (like a progress bar shaped as a torso) — higher BF% = more fill

**Educational tooltip**:
- Add an info icon (ⓘ) next to the title "Body Composition"
- On tap, show an expandable section explaining:
  - "Body fat percentage is the proportion of your total weight that comes from fat tissue."
  - "Knowing your approximate body fat helps us calculate your lean mass, which gives a more accurate calorie target."
  - "Don't worry about being exact — an estimate within 5% is good enough."
- This text is always visible (not hidden behind a tap) — show it as a subtle card below the subtitle

**Why this matters**: Body composition is the most intimidating screen in the wizard. Users who feel confused or judged will skip. Users who feel educated and supported will engage. The educational text reduces skip rate, and visual references improve data accuracy.

**Implementation**:
- Add a `bodyFatInfo` card below the subtitle with the educational text (always visible, muted styling)
- For each range card, add a simple visual indicator: a vertical bar on the left side of the card, filled proportionally to the BF% midpoint (e.g., 12% = 12% filled, 38% = 38% filled), colored on a gradient from green (low) to orange (high)
- The bar serves as a quick visual anchor without requiring actual body illustrations
- Keep the existing text descriptions — they're good

---

## Issue 4: Diet Style — "50% carbs / 50% fat split" implies zero protein

### Current State
4 diet cards show:
- Balanced: "55% carbs / 45% fat split"
- High Protein: "50% carbs / 50% fat split"
- Low Carb: "30% carbs / 70% fat split"
- Keto: "10% carbs / 90% fat split"

### Problem
- The descriptions say "X% carbs / Y% fat split" — this reads as if the entire diet is only carbs and fat, with zero protein
- "High Protein" showing "50% carbs / 50% fat" is especially confusing — the name says high protein but the description only mentions carbs and fat
- The subtitle says "split your remaining calories" but "remaining" is not defined — remaining after what?
- Users who don't understand macronutrient math will be confused and either pick randomly or drop off

### Fix: Rewrite descriptions to show all three macros with clear context

**New card descriptions** (showing the full picture):

- **Balanced**: "Protein first, then 55/45 carbs-to-fat" → Better: show actual grams preview
- **High Protein**: "Extra protein, even carb/fat split"
- **Low Carb**: "Protein first, mostly fats, fewer carbs"
- **Keto**: "Very low carb, high fat, adequate protein"

But even better — show the actual gram breakdown on each card as a preview:

```
Balanced
Protein: 140g · Carbs: 187g · Fat: 68g
[====protein====][=====carbs======][==fat==]
```

Each card shows a mini horizontal stacked bar with the three macro colors, plus the gram values. This makes the split immediately visual and removes all ambiguity.

**Also add context text**: Change subtitle from "Choose how you'd like to split your remaining calories" to "Choose your macro balance. Protein is set first based on your body weight — these styles change how the rest of your calories are split between carbs and fat."

**Why this matters**: This is the screen where users decide their daily macro targets. If they don't understand what they're choosing, they'll pick randomly, get targets that don't match their expectations, and churn. Clear communication here directly impacts Day 1 food logging accuracy.

**Implementation**:
- Compute macros for each diet style on-the-fly using `computeMacroSplit(budget, weightKg, proteinPerKg, style)` for all 4 styles
- Show a mini stacked bar (3 colored segments) + gram values on each card
- Update subtitle text as specified above
- Keep the live macro card at the bottom (it updates when selection changes)

---

## Issue 5: Protein Per Kg — No explanation of why the range matters

### Current State
7 discrete buttons (1.4–2.6 in 0.2 increments). Buttons in the recommended range get a green tint. Below: "Recommended: X–X g/kg" text.

### Problem
- "Protein per kg body weight" is jargon — most users don't think in g/kg
- The recommended range is highlighted but there's no explanation of WHY it's recommended
- Users don't know what happens if they pick above or below the range
- The discrete buttons feel limiting — what if someone wants 1.9 or 2.1?

### Fix: Continuous slider with educational info tooltip

**Slider**:
- Replace discrete buttons with a continuous `Slider` (or custom horizontal scroll scale like the height/weight one)
- Range: 1.2–3.0 g/kg, step 0.1
- Recommended zone highlighted on the track (green segment)
- Current value displayed prominently above: "2.0 g/kg" → "140g protein/day"
- Show both the g/kg value AND the total grams (computed from weight) so users see the real-world impact

**Info tooltip**:
- Add an ⓘ icon next to "Protein per kg body weight"
- On tap (or always visible as a subtle card), show:
  - "Protein helps preserve muscle during fat loss and build muscle during bulking."
  - "The highlighted range is optimal for your goal and training style."
  - Below range: "Going below may cause muscle loss. Going above has diminishing returns but isn't harmful."
- This gives users confidence in their choice and reduces decision paralysis

**Why this matters**: Protein is the most important macro for body composition outcomes. If users pick too low (because they don't understand the scale), their results will be worse, and they'll blame the app. Education here directly impacts outcomes and retention.

**Implementation**:
- Use the same `ScrollScale` component from height/weight (horizontal ruler)
- Range: 1.2–3.0, step: 0.1
- Recommended zone: render a green background segment on the scale between `proteinRec.min` and `proteinRec.max`
- Display: "{value} g/kg · {Math.round(value * weightKg)}g protein/day"
- Info card below the scale with educational text (always visible, muted styling)

---

## Implementation Priority

| # | Screen | Change | Effort | Impact |
|---|--------|--------|--------|--------|
| 1 | DietStyleStep | Rewrite descriptions + mini macro bars | Small | High — removes confusion |
| 2 | DietStyleStep | Protein slider + info tooltip | Medium | High — improves data quality |
| 3 | BodyCompositionStep | Educational text + visual indicators | Small | Medium — reduces skip rate |
| 4 | BodyBasicsStep | Birth year scroll picker + month pills | Medium | Medium — premium feel |
| 5 | BodyBasicsStep | Height/weight scroll scales | Large | High — premium feel, industry standard |

**Recommended execution order**: 1 → 2 → 3 → 4 → 5

Items 1-3 are quick wins that fix real confusion. Items 4-5 are polish that elevate the premium feel.

---

## What We're NOT Changing

- **IntentStep** — 4 cards work well, no issues reported
- **LifestyleStep** — Activity level cards + exercise chips are clear
- **TDEERevealStep** — The reveal animation is the highlight of the wizard
- **GoalStep** — Rate buttons with color coding work well (discrete rates are intentional — we don't want users picking 0.37 kg/week)
- **FoodDNAStep** — Chip selectors are appropriate for multi-select
- **SummaryStep** — Review + edit flow is solid
- **FastTrackStep** — TextInputs are appropriate here (experienced users know their numbers)
