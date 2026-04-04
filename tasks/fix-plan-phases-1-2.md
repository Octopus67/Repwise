# Repwise Tech Debt Fix Plan — Phases 1–2

> Generated from audit findings. Each task is self-contained with root cause, fix, and verification.

---

## Phase 1: CRITICAL

### Task 1.1: Redis Rate Limiting
- **Root Cause:** 8 in-memory dicts store rate limit counters. Server restart resets all limits, allowing burst abuse. No shared state across workers.
- **Fix:** Add `redis` dependency, create `RedisRateLimiter` class backed by Redis sorted sets with TTL, replace all in-memory dict references.
- **Files:**
  - `src/middleware/rate_limiter.py:10-17` — 8 dict declarations
  - `src/middleware/global_rate_limiter.py:15` — global dict instance
  - `src/modules/auth/router.py:46` — auth rate limit usage
  - `src/modules/user/service.py:43` — user service rate limit usage
- **Steps:**
  1. Add `redis` to `requirements.txt` / pyproject deps
  2. Add `REDIS_URL` to config/settings with fallback to `redis://localhost:6379`
  3. Create `src/middleware/redis_rate_limiter.py` with `RedisRateLimiter` class using sorted sets + `ZREMRANGEBYSCORE` for sliding window
  4. Implement same interface as current dict-based limiter (`check_rate_limit`, `reset`)
  5. Replace all 8 dict references in `rate_limiter.py` with Redis calls
  6. Update `global_rate_limiter.py:15` to instantiate `RedisRateLimiter`
  7. Update imports in `auth/router.py:46` and `user/service.py:43`
  8. Add graceful fallback to in-memory if Redis unavailable (dev/SQLite mode)
- **Testing:**
  - Verify limits persist across server restart
  - Verify limits work across multiple workers
  - Verify fallback to in-memory when Redis is down
  - Load test: confirm rate limit triggers at threshold
- **Risk:** MED — touches all rate-limited endpoints; fallback mitigates breakage
- **Effort:** 4 hours
- **Depends on:** None

---

### Task 1.2: Dashboard Silent Mutations
- **Root Cause:** 3 coaching handlers (accept, modify, dismiss) have empty `catch {}` blocks. On API failure, the UI optimistically clears store state but never rolls back or notifies the user. Data silently desyncs.
- **Fix:** Add `Alert.alert` in each catch block with user-facing error message. Do NOT clear store on error — only clear on success.
- **Files:**
  - `app/screens/dashboard/DashboardScreen.tsx:137-139` — empty catch blocks for accept/modify/dismiss
- **Steps:**
  1. In each of the 3 catch blocks, add `Alert.alert('Error', 'Could not update coaching. Please try again.')`
  2. Move store-clearing logic from before the API call to after the `await` succeeds (inside try, after response)
  3. Add optional retry button in Alert for each handler
- **Testing:**
  - Simulate API failure (network off) → confirm Alert appears
  - Confirm store state unchanged on failure
  - Confirm store updates correctly on success
- **Risk:** LOW — UI-only change, no backend impact
- **Effort:** 1 hour
- **Depends on:** None

---

### Task 1.3: Log Deletion Silent Failure
- **Root Cause:** DELETE request for workout logs catches errors and ignores them. User thinks log is deleted but it persists on server. UI may remove it from local list, causing desync.
- **Fix:** Add error toast notification on failure. Do not remove log from local state until server confirms deletion.
- **Files:**
  - `app/screens/logs/LogsScreen.tsx:215` — delete handler catch block
  - `app/screens/logs/LogsScreen.tsx:222` — second catch block (bulk delete or related)
- **Steps:**
  1. In catch at line 215, add toast/Alert: `'Failed to delete log. Please try again.'`
  2. In catch at line 222, add same error notification
  3. Move local state removal (`filter`/`splice`) to after successful API response
  4. Add loading indicator during delete request
- **Testing:**
  - Kill API → attempt delete → confirm toast appears and log remains in list
  - Successful delete → confirm log removed from list and server
- **Risk:** LOW — UI-only change
- **Effort:** 1 hour
- **Depends on:** None

---

