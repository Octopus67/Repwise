# Repwise Launch Checklist

> Generated: 2026-04-08 | App Version: 1.0.0
> Status: **Pre-Launch** | Overall Readiness: ~70%

---

## Phase 0: Critical Blockers (Must Fix Before Anything Else)

### 🔴 Security — Secrets & Credentials
- [ ] **Rotate ALL secrets in `.env`** — AWS SES keys, JWT secret, RevenueCat keys, Google OAuth client secret are in plaintext on disk. Even though `.env` is gitignored, rotate them as a precaution.
- [ ] **Audit git history for leaked secrets** — Run `git log --all -p -- .env` and `trufflehog` or `gitleaks` to verify no secrets were ever committed.
- [ ] **Move secrets to a secrets manager** — Railway has built-in env var management. Never store production secrets in files.
- [ ] **Generate production JWT_SECRET** — Must be ≥32 chars, cryptographically random: `openssl rand -base64 48`

### 🔴 Infrastructure — Services to Provision
- [ ] **PostgreSQL** — Verify Railway Postgres is provisioned with SSL, connection pooling, and automated backups
- [ ] **Redis** — Provision Redis instance (Railway add-on or Upstash). Required for rate limiting, session management, scheduler locks. Without it, rate limiting falls back to in-memory (resets on deploy).
- [ ] **Cloudflare R2** — Create bucket for progress photos, food images, export files. Set CORS policy for `api.repwise.app`.
- [ ] **Cloudflare CDN** — Set up `cdn.repwise.app` pointing to R2 bucket
- [ ] **AWS SES** — Verify sender domain `repwise.app`, move out of sandbox, set up DKIM/SPF/DMARC
- [ ] **DNS** — Configure `repwise.app`, `api.repwise.app`, `cdn.repwise.app` records

---

## Phase 1: Backend Production Readiness

### Environment Configuration
- [ ] Set `ENVIRONMENT=production` 
- [ ] Set `DEBUG=False`
- [ ] Set `ALLOWED_HOSTS=api.repwise.app`
- [ ] Set `CORS_ORIGINS=https://app.repwise.app` (and any web domains)
- [ ] Set `DATABASE_URL` to production PostgreSQL (with `?sslmode=require`)
- [ ] Set `REDIS_URL` to production Redis
- [ ] Set `SENTRY_DSN` for backend error tracking
- [ ] Set `POSTHOG_PROJECT_API_KEY` for analytics
- [ ] Set `USDA_API_KEY` — replace `DEMO_KEY` with real key (1000 req/hr limit otherwise)
- [ ] Set `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET_NAME`
- [ ] Set `CDN_BASE_URL=https://cdn.repwise.app`
- [ ] Set `SES_SENDER_EMAIL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_REGION`
- [ ] Set `GOOGLE_CLIENT_ID` for OAuth
- [ ] Set `APPLE_CLIENT_ID` (bundle ID: `com.octopuslabs.repwise`)
- [ ] Set `REVENUECAT_API_KEY` + `REVENUECAT_WEBHOOK_AUTH_KEY`
- [ ] Set `EXPO_ACCESS_TOKEN` for push notifications

### Database
- [ ] Run `alembic upgrade head` on production database
- [ ] Verify all 35+ migrations apply cleanly
- [ ] Set up automated daily database backups (Railway or pg_dump cron)
- [ ] Configure connection pool limits (`pool_size`, `max_overflow`) for expected load
- [ ] Seed feature flags (`push_notifications`, `body_measurements`, volume landmarks)
- [ ] Seed founder content if applicable

### Sync Redis (P0 from audit — still pending)
- [ ] **Replace sync `redis` with `redis.asyncio`** in all middleware files — this is the #1 production stability risk. Under concurrent load, sync Redis blocks the entire async event loop.
  - `src/middleware/rate_limiter.py`
  - `src/middleware/global_rate_limiter.py`
  - `src/services/redis_rate_limiter.py`
  - `src/services/redis.py`
  - `src/scheduler.py`

### API Hardening
- [ ] Verify HTTPS redirect middleware is active
- [ ] Verify security headers (CSP, HSTS, X-Frame-Options) are set
- [ ] Verify rate limiting thresholds are appropriate for launch load
- [ ] Reduce Sentry traces sample rate from 0.2 to 0.1 after 2-week stabilization (TODO in main.py)
- [ ] Set up health check endpoint monitoring (e.g., UptimeRobot, Better Uptime)

