# Repwise E2E & Integration Test Plan

## Architecture

```
tests/
├── conftest.py                    # Existing unit test fixtures
├── e2e/                           # NEW: Backend API flow tests
│   ├── conftest.py                # Shared fixtures: auth helpers, factories
│   ├── factories.py               # User/workout/nutrition data factories
│   ├── scenarios.py               # Parameterized test data (all permutations)
│   ├── test_auth_flows.py         # Registration, login, OAuth, password reset
│   ├── test_onboarding_flows.py   # Full onboarding with all permutations
│   ├── test_training_flows.py     # Workout logging with all set types/RPE/RIR combos
│   ├── test_nutrition_flows.py    # Food logging, batch, copy, daily totals
│   ├── test_interleaved_flows.py  # Workout + nutrition + navigation mixed
│   ├── test_adaptive_flows.py     # Multi-day logging → adaptive recalculation
│   ├── test_social_flows.py       # Follow, share, react, leaderboard
│   ├── test_measurement_flows.py  # Body measurements, progress photos
│   └── test_premium_flows.py      # Subscription, trial, feature gating
app/
├── e2e/                           # EXISTING: Playwright frontend E2E
│   ├── helpers.ts                 # Fix + extend
│   ├── fixtures/                  # NEW: Test data + API helpers
│   │   ├── api-client.ts          # Direct API calls for test setup
│   │   └── test-users.ts          # Pre-built user scenarios
│   ├── flows/                     # NEW: Full user journey specs
│   │   ├── onboarding.spec.ts     # 9-step wizard, all permutations
│   │   ├── training-full.spec.ts  # Complete workout lifecycle
│   │   ├── nutrition-full.spec.ts # Full day of food logging
│   │   ├── weekly-cycle.spec.ts   # 7-day simulate: train + eat + check stats
│   │   └── settings-profile.spec.ts
│   ├── smoke.spec.ts              # Keep: quick sanity
│   ├── auth.spec.ts               # Keep: update selectors
│   ├── navigation.spec.ts         # Keep: works
│   └── ... (fix broken specs)
```

---

## Layer 1: Backend API Flow Tests

### Test Data Permutations

#### Onboarding Scenarios (24 parameterized cases)
| # | Goal | Activity | Sex | Diet | Body Fat | Rate |
|---|------|----------|-----|------|----------|------|
| 1 | cutting | sedentary | male | balanced | 25% | -0.5 |
| 2 | cutting | active | female | high_protein | null | -1.0 |
| 3 | cutting | very_active | male | low_carb | 15% | -2.0 |
| 4 | bulking | sedentary | female | balanced | 30% | +0.25 |
| 5 | bulking | moderate | male | high_protein | 18% | +0.5 |
| 6 | bulking | very_active | other | balanced | null | +1.0 |
| 7 | maintaining | light | male | keto | 12% | 0 |
| 8 | maintaining | active | female | balanced | null | 0 |
| 9 | recomposition | moderate | male | high_protein | 20% | 0 |
| 10 | recomposition | active | female | low_carb | 28% | 0 |
| 11 | cutting | light | other | keto | 35% | -0.75 |
| 12 | bulking | moderate | male | keto | 10% | +2.0 |
| 13-24 | Boundary: age 13/120, height 100/250, weight 30/300, bf 3%/60% |

#### Training Set Permutations (16 combos per exercise)
| Set Type | RPE | RIR | Weight | Reps |
|----------|-----|-----|--------|------|
| normal | 8.0 | null | 100 | 8 |
| normal | null | 2 | 80 | 12 |
| normal | 9.5 | 1 | 120 | 5 |
| normal | null | null | 60 | 15 |
| warm-up | 5.0 | null | 40 | 10 |
| warm-up | null | null | 20 | 15 |
| drop-set | 9.0 | 0 | 80→60→40 | 8→10→12 |
| amrap | 10.0 | 0 | 60 | 20+ |
| normal | 0 | 5 | 0 | 1000 | (boundary: min RPE, max RIR, bodyweight, max reps)
| normal | 10 | 0 | 1000 | 1 | (boundary: max RPE, min RIR, max weight, min reps)

