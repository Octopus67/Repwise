# Repwise Production Readiness Audit

**Date:** April 5, 2026
**Auditor:** Automated Deep Audit (6 parallel agents)
**Scope:** Backend, Frontend, Database, CI/CD, Security, Tests

---

## Executive Summary

**Overall Readiness Score: 6.5 / 10**

The application has strong fundamentals — comprehensive error handling, JWT blacklisting, property-based testing, and good module separation. However, several critical issues around data integrity, user data isolation, and GDPR compliance must be resolved before launch.

### Top 5 Critical Items — MUST Fix Before Launch

1. **Cross-user data leak on logout** — TanStack Query cache, active workout, and auxiliary Zustand stores are not cleared on logout. The next user sees the previous user's cached data. (`app/components/profile/AccountSection.tsx:48-52`)
2. **Orphaned PII after account deletion** — 13 tables lack ForeignKey constraints on `user_id`, so `CASCADE` deletion doesn't reach nutrition entries, training sessions, or subscriptions. GDPR violation. (`src/modules/nutrition/models.py`, `src/modules/training/models.py`)
3. **Base model timestamps are timezone-naive** — `created_at`/`updated_at` on ALL 40+ tables use `DateTime` without `timezone=True`, causing comparison bugs with timezone-aware code. (`src/shared/base_model.py`)
4. **CI deploy gate is a no-op** — The `ci-gate` job in `deploy.yml` just echoes "passed" without actually verifying CI status. Broken code can deploy to production if branch protection is misconfigured. (`.github/workflows/deploy.yml:20-25`)
5. **Missing unique constraint on bodyweight_logs** — Upsert logic uses SELECT-then-INSERT without `FOR UPDATE` or a unique constraint. Concurrent requests create duplicate entries. (`src/modules/user/service.py:196-207`)

### Top 5 Items — Fix Within First Month

1. **Accessibility: 23% label coverage** — Only 213 of 921 interactive elements have `accessibilityLabel`. 15+ screens have zero labels.
2. **No uptime monitoring** — No external health check configured. If Railway crashes after max retries, nobody is notified.
3. **Rate limiting tests entirely skipped** — `test_rate_limiting.py` is skipped at module level due to Redis migration. Zero test coverage on rate limiting.
4. **No automated rollback on failed deploy** — Failed health checks leave broken deployments live.
5. **No frontend coverage enforcement** — Backend enforces 80% coverage threshold; frontend has no threshold despite 1,930 tests.

---

## Findings by Severity

### 🔴 CRITICAL (must fix before launch)

**1. Cross-user data leak on logout — TanStack Query cache not cleared**
- **File:** `app/components/profile/AccountSection.tsx:48-52`
- **Source:** Frontend audit
- Logout calls `secureClear()` and `store.clearAuth()` but never calls `queryClient.clear()`. The MMKV-persisted TanStack Query cache retains the previous user's nutrition entries, training sessions, and analytics data. The next user who logs in sees stale data from the previous account.
- **Fix:** Import `queryClient` and call `queryClient.clear()` in the logout flow before or after `clearAuth()`.

**2. Cross-user data leak — Active workout and auxiliary stores not cleared on logout**
- **Files:** `app/store/activeWorkoutSlice.ts:519`, `app/store/tooltipStore.ts:38`, `app/store/workoutPreferencesStore.ts:51`, `app/store/onboardingSlice.ts:124`
- **Source:** Frontend audit
- Active workout state is persisted in AsyncStorage and never discarded on logout. Tooltip, workout preferences, and onboarding stores are also persisted and not cleared. User A's in-progress workout could appear for User B.
- **Fix:** Call `useActiveWorkoutStore.getState().discardWorkout()` during logout. Clear or namespace all persisted Zustand stores by user ID.

**3. Orphaned PII after account deletion — 13 tables missing ForeignKey on user_id**
- **Files:** `src/modules/nutrition/models.py:28`, `src/modules/training/models.py:37`, `src/modules/payments/models.py`, `src/modules/adaptive/models.py`, `src/modules/achievements/models.py`, `src/modules/health_reports/models.py`
- **Source:** Database audit + Security audit
- `nutrition_entries`, `training_sessions`, `subscriptions`, `adaptive_snapshots`, `user_achievements`, `achievement_progress`, `health_reports`, `payment_transactions`, `recovery_checkins`, `readiness_scores`, `workout_templates`, `password_reset_codes`, `email_verification_codes` — all have `user_id` columns that are NOT declared as `ForeignKey("users.id")`. When `permanently_delete_expired_accounts()` calls `session.delete(user)`, CASCADE doesn't reach these tables. Nutrition entries (dietary preferences) and training sessions (health data) are sensitive under GDPR.
- **Fix:** Add Alembic migration: `ForeignKey("users.id", ondelete="CASCADE")` to all 13 tables. Alternatively, add explicit deletion of all related tables in `permanently_delete_expired_accounts()`.

**4. Base model timestamps are timezone-naive**
- **File:** `src/shared/base_model.py`
- **Source:** Database audit
- `created_at` and `updated_at` use `DateTime` without `timezone=True` and `func.now()`. PostgreSQL stores these as `TIMESTAMP WITHOUT TIME ZONE`. Comparing with `datetime.now(timezone.utc)` causes bugs. Affects ALL 40+ tables.
- **Fix:** Change to `mapped_column(DateTime(timezone=True), server_default=func.now())`. Create Alembic migration to alter existing columns.

**5. CI deploy gate is a no-op**
- **File:** `.github/workflows/deploy.yml:20-25`
- **Source:** CI/CD audit
- The `ci-gate` job runs `echo "CI checks passed"` without verifying actual CI workflow status. If GitHub branch protection is misconfigured or bypassed, broken code deploys to production.
- **Fix:** Use `actions/github-script` to poll for CI check status, or use `workflow_run` trigger instead of `push` trigger.

