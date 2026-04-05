# Repwise Deep Audit Fix Plan

**Date:** April 5, 2026
**Source:** Deep Independent Audit (63 findings across 6 dimensions)
**Total Findings:** 7 CRITICAL, 15 HIGH, 25 MEDIUM, 16 LOW
**Estimated Effort:** 80-100 hours across 6 phases

---

## Plan Overview

| Phase | Severity | Items | Est. Hours | Dependencies |
|-------|----------|-------|------------|--------------|
| 1: Secrets & Launch Blockers | 🔴 CRITICAL | 5 (C1, C2, C3, C5, H3) | 10-12h | None |
| 2: Data Integrity & Locking | 🔴 CRITICAL + 🟠 HIGH | 6 (C4, H4, H5, H6, H7, H8) | 14-16h | Phase 1 |
| 3: Resilience & Observability | 🟠 HIGH | 7 (H2, H9, H10, H11, H12, H14, L5) | 10-12h | None |
| 4: Frontend Hardening | 🟠 HIGH + 🟡 MEDIUM | 12 (C6, H13, M1-M9) | 16-20h | None |
| 5: Architecture & Schema Cleanup | 🟡 MEDIUM | 12 (M10-M20, M23-M25) | 14-16h | Phase 2 |
| 6: Test Gaps & Polish | 🟡 MEDIUM + 🔵 LOW | 21 (C7, H15, M21-M22, L1-L16) | 16-24h | Phase 1-3 |

---

## Phase 1: Secrets & Launch Blockers (MUST complete before launch)

### 1.1 Rotate all exposed secrets and scrub git history [C1]

**Root cause:** Real API keys (Sentry auth token, Neon API key, PostHog, RevenueCat, Sentry DSN) committed in `.env`, `.env.example`, and `app/eas.json`. Recoverable from git history even if removed from HEAD.

**Affected files:**
- `.env:28-29` — SENTRY_AUTH_TOKEN, NEON_API_KEY
- `.env.example:63-68` — PostHog key, RevenueCat key, Sentry DSN
- `app/eas.json` — PostHog key, Sentry DSN
- Git history (all commits touching these files)

**Implementation steps:**
1. **Rotate keys** (external — no code change):
   - Sentry: Settings → Auth Tokens → Revoke + create new
   - Neon: Project Settings → API Keys → Revoke + create new
   - PostHog: Project Settings → API Key → Regenerate
   - RevenueCat: Project → API Keys → Create new, deactivate old
