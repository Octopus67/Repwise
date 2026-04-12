# Exercise UX Overhaul Plan v2 — Post-Audit Corrections

> Updated with 17 findings from independent review
> 7 phases (was 6), ~5-6 hours total

---

## PHASE 1: Fix SVG Muscle Diagram Colors [15 min]

**Correction from audit:** `effective_sets: 10, mev: 1, mrv: 10` → `nearMrv` tier (YELLOW), not RED as originally claimed. To get RED (aboveMrv), need `effective_sets: 11`.

**File:** `app/components/exercise/ExerciseMuscleDiagram.tsx`

**Fix:**
- Primary: `{ effective_sets: 11, mev: 1, mrv: 10, mav: 5 }` → `aboveMrv` → RED
- Secondary: `{ effective_sets: 5, mev: 1, mrv: 10, mav: 5 }` → `optimal` → GREEN
- Inactive: stays `untrained` → GRAY

**Risk:** LOW
**Test:** Visual verification — primary=red, secondary=green, inactive=gray.

---

## PHASE 2: Centralize Image URL Resolution + Add Images [45 min]

**Correction from audit:** Image URLs are broken in ExerciseDetailSheet AND SessionDetailScreen (relative paths not resolved). Must fix ALL screens, not just add to ExerciseDetailScreen.

### Task 2.1: Create shared `resolveImageUrl` utility
**File:** `app/utils/exerciseDetailLogic.ts`
- Move `resolveImageUrl` from ExerciseCard.tsx to shared utility
- Import `API_BASE_URL` from services/api
- Export for use everywhere

### Task 2.2: Add hero image to ExerciseDetailScreen
**File:** `app/screens/training/ExerciseDetailScreen.tsx`
- Import `Image`, `shouldShowImage`, `getDisplayImageUrl`, `resolveImageUrl`
- Add image between tags and muscle diagram
- Add fallback: MuscleGroupIcon placeholder for 32 exercises without images
- Use `aspectRatio: 16/9` instead of fixed `height: 200` (handles varying image ratios)
- Add `onError` handler to show fallback on load failure

### Task 2.3: Fix ExerciseDetailSheet image URLs
**File:** `app/components/training/ExerciseDetailSheet.tsx`
- Import and apply `resolveImageUrl` to the existing image rendering

### Task 2.4: Fix SessionDetailScreen image URLs
**File:** `app/screens/training/SessionDetailScreen.tsx`
- Import and apply `resolveImageUrl` to exercise thumbnails

### Task 2.5: Update ExerciseCard.tsx to use shared utility
**File:** `app/components/exercise-picker/ExerciseCard.tsx`
- Remove local `resolveImageUrl`, import from shared utility

**Risk:** LOW — fixing existing broken behavior + additive UI.

---

## PHASE 3: Visible Set Delete Button + Undo [45 min]

**Correction from audit:** Must add undo mechanism — a visible delete button without undo makes accidental deletion too easy.

**File:** `app/components/training/SetRowPremium.tsx`

### Task 3.1: Add delete button on far left
- Small `×` icon (Ionicons `close-circle-outline`, 16px) BEFORE the set number
- `c.text.muted` color, `hitSlop: 10` all sides → 36×36px touch target
- Only show when `onRemoveSet` is provided
- Layout: `[× delete] [#] [Type?] [Prev] [Reps] [Weight ±] [RPE?] [RIR?] [✓ check]`

### Task 3.2: Add undo toast on deletion
- When delete is tapped, show toast "Set deleted" with "Undo" action (3 second timeout)
- Use the existing `useToast` context (already integrated in Phase 5 of previous plan)
- On undo: re-add the set at the same position
- Store the deleted set data temporarily in a ref

**Risk:** MEDIUM — undo requires storing deleted set state.

---

## PHASE 4: Improve Info Button + Remove Chevron [15 min]

**Correction from audit:** Removing chevron needs a replacement visual cue. Add a subtle "+" indicator instead.

**File:** `app/components/exercise-picker/ExerciseCard.tsx`

**Fix:**
1. Remove chevron `›`
2. Increase info icon: 18 → 22px
3. Add subtle circular background to info button
4. Add a small `+` badge or "Add" text on the left side of the card (where the image/icon is) to indicate tap=add

**Risk:** LOW — style changes.

---

## PHASE 5: Regenerate 1,200 Exercise Descriptions + Instructions [2-3 hrs]

### Corrections from audit:
- Use 3 format variants (standard, bodyweight/isometric, stretch/mobility)
- Add "Muscles Worked" as structured data
- Add difficulty tag (🟢/🟡/🔴)
- Max word counts per layer (hook: 30w, why: 60w, pro tip: 40w, biomechanics: 80w)
- Use Haiku for bulk generation (~$1.60), Sonnet for QA on 50 exercises
- Validate description length (max 250 words total)