**6. Bodyweight upsert race condition — no unique constraint**
- **File:** `src/modules/user/service.py:196-207`
- **Source:** Backend audit
- SELECT then UPDATE/INSERT without `SELECT ... FOR UPDATE`. Two concurrent requests for the same date create duplicate entries. No database-level unique constraint exists on `(user_id, recorded_date)`.
- **Fix:** Add `UniqueConstraint("user_id", "recorded_date")` to `bodyweight_logs` model. Use `INSERT ... ON CONFLICT DO UPDATE`.

**7. Soft-deleted subscription reactivated by webhook**
- **File:** `src/modules/payments/service.py:240-244`
- **Source:** Backend audit
- `_process_webhook_event` queries `select(Subscription).where(provider_subscription_id == ...)` without `deleted_at IS NULL` filter. A webhook event could match and reactivate a soft-deleted subscription.
- **Fix:** Add `.where(Subscription.deleted_at.is_(None))` to the query.

### 🟠 HIGH (fix within first week)

**8. Unauthenticated email spam — resend_verification_by_email has no rate limit**
- **File:** `src/modules/auth/router.py:245`
- **Source:** Backend audit
- Unauthenticated endpoint that sends emails with no rate limiting. Attacker can spam email sends at scale.
- **Fix:** Add `check_forgot_password_rate_limit(data.email)` or equivalent.

**9. N+1 queries in recipe/meal plan services**
- **Files:** `src/modules/food_database/service.py:638-655, 761-780`, `src/modules/meal_plans/service.py:296-315`
- **Source:** Backend audit
- Recipe creation/update loops over ingredients with per-ingredient DB lookups (40+ queries for 20 ingredients). Shopping list generation does the same (42+ queries for a 7-day plan).
- **Fix:** Batch-fetch all ingredient food items in one query. Use `selectinload` for recipe ingredients.

**10. Apple Sign-In nonce validation is optional**
- **File:** `src/modules/auth/service.py:157-162`
- **Source:** Security audit (OWASP A07:2021)
- Nonce verification is conditional: `if data and getattr(data, 'nonce', None)`. Without nonce, tokens are accepted without replay protection.
- **Fix:** Make nonce mandatory: `if not data or not data.nonce: raise UnauthorizedError("Nonce required")`.

**11. No OAuth state parameter / CSRF protection**
- **File:** `src/modules/auth/router.py:109-116`
- **Source:** Security audit (OWASP A07:2021)
- OAuth flow accepts tokens directly without a `state` parameter. Web clients are vulnerable to CSRF.
- **Fix:** Implement state parameter flow for web clients. Document mobile-only exception.

**12. No HTML sanitization on user-generated content**
- **Files:** `src/modules/training/schemas.py:354`, `src/modules/nutrition/models.py:30`
- **Source:** Security audit (OWASP A03:2021)
- Exercise names, food names, and article content have max_length but no HTML/script stripping. The sharing endpoint renders HTML directly.
- **Fix:** Add `bleach.clean()` or `strip_tags()` validator on all user-facing string fields.

**13. Web token storage uses localStorage (XSS-vulnerable)**
- **File:** `app/utils/secureStorage.ts:7`
- **Source:** Security audit (OWASP A07:2021)
- On web, JWT tokens are stored in `localStorage` which is accessible to any XSS attack. Mobile uses SecureStore (encrypted keychain).
- **Fix:** Use `httpOnly` cookies for web, or implement a BFF pattern. Document reduced security guarantees for web.

**14. No automated rollback on failed deploy**
- **File:** `.github/workflows/deploy.yml`
- **Source:** CI/CD audit
- If health check fails after 10 attempts, the workflow errors but the broken deployment stays live.
- **Fix:** Add rollback step: `railway rollback` or redeploy previous commit on health check failure.

**15. Migrations run AFTER deploy**
- **File:** `.github/workflows/deploy.yml`
- **Source:** CI/CD audit
- New code requiring new DB columns runs against old schema during the migration window. If migration fails, incompatible code is already deployed.
- **Fix:** Run migrations BEFORE deploy (requires separate DB access), or use blue-green deployment.

**16. No frontend coverage enforcement**
- **File:** `.github/workflows/ci-frontend.yml`
- **Source:** CI/CD audit
- Backend has `--cov-fail-under=80` but frontend Jest runs without any coverage threshold. Coverage could silently regress.
- **Fix:** Add `--coverage --coverageThreshold='{"global":{"branches":70,"functions":70,"lines":80}}'`.

**17. No npm audit in frontend CI**
- **File:** `.github/workflows/ci-frontend.yml`
- **Source:** CI/CD audit
- Backend has `pip-audit` but frontend has no `yarn audit` step. React Native apps have large dependency trees.
- **Fix:** Add `yarn audit --level high` step.

**18. No uptime monitoring**
- **Source:** CI/CD audit
- No external health check configured. If Railway crashes after max retries, nobody is notified.
- **Fix:** Set up UptimeRobot (free) or BetterStack to ping `/api/v1/health` every 5 minutes.

**19. No disaster recovery runbook**
- **Source:** CI/CD audit
- `tasks/phase1-runbook.md` covers launch setup but not "what to do when production is down."
- **Fix:** Create `docs/DISASTER_RECOVERY.md` covering Railway outage, Neon outage, corrupted deploy, data loss scenarios.

