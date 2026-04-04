# Repwise Backend — Zero-Bug Hardening Plan

> Generated from codebase audit. 80 broad exception blocks, 0 retry logic, 4 untested modules, dual migration dirs, in-memory state bug.

## Codebase Snapshot

| Metric | Value |
|--------|-------|
| Python | 3.14 |
| Framework | FastAPI + SQLAlchemy async + Alembic |
| Endpoints | 217 across 34 modules |
| Tests | 1,205 passing across 103 files |
| DB Tables | ~50 (SQLite dev / PostgreSQL prod) |
| External Services | 5 (USDA, OFF, RevenueCat, SES, Expo Push) |
| Background Jobs | 7 (APScheduler + Redis leader election) |
| Middleware Layers | 8 |
| Soft-Delete Models | 13 (User, TrainingSession, WorkoutTemplate, CustomExercise, NutritionEntry, CustomMeal, Subscription, FoodItem, HealthReport, MealPlan, ContentArticle, ProgressPhoto, TrainingBlock) |

---

## Dependency Graph

```
Phase 1 (Exceptions) ──┐
                        ├──▶ Phase 5 (Endpoint Verification)
Phase 2 (Retry)  ──────┤
                        ├──▶ Phase 7 (Security)
Phase 3 (Tests)  ──────┤
                        ├──▶ Phase 8 (Performance)
Phase 4 (DB)     ──────┘
                        ┌──▶ Phase 9 (Jobs)
Phase 6 (Contracts) ───┘
                        └──▶ Phase 10 (Logging)
```

## Parallelization

| Can Run In Parallel | Why |
|---------------------|-----|
| Phase 1 + Phase 2 + Phase 3 | Independent: exception handling, retry utility, test writing |
| Phase 4 (after Phase 1) | DB changes depend on exception handling being clean |
| Phase 5 + Phase 6 | Endpoint audit and contract verification are complementary |
| Phase 7 + Phase 8 | Security and performance are independent concerns |
| Phase 9 + Phase 10 | Jobs and logging are independent |

## Total Effort Estimate

| Phase | Effort | Risk |
|-------|--------|------|
| 1. Exception Handling | Medium (1-2d) | HIGH — touches 38 files |
| 2. External Service Resilience | Short (2-4h) | LOW — additive only |
| 3. Missing Test Coverage | Medium (1-2d) | LOW — additive only |
| 4. Database Hardening | Medium (1-2d) | HIGH — migration consolidation |
| 5. Endpoint Verification | Large (3-5d) | MEDIUM — 217 endpoints |
| 6. Frontend-Backend Contracts | Medium (1-2d) | MEDIUM — cross-stack |
| 7. Security Hardening | Medium (1-2d) | HIGH — auth/authz changes |
| 8. Performance Audit | Short (4-8h) | LOW — mostly diagnostic |
| 9. Background Job Hardening | Short (4-8h) | MEDIUM — concurrency |
| 10. Logging & Observability | Short (2-4h) | LOW — additive only |
| **Total** | **~12-18 days** | |

---

## Verification Protocol (Every Phase)

```bash
# After EVERY phase:
cd /Users/manavmht/Documents/HOS
python -m pytest tests/ -v                          # All 1205+ tests pass
python -m pytest tests/ -W error                    # No deprecation warnings
python -m pytest tests/ --cov=src --cov-report=term-missing  # Coverage check
```

---

## Phase 1: Exception Handling Overhaul

**Covers:** Replace all 80 `except Exception` blocks with specific exception types
**Effort:** Medium (1-2 days) | **Risk:** HIGH | **Dependencies:** None (do first)

### Tier 1 — CRITICAL: Route Handlers (broad catches hide HTTP errors from users)

| Task ID | File | Lines | Severity | Root Cause | Implementation |
|---------|------|-------|----------|------------|----------------|
| 1.1 | `src/modules/recomp/router.py` | 59, 87, 111 | CRITICAL | 3 route handlers catch `Exception` and return generic 500. Hides `IntegrityError`, `ValueError`, service-layer `ApiError` subclasses. | Replace with: `except (IntegrityError, ValueError) as e:` → 400/409; `except ApiError:` → re-raise; remove bare `except Exception`. |
| 1.2 | `src/modules/reports/router.py` | 71, 101, 128 | CRITICAL | Weekly/monthly/yearly report routes catch `Exception` after already re-raising `ValueError`/`KeyError`. The remaining catch hides DB errors. | Narrow to `except SQLAlchemyError as e:` → 500 with structured log. The `ValueError`/`KeyError` re-raises are already correct. |
| 1.3 | `src/modules/readiness/readiness_router.py` | 104, 112 | CRITICAL | Readiness endpoints swallow all errors. | Catch `SQLAlchemyError`, `ValueError` specifically. Let `ApiError` propagate. |
| 1.4 | `src/modules/achievements/router.py` | 120 | HIGH | Single broad catch in achievement unlock endpoint. | Narrow to `IntegrityError` (duplicate achievement) and `SQLAlchemyError`. |
| 1.5 | `src/modules/food_database/router.py` | 76 | HIGH | Food search route catches everything. | Catch `httpx.HTTPError`, `httpx.TimeoutException`, `ValueError`. |

**Ripple effects:** Tests relying on 500 responses from these routes may need updating to expect specific 4xx codes.

### Tier 2 — HIGH: Service Layer (silent failures corrupt business logic)

