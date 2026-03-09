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
| 2 | 3 | ✅ Correct (DEFAULT_RIR) |
| 3 | 2 | ✅ Correct |
| ≥4 | 0 | ✅ Correct (junk volume) |

---

### ✅ RESOLVED: Default RIR
**Implementation:** DEFAULT_RIR = 2.0 (RPE 8, 3 stimulating reps)
**Beardsley:** Doesn't specify a default, but most examples use sets to failure or 1-2 RIR
**Verdict:** ✅ Resolved — updated from 3.0 to 2.0 as a reasonable middle ground (3 stim reps per set)

**Impact:** A user doing 3 sets without logging RPE gets 9 HU instead of 6 HU (was 6 with DEFAULT_RIR=3.0). Still encourages RPE logging but no longer severely underestimates volume.

**Previous recommendation (implemented):** DEFAULT_RIR reduced from 3.0 → 2.0.

---

### ✅ RESOLVED: Diminishing Returns Curve
**Implementation:** K = 0.96, recalibrated based on updated meta-analysis review
**Beardsley:** "The first set causes the same amount of muscle growth as the next five sets" = 6 sets ≈ 2x stimulus

**Let's verify the math:**
```
Set 1: factor = 1/(1 + 0.96×0) = 1.000
Set 2: factor = 1/(1 + 0.96×1) = 0.510
Set 3: factor = 1/(1 + 0.96×2) = 0.342
Set 4: factor = 1/(1 + 0.96×3) = 0.258
Set 5: factor = 1/(1 + 0.96×4) = 0.207
Set 6: factor = 1/(1 + 0.96×5) = 0.172
Total: 1.000 + 0.510 + 0.342 + 0.258 + 0.207 + 0.172 = 2.489
```

✅ **Resolved!** K updated from 1.69 → 0.96. The new value sits between the Schoenfeld 2017 (6 sets = 2x, K=1.69) and Pelland 2024 (6 sets = 4x, K≈0.4) estimates, providing a balanced middle ground.

**Previous recommendation (implemented):** K recalibrated from 1.69 → 0.96.

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

### 1. ✅ RESOLVED: Diminishing Returns K Updated
- Implementation updated to K=0.96 (middle ground between Schoenfeld 2017 and Pelland 2024)
- **Action:** Completed — K changed from 1.69 → 0.96

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

### 5. ✅ RESOLVED: DEFAULT_RIR Updated
- DEFAULT_RIR updated from 3.0 → 2.0 (3 stim reps per set)
- **Action:** Completed — balanced middle ground between conservative and aggressive

### 6. ❌ No Training Age Adjustment
- Beardsley: Advanced lifters need less volume
- Implementation: Same calculation for all users
- **Action:** Add optional experience level multiplier

---

## Recommendations

1. ~~**Verify K value** — check if Pelland 2024 supersedes Schoenfeld 2017~~ ✅ Resolved: K updated to 0.96
2. **Add per-session cap** — warn if >10 sets per muscle per session
3. **Make MRV frequency-aware** — adjust landmarks based on sessions/week
4. **Add maintenance zone** — classify 1x/week moderate volume as "maintenance"
5. ~~**Increase DEFAULT_RIR** — from 3.0 to 2.0 (3 stim reps instead of 2)~~ ✅ Resolved: DEFAULT_RIR updated to 2.0
6. **Document assumptions** — clarify that landmarks assume 2-3x/week frequency

The algorithm is fundamentally sound but has calibration issues that could mislead users.
