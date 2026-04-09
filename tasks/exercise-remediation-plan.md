# Exercise Data & Volume Calculation Remediation Plan

## Overview

**Scope:** 23 bugs/issues across 4 severity tiers, organized into 6 phases.
**Estimated effort:** ~5-6 focused sessions.
**Risk profile:** Phase 0 is the foundation (LLM audit of all 1,200 exercises). Phase 1 is a data migration (highest risk). Phases 2-5 are isolated fixes.

---

## Phase 0: LLM Audit of Every Exercise (CORRECTNESS FIRST)

**Why first:** Every subsequent phase depends on correct exercise-to-muscle mappings. Pattern matching gets ~85% right. We need 100%. This phase audits all 1,200 exercises via LLM to produce a verified, corrected `exercises_data.json` before any code changes.

**Approach:** Process exercises in batches of 50 through an LLM with exercise science knowledge. For each exercise, the LLM validates/corrects:
1. `muscle_group` (primary) — is it the correct primary mover?
2. `secondary_muscles` — are all synergists listed? Are any wrong?
3. `category` — is it correctly classified as compound/isolation?
4. Is this a stretch/mobility exercise that should NOT count as hypertrophy volume?

### Task 0.1: Generate audit batches

**Steps:**
1. Load `exercises_data.json` (1,200 exercises)
2. Split into 24 batches of 50 exercises each
3. For each batch, send to LLM with this prompt:

```
You are a certified strength & conditioning specialist (CSCS) and exercise science expert.
For each exercise below, verify or correct:

1. PRIMARY MUSCLE GROUP — must be exactly one of: chest, shoulders, biceps, triceps, forearms, abs, quads, hamstrings, glutes, calves, traps, lats, erectors, adductors
   - "back" is NOT valid. Remap to "lats" (pulling movements) or "erectors" (spinal extension movements)
   - "full_body" is NOT valid. Pick the dominant primary mover.

2. SECONDARY MUSCLES — list ALL synergist muscles that receive meaningful stimulus (>30% of primary). Use the same muscle group names.
   Rules:
   - Rows/pulldowns: always include biceps, forearms. Add traps for unsupported rows.
   - Presses: always include triceps. Add shoulders for chest presses, add chest for shoulder presses.
   - Squats/lunges: include glutes. Add adductors for wide-stance variations.
   - Deadlifts: include glutes, hamstrings. Add lats (bar stabilization), forearms (grip).
   - Curls: include forearms.
   - Do NOT list muscles that only stabilize (e.g., abs during squats — unless it's a heavy compound).

3. CATEGORY — "compound" (multi-joint) or "isolation" (single-joint)

4. IS_MOBILITY — true if this is a stretch, mobility drill, foam rolling, or SMR exercise that should NOT count toward hypertrophy volume. false otherwise.

Output as JSON array. Only include exercises where you made a change or added data.
```

4. Collect all LLM responses, merge corrections into the master data
5. Run a second pass on any exercises the LLM flagged as ambiguous

### Task 0.2: Validate the audit results

**Steps:**
1. Diff the original vs corrected `exercises_data.json`
2. Generate a summary report:
   - How many exercises changed primary muscle group?
   - How many gained secondary muscles?
   - How many were flagged as mobility?
   - Distribution of exercises per muscle group (before vs after)
3. Spot-check 50 random corrections manually
4. Verify: 0 exercises have `muscle_group: "back"` or `"full_body"`
5. Verify: every muscle group has ≥10 exercises as primary
6. Verify: `lats`, `erectors`, `adductors` each appear as secondary in ≥10 exercises
7. Verify: all mobility exercises are flagged

### Task 0.3: Add `is_mobility` field to exercise schema

**Steps:**
1. Add `is_mobility: bool = False` to the exercise data structure
2. In volume calculation (both engines), skip exercises where `is_mobility == True`
3. This prevents stretches/foam rolling from counting as hypertrophy sets

**Affected files:**
- `src/modules/training/exercises_data.json` (add field to flagged exercises)
- `src/modules/training/volume_service.py` (skip mobility exercises)
- `src/modules/training/wns_volume_service.py` (skip mobility exercises)
- `src/modules/training/schemas.py` (add field to Exercise schema)

### Task 0.4: Independent verification

**Steps:**
1. Take the corrected exercise data and run it through a SECOND LLM pass with a different prompt:
   "For each exercise, does the primary muscle group match the primary mover? Rate confidence 1-5."