### Background Jobs
- [ ] Verify scheduler runs: permanent account deletion job (daily)
- [ ] Verify export generation background task has error handling (add if missing)
- [ ] Set up dead letter queue or alerting for failed background jobs

---

## Phase 2: Mobile App Build & Configuration

### Build Environment
- [ ] Set `EXPO_PUBLIC_API_URL=https://api.repwise.app` in EAS secrets
- [ ] Set `EXPO_PUBLIC_POSTHOG_KEY` in EAS secrets
- [ ] Set `EXPO_PUBLIC_SENTRY_DSN` in EAS secrets
- [ ] Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- [ ] Set `EXPO_PUBLIC_RC_IOS_KEY` and `EXPO_PUBLIC_RC_ANDROID_KEY` (RevenueCat)
- [ ] Enable Sentry source map upload (currently disabled: `SENTRY_DISABLE_AUTO_UPLOAD: "true"`)

### iOS Build
- [ ] Run `eas credentials` to set up Apple Distribution Certificate
- [ ] Run `eas credentials` to set up iOS Provisioning Profile (App Store)
- [ ] Upload APNs key to Expo dashboard for push notifications
- [ ] Run `eas build --platform ios --profile production`
- [ ] Test production build on physical device via TestFlight

### Android Build
- [ ] Create Google Play service account and download JSON key
- [ ] Place at `./google-play-service-account.json` (gitignored)
- [ ] Run `eas build --platform android --profile production`
- [ ] Test production build on physical device via internal testing track

### App Configuration
- [ ] Fix splash screen config — add `image` key pointing to `./assets/splash.png` with `resizeMode: "contain"`
- [ ] Decide on iPad support (`supportsTablet: false` currently)
- [ ] Consider enabling React Native New Architecture (`newArchEnabled: true`) for performance
- [ ] Consider adding `expo-updates` for OTA updates post-launch

---

## Phase 3: App Store Submission

### Apple App Store
- [ ] **App Store Connect setup:**
  - [ ] App name: "Repwise"
  - [ ] Subtitle (30 chars max)
  - [ ] Description (4000 chars max)
  - [ ] Keywords (100 chars max, comma-separated)
  - [ ] Promotional text
  - [ ] What's New text for v1.0.0
- [ ] **Screenshots** (required sizes):
  - [ ] iPhone 6.7" (1290×2796) — at least 3
  - [ ] iPhone 6.5" (1284×2778) — at least 3
  - [ ] iPhone 5.5" (1242×2208) — at least 3
  - [ ] iPad Pro 12.9" (2048×2732) — if supporting tablet
- [ ] **App Preview videos** (optional but recommended, 15-30 sec)
- [ ] **App icon** — 1024×1024 PNG, no alpha, no rounded corners (Apple adds them)
- [ ] **Privacy Nutrition Labels** — declare all data types collected:
  - [ ] Health & Fitness (workout data, body measurements)
  - [ ] Contact Info (email, name)
  - [ ] Identifiers (user ID)
  - [ ] Usage Data (analytics via PostHog)
  - [ ] Diagnostics (crash logs via Sentry)
- [ ] **App Tracking Transparency** — add `expo-tracking-transparency` plugin and ATT prompt (PostHog + Sentry = tracking)
- [ ] **HealthKit usage description** — required since app reads Apple Health data
- [ ] **Age rating** — 4+ (fitness app, no objectionable content)
- [ ] **Review notes** — provide test account credentials for Apple reviewer
- [ ] **Contact info** — support URL, marketing URL, privacy policy URL
- [ ] Submit via `eas submit --platform ios`

### Google Play Store
- [ ] **Google Play Console setup:**
  - [ ] Short description (80 chars)
  - [ ] Full description (4000 chars)
  - [ ] Feature graphic (1024×500)
  - [ ] Screenshots — phone (min 2), tablet (if supporting)
  - [ ] Hi-res icon (512×512)
- [ ] **Content rating questionnaire** — complete IARC rating
- [ ] **Data safety section:**
  - [ ] Data collected: name, email, health info, photos, app activity
  - [ ] Data shared: analytics (PostHog), crash reports (Sentry)
  - [ ] Data deletion: yes (account deletion feature)
  - [ ] Data encryption: yes (HTTPS + encrypted at rest)
