# Comprehensive Fix Plan — Post-Audit Remediation

**Generated:** 2026-03-16
**Source:** Independent audit of all security/architectural changes made today
**Total issues:** 33 (5 Critical, 8 High, 12 Medium, 8 Low)

---

## Phase 1: Critical Security Fixes (Blocking — Must Fix Before Any Deploy)

### 1.1 Sharing IDOR: Any user can expose any other user's workout

**Severity:** CRITICAL
**Root cause:** `SharingService.track_share()` creates a `ShareEvent` for any `session_id` without verifying the session belongs to the authenticated user. Since `get_shared_workout()` uses ShareEvent existence as the access gate, this lets any user make any workout public.

**Files to modify:**
- `src/modules/sharing/service.py` — Add ownership check in `track_share()`

**Fix approach:**
- Before creating the ShareEvent, query `TrainingSession` to verify `session_id` belongs to `user_id`
- If not, raise `NotFoundError("Training session not found")`
- Import `TrainingSession` is already present in the file

**Implementation steps:**
1. In `track_share()`, after the method signature and before creating the ShareEvent, add:
   ```python
   if session_id:
       result = await self._db.execute(
           select(TrainingSession.id).where(
               TrainingSession.id == session_id,
               TrainingSession.user_id == user_id,
           )
       )
       if result.scalar_one_or_none() is None:
           from src.shared.errors import NotFoundError
           raise NotFoundError("Training session not found")
   ```

**Ripple effects:** None — this only adds a check, doesn't change the return type or API contract.
**Regression risk:** LOW — only affects the share creation path, not reading.
**Tests:** Existing share tests need a test case for sharing another user's session (should return 404). Manual verification: try sharing a session you don't own.

---

### 1.2 Logout token cleanup race condition

**Severity:** CRITICAL
**Root cause:** In `AccountSection.handleLogout()`, `store.clearAuth()` runs BEFORE `onLogout()` (which calls `secureClear()` in ProfileScreen). Clearing Zustand triggers a re-render to the auth screen, potentially unmounting the component before SecureStore is cleared. Stale tokens persist.

**Files to modify:**
- `app/components/profile/AccountSection.tsx` — Reorder cleanup
- `app/screens/profile/ProfileScreen.tsx` — Verify secureClear runs first

**Fix approach:**
- Move `store.clearAuth()` to AFTER `onLogout()` completes
- Make `onLogout` async and await it
- Or better: combine both into a single atomic function

**Implementation steps:**
1. In `AccountSection.tsx`, change the `finally` block:
   ```typescript
   } finally {
     await onLogout();      // secureClear first
     store.clearAuth();     // then clear Zustand (triggers re-render)
   }
   ```
2. Ensure `onLogout` in ProfileScreen is async and awaitable (it already is).

**Ripple effects:** The re-render to auth screen now happens AFTER tokens are cleared. Slight delay in UI transition (SecureStore delete is ~10ms).
**Regression risk:** LOW — only changes ordering, not logic.
**Tests:** Manual verification: log out, force-close app, reopen — should NOT be auto-logged-in.

---

### 1.3 `onRefreshFailed` doesn't await token deletion

**Severity:** CRITICAL
**Root cause:** In `LoginScreen.initTokenProvider()`, `secureDelete()` calls are fire-and-forget async. `clearAuth()` runs immediately, potentially unmounting before deletes complete.

**Files to modify:**
- `app/screens/auth/LoginScreen.tsx` — Await secureDelete calls

**Fix approach:**
- Make `onRefreshFailed` async and await the deletes

**Implementation steps:**
1. Change `onRefreshFailed` in `initTokenProvider()`:
   ```typescript
   onRefreshFailed: async () => {
     await secureDelete(TOKEN_KEYS.access);
     await secureDelete(TOKEN_KEYS.refresh);
     clearAuth();
   },
   ```
2. In `api.ts`, the `onRefreshFailed?.()` call doesn't await — but that's OK because the token deletion is the important part, and `clearAuth()` runs after the awaits.

**Ripple effects:** `setTokenProvider` type expects `onRefreshFailed: () => void` — need to change to `() => void | Promise<void>` in api.ts.
**Regression risk:** LOW — only adds awaits.
**Tests:** Manual verification: simulate token refresh failure, verify tokens are cleared from SecureStore.