2. Any exercise rated <4 confidence gets manual review
3. Final sign-off: the corrected data is the source of truth for all subsequent phases

**Tests:**
- New test: assert 0 exercises have `muscle_group` not in VALID_MUSCLE_GROUPS
- New test: assert 0 exercises have `muscle_group: "back"` or `"full_body"`
- New test: assert every exercise with `category: "compound"` has ≥1 secondary muscle
- New test: assert `is_mobility` exercises have no secondary muscles or are excluded from volume

**Risk:** LOW — this phase only changes data, not algorithms. But it's the foundation for everything else.
**Estimated time:** 2-3 hours (LLM processing + manual review)

---

## Phase 1: Fix the "back" Taxonomy (ROOT CAUSE)

**Why first:** This single change resolves 4+ downstream bugs. Every subsequent phase depends on a clean muscle group taxonomy.

**Root cause:** "back" is a body region, not a muscle. The system has `back` (113 exercises), `lats` (28), and `erectors` (0) as separate groups, causing double-tracking in WNS and zero-tracking in legacy.

### Task 1.1: Remap exercises in `exercises_data.json`

**Approach:** Reclassify all 113 "back" exercises to `lats` or `erectors` based on movement pattern.

**Mapping rules:**
- Vertical pulls (pulldowns, pull-ups, chin-ups, lat pulldowns) → `lats`
- Horizontal rows (barbell row, cable row, dumbbell row, T-bar row, seated row) → `lats`
- Pullovers (dumbbell pullover, cable pullover) → `lats`
- Deadlift variations (conventional, sumo, trap bar) → `erectors`
- Good mornings, rack pulls, hyperextensions, back extensions → `erectors`
- Reverse hypers, Superman → `erectors`

**Steps:**
1. Write a Python script to load `exercises_data.json`, classify each "back" exercise by name pattern matching, output the new JSON
2. Manual review of the reclassification (some exercises are ambiguous — e.g., "Pendlay Row" is lats-primary but erectors-secondary)
3. Also add `erectors` as secondary muscle for all row exercises, and `lats` as secondary for deadlift variations
4. Verify: 0 exercises remain with `muscle_group: "back"`

**Affected files:**
- `src/modules/training/exercises_data.json` (113 exercises modified)

**Secondary muscle additions (Task 1.1b):**
- All row exercises: add `erectors` to secondary_muscles
- All squat/lunge exercises: add `adductors` to secondary_muscles
- All deadlift exercises: add `lats` to secondary_muscles (if primary is erectors)
- All bench press variations: verify `shoulders`, `triceps` in secondary_muscles

**Tests:** Run existing exercise data tests. Add a new test asserting 0 exercises have `muscle_group: "back"`.
**Risk:** HIGH — changes exercise data for all users. Must verify no exercise lookup breaks.

---

### Task 1.1b: Fix "back" in secondary_muscles arrays

**Root cause (from oracle audit):** 165 exercises have `"back"` in their `secondary_muscles` array. After removing "back" as a valid group, these become orphaned — WNS computes coefficients for a group with no landmarks, silently dropping stimulus.

**Steps:**
1. In `exercises_data.json`, find all exercises where `secondary_muscles` contains `"back"`
2. Replace `"back"` with `"lats"` (for pulling/rowing exercises) or `"erectors"` (for hip hinge/extension exercises)
3. This should already be handled by Phase 0's LLM audit, but verify explicitly

**Note:** Phase 0 (Task 0.1) should catch and fix these. This task is a verification step to ensure none were missed.

**Tests:** Assert 0 exercises have `"back"` anywhere in `secondary_muscles`.
**Risk:** LOW — data only, covered by Phase 0 audit.

---

### Task 1.2: Remove "back" from backend constants

**Steps:**
1. `src/modules/training/custom_exercise_service.py` L20-27: Remove `"back"` from `VALID_MUSCLE_GROUPS`. Add migration note for existing custom exercises.
2. `src/modules/training/volume_service.py` L20-36: Remove `"back"` entry from `DEFAULT_LANDMARKS`. Verify `lats` and `erectors` entries exist with correct values.
3. `src/modules/training/wns_volume_service.py` L30-46: Remove `"back"` entry from `DEFAULT_WNS_LANDMARKS`. Verify `lats` and `erectors` entries exist.
4. `src/modules/training/exercise_mapping.py` L8-131: Remap any `"back"` entries in `EXERCISE_MUSCLE_MAP` to `"lats"` or `"erectors"`.

