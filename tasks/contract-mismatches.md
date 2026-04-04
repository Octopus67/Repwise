# Backend ↔ Frontend Contract Mismatch Audit

## Summary

13 contract mismatches identified between Repwise backend (FastAPI) and frontend (React Native/Expo).
3 backend-side fixes applied. 10 remaining are frontend-side issues.

---

## Backend Fixes (Applied ✅)

### Issue #8 — GET /adaptive/weekly-checkin missing ✅ FIXED
- **Side:** Backend
- **Problem:** Frontend calls `GET adaptive/weekly-checkin` but backend only had `POST`
- **Fix:** Added `GET /adaptive/weekly-checkin` endpoint + `CoachingService.get_latest_checkin()` method
- **Files:** `src/modules/adaptive/router.py`, `src/modules/adaptive/coaching_service.py`

### Issue #9 — Social feed response not wrapped ✅ FIXED
- **Side:** Backend
- **Problem:** Frontend expects `{ events: [...], next_cursor: string | null }`, backend returned flat array
- **Fix:** Wrapped response in `FeedPageResponse` schema; `next_cursor` built from last event when page is full
- **Files:** `src/modules/social/router.py`, `src/modules/social/schemas.py`

### Issue #10 — Leaderboard response flat, missing user enrichment ✅ FIXED
- **Side:** Backend
- **Problem:** Frontend expects `{ entries: [{ rank, user: { id, display_name, avatar_url }, score, unit }] }`, backend returned flat `user_id`
- **Fix:** Added `get_leaderboard_enriched()` to SocialService; joins UserProfile for display_name/avatar_url; wraps in `LeaderboardPageResponse`
- **Files:** `src/modules/social/router.py`, `src/modules/social/service.py`, `src/modules/social/schemas.py`

---

## Frontend Fixes (Not Applied — Need React Native Changes)

### Issue #1 — Nutrition log date format
- **Side:** Frontend
- **Problem:** Frontend sends date as ISO string, backend expects `YYYY-MM-DD`

### Issue #2 — Training session exercises shape
- **Side:** Frontend
- **Problem:** Frontend sends nested exercise objects with different key names than backend expects

### Issue #3 — Bodyweight log field naming
- **Side:** Frontend
- **Problem:** Frontend uses `weight` field, backend expects `weight_kg`

### Issue #4 — User profile update partial fields
- **Side:** Frontend
- **Problem:** Frontend sends full profile object on update, backend expects only changed fields (PATCH semantics)

### Issue #5 — Achievement unlock response handling
- **Side:** Frontend
- **Problem:** Frontend doesn't handle the `unlocked_achievements` array in workout completion response

### Issue #6 — Measurement units conversion
- **Side:** Frontend
- **Problem:** Frontend sends imperial units without conversion, backend expects metric

### Issue #7 — Snapshot request missing training_load_score
- **Side:** Frontend
- **Problem:** Frontend omits `training_load_score` field which is required by backend

### Issue #11 — Template sharing response handling
- **Side:** Frontend
- **Problem:** Frontend expects `share_url` field, backend returns `share_code`

### Issue #12 — Reaction toggle optimistic update
- **Side:** Frontend
- **Problem:** Frontend optimistic update doesn't match backend response shape for reaction toggling

### Issue #13 — Follow/unfollow response status codes
- **Side:** Frontend
- **Problem:** Frontend doesn't handle 204 No Content on unfollow (expects JSON body)

---

## Verification

- **Python AST parse:** All 5 changed files ✓
- **Module imports:** All changed modules import cleanly ✓
- **Schema validation:** New Pydantic schemas instantiate correctly ✓
- **Existing tests:** 45/45 passed (social + adaptive) ✓
- **Pre-existing failure:** `test_duplicate_registration_rejected` — SES token issue, unrelated