- [ ] **Target audience** — 13+ (fitness app)
- [ ] **Pricing** — Free (with in-app purchases)
- [ ] Submit via `eas submit --platform android`

---

## Phase 4: Legal & Compliance

### 🔴 Must Fix Before Launch
- [ ] **Add HealthKit/Health Connect disclosure to privacy policy** — Apple requires explicit mention of what HealthKit data is read (HRV, resting HR, sleep) and how it's used. App Store rejection risk without this.
- [ ] **Add auto-renewal disclosure to UpgradeModal** — Apple/Google require visible text near the subscribe button: "Subscription auto-renews at $X/period unless cancelled at least 24 hours before the end of the current period. Cancel anytime in Settings > Subscriptions."
- [ ] **Add in-app health disclaimer during onboarding** — "Repwise provides general fitness information. It is not medical advice. Consult a healthcare professional before starting any exercise or nutrition program." Show once, require acknowledgment.

### Should Fix
- [ ] Verify privacy policy covers all third-party SDKs (RevenueCat, Sentry, PostHog, Expo) — currently covers RevenueCat, Sentry, PostHog. Add Expo if push notification tokens are sent to Expo servers.
- [ ] Verify GDPR data export includes ALL user data (check: does export include health data from Apple Health/Health Connect?)
- [ ] Add data processing agreement (DPA) references for EU users if applicable
- [ ] Verify 30-day deletion grace period is clearly communicated in the app UI (not just privacy policy)

---

## Phase 5: Payments & Monetization

### RevenueCat Setup
- [ ] Create RevenueCat project at `app.revenuecat.com`
- [ ] Create iOS app in RevenueCat, add App Store Connect shared secret
- [ ] Create Android app in RevenueCat, add Google Play service credentials
- [ ] Create products/entitlements matching your subscription tiers
- [ ] Configure webhook URL: `https://api.repwise.app/payments/webhook`
- [ ] Set `REVENUECAT_API_KEY` and `REVENUECAT_WEBHOOK_AUTH_KEY` in production env
- [ ] Set `EXPO_PUBLIC_RC_IOS_KEY` and `EXPO_PUBLIC_RC_ANDROID_KEY` in EAS secrets
- [ ] Test purchase flow end-to-end in sandbox (iOS) and test track (Android)
- [ ] Test restore purchases flow
- [ ] Test subscription expiry and grace period handling
- [ ] Verify premium feature gating works (coaching, reports, etc.)

### App Store Pricing
- [ ] Set up subscription products in App Store Connect
- [ ] Set up subscription products in Google Play Console
- [ ] Configure pricing tiers for all target markets
- [ ] Set up introductory offers / free trial if applicable

---

## Phase 6: Monitoring & Observability

### Error Tracking
- [ ] Verify Sentry is receiving backend errors (test with a deliberate error)
- [ ] Verify Sentry is receiving frontend crashes
- [ ] Enable Sentry source map upload for readable stack traces
- [ ] Set up Sentry alerts for: error spike, new issue, unhandled exception
- [ ] Create Sentry release tracking (tag deploys with version)

### Analytics
- [ ] Verify PostHog is receiving events
- [ ] Set up key funnels: onboarding completion, first workout, first food log, subscription conversion
- [ ] Set up retention cohorts: D1, D7, D30
- [ ] Set up feature flag targeting rules

### Uptime & Performance
- [ ] Set up uptime monitoring for `https://api.repwise.app/health` (UptimeRobot, Better Uptime, or similar)
- [ ] Set up alerting for: API down, response time > 2s, error rate > 5%
- [ ] Set up database monitoring: connection count, query latency, disk usage
- [ ] Set up Redis monitoring: memory usage, connection count

### Logging
- [ ] Verify structured logging is working in production
- [ ] Set up log aggregation (Railway logs, or ship to Datadog/Logtail)
- [ ] Verify sensitive data is redacted in logs (email masking, query param scrubbing)

---

## Phase 7: Testing & QA

### Current Test Status ✅
- Backend: 1793 tests passing
- Frontend: 1998 tests passing
- E2E (Playwright): 126 tests passing