#### Nutrition Permutations
| Scenario | Meals | Entries/Meal | Micros | Source |
|----------|-------|-------------|--------|--------|
| Simple day | 3 | 1 each | none | manual |
| Heavy day | 5 | 4 each | full | food_db |
| Batch entry | 1 | 10 items | partial | batch API |
| Copy day | copy from yesterday | all | all | copy API |
| Zero calories | 1 | 1 | none | manual |
| Max calories | 1 | 1 (50000 cal) | none | manual |
| Micro tracking | 3 | 2 each | fiber, sodium, iron, B12 | manual |

### Flow Tests

#### F1: Auth Flows (test_auth_flows.py)
```
F1.1: Register → verify email → login → get dashboard
F1.2: Register → login without verify → still works (email_verified=false)
F1.3: Register duplicate email → 409
F1.4: Login wrong password → 401
F1.5: Login non-existent email → 401 (same timing as wrong password)
F1.6: Forgot password → get code → reset → login with new password
F1.7: Forgot password → use code twice → second fails
F1.8: Forgot password → expired code → fails
F1.9: Refresh token → get new access token
F1.10: Refresh with blacklisted token → 401
F1.11: Access protected route without token → 401
F1.12: Access protected route with expired token → 401
F1.13: Register with each password rule violation (5 cases)
F1.14: Register → logout → token blacklisted → can't reuse
```

#### F2: Onboarding Flows (test_onboarding_flows.py)
```
F2.1-F2.24: Parameterized onboarding (24 scenarios above)
  Each verifies:
  - 201 response
  - Adaptive snapshot created with correct TDEE
  - Goals match requested goal_type
  - Macros are physiologically reasonable (protein 1.2-3.0 g/kg, fat >= 20g, carbs >= 50g)
  - Calories match activity level direction (active > sedentary)
  
F2.25: Double-submit onboarding → 409 (idempotent)
F2.26: Onboarding with missing required fields → 400 with specific error
F2.27: Onboarding with invalid goal_type → 400
```

#### F3: Training Flows (test_training_flows.py)
```
F3.1: Log single exercise, 3 normal sets → session created, PR detected
F3.2: Log 5 exercises, mixed set types (normal + warmup + dropset + amrap)
F3.3: Log with RPE only on all sets
F3.4: Log with RIR only on all sets
F3.5: Log with both RPE and RIR
F3.6: Log with neither RPE nor RIR
F3.7: Log → update session (add exercise) → verify
F3.8: Log → delete session → verify gone
F3.9: Log same exercise on consecutive days → PR comparison works
F3.10: Log 50 exercises (max) → succeeds
F3.11: Log 51 exercises → 400
F3.12: Log 20 sets per exercise (max) → succeeds
F3.13: Log 21 sets → 400
F3.14: Log with metadata (notes, superset groups)
F3.15: Log → check personal records endpoint → new PR appears
F3.16: Log lighter weight → no new PR
F3.17: Log with start_time > end_time → 400
F3.18: Log with future date → 400
F3.19: Get previous performance for exercise → returns last session's data
F3.20: Log → check muscle group volume → correct
F3.21: Create workout template → start from template → log → verify
F3.22: Log 3 sessions same week → weekly volume accumulates correctly
```