2. **Scrub `.env.example`** — replace all real values with `<your-key-here>` placeholders
3. **Scrub `app/eas.json`** — replace PostHog key and Sentry DSN with placeholders or move to EAS Secrets
4. **Add `.env` to `.gitignore`** (verify it's already there; if not, add)
5. **Remove committed files from git tracking:**
   ```bash
   git rm --cached .env dev.db backend.log
   ```
6. **Add `detect-secrets` pre-commit hook:**
   ```bash
   pip install detect-secrets
   detect-secrets scan > .secrets.baseline
   # Add to .pre-commit-config.yaml
   ```
7. **Update Railway env vars** with new rotated keys

**Ripple effects:** All environments (Railway, local dev, CI) need updated keys. CI secrets in GitHub must be updated.
**Regression risk:** HIGH — if any key is missed, that service breaks. Verify each service after rotation.
**Testing:** Manual — hit each external service endpoint after rotation to confirm connectivity.
**Audit pass criteria:** `git log -p --all -S 'phc_' -- .` returns zero results for real keys in HEAD.

---

### 1.2 Add FK constraint on PaymentTransaction.subscription_id [C2]

**Root cause:** `subscription_id` is a plain UUID column with no ForeignKey to `subscriptions.id`. Orphan transactions can reference non-existent subscriptions.

**Affected files:**
- `src/modules/payments/models.py:70` — column definition
- New Alembic migration

**Implementation steps:**
1. In `models.py`, change:
   ```python
   # Before
   subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True)
   # After
   subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(
       ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True
   )
   ```
2. Create Alembic migration:
   - First: clean orphans — `DELETE FROM payment_transactions WHERE subscription_id NOT IN (SELECT id FROM subscriptions)`
   - Then: add FK constraint
   - SQLite guard (skip on SQLite)
3. Downgrade: drop FK constraint

**Ripple effects:** Any code creating PaymentTransaction with an invalid subscription_id will now fail with IntegrityError. Verify webhook handler and cancel flow.
**Regression risk:** MEDIUM — FK constraint could reject valid writes if subscription is deleted before transaction is created. `ondelete="SET NULL"` handles this.
**Testing:**
- Migration round-trip test (upgrade → downgrade → upgrade)
- Unit test: create transaction with valid subscription_id → success
- Unit test: create transaction with invalid subscription_id → IntegrityError

---

### 1.3 Add streaming/limits to export service [C3]

**Root cause:** `_collect_user_data()` in `export/service.py:283-301` fetches ALL bodyweight logs, training sessions, and nutrition entries with `.scalars().all()` and no LIMIT. Power users with years of data can OOM the worker.

**Affected files:**
- `src/modules/export/service.py:283-301` — `_collect_user_data()`
- `src/modules/export/service.py:150,245` — file write operations (also blocking I/O — see H7)

**Implementation steps:**
1. Replace `.scalars().all()` with `.yield_per(500)` for streaming:
   ```python
   result = await session.stream(stmt)
   async for row in result.scalars().yield_per(500):
       writer.writerow(row.to_dict())
   ```
2. Add a hard cap: `LIMIT 100_000` on each query as a safety net
3. Write CSV incrementally to a temp file instead of building in memory
4. Add `Content-Length` estimation to the export response

**Ripple effects:** Export response format unchanged. Streaming means the response starts before all data is fetched — verify the HTTP response is chunked.
**Regression risk:** LOW — same output, different memory profile.
**Testing:**
- Unit test: export user with 0 entries → empty CSV
- Unit test: export user with 1000 entries → correct CSV
- Manual: verify export works for a user with substantial data

---

### 1.4 Add auth token persistence to Zustand store [C5]

**Root cause:** `useStore` (holding auth tokens, user profile, subscription state) is NOT persisted. App kill/crash forces re-login every time.

**Affected files:**
- `app/store/index.ts` — main store definition
- `app/utils/secureStorage.ts` — storage adapter

**Implementation steps:**
1. Create a SecureStore storage adapter for Zustand persist:
   ```typescript
   import { StateStorage } from 'zustand/middleware';
   import { secureGet, secureSet, secureDelete } from '../utils/secureStorage';
   
   export const secureStorageAdapter: StateStorage = {
     getItem: async (name) => await secureGet(name),
     setItem: async (name, value) => await secureSet(name, value),
     removeItem: async (name) => await secureDelete(name),
   };
   ```
2. Add `persist` middleware to the auth slice in `useStore`:
   ```typescript
   persist(
     (set, get) => ({ ...authSlice(set, get), ...otherSlices }),
     {
       name: 'repwise-auth',
       storage: createJSONStorage(() => secureStorageAdapter),
       partialize: (state) => ({ tokens: state.tokens, user: state.user }),
     }
   )
   ```
3. Add `onRehydrateStorage` callback to validate token expiry on app start
4. Ensure logout still clears persisted auth (already calls `clearAuth()`)

**Ripple effects:** App startup now has an async rehydration step. Splash screen must wait for rehydration before navigating. Check `App.tsx` for existing loading gate.
**Regression risk:** MEDIUM — if persistence fails silently, users get logged out. Add error handling in the storage adapter.
**Testing:**
- Manual: login → kill app → reopen → should be logged in
- Manual: login → logout → kill app → reopen → should be on login screen
- Unit test: secureStorageAdapter round-trip (set → get → remove)

---

### 1.5 Fix webhook auth timing attack [H3]

**Root cause:** RevenueCat webhook auth key comparison in `payments/router.py` may use `==` instead of `hmac.compare_digest()`, enabling timing-based secret extraction.

**Affected files:**
- `src/modules/payments/router.py:37-55` — webhook auth check

**Implementation steps:**
1. Read the current webhook auth implementation
2. Replace any `==` comparison with:
   ```python
   import hmac
   if not hmac.compare_digest(
       request.headers.get("Authorization", ""),
       f"Bearer {settings.REVENUECAT_WEBHOOK_AUTH_KEY}"
   ):
       raise HTTPException(status_code=401)
   ```
3. Ensure both sides are `str` (not `bytes`) — `compare_digest` handles both

**Ripple effects:** None — same behavior, constant-time comparison.
**Regression risk:** NONE
**Testing:**
- Unit test: valid auth key → 200
- Unit test: invalid auth key → 401
- Unit test: missing auth header → 401


---

## Phase 2: Data Integrity & Locking

### 2.1 Add optimistic locking to TrainingSession and Subscription [C4]

**Root cause:** No `version` column. Concurrent PUT requests on training sessions cause silent data loss (last-write-wins). Concurrent webhook events can race on subscription status transitions.

**Affected files:**
- `src/modules/training/models.py` — TrainingSession model
- `src/modules/payments/models.py` — Subscription model
- `src/modules/training/service.py` — update methods
- `src/modules/payments/service.py` — status transition methods
- New Alembic migration (add `version` column to both tables)

**Implementation steps:**
1. Add to both models:
   ```python
   version: Mapped[int] = mapped_column(default=1, server_default="1")
   ```
2. In training service update method, add version check:
   ```python
   stmt = (
       update(TrainingSession)
       .where(TrainingSession.id == session_id, TrainingSession.version == expected_version)
       .values(**updates, version=expected_version + 1)
   )
   result = await db.execute(stmt)
   if result.rowcount == 0:
       raise ConflictError("Training session was modified by another request")
   ```
3. Same pattern for Subscription status transitions
4. Create migration adding `version` column with default=1 to both tables
5. Add `ConflictError` (HTTP 409) to `src/shared/errors.py` if not present

**Ripple effects:** Frontend must handle 409 responses — show "Data was updated, please refresh" message. Check all PUT/PATCH endpoints on these models.
**Regression risk:** MEDIUM — any update path that doesn't pass `version` will fail. Grep for ALL update calls on these models.
**Testing:**
- Unit test: concurrent updates → second one gets 409
- Unit test: sequential updates with correct version → success
- Integration test: webhook + API update race → one succeeds, one gets 409

---

### 2.2 Cache dashboard queries or combine into single CTE [H4]

**Root cause:** `dashboard/service.py` fires 5+ parallel DB queries via `asyncio.gather()`. Under load, this multiplies connection usage (5 connections per dashboard request).

**Affected files:**
- `src/modules/dashboard/service.py:30-50` — `get_summary()`

**Implementation steps:**
Option A (Redis cache — preferred if Redis available):
1. Cache dashboard response per user with 5-minute TTL
2. Invalidate on nutrition/training/bodyweight writes
3. Return cached response for subsequent requests

Option B (Single CTE query — no Redis dependency):
1. Combine nutrition summary, training summary, streak, bodyweight, and challenges into a single SQL CTE
2. Parse the combined result into the dashboard response shape

**Recommendation:** Option A if Redis is configured, Option B as fallback.

**Ripple effects:** Cached data may be up to 5 minutes stale. Pull-to-refresh should bypass cache.
**Regression risk:** LOW — same response shape, different fetch strategy.
**Testing:**
- Unit test: dashboard returns correct data
- Performance test: measure query count before/after (should drop from 5+ to 1)

---

### 2.3 Fix content module eager loading [H5]

**Root cause:** `lazy="selectin"` on `ContentModule.articles` and `ContentArticle.versions` triggers recursive loading of all articles and all their versions on every module query.

**Affected files:**
- `src/modules/content/models.py:42,80,83` — relationship definitions

**Implementation steps:**
1. Change `lazy="selectin"` to `lazy="raise"` on:
   - `ContentModule.articles`
   - `ContentArticle.versions`
   - `ContentArticle.favorites`
2. Update service methods to use explicit `.options(selectinload(...))` only when needed:
   - List endpoint: load articles only (no versions)
   - Detail endpoint: load article + versions

**Ripple effects:** Any code that accesses `.articles` or `.versions` without explicit loading will raise `LazyLoadError`. Grep for all access patterns.
**Regression risk:** MEDIUM — must update all callers.
**Testing:** Run existing content tests — any that access relationships without loading will fail (desired behavior).

---

### 2.4 Push dietary analysis aggregation to SQL [H6]

**Root cause:** `dietary_analysis/service.py:149-264` fetches all nutrition entries then aggregates in Python. For 100+ entries/day over 30 days, this is 3000+ rows in memory.

**Affected files:**
- `src/modules/dietary_analysis/service.py:149-264`

**Implementation steps:**
1. Replace Python-side aggregation with SQL:
   ```python
   stmt = (
       select(
           NutritionEntry.entry_date,
           func.sum(NutritionEntry.calories).label("total_calories"),
           func.avg(NutritionEntry.protein_g).label("avg_protein"),
           # ... other aggregations
       )
       .where(NutritionEntry.user_id == user_id, NutritionEntry.entry_date.between(start, end))
       .group_by(NutritionEntry.entry_date)
   )
   ```
2. Keep the gap analysis logic in Python (it's comparison logic, not aggregation)

**Ripple effects:** None — same response shape.
**Regression risk:** LOW — verify aggregation results match.
**Testing:** Compare output of old vs new implementation for a test user.

---

### 2.5 Fix blocking file I/O in async functions [H7]

**Root cause:** `open()` calls in async service methods block the event loop.

**Affected files:**
- `src/modules/food_database/global_seed_data.py:10`
- `src/modules/training/exercises.py:17`
- `src/modules/export/service.py:150,245`
- `src/modules/measurements/photo_service.py:67`

**Implementation steps:**
1. Add `aiofiles>=24.0.0` to `pyproject.toml`
2. Replace each `open()` with `aiofiles.open()`:
   ```python
   # Before
   with open(path) as f:
       data = json.load(f)
   # After
   async with aiofiles.open(path) as f:
       content = await f.read()
       data = json.loads(content)
   ```
3. For one-time reads (seed data, exercises.json), consider caching in module-level variable after first read

**Ripple effects:** Functions become async if they weren't already. Check all callers.
**Regression risk:** LOW — same behavior, non-blocking.
**Testing:** Existing tests should pass. Verify exercises load correctly.

---

### 2.6 Add Docker HEALTHCHECK instruction [H8]

**Root cause:** Container orchestrators can't detect unhealthy containers without HEALTHCHECK.

**Affected files:**
- `Dockerfile:38`

**Implementation steps:**
1. Add before CMD:
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
     CMD curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1
   ```
2. Ensure `curl` is available in the runtime image (it's in `python:3.12-slim`)

**Ripple effects:** None.
**Regression risk:** NONE
**Testing:** `docker build` + `docker run` → verify health check passes.


---

## Phase 3: Resilience & Observability

### 3.1 Implement exponential backoff on account lockout [H2]

**Root cause:** 15 guesses/day before lockout, no exponential backoff, no email notification.

**Affected files:**
- `src/middleware/rate_limiter.py:163-167` — lockout logic
- `src/modules/auth/service.py` — login failure handling

**Implementation steps:**
1. Track consecutive failures per account in rate limiter
2. Implement backoff windows: 1min after 3 failures, 5min after 5, 15min after 8, 1hr after 10
3. Send email notification after 5 consecutive failures ("Someone is trying to access your account")
4. Reset counter on successful login

**Ripple effects:** Legitimate users who forget passwords will be locked out faster. Ensure "forgot password" flow is clearly accessible.
**Regression risk:** LOW
**Testing:** Unit tests for each backoff tier. Integration test for email notification trigger.

---

### 3.2 Increase worker count and document scaling [H9]

**Affected files:**
- `railway.toml` — add `WEB_CONCURRENCY` recommendation
- `docs/DISASTER_RECOVERY.md` — add scaling section

**Implementation steps:**
1. Set `WEB_CONCURRENCY=2` in Railway env vars (not in code — runtime config)
2. Document in DR runbook: "For Neon free tier (100 connections), max workers = 100 / (pool_size + max_overflow) = 100/15 ≈ 6 workers"
3. Add Railway env var `DB_POOL_SIZE=3` and `DB_MAX_OVERFLOW=5` for 2-worker config (2 × 8 = 16 connections)

**Ripple effects:** More workers = more DB connections. Must stay within Neon limits.
**Regression risk:** LOW — monitor memory after change.
**Testing:** Deploy with 2 workers → verify health check passes → monitor for OOM.

---

### 3.3 Make E2E tests and npm audit blocking in CI [H10]

**Affected files:**
- `.github/workflows/ci-frontend.yml:82` — remove `|| true` from audit
- `.github/workflows/e2e.yml:10-11` — remove `continue-on-error` from login flow

**Implementation steps:**
1. Remove `|| true` from `npx audit-ci --high` — fix any current high-severity vulnerabilities first
2. In E2E workflow, keep `continue-on-error: true` on all flows EXCEPT login (the most stable)
3. Add `allow-list` to audit-ci for known false positives

**Ripple effects:** CI may start failing if there are current audit findings. Fix those first.
**Regression risk:** LOW — only affects CI, not runtime.
**Testing:** Trigger CI run → verify audit step runs and reports correctly.

---

### 3.4 Configure Sentry Performance alerts [H11]

**Affected files:**
- `src/main.py` — verify `traces_sample_rate` is set
- External: Sentry dashboard configuration

**Implementation steps:**
1. Verify `traces_sample_rate` is set (already done: `float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.5'))`)
2. In Sentry dashboard, create alerts:
   - Error rate > 10 events/minute → Slack notification
   - P95 transaction duration > 2s → Slack notification
   - New issue in production → email notification
3. Document alert configuration in DR runbook

**Ripple effects:** None — monitoring only.
**Regression risk:** NONE
**Testing:** Trigger a test error → verify alert fires.

---

### 3.5 Define RTO/RPO and test backup restore [H12]

**Affected files:**
- `docs/DISASTER_RECOVERY.md` — add RTO/RPO section

**Implementation steps:**
1. Define: RTO = 1 hour, RPO = 1 hour (Neon PITR granularity)
2. Document quarterly DR drill procedure:
   - Create Neon branch from 1 hour ago
   - Point a test instance at the branch
   - Verify data integrity (row counts, latest timestamps)
   - Delete the branch
3. Execute the first drill and document results
4. Add calendar reminder for quarterly drills

**Ripple effects:** None — documentation and process.
**Regression risk:** NONE
**Testing:** Execute the DR drill as described.

---

### 3.6 Add ErrorBoundary to all tab navigator screens [H14]

**Affected files:**
- `app/navigation/BottomTabNavigator.tsx` — wrap each tab screen
- `app/components/common/ErrorBoundary.tsx` — verify it exists (or create)

**Implementation steps:**
1. Verify `ErrorBoundary` component exists with Sentry reporting
2. Wrap each tab screen in the navigator:
   ```tsx
   <Tab.Screen name="Home">
     {() => <ErrorBoundary><DashboardStack /></ErrorBoundary>}
   </Tab.Screen>
   ```
3. Add a user-friendly fallback UI ("Something went wrong. Tap to retry.")

**Ripple effects:** Errors in one tab no longer crash the entire app.
**Regression risk:** NONE — additive.
**Testing:** Manually trigger an error in a screen → verify fallback UI shows, other tabs still work.

---

### 3.7 Add expired token blacklist cleanup job [L5]

**Affected files:**
- `src/config/scheduler.py` — add cleanup job
- `src/modules/auth/service.py` — add cleanup method

**Implementation steps:**
1. Add method: `async def cleanup_expired_blacklist(db): await db.execute(delete(TokenBlacklist).where(TokenBlacklist.expires_at < func.now()))`
2. Register as APScheduler job running daily at 3 AM UTC

**Ripple effects:** None — removes expired entries only.
**Regression risk:** NONE
**Testing:** Unit test: create expired entry → run cleanup → verify deleted.


---

## Phase 4: Frontend Hardening

### 4.1 Split food_database/service.py into focused services [C6]

**Root cause:** 1,023-line god file handling search, FTS, frequency, favorites, recipes, barcode, USDA.

**Affected files:**
- `src/modules/food_database/service.py` → split into:
  - `src/modules/food_database/search_service.py` — FTS, search, frequency ranking
  - `src/modules/food_database/recipe_service.py` — recipe CRUD, ingredients
  - `src/modules/food_database/favorites_service.py` — favorites, frequency tracking
  - `src/modules/food_database/service.py` — thin facade importing from above

**Implementation steps:**
1. Identify method groupings by reading the file
2. Extract each group into its own file with its own class
3. Keep `FoodDatabaseService` as a facade that delegates to sub-services
4. Update router imports (should only need to change the import path if facade is maintained)
5. Update any cross-module imports

**Ripple effects:** Any module importing specific methods from `food_database.service` needs updating. Grep for all imports.
**Regression risk:** MEDIUM — refactoring a 1K-line file. Run full test suite after.
**Testing:** All existing food_database tests must pass unchanged.

---

### 4.2 Decompose AddTrainingModal into sub-components [H13]

**Root cause:** 860-line component handling exercise search, set entry, template selection, and submission.

**Affected files:**
- `app/components/modals/AddTrainingModal.tsx` → extract:
  - `ExerciseSearchPanel.tsx`
  - `SetEntryForm.tsx`
  - `TemplateSelector.tsx`

**Implementation steps:**
1. Extract exercise search UI + logic into `ExerciseSearchPanel`
2. Extract set entry (reps, weight, RPE) into `SetEntryForm`
3. Extract template browsing into `TemplateSelector`
4. Parent modal manages state and passes callbacks

**Ripple effects:** None if props interface is clean.
**Regression risk:** LOW — visual refactor, same behavior.
**Testing:** Existing AddTrainingModal tests must pass. Manual visual verification.

---

### 4.3 Migrate onboarding store to Zustand persist [M1]

**Affected file:** `app/store/onboardingSlice.ts:108-115`
**Fix:** Replace manual AsyncStorage calls with Zustand `persist` middleware, matching the pattern of other persisted stores.
**Risk:** LOW | **Testing:** Manual onboarding flow test.

---

### 4.4 Type the `any` in useWorkoutSave [M3]

**Affected file:** `app/hooks/useWorkoutSave.ts:71`
**Fix:** Replace `(item: any)` with proper `TrainingSession` type.
**Risk:** NONE | **Testing:** TypeScript compilation.

---

### 4.5 Add memoization to CoachingScreen [M4]

**Affected file:** `app/screens/coaching/CoachingScreen.tsx`
**Fix:** Add `useCallback` for handlers passed to child components, `useMemo` for computed data.
**Risk:** LOW | **Testing:** Manual — verify coaching screen interactions.

---

### 4.6 Replace ScrollView+.map() with FlatList in ActiveWorkoutBody [M5]

**Affected file:** `app/screens/training/ActiveWorkoutBody.tsx:73,85`
**Fix:** Replace `<ScrollView>{exercises.map(...)}</ScrollView>` with `<FlatList data={exercises} renderItem={...} />`.
**Risk:** LOW | **Testing:** Manual — verify workout logging with 10+ exercises.

---

### 4.7 Move inline styles to StyleSheet.create() [M6]

**Affected files:** ~30 files with inline `style={{}}` objects.
**Fix:** Batch refactor — extract inline objects to `StyleSheet.create()` at bottom of each file.
**Risk:** NONE | **Testing:** Visual regression check on key screens.

---

### 4.8 Add offline indicator UI [M7]

**Affected files:**
- New: `app/components/common/OfflineBanner.tsx`
- `app/App.tsx` — render banner globally

**Fix:** Create a banner that shows when `onlineManager.isOnline()` returns false. Use NetInfo listener.
**Risk:** NONE | **Testing:** Toggle airplane mode → verify banner appears/disappears.

---

### 4.9 Wrap write operations in useMutation [M8]

**Affected files:** Multiple screens that use raw `api.post()` for writes.
**Fix:** Identify the 5 most critical write paths (log food, log workout, update profile, log bodyweight, coaching actions) and wrap in `useMutation` with `networkMode: 'offlineFirst'`.
**Risk:** LOW | **Testing:** Verify each write path works online and queues offline.

---

### 4.10 Create typed ApiError shape [M9]

**Affected files:**
- `app/services/api.ts` — add error interceptor
- New: `app/types/api.ts` — `ApiError` type

**Fix:** Create `interface ApiError { detail: string; code: string; status: number }`. Add axios response interceptor that normalizes errors.
**Risk:** LOW | **Testing:** Unit test error normalization.

---

### 4.11 Add ActiveWorkout migration logic [M2]

**Affected file:** `app/store/activeWorkoutSlice.ts:521-524`
**Fix:** Add proper field migration for v1→v2 when schema changes. Currently a no-op stub.
**Risk:** LOW | **Testing:** Unit test migration function with v1 data shape.

---

### 4.12 Fix useNavigation `any` in linking config [M3 related]

**Affected file:** `app/navigation/linking.ts`
**Fix:** Replace `LinkingOptions<any>` with `LinkingOptions<RootParamList>` using the project's param list types.
**Risk:** NONE | **Testing:** TypeScript compilation.


---

## Phase 5: Architecture & Schema Cleanup

### 5.1 Refactor sharing models to use Base class [M10]

**Affected file:** `src/modules/sharing/models.py:17-32`
**Root cause:** `ShareEvent` and `Referral` use legacy `Column()` with manual `id`/`created_at`, bypassing `Base` class.
**Fix:** Refactor to `Mapped[]/mapped_column()` pattern inheriting from `Base`. Create migration to add `updated_at` column.
**Risk:** MEDIUM — schema change on existing table. | **Testing:** Migration round-trip + existing sharing tests.

---

### 5.2 Separate data migrations from schema migrations [M11]

**Affected file:** `src/database/migrations/versions/j1a2b3c4d5e6_seed_push_notifications_flag.py`
**Fix:** Split into two migrations: schema change first, data seed second. Add `depends_on` to ensure ordering.
**Risk:** LOW | **Testing:** Migration round-trip.

---

### 5.3 Use ADD COLUMN IF NOT EXISTS for safer migrations [M12]

**Affected file:** `src/database/migrations/versions/h1a2b3c4d5e6_add_push_notification_columns.py`
**Fix:** Wrap column additions in try/except or use `IF NOT EXISTS` (PG 9.6+). Add `op.execute("SET lock_timeout = '5s'")` to prevent long locks.
**Risk:** LOW | **Testing:** Migration round-trip.

---

### 5.4 Reduce cross-module coupling in trial_service [M13]

**Affected file:** `src/modules/payments/trial_service.py:15-19`
**Fix:** Create `src/shared/activity_check.py` with `has_user_activity(user_id, db)` that each module registers into. Trial service calls the shared function instead of importing 4 modules.
**Risk:** MEDIUM — architectural change. | **Testing:** Existing trial tests must pass.

---

### 5.5 Move business logic out of routers [M14]

**Affected files:** `src/modules/food_database/router.py:68-80`, `src/modules/export/router.py:39-43`
**Fix:** Move SQL queries and `session.commit()` calls into service layer. Router should only call service methods and return responses.
**Risk:** LOW | **Testing:** Existing tests.

---

### 5.6 Add Pydantic response models to 15 endpoints [M15]

**Affected files:** 15 endpoints across adaptive, auth, dietary_analysis, feature_flags, food_database, notifications routers.
**Fix:** Create response models (e.g., `StatusResponse`, `MessageResponse`) and add `response_model=` to each endpoint decorator.
**Risk:** LOW — additive. | **Testing:** Verify OpenAPI docs show correct schemas.

---

### 5.7 Break long functions into smaller units [M16]

**Affected files:** `health_reports/service.py:33` (303L), `training/wns_volume_service.py:94` (260L), `payments/service.py:51` (250L)
**Fix:** Extract logical blocks into private helper methods. Target <50 lines per function.
**Risk:** LOW | **Testing:** Existing tests.

---

### 5.8 Add pagination to challenges and notifications [M17]

**Affected files:** `src/modules/challenges/router.py:40`, `src/modules/notifications/router.py`
**Fix:** Add `PaginatedResult` wrapper using existing pagination infrastructure.
**Risk:** LOW — API change (adds `items`, `total`, `page` fields). | **Testing:** Verify pagination works.

---

### 5.9 Move seed_data.py to data directory [M18]

**Affected file:** `src/modules/food_database/seed_data.py` (4,312 lines)
**Fix:** Move to `data/food_seed.json` or a database migration. Refactor `_build_serving_options` (1,340 lines) into a data-driven lookup table.
**Risk:** MEDIUM — changes import paths. | **Testing:** Verify seed data loads correctly.

---

### 5.10 Upgrade SameSite to Strict + add CSRF double-submit [M19]

**Affected file:** `src/modules/auth/router.py:55-70`
**Fix:** Change `samesite="lax"` to `samesite="strict"` for access token cookie. Add double-submit cookie CSRF pattern for web clients.
**Risk:** MEDIUM — may break cross-origin flows. | **Testing:** Manual web login flow.

---

### 5.11 Add privacy toggle for shared workout display names [M20]

**Affected files:** `src/modules/sharing/router.py:30-45`, `src/modules/user/models.py`
**Fix:** Add `show_name_on_shares: bool = False` to user profile. Default to anonymous on shared pages.
**Risk:** LOW | **Testing:** Share a workout → verify anonymous by default.

---

### 5.12 Pin dependency version ranges [M23]

**Affected file:** `pyproject.toml`
**Fix:** Change `>=` to compatible ranges: `fastapi>=0.115.0,<1.0.0`, `sqlalchemy>=2.0.0,<3.0.0`, etc.
**Risk:** NONE | **Testing:** `pip install -e .` succeeds.

---

### 5.13 Document Redis as required in production [M24]

**Affected files:** `src/middleware/rate_limiter.py`, `docs/DISASTER_RECOVERY.md`
**Fix:** Add startup check: if `ENVIRONMENT=production` and Redis unavailable, log a WARNING (not crash — graceful degradation is better than hard failure). Document in DR runbook.
**Risk:** NONE | **Testing:** Start app without Redis → verify warning logged.

---

### 5.14 Add pytest-xdist for parallel test execution [M25]

**Affected files:** `pyproject.toml` (dev deps), CI workflow
**Fix:** Add `pytest-xdist` to dev dependencies. Update CI: `pytest -n auto --dist loadfile`.
**Risk:** LOW — tests must be isolated. | **Testing:** Run `pytest -n 4` locally → verify all pass.


---

## Phase 6: Test Gaps & Polish

### 6.1 Add load tests with locust [C7]

**Root cause:** Zero performance tests. No data on concurrent user behavior.

**Affected files:**
- New: `loadtests/locustfile.py`
- New: `loadtests/README.md`

**Implementation steps:**
1. Add `locust` to dev dependencies
2. Create locustfile with user flows:
   - Login → dashboard → log food → log workout (weighted 60%)
   - Login → analytics (weighted 20%)
   - Login → profile → export (weighted 10%)
   - Registration (weighted 10%)
3. Configure: 50 users, 5 users/sec spawn rate, 5-minute run
4. Document baseline metrics: P50, P95, P99 latency, error rate
5. Add to CI as weekly scheduled job (non-blocking)

**Risk:** NONE — test-only. | **Testing:** Run locally against dev server.

---

### 6.2 Add frontend screen tests for 5 critical screens [H15]

**Affected files:** New test files in `app/__tests__/screens/`

**Implementation steps:**
1. `LoginScreen.test.tsx` — render, input validation, submit, error display
2. `DashboardScreen.test.tsx` — render with mock data, quick actions, pull-to-refresh
3. `LogsScreen.test.tsx` — tab switching, entry display, swipe-to-delete
4. `ActiveWorkoutScreen.test.tsx` — add exercise, log set, finish workout
5. `OnboardingWizard.test.tsx` — step navigation, form validation, completion

**Risk:** NONE — test-only. | **Testing:** `npx jest --passWithNoTests`.

---

### 6.3 Fix timing-based flaky test [M21]

**Affected file:** `tests/test_auth_security.py:L50`
**Fix:** Replace `time.perf_counter()` comparison with `freezegun` or increase tolerance to 500ms.
**Risk:** NONE | **Testing:** Run test 100 times → verify no flakes.

---

### 6.4 Add chaos/resilience tests [M22]

**Affected files:** New: `tests/test_resilience.py`
**Fix:** Test behavior when DB is down (mock connection failure), Redis is down (verify fallback), and API timeout (mock slow response).
**Risk:** NONE — test-only. | **Testing:** Run tests.

---

### 6.5 Remove dev.db and backend.log from git [L1, L2]

**Fix:** `git rm --cached dev.db backend.log`, add `*.db` and `*.log` to `.gitignore`.
**Risk:** NONE | **Testing:** Verify files no longer tracked.

---

### 6.6 Add startup warning for DEBUG=true in production [L3]

**Affected file:** `src/main.py`
**Fix:** Add `if settings.DEBUG and settings.ENVIRONMENT == "production": logger.warning("DEBUG=true in production!")`.
**Risk:** NONE | **Testing:** Unit test.

---

### 6.7 Add token blacklist cleanup job [L5]

Already covered in Phase 3 (3.7).

---

### 6.8 Add index on ExportRequest.status [L6]

**Affected file:** `src/modules/export/models.py:22`
**Fix:** Add `index=True` to status column.
**Risk:** NONE | **Testing:** Migration round-trip.

---

### 6.9 Remove BarcodeCache timestamp overrides [L7]

**Affected file:** `src/modules/food_database/models.py:130-136`
**Fix:** Remove manual `created_at`/`updated_at` defaults. Let `Base` handle them.
**Risk:** LOW | **Testing:** Verify barcode cache still works.

---

### 6.10 Change ProgressPhoto JSON to JSONB [L8]

**Affected file:** `src/modules/progress_photos/models.py:36`
**Fix:** Change `JSON` to `JSONB`. Create migration.
**Risk:** LOW | **Testing:** Migration round-trip.

---

### 6.11 Add Cache-Control headers for read-heavy endpoints [L9]

**Affected files:** `src/modules/training/router.py` (exercise search), `src/modules/content/router.py` (articles)
**Fix:** Add `Cache-Control: public, max-age=300` to read-only endpoints.
**Risk:** NONE | **Testing:** Verify header in response.

---

### 6.12 Add structured JSON logging [L10]

**Affected file:** `src/config/logging_config.py`
**Fix:** Use `python-json-logger` with fields: timestamp, level, request_id, user_id, module.
**Risk:** LOW — log format change. | **Testing:** Verify logs parse as JSON.

---

### 6.13 Add freezegun to time-dependent tests [L11]

**Affected files:** Trial, subscription, and streak tests.
**Fix:** Add `@freeze_time("2026-04-05")` to tests that depend on current date.
**Risk:** NONE | **Testing:** Run affected tests.

---

### 6.14 Add --durations=20 to CI pytest [L12]

**Affected file:** `.github/workflows/ci.yml`
**Fix:** Add `--durations=20` to pytest command.
**Risk:** NONE | **Testing:** Verify CI output shows slowest tests.

---

### 6.15 Expand N+1 query tests [L13]

**Affected file:** `tests/test_n_plus_one.py`
**Fix:** Add query count assertions for: feed, content list, coaching list, notifications.
**Risk:** NONE | **Testing:** Run tests.

---

### 6.16 Add USDA_API_KEY production validator [L14]

**Affected file:** `src/config/settings.py`
**Fix:** Add validator: if `ENVIRONMENT=production` and `USDA_API_KEY=DEMO_KEY`, log warning.
**Risk:** NONE | **Testing:** Unit test.

---

### 6.17 Add aiofiles to dependencies [L15]

**Affected file:** `pyproject.toml`
**Fix:** Add `aiofiles>=24.0.0`. (Needed for Phase 2 task 2.5.)
**Risk:** NONE | **Testing:** `pip install -e .` succeeds.

---

### 6.18 Add X-Request-ID tracing middleware [L16]

**Affected files:**
- New: `src/middleware/request_id.py`
- `src/main.py` — register middleware

**Fix:** Generate UUID per request, add to response headers, include in all log entries.
**Risk:** LOW | **Testing:** Verify header in response, verify ID in logs.

---

### 6.19 Enable CAPTCHA on registration [L4]

**Affected files:** `src/config/settings.py`, `src/modules/auth/router.py`
**Fix:** Set `REQUIRE_CAPTCHA=true` in production. Integrate hCaptcha or Cloudflare Turnstile.
**Risk:** MEDIUM — requires frontend changes. | **Testing:** Manual registration flow.

---

## Dependency Graph

```
Phase 1 (Secrets & Blockers) ──→ Phase 2 (Data Integrity)
                               ──→ Phase 5 (Architecture)
                               ──→ Phase 6 (Tests & Polish)

Phase 3 (Resilience) ──────────→ Phase 6 (Tests & Polish)

Phase 4 (Frontend) ────────────→ (independent, can run in parallel with Phase 2-3)
```

Key chains:
- Phase 1 → Phase 2: Secrets must be rotated before any deployment
- Phase 1 → Phase 6: Load tests need a stable baseline (post-secret-rotation)
- Phase 2 → Phase 5: Schema changes (optimistic locking) must land before architecture refactors
- Phase 3 → Phase 6: Observability must be in place before chaos tests

---

## Risk Matrix

| Task | Regression Risk | Shared Code | Needs Migration | Breaking API Change |
|------|----------------|-------------|-----------------|---------------------|
| 1.1 Rotate secrets | HIGH | All services | No | No |
| 1.2 FK on PaymentTransaction | MEDIUM | Payments | Yes | No |
| 1.4 Auth persistence | MEDIUM | Auth flow | No | No |
| 2.1 Optimistic locking | MEDIUM | Training + Payments | Yes | Yes (409 responses) |
| 2.3 Eager loading fix | MEDIUM | Content module | No | No |
| 4.1 Split god file | MEDIUM | Food database | No | No |
| 5.1 Sharing model refactor | MEDIUM | Sharing | Yes | No |
| 5.10 SameSite Strict | MEDIUM | Web auth | No | No |

---

## Verification Checklist (after all phases)

- [ ] All rotated keys work (Sentry, Neon, PostHog, RevenueCat)
- [ ] `git log -p --all -S 'phc_'` returns no real keys in HEAD
- [ ] Backend tests pass: `pytest tests/ -v --timeout=120`
- [ ] Frontend tests pass: `cd app && npx jest`
- [ ] TypeScript clean: `cd app && npx tsc --noEmit`
- [ ] Linting clean: `ruff check src/`
- [ ] Migration round-trip: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`
- [ ] Docker build succeeds: `docker build -t repwise-test .`
- [ ] Health check passes within 30s of container start
- [ ] Load test baseline documented (P50, P95, P99)
- [ ] Sentry alerts configured and tested
- [ ] DR drill completed and documented
- [ ] Manual smoke test: register → login → log food → log workout → analytics → export → logout

---

## Finding Cross-Reference

| Finding ID | Phase.Task | Severity |
|-----------|-----------|----------|
| C1 | 1.1 | 🔴 CRITICAL |
| C2 | 1.2 | 🔴 CRITICAL |
| C3 | 1.3 | 🔴 CRITICAL |
| C4 | 2.1 | 🔴 CRITICAL |
| C5 | 1.4 | 🔴 CRITICAL |
| C6 | 4.1 | 🔴 CRITICAL |
| C7 | 6.1 | 🔴 CRITICAL |
| H1 | Documented risk (no code change) | 🟠 HIGH |
| H2 | 3.1 | 🟠 HIGH |
| H3 | 1.5 | 🟠 HIGH |
| H4 | 2.2 | 🟠 HIGH |
| H5 | 2.3 | 🟠 HIGH |
| H6 | 2.4 | 🟠 HIGH |
| H7 | 2.5 | 🟠 HIGH |
| H8 | 2.6 | 🟠 HIGH |
| H9 | 3.2 | 🟠 HIGH |
| H10 | 3.3 | 🟠 HIGH |
| H11 | 3.4 | 🟠 HIGH |
| H12 | 3.5 | 🟠 HIGH |
| H13 | 4.2 | 🟠 HIGH |
| H14 | 3.6 | 🟠 HIGH |
| H15 | 6.2 | 🟠 HIGH |
| M1 | 4.3 | 🟡 MEDIUM |
| M2 | 4.11 | 🟡 MEDIUM |
| M3 | 4.4 | 🟡 MEDIUM |
| M4 | 4.5 | 🟡 MEDIUM |
| M5 | 4.6 | 🟡 MEDIUM |
| M6 | 4.7 | 🟡 MEDIUM |
| M7 | 4.8 | 🟡 MEDIUM |
| M8 | 4.9 | 🟡 MEDIUM |
| M9 | 4.10 | 🟡 MEDIUM |
| M10 | 5.1 | 🟡 MEDIUM |
| M11 | 5.2 | 🟡 MEDIUM |
| M12 | 5.3 | 🟡 MEDIUM |
| M13 | 5.4 | 🟡 MEDIUM |
| M14 | 5.5 | 🟡 MEDIUM |
| M15 | 5.6 | 🟡 MEDIUM |
| M16 | 5.7 | 🟡 MEDIUM |
| M17 | 5.8 | 🟡 MEDIUM |
| M18 | 5.9 | 🟡 MEDIUM |
| M19 | 5.10 | 🟡 MEDIUM |
| M20 | 5.11 | 🟡 MEDIUM |
| M21 | 6.3 | 🟡 MEDIUM |
| M22 | 6.4 | 🟡 MEDIUM |
| M23 | 5.12 | 🟡 MEDIUM |
| M24 | 5.13 | 🟡 MEDIUM |
| M25 | 5.14 | 🟡 MEDIUM |
| L1 | 6.5 | 🔵 LOW |
| L2 | 6.5 | 🔵 LOW |
| L3 | 6.6 | 🔵 LOW |
| L4 | 6.19 | 🔵 LOW |
| L5 | 3.7 | 🔵 LOW |
| L6 | 6.8 | 🔵 LOW |
| L7 | 6.9 | 🔵 LOW |
| L8 | 6.10 | 🔵 LOW |
| L9 | 6.11 | 🔵 LOW |
| L10 | 6.12 | 🔵 LOW |
| L11 | 6.13 | 🔵 LOW |
| L12 | 6.14 | 🔵 LOW |
| L13 | 6.15 | 🔵 LOW |
| L14 | 6.16 | 🔵 LOW |
| L15 | 6.17 | 🔵 LOW |
| L16 | 6.18 | 🔵 LOW |

**All 63 findings mapped. Zero skipped.**


---

## PLAN AMENDMENTS (Post-Validation Review)

The following amendments address gaps found during cross-validation, regression risk analysis, and a fresh codebase scan. These are corrections to the plan above — not new findings.

---

### Amendment A: Task 1.1 (Rotate Secrets) — Add missing steps

**Gaps found:**
1. Mobile app has PostHog key and Sentry DSN baked into `app/eas.json` — rotating these keys requires a new EAS build + App Store submission
2. GitHub CI secrets (`EXPO_TOKEN`, `RAILWAY_TOKEN`) need updating if rotated
3. No rollback plan if a rotated key doesn't work
4. No ordering specified for key rotation

**Add to implementation steps:**
- Step 0: **Order of rotation** — rotate non-critical first (Sentry, PostHog), then payment-critical (RevenueCat), then infrastructure (Neon)
- Step 7 (new): Update GitHub repo secrets if any CI-used keys were rotated
- Step 8 (new): Trigger new EAS build with updated `eas.json` keys → submit to TestFlight
- Step 9 (new): **Rollback plan** — keep old keys active for 48 hours after rotation. Only deactivate old keys after confirming new keys work in all environments.

**Risk change:** Remains HIGH but now mitigated.

---

### Amendment B: Task 1.4 (Auth Persistence) — Fix dual-persistence conflict

**Gap found:** Auth tokens are ALREADY persisted via `secureStorage.ts` in `LoginScreen.tsx`, `RegisterScreen.tsx`, and `App.tsx:78-79`. Adding Zustand `persist` creates a duplicate persistence mechanism with race conditions on startup.

**Replace implementation steps with:**
1. **Do NOT add Zustand persist for tokens.** Tokens are already correctly persisted via SecureStore.
2. Instead, persist the **non-sensitive user profile data** (user object, subscription state, unitSystem, goals) via Zustand persist with MMKV storage (not SecureStore — this data isn't sensitive).
3. Keep the existing SecureStore token flow in `App.tsx` as the source of truth for auth.
4. Add `onRehydrateStorage` to validate that persisted user profile matches the token's user_id (stale profile detection).

**Risk change:** Drops from MEDIUM to LOW — no longer touching the auth token flow.

---

### Amendment C: Task 2.1 (Optimistic Locking) — Fix webhook incompatibility

**Gap found:** RevenueCat webhooks can't pass a `version` parameter because they don't know the DB version. The plan's `WHERE version = :expected` approach will cause webhook processing to silently fail (rowcount=0) when two webhooks race.

**Replace implementation for Subscription with:**
1. **Use `SELECT ... FOR UPDATE` instead of optimistic locking for Subscription:**
   ```python
   stmt = select(Subscription).where(
       Subscription.id == sub_id
   ).with_for_update()
   ```
   This pessimistic lock is appropriate for webhooks (low contention, critical correctness).
2. **Keep optimistic locking (version column) for TrainingSession** — frontend can pass version.

**Additional steps for TrainingSession:**
3. Add `version` field to `ActiveWorkoutPayload` type in `app/types/training.ts`
4. Send `version` in `useWorkoutSave.ts` PUT request
5. Handle 409 response in frontend — show "Session was updated elsewhere, please refresh"
6. Also add version check to `soft_delete_session()` (missed in original plan)

**Risk change:** Remains HIGH but now technically correct.

---

### Amendment D: Task 2.3 (Eager Loading Fix) — Don't touch .module relationship

**Gap found:** The router's `_article_to_response()` accesses `article.module.name` on every response. Changing `ContentArticle.module` to `lazy="raise"` would break ALL 8 content endpoints.

**Replace implementation steps with:**
1. Change `ContentModule.articles` from `lazy="selectin"` to `lazy="raise"` — this is the N+1 source
2. Change `ContentArticle.versions` from `lazy="selectin"` to `lazy="raise"` — versions shouldn't load on list
3. **KEEP `ContentArticle.module` as `lazy="selectin"`** — it's a single-object load (not N+1) and is accessed by every response
4. Update these service methods to add explicit `selectinload`:
   - `get_articles()` — add `.options(selectinload(ContentArticle.module))` (already loaded, but be explicit)
   - `get_article()` — add `.options(selectinload(ContentArticle.versions), selectinload(ContentArticle.module))`
   - `get_module_articles()` — add `.options(selectinload(ContentArticle.module))`

**Risk change:** Drops from HIGH to MEDIUM — the most dangerous relationship (.module) is left alone.

---

### Amendment E: Task 5.10 (SameSite Strict) — Downgrade to documentation-only

**Gap found:** SameSite=Strict breaks OAuth redirect flows (Google/Apple redirect back to app won't carry cookies) and all cross-origin web client auth. The current SameSite=Lax already prevents CSRF on POST/PUT/DELETE requests.

**Replace implementation with:**
1. **KEEP SameSite=Lax** (current setting) — it's the correct choice for an app with OAuth redirects
2. **Document the CSRF posture** in a security doc: "SameSite=Lax prevents CSRF on state-changing requests (POST/PUT/DELETE). GET endpoints have no side effects. No additional CSRF token needed."
3. **Add a code comment** in `auth/router.py` explaining why Lax is used instead of Strict
4. Remove the CSRF double-submit cookie from the plan — it's unnecessary with Lax + no side-effect GETs

**Risk change:** Drops from HIGH to NONE — no code change, documentation only.

---

### Amendment F: NEW — Fix 5 unhandled promise rejections [Fresh scan finding]

**Not in original audit.** Found during fresh codebase scan.

**Root cause:** 5 `.then()` chains in React Native code have no `.catch()` handler. Unhandled promise rejections are warnings now but will become fatal errors in future RN versions.

**Affected files:**
1. `app/screens/dashboard/DashboardScreen.tsx:103,106` — `AsyncStorage.getItem().then()`
2. `app/screens/dashboard/DashboardScreen.tsx:121` — `fetchInsights().then(setTrialInsights)`
3. `app/components/premium/UpgradeModal.tsx:55` — `getOfferings().then()`
4. `app/components/nutrition/BarcodeScanner.tsx:74` — `requestPermission().then()`
5. `app/components/nutrition/FoodSearchPanel.tsx:60` — `secureGet().then()`

**Fix:** Add `.catch(() => {})` to each chain, or convert to `async/await` with try/catch.

**Phase:** Add to Phase 4 as task 4.13.
**Risk:** NONE
**Testing:** Verify no console warnings for unhandled rejections.

---

### Amendment G: Task 1.2 (FK on PaymentTransaction) — Downgrade priority

**Finding:** `PaymentTransaction` is defined in models but **never instantiated anywhere in the codebase**. The table is likely empty. The FK constraint is still correct to add (prevents future bugs), but this is LOW priority, not CRITICAL.

**Change:** Move from Phase 1 to Phase 5. Severity downgrade: CRITICAL → LOW.

---

### Summary of Amendments

| Amendment | Task | Change | Risk Impact |
|-----------|------|--------|-------------|
| A | 1.1 Rotate secrets | Add mobile rebuild, CI secrets, rollback plan, ordering | HIGH → HIGH (mitigated) |
| B | 1.4 Auth persistence | Don't persist tokens (already done); persist profile via MMKV | MEDIUM → LOW |
| C | 2.1 Optimistic locking | Use SELECT FOR UPDATE for Subscription; keep version for TrainingSession | HIGH → HIGH (correct) |
| D | 2.3 Eager loading | Keep .module as selectin; only change .articles and .versions | HIGH → MEDIUM |
| E | 5.10 SameSite | Keep Lax; document CSRF posture; remove double-submit | HIGH → NONE |
| F | NEW 4.13 | Fix 5 unhandled promise rejections | NEW MEDIUM |
| G | 1.2 FK PaymentTransaction | Move to Phase 5; downgrade to LOW | CRITICAL → LOW |


---

## FINAL PRE-LAUNCH ADDENDUM (Last Audit Pass)

This section captures findings from the absolute final audit pass — edge cases, launch blockers, and error paths that were not in the original 63 findings or the 7 amendments.

---

### NEW FINDINGS — Edge Cases & Bugs

#### F1. 🔴 FREE TRIAL EXPIRY NOT ENFORCED SERVER-SIDE [HIGH]
**File:** `src/modules/payments/service.py`, `src/middleware/freemium_gate.py`
**Root cause:** `trial_ends_at` field exists on the user model but NO middleware or service checks it against current time. Trial expiry is only enforced client-side via RevenueCat SDK. If client cache is stale, user retains premium access after trial ends.
**Fix:** In `freemium_gate.py`, add check: if subscription status is `trialing` and `trial_ends_at < now()`, treat as expired. Call RevenueCat to verify if uncertain.
**Phase:** Add to Phase 1 (launch blocker).
**Risk:** LOW — additive check.
**Testing:** Unit test: trial_ends_at in past → premium denied.

#### F2. 🟡 NUTRITION ALLOWS FUTURE DATES [MEDIUM]
**File:** `src/modules/nutrition/schemas.py` — `NutritionEntryCreate`
**Root cause:** Training schemas have `no_future_dates` validator but nutrition schemas don't. Users can log food for future dates, breaking daily totals and analytics.
**Fix:** Add `@field_validator('entry_date')` that rejects dates > today.
**Phase:** Add to Phase 4.
**Risk:** NONE
**Testing:** Unit test: future date → 422.

#### F3. 🟡 NEGATIVE WORKOUT DURATION ACCEPTED [MEDIUM]
**File:** `src/modules/training/schemas.py` — `TrainingSessionCreate`
**Root cause:** `start_time` and `end_time` are Optional[datetime] with no cross-field validation. `end_time < start_time` is accepted.
**Fix:** Add `@model_validator(mode='after')` that checks `end_time >= start_time` when both are provided.
**Phase:** Add to Phase 4.
**Risk:** NONE
**Testing:** Unit test: end < start → 422.

#### F4. 🟡 MMKV PERSISTER HAS NO ERROR BOUNDARY [MEDIUM]
**File:** `app/services/queryClient.ts` (or wherever MMKV persister is configured)
**Root cause:** If MMKV storage is corrupted, `mmkv.getString(key)` may throw during cache hydration, crashing the app on startup.
**Fix:** Wrap MMKV operations in try/catch. On corruption, clear MMKV and start fresh.
**Phase:** Add to Phase 4.
**Risk:** LOW
**Testing:** Manual: corrupt MMKV data → app should recover gracefully.

#### F5. 🟡 STREAK CALCULATION DOESN'T ANCHOR TO TODAY [MEDIUM]
**File:** `src/modules/training/service.py` (streak calculation)
**Root cause:** Streak counts consecutive past dates but doesn't verify the chain connects to today or yesterday. A user who worked out Mon-Fri but not Sat would still show streak=5 on Sunday.
**Fix:** After counting consecutive dates, verify the most recent date is today or yesterday. If not, streak = 0.
**Phase:** Add to Phase 4.
**Risk:** LOW — changes displayed streak value.
**Testing:** Unit test: last workout 2 days ago → streak = 0.

#### F6. 🟡 5 UNHANDLED PROMISE REJECTIONS [MEDIUM]
Already captured in Amendment F. Confirmed in this pass.

#### F7. 🟡 OAUTH USER HITS PASSWORD RESET — CONFUSING ERROR [MEDIUM]
**File:** `src/modules/auth/service.py`
**Root cause:** OAuth users have `hashed_password=None`. If they use the forgot-password flow, `_get_user_by_email` succeeds but the reset code is generated for an account that can't use passwords. User gets a reset email, enters new password, and gets a confusing error.
**Fix:** In `forgot_password`, check if user has `hashed_password`. If None, return a message: "This account uses Google/Apple Sign-In. Please use that to log in."
**Phase:** Add to Phase 4.
**Risk:** NONE
**Testing:** Unit test: OAuth user → forgot password → helpful message.

#### F8. 🟡 SUBSCRIPTION DOWNGRADE — NO PERIOD-END ENFORCEMENT [MEDIUM]
**File:** `src/modules/payments/service.py`
**Root cause:** When subscription status transitions to CANCELLED, there's no `current_period_end` check. User may lose premium access immediately rather than at the end of their paid period.
**Fix:** In `freemium_gate.py`, if status is CANCELLED but `current_period_end > now()`, still grant premium access.
**Phase:** Add to Phase 2.
**Risk:** LOW
**Testing:** Unit test: cancelled but period not ended → premium still active.

---

### NEW FINDINGS — Launch Blockers (Infrastructure)

#### F9. ❌ 6 RAILWAY ENV VARS ARE PLACEHOLDERS [BLOCKING]
**Source:** Launch readiness checklist
**Details:** These env vars have placeholder values and MUST be set with real values before launch:
1. `AWS_ACCESS_KEY_ID` — needed for SES email (verification, password reset)
2. `AWS_SECRET_ACCESS_KEY` — same
3. `R2_ACCESS_KEY` — needed for progress photo uploads
4. `R2_SECRET_KEY` — same
5. `R2_ENDPOINT_URL` — same
6. `REVENUECAT_WEBHOOK_AUTH_KEY` — needed for subscription webhooks

**Fix:** Set real values in Railway dashboard. For AWS: create IAM user with SES-only permissions. For R2: create Cloudflare R2 bucket + API token. For RevenueCat: copy webhook auth key from RevenueCat dashboard.
**Phase:** Phase 1 (pre-launch infrastructure).

#### F10. ⚠️ REDIS NOT CONFIGURED [WARNING]
**Details:** `REDIS_URL` is empty. Rate limiting falls back to in-memory (per-process, not shared across workers). With 2+ workers, rate limits are effectively doubled.
**Fix:** Add Railway Redis plugin. Set `REDIS_URL` env var.
**Phase:** Phase 1.

#### F11. ⚠️ DNS NOT VERIFIED [WARNING]
**Details:** `api.repwise.app` is referenced in `eas.json` production config but DNS configuration can't be verified from codebase. Must be a CNAME to Railway.
**Fix:** Verify in Cloudflare DNS dashboard. Add CNAME record if missing.
**Phase:** Phase 1.

---

### NEW FINDINGS — Error Path Improvements

#### F12. 🟡 NO GLOBAL IntegrityError HANDLER [MEDIUM]
**File:** `src/main.py`
**Root cause:** SQLAlchemy `IntegrityError` (unique constraint violations, FK violations) bubble up as generic 500 errors. Should return 409 Conflict.
**Fix:** Add exception handler: `@app.exception_handler(IntegrityError)` → return 409 with "Resource conflict" message.
**Phase:** Add to Phase 3.
**Risk:** LOW
**Testing:** Trigger a unique constraint violation → verify 409 response.

#### F13. 🟡 NO STARTUP DB CONNECTIVITY CHECK [MEDIUM]
**File:** `src/main.py` (lifespan function)
**Root cause:** App starts accepting requests before confirming DB is reachable. First user request gets a 500 if DB is down.
**Fix:** In lifespan, add `SELECT 1` check before `yield`. If it fails, log error and exit.
**Phase:** Add to Phase 3.
**Risk:** NONE
**Testing:** Start app with wrong DATABASE_URL → verify clear error message.

---

### UPDATED FINDING COUNT

| Category | Original | Amendments | This Pass | Total |
|----------|----------|------------|-----------|-------|
| CRITICAL | 7 | 0 | 1 (F1) | 8 |
| HIGH | 15 | 0 | 0 | 15 |
| MEDIUM | 25 | 1 (F6) | 7 (F2-F5, F7-F8, F12-F13) | 33 |
| LOW | 16 | 0 | 0 | 16 |
| BLOCKING (infra) | 0 | 0 | 3 (F9-F11) | 3 |
| **TOTAL** | **63** | **1** | **11** | **75** |

---

### UPDATED PHASE ASSIGNMENTS

| New Finding | Assigned Phase | Task # |
|-------------|---------------|--------|
| F1 (trial expiry) | Phase 1 | 1.6 |
| F2 (future dates) | Phase 4 | 4.14 |
| F3 (negative duration) | Phase 4 | 4.15 |
| F4 (MMKV error boundary) | Phase 4 | 4.16 |
| F5 (streak anchor) | Phase 4 | 4.17 |
| F6 (promise rejections) | Phase 4 | 4.13 (Amendment F) |
| F7 (OAuth password reset) | Phase 4 | 4.18 |
| F8 (subscription period-end) | Phase 2 | 2.7 |
| F9 (env vars) | Phase 1 | 1.7 (infrastructure) |
| F10 (Redis) | Phase 1 | 1.8 (infrastructure) |
| F11 (DNS) | Phase 1 | 1.9 (infrastructure) |
| F12 (IntegrityError handler) | Phase 3 | 3.8 |
| F13 (startup DB check) | Phase 3 | 3.9 |
