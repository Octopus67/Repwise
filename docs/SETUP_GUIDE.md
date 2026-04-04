# Repwise: Third-Party Service Setup Guide

Total estimated time: ~3 hours (excluding Apple approval wait)

---

## 1. Apple Developer Program (~30 min setup + 24-48h approval)

**Cost:** $99/year | **URL:** https://developer.apple.com/programs/enroll/

### Enrollment (Individual)
1. Go to https://developer.apple.com/enroll/
2. Sign in with your Apple Account (must have 2FA enabled)
3. Select **"Individual / Sole Proprietor"** — your legal name becomes the App Store seller name
4. Provide legal name, email, phone, and physical address (no P.O. boxes)
5. Agree to the Apple Developer Program License Agreement
6. Pay $99 USD (prices vary by region)
7. **Approval time:** Individual accounts are typically approved within 24-48 hours. Occasionally instant.

### Create an App ID
1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click **"+"** → select **"App IDs"** → **"App"**
3. Enter description: `Repwise` and Bundle ID: `com.yourname.repwise` (Explicit)
4. Under Capabilities, check **"Sign in with Apple"**
5. Click **Continue** → **Register**

### Create a Services ID (for backend Apple OAuth)
1. Same Identifiers page → click **"+"** → select **"Services IDs"**
2. Description: `Repwise Web Auth`, Identifier: `com.yourname.repwise.auth`
3. Enable **"Sign in with Apple"** → click **Configure**
4. Set Primary App ID to your App ID from above
5. Add your backend domain (e.g., `api.repwise.app`) and return URL
6. Click **Save** → **Continue** → **Register**

### Find Your Team ID
1. Go to https://developer.apple.com/account → **Membership Details**
2. Your **Team ID** is a 10-character alphanumeric string (e.g., `A1B2C3D4E5`)

### Configure in Expo
In `app.json` / `app.config.ts`:
- Set `ios.bundleIdentifier` to match your App ID
- Add `"apple"` to `ios.usesAppleSignIn`
- Set `expo.extra.appleTeamId` to your Team ID

### Gotchas
- Use your **legal name** (not a nickname) or enrollment gets delayed
- Organization enrollment requires a D-U-N-S number — avoid this as a solo dev
- The Services ID is separate from the App ID — you need both for backend OAuth

---

## 2. RevenueCat Setup (~45 min)

**Cost:** Free up to $2,500/mo MTR, then 1% of MTR | **URL:** https://app.revenuecat.com/signup

### Create Account & Project
1. Sign up at https://app.revenuecat.com/signup
2. Create a new **Project** (e.g., "Repwise")
3. Add two apps within the project: one for **Apple App Store**, one for **Google Play Store**