| Task ID | File | Lines | Severity | Root Cause | Implementation |
|---------|------|-------|----------|------------|----------------|
| 1.6 | `src/modules/reports/service.py` | 53, 94, 132, 160, 198 + 2 more | HIGH | 7 catches in report generation. Partial data returned silently when aggregation fails. | Each try block does DB queries + math. Catch `SQLAlchemyError` for DB, `ZeroDivisionError`/`TypeError` for math. Log with `user_id`, `year`, `week`. |
| 1.7 | `src/modules/training/service.py` | 95, 119, 127, 147 | HIGH | Training session CRUD swallows errors. PR detection, session creation can silently fail. | Catch `IntegrityError` (duplicate session), `SQLAlchemyError`, `ValueError` (invalid exercise data). |
| 1.8 | `src/modules/training/volume_service.py` | 132, 154, 190, 241 | HIGH | WNS volume calculations silently return 0 on error. | Catch `ZeroDivisionError`, `TypeError`, `KeyError` for calculation errors. `SQLAlchemyError` for DB. |
| 1.9 | `src/modules/auth/service.py` | 88, 228, 289, 513 | HIGH | Auth operations (register, login, token refresh, OAuth) swallow errors. Line 88: registration. Line 513: OAuth callback. | Line 88: `IntegrityError` (duplicate email) → 409. Line 228: `jwt.InvalidTokenError` → 401. Line 289: `ClientError` (SES) → log + continue. Line 513: `httpx.HTTPError` (OAuth provider) → 502. |
| 1.10 | `src/modules/adaptive/sync_service.py` | 235, 272, 337 | HIGH | Adaptive engine sync silently drops updates. | Catch `SQLAlchemyError`, `ValueError`, `KeyError`. Log sync context (user_id, snapshot_id). |
| 1.11 | `src/modules/nutrition/service.py` | 85, 98, 238 | HIGH | Nutrition entry creation/batch can silently fail. | Catch `IntegrityError`, `SQLAlchemyError`, `ValidationError`. |
| 1.12 | `src/modules/readiness/readiness_service.py` | 71, 195, 252 | HIGH | Readiness score calculation swallows errors. | Catch `ZeroDivisionError`, `TypeError`, `SQLAlchemyError`. |
| 1.13 | `src/modules/user/service.py` | 518 | HIGH | User recalculate swallows all errors. | Catch `SQLAlchemyError`, `ValueError`. |
| 1.14 | `src/modules/food_database/service.py` | 125 | HIGH | Food search aggregation error swallowed. | Catch `httpx.HTTPError`, `httpx.TimeoutException`, `KeyError`, `ValueError`. |
| 1.15 | `src/modules/food_database/barcode_service.py` | 157 | HIGH | Barcode lookup error swallowed. | Catch `httpx.HTTPError`, `httpx.TimeoutException`, `ValueError`. |
| 1.16 | `src/modules/export/service.py` | 137 | HIGH | Export generation error swallowed. | Catch `SQLAlchemyError`, `IOError`, `ValueError`. |
| 1.17 | `src/modules/adaptive/service.py` | 110 | HIGH | Adaptive suggestion error swallowed. | Catch `SQLAlchemyError`, `ValueError`, `KeyError`. |
| 1.18 | `src/modules/adaptive/coaching_service.py` | 579 | HIGH | Coaching recommendation error swallowed. | Catch `SQLAlchemyError`, `ValueError`. |
| 1.19 | `src/modules/analytics/service.py` | 55 | HIGH | Analytics aggregation error swallowed. | Catch `SQLAlchemyError`, `ZeroDivisionError`, `TypeError`. |
| 1.20 | `src/modules/training/wns_volume_service.py` | 170, 348 | HIGH | WNS volume landmark calculations silently fail. | Catch `ZeroDivisionError`, `TypeError`, `SQLAlchemyError`. |
| 1.21 | `src/modules/training/fatigue_service.py` | 131 | HIGH | Fatigue calculation error swallowed. | Catch `ZeroDivisionError`, `TypeError`, `KeyError`. |
| 1.22 | `src/modules/achievements/engine.py` | 59, 77 | HIGH | Achievement check silently fails — user misses unlocks. | Catch `SQLAlchemyError`, `KeyError`, `TypeError`. |

### Tier 3 — MEDIUM: Infrastructure (fail-open is OK, but must log specifically)

| Task ID | File | Lines | Severity | Root Cause | Implementation |
|---------|------|-------|----------|------------|----------------|
| 1.23 | `src/middleware/redis_rate_limiter.py` | 36, 49, 90, 107, 120 | MEDIUM | 6 catches. Fails open by design (correct), but logs generic "Exception". | Narrow to `redis.ConnectionError`, `redis.TimeoutError`, `redis.RedisError`. Keep fail-open behavior. |
| 1.24 | `src/middleware/rate_limiter.py` | 47, 63, 74 | MEDIUM | Same pattern as redis_rate_limiter. | Same fix: specific Redis exceptions. |
| 1.25 | `src/middleware/global_rate_limiter.py` | 51 | MEDIUM | Same pattern. | Same fix. |
| 1.26 | `src/config/redis.py` | 40, 57, 67 | MEDIUM | Redis connection/health check catches everything. | Catch `redis.ConnectionError`, `redis.AuthenticationError`, `OSError`. |
| 1.27 | `src/config/database.py` | 28 | MEDIUM | DB engine creation catches everything. | Catch `SQLAlchemyError`, `OSError`. |
| 1.28 | `src/config/scheduler.py` | 74 | MEDIUM | Job wrapper catches everything (by design for Sentry). | Keep broad catch BUT add specific catches first: `SQLAlchemyError`, `httpx.HTTPError`, `ValueError` → log at ERROR. Final `Exception` → Sentry only. |
| 1.29 | `src/main.py` | 100, 162, 284 | MEDIUM | App startup/shutdown catches everything. | Narrow to specific startup errors: `OSError`, `SQLAlchemyError`, `redis.ConnectionError`. |
| 1.30 | `src/shared/storage.py` | 57 | MEDIUM | Image dimension check catches everything. | Already has `except ImportError` and `except ValidationError`. Narrow remaining to `OSError`, `PIL.UnidentifiedImageError`. |
| 1.31 | `src/services/feature_flags.py` | 76 | MEDIUM | Feature flag evaluation catches everything. | Catch `SQLAlchemyError`, `KeyError`, `ValueError`. |

### Tier 4 — MEDIUM: Background Jobs

| Task ID | File | Lines | Severity | Root Cause | Implementation |
|---------|------|-------|----------|------------|----------------|
| 1.32 | `src/jobs/workout_reminders.py` | 99, 173 | MEDIUM | Reminder send catches everything. | Catch `httpx.HTTPError` (Expo), `SQLAlchemyError`. |
| 1.33 | `src/jobs/trial_expiration.py` | 40, 77 | MEDIUM | Trial check catches everything. | Catch `SQLAlchemyError`, `ValueError`. |
| 1.34 | `src/jobs/export_worker.py` | 92, 104 | MEDIUM | Export processing catches everything. | Catch `SQLAlchemyError`, `IOError`, `ClientError` (R2). |
| 1.35 | `src/jobs/cleanup_blacklist.py` | 39 | MEDIUM | Cleanup catches everything. | Catch `SQLAlchemyError`. |
| 1.36 | `src/jobs/cleanup_exports.py` | 58 | MEDIUM | Cleanup catches everything. | Catch `SQLAlchemyError`, `ClientError` (R2 delete). |
| 1.37 | `src/jobs/permanent_deletion.py` | 35 | MEDIUM | Per-user deletion catches everything. | Catch `SQLAlchemyError`, `ClientError` (R2). Continue to next user on failure. |
| 1.38 | `src/jobs/refresh_leaderboards.py` | 128 | MEDIUM | Leaderboard refresh catches everything. | Catch `SQLAlchemyError`, `redis.RedisError`. |

