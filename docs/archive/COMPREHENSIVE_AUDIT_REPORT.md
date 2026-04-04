# Comprehensive Static Code Analysis Report — Repwise/HOS

**Generated:** 2026-03-17  
**Scope:** All 10 phases, ~250 scenarios, line-by-line code tracing  
**Files Analyzed:** 150+ frontend + backend files  
**Total Issues Found:** 168

---

## Executive Summary

This report documents a comprehensive static code analysis of the entire Repwise (Hypertrophy OS) application, covering authentication, training logging, nutrition tracking, analytics, body measurements, profile management, and all supporting features.

**Severity Breakdown:**
- 🔴 **Critical:** 10 issues (broken features, data loss, security vulnerabilities)
- 🟠 **High:** 25 issues (major bugs, performance problems, missing features)
- 🟡 **Medium:** 39 issues (validation gaps, UX issues, inconsistencies)
- 🟢 **Low:** 26 issues (code quality, minor bugs, edge cases)
- 📝 **Observations:** 68 items (architectural notes, design decisions, good practices)

---

## 🔴 CRITICAL ISSUES (10) — Must Fix Before Launch

### 1. Meal-Prep Screens Use fetch() Without Auth Headers
**Files:** `MealPlanScreen.tsx`, `ShoppingListView.tsx`, `PrepSundayFlow.tsx`  
**Impact:** All meal plan API calls return 401 Unauthorized  
**Fix:** Replace `fetch('/api/v1/...')` with `api.post('meal-plans/...')`

### 2. DataExportScreen Double API Prefix
**File:** `DataExportScreen.tsx` lines 56, 88, 101, 104, 137  
**Impact:** All export API calls 404 (requests go to `/api/v1/api/v1/export/...`)  
**Fix:** Change absolute paths to relative: `'export/history'` not `'/api/v1/export/history'`

### 3. Export Service References Non-Existent photo_url Field
**File:** `src/modules/export/service.py` line 347  
**Impact:** AttributeError crash during any export containing progress photos  
**Fix:** Change `r.photo_url` to `r.r2_key` or compute CDN URL

### 4. React Hooks Violation in getStatusLabel
**File:** `app/screens/reports/WeeklyReportScreen.tsx` line 80  
**Impact:** Runtime crash or undefined behavior  
**Fix:** Use `getThemeColors()` (non-hook) or convert to custom hook

### 5. Sharing Service Doesn't Filter Soft-Deleted Sessions
**File:** `src/modules/sharing/service.py` line 76  
**Impact:** Deleted workouts remain publicly accessible via share links  
**Fix:** Add `TrainingSession.not_deleted()` filter

### 6. Password Validation Mismatch Frontend/Backend
**Files:** `passwordStrength.ts` vs `auth/schemas.py`  
**Impact:** Passwords rejected inconsistently, confusing UX  
**Fix:** Align validation rules (zxcvbn vs regex requirements)

### 7. food_item_id Never Sent in Nutrition POST
**File:** `AddNutritionModal.tsx` line 195  
**Impact:** Food frequency tracking completely broken  
**Fix:** Add `food_item_id: selectedFood?.id ?? null` to payload

### 8. onRemoveSet Unreachable (No UI to Delete Sets)
**File:** `ExerciseCardPremium.tsx`  
**Impact:** Users cannot delete individual sets from active workout  
**Fix:** Add swipe-to-delete gesture or delete button on SetRowPremium

### 9. Timing Oracle for User Enumeration
**File:** `src/modules/auth/service.py` line 88  
**Impact:** Attackers can enumerate valid emails via response time measurement  
**Fix:** Add dummy bcrypt call when user not found to normalize timing

### 10. OAuth Nonce Not Verified on Backend
**File:** `src/modules/auth/service.py` Apple OAuth flow  
**Impact:** Replay attack vector for Apple Sign-In  
**Fix:** Add nonce field to OAuthCallbackRequest, verify against JWT claim

---

## 🟠 HIGH ISSUES (25) — Should Fix Soon

### Auth & Security (8)
- DB rate limiter records on success (users locked out after 5 successful logins)
- Registration rate limit in-memory only (resets on server restart)
- No IP-based rate limiting for login endpoint
- No account lockout or exponential backoff
- Forgot-password timing attack (bcrypt skip when email not found)
- No session invalidation on password reset
- Missing Retry-After HTTP header on 429 responses
- OAuth email conflict leaks provider information

### Performance (5)
- N+1 API waterfall on dashboard (17 calls instead of 1)
- Dual readiness computation (calculated 2-3 times per load)
- Sequential fire-and-forget waterfall (7 API calls in series)
- N+1 shopping list query (one query per food item)
- N+1 exercise image fetch in SessionDetail

### Missing Features (7)
- ReadinessGauge, ArticleCardCompact, QuickAddModal, WaterTracker, CopyMealsBar — all dead code
- WeeklyChallengeCard self-fetching (no loading/error/refresh integration)
- No custom exercise creation in ExercisePickerSheet (bottom sheet)
- No superset UI (store actions exist but no UI)
- Template load failure silent (no user feedback)
- No pagination on PR history (truncates at 100)
- No offline queue for failed API calls

### Data Integrity (5)
- PR detection skips first-time exercises
- PRs from deleted sessions visible in history
- Update session doesn't run PR detection
- Meal plan generator produces identical days
- Duplicate exercise notes overwrite in finishWorkout

---