**20. No deep linking configuration**
- **File:** `app/App.tsx:344`
- **Source:** Frontend audit
- `<NavigationContainer>` has no `linking` prop. Shared template links (`/shared/{share_code}`) won't work from external sources.
- **Fix:** Add linking config with URL scheme and path mappings.

**21. 2 Modals missing onRequestClose (Android back button broken)**
- **Files:** `app/components/training/SimpleModeDiscoveryModal.tsx:45`, `app/components/common/PickerField.tsx:55`
- **Source:** Frontend audit
- On Android, pressing hardware back button does nothing. Users are trapped in these modals.
- **Fix:** Add `onRequestClose={onClose}` / `onRequestClose={() => setVisible(false)}`.

**22. 2 useMutation calls missing mutationKey (offline persistence broken)**
- **Files:** `app/components/social/ReactionButton.tsx:19`, `app/screens/settings/ImportDataScreen.tsx:42,55`
- **Source:** Frontend audit
- Reactions and import operations will be lost if app restarts offline. Per project docs: "Use `useMutation` with `mutationKey` for ANY write that should survive offline."
- **Fix:** Add `mutationKey` to all useMutation calls.

**23. Missing ondelete on 10 ForeignKey definitions**
- **Files:** `src/modules/coaching/models.py`, `src/modules/content/models.py`, `src/modules/training/models.py`
- **Source:** Database audit
- `coach_profiles`, `coaching_requests`, `coaching_sessions`, `content_articles`, `article_versions`, `article_favorites`, `custom_exercises`, `personal_records`, `user_volume_landmarks` — ForeignKeys exist but lack `ondelete` specification (defaults to RESTRICT).
- **Fix:** Add `ondelete="CASCADE"` (or `SET NULL` where appropriate) to each FK.

**24. No multi-stage Docker build**
- **File:** `Dockerfile`
- **Source:** CI/CD audit
- Build tools (`gcc`, `libpq-dev`) remain in the final image, increasing size and attack surface.
- **Fix:** Use multi-stage build: stage 1 builds wheels, stage 2 copies only wheels into clean slim image.

**25. Social feed query — IN subquery will be slow at scale**
- **File:** `src/modules/social/service.py:96-107`
- **Source:** Database audit
- `IN (subquery)` on `feed_events` scans all events for all followed users. At 10K users with 50 follows each = 10M feed_events.
- **Fix:** Use JOIN instead of `IN`, add `LIMIT` to subquery, or consider materialized feed at >10K users.

**26. Rate limiting tests entirely SKIPPED**
- **File:** `tests/test_rate_limiting.py`
- **Source:** Tests audit
- Entire test file skipped at module level due to Redis migration. Rate limiting has ZERO test coverage.
- **Fix:** Add Redis mock using `fakeredis` or test against in-memory fallback.

**27. No AnalyticsScreen test**
- **Source:** Tests audit
- The most data-heavy frontend screen has zero test coverage. No rendering, interaction, or data flow tests.
- **Fix:** Add `AnalyticsScreen.test.tsx` covering tab switching, time range selection, chart rendering.

**28. No real E2E tests**
- **Source:** Tests audit
- Frontend "e2e" tests are pure-logic simulations, not actual Detox/Maestro device tests.
- **Fix:** Add Detox or Maestro E2E suite for critical flows (login → log food → log workout → view analytics).

### 🟡 MEDIUM (fix within first month)

**29. Accessibility: 23% label coverage (213/921 interactive elements)**
- **Files:** `app/components/modals/AddTrainingModal.tsx` (21 elements, 0 labels), `app/screens/logs/LogsScreen.tsx` (19, 0), `app/screens/meal-prep/PrepSundayFlow.tsx` (17, 0), `app/components/profile/PlanEditFlow.tsx` (17, 0), `app/components/nutrition/BarcodeScanner.tsx` (17, 0), and 10+ more screens
- **Source:** Frontend audit
- **Fix:** Add `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` to all interactive elements. Prioritize the 15 worst-offending files listed above.

**30. FTS5 operator injection**
- **File:** `src/modules/food_database/service.py:226`
- **Source:** Backend audit
- FTS5 sanitization strips special chars but NOT `:` or `AND`/`OR`/`NOT` operators. A query like `chicken AND NOT healthy` passes through to MATCH.
- **Fix:** Add `re.sub(r'\b(AND|OR|NOT|NEAR)\b', ' ', safe_query, flags=re.IGNORECASE)` or double-quote each token.

**31. Missing indexes on FK columns**
- **Files:** `src/modules/adaptive/models.py:66` (`coaching_suggestions.snapshot_id`), `src/modules/food_database/models.py:55` (`food_items.created_by`)
- **Source:** Backend audit
- No index on these FK columns. CASCADE deletes and creator-filtered queries will full-scan.
- **Fix:** Add `index=True` to both columns.

**32. Subscription upsert race condition**
- **File:** `src/modules/payments/service.py:170-188`
- **Source:** Backend audit
- `_get_or_create_subscription`: SELECT then INSERT without locking. Concurrent webhook events could create duplicate subscriptions.
- **Fix:** Use `INSERT ... ON CONFLICT` or `SELECT ... FOR UPDATE`.

**33. Device token upsert race condition**
- **File:** `src/modules/notifications/service.py:48-70`
- **Source:** Backend audit
- SELECT by token then UPDATE/INSERT. Concurrent registrations could create duplicates.
- **Fix:** Use `INSERT ... ON CONFLICT (token) DO UPDATE`.

**34. Unbounded in-memory rate limiter store**
- **File:** `src/middleware/rate_limiter.py:24`
- **Source:** Backend audit
- `_mem_store: dict[str, list[float]]` — no eviction of expired keys. Under sustained attack, keys accumulate without bound.
- **Fix:** Add periodic cleanup of empty keys, or cap dict size.

