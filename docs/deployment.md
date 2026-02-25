# Deployment Guide

**Hypertrophy OS — Production Infrastructure Setup**

This guide walks through setting up all production infrastructure from scratch. Follow sections in order.

## 1. Railway (Backend Compute)

### 1.1 Create Project

1. Sign up at [railway.app](https://railway.app)
2. Create a new project → "Deploy from GitHub repo"
3. Connect your GitHub account and select the Hypertrophy OS repository
4. Railway auto-detects the `Dockerfile` at the repo root

### 1.2 Configure Build

- Builder: **Dockerfile** (auto-detected from repo root `Dockerfile`)
- Start command: `uvicorn src.main:app --host 0.0.0.0 --port 8000`
- Watch paths: Leave default (entire repo)

### 1.3 Set Environment Variables

Add all variables in Railway's "Variables" tab:

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL` | `postgresql+asyncpg://<user>:<pass>@<host>/<db>?sslmode=require` | Neon dashboard (Section 2) |
| `JWT_SECRET` | 256-bit hex string | Generate: `openssl rand -hex 32` |
| `JWT_ALGORITHM` | `HS256` | Default |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Default |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Default |
| `USDA_API_KEY` | Production API key | [USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup.html) |
| `STRIPE_API_KEY` | `sk_live_...` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe Dashboard → Developers → Webhooks |
| `RAZORPAY_KEY_ID` | `rzp_live_...` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Live secret key | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret | Razorpay Dashboard → Settings → Webhooks |
| `CORS_ORIGINS` | `["https://hypertrophyos.com"]` | Custom |
| `SENTRY_DSN` | `https://...@sentry.io/...` | Sentry project (Section 5) |
| `R2_ACCESS_KEY` | R2 API token access key | Cloudflare dashboard (Section 3) |
| `R2_SECRET_KEY` | R2 API token secret | Cloudflare dashboard (Section 3) |
| `R2_ENDPOINT_URL` | `https://<account-id>.r2.cloudflarestorage.com` | Cloudflare dashboard |
| `R2_BUCKET_NAME` | `hypertrophy-os-uploads` | Cloudflare R2 (Section 3) |
| `FCM_SERVER_KEY` | Firebase server key | Firebase console (Section 4) |
| `DEBUG` | `false` | Production mode |

### 1.4 Configure Custom Domain

1. In Railway service settings → "Custom Domain"
2. Add `api.hypertrophyos.com`
3. Railway provides a CNAME target (e.g., `<service>.up.railway.app`)
4. Add this CNAME in Cloudflare DNS (Section 3)

### 1.5 Set Health Check

- Health check path: `/api/v1/health`
- Health check timeout: 30 seconds
- The existing `src/main.py` already exposes this endpoint returning `{"status": "ok"}`

### 1.6 Set Region

- Region: **US-West**
- Serves both US and India users via Cloudflare edge caching
- Single region is sufficient for launch; multi-region (Fly.io) deferred to v2

### 1.7 Scaling

- Initial: 1 instance at $5/month
- Manual scale to 2-3 instances at $5/instance/month when needed
- Auto-scaling deferred to v2

### 1.8 Auto-Deploy

- Railway auto-deploys on every push to `main` branch
- Ensure CI (GitHub Actions) passes before merging to `main`


## 2. Neon (PostgreSQL Database)

### 2.1 Create Project

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
   - Name: `hypertrophy-os`
   - Region: **US-East** (same network proximity as Railway US-West for low latency)
   - PostgreSQL version: 16

### 2.2 Get Connection String

1. In the Neon dashboard, go to "Connection Details"
2. Select "Connection string" format
3. Copy the connection string and convert to asyncpg format:

```
# Neon provides:
postgresql://<user>:<pass>@<host>/<db>?sslmode=require

# Convert to asyncpg for SQLAlchemy:
postgresql+asyncpg://<user>:<pass>@<host>/<db>?ssl=require
```

4. Set this as `DATABASE_URL` in Railway environment variables

### 2.3 Create Staging Branch

1. In Neon dashboard → "Branches" → "Create Branch"
2. Name: `staging`
3. This creates a copy-on-write branch that shares storage with main (free)
4. Use the staging branch connection string for the staging environment

### 2.4 Connection Pooling

- Neon includes built-in PgBouncer connection pooling
- Free tier: max 100 connections
- The app's `database.py` is configured with `pool_size=10, max_overflow=20` which stays well within limits
- Use the pooled connection endpoint (port 5432) for production

### 2.5 Auto-Suspend

- Free tier auto-suspends after 5 minutes of inactivity
- First request after suspend takes 1-3 seconds (cold start)
- Acceptable for low-traffic launch phase
- Neon Pro ($19/month) allows configuring suspend timeout or disabling it

### 2.6 Backups

- Neon provides automated point-in-time recovery
- Free tier: 7-day history
- Pro tier: 30-day history
- No manual backup configuration needed

### 2.7 Run Migrations

```bash
# Set DATABASE_URL to Neon production connection string
export DATABASE_URL="postgresql+asyncpg://<user>:<pass>@<host>/<db>?ssl=require"

# Run all migrations
alembic upgrade head

# Verify tables created
# Check via Neon SQL Editor or psql
```

## 3. Cloudflare (CDN, DNS, R2 Object Storage)

### 3.1 Add Domain

1. Sign up at [cloudflare.com](https://cloudflare.com) (free plan)
2. Add site: `hypertrophyos.com`
3. Update domain registrar nameservers to Cloudflare's assigned nameservers
4. Wait for DNS propagation (up to 24 hours, usually minutes)

### 3.2 Configure DNS Records

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `<service>.up.railway.app` (from Railway custom domain setup) | Proxied (orange cloud) |
| CNAME | `cdn` | R2 public bucket URL (see Section 3.4) | Proxied |
| A/CNAME | `@` | Landing page host (Cloudflare Pages, Vercel, etc.) | Proxied |

### 3.3 Set SSL Mode

1. Go to SSL/TLS → Overview
2. Set encryption mode: **Full (strict)**
   - Cloudflare terminates TLS at the edge
   - Re-encrypts traffic to Railway origin
   - Requires valid SSL cert on origin (Railway provides this automatically)

### 3.4 Create R2 Bucket

1. Go to R2 → "Create bucket"
2. Bucket name: `hypertrophy-os-uploads`
3. Location: Automatic
4. Create an API token for the bucket:
   - Go to R2 → "Manage R2 API Tokens"
   - Create token with "Object Read & Write" permissions for the bucket
   - Save the Access Key ID and Secret Access Key
   - Set these as `R2_ACCESS_KEY` and `R2_SECRET_KEY` in Railway
5. Note the R2 endpoint URL: `https://<account-id>.r2.cloudflarestorage.com`
   - Set as `R2_ENDPOINT_URL` in Railway

### 3.5 Configure R2 Public Access (CDN)

1. In the R2 bucket settings → "Public Access"
2. Enable public access via custom domain
3. Set custom domain: `cdn.hypertrophyos.com`
4. This automatically creates the DNS CNAME record

### 3.6 Configure Cache Rules

Go to Caching → Cache Rules and create:

| Rule Name | Match | Cache Behavior | TTL |
|-----------|-------|----------------|-----|
| Static Assets | `api.hypertrophyos.com/static/*` | Cache Everything | 1 year (31536000s) |
| API Bypass | `api.hypertrophyos.com/api/*` | Bypass Cache | — |
| CDN Assets | `cdn.hypertrophyos.com/*` | Cache Everything | 1 year (31536000s) |

Set default Cache-Control headers:
- Hashed/versioned filenames: `max-age=31536000, immutable`
- Dynamic content: `max-age=3600`

## 4. Firebase (Push Notifications)

### 4.1 Create Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project: "Hypertrophy OS"
3. Disable Google Analytics for the project (we use PostHog instead)

### 4.2 Enable FCM

1. In Firebase console → Project Settings → Cloud Messaging
2. FCM is enabled by default for new projects
3. Note the **Server Key** — this is the `FCM_SERVER_KEY` environment variable for Railway

### 4.3 Download Service Account Key

1. Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Store securely — this is used for server-side FCM sends

### 4.4 iOS Setup (APNs)

1. In Firebase console → Project Settings → Cloud Messaging → iOS app
2. Upload your APNs authentication key (.p8 file) from Apple Developer portal
3. Enter Key ID and Team ID
4. This enables Firebase to relay push notifications to iOS devices via APNs

### 4.5 Android Setup

1. In Firebase console → Project Settings → General → Android app
2. Register app with package name: `com.hypertrophyos.app`
3. Download `google-services.json` and place in the app's Android directory

## 5. Sentry (Crash Reporting & Error Tracking)

### 5.1 Create Project

1. Sign up at [sentry.io](https://sentry.io) (free tier: 5,000 events/month)
2. Create organization: "Hypertrophy OS"

### 5.2 Backend Project (Python)

1. Create project → Platform: Python → Framework: FastAPI
2. Copy the DSN from Project Settings → Client Keys (DSN)
3. Set as `SENTRY_DSN` in Railway environment variables
4. The backend `src/main.py` already has conditional Sentry initialization:
   ```python
   if settings.SENTRY_DSN:
       sentry_sdk.init(dsn=settings.SENTRY_DSN, ...)
   ```

### 5.3 Frontend Project (React Native)

1. Create a second project → Platform: React Native
2. Copy the DSN
3. Set as `EXPO_PUBLIC_SENTRY_DSN` in EAS build environment variables
4. The frontend `app/App.tsx` initializes Sentry conditionally

### 5.4 Alert Rules

Configure alerts in Sentry:

| Alert | Condition | Action |
|-------|-----------|--------|
| Error spike | Error count > 50 in 5 minutes | Email notification |
| New issue | First occurrence of a new error | Email notification |
| Crash rate | Frontend crash rate > 0.1% | Email notification |

### 5.5 Environment Tags

Sentry automatically tags events with the environment:
- `production` — when `DEBUG=false`
- `development` — when `DEBUG=true` / `__DEV__` is true

## 6. Post-Deployment Verification

After all services are configured, verify the full stack:

```bash
# 1. Health check
curl https://api.hypertrophyos.com/api/v1/health
# Expected: {"status": "ok"}

# 2. SSL verification
curl -vI https://api.hypertrophyos.com 2>&1 | grep "SSL certificate"
# Expected: Valid SSL certificate

# 3. CDN verification
curl -I https://cdn.hypertrophyos.com/test.txt
# Expected: Cloudflare headers present (cf-ray, cf-cache-status)

# 4. Database connectivity (via health check response time)
# If health check responds < 100ms, database is connected

# 5. Sentry test
# Trigger a test error in the app and verify it appears in Sentry dashboard
```

## 7. Cost Summary

| Service | Free Tier Limit | Monthly Cost (Launch) | Monthly Cost (10K Users) |
|---------|----------------|----------------------|--------------------------|
| Railway | $5 credit | $5 | $20 (2 instances) |
| Neon | 0.5GB, auto-suspend | $0 | $19 (Pro) |
| Cloudflare (CDN + DNS) | Unlimited bandwidth | $0 | $0 |
| Cloudflare R2 | 10GB storage | $0 | $0 |
| Firebase FCM | Unlimited messages | $0 | $0 |
| Sentry | 5K events/month | $0 | $26 (Team) |
| PostHog | 1M events/month | $0 | $0 |
| **Total** | | **$5/month** | **$65/month** |
