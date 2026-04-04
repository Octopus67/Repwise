# Repwise — Complete Production Launch Checklist

**Last Updated:** 2026-03-20
**Status:** Pre-launch

---

## 🔴 CRITICAL — App Won't Work Without These

### 1. Fix FTS5 Migration for PostgreSQL
The `fts5_auto_sync.py` migration uses SQLite-only FTS5 triggers that will FAIL on Neon PostgreSQL.
- [ ] Add dialect check: `if connection.dialect.name == 'sqlite':` around FTS5 triggers
- [ ] For PostgreSQL, either skip (food search uses LIKE fallback) or implement `tsvector` + `GIN` index
- **Why:** Alembic upgrade will crash on Neon without this fix

### 2. AWS SES Email Setup
- [ ] Verify `repwise.app` domain in AWS SES Console → Verified Identities
- [ ] Add 3 DKIM CNAME records to your DNS
- [ ] Add SPF TXT record: `"v=spf1 include:amazonses.com ~all"`
- [ ] Add DMARC TXT record: `"v=DMARC1; p=quarantine; rua=mailto:dmarc@repwise.app; pct=100"`
- [ ] Request SES production access (exit sandbox) — submit via SES Console → Account Dashboard
- [ ] Wait for approval (24-48 hours)
- **Why:** Without this, verification emails and password resets don't work

### 3. Neon Database Migration
- [ ] Get your Neon DIRECT connection string (not pooled) — format: `postgresql+asyncpg://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`
- [ ] Run migrations: `DATABASE_URL="<direct-url>" alembic upgrade head`
- [ ] Verify all 63 tables created: `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`
- [ ] Switch Railway's `DATABASE_URL` to the POOLED connection string for runtime
- **Why:** Schema changes from our session (social tables, GIN indexes, etc.) need to be applied
- **Neon Free Tier:** 0.5 GB storage, 100 compute-hours/month — sufficient for launch. Upgrade when you hit ~500 active users or storage exceeds 0.5 GB (~$2-5/mo on Launch plan)

---

## 🟡 HIGH — App Store Submission Blockers

### 4. Apple Developer Program
- [ ] Enroll at https://developer.apple.com/programs/enroll/ ($99/yr)
- [ ] Wait for approval (24-48 hours)
- [ ] Create App ID with "Sign in with Apple" capability
- [ ] Create Services ID for backend OAuth verification
- [ ] Note your Team ID (Membership Details page)
- [ ] Set `APPLE_CLIENT_ID` in Railway env vars

### 5. Legal Pages (Privacy Policy + Terms)
- [ ] Write/generate privacy policy covering: data collected, third parties (Sentry, PostHog, RevenueCat, AWS SES, Cloudflare), GDPR rights, data retention (30 days after deletion), contact info
- [ ] Write terms of service: no medical advice disclaimer, subscription terms, UGC ownership
- [ ] Host at `repwise.app/privacy` and `repwise.app/terms`
- [ ] Option: Use GitHub Pages, Cloudflare Pages, or Vercel (all free)
- **Why:** App Store and Play Store both require live privacy policy URLs