**Affected files:**
- `src/modules/training/custom_exercise_service.py` (L20-27)
- `src/modules/training/volume_service.py` (L20-36)
- `src/modules/training/wns_volume_service.py` (L30-46)
- `src/modules/training/exercise_mapping.py` (L8-131)

**Tests:** Update all tests referencing `"back"` as a muscle group. Run full backend test suite.
**Risk:** MEDIUM — existing custom exercises with `muscle_group: "back"` will fail validation. Need migration (Task 1.4).

---

### Task 1.3: Update frontend

**Steps:**
1. `app/components/analytics/anatomicalPathsV2.ts` L79-80: Remove `back` from `COMPOSITE_MUSCLE_MAP` (or leave as empty fallback).
2. `app/__tests__/components/anatomicalPathsV2.test.ts` L11: Remove `'back'` from `API_MUSCLE_GROUPS`.
3. Update test fixtures in: `ExercisePickerEnhancements.test.ts`, `volumeAggregator.test.ts`, `dayClassificationLogic.test.ts` — change `'back'` to `'lats'`.

**Affected files:**
- `app/components/analytics/anatomicalPathsV2.ts`
- 4 test files

**Tests:** Run full frontend test suite.
**Risk:** LOW — frontend uses string matching, no enum constraints.

---

### Task 1.4: Data migration for existing users

**Steps:**
1. Write an Alembic migration that:
   - Updates `exercises` table: `UPDATE exercises SET muscle_group = 'lats' WHERE muscle_group = 'back' AND name ILIKE ANY(ARRAY['%row%', '%pull%', '%lat%', '%pullover%'])`
   - Updates remaining: `UPDATE exercises SET muscle_group = 'erectors' WHERE muscle_group = 'back'`
   - Updates `user_volume_landmarks` table: rename any `muscle_group = 'back'` entries to `'lats'`
   - Updates `secondary_muscles` JSONB arrays: replace `'back'` with `'lats'` where present
2. Write a reverse migration (back → lats/erectors is lossy, so reverse = set all to 'lats')

**Affected files:**
- New migration file in `src/migrations/`

**Tests:** Test migration on a copy of the DB. Verify no orphaned references.
**Risk:** HIGH — production data migration. Must be tested thoroughly. Run in transaction with rollback capability.

---

## Phase 2: Fix Critical Calculation Bugs

### Task 2.1: Fix WNS trend calculation

**Root cause:** `_compute_trend()` in `wns_volume_service.py` L112-143 counts raw hard sets (`+= 1`) instead of HU, and uses `get_muscle_group()` (single-muscle, 130-exercise map) instead of the full exercise catalog with coefficients.

**Fix approach:** Rewrite `_compute_trend()` to:
1. Use `get_muscle_coefficients()` from `exercise_coefficients.py` instead of `get_muscle_group()`
2. Compute HU per set using the same `stimulating_reps_per_set()` + `diminishing_returns()` pipeline as the main calculation
3. Accumulate HU (not set count) per muscle per week

**Affected files:**
- `src/modules/training/wns_volume_service.py` (L112-143)

**Steps:**
1. Import `get_muscle_coefficients` and `stimulating_reps_per_set`, `diminishing_returns` from respective modules
2. In the session loop, for each set: compute stim_reps, apply diminishing returns, multiply by coefficient per muscle
3. Accumulate the HU value instead of `+= 1`
4. Return trend data in HU units

**Tests:** Add test comparing trend output to main volume output for the same data — they should use the same units.
**Risk:** MEDIUM — changes trend data for all WNS users. Old trend data in cache will show different scale.

---

### Task 2.2: Fix goal multiplier kcal math

**Root cause:** `wns_volume_service.py` L73 uses `rate_kg * -1000` but 1kg body mass ≈ 7700 kcal, not 1000. Currently masked by clamping (0.70-1.20 range).

**Fix approach:**
1. Change `deficit_kcal = rate_kg * -1000` → `deficit_kcal = rate_kg * -7700` (L73)
2. Change `surplus_kcal = rate_kg * 1000` → `surplus_kcal = rate_kg * 7700` (L77)
3. Adjust coefficients to maintain same output range:
   - Cutting: `0.0003` → `0.0000389` (so that 0.5 kg/week → multiplier ≈ 0.85)
   - Bulking: `0.00025` → `0.0000325` (so that 0.5 kg/week → multiplier ≈ 1.125)