**Testing:** Run full suite after each tier. Existing tests may fail if they relied on broad catches swallowing errors that now propagate — fix the tests to match new behavior.

---

## Phase 2: External Service Resilience

**Covers:** Retry logic, timeout enforcement, connection pooling, graceful degradation
**Effort:** Short (2-4h) | **Risk:** LOW | **Dependencies:** None (parallel with Phase 1)

### Task 2.1 — Create shared retry utility (CRITICAL)

**Root cause:** Zero retry logic on any external call. A single network blip → user-facing failure.
**File:** `src/utils/retry.py` (new file)
**Implementation:**
1. Install `tenacity` (or use stdlib `asyncio` + manual backoff)
2. Create `@with_retry` decorator:
   - Exponential backoff with jitter
   - Default: 3 retries, 0.5s base delay, 10s max delay
   - Retryable: `httpx.ConnectError`, `httpx.TimeoutException`, `httpx.HTTPStatusError` (5xx only)
   - Log WARNING on each retry, ERROR on final failure
3. Create `@with_retry_sync` variant for synchronous calls (SES via boto3)
   - Retryable: `botocore.exceptions.ClientError` (throttling, service unavailable)

**Risk:** LOW — purely additive
**Testing:** Unit tests for retry decorator with mock failures

### Task 2.2 — Apply retry to USDA client (HIGH)

**Root cause:** `src/modules/food_database/usda_client.py:124,145` — creates new `httpx.AsyncClient` per request, no retry.
**File:** `src/modules/food_database/usda_client.py`
**Implementation:**
1. Wrap `search_usda_foods()` and `get_usda_food_details()` with `@with_retry(max_retries=2, base_delay=1.0)`
2. Currently catches `(httpx.HTTPError, httpx.TimeoutException, KeyError, ValueError)` and returns `[]`/`None` — keep fallback behavior but add retry before giving up
3. Verify timeout is set (already 10s ✅)
4. **Connection pooling issue:** Creates `httpx.AsyncClient()` inside `async with` per call. Consider module-level client initialized in app lifespan.

**Ripple effects:** `food_database/service.py` calls these — no changes needed there.

### Task 2.3 — Apply retry to Open Food Facts client (HIGH)

**Root cause:** `src/modules/food_database/off_client.py:70` — same per-request client pattern, no retry.
**File:** `src/modules/food_database/off_client.py`
**Implementation:**
1. Wrap `get_product_by_barcode()` with `@with_retry(max_retries=2, base_delay=0.5)`
2. Already has semaphore(5) concurrency limit ✅ — retry must respect this
3. Verify timeout is set (already 5s ✅)
4. Same connection pooling concern as USDA

### Task 2.4 — Apply retry to RevenueCat provider (CRITICAL)

**Root cause:** `src/modules/payments/revenuecat_provider.py:144` — payment-critical, no retry, no explicit timeout.
**File:** `src/modules/payments/revenuecat_provider.py`
**Implementation:**
1. Wrap API calls with `@with_retry(max_retries=3, base_delay=1.0)`
2. **Add explicit timeout** — currently `httpx.AsyncClient()` with no timeout (defaults to 5s connect, no read timeout)
3. Set `timeout=httpx.Timeout(10.0, connect=5.0)`
4. Webhook processing must be idempotent for retries to be safe — verify `webhook_event_logs` dedup

**Risk:** MEDIUM — payment operations must be idempotent

### Task 2.5 — Apply retry to email service (HIGH)

**Root cause:** `src/services/email_service.py` — boto3 SES calls with no retry. Already catches `ClientError` and returns `False`.
**File:** `src/services/email_service.py`
**Implementation:**
1. Wrap `_send()` with `@with_retry_sync(max_retries=3, base_delay=1.0)`
2. Retry on `ClientError` with error codes: `Throttling`, `ServiceUnavailable`, `RequestLimitExceeded`
3. Do NOT retry on `MessageRejected`, `MailFromDomainNotVerified` (permanent errors)

### Task 2.6 — Apply retry to push notification service (MEDIUM)

**Root cause:** `src/services/push_notifications.py` — Expo API calls with no retry. Already catches `httpx.HTTPError`.
**File:** `src/services/push_notifications.py`
**Implementation:**
1. Wrap `_send_batch()` with `@with_retry(max_retries=2, base_delay=0.5)`
2. Already has 30s timeout ✅
3. **Connection pooling:** Creates new client per call when `_http_client` is None. Consider passing shared client.

### Task 2.7 — Graceful degradation for food search (MEDIUM)

**Root cause:** If USDA is down, food search should still return OFF results (and vice versa).
**File:** `src/modules/food_database/service.py`
**Implementation:**
1. Verify food search calls USDA and OFF independently (not sequentially dependent)
2. If one fails after retries, return results from the other with a `degraded: true` flag
3. If both fail, return empty results with clear error message — not a 500

**Testing:** Mock each service down independently, verify partial results returned.

---

## Phase 3: Missing Test Coverage

**Covers:** 4 untested modules + gaps in existing modules. Target: 1,400+ tests.
**Effort:** Medium (1-2 days) | **Risk:** LOW | **Dependencies:** None (parallel with Phase 1-2)

### Task 3.1 — Test challenges module (HIGH)

**Root cause:** `src/modules/challenges/router.py` has 2 endpoints, 0 tests.
**New file:** `tests/test_challenges.py`
**Tests to write (~20):**
1. `GET /challenges/current` — returns current week's challenges
2. `GET /challenges/current` — auto-generates if none exist
3. `GET /challenges/current` — requires auth (401)
4. `POST /challenges/{id}/progress` — updates progress value
5. `POST /challenges/{id}/progress` — validates value range (0-10000)
6. `POST /challenges/{id}/progress` — marks completed when target reached
7. `POST /challenges/{id}/progress` — IDOR: can't update another user's challenge
8. `POST /challenges/{id}/progress` — 404 for nonexistent challenge
9. Edge: challenge expiry (past week_end)
10. Edge: duplicate generation for same week

