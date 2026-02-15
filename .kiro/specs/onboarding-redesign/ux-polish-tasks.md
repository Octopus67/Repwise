# Onboarding UX Polish V2 — Execution Tasks

## Phase 1: Quick Wins (Fix Confusion)

- [x] 1. DietStyleStep — Rewrite descriptions + add mini macro preview bars
  - [x] 1.1 Compute macros for all 4 diet styles on-the-fly in the component
  - [x] 1.2 Replace text descriptions with mini stacked bar (protein/carbs/fat colors) + gram values per card
  - [x] 1.3 Update subtitle: "Choose your macro balance. Protein is set first from your body weight — these styles change how carbs and fat are split."
  - [x] 1.4 Each card shows: style name, one-line philosophy, mini bar + "P: Xg · C: Xg · F: Xg"

- [x] 2. DietStyleStep — Protein section: continuous scale + info tooltip + total grams display
  - [x] 2.1 Replace 7 discrete buttons with a horizontal ScrollScale (range 1.2–3.0, step 0.1)
  - [x] 2.2 Highlight recommended zone on the scale (green segment between proteinRec.min and proteinRec.max)
  - [x] 2.3 Display above scale: "{value} g/kg · {totalG}g protein/day"
  - [x] 2.4 Add info card below scale explaining protein importance and the green zone

- [x] 3. BodyCompositionStep — Educational text + visual BF% indicators
  - [x] 3.1 Add educational card below subtitle explaining body fat % and estimation accuracy
  - [x] 3.2 Add a vertical fill bar on the left side of each range card (green→orange→red, filled proportionally)
  - [x] 3.3 Keep existing text descriptions unchanged

## Phase 2: Premium Polish (Elevate Feel)

- [x] 4. BodyBasicsStep — Birth year scroll picker + month pills
  - [x] 4.1 Replace birth year TextInput with a vertical FlatList scroll picker
  - [x] 4.2 Selected year: large + accent color, adjacent years fade to muted
  - [x] 4.3 Default scroll position: currentYear - 25
  - [x] 4.4 Add month selector: 12 horizontal pill buttons (Jan–Dec)
  - [x] 4.5 Update store: birthYear + birthMonth both set from this screen

- [x] 5. BodyBasicsStep — Height/weight scroll scales
  - [x] 5.1 Create reusable HorizontalScale component
  - [x] 5.2 Horizontal ScrollView with snapToInterval, tick marks, taller ticks every 5th/10th
  - [x] 5.3 Center indicator line (accent color), selected value displayed prominently above
  - [x] 5.4 Replace height TextInput with HorizontalScale (100–250 cm / 39–98 in)
  - [x] 5.5 Replace weight TextInput with HorizontalScale (30–300 kg / 66–661 lbs)
  - [x] 5.6 Keep unit toggle button, reset scroll positions when units change

## Phase 3: Verification

- [x] 6. Run all tests and diagnostics
  - [x] 6.1 getDiagnostics on all 3 modified files — 0 errors
  - [x] 6.2 npx jest --no-coverage — 51 suites, 486 tests, all passing
  - [x] 6.3 pytest tests/ — 285 tests, all passing
