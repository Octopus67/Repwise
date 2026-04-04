---
inclusion: manual
---

# Backend Architecture

## Entry Point
`src/main.py` — Registers all routers, configures CORS, Sentry, exception handlers.

## Server
Gunicorn with Uvicorn workers (NOT bare Uvicorn). SQLAlchemy pool_size=5, max_overflow=10.

## API Modules (25 total)
All mounted at `/api/v1/<prefix>`. Key modules:

| Module | Prefix | Purpose |
|--------|--------|---------|
| auth | `/auth` | JWT auth, OAuth, password reset |
| user | `/users` | Profile, metrics, bodyweight, goals |
| nutrition | `/nutrition` | Food logging, entries, micronutrient dashboard |
| training | `/training` | Sessions, exercises, volume, fatigue, analytics |
| adaptive | `/adaptive` | Daily targets, adaptive macros |
| food | `/food` | Food search (FTS5), barcode (OFF→USDA fallback) |
| payments | `/payments` | RevenueCat subscriptions (webhook, status) |
| social | `/social` | Feed, reactions, leaderboard, follows |
| coaching | `/coaching` | Coach profiles, sessions, suggestions |
| reports | `/reports` | Weekly intelligence reports |
| onboarding | `/onboarding` | Onboarding wizard (status, steps) |
| achievements | `/achievements` | Gamification, badges, progress |
| notifications | `/notifications` | Push notifications, device tokens |
| account | `/account` | Account deletion, data export |

Other: content, health, dietary, progress_photos, periodization, readiness, founder, community, recomp, meals, meal_plans, feature_flags (DEPRECATED — use PostHog).

## Payment: RevenueCat Only
- Removed Stripe + Razorpay entirely. RevenueCat is the sole payment provider.
- Webhook: `/webhook/revenuecat` — handles subscription lifecycle events.
- Provider: `src/modules/payments/revenuecat_provider.py`.
- `require_premium` dependency checks RevenueCat entitlement status.

## Rate Limiting: Redis-Backed
- `src/middleware/rate_limiter.py` — sorted set sliding window algorithm.
- Required in production (Redis URL must be configured). Fail-open if Redis is down.
- Applied to auth endpoints and sensitive routes.

## Feature Flags: PostHog
- `src/services/feature_flags.py` — PostHog integration for runtime feature toggles.
- `require_feature()` FastAPI dependency for gating endpoints.
- DEPRECATED: DB-based `feature_flags` module. Migrate all flags to PostHog.

## Social Module
- `src/modules/social/` — 5 tables: follows, feed_events, reactions, leaderboard_entries, shared_templates.
- Fan-out-on-read architecture (no fan-out-on-write).
- Leaderboard: cron job refreshes `leaderboard_cache` periodically.

## Middleware (`src/middleware/`)

| File | Purpose |
|------|---------|
| `authenticate.py` | `get_current_user` — JWT validation |
| `freemium_gate.py` | `require_premium` — checks RevenueCat entitlement |
| `rate_limiter.py` | Redis-backed sorted set rate limiting |
| `request_timeout.py` | 30s default / 120s for long operations |
| `logging_middleware.py` | Request/response logging |

File upload validation lives in `src/shared/storage.py` (size + type checks).

## Cron Jobs (7)
1. `permanent_deletion.py` — daily, GDPR account deletion
2. `cleanup_blacklist.py` — daily, expired token cleanup
3. `trial_expiration.py` — hourly, trial downgrades
4. `export_worker.py` — periodic, process pending exports
5. `cleanup_exports.py` — daily, delete expired export files
6. `refresh_leaderboards.py` — every 15 min, recalculate leaderboards
7. `workout_reminders.py` — every 2 hours, push notifications

## Shared Infrastructure (`src/shared/`)
- `base_model.py` — SQLAlchemy Base: UUID pk, created_at, updated_at
- `soft_delete.py` — SoftDeleteMixin: deleted_at, `Model.not_deleted(stmt)` filter
- `audit.py` — AuditLogMixin: writes to audit_logs on changes
- `errors.py` — ApiError, NotFoundError, UnprocessableError, ForbiddenError
- `pagination.py` — PaginatedResult, PaginationParams (limit max 500)

## Database
- Dev: SQLite (JSONB→JSON patching). Prod: PostgreSQL + asyncpg.
- Models use JSONB for extensible fields. All inherit Base with SoftDeleteMixin.
- Queries MUST use `Model.not_deleted(stmt)` to filter deleted records.

## N+1 Query Fixes
- Dashboard: `asyncio.gather()` for parallel data fetching.
- PR detector: batch query instead of per-item lookups.
- Coaching: sequential awaits (acceptable — low cardinality).

## Key Engines
- **WNS Volume**: `wns_engine.py` (pure functions), `wns_volume_service.py` (DB-backed). K=0.96, MAX_STIM_REPS=5.
- **Fatigue**: `fatigue_engine.py` — e1RM regression, composite score (regression 35%, volume 30%, frequency 20%, nutrition 15%).
- **Micronutrient Dashboard**: 27 nutrients, age/sex-specific RDA, score 0-100.
- **Adaptive Engine**: Daily macro targets adjusted by training volume + body comp goals.
- **Weekly Report**: Integrates WNS HU, nutrient score, compliance, weight-goal alignment.

## Key Rules
- Bodyweight: upsert by date (no duplicates). display_name: min_length=1.
- Nutrition: food_name nullable, pagination max 500, copy preserves source_meal_id.
- Feature flag `wns_engine` controls volume engine selection (ON by default).