**35. Follow endpoint has no per-user rate limit**
- **File:** `src/modules/social/router.py:39`
- **Source:** Backend audit
- Could be abused for follow/unfollow spam.
- **Fix:** Add `check_user_endpoint_rate_limit(user.id, "social:follow", 30, 60)`.

**36. Batch nutrition endpoint has no rate limit**
- **File:** `src/modules/nutrition/router.py:114`
- **Source:** Backend audit
- Batch endpoint could flood the database.
- **Fix:** Add per-user rate limit (e.g., 10 batch calls/min).

**37. Sharing endpoint user lookup ignores soft delete**
- **File:** `src/modules/sharing/service.py:87`
- **Source:** Backend audit
- `select(User).where(User.id == session.user_id)` — no soft delete filter. Could return a deleted user's email.
- **Fix:** Add `User.not_deleted(stmt)`.

**38. No Content-Security-Policy header**
- **File:** `src/middleware/security_headers.py`
- **Source:** Security audit (OWASP A05:2021)
- Security headers include X-Frame-Options, HSTS, etc. but no CSP.
- **Fix:** Add `Content-Security-Policy: default-src 'self'; script-src 'none'; style-src 'unsafe-inline'` for HTML endpoints.

**39. Sharing endpoint OG meta tags not fully escaped**
- **File:** `src/modules/sharing/router.py:79,85`
- **Source:** Security audit (OWASP A03:2021)
- `description` variable interpolated into `<meta>` tags without `html.escape()`. Currently numeric but could become XSS vector.
- **Fix:** Apply `html_mod.escape()` to all interpolated values.

**40. JWT secret validation only in non-debug mode**
- **File:** `src/config/settings.py:88-94`
- **Source:** Security audit (OWASP A07:2021)
- Default `JWT_SECRET = "change-me-in-production"` accepted when `DEBUG=true`. If production accidentally sets `DEBUG=true`, weak secret is used.
- **Fix:** Reject default secret regardless of DEBUG mode, or use separate `ENVIRONMENT` variable.

**41. Stale Stripe/Razorpay secrets in settings**
- **File:** `src/config/settings.py:64-65`
- **Source:** Security audit + Backend audit
- `STRIPE_WEBHOOK_SECRET` and `RAZORPAY_WEBHOOK_SECRET` still defined as defaults despite being replaced by RevenueCat. Dead code that confuses developers.
- **Fix:** Remove these settings entirely.

**42. passlib[bcrypt] is unmaintained and unused**
- **File:** `pyproject.toml:17`
- **Source:** Security audit + Backend audit
- Listed as dependency but code uses `bcrypt` directly. passlib last released 2020.
- **Fix:** Remove `passlib[bcrypt]` from dependencies.

**43. `datetime.utcnow()` deprecated usage**
- **File:** `src/middleware/db_rate_limiter.py:22,59`
- **Source:** Database audit
- Deprecated in Python 3.12. Returns naive datetime.
- **Fix:** Replace with `datetime.now(timezone.utc)`.

**44. Missing partial indexes on soft-delete tables**
- **Tables:** `workout_templates`, `custom_meals`, `meal_plans`
- **Source:** Database audit
- These soft-delete tables lack partial indexes on `deleted_at IS NULL` that other tables have.
- **Fix:** Add partial indexes via Alembic migration.

**45. Missing composite indexes for common query patterns**
- **Tables:** `payment_transactions(user_id, created_at)`, `notification_log(user_id, read_at)`, `coaching_requests(user_id, created_at)`, `body_measurements(user_id, measured_at DESC)`
- **Source:** Database audit
- **Fix:** Add composite indexes via Alembic migration.

**46. JSONB validation gaps**
- **Tables:** `meal_plans.slot_splits`, `coaching_requests.progress_data`, `coaching_sessions.document_urls`
- **Source:** Database audit
- NOT NULL JSONB columns without schema validation. Potential for malformed/oversized data.
- **Fix:** Add `validate_json_size` to schemas.

**47. Missing SoftDeleteMixin on user-facing tables**
- **Tables:** `coaching_requests`, `coaching_sessions`, `body_measurements`, `recomp_measurements`
- **Source:** Database audit
- User-submitted data should be recoverable.
- **Fix:** Add `SoftDeleteMixin` and `deleted_at` column.

**48. GIN index migration lacks SQLite dialect check**
- **File:** `g1b2_add_gin_indexes.py`
- **Source:** Database audit
- PostgreSQL-only GIN indexes will fail on SQLite if migration is run in dev.
- **Fix:** Add `if conn.dialect.name == 'sqlite': return` guard.

**49. toISOString() used for date formatting (20 occurrences)**
- **Files:** AnalyticsScreen (6), LogsScreen (3), DashboardScreen (1), ExerciseHistoryScreen (2), LeaderboardScreen (1), WeeklyReportScreen (1), and 6 more
- **Source:** Frontend audit
- `new Date().toISOString().split('T')[0]` returns UTC date, not local date. At 11:30 PM EST, returns tomorrow's date.
- **Fix:** Use local date helper per project rules.

**50. DashboardScreen: zero useCallback/useMemo, inline handlers everywhere**
- **File:** `app/screens/dashboard/DashboardScreen.tsx`
- **Source:** Frontend audit
- 345-line component with 0 `useCallback` or `useMemo`. Inline arrow functions recreated every render.
- **Fix:** Wrap handlers in `useCallback`, memoize computed values with `useMemo`.

**51. AnalyticsScreen: heavy computations on every render**
- **File:** `app/screens/analytics/AnalyticsScreen.tsx:262-272`
- **Source:** Frontend audit
- `filterByTimeRange()` called 3 times and `computeEMA()` once on every render without `useMemo`.
- **Fix:** Wrap in `useMemo` with appropriate deps.

