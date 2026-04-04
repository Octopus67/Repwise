# Privacy Policy

**Repwise**
**Last Updated:** March 20, 2026
**Effective Date:** March 20, 2026

## 1. Introduction

Repwise ("we," "us," or "our") operates the Repwise mobile application (the "App"). This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our App.

By using Repwise, you agree to the collection and use of information as described in this policy.

## 2. Information We Collect

### 2.1 Account Information

| Data Type | Purpose | Storage |
|-----------|---------|---------|
| Email address | Account creation, login, communication | Encrypted at rest in our database |
| Password | Authentication (email/password accounts) | Stored as a bcrypt hash — we never store plaintext passwords |
| Name | Display name, personalization | Encrypted at rest (received from Google OAuth or Apple Sign-In) |
| Profile photo URL | Profile display | Encrypted at rest (received from Google OAuth) |
| OAuth provider ID | Account linking for Google OAuth and Apple Sign-In | Encrypted at rest |

### 2.2 Body & Health Data

| Data Type | Purpose | Storage |
|-----------|---------|---------|
| Height | TDEE calculation, body composition tracking | Encrypted at rest |
| Weight | Weight trend tracking, adaptive nutrition | Encrypted at rest |
| Body fat percentage | Body composition analysis, coaching recommendations | Encrypted at rest |

### 2.3 Activity & Nutrition Data

| Data Type | Purpose | Storage |
|-----------|---------|---------|
| Nutrition logs | Calorie and macro tracking, dietary analysis | Encrypted at rest |
| Training logs | Workout tracking, progressive overload analysis, PR detection | Encrypted at rest |

### 2.4 Media

| Data Type | Purpose | Storage |
|-----------|---------|---------|
| Progress photos | Visual progress tracking, before/after comparisons | Encrypted at rest in cloud object storage (Cloudflare R2) |

### 2.5 Social Features Data

| Data Type | Purpose | Storage |
|-----------|---------|---------|
| Feed posts | Social sharing of workouts and progress | Encrypted at rest |
| Reactions | Social engagement on feed posts | Encrypted at rest |
| Follows | Social connections between users | Encrypted at rest |
| Leaderboard entries | Competitive rankings and motivation | Encrypted at rest |

### 2.6 Device & Technical Data

| Data Type | Purpose | Storage |
|-----------|---------|---------|
| Device push tokens | Delivering push notifications (coaching reminders, subscription alerts) | Encrypted at rest |
| Analytics events | Understanding app usage, improving features, tracking engagement | Processed by PostHog analytics |
| Crash reports | Identifying and fixing bugs, improving app stability | Processed by Sentry |

## 3. How We Use Your Information

We use the information we collect to:

- Provide and maintain the App's core functionality (nutrition tracking, training logging, adaptive TDEE)
- Calculate and adjust your personalized nutrition targets
- Deliver coaching recommendations and weekly check-in reminders
- Process subscription payments
- Send push notifications you have opted into (coaching reminders, subscription status updates)
- Monitor app performance and fix crashes
- Analyze usage patterns to improve the App
- Comply with legal obligations

We do not sell your personal data to third parties.

## 4. Third-Party Services

We share limited data with the following third-party services to operate the App:

| Service | Purpose | Data Shared | Privacy Policy |
|---------|---------|-------------|----------------|
| **Apple App Store** | Subscription payment processing (iOS) | Apple ID, subscription plan — all payment data handled by Apple | [apple.com/legal/privacy](https://www.apple.com/legal/privacy/) |
| **Google Play Store** | Subscription payment processing (Android) | Google account, subscription plan — all payment data handled by Google | [policies.google.com/privacy](https://policies.google.com/privacy) |
| **RevenueCat** | Subscription management and entitlement tracking | Anonymous app user ID, subscription status, purchase receipts | [revenuecat.com/privacy](https://www.revenuecat.com/privacy) |
| **Sentry** | Crash reporting and error tracking | Device model, OS version, app version, stack traces | [sentry.io/privacy](https://sentry.io/privacy) |
| **PostHog** | Product analytics | Anonymous usage events, device type, app version | [posthog.com/privacy](https://posthog.com/privacy) |
| **Firebase (FCM)** | Push notifications | Device push tokens | [firebase.google.com/support/privacy](https://firebase.google.com/support/privacy) |
| **Cloudflare R2** | CDN and object storage for progress photos | Progress photos, uploaded media | [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |
| **AWS SES** | Transactional emails (account verification, password reset) | Email address | [aws.amazon.com/privacy](https://aws.amazon.com/privacy/) |

Repwise never handles payment card data directly. All subscription payments are processed through Apple App Store (iOS) or Google Play Store (Android) via in-app purchases. We use RevenueCat to manage subscription entitlements and status.

## 5. Data Storage and Security

- All data is stored in managed PostgreSQL databases with encryption at rest
- Progress photos are stored in Cloudflare R2 object storage with encryption at rest
- All data in transit is encrypted via TLS/HTTPS — no plaintext HTTP connections are accepted
- Passwords are hashed using bcrypt before storage
- API authentication uses JWT tokens with short-lived access tokens (15 minutes) and rotating refresh tokens
- Access to user data is scoped — users can only access their own data

## 6. Data Retention

- **Active accounts:** Your data is retained for as long as your account is active
- **Account deletion:** When you request account deletion, your account enters a 30-day grace period during which you can reactivate. After 30 days, all personal data is permanently and irreversibly removed from our systems, including:
  - Account information (email, password hash)
  - Body measurements (height, weight, body fat)
  - Nutrition logs
  - Training logs
  - Progress photos
  - Device tokens
  - Notification preferences
- **Active subscriptions:** If you have an active subscription at the time of deletion request, it will be cancelled automatically

## 7. Your Rights

You have the following rights regarding your personal data:

### 7.1 Right to Access
You can view all your personal data within the App at any time (profile, logs, photos, preferences).

### 7.2 Right to Correction
You can update your personal information (email, body measurements, nutrition entries, training entries) directly within the App.

### 7.3 Right to Deletion
You can request account deletion through the App's account settings. Deletion follows the 30-day grace period described in Section 6.

### 7.4 Right to Data Portability
You can request an export of your personal data in a machine-readable format by contacting us at the email below.

## 8. Children's Privacy

Repwise is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will delete it promptly.

## 9. Push Notifications

We may send push notifications for:
- Weekly coaching check-in reminders
- Subscription status changes (renewal, expiry, payment issues)

You can opt out of push notifications at any time through the App's notification preferences or your device settings.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy within the App and updating the "Last Updated" date above.

## 11. Contact Us

If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at:

**Email:** support@repwise.app

**Privacy Policy URL:** https://repwise.app/privacy
