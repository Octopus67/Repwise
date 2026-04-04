# Repwise — Comprehensive Multi-Phase Design Plan

**Created:** 2026-03-19
**Status:** PLAN ONLY — Do not implement until reviewed
**Author:** Automated audit + design system

---

## Overview

This plan addresses every bug, edge case, and improvement identified in the comprehensive Repwise audit. It is organized into 4 phases ordered by severity and dependency:

- **Phase 0 — Critical Launch Blockers** (must fix before App Store submission)
- **Phase 1 — High Priority** (fix within 2 weeks of launch)
- **Phase 2 — Feature Additions** (social, Apple Watch, coaching, onboarding)
- **Phase 3 — Medium/Low Priority** (performance, cleanup, polish)

### Key Decisions (from founder input)
- App launches 100% free — no paywall except premium 1:1 coaching
- Design feature gating for future premium (boolean flags per feature)
- Keep full scope — no feature cuts except skip Food DNA onboarding step
- RevenueCat for iOS IAP + Google Play + Razorpay separate for India
- TanStack Query v5 + MMKV for offline queue
- Native SwiftUI Apple Watch app + react-native-watch-connectivity
- PostHog for feature flags (replace custom DB table)
- Fan-out-on-read social feed architecture
- Web version is testing-only — web bugs are acceptable

---


## Phase 0 — Critical Launch Blockers

**Timeline:** 5-7 days | **Must complete before App Store submission**

---

### P0-1: iOS In-App Purchase Compliance (App Store Guideline 3.1.1)

**Severity:** 🔴 CRITICAL — App Store will reject without this
**Effort:** 3-4 days
**Risk:** HIGH — touches payment flow, subscription lifecycle, receipt validation

#### Root Cause
The app uses Stripe + Razorpay for subscriptions. Apple requires StoreKit/IAP for all digital goods/subscriptions sold within iOS apps. This is a hard rejection under Guideline 3.1.1.

#### Fix Approach: RevenueCat Integration (Hybrid)

RevenueCat wraps Apple IAP + Google Play Billing with a unified SDK. Keep Razorpay separate for India (RevenueCat Web Billing is blocked for Indian Stripe accounts).

**Architecture:**
```
iOS App → RevenueCat SDK → Apple IAP → RevenueCat Webhooks → FastAPI
Android App (non-India) → RevenueCat SDK → Google Play Billing → RevenueCat Webhooks → FastAPI
Android App (India) → Razorpay SDK → Razorpay Webhooks → FastAPI (existing)
Web (non-India) → RevenueCat Web Billing → RevenueCat Webhooks → FastAPI
Web (India) → Razorpay → Razorpay Webhooks → FastAPI (existing)
```

#### Implementation Steps

**Step 1: RevenueCat Account + Dashboard Setup**
- Create RevenueCat account, create project
- Configure Apple App Store Connect credentials (shared secret, App Store Connect API key)
- Configure Google Play credentials (service account JSON)
- Create "Offerings" in RevenueCat dashboard matching current plans:
  - `repwise_monthly` — $9.99/mo
  - `repwise_yearly` — $79.99/yr
  - `repwise_coaching` — premium coaching tier (price TBD)
- Configure webhook URL: `https://api.repwise.app/api/v1/payments/webhook/revenuecat`

**Step 2: Backend — Add RevenueCat Provider**
- Files to create:
  - `src/modules/payments/revenuecat_provider.py` — implements `PaymentProvider` ABC
- Files to modify:
  - `src/modules/payments/router.py` — add `webhook_revenuecat()` endpoint
  - `src/modules/payments/service.py` — add RevenueCat as a provider option
  - `src/modules/payments/constants.py` — add RevenueCat plan IDs
  - `src/config/settings.py` — add `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`
- RevenueCat webhook handler:
  - Verify webhook auth header (`Authorization: Bearer <webhook_secret>`)
  - Handle events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE_DETECTED`, `SUBSCRIBER_ALIAS`
  - Map RevenueCat entitlements to local `Subscription` model
  - Idempotency via `WebhookEventLog` (existing pattern)
- Entitlement check: Add `check_revenuecat_entitlement(user_id)` that calls RevenueCat REST API as fallback

**Step 3: Frontend — RevenueCat SDK Integration**
- Install: `npx expo install react-native-purchases`
- Files to create:
  - `app/services/purchases.ts` — RevenueCat initialization, offering fetch, purchase flow
- Files to modify:
  - `app/components/premium/UpgradeModal.tsx` — replace Stripe checkout with RevenueCat purchase flow
  - `app/components/premium/UpgradeBanner.tsx` — update CTA
  - `app/components/premium/OnboardingTrialPrompt.tsx` — use RevenueCat trial
  - `App.tsx` — initialize RevenueCat with `Purchases.configure({apiKey, appUserID})`
- Platform routing:
  - iOS: Always use RevenueCat (Apple IAP)
  - Android: Use RevenueCat for non-India, Razorpay for India (detect via user's `region` field in profile)
  - Web: RevenueCat Web Billing for non-India, Razorpay for India

**Step 4: Subscription Lifecycle Unification**
- Modify `src/modules/payments/service.py`:
  - `get_subscription_status()` checks both RevenueCat entitlements AND local Razorpay subscriptions
  - Priority: RevenueCat is source of truth for iOS/Android, Razorpay for India web
- Modify `src/middleware/freemium_gate.py`:
  - `require_premium()` checks unified status
- Trial handling:
  - RevenueCat manages Apple/Google free trials natively
  - Keep existing `trial_service.py` for Razorpay users
  - Sync trial status: RevenueCat webhook `INITIAL_PURCHASE` with `is_trial_period=true`

#### Affected Files Summary
| File | Action | Risk |
|------|--------|------|
| `src/modules/payments/revenuecat_provider.py` | CREATE | Low |
| `src/modules/payments/router.py` | MODIFY — add webhook endpoint | Medium |
| `src/modules/payments/service.py` | MODIFY — add provider routing | Medium |
| `src/modules/payments/constants.py` | MODIFY — add RC plan IDs | Low |
| `src/config/settings.py` | MODIFY — add RC env vars | Low |
| `app/services/purchases.ts` | CREATE | Low |
| `app/components/premium/UpgradeModal.tsx` | MODIFY — RC purchase flow | High |
| `app/components/premium/UpgradeBanner.tsx` | MODIFY — update CTA | Low |
| `App.tsx` | MODIFY — RC init | Medium |

#### Testing
- New tests: `tests/test_revenuecat_provider.py` — webhook parsing, entitlement mapping, idempotency
- New tests: `tests/test_payment_service_unified.py` — multi-provider subscription status
- Manual: Test purchase flow in RevenueCat Sandbox (iOS Simulator + TestFlight)
- Manual: Verify Razorpay still works for India users
- Regression: Run existing `tests/test_payments/` suite — ensure Stripe/Razorpay paths unchanged

#### Ripple Effects
- `UpgradeModal` UX changes — purchase is now native sheet (Apple/Google) not web redirect
- Trial flow changes — Apple manages trial, not our backend (for iOS users)
- Winback service may need adjustment — RevenueCat has its own win-back offers

---

### P0-2: Offline Workout + Nutrition Queue

**Severity:** 🔴 CRITICAL — Users will lose workouts in gyms with poor connectivity
**Effort:** 3-4 days
**Risk:** HIGH — replaces core data persistence layer, touches workout save flow

#### Root Cause
No offline queue exists. `activeWorkoutSlice.ts` has crash recovery via AsyncStorage but no retry on network failure. If the POST to save a workout fails, the workout is lost. Comment in code: "Deferred: offline queue planned for v2."

#### Fix Approach: TanStack Query v5 + MMKV Persister

Replace manual `useEffect` + `axios` fetching with TanStack Query. Mutations auto-pause when offline and resume when connectivity returns. MMKV persister survives app restarts.

**Architecture:**
```
User finishes workout
  → useMutation('saveWorkout', payload)
    → Online? → POST /training/sessions → success → invalidate queries
    → Offline? → mutation paused, persisted to MMKV
      → App restart? → PersistQueryClientProvider restores mutations
      → Connectivity returns? → resumePausedMutations() → POST fires