**52. AnalyticsScreen: 5 useEffects without AbortController cleanup**
- **File:** `app/screens/analytics/AnalyticsScreen.tsx:242-260`
- **Source:** Frontend audit
- Async API calls in useEffect without AbortController. State updates on unmounted component if user navigates away.
- **Fix:** Add AbortController to each useEffect.

**53. LogsScreen nutrition tab uses ScrollView instead of FlatList**
- **File:** `app/screens/logs/LogsScreen.tsx:434-537`
- **Source:** Frontend audit
- Renders all nutrition entries at once instead of virtualizing.
- **Fix:** Replace with `<FlatList>`.

**54. @zxcvbn-ts/core eagerly imported (400KB+)**
- **File:** `app/utils/passwordStrength.ts:1`
- **Source:** Frontend audit
- Only needed on auth screens but statically imported, bloating initial bundle.
- **Fix:** Use dynamic `import()`.

**55. BarcodeScanner eagerly imports expo-camera**
- **File:** `app/components/nutrition/BarcodeScanner.tsx:25`
- **Source:** Frontend audit
- Heavy native module imported even when scanner is never used.
- **Fix:** Lazy-load with `React.lazy()`.

**56. Progress photos metadata in unencrypted AsyncStorage**
- **Files:** `app/screens/profile/ProgressPhotosScreen.tsx:47,112,134`
- **Source:** Frontend audit
- Body progress photos are sensitive personal data stored unencrypted.
- **Fix:** Use SecureStore for photo metadata or encrypt before storing.

**57. `useNavigation<any>` loses type safety (3 occurrences)**
- **Files:** `app/screens/profile/ProfileScreen.tsx:44`, `app/screens/analytics/AnalyticsScreen.tsx:77`, `app/components/profile/BodyStatsSection.tsx:101`
- **Source:** Frontend audit
- **Fix:** Use typed navigation: `useNavigation<NativeStackNavigationProp<StackParamList>>()`.

**58. Sentry traces_sample_rate too low for launch**
- **File:** `src/main.py:207`
- **Source:** CI/CD audit
- 10% sampling misses 90% of performance traces during critical launch period.
- **Fix:** Increase to 50% for launch, reduce after stabilization.

**59. No deploy failure notifications**
- **Source:** CI/CD audit
- Deploy failures only visible in GitHub Actions UI.
- **Fix:** Add Slack/Discord webhook notification on deploy failure.

**60. Railway healthcheck timeout too generous (120s)**
- **File:** `railway.toml`
- **Source:** CI/CD audit
- 2 minutes to respond to a simple JSON health check. Hung app goes undetected.
- **Fix:** Reduce to 30 seconds.

**61. No SAST beyond pip-audit**
- **File:** `.github/workflows/ci.yml`
- **Source:** CI/CD audit
- No Bandit or Semgrep for Python code security patterns.
- **Fix:** Add `bandit -r src/` step to security-scan job.

**62. No pinned dependency versions (backend)**
- **File:** `pyproject.toml`
- **Source:** CI/CD audit + Security audit
- Uses `>=` ranges. CI could pass with one version, prod installs different version.
- **Fix:** Use `pip-compile` for deterministic production builds.

**63. Payments module undertested**
- **Source:** Tests audit
- No test for `/payments/status` endpoint, cancel flow, or RevenueCat entitlement check.
- **Fix:** Add integration tests for subscription lifecycle.

**64. Offline behavior completely untested**
- **Source:** Tests audit
- NetInfo mock always returns `isConnected: true`. TanStack Query mutation queue never tested offline.
- **Fix:** Add tests with NetInfo mock returning offline state.

**65. WeeklyCheckinCard untested**
- **Source:** Tests audit
- The adaptive engine's primary user-facing component has no frontend test.
- **Fix:** Add `WeeklyCheckinCard.test.tsx`.

**66. No cross-service integration tests**
- **Source:** Tests audit
- No test verifies: log workout → triggers achievement → updates feed → appears in leaderboard.
- **Fix:** Add integration test for the full event chain.

**67. Dashboard tests are shallow (smoke only)**
- **File:** `tests/test_dashboard_smoke.py`
- **Source:** Tests audit
- Only checks status codes and key presence. No business logic validation.
- **Fix:** Add assertions for computed macro totals, EMA smoothing, streak calculation.

**68. Missing unique constraint on active subscriptions**
- **Table:** `subscriptions`
- **Source:** Database audit
- Multiple active subscriptions possible per user.
- **Fix:** Add partial unique index `WHERE status IN ('active', 'trialing') AND deleted_at IS NULL`.

**69. Pool size hardcoded**
- **File:** `src/config/database.py`
- **Source:** Database audit
- `pool_size=5, max_overflow=10` hardcoded. At 8+ Gunicorn workers, exceeds Neon's 100 connection limit.
- **Fix:** Make configurable via environment variables.

**70. Docs endpoint tied to DEBUG flag**
- **File:** `src/main.py:139-141`
- **Source:** Security audit (OWASP A05:2021)
- If production accidentally enables DEBUG, full API schema is exposed.
- **Fix:** Use separate `ENABLE_DOCS` flag independent of DEBUG.

### 🟢 LOW (nice to have)

**71. Broad exception catch in food search swallows errors**
- **File:** `src/modules/food_database/service.py:126`
- Catches `(SQLAlchemyError, TypeError, ValueError)` silently. **Fix:** Log exception before returning empty results.

**72. Sharing router fragile null check on request**
- **File:** `src/modules/sharing/router.py:32`
- `request: Request = None  # type: ignore` — if None, `request.client.host` raises AttributeError. **Fix:** Add explicit null check.