---

### 1.4 Token refresh race condition (proactive vs reactive)

**Severity:** CRITICAL
**Root cause:** The proactive refresh in the request interceptor has no coordination with the `isRefreshing` flag used by the response interceptor. Both can fire simultaneously with the same refresh token. Since the backend rotates refresh tokens, one invalidates the other.

**Files to modify:**
- `app/services/api.ts` — Add mutex coordination

**Fix approach:**
- Use the existing `isRefreshing` flag in the proactive refresh path too
- If `isRefreshing` is true, skip proactive refresh (the response interceptor will handle it)
- If proactive refresh starts, set `isRefreshing = true` and process the pending queue on completion

**Implementation steps:**
1. In the request interceptor, wrap the proactive refresh:
   ```typescript
   if (exp && exp - Date.now() / 1000 < 30 && !isRefreshing) {
     isRefreshing = true;
     try {
       const refresh = await getRefreshToken();
       if (refresh) {
         const { data } = await axios.post(...);
         await onTokensRefreshed(data.access_token, data.refresh_token);
         token = data.access_token;
         processPendingQueue(data.access_token);
       }
     } catch { /* fall through */ }
     finally { isRefreshing = false; }
   }
   ```

**Ripple effects:** Concurrent requests during proactive refresh will queue (same as 401 path). Slight latency increase for queued requests.
**Regression risk:** MEDIUM — touches the core auth interceptor. Test thoroughly.
**Tests:** Manual verification: make multiple rapid API calls when token is near expiry. Verify no forced logouts.

---

### 1.5 `r2_key` in PhotoCreate accepts arbitrary strings

**Severity:** CRITICAL
**Root cause:** `r2_key: Optional[str] = None` has no validation. Client can inject arbitrary paths.

**Files to modify:**
- `src/modules/progress_photos/schemas.py` — Add validation to r2_key

**Fix approach:**
- Add `max_length=500` and a `pattern` that matches the expected R2 key format
- The format is `users/{uuid}/{sanitized_filename}`

**Implementation steps:**
1. Change `r2_key` in `PhotoCreate`:
   ```python
   r2_key: Optional[str] = Field(
       default=None,
       max_length=500,
       pattern=r'^users/[a-f0-9\-]+/[a-zA-Z0-9._-]+$',
   )
   ```

**Ripple effects:** None — only tightens validation on input.
**Regression risk:** LOW — only rejects malformed keys. Legitimate keys from the upload-url endpoint match this pattern.
**Tests:** Verify that the key returned by `POST /upload-url` matches the pattern. Test with a malicious r2_key value (should get 422).

---

## Phase 2: High Priority Fixes

### 2.1 Food database `get_by_id` missing ownership check for custom items

**Severity:** HIGH
**Root cause:** `get_by_id()` fetches any food item by UUID without checking if custom items belong to the requesting user.

**Files to modify:**
- `src/modules/food_database/service.py` — Add ownership check for custom items
- `src/modules/food_database/router.py` — Pass user_id to get_by_id

**Fix approach:**
- Same pattern as `get_recipe`: if `item.created_by is not None and item.created_by != user_id`, raise NotFoundError
- System/verified items (created_by=None) remain accessible to all

**Implementation steps:**
1. Add `user_id` parameter to `get_by_id()`
2. After fetching the item, add ownership check for custom items
3. Update router to pass `user.id`

**Regression risk:** LOW — only affects custom food items.
**Tests:** Verify system food items are still accessible. Verify custom items are only visible to their creator.

---

### 2.2 Coaching `cancel_request` audit log records wrong old status

**Severity:** HIGH
**Root cause:** `request.status` is mutated BEFORE the audit log captures the old value.

**Files to modify:**
- `src/modules/coaching/service.py` — Capture old status before mutation

**Fix approach:**
- Save `old_status = request.status` before the mutation line

**Implementation steps:**
1. Before `request.status = CoachingRequestStatus.CANCELLED`, add:
   ```python
   old_status = request.status
   ```
2. In the audit log, change `"old": request.status` to `"old": old_status`

**Regression risk:** NONE.
**Tests:** Verify audit log entry shows correct old status.

---

