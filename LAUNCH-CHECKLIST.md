# Launch Checklist — You're Almost There

## ✅ Done

- [x] Neon database created and initialized with all tables
- [x] Railway project created
- [x] Database URL configured: `postgresql+asyncpg://neondb_owner:...@ep-steep-bonus-ai7arlzn-pooler.c-4.us-east-1.aws.neon.tech/neondb?ssl=require`
- [x] Railway domain generated: `hypertrophyos-production.up.railway.app`
- [x] `app/eas.json` updated with Railway URL
- [x] All production code complete (notifications, payments, logging, Sentry)

## 🔲 Next Steps (30 min)

### 1. Push to GitHub

```bash
git add .
git commit -m "Production ready — Railway + Neon configured"
git push origin main
```

Railway will auto-deploy when it sees the push.

### 2. Verify Backend is Live (2 min)

Wait 2-3 minutes for Railway to build and deploy, then:

```bash
curl https://hypertrophyos-production.up.railway.app/api/v1/health
```

Should return: `{"status":"ok"}`

If you get 404 or error, check Railway dashboard → Deployments → View Logs.

### 3. Build Mobile App (30 min)

```bash
cd app
npm install -g eas-cli  # if not installed
eas login
eas build --profile production --platform all --non-interactive
```

This takes 20-30 minutes. EAS will email you when done with download links for the `.ipa` (iOS) and `.aab` (Android) files.

### 4. Test the App Locally First (Optional but Recommended)

Before submitting to stores, test against your production backend:

```bash
cd app
# Update .env or create .env.local with:
# EXPO_PUBLIC_API_URL=https://hypertrophyos-production.up.railway.app

npx expo start
```

Test: register, login, log nutrition, log training. Make sure everything works.

## 🔲 App Store Submission (1-2 hours)

Follow `docs/app-store-submission.md` for detailed steps. Quick version:

### Apple App Store

1. Go to appstoreconnect.apple.com
2. Create app listing (name: HypertrophyOS, category: Health & Fitness)
3. Upload 5 screenshots per device size (use Simulator)
4. Create IAP products: $9.99/mo, $79.99/yr
5. Create demo account: `reviewer@hypertrophyos.com` / `ReviewPass123`
6. Upload `.ipa` via Transporter or `eas submit --platform ios`
7. Submit for review

### Google Play

1. Go to play.google.com/console
2. Create app listing
3. Upload 8 screenshots + feature graphic (1024x500)
4. Complete data safety section
5. Upload `.aab` to internal testing track
6. Promote to production after testing

## 🔲 Privacy Policy (15 min)

Apple and Google require a privacy policy URL. Quick options:

1. **GitHub Pages** (easiest):
   ```bash
   # Create a new repo called "hypertrophyos-legal"
   # Enable Pages in repo settings
   # Upload docs/privacy-policy.md as index.md
   # URL: https://YOUR_USERNAME.github.io/hypertrophyos-legal/
   ```

2. **Notion** (free): Publish `docs/privacy-policy.md` as a public page

3. **Google Docs** (free): Upload the doc, set sharing to "Anyone with the link"

Use that URL in both App Store Connect and Google Play Console.

## 🔲 Optional: Add Live Payment Keys

You can launch with test keys and upgrade later. To add live keys:

### Stripe

1. dashboard.stripe.com → Developers → API keys
2. Copy `sk_live_...` → Railway variables: `STRIPE_API_KEY`
3. Create webhook: URL = `https://hypertrophyos-production.up.railway.app/api/v1/payments/webhook/stripe`
4. Copy `whsec_...` → Railway: `STRIPE_WEBHOOK_SECRET`
5. Create products: $9.99/mo, $79.99/yr
6. Update `STRIPE_PRICE_MAP` in `src/modules/payments/stripe_provider.py` with real price IDs

### Razorpay (for Indian users)

1. dashboard.razorpay.com → Settings → API Keys
2. Copy live keys → Railway variables
3. Create plans: ₹499/mo, ₹3,999/yr
4. Update `RAZORPAY_PLAN_MAP` in `src/modules/payments/razorpay_provider.py`

## Cost Summary

| Service | Cost |
|---------|------|
| Railway | $5/mo |
| Neon | $0 (free tier, auto-suspend) |
| Apple Developer | $99/year |
| Google Play | $25 one-time |
| **Total first month** | ~$38 |
| **Ongoing** | $5/mo |

## Troubleshooting

**Railway deploy fails:**
- Check Railway dashboard → Deployments → Logs
- Verify all env vars are set (especially DATABASE_URL and JWT_SECRET)

**App can't connect:**
- Verify `EXPO_PUBLIC_API_URL` in `app/eas.json` matches your Railway URL
- Test health endpoint: `curl https://YOUR_URL.up.railway.app/api/v1/health`

**Database connection fails:**
- Verify DATABASE_URL format: `postgresql+asyncpg://...?ssl=require`
- Check Neon dashboard → your database is active (not suspended)

## What's Next After Launch

Once you have users:

1. Monitor Railway logs for errors
2. Watch Neon dashboard for database usage
3. Add Sentry DSN for crash reporting (optional)
4. Add custom domain when you're ready ($12/yr)
5. Upgrade Neon to Pro ($19/mo) when you hit 5K users

You're ready to ship. Good luck with the launch!
