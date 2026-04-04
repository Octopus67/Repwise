# Repwise Backend — Zero-Bug Hardening Prompt

## YOUR MISSION

You are a **Principal Engineer** with 20+ years of experience shipping production systems at scale. You have been brought in to do a zero-bug hardening pass on the Repwise backend. Your job is to make this backend **bulletproof** — every endpoint verified, every edge case covered, every error handled gracefully, every integration resilient, every query optimized, every test passing.

Think like someone whose pager goes off at 3 AM when things break. Think like someone who has been burned by every possible failure mode and now obsessively prevents them. Think like someone who reviews code at Amazon/Google/Stripe and rejects anything that isn't production-grade.

**Your standard: if a senior principal engineer at a top-tier company audited this codebase, they would find ZERO issues.**

---

## THE CODEBASE

- **Location**: `/Users/manavmht/Documents/HOS`
- **Stack**: Python 3.12 + FastAPI + SQLAlchemy (async) + Alembic + SQLite (dev) / PostgreSQL (prod)
- **Scale**: 220 endpoints across 34 modules, ~50 database tables, 1,539 tests across 105 test files
- **Auth**: JWT (access 15min + refresh 7 days) + Google/Apple OAuth + bcrypt
- **External Services**: USDA FoodData Central, Open Food Facts, RevenueCat, Cloudflare R2, AWS SES, Expo Push, Redis, PostHog, Sentry
- **Background Jobs**: APScheduler with Redis leader election (7 scheduled jobs)
- **Middleware**: 8 layers (TrustedHost, SecurityHeaders, CORS, HTTPS Redirect, Timeout, Logging, BodySize, RateLimit)

---

## PHASE 1: EXCEPTION HANDLING OVERHAUL (CRITICAL — DO FIRST)

There are **80 broad `except Exception` blocks** across the codebase. This is the #1 source of silent failures and impossible-to-debug production issues.

### What to Do

For EVERY `except Exception` block in the codebase:

1. **Identify the specific exceptions** that can actually be raised in the `try` block
2. **Replace with specific exception types** (e.g., `httpx.HTTPError`, `sqlalchemy.exc.IntegrityError`, `json.JSONDecodeError`, `KeyError`, `ValueError`, etc.)
3. **Ensure proper logging** — every caught exception must be logged with context (what operation, what input, what user)
4. **Decide the correct failure behavior**:
   - Should it raise an `ApiError` subclass? (most route handlers)
   - Should it return a default/fallback value? (only for non-critical enrichment)
   - Should it re-raise? (if the caller needs to know)
5. **NEVER silently swallow exceptions** — `except Exception: pass` is forbidden

### Priority Files (Worst Offenders)

| File | Broad Catches | Severity |
|------|--------------|----------|
| `src/modules/reports/service.py` | 7 | HIGH — report generation silently returns partial data |
| `src/middleware/redis_rate_limiter.py` | 6 | MEDIUM — fails open by design, but should log specifically |
| `src/modules/training/service.py` | 4 | HIGH — training data operations |
| `src/modules/training/volume_service.py` | 4 | HIGH — WNS calculations |
| `src/modules/adaptive/sync_service.py` | 3 | HIGH — adaptive engine |
| `src/modules/recomp/router.py` | 3 | CRITICAL — broad catches IN ROUTE HANDLERS |
| All other files | ~53 | MEDIUM — audit each one |

### Rules

- `except Exception` in a **route handler** = CRITICAL. Route handlers must catch specific errors and return proper HTTP status codes.
- `except Exception` in a **service layer** = HIGH. Services should catch specific errors and either handle them or raise `ApiError` subclasses.
- `except Exception` in **infrastructure code** (Redis, middleware) = MEDIUM. These can fail open, but must log the specific error type.
- After fixing, run the full test suite. If any test relied on broad exception swallowing, fix the test to match the new behavior.

---

## PHASE 2: EXTERNAL SERVICE RESILIENCE