### 6. DNS Configuration
- [ ] Point `api.repwise.app` → Railway (CNAME to your Railway domain)
- [ ] Point `cdn.repwise.app` → Cloudflare R2 (or Cloudflare CDN)
- [ ] Point `repwise.app` → your legal pages hosting
- [ ] Verify all DNS records propagated (use https://dnschecker.org)

### 7. RevenueCat Setup
- [ ] Create account at https://app.revenuecat.com/signup (free)
- [ ] Connect Apple App Store (upload .p8 API key from App Store Connect)
- [ ] Connect Google Play (upload service account JSON)
- [ ] Create products: `repwise_monthly` ($9.99), `repwise_yearly` ($79.99)
- [ ] Create `premium` entitlement, attach both products
- [ ] Create default offering with Monthly + Annual packages
- [ ] Copy API keys to Railway env vars: `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_AUTH_KEY`
- [ ] Copy SDK keys to EAS env: `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`
- [ ] Configure webhook URL: `https://api.repwise.app/api/v1/payments/webhook/revenuecat`

### 8. EAS Build Configuration
- [ ] Update `eas.json` with real Apple ID and Team ID
- [ ] Ensure `google-play-service-account.json` exists for Android submit
- [ ] Run test build: `eas build --platform ios --profile staging`
- [ ] Run test build: `eas build --platform android --profile staging`

---

## 🟠 MEDIUM — Should Do Before Launch

### 9. Railway Environment Variables
Set ALL of these in Railway dashboard:

```
# Database (use POOLED Neon URL for runtime)
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require

# Auth
JWT_SECRET=<generate: openssl rand -hex 32>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
APPLE_CLIENT_ID=com.octopuslabs.repwise

# Email
AWS_ACCESS_KEY_ID=<from AWS IAM>
AWS_SECRET_ACCESS_KEY=<from AWS IAM>
AWS_REGION=us-east-1
SES_SENDER_EMAIL=noreply@repwise.app
SES_REGION=us-east-1

# Storage
R2_ACCESS_KEY=<from Cloudflare R2>
R2_SECRET_KEY=<from Cloudflare R2>
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=repwise-uploads
CDN_BASE_URL=https://cdn.repwise.app

# Payments
REVENUECAT_API_KEY=<from RevenueCat>
REVENUECAT_WEBHOOK_AUTH_KEY=<from RevenueCat>

# Rate Limiting
REDIS_URL=<from Railway Redis plugin>

# Observability
SENTRY_DSN=<from Sentry>
POSTHOG_PROJECT_API_KEY=<from PostHog>

# Push Notifications
EXPO_ACCESS_TOKEN=<from Expo>

# App Config
DEBUG=false
ALLOWED_HOSTS=["api.repwise.app"]
CORS_ORIGINS=["https://repwise.app"]
USDA_API_KEY=<from https://fdc.nal.usda.gov/api-key-signup.html>
```

### 10. App Store Metadata Preparation
**Apple App Store Connect:**
- [ ] App name: "Repwise" (30 chars max)
- [ ] Subtitle: "Smart Workout & Nutrition Tracker" (30 chars)
- [ ] Keywords: "workout,nutrition,hypertrophy,gym,fitness,tracker,macros,volume" (100 chars)
- [ ] Description: 4,000 chars — focus on dual training+nutrition value prop
- [ ] Screenshots: 6.7" iPhone (1290×2796), 6.5" iPhone, iPad (optional)
- [ ] Category: Health & Fitness
- [ ] Age Rating: 12+ (social features with UGC)
- [ ] App Privacy nutrition labels — declare all data types

**Google Play Console:**
- [ ] Title: "Repwise - Workout & Nutrition" (30 chars)
- [ ] Short description: "Track workouts, nutrition, and muscle stimulus with science-backed tools" (80 chars)
- [ ] Full description: 4,000 chars
- [ ] Feature graphic: 1024×500px
- [ ] Screenshots: phone + tablet
- [ ] Content rating: complete IARC questionnaire
- [ ] Data Safety section: declare all data types
- [ ] Target API level: 35 (Android 15)

### 11. Sentry Configuration
- [ ] Create Sentry project for React Native
- [ ] Create Sentry project for FastAPI (or use same with different environments)
- [ ] Set `SENTRY_DSN` in Railway
- [ ] Set `EXPO_PUBLIC_SENTRY_DSN` in EAS build env
- [ ] Configure 5 alert rules (webhook failures, 500 spikes, slow responses, Redis errors, job failures)
- [ ] Upload source maps during EAS build (add `@sentry/react-native` Expo plugin)

### 12. PostHog Feature Flags
- [ ] Create 5 flags in PostHog dashboard:
  - `premium-coaching` (ON for premium users)
  - `premium-volume-landmarks` (OFF — free for now)
  - `premium-weekly-reports` (OFF — free for now)
  - `feature-social-feed` (5% rollout)
  - `feature-simple-mode` (25% rollout)

---

## 🟢 LOW — Nice to Have Before Launch

### 13. Placeholder URLs
- [ ] Create Calendly booking page for coaching (or remove coaching feature)
- [ ] Create Telegram community group (or remove link)

### 14. Monitoring
- [ ] Set up UptimeRobot for `https://api.repwise.app/api/v1/health` (free, 5-min checks)
- [ ] Verify Railway auto-restart works (deploy, kill process, verify restart)

### 15. Backup Strategy
- [ ] Neon has automatic daily snapshots (free tier: 6-hour restore window)
- [ ] For launch: manually snapshot before each deploy via Neon dashboard
- [ ] Consider enabling point-in-time recovery (requires paid plan)

### 16. Pre-Launch Testing
- [ ] Install on real iOS device via TestFlight
- [ ] Install on real Android device via internal testing track
- [ ] Complete full flow: register → onboarding → log workout → log nutrition → check dashboard → check analytics
- [ ] Test offline: airplane mode → log workout → reconnect → verify sync
- [ ] Test Simple Mode discovery modal
- [ ] Test import from Strong CSV (export from Strong, import into Repwise)

---

## Database Deep Dive — What Needs Updating on Neon

Your Neon database needs these schema changes from our session:

**New tables (must be created via migration):**
- `follows` — social graph
- `feed_events` — activity feed
- `reactions` — feed reactions
- `leaderboard_entries` — weekly leaderboards
- `shared_templates` — shared workout templates

**New indexes:**
- GIN index on `training_sessions.exercises` (JSONB)
- GIN index on `food_items.micro_nutrients` (JSONB)
- GIN index on `user_profiles.preferences` (JSONB)
- GIN index on `content_articles.tags` (JSONB)
- B-tree index on `token_blacklist.expires_at`

**New columns:**
- `export_requests.retry_count` (INTEGER, default 0)

**Migration command (run against Neon DIRECT URL):**
```bash
DATABASE_URL="postgresql+asyncpg://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require" \
  alembic upgrade head
```

**⚠️ IMPORTANT:** Fix the FTS5 migration BEFORE running this, or it will fail on PostgreSQL.

---

## Neon Free Tier — Do You Need to Upgrade?

**Free tier gives you:**
- 0.5 GB storage
- 100 compute-hours/month
- Scale to zero after 5 min idle

**You need to upgrade when:**
- Storage > 0.5 GB (~500+ active users with full workout history)
- Compute hours exhausted (sustained traffic throughout the month)
- You want to disable scale-to-zero (eliminates cold start latency)

**For launch:** Free tier is fine. Upgrade to Launch plan (~$2-5/mo) when you get consistent traffic.

**Connection string tips:**
- Use POOLED URL for your app: `...@ep-xxx-pooler.region.aws.neon.tech/...`
- Use DIRECT URL for migrations: `...@ep-xxx.region.aws.neon.tech/...`
- Always include `?sslmode=require`
- Prefix with `postgresql+asyncpg://` (not just `postgresql://`)
