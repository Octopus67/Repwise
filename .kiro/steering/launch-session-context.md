---
inclusion: manual
---

# Launch Session Context — April 5, 2026

Everything learned during the launch infrastructure setup session. Load this for continuity.

## Production Infrastructure (ALL LIVE)

### Railway Deployment
- **URL:** `https://hypertrophyos-production.up.railway.app`
- **Health:** `/api/v1/health` → `{"status":"ok"}` ✅
- **Auth:** Register + Login both working, returning JWT tokens ✅
- **Port:** 8080 (Railway sets `PORT` env var, Dockerfile uses `${PORT:-8000}`)
- **Workers:** 1 Gunicorn worker with Uvicorn (reduced from 4 for memory)
- **Auto-deploy:** Connected to `main` branch, deploys on push
- **Region:** us-east4

### Neon PostgreSQL
- **Pooler URL:** `postgresql+asyncpg://neondb_owner:npg_yVzuCrjh7TL4@ep-steep-bonus-ai7arlzn-pooler.c-4.us-east-1.aws.neon.tech/neondb?ssl=require`
- **Direct URL (for migrations):** `postgresql+asyncpg://neondb_owner:npg_yVzuCrjh7TL4@ep-steep-bonus-ai7arlzn.c-4.us-east-1.aws.neon.tech/neondb?ssl=require`
- **Tables:** 61 (created via `Base.metadata.create_all`, NOT via Alembic migrations)
- **Alembic:** Stamped to head (`28c15b684365`)
- **CRITICAL:** asyncpg uses `ssl=require`, NOT `sslmode=require`
- **CRITICAL:** Tables were recreated on Apr 5 because first `create_all` missed columns (users had 9 instead of 15). Always import ALL model files before `create_all`.
- **Plan:** Neon Free tier (0.5 GB) sufficient for launch. Upgrade to Launch ($6-15/mo) when loading full 2.37M food database.

### AWS SES
- **Domain:** `repwise.app` — DKIM verified ✅, MAIL FROM verified ✅
- **DNS:** 6 records on Cloudflare (3 DKIM CNAMEs, 1 MX, 2 TXTs) — all DNS only (grey cloud)
- **MAIL FROM:** `mail.repwise.app`
- **Production access:** Requested, awaiting approval (24-48h from Apr 5 00:40 IST)
- **Sender:** `noreply@repwise.app`
- **Region:** us-east-1

### Apple Developer
- **Team ID:** `RYP66CBGJP`
- **Bundle ID:** `com.octopuslabs.repwise` (NOT `com.repwise.app` — that was taken)
- **App Store Connect App ID:** `6761667763`
- **App Name:** `Repwise - Smart Training`
- **API Key (.p8):** `~/.appstore-keys/AuthKey_4GTAQ97376.p8` (Key ID: `4GTAQ97376`)
- **Subscription Key (.p8):** `SubscriptionKey_33685FX7U8.p8` (Key ID: `33685FX7U8`)
- **Issuer ID:** `2212caf4-328b-4c26-93b3-d0e8a1b76663`

### RevenueCat
- **Public SDK Key (iOS):** `appl_bygjnXMcoiGFjzbnoqFSQpYLlQU`
- **Secret API Key:** `sk_WkpNkkYrRmSJIMqlNAGkLBecXKLMO`
- **Webhook Auth Key:** `d2f6589a4ba26cd6f62f0120a94478ca`
- **Entitlement:** `premium`
- **Products:** `repwise_monthly` ($9.99/mo), `repwise_yearly` ($79.99/yr)
- **Offering:** `default` with Monthly + Annual packages
- **Webhook URL:** `https://api.repwise.app/api/v1/payments/webhook/revenuecat` (set up when api.repwise.app DNS is configured)

### Sentry
- **DSN:** `https://1fc3a257081e1053ffaeacb4edf3be86@o4510946415607808.ingest.us.sentry.io/4511163459960832`

### PostHog
- **API Key:** `phc_v6tVok9EaERgQ9NKJJATGgsfvM2Ea78GFfs8jA6kaRaw`
- **Host:** `https://us.i.posthog.com`
- **Project ID:** `369254`

### GitHub
- **Secrets set:** `EXPO_TOKEN`, `RAILWAY_TOKEN`
- **Variables set:** `RAILWAY_URL=hypertrophyos-production.up.railway.app`
- **Branch protection:** Configured on `main` (require PR, require status checks)