Currently **ZERO external service calls have retry logic**. This means a single network blip to USDA, Open Food Facts, RevenueCat, SES, or Expo causes a user-facing failure.

### What to Build

Create a shared retry utility at `src/utils/retry.py`:

```python
# Requirements:
# - Exponential backoff with jitter
# - Configurable max retries (default 3)
# - Configurable base delay (default 0.5s)
# - Configurable max delay (default 10s)
# - Configurable retryable exceptions (default: httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError for 5xx)
# - Logging on each retry attempt (warning level)
# - Final failure logged at error level with full context
# - Circuit breaker pattern (optional, for high-frequency calls)
```

### Apply Retry Logic to Each Service

| Service | File | Retry Config | Notes |
|---------|------|-------------|-------|
| **USDA FoodData Central** | food search client | 2 retries, 1s base | High latency API, timeout already 10s |
| **Open Food Facts** | food search client | 2 retries, 0.5s base | Already has semaphore(5) concurrency limit |
| **RevenueCat** | payments service | 3 retries, 1s base | Payment-critical, must not lose webhook data |
| **AWS SES** | email service | 3 retries, 1s base | Email delivery is important (verification, password reset) |
| **Expo Push** | notification service | 2 retries, 0.5s base | Best-effort, but should try harder |
| **Cloudflare R2** | progress photos | 2 retries, 1s base | Presigned URL generation |

### Additional Resilience Patterns

- **Timeout enforcement**: Verify every `httpx.AsyncClient` has an explicit timeout. Currently USDA=10s, OFF=5s. Add timeouts to any client missing them.
- **Connection pooling**: Ensure `httpx.AsyncClient` instances are reused (not created per-request). Check if they're initialized in app lifespan and shared.
- **Graceful degradation**: If USDA is down, food search should still return Open Food Facts results (and vice versa). If both are down, return cached results or a clear error — not a 500.
- **Health check integration**: The `/health/jobs` endpoint should report external service health (last successful call timestamp, error rate).

---

## PHASE 3: MISSING TEST COVERAGE

Six modules have **ZERO dedicated tests**. This is unacceptable for production.

### Modules Needing Tests

| Module | Endpoints | What to Test |
|--------|-----------|-------------|
| **dietary_analysis** | GET /trends, /gaps, /recommendations | Response structure (currently returns raw dicts!), date range handling, empty data, user with no nutrition entries, edge cases in gap detection |
| **community** | GET /, PUT / | CRUD operations, auth required, admin-only updates |
| **account (deletion)** | DELETE /account, POST /reactivate | Soft delete flow, data retention, reactivation within window, reactivation after window, cascading effects on related data (sessions, entries, subscriptions) |
| **health_reports** | POST /reports, GET /reports, GET /correlations | Report creation, blood marker parsing, correlation calculations, sample data endpoint, pagination |
| **challenges** | GET /current, POST /progress | Challenge lifecycle, progress tracking, completion detection, expired challenges |
| **legal** | GET /privacy, GET /terms | HTML rendering, content presence |

### Test Quality Standards

Every test file must include:

1. **Happy path tests** — the normal flow works correctly
2. **Authentication tests** — endpoint rejects unauthenticated requests (401)
3. **Authorization tests** — endpoint rejects unauthorized users (403), users can't access other users' data (IDOR prevention)
4. **Validation tests** — invalid input returns 422 with clear error messages
5. **Empty state tests** — what happens when there's no data?
6. **Edge case tests** — boundary values, maximum lengths, special characters, Unicode, null/None handling
7. **Concurrent access tests** — what happens with simultaneous requests? (where applicable)
8. **Error path tests** — what happens when dependencies fail? (DB errors, external service errors)

### Existing Test Gaps to Fill

| Module | Gap | What's Missing |
|--------|-----|---------------|
| **reports** | Monthly/yearly reports | Only weekly report has tests. Add tests for monthly and yearly report generation, empty data handling, date boundary edge cases |
| **social** | Light coverage | Add tests for: follow/unfollow idempotency, self-follow prevention, feed pagination, reaction CRUD, leaderboard calculation, shared template copy |
| **sharing** | Light coverage | Add tests for: share link generation, share tracking, HTML rendering of shared workouts |