### Task 3.2 — Test dietary_analysis module (HIGH)

**Root cause:** `src/modules/dietary_analysis/router.py` has 3 endpoints returning raw `dict` (no response_model), 0 tests.
**New file:** `tests/test_dietary_analysis.py`
**Tests to write (~25):**
1. `GET /trends` — returns trend data with correct structure
2. `GET /trends` — window_days validation (1-90)
3. `GET /trends` — empty data (no nutrition entries)
4. `GET /trends` — rate limited (10/60s)
5. `GET /gaps` — requires premium (403 for free users)
6. `GET /gaps` — returns gap list with correct structure
7. `GET /gaps` — empty data returns empty list
8. `GET /recommendations` — requires premium
9. `GET /recommendations` — returns recommendations for identified gaps
10. All 3: auth required (401)
11. **Also fix:** Add `response_model` to all 3 endpoints (currently return raw dicts)

### Task 3.3 — Test health_reports module (HIGH)

**Root cause:** `src/modules/health_reports/router.py` has 5 endpoints, 0 tests.
**New file:** `tests/test_health_reports.py`
**Tests to write (~30):**
1. `POST /reports` — create report (premium-gated)
2. `POST /reports` — validation (blood marker parsing)
3. `GET /reports` — pagination (page, limit)
4. `GET /reports` — empty state
5. `GET /reports/{id}` — detail view
6. `GET /reports/{id}` — IDOR prevention (can't access other user's report)
7. `GET /reports/{id}` — 404 for nonexistent
8. `GET /reports/{id}/correlations` — cross-reference with nutrition data
9. `GET /reports/samples` — returns sample data (no premium required)
10. All: auth required (401), premium-gated where specified (403)

### Task 3.4 — Test legal module (LOW)

**Root cause:** `src/modules/legal/router.py` has 2 endpoints, 0 tests.
**New file:** `tests/test_legal.py`
**Tests to write (~6):**
1. `GET /privacy` — returns HTML with content
2. `GET /terms` — returns HTML with content
3. Both: no auth required
4. Both: correct Content-Type header
5. Edge: missing markdown file → graceful error (not 500)

### Task 3.5 — Fill gaps in reports module (MEDIUM)

**Root cause:** Only weekly report has tests (`tests/test_weekly_report_unit.py`). Monthly and yearly have none.
**New file:** `tests/test_monthly_report.py`, `tests/test_yearly_report.py`
**Tests to write (~20):**
1. Monthly: valid month, empty data, future month rejected, date boundary (Jan vs Dec)
2. Yearly: valid year, empty data, future year rejected
3. Both: rate limiting (10/60s shared with weekly)
4. Both: auth required

### Task 3.6 — Fill gaps in social module (MEDIUM)

**Existing file:** `tests/test_social.py` (light coverage)
**Tests to add (~15):**
1. Follow/unfollow idempotency
2. Self-follow prevention
3. Feed pagination
4. Reaction CRUD (create, delete, duplicate prevention)
5. Leaderboard calculation accuracy
6. Shared template copy

### Task 3.7 — Fill gaps in sharing module (MEDIUM)

**Existing file:** `tests/test_sharing.py` (light coverage)
**Tests to add (~10):**
1. Share link generation (unique, correct format)
2. Share tracking (view count increment)
3. HTML rendering of shared workouts
4. Expired share links
5. Auth: share creation requires auth, viewing does not

**Total new tests: ~126 → Target: 1,331+ (from 1,205)**

---

## Phase 4: Data Integrity & Database Hardening

**Covers:** Migration consolidation, in-memory state bug, indexes, soft delete audit, JSONB validation
**Effort:** Medium (1-2 days) | **Risk:** HIGH | **Dependencies:** Phase 1 (clean exception handling first)

### Task 4.1 — Consolidate dual migration directories (CRITICAL)

**Root cause:** Two Alembic migration directories exist:
- `src/database/migrations/versions/` — 33 files (active, referenced by `alembic.ini`)
- `alembic/versions/` — 5 files (orphaned: `20240601_meal_plans.py`, `20240601_add_recomp_measurements.py`, `20240602_body_measurements.py`, `20240603_create_export_requests.py`, `20260316_add_r2_key_to_progress_photos.py`)

**Implementation:**
1. Run `alembic heads` to check for multiple heads
2. Run `alembic history` to verify the chain in `src/database/migrations/versions/`
3. Check if the 5 orphaned files in `alembic/versions/` are already represented in the main directory (likely duplicates from early development)
4. If duplicates: delete `alembic/versions/` directory entirely
5. If unique: merge into main directory with correct `down_revision` chain
6. Verify: `alembic check` shows no issues, `alembic upgrade head` works on fresh DB

**Risk:** HIGH — broken migration chain can corrupt production DB
**Testing:** Create fresh SQLite DB, run `alembic upgrade head`, verify all tables exist

### Task 4.2 — Move _recalculate_attempts to Redis (CRITICAL)

**Root cause:** `src/modules/user/service.py:42` — in-memory dict for rate limiting recalculate. Broken for multi-worker Gunicorn: each worker has its own dict, users bypass cooldown by hitting different workers. Also lost on restart.
**File:** `src/modules/user/service.py`
**Implementation:**
1. Replace `_recalculate_attempts: dict[str, float] = {}` (line 42) with Redis-based check
2. Key pattern: `recalculate_cooldown:{user_id}` with TTL = `RECALCULATE_COOLDOWN_SECONDS` (60s)
3. Use `redis.set(key, "1", nx=True, ex=60)` — if returns True, allow; if False, reject
4. Remove the manual dict cleanup at line 277 (`if len(_recalculate_attempts) > 10000`)
5. Fallback: if Redis unavailable, allow the operation (fail-open for non-critical rate limit)

**Ripple effects:** `tests/test_recalculate_properties.py` and `tests/test_auto_recalculate.py` may need Redis mock
**Risk:** MEDIUM — straightforward Redis pattern
**Testing:** Test cooldown works across simulated workers, test Redis-down fallback

### Task 4.3 — Verify and add missing indexes (HIGH)