```

#### Implementation Steps

**Step 1: Install Dependencies**
```bash
npx expo install @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister react-native-mmkv @react-native-community/netinfo
```

**Step 2: Create Query Infrastructure**
- Files to create:
  - `app/services/queryClient.ts` — QueryClient config with offline-friendly defaults
  - `app/services/mmkvStorage.ts` — MMKV instance + TanStack persister adapter
  - `app/services/networkManager.ts` — NetInfo listener → `onlineManager.setOnline()`
  - `app/hooks/useOnlineStatus.ts` — hook exposing current connectivity state
- Files to modify:
  - `App.tsx` — wrap app in `PersistQueryClientProvider` + `QueryClientProvider`
    - `onSuccess` callback: `queryClient.resumePausedMutations()`

**Step 3: Migrate Workout Save to TanStack Mutation**
- Files to modify:
  - `app/screens/training/ActiveWorkoutScreen.tsx` (line 392, `handleConfirmFinish`):
    - Replace direct `api.post('training/sessions', payload)` with `useMutation`
    - Add `mutationKey: ['saveWorkout']` for persistence
    - Add optimistic update: navigate to summary immediately, show "syncing" badge if offline
  - `app/store/activeWorkoutSlice.ts`:
    - Keep crash recovery (AsyncStorage persist) as backup
    - Add `pendingSync: boolean` flag to store
    - Clear store only after mutation succeeds (not on navigate)

**Step 4: Migrate Nutrition Save to TanStack Mutation**
- Files to modify:
  - `app/components/modals/AddNutritionModal.tsx` (line 250):
    - Replace `api.post('nutrition/entries', {...})` with `useMutation`
    - Add `mutationKey: ['logNutrition']` for persistence
    - Optimistic update: add entry to local list immediately

**Step 5: Offline Nutrition Search Fallback**
- Files to create:
  - `app/services/offlineFoodCache.ts` — cache user's recent + favorite foods in MMKV
- Files to modify:
  - `app/components/nutrition/FoodSearchPanel.tsx`:
    - When offline: search only cached recent/favorites (MMKV)
    - When online: search API as normal, cache results
    - Show "Offline — showing saved foods only" banner
  - `app/hooks/useRecentFoods.ts` (create):
    - `useQuery(['foods', 'recent'], fetchRecentFoods, { staleTime: 1h, gcTime: 7d })`
    - Cached in MMKV via persister — available offline

**Step 6: Sync Status UI**
- Files to create:
  - `app/components/common/SyncStatusBadge.tsx` — shows pending mutation count
  - `app/components/common/OfflineBanner.tsx` — "You're offline — changes will sync when connected"
- Files to modify:
  - `app/screens/training/WorkoutSummaryScreen.tsx` — show "Syncing..." if mutation pending
  - `app/screens/dashboard/DashboardScreen.tsx` — show OfflineBanner at top

**Step 7: Conflict Resolution (Last-Write-Wins)**
- Files to modify:
  - Backend `src/modules/training/service.py`:
    - Add `client_updated_at` field to `TrainingSessionCreate` schema
    - On POST: if session with same `client_id` exists and server's `updated_at` >= `client_updated_at`, skip (server wins)
    - On POST: if client is newer, upsert
  - Backend `src/modules/nutrition/service.py`:
    - Same pattern for nutrition entries
  - Frontend mutations:
    - Include `client_updated_at: new Date().toISOString()` in every mutation payload
    - Include `client_id: uuid()` for dedup

#### Affected Files Summary
| File | Action | Risk |
|------|--------|------|
| `app/services/queryClient.ts` | CREATE | Low |
| `app/services/mmkvStorage.ts` | CREATE | Low |
| `app/services/networkManager.ts` | CREATE | Low |
| `app/services/offlineFoodCache.ts` | CREATE | Low |
| `app/hooks/useOnlineStatus.ts` | CREATE | Low |
| `app/hooks/useRecentFoods.ts` | CREATE | Low |
| `app/components/common/SyncStatusBadge.tsx` | CREATE | Low |
| `app/components/common/OfflineBanner.tsx` | CREATE | Low |
| `App.tsx` | MODIFY — add providers | Medium |
| `ActiveWorkoutScreen.tsx` | MODIFY — mutation migration | HIGH |
| `activeWorkoutSlice.ts` | MODIFY — add pendingSync | Medium |
| `AddNutritionModal.tsx` | MODIFY — mutation migration | HIGH |
| `FoodSearchPanel.tsx` | MODIFY — offline fallback | Medium |
| `WorkoutSummaryScreen.tsx` | MODIFY — sync status | Low |
| `DashboardScreen.tsx` | MODIFY — offline banner | Low |
| `src/modules/training/service.py` | MODIFY — LWW conflict resolution | Medium |
| `src/modules/nutrition/service.py` | MODIFY — LWW conflict resolution | Medium |

#### Testing
- New tests: `__tests__/services/queryClient.test.ts` — persister setup, mutation defaults
- New tests: `__tests__/hooks/useOnlineStatus.test.ts` — NetInfo mock
- New tests: `__tests__/offline/workoutSync.test.ts` — offline save → online resume
- New tests: `__tests__/offline/nutritionSync.test.ts` — offline nutrition → online resume
- Backend tests: `tests/test_training_conflict.py` — LWW resolution
- Manual: Enable airplane mode → finish workout → disable airplane mode → verify sync
- Manual: Kill app mid-workout → reopen → verify crash recovery still works
- Regression: All existing workout/nutrition tests must pass

#### Ripple Effects
- AsyncStorage crash recovery in `activeWorkoutSlice.ts` becomes redundant (MMKV persister handles it) — keep as backup for now, remove in Phase 3
- All screens that fetch data will eventually migrate to `useQuery` — this phase only migrates the critical save paths
- `api.ts` interceptors (401 refresh) still work — TanStack Query uses the same axios instance

---

### P0-3: Multi-Worker Production Server

**Severity:** 🔴 CRITICAL — Single worker blocks under any real load
**Effort:** 1-2 hours
**Risk:** LOW — isolated change to Dockerfile

#### Root Cause
Dockerfile runs `uvicorn src.main:app` with no `--workers` flag. Single async event loop, single process. CPU-bound requests (analytics, e1RM calculations) block the entire server.

#### Fix Approach

Replace Uvicorn with Gunicorn + Uvicorn workers. Gunicorn manages process lifecycle, Uvicorn handles async.

#### Implementation Steps

**Step 1: Update Dockerfile**
- File: `Dockerfile` (line 25)
- Replace:
  ```dockerfile
  CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'
  ```
- With:
  ```dockerfile
  CMD gunicorn src.main:app -w ${WEB_CONCURRENCY:-4} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --timeout 120 --graceful-timeout 30 --keep-alive 5
  ```

**Step 2: Add Gunicorn Dependency**
- File: `pyproject.toml` or `requirements.txt`
- Add: `gunicorn>=22.0.0`

**Step 3: Adjust Connection Pool**
- File: `src/config/database.py`
- Current: `pool_size=10, max_overflow=20` → 30 connections per worker
- With 4 workers: 4 × 30 = 120 → exceeds Railway's 100 connection limit
- Fix: `pool_size=5, max_overflow=10` → 15 per worker × 4 = 60 connections (safe)
- Add: `pool_pre_ping=True` for connection health checks

**Step 4: Railway Environment Variable**
- Set `WEB_CONCURRENCY=4` in Railway dashboard (or 2 for Hobby plan)

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `Dockerfile` | MODIFY — CMD line | Low |
| `pyproject.toml` | MODIFY — add gunicorn | Low |
| `src/config/database.py` | MODIFY — pool sizes | Medium |

#### Testing
- Manual: Deploy to Railway staging, run `wrk` or `hey` load test
- Verify: Multiple concurrent requests don't block each other
- Verify: Health check endpoint responds under load
- Regression: All API tests pass (pool size change could surface connection issues)

#### Ripple Effects
- In-memory rate limiting breaks with multiple workers (addressed in P1-1)
- In-memory FTS cache in food_database becomes per-worker (acceptable — each worker builds its own cache)
- Redis becomes mandatory (addressed in P1-1)

---

### P0-4: Apple OAuth Configuration

**Severity:** 🔴 CRITICAL — App Store requires Sign in with Apple when offering social login
**Effort:** 2-4 hours
**Risk:** LOW — code is already implemented, just needs configuration

#### Root Cause
Apple OAuth is FULLY IMPLEMENTED in the codebase (`src/modules/auth/service.py:113-162`). JWKS verification, nonce handling, email extraction — all working. The only issue: `APPLE_CLIENT_ID` environment variable is not set in production, causing an `UnauthorizedError("Apple OAuth not configured")` response.

#### Implementation Steps

**Step 1: Apple Developer Account Setup**
- Create Apple Developer account ($99/yr) at developer.apple.com
- Create App ID with "Sign in with Apple" capability
- Create Services ID (this is the `client_id` for web/backend verification)
- Configure domains and return URLs

**Step 2: Set Environment Variables**
- File: Railway dashboard → Environment Variables
- Add: `APPLE_CLIENT_ID=com.octopuslabs.repwise` (must match bundle ID or Services ID)
- Add: `APPLE_TEAM_ID=<your_team_id>`

**Step 3: Expo Configuration**
- File: `app.json` — verify `expo-apple-authentication` plugin is configured (already present)
- File: `eas.json` — verify Apple credentials are configured for EAS Build

**Step 4: Verify Frontend**
- File: `app/components/auth/SocialLoginButtons.tsx:86` — Apple sign-in button already exists
- Verify: Button is visible on iOS, hidden on Android (Apple Sign-In is iOS-only in managed workflow)

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| Railway env vars | ADD — APPLE_CLIENT_ID, APPLE_TEAM_ID | Low |
| `app.json` | VERIFY — plugin config | Low |

#### Testing
- Manual: Test Apple Sign-In on iOS Simulator (requires Xcode 15+)
- Manual: Test on TestFlight with real Apple ID
- Verify: Login creates user, returns JWT, profile has Apple provider
- Regression: Google OAuth still works

---

### P0-5: GDPR — Wire Up Permanent Account Deletion

**Severity:** 🔴 CRITICAL — Data retention violation, App Store requires account deletion
**Effort:** 1-2 hours
**Risk:** LOW — function exists, just needs scheduling

#### Root Cause
`permanently_delete_expired_accounts()` in `src/modules/account/service.py:112` is defined but never called. Soft-deleted accounts past the 30-day grace period remain in the database forever.

#### Implementation Steps

**Step 1: Create Deletion Job**
- File to create: `src/jobs/permanent_deletion.py`
- Pattern: Follow existing job pattern (see `src/jobs/trial_expiration.py`)
- Logic:
  ```python
  async def run_permanent_deletion():
      async with get_db_session() as db:
          service = AccountService(db)
          deleted_count = await service.permanently_delete_expired_accounts()
          logger.info(f"Permanently deleted {deleted_count} expired accounts")
  ```

**Step 2: Schedule the Job**
- Railway cron job: Run daily at 3:00 AM UTC
- Command: `python -m src.jobs.permanent_deletion`

**Step 3: Audit Cascade Completeness**
- Verify `permanently_delete_expired_accounts()` cascades to:
  - `training_sessions` — user's workouts
  - `nutrition_entries` — user's food logs
  - `subscriptions` — payment records
  - `progress_photos` — R2 objects (must delete from Cloudflare R2 too)
  - `device_tokens` — push notification tokens
  - `audit_logs` — should these be retained? (GDPR says no if they contain PII)
  - `share_events`, `referrals` — anonymize referrer_id
- File to modify: `src/modules/account/service.py` — ensure R2 photo cleanup is included

**Step 4: Add Sentry Alerting**
- Add Sentry breadcrumb for each deletion
- Add Sentry alert if deletion fails (don't silently swallow exceptions)

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/jobs/permanent_deletion.py` | CREATE | Low |
| `src/modules/account/service.py` | MODIFY — verify cascade, add R2 cleanup | Medium |
| Railway cron config | ADD — daily job | Low |

#### Testing
- New test: `tests/test_permanent_deletion.py` — soft-delete user, advance time 31 days, run job, verify all data gone
- New test: Verify R2 objects are deleted (mock boto3)
- Manual: Create test user, delete account, wait (or mock time), run job, verify DB is clean

---

### P0-6: Legal URLs — Privacy Policy & Terms of Service

**Severity:** 🔴 CRITICAL — App Store reviewers check these links
**Effort:** 2-4 hours
**Risk:** LOW — static content

#### Root Cause
Legal URLs hardcoded to `repwise.app/privacy` and `repwise.app/terms` in 4 files. Domain may not be configured yet.

#### Fix Approach: Host on Cloudflare R2 + CDN (no domain purchase needed)

You already have `cdn.repwise.com` configured. Host static HTML pages there. Alternatively, use a free hosting option.

**Option A (Recommended): GitHub Pages**
- Create a `repwise-legal` repo on GitHub
- Add `privacy.html` and `terms.html`
- Enable GitHub Pages → `https://yourusername.github.io/repwise-legal/privacy.html`
- Free, no domain needed, easy to update

**Option B: Cloudflare R2 Static Site**
- Upload HTML files to R2 bucket
- Serve via `cdn.repwise.com/legal/privacy.html`

**Option C: Buy `repwise.app` domain ($12/yr)**
- Best long-term option — you'll need it for marketing anyway
- Host on Cloudflare Pages (free) or Vercel (free)

#### Implementation Steps

**Step 1: Write Legal Documents**
- Privacy Policy: Cover GDPR (EU), CCPA (California), India DPDP Act
  - Data collected: email, name, workout data, nutrition data, body measurements, photos
  - Third parties: Sentry (error tracking), PostHog (analytics), AWS SES (email), Cloudflare (CDN), RevenueCat (payments)
  - Data retention: 30 days after account deletion
  - Contact: your email
- Terms of Service: Standard fitness app terms
  - No medical advice disclaimer
  - User-generated content (workout data) ownership
  - Subscription terms and cancellation

**Step 2: Host the Pages**
- Choose Option A, B, or C above
- Deploy HTML pages

**Step 3: Update Frontend URLs**
- Files to modify:
  - `app/components/profile/AccountSection.tsx:119,125` — update URLs
  - `app/screens/auth/RegisterScreen.tsx:177,179` — update URLs
- Extract URLs to a constants file:
  - Create `app/constants/urls.ts`:
    ```typescript
    export const LEGAL_URLS = {
      privacy: 'https://yourusername.github.io/repwise-legal/privacy',
      terms: 'https://yourusername.github.io/repwise-legal/terms',
    };
    ```

**Step 4: Add to App Store Connect / Play Console**
- App Store Connect: Settings → App Information → Privacy Policy URL
- Google Play Console: Store Listing → Privacy Policy URL

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/constants/urls.ts` | CREATE | Low |
| `app/components/profile/AccountSection.tsx` | MODIFY — use constants | Low |
| `app/screens/auth/RegisterScreen.tsx` | MODIFY — use constants | Low |

#### Testing
- Manual: Tap privacy/terms links on Register screen and Profile screen
- Verify: Pages load, content is correct, no 404s

---

### P0-7: Coaching Feature — Honest Labeling

**Severity:** 🔴 CRITICAL — Premium-gated feature that doesn't deliver will cause 1-star reviews
**Effort:** 4-6 hours
**Risk:** LOW — UI changes only

#### Root Cause
Coaching screen promises "1:1 Personal Coaching" but redirects to Telegram. Backend has CRUD for coaching requests/sessions but no coach dashboard. Premium users paying for coaching get a Telegram link.

#### Fix Approach: Honest "Founder Coaching" with Calendly Integration

Since the founder is the coach for now, make it a personal, premium experience:
- Replace generic "1:1 Personal Coaching" with "Train with the Founder"
- Replace Telegram redirect with Calendly booking link
- Keep coaching as premium-only
- Backend coaching request flow stays — just update the frontend UX

#### Implementation Steps

**Step 1: Update Coaching Screen**
- File: `app/screens/coaching/CoachingScreen.tsx`
- Replace:
  - "1:1 Personal Coaching" → "Train with the Founder"
  - Telegram link → Calendly booking URL (or WhatsApp business link)
  - Add founder bio section (photo, credentials, approach)
  - Add "What you get" section: weekly check-in, program review, nutrition guidance
  - Add pricing: show this is a premium feature
- Keep existing coaching request form — when user submits, it creates a `CoachingRequest` in DB AND opens Calendly

**Step 2: Update External Links**
- File: `app/utils/externalLinks.ts`
- Add: `openCalendlyLink()` → `Linking.openURL('https://calendly.com/your-link')`
- Keep: `openTelegramLink()` for community (not coaching)

**Step 3: Update Coaching Mode Selector**
- File: `app/components/coaching/CoachingModeSelector.tsx`
- AI coaching mode: Keep as-is (adaptive suggestions from `coaching_service.py`)
- Human coaching mode: Update copy to "Founder Coaching (Premium)"

**Step 4: Ensure Premium Gate Works**
- Verify: `require_premium` dependency is on coaching endpoints
- For launch: coaching is the ONLY premium feature
- Non-premium users see coaching screen with upgrade prompt

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/screens/coaching/CoachingScreen.tsx` | MODIFY — new copy, Calendly link | Low |
| `app/utils/externalLinks.ts` | MODIFY — add Calendly | Low |
| `app/components/coaching/CoachingModeSelector.tsx` | MODIFY — update copy | Low |