---

## PHASE 4: DATA INTEGRITY & DATABASE HARDENING

### Missing Indexes (Verify and Add)

These columns are queried frequently but may lack indexes:

```sql
-- Verify these exist, add if missing:
CREATE INDEX IF NOT EXISTS ix_nutrition_entries_user_date ON nutrition_entries (user_id, date);
CREATE INDEX IF NOT EXISTS ix_training_sessions_user_date ON training_sessions (user_id, date);
CREATE INDEX IF NOT EXISTS ix_bodyweight_logs_user_date ON bodyweight_logs (user_id, date);
CREATE INDEX IF NOT EXISTS ix_adaptive_snapshots_user_created ON adaptive_snapshots (user_id, created_at);
```

Run `EXPLAIN ANALYZE` on the most common queries (dashboard load, session list, nutrition entries by date) and verify indexes are being used.

### Migration Consolidation

There are **two Alembic migration directories**:
- `alembic/versions/` (4 files)
- `src/database/migrations/versions/` (33 files)

This is a ticking time bomb. Consolidate to a single directory. Verify the migration chain is unbroken (no orphaned heads, no missing dependencies).

### In-Memory State Bug

`src/modules/user/service.py` uses an **in-memory dict** (`_recalculate_attempts`) for recalculation cooldowns. This is broken in production:
- Lost on process restart
- Not shared across Gunicorn workers (each worker has its own dict)
- Users can bypass cooldown by hitting a different worker

**Fix**: Move to Redis with TTL-based keys:
```python
# Key: f"recalculate_cooldown:{user_id}"
# Value: attempt count
# TTL: cooldown period
```

### Soft Delete Verification

Multiple models use `SoftDeleteMixin` (User, TrainingSession, WorkoutTemplate, CustomExercise, NutritionEntry, CustomMeal, Subscription, TrainingBlock). Verify:

1. **All queries filter by `deleted_at IS NULL`** — search for any query that might return soft-deleted records
2. **Cascade behavior** — when a user is soft-deleted, are their related records also properly handled?
3. **Unique constraints** — do unique constraints account for soft deletes? (e.g., can a user create a custom exercise with the same name as a soft-deleted one?)
4. **Reactivation** — when an account is reactivated, are all related soft-deleted records also restored?

### JSONB Validation

Several models store critical data in JSONB columns (exercises in TrainingSession, metadata in User, macros in AdaptiveSnapshot, preferences in UserProfile). Verify:

1. **Schema validation** — is the JSONB structure validated before storage? (Pydantic models should enforce this)
2. **Migration safety** — if the JSONB schema evolves, are old records still readable?
3. **Query safety** — any JSONB queries use proper null checks and default values
4. **Size limits** — `validate_json_size()` is called before storing large JSONB blobs

---

## PHASE 5: ENDPOINT-BY-ENDPOINT VERIFICATION

Go through EVERY endpoint (all 220) and verify:

### For Each Endpoint, Check:

1. **Auth**: Does it require authentication? Is the `get_current_user` dependency present? Are there endpoints that should be auth-protected but aren't?
2. **Authorization**: Does it check that the user owns the resource they're accessing? (IDOR prevention). Every `GET /resource/{id}`, `PUT /resource/{id}`, `DELETE /resource/{id}` must verify `resource.user_id == current_user.id`.
3. **Input Validation**: Is the request body validated with a Pydantic model? Are query parameters validated (types, ranges, lengths)?
4. **Response Model**: Does the endpoint have a `response_model` defined? (The dietary_analysis endpoints return raw dicts — fix this)
5. **Error Responses**: Does the endpoint return proper HTTP status codes for all failure modes? (400, 401, 403, 404, 409, 422, 429, 500)
6. **Pagination**: Do list endpoints support pagination? Is there a maximum page size to prevent abuse?
7. **Rate Limiting**: Are sensitive endpoints rate-limited? (auth, password reset, email verification, recalculate)
8. **Idempotency**: Are POST endpoints idempotent where they should be? (e.g., webhook handlers, favorite toggles)
9. **Concurrency**: What happens if two requests modify the same resource simultaneously? (optimistic locking, last-write-wins, or conflict detection?)
10. **Soft Delete**: Do DELETE endpoints soft-delete or hard-delete? Is this consistent with the model's mixin?