### Task 1.4: JWT Refresh Silent Failure
- **Root Cause:** Token refresh interceptor fails silently — no logging, no logout. User stays in a zombie authenticated state with an expired token, causing cascading 401s on every subsequent request.
- **Fix:** Log warning on refresh failure. Force logout and redirect to login screen when refresh fails.
- **Files:**
  - `app/services/api.ts:40` — refresh interceptor try block
  - `app/services/api.ts:59` — catch block (silent)
- **Steps:**
  1. In catch block at line 59, add `console.warn('Token refresh failed:', error)`
  2. Call auth store's `logout()` / `clearTokens()` on refresh failure
  3. Navigate to login screen (use navigation ref or event emitter)
  4. Prevent infinite retry loops — add a flag to skip refresh if already refreshing
- **Testing:**
  - Expire refresh token → confirm user is logged out and redirected
  - Confirm console warning is logged
  - Confirm no infinite 401 → refresh → 401 loop
- **Risk:** MED — affects auth flow; must handle race conditions with concurrent requests
- **Effort:** 2 hours
- **Depends on:** None

---

## Phase 2: HIGH SECURITY

### Task 2.1: `password_changed_at` Session Invalidation
- **Root Cause:** No `password_changed_at` column on user model. After password reset, all existing JWTs remain valid. Attacker with stolen token retains access indefinitely.
- **Fix:** Add Alembic migration for `password_changed_at` column. Set it on every password change. Validate JWT `iat` against `password_changed_at` in auth middleware.
- **Files:**
  - `src/modules/auth/service.py:341` — password change handler (no timestamp set)
  - User model (likely `src/models/user.py` or `src/modules/user/model.py`) — needs column
  - Auth middleware / JWT decode logic — needs `iat` check
- **Steps:**
  1. Add `password_changed_at: DateTime` column to User model (nullable, default `None`)
  2. Generate Alembic migration: `alembic revision --autogenerate -m "add_password_changed_at"`
  3. In `auth/service.py:341`, set `user.password_changed_at = datetime.utcnow()` on password change
  4. In JWT validation middleware, compare `token.iat < user.password_changed_at` → reject if true
  5. Handle `None` case (existing users without timestamp) — allow token
  6. Run migration on dev DB, verify column exists
- **Testing:**
  - Login → get token → change password → use old token → confirm 401
  - Login → get token → don't change password → confirm token still works
  - Existing users (null `password_changed_at`) → confirm tokens still valid
- **Risk:** HIGH — affects all authenticated users; migration required; must handle null case
- **Effort:** 3 hours
- **Depends on:** None

---

### Task 2.2: Apple OAuth Complete Implementation
- **Root Cause:** Apple OAuth flow is partially implemented. Nonce is optional (lines 143-151) allowing replay attacks. Identity token verification may be incomplete.
- **Fix:** Make nonce mandatory. Complete Apple identity token verification (signature, audience, issuer, expiry). Store Apple user ID for account linking.
- **Files:**
  - `src/modules/auth/service.py:115` — Apple OAuth entry point
  - `src/modules/auth/service.py:143-151` — nonce handling (optional)
- **Steps:**
  1. Make `nonce` a required parameter in Apple auth endpoint — return 400 if missing
  2. Verify Apple identity token JWT signature against Apple's public keys (`https://appleid.apple.com/auth/keys`)
  3. Validate claims: `iss == "https://appleid.apple.com"`, `aud == app_bundle_id`, `exp > now`
  4. Verify nonce hash matches `nonce` claim in identity token
  5. Cache Apple public keys with TTL (avoid fetching on every request)
  6. On frontend, generate and store nonce before initiating Apple Sign-In, send with auth request
- **Testing:**
  - Missing nonce → 400 error
  - Invalid/expired identity token → 401
  - Replayed token with wrong nonce → 401
  - Valid flow → successful auth
- **Risk:** HIGH — breaking change for existing Apple auth users; coordinate frontend + backend deploy
- **Effort:** 4 hours
- **Depends on:** None

---