#### Testing
- Manual: Navigate to coaching as free user → see upgrade prompt
- Manual: Navigate to coaching as premium user → see founder bio + Calendly link
- Manual: Submit coaching request → verify DB record created
- Regression: AI coaching suggestions still work

---

## Phase 1 — High Priority Fixes

**Timeline:** 1-2 weeks after Phase 0 | **Fix within first 2 weeks of launch**

---

### P1-1: Redis Mandatory + Rate Limiting Migration

**Severity:** 🟠 HIGH — Security hole with multiple workers
**Effort:** 4-6 hours
**Risk:** MEDIUM — touches auth security layer
**Depends on:** P0-3 (multi-worker makes this urgent)

#### Root Cause
10 in-memory rate limit dictionaries in `src/middleware/rate_limiter.py` and 1 in `src/modules/auth/router.py` use process-local state. With multiple Gunicorn workers (P0-3), each worker has its own rate limit counters. An attacker distributes requests across workers to bypass limits entirely.

#### In-Memory Dicts to Migrate
```python
# src/middleware/rate_limiter.py
_login_attempts: dict[str, list[float]]
_forgot_password_attempts: dict[str, list[float]]
_reset_password_attempts: dict[str, list[float]]
_register_attempts: dict[str, list[float]]
_oauth_attempts: dict[str, list[float]]
_user_endpoint_attempts: dict[str, list[float]]
_login_ip_attempts: dict[str, list[float]]
_lockout_violations: dict[str, list[float]]

# src/modules/auth/router.py:52
_verify_attempts: dict[str, list[float]]

# src/middleware/global_rate_limiter.py
_ip_requests: dict[str, list[float]]
```

#### Fix Approach

Migrate all rate limiting to Redis. Make Redis a required dependency in production (no in-memory fallback).

#### Implementation Steps

**Step 1: Make Redis Required in Production**
- File: `src/config/settings.py`
  - Add `REDIS_URL: str` (required, no default)
  - Add production validator: raise error if `REDIS_URL` is empty and `DEBUG=False`
- File: `src/config/redis.py` (create)
  - Singleton Redis connection pool
  - Health check function
  - Graceful degradation logging (warn, don't crash)

**Step 2: Create Unified Redis Rate Limiter**
- File: `src/middleware/rate_limiter.py` (rewrite)
  - Replace all 8 in-memory dicts with Redis-backed sliding window
  - Pattern: `INCR` + `EXPIRE` for simple counting, or sorted set for sliding window
  - Key format: `rl:{endpoint}:{identifier}:{window}` (e.g., `rl:login:user@email.com:900`)
  - Function signature stays the same — `check_rate_limit(key, max_attempts, window_seconds)` — callers don't change

**Step 3: Migrate Auth Rate Limiter**
- File: `src/modules/auth/router.py`
  - Replace `_verify_attempts` dict with Redis call
  - Use same `check_rate_limit()` function from Step 2

**Step 4: Migrate Global Rate Limiter**
- File: `src/middleware/global_rate_limiter.py`
  - Replace `_ip_requests` dict with Redis sorted set
  - Key: `rl:global:{ip}` with score = timestamp
  - `ZRANGEBYSCORE` to count requests in window, `ZADD` to record new request

**Step 5: Add Per-User Rate Limits on Expensive Endpoints**
- Currently unprotected expensive endpoints:
  - `GET /food/search` — FTS queries
  - `GET /training/analytics/*` — CPU-intensive aggregations
  - `GET /reports/*` — complex report generation
  - `POST /adaptive/snapshot` — full adaptive engine computation
- Add `check_user_rate_limit(user_id, endpoint, max_rpm=30)` dependency to these routes

**Step 6: Railway Redis Setup**
- Add Redis plugin in Railway dashboard
- Set `REDIS_URL` environment variable

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/config/settings.py` | MODIFY — add REDIS_URL required | Low |
| `src/config/redis.py` | CREATE — Redis connection pool | Low |
| `src/middleware/rate_limiter.py` | REWRITE — Redis-backed | HIGH |
| `src/modules/auth/router.py` | MODIFY — use Redis rate limiter | Medium |
| `src/middleware/global_rate_limiter.py` | MODIFY — Redis sorted set | Medium |
| Multiple route files | MODIFY — add per-user rate limits | Low |

#### Testing
- New tests: `tests/test_redis_rate_limiter.py` — sliding window, expiry, concurrent access
- New tests: `tests/test_rate_limit_integration.py` — verify limits work across simulated workers
- Regression: All existing auth tests pass
- Manual: Hit login endpoint 6 times rapidly → verify 429 on 6th attempt
- Manual: Verify rate limit persists across Railway deploys

#### Ripple Effects
- Redis is now a hard dependency — Railway must have Redis plugin
- Token blacklist can also move to Redis (future optimization)
- Feature flag cache can use Redis (future optimization)

---

### P1-2: Android Back Button — Workout Data Loss Prevention

**Severity:** 🟠 HIGH — Data loss on Android's most common navigation gesture
**Effort:** 2-3 hours
**Risk:** LOW — isolated to one screen

#### Root Cause
`ActiveWorkoutScreen.tsx` has no hardware back button interception. On Android, pressing the back button during an active workout navigates away without confirmation, losing all workout data.

#### Implementation Steps

**Step 1: Add Back Handler**
- File: `app/screens/training/ActiveWorkoutScreen.tsx`
- Add `useBackHandler` hook (from `@react-navigation/native` or custom):
  ```typescript
  import { usePreventRemove } from '@react-navigation/native';
  
  // Prevent navigation away when workout is active
  usePreventRemove(hasActiveWorkout, ({ data }) => {
    Alert.alert(
      'Workout in Progress',
      'You have an active workout. What would you like to do?',
      [
        { text: 'Continue Workout', style: 'cancel' },
        { text: 'Save & Exit', onPress: () => handleConfirmFinish() },
        { text: 'Discard', style: 'destructive', onPress: () => { clearWorkout(); data.action && navigation.dispatch(data.action); } },
      ]
    );
  });
  ```

**Step 2: Add Gesture Prevention**
- Same file: Disable iOS swipe-to-go-back during active workout:
  ```typescript
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !hasActiveWorkout });
  }, [hasActiveWorkout]);
  ```

**Step 3: Handle App Background/Kill**
- Already handled by `activeWorkoutSlice.ts` AsyncStorage persistence
- Verify: On app reopen after kill, "Resume Workout?" alert appears

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/screens/training/ActiveWorkoutScreen.tsx` | MODIFY — add back handler | Low |

#### Testing
- Manual (Android): Start workout → press hardware back → verify alert appears
- Manual (Android): Start workout → press back → tap "Continue" → verify workout intact
- Manual (Android): Start workout → press back → tap "Discard" → verify navigation works
- Manual (iOS): Start workout → swipe back → verify gesture is blocked
- Regression: Normal navigation (no active workout) still works

---

### P1-3: React Query Migration — Critical Screens

**Severity:** 🟠 HIGH — Silent API failures, no caching, poor UX
**Effort:** 3-5 days
**Risk:** MEDIUM — touches many screens, but incremental migration
**Depends on:** P0-2 (TanStack Query infrastructure)

#### Root Cause
Every screen fetches data with raw `useEffect` + `axios`. No dedup, no stale-while-revalidate, no retry on failure. 6 silent `.catch(() => {})` blocks in ActiveWorkoutScreen alone. Navigating back re-fetches everything.

#### Fix Approach: Incremental Migration

P0-2 installs TanStack Query infrastructure. This phase migrates the highest-impact screens to `useQuery`. Not a full migration — just the screens where caching and error handling matter most.

#### Implementation Steps

**Step 1: Create Custom Hooks for Core Data**
- Files to create:
  - `app/hooks/queries/useTrainingSessions.ts` — `useQuery(['sessions', date], fetchSessions)`
  - `app/hooks/queries/useDashboardData.ts` — `useQueries` for parallel dashboard fetches
  - `app/hooks/queries/useNutritionEntries.ts` — `useQuery(['nutrition', date], fetchEntries)`
  - `app/hooks/queries/useExercises.ts` — `useQuery(['exercises'], fetchExercises, { staleTime: 24h })`
  - `app/hooks/queries/useUserProfile.ts` — `useQuery(['profile'], fetchProfile, { staleTime: 5min })`
  - `app/hooks/queries/useAnalytics.ts` — `useQuery(['analytics', type, range], fetchAnalytics)`
  - `app/hooks/queries/usePreviousPerformance.ts` — `useQuery(['prevPerf', exerciseName])`

**Step 2: Migrate Dashboard**
- File: `app/screens/dashboard/DashboardScreen.tsx`
- Replace: Multiple `useEffect` + `useState` + `api.get()` calls
- With: `useDashboardData()` hook using `useQueries` for parallel fetching
- Add: Pull-to-refresh triggers `queryClient.invalidateQueries(['dashboard'])`
- Add: Error boundary shows retry button instead of blank screen

**Step 3: Migrate Active Workout Data Fetching**
- File: `app/screens/training/ActiveWorkoutScreen.tsx`
- Replace 6 silent `.catch(() => {})` blocks with proper `useQuery` error states
- Specifically:
  - Previous performance data → `usePreviousPerformance(exerciseName)`
  - Overload suggestions → `useQuery(['overload', exerciseId])`
  - Weekly volume → `useQuery(['weeklyVolume'])`
- Show inline error indicators instead of silent failures

**Step 4: Migrate Logs Screen**
- File: `app/screens/logs/LogsScreen.tsx`
- Replace: `useEffect` fetch on mount/focus
- With: `useTrainingSessions(dateRange)` with `staleTime: 5min`
- Add: Infinite scroll with `useInfiniteQuery`

**Step 5: Migrate Analytics**
- File: `app/screens/analytics/AnalyticsHome.tsx`
- Replace: Manual fetch per tab
- With: `useAnalytics(type, range)` — cached per tab, no re-fetch on tab switch