### Specific Endpoint Concerns

| Endpoint | Concern | What to Verify |
|----------|---------|---------------|
| `POST /auth/register` | Race condition | Two simultaneous registrations with same email — does the unique constraint handle this gracefully? |
| `POST /auth/refresh` | Token rotation | Is the old refresh token blacklisted atomically with new token generation? |
| `POST /payments/webhook/revenuecat` | Idempotency | Does `webhook_event_logs` prevent duplicate processing? What if the same event arrives twice simultaneously? |
| `DELETE /account` | Cascade | What happens to active subscriptions, scheduled jobs, pending exports? |
| `POST /training/sessions` | Data integrity | Are personal records recalculated atomically with session creation? |
| `POST /nutrition/entries/batch` | Partial failure | If one entry in the batch fails validation, do all fail or just the invalid one? What's the correct behavior? |
| `POST /progress-photos/upload-url` | Security | Is `validate_image_upload()` actually called? (Audit noted it's NOT called for presigned URL uploads) |
| `POST /import/execute` | Data integrity | Is the import atomic? If it fails halfway, is the partial import rolled back? |
| `POST /meal-plans/generate` | Timeout | Meal plan generation with the greedy algorithm — can it exceed the 30s request timeout? |
| `GET /training/exercises/search` | Performance | Full-text search on exercises — is it using FTS5/GIN index or doing LIKE queries? |
| `POST /adaptive/weekly-checkin` | Side effects | Does this trigger recalculation? What if recalculation fails — is the checkin still saved? |
| `GET /reports/weekly` | Performance | Report generation aggregates across multiple tables — is it doing N+1 queries? |

---

## PHASE 6: FRONTEND-BACKEND CONTRACT VERIFICATION

The frontend (React Native + Axios) and backend (FastAPI) must be in perfect sync.

### What to Verify

1. **Every frontend API call matches a backend endpoint** — search the frontend for all `api.get()`, `api.post()`, `api.put()`, `api.delete()`, `api.patch()` calls. Verify each one hits a real endpoint with the correct method and path.

2. **Request body shapes match** — the frontend's request objects must match the backend's Pydantic request models exactly. Check field names, types, optional vs required.

3. **Response shapes match** — the frontend's TypeScript types/interfaces must match the backend's Pydantic response models. Check field names, types, nullable fields, nested objects.

4. **Error handling** — the frontend currently only auto-retries on 401. Verify it handles:
   - 422 (validation errors) — shows field-level error messages
   - 429 (rate limited) — shows "try again later" with Retry-After header
   - 403 (premium required) — shows upgrade prompt
   - 404 (not found) — shows appropriate empty state
   - 500 (server error) — shows generic error with retry option
   - Network errors (no connection) — shows offline state

5. **Pagination contract** — verify the frontend and backend agree on pagination format (page/page_size vs cursor-based, response envelope structure).

6. **Date format** — verify both sides use the same date format (ISO 8601). Check timezone handling — are dates stored as UTC? Does the frontend convert to local time?

7. **File uploads** — verify the presigned URL flow: frontend requests URL → backend generates R2 presigned URL → frontend uploads directly to R2 → frontend confirms upload to backend. Check error handling at each step.

### Add Client-Side Retry

The frontend currently has NO retry logic for network errors (only 401 retry). Add:

```typescript
// Retry config for the Axios instance:
// - Retry on network errors (no response)
// - Retry on 502, 503, 504 (server temporarily unavailable)
// - 3 retries with exponential backoff (1s, 2s, 4s)
// - Do NOT retry on 4xx errors (client errors)
// - Do NOT retry on POST/PUT/DELETE unless idempotent
```

---

## PHASE 7: SECURITY HARDENING

### Presigned Upload Validation Gap

The audit found that `validate_image_upload()` is **NOT called for R2 presigned URL uploads**. This means:
- A user could upload a non-image file (malware, executable) to R2
- A user could upload an oversized file
- Content-type header could be spoofed

**Fix options:**
1. Add a confirmation endpoint that validates the uploaded file after upload (download from R2, validate, delete if invalid)
2. Add R2 event notification that triggers validation
3. At minimum, add content-type and size constraints to the presigned URL policy

### Rate Limiting Gaps

Verify rate limiting on ALL sensitive endpoints:

| Endpoint | Expected Limit | Verify |
|----------|---------------|--------|
| POST /auth/login | 5/15min per email | ✅ Confirmed |
| POST /auth/register | Rate limited | Verify limit |
| POST /auth/forgot-password | Rate limited | Verify limit |
| POST /auth/resend-verification | 3/15min | ✅ Confirmed |
| POST /auth/oauth/* | Rate limited | Verify limit |
| POST /users/recalculate | Cooldown | ⚠️ In-memory only — fix in Phase 4 |
| POST /import/execute | ? | Should be rate limited (expensive operation) |
| POST /meal-plans/generate | ? | Should be rate limited (expensive operation) |
| POST /export/request | ? | Should be rate limited (expensive operation) |
| POST /progress-photos/upload-url | ? | Should be rate limited (storage cost) |

### IDOR (Insecure Direct Object Reference) Audit

For EVERY endpoint that takes a resource ID as a path parameter, verify:

```python
# CORRECT:
resource = await db.get(Resource, resource_id)
if resource.user_id != current_user.id:
    raise ForbiddenError("Access denied")

# WRONG (missing ownership check):
resource = await db.get(Resource, resource_id)
return resource  # Any authenticated user can access any resource!
```

Endpoints to audit (every `{id}` parameter):
- `GET/PUT/DELETE /nutrition/entries/{entry_id}`
- `GET/PUT/DELETE /training/sessions/{id}`
- `GET/PUT/DELETE /training/custom-exercises/{id}`
- `GET/PUT/DELETE /training/templates/user/{id}`
- `GET/PUT/DELETE /food/recipes/{id}`
- `GET/PUT/DELETE /food/items/{id}`
- `GET/PATCH/DELETE /progress-photos/{id}`
- `GET/PUT/DELETE /periodization/blocks/{id}`
- `GET/PUT/DELETE /body-measurements/{id}`
- `DELETE /body-measurements/{id}/photos/{photo_id}`
- `GET /export/status/{id}`, `GET /export/download/{id}`, `DELETE /export/{id}`
- `GET /health-reports/{id}`, `GET /health-reports/{id}/correlations`
- `POST /coaching/requests/{id}/*`
- `POST /coaching/sessions/{id}/*`
- `POST /adaptive/suggestions/{id}/*`
- `PUT/DELETE /meals/custom/{meal_id}`
- `DELETE /meals/favorites/{id}`
- `DELETE /notifications/register-device/{id}`

### Enumeration Prevention

Verify that error messages don't leak information:
- Login failure: "Invalid email or password" (not "User not found" vs "Wrong password")
- Registration: Don't reveal if email is already registered (or if you do, rate-limit the check)
- Password reset: "If an account exists, we've sent a reset code" (not "No account with that email")
- Resource not found: Generic 404 (not "Resource belongs to another user")

---

## PHASE 8: PERFORMANCE AUDIT

### N+1 Query Detection

Check these endpoints for N+1 queries:

| Endpoint | Concern |
|----------|---------|
| `GET /training/sessions` (list) | Does it eager-load exercises, or does each session trigger a separate query? |
| `GET /reports/weekly` | Aggregates training + nutrition + body data — how many queries? |
| `GET /dashboard/summary` | Loads macros, meals, training, trends — how many queries? |
| `GET /analytics/muscle-volume` | WNS calculation across all sessions — query count? |
| `GET /achievements` | Checks progress for all 23 achievements — query count? |
| `GET /social/feed` | Feed with reactions, user info — eager loading? |

For each: add query counting in tests (log SQL queries, assert count is reasonable).

### Slow Query Identification

Add query timing logging:
```python
# Log any query taking > 100ms at WARNING level
# Log any query taking > 500ms at ERROR level
# Include the query, parameters, and execution time
```

### Response Size

Check that list endpoints don't return unbounded data:
- Every paginated endpoint has a maximum `page_size` (e.g., 100)
- JSONB fields in responses are not unnecessarily large
- The `exercises` JSONB in training sessions can be very large — is it included in list responses or only in detail responses?

---

## PHASE 9: BACKGROUND JOB HARDENING

### Verify Each Scheduled Job

| Job | Schedule | What to Verify |
|-----|----------|---------------|
| `permanent_deletion` | Daily 3 AM | Does it handle partial failures? If deleting user A fails, does it still process user B? Is it idempotent (safe to run twice)? |
| `cleanup_blacklist` | Daily 4 AM | Does it batch deletes to avoid long-running transactions? |
| `trial_expiration` | Hourly | Does it handle the case where a user upgrades to paid during the hour between checks? Race condition with webhook? |
| `export_worker` | Every 5 min | What happens if an export takes longer than 5 min? Does the next run pick it up again? (Double processing?) |
| `cleanup_exports` | Daily 5 AM | Does it delete from R2 AND the database? What if R2 delete fails? |
| `refresh_leaderboards` | Every 15 min | Is this atomic? What do users see during refresh? (Stale data? Empty data?) |
| `workout_reminders` | Every 2 hours | Does it respect notification preferences? Does it check if the user has already worked out today? |

### Leader Election

The Redis-based leader election uses NX lock with 60s TTL, renewed every 30s. Verify:
- What happens if Redis goes down? (All workers stop scheduling? Or all workers start scheduling?)
- What happens if the leader process hangs (not dead, but stuck)? Does the lock expire and another worker take over?
- Is there a race condition in lock renewal? (Lock expires between check and renewal)

---

## PHASE 10: LOGGING & OBSERVABILITY

### Structured Logging Audit

Verify that every important operation is logged with sufficient context:

```python
# GOOD:
logger.info("Training session created", extra={
    "user_id": user.id,
    "session_id": session.id,
    "exercise_count": len(session.exercises),
    "request_id": request_id
})

# BAD:
logger.info("Session created")  # No context — useless in production
```

### What Must Be Logged

| Event | Level | Required Context |
|-------|-------|-----------------|
| Auth success | INFO | user_id, provider, IP |
| Auth failure | WARNING | email (masked), reason, IP |
| Rate limit hit | WARNING | IP, endpoint, limit |
| External service error | ERROR | service name, endpoint, status code, response time |
| External service retry | WARNING | service name, attempt number, delay |
| Background job start/complete | INFO | job name, duration, records processed |
| Background job failure | ERROR | job name, error type, error message, stack trace |
| Slow query | WARNING | query (truncated), duration, endpoint |
| Subscription change | INFO | user_id, old_status, new_status, provider |
| Account deletion | INFO | user_id, deletion_type (soft/permanent) |
| Data export | INFO | user_id, format, size |
| Webhook received | INFO | event_type, event_id, provider |
| Webhook processing error | ERROR | event_type, event_id, error |

### Sentry Integration

Verify:
- All unhandled exceptions reach Sentry (the catch-all handler should call `sentry_sdk.capture_exception()`)
- User context is attached to Sentry events (`sentry_sdk.set_user({"id": user.id})`)
- Request context is attached (URL, method, headers minus auth)
- Breadcrumbs are useful (DB queries, external service calls)
- `traces_sample_rate=0.1` — is this appropriate? For a new app, consider 1.0 until you have volume.

---

## VERIFICATION PROTOCOL (NON-NEGOTIABLE)

After EVERY phase, you MUST:

1. **Run the full test suite**: `pytest` — all 1,539+ tests must pass
2. **Run with warnings**: `pytest -W error` — no deprecation warnings
3. **Type check**: `mypy src/` (if configured) or verify no type errors in IDE
4. **Check for regressions**: any endpoint that was working before must still work
5. **Document what you changed**: for each file modified, explain what was wrong and what you fixed

### Test Commands

```bash
# Run all tests
cd /Users/manavmht/Documents/HOS
python -m pytest tests/ -v

# Run specific module tests
python -m pytest tests/test_auth_unit.py -v
python -m pytest tests/test_training_properties.py -v

# Run with coverage
python -m pytest tests/ --cov=src --cov-report=term-missing

# Run only new tests you wrote
python -m pytest tests/test_dietary_analysis.py tests/test_community.py tests/test_account_deletion.py tests/test_health_reports.py tests/test_challenges.py tests/test_legal.py -v
```

---

## EXECUTION ORDER

1. **Phase 1**: Exception handling (highest impact, most bugs hidden here)
2. **Phase 2**: External service resilience (retry logic)
3. **Phase 3**: Missing test coverage (6 untested modules + gaps)
4. **Phase 4**: Data integrity (indexes, migrations, in-memory state, soft deletes)
5. **Phase 5**: Endpoint verification (220 endpoints, one by one)
6. **Phase 6**: Frontend-backend contract (mismatches cause user-facing bugs)
7. **Phase 7**: Security hardening (presigned uploads, rate limiting, IDOR)
8. **Phase 8**: Performance (N+1 queries, slow queries, response sizes)
9. **Phase 9**: Background jobs (idempotency, failure handling, race conditions)
10. **Phase 10**: Logging & observability (structured logging, Sentry)

---

## DO NOT

- Do NOT delete or skip existing tests to make the suite pass — fix the code, not the tests
- Do NOT add `# type: ignore`, `# noqa`, or suppress any linter/type warnings
- Do NOT change API response shapes without updating the frontend types
- Do NOT add new dependencies without justification (prefer stdlib solutions)
- Do NOT refactor code structure (file moves, renames) — this is a hardening pass, not a rewrite
- Do NOT change business logic — only fix bugs, add resilience, and improve error handling
- Do NOT leave any `except Exception` blocks — every single one must be narrowed to specific types
- Do NOT skip any phase — all 10 phases are mandatory
- Do NOT mark a phase complete without running the full test suite

## DO

- Add comments explaining WHY you made each change (not what — the diff shows what)
- Add type hints to any function missing them
- Add docstrings to any public function missing them
- Preserve all existing comments, logging statements, and documentation
- Create an Alembic migration for any schema changes (indexes, constraints)
- Write property-based tests (Hypothesis) where appropriate — the codebase already uses this pattern
- Test error paths, not just happy paths
- Think about what happens at 3 AM when you're not watching

---

## WHAT SUCCESS LOOKS LIKE

When you're done:

1. **Zero broad `except Exception` blocks** — every exception handler catches specific types
2. **All external services have retry logic** with exponential backoff
3. **1,700+ tests passing** (1,539 existing + ~160 new for untested modules and gaps)
4. **All 220 endpoints verified** for auth, authorization, validation, error handling, and IDOR
5. **Frontend and backend contracts match** — no mismatches in request/response shapes
6. **All indexes verified** — `EXPLAIN ANALYZE` confirms they're used
7. **Single Alembic migration directory** — clean, linear migration chain
8. **In-memory state moved to Redis** — recalculate cooldown is multi-worker safe
9. **Presigned upload validation** — files are validated after upload
10. **Every sensitive endpoint is rate-limited** — no abuse vectors
11. **Structured logging** — every important operation logged with context
12. **The codebase is something you'd be proud to show a principal engineer**

This backend should be so solid that you could deploy it, go on vacation for a month, and come back to zero incidents.