**73. FTS5 fetch SQL missing soft delete filter**
- **File:** `src/modules/food_database/service.py:265-280`
- PostgreSQL fallback path may return soft-deleted food items. **Fix:** Add `AND deleted_at IS NULL`.

**74. Unauthenticated exercise search endpoint**
- **File:** `src/modules/training/router.py:58`
- Low data sensitivity but enables scraping. **Fix:** Add `get_current_user_optional` or rate limit by IP.

**75. Unbounded feature flag cache**
- **File:** `src/modules/feature_flags/service.py:36`
- Expired entries only evicted on read. **Fix:** Add LRU with 1000 entries or periodic sweep.

**76. Missing indexes on low-traffic FK columns**
- **Files:** `src/modules/meal_plans/models.py:52` (`meal_plan_items.food_item_id`), `src/modules/meals/models.py:55` (`meal_favorites.meal_id`)
- **Fix:** Add index if queries become slow.

**77. No special character requirement in password policy**
- **File:** `src/modules/auth/schemas.py:29-36`
- **Fix:** Consider adding or integrating zxcvbn server-side.

**78. CORS allow_credentials with dynamic origins**
- **File:** `src/main.py:165`
- **Fix:** Audit production CORS_ORIGINS to ensure minimal list.

**79. APScheduler pinned to < 4.0 (maintenance mode)**
- **File:** `pyproject.toml:24`
- **Fix:** Consider upgrading when APScheduler 4.x is stable.

**80. No .dockerignore**
- Build context may include unnecessary files. **Fix:** Create `.dockerignore` excluding `app/`, `tests/`, `docs/`, `.git/`.

**81. No CAPTCHA on registration**
- **File:** `src/modules/auth/router.py:68`
- Rate limiting exists but no CAPTCHA. Automated account creation possible with IP rotation. **Fix:** Add reCAPTCHA or hCaptcha.

**82. Minor email enumeration via email_verified field**
- **File:** `src/modules/auth/schemas.py`
- `email_verified` in LoginResponse could leak account existence. **Fix:** Consider removing from response.

**83. PostHog API key in eas.json**
- **File:** `app/eas.json:12-13`
- Client-side key (designed to be public) but Sentry DSN contains auth token. **Fix:** Configure allowed origins in Sentry dashboard.

**84. BodyBasicsStep setTimeout without cleanup**
- **File:** `app/screens/onboarding/steps/BodyBasicsStep.tsx:62`
- Short timer with optional chaining, low risk. **Fix:** Store ref and clear on cleanup.

**85. Barcode scan history in unencrypted AsyncStorage**
- **File:** `app/components/nutrition/FoodSearchPanel.tsx:59,95`
- Low sensitivity but reveals dietary habits. **Fix:** Consider encrypting.

**86. No build artifact caching in mobile CI**
- **File:** `.github/workflows/build-mobile.yml`
- Node modules installed twice (test + build jobs). **Fix:** Use `actions/cache`.

**87. No API contract tests**
- **Source:** Tests audit
- No schema validation ensuring API responses match TypeScript types. **Fix:** Add contract tests.

**88. No bundle size budget test**
- **Source:** Tests audit
- No test ensures frontend bundle stays under size budget. **Fix:** Add size check.

**89. RevenueCat mock too simple for premium testing**
- **File:** `app/__mocks__/react-native-purchases.ts`
- Returns `{ current: null }` — doesn't simulate premium state. **Fix:** Add configurable mock.

**90. No N+1 query detection in tests**
- **Source:** Tests audit
- Only manual code review catches N+1 patterns. **Fix:** Add query count assertions for key endpoints.

---

## Category Deep Dives

### Backend Architecture

**Strengths:**
- Consistent module pattern (`router.py` → `service.py` → `models.py` → `schemas.py`) across all 25 modules
- No bare `except:` clauses — all handlers catch specific types
- Consistent error shapes via `ApiError` subclasses from `src/shared/errors.py`
- No raw SQL with string interpolation — all use `:param` bindings
- Pydantic schemas on all request bodies
- FTS5 MATCH expression sanitized via regex

**Key Issues:**
- 3 N+1 query patterns in recipe creation (`service.py:638-655`), recipe update (`service.py:761-780`), and shopping list generation (`meal_plans/service.py:296-315`) — each doing 40+ queries for batch operations
- Bodyweight upsert race condition (`user/service.py:196-207`) — SELECT then INSERT without locking
- Unbounded in-memory rate limiter store (`middleware/rate_limiter.py:24`) — memory leak under sustained attack
- `resend_verification_by_email` endpoint has no rate limiting — email spam vector
- `passlib[bcrypt]` dependency is unmaintained (last release 2020) and unused — code uses `bcrypt` directly

### Frontend Architecture

**Strengths:**
- Error boundaries on all 4 tab stacks + root level with Sentry integration
- Only 3 `as any` in production code (all justified)
- Extensive `React.lazy()` usage — 20+ screens lazy-loaded
- JWT tokens use SecureStore on mobile (encrypted keychain)
- TanStack Query + MMKV persistence properly wired for offline support

**Key Issues:**
- TanStack Query cache NOT cleared on logout — cross-user data leak (`AccountSection.tsx:48-52`)
- Active workout + 3 auxiliary Zustand stores persisted in AsyncStorage, not cleared on logout
- 23% accessibility label coverage (213/921 interactive elements)
- 20 occurrences of `toISOString()` for date formatting — timezone bugs per project rules
- DashboardScreen (345 lines) has zero `useCallback`/`useMemo` — all handlers recreated every render
- No deep linking configuration — shared template links won't work externally