#### F4: Nutrition Flows (test_nutrition_flows.py)
```
F4.1: Log breakfast (2 items) → check daily totals
F4.2: Log breakfast + lunch + dinner → full day totals correct
F4.3: Batch entry (10 items) → all created
F4.4: Copy yesterday's entries to today → duplicated correctly
F4.5: Update entry calories → daily total recalculated
F4.6: Delete entry → daily total recalculated
F4.7: Log with micronutrients → micro dashboard shows them
F4.8: Log 0 calorie entry → succeeds (water, supplements)
F4.9: Log 50000 calorie entry (max) → succeeds
F4.10: Log with food_item_id from food search → linked correctly
F4.11: Search food → log from result → nutrition values match
F4.12: Create custom meal → log from custom meal → values match
F4.13: Favorite a meal → appears in favorites list
F4.14: Log across multiple days → per-day totals independent
```

#### F5: Interleaved Flows (test_interleaved_flows.py)
```
F5.1: Register → onboard → log workout → log food → check dashboard summary
F5.2: Start workout → mid-workout log food → finish workout → both saved
F5.3: Log food → log workout → log food → check daily totals include all
F5.4: Log 7 days of training + nutrition → check weekly report
F5.5: Log workout → check achievements → new achievement unlocked
F5.6: Log food → check dietary analysis → gaps identified
F5.7: Multiple users: user A follows user B → B logs workout → A sees in feed
```

#### F6: Adaptive Engine Flows (test_adaptive_flows.py)
```
F6.1: Onboard → log 7 days food + weight → trigger weekly checkin → targets adjust
F6.2: Cutting user consistently under calories → targets decrease
F6.3: Bulking user consistently over calories → targets increase
F6.4: User changes goal (cut → bulk) → recalculate → targets flip
F6.5: User with body_fat_pct → different macro split than without
F6.6: Override daily targets → override persists until next recalc
```

#### F7: Measurement & Progress Flows (test_measurement_flows.py)
```
F7.1: Log body measurements (chest, waist, arms) → trend shows
F7.2: Log measurements weekly for 4 weeks → trend direction correct
F7.3: Upload progress photo → appears in gallery
F7.4: Log bodyweight daily for 7 days → EMA smoothing correct
```

#### F8: Social Flows (test_social_flows.py)
```
F8.1: User A follows User B → B appears in A's following list
F8.2: User B logs workout → appears in User A's feed
F8.3: User A reacts to B's workout → reaction count updates
F8.4: User A shares workout template → B can import it
F8.5: Leaderboard shows top users by volume/streak
```

#### F9: Premium Flows (test_premium_flows.py)
```
F9.1: New user → has trial → premium features accessible
F9.2: Trial expired → premium features gated
F9.3: Webhook: subscription created → user upgraded
F9.4: Webhook: subscription cancelled → user downgraded
F9.5: Webhook: duplicate event → idempotent
```

---

## Layer 2: Playwright Frontend E2E

### Fix Existing Specs
| Spec | Action |
|------|--------|
| bodyweight-modal.spec.ts | Delete or rewrite — entry point removed |
| training-modal.spec.ts | Replace with ActiveWorkout flow tests |
| dashboard.spec.ts | Remove bodyweight button test, fix articles testID |
| analytics-tabs.spec.ts | Add volume tab test |
| profile-features.spec.ts | Add missing community testIDs |
| learn.spec.ts | Fix filter pills testID |
| debug-auth.spec.ts | Delete (debug only) |
| app.spec.ts | Delete (redundant with smoke) |

### New Flow Specs

#### E1: Onboarding Flow (onboarding.spec.ts)
```
E1.1: Register → complete all 9 steps (bulk, male, active) → lands on dashboard
E1.2: Register → complete all 9 steps (cut, female, sedentary) → lands on dashboard
E1.3: Register → skip body composition step → still completes
E1.4: Register → go back and change goal mid-wizard → final result matches last choice
E1.5: Register → step counter shows correct "Step X of 9" at each step
E1.6: Register → password strength meter shows all 5 rules
E1.7: Register → weak password → error message shows specific missing requirement
```