### 2.3 RegisterScreen uses hardcoded token keys

**Severity:** HIGH
**Root cause:** `RegisterScreen` imports `secureSet` but uses hardcoded `'rw_access_token'` strings instead of `TOKEN_KEYS` constants.

**Files to modify:**
- `app/screens/auth/RegisterScreen.tsx` — Import and use TOKEN_KEYS

**Fix approach:**
- Import `TOKEN_KEYS` from `@/utils/secureStorage`
- Replace all hardcoded key strings with `TOKEN_KEYS.access` and `TOKEN_KEYS.refresh`

**Implementation steps:**
1. Change import: `import { secureSet, TOKEN_KEYS } from '../../utils/secureStorage';`
2. Replace `'rw_access_token'` → `TOKEN_KEYS.access` (2 occurrences: handleRegister + handleSocialSuccess)
3. Replace `'rw_refresh_token'` → `TOKEN_KEYS.refresh` (2 occurrences)

**Regression risk:** NONE — same values, just using constants.
**Tests:** Verify registration still works end-to-end.

---

### 2.4 `.env.example` missing production variables

**Severity:** HIGH
**Root cause:** `.env.example` was created with minimal variables, missing 15+ production config vars.

**Files to modify:**
- `.env.example` — Add all missing variables

**Fix approach:**
- Read `src/config/settings.py` and add every setting that has a non-empty default or is required for production

**Implementation steps:**
1. Add all missing variables with placeholder values:
   ```
   R2_ACCESS_KEY=your-r2-access-key
   R2_SECRET_KEY=your-r2-secret-key
   R2_ENDPOINT_URL=https://your-account.r2.cloudflarestorage.com
   R2_BUCKET_NAME=repwise-uploads
   CDN_BASE_URL=https://cdn.repwise.com
   SENTRY_DSN=
   STRIPE_API_KEY=sk_test_...
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   RATE_LIMIT_RPM=100
   ALLOWED_HOSTS=["your-app.railway.app"]
   CORS_ORIGINS=["https://your-app.com"]
   EXPO_ACCESS_TOKEN=
   ```

**Regression risk:** NONE.
**Tests:** None needed.

---

### 2.5 CDN URL hardcoded in storage.py

**Severity:** HIGH
**Root cause:** `generate_read_url()` returns `f"https://cdn.repwise.com/{key}"` — not configurable.

**Files to modify:**
- `src/shared/storage.py` — Use settings for CDN base URL
- `src/config/settings.py` — Add `CDN_BASE_URL` setting
- `src/modules/progress_photos/schemas.py` — Use settings for image_url computation

**Fix approach:**
- Add `CDN_BASE_URL: str = "https://cdn.repwise.com"` to Settings
- Use it in `generate_read_url()` and `PhotoResponse.image_url`

**Implementation steps:**
1. Add to settings.py: `CDN_BASE_URL: str = "https://cdn.repwise.com"`
2. In storage.py: `return f"{settings.CDN_BASE_URL}/{key}"`
3. In schemas.py PhotoResponse: import settings and use `f"{settings.CDN_BASE_URL}/{self.r2_key}"`

**Regression risk:** LOW — same default value, just configurable now.
**Tests:** Verify CDN URLs still generate correctly.

---

### 2.6 Pre-signed URL expiry with no client retry

**Severity:** HIGH
**Root cause:** 15-min pre-signed URL can expire on slow connections. No retry mechanism.

**Files to modify:**
- `app/services/photoUpload.ts` — Add retry with fresh URL

**Fix approach:**
- On upload failure (403/expired), request a new pre-signed URL and retry once

**Implementation steps:**
1. Wrap the upload in a retry loop (max 1 retry):
   ```typescript
   for (let attempt = 0; attempt < 2; attempt++) {
     const { data } = await api.post('progress-photos/upload-url', {...});
     const result = await FileSystem.uploadAsync(data.upload_url, localUri, {...});
     if (result.status >= 200 && result.status < 300) return { r2Key: data.key };
     if (attempt === 0 && result.status === 403) continue; // retry with fresh URL
     throw new Error(`Upload failed: ${result.status}`);
   }
   ```

**Regression risk:** LOW — only adds retry logic.
**Tests:** Manual verification: simulate slow upload, verify retry works.