**Root cause:** Frequently queried columns may lack indexes, causing slow queries at scale.
**Files:** New Alembic migration
**Implementation:**
1. Check existing indexes: `SELECT * FROM pg_indexes WHERE tablename IN ('nutrition_entries', 'training_sessions', 'bodyweight_logs', 'adaptive_snapshots');`
2. Verify these composite indexes exist (add if missing):
   - `ix_nutrition_entries_user_date` on `(user_id, date)`
   - `ix_training_sessions_user_date` on `(user_id, date)`
   - `ix_bodyweight_logs_user_date` on `(user_id, date)`
   - `ix_adaptive_snapshots_user_created` on `(user_id, created_at)`
3. Run `EXPLAIN ANALYZE` on: dashboard load query, session list query, nutrition entries by date
4. Create Alembic migration for any missing indexes

**Risk:** LOW — additive, non-destructive
**Testing:** Verify migration applies cleanly, verify `EXPLAIN` shows index usage

### Task 4.4 — Audit soft delete queries (HIGH)

**Root cause:** 13 models use `SoftDeleteMixin`. Any query missing `WHERE deleted_at IS NULL` returns ghost records.
**Files:** All service files that query soft-deletable models
**Implementation:**
1. For each of the 13 soft-delete models, grep all `select()` statements
2. Verify every query includes `.where(Model.deleted_at.is_(None))` or uses a base query that filters
3. Check if `SoftDeleteMixin` provides a default query filter (SQLAlchemy event) — if not, consider adding one
4. Verify unique constraints account for soft deletes (e.g., user can create exercise with same name as soft-deleted one)
5. Verify cascade: when User is soft-deleted, check what happens to their TrainingSessions, NutritionEntries, etc.
6. Verify reactivation: when account is reactivated, are related soft-deleted records restored?

**Models to audit:** User, TrainingSession, WorkoutTemplate, CustomExercise, NutritionEntry, CustomMeal, Subscription, FoodItem, HealthReport, MealPlan, ContentArticle, ProgressPhoto, TrainingBlock

**Risk:** MEDIUM — may find queries returning deleted data
**Testing:** Create soft-deleted records, verify they don't appear in list/search endpoints

### Task 4.5 — JSONB validation audit (MEDIUM)

**Root cause:** Several models store critical data in JSONB (exercises in TrainingSession, metadata in User, macros in AdaptiveSnapshot). Schema drift can cause runtime errors.
**Implementation:**
1. Verify Pydantic models validate JSONB before storage
2. Check `validate_json_size()` is called for large JSONB blobs
3. Verify JSONB queries use null checks and defaults
4. Test: store old-format JSONB, verify it's still readable (migration safety)

---

## Phase 5: Endpoint-by-Endpoint Verification

**Covers:** All 217 endpoints — auth, authorization, IDOR, validation, pagination, rate limiting
**Effort:** Large (3-5 days) | **Risk:** MEDIUM | **Dependencies:** Phase 1, Phase 4

### Verification Checklist (apply to every endpoint)

| Check | What to Verify |
|-------|---------------|
| Auth | `get_current_user` dependency present? |
| AuthZ | Resource ownership verified (`resource.user_id == current_user.id`)? |
| Validation | Pydantic request model? Query param types/ranges? |
| Response Model | `response_model=` defined? (dietary_analysis returns raw dicts — fix) |
| Error Codes | 400, 401, 403, 404, 409, 422, 429 returned appropriately? |
| Pagination | List endpoints paginated? Max page_size enforced? |
| Rate Limiting | Sensitive endpoints rate-limited? |
| Idempotency | POST endpoints idempotent where needed? |
| Soft Delete | DELETE uses soft-delete consistent with model mixin? |

### Priority Module: Training (36 endpoints — largest module)

| Task ID | Endpoint | Concern | Action |
|---------|----------|---------|--------|
| 5.1 | `POST /training/sessions` | Data integrity | Verify PR recalculation is atomic with session creation |
| 5.2 | `GET /training/sessions` | Pagination | Verify max page_size, default ordering |
| 5.3 | `PUT /training/sessions/{id}` | IDOR | Verify `session.user_id == current_user.id` |
| 5.4 | `DELETE /training/sessions/{id}` | Soft delete | Verify uses SoftDeleteMixin, PRs recalculated |
| 5.5 | `GET /training/exercises/search` | Performance | Check if using FTS5/GIN or LIKE queries |

### Specific High-Risk Endpoints

| Task ID | Endpoint | Severity | Concern | Action |
|---------|----------|----------|---------|--------|
| 5.6 | `POST /auth/register` | CRITICAL | Race condition: two simultaneous registrations with same email | Verify unique constraint handles this → `IntegrityError` → 409 |
| 5.7 | `POST /auth/refresh` | CRITICAL | Token rotation: is old refresh token blacklisted atomically? | Verify atomic blacklist + new token generation |
| 5.8 | `POST /payments/webhook/revenuecat` | CRITICAL | Idempotency: duplicate webhook events | Verify `webhook_event_logs` dedup, concurrent event handling |
| 5.9 | `DELETE /account` | CRITICAL | Cascade: active subscriptions, scheduled jobs, pending exports | Verify all related data handled on soft-delete |
| 5.10 | `POST /nutrition/entries/batch` | HIGH | Partial failure: one invalid entry in batch | Verify: all-or-nothing or partial success? Document behavior. |
| 5.11 | `POST /progress-photos/upload-url` | HIGH | Security: `validate_image_upload()` NOT called for presigned URLs | See Phase 7 Task 7.1 |
| 5.12 | `POST /import/execute` | HIGH | Atomicity: partial import on failure | Verify transaction rollback on error |
| 5.13 | `POST /meal-plans/generate` | HIGH | Timeout: greedy algorithm may exceed 30s | Verify timeout handling, add max iteration limit |
| 5.14 | `POST /adaptive/weekly-checkin` | HIGH | Side effects: recalculation failure | Verify checkin saved even if recalculation fails |
| 5.15 | `GET /reports/weekly` | HIGH | N+1 queries: aggregates across tables | Profile query count (see Phase 8) |

### Module-by-Module Sweep (remaining 33 modules)