### Pre-Launch QA
- [ ] Full manual QA pass on iOS production build (TestFlight)
- [ ] Full manual QA pass on Android production build (internal track)
- [ ] Test on older devices: iPhone SE (small screen), iPhone 15 Pro Max (large screen)
- [ ] Test on Android: Samsung Galaxy S21 (mainstream), Pixel 7 (stock Android)
- [ ] Test with slow network (3G simulation)
- [ ] Test with no network (airplane mode) — verify offline behavior
- [ ] Test with large datasets (100+ workouts, 1000+ food entries)
- [ ] Test deep links from external sources (email, SMS, social media)
- [ ] Test push notifications (foreground, background, cold start)
- [ ] Test subscription purchase, restore, and expiry flows
- [ ] Test account deletion and re-registration
- [ ] Test Google Sign-In and Apple Sign-In on both platforms
- [ ] Test forgot password flow end-to-end
- [ ] Test data export (JSON, CSV, PDF)
- [ ] Test data import (CSV)
- [ ] Test progress photo upload, viewing, and deletion
- [ ] Accessibility audit: VoiceOver (iOS), TalkBack (Android)

---

## Phase 8: Launch Day

### Pre-Launch (24 hours before)
- [ ] Final production build: `eas build --platform all --profile production`
- [ ] Submit to App Store and Google Play
- [ ] Verify all production env vars are set
- [ ] Run `alembic upgrade head` on production DB
- [ ] Seed production feature flags
- [ ] Verify health check endpoint returns 200
- [ ] Verify email sending works (send test email via SES)
- [ ] Verify push notifications work (send test notification)
- [ ] Verify RevenueCat webhook is receiving events
- [ ] Take a database backup

### Launch Day
- [ ] Monitor Sentry for new errors
- [ ] Monitor API response times
- [ ] Monitor database connection count
- [ ] Monitor Redis memory usage
- [ ] Watch App Store Connect / Google Play Console for review status
- [ ] Prepare hotfix branch in case of critical issues
- [ ] Have rollback plan ready (previous Railway deployment)

### Post-Launch (First Week)
- [ ] Monitor crash-free rate (target: >99.5%)
- [ ] Monitor API error rate (target: <1%)
- [ ] Monitor onboarding completion rate
- [ ] Monitor D1 retention
- [ ] Address any App Store review feedback
- [ ] Reduce Sentry traces sample rate to 0.1 after stabilization
- [ ] Review user feedback and prioritize fixes
- [ ] Set up automated database backup verification

---

## Remaining Code Fixes (from Super Audit)

### Still Pending (not yet implemented)
- [ ] **P0: Replace sync Redis with `redis.asyncio`** — production stability risk
- [ ] **P0: Rotate production secrets** — credential security
- [ ] **P1: Fix `text(f"...")` SQL pattern in `food_database/search_service.py`** — not currently exploitable but one refactor away
- [ ] **P1: Add error handling to export background task** — stuck "pending" on failure
- [ ] **P1: Fix feature flag cache inconsistency across workers** — different workers serve different states
- [ ] **P1: Add missing `server_default` on 7+ model columns** — raw SQL inserts could violate NOT NULL
- [ ] **P2: Add CAPTCHA integration** — bot registration protection (TODO in settings.py)
- [ ] **P2: Fix 42 ScrollView + .map() patterns** — use FlatList for virtualization
- [ ] **P2: Add image caching for progress photos** — re-downloaded each render
- [ ] **P2: Fix `selectedDate` stale after midnight** — no AppState listener

---

## Summary: Launch Readiness by Category

| Category | Ready? | Blockers |
|----------|--------|----------|
| Code Quality | ✅ 95% | Sync Redis is the one P0 |
| Tests | ✅ 100% | 3917 tests passing, 0 failures |
| Infrastructure | ❌ 40% | Redis, R2, SES, CDN not provisioned |
| App Store | ❌ 20% | No screenshots, metadata, or ATT prompt |
| Legal | ⚠️ 80% | HealthKit disclosure + auto-renewal text missing |
| Payments | ❌ 30% | RevenueCat not configured, no products created |
| Monitoring | ⚠️ 60% | Sentry works, need uptime + alerting |
| Security | ⚠️ 70% | Secrets rotation + sync Redis |

**Estimated time to launch-ready: 2-3 weeks** with focused effort on infrastructure, app store assets, and payments setup.