---

### 2.7 Missing JSONB validation on food_database `micro_nutrients`

**Severity:** HIGH
**Root cause:** `micro_nutrients: Optional[dict[str, float]]` has no size validation.

**Files to modify:**
- `src/modules/food_database/schemas.py` — Add validate_json_size to micro_nutrients

**Fix approach:**
- Add `@field_validator('micro_nutrients')` with `validate_json_size` to relevant schemas

**Implementation steps:**
1. Import `validate_json_size` from `src.shared.validators`
2. Add validator to `FoodItemCreate` and any update schemas that have `micro_nutrients`

**Regression risk:** LOW — only rejects oversized payloads.
**Tests:** Verify normal micro_nutrients payloads still pass.

---

## Phase 3: Medium Priority Fixes

### 3.1 `validate_json_size` depth check off-by-one + ordering

**Files:** `src/shared/validators.py`
**Fix:** Change `depth > MAX_JSON_DEPTH` to `depth >= MAX_JSON_DEPTH`. Move `_check_depth()` call BEFORE `json.dumps()` to fail fast on deep payloads.
**Risk:** LOW — tightens validation by 1 level.

### 3.2 Feature flag pattern rejects digits

**File:** `src/modules/feature_flags/router.py`
**Fix:** Change pattern to `r'^[a-z0-9_]{1,100}$'` to allow digits.
**Risk:** NONE.

### 3.3 `search_exercises` default="" conflicts with min_length=1

**File:** `src/modules/training/router.py`
**Fix:** Remove `min_length=1` (empty string means "no filter" which is valid).
**Risk:** NONE.

### 3.4 Missing max_length on food_database description fields

**Files:** `src/modules/food_database/schemas.py`
**Fix:** Add `max_length=2000` to `description` fields in FoodItemCreate, RecipeCreateRequest, RecipeUpdateRequest.
**Risk:** NONE.

### 3.5 Coaching `document_url` accepts dangerous URL schemes

**File:** `src/modules/coaching/schemas.py`
**Fix:** Add `pattern=r'^https?://'` to `document_url` field to only allow http/https schemes.
**Risk:** LOW — rejects non-http URLs.

### 3.6 Photo metadata created when R2 upload fails (no retry/sync)

**File:** `app/screens/profile/ProgressPhotosScreen.tsx`
**Fix:** This is a design limitation, not a bug. Document it. For a future enhancement: add a background sync queue that retries failed uploads. For now, the local-first behavior is acceptable.
**Risk:** N/A — documentation only for now.

### 3.7 `documentDirectory` null on web (progress photos broken on web)

**File:** `app/screens/profile/ProgressPhotosScreen.tsx`
**Fix:** Add early return or web-specific message: `if (Platform.OS === 'web') return <Text>Progress photos are not available on web</Text>;`
**Risk:** NONE.

### 3.8 Password strength error message misleading

**File:** `app/screens/auth/RegisterScreen.tsx`
**Fix:** Change error message from `'Password must be at least 8 characters'` to `'Password is too weak. Try adding numbers, uppercase letters, or symbols.'`
**Risk:** NONE.

### 3.9 `parseJwtSub` duplicated in LoginScreen and RegisterScreen

**Files:** `app/screens/auth/LoginScreen.tsx`, `app/screens/auth/RegisterScreen.tsx`
**Fix:** Extract to `app/utils/jwtUtils.ts` and import in both screens.
**Risk:** NONE.

### 3.10 OPTIONS preflight responses missing security headers

**File:** `src/main.py`
**Fix:** Move SecurityHeadersMiddleware to be added BEFORE CORSMiddleware (so it wraps CORS and runs on all responses including preflight). In Starlette's reverse-add order, add SecurityHeaders AFTER CORS.
**Risk:** MEDIUM — changing middleware order. Test CORS preflight still works.

### 3.11 Web tokens in localStorage (XSS risk)

**File:** `app/utils/secureStorage.ts`
**Fix:** Document as known limitation in SECURITY.md. For a future enhancement: implement httpOnly cookie auth for web. Not fixable without architectural change.
**Risk:** N/A — documentation only.

### 3.12 Sharing: food_database recipe ownership fragility