| Module | Endpoints | Key Checks |
|--------|-----------|------------|
| auth | ~12 | Rate limiting on all auth endpoints, enumeration prevention |
| user | ~8 | Profile IDOR, recalculate rate limit (Phase 4 fix) |
| nutrition | ~15 | Batch operations, date validation, IDOR on entries |
| food_database | ~10 | Search pagination, barcode validation |
| meals | ~8 | Custom meal IDOR, favorite toggle idempotency |
| meal_plans | ~6 | Generation timeout, premium gate |
| periodization | ~8 | Block IDOR, template validation |
| achievements | ~6 | Unlock idempotency, streak freeze limits |
| social | ~12 | Follow IDOR, feed pagination, reaction limits |
| coaching | ~10 | Request/session IDOR, tier validation |
| adaptive | ~8 | Suggestion IDOR, sync atomicity |
| reports | 3 | Rate limiting (already present ✅), future date validation (already present ✅) |
| recomp | 3 | Feature flag gate (already present ✅), broad catches (Phase 1) |
| measurements | ~6 | Photo IDOR, measurement validation |
| progress_photos | ~5 | Upload validation gap (Phase 7), photo IDOR |
| export | ~4 | Rate limiting, download IDOR, status IDOR |
| health_reports | 5 | Premium gate, report IDOR, correlation accuracy |
| dietary_analysis | 3 | Add response_model (returns raw dicts), premium gate |
| challenges | 2 | Challenge IDOR, progress validation |
| sharing | ~5 | Share link auth (create=auth, view=public) |
| notifications | ~4 | Device token IDOR, preference validation |
| import_data | ~3 | File validation, atomicity |
| onboarding | ~4 | Idempotency, validation |
| account | ~3 | Deletion cascade, reactivation window |
| dashboard | ~3 | Performance (aggregation queries) |
| analytics | ~4 | Performance (volume calculations) |
| readiness | ~4 | Calculation accuracy, broad catches (Phase 1) |
| content | ~3 | Admin-only mutations |
| community | 2 | Admin-only updates |
| feature_flags | ~3 | Admin-only |
| founder | ~2 | Founder code validation |
| legal | 2 | Public access (no auth) ✅ |
| payments | ~6 | Webhook security, subscription IDOR |

---

## Phase 6: Frontend-Backend Contract Verification

**Covers:** API call matching, request/response shape verification, error handling, pagination contracts
**Effort:** Medium (1-2 days) | **Risk:** MEDIUM | **Dependencies:** Phase 5 (endpoints verified first)

### Task 6.1 — Map all frontend API calls to backend endpoints (HIGH)

**Implementation:**
1. Search frontend for all `api.get()`, `api.post()`, `api.put()`, `api.delete()`, `api.patch()` calls
2. Build a mapping table: frontend call → backend endpoint → method match → path match
3. Flag any frontend call that hits a nonexistent endpoint
4. Flag any backend endpoint with no frontend caller (dead endpoint?)

### Task 6.2 — Verify request/response shapes (HIGH)

**Implementation:**
1. For each mapped call, compare frontend TypeScript types with backend Pydantic models
2. Check: field names match, types match, optional vs required match, nested objects match
3. **Known issue:** `dietary_analysis` endpoints return raw `dict` — no TypeScript type can match. Fix by adding `response_model` (Task 3.2).
4. Check nullable fields — frontend may not handle `null` for fields that backend can return as `None`

### Task 6.3 — Verify error handling for all status codes (HIGH)

**Implementation:**
1. Frontend currently auto-retries on 401 only. Verify handling for:
   - 422 → field-level error messages displayed
   - 429 → "try again later" with `Retry-After` header
   - 403 → upgrade prompt (premium required)
   - 404 → appropriate empty state
   - 500 → generic error with retry option
   - Network errors → offline state
2. Verify backend returns `Retry-After` header on 429 responses

### Task 6.4 — Verify pagination contract (MEDIUM)

**Implementation:**
1. Verify frontend and backend agree on pagination format (page/page_size)
2. Check response envelope structure matches (`items`, `total_count`, `page`, `limit`)
3. Verify frontend handles empty pages correctly

### Task 6.5 — Verify date format contract (MEDIUM)

**Implementation:**
1. Verify both sides use ISO 8601
2. Check timezone handling: dates stored as UTC, frontend converts to local
3. Check date-only fields (e.g., `training_sessions.date`) vs datetime fields

### Task 6.6 — Verify file upload flow (MEDIUM)

**Implementation:**
1. Trace the presigned URL flow: frontend requests → backend generates R2 URL → frontend uploads → frontend confirms
2. Verify error handling at each step
3. Check: what happens if upload succeeds but confirmation fails? (Orphaned file in R2)

---

## Phase 7: Security Hardening

**Covers:** Presigned upload validation, rate limiting gaps, IDOR audit, enumeration prevention
**Effort:** Medium (1-2 days) | **Risk:** HIGH | **Dependencies:** Phase 4 (Redis for rate limiting), Phase 5

### Task 7.1 — Fix presigned upload validation gap (CRITICAL)

**Root cause:** `src/shared/storage.py:23` — comment explicitly states `validate_image_upload()` is NOT called for presigned URL uploads. Users can upload malware, executables, oversized files.
**File:** `src/shared/storage.py`, `src/modules/progress_photos/router.py`
**Implementation (choose one):**
- **Option A (recommended):** Add content-type and content-length constraints to presigned URL policy:
  ```python
  Conditions=[
      ["content-length-range", 0, MAX_FILE_SIZE],
      ["starts-with", "$Content-Type", "image/"],
  ]
  ```
- **Option B:** Add post-upload confirmation endpoint that downloads from R2, validates, deletes if invalid
- **Option C:** R2 event notification triggers validation Lambda

**Risk:** HIGH — current state allows arbitrary file upload
**Testing:** Attempt upload of non-image file, verify rejection

### Task 7.2 — Rate limiting gaps on sensitive endpoints (HIGH)

**Root cause:** Several expensive/sensitive endpoints lack rate limiting.
**Files:** Various router files
**Implementation:**

| Endpoint | Current | Required | Action |
|----------|---------|----------|--------|
| `POST /auth/login` | 5/15min ✅ | — | No change |
| `POST /auth/register` | Verify | 5/15min | Add if missing |
| `POST /auth/forgot-password` | Verify | 3/15min | Add if missing |
| `POST /auth/resend-verification` | 3/15min ✅ | — | No change |
| `POST /auth/oauth/*` | Verify | 10/15min | Add if missing |
| `POST /users/recalculate` | In-memory ⚠️ | Redis-based | Fixed in Task 4.2 |
| `POST /import/execute` | None | 3/hour | Add — expensive operation |
| `POST /meal-plans/generate` | None | 5/hour | Add — expensive operation |
| `POST /export/request` | None | 3/hour | Add — expensive operation |
| `POST /progress-photos/upload-url` | None | 20/hour | Add — storage cost |