**Step 6: Add Global Error Handler**
- File: `app/services/queryClient.ts`
- Add `onError` default: show toast for network errors, Sentry capture for unexpected errors
- Add `retry: 3` with exponential backoff for network failures

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/hooks/queries/*.ts` (7 files) | CREATE | Low |
| `DashboardScreen.tsx` | MODIFY — useQuery migration | Medium |
| `ActiveWorkoutScreen.tsx` | MODIFY — replace silent catches | HIGH |
| `LogsScreen.tsx` | MODIFY — useQuery migration | Medium |
| `AnalyticsHome.tsx` | MODIFY — useQuery migration | Medium |
| `app/services/queryClient.ts` | MODIFY — add defaults | Low |

#### Testing
- New tests: `__tests__/hooks/queries/*.test.ts` — mock API, verify caching behavior
- Manual: Navigate Dashboard → Logs → back to Dashboard → verify no re-fetch (cached)
- Manual: Turn off network → navigate → verify cached data shown with offline banner
- Manual: Trigger API error → verify error state shown (not blank screen)
- Regression: All existing screen tests pass

---

### P1-4: GIN Indexes on JSONB Columns

**Severity:** 🟠 HIGH — Analytics queries degrade at 5K+ users
**Effort:** 2-3 hours
**Risk:** LOW — additive change, no schema modification

#### Root Cause
Zero GIN indexes across 30 JSONB columns in 20 tables. Queries filtering/aggregating JSONB data (exercise analytics, PR detection, volume tracking) do full-table scans.

#### Fix Approach: Add GIN Indexes via Alembic Migration

Not all 30 JSONB columns need GIN indexes. Only add them where queries actually filter/search within JSONB.

#### Priority GIN Indexes (add now)
| Table | Column | Justification |
|-------|--------|---------------|
| `training_sessions` | `exercises` | PR detection, analytics, volume tracking all query this |
| `food_items` | `micro_nutrients` | Micronutrient dashboard queries |
| `user_profiles` | `preferences` | Feature flag conditions may query preferences |
| `content_articles` | `tags` | Content filtering by tag |

#### Deferred GIN Indexes (add when needed)
| Table | Column | Why Defer |
|-------|--------|----------|
| `workout_templates.exercises` | Low query volume |
| `adaptive_snapshots.input_parameters` | Rarely queried |
| `health_reports.markers` | Premium-only, low volume |
| Other 23 columns | No current JSONB path queries |

#### Implementation Steps

**Step 1: Create Alembic Migration**
- File: `src/database/migrations/versions/xxxx_add_gin_indexes.py`
```python
def upgrade():
    op.create_index('ix_training_sessions_exercises_gin', 'training_sessions', ['exercises'], postgresql_using='gin')
    op.create_index('ix_food_items_micro_nutrients_gin', 'food_items', ['micro_nutrients'], postgresql_using='gin')
    op.create_index('ix_user_profiles_preferences_gin', 'user_profiles', ['preferences'], postgresql_using='gin')
    op.create_index('ix_content_articles_tags_gin', 'content_articles', ['tags'], postgresql_using='gin')

def downgrade():
    op.drop_index('ix_training_sessions_exercises_gin')
    op.drop_index('ix_food_items_micro_nutrients_gin')
    op.drop_index('ix_user_profiles_preferences_gin')
    op.drop_index('ix_content_articles_tags_gin')
```

**Step 2: Add Composite B-tree Indexes**
These are more impactful than GIN for common query patterns:
```python
# Most common query: user's sessions by date
op.create_index('ix_training_sessions_user_date', 'training_sessions', ['user_id', 'session_date'])
# Most common query: user's nutrition by date
op.create_index('ix_nutrition_entries_user_date', 'nutrition_entries', ['user_id', 'entry_date'])
# Token blacklist cleanup
op.create_index('ix_token_blacklist_expires', 'token_blacklist', ['expires_at'])
```

**Step 3: Consolidate Migration Directories**
- Current: Two directories (`alembic/versions/` and `src/database/migrations/versions/`)
- Fix: Move all migrations to `src/database/migrations/versions/` (the one with more files)
- Update `alembic.ini` to point to single directory
- Delete `alembic/versions/` after verifying all migrations are in the canonical directory

**Step 4: Run Migration**
- `alembic upgrade head` on staging first
- Monitor: GIN index creation on large tables can take minutes — use `CREATE INDEX CONCURRENTLY` if table has >100K rows

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/database/migrations/versions/xxxx_add_gin_indexes.py` | CREATE | Low |
| `alembic.ini` | MODIFY — single migration dir | Low |
| `alembic/versions/` | DELETE — consolidate | Medium |

#### Testing
- Verify: `alembic upgrade head` succeeds on fresh DB
- Verify: `alembic downgrade -1` then `alembic upgrade head` (round-trip)
- Manual: Run `EXPLAIN ANALYZE` on training analytics query before/after — verify index usage
- CI: Migration round-trip test already exists — ensure it passes

---

### P1-5: Feature Gating Architecture (Future-Proof Paywall)

**Severity:** 🟠 HIGH — Architectural foundation for future monetization
**Effort:** 3-4 days
**Risk:** MEDIUM — touches middleware and many screens

#### Root Cause
Founder wants to launch 100% free (except coaching) but needs the ability to gate any feature behind premium with a boolean flag in the future.

#### Fix Approach: PostHog Feature Flags + Lightweight Middleware

Migrate from custom `feature_flags` DB table to PostHog Feature Flags. PostHog is already integrated for analytics. This gives: per-user targeting, percentage rollout, A/B experiments, React Native hooks, Python SDK — all for free.

#### Architecture
```
PostHog Dashboard
  ├── premium-coaching (boolean) → ON for premium users
  ├── premium-volume-landmarks (boolean) → OFF (free for now, gate later)
  ├── premium-weekly-reports (boolean) → OFF (free for now, gate later)
  ├── premium-historical-analytics (boolean) → OFF (free for now, gate later)
  ├── premium-health-reports (boolean) → OFF (free for now, gate later)
  ├── premium-dietary-analysis (boolean) → OFF (free for now, gate later)
  ├── feature-social-feed (boolean + rollout %) → gradual launch
  └── feature-apple-watch (boolean) → toggle for Watch features
```

**At launch:** All `premium-*` flags are OFF (features are free). When ready to monetize, flip flags ON in PostHog dashboard — no code deploy needed.

#### Implementation Steps

**Step 1: Backend — PostHog Feature Flag Integration**
- File: `src/config/settings.py` — add `POSTHOG_API_KEY`, `POSTHOG_HOST`
- File to create: `src/services/feature_flags.py`
  ```python
  from posthog import Posthog
  posthog = Posthog(api_key=settings.POSTHOG_API_KEY, host=settings.POSTHOG_HOST)
  
  async def is_feature_enabled(flag_name: str, user_id: str, properties: dict = None) -> bool:
      return posthog.feature_enabled(flag_name, user_id, person_properties=properties or {})
  ```

**Step 2: Backend — Update Freemium Gate**
- File: `src/middleware/freemium_gate.py`
- Replace DB query with PostHog call:
  ```python
  async def require_premium(user: User = Depends(get_current_user)):
      if user.role == UserRole.ADMIN:
          return user
      is_premium = await is_feature_enabled('premium-access', str(user.id), 
                                             {'plan': user.subscription_plan})
      if not is_premium:
          raise PremiumRequiredError()
      return user
  ```
- Add new dependency: `require_feature(flag_name: str)` — generic feature gate
  ```python
  def require_feature(flag_name: str):
      async def dependency(user: User = Depends(get_current_user)):
          if not await is_feature_enabled(flag_name, str(user.id)):
              raise ForbiddenError(f"Feature '{flag_name}' is not available")
          return user
      return dependency
  ```

**Step 3: Frontend — PostHog Feature Flag Hooks**
- PostHog React Native SDK already has `useFeatureFlag` hook
- File to create: `app/hooks/useGatedFeature.ts`
  ```typescript
  import { usePostHog } from 'posthog-react-native';
  
  export function useGatedFeature(flagName: string): { enabled: boolean; loading: boolean } {
    const posthog = usePostHog();
    const enabled = posthog.isFeatureEnabled(flagName) ?? false;
    return { enabled, loading: !posthog.isReady };
  }
  ```
- File to create: `app/components/premium/FeatureGate.tsx`
  ```typescript
  export function FeatureGate({ flag, children, fallback }: Props) {
    const { enabled, loading } = useGatedFeature(flag);
    if (loading) return <Skeleton />;
    if (!enabled) return fallback ?? <UpgradePrompt feature={flag} />;
    return children;
  }
  ```

**Step 4: Wrap Future-Premium Screens**
- Files to modify (add `<FeatureGate>` wrapper, currently passes through):
  - `app/screens/analytics/VolumeLandmarksCard.tsx` — `flag="premium-volume-landmarks"`
  - `app/screens/reports/WeeklyReportScreen.tsx` — `flag="premium-weekly-reports"`
  - `app/screens/analytics/ExerciseHistoryScreen.tsx` — `flag="premium-historical-analytics"`
  - `app/screens/health/HealthReportsScreen.tsx` — `flag="premium-health-reports"`
  - `app/screens/dietary/DietaryAnalysisScreen.tsx` — `flag="premium-dietary-analysis"`
- Since all flags are OFF at launch, `<FeatureGate>` renders children (feature is free)
- When flag is turned ON in PostHog, `<FeatureGate>` shows `<UpgradePrompt>` instead

**Step 5: Deprecate Custom Feature Flags Table**
- File: `src/modules/feature_flags/` — mark as deprecated, keep for backward compatibility
- File: `app/hooks/useFeatureFlag.ts` — redirect to PostHog hook
- Migration: Move existing flag values to PostHog dashboard
- Remove custom flag API endpoint after migration verified

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/services/feature_flags.py` | CREATE | Low |
| `src/middleware/freemium_gate.py` | MODIFY — PostHog backend | Medium |
| `src/config/settings.py` | MODIFY — PostHog env vars | Low |
| `app/hooks/useGatedFeature.ts` | CREATE | Low |
| `app/components/premium/FeatureGate.tsx` | CREATE | Low |
| 5+ screen files | MODIFY — add FeatureGate wrapper | Low |
| `src/modules/feature_flags/` | DEPRECATE | Low |
| `app/hooks/useFeatureFlag.ts` | MODIFY — redirect to PostHog | Low |

#### Testing
- New tests: `tests/test_posthog_feature_flags.py` — mock PostHog, verify gate behavior
- New tests: `__tests__/components/FeatureGate.test.tsx` — enabled/disabled/loading states
- Manual: Set flag ON in PostHog → verify screen shows upgrade prompt
- Manual: Set flag OFF in PostHog → verify screen shows content
- Regression: All existing premium/freemium tests pass

#### Ripple Effects
- PostHog becomes a critical dependency (analytics + feature flags)
- If PostHog is down, feature flags should default to "enabled" (fail open, not closed)
- Add fallback: if PostHog unreachable, check local cache or default to enabled

---

### P1-6: Token Blacklist Cleanup Job

**Severity:** 🟠 HIGH — Unbounded table growth degrades auth performance
**Effort:** 1 hour
**Risk:** LOW — additive job

#### Root Cause
Token blacklist table grows with every logout. No cleanup job deletes expired entries. At 100K users with weekly logouts, table reaches 1M+ rows within months.

#### Implementation Steps

**Step 1: Create Cleanup Job**
- File to create: `src/jobs/cleanup_blacklist.py`
- Logic: `DELETE FROM token_blacklist WHERE expires_at < NOW()`
- Schedule: Daily via Railway cron

**Step 2: Add Index**
- Already covered in P1-4 (composite index on `expires_at`)

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/jobs/cleanup_blacklist.py` | CREATE | Low |

#### Testing
- New test: Insert 100 expired + 10 valid entries → run job → verify only 10 remain

---

### P1-7: N+1 Query Fixes — Critical Paths

**Severity:** 🟠 HIGH — Dashboard and workout save are slow
**Effort:** 3-4 hours
**Risk:** MEDIUM — ORM changes can have subtle effects

#### Root Cause
Only 8 `selectinload`/`joinedload` usages across 55 tables. Most queries that traverse relationships trigger N+1 patterns.

#### Priority Fixes

**Dashboard (5-8 sequential queries):**
- File: `src/modules/dashboard/service.py`
- Fix: Batch queries with `selectinload` for user profile, recent sessions, nutrition summary, achievements
- Use `asyncio.gather()` for independent queries

**Workout Save (PR detection iterates sessions):**
- File: `src/modules/training/pr_detector.py`
- Fix: Single query with `selectinload(TrainingSession.personal_records)` instead of per-session lookup

**Coaching Service (4 separate DB round-trips per request):**
- File: `src/modules/coaching/service.py`
- Fix: `_get_latest_snapshot`, `_get_profile`, `_get_recent_bodyweight`, `_get_goal` → single query with joins

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/modules/dashboard/service.py` | MODIFY — eager loading + gather | Medium |
| `src/modules/training/pr_detector.py` | MODIFY — batch query | Medium |
| `src/modules/coaching/service.py` | MODIFY — join queries | Medium |

#### Testing
- Add SQLAlchemy query logging in test mode — count queries per endpoint
- Verify: Dashboard endpoint makes ≤5 queries (down from 8+)
- Regression: All dashboard/training/coaching tests pass


---

## Phase 2 — Feature Additions

**Timeline:** 2-4 weeks after Phase 1 | **New features for growth**

---

### P2-1: Social Features — Activity Feed, Reactions, Leaderboards, Shared Templates

**Severity:** 🟡 MEDIUM — Growth driver, not a bug fix
**Effort:** 2-3 weeks
**Risk:** MEDIUM — new module, new tables, new API surface

#### Architecture: Fan-Out on Read (Integrated Module)

For <100K users, fan-out on read is correct. No separate microservice — keep social tables in the same PostgreSQL database.

#### New Database Tables

```sql
-- Social graph
CREATE TABLE follows (
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Activity feed events
CREATE TABLE feed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL,  -- 'workout', 'pr', 'streak', 'achievement'
    ref_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_feed_user_time ON feed_events(user_id, created_at DESC);

-- Reactions (one per user per event)
CREATE TABLE reactions (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feed_event_id UUID REFERENCES feed_events(id) ON DELETE CASCADE,
    emoji VARCHAR(10) DEFAULT '💪',
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, feed_event_id)
);

-- Leaderboards (materialized, refreshed by cron)
CREATE TABLE leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL,
    rank INT,
    UNIQUE(board_type, period_start, user_id)
);
CREATE INDEX idx_lb_board_period_rank ON leaderboard_entries(board_type, period_start, rank);

-- Shared templates
CREATE TABLE shared_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID NOT NULL,
    share_code VARCHAR(12) UNIQUE NOT NULL,
    copy_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### New API Endpoints

```
# Social Graph
POST   /api/v1/social/follow/{user_id}
DELETE /api/v1/social/follow/{user_id}
GET    /api/v1/social/followers?cursor=&limit=20
GET    /api/v1/social/following?cursor=&limit=20
GET    /api/v1/social/search?q=username

# Activity Feed
GET    /api/v1/feed?cursor=<timestamp>&limit=20

# Reactions
POST   /api/v1/feed/{event_id}/reactions    body: {emoji: "💪"}
DELETE /api/v1/feed/{event_id}/reactions

# Leaderboards
GET    /api/v1/leaderboard/{board_type}?period=current_week
         board_type: weekly_volume | streak | exercise_1rm

# Shared Templates
POST   /api/v1/templates/{id}/share         → returns {share_code, url}
GET    /api/v1/shared/{share_code}           → returns template preview
POST   /api/v1/shared/{share_code}/copy      → copies to user's templates
```

#### Implementation Steps

**Step 1: Backend — Social Module**
- Files to create:
  - `src/modules/social/__init__.py`
  - `src/modules/social/models.py` — Follow, FeedEvent, Reaction, LeaderboardEntry, SharedTemplate
  - `src/modules/social/service.py` — SocialService class
  - `src/modules/social/router.py` — all endpoints above
  - `src/modules/social/schemas.py` — Pydantic models
- Alembic migration for new tables

**Step 2: Feed Event Generation**
- Modify `src/modules/training/service.py`:
  - After saving a workout session, create a `FeedEvent(event_type='workout', ref_id=session.id, metadata={exercise_count, duration, total_volume})`
- Modify `src/modules/training/pr_detector.py`:
  - After detecting a PR, create a `FeedEvent(event_type='pr', ref_id=pr.id, metadata={exercise, weight, reps})`
- Modify `src/modules/achievements/service.py`:
  - After unlocking achievement, create `FeedEvent(event_type='achievement', ref_id=achievement.id)`

**Step 3: Feed Query (Fan-Out on Read)**
```python
async def get_feed(user_id: UUID, cursor: datetime, limit: int = 20):
    return await db.execute(
        select(FeedEvent)
        .join(Follow, Follow.following_id == FeedEvent.user_id)
        .where(Follow.follower_id == user_id)
        .where(FeedEvent.created_at < cursor)
        .order_by(FeedEvent.created_at.desc())
        .limit(limit)
        .options(selectinload(FeedEvent.reactions))
    )
```

**Step 4: Leaderboard Refresh Job**
- File to create: `src/jobs/refresh_leaderboards.py`
- Schedule: Every 15 minutes via Railway cron
- Boards:
  - `weekly_volume`: SUM(weight × reps) for current week
  - `streak`: Current streak length
  - `exercise_1rm`: Top estimated 1RM per exercise

**Step 5: Frontend — Social Screens**
- Files to create:
  - `app/screens/social/FeedScreen.tsx` — activity feed with pull-to-refresh
  - `app/screens/social/LeaderboardScreen.tsx` — weekly leaderboards
  - `app/screens/social/UserSearchScreen.tsx` — find and follow users
  - `app/components/social/FeedCard.tsx` — workout/PR/achievement card
  - `app/components/social/ReactionButton.tsx` — 💪 kudos button
  - `app/components/social/LeaderboardRow.tsx` — rank + user + score
  - `app/components/social/ShareTemplateButton.tsx` — share link generator
- Modify navigation: Add Social tab or integrate into existing Community screen

**Step 6: Deep Linking for Shared Templates**
- URL format: `repwise://shared/{share_code}`
- Modify `App.tsx` deep link handler to route to shared template preview

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/modules/social/` (5 files) | CREATE | Low |
| `src/modules/training/service.py` | MODIFY — emit feed events | Medium |
| `src/modules/training/pr_detector.py` | MODIFY — emit feed events | Low |
| `src/modules/achievements/service.py` | MODIFY — emit feed events | Low |
| `src/jobs/refresh_leaderboards.py` | CREATE | Low |
| `app/screens/social/` (3 files) | CREATE | Low |
| `app/components/social/` (4 files) | CREATE | Low |
| Navigation config | MODIFY — add social tab/screen | Medium |

#### Testing
- New tests: `tests/test_social/` — follow/unfollow, feed generation, reactions, leaderboard refresh, shared templates
- New tests: `__tests__/screens/social/` — feed rendering, leaderboard display
- Manual: Follow user → they log workout → verify it appears in your feed
- Manual: React to workout → verify reaction count updates
- Manual: Share template → open link → verify template preview

---

### P2-2: Apple Watch Companion App

**Severity:** 🟡 MEDIUM — Competitive differentiator, retention driver
**Effort:** 2-3 weeks
**Risk:** HIGH — native SwiftUI code, requires Expo prebuild, new Xcode target

#### Architecture: Native SwiftUI + react-native-watch-connectivity

The Watch app is pure SwiftUI (required by Apple). Communication with the phone app uses WatchConnectivity framework, bridged to React Native via `react-native-watch-connectivity`.

```
Phone (React Native)                    Watch (SwiftUI)
┌──────────────────┐                   ┌──────────────────┐
│ useWatch() hook  │◄──WCSession──────►│ WatchConnectivity│
│                  │   sendMessage()   │ Manager.swift    │
│ Zustand store ───┼──►updateAppCtx()  │                  │
│ (workout state)  │                   │ ContentView.swift│
│                  │◄──sendMessage()───│ (timer, sets UI) │
└──────────────────┘                   └──────────────────┘
```

#### Watch App Features (MVP)
1. **Rest Timer** — countdown display, haptic on completion
2. **Current Set Logging** — weight (Digital Crown), reps (tap +/-), RPE (optional)
3. **Workout State** — current exercise name, set number, previous performance

#### Communication Patterns
- **Rest timer:** Phone sends `updateApplicationContext({timerEnd: timestamp, duration: 90})`. Watch runs its own countdown — no continuous messaging.
- **Set logging:** Watch sends `sendMessage({action: 'logSet', reps: 8, weight: 135, rpe: 8})` → Phone dispatches to Zustand store.
- **Workout state sync:** `updateApplicationContext({exercise: 'Bench Press', setNumber: 3, previousWeight: 130, previousReps: 10})` — persists across app launches.

#### Implementation Steps

**Step 1: Expo Prebuild + Xcode Setup**
- Run `npx expo prebuild` to generate `ios/` directory
- Open `ios/Repwise.xcworkspace` in Xcode
- Add WatchOS target: File → New → Target → Watch App
- Target name: `Repwise-Watch`
- Minimum WatchOS: 9.0

**Step 2: Install react-native-watch-connectivity**
```bash
npm install react-native-watch-connectivity
cd ios && pod install
```
- Autolinking handles the native module registration

**Step 3: Watch App — SwiftUI Views**
- Files to create in `ios/Repwise-Watch/`:
  - `RepwiseWatchApp.swift` — app entry point
  - `ContentView.swift` — main view (timer or set logging based on state)
  - `RestTimerView.swift` — circular countdown, haptic on complete
  - `SetLoggingView.swift` — weight (Digital Crown), reps (+/- buttons), confirm button
  - `WatchConnectivityManager.swift` — WCSession delegate, message handling

**Step 4: Phone Side — useWatch Hook**
- File to create: `app/hooks/useWatch.ts`
  ```typescript
  import { watchEvents, sendMessage, updateApplicationContext } from 'react-native-watch-connectivity';
  
  export function useWatch() {
    useEffect(() => {
      const sub = watchEvents.on('message', (message) => {
        if (message.action === 'logSet') {
          useActiveWorkoutStore.getState().completeSet(message);
        }
      });
      return () => sub.remove();
    }, []);
    
    const syncWorkoutState = (state) => updateApplicationContext(state);
    const syncRestTimer = (endTime, duration) => updateApplicationContext({ timerEnd: endTime, duration });
    
    return { syncWorkoutState, syncRestTimer };
  }
  ```

**Step 5: Integrate with Active Workout**
- File: `app/screens/training/ActiveWorkoutScreen.tsx`
  - Call `syncWorkoutState()` when exercise changes
  - Call `syncRestTimer()` when rest timer starts
  - Listen for set completions from Watch

**Step 6: EAS Build Configuration**
- File: `eas.json` — add Watch target to build config
- File: `app.json` — add Watch app bundle ID
- Test: Build via `eas build --platform ios --profile development`

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `ios/Repwise-Watch/` (5 Swift files) | CREATE | HIGH (new platform) |
| `app/hooks/useWatch.ts` | CREATE | Medium |
| `ActiveWorkoutScreen.tsx` | MODIFY — Watch sync | Medium |
| `app/components/training/RestTimer*.tsx` | MODIFY — Watch sync | Low |
| `eas.json` | MODIFY — Watch build config | Low |
| `app.json` | MODIFY — Watch bundle ID | Low |

#### Testing
- Manual: Start workout on phone → verify Watch shows exercise name
- Manual: Start rest timer on phone → verify Watch shows countdown + haptic
- Manual: Log set on Watch → verify phone store updates
- Manual: Kill phone app → reopen → verify Watch state persists (applicationContext)
- Edge case: Watch not reachable → verify phone works normally (graceful degradation)
- Edge case: Phone not reachable → verify Watch shows last known state

#### Gotchas
- Must use `npx expo prebuild` — can't use Expo Go for Watch features
- Watch app requires separate App Store review but ships in same bundle
- `sendMessage` only works when both apps are reachable; use `transferUserInfo` for guaranteed delivery
- WatchOS simulator has known connectivity bugs — test on physical devices
- Digital Crown input requires `focusable()` modifier in SwiftUI

---

### P2-3: Onboarding — Skip Food DNA Step

**Severity:** 🟡 MEDIUM — Reduces onboarding from 10 to 9 steps
**Effort:** 30 minutes
**Risk:** LOW — isolated change

#### Root Cause
Founder wants to defer Food DNA step. The step already has an `onSkip` prop wired. All Food DNA fields in `OnboardingCompleteRequest` are `Optional`.

#### Implementation Steps

**Step 1: Skip Step in Wizard**
- File: `app/screens/onboarding/OnboardingWizard.tsx`
- At the top of the file, add comment:
  ```typescript
  // DEFERRED: Food DNA step (step 9) is skipped for v1 launch.
  // To re-enable, remove the skip logic below and uncomment in stepConstants.ts
  ```
- In the step navigation logic, when current step is DIET_STYLE (step 8), jump directly to SUMMARY (step 10), skipping FOOD_DNA (step 9)

**Step 2: Update Step Count**
- File: `app/screens/onboarding/stepConstants.ts`
- Add comment: `// FOOD_DNA step temporarily skipped — see OnboardingWizard.tsx`
- Update `TOTAL_STEPS` display count from 10 to 9 (if used in progress indicator)

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/screens/onboarding/OnboardingWizard.tsx` | MODIFY — skip step 9 | Low |
| `app/screens/onboarding/stepConstants.ts` | MODIFY — comment + count | Low |

#### Testing
- Manual: Complete onboarding → verify step 9 is skipped
- Manual: Verify onboarding completes successfully without Food DNA data
- Regression: Backend `complete_onboarding()` handles null Food DNA fields

---

### P2-4: Onboarding Progress Indicator

**Severity:** 🟡 MEDIUM — Users don't know they're on step 6 of 9
**Effort:** 2-3 hours
**Risk:** LOW — UI addition only

#### Root Cause
`TOTAL_STEPS` constant exists but isn't rendered as a progress bar. Users don't know how far along they are, contributing to 30-40% estimated drop-off.

#### Implementation Steps

**Step 1: Create Progress Component**
- File to create: `app/components/onboarding/OnboardingProgress.tsx`
- Design: Horizontal dots or segmented bar showing current step / total steps
- Use existing design tokens (accent cyan, spacing)

**Step 2: Add to Wizard**
- File: `app/screens/onboarding/OnboardingWizard.tsx`
- Render `<OnboardingProgress current={currentStep} total={TOTAL_STEPS} />` at top of each step

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/components/onboarding/OnboardingProgress.tsx` | CREATE | Low |
| `app/screens/onboarding/OnboardingWizard.tsx` | MODIFY — add progress | Low |

#### Testing
- Manual: Walk through onboarding → verify progress indicator updates each step
- Visual: Verify design matches app theme

---

## Phase 3 — Medium/Low Priority

**Timeline:** 1-3 months post-launch | **Performance, polish, and cleanup**

---

### P3-1: Request Timeout Middleware

**Severity:** 🟡 MEDIUM
**Effort:** 2-3 hours
**Risk:** LOW

#### Root Cause
No server-side request timeout. Client has 15s timeout but server processes indefinitely. Slow analytics or export generation can hold connections forever.

#### Implementation Steps

**Step 1: Add Timeout Middleware**
- File to create: `src/middleware/request_timeout.py`
- Use `asyncio.timeout()` (Python 3.11+) or `async_timeout` library
- Default: 30s for normal endpoints, 120s for export/report endpoints
- On timeout: return 504 Gateway Timeout with request_id

**Step 2: Configure Per-Route Timeouts**
- File: `src/main.py` — add middleware
- Slow endpoints get longer timeouts via route decorator or dependency

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/middleware/request_timeout.py` | CREATE | Low |
| `src/main.py` | MODIFY — add middleware | Low |

#### Testing
- New test: Mock slow endpoint → verify 504 after timeout
- Manual: Trigger slow analytics query → verify timeout response

---

### P3-2: Image Optimization Pipeline

**Severity:** 🟡 MEDIUM
**Effort:** 1-2 days
**Risk:** LOW

#### Root Cause
Progress photos uploaded at full resolution. No client-side compression, no thumbnails, no lazy loading. Will degrade as users accumulate photos.

#### Implementation Steps

**Step 1: Client-Side Compression**
- Install: `expo-image-manipulator`
- File: `app/services/imageUpload.ts` (create)
- Before upload: resize to max 1920px wide, compress to 80% JPEG quality
- Estimated savings: 70-80% file size reduction

**Step 2: Server-Side Thumbnails**
- File: `src/shared/storage.py` — add thumbnail generation
- On upload: generate 200px thumbnail, store alongside original in R2
- Return both URLs in API response

**Step 3: Frontend Image Component**
- Install: `expo-image` (faster than default `<Image>`, built-in caching)
- File to create: `app/components/common/OptimizedImage.tsx`
- Features: blur placeholder, progressive loading, disk cache
- Replace `<Image>` with `<OptimizedImage>` in photo-heavy screens

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/services/imageUpload.ts` | CREATE | Low |
| `src/shared/storage.py` | MODIFY — thumbnail gen | Medium |
| `app/components/common/OptimizedImage.tsx` | CREATE | Low |
| Photo screens (3-4 files) | MODIFY — use OptimizedImage | Low |

#### Testing
- Manual: Upload photo → verify compressed size < 500KB
- Manual: View photo grid → verify thumbnails load fast
- Verify: Original full-res still accessible for detail view

---

### P3-3: Dashboard Virtualization

**Severity:** 🟡 MEDIUM
**Effort:** 1-2 days
**Risk:** MEDIUM — layout changes can cause visual regressions

#### Root Cause
Dashboard renders 12+ cards in a `ScrollView`. As users accumulate data, this causes jank on mid-range devices.

#### Implementation Steps

**Step 1: Replace ScrollView with FlashList**
- Install: `@shopify/flash-list` (faster than FlatList for heterogeneous lists)
- File: `app/screens/dashboard/DashboardScreen.tsx`
- Convert dashboard sections to a flat data array with section types
- Render via `<FlashList>` with `estimatedItemSize` and `getItemType`

**Step 2: Add Skeleton Loading**
- Use existing `Skeleton` component for each card type
- Show skeletons while TanStack Query fetches data

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `app/screens/dashboard/DashboardScreen.tsx` | MODIFY — FlashList migration | Medium |
| Dashboard card components | MODIFY — add skeleton variants | Low |

#### Testing
- Manual: Scroll dashboard rapidly → verify no jank
- Manual: Profile with React Native Perf Monitor → verify <16ms frame time
- Regression: All dashboard functionality intact

---

### P3-4: Dependency Cleanup

**Severity:** 🟢 LOW
**Effort:** 2-3 hours
**Risk:** LOW

#### Items

1. **Remove `victory-native`** — imported but unused (custom SVG charts used instead). Saves ~150KB bundle.
   - File: `package.json` — remove from dependencies
   - Verify: No imports reference `victory-native` in any file

2. **Remove duplicate `@react-navigation/stack`** — `native-stack` (v7) is already used. `stack` (v6) is redundant.
   - File: `package.json` — remove `@react-navigation/stack`
   - Verify: All navigators use `native-stack`

3. **Consider replacing `python-jose` with `PyJWT`** — `python-jose` is in maintenance mode. `PyJWT` is actively maintained and already in dependencies.
   - File: `src/modules/auth/service.py` — swap JWT encode/decode calls
   - Low priority — `python-jose` still works fine

4. **Lazy-load `@zxcvbn-ts/core`** — ~400KB password strength library loaded at app start. Only needed on Register screen.
   - File: `app/screens/auth/RegisterScreen.tsx` — dynamic import

#### Testing
- After each removal: full build + test suite
- Verify: Bundle size decreased (check with `npx expo export --dump-sourcemap`)

---

### P3-5: Export Worker Crash Recovery

**Severity:** 🟢 LOW
**Effort:** 2-3 hours
**Risk:** LOW

#### Root Cause
If export worker crashes mid-export, the export stays in "pending" forever. No retry, no max-attempts, no timeout.

#### Implementation Steps

**Step 1: Add Processing State**
- File: `src/modules/export/service.py`
- Before processing: set status = "processing" with `started_at` timestamp
- On success: set status = "completed"
- On failure: set status = "failed" with error message

**Step 2: Add Timeout + Retry**
- File: `src/jobs/export_worker.py`
- If export has been "processing" for >5 minutes, reset to "pending" (retry)
- Max retries: 3 — after that, set status = "failed"
- Add `retry_count` column to `export_requests` table

**Step 3: User-Visible Error State**
- File: `app/screens/settings/DataExportScreen.tsx`
- Show "Export failed — tap to retry" when status = "failed"

#### Affected Files
| File | Action | Risk |
|------|--------|------|
| `src/modules/export/service.py` | MODIFY — state machine | Medium |
| `src/jobs/export_worker.py` | MODIFY — timeout + retry | Medium |
| `DataExportScreen.tsx` | MODIFY — error state | Low |
| Alembic migration | CREATE — add retry_count column | Low |

#### Testing
- New test: Mock export failure → verify retry → verify max retries → verify failed state
- Manual: Trigger export → kill worker → restart → verify export retries

---

### P3-6: Sentry Enhancements

**Severity:** 🟢 LOW
**Effort:** 1-2 hours
**Risk:** LOW

#### Items

1. **Add custom breadcrumbs for payment webhooks**
   - File: `src/modules/payments/router.py` — `sentry_sdk.add_breadcrumb()` before/after webhook processing

2. **Add custom breadcrumbs for background jobs**
   - Files: `src/jobs/*.py` — breadcrumb at start/end of each job run

3. **Increase trace sample rate for critical paths**
   - File: `src/main.py` — use `traces_sampler` function instead of flat 10%
   - 100% for payment webhooks, 50% for auth endpoints, 10% for everything else

4. **Add Sentry Cron Monitoring**
   - File: `src/jobs/*.py` — use `sentry_sdk.monitor()` to track job health
   - Alert if a job doesn't run on schedule

---

### P3-7: Accessibility Improvements

**Severity:** 🟢 LOW
**Effort:** 3-5 days
**Risk:** LOW

#### Current State
Partial implementation: `accessibilityLabel` in ~25 files, no `accessibilityHint`, no `accessibilityState`, no screen reader announcements, no dynamic font scaling.

#### Implementation Steps

1. **Add `accessibilityHint` to all interactive elements** — buttons, inputs, toggles
2. **Add `accessibilityState`** — selected/disabled/checked states on toggles, checkboxes
3. **Add screen reader announcements** — `AccessibilityInfo.announceForAccessibility()` for:
   - Set completion ("Set 3 of 4 completed")
   - PR celebration ("New personal record!")
   - Rest timer completion ("Rest complete, next set ready")
4. **Dynamic font scaling** — use `allowFontScaling` and test with large text sizes
5. **Color contrast audit** — verify all text meets WCAG AA (4.5:1 ratio)

#### Testing
- Enable VoiceOver (iOS) / TalkBack (Android) → navigate entire app
- Run accessibility audit test (`__tests__/audit/accessibilityAudit.test.ts` already exists)
- Test with Large Text accessibility setting enabled

---

### P3-8: CI/CD Improvements

**Severity:** 🟢 LOW
**Effort:** 1-2 days
**Risk:** LOW

#### Items

1. **Run backend tests against PostgreSQL in CI** (not just SQLite)
   - File: `.github/workflows/ci.yml`
   - Add PostgreSQL service container
   - Run tests with `DATABASE_URL=postgresql://...`
   - This catches JSONB operator differences, partial index behavior, FTS ranking differences

2. **Add Android-specific E2E tests**
   - Back button handling, notification channels, permission flows

3. **Add bundle size tracking**
   - Track JS bundle size in CI, alert if it grows >5% between PRs

4. **Add migration safety check**
   - Verify no destructive migrations (DROP TABLE, DROP COLUMN) without explicit flag

---

### P3-9: Webhook Timestamp Freshness

**Severity:** 🟢 LOW
**Effort:** 1 hour
**Risk:** LOW

#### Root Cause
Stripe webhooks have no timestamp freshness check. A replayed webhook with a valid signature from months ago would be accepted. Idempotency check mitigates duplicate events but not replay attacks with new event IDs.

#### Fix
- File: `src/modules/payments/stripe_provider.py`
- Parse `t=<timestamp>` from Stripe signature header
- Reject webhooks older than 5 minutes
- Log rejected replays to Sentry

---

### P3-10: File Upload Security

**Severity:** 🟢 LOW
**Effort:** 2-3 hours
**Risk:** LOW

#### Root Cause
No magic byte validation on uploaded files. No image dimension limits.

#### Fix
- File: `src/shared/storage.py`
- Add magic byte check: verify file starts with JPEG (FF D8 FF), PNG (89 50 4E 47), or HEIC signatures
- Add dimension limit: max 8000x8000 pixels
- Add file size limit: max 10MB per photo
- Reject non-image files with 400 error

---

## Summary

### Phase Overview

| Phase | Items | Timeline | Effort |
|-------|-------|----------|--------|
| **Phase 0** — Critical Launch Blockers | 7 items (P0-1 through P0-7) | 5-7 days | ~10-12 days total effort |
| **Phase 1** — High Priority Fixes | 7 items (P1-1 through P1-7) | 1-2 weeks | ~8-10 days total effort |
| **Phase 2** — Feature Additions | 4 items (P2-1 through P2-4) | 2-4 weeks | ~15-20 days total effort |
| **Phase 3** — Medium/Low Priority | 10 items (P3-1 through P3-10) | 1-3 months | ~10-15 days total effort |

### Total: 28 items across 4 phases

### Dependency Graph

```
P0-3 (Gunicorn) ───► P1-1 (Redis mandatory)
P0-2 (TanStack Query) ─► P1-3 (React Query migration)
P0-1 (RevenueCat) ───► P1-5 (Feature gating)
P1-4 (GIN indexes) ──► P3-8 (PostgreSQL CI)
P1-3 (React Query) ──► P3-3 (Dashboard virtualization)
P2-1 (Social) ──────► P3-6 (Sentry enhancements)
```

### Files Most Frequently Modified

| File | Phases | Risk |
|------|--------|------|
| `ActiveWorkoutScreen.tsx` | P0-2, P1-2, P1-3, P2-2 | HIGH — test thoroughly |
| `App.tsx` | P0-1, P0-2, P2-1 | MEDIUM |
| `src/modules/payments/service.py` | P0-1, P1-5 | MEDIUM |
| `src/middleware/freemium_gate.py` | P0-1, P1-5 | MEDIUM |
| `DashboardScreen.tsx` | P0-2, P1-3, P3-3 | MEDIUM |
| `src/config/settings.py` | P0-1, P0-4, P1-1, P1-5 | LOW |

### New Dependencies to Install

| Package | Phase | Purpose |
|---------|-------|---------|
| `react-native-purchases` | P0-1 | RevenueCat SDK |
| `@tanstack/react-query` | P0-2 | Server state management |
| `@tanstack/react-query-persist-client` | P0-2 | Mutation persistence |
| `@tanstack/query-sync-storage-persister` | P0-2 | MMKV adapter |
| `react-native-mmkv` | P0-2 | Fast local storage |
| `@react-native-community/netinfo` | P0-2 | Network state |
| `gunicorn` | P0-3 | Process manager |
| `react-native-watch-connectivity` | P2-2 | Watch communication |
| `@shopify/flash-list` | P3-3 | Virtualized list |
| `expo-image` | P3-2 | Optimized images |
| `expo-image-manipulator` | P3-2 | Client-side compression |

### New Backend Modules

| Module | Phase | Tables |
|--------|-------|--------|
| `src/modules/social/` | P2-1 | follows, feed_events, reactions, leaderboard_entries, shared_templates |
| `src/services/feature_flags.py` | P1-5 | (uses PostHog, no new table) |
| `src/config/redis.py` | P1-1 | (connection pool) |
| `src/jobs/permanent_deletion.py` | P0-5 | (uses existing tables) |
| `src/jobs/cleanup_blacklist.py` | P1-6 | (uses existing tables) |
| `src/jobs/refresh_leaderboards.py` | P2-1 | (uses leaderboard_entries) |

---

**END OF DESIGN PLAN**

*This plan covers all 28 items identified in the comprehensive audit. No bugs, edge cases, or improvements have been skipped. Each item includes root cause analysis, exact fix approach, affected files, testing requirements, and risk annotations.*

*Do not implement until this plan has been reviewed and approved.*

---

## Addendum — Review Findings & Corrections

*Added after critical review by independent reviewer. These items were missing or incorrect in the original plan.*

---

### CORRECTION 1: Promote P1-1 (Redis) to Phase 0

**Issue:** P0-3 deploys multi-worker Gunicorn, which immediately breaks in-memory rate limiting. P1-1 (Redis migration) is scheduled 1-2 weeks later. During that gap, rate limiting is effectively disabled — a security regression.

**Fix:** P1-1 (Redis Mandatory + Rate Limiting Migration) should be deployed simultaneously with P0-3 (Multi-Worker). Treat them as a single atomic deployment: **P0-3+P1-1 together**.

---

### CORRECTION 2: Missing Bug — DataExportScreen Double API Prefix

**Severity:** 🟠 HIGH — causes 404 on native file downloads
**Effort:** 15 minutes
**Phase:** Add as P1-8

**Root Cause:** `app/screens/profile/DataExportScreen.tsx` (NOT `app/screens/settings/` as referenced elsewhere) line ~115 builds a download URL as `${API_BASE_URL}/api/v1/export/download/${exportId}` while `API_BASE_URL` likely already includes `/api/v1/`. The `downloadAsync` call uses this doubled URL, causing 404s.

**Fix:**
- File: `app/screens/profile/DataExportScreen.tsx`
- Use relative path with the `api` instance instead of constructing full URL
- Or strip `/api/v1/` from `API_BASE_URL` before concatenation

**Testing:** Manual — trigger export → download → verify file downloads successfully

---

### CORRECTION 3: Missing Bug — Meal Prep Auth (Needs Triage)

**Status:** UNCONFIRMED — may not be a real bug

The audit flagged meal prep screens using `fetch()` without auth headers. However, the explorer found that `MealPlanScreen.tsx`, `PrepSundayFlow.tsx`, and `ShoppingListView.tsx` all import the authenticated `api` instance.

**Action:** Triage before Phase 1. If the screens use `api.post()` (authenticated), this is not a bug. If any screen uses raw `fetch()`, fix it.

**Fix (if needed):** Replace `fetch()` with `api.post()` / `api.get()` in affected screens.

---

### CORRECTION 4: File Path Corrections

| Plan Reference | Correct Path |
|---|---|
| `App.tsx` (root) | `app/App.tsx` |
| `app/screens/settings/DataExportScreen.tsx` | `app/screens/profile/DataExportScreen.tsx` |

These affect P0-1, P0-2, P2-1, and P3-5. Use the correct paths during implementation.

---

### CORRECTION 5: Revised Timeline Estimates (Solo Developer)

The original timeline assumes parallel work. For a solo developer, realistic estimates:

| Phase | Original | Revised (Solo Dev) |
|---|---|---|
| Phase 0 | 5-7 days | **2-3 weeks** |
| Phase 1 | 1-2 weeks | **2-3 weeks** |
| Phase 2 | 2-4 weeks | **4-6 weeks** |
| Phase 3 | 1-3 months | **2-4 months** |

Key adjustments:
- P0-1 (RevenueCat): 3-4 days → **5-7 days** (Apple IAP sandbox testing is slow)
- P1-3 (React Query migration): 3-5 days → **5-8 days** (touching ActiveWorkoutScreen is high-risk)
- P2-1 (Social features): 2-3 weeks → **4-6 weeks** (5 tables, 10+ endpoints, 7+ screens)

---

### CORRECTION 6: ActiveWorkoutScreen Refactor Recommendation

**Issue:** `ActiveWorkoutScreen.tsx` (33KB, ~480 lines) is modified in P0-2, P1-2, P1-3, and P2-2. Four separate phases touching the highest-risk file in the codebase.

**Recommendation:** Before P0-2, add a preparatory task:

**P0-0: Decompose ActiveWorkoutScreen**
- Extract `useWorkoutActions()` hook — finish, discard, save logic
- Extract `useWorkoutData()` hook — previous performance, overload, volume fetching
- Extract `WorkoutHeader` component — timer, exercise count, duration
- Keep `ActiveWorkoutScreen` as a thin orchestrator
- This makes subsequent modifications (P0-2, P1-2, P1-3, P2-2) safer and more isolated

**Effort:** 1-2 days
**Risk:** MEDIUM — must not change behavior, only structure

---

### Updated Item Count: 31 items (28 original + 3 corrections)

---

**END OF ADDENDUM**

---

## Addendum 2 — SDE3 Second-Pass Review (Testing, Edge Cases, Ops, Security)

*Staff-engineer-level review focused on testing gaps, customer edge cases, operational excellence, and security. 47 testing gaps, 8 customer edge cases, 8 operational gaps, 8 security concerns, 12 missing details found.*

---

### TESTING GAPS BY PHASE

#### P0-1 (RevenueCat) — 7 Missing Tests
1. **Cross-platform restore** — user subscribes on iOS, opens Android. Test `Purchases.restorePurchases()` + backend entitlement reconciliation across providers
2. **Sandbox vs production receipts** — Apple sandbox auto-renews every 5 min. Test sandbox detection logic
3. **Dual subscription conflict** — user has active Razorpay AND RevenueCat. Test `get_subscription_status()` priority logic
4. **Webhook retry/failure** — RevenueCat retries for 72h. Test idempotent handling of duplicate deliveries with different `event_id`s for same logical event
5. **Billing failure lifecycle** — `BILLING_ISSUE_DETECTED` → grace period → `EXPIRATION` full sequence test
6. **Subscriber alias** — anonymous ID merges with logged-in ID. Test alias resolution
7. **Full integration test** — SDK purchase → webhook → DB update → entitlement check returns premium (mocked RevenueCat)
8. **Add `REFUND` and `PRODUCT_CHANGE` events** to webhook handler — currently missing from event list

#### P0-2 (Offline Queue) — 7 Missing Tests
1. **Mutation dependency ordering** — user creates custom food offline, then logs nutrition referencing it. If nutrition replays first → 404. Need sequential replay or dependency graph
2. **MMKV storage exhaustion** — test graceful degradation when device storage is full
3. **Bulk replay stress test** — 50+ queued mutations replay on reconnect. Server rate limiting could block user's own sync
4. **Dual-device conflict** — same workout logged on phone and tablet. Test `client_id` collision
5. **Token expiry during replay** — user offline 2+ hours, JWT expires. Test 401 interceptor refreshes token before replaying mutations
6. **`resumePausedMutations()` on app restart** — test this fires correctly from PersistQueryClientProvider `onSuccess`
7. **Crash recovery overlap** — MMKV persister AND AsyncStorage backup both have workout data. Which wins? Test priority

#### P0-3 (Multi-Worker) — 2 Missing Tests
1. **Graceful shutdown** — in-flight workout saves complete during deploy (30s graceful timeout)
2. **Health check under load** — automated load test, not just manual

#### P0-5 (GDPR) — 2 Missing Tests
1. **Partial deletion failure** — R2 photo deletion fails mid-batch. Does DB deletion roll back? Test atomicity across Postgres + R2
2. **Deletion of user with social followers** — CASCADE on `follows` table. Add test when P2-1 ships

#### P1-1 (Redis) — 4 Missing Tests + 1 Contradiction
1. **Redis unreachable at startup** — test app behavior when Redis is down on boot
2. **Connection pool exhaustion** — 4 workers × concurrent requests. No circuit breaker test
3. **Sliding window race condition** — `ZADD`/`ZRANGEBYSCORE` without `MULTI`/`EXEC` has race conditions. Concurrency test needed
4. **⚠️ CONTRADICTION:** Plan says "required, no in-memory fallback" AND "warn, don't crash" (graceful degradation). Pick one:
   - **Recommended:** Required for startup. If Redis drops mid-operation, log error + allow request through (fail open for availability). Alert immediately via Sentry.

#### P1-3 (React Query) — 3 Missing Tests
1. **Cache invalidation correctness** — after saving workout, does `invalidateQueries(['sessions'])` refresh Logs screen?
2. **Stale data indicator** — `staleTime: 5min` means user sees old data. Test stale indicator or refresh behavior
3. **Lint rule for silent catches** — add CI grep check ensuring no `.catch(() => {})` or `catch {}` blocks remain

#### P1-5 (Feature Flags) — 4 Missing Tests + 1 Contradiction
1. **PostHog SDK init failure** — if PostHog unreachable on app start, does app hang? Crash? Test timeout
2. **Flag evaluation latency** — first load requires network. Test loading state during flag fetch
3. **Mid-session flag change** — user is active, flag flips in PostHog. When does app pick it up?
4. **⚠️ CONTRADICTION:** Plan says "fail open" but `require_feature()` raises `ForbiddenError`. If PostHog is down:
   - **Recommended:** Backend fails OPEN (allow access). Frontend fails OPEN (show feature). Log to Sentry. This prevents paying users from being locked out during PostHog outages.

#### P2-1 (Social) — 7 Missing Tests
1. **Feed pagination with concurrent writes** — cursor-based `created_at < cursor` can miss events with identical timestamps. Use `(created_at, id)` composite cursor
2. **Deleted workout in feed** — user deletes workout, feed event's `ref_id` is orphaned. Test graceful handling
3. **Self-follow prevention** — add CHECK constraint `follower_id != following_id`
4. **Leaderboard calculation correctness** — verify cron job scores match actual workout data
5. **Shared template with deleted exercises** — template references deleted exercises. Test broken template handling
6. **Rate limiting on social writes** — follow/unfollow spam, reaction spam
7. **Privacy test** — can user A see user B's feed events without following? (Currently: yes, because no privacy model exists)

#### P2-2 (Apple Watch) — 5 Missing Tests
1. **Bluetooth loss mid-set** — `sendMessage` fails silently. Test retry or `transferUserInfo` fallback
2. **Watch app crash recovery** — does `applicationContext` restore state on reopen?
3. **Phone killed while Watch logging** — Watch sends `logSet`, phone is dead. Need `transferUserInfo` for guaranteed delivery
4. **Manual test matrix** — specify device combinations (Watch Series 7+, iPhone 12+, WatchOS 9+)
5. **Battery drain budget** — define acceptable Watch battery impact (e.g., <5% per 1-hour workout)

---

### CUSTOMER EDGE CASES NOT COVERED

#### 1. Zero-Data First Launch (CRITICAL UX)
Every screen needs an empty state design:
- **Dashboard:** "Welcome! Start your first workout" with CTA
- **Logs:** "No workouts yet" with template suggestions
- **Analytics:** "Log 3+ workouts to see trends" with progress indicator
- **Nutrition:** "Track your first meal" with quick-add CTA
- **Feed:** "Follow friends to see their workouts" with user search CTA
- **Leaderboard:** "Not enough data yet — log workouts to compete"

**Action:** Add P0-8: Empty State Designs for all screens. Effort: 1 day.

#### 2. Timezone Travel
User in IST logs Monday workout, flies to PST. `session_date` stored as date (no timezone). Weekly report groups by "this week" using server time or client time?

**Action:** Add `session_timezone` field to `TrainingSession` and `NutritionEntry`. Store user's timezone at time of logging. Weekly grouping uses the entry's timezone, not current timezone. Effort: 3 hours.

#### 3. Mid-Update Data Migration
User starts workout on old version (AsyncStorage crash recovery). App auto-updates to new version (TanStack Query + MMKV). Old AsyncStorage workout data must survive.

**Action:** Add migration logic in P0-2: on first boot after update, check AsyncStorage for active workout, migrate to MMKV if found, then clear AsyncStorage. Test this explicitly.

#### 4. Subscription Lifecycle Gaps
Not covered in P0-1:
- Subscribe → cancel → resubscribe within grace period
- Card declines → grace period → user updates card → auto-retry
- Apple refund → RevenueCat `REFUND` event (not in webhook handler!)
- User disputes charge → chargeback

**Action:** Add `REFUND`, `PRODUCT_CHANGE`, `BILLING_ISSUE_DETECTED` handling to RevenueCat webhook. Add test for each lifecycle path.

#### 5. Offline Mid-Workout Exercise Data
User starts workout online (fetches previous performance for Bench Press), gym loses signal, switches to Squats. `usePreviousPerformance('Squat')` query fails — no cached data.

**Action:** In P0-2, when workout starts, prefetch previous performance for ALL exercises in the template/session and cache in TanStack Query. Offline fallback shows cached data.

#### 6. Large Data Performance
User with 500+ workouts. Analytics endpoints aggregate all sessions. No pagination on analytics.

**Action:** Add date-range limits to analytics queries (default: last 90 days). Add pagination to nutrition entries list. Add performance test with 1000 sessions.

#### 7. Accessibility During Workout
- Rest timer: visual-only circular countdown. Blind user can't know remaining time
- Set logging: small +/- buttons for reps. Motor-impaired user struggles

**Action:** Add to P3-7: screen reader announcement every 10s during rest timer ("20 seconds remaining"). Add voice input option for reps. Add larger touch targets (48x48dp minimum).

#### 8. Onboarding Progress Persistence
User completes 6/9 steps, kills app. On reopen, onboarding restarts from step 1.

**Action:** Add to P2-3: persist `currentStep` to AsyncStorage/MMKV. On app reopen, resume from last completed step. Effort: 1 hour.

---

### OPERATIONAL GAPS

#### 1. RevenueCat Rollback Plan (CRITICAL)
If RevenueCat breaks post-deploy, iOS subscribers are stuck. Need:
- Keep Stripe webhook endpoint active (don't delete, just deprioritize)
- Feature flag `use-revenuecat` to route purchases back to web checkout
- Manual subscription extension procedure for affected users
- Runbook: "RevenueCat is down" → check status page → if >30min, flip flag → notify affected users

#### 2. Monitoring & Alerting (ZERO defined)
Add Sentry alerts for:
- Webhook failure rate > 5% in 5 minutes
- Offline mutation queue depth > 20 (indicates sync issues)
- Redis connection errors > 0 in 1 minute
- Feed query p99 > 500ms
- Leaderboard job duration > 5 minutes
- Export job failures > 0
- GDPR deletion job failures > 0
- Token blacklist table > 500K rows

#### 3. Social Gradual Rollout
- Week 1: 5% of users (feature flag `feature-social-feed` at 5%)
- Week 2: 25% if no issues
- Week 3: 50%
- Week 4: 100%
- Monitor: feed query latency, reaction write latency, follow/unfollow rate

#### 4. Runbooks Needed
Create `docs/runbooks/` with:
- `redis-down.md` — symptoms, impact, mitigation, recovery
- `revenuecat-webhook-backlog.md` — check RC dashboard, manual sync, alert thresholds
- `mmkv-corruption.md` — symptoms (app crash on boot), fix (clear MMKV, re-fetch from server)
- `leaderboard-job-stuck.md` — check Railway logs, manual re-run, distributed lock cleanup
- `export-worker-crash.md` — reset stuck exports, manual re-trigger

#### 5. Database Backup Before Migration
Before running P1-4 (GIN indexes) and P2-1 (social tables) migrations:
- Take manual PostgreSQL backup via Railway
- Test backup restoration on a separate instance
- Run migration on staging first, verify, then production

#### 6. Idempotency Gap — UI-Level Dedup
Offline queue uses `client_id` for server-side dedup. But if user taps "Save Workout" twice while offline, two mutations with DIFFERENT `client_id`s are queued → duplicate workout.

**Fix:** Disable save button after first tap. Show "Saving..." / "Queued for sync" state. Generate `client_id` once when workout starts (not on save), reuse for all save attempts of that workout.

#### 7. Canary Deployment
Railway doesn't support canary natively. Workaround:
- Deploy to staging environment first
- Run automated smoke tests (health check, auth flow, workout save, nutrition log)
- If green, promote to production
- Add to CI/CD pipeline (P3-8)

#### 8. Leaderboard Distributed Lock
If Railway cron fires twice (clock skew, retry), two instances corrupt leaderboard.

**Fix:** Add Redis advisory lock at start of `refresh_leaderboards.py`:
```python
lock = redis.set(f"lock:leaderboard:{board_type}", "1", nx=True, ex=300)
if not lock:
    logger.info("Leaderboard refresh already running, skipping")
    return
```

---

### SECURITY CONCERNS

#### 1. Social Privacy Model (CRITICAL — Must Define Before P2-1)
Current plan: anyone can follow anyone, all feed events are visible to followers. No privacy controls.

**Required additions:**
- Add `is_public` boolean to `user_profiles` (default: `true`)
- Public profiles: anyone can follow, feed visible to followers
- Private profiles: follow requires approval (`follow_requests` table), feed visible only to approved followers
- Add `follow_requests` table: `requester_id, target_id, status (pending/approved/rejected), created_at`
- Add block functionality: `blocked_users` table, blocked users can't follow or see feed
- Add report functionality: `reports` table for abuse reporting

#### 2. Share Code Generation
Must use CSPRNG: `secrets.token_urlsafe(9)` (12 chars, 72 bits of entropy). NOT sequential, NOT predictable.

#### 3. Leaderboard Score Validation
Add exercise weight/reps bounds validation:
- Weight: 0-2000 lbs (907 kg) — covers all realistic lifts
- Reps: 0-500 — covers all realistic rep ranges
- Reject outliers in leaderboard calculation (>3 standard deviations from user's mean)

#### 4. Server-Side Premium Enforcement (MANDATORY)
**ALL premium checks MUST be server-side via `require_premium()` or `require_feature()`.** Client-side PostHog flag evaluation is cosmetic only (hides UI). A user can bypass client-side flags by patching the PostHog SDK response. Never trust the client for authorization.

#### 5. Rate Limiting on Social Endpoints
- Follow/unfollow: 30 per hour per user
- Reactions: 60 per hour per user
- Template sharing: 10 per hour per user
- Feed fetch: 120 per minute per user (prevent scraping)

#### 6. Feed Event Cleanup on Entity Deletion
When a workout/PR/achievement is deleted, either:
- Soft-delete the feed event (set `deleted_at`)
- Or nullify `ref_id` and show "This workout was deleted" in feed

Do NOT leave orphaned `ref_id`s — they'll cause 404s when feed cards try to fetch details.

#### 7. Shared Template Endpoint Auth
`GET /api/v1/shared/{share_code}` should be PUBLIC (no auth) — allows sharing links to non-users. But `POST /api/v1/shared/{share_code}/copy` MUST require auth.

#### 8. Watch Communication Trust Boundary
WatchConnectivity is trusted (same app group, same developer signing). No additional auth needed. But document this assumption: "Watch↔Phone communication is trusted because both apps share the same App Group and developer certificate. No additional authentication is applied to WCSession messages."

---

### MISSING DETAILS

#### 1. Database Transaction Boundaries
These multi-table writes MUST be atomic (single transaction):
- Workout save + feed event creation + PR detection + achievement check
- Follow + feed event ("X started following you")
- Account deletion + R2 cleanup + subscription cancellation

**Action:** Ensure all service methods use `async with db.begin():` for multi-table writes.

#### 2. User-Facing Error Messages
Define error copy for every error type:
- `PremiumRequiredError` → "Upgrade to Premium to access this feature"
- `RateLimitedError` → "Too many attempts. Please try again in X minutes"
- `ForbiddenError` (feature flag) → "This feature is coming soon!"
- Network error → "No internet connection. Your changes will sync when you're back online"
- Webhook failure → (silent — user never sees this)

#### 3. Loading & Empty States for New Screens
Every new screen in P2-1 needs:
- Loading state: Skeleton component (existing `Skeleton.tsx`)
- Empty state: Illustration + message + CTA
- Error state: ErrorBanner (existing) + retry button

#### 4. Feed Pagination Fix
Use composite cursor `(created_at, id)` instead of just `created_at` to handle events with identical timestamps:
```sql
WHERE (fe.created_at, fe.id) < (:cursor_time, :cursor_id)
ORDER BY fe.created_at DESC, fe.id DESC
```

#### 5. Feed Event TTL / Archival
Feed events table will grow unbounded. Add:
- TTL: Archive events older than 90 days to `feed_events_archive` table
- Or: Add `created_at` index + periodic cleanup job

#### 6. Missing Indexes on New Tables
Add to P2-1 migration:
```sql
CREATE INDEX idx_shared_templates_owner ON shared_templates(owner_id);
CREATE INDEX idx_shared_templates_template ON shared_templates(template_id);
```

#### 7. API Versioning Confirmation
All new endpoints MUST follow `/api/v1/` convention:
- ✅ `/api/v1/social/follow/{user_id}`
- ✅ `/api/v1/feed`
- ✅ `/api/v1/leaderboard/{board_type}`
- ⚠️ `/api/v1/shared/{share_code}` — confirm this is under `/api/v1/`
- ⚠️ `/api/v1/templates/{id}/share` — confirm this doesn't conflict with existing template routes

---

### UPDATED ITEM COUNT

| Category | Count |
|----------|-------|
| Original plan items | 28 |
| Addendum 1 corrections | 3 |
| Addendum 2 additions | 20 |
| **Total actionable items** | **51** |

### TOP 4 RISKS TO ADDRESS BEFORE IMPLEMENTATION

1. **Define social privacy model** — without this, P2-1 is a privacy incident waiting to happen
2. **Offline queue mutation ordering** — nutrition entries referencing offline-created foods will 404
3. **Add monitoring/alerting** — zero alerts means zero visibility into production issues
4. **RevenueCat rollback plan** — no fallback if IAP integration breaks

---

**END OF ADDENDUM 2**