### Connect Apple App Store
1. In App Store Connect (https://appstoreconnect.apple.com), go to **Users and Access** → **Integrations** → **App Store Connect API**
2. Click **"+"** to generate a new API key with **Admin** role
3. Download the `.p8` file — you can only download it once!
4. Note the **Issuer ID** and **Key ID**
5. In RevenueCat dashboard → your iOS app → **App Store Connect API** tab
6. Upload the `.p8` file, enter Issuer ID and Key ID

### Connect Google Play Console
1. In Google Cloud Console (https://console.cloud.google.com), create a Service Account
2. Grant it the **"Pub/Sub Editor"** role
3. Generate a JSON key and download it
4. In Google Play Console (https://play.google.com/console) → **Setup** → **API access**
5. Link the service account and grant **"Financial data"** + **"Manage orders"** permissions
6. In RevenueCat dashboard → your Android app → upload the service account JSON

### Create Products & Offerings
1. In RevenueCat → **Product Catalog** → **Products**
2. Create products matching your store products:
   - `repwise_monthly` — $9.99/month
   - `repwise_yearly` — $79.99/year
3. Go to **Entitlements** → create `premium` entitlement → attach both products
4. Go to **Offerings** → edit the **Default** offering:
   - Add a **Monthly** package → attach `repwise_monthly`
   - Add an **Annual** package → attach `repwise_yearly`

### Get API Keys
1. Go to **Project Settings** → **API Keys**
2. You'll see separate **public** API keys for iOS and Android — use these in your app
3. The **REST API** secret key is for server-side verification (keep this in your backend `.env`)

### Configure Webhook
1. Go to **Project Settings** → **Integrations** → **Webhooks**
2. Add webhook URL: `https://api.repwise.app/webhooks/revenuecat`
3. Set authorization header if needed
4. Select events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`

### Sandbox Testing
1. RevenueCat now includes a **Test Store** — works immediately without real store setup
2. For real store testing: use Apple Sandbox accounts (Settings → App Store → Sandbox Account in iOS)
3. For Google: use license test accounts in Play Console → **Setup** → **License testing**

### Gotchas
- Product IDs in RevenueCat must **exactly match** the IDs in App Store Connect / Google Play Console
- The `.p8` key can only be downloaded once — save it securely
- Google service account permissions can take up to 24 hours to propagate

---

## 3. Railway Redis Setup (~10 min)

**Cost:** Usage-based (~$5-10/mo for light use) | **URL:** https://railway.com

### Add Redis to Your Project
1. Open your Railway project at https://railway.com/dashboard
2. Click **"+ New"** on the project canvas (or press `Cmd/Ctrl + K`)
3. Select **"Database"** → **"Redis"**
4. Railway deploys a Redis instance from the official Docker image automatically

### Get the REDIS_URL
1. Click on the new Redis service in your project canvas
2. Go to the **Variables** tab
3. Copy `REDIS_URL` — format: `redis://default:PASSWORD@HOST:PORT`
4. In your FastAPI service, reference it: click **Variables** → **"Add Reference"** → select `REDIS_URL` from the Redis service

### Cost Breakdown
- **No free tier** — Railway removed it in 2024
- CPU: $20/vCPU/mo (billed by actual usage, not reserved)
- Memory: $10/GB/mo (billed by actual usage)
- Storage: $0.25/GB/mo
- A light Redis instance (~256MB RAM) costs roughly **$2-5/month**
- Railway Hobby plan: $5/mo subscription + usage

### Gotchas
- Use `REDIS_URL` via Railway's internal private networking (`redis.railway.internal`) for service-to-service — no egress charges
- External connections use TCP Proxy and incur egress costs ($0.05/GB)
- Redis data is ephemeral by default — add a volume for persistence if needed

---

## 4. Railway Cron Jobs (~15 min)

**Cost:** Included in Railway usage (you pay for compute time only) | **Docs:** https://docs.railway.com/guides/cron-jobs

### Setup Strategy
Create **separate Railway services** for each cron job (recommended) or one service with different start commands.

### Option A: Separate Services (Recommended)
For each job, create a new service from the same GitHub repo:

**Job 1: Permanent Deletion (daily at 3 AM UTC)**
1. Click **"+ New"** → **"GitHub Repo"** → select your backend repo
2. Go to **Settings** → set Start Command: `python -m src.jobs.permanent_deletion`
3. In **Settings** → **Cron Schedule**: `0 3 * * *`
4. Add all required env vars (DATABASE_URL, etc.) via variable references

**Job 2: Cleanup Blacklist (daily at 4 AM UTC)**
1. Same process — new service from same repo
2. Start Command: `python -m src.jobs.cleanup_blacklist`
3. Cron Schedule: `0 4 * * *`

**Job 3: Refresh Leaderboards (every 15 min)**
1. Same process — new service from same repo
2. Start Command: `python -m src.jobs.refresh_leaderboards`
3. Cron Schedule: `*/15 * * * *`

### Critical Requirements
- Each cron job **must exit** after completing its task (close DB connections, etc.)
- If a previous execution is still running when the next is due, Railway **skips** the new one
- Minimum interval is **5 minutes** — your 15-min leaderboard job is fine
- All schedules are in **UTC**

### Monitoring
- View logs for each cron service in the Railway dashboard → **Logs** tab
- Each execution shows as a separate deployment with status (Success/Failed)
- Set up Railway webhooks (Settings → Webhooks) to get notified on failures

### Gotchas
- Jobs that don't exit will block all future executions — always `sys.exit(0)` on completion
- You pay only for the seconds each job runs — a 5-second daily job costs fractions of a cent
- Don't use in-code schedulers (like APScheduler) — let Railway handle scheduling

---

## 5. PostHog Feature Flags (~20 min)

**Cost:** 1M feature flag requests/mo free, then $0.0001/request | **URL:** https://app.posthog.com

### Get Your Project API Key
1. Log in at https://app.posthog.com (you already have an account for analytics)
2. Go to **Settings** (gear icon) → **Project** → **Project API Key**
3. This is the same key you use for analytics — it works for feature flags too

### Create Feature Flags
Go to https://app.posthog.com/feature_flags → click **"New feature flag"** for each:

**Flag 1: `premium-coaching`**
1. Key: `premium-coaching`
2. Type: **Release toggle** (boolean)
3. Release conditions: Add condition → Property filter: `subscription_tier` equals `premium`
4. Rollout: 100% of matching users
5. Click **Save**

**Flag 2: `premium-volume-landmarks`**
1. Key: `premium-volume-landmarks`
2. Type: Release toggle (boolean)
3. Toggle **Disable** at the top (OFF for now)
4. Click **Save**

**Flag 3: `premium-weekly-reports`**
1. Key: `premium-weekly-reports`
2. Type: Release toggle (boolean)
3. Toggle **Disable** (OFF for now)
4. Click **Save**

**Flag 4: `feature-social-feed`**
1. Key: `feature-social-feed`
2. Type: Release toggle (boolean)
3. Release conditions: Set rollout to **5%** of all users
4. Click **Save**

**Flag 5: `feature-apple-watch`**
1. Key: `feature-apple-watch`
2. Type: Release toggle (boolean)
3. Toggle **Disable** (OFF for now)
4. Click **Save**

### Testing Flags Locally
1. In PostHog dashboard, edit any flag → add a release condition:
   - Property: `email` equals `your-email@example.com`
   - Rollout: 100%
2. This overrides the flag for your account only
3. In your React Native app, use `posthog.isFeatureEnabled('flag-key')` to check
4. Use `posthog.reloadFeatureFlags()` to force-refresh after changes

### Gotchas
- Feature flag requests are separate from analytics events in billing
- Free tier is generous: 1M requests/month covers most early-stage apps
- Flags are evaluated based on `distinct_id` — make sure you call `posthog.identify()` with the user ID so property-based targeting (like `subscription_tier`) works
- Flag changes take effect immediately — no deploy needed

## Cost Summary (Monthly)

| Service | Monthly Cost |
|---------|-------------|
| Apple Developer Program | ~$8.25/mo ($99/yr) |
| RevenueCat | Free (until $2.5K MTR) |
| Railway Redis | ~$3-5/mo |
| Railway Cron Jobs | ~$1-2/mo (seconds of compute) |
| PostHog Feature Flags | Free (1M requests/mo) |
| **Total additional** | **~$12-15/mo** |
