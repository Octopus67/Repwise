# Repwise Audit Fix — Agent Handoff Context

**Date:** April 5, 2026
**Purpose:** Everything an agent needs to start fixing audit findings independently.

---

## What Is Repwise?

A full-stack fitness platform for serious lifters. Adaptive nutrition tracking, intelligent training logging with Weekly Net Stimulus (WNS) volume tracking, evidence-based coaching, micronutrient analysis, and social features.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.12), SQLAlchemy async, PostgreSQL (Neon) |
| Frontend | React Native (Expo SDK 53), TypeScript, Zustand, TanStack Query v5 |
| Auth | JWT (access + refresh tokens), bcrypt, OAuth (Google, Apple) |
| Payments | RevenueCat (handles App Store + Play Store natively) |
| Feature Flags | PostHog |
| Monitoring | Sentry |
| Deployment | Railway (Docker), auto-deploy from `main` branch |
| Tests | pytest + Hypothesis (backend), Jest + fast-check (frontend) |

## Project Structure

```
/Users/manavmht/Documents/HOS/
├── src/                    # Backend (FastAPI)
│   ├── main.py             # App entry, router registration, lifespan
│   ├── config/             # Settings, database, redis, scheduler
│   ├── modules/            # 25+ feature modules (router.py, service.py, models.py, schemas.py)
│   ├── middleware/          # Auth, freemium gate, rate limiting, logging
│   ├── shared/             # Base models, errors, pagination, soft delete
│   └── database/           # Alembic migrations
├── app/                    # Frontend (React Native)
│   ├── App.tsx             # Root component
│   ├── screens/            # Screen components by feature
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom hooks (TanStack Query, etc.)
│   ├── store/              # Zustand state management
│   ├── services/           # API client (axios), TanStack Query config
│   └── utils/              # Pure utility functions
├── tests/                  # Backend tests (pytest)
├── data/                   # Exercise JSON, food data (gitignored, exercises moved to src/)
└── docs/                   # Documentation, audit reports
```

## Running the App

```bash
# Backend (auto-reload)
.venv/bin/uvicorn src.main:app --reload --port 8000 --host 0.0.0.0

# Frontend (hot reload)
cd app && npx expo start --port 8081

# Backend tests
DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v

# Frontend tests
cd app && npx jest --passWithNoTests
```

## Production URLs

- **API:** `https://hypertrophyos-production.up.railway.app`
- **Health:** `GET /api/v1/health` → `{"status":"ok"}`
- **Database:** Neon PostgreSQL (61 tables, pooler URL with `ssl=require`)

## Critical Rules