### Task 2.3: Token Blacklist Logging
- **Root Cause:** 3 `except: pass` blocks in logout/token-blacklist flow. If blacklisting fails, token remains valid but no one knows. No audit trail for security events.
- **Fix:** Replace `except: pass` with `except Exception as e: logger.warning(...)` in all 3 locations. Add structured context (user_id, token_jti).
- **Files:**
  - `src/modules/auth/service.py:262` — first except:pass
  - `src/modules/auth/service.py:275` — second except:pass
  - `src/modules/auth/service.py:289` — third except:pass
- **Steps:**
  1. Import `logging` if not present; get logger: `logger = logging.getLogger(__name__)`
  2. At line 262: replace `pass` with `logger.warning("Failed to blacklist access token", extra={"user_id": user_id, "error": str(e)})`
  3. At line 275: replace `pass` with `logger.warning("Failed to blacklist refresh token", extra={"user_id": user_id, "error": str(e)})`
  4. At line 289: replace `pass` with `logger.warning("Failed to clear token record", extra={"user_id": user_id, "error": str(e)})`
  5. Ensure each `except` catches `Exception as e`, not bare `except`
- **Testing:**
  - Force DB error during logout → confirm warning logged with user_id and error
  - Normal logout → confirm no warnings
  - Check log output format is parseable
- **Risk:** LOW — logging-only change, no behavior change
- **Effort:** 30 minutes
- **Depends on:** None

---

### Task 2.4: Per-Endpoint Rate Limits
- **Root Cause:** 27 of 29 routers have no rate limiting. Sensitive endpoints (payments, account deletion, data export, coaching) are completely unprotected against abuse.
- **Fix:** Add rate limit decorators/dependencies to payments, account, export, and coaching routers using the Redis-backed limiter from Task 1.1.
- **Files:**
  - Payment router (e.g., `src/modules/payment/router.py`) — no rate limit
  - Account router (e.g., `src/modules/account/router.py` or `user/router.py`) — no rate limit
  - Export router (e.g., `src/modules/export/router.py`) — no rate limit
  - Coaching router (e.g., `src/modules/coaching/router.py`) — no rate limit
- **Steps:**
  1. Confirm Task 1.1 (Redis rate limiter) is complete and working
  2. Create rate limit presets: `STRICT` (5/min), `STANDARD` (30/min), `RELAXED` (60/min)
  3. Add `STRICT` to: payment endpoints, account deletion, password change
  4. Add `STANDARD` to: data export, coaching mutations
  5. Add `RELAXED` to: remaining unprotected read-heavy endpoints
  6. Apply as FastAPI `Depends()` on each router
  7. Document rate limits in API docs / OpenAPI schema
- **Testing:**
  - Hit payment endpoint > 5 times in 1 min → confirm 429
  - Hit export endpoint > 30 times in 1 min → confirm 429
  - Confirm limits reset after window expires
  - Confirm different users have independent limits
- **Risk:** MED — could block legitimate users if limits too aggressive; tune thresholds
- **Effort:** 3 hours
- **Depends on:** Task 1.1 (Redis Rate Limiting)

---

## Summary

| Task | Title | Risk | Effort | Depends |
|------|-------|------|--------|---------|
| 1.1 | Redis Rate Limiting | MED | 4h | — |
| 1.2 | Dashboard Silent Mutations | LOW | 1h | — |
| 1.3 | Log Deletion Silent | LOW | 1h | — |
| 1.4 | JWT Refresh Silent | MED | 2h | — |
| 2.1 | `password_changed_at` | HIGH | 3h | — |
| 2.2 | Apple OAuth | HIGH | 4h | — |
| 2.3 | Token Blacklist Logging | LOW | 0.5h | — |
| 2.4 | Per-Endpoint Rate Limits | MED | 3h | 1.1 |

**Total estimated effort:** ~18.5 hours

**Recommended execution order:**
1. 2.3 (lowest risk, 30 min, immediate security win)
2. 1.2, 1.3 (parallel, LOW risk, 1h each)
3. 1.4 (MED risk, 2h)
4. 1.1 (MED risk, 4h — unblocks 2.4)
5. 2.1 (HIGH risk, 3h — needs migration planning)
6. 2.4 (MED risk, 3h — after 1.1)
7. 2.2 (HIGH risk, 4h — needs frontend coordination)