### Database & Schema

**Strengths:**
- Well-indexed core tables: `nutrition_entries(user_id, entry_date DESC)`, `training_sessions(user_id, session_date DESC)`, `feed_events(user_id, created_at)` with partial indexes on `deleted_at IS NULL`
- GIN indexes on 4 key JSONB columns (exercises, micro_nutrients, preferences, tags)
- Cursor-based pagination for feed (not OFFSET)
- `pool_pre_ping=True` handles Neon's idle connection termination
- All 35 Alembic migrations have downgrade functions

**Key Issues:**
- 13 tables missing `ForeignKey` on `user_id` — no referential integrity, orphaned rows on user deletion
- Base model timestamps (`created_at`, `updated_at`) are timezone-naive across ALL 40+ tables
- Missing unique constraint on `bodyweight_logs(user_id, recorded_date)` — race condition
- 10 ForeignKeys missing `ondelete` specification (defaults to RESTRICT)
- `datetime.utcnow()` used in `db_rate_limiter.py` — deprecated in Python 3.12
- Connection pool hardcoded at 5+10 — will exceed Neon's 100 limit at 8+ workers

### Security Posture

**Strengths:**
- JWT blacklist checked on every request (`authenticate.py:53-58`)
- Timing attack prevention with `DUMMY_HASH` for non-existent users
- Password reset: 6-digit OTP, bcrypt-hashed, 10-minute expiry, single-use
- Account lockout on failed login attempts (Redis-backed + in-memory fallback)
- Algorithm pinning prevents JWT algorithm confusion attacks
- All resource endpoints scope to authenticated user (no IDOR vulnerabilities found)
- File upload validation: magic bytes, 10MB limit, 8000px max, content-type whitelist
- Path traversal prevention on both upload and download
- GDPR: account deletion with 30-day grace period, data export in JSON/CSV/PDF

**Key Issues (OWASP references):**
- **A01:2021 Broken Access Control** — Orphaned PII after account deletion due to missing CASCADE constraints
- **A03:2021 Injection** — No HTML sanitization on user-generated content (exercise names, food names). FTS5 operator injection possible.
- **A05:2021 Security Misconfiguration** — No Content-Security-Policy header. Stale Stripe/Razorpay secrets in settings. Docs endpoint tied to DEBUG flag.
- **A07:2021 Authentication Failures** — Apple Sign-In nonce optional. No OAuth state parameter. Web tokens in localStorage (XSS-vulnerable). JWT secret validation only in non-debug mode.
- **A06:2021 Vulnerable Components** — passlib unmaintained, no backend lock file, no npm audit in frontend CI.

### CI/CD & Deployment

**Strengths:**
- Backend CI comprehensive: 8 jobs (lint, typecheck, security scan, unit tests, property tests, coverage >80%, migration round-trip, PR size)
- Frontend CI: 3 jobs (lint, typecheck, tests)
- `pip-audit --strict --desc` on every CI run
- Non-root Docker user, no secrets baked in, `--no-cache-dir` for pip
- Sentry integration across app + all 7 cron jobs
- Mobile build pipeline with pre-build tests and conditional store submission
- `.env` properly gitignored with production validators in `settings.py`

**Key Issues:**
- CI deploy gate is a no-op — `echo "CI checks passed"` without actual verification
- No automated rollback on failed health check — broken deployments stay live
- Migrations run AFTER deploy — schema mismatch window
- No frontend coverage enforcement (backend has 80% threshold)
- No npm audit for frontend dependencies
- No uptime monitoring configured
- No disaster recovery runbook
- No multi-stage Docker build — build tools in final image
- No deploy failure notifications

### Test Strategy & Coverage

**Strengths:**
- 1,634 backend test functions + 1,930 frontend test cases
- Exceptional property-based testing: 38 Hypothesis files (backend) + 63 fast-check files (frontend)
- Strong lifecycle integration suite: 6 phases, 4 personas, 28-day simulation
- Excellent test isolation: in-memory DB, auto-rollback, cache clearing between tests
- Python↔TypeScript parity testing (WNS calculator)
- All generators properly bounded (no known pitfall violations)
- 120+ utility test files with excellent pure function coverage