**Backend:**
- Business logic in `service.py`, routing only in `router.py`
- All errors via `ApiError` subclasses from `src/shared/errors.py`
- Never hard-delete user data — use `deleted_at` soft delete
- All DB columns use `TIMESTAMP WITHOUT TIME ZONE` (known issue — audit finding #4)
- `CORS_ORIGINS` and `ALLOWED_HOSTS` are `str` type with `_parse_list()` helper (accepts JSON arrays or comma-separated)

**Frontend:**
- All modals need `onRequestClose` prop
- `ErrorBanner` needs `onDismiss` prop
- Submit buttons need `disabled={loading}` during async ops
- State must reset when modals close (`useEffect` on `visible`)
- Use local date arithmetic, not `toISOString()`, for date comparisons

**Database:**
- asyncpg uses `ssl=require`, NOT `sslmode=require`
- Tables created via `create_all` + `stamp head`, NOT via Alembic migrations
- Always import ALL model files before `create_all` (first attempt missed columns)
- `TrustedHostMiddleware` was removed — Railway reverse proxy handles host validation

## Audit Documents

### Production Readiness Audit
- **File:** `docs/PRODUCTION_READINESS_AUDIT.md` (756 lines)
- **Score:** 6.5/10
- **Findings:** 90 total (7 CRITICAL, 21 HIGH, 42 MEDIUM, 20 LOW)

### Fix Plan
- **File:** `docs/AUDIT_FIX_PLAN.md` (2,264 lines)
- **Phases:** 10 phases, 90 tasks, 152-160 hours estimated
- **Structure:** Each task has root cause, affected files, implementation steps, ripple effects, regression risk, testing requirements

### Phase Summary

| Phase | Focus | Tasks | Hours |
|-------|-------|-------|-------|
| 1 | 🔴 Critical Data Integrity & Security | 8 tasks | 22-24h |
| 2 | 🟠 High Auth & Security | 5 tasks | 14-16h |
| 3 | 🟠 High CI/CD & Deployment | 7 tasks | 10h |
| 4 | 🟠 High Performance & Frontend | 5 tasks | 10h |
| 5 | 🟠 High Test Gaps | 4 tasks | 28-30h |
| 6 | 🟡 Medium Input Validation & Security | 12 tasks | 14h |
| 7 | 🟡 Medium Performance & Frontend | 10 tasks | 12h |
| 8 | 🟡 Medium Database & Schema | 8 tasks | 12h |
| 9 | 🟡 Medium Test Gaps & Cleanup | 7 tasks | 10h |
| 10 | 🟢 Low Polish | 22 tasks | 24-28h |

### Top 7 Critical Items

1. **Cross-user data leak on logout** — TanStack Query cache + Zustand stores not cleared (`app/components/profile/AccountSection.tsx`)
2. **Orphaned PII after account deletion** — 13 tables missing FK CASCADE (`src/modules/nutrition/models.py`, etc.)
3. **Timezone-naive timestamps** — ALL 40+ tables use `DateTime` without `timezone=True` (`src/shared/base_model.py`)
4. **CI deploy gate is a no-op** — Just echoes "passed" (`.github/workflows/deploy.yml`)
5. **Bodyweight upsert race condition** — No unique constraint (`src/modules/user/service.py`)
6. **Soft-deleted subscription reactivated by webhook** — Missing `deleted_at IS NULL` filter (`src/modules/payments/service.py`)

## How to Work on This

1. **Read the fix plan:** `docs/AUDIT_FIX_PLAN.md`
2. **Pick a phase/task** — each task is self-contained with all context needed
3. **Follow the implementation steps** — they're specific to file paths and line numbers
4. **Run tests after each fix:**
   ```bash
   # Backend
   DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v
   # Frontend
   cd app && npx jest --passWithNoTests
   ```
5. **Do NOT push directly to main** — branch protection requires PRs
6. **Check Sentry after deploying** — `https://sentry.io` (DSN is configured)

## Known Gotchas

- **macOS Gunicorn fork crash:** `objc[]: +[NSMutableString initialize] may have been in progress in another thread when fork() was called` — macOS-only, doesn't happen on Linux/Railway. Use `uvicorn` directly for local testing.
- **Alembic migrations vs PostgreSQL:** Many migrations have SQLite-specific code (`DATE()`, missing `IF EXISTS`). Use `create_all` + `stamp head` for fresh PostgreSQL setups.
- **Railway env vars:** Don't use JSON arrays for `CORS_ORIGINS`/`ALLOWED_HOSTS` — use comma-separated strings.
- **Neon connection:** Pooler URL for runtime, direct URL (without `-pooler`) for migrations.
- **exercises.json:** Moved from `data/exercises.json` to `src/modules/training/exercises_data.json` (data/ is gitignored).

## Files Modified in This Session

Key files changed during the launch session (for awareness):

| File | Change |
|------|--------|
| `Dockerfile` | Removed `--proxy-headers`, removed `COPY data/`, reduced workers to 1 |
| `railway.toml` | Healthcheck timeout 30s → 120s |
| `pyproject.toml` | Added `python-multipart` |
| `src/config/settings.py` | `CORS_ORIGINS`/`ALLOWED_HOSTS` changed to `str` with `_parse_list()` |
| `src/config/scheduler.py` | Redis resilience (try/except), `safe_run` catches `Exception`, idempotency guard |
| `src/main.py` | Removed `TrustedHostMiddleware`, uses `settings.cors_origins_list` |
| `src/middleware/db_rate_limiter.py` | `datetime.now(timezone.utc)` → `datetime.utcnow()` |
| `src/modules/training/exercises.py` | Path changed to `exercises_data.json` in same directory |
| `src/modules/training/exercises_data.json` | NEW — copied from `data/exercises.json` |
| `app/eas.json` | Real Apple Team ID, ASC App ID, Sentry DSN, PostHog key, RC key |
| `.env.example` | Real Sentry DSN, PostHog key, RC key, bundle ID |
| `src/database/migrations/versions/` | Fixed 3 migrations for PostgreSQL compatibility |
| `docs/PRODUCTION_READINESS_AUDIT.md` | NEW — 756-line audit report |
| `docs/AUDIT_FIX_PLAN.md` | NEW — 2,264-line fix plan |
