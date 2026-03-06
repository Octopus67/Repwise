# WNS Algorithm Audit — Beardsley Model Compliance

## Implementation vs Research Findings

### ✅ CORRECT: Stimulating Reps Model
**Implementation:** Last ~5 reps before failure count (MAX_STIM_REPS=5.0)
**Beardsley:** "Last ~5 reps before failure" (range: >5 but <8, likely closer to 5)
**Verdict:** ✅ Matches research

**RIR Lookup Table:**
| RIR | Stim Reps (Implementation) | Beardsley Model |
|-----|---------------------------|-----------------|
| 0 | 5 | ✅ Correct (failure) |
| 1 | 4 | ✅ Correct |
| 2 | 3 | ✅ Correct |
| 3 | 2 | ✅ Correct (DEFAULT_RIR) |
| ≥4 | 0 | ✅ Correct (junk volume) |

---

### ⚠️ CONSERVATIVE: Default RIR
**Implementation:** DEFAULT_RIR = 3.0 (RPE 7, 2 stimulating reps)
**Beardsley:** Doesn't specify a default, but most examples use sets to failure or 1-2 RIR
**Verdict:** ⚠️ Conservative — users who don't log RPE/RIR get only 2 stim reps per set instead of 5

**Impact:** A user doing 3 sets without logging RPE gets 6 HU instead of 15 HU. This is intentional to encourage RPE logging, but it significantly underestimates volume for users who train hard but don't track effort.

**Recommendation:** Consider DEFAULT_RIR = 1.0 (4 stim reps) as a middle ground, or prompt users to log RPE/RIR.

---

### ❌ INCORRECT: Diminishing Returns Curve
**Implementation:** K = 1.69, fitted so "6 sets ≈ 2x stimulus of 1 set"
**Beardsley:** "The first set causes the same amount of muscle growth as the next five sets" = 6 sets ≈ 2x stimulus

**Let's verify the math:**
```
Set 1: factor = 1/(1 + 1.69×0) = 1.000
Set 2: factor = 1/(1 + 1.69×1) = 0.372
Set 3: factor = 1/(1 + 1.69×2) = 0.228
Set 4: factor = 1/(1 + 1.69×3) = 0.165
Set 5: factor = 1/(1 + 1.69×4) = 0.129
Set 6: factor = 1/(1 + 1.69×5) = 0.106
Total: 1.000 + 0.372 + 0.228 + 0.165 + 0.129 + 0.106 = 2.000
```

✅ **Correct!** 6 sets = 2.0x stimulus of 1 set.

**However:** Beardsley's Patreon (Nov 2023) references the Pelland (2024) meta-analysis which found 6 sets = **4x** stimulus of 1 set, not 2x. This is a MUCH steeper curve.

**If we use Pelland's 6 sets = 4x:**
```
Solve: Σ(1/(1+K×i)) for i=0..5 = 4.0
K ≈ 0.4 (the original value in wns-execution-plan.md!)
```

**Discrepancy:** The implementation uses Schoenfeld (2017) data (6 sets = 2x), but Beardsley's more recent Patreon posts reference Pelland (2024) which shows 6 sets = 4x. The implementation may be using OUTDATED research.

**Recommendation:** Re-evaluate K based on Pelland (2024). If 6 sets = 4x is more accurate, K should be ~0.4, not 1.69.

---

### ✅ CORRECT: Stimulus Duration
**Implementation:** DEFAULT_STIMULUS_DURATION_DAYS = 2.0 (48 hours)
**Beardsley:** "MPS elevation lasts 24-48 hours in trained individuals, likely 36-48h"
**Verdict:** ✅ Matches research (uses upper bound of 48h)

---

### ✅ CORRECT: Maintenance Volume
**Implementation:** DEFAULT_MAINTENANCE_SETS = 3.0 sets once per week
**Beardsley:** "3-4 sets once per week maintains muscle"
**Verdict:** ✅ Matches research

---

### ⚠️ QUESTIONABLE: MRV Landmarks

**Implementation MRV values (Hypertrophy Units):**
- Chest: 28 HU
- Lats/Back: 30 HU
- Quads: 26 HU
- Shoulders: 22 HU
- Biceps/Triceps: 20 HU

**Beardsley's Model:** He does NOT define fixed weekly MRV values independent of frequency. His model says "maximum effective volume per week depends on frequency."

**Problem:** The implementation treats MRV as a fixed weekly number (e.g., chest MRV = 28 HU). But Beardsley's model says this is frequency-dependent:
- At 1x/week: chest MRV ≈ 5 sets (25 stim reps) = ~25 HU
- At 2x/week: chest MRV ≈ 10 sets (50 stim reps) = ~35 HU (after diminishing returns)
- At 3x/week: chest MRV ≈ 15 sets (75 stim reps) = ~40 HU

**The implementation's fixed MRV values don't account for frequency.**

**Recommendation:** Either:
1. Make MRV frequency-dependent (MRV = f(frequency))
2. Document that the MRV values assume 2-3x/week frequency
3. Use Beardsley's per-session cap (10 sets/session) instead of weekly MRV

---

### ❌ MISSING: Per-Session Volume Cap

**Beardsley:** "Above 10 sets per muscle group per workout: likely negative effects"

**Implementation:** No per-session cap. A user could do 20 sets of chest in one session and the algorithm would calculate it as valid (with diminishing returns).

**Recommendation:** Add a per-session volume cap of 10 sets per muscle group. Warn users if they exceed it.

---

### ❌ MISSING: Advanced Lifter Adjustment

