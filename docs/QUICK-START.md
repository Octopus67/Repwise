# Quick Start Guide — Launch Without a Domain

Get your app live on both app stores in under 3 hours. No custom domain required.

## Prerequisites (30 min setup)

1. **Railway** (railway.app) — Backend hosting, $5/mo
2. **Neon** (neon.tech) — PostgreSQL database, free tier
3. **Stripe** (stripe.com) — Payments for USD/global users
4. **Razorpay** (razorpay.com) — Payments for Indian users (optional for v1)
5. **Apple Developer** ($99/yr) — Start this first, takes 24-48h to verify
6. **Google Play Developer** ($25 one-time) — Instant approval

## Step 1: Set Up Railway + Neon (15 min)

### 1.1 Create Neon Database

1. Go to neon.tech → Sign up with GitHub
2. Create project: name it `hypertrophy-os`, region `AWS US East 1`, Postgres 17
3. Copy the connection string (looks like `postgresql://neondb_owner:password@ep-...`)
4. Convert it:
   - Change `postgresql://` to `postgresql+asyncpg://`
   - Change `?sslmode=require&channel_binding=require` to `?ssl=require`
5. Save this — you'll paste it into Railway

### 1.2 Create Railway Project

1. Go to railway.app → Sign up with GitHub
2. "New Project" → "Deploy from GitHub repo" → Select your HypertrophyOS repo
3. Railway auto-detects the Dockerfile and deploys
4. Go to your service → "Variables" → "Raw Editor"
5. Paste this (replace the two values):

```
DATABASE_URL=postgresql+asyncpg://YOUR_NEON_CONNECTION_STRING_HERE
JWT_SECRET=PASTE_64_CHAR_HEX_HERE
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
DEBUG=false
USDA_API_KEY=DEMO_KEY
STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=whsec_test_secret
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=rzp_test_secret
SENTRY_DSN=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_ENDPOINT_URL=
R2_BUCKET_NAME=hypertrophy-os-uploads
FCM_SERVER_KEY=
CORS_ORIGINS=["*"]
```

6. Generate JWT_SECRET by running in your terminal: `openssl rand -hex 32`
7. Hit "Update Variables" — Railway redeploys automatically

### 1.3 Get Your Railway URL

1. In Railway → Your service → "Settings" → "Networking"
2. Click "Generate Domain" — Railway gives you a URL like `hypertrophy-os-production.up.railway.app`
3. Copy this URL

### 1.4 Run Database Migrations

In your terminal:

```bash
export DATABASE_URL="postgresql+asyncpg://YOUR_NEON_CONNECTION_STRING"
alembic upgrade head
```

This creates all tables including the new notifications tables.

### 1.5 Update Your App Config

Open `app/eas.json` and replace `YOUR_RAILWAY_PROJECT` with your actual Railway URL:

```json
"EXPO_PUBLIC_API_URL": "https://hypertrophy-os-production.up.railway.app"
```

## Step 2: Verify Backend is Live (2 min)

```bash
curl https://YOUR_RAILWAY_URL.up.railway.app/api/v1/health
```

Should return: `{"status":"ok"}`

If you get an error, check Railway logs (Dashboard → Deployments → View Logs).

## Step 3: Build Mobile App (30 min)

### 3.1 Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 3.2 Build for Both Platforms

```bash
cd app
eas build --profile production --platform all --non-interactive
```

This takes 20-30 minutes. EAS handles all the code signing for you.

### 3.3 Download Builds

When done, EAS gives you download links for:
- iOS: `.ipa` file
- Android: `.aab` file

## Step 4: Submit to App Stores (1-2 hours)

### 4.1 Apple App Store

Follow `docs/app-store-submission.md` Section 1 (Apple). Key steps:

1. Create App Store Connect listing
2. Upload 5 screenshots per device size (use Simulator or real device)
3. Create IAP subscription products ($9.99/mo, $79.99/yr)
4. Create demo account: `reviewer@hypertrophyos.com` with premium access
5. Upload `.ipa` via Transporter or `eas submit --platform ios`
6. Submit for review

### 4.2 Google Play Store

Follow `docs/app-store-submission.md` Section 2 (Google Play). Key steps:

1. Create store listing
2. Upload 8 screenshots + feature graphic
3. Complete data safety section
4. Create IAP products (₹499/mo, ₹3,999/yr)
5. Upload `.aab` to internal testing track
6. Promote to production after testing

## Step 5: Set Up Payments (Optional for v1)

You can launch with test payment keys and upgrade to live keys later.

### Stripe (for USD/global users)

1. Go to dashboard.stripe.com → Developers → API keys
2. Copy live secret key (`sk_live_...`)
3. Add to Railway variables: `STRIPE_API_KEY=sk_live_...`
4. Create webhook: Developers → Webhooks → Add endpoint
   - URL: `https://YOUR_RAILWAY_URL.up.railway.app/api/v1/payments/webhook/stripe`
   - Events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
5. Copy webhook secret (`whsec_...`) → Railway: `STRIPE_WEBHOOK_SECRET=whsec_...`

### Razorpay (for Indian users)

1. Go to dashboard.razorpay.com → Settings → API Keys
2. Copy live key ID and secret
3. Add to Railway variables
4. Create webhook with your Railway URL

## What You Can Skip for v1

- Custom domain (use Railway's URL)
- Cloudflare CDN (Railway has decent performance)
- R2 object storage (progress photos can be added later)
- Firebase push notifications (can add later)
- Sentry crash reporting (nice-to-have, not required)

## Privacy Policy Requirement

Apple and Google require a privacy policy URL. Quick options:

1. **GitHub Pages** (free): Create a repo, enable Pages, upload `docs/privacy-policy.md`
2. **Notion** (free): Publish the privacy policy as a public page
3. **Google Docs** (free): Set sharing to "Anyone with the link"

Use that URL in your App Store Connect and Google Play listings.

## Estimated Costs (First Month)

| Service | Cost |
|---------|------|
| Railway | $5 |
| Neon | $0 (free tier) |
| Apple Developer | $99/year ($8.25/mo) |
| Google Play | $25 one-time |
| **Total first month** | **~$38** |
| **Ongoing monthly** | **$5** |

## Troubleshooting

**Railway deploy fails:**
- Check logs in Railway dashboard
- Verify DATABASE_URL is correct (asyncpg format with `?ssl=require`)
- Verify JWT_SECRET is at least 32 characters

**App can't connect to API:**
- Verify EXPO_PUBLIC_API_URL in eas.json matches your Railway URL
- Check Railway logs for errors
- Try the health check: `curl https://YOUR_URL.up.railway.app/api/v1/health`

**Migrations fail:**
- Verify DATABASE_URL is set correctly
- Check Neon dashboard → SQL Editor to see if tables exist
- Try: `alembic downgrade base` then `alembic upgrade head`

## Next Steps After Launch

Once you have users and revenue:

1. Add custom domain ($12/yr for .com)
2. Add Cloudflare CDN for faster global performance
3. Add R2 object storage for progress photos
4. Upgrade Neon to Pro ($19/mo) when you hit 5K users
5. Add Sentry for crash reporting
6. Add Firebase for push notifications

But for v1, Railway + Neon + test payment keys gets you live.