4. Verify: same inputs produce same (or very similar) outputs as before

**Affected files:**
- `src/modules/training/wns_volume_service.py` (L73, L77, L74, L78)

**Tests:** Add parametrized test: `(rate=0.5, goal=cutting) → multiplier ≈ 0.85`, `(rate=1.0, goal=cutting) → multiplier = 0.70`, `(rate=0.3, goal=bulking) → multiplier ≈ 1.07`.
**Risk:** LOW — output range is clamped, so behavior change is minimal. But verify edge cases.

---

### Task 2.3: Legacy engine catalog fallback

**Root cause:** `exercise_mapping.py` `get_muscle_group()` returns "Other" for ~89% of exercises. "Other" has no landmarks → volume silently dropped.

**Fix approach:** Make `get_muscle_group()` fall back to the exercise catalog (`exercises_data.json`) when `EXERCISE_MUSCLE_MAP` returns "Other".

**Steps:**
1. In `exercise_mapping.py`, import `get_all_exercises` from `exercises.py`
2. Build a lazy-loaded lookup dict from the catalog (name.lower() → muscle_group)
3. In `get_muscle_group()`: if EXERCISE_MUSCLE_MAP returns "Other", check catalog lookup
4. Cache the catalog lookup (module-level dict, loaded once)

**Affected files:**
- `src/modules/training/exercise_mapping.py` (L173-175)

**Tests:** Test that `get_muscle_group("Bent Over Barbell Row")` returns `"lats"` (not "Other"). Test that unknown exercises still return "Other".
**Risk:** LOW — additive change, only affects exercises that currently return "Other".

---

## Phase 3: Fix Data Gaps

### Task 3.1: Populate secondary muscles for top 100 compounds

**Root cause:** 361 exercises (30%) have no secondary muscles. Worst: calves (86%), forearms (74%), abs (65%). `lats`, `erectors`, `adductors` never appear as secondary muscles anywhere.

**Approach:** Script-assisted bulk update of `exercises_data.json`.

**Steps:**
1. Write a classification script that assigns secondary muscles based on exercise name patterns:
   - `*row*`, `*pull*` → add `biceps`, `forearms` if missing
   - `*press*`, `*bench*` → add `triceps`, `shoulders` if missing
   - `*squat*`, `*lunge*`, `*leg press*` → add `adductors`, `glutes` if missing
   - `*deadlift*`, `*rdl*` → add `glutes`, `hamstrings` if missing
   - `*curl*` → add `forearms` if missing
2. Manual review of the top 100 most common exercises (by name frequency in training data, or by alphabetical review of compounds)
3. Verify: `lats`, `erectors`, `adductors` each appear as secondary in ≥10 exercises

**Affected files:**
- `src/modules/training/exercises_data.json`

**Tests:** Add test asserting minimum secondary muscle coverage per group.
**Risk:** LOW — additive data change. Only affects WNS engine (legacy ignores secondary muscles).

---

### Task 3.2: Handle `full_body` exercises

**Root cause:** 26 exercises mapped to `full_body` but no landmarks exist for it in either engine. Volume is silently dropped.

**Approach:** Remap `full_body` exercises to their primary mover, with broad secondary muscles.

**Steps:**
1. Reclassify the 26 `full_body` exercises:
   - Clean & Press → `shoulders` (secondary: quads, traps, triceps)
   - Thruster → `quads` (secondary: shoulders, triceps)
   - Burpee → `chest` (secondary: quads, shoulders, triceps)
   - Turkish Get-Up → `shoulders` (secondary: abs, glutes)
   - etc.