**Beardsley:** Advanced lifters need LESS volume (as low as 1-2 sets per exercise)

**Implementation:** No adjustment for training age/experience level. A beginner and an advanced lifter get the same HU calculation.

**Recommendation:** Add an optional "training experience" multiplier or document that the landmarks are calibrated for intermediate lifters.

---

## Test Scenarios

### Scenario 1: Beginner, 3x/week Full Body
- **Setup:** 3 sets bench press (chest), 3 sets rows (back), 3 sets squats (quads), 3x/week
- **Per session:** 3 sets × 5 stim reps = 15 stim reps
- **Diminishing returns:** 1.0 + 0.372 + 0.228 = 1.6 factor
- **Session stimulus:** 15 × 1.6 = 24 HU per muscle
- **Weekly gross:** 24 × 3 = 72 HU
- **Atrophy:** 2 sessions with 2-day gaps = 0 atrophy (within stimulus duration)
- **Weekly net:** 72 HU
- **Status:** Above MRV (chest MRV = 28 HU)
- **Issue:** ❌ Algorithm says "above MRV" but Beardsley says 3x/week with 3 sets/session is OPTIMAL for beginners

**Root cause:** MRV landmarks don't account for frequency.

---

### Scenario 2: Advanced Lifter, 2x/week Low Volume
- **Setup:** 1 set bench press to failure, 2x/week
- **Per session:** 1 set × 5 stim reps × 1.0 factor = 5 HU
- **Weekly gross:** 5 × 2 = 10 HU
- **Atrophy:** 1 gap of 3 days = (3-2) × (3/7) = 0.43 HU
- **Weekly net:** 10 - 0.43 = 9.57 HU
- **Status:** Optimal (between MEV=8 and MAV_low=14)
- **Beardsley:** This is his recommended approach for advanced lifters
- **Verdict:** ✅ Algorithm correctly classifies this as optimal

---

### Scenario 3: Bro Split, 1x/week High Volume
- **Setup:** 10 sets chest, once per week
- **Per session:** 10 sets × 5 stim reps = 50 stim reps
- **Diminishing returns:** 1.0 + 0.372 + 0.228 + 0.165 + 0.129 + 0.106 + 0.090 + 0.078 + 0.069 + 0.062 = 2.299
- **Session stimulus:** 50 × 2.299 = 114.95 HU
- **Weekly gross:** 114.95 HU
- **Atrophy:** 5 days beyond stimulus (7 - 2) = 5 × (3/7) = 2.14 HU
- **Weekly net:** 114.95 - 2.14 = 112.81 HU
- **Status:** WAY above MRV (chest MRV = 28 HU)
- **Beardsley:** "Above 10 sets per session: likely negative effects"
- **Verdict:** ⚠️ Algorithm allows this but should warn about per-session excess

---

### Scenario 4: Maintenance Phase
- **Setup:** 3 sets chest, once per week
- **Per session:** 3 sets × 5 stim reps × (1.0 + 0.372 + 0.228) = 15 × 1.6 = 24 HU
- **Weekly gross:** 24 HU
- **Atrophy:** 5 days × (3/7) = 2.14 HU
- **Weekly net:** 24 - 2.14 = 21.86 HU
- **Status:** Approaching MRV (between MAV_high=20 and MRV=28)
- **Beardsley:** "3 sets once/week maintains muscle"
- **Issue:** ❌ Algorithm says "approaching MRV" but this should be classified as "maintenance"

**Root cause:** No "maintenance" status zone. The landmarks assume growth, not maintenance.

---

## Critical Issues Found

### 1. ❌ Diminishing Returns K May Be Outdated
- Implementation uses K=1.69 (Schoenfeld 2017: 6 sets = 2x)
- Beardsley's recent posts reference Pelland 2024: 6 sets = 4x
- **Action:** Verify which meta-analysis is more accurate, update K if needed

### 2. ❌ MRV Landmarks Are Frequency-Agnostic
- Fixed weekly MRV values don't account for session frequency
- Beardsley explicitly says weekly volume limits depend on frequency
- **Action:** Make MRV frequency-dependent or document assumptions

### 3. ❌ No Per-Session Volume Cap
- Beardsley: "Above 10 sets per session: negative effects"
- Implementation: No cap or warning
- **Action:** Add per-session limit of 10 sets per muscle group

### 4. ❌ No Maintenance Status Zone
- Current zones: below_mev, optimal, approaching_mrv, above_mrv
- Missing: "maintenance" zone for 1x/week moderate volume
- **Action:** Add maintenance zone or adjust landmarks

### 5. ⚠️ DEFAULT_RIR Too Conservative
- DEFAULT_RIR=3.0 gives only 2 stim reps per set
- Most users train closer to failure than RIR 3
- **Action:** Consider DEFAULT_RIR=1.5 or 2.0

### 6. ❌ No Training Age Adjustment
- Beardsley: Advanced lifters need less volume
- Implementation: Same calculation for all users
- **Action:** Add optional experience level multiplier

---

## Recommendations

1. **Verify K value** — check if Pelland 2024 supersedes Schoenfeld 2017
2. **Add per-session cap** — warn if >10 sets per muscle per session
3. **Make MRV frequency-aware** — adjust landmarks based on sessions/week
4. **Add maintenance zone** — classify 1x/week moderate volume as "maintenance"
5. **Increase DEFAULT_RIR** — from 3.0 to 2.0 (3 stim reps instead of 2)
6. **Document assumptions** — clarify that landmarks assume 2-3x/week frequency

The algorithm is fundamentally sound but has calibration issues that could mislead users.