### Task 7.3 — IDOR audit on every {id} parameter (CRITICAL)

**Root cause:** Every endpoint taking a resource ID must verify ownership.
**Implementation:** For each endpoint below, verify `resource.user_id == current_user.id` check exists:

| Endpoint Group | Files | Check |
|---------------|-------|-------|
| `nutrition/entries/{entry_id}` | `src/modules/nutrition/router.py` | GET, PUT, DELETE |
| `training/sessions/{id}` | `src/modules/training/router.py` | GET, PUT, DELETE |
| `training/custom-exercises/{id}` | `src/modules/training/router.py` | GET, PUT, DELETE |
| `training/templates/user/{id}` | `src/modules/training/templates_router.py` | GET, PUT, DELETE |
| `food/recipes/{id}` | `src/modules/food_database/router.py` | GET, PUT, DELETE |
| `food/items/{id}` | `src/modules/food_database/router.py` | GET, PUT, DELETE |
| `progress-photos/{id}` | `src/modules/progress_photos/router.py` | GET, PATCH, DELETE |
| `periodization/blocks/{id}` | `src/modules/periodization/router.py` | GET, PUT, DELETE |
| `body-measurements/{id}` | `src/modules/measurements/router.py` | GET, PUT, DELETE |
| `export/status/{id}`, `download/{id}` | `src/modules/export/router.py` | GET, DELETE |
| `health-reports/{id}` | `src/modules/health_reports/router.py` | GET, correlations |
| `coaching/requests/{id}/*` | `src/modules/coaching/router.py` | All mutations |
| `coaching/sessions/{id}/*` | `src/modules/coaching/router.py` | All mutations |
| `adaptive/suggestions/{id}/*` | `src/modules/adaptive/router.py` | All mutations |
| `meals/custom/{meal_id}` | `src/modules/meals/router.py` | PUT, DELETE |
| `meals/favorites/{id}` | `src/modules/meals/router.py` | DELETE |
| `challenges/{id}/progress` | `src/modules/challenges/router.py` | POST |

### Task 7.4 — Enumeration prevention (HIGH)

**Root cause:** Error messages may leak whether a resource exists or belongs to another user.
**Files:** `src/modules/auth/service.py`, `src/modules/auth/router.py`
**Implementation:**
1. Login failure: must return "Invalid email or password" (not "User not found" vs "Wrong password")
2. Registration: don't reveal if email exists (send "account exists" email instead — already implemented ✅ in `email_service.py`)
3. Password reset: "If an account exists, we've sent a reset code"
4. Resource 404: generic "Not found" (not "Resource belongs to another user")

---

## Phase 8: Performance Audit

**Covers:** N+1 query detection, slow query logging, response size limits
**Effort:** Short (4-8h) | **Risk:** LOW | **Dependencies:** Phase 4 (indexes)

### Task 8.1 — N+1 query detection on key endpoints (HIGH)

**Root cause:** Endpoints aggregating across multiple tables may issue N+1 queries.
**Implementation:** Add SQL query counting in tests for these endpoints:

| Endpoint | Concern | Max Expected Queries |
|----------|---------|---------------------|
| `GET /training/sessions` (list) | Eager-load exercises? | ≤3 (sessions + exercises + PRs) |
| `GET /reports/weekly` | Aggregates training + nutrition + body | ≤10 |
| `GET /dashboard/summary` | Loads macros, meals, training, trends | ≤8 |
| `GET /analytics/muscle-volume` | WNS across all sessions | ≤5 |
| `GET /achievements` | Checks 23 achievements | ≤5 (batch check, not per-achievement) |
| `GET /social/feed` | Feed with reactions, user info | ≤4 |

**How to measure:** Use SQLAlchemy event listener to count queries per request in test:
```python
from sqlalchemy import event
queries = []
event.listen(engine.sync_engine, "before_cursor_execute", lambda *a: queries.append(a))
```

### Task 8.2 — Add slow query logging (MEDIUM)

**Root cause:** No visibility into query performance in production.
**File:** `src/config/database.py` or new middleware
**Implementation:**
1. Add SQLAlchemy event listener for `after_cursor_execute`
2. Log WARNING for queries > 100ms
3. Log ERROR for queries > 500ms
4. Include: query text (truncated to 200 chars), params (sanitized), duration, calling endpoint

### Task 8.3 — Response size limits (MEDIUM)

**Root cause:** List endpoints may return unbounded data.
**Implementation:**
1. Verify every paginated endpoint has max `page_size` (recommend 100)
2. Check: does `GET /training/sessions` list include full `exercises` JSONB? (Should be summary only in list, full in detail)
3. Verify JSONB fields in list responses are not unnecessarily large
4. Add `Content-Length` logging for responses > 1MB

---

## Phase 9: Background Job Hardening

**Covers:** All 7 scheduled jobs — idempotency, failure handling, race conditions, leader election
**Effort:** Short (4-8h) | **Risk:** MEDIUM | **Dependencies:** Phase 1 (exception handling)

### Job-by-Job Verification

| Task ID | Job | Schedule | File | Checks |
|---------|-----|----------|------|--------|
| 9.1 | `permanent_deletion` | Daily 3 AM | `src/jobs/permanent_deletion.py` | ① Partial failure: if deleting user A fails, does it continue to user B? ② Idempotent: safe to run twice? ③ Deletes from R2 AND DB? ④ What if R2 delete fails — DB record left in limbo? |
| 9.2 | `cleanup_blacklist` | Daily 4 AM | `src/jobs/cleanup_blacklist.py` | ① Batch deletes to avoid long transactions? ② Idempotent? |
| 9.3 | `trial_expiration` | Hourly | `src/jobs/trial_expiration.py` | ① Race with webhook: user upgrades during the hour between checks? ② Idempotent: running twice doesn't double-expire? |
| 9.4 | `export_worker` | Every 5 min | `src/jobs/export_worker.py` | ① What if export takes > 5 min? Next run picks it up again? (Double processing) ② Verify `max_instances=1` prevents overlap ✅ ③ Stuck export detection (timeout?) |
| 9.5 | `cleanup_exports` | Daily 5 AM | `src/jobs/cleanup_exports.py` | ① Deletes from R2 AND DB? ② R2 delete failure handling? |
| 9.6 | `refresh_leaderboards` | Every 15 min | `src/jobs/refresh_leaderboards.py` | ① Atomic refresh? What do users see during refresh? ② Stale data vs empty data during refresh? |
| 9.7 | `workout_reminders` | Every 2 hours | `src/jobs/workout_reminders.py` | ① Respects notification preferences? ② Checks if user already worked out today? ③ Doesn't spam on repeated runs? |

