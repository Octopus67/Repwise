# App Store Submission Guide

**Repwise — iOS & Android Store Submission**

## Part 1: Apple App Store (iOS)

### 1.1 Apple Developer Account

1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/)
2. Enroll in the Apple Developer Program ($99/year)
3. Complete identity verification (may take 24-48 hours)
4. Once approved, sign in to [App Store Connect](https://appstoreconnect.apple.com)

### 1.2 Create App Store Connect Listing

1. In App Store Connect → "My Apps" → "+" → "New App"
2. Fill in:
   - **Platform:** iOS
   - **Name:** Repwise
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** `com.repwise.app` (must match `app.json`)
   - **SKU:** `repwise-ios`

### 1.3 App Metadata

| Field | Value |
|-------|-------|
| Name | Repwise |
| Subtitle | Smart Training & Nutrition |
| Category | Health & Fitness |
| Description | See Section 1.4 below |
| Keywords | hypertrophy, workout tracker, nutrition tracker, macro tracker, TDEE, bodybuilding, fitness, meal plan, coaching, progressive overload |
| Support URL | https://repwise.com/support |
| Marketing URL | https://repwise.com |
| Privacy Policy URL | https://repwise.com/privacy |

### 1.4 App Description

```
Repwise is the adaptive training and nutrition platform built for serious lifters.

Track your nutrition with barcode scanning and a database of 300,000+ foods. Log your training with smart exercise suggestions and automatic PR detection. Watch your body composition change with progress photo comparisons.

What makes Repwise different:
- Adaptive TDEE that adjusts to YOUR metabolism using real weight and intake data
- Three coaching modes (Autonomous, Guided, Coached) that match your experience level
- Progressive overload tracking with personal record detection
- Meal plans and recipe builder tailored to your macro targets
- Weekly check-ins that adjust your nutrition targets automatically

Free features:
- Full nutrition tracking with barcode scanner
- Basic training logging
- Body weight tracking

Premium ($9.99/mo or $79.99/yr):
- Coaching modes with adaptive recommendations
- Advanced analytics and trend reports
- Meal plans and recipe builder
- Progress photo comparisons
- Priority support
```

### 1.5 Screenshots

Prepare screenshots for three required device sizes, 5 screens each:

| Device Size | Resolution | Device Reference |
|-------------|------------|------------------|
| 6.7" | 1290 × 2796 | iPhone 15 Pro Max |
| 6.5" | 1284 × 2778 | iPhone 11 Pro Max |
| 5.5" | 1242 × 2208 | iPhone 8 Plus |

**5 screens to capture (per device size):**

1. **Dashboard** — Daily summary with macro rings, calorie budget, and today's training
2. **Active Workout** — Mid-workout view showing exercise, sets, and PR badge
3. **Nutrition** — Food logging screen with barcode scanner and macro breakdown
4. **Analytics** — Trend charts showing weight, TDEE, and body composition over time
5. **Coaching** — Coaching mode selector or weekly check-in card

**Tips:**
- Use a clean demo account with realistic data
- Ensure status bar shows full battery and strong signal
- No placeholder text — all data should look real
- Screenshots should highlight the value proposition of each screen


### 1.6 In-App Purchase Products

Create subscription products in App Store Connect → "Features" → "In-App Purchases":

| Product ID | Reference Name | Type | Price |
|------------|---------------|------|-------|
| `rw_premium_monthly` | RW Premium Monthly | Auto-Renewable Subscription | $9.99/month |
| `rw_premium_annual` | RW Premium Annual | Auto-Renewable Subscription | $79.99/year |

**Subscription Group:** "RW Premium"

For each product:
1. Set display name and description
2. Set pricing (price tier)
3. Add localization for all target regions
4. Set subscription duration
5. Submit for review (reviewed alongside the app binary)

### 1.7 Demo Account for App Review

Provide a demo account so Apple reviewers can test the app:

| Field | Value |
|-------|-------|
| Email | reviewer@repwise.com |
| Password | ReviewPass123 |

**Setup:**
1. Create this account in the production database before submission
2. Grant it premium access (active subscription) so reviewers can test all features
3. Pre-populate with sample data (a few nutrition logs, training sessions, body weight entries) so the app doesn't look empty

### 1.8 Review Notes Template

Paste this in the "Notes for Review" field in App Store Connect:

```
Repwise is a freemium fitness app for tracking nutrition and training.

FREE FEATURES:
- Nutrition tracking with barcode scanner (300,000+ food database)
- Basic training logging
- Body weight tracking

PREMIUM FEATURES ($9.99/mo or $79.99/yr):
- Three coaching modes (Autonomous, Guided, Coached)
- Advanced analytics and trend reports
- Meal plans and recipe builder
- Progress photo comparisons

DEMO ACCOUNT:
Email: reviewer@repwise.com
Password: ReviewPass123
(This account has premium access enabled for review purposes)

The app uses Stripe for payment processing via web checkout.
Push notifications are used for weekly coaching reminders and subscription status updates.
```

### 1.9 Age Rating

- Select **4+** (no objectionable content)
- No gambling, horror, violence, or mature content
- Health & Fitness category with body measurement tracking

### 1.10 Privacy URL

- Privacy Policy URL: `https://repwise.com/privacy`
- Ensure the privacy policy page is live and accessible before submission

### 1.11 App Privacy Details

In App Store Connect → "App Privacy", declare:

| Data Type | Collection | Linked to Identity | Tracking |
|-----------|------------|-------------------|----------|
| Email Address | Yes | Yes | No |
| Health & Fitness (body measurements) | Yes | Yes | No |
| Health & Fitness (nutrition) | Yes | Yes | No |
| Fitness Activity (training logs) | Yes | Yes | No |
| Photos (progress photos) | Yes | Yes | No |
| Identifiers (device token) | Yes | Yes | No |
| Diagnostics (crash data) | Yes | No | No |
| Usage Data (analytics) | Yes | No | No |

### 1.12 Submission Checklist

- [ ] App binary uploaded via EAS Submit or Transporter
- [ ] All metadata fields filled (name, subtitle, description, keywords)
- [ ] Screenshots uploaded for all 3 device sizes (5 per size)
- [ ] App icon (1024x1024) uploaded
- [ ] Privacy policy URL live and accessible
- [ ] IAP products created and submitted for review
- [ ] Demo account created and working
- [ ] Review notes filled in
- [ ] Age rating set to 4+
- [ ] App Privacy details completed
- [ ] Build selected for review

---

## Part 2: Google Play Store (Android)

### 2.1 Google Play Developer Account

1. Go to [play.google.com/console](https://play.google.com/console)
2. Pay the one-time registration fee ($25)
3. Complete identity verification
4. Accept the Developer Distribution Agreement

### 2.2 Create Store Listing

1. In Google Play Console → "All apps" → "Create app"
2. Fill in:
   - **App name:** Repwise
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free

### 2.3 Store Listing Metadata

| Field | Value |
|-------|-------|
| Title | Repwise |
| Short description (80 chars) | Adaptive training & nutrition for serious lifters |
| Full description | Same as iOS description (Section 1.4), adapted for Google Play formatting |
| Category | Health & Fitness |
| Tags | Fitness, Nutrition, Workout, Training |

### 2.4 Graphics Assets

| Asset | Specification |
|-------|--------------|
| App icon | 512 × 512 PNG (32-bit, no alpha) |
| Feature graphic | 1024 × 500 PNG or JPEG — branded image with app name and key screens |
| Phone screenshots | Minimum 2, recommended 8 — same screens as iOS (Dashboard, Active Workout, Nutrition, Analytics, Coaching, Onboarding, Profile, Exercise Picker) |

**Screenshot specs:**
- Minimum: 320px on shortest side
- Maximum: 3840px on longest side
- Aspect ratio between 16:9 and 9:16
- JPEG or PNG, max 8MB each

### 2.5 Content Rating (IARC)

1. Go to "Policy" → "App content" → "Content rating"
2. Start the IARC questionnaire
3. Answer all questions:
   - Violence: No
   - Sexual content: No
   - Language: No
   - Controlled substances: No
   - User-generated content: Yes (progress photos, but private to user)
4. Expected rating: **Everyone** (IARC equivalent of 4+)

### 2.6 Data Safety Section

Go to "Policy" → "App content" → "Data safety":

| Data Type | Collected | Shared | Purpose | Encrypted in Transit | Deletable |
|-----------|-----------|--------|---------|---------------------|-----------|
| Email address | Yes | No | Account management | Yes | Yes |
| Body measurements (height, weight, body fat) | Yes | No | App functionality | Yes | Yes |
| Nutrition logs | Yes | No | App functionality | Yes | Yes |
| Training/exercise logs | Yes | No | App functionality | Yes | Yes |
| Photos (progress photos) | Yes | No | App functionality | Yes | Yes |
| Crash logs | Yes | No | Analytics | Yes | No |
| App interactions | Yes | No | Analytics | Yes | No |
| Device identifiers (push token) | Yes | No | App functionality | Yes | Yes |

**Additional declarations:**
- Data is encrypted in transit: Yes
- Users can request data deletion: Yes
- Committed to following the Families Policy: N/A (not a children's app)

### 2.7 In-App Purchase Products

Create subscription products in Google Play Console → "Monetize" → "Products" → "Subscriptions":

| Product ID | Name | Base Plan | Price |
|------------|------|-----------|-------|
| `rw_premium_monthly` | RW Premium Monthly | Monthly auto-renew | $9.99/month (₹499/month in India) |
| `rw_premium_annual` | RW Premium Annual | Annual auto-renew | $79.99/year (₹3,999/year in India) |

For each product:
1. Create the subscription
2. Add a base plan with the billing period
3. Set pricing for all target regions (use "Set prices by country" for INR pricing)
4. Activate the subscription

### 2.8 Testing Track Promotion Flow

Google Play requires progressive rollout through testing tracks:

**Step 1: Internal Testing**
1. Go to "Testing" → "Internal testing"
2. Create a release → upload the `.aab` file from EAS Build
3. Add testers by email (up to 100)
4. Testers install via the opt-in link
5. Validate all core flows (auth, nutrition, training, payments, push)

**Step 2: Closed Testing**
1. Go to "Testing" → "Closed testing"
2. Create a track (e.g., "Beta")
3. Promote the internal testing release to closed testing
4. Add 50-100 beta testers
5. Collect feedback and crash reports for 1-2 weeks
6. Fix any critical issues

**Step 3: Production**
1. Go to "Production"
2. Promote the closed testing release to production
3. Set rollout percentage (start at 20%, increase to 100% over a few days)
4. Monitor crash rate and user feedback in the dashboard

### 2.9 Submission Checklist

- [ ] App binary (.aab) uploaded via EAS Submit or manual upload
- [ ] Store listing complete (title, descriptions, category)
- [ ] Feature graphic (1024x500) uploaded
- [ ] 8 phone screenshots uploaded
- [ ] App icon (512x512) uploaded
- [ ] Content rating questionnaire completed (IARC)
- [ ] Data safety section completed
- [ ] Privacy policy URL set and accessible
- [ ] IAP subscription products created and activated
- [ ] Target countries configured (US, India, global)
- [ ] Internal testing release validated
- [ ] Closed testing release validated
- [ ] Production release submitted for review

---

## Common Rejection Reasons & Fixes

### Apple App Store

| Rejection Reason | Fix |
|-----------------|-----|
| Missing demo account | Ensure reviewer@repwise.com works and has premium access |
| Privacy policy incomplete | Verify all collected data types are disclosed |
| Broken links | Test all URLs (privacy, support, marketing) before submission |
| Subscription not clearly explained | Add clear pricing and auto-renewal info in the app and description |
| Guideline 3.1.1 — IAP required for digital content | Ensure subscriptions use Apple IAP (not just Stripe web checkout) |
| Guideline 5.1.1 — Data collection disclosure | Complete App Privacy section accurately |

### Google Play

| Rejection Reason | Fix |
|-----------------|-----|
| Data safety inaccurate | Ensure all collected data types match what the app actually collects |
| Missing privacy policy | Set privacy policy URL in store listing and within the app |
| Content rating mismatch | Re-do IARC questionnaire if app content changes |
| Subscription issues | Ensure IAP products are activated and pricing is set for all regions |
| Target API level too low | Ensure `targetSdkVersion` meets Google Play's current requirement (API 34+) |