### New 5-Layer Description Format:

**Standard exercises (compound/isolation with equipment):**
```
**[One-liner hook — 30 words max]**

**Muscles worked:** Primary: [muscle]. Secondary: [muscles].
**Difficulty:** 🟢 Beginner / 🟡 Intermediate / 🔴 Advanced

[Why it works — 60 words max. Accessible language, no jargon.]

**Pro tip:** [One standout practical insight — 40 words max.]

**Biomechanics:** [Strength curve, loading position, stretch potential — 80 words max. Collapsed by default in UI.]
```

**Bodyweight/isometric variant (drop biomechanics, expand pro tip):**
```
**[One-liner hook]**

**Muscles worked:** Primary: [muscle]. Secondary: [muscles].
**Difficulty:** 🟢/🟡/🔴

[Why it works — 80 words max.]

**Pro tip:** [Expanded to 60 words — covers form cues and common mistakes.]
```

**Stretch/mobility variant (2 layers only):**
```
**[What this stretch does — 30 words]**

**Target areas:** [muscles/joints]

[How to get the most from it — 60 words. Focus on breathing, hold duration, when to use it.]
```

### Regeneration Script:
1. Create `scripts/regenerate_descriptions.py`
2. Process in batches of 20 exercises
3. Input per exercise: name, equipment, muscle_group, secondary_muscles, category, strength_curve, loading_position, stimulus_to_fatigue, stretch_hypertrophy_potential, fatigue_rating, is_mobility
4. Generate: new `description` (layered format), new `instructions` (3-6 correct steps)
5. Keep existing `tips` and `coaching_cues` (already good quality)
6. Validate: equipment match, word counts, no empty sections
7. Write back to `exercises_data.json`

### Instruction Regeneration:
- ALL 1,200 exercises get new instructions
- 3-6 numbered steps per exercise
- Equipment must match exercise name
- Start with setup, end with return to start
- Clear, gym-ready language

**Risk:** MEDIUM — 1,200 entries modified. Run existing validation tests + spot-check 50.

---

## PHASE 6: Frontend Markdown Rendering [30 min]

**Correction from audit:** `react-native-markdown-display` v7.0.2 is already installed and used in `ArticleDetailScreen.tsx`. Don't build a custom parser.

### Task 6.1: Create shared markdown styles
**File:** `app/utils/markdownStyles.ts` (or reuse from ArticleDetailScreen)
- Theme-aware styles for bold, paragraphs, headers
- Compact variant for exercise descriptions (smaller font, tighter spacing)

### Task 6.2: Apply to ExerciseDetailScreen
**File:** `app/screens/training/ExerciseDetailScreen.tsx`
- Replace `<Text>{description}</Text>` with `<Markdown style={markdownStyles}>{description}</Markdown>`
- Make "Biomechanics" section collapsible (collapsed by default)

### Task 6.3: Add description to ExerciseDetailSheet
**File:** `app/components/training/ExerciseDetailSheet.tsx`
- Currently shows NO description. Add a compact description section with markdown rendering.
- Position: after muscles text, before instructions

### Task 6.4: Apply to ExerciseDetailSheet
- Same markdown rendering for the description section

**Risk:** LOW — using existing library.

---

## PHASE 7: Validation & Testing [30 min]

1. Run existing exercise validation tests (31 tests)
2. Spot-check 20 exercises across all 3 format variants
3. Verify images load on web and mobile
4. Verify SVG colors are correct (primary=red, secondary=green)
5. Verify set deletion + undo works
6. Verify markdown renders correctly in both screens
7. Run full frontend test suite (1,998 tests)

---

## EXECUTION ORDER

| Phase | What | Files | Time |
|-------|------|-------|------|
| 1 | SVG colors | ExerciseMuscleDiagram.tsx | 15 min |
| 2 | Images (centralize + add + fix) | 5 files | 45 min |
| 3 | Set delete button + undo | SetRowPremium.tsx | 45 min |
| 4 | Info button + chevron | ExerciseCard.tsx | 15 min |
| 5 | Regenerate descriptions | exercises_data.json (script) | 2-3 hrs |
| 6 | Markdown rendering | 4 files | 30 min |
| 7 | Validation | Tests | 30 min |

## RISK MATRIX

| Phase | Risk | Reason |
|-------|------|--------|
| 1 | LOW | Single number change |
| 2 | LOW | Fixing broken behavior + additive |
| 3 | MEDIUM | Undo requires state management |
| 4 | LOW | Style changes |
| 5 | MEDIUM | 1,200 entries, needs validation |
| 6 | LOW | Using existing library |
| 7 | LOW | Testing only |

## COST ESTIMATE
- LLM generation: ~$1.60 (Haiku bulk) + ~$1 (Sonnet QA) = ~$3
- Engineering time: ~5-6 hours
- Total files modified: ~10
