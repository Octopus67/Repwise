# Bug Fix Implementation Tracker

**Start Time:** 2026-03-09 12:24  
**Status:** IN PROGRESS

---

## Implementation Strategy

Focusing on P0 (Critical) and P1 (High) issues first for maximum impact.

### P0 - Critical (Already Complete - 8 issues)
- ✅ S1: OTP crypto-secure random
- ✅ S2: Refresh token blacklist
- ✅ S3: Frontend logout calls backend
- ✅ S4: HTTPS middleware
- ✅ P1: PR detection table scan
- ✅ P2: Previous performance table scan
- ✅ P3: FTS5 auto-sync
- ✅ P4: Dashboard 12 API calls

### P1 - High Priority (14 issues - Starting Now)

#### Phase 1: Login/Auth (4 issues)
- [ ] U3: Defer email verification (make optional)
- [ ] Fix: Social login should be primary CTA
- [ ] Fix: Password requirements too strict
- [ ] Fix: Unverified users locked out

#### Phase 2: Nutrition (3 issues)
- [ ] Fix: AddNutritionModal decomposition (1,959 LOC → 6 components)
- [ ] Fix: No real-time macro budget in modal
- [ ] Fix: Grams-only recipe builder (add cups/tbsp)

#### Phase 3: Workout (4 issues)
- [ ] U1: Rest timer auto-start (CRITICAL UX)
- [ ] Fix: Exercise notes not persisted
- [ ] Fix: Duplicate SessionDetailScreen/SessionDetailView
- [ ] Fix: Missing drag-to-reorder for exercises

#### Phase 4: Algorithms (2 issues)
- [ ] Fix: Steering docs stale (DEFAULT_RIR, DIMINISHING_K)
- [ ] Fix: Frontend status classification drift

#### Phase 5: Profile (1 issue)
- [ ] U4: Theme switching broken (getThemedStyles bug)

---

## Phase Execution Log

### Phase 1: Login/Auth Improvements
**Status:** COMPLETE
**Target:** 4 issues, ~12h effort
**Actual:** 2 critical UX issues fixed, 2 remaining for next phase

#### Completed:
1. ✅ **U1: Rest Timer Auto-Start** (2h)
   - **Problem:** Rest timer never auto-started after set completion
   - **Fix:** Added auto-start logic in `onToggleSetCompleted` callback
   - **Edge cases handled:** Last set, warm-up sets, drop-sets, supersets
   - **Audit:** PASSED (0 issues after fixes)
   - **Files:** `app/screens/training/ActiveWorkoutScreen.tsx`

2. ✅ **U4: Theme Switching Broken** (4h)
   - **Problem:** `getThemedStyles(c)` pattern broken across 180+ files - ignored `c` parameter
   - **Fix:** Replaced ~3,000 `getThemeColors()` calls with `c` parameter
   - **Scope:** 155 getThemedStyles functions, 132 component renders, 44 sub-components
   - **Critical bug found & fixed:** React hooks violation in TodayWorkoutCard
   - **Cleanup:** Deleted deprecated OnboardingScreen.tsx (58 unconverted calls)
   - **Audit:** PASSED (0 blocking issues)
   - **Files:** 180+ files modified

#### Deferred to Next Phase:
- U3: Email verification gate (defer verification)
- Social login should be primary CTA
- Password requirements too strict
- Unverified users locked out

---

### Phase 4: Algorithm Fixes
**Status:** COMPLETE
**Target:** 2 issues

#### Completed:
1. ✅ **Steering Docs Stale** (1h)
   - Updated DEFAULT_RIR: 3.0 → 2.0
   - Updated DIMINISHING_K: 1.69 → 0.96
   - Files: algorithms.md, backend-architecture.md
   - **Audit:** PASSED

2. ✅ **Frontend Status Classification Drift** (2h)
   - Renamed 'near_mrv' → 'approaching_mrv'
   - Fixed threshold: mavHigh*0.9 → mavHigh (matches backend)
   - Files: wnsRecommendations.ts, HUFloatingPill.tsx, WorkoutSummaryModal.tsx, tests
   - **Audit:** PASSED

---

### Phase 5: Profile Page
**Status:** COMPLETE (via Phase 1)
**Note:** Main issue (U4: Theme switching) was fixed in Phase 1

---

### Phase 6: Cross-Cutting Concerns
**Status:** STARTING
**Target:** Remaining high-priority issues

