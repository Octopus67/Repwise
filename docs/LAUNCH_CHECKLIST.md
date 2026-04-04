# Repwise — Launch Checklist

**Generated:** 2026-03-29
**Status:** Pre-launch — 862 uncommitted files, 0 unpushed commits

---

## Phase 0: Commit & Push (DO THIS FIRST)

862 files of work are sitting uncommitted. This is the single biggest risk — a disk failure loses everything.

- [ ] **Clean up exports/** — 300+ test export dirs (~1.5MB). Add `exports/` to `.gitignore`
- [ ] **Clean up .kiro agent artifacts** — `.kiro/logs/`, `.kiro/memory/`, `.kiro/vector-db/` should be gitignored
- [ ] **Gitignore dev artifacts** — `dev.db.bak`, `.yolo-sisyphus/`, `.kiro/AGENT-STATUS.md`, etc.
- [ ] **Stage and commit in logical chunks:**
  1. `chore: cleanup dead code + consolidated migrations` (17 deletions)
  2. `feat: RevenueCat migration — remove Stripe/Razorpay` (payments module)
  3. `feat: social module — feed, reactions, leaderboard, shared templates` (social/)
  4. `feat: offline support — TanStack Query, MMKV, network manager` (services/)
  5. `feat: new middleware — rate limiting, security headers, timeouts` (middleware/)
  6. `feat: new screens + components` (training decomposition, import, social)
  7. `feat: steering docs + test updates` (docs, tests)
  8. `chore: website SEO improvements` (repwise-website/ — separate repo)
- [ ] **Push all commits to origin/main**
- [ ] **Verify CI passes** — 4 workflows, 16 jobs

---

## Phase 1: Critical — App Won't Work Without These

### 1.1 Fix FTS5 Migration for PostgreSQL
- [ ] Add dialect check in `src/database/migrations/versions/fts5_auto_sync.py`
- [ ] SQLite: keep FTS5 triggers. PostgreSQL: skip or use `tsvector` + GIN
- **Risk:** Alembic upgrade crashes on Neon without this

### 1.2 AWS SES Email Setup
- [ ] Verify `repwise.app` domain in SES
- [ ] Add DKIM (3 CNAMEs), SPF, DMARC DNS records
- [ ] Request production access (exit sandbox) — 24-48h wait
- **Risk:** No verification emails, no password resets

### 1.3 Neon Database Migration
- [ ] Get DIRECT connection string (not pooled)
- [ ] Fix FTS5 migration first (1.1)
- [ ] Run: `DATABASE_URL="<direct-url>" alembic upgrade head`
- [ ] Verify all tables created (social tables, GIN indexes, export columns)
- [ ] Switch Railway to POOLED connection string for runtime
- **Risk:** Schema mismatch = 500 errors on every endpoint

### 1.4 Railway Environment Variables
- [ ] `JWT_SECRET` — `openssl rand -hex 32`
- [ ] `DATABASE_URL` — Neon pooled URL
- [ ] `REDIS_URL` — Railway Redis plugin
- [ ] `SENTRY_DSN` — from Sentry project
- [ ] `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `SES_SENDER_EMAIL`
- [ ] `REVENUECAT_API_KEY` + `REVENUECAT_WEBHOOK_AUTH_KEY`
- [ ] `POSTHOG_PROJECT_API_KEY`
- [ ] `R2_ACCESS_KEY` + `R2_SECRET_KEY` + `R2_ENDPOINT_URL` + `R2_BUCKET_NAME`
- [ ] `USDA_API_KEY`
- [ ] `DEBUG=false`
- [ ] `ALLOWED_HOSTS=["api.repwise.app"]`
- [ ] `CORS_ORIGINS=["https://repwise.app"]`

---

## Phase 2: App Store Submission Blockers

### 2.1 Apple Developer Program
- [ ] Enroll ($99/yr) at developer.apple.com
- [ ] Wait for approval (24-48h)
- [ ] Create App ID with "Sign in with Apple" capability
- [ ] Create Services ID for backend OAuth
- [ ] Note Team ID → set `APPLE_CLIENT_ID` in Railway

### 2.2 Google Play Console
- [ ] Create developer account ($25 one-time)
- [ ] Create app listing
- [ ] Upload service account JSON for EAS Submit

### 2.3 Legal Pages
- [ ] Host privacy policy at `repwise.app/privacy` (exists in `docs/privacy-policy.md`)
- [ ] Host terms of service at `repwise.app/terms` (exists in `docs/terms-of-service.md`)
- [ ] Option: deploy via repwise-website (Next.js, already exists)

### 2.4 DNS Configuration
- [ ] `api.repwise.app` → Railway CNAME
- [ ] `cdn.repwise.app` → Cloudflare R2
- [ ] `repwise.app` → website hosting (Vercel/Cloudflare Pages)
- [ ] Verify propagation at dnschecker.org

### 2.5 RevenueCat Setup
- [ ] Create account at app.revenuecat.com
- [ ] Connect App Store (upload .p8 key)
- [ ] Connect Play Store (upload service account JSON)
- [ ] Create products: `repwise_monthly` ($9.99), `repwise_yearly` ($79.99)
- [ ] Create `premium` entitlement, attach both products
- [ ] Create default offering
- [ ] Set webhook URL: `https://api.repwise.app/api/v1/payments/webhook/revenuecat`
- [ ] Copy SDK keys to EAS env: `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`

### 2.6 EAS Build
- [ ] Update `eas.json` with real Apple ID + Team ID
- [ ] Test build: `eas build --platform ios --profile staging`
- [ ] Test build: `eas build --platform android --profile staging`
- [ ] Verify builds install and run on real devices

### 2.7 App Store Metadata
- [ ] App name, subtitle, keywords, description (both stores)
- [ ] Screenshots: 6.7" iPhone (1290×2796), 6.5" iPhone
- [ ] Feature graphic (Play Store): 1024×500px
- [ ] Privacy nutrition labels (App Store)
- [ ] Data Safety section (Play Store)
- [ ] Age rating: 12+
- [ ] Category: Health & Fitness

---

## Phase 3: Observability & Safety

### 3.1 Sentry
- [ ] Create React Native project
- [ ] Create FastAPI project (or same project, different env)
- [ ] Set DSNs in Railway + EAS env
- [ ] Configure alert rules: 500 spikes, slow responses, webhook failures
- [ ] Upload source maps during EAS build

### 3.2 PostHog Feature Flags
- [ ] Create project at posthog.com
- [ ] Create flags: `premium-coaching`, `feature-social-feed` (5%), `feature-simple-mode` (25%)
- [ ] Set `POSTHOG_PROJECT_API_KEY` in Railway + EAS

### 3.3 Uptime Monitoring
- [ ] UptimeRobot (free) → `https://api.repwise.app/api/v1/health`
- [ ] 5-min check interval, email + Telegram alerts

### 3.4 GitHub Branch Protection
- [ ] Require PR before merging to main
- [ ] Required status checks: Lint, Type Check, Unit Tests, Coverage >80%, Migration Round-Trip, Security Scan
- [ ] Require branches up to date
- [ ] No bypass for admins

### 3.5 GitHub Secrets
- [ ] `EXPO_TOKEN` — for EAS builds
- [ ] `RAILWAY_TOKEN` — for auto-deploy
- [ ] `CODECOV_TOKEN` — for coverage reporting (optional)
- [ ] Variable: `RAILWAY_URL` = `api.repwise.app`

---

## Phase 4: Cron Jobs & Background Work

Railway needs a scheduler for 7 cron jobs:

- [ ] `permanent_deletion.py` — daily (GDPR)
- [ ] `cleanup_blacklist.py` — daily (expired tokens)
- [ ] `trial_expiration.py` — hourly (trial downgrades)
- [ ] `export_worker.py` — every 5 min (pending exports)
- [ ] `cleanup_exports.py` — daily (expired export files)
- [ ] `refresh_leaderboards.py` — every 15 min
- [ ] `workout_reminders.py` — every 2 hours (push notifications)

Options: Railway cron service, or APScheduler in-process.

---

## Phase 5: Pre-Launch Testing

- [ ] Install on real iOS device via TestFlight
- [ ] Install on real Android device via internal track
- [ ] Full flow: register → onboarding → log workout → log nutrition → dashboard → analytics
- [ ] Test offline: airplane mode → log workout → reconnect → verify sync
- [ ] Test payment flow: subscribe → verify premium → cancel → verify downgrade
- [ ] Test email: register → check verification email → verify → login
- [ ] Test password reset flow end-to-end
- [ ] Load test: 50 concurrent users against Railway (k6 or similar)

---

## Phase 6: Launch Day

- [ ] Final `alembic upgrade head` on Neon
- [ ] Deploy to Railway (verify health check passes)
- [ ] Submit iOS build to App Store Review
- [ ] Submit Android build to Play Store Review
- [ ] Monitor Sentry for first 24 hours
- [ ] Monitor Railway logs for errors
- [ ] Announce on social channels

---

## Cost Summary at Launch

| Service | Monthly Cost |
|---------|-------------|
| Railway (backend + Redis) | ~$10 |
| Neon PostgreSQL (free tier) | $0 |
| AWS SES (first 62K emails free) | $0 |
| Cloudflare R2 (10GB free) | $0 |
| Sentry (free tier) | $0 |
| PostHog (free tier, 1M events) | $0 |
| RevenueCat (free under $2.5K MRR) | $0 |
| UptimeRobot (free) | $0 |
| Apple Developer | $8.25 ($99/yr) |
| Google Play | $0 ($25 one-time) |
| **Total** | **~$18/mo** |

---

## What's Already Done ✅

- [x] Security hardening (rate limiting, HTTPS redirect, crypto-secure OTP, token lifecycle)
- [x] CI/CD pipeline (4 workflows, 16 jobs)
- [x] Onboarding wizard (4 phases of improvements)
- [x] RevenueCat migration (Stripe/Razorpay removed)
- [x] Social module (feed, reactions, leaderboard, shared templates)
- [x] Offline support (TanStack Query + MMKV)
- [x] 1,618 backend tests + 2,445 frontend tests passing
- [x] Privacy policy + Terms of Service drafted
- [x] App store copy drafted (`docs/app-store-copy.md`)
- [x] Website built (`repwise-website/`)
- [x] WNS volume engine + fatigue detection
- [x] Micronutrient dashboard (27 nutrients)
- [x] Adaptive macro engine
- [x] Weekly intelligence reports