## Bugs Fixed During Deployment

These were discovered and fixed during the Railway deployment process:

1. **`--proxy-headers` is Uvicorn flag, not Gunicorn** — Removed from Dockerfile CMD
2. **`data/exercises.json` not in Docker image** — Moved to `src/modules/training/exercises_data.json`, updated path reference
3. **`python-multipart` missing from pyproject.toml** — Added (needed for file upload endpoints)
4. **`TrustedHostMiddleware` blocking Railway health checks** — Removed entirely (Railway reverse proxy + CORS handles this)
5. **`CORS_ORIGINS` / `ALLOWED_HOSTS` JSON parsing fails in Railway** — Changed from `list[str]` to `str` type with `_parse_list()` helper that accepts both JSON arrays and comma-separated strings
6. **Timezone-naive datetime vs PostgreSQL** — `rate_limit_entries.created_at` is `TIMESTAMP WITHOUT TIME ZONE` but code used `datetime.now(timezone.utc)`. Changed to `datetime.utcnow()`
7. **Neon tables missing columns** — First `create_all` only created 9 of 15 user columns. Fixed by importing ALL model files before `create_all`, then recreating.
8. **Alembic migrations incompatible with PostgreSQL** — `DATE()` function, missing `IF EXISTS`, constraint drops. Fixed individual migrations but ultimately used `create_all` + `stamp head`.

## Railway Environment Variables (complete set)

```
DATABASE_URL=postgresql+asyncpg://neondb_owner:npg_yVzuCrjh7TL4@ep-steep-bonus-ai7arlzn-pooler.c-4.us-east-1.aws.neon.tech/neondb?ssl=require
JWT_SECRET=af954fb23ba58786f51686a775d11110de8d3b268db8393e6e3255ae165c45dc
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
DEBUG=false
USDA_API_KEY=DEMO_KEY
GOOGLE_CLIENT_ID=626243275639-vh8mmvdbnp4ufgihga0bme2gd2j39ghp.apps.googleusercontent.com
APPLE_CLIENT_ID=com.octopuslabs.repwise
CORS_ORIGINS=https://repwise.app,https://www.repwise.app
ALLOWED_HOSTS=hypertrophyos-production.up.railway.app,api.repwise.app
SENTRY_DSN=https://1fc3a257081e1053ffaeacb4edf3be86@o4510946415607808.ingest.us.sentry.io/4511163459960832
POSTHOG_PROJECT_API_KEY=phc_v6tVok9EaERgQ9NKJJATGgsfvM2Ea78GFfs8jA6kaRaw
POSTHOG_HOST=https://us.i.posthog.com
REVENUECAT_API_KEY=sk_WkpNkkYrRmSJIMqlNAGkLBecXKLMO
REVENUECAT_WEBHOOK_AUTH_KEY=d2f6589a4ba26cd6f62f0120a94478ca
REVENUECAT_API_URL=https://api.revenuecat.com/v1
R2_BUCKET_NAME=hypertrophy-os-uploads
SES_SENDER_EMAIL=noreply@repwise.app
SES_REGION=us-east-1
```

### Still needed:
```
AWS_ACCESS_KEY_ID=<create IAM user after SES approves>
AWS_SECRET_ACCESS_KEY=<same>
REDIS_URL=<add Railway Redis plugin when needed>
R2_ACCESS_KEY=<when Cloudflare R2 is set up>
R2_SECRET_KEY=<same>
R2_ENDPOINT_URL=<same>
```

## Production Readiness Audit

- **Report:** `docs/PRODUCTION_READINESS_AUDIT.md` (756 lines, 90 findings)
- **Fix Plan:** `docs/AUDIT_FIX_PLAN.md` (2,264 lines, 90 tasks across 10 phases)
- **Score:** 6.5/10
- **Critical items:** 7 (cross-user data leak, orphaned PII, timezone-naive timestamps, CI gate no-op, race conditions)
- **Total effort:** 152-160 hours (19-20 days)

## Remaining for App Store Submission

1. SES production access approval (waiting)
2. Create IAM user for SES → add AWS keys to Railway
3. First EAS build (`cd app && eas build --platform ios --profile preview`)
4. Install on phone via TestFlight
5. Set App Store category (Health & Fitness) + age rating
6. Submit to App Store
7. Fix 7 critical audit items (cross-user data leak is #1 priority)