**Key Gaps:**
- Rate limiting tests entirely SKIPPED (`test_rate_limiting.py`) — zero coverage
- No AnalyticsScreen test — most complex frontend screen untested
- No real device E2E tests (Detox/Maestro)
- No load/stress testing — no concurrent request simulation
- No cross-service integration test (workout → achievement → feed → leaderboard)
- Offline behavior completely untested (NetInfo mock always online)
- WeeklyCheckinCard (adaptive engine's primary UI) untested
- Payments module: only webhook + trial tested, no status/cancel/entitlement tests
- Dashboard tests are smoke-only (status codes, not business logic)
- `src/modules/analytics/service.py` has no dedicated test file
- Database error paths untested (no connection failure or constraint violation tests)

---

## Production Checklist

### Data Integrity
- [ ] Add `ForeignKey("users.id", ondelete="CASCADE")` to all 13 tables missing it (Alembic migration)
- [ ] Add `ondelete` to 10 ForeignKeys missing it
- [ ] Add `UniqueConstraint("user_id", "recorded_date")` to `bodyweight_logs`
- [ ] Add partial unique index on `subscriptions` for active subscriptions per user
- [ ] Change Base model to `DateTime(timezone=True)` for `created_at`/`updated_at` (Alembic migration)
- [ ] Replace `datetime.utcnow()` with `datetime.now(timezone.utc)` in `db_rate_limiter.py`
- [ ] Add `deleted_at IS NULL` filter to webhook subscription lookup in `payments/service.py`
- [ ] Add `User.not_deleted()` filter to sharing service user lookup

### Security
- [ ] Clear `queryClient` on logout (`AccountSection.tsx`)
- [ ] Clear active workout + auxiliary Zustand stores on logout
- [ ] Add rate limiting to `resend_verification_by_email` endpoint
- [ ] Make Apple Sign-In nonce mandatory
- [ ] Add HTML sanitization (`bleach.clean()`) on user-generated string fields
- [ ] Add `Content-Security-Policy` header to security middleware
- [ ] Escape all interpolated values in sharing HTML template
- [ ] Remove stale Stripe/Razorpay settings from `settings.py`
- [ ] Remove unused `passlib[bcrypt]` dependency
- [ ] Reject default JWT secret regardless of DEBUG mode

### CI/CD
- [ ] Fix CI gate in `deploy.yml` to actually verify CI status
- [ ] Add automated rollback on failed health check
- [ ] Run migrations BEFORE deploy (or implement blue-green)
- [ ] Add frontend coverage threshold to `ci-frontend.yml`
- [ ] Add `yarn audit --level high` to frontend CI
- [ ] Set up uptime monitoring (UptimeRobot/BetterStack)
- [ ] Create disaster recovery runbook (`docs/DISASTER_RECOVERY.md`)
- [ ] Add deploy failure notifications (Slack webhook)
- [ ] Implement multi-stage Docker build
- [ ] Reduce Railway healthcheck timeout from 120s to 30s

### Frontend
- [ ] Add `onRequestClose` to SimpleModeDiscoveryModal and PickerField
- [ ] Add `mutationKey` to ReactionButton and ImportDataScreen mutations
- [ ] Add deep linking configuration to NavigationContainer
- [ ] Replace 20 `toISOString()` date formatting calls with local date helper
- [ ] Add `useCallback`/`useMemo` to DashboardScreen and AnalyticsScreen
- [ ] Add AbortController to 5 useEffects in AnalyticsScreen
- [ ] Replace ScrollView with FlatList in LogsScreen nutrition tab
- [ ] Lazy-load zxcvbn and BarcodeScanner

### Testing
- [ ] Fix or rewrite rate limiting tests (use `fakeredis`)
- [ ] Add AnalyticsScreen test
- [ ] Add WeeklyCheckinCard test
- [ ] Add payments lifecycle integration tests
- [ ] Add offline behavior tests (mock NetInfo as disconnected)

### Database
- [ ] Add composite indexes: `payment_transactions(user_id, created_at)`, `notification_log(user_id, read_at)`, `body_measurements(user_id, measured_at DESC)`
- [ ] Add partial indexes on `deleted_at IS NULL` for `workout_templates`, `custom_meals`, `meal_plans`
- [ ] Add JSONB validation to `meal_plans.slot_splits`
- [ ] Make pool_size/max_overflow configurable via environment variables
- [ ] Add dialect check to GIN index migration for SQLite compatibility
- [ ] Verify branch protection rules are configured in GitHub Settings

---

## Recommendations

### Immediate (before launch)
1. **Data isolation on logout** — Clear all caches and persisted stores. This is the highest-impact user-facing bug. (~2 hours)
2. **ForeignKey migration** — Single Alembic migration adding FK constraints to 13 tables + ondelete to 10 more. (~3 hours)
3. **Timezone migration** — Change Base model timestamps to timezone-aware. (~2 hours)
4. **Fix deploy pipeline** — Real CI gate, automated rollback, migrations-before-deploy. (~4 hours)
5. **Rate limit email endpoint** — 5-minute fix preventing email spam abuse.

### First Week
6. **Security hardening** — HTML sanitization, CSP header, Apple nonce, sharing template escaping. (~1 day)
7. **Uptime monitoring + alerting** — UptimeRobot + Slack notifications for deploys and cron failures. (~2 hours)
8. **Fix N+1 queries** — Batch-fetch in recipe and meal plan services. (~4 hours)
9. **Frontend coverage enforcement** — Add threshold to CI. (~30 minutes)
10. **npm audit in CI** — Add `yarn audit` step. (~15 minutes)

### First Month
11. **Accessibility sprint** — Target 80%+ label coverage on the 15 worst screens. (~3 days)
12. **Test gap closure** — Rate limiting tests, AnalyticsScreen, WeeklyCheckinCard, payments lifecycle, offline behavior. (~1 week)
13. **Performance optimization** — Memoization in Dashboard/Analytics, FlatList in Logs, lazy-load heavy deps. (~2 days)
14. **Deep linking** — Enable shared template links and push notification deep links. (~1 day)
15. **Disaster recovery runbook** — Document procedures for Railway, Neon, and deploy failures. (~4 hours)

### Post-Launch
16. **Real E2E tests** — Detox or Maestro suite for critical user flows.
17. **Load testing** — Simulate 100+ concurrent users on critical endpoints.
18. **API contract tests** — Validate backend responses match frontend TypeScript types.
19. **Multi-stage Docker build** — Reduce image size and attack surface.
20. **Dependency lock files** — `pip-compile` for backend, verify `yarn.lock` is committed for frontend.

---

## Severity Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| 🔴 CRITICAL | 7 | Cross-user data leak, orphaned PII, timezone-naive timestamps, deploy gate no-op, race conditions |
| 🟠 HIGH | 21 | Auth gaps, N+1 queries, no rollback, no uptime monitoring, missing tests, accessibility |
| 🟡 MEDIUM | 42 | Input sanitization, missing indexes, race conditions, performance, bundle size, test gaps |
| 🟢 LOW | 20 | Minor auth inconsistencies, caching, code cleanup, nice-to-have tests |
| **Total** | **90** | |