### Task 9.8 — Leader election verification (HIGH)

**Root cause:** Redis-based leader election in `src/config/scheduler.py` uses NX lock with 60s TTL, renewed every 30s.
**File:** `src/config/scheduler.py`
**Verify:**
1. **Redis down:** All workers stop scheduling? Or all workers start scheduling? (Should: stop scheduling, fail-safe)
2. **Leader hangs (not dead, but stuck):** Lock expires after 60s, another worker takes over? Verify the stuck worker's in-flight job doesn't conflict with new leader's job.
3. **Lock renewal race:** Lock expires between check (`r.get`) and renewal (`r.expire`) at lines ~57-58. Use Lua script for atomic check-and-renew.
4. **Graceful shutdown:** `stop_scheduler()` releases lock and waits for in-flight jobs ✅

**Implementation if issues found:**
- Replace check-then-renew with atomic Lua script:
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
  else
      return 0
  end
  ```

---

## Phase 10: Logging & Observability

**Covers:** Structured logging audit, Sentry integration, log coverage for critical operations
**Effort:** Short (2-4h) | **Risk:** LOW | **Dependencies:** Phase 1 (exception handling provides logging context)

### Task 10.1 — Structured logging audit (HIGH)

**Root cause:** Many log statements lack context (user_id, request_id, operation details).
**Implementation:** Audit every `logger.info/warning/error` call and ensure it includes:

| Event | Level | Required Context |
|-------|-------|-----------------|
| Auth success | INFO | user_id, provider (email/google/apple), IP |
| Auth failure | WARNING | email (masked: `j***@gmail.com`), reason, IP |
| Rate limit hit | WARNING | IP, endpoint, limit, window |
| External service error | ERROR | service name, endpoint, status code, response time |
| External service retry | WARNING | service name, attempt number, delay |
| Background job start | INFO | job name |
| Background job complete | INFO | job name, duration, records processed |
| Background job failure | ERROR | job name, error type, message, stack trace |
| Slow query (>100ms) | WARNING | query (truncated), duration, endpoint |
| Subscription change | INFO | user_id, old_status, new_status, provider |
| Account deletion | INFO | user_id, deletion_type (soft/permanent) |
| Data export | INFO | user_id, format, size |
| Webhook received | INFO | event_type, event_id, provider |
| Webhook processing error | ERROR | event_type, event_id, error |

### Task 10.2 — Sentry integration verification (MEDIUM)

**File:** `src/main.py` (Sentry init), `src/config/scheduler.py` (job wrapper)
**Verify:**
1. All unhandled exceptions reach Sentry (catch-all handler calls `sentry_sdk.capture_exception()`)
2. User context attached: `sentry_sdk.set_user({"id": user.id})` in auth middleware
3. Request context attached: URL, method, headers (minus Authorization)
4. Breadcrumbs include: DB queries, external service calls
5. `traces_sample_rate` — currently 0.1. For early-stage app, consider 1.0 until volume justifies sampling.
6. Job failures in `safe_run()` wrapper already call `sentry_sdk.capture_exception()` ✅

### Task 10.3 — Add request_id propagation (MEDIUM)

**Root cause:** No way to correlate logs across a single request.
**File:** `src/middleware/logging_middleware.py`
**Implementation:**
1. Generate UUID per request in logging middleware
2. Add to `extra` context for all log calls within that request
3. Return as `X-Request-ID` response header
4. Pass to Sentry as tag

---

## What I Can Implement vs What Needs the User

### I Can Implement Autonomously

| Phase | Tasks | Why |
|-------|-------|-----|
| Phase 1 | All 38 tasks | Mechanical: identify exception types, replace, add logging |
| Phase 2 | Tasks 2.1-2.6 | Create retry utility, apply decorators |
| Phase 3 | Tasks 3.1-3.7 | Write tests against existing endpoints |
| Phase 4 | Tasks 4.2, 4.3, 4.4, 4.5 | Redis migration, index verification, soft delete audit |
| Phase 7 | Tasks 7.3, 7.4 | IDOR audit, enumeration prevention |
| Phase 8 | Tasks 8.1, 8.2, 8.3 | Query counting, slow query logging |
| Phase 9 | Tasks 9.1-9.7 | Job-by-job code review and fixes |
| Phase 10 | All tasks | Logging improvements, Sentry verification |

### Needs User Input / Decision

| Phase | Task | Decision Needed |
|-------|------|----------------|
| Phase 2 | Task 2.7 | Graceful degradation: should food search return partial results with a flag, or fail entirely? |
| Phase 4 | Task 4.1 | Migration consolidation: are the 5 files in `alembic/versions/` duplicates or unique? Need to verify against production DB state. |
| Phase 5 | Task 5.10 | Batch nutrition entries: all-or-nothing or partial success? Business decision. |
| Phase 6 | All tasks | Requires access to frontend codebase (React Native). I can audit backend side only. |
| Phase 7 | Task 7.1 | Presigned upload fix: Option A (URL constraints), B (post-upload validation), or C (event notification)? Recommend A. |
| Phase 7 | Task 7.2 | Rate limit values for new endpoints: confirm proposed limits. |
| Phase 9 | Task 9.8 | Leader election: if Lua script fix is needed, requires Redis version ≥ 2.6 (verify production Redis version). |

---

## Success Criteria

| # | Criterion | Measurable |
|---|-----------|-----------|
| 1 | Zero `except Exception` blocks | `grep -r "except Exception" src/ | wc -l` → 0 |
| 2 | All external services have retry | 5 services × retry decorator applied |
| 3 | 1,400+ tests passing | `pytest --tb=short | tail -1` |
| 4 | Single migration directory | `ls alembic/versions/` → empty or deleted |
| 5 | In-memory state moved to Redis | `grep "_recalculate_attempts" src/` → 0 hits |
| 6 | All {id} endpoints IDOR-checked | Manual audit checklist complete |
| 7 | Presigned upload validated | Upload non-image → rejected |
| 8 | All sensitive endpoints rate-limited | Rate limit test for each |
| 9 | Structured logging on all critical ops | Log audit checklist complete |
| 10 | Full test suite green after every phase | CI pipeline confirms |