#### E2: Training Full Flow (training-full.spec.ts)
```
E2.1: Start workout → add 3 exercises → log sets with weight/reps → finish → summary shows
E2.2: Start workout → add exercise → log warmup + working + amrap sets → finish
E2.3: Start workout → add exercise → enter RPE → finish → RPE saved
E2.4: Start workout → add exercise → enter RIR → finish → RIR saved
E2.5: Start workout → discard → confirm → no session saved
E2.6: Start workout → add exercise → remove set → add set → finish → correct set count
E2.7: Start from template → exercises pre-filled → log → finish
E2.8: Start workout → navigate to nutrition tab → come back → workout still active
E2.9: Start workout → log 5 exercises with 4 sets each → finish → all saved
E2.10: Finish workout → PR toast appears for new personal record
```

#### E3: Nutrition Full Flow (nutrition-full.spec.ts)
```
E3.1: Open nutrition modal → fill all fields → save → appears in log
E3.2: Log breakfast → log lunch → log dinner → daily totals correct on dashboard
E3.3: Search food → select result → macros auto-filled → save
E3.4: Open meal builder → add items → save as custom meal
E3.5: Log from saved custom meal → values match
E3.6: Edit logged entry → updated values reflected
E3.7: Delete logged entry → removed from daily totals
```

#### E4: Analytics & Progress (analytics-full.spec.ts)
```
E4.1: Navigate to analytics → all 4 tabs visible (nutrition, training, body, volume)
E4.2: Switch time range → charts update
E4.3: Training tab → shows volume by muscle group
E4.4: Body tab → shows weight trend
E4.5: Nutrition tab → shows calorie/macro trends
```

#### E5: Profile & Settings (settings-profile.spec.ts)
```
E5.1: Navigate to profile → all sections visible
E5.2: Edit body stats → save → persisted on reload
E5.3: Change notification preferences → save → persisted
E5.4: View achievements → list renders
E5.5: Navigate to each sub-screen (coaching, community, founder) → no crash
```

#### E6: Weekly Simulation (weekly-cycle.spec.ts)
```
E6.1: Simulate 3 training days + 7 nutrition days → dashboard summary correct
  - Day 1: Upper body workout + 3 meals
  - Day 2: Rest day + 3 meals
  - Day 3: Lower body workout + 3 meals
  - Check: weekly volume, calorie average, streak count
```

---

## Layer 3: Pre-Push Hook

```bash
#!/bin/bash
# .git/hooks/pre-push
set -e

echo "🧪 Running pre-push checks..."

# 1. Backend unit tests (fast subset)
echo "→ Backend tests..."
cd /path/to/HOS
.venv/bin/pytest tests/ -x -q --tb=short -k "not slow" 2>&1 | tail -3

# 2. Frontend type check + unit tests
echo "→ Frontend checks..."
cd app
npx tsc --noEmit 2>&1 | tail -3
npx jest --passWithNoTests --no-coverage --silent 2>&1 | tail -3

# 3. Backend E2E flow tests
echo "→ Backend flow tests..."
cd ..
.venv/bin/pytest tests/e2e/ -x -q --tb=short 2>&1 | tail -3

echo "✅ All checks passed — pushing"
```

Install: `cp scripts/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push`

---

## Implementation Priority

| Phase | What | Effort | Catches |
|-------|------|--------|---------|
| 1a | Backend flow tests: auth + onboarding (F1, F2) | 2 hrs | Registration/onboarding bugs |
| 1b | Backend flow tests: training + nutrition (F3, F4) | 2 hrs | Data integrity bugs |
| 1c | Backend flow tests: interleaved + adaptive (F5, F6) | 2 hrs | Cross-feature bugs |
| 2a | Fix broken Playwright specs | 1 hr | Restore existing coverage |
| 2b | New Playwright: onboarding + training flows | 2 hrs | UI flow bugs |
| 2c | New Playwright: nutrition + analytics flows | 2 hrs | UI data display bugs |
| 3 | Pre-push hook | 30 min | Prevents broken pushes |

Total: ~12 hours for comprehensive coverage.