**File:** `src/modules/food_database/service.py`
**Fix:** Add a comment documenting the invariant: system recipes have `created_by=None` and are accessible to all. Add an assertion or explicit check.
**Risk:** NONE.

---

## Phase 4: Low Priority Fixes

### 4.1 `LoginRequest.password` missing min_length
**File:** `src/modules/auth/schemas.py`
**Fix:** Add `min_length=1` to LoginRequest.password Field.
**Risk:** NONE.

### 4.2 Coaching `CoachProfileCreate.specializations` type mismatch
**File:** `src/modules/coaching/schemas.py`
**Fix:** Investigate whether the DB stores list or dict. Align input and output schemas.
**Risk:** LOW — needs investigation.

### 4.3 Redundant barcode regex check
**File:** `src/modules/food_database/router.py`
**Fix:** Remove the manual `_BARCODE_RE.match()` check since Path pattern already validates.
**Risk:** NONE.

### 4.4 Client-side rate limiter resets on app restart
**File:** `app/utils/rateLimiter.ts`
**Fix:** Document as expected behavior. Backend rate limiting is the real protection.
**Risk:** N/A — documentation only.

### 4.5 No loading state on resend verification button
**File:** `app/screens/auth/EmailVerificationScreen.tsx`
**Fix:** Add `resending` state, disable button during API call.
**Risk:** NONE.

### 4.6 `r2_key` schema missing max_length (DB is String(500))
**File:** `src/modules/progress_photos/schemas.py`
**Fix:** Already addressed in Phase 1.5 (adding max_length=500 + pattern).
**Risk:** N/A — covered by 1.5.

### 4.7 `.gitignore` missing `.env.development`, `.env.test`
**File:** `.gitignore`
**Fix:** Add `.env.*` glob pattern (covers all env file variants).
**Risk:** NONE.

### 4.8 `photoUpload.ts` doesn't validate content type client-side
**File:** `app/services/photoUpload.ts`
**Fix:** Add content type check: `if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('Invalid content type');`
**Risk:** NONE.

---

## Dependency Graph

```
Phase 1 (all independent, can be parallelized):
  1.1 Sharing IDOR ──────────────────────┐
  1.2 Logout token cleanup ──────────────┤
  1.3 onRefreshFailed await ─────────────┤── All must complete before deploy
  1.4 Refresh race condition ────────────┤
  1.5 r2_key validation ─────────────────┘

Phase 2 (after Phase 1, mostly independent):
  2.1 Food get_by_id IDOR
  2.2 Coaching audit log
  2.3 RegisterScreen TOKEN_KEYS
  2.4 .env.example ──────────────────────── depends on 2.5 (CDN_BASE_URL)
  2.5 CDN URL configurable ──────────────── 2.4 depends on this
  2.6 Upload retry
  2.7 micro_nutrients validation

Phase 3 (after Phase 2, all independent):
  3.1-3.12 all independent

Phase 4 (after Phase 3, all independent):
  4.1-4.8 all independent
```

---

## Estimated Effort

| Phase | Issues | Estimated Time | Risk Level |
|-------|--------|---------------|------------|
| Phase 1 | 5 critical | 2-3 hours | HIGH (touches auth + security) |
| Phase 2 | 7 high | 2-3 hours | MEDIUM |
| Phase 3 | 12 medium | 3-4 hours | LOW-MEDIUM |
| Phase 4 | 8 low | 1-2 hours | LOW |
| **Total** | **32** | **8-12 hours** | |

---

## Verification Checklist (Post-Implementation)

- [ ] Log out → force close → reopen: NOT auto-logged-in
- [ ] Share another user's workout: returns 404
- [ ] Submit malicious r2_key: returns 422
- [ ] Fetch another user's custom food item: returns 404
- [ ] System food items still accessible to all users
- [ ] Registration with TOKEN_KEYS works end-to-end
- [ ] Concurrent API calls near token expiry: no forced logout
- [ ] Photo upload on slow connection: retries successfully
- [ ] Feature flag with digits (e.g., `wns_v2`): works
- [ ] JSONB payload at 10KB boundary: passes
- [ ] JSONB payload at 10.1KB: rejected
- [ ] Progress photos on web: shows "not available" message
- [ ] CDN URL uses configurable base URL
- [ ] All existing tests still pass