2. Remove `"full_body"` from `VALID_MUSCLE_GROUPS` (or keep for custom exercises but add a note that it won't track volume)
3. Alternative: Keep `full_body` valid but add landmarks for it (MEV=0, MAV=0, MRV=0 — effectively "untracked")

**Affected files:**
- `src/modules/training/exercises_data.json` (26 exercises)
- `src/modules/training/custom_exercise_service.py` (optionally remove from VALID_MUSCLE_GROUPS)

**Tests:** Verify 0 exercises remain with `muscle_group: "full_body"` (or that full_body has landmarks if kept).
**Risk:** LOW — only 26 exercises affected.

---

### Task 3.3: Add erector and adductor exercises

**Root cause:** 0 exercises exist with `muscle_group: "erectors"` or `"adductors"` as primary.

**Note:** Task 1.1 partially fixes this by remapping deadlift variations to `erectors`. This task adds any remaining gaps.

**Steps:**
1. After Task 1.1, verify erectors count. If still low, add:
   - Back Extension, Hyperextension, Reverse Hyper, Good Morning, Superman → `erectors`
2. For adductors, add:
   - Adductor Machine, Copenhagen Plank, Cable Hip Adduction, Sumo Squat (primary: quads, secondary: adductors) → verify secondary coverage
3. If no dedicated adductor exercises exist in the catalog, create entries

**Affected files:**
- `src/modules/training/exercises_data.json`

**Tests:** Assert `erectors` has ≥15 exercises, `adductors` appears as secondary in ≥10 exercises.
**Risk:** LOW — additive.

---

## Phase 4: Fix Medium-Priority Issues

### Task 4.1: Legacy engine secondary muscle credit

**Root cause:** `volume_service.py` `get_weekly_muscle_volume()` only calls `get_muscle_group()` (single primary). Bench press only counts toward chest.

**Fix approach:** Add secondary muscle credit to the legacy engine using the exercise catalog.

**Steps:**
1. In `volume_service.py`, import `get_muscle_coefficients` from `exercise_coefficients.py`
2. In the session loop (L109), replace `get_muscle_group()` call with `get_muscle_coefficients()` call
3. For each set, distribute `effort * coefficient` to each muscle group (1.0 for primary, 0.5 for secondary)
4. Accumulate per-muscle effective_sets as before

**Affected files:**
- `src/modules/training/volume_service.py` (L93-137)

**Tests:** Test that bench press contributes to chest (1.0), shoulders (0.5), triceps (0.5). Verify existing tests still pass with updated expected values.
**Risk:** MEDIUM — changes volume numbers for ALL legacy users. Their "effective sets" will increase for synergist muscles. May trigger unexpected volume_status changes. Consider: should this be behind a feature flag?

---

### Task 4.2: Decouple push notifications from volume calculation

**Root cause:** `wns_volume_service.py` L232-258 sends push notifications inside `get_weekly_muscle_volume()`. This couples a read operation with a write side effect.

**Fix approach:** Extract notification logic to a separate function called by the router, not the service.

**Steps:**
1. Extract L232-258 into a standalone function: `async def check_and_send_volume_warnings(user_id, muscle_volumes, session)`
2. Move the call to `volume_router.py` — call it after `get_weekly_muscle_volume()` returns
3. Make it fire-and-forget (don't await, or use background task)

**Affected files:**
- `src/modules/training/wns_volume_service.py` (L232-258 → extract)
- `src/modules/training/volume_router.py` (add call after volume computation)

**Tests:** Verify notifications still fire. Verify volume endpoint doesn't fail if notification fails.
**Risk:** LOW — behavioral change is minimal. Notifications still fire, just from a different call site.

---

### Task 4.3: Fix `intensity_pct` always None

**Root cause:** The WNS engine has a heavy-load path (`intensity_pct >= 0.85`) in `stimulating_reps_per_set()` but `intensity_pct` is never populated from training data.

**Fix approach:** Calculate `intensity_pct` from the set's weight and the user's estimated 1RM for that exercise.

**Steps:**
1. In `wns_volume_service.py`, when processing each set, if `weight` and `e1rm` are available: `intensity_pct = weight / e1rm`
2. Pass `intensity_pct` to `stimulating_reps_per_set()`
3. If e1RM is not available, continue using `None` (existing RIR-based path)

**Affected files:**
- `src/modules/training/wns_volume_service.py` (L168-176)

**Tests:** Test that a set at 90% 1RM with 3 reps gets full stimulating reps credit.
**Risk:** LOW — additive. Only activates when e1RM data is available.

---

### Task 4.4: WNS landmark user customization

**Root cause:** `DEFAULT_WNS_LANDMARKS` is hardcoded. Legacy has `LandmarkStore` for user overrides, but WNS doesn't.

**Fix approach:** Extend `LandmarkStore` to support WNS landmarks.

**Steps:**
1. Add `engine` column to `UserVolumeLandmark` model (default: 'legacy')
2. In `LandmarkStore.get_landmarks()`, accept `engine` parameter
3. In `wns_volume_service.py`, use `LandmarkStore.get_landmarks(engine='wns')` with `DEFAULT_WNS_LANDMARKS` as base
4. Add PUT endpoint for WNS landmarks in `volume_router.py`

**Affected files:**
- `src/modules/training/volume_models.py`
- `src/modules/training/landmark_store.py`
- `src/modules/training/wns_volume_service.py`
- `src/modules/training/volume_router.py`
- New Alembic migration

**Tests:** Test CRUD for WNS landmarks. Test that custom WNS landmarks override defaults.
**Risk:** MEDIUM — DB schema change. Requires migration.

---

## Phase 5: Fix Low-Priority Issues & Edge Cases

### Task 5.1: Exercise catalog caching

**Root cause:** `_build_exercise_lookup()` loads all 1,200 exercises into memory on every volume calculation call.

**Fix approach:** Cache at module level with lazy initialization.

**Steps:**
1. Add `_exercise_cache: dict | None = None` module-level variable
2. In `_build_exercise_lookup()`, return cache if populated, else build and cache
3. Add cache invalidation when exercises are created/updated/deleted

**Affected files:**
- `src/modules/training/wns_volume_service.py` (or `exercises.py`)

**Tests:** Verify cache hit on second call. Verify invalidation on exercise CRUD.
**Risk:** LOW.

---

### Task 5.2: Week boundary timezone handling

**Root cause:** Week boundaries (Mon-Sun) don't account for user timezone. A user training at 11:30 PM Sunday in UTC-8 might have their session counted in the wrong week.

**Fix approach:** Use user's timezone preference (from profile) when computing week boundaries.

**Steps:**
1. In `volume_router.py`, fetch user's timezone from profile
2. Pass timezone to `get_weekly_muscle_volume()`
3. In the service, convert session timestamps to user's timezone before week bucketing

**Affected files:**
- `src/modules/training/volume_router.py`
- `src/modules/training/volume_service.py`
- `src/modules/training/wns_volume_service.py`

**Tests:** Test that a session at 2026-04-06T23:30:00-08:00 (Sunday PST) counts as Sunday's week, not Monday's.
**Risk:** LOW — only affects edge-case sessions near midnight.

---

### Task 5.3: Concurrent session handling

**Root cause:** If a user has two sessions on the same day (AM/PM split), the WNS atrophy calculation sees 0-day gap. The diminishing returns reset between sessions. This is correct behavior but should be documented.

**Fix approach:** No code change needed. Add documentation/comment in `wns_engine.py` explaining that same-day sessions are treated as separate sessions with independent diminishing returns curves (which is the scientifically correct behavior — MPS is re-elevated by each session).

**Affected files:**
- `src/modules/training/wns_engine.py` (add comment)

**Tests:** Add test verifying 5+5 sets across 2 sessions produces more HU than 10 sets in 1 session.
**Risk:** NONE.

---

### Task 5.4: Detail endpoint optimization

**Root cause:** `GET /analytics/muscle-volume/{muscle_group}/detail` recomputes ALL muscles then filters to one.

**Fix approach:** Add early-exit optimization — pass target muscle group to the service so it can skip unrelated exercises.

**Steps:**
1. Add `target_muscle: str | None = None` parameter to `get_weekly_muscle_volume()`
2. When set, skip exercises that don't contribute to the target muscle (check coefficients)
3. Return only the target muscle's data

**Affected files:**
- `src/modules/training/wns_volume_service.py`
- `src/modules/training/volume_service.py`
- `src/modules/training/volume_router.py`

**Tests:** Verify detail endpoint returns same data as full endpoint filtered to one muscle.
**Risk:** LOW — optimization only, no behavioral change.

---

### Task 5.5: Document K=0.96 derivation

**Root cause:** The diminishing returns constant K=0.96 is described as "average of Schoenfeld (1.69) and Pelland (0.24)" which is methodologically questionable.

**Fix approach:** Update the comment to describe it as "empirically tuned to produce reasonable behavior" with references to both studies for context. No code change.

**Affected files:**
- `src/modules/training/wns_engine.py` (L10 comment)

**Tests:** None.
**Risk:** NONE.

---

## Dependency Graph

```
Phase 0 (LLM Audit) — MUST COMPLETE FIRST
  ├── Task 0.1: LLM audit all 1,200 exercises in batches of 50
  ├── Task 0.2: Validate audit results (diff, spot-check, coverage)
  ├── Task 0.3: Add is_mobility field to exercise schema
  └── Task 0.4: Independent verification (second LLM pass)

Phase 1 (Taxonomy) — depends on Phase 0
  ├── Task 1.1: Remap exercises_data.json (already done by Phase 0)
  ├── Task 1.1b: Verify "back" removed from all secondary_muscles
  ├── Task 1.2: Update backend constants (depends on 1.1)
  ├── Task 1.3: Update frontend (depends on 1.2)
  └── Task 1.4: Data migration (depends on 1.1 + 1.2)

Phase 2 (Critical Bugs) — can start after Phase 1
  ├── Task 5.1*: Exercise catalog caching (MOVED HERE — must precede 2.3)
  ├── Task 2.1: Fix WNS trend (independent)
  └── Task 2.3: Legacy catalog fallback (depends on 5.1* for caching)

Phase 3 (Data Gaps) — already handled by Phase 0
  ├── Task 3.1: Populate secondary muscles (done in Phase 0)
  ├── Task 3.2: Handle full_body exercises (done in Phase 0)
  └── Task 3.3: Add erector/adductor exercises (done in Phase 0)

Phase 4 (Medium) — can start after Phase 2
  ├── Task 4.1: Legacy secondary credit (depends on 2.3, FEATURE FLAGGED)
  ├── Task 4.2: Decouple notifications (independent)
  ├── Task 4.3: Fix intensity_pct (independent)
  └── Task 4.4: WNS landmark customization (independent)

Phase 5 (Low) — can start anytime
  ├── Task 5.2: Timezone handling (independent)
  └── (5.1 moved to Phase 2)
```

## Risk Summary

| Risk Level | Tasks | Mitigation |
|------------|-------|------------|
| HIGH | 1.1, 1.4 | Test migration on DB copy. Feature flag for rollback. |
| MEDIUM | 1.2, 2.1, 4.1, 4.4 | Run full test suite. Compare before/after volume outputs. |
| LOW | All others | Standard testing. |

## Verification Strategy

After each phase:
1. Run full backend test suite (`pytest`)
2. Run full frontend test suite (`jest`)
3. Manual verification: log into the app, check Analytics → Training tab, verify heatmap shows correct data
4. Compare volume outputs before/after for a sample user's training week

---

## Safeguards (from Oracle Audit)

### Before/After Snapshot (MANDATORY before Phase 1)
1. Select 50+ real user IDs with diverse training patterns
2. Run current volume calculation, store results as JSON
3. After Phase 1, run new calculation, diff against stored results
4. Define acceptable delta: no user's total volume changes by more than 25%
5. Automate as a CI check

### Feature Flags (MANDATORY for algorithm changes)
- Task 1.2 (back taxonomy): behind `v2_muscle_taxonomy` flag
- Task 2.3 (legacy fallback): behind `legacy_catalog_fallback` flag
- Task 4.1 (legacy secondary credit): behind `legacy_secondary_muscles` flag
- Gradual rollout: 1% → 10% → 50% → 100%

### Migration Rollback (MANDATORY for Task 1.4)
- Create `back_migration_backup` table storing original muscle_group for every modified exercise
- Tested reverse migration using backup table
- 72-hour monitoring period before dropping backup

### User Notification
- In-app banner: "We've improved muscle group tracking. Your volume numbers may look different."
- Help article explaining what changed and why

### Caching Before Fallback
- Task 5.1 (exercise catalog caching) MUST be completed BEFORE Task 2.3 (legacy fallback)
- Without caching, every per-set volume calculation loads 1,200 exercises from JSON

### Custom Exercise Migration
- Task 1.4 must also update custom exercises with `muscle_group: "back"` → `"lats"`
- Users who created custom "back" exercises must not have their exercises break on edit

## Tasks REMOVED (per Oracle recommendation)

| Task | Reason |
|------|--------|
| ~~2.2 (Fix kcal math)~~ | Outputs identical (max 0.05% delta). Risk > benefit. Fix comment only. |
| ~~5.3 (Document concurrent sessions)~~ | One-line comment. Do as drive-by commit. |
| ~~5.4 (Detail endpoint optimization)~~ | Premature optimization. No evidence of slowness. |
| ~~5.5 (Document K constant)~~ | One-line comment. Do as drive-by commit. |