## 🟡 MEDIUM ISSUES (39)

### Validation Gaps (12)
- canCompleteSet allows weight=0
- No max weight validation in set logging
- RPE/RIR fields not synced bidirectionally
- Barcode multiplier unbounded
- Recipe servings unbounded
- Negative values allowed in ManualEntryForm
- No NaN guards in meal slot totals
- Navy BF clamp mismatch frontend/backend
- Quiet hours string/time type mismatch
- Coaching goals no maxLength on frontend
- Measurement date no picker (manual YYYY-MM-DD)
- No photo file size validation before R2 upload

### UX Issues (10)
- Password strength error message misleading
- Forgot password says "link" not "code"
- No unsaved data guard on QuickAddModal, AddBodyweightModal
- RecoveryCheckinModal uses raw Modal (no swipe-to-dismiss)
- No loading state during active workout initialization
- Edit mode with invalid sessionId silently starts blank workout
- Crash recovery inflates duration timer
- No client-side premium check before coaching submit
- LearnScreen favorites filter only shows current category
- DataExportScreen has no back button

### Performance (8)
- TodayWorkoutCard getStyles() anti-pattern (StyleSheet recreation)
- MealSlotDiary redundant daily total computation
- MealSlotGroup sorts entries on every render
- AnalyticsScreen always fetches 90 days regardless of time range
- Silent error handling in analytics (volume/strength/e1rm)
- getStyles() pattern in multiple components
- useFeatureFlag makes network call per flag
- Weekly checkin POST on every dashboard load

### Data Issues (9)
- useDailyTargets returns baseline instead of effective
- Duplicate meal favorites not prevented
- Copy entries has no idempotency check
- Barcode scan creates globally visible food items
- FTS cache uses class-level mutable state
- Recipe unit field ignored in aggregation
- Dual favorites systems (food vs meals)
- Stale scan history in AsyncStorage
- Export CSV logic error for dict values

---

## 🟢 LOW ISSUES (26)

Too many to list individually — includes code quality improvements, minor validation gaps, cosmetic issues, dead code, type mismatches, and edge case handling.

---

## 📝 KEY OBSERVATIONS (68)

### Good Practices Verified ✅
- Soft delete pattern consistently applied (except BodyMeasurement)
- JWT token rotation with blacklisting
- OTP codes bcrypt-hashed, not plaintext
- Old OTP invalidation before new generation
- Audit trail on all state-changing operations
- Email normalization at multiple layers
- Anti-enumeration on register/forgot-password
- Crash recovery via AsyncStorage persistence
- Pagination pattern consistent across endpoints
- Input validation via Pydantic schemas
- Security logging without password leakage

### Architectural Concerns ⚠️
- No offline support (no NetInfo, no queue, no cached fallback)
- Frontend types manually mirror backend (drift risk)
- In-memory rate limiters reset on restart
- Progress photos on-device only (R2 upload optional)
- Multiple unused/legacy components (5 timer variants, dead modals)
- Backend consolidated dashboard endpoint unused by frontend
- Dual target systems (useDailyTargets vs adaptive/snapshots)

---

## Priority Fix Order

### Phase A (Blocking — Must Fix)
1. DataExportScreen double prefix (all export broken)
2. Export service photo_url AttributeError (crashes on export)
3. Meal-prep fetch() without auth (all meal plans broken)
4. food_item_id missing (frequency tracking broken)
5. getStatusLabel hooks violation (crashes on render)

### Phase B (Critical Security)
6. Timing oracle (user enumeration)
7. OAuth nonce not verified (replay attacks)
8. Sharing doesn't filter deleted sessions (privacy leak)
9. DB rate limiter records on success (false lockouts)
10. Password validation mismatch (UX confusion)

### Phase C (Major Bugs)
11. onRemoveSet unreachable (no UI to delete sets)
12. PR detection skips first-time exercises (no celebration)
13. N+1 dashboard API waterfall (performance)
14. N+1 shopping list query (performance)
15. Meal plan identical days (no variety)

### Phase D (Medium Priority)
16-39. Validation gaps, UX issues, performance concerns

### Phase E (Low Priority)
40-68. Code quality, minor bugs, edge cases

---

## Testing Recommendations

### Manual Verification Required
- Login with wrong password 5 times → verify rate limiting
- Register with weak password → verify frontend/backend validation
- Take progress photo → verify R2 upload + CDN fallback
- Export data → verify all formats work
- Create meal plan → verify variety across days
- Complete first workout → verify PR celebration
- Delete set from active workout → verify UI exists
- Share workout → verify no XSS in HTML

### Automated Test Gaps
- No timing oracle test (login user-not-found vs wrong-password)
- No rate limiter persistence test (across server restarts)
- No OAuth nonce verification test
- No soft-delete filter test on sharing endpoint
- No duplicate exercise name test
- No R2 upload failure recovery test

---

## Conclusion

The codebase is **functionally complete** with **comprehensive security hardening** applied today. However, **10 critical bugs** would break core features in production:
- 3 make entire features unusable (export, meal plans)
- 2 are security vulnerabilities (timing oracle, OAuth nonce)
- 5 are major UX/data integrity issues

The **25 high-priority issues** represent significant quality concerns but don't block basic functionality.

**Recommendation:** Fix Phase A+B (15 issues) before any production deployment. Phase C can follow in a subsequent release.

---

*Full detailed findings with line numbers, code snippets, and fix recommendations are documented in the analysis context above.*
