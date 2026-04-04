# Phase 1 Runbook — Critical Launch Blockers

**Date:** 2026-03-29
**Status:** In Progress

---

## ✅ 1.1 FTS5 Migration Fix — DONE

- Migration already had dialect check (`if conn.dialect.name != 'sqlite': return`)
- Improved `_has_fts_table()` to skip `sqlite_master` query on PostgreSQL (avoids logged error)
- All 1,614 tests pass (4 pre-existing SES/env failures unrelated)

---

## 🔲 1.2 AWS SES Email Setup

### Step 1: Verify Domain (5 min)
1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/) → Verified Identities → Create Identity
2. Select "Domain" → enter `repwise.app`
3. Enable "Easy DKIM" (recommended)
4. Copy the 3 CNAME records AWS gives you

### Step 2: DNS Records (10 min)
Add these to your DNS provider (wherever `repwise.app` is registered):

```
# DKIM (3 records — AWS provides exact values)
CNAME  <selector1>._domainkey.repwise.app  →  <selector1>.dkim.amazonses.com
CNAME  <selector2>._domainkey.repwise.app  →  <selector2>.dkim.amazonses.com
CNAME  <selector3>._domainkey.repwise.app  →  <selector3>.dkim.amazonses.com

# SPF
TXT    repwise.app  →  "v=spf1 include:amazonses.com ~all"

# DMARC
TXT    _dmarc.repwise.app  →  "v=DMARC1; p=quarantine; rua=mailto:dmarc@repwise.app; pct=100"
```

### Step 3: Exit Sandbox (24-48h wait)
1. SES Console → Account Dashboard → "Request production access"
2. Fill in:
   - Mail type: Transactional
   - Website URL: repwise.app
   - Use case: "Transactional emails only — account verification, password reset, weekly reports for fitness app users who explicitly registered"
   - Expected volume: <1,000/day
3. Submit and wait for approval

### Step 4: Create IAM User (5 min)
1. IAM Console → Users → Create User → `repwise-ses-sender`
2. Attach policy: `AmazonSESFullAccess` (or create custom policy for `ses:SendEmail` only)
3. Create access key → copy `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

### Step 5: Test (after sandbox exit)
```bash
aws ses send-email \
  --from noreply@repwise.app \
  --to <your-email> \
  --subject "Repwise SES Test" \
  --text "If you see this, SES is working." \
  --region us-east-1
```

---

## 🔲 1.3 Neon Database Migration

### Prerequisites
- FTS5 fix applied ✅
- Neon account created with database

### Step 1: Get Connection Strings
From Neon dashboard → your project → Connection Details:
- **Direct URL** (for migrations): `postgresql+asyncpg://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`
- **Pooled URL** (for runtime): `postgresql+asyncpg://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require`

⚠️ Make sure prefix is `postgresql+asyncpg://` not `postgres://`

### Step 2: Run Migrations
```bash
cd /Users/manavmht/Documents/HOS

# Set direct URL (NOT pooled — Alembic needs direct connection for DDL)
export DATABASE_URL="postgresql+asyncpg://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# Run all migrations
.venv/bin/alembic upgrade head
```

### Step 3: Verify Tables
Connect to Neon via psql or their SQL editor:
```sql
-- Should return ~63 tables
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- Verify key tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify social tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN (
  'follows', 'feed_events', 'reactions', 'leaderboard_entries', 'shared_templates'
);

-- Verify GIN indexes
SELECT indexname FROM pg_indexes WHERE indexdef LIKE '%gin%';
```

### Step 4: Seed Food Database (if needed)
```bash
# Only if food_items table is empty
DATABASE_URL="<direct-url>" .venv/bin/python -m scripts.seed_food_database
```

### Step 5: Switch Railway to Pooled URL
In Railway dashboard → Variables:
```
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
```

---

## 🔲 1.4 Railway Environment Variables

### Required Variables (set in Railway dashboard → Variables)

```bash
# === CRITICAL (app won't start without these) ===
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
JWT_SECRET=<run: openssl rand -hex 32>
DEBUG=false

# === EMAIL (registration/password reset won't work) ===
AWS_ACCESS_KEY_ID=<from Step 1.2>
AWS_SECRET_ACCESS_KEY=<from Step 1.2>
AWS_REGION=us-east-1
SES_SENDER_EMAIL=noreply@repwise.app
SES_REGION=us-east-1

# === PAYMENTS (premium features won't work) ===
REVENUECAT_API_KEY=<from RevenueCat dashboard>
REVENUECAT_WEBHOOK_AUTH_KEY=<from RevenueCat dashboard>

# === RATE LIMITING (security) ===
REDIS_URL=<from Railway Redis plugin — add Redis service first>

# === MONITORING ===
SENTRY_DSN=<from Sentry project>
POSTHOG_PROJECT_API_KEY=<from PostHog project>

# === STORAGE (photos/exports won't work) ===
R2_ACCESS_KEY=<from Cloudflare R2>
R2_SECRET_KEY=<from Cloudflare R2>
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=repwise-uploads
CDN_BASE_URL=https://cdn.repwise.app

# === FOOD DATABASE ===
USDA_API_KEY=<from https://fdc.nal.usda.gov/api-key-signup.html>

# === SECURITY ===
ALLOWED_HOSTS=["api.repwise.app"]
CORS_ORIGINS=["https://repwise.app"]

# === OAUTH (optional for launch) ===
GOOGLE_CLIENT_ID=<from Google Cloud Console>
APPLE_CLIENT_ID=com.octopuslabs.repwise
```

### Generate JWT Secret
```bash
openssl rand -hex 32
# Example output: a1b2c3d4e5f6...  (64 hex chars = 32 bytes)
```

### Add Redis to Railway
1. Railway dashboard → your project → "New" → "Database" → "Redis"
2. Copy the `REDIS_URL` from the Redis service's Variables tab
3. Paste into your backend service's Variables

---

## Verification Checklist

After completing all steps:

```bash
# 1. Health check
curl https://api.repwise.app/api/v1/health
# Expected: {"status": "ok"}

# 2. Registration (tests SES)
curl -X POST https://api.repwise.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "<your-email>", "password": "TestPass123!", "name": "Launch Test"}'
# Expected: 201 + verification email received

# 3. Login
curl -X POST https://api.repwise.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "<your-email>", "password": "TestPass123!"}'
# Expected: 200 + access_token + refresh_token

# 4. Food search (tests DB)
curl https://api.repwise.app/api/v1/food/search?q=chicken \
  -H "Authorization: Bearer <token>"
# Expected: 200 + food items array
```
