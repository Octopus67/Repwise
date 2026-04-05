# Repwise Audit Fix Plan

**Generated:** April 5, 2026
**Source:** Production Readiness Audit (90 findings)
**Estimated Total Effort:** 19–20 days (152–160 hours)

---

## Plan Overview

| Phase | Severity | Items | Est. Hours | Dependencies |
|-------|----------|-------|------------|--------------|
| 1: Critical Data Integrity & Security | 🔴 CRITICAL | 8 (#1-#7, #23, #43) | 22-24h | None |
| 2: High-Priority Auth & Security | 🟠 HIGH | 5 (#8, #10-#13) | 14-16h | Phase 1 |
| 3: High-Priority CI/CD & Deployment | 🟠 HIGH | 7 (#14-#18, #24, #59) | 10h | None |
| 4: High-Priority Performance & Frontend | 🟠 HIGH | 5 (#9, #20-#22, #25) | 8h | None |
| 5: High-Priority Test Gaps | 🟠 HIGH | 4 (#26-#28, #19) | 28-32h | Phase 1-2 |
| 6: Medium Input Validation & Security | 🟡 MEDIUM | 11 (#30, #34-#40, #46, #56, #70) | 10h | Phase 2 |
| 7: Medium Performance & Frontend | 🟡 MEDIUM | 10 (#29, #49-#55, #57-#58, #60) | 12h | None |
| 8: Medium Database & Schema | 🟡 MEDIUM | 8 (#31-#33, #44-#45, #47-#48, #68-#69) | 12h | Phase 1 |
| 9: Medium Test Gaps | 🟡 MEDIUM | 7 (#63-#67, #41-#42) | 12h | Phase 4-5 |
| 10: Low-Priority Polish | 🟢 LOW | 22 (#71-#90, #61-#62) | 24-28h | None |
| **Total** | | **90** | **152-160h** | |

---

## Phase 1: Critical Data Integrity & Security (MUST fix before launch)

### 1.0 CI Deploy Gate — Actually Verify CI Status

**Audit Finding:** #5 from CRITICAL
**Root Cause:** The `ci-gate` job in `deploy.yml` was a placeholder that was never implemented. It runs `echo "CI checks passed"` without checking anything. If GitHub branch protection is misconfigured or bypassed (admin merge), broken code deploys. **This is the very first task because every subsequent fix deploys through this broken gate.**

**Affected Files:**
- `.github/workflows/deploy.yml:20-25` — `ci-gate` job

**Implementation Steps:**
1. Replace the echo step with `actions/github-script` that polls the GitHub API for CI check status on the current commit
2. Alternatively, change `deploy.yml` trigger from `push` to `workflow_run` that triggers after `ci.yml` completes successfully
3. Add a timeout of 10 minutes for CI completion

**Ripple Effects:** Deploys will be blocked until CI passes. This is the desired behavior. May slow down deploy by a few minutes.
**Regression Risk:** LOW — worst case, deploys are delayed. No code changes.
**Testing:**
- [ ] Push a commit with failing tests → verify deploy does NOT trigger
- [ ] Push a commit with passing tests → verify deploy triggers after CI completes

---

### 1.1 Cross-User Data Leak — Cache & Store Cleanup on Logout

**Audit Finding:** #1 and #2 from CRITICAL
**Root Cause:** The logout handler in `AccountSection.tsx` was written before TanStack Query migration. It clears JWT tokens via `secureClear()` and Zustand auth state via `store.clearAuth()`, but the TanStack Query cache (persisted to MMKV) and auxiliary Zustand stores (persisted to AsyncStorage) were added later and never wired into the logout flow. The next user who logs in on the same device sees the previous user's cached nutrition entries, training sessions, active workout, and analytics data.

**Affected Files:**
- `app/components/profile/AccountSection.tsx:48-52` — logout handler
- `app/store/activeWorkoutSlice.ts:519` — persisted workout state
- `app/store/tooltipStore.ts:38` — persisted tooltip state
- `app/store/workoutPreferencesStore.ts:51` — persisted preferences
- `app/store/onboardingSlice.ts:124` — persisted onboarding state
- `app/services/` — TanStack Query client config (for `queryClient` import)

**Implementation Steps:**
1. In `AccountSection.tsx`, import `queryClient` from TanStack Query config
2. Add `queryClient.clear()` call in the logout handler `finally` block after `store.clearAuth()`
3. Add `useActiveWorkoutStore.getState().discardWorkout()` call in the same block
4. Add `useTooltipStore.getState().reset()` (or equivalent reset action) call
5. Add `useWorkoutPreferencesStore.getState().reset()` call
6. Add `useOnboardingStore.getState().reset()` call
7. Clear MMKV persisted cache explicitly (the TanStack Query MMKV persister storage key)

**Ripple Effects:** None — logout is a terminal action. No other code depends on cache surviving logout.
**Regression Risk:** LOW — only affects logout flow. Verify login→use→logout→login cycle.
**Testing:**
- [ ] Manual test: Login as User A, log food, logout, login as User B — verify no User A data visible
- [ ] Manual test: Start workout as User A, logout, login as User B — verify no active workout
- [ ] Add unit test: `AccountSection.test.tsx` — verify all stores reset on logout
- [ ] Add unit test: verify `queryClient.clear()` is called during logout

---
### 1.2 Orphaned PII — Cleanup Orphaned Rows (Migration A)

**Audit Finding:** #3 from CRITICAL (part 1 of 2)
**Root Cause:** The 13 tables were created with plain `user_id: Mapped[uuid.UUID]` columns (indexed but not declared as ForeignKey). This was likely an early design choice to avoid circular imports or simplify the initial schema, but it means `session.delete(user)` doesn't cascade to these tables. When `permanently_delete_expired_accounts()` runs, nutrition entries, training sessions, and other PII remain orphaned in the database — a GDPR violation.

**Affected Files:**
- New Alembic migration file (Migration A — orphan cleanup)

**Implementation Steps:**
1. Create Alembic migration "cleanup_orphaned_rows"
2. Before deleting, log row counts per table for audit trail:
   ```python
   for table in TABLES_WITH_USER_ID:
       count = op.get_bind().execute(text(f"SELECT COUNT(*) FROM {table} WHERE user_id NOT IN (SELECT id FROM users)")).scalar()
       print(f"  {table}: {count} orphaned rows")
   ```
3. Delete orphaned rows from all 13 tables:
   - `DELETE FROM nutrition_entries WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM training_sessions WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM subscriptions WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM adaptive_snapshots WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM user_achievements WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM achievement_progress WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM health_reports WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM payment_transactions WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM recovery_checkins WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM readiness_scores WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM workout_templates WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM password_reset_codes WHERE user_id NOT IN (SELECT id FROM users)`
   - `DELETE FROM email_verification_codes WHERE user_id NOT IN (SELECT id FROM users)`
4. Downgrade function: no-op (deleted data cannot be restored — document this)

**Rollback Plan:** Downgrade is a no-op. If orphan cleanup deletes too many rows, restore from Neon point-in-time recovery.
**Ripple Effects:** None — orphaned rows are inaccessible via the API anyway.
**Regression Risk:** LOW — only deletes rows with no parent user.
**Testing:**
- [ ] Migration test: `alembic upgrade head` succeeds
- [ ] Verify row counts logged during migration
- [ ] Verify no valid user data was deleted (spot-check a few user_ids)

---

### 1.3 Orphaned PII — Add Foreign Key Cascades (Migration B) + Add ondelete to 10 Existing FKs

**Audit Finding:** #3 from CRITICAL (part 2 of 2) + #23 from HIGH
**Root Cause:** After orphan cleanup (1.2), we can safely add FK constraints. Additionally, 10 existing ForeignKeys were declared without `ondelete` specification, defaulting to RESTRICT.

**Affected Files:**
- `src/modules/nutrition/models.py:28` — `nutrition_entries.user_id`
- `src/modules/training/models.py:37` — `training_sessions.user_id`
- `src/modules/payments/models.py` — `subscriptions.user_id`
- `src/modules/adaptive/models.py` — `adaptive_snapshots.user_id`
- `src/modules/achievements/models.py` — `user_achievements.user_id`, `achievement_progress.user_id`
- `src/modules/health_reports/models.py` — `health_reports.user_id`
- `src/modules/payments/models.py` — `payment_transactions.user_id`
- `src/modules/readiness/models.py` — `recovery_checkins.user_id`, `readiness_scores.user_id`
- `src/modules/training/models.py` — `workout_templates.user_id`
- `src/modules/auth/models.py` — `password_reset_codes.user_id`, `email_verification_codes.user_id`
- `src/modules/coaching/models.py` — `coach_profiles`, `coaching_requests`, `coaching_sessions`
- `src/modules/content/models.py` — `content_articles`, `article_versions`, `article_favorites`
- `src/modules/training/models.py` — `custom_exercises`, `personal_records`, `user_volume_landmarks`
- New Alembic migration file (Migration B — add FK constraints)

**Implementation Steps:**
1. Update all 13 model files: change `user_id: Mapped[uuid.UUID] = mapped_column(index=True)` to `user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)`
2. Update 10 existing ForeignKeys to include `ondelete="CASCADE"` (or `ondelete="SET NULL"` for `article_favorites` where the article FK should nullify rather than delete the favorite record)
3. Create Alembic migration that adds FK constraints to all 13 tables + alters 10 existing FKs
4. Test migration up and down

**Rollback Plan:** Downgrade function drops all added FK constraints, reverting columns to plain indexed columns.
**Ripple Effects:** Deleting a user now cascades to all 13 tables. The `permanently_delete_expired_accounts()` cron job may need fewer explicit DELETE statements. Verify it still works correctly. Deleting a coach profile now cascades to coaching requests/sessions. Deleting an article cascades to versions/favorites.
**Regression Risk:** MEDIUM — FK constraints could cause unexpected failures if any code creates entries with invalid user_ids. Run full test suite after migration.
**Time Estimate:** 6-8h (combined 1.2 + 1.3)
**Testing:**
- [ ] Migration test: `alembic upgrade head` then `alembic downgrade -1` succeeds for both migrations
- [ ] Integration test: create user → create nutrition entry → delete user → verify entry deleted
- [ ] Verify `permanently_delete_expired_accounts()` still works with CASCADE
- [ ] Integration test: delete coach → verify coaching_requests deleted
- [ ] Integration test: delete article → verify article_favorites deleted
- [ ] Run full backend test suite to catch any FK violation errors

---
### 1.4 Base Model Timestamps — Timezone-Aware Migration + Replace datetime.utcnow()

**Audit Finding:** #4 from CRITICAL + #43 from MEDIUM (combined — same root cause, must deploy together)
**Root Cause:** `src/shared/base_model.py` uses `Mapped[datetime]` with `server_default=func.now()` but without `DateTime(timezone=True)`. PostgreSQL stores these as `TIMESTAMP WITHOUT TIME ZONE`. Any code comparing with `datetime.now(timezone.utc)` gets incorrect results. Affects ALL 40+ tables. Additionally, `datetime.utcnow()` is deprecated in Python 3.12 and returns naive datetimes — these must be replaced in the same deployment to avoid mixing naive/aware datetimes.

**Affected Files:**
- `src/shared/base_model.py` — `created_at` and `updated_at` column definitions
- `src/middleware/db_rate_limiter.py:22,59` — uses deprecated `datetime.utcnow()`
- All other files using `datetime.utcnow()` (grep to find)
- New Alembic migration file

**⚠️ NOTE:** `ALTER COLUMN ... TYPE TIMESTAMPTZ` takes an `ACCESS EXCLUSIVE` lock on each table. Run during a low-traffic window.

**Implementation Steps:**

**(a) Pre-migration: estimate impact**
1. Count rows per table to estimate migration duration:
   ```sql
   SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;
   ```
2. For tables with >100K rows, expect ~1s per 100K rows for the ALTER COLUMN

**(b) Create Alembic migration with explicit per-table locking strategy**
1. In `base_model.py`, change both columns:
   - `created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())`
   - `updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())`
2. Create Alembic migration that alters columns per-table:
   ```python
   # Each ALTER takes ACCESS EXCLUSIVE lock on that table
   for table in ALL_TABLES:
       op.alter_column(table, 'created_at', type_=sa.DateTime(timezone=True),
                        postgresql_using="created_at AT TIME ZONE 'UTC'")
       op.alter_column(table, 'updated_at', type_=sa.DateTime(timezone=True),
                        postgresql_using="updated_at AT TIME ZONE 'UTC'")
   ```
3. Add SQLite dialect guard (SQLite ignores timezone parameter — migration is a no-op)

**(c) Add rollback plan (downgrade function)**
```python
def downgrade():
    for table in ALL_TABLES:
        op.alter_column(table, 'created_at', type_=sa.DateTime(timezone=False))
        op.alter_column(table, 'updated_at', type_=sa.DateTime(timezone=False))
```

**(d) Replace all datetime.utcnow() calls**
1. In `db_rate_limiter.py`, replace `datetime.utcnow()` with `datetime.now(timezone.utc)` (2 occurrences, lines 22 and 59)
2. Add `from datetime import timezone` import
3. Grep for any other `utcnow()` usage across the entire codebase and fix all occurrences

**Rollback Plan:** Downgrade function reverts all columns to `TIMESTAMP WITHOUT TIME ZONE`. The `utcnow()` → `now(timezone.utc)` code changes are backward-compatible with both column types.
**Ripple Effects:** HIGH — touches every table in the database. All datetime comparisons now work correctly with timezone-aware datetimes. SQLite dev database is unaffected (SQLite ignores timezone parameter).
**Regression Risk:** HIGH — this is a schema change on ALL tables. Must test migration thoroughly.
**Time Estimate:** 6-8h
**Testing:**
- [ ] Migration test: upgrade + downgrade on PostgreSQL
- [ ] Verify SQLite dev database still works (migration should be a no-op on SQLite)
- [ ] Run full backend test suite — any datetime comparison failures indicate code that needs updating
- [ ] Grep confirms zero remaining `utcnow()` calls in the codebase
- [ ] Verify rate limiter still works correctly after `utcnow()` replacement

---
### 1.5 Bodyweight Upsert Race Condition

**Audit Finding:** #6 from CRITICAL
**Root Cause:** `src/modules/user/service.py:196-207` does SELECT then UPDATE/INSERT without database-level protection. Two concurrent requests for the same `(user_id, recorded_date)` both see no existing row, both INSERT, creating duplicates. No unique constraint exists to prevent this.

**Affected Files:**
- `src/modules/user/service.py:196-207` — bodyweight log upsert logic
- `src/modules/user/models.py` — `BodyweightLog` model (add UniqueConstraint)
- New Alembic migration (can combine with 1.2/1.4 migration)

**Implementation Steps:**
1. Add `UniqueConstraint("user_id", "recorded_date", name="uq_bodyweight_user_date")` to `BodyweightLog.__table_args__`
2. Refactor upsert in `service.py` to use PostgreSQL `INSERT ... ON CONFLICT (user_id, recorded_date) DO UPDATE SET weight_kg = excluded.weight_kg`
3. For SQLite compatibility, use `sqlalchemy.dialects.sqlite.insert` with `on_conflict_do_update`
4. Add Alembic migration for the unique constraint (clean up any existing duplicates first: keep latest per user+date)

**Rollback Plan:** Downgrade function drops the unique constraint.
**Ripple Effects:** Any code that accidentally creates duplicate bodyweight entries will now get a constraint violation. This is the desired behavior.
**Regression Risk:** LOW — the upsert logic already intends to prevent duplicates; this just enforces it at the DB level.
**Testing:**
- [ ] Unit test: concurrent upsert simulation (two inserts for same user+date)
- [ ] Integration test: verify upsert returns updated row, not duplicate
- [ ] Migration test: verify duplicate cleanup in migration works

---

### 1.6 Soft-Deleted Subscription Reactivated by Webhook

**Audit Finding:** #7 from CRITICAL
**Root Cause:** `src/modules/payments/service.py:240-244` queries subscriptions by `provider_subscription_id` without filtering `deleted_at IS NULL`. A RevenueCat webhook event for a previously-cancelled (soft-deleted) subscription matches the old row and reactivates it, bypassing the user's cancellation.

**Affected Files:**
- `src/modules/payments/service.py:240-244` — `_process_webhook_event` method

**Implementation Steps:**
1. Add `.where(Subscription.deleted_at.is_(None))` to the SELECT query in `_process_webhook_event`
2. If no active subscription found, create a new one (existing logic handles this)

**Ripple Effects:** None — this is a query filter addition. Soft-deleted subscriptions are correctly ignored.
**Regression Risk:** LOW — only affects webhook processing path.
**Testing:**
- [ ] Unit test: soft-delete a subscription, send webhook event, verify it creates new subscription instead of reactivating old one
- [ ] Integration test: full webhook lifecycle (create → cancel → soft-delete → new webhook → new subscription)

---

### ✅ Phase 1 Verification Gate — Staging Smoke Test

**Before proceeding to Phase 2, ALL of the following must pass:**

1. **Deploy to Railway** — all Phase 1 changes deployed successfully
2. **Full manual smoke test:**
   - Register new account → login → log food → log workout → view analytics → logout
   - Login as a different user → verify no cross-user data visible
   - Verify bodyweight logging works (no duplicates)
   - Verify subscription webhook processing works correctly
3. **Check Sentry** — zero new errors after deploy
4. **Run full test suites:**
   - All 1618 backend tests pass: `.venv/bin/pytest tests/ -v --timeout=120`
   - All 1955 frontend tests pass: `cd app && npx jest --passWithNoTests`
5. **Migration round-trip:** `alembic upgrade head` → `alembic downgrade -1` → `alembic upgrade head` — no errors

**⛔ Do NOT proceed to Phase 2 until this gate passes.**

---
## Phase 2: High-Priority Auth & Security

### 2.1 Rate Limit Email Resend Endpoint

**Audit Finding:** #8 from HIGH
**Root Cause:** `resend_verification_by_email` was added as a convenience endpoint but was never wired into the rate limiting system. Unlike `forgot_password` (which has `check_forgot_password_rate_limit`), this endpoint has no rate limit. An attacker can trigger unlimited email sends.

**Affected Files:**
- `src/modules/auth/router.py:245` — endpoint definition

**Implementation Steps:**
1. Add `check_forgot_password_rate_limit(data.email)` (or a new `check_resend_rate_limit`) before the email send call
2. Use the same 3-attempts-per-5-minutes window as forgot_password

**Ripple Effects:** None — adds protection to an existing endpoint.
**Regression Risk:** LOW
**Testing:**
- [ ] Manual test: call endpoint 4 times rapidly, verify 429 on 4th attempt
- [ ] Unit test: verify rate limit function is called

---

### 2.2 Apple Sign-In Nonce Mandatory

**Audit Finding:** #10 from HIGH
**Root Cause:** The Apple Sign-In handler was written to be lenient during development — nonce verification is conditional (`if data and getattr(data, 'nonce', None)`). Without nonce, ID tokens are accepted without replay protection, allowing token reuse attacks.

**Affected Files:**
- `src/modules/auth/service.py:157-162` — Apple OAuth handler

**Implementation Steps:**
1. Change conditional to mandatory: `if not data or not data.nonce: raise UnauthorizedError("Nonce required for Apple Sign-In")`
2. Verify nonce matches the one generated by the client

**Ripple Effects:** Frontend Apple Sign-In flow must always send a nonce. Verify `app/services/purchases.ts` or auth service sends nonce.
**Regression Risk:** MEDIUM — could break Apple Sign-In if frontend doesn't send nonce. Test end-to-end.
**Testing:**
- [ ] Unit test: Apple auth without nonce → 401
- [ ] Unit test: Apple auth with valid nonce → success
- [ ] Manual test: Apple Sign-In flow on iOS device

---

### 2.3 OAuth State Parameter / CSRF Protection

**Audit Finding:** #11 from HIGH
**Root Cause:** OAuth flow accepts tokens directly from the client without a `state` parameter. On mobile this is acceptable (deep link redirect), but web clients are vulnerable to CSRF — an attacker can craft a URL that logs the victim into the attacker's account.

**Affected Files:**
- `src/modules/auth/router.py:109-116` — OAuth token endpoint
- `app/screens/auth/` — frontend OAuth flow

**Implementation Steps:**
1. Generate a random `state` parameter on the backend, store in session/Redis with 5-minute TTL
2. Frontend includes `state` in OAuth redirect URL
3. Backend validates `state` on callback before accepting the token
4. For mobile-only flows (deep link), document the exception and add a `platform` parameter

**Ripple Effects:** Frontend OAuth flow needs updating to include state parameter. Mobile deep link flow may need a different code path.
**Regression Risk:** MEDIUM — OAuth flow changes affect all OAuth users.
**Testing:**
- [ ] Unit test: OAuth callback without state → 403
- [ ] Unit test: OAuth callback with valid state → success
- [ ] Manual test: Google Sign-In on web and mobile

---

### 2.4 HTML Sanitization on User-Generated Content

**Audit Finding:** #12 from HIGH
**Root Cause:** Pydantic schemas validate `max_length` on string fields but don't strip HTML/script tags. Exercise names, food names, and notes are stored as-is. The sharing endpoint renders user content into HTML `<meta>` tags, creating an XSS vector.

**Affected Files:**
- `src/modules/training/schemas.py:354` — exercise name field
- `src/modules/nutrition/models.py:30` — food_name field
- All Pydantic schemas with user-facing string fields
- `src/shared/` — new `sanitize.py` utility

**Implementation Steps:**
1. Create `src/shared/sanitize.py` with `strip_html(value: str) -> str` using `bleach.clean()` or `html.escape()`
2. Add `bleach` to `pyproject.toml` dependencies
3. Add Pydantic `field_validator` on all user-facing string fields that calls `strip_html()`
4. Apply to: exercise names, food names, meal names, notes, coaching request descriptions, article content (admin-only, less critical)

**Ripple Effects:** Existing data with HTML tags will display escaped. This is correct behavior. No data migration needed — sanitize on input going forward.
**Regression Risk:** LOW — only affects new input. Existing data unchanged.
**Testing:**
- [ ] Unit test: `strip_html("<script>alert('xss')</script>Chicken")` → `"Chicken"`
- [ ] Integration test: create nutrition entry with HTML in food_name → stored sanitized
- [ ] Manual test: verify sharing endpoint renders safely

---

### 2.5 Web Token Storage — Move from localStorage to httpOnly Cookies

**Audit Finding:** #13 from HIGH
**Root Cause:** `app/utils/secureStorage.ts:7` uses `localStorage` on web platform. While mobile uses SecureStore (encrypted keychain), web's `localStorage` is accessible to any JavaScript running on the page — a single XSS vulnerability exposes all JWT tokens.

**Affected Files:**
- `app/utils/secureStorage.ts:7` — web storage implementation
- `src/modules/auth/router.py` — needs to set httpOnly cookies for web
- `src/middleware/authenticate.py` — needs to read token from cookie OR header

**Phased Rollout Strategy:**

**Step 1: Dual-read middleware (backend)**
1. `authenticate.py` — check `Authorization` header first, fall back to reading `access_token` from httpOnly cookie
2. Backend login/refresh endpoints: set `httpOnly`, `Secure`, `SameSite=Strict` cookie with access token for web clients (detect via `X-Platform: web` header)
3. Add CSRF protection: generate `X-CSRF-Token` on login, require it on all state-changing requests (POST/PUT/DELETE) when auth is via cookie

**Step 2: Frontend starts using cookies**
1. `secureStorage.ts` — on web, stop storing token in localStorage; rely on httpOnly cookie
2. `api.ts` — on web, add `withCredentials: true` to axios config and include `X-CSRF-Token` header
3. Frontend still sends `Authorization` header as fallback during transition

**Step 3: Remove legacy support (after 7 days — all old tokens expired)**
1. Remove `Authorization` header support for web platform (keep for mobile)
2. Remove any localStorage token cleanup code
3. Document: web uses httpOnly cookies, mobile uses SecureStore

**CSRF Handling:**
- `SameSite=Strict` prevents cross-origin cookie sending
- `X-CSRF-Token` header required for state-changing requests when auth is via cookie
- CSRF token generated on login, stored in non-httpOnly cookie (readable by JS) or returned in login response body

**Ripple Effects:** CORS configuration must allow credentials from web origin. Refresh token flow changes for web.
**Regression Risk:** HIGH — changes auth flow for web platform. Mobile unaffected. Phased rollout mitigates risk.
**Time Estimate:** 6-8h
**Testing:**
- [ ] Manual test: web login → verify token in httpOnly cookie, not localStorage
- [ ] Manual test: web API calls work with cookie auth
- [ ] Manual test: mobile login → verify SecureStore still used
- [ ] Unit test: authenticate middleware reads from cookie when no header present
- [ ] Unit test: state-changing request without CSRF token → 403
- [ ] Manual test: during Step 1+2 overlap, both auth methods work simultaneously

---
## Phase 3: High-Priority CI/CD & Deployment

### 3.1 Automated Rollback on Failed Deploy

**Audit Finding:** #14 from HIGH
**Root Cause:** `deploy.yml` health check retries 10 times but on failure just exits with error code. The broken deployment remains live, serving 500s to users until someone manually intervenes.

**Affected Files:**
- `.github/workflows/deploy.yml` — health check step + new rollback step

**Implementation Steps:**
1. After health check failure, add a rollback step: `railway rollback` or `railway up --detach` with the previous commit SHA
2. Store the pre-deploy commit SHA in an earlier step for rollback reference
3. Add a Slack/Discord notification on rollback (ties into 3.6)

**Ripple Effects:** Failed deploys now auto-recover. The previous working version is restored.
**Regression Risk:** LOW — rollback is a safety net, not a code change.
**Testing:**
- [ ] Simulate failed health check → verify rollback executes
- [ ] Verify rollback restores previous working deployment

---

### 3.2 Run Migrations Before Deploy — Railway startCommand

**Audit Finding:** #15 from HIGH
**Root Cause:** `deploy.yml` runs `railway up --detach` (deploy new code) THEN `railway run alembic upgrade head` (migrate). During the window between deploy and migration, new code runs against old schema — any new column access causes 500 errors.

**Affected Files:**
- `railway.toml` — add startCommand
- `.github/workflows/deploy.yml` — remove separate migration step

**Implementation Steps:**
1. **Primary approach:** Use `railway.toml` startCommand to run migrations before the app starts:
   ```toml
   [deploy]
   startCommand = "alembic upgrade head && gunicorn -w 4 -k uvicorn.workers.UvicornWorker src.main:app"
   ```
2. Remove the separate `railway run alembic upgrade head` step from `deploy.yml` (eliminates the security risk of CI runners having direct prod DB write access)
3. Ensure migrations are backward-compatible (additive only — new columns must be nullable or have defaults)
4. Add a migration timeout (30s) to prevent hung migrations from blocking app startup

**Ripple Effects:** Migrations now run as part of app startup. If a migration fails, the app won't start and Railway will keep the previous deployment. All migrations must be backward-compatible (add columns, don't remove/rename).
**Regression Risk:** MEDIUM — changes deploy order. Test with a real migration.
**Testing:**
- [ ] Deploy with a new nullable column migration → verify no errors during transition
- [ ] Verify migration runs before new code starts serving
- [ ] Verify failed migration prevents app startup (Railway keeps old deployment)

---

### 3.3 Frontend Coverage Enforcement

**Audit Finding:** #16 from HIGH
**Root Cause:** Backend CI has `--cov-fail-under=80` but frontend CI was set up without coverage thresholds. Coverage could silently regress to 0% without failing CI.

**Affected Files:**
- `.github/workflows/ci-frontend.yml` — test job

**Implementation Steps:**
1. Add `--coverage --coverageThreshold='{"global":{"branches":70,"functions":70,"lines":80}}'` to the Jest command in CI
2. Alternatively, add `coverageThreshold` to `app/jest.config.js`

**Ripple Effects:** PRs that reduce coverage below threshold will fail CI. May need to add tests for currently-uncovered code first.
**Regression Risk:** LOW — only affects CI, not runtime.
**Testing:**
- [ ] Verify CI fails when coverage drops below threshold
- [ ] Verify current coverage meets the threshold before enabling

---

### 3.4 Add npm Audit to Frontend CI

**Audit Finding:** #17 from HIGH
**Root Cause:** Backend has `pip-audit --strict` but frontend CI has no dependency vulnerability scanning. React Native apps have large dependency trees with frequent CVEs.

**Affected Files:**
- `.github/workflows/ci-frontend.yml` — add new step

**Implementation Steps:**
1. Add step: `yarn audit --level high || true` (or `npm audit --audit-level=high`)
2. Use `--level high` to avoid blocking on low-severity issues
3. Consider `better-npm-audit` for more control over exceptions

**Ripple Effects:** CI may fail if current dependencies have known high-severity vulnerabilities. Fix those first.
**Regression Risk:** LOW
**Testing:**
- [ ] Run `yarn audit --level high` locally first to check current state
- [ ] Verify CI step runs and reports correctly

---

### 3.5 Set Up Uptime Monitoring

**Audit Finding:** #18 from HIGH
**Root Cause:** No external monitoring configured. If Railway crashes, the only notification is in Railway's dashboard (which nobody watches 24/7). The health endpoint exists (`/api/v1/health`) but nothing pings it.

**Affected Files:**
- No code changes — external service configuration
- `docs/DISASTER_RECOVERY.md` — document monitoring setup

**Implementation Steps:**
1. Sign up for UptimeRobot (free tier: 50 monitors, 5-min intervals)
2. Add monitor: `GET https://<RAILWAY_URL>/api/v1/health` every 5 minutes
3. Configure alert contacts: email + Slack webhook
4. Add a second monitor for the frontend (Expo web URL if applicable)

**Ripple Effects:** None — external monitoring only.
**Regression Risk:** NONE
**Testing:**
- [ ] Verify UptimeRobot sends alert when health endpoint is down
- [ ] Verify alert reaches Slack channel

---

### 3.6 Deploy Failure Notifications

**Audit Finding:** #59 from MEDIUM (elevated here — grouped with CI/CD)
**Root Cause:** Deploy failures are only visible in GitHub Actions UI. No push notification to the team.

**Affected Files:**
- `.github/workflows/deploy.yml` — add notification step

**Implementation Steps:**
1. Add a `failure()` conditional step at the end of the deploy job
2. Use `slackapi/slack-github-action` to send a message to a deploy channel
3. Include: commit SHA, author, error message, link to Actions run

**Ripple Effects:** None — notification only.
**Regression Risk:** NONE
**Testing:**
- [ ] Trigger a failed deploy → verify Slack notification received

---

### 3.7 Multi-Stage Docker Build

**Audit Finding:** #24 from HIGH
**Root Cause:** The Dockerfile installs build tools (`gcc`, `libpq-dev`, `python3-dev`) for compiling native extensions but leaves them in the final image. This increases image size (~200MB extra) and attack surface.

**Affected Files:**
- `Dockerfile` — restructure into multi-stage build

**Implementation Steps:**
1. Stage 1 (`builder`): install build deps, compile wheels with `pip wheel`
2. Stage 2 (`runtime`): copy only compiled wheels from builder, install with `pip install --no-deps`
3. Use `python:3.12-slim` for runtime stage
4. Verify all native extensions (bcrypt, asyncpg, uvloop) work in slim image

**Ripple Effects:** Smaller image = faster deploys. May need to add runtime-only system deps (e.g., `libpq5` without `libpq-dev`).
**Regression Risk:** MEDIUM — Docker build changes can break deployment. Test locally first.
**Testing:**
- [ ] Build image locally: `docker build -t repwise-test .`
- [ ] Run container: `docker run repwise-test` → verify health endpoint responds
- [ ] Compare image sizes: before vs after

---
## Phase 4: High-Priority Performance & Frontend

### 4.1 Fix N+1 Queries in Recipe & Meal Plan Services

**Audit Finding:** #9 from HIGH
**Root Cause:** Recipe creation/update loops over ingredients with per-ingredient DB lookups (`service.py:638-655`, `761-780`). For a recipe with 20 ingredients, this fires 40+ individual SELECT queries. Shopping list generation in `meal_plans/service.py:296-315` does the same for a 7-day plan (42+ queries).

**Affected Files:**
- `src/modules/food_database/service.py:638-655` — recipe creation
- `src/modules/food_database/service.py:761-780` — recipe update
- `src/modules/meal_plans/service.py:296-315` — shopping list generation

**Implementation Steps:**
1. Collect all `food_item_id`s from the ingredient list upfront
2. Batch-fetch: `SELECT * FROM food_items WHERE id IN (:ids)` — single query
3. Build a `{id: food_item}` lookup dict
4. Replace per-ingredient lookups with dict access
5. For shopping list: same pattern — collect all food_item_ids across all days, single batch query

**Ripple Effects:** None — internal optimization, same API response.
**Regression Risk:** LOW — same output, fewer queries.
**Testing:**
- [ ] Integration test: create recipe with 20 ingredients → verify correct result
- [ ] Add query count assertion (or log query count) to verify batch behavior
- [ ] Integration test: generate shopping list for 7-day plan → verify correct aggregation

---

### 4.2 Add Deep Linking Configuration

**Audit Finding:** #20 from HIGH
**Root Cause:** `app/App.tsx:344` renders `<NavigationContainer>` without a `linking` prop. Shared template links (`/shared/{share_code}`), push notification deep links, and password reset links all fail to navigate to the correct screen when opened from outside the app.

**Affected Files:**
- `app/App.tsx:344` — NavigationContainer
- `app/navigation/` — linking config file (new)
- `app.json` or `app.config.js` — URL scheme registration

**Implementation Steps:**
1. Create `app/navigation/linking.ts` with URL scheme and path mappings:
   - `repwise://shared/:shareCode` → SharedTemplateScreen
   - `repwise://reset-password/:token` → ResetPasswordScreen
   - `https://app.repwise.app/shared/:shareCode` → SharedTemplateScreen (universal link)
2. Add `linking` prop to `<NavigationContainer linking={linkingConfig}>`
3. Register URL scheme in `app.json`: `"scheme": "repwise"`
4. Configure universal links in Apple/Google app configs

**Ripple Effects:** Push notifications can now deep link to specific screens. Shared template links work from external sources.
**Regression Risk:** LOW — additive change, no existing navigation affected.
**Testing:**
- [ ] Manual test: open `repwise://shared/abc123` → navigates to shared template screen
- [ ] Manual test: tap push notification → navigates to correct screen
- [ ] Unit test: linking config maps all expected paths

---

### 4.3 Fix Android Back Button on 2 Modals

**Audit Finding:** #21 from HIGH
**Root Cause:** `SimpleModeDiscoveryModal.tsx:45` and `PickerField.tsx:55` render `<Modal>` without `onRequestClose` prop. On Android, the hardware back button fires `onRequestClose` — without it, the modal traps the user.

**Affected Files:**
- `app/components/training/SimpleModeDiscoveryModal.tsx:45`
- `app/components/common/PickerField.tsx:55`

**Implementation Steps:**
1. `SimpleModeDiscoveryModal.tsx`: Add `onRequestClose={onClose}` to `<Modal>` (the `onClose` prop already exists)
2. `PickerField.tsx`: Add `onRequestClose={() => setVisible(false)}` to `<Modal>`

**Ripple Effects:** None — standard React Native pattern.
**Regression Risk:** NONE
**Testing:**
- [ ] Manual test on Android: open each modal → press back button → modal closes
- [ ] Verify iOS behavior unchanged

---

### 4.4 Add mutationKey to 2 Offline-Unsafe Mutations

**Audit Finding:** #22 from HIGH
**Root Cause:** `ReactionButton.tsx:19` and `ImportDataScreen.tsx:42,55` use `useMutation` without `mutationKey`. Per project docs, mutations without `mutationKey` are not persisted by TanStack Query's MMKV persister — they're lost on app restart. If the user reacts to a feed post or starts a data import while offline, the mutation is silently dropped.

**Affected Files:**
- `app/components/social/ReactionButton.tsx:19`
- `app/screens/settings/ImportDataScreen.tsx:42,55`

**Implementation Steps:**
1. `ReactionButton.tsx`: Add `mutationKey: ['reaction', eventId]` to `useMutation` options
2. `ImportDataScreen.tsx:42`: Add `mutationKey: ['import', 'upload']` to upload mutation
3. `ImportDataScreen.tsx:55`: Add `mutationKey: ['import', 'process']` to process mutation

**Ripple Effects:** None — mutations now survive app restart. Existing behavior unchanged when online.
**Regression Risk:** NONE
**Testing:**
- [ ] Manual test: react to feed post offline → restart app → go online → verify reaction persisted
- [ ] Unit test: verify mutationKey is present on all three mutations

---

### 4.5 Social Feed Query Optimization

**Audit Finding:** #25 from HIGH
**Root Cause:** `src/modules/social/service.py:96-107` uses `WHERE user_id IN (SELECT following_id FROM follows WHERE follower_id = :id)` — an IN subquery that scans all feed_events for all followed users. At scale (10K users, 50 follows each), this becomes a full table scan on millions of rows.

**Affected Files:**
- `src/modules/social/service.py:96-107` — feed query

**Implementation Steps:**
1. Replace `IN (subquery)` with a JOIN: `FROM feed_events JOIN follows ON feed_events.user_id = follows.following_id WHERE follows.follower_id = :id`
2. Add `LIMIT` to the query (already has cursor pagination, but ensure LIMIT is applied early)
3. Verify the composite index `feed_events(user_id, created_at)` is used by the query planner

**Ripple Effects:** None — same result set, better query plan.
**Regression Risk:** LOW — same output.
**Testing:**
- [ ] Integration test: verify feed returns same results with JOIN as with IN subquery
- [ ] Run EXPLAIN ANALYZE on the new query to verify index usage

---

## Phase 5: High-Priority Test Gaps

### 5.1 Fix Rate Limiting Tests

**Audit Finding:** #26 from HIGH
**Root Cause:** `tests/test_rate_limiting.py` is skipped at module level (`@pytest.mark.skip(reason="Redis migration")`) because the rate limiter was migrated from in-memory to Redis-backed. The tests were never updated to use a Redis mock. Rate limiting has ZERO test coverage.

**Affected Files:**
- `tests/test_rate_limiting.py` — entire file needs rewrite
- `tests/conftest.py` — add `fakeredis` fixture

**Implementation Steps:**
1. Add `fakeredis[aioredis]` to test dependencies in `pyproject.toml`
2. Create a `redis_mock` fixture in `conftest.py` that patches `get_redis()` to return a `fakeredis` instance
3. Remove the module-level skip decorator
4. Rewrite tests to use the mock: test login rate limit, forgot password rate limit, registration rate limit
5. Test both Redis path and in-memory fallback path

**Ripple Effects:** None — test-only changes.
**Regression Risk:** NONE
**Testing:**
- [ ] All rate limiting tests pass with fakeredis
- [ ] Test in-memory fallback when Redis is unavailable

---

### 5.2 Add AnalyticsScreen Tests

**Audit Finding:** #27 from HIGH
**Root Cause:** The most complex frontend screen (AnalyticsScreen) has zero test coverage. It has 3 tabs (nutrition, training, body), time range selectors, multiple chart components, and 5 useEffects — all untested.

**Affected Files:**
- `app/__tests__/screens/AnalyticsScreen.test.tsx` — new file

**Implementation Steps:**
1. Create test file with mocked TanStack Query responses
2. Test tab switching (nutrition → training → body)
3. Test time range selection (7d, 14d, 30d, 90d)
4. Test loading states and error states
5. Test that chart components render with mock data

**Ripple Effects:** None — test-only.
**Regression Risk:** NONE
**Testing:**
- [ ] All new tests pass
- [ ] Coverage increases for AnalyticsScreen

---

### 5.3 Add Real E2E Tests (Maestro)

**Audit Finding:** #28 from HIGH
**Root Cause:** Frontend "e2e" tests are pure-logic simulations running in Node.js, not actual device tests. No Detox or Maestro suite exists for testing real user flows on a device/emulator.

**Affected Files:**
- `maestro/` — new directory at project root
- `maestro/config.yaml` — Maestro configuration
- `.github/workflows/e2e.yml` — new CI workflow

**Implementation Steps:**

**(a) Install Maestro**
1. Install Maestro CLI: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. Verify: `maestro --version`

**(b) Configure for Expo**
1. Create `maestro/config.yaml` with app identifier and Expo dev server URL
2. Configure Maestro to launch the Expo dev client or a pre-built `.app`/`.apk`
3. Set up environment variables for test user credentials

**(c) Write 4 critical test flows**
1. `maestro/flows/login.yaml` — email/password login → verify dashboard loads
2. `maestro/flows/log-food.yaml` — search food → select → log entry → verify on dashboard macro rings
3. `maestro/flows/log-workout.yaml` — start workout → add exercise → complete set → finish → verify in session history
4. `maestro/flows/view-analytics.yaml` — navigate to analytics → switch tabs (nutrition/training/body) → verify charts render

**(d) Add to CI as optional check initially**
1. Create `.github/workflows/e2e.yml` triggered on `workflow_dispatch` and nightly schedule
2. Run on macOS runner with iOS simulator
3. Mark as `continue-on-error: true` (non-blocking) initially

**(e) Make required after stabilization**
1. After 2 weeks of stable runs, remove `continue-on-error`
2. Add to branch protection required checks

**Ripple Effects:** Requires a running backend for E2E tests. Use a dedicated test environment or mock server.
**Regression Risk:** NONE — additive.
**Time Estimate:** 16-20h
**Testing:**
- [ ] All 4 Maestro flows pass on iOS simulator
- [ ] All 4 Maestro flows pass on Android emulator
- [ ] CI workflow runs successfully (even if optional)

---

### 5.4 Create Disaster Recovery Runbook

**Audit Finding:** #19 from HIGH
**Root Cause:** `tasks/phase1-runbook.md` covers launch setup but not incident response. No documented procedure for "production is down" scenarios.

**Affected Files:**
- `docs/DISASTER_RECOVERY.md` — new file

**Implementation Steps:**
1. Document scenarios and response procedures:
   - Railway outage → check status page, wait or migrate to backup
   - Neon database outage → check status, failover to read replica
   - Corrupted deploy → `railway rollback` or redeploy previous commit
   - Data corruption → restore from Neon point-in-time recovery
   - DDoS → enable Cloudflare, increase rate limits
2. Include contact information, escalation paths, and recovery time objectives
3. Document how to access Railway and Neon dashboards

**Ripple Effects:** None — documentation only.
**Regression Risk:** NONE
**Testing:**
- [ ] Review runbook with team
- [ ] Simulate a rollback to verify procedure works

---
## Phase 6: Medium-Priority Input Validation & Security

### 6.1 FTS5 Operator Injection

**Audit Finding:** #30 from MEDIUM
**Root Cause:** `src/modules/food_database/service.py:226` sanitizes FTS5 special characters but doesn't strip boolean operators (`AND`, `OR`, `NOT`, `NEAR`). A query like `chicken AND NOT healthy` passes through to the MATCH expression, potentially causing unexpected results or errors.

**Affected Files:**
- `src/modules/food_database/service.py:226` — FTS5 sanitization function

**Implementation Steps:**
1. Add `re.sub(r'\b(AND|OR|NOT|NEAR)\b', ' ', safe_query, flags=re.IGNORECASE)` after existing sanitization
2. Alternatively, double-quote each search token: `'"chicken" "breast"'`

**Ripple Effects:** Search queries with boolean words (e.g., "not" in food names) will be treated as plain text. This is correct for food search.
**Regression Risk:** LOW
**Testing:**
- [ ] Unit test: `sanitize("chicken AND NOT healthy")` → no operators in output
- [ ] Integration test: search for "not" → returns results, no FTS5 error

---

### 6.2 Unbounded In-Memory Rate Limiter Store

**Audit Finding:** #34 from MEDIUM
**Root Cause:** `src/middleware/rate_limiter.py:24` uses `_mem_store: dict[str, list[float]]` as fallback when Redis is unavailable. Expired keys are only cleaned on access. Under sustained attack, thousands of unique keys accumulate without bound, causing memory growth.

**Affected Files:**
- `src/middleware/rate_limiter.py:24` — `_mem_store` dict

**Implementation Steps:**
1. Add a periodic cleanup: after every 1000th check, sweep `_mem_store` and remove keys with all timestamps older than the window
2. Cap dict size at 10,000 keys — evict oldest keys when limit reached
3. Alternative: use `cachetools.TTLCache` with automatic expiry

**Ripple Effects:** None — internal memory management.
**Regression Risk:** LOW
**Testing:**
- [ ] Unit test: add 10,001 keys → verify oldest evicted
- [ ] Unit test: verify expired timestamps are cleaned up

---

### 6.3 Follow Endpoint Rate Limit

**Audit Finding:** #35 from MEDIUM
**Root Cause:** `src/modules/social/router.py:39` has no per-user rate limit. An attacker could spam follow/unfollow to flood the database and generate excessive feed events.

**Affected Files:**
- `src/modules/social/router.py:39` — follow endpoint

**Implementation Steps:**
1. Add `check_user_endpoint_rate_limit(user.id, "social:follow", 30, 60)` — 30 follows per minute

**Ripple Effects:** None — protective measure.
**Regression Risk:** NONE
**Testing:**
- [ ] Unit test: 31st follow in 60 seconds → 429

---

### 6.4 Batch Nutrition Endpoint Rate Limit

**Audit Finding:** #36 from MEDIUM
**Root Cause:** `src/modules/nutrition/router.py:114` batch endpoint has no rate limit. Could be used to flood the database with entries.

**Affected Files:**
- `src/modules/nutrition/router.py:114` — batch endpoint

**Implementation Steps:**
1. Add per-user rate limit: 10 batch calls per minute

**Ripple Effects:** None.
**Regression Risk:** NONE
**Testing:**
- [ ] Unit test: 11th batch call in 60 seconds → 429

---

### 6.5 Sharing Endpoint Soft Delete Filter

**Audit Finding:** #37 from MEDIUM
**Root Cause:** `src/modules/sharing/service.py:87` queries `User` by ID without `User.not_deleted()` filter. Could return a deleted user's display name/email in the shared template preview.

**Affected Files:**
- `src/modules/sharing/service.py:87`

**Implementation Steps:**
1. Add `User.not_deleted(stmt)` to the user lookup query
2. Return generic "Unknown User" if user is soft-deleted

**Ripple Effects:** Shared templates from deleted users show "Unknown User" instead of PII.
**Regression Risk:** LOW
**Testing:**
- [ ] Unit test: share template → delete user → preview shows "Unknown User"

---

### 6.6 Content-Security-Policy Header

**Audit Finding:** #38 from MEDIUM
**Root Cause:** `src/middleware/security_headers.py` adds X-Frame-Options, HSTS, X-Content-Type-Options, but no CSP header. The sharing endpoint serves HTML, making it vulnerable to injected scripts.

**Affected Files:**
- `src/middleware/security_headers.py`

**Implementation Steps:**
1. Add `Content-Security-Policy: default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' https://cdn.repwise.app` to the security headers middleware
2. Apply only to HTML responses (not JSON API responses)

**Ripple Effects:** Any inline scripts in HTML responses will be blocked. Verify sharing endpoint doesn't use inline scripts.
**Regression Risk:** LOW
**Testing:**
- [ ] Manual test: sharing endpoint renders correctly with CSP header
- [ ] Verify no console errors about blocked resources

---

### 6.7 Sharing Endpoint HTML Escaping

**Audit Finding:** #39 from MEDIUM
**Root Cause:** `src/modules/sharing/router.py:79,85` interpolates `description` into `<meta>` OG tags without `html.escape()`. Currently the description is numeric (exercise count), but if it ever includes user text, it becomes an XSS vector.

**Affected Files:**
- `src/modules/sharing/router.py:79,85`

**Implementation Steps:**
1. Import `html` module
2. Apply `html.escape()` to all interpolated values in the HTML template: `description`, `title`, `image_url`

**Ripple Effects:** None — defensive escaping.
**Regression Risk:** NONE
**Testing:**
- [ ] Unit test: template with `<script>` in description → escaped in output

---

### 6.8 JWT Secret Validation Independent of DEBUG

**Audit Finding:** #40 from MEDIUM
**Root Cause:** `src/config/settings.py:88-94` only rejects the default JWT secret (`"change-me-in-production"`) when `DEBUG=false`. If production accidentally sets `DEBUG=true`, the weak secret is accepted.

**Affected Files:**
- `src/config/settings.py:88-94`

**Implementation Steps:**
1. Add a separate `ENVIRONMENT` variable (e.g., `production`, `staging`, `development`)
2. Reject default JWT secret when `ENVIRONMENT != "development"`, regardless of DEBUG
3. Alternative: always reject the default secret, require explicit override in dev via `.env`

**Ripple Effects:** Dev environment needs `JWT_SECRET` in `.env` (already has it per README).
**Regression Risk:** LOW — dev already sets JWT_SECRET.
**Testing:**
- [ ] Unit test: `ENVIRONMENT=production` + default secret → startup error
- [ ] Unit test: `ENVIRONMENT=development` + default secret → allowed

---

### 6.9 JSONB Validation Gaps

**Audit Finding:** #46 from MEDIUM
**Root Cause:** `meal_plans.slot_splits`, `coaching_requests.progress_data`, `coaching_sessions.document_urls` are NOT NULL JSONB columns without schema validation. Malformed or oversized JSON can be stored.

**Affected Files:**
- `src/modules/meal_plans/schemas.py` — slot_splits validation
- `src/modules/coaching/schemas.py` — progress_data, document_urls validation

**Implementation Steps:**
1. Add Pydantic validators that check JSON structure and size (max 64KB per field)
2. Define expected schemas for each JSONB field
3. Add `validate_json_size()` utility to `src/shared/`

**Ripple Effects:** Existing malformed data won't be affected (validation is on input only).
**Regression Risk:** LOW
**Testing:**
- [ ] Unit test: oversized JSON → validation error
- [ ] Unit test: malformed JSON structure → validation error

---

### 6.10 Progress Photos Metadata Encryption

**Audit Finding:** #56 from MEDIUM
**Root Cause:** `app/screens/profile/ProgressPhotosScreen.tsx:47,112,134` stores body progress photo metadata (timestamps, body measurements) in unencrypted AsyncStorage. This is sensitive personal health data.

**Affected Files:**
- `app/screens/profile/ProgressPhotosScreen.tsx:47,112,134`

**Implementation Steps:**
1. Move photo metadata storage from AsyncStorage to SecureStore (mobile) or encrypted MMKV
2. Migrate existing data on first access

**Ripple Effects:** Photo metadata access is now async (SecureStore is async). Verify all callers handle this.
**Regression Risk:** LOW
**Testing:**
- [ ] Manual test: take progress photo → verify metadata in SecureStore, not AsyncStorage
- [ ] Migration test: existing AsyncStorage data migrated to SecureStore

---

### 6.11 Docs Endpoint Independent of DEBUG

**Audit Finding:** #70 from MEDIUM
**Root Cause:** `src/main.py:139-141` enables Swagger/ReDoc docs when `DEBUG=true`. If production accidentally enables DEBUG, the full API schema is exposed publicly.

**Affected Files:**
- `src/main.py:139-141`

**Implementation Steps:**
1. Add `ENABLE_DOCS` environment variable (default: `false`)
2. Use `ENABLE_DOCS` instead of `DEBUG` to control docs endpoints
3. In dev `.env`, set `ENABLE_DOCS=true`

**Ripple Effects:** None — docs are already disabled in production.
**Regression Risk:** NONE
**Testing:**
- [ ] Verify docs accessible when `ENABLE_DOCS=true`
- [ ] Verify docs hidden when `ENABLE_DOCS=false` even if `DEBUG=true`

---
## Phase 7: Medium-Priority Performance & Frontend

### 7.1 Replace 20 toISOString() Date Formatting Calls

**Audit Finding:** #49 from MEDIUM
**Root Cause:** 20 occurrences of `new Date().toISOString().split('T')[0]` across the frontend. This returns the UTC date, not the local date. At 11:30 PM EST, it returns tomorrow's date. Per project rules: "Use local date arithmetic, not `toISOString()`, for date comparisons."

**Affected Files:**
- `app/screens/analytics/AnalyticsScreen.tsx` (6 occurrences)
- `app/screens/logs/LogsScreen.tsx` (3)
- `app/screens/dashboard/DashboardScreen.tsx` (1)
- `app/screens/training/ExerciseHistoryScreen.tsx` (2)
- `app/screens/social/LeaderboardScreen.tsx` (1)
- `app/screens/analytics/WeeklyReportScreen.tsx` (1)
- 6 more files

**Implementation Steps:**
1. Create `app/utils/localDate.ts` with `getLocalDateString(): string` that returns `YYYY-MM-DD` in local timezone
2. Replace all 20 `toISOString().split('T')[0]` calls with `getLocalDateString()`
3. Use `date.getFullYear()`, `date.getMonth() + 1`, `date.getDate()` for local date components

**Ripple Effects:** Date-dependent queries will now use the correct local date. Users in negative UTC offsets will see correct "today" data.
**Regression Risk:** LOW — fixes a bug, doesn't introduce new behavior.
**Testing:**
- [ ] Unit test: `getLocalDateString()` returns local date, not UTC
- [ ] Unit test: at 11:30 PM EST, returns today's date (not tomorrow)
- [ ] Grep confirms no remaining `toISOString().split('T')[0]` calls

---

### 7.2 DashboardScreen Memoization

**Audit Finding:** #50 from MEDIUM
**Root Cause:** `app/screens/dashboard/DashboardScreen.tsx` is a 345-line component with zero `useCallback` or `useMemo`. All inline arrow functions (event handlers, computed values) are recreated on every render, causing unnecessary re-renders of child components.

**Affected Files:**
- `app/screens/dashboard/DashboardScreen.tsx`

**Implementation Steps:**
1. Wrap all event handlers in `useCallback` with appropriate deps
2. Wrap computed values (macro calculations, date formatting) in `useMemo`
3. Ensure `useCallback`/`useMemo` declarations come AFTER the functions they depend on (avoid temporal dead zone per project rules)

**Ripple Effects:** Child components that receive these handlers as props will re-render less frequently. Performance improvement.
**Regression Risk:** LOW — same behavior, better performance. Watch for stale closures.
**Testing:**
- [ ] Manual test: dashboard renders correctly, all interactions work
- [ ] React DevTools profiler: verify fewer re-renders

---

### 7.3 AnalyticsScreen Memoization & Cleanup

**Audit Finding:** #51 and #52 from MEDIUM
**Root Cause:** `AnalyticsScreen.tsx:262-272` calls `filterByTimeRange()` 3 times and `computeEMA()` once on every render without `useMemo`. Additionally, 5 `useEffect` hooks (lines 242-260) make async API calls without `AbortController` — state updates on unmounted components cause React warnings and potential memory leaks.

**Affected Files:**
- `app/screens/analytics/AnalyticsScreen.tsx:242-272`

**Implementation Steps:**
1. Wrap `filterByTimeRange()` and `computeEMA()` calls in `useMemo` with `[data, timeRange]` deps
2. Add `AbortController` to each of the 5 useEffects:
   ```typescript
   useEffect(() => {
     const controller = new AbortController();
     fetchData({ signal: controller.signal });
     return () => controller.abort();
   }, [deps]);
   ```
3. In each fetch function, pass `signal` to axios and check `signal.aborted` before setting state

**Ripple Effects:** Navigating away from Analytics tab no longer causes state-update-on-unmounted warnings.
**Regression Risk:** LOW
**Testing:**
- [ ] Manual test: navigate to Analytics → quickly navigate away → no console warnings
- [ ] Manual test: all charts render correctly with memoized data

---

### 7.4 LogsScreen — Replace ScrollView with FlatList

**Audit Finding:** #53 from MEDIUM
**Root Cause:** `app/screens/logs/LogsScreen.tsx:434-537` renders the nutrition tab using `<ScrollView>` which renders ALL entries at once. For users with 50+ daily entries, this causes jank and high memory usage.

**Affected Files:**
- `app/screens/logs/LogsScreen.tsx:434-537`

**Implementation Steps:**
1. Replace `<ScrollView>` with `<FlatList>` for the nutrition entries list
2. Add `renderItem` function with `useCallback`
3. Add `keyExtractor` using entry ID
4. Add `getItemLayout` if items have fixed height (for scroll performance)

**Ripple Effects:** None — same visual output, virtualized rendering.
**Regression Risk:** LOW — FlatList is a drop-in replacement for ScrollView with data.
**Testing:**
- [ ] Manual test: scroll through 50+ nutrition entries — smooth scrolling
- [ ] Manual test: all entry interactions (edit, delete, copy) still work

---

### 7.5 Lazy-Load zxcvbn (400KB+)

**Audit Finding:** #54 from MEDIUM
**Root Cause:** `app/utils/passwordStrength.ts:1` statically imports `@zxcvbn-ts/core` (400KB+). This module is only needed on auth screens (registration, password reset) but is included in the initial bundle, slowing app startup.

**Affected Files:**
- `app/utils/passwordStrength.ts:1`

**Implementation Steps:**
1. Replace static import with dynamic: `const { zxcvbn } = await import('@zxcvbn-ts/core')`
2. Make `checkPasswordStrength()` async
3. Update callers to await the result
4. Show a brief loading state while zxcvbn loads (first call only)

**Ripple Effects:** Password strength check is now async. Callers on auth screens need to handle the promise.
**Regression Risk:** LOW — only affects auth screens.
**Testing:**
- [ ] Manual test: registration screen → type password → strength indicator appears (may have brief delay on first load)
- [ ] Verify bundle size reduction

---

### 7.6 Lazy-Load BarcodeScanner

**Audit Finding:** #55 from MEDIUM
**Root Cause:** `app/components/nutrition/BarcodeScanner.tsx:25` eagerly imports `expo-camera`, a heavy native module. It's loaded even when the user never uses the barcode scanner.

**Affected Files:**
- `app/components/nutrition/BarcodeScanner.tsx:25`

**Implementation Steps:**
1. Wrap BarcodeScanner with `React.lazy()`: `const BarcodeScanner = React.lazy(() => import('./BarcodeScanner'))`
2. Add `<Suspense fallback={<ActivityIndicator />}>` wrapper at the usage site
3. Move the `expo-camera` import inside the component file (it's already there, just needs lazy boundary)

**Ripple Effects:** First barcode scan has a brief loading delay. Subsequent scans are instant.
**Regression Risk:** LOW
**Testing:**
- [ ] Manual test: open barcode scanner → camera loads after brief spinner
- [ ] Verify scanner functionality unchanged

---

### 7.7 Fix useNavigation<any> Type Safety

**Audit Finding:** #57 from MEDIUM
**Root Cause:** 3 files use `useNavigation<any>()` which loses all type safety on navigation parameters. Typos in screen names or missing params won't be caught at compile time.

**Affected Files:**
- `app/screens/profile/ProfileScreen.tsx:44`
- `app/screens/analytics/AnalyticsScreen.tsx:77`
- `app/components/profile/BodyStatsSection.tsx:101`

**Implementation Steps:**
1. Define or import the correct `StackParamList` type for each navigator
2. Replace `useNavigation<any>()` with `useNavigation<NativeStackNavigationProp<ProfileStackParamList>>()`
3. Verify all `navigation.navigate()` calls have correct params

**Ripple Effects:** TypeScript will now catch navigation errors at compile time.
**Regression Risk:** NONE — type-only change, no runtime effect.
**Testing:**
- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] Verify navigation works on affected screens

---

### 7.8 Increase Sentry Traces Sample Rate for Launch

**Audit Finding:** #58 from MEDIUM
**Root Cause:** `src/main.py:207` sets `traces_sample_rate=0.1` (10%). During the critical launch period, 90% of performance traces are missed, making it hard to diagnose slow endpoints or errors.

**Affected Files:**
- `src/main.py:207`

**Implementation Steps:**
1. Change `traces_sample_rate` to `0.5` (50%) for launch
2. Add a TODO comment: "Reduce to 0.1 after launch stabilization (2 weeks)"
3. Consider making it configurable via environment variable: `SENTRY_TRACES_SAMPLE_RATE`

**Ripple Effects:** Higher Sentry usage — check Sentry plan limits. 50% sampling at low traffic is fine.
**Regression Risk:** NONE
**Testing:**
- [ ] Verify Sentry receives traces after change
- [ ] Monitor Sentry quota usage

---

### 7.9 Reduce Railway Healthcheck Timeout

**Audit Finding:** #60 from MEDIUM
**Root Cause:** `railway.toml` sets healthcheck timeout to 120 seconds. A simple JSON health check should respond in <1 second. A 2-minute timeout means a hung application goes undetected for 2 minutes per check.

**Affected Files:**
- `railway.toml`

**Implementation Steps:**
1. Change healthcheck timeout from 120s to 30s
2. Verify health endpoint responds in <1s under normal conditions

**Ripple Effects:** If the app is slow to start (cold start), it may fail the health check. Verify startup time.
**Regression Risk:** LOW — if startup takes >30s, increase slightly.
**Testing:**
- [ ] Deploy and verify health check passes within 30s
- [ ] Monitor for false-positive health check failures

---

### 7.10 Accessibility Label Coverage Sprint

**Audit Finding:** #29 from MEDIUM
**Root Cause:** Only 213 of 921 interactive elements (23%) have `accessibilityLabel`. 15+ screens have zero labels. This makes the app unusable for screen reader users and fails WCAG 2.1 AA compliance.

**Affected Files (worst offenders):**
- `app/components/modals/AddTrainingModal.tsx` (21 elements, 0 labels)
- `app/screens/logs/LogsScreen.tsx` (19 elements, 0 labels)
- `app/screens/meal-prep/PrepSundayFlow.tsx` (17 elements, 0 labels)
- `app/components/profile/PlanEditFlow.tsx` (17 elements, 0 labels)
- `app/components/nutrition/BarcodeScanner.tsx` (17 elements, 0 labels)
- 10+ more screens

**Implementation Steps:**
1. Start with the 5 worst-offending files listed above
2. Add `accessibilityLabel` to all `TouchableOpacity`, `Pressable`, `TextInput`, `Switch` elements
3. Add `accessibilityRole` (button, link, search, etc.) to interactive elements
4. Add `accessibilityHint` for non-obvious actions
5. Target 80%+ coverage across the app

**Ripple Effects:** None — additive props, no behavior change.
**Regression Risk:** NONE
**Testing:**
- [ ] Run accessibility audit tool (e.g., `react-native-a11y`) to measure coverage
- [ ] Manual test with VoiceOver (iOS) / TalkBack (Android) on key screens

---
## Phase 8: Medium-Priority Database & Schema

### 8.1 Add Missing Indexes on FK Columns

**Audit Finding:** #31 from MEDIUM
**Root Cause:** `coaching_suggestions.snapshot_id` and `food_items.created_by` are FK columns without indexes. CASCADE deletes and filtered queries on these columns require full table scans.

**Affected Files:**
- `src/modules/adaptive/models.py:66` — `coaching_suggestions.snapshot_id`
- `src/modules/food_database/models.py:55` — `food_items.created_by`
- New Alembic migration

**Implementation Steps:**
1. Add `index=True` to both column definitions
2. Create Alembic migration to add indexes

**Rollback Plan:** Downgrade function drops both indexes.
**Ripple Effects:** Slightly slower inserts (index maintenance), much faster lookups and CASCADE deletes.
**Regression Risk:** LOW
**Testing:**
- [ ] Migration test: upgrade + downgrade
- [ ] Verify query plans use new indexes

---

### 8.2 Subscription Upsert Race Condition

**Audit Finding:** #32 from MEDIUM
**Root Cause:** `src/modules/payments/service.py:170-188` `_get_or_create_subscription` does SELECT then INSERT without locking. Concurrent RevenueCat webhook events for the same user could create duplicate active subscriptions.

**Affected Files:**
- `src/modules/payments/service.py:170-188`

**Implementation Steps:**
1. Use `INSERT ... ON CONFLICT (user_id, provider_subscription_id) DO UPDATE` pattern
2. Add unique constraint on `(user_id, provider_subscription_id)` if not exists
3. Alternative: use `SELECT ... FOR UPDATE` to lock the row during the check

**Rollback Plan:** Downgrade function drops the unique constraint.
**Ripple Effects:** Duplicate subscription creation is now impossible at the DB level.
**Regression Risk:** LOW
**Testing:**
- [ ] Unit test: concurrent webhook events for same user → single subscription created

---

### 8.3 Device Token Upsert Race Condition

**Audit Finding:** #33 from MEDIUM
**Root Cause:** `src/modules/notifications/service.py:48-70` does SELECT by token then UPDATE/INSERT. Concurrent device registrations could create duplicate token entries.

**Affected Files:**
- `src/modules/notifications/service.py:48-70`

**Implementation Steps:**
1. Add unique constraint on `device_tokens.token` if not exists
2. Use `INSERT ... ON CONFLICT (token) DO UPDATE SET user_id = :user_id, updated_at = now()`

**Rollback Plan:** Downgrade function drops the unique constraint.
**Ripple Effects:** None — same behavior, race-condition-safe.
**Regression Risk:** LOW
**Testing:**
- [ ] Unit test: register same token twice concurrently → single entry

---

### 8.4 Add Partial Indexes on Soft-Delete Tables

**Audit Finding:** #44 from MEDIUM
**Root Cause:** `workout_templates`, `custom_meals`, `meal_plans` have `SoftDeleteMixin` but lack partial indexes on `deleted_at IS NULL`. Other soft-delete tables have these indexes for efficient queries that filter out deleted rows.

**Affected Files:**
- `src/modules/training/models.py` — `workout_templates`
- `src/modules/meals/models.py` — `custom_meals`
- `src/modules/meal_plans/models.py` — `meal_plans`
- New Alembic migration

**Implementation Steps:**
1. Add `Index("ix_workout_templates_active", "user_id", postgresql_where=text("deleted_at IS NULL"))` to each table
2. Create Alembic migration with SQLite dialect guard (partial indexes are PostgreSQL-only)

**Rollback Plan:** Downgrade function drops the partial indexes.
**Ripple Effects:** Faster queries on these tables when filtering active records.
**Regression Risk:** LOW
**Testing:**
- [ ] Migration test: upgrade + downgrade on PostgreSQL
- [ ] Verify SQLite migration is a no-op (dialect guard)

---

### 8.5 Add Composite Indexes for Common Query Patterns

**Audit Finding:** #45 from MEDIUM
**Root Cause:** Four common query patterns lack composite indexes, causing sequential scans on growing tables.

**Affected Files:**
- `src/modules/payments/models.py` — `payment_transactions(user_id, created_at)`
- `src/modules/notifications/models.py` — `notification_log(user_id, read_at)`
- `src/modules/coaching/models.py` — `coaching_requests(user_id, created_at)`
- `src/modules/user/models.py` — `body_measurements(user_id, measured_at DESC)`
- New Alembic migration (combine with 8.4)

**Implementation Steps:**
1. Add composite indexes to each model's `__table_args__`
2. Create single Alembic migration for all 4 indexes

**Rollback Plan:** Downgrade function drops all 4 composite indexes.
**Ripple Effects:** Faster queries, slightly slower inserts.
**Regression Risk:** LOW
**Testing:**
- [ ] Migration test: upgrade + downgrade
- [ ] Verify query plans use new indexes

---

### 8.6 Add SoftDeleteMixin to User-Facing Tables

**Audit Finding:** #47 from MEDIUM
**Root Cause:** `coaching_requests`, `coaching_sessions`, `body_measurements`, `recomp_measurements` lack `SoftDeleteMixin`. User-submitted data on these tables is hard-deleted, making it unrecoverable.

**Affected Files:**
- `src/modules/coaching/models.py` — `coaching_requests`, `coaching_sessions`
- `src/modules/user/models.py` — `body_measurements`
- `src/modules/recomp/models.py` — `recomp_measurements`
- `src/modules/coaching/service.py` — all queries and deletes on coaching tables
- `src/modules/user/service.py` — all queries and deletes on body_measurements
- `src/modules/recomp/service.py` — all queries and deletes on recomp_measurements
- New Alembic migration (add `deleted_at` column)

**Implementation Steps:**
1. Add `SoftDeleteMixin` to each model class
2. Create Alembic migration adding `deleted_at` nullable DateTime column to each table
3. Grep for ALL references to these 4 table names in service files:
   ```bash
   grep -rn "coaching_requests\|coaching_sessions\|body_measurements\|recomp_measurements" src/modules/*/service.py
   ```
4. Update ALL existing SELECT queries on these 4 tables to include `deleted_at IS NULL` filter (use `Model.not_deleted(stmt)`)
5. Update ALL existing DELETE operations to set `deleted_at = now()` instead of hard delete (`session.delete()` → `update().values(deleted_at=func.now())`)
6. Verify no query path returns soft-deleted records

**Rollback Plan:** Downgrade function drops the `deleted_at` column from all 4 tables. Any records soft-deleted during the window will be permanently lost (acceptable — they were going to be hard-deleted anyway).
**Ripple Effects:** All services querying these tables must add `not_deleted()` filter. Missing a filter could return deleted records.
**Regression Risk:** MEDIUM — must update all queries. Thorough grep required.
**Time Estimate:** 4h
**Testing:**
- [ ] Integration test: soft-delete coaching request → verify not returned in list
- [ ] Integration test: soft-delete body measurement → verify not returned in history
- [ ] Grep for all queries on these 4 tables → verify `not_deleted()` filter present on every SELECT
- [ ] Grep for all `session.delete()` calls on these 4 models → verify replaced with soft delete

---

### 8.7 GIN Index Migration SQLite Guard

**Audit Finding:** #48 from MEDIUM
**Root Cause:** `g1b2_add_gin_indexes.py` migration creates PostgreSQL-only GIN indexes without checking the database dialect. Running this migration on SQLite (dev) causes an error.

**Affected Files:**
- Alembic migration file `g1b2_add_gin_indexes.py`

**Implementation Steps:**
1. Add dialect check at the top of `upgrade()`:
   ```python
   conn = op.get_bind()
   if conn.dialect.name == 'sqlite':
       return
   ```
2. Add same guard to `downgrade()`

**Ripple Effects:** None — SQLite dev database skips PostgreSQL-only indexes.
**Regression Risk:** NONE
**Testing:**
- [ ] Run `alembic upgrade head` on SQLite → no error
- [ ] Run `alembic upgrade head` on PostgreSQL → GIN indexes created

---

### 8.8 Missing Unique Constraint on Active Subscriptions & Configurable Pool Size

**Audit Finding:** #68 and #69 from MEDIUM
**Root Cause (68):** No unique constraint prevents multiple active subscriptions per user. Concurrent webhook events could create duplicates.
**Root Cause (69):** `src/config/database.py` hardcodes `pool_size=5, max_overflow=10`. At 8+ Gunicorn workers, total connections = 8 × 15 = 120, exceeding Neon's 100 connection limit.

**⚠️ Dependency:** Task 8.2 (subscription upsert fix) MUST complete before this task. The upsert race condition fix in 8.2 adds the `(user_id, provider_subscription_id)` unique constraint. This task adds the broader partial unique index on active subscriptions. Applying 8.8 before 8.2 could cause constraint violations on the upsert path that isn't yet handling conflicts.

**Affected Files:**
- `src/modules/payments/models.py` — subscriptions table (#68)
- `src/config/database.py` — pool configuration (#69)
- New Alembic migration (#68)

**Implementation Steps:**
1. (#68) Add partial unique index: `CREATE UNIQUE INDEX uq_active_subscription ON subscriptions (user_id) WHERE status IN ('active', 'trialing') AND deleted_at IS NULL`
2. (#69) Make pool configurable:
   ```python
   pool_size = int(os.getenv("DB_POOL_SIZE", "5"))
   max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))
   ```
3. Document recommended values for different worker counts in README

**Rollback Plan:** Downgrade function drops the partial unique index. Pool size change is config-only (no migration).
**Ripple Effects:** (#68) Duplicate active subscriptions will cause constraint violations — handle in webhook processor. (#69) Production needs `DB_POOL_SIZE` and `DB_MAX_OVERFLOW` env vars.
**Regression Risk:** LOW for both.
**Testing:**
- [ ] (#68) Unit test: attempt to create second active subscription → constraint violation
- [ ] (#69) Verify pool size reads from environment variable

---
## Phase 9: Medium-Priority Test Gaps & Code Cleanup

### 9.1 Payments Module Integration Tests

**Audit Finding:** #63 from MEDIUM
**Root Cause:** Only webhook and trial tests exist. No test for `/payments/status`, cancel flow, or RevenueCat entitlement check. The subscription lifecycle is undertested.

**Affected Files:**
- `tests/test_payments_integration.py` — new file

**Implementation Steps:**
1. Add test: `GET /payments/status` returns correct subscription state
2. Add test: `POST /payments/cancel` transitions subscription to cancelled
3. Add test: RevenueCat webhook → subscription created → status check → active
4. Add test: expired subscription → status check → expired
5. Mock RevenueCat API responses

**Ripple Effects:** None — test-only.
**Regression Risk:** NONE
**Testing:**
- [ ] All new payment tests pass

---

### 9.2 Offline Behavior Tests

**Audit Finding:** #64 from MEDIUM
**Root Cause:** NetInfo mock always returns `isConnected: true`. TanStack Query mutation queue is never tested in offline mode. Offline-first is a key feature but has zero test coverage.

**Affected Files:**
- `app/__tests__/offline/` — new directory
- `app/__mocks__/@react-native-community/netinfo.ts` — update mock

**Implementation Steps:**
1. Update NetInfo mock to support configurable `isConnected` state
2. Add test: log food offline → mutation queued → go online → mutation executed
3. Add test: log workout offline → mutation queued → app restart → mutation persisted
4. Add test: offline indicator shown when disconnected

**Ripple Effects:** None — test-only.
**Regression Risk:** NONE
**Testing:**
- [ ] All offline tests pass

---

### 9.3 WeeklyCheckinCard Tests

**Audit Finding:** #65 from MEDIUM
**Root Cause:** The adaptive engine's primary user-facing component (`WeeklyCheckinCard`) has no frontend test. It handles accept/modify/dismiss of weekly target suggestions — critical business logic.

**Affected Files:**
- `app/__tests__/components/WeeklyCheckinCard.test.tsx` — new file

**Implementation Steps:**
1. Test rendering with pending suggestion
2. Test accept action → API call → UI update
3. Test modify action → opens edit modal
4. Test dismiss action → API call → card hidden
5. Test no-suggestion state (no check-in due)

**Ripple Effects:** None — test-only.
**Regression Risk:** NONE
**Testing:**
- [ ] All new tests pass

---

### 9.4 Cross-Service Integration Tests

**Audit Finding:** #66 from MEDIUM
**Root Cause:** No test verifies the full event chain: log workout → triggers achievement check → creates feed event → appears in leaderboard. Each module is tested in isolation but the integration is untested.

**Affected Files:**
- `tests/test_cross_service_integration.py` — new file

**Implementation Steps:**
1. Create test: log workout session → verify achievement triggered (e.g., "First Workout" badge)
2. Create test: achievement earned → feed event created with correct metadata
3. Create test: workout logged → volume appears in leaderboard calculation
4. Use real DB session (not mocks) for true integration testing

**Ripple Effects:** None — test-only.
**Regression Risk:** NONE
**Testing:**
- [ ] All integration tests pass

---

### 9.5 Dashboard Tests — Business Logic Assertions

**Audit Finding:** #67 from MEDIUM
**Root Cause:** `tests/test_dashboard_smoke.py` only checks HTTP status codes and key presence. No assertions on computed values (macro totals, EMA smoothing, streak calculation).

**Affected Files:**
- `tests/test_dashboard_smoke.py` — enhance existing tests

**Implementation Steps:**
1. Add assertions: macro totals match sum of logged entries
2. Add assertions: EMA weight is correctly smoothed
3. Add assertions: streak count matches consecutive logging days
4. Add assertions: budget remaining = target - consumed

**Ripple Effects:** None — test-only.
**Regression Risk:** NONE
**Testing:**
- [ ] Enhanced tests pass with correct business logic assertions

---

### 9.6 Remove Stale Stripe/Razorpay Settings

**Audit Finding:** #41 from MEDIUM
**Root Cause:** `src/config/settings.py:64-65` still defines `STRIPE_WEBHOOK_SECRET` and `RAZORPAY_WEBHOOK_SECRET` with default values despite being fully replaced by RevenueCat. Dead code that confuses developers.

**Affected Files:**
- `src/config/settings.py:64-65`

**Implementation Steps:**
1. Remove `STRIPE_WEBHOOK_SECRET` and `RAZORPAY_WEBHOOK_SECRET` from settings
2. Grep for any remaining references to these settings and remove
3. Remove any Stripe/Razorpay imports or dead code paths

**Ripple Effects:** Any code still referencing these settings will fail at import time — this is desired (find and remove dead code).
**Regression Risk:** LOW — grep thoroughly for references.
**Testing:**
- [ ] `grep -r "STRIPE_WEBHOOK_SECRET\|RAZORPAY_WEBHOOK_SECRET" src/` returns no results
- [ ] All backend tests pass

---

### 9.7 Remove Unused passlib[bcrypt] Dependency

**Audit Finding:** #42 from MEDIUM
**Root Cause:** `pyproject.toml:17` lists `passlib[bcrypt]` as a dependency but the code uses `bcrypt` directly. passlib was last released in 2020 and is unmaintained.

**Affected Files:**
- `pyproject.toml:17`

**Implementation Steps:**
1. Remove `passlib[bcrypt]` from `pyproject.toml` dependencies
2. Grep for any `passlib` imports and remove
3. Verify `bcrypt` is still listed as a direct dependency

**Ripple Effects:** None if passlib is truly unused. If any code imports it, it will fail — fix those imports.
**Regression Risk:** LOW — grep first.
**Testing:**
- [ ] `grep -r "passlib" src/` returns no results
- [ ] All backend tests pass after removal

---

## Phase 10: Low-Priority Polish

### 10.1 Log Exceptions in Food Search Catch Block

**Audit Finding:** #71 from LOW
**Root Cause:** `src/modules/food_database/service.py:126` catches `(SQLAlchemyError, TypeError, ValueError)` and returns empty results silently. Errors are swallowed without logging, making debugging impossible.

**Affected Files:**
- `src/modules/food_database/service.py:126`

**Implementation Steps:**
1. Add `logger.exception("Food search failed")` before returning empty results

**Ripple Effects:** None. **Regression Risk:** NONE.
**Testing:**
- [ ] Verify error appears in logs when search fails

---

### 10.2 Sharing Router Null Request Check

**Audit Finding:** #72 from LOW
**Root Cause:** `src/modules/sharing/router.py:32` has `request: Request = None  # type: ignore`. If None, `request.client.host` raises AttributeError.

**Affected Files:**
- `src/modules/sharing/router.py:32`

**Implementation Steps:**
1. Add `if request and request.client:` guard before accessing `request.client.host`
2. Default to `"unknown"` if request is None

**Ripple Effects:** None. **Regression Risk:** NONE.
**Testing:**
- [ ] Unit test: sharing endpoint with None request → no crash

---

### 10.3 FTS5 Fetch Soft Delete Filter

**Audit Finding:** #73 from LOW
**Root Cause:** `src/modules/food_database/service.py:265-280` PostgreSQL fallback path may return soft-deleted food items.

**Affected Files:**
- `src/modules/food_database/service.py:265-280`

**Implementation Steps:**
1. Add `AND deleted_at IS NULL` to the PostgreSQL fallback query

**Ripple Effects:** None. **Regression Risk:** NONE.
**Testing:**
- [ ] Unit test: soft-deleted food item not returned in search

---

### 10.4 Rate Limit or Auth on Exercise Search

**Audit Finding:** #74 from LOW
**Root Cause:** `src/modules/training/router.py:58` exercise search is unauthenticated. Low data sensitivity but enables scraping the full exercise catalog.

**Affected Files:**
- `src/modules/training/router.py:58`

**Implementation Steps:**
1. Add IP-based rate limit: 60 requests per minute
2. Or add `get_current_user_optional` dependency (allows unauthenticated but tracks usage)

**Ripple Effects:** None. **Regression Risk:** NONE.
**Testing:**
- [ ] Verify rate limit triggers on excessive requests

---

### 10.5 Bounded Feature Flag Cache

**Audit Finding:** #75 from LOW
**Root Cause:** `src/modules/feature_flags/service.py:36` — expired entries only evicted on read. Cache grows unbounded.

**Affected Files:**
- `src/modules/feature_flags/service.py:36`

**Implementation Steps:**
1. Replace dict with `cachetools.TTLCache(maxsize=1000, ttl=300)`

**Ripple Effects:** None. **Regression Risk:** NONE.
**Testing:**
- [ ] Unit test: cache evicts entries after TTL

---

### 10.6 Add Indexes on Low-Traffic FK Columns

**Audit Finding:** #76 from LOW
**Root Cause:** `meal_plan_items.food_item_id` and `meal_favorites.meal_id` lack indexes.

**Affected Files:**
- `src/modules/meal_plans/models.py:52`
- `src/modules/meals/models.py:55`

**Implementation Steps:**
1. Add `index=True` to both columns
2. Include in next Alembic migration batch

**Rollback Plan:** Downgrade drops both indexes.
**Ripple Effects:** None. **Regression Risk:** NONE.
**Testing:**
- [ ] Migration test passes

---

### 10.7 Password Policy Enhancement

**Audit Finding:** #77 from LOW
**Root Cause:** `src/modules/auth/schemas.py:29-36` requires length but no special characters.

**Affected Files:**
- `src/modules/auth/schemas.py:29-36`

**Implementation Steps:**
1. Consider adding zxcvbn server-side check (score ≥ 2)
2. Or add regex validator requiring at least one number and one special character
3. Update frontend password requirements display

**Ripple Effects:** Existing users unaffected. New registrations and password changes must meet new requirements.
**Regression Risk:** LOW
**Testing:**
- [ ] Unit test: weak password → rejected
- [ ] Unit test: strong password → accepted

---

### 10.8 Audit CORS Configuration

**Audit Finding:** #78 from LOW
**Root Cause:** `src/main.py:165` uses `allow_credentials=True` with dynamic origins. If CORS_ORIGINS is too broad, credentials could be sent to unintended origins.

**Affected Files:**
- `src/main.py:165`
- `src/config/settings.py` — CORS_ORIGINS

**Implementation Steps:**
1. Audit production `CORS_ORIGINS` — ensure only `https://app.repwise.app` and `https://repwise.app`
2. Document allowed origins in README
3. Add validation: reject wildcard `*` when `allow_credentials=True`

**Ripple Effects:** None if origins are already correct. **Regression Risk:** NONE.
**Testing:**
- [ ] Verify CORS headers in production response

---

### 10.9 APScheduler Version Pin

**Audit Finding:** #79 from LOW
**Root Cause:** `pyproject.toml:24` pins `apscheduler < 4.0`. APScheduler 3.x is in maintenance mode.

**Affected Files:**
- `pyproject.toml:24`

**Implementation Steps:**
1. Monitor APScheduler 4.x stability
2. When stable, upgrade and update cron job configuration syntax
3. For now, document the pin reason in a comment

**Ripple Effects:** None until upgrade. **Regression Risk:** NONE.
**Testing:**
- [ ] N/A — monitoring only

---

### 10.10 Create .dockerignore

**Audit Finding:** #80 from LOW
**Root Cause:** No `.dockerignore` file. Docker build context includes `app/`, `tests/`, `docs/`, `.git/` — unnecessary files that slow builds and increase image size.

**Affected Files:**
- `.dockerignore` — new file

**Implementation Steps:**
1. Create `.dockerignore` with: `app/`, `tests/`, `docs/`, `.git/`, `*.md`, `dev.db`, `test.db`, `node_modules/`, `.venv/`, `data/`

**Ripple Effects:** Faster Docker builds. **Regression Risk:** NONE.
**Testing:**
- [ ] Docker build succeeds with `.dockerignore`
- [ ] Verify no required files are excluded

---

### 10.11 CAPTCHA on Registration

**Audit Finding:** #81 from LOW
**Root Cause:** `src/modules/auth/router.py:68` has rate limiting but no CAPTCHA. Automated account creation is possible with IP rotation.

**Affected Files:**
- `src/modules/auth/router.py:68`
- Frontend registration screen

**Implementation Steps:**
1. Integrate hCaptcha or reCAPTCHA v3 (invisible)
2. Backend: verify CAPTCHA token before creating account
3. Frontend: add CAPTCHA widget to registration form
4. Skip CAPTCHA in test/dev environments

**Ripple Effects:** Registration flow adds a CAPTCHA step. Mobile may need different approach (device attestation).
**Regression Risk:** LOW
**Testing:**
- [ ] Manual test: registration with valid CAPTCHA → success
- [ ] Manual test: registration without CAPTCHA → rejected

---

### 10.12 Remove email_verified from LoginResponse

**Audit Finding:** #82 from LOW
**Root Cause:** `src/modules/auth/schemas.py` includes `email_verified` in LoginResponse. This could be used for email enumeration (try login → check if email_verified field exists → email is registered).

**Affected Files:**
- `src/modules/auth/schemas.py` — LoginResponse

**Implementation Steps:**
1. Remove `email_verified` from LoginResponse schema
2. Move email verification check to a separate authenticated endpoint
3. Update frontend to check verification status via `/auth/me` instead

**Ripple Effects:** Frontend code that reads `email_verified` from login response needs updating.
**Regression Risk:** LOW
**Testing:**
- [ ] Verify login response no longer contains `email_verified`
- [ ] Verify frontend still handles unverified emails correctly

---

### 10.13 Sentry DSN in eas.json

**Audit Finding:** #83 from LOW
**Root Cause:** `app/eas.json:12-13` contains PostHog API key (designed to be public) and Sentry DSN. The Sentry DSN contains an auth token that could be used to send fake error reports.

**Affected Files:**
- `app/eas.json:12-13`
- Sentry dashboard configuration

**Implementation Steps:**
1. Configure allowed origins in Sentry dashboard to only accept events from the app's domain
2. Enable Sentry's "Allowed Domains" security feature
3. Consider using Sentry's relay for additional protection

**Ripple Effects:** None — Sentry configuration only. **Regression Risk:** NONE.
**Testing:**
- [ ] Verify Sentry rejects events from unauthorized origins

---

### 10.14 BodyBasicsStep setTimeout Cleanup

**Audit Finding:** #84 from LOW
**Root Cause:** `app/screens/onboarding/steps/BodyBasicsStep.tsx:62` uses `setTimeout` without storing the ref for cleanup. If the component unmounts before the timer fires, it's a minor memory leak.

**Affected Files:**
- `app/screens/onboarding/steps/BodyBasicsStep.tsx:62`

**Implementation Steps:**
1. Store timeout ref: `const timerRef = useRef<NodeJS.Timeout>()`
2. In useEffect cleanup: `return () => clearTimeout(timerRef.current)`

**Ripple Effects:** None. **Regression Risk:** NONE.
**Testing:**
- [ ] Verify no memory leak warning on fast navigation through onboarding

---

### 10.15 Encrypt Barcode Scan History

**Audit Finding:** #85 from LOW
**Root Cause:** `app/components/nutrition/FoodSearchPanel.tsx:59,95` stores barcode scan history in unencrypted AsyncStorage. Low sensitivity but reveals dietary habits.

**Affected Files:**
- `app/components/nutrition/FoodSearchPanel.tsx:59,95`

**Implementation Steps:**
1. Move barcode history to encrypted MMKV or SecureStore
2. Or simply don't persist barcode history (it's a convenience feature)

**Ripple Effects:** None. **Regression Risk:** NONE.
**Testing:**
- [ ] Verify barcode history not in plain AsyncStorage

---

### 10.16 Build Artifact Caching in Mobile CI

**Audit Finding:** #86 from LOW
**Root Cause:** `.github/workflows/build-mobile.yml` installs node_modules twice (test job + build job) without caching.

**Affected Files:**
- `.github/workflows/build-mobile.yml`

**Implementation Steps:**
1. Add `actions/cache@v4` step for `node_modules` with `yarn.lock` hash as key
2. Add cache for Expo CLI

**Ripple Effects:** Faster CI builds. **Regression Risk:** NONE.
**Testing:**
- [ ] Verify cache hit on second CI run

---

### 10.17 API Contract Tests

**Audit Finding:** #87 from LOW
**Root Cause:** No schema validation ensuring API responses match frontend TypeScript types. A backend change could break the frontend without any test catching it.

**Affected Files:**
- `tests/test_api_contracts.py` — new file
- `app/__tests__/contracts/` — new directory

**Implementation Steps:**
1. Export TypeScript types as JSON Schema (using `ts-json-schema-generator`)
2. Backend tests: validate API responses against JSON Schema
3. Or use `pact` for consumer-driven contract testing
4. Start with critical endpoints: `/auth/login`, `/nutrition/entries`, `/training/sessions`

**Ripple Effects:** None — test-only. **Regression Risk:** NONE.
**Testing:**
- [ ] Contract tests pass for critical endpoints

---

### 10.18 Bundle Size Budget Test

**Audit Finding:** #88 from LOW
**Root Cause:** No test ensures frontend bundle stays under a size budget. Bundle could grow unchecked.

**Affected Files:**
- `app/__tests__/bundleSize.test.ts` — new file
- Or CI step using `size-limit`

**Implementation Steps:**
1. Add `size-limit` package to dev dependencies
2. Configure size budget in `package.json`: `"size-limit": [{"path": "dist/**/*.js", "limit": "2 MB"}]`
3. Add CI step: `npx size-limit`

**Ripple Effects:** PRs that increase bundle size beyond budget will fail CI.
**Regression Risk:** NONE
**Testing:**
- [ ] Verify current bundle is under budget
- [ ] Verify CI fails when budget exceeded

---

### 10.19 RevenueCat Mock Enhancement

**Audit Finding:** #89 from LOW
**Root Cause:** `app/__mocks__/react-native-purchases.ts` returns `{ current: null }` — doesn't simulate premium state. Tests can't verify premium-gated features.

**Affected Files:**
- `app/__mocks__/react-native-purchases.ts`

**Implementation Steps:**
1. Add configurable mock state: `setPremiumState(true/false)`
2. Mock `getCustomerInfo()` to return appropriate entitlements
3. Mock `purchasePackage()` to simulate purchase flow

**Ripple Effects:** Enables testing premium features in frontend tests.
**Regression Risk:** NONE
**Testing:**
- [ ] Test: premium mock → gated feature visible
- [ ] Test: free mock → gated feature hidden

---

### 10.20 N+1 Query Detection in Tests

**Audit Finding:** #90 from LOW
**Root Cause:** Only manual code review catches N+1 patterns. No automated detection in the test suite.

**Affected Files:**
- `tests/conftest.py` — add query counter fixture
- `tests/test_n_plus_one.py` — new file

**Implementation Steps:**
1. Create a `query_counter` fixture that hooks into SQLAlchemy's `before_cursor_execute` event
2. Add assertions for key endpoints: dashboard (≤10 queries), recipe creation (≤5 queries), feed (≤5 queries)
3. Log query count in test output for monitoring

**Ripple Effects:** None — test-only. **Regression Risk:** NONE.
**Testing:**
- [ ] Query count assertions pass for key endpoints
- [ ] N+1 patterns are caught by the counter

---

### 10.21 Add SAST (Bandit) to CI

**Audit Finding:** #61 from MEDIUM (placed here as it's a CI addition with low urgency)
**Root Cause:** `.github/workflows/ci.yml` has `pip-audit` for dependency vulnerabilities but no static analysis for Python code security patterns (hardcoded secrets, SQL injection, etc.).

**Affected Files:**
- `.github/workflows/ci.yml` — security-scan job

**Implementation Steps:**
1. Add `bandit -r src/ -ll` step to the security-scan job (report medium+ severity)
2. Add `.bandit` config file to exclude test files and known false positives
3. Alternative: use `semgrep` with Python security rules

**Ripple Effects:** May flag existing code patterns. Fix or add `# nosec` comments with justification.
**Regression Risk:** NONE
**Testing:**
- [ ] Run `bandit -r src/ -ll` locally — review and fix findings
- [ ] CI step passes

---

### 10.22 Pin Backend Dependencies

**Audit Finding:** #62 from MEDIUM (placed here — requires careful rollout)
**Root Cause:** `pyproject.toml` uses `>=` version ranges. CI could pass with one version while production installs a different (potentially incompatible) version.

**Affected Files:**
- `pyproject.toml`
- `requirements.lock` — new file (generated by `pip-compile`)

**Implementation Steps:**
1. Install `pip-tools`: `pip install pip-tools`
2. Generate lock file: `pip-compile pyproject.toml -o requirements.lock`
3. In Dockerfile, install from lock file: `pip install -r requirements.lock`
4. In CI, install from lock file
5. Keep `pyproject.toml` with `>=` ranges for development flexibility
6. Add `requirements.lock` to git

**Ripple Effects:** Production installs are now deterministic. Must regenerate lock file when updating dependencies.
**Regression Risk:** LOW
**Testing:**
- [ ] `pip install -r requirements.lock` succeeds
- [ ] All tests pass with locked versions

---
## Dependency Graph

```
Phase 1 (Critical Data Integrity) ──┬──→ Phase 2 (Auth & Security) ──→ Phase 6 (Input Validation)
                                     │
                                     └──→ Phase 8 (Database & Schema)
                                     │
                                     └──→ Phase 5 (Test Gaps) ──→ Phase 9 (More Test Gaps)

Phase 3 (CI/CD & Deployment) ──────────→ Phase 5 (Test Gaps — E2E needs CI)

Phase 4 (Performance & Frontend) ──────→ Phase 7 (More Performance)
                                         Phase 9 (Test Gaps — need perf fixes first)

Phase 10 (Low-Priority Polish) ────────→ No dependencies (can start anytime)
```

Key dependency chains:
- Phase 1 → Phase 8: FK migrations in Phase 1 must land before adding more indexes/constraints in Phase 8
- Phase 1 → Phase 2: Data integrity fixes must precede auth hardening (e.g., cascade deletes before OAuth fixes)
- Phase 2 → Phase 6: Auth security patterns (sanitization, CSP) inform input validation approach
- Phase 4 → Phase 7: N+1 fixes and deep linking must land before frontend performance optimization
- Phase 3 → Phase 5: CI pipeline must be reliable before adding E2E tests to it
- Phase 8: Task 8.2 → Task 8.8: Subscription upsert fix must land before unique constraint on active subscriptions

---

## Database Migration Rollback SOP

If a migration fails in production:

1. **Check Alembic current:** `alembic current` — identify which revision is active
2. **Downgrade one step:** `alembic downgrade -1` — revert the failed migration
3. **If downgrade fails:** Restore from Neon point-in-time recovery (Settings → Branching → Restore)
4. **If data corruption:** Create Neon branch from last known good timestamp, swap `DATABASE_URL` to point to the branch
5. **Always after any incident:**
   - Check Sentry for related errors
   - Notify team via Slack
   - Document what happened in `docs/INCIDENT_LOG.md`
   - Verify application health after recovery: `curl https://<RAILWAY_URL>/api/v1/health`

**Prevention:**
- Every migration in this plan has an explicit rollback plan (downgrade function)
- Test `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` before deploying
- Run migrations during low-traffic windows for schema changes that take ACCESS EXCLUSIVE locks
- Keep migrations backward-compatible: add columns (nullable/default), don't remove/rename

---
## Execution Timeline

| Day | Phase | Tasks | Est. Hours | Cumulative |
|-----|-------|-------|------------|------------|
| 1 | Phase 1 | 1.0 (CI gate fix), 1.1 (cache cleanup), 1.5 (bodyweight upsert), 1.6 (webhook filter) | 8h | 8h |
| 2-3 | Phase 1 | 1.2 (orphan cleanup migration), 1.3 (FK cascade migration) | 8h | 16h |
| 3 | Phase 1 | 1.4 (timezone migration + utcnow replacement) — start | 4h | 20h |
| 4 | Phase 1 | 1.4 (timezone migration — complete + test), Phase 1 Verification Gate | 4h | 24h |
| 5 | Phase 2 | 2.1 (rate limit email), 2.2 (Apple nonce), 2.3 (OAuth state), 2.4 (HTML sanitization) | 8h | 32h |
| 6-7 | Phase 2 | 2.5 (httpOnly cookies — phased rollout, all 3 steps) | 8h | 40h |
| 8 | Phase 3 | 3.1 (rollback), 3.2 (migration order), 3.3 (frontend coverage), 3.4 (npm audit), 3.5 (uptime), 3.6 (notifications) | 8h | 48h |
| 9 | Phase 3 + 4 | 3.7 (Docker multi-stage), 4.1 (N+1 queries), 4.2 (deep linking) | 8h | 56h |
| 10 | Phase 4 | 4.3 (modals), 4.4 (mutationKey), 4.5 (feed query), start Phase 5 | 8h | 64h |
| 11 | Phase 5 | 5.1 (rate limit tests), 5.2 (AnalyticsScreen tests), 5.4 (DR runbook) | 8h | 72h |
| 12-13 | Phase 5 | 5.3 (E2E tests — Maestro install + configure) | 8h | 80h |
| 14-15 | Phase 5 | 5.3 (E2E tests — write 4 flows + CI integration) | 12h | 92h |
| 16 | Phase 6 | 6.1-6.6 (FTS5, rate limiter, follow/batch limits, soft delete filter, CSP) | 8h | 100h |
| 17 | Phase 6 + 7 | 6.7-6.11 (HTML escape, JWT validation, JSONB, photos, docs flag), 7.1 (toISOString) | 8h | 108h |
| 18 | Phase 7 + 8 | 7.2-7.6 (memoization, FlatList, lazy-load), 8.1-8.3 (indexes, upserts) | 8h | 116h |
| 19 | Phase 7 + 8 | 7.7-7.10 (navigation types, Sentry, Railway, a11y), 8.4-8.6 (partial indexes, soft delete) | 8h | 124h |
| 20 | Phase 8 + 9 | 8.7-8.8 (GIN guard, pool size, unique constraint), 9.1-9.3 (payment/offline/checkin tests) | 8h | 132h |
| 21 | Phase 9 | 9.4-9.7 (integration tests, dashboard tests, cleanup) | 8h | 140h |
| 22-23 | Phase 10 | 10.1-10.11 (LOW items — logging, null checks, indexes, Docker, CAPTCHA) | 10h | 150h |
| 24-25 | Phase 10 | 10.12-10.22 (LOW items — email enum, Sentry, a11y, contracts, bundle, deps) | 10h | 160h |

---
## Verification Checklist

After ALL phases complete:
- [ ] All ~1,618 backend tests pass: `.venv/bin/pytest tests/ -v --timeout=120`
- [ ] All ~1,955 frontend tests pass: `cd app && npx jest --passWithNoTests`
- [ ] `cd app && npx tsc --noEmit` — zero TypeScript errors
- [ ] `ruff check src/` — zero linting errors
- [ ] `bandit -r src/ -ll` — zero medium+ security findings
- [ ] `yarn audit --level high` — zero high-severity vulnerabilities
- [ ] Manual smoke test: register → login → log food → log workout → view analytics → logout
- [ ] Cross-user test: Login as User A → log data → logout → login as User B → verify no User A data visible
- [ ] Offline test: disconnect → log food → reconnect → verify data synced
- [ ] Deploy to Railway → health check passes within 30s
- [ ] Alembic migration: `upgrade head` then `downgrade -1` then `upgrade head` — no errors
- [ ] Sentry shows no new errors after deploy
- [ ] UptimeRobot confirms health endpoint responding
- [ ] Accessibility audit: ≥80% label coverage
- [ ] All 4 Maestro E2E flows pass on iOS simulator

---
## Finding Cross-Reference

Every audit finding mapped to its plan task:

| # | Finding | Severity | Plan Task |
|---|---------|----------|-----------|
| 1 | TanStack Query cache not cleared on logout | 🔴 CRITICAL | 1.1 |
| 2 | Active workout + aux stores not cleared on logout | 🔴 CRITICAL | 1.1 |
| 3 | 13 tables missing ForeignKey on user_id | 🔴 CRITICAL | 1.2 + 1.3 |
| 4 | Base model timestamps timezone-naive | 🔴 CRITICAL | 1.4 |
| 5 | CI deploy gate is a no-op | 🔴 CRITICAL | 1.0 |
| 6 | Bodyweight upsert race condition | 🔴 CRITICAL | 1.5 |
| 7 | Soft-deleted subscription reactivated by webhook | 🔴 CRITICAL | 1.6 |
| 8 | resend_verification_by_email no rate limit | 🟠 HIGH | 2.1 |
| 9 | N+1 queries in recipe/meal plan services | 🟠 HIGH | 4.1 |
| 10 | Apple Sign-In nonce optional | 🟠 HIGH | 2.2 |
| 11 | No OAuth state parameter / CSRF | 🟠 HIGH | 2.3 |
| 12 | No HTML sanitization on user content | 🟠 HIGH | 2.4 |
| 13 | Web token storage uses localStorage | 🟠 HIGH | 2.5 |
| 14 | No automated rollback on failed deploy | 🟠 HIGH | 3.1 |
| 15 | Migrations run AFTER deploy | 🟠 HIGH | 3.2 |
| 16 | No frontend coverage enforcement | 🟠 HIGH | 3.3 |
| 17 | No npm audit in frontend CI | 🟠 HIGH | 3.4 |
| 18 | No uptime monitoring | 🟠 HIGH | 3.5 |
| 19 | No disaster recovery runbook | 🟠 HIGH | 5.4 |
| 20 | No deep linking configuration | 🟠 HIGH | 4.2 |
| 21 | 2 modals missing onRequestClose | 🟠 HIGH | 4.3 |
| 22 | 2 useMutation calls missing mutationKey | 🟠 HIGH | 4.4 |
| 23 | 10 ForeignKeys missing ondelete | 🟠 HIGH | 1.3 |
| 24 | No multi-stage Docker build | 🟠 HIGH | 3.7 |
| 25 | Social feed IN subquery slow at scale | 🟠 HIGH | 4.5 |
| 26 | Rate limiting tests entirely SKIPPED | 🟠 HIGH | 5.1 |
| 27 | No AnalyticsScreen test | 🟠 HIGH | 5.2 |
| 28 | No real E2E tests | 🟠 HIGH | 5.3 |
| 29 | Accessibility: 23% label coverage | 🟡 MEDIUM | 7.10 |
| 30 | FTS5 operator injection | 🟡 MEDIUM | 6.1 |
| 31 | Missing indexes on FK columns | 🟡 MEDIUM | 8.1 |
| 32 | Subscription upsert race condition | 🟡 MEDIUM | 8.2 |
| 33 | Device token upsert race condition | 🟡 MEDIUM | 8.3 |
| 34 | Unbounded in-memory rate limiter store | 🟡 MEDIUM | 6.2 |
| 35 | Follow endpoint no rate limit | 🟡 MEDIUM | 6.3 |
| 36 | Batch nutrition endpoint no rate limit | 🟡 MEDIUM | 6.4 |
| 37 | Sharing endpoint ignores soft delete | 🟡 MEDIUM | 6.5 |
| 38 | No Content-Security-Policy header | 🟡 MEDIUM | 6.6 |
| 39 | Sharing OG meta tags not escaped | 🟡 MEDIUM | 6.7 |
| 40 | JWT secret validation only in non-debug | 🟡 MEDIUM | 6.8 |
| 41 | Stale Stripe/Razorpay secrets in settings | 🟡 MEDIUM | 9.6 |
| 42 | passlib[bcrypt] unmaintained and unused | 🟡 MEDIUM | 9.7 |
| 43 | datetime.utcnow() deprecated | 🟡 MEDIUM | 1.4 (combined) |
| 44 | Missing partial indexes on soft-delete tables | 🟡 MEDIUM | 8.4 |
| 45 | Missing composite indexes | 🟡 MEDIUM | 8.5 |
| 46 | JSONB validation gaps | 🟡 MEDIUM | 6.9 |
| 47 | Missing SoftDeleteMixin on user-facing tables | 🟡 MEDIUM | 8.6 |
| 48 | GIN index migration lacks SQLite guard | 🟡 MEDIUM | 8.7 |
| 49 | toISOString() for date formatting (20 occurrences) | 🟡 MEDIUM | 7.1 |
| 50 | DashboardScreen zero useCallback/useMemo | 🟡 MEDIUM | 7.2 |
| 51 | AnalyticsScreen heavy computations every render | 🟡 MEDIUM | 7.3 |
| 52 | AnalyticsScreen 5 useEffects without AbortController | 🟡 MEDIUM | 7.3 |
| 53 | LogsScreen ScrollView instead of FlatList | 🟡 MEDIUM | 7.4 |
| 54 | zxcvbn eagerly imported (400KB+) | 🟡 MEDIUM | 7.5 |
| 55 | BarcodeScanner eagerly imports expo-camera | 🟡 MEDIUM | 7.6 |
| 56 | Progress photos metadata unencrypted | 🟡 MEDIUM | 6.10 |
| 57 | useNavigation<any> loses type safety | 🟡 MEDIUM | 7.7 |
| 58 | Sentry traces_sample_rate too low | 🟡 MEDIUM | 7.8 |
| 59 | No deploy failure notifications | 🟡 MEDIUM | 3.6 |
| 60 | Railway healthcheck timeout too generous | 🟡 MEDIUM | 7.9 |
| 61 | No SAST beyond pip-audit | 🟡 MEDIUM | 10.21 |
| 62 | No pinned dependency versions | 🟡 MEDIUM | 10.22 |
| 63 | Payments module undertested | 🟡 MEDIUM | 9.1 |
| 64 | Offline behavior completely untested | 🟡 MEDIUM | 9.2 |
| 65 | WeeklyCheckinCard untested | 🟡 MEDIUM | 9.3 |
| 66 | No cross-service integration tests | 🟡 MEDIUM | 9.4 |
| 67 | Dashboard tests are shallow | 🟡 MEDIUM | 9.5 |
| 68 | Missing unique constraint on active subscriptions | 🟡 MEDIUM | 8.8 |
| 69 | Pool size hardcoded | 🟡 MEDIUM | 8.8 |
| 70 | Docs endpoint tied to DEBUG flag | 🟡 MEDIUM | 6.11 |
| 71 | Broad exception catch swallows errors | 🟢 LOW | 10.1 |
| 72 | Sharing router fragile null check | 🟢 LOW | 10.2 |
| 73 | FTS5 fetch missing soft delete filter | 🟢 LOW | 10.3 |
| 74 | Unauthenticated exercise search | 🟢 LOW | 10.4 |
| 75 | Unbounded feature flag cache | 🟢 LOW | 10.5 |
| 76 | Missing indexes on low-traffic FK columns | 🟢 LOW | 10.6 |
| 77 | No special character in password policy | 🟢 LOW | 10.7 |
| 78 | CORS allow_credentials with dynamic origins | 🟢 LOW | 10.8 |
| 79 | APScheduler pinned to < 4.0 | 🟢 LOW | 10.9 |
| 80 | No .dockerignore | 🟢 LOW | 10.10 |
| 81 | No CAPTCHA on registration | 🟢 LOW | 10.11 |
| 82 | Email enumeration via email_verified | 🟢 LOW | 10.12 |
| 83 | PostHog/Sentry keys in eas.json | 🟢 LOW | 10.13 |
| 84 | BodyBasicsStep setTimeout without cleanup | 🟢 LOW | 10.14 |
| 85 | Barcode scan history unencrypted | 🟢 LOW | 10.15 |
| 86 | No build artifact caching in mobile CI | 🟢 LOW | 10.16 |
| 87 | No API contract tests | 🟢 LOW | 10.17 |
| 88 | No bundle size budget test | 🟢 LOW | 10.18 |
| 89 | RevenueCat mock too simple | 🟢 LOW | 10.19 |
| 90 | No N+1 query detection in tests | 🟢 LOW | 10.20 |

**Total findings mapped: 90 / 90 ✅**
