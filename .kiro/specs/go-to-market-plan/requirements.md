# Requirements Document

## Introduction

This document defines the requirements for taking Hypertrophy OS from development to live on both Apple App Store and Google Play Store — covering cloud infrastructure deployment, app store submissions, payment provider production integration, observability, and operational readiness.

### Problem Definition

"I've built the whole app but I have no idea how to actually get it in front of users — the backend is running on SQLite locally, payments are stubbed, and I've never submitted to the App Store."

Why now: The app has a complete feature set (adaptive TDEE, nutrition tracking with barcode scan, Active Workout with PR detection, coaching modes, progress photos, meal plans) and a freemium model with Stripe + Razorpay payment providers already coded. The gap is purely operational — going from `localhost:8000` to a production URL that real users hit, with signed app binaries in both stores.

Sharpness: This isn't generic "deploy an app." This is specific to a React Native (Expo 50) + FastAPI + PostgreSQL stack with dual payment providers (Stripe for USD/global, Razorpay for INR/India), a freemium gate middleware, 20+ API modules, Alembic migrations, and a founder bootstrapping on minimal budget who needs to stay under $50/month at launch.

### Success Metrics

- **Primary**: App live on both App Store and Google Play within 2 weeks of starting execution
- **Primary**: Backend API p95 response time under 500ms at 1,000 concurrent users
- **Guardrail**: Monthly infrastructure cost stays under $50 for the first 1,000 users
- **Leading indicator**: First 100 organic installs within 30 days of launch

### Rollout Strategy

- **Phase 1 — Staging**: Deploy backend to staging, run full test suite against it, validate payment webhooks with test keys
- **Phase 2 — Internal Testing**: Submit app to TestFlight (iOS) and Internal Testing track (Android), validate end-to-end flows with 3-5 testers
- **Phase 3 — Closed Beta**: Open to 50-100 beta users via TestFlight public link and Google Play closed testing, collect crash reports and feedback
- **Phase 4 — Production Launch**: Promote to App Store and Google Play production, switch payment providers to live keys, enable monitoring alerts
- **Phase 5 — Scale Monitoring**: Watch cost and performance metrics weekly, upgrade infrastructure tiers as user count grows

## Glossary

- **Backend_Service**: The FastAPI application serving the REST API at `/api/v1/`, containerized via the existing Dockerfile
- **Frontend_App**: The React Native (Expo 50) mobile application for iOS and Android
- **Build_Pipeline**: The CI/CD system (GitHub Actions + EAS Build) that builds, tests, and deploys artifacts
- **Infrastructure_Provisioner**: The system or scripts that create and configure cloud resources
- **App_Store_Publisher**: The process that submits and manages app listings on Apple App Store and Google Play Store
- **Payment_Gateway**: The Stripe and Razorpay integrations (existing `stripe_provider.py` and `razorpay_provider.py`) that process subscriptions
- **Monitoring_System**: The observability stack (logging, metrics, crash reporting, analytics)
- **CDN**: Content Delivery Network for serving static assets and API caching
- **Database_Service**: The managed PostgreSQL instance replacing the current SQLite dev database
- **Object_Storage**: Cloud storage for user-uploaded files (progress photos, avatars)
- **Push_Service**: The service that delivers push notifications to mobile devices via APNs and FCM
- **SSL_Terminator**: The component that handles TLS certificate provisioning and HTTPS termination

## Requirements

### Requirement 1: Backend Deployment Infrastructure

**User Story:** As a founder, I want the backend deployed to a reliable, cost-efficient cloud environment, so that the API is available to all users with minimal latency and I stay under budget.

#### Acceptance Criteria

1. THE Infrastructure_Provisioner SHALL deploy the Backend_Service as a containerized application using the existing Dockerfile
2. WHEN the Backend_Service starts, THE Infrastructure_Provisioner SHALL configure a managed PostgreSQL instance as the Database_Service with automated daily backups
3. THE Infrastructure_Provisioner SHALL configure the SSL_Terminator to provision and auto-renew TLS certificates for all API endpoints
4. WHEN traffic increases beyond a single instance capacity, THE Infrastructure_Provisioner SHALL auto-scale the Backend_Service horizontally up to a configured maximum
5. THE Infrastructure_Provisioner SHALL configure environment variables (DATABASE_URL, JWT_SECRET, USDA_API_KEY, STRIPE_WEBHOOK_SECRET, RAZORPAY_WEBHOOK_SECRET, CORS_ORIGINS) using a secrets management approach
6. WHEN the Backend_Service is deployed, THE Infrastructure_Provisioner SHALL expose the existing health check endpoint at `/api/v1/health` for load balancer probes
7. THE Infrastructure_Provisioner SHALL deploy the Backend_Service to a region geographically close to the primary user base (India and US)

### Requirement 2: Frontend Build and Distribution Pipeline

**User Story:** As a developer, I want an automated build pipeline for the mobile app, so that I can produce signed builds for both iOS and Android from a single codebase without manual Xcode/Android Studio work.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL produce signed iOS builds (.ipa) using an Apple Distribution certificate and provisioning profile
2. THE Build_Pipeline SHALL produce signed Android builds (.aab) using an upload keystore registered with Google Play Console
3. WHEN code is merged to the main branch, THE Build_Pipeline SHALL trigger a build for both platforms automatically
4. THE Build_Pipeline SHALL inject environment-specific variables (EXPO_PUBLIC_API_URL, EXPO_PUBLIC_POSTHOG_KEY) at build time for staging and production environments
5. IF a build fails, THEN THE Build_Pipeline SHALL notify the development team with the failure reason and build logs
6. THE Build_Pipeline SHALL use EAS Build (Expo Application Services) to compile native binaries, because the app uses Expo 50 with native modules (expo-camera, expo-haptics, expo-secure-store)

### Requirement 3: Apple App Store Submission

**User Story:** As a product owner, I want the app submitted to the Apple App Store, so that iOS users can discover and install Hypertrophy OS.

#### Acceptance Criteria

1. THE App_Store_Publisher SHALL register an Apple Developer account ($99/year) and create an App Store Connect listing for Hypertrophy OS
2. THE App_Store_Publisher SHALL provide app metadata: name ("Hypertrophy OS"), subtitle, description, keywords, category (Health & Fitness), and privacy policy URL
3. THE App_Store_Publisher SHALL upload screenshots for required device sizes (6.7" iPhone 15 Pro Max, 6.5" iPhone 11 Pro Max, and 5.5" iPhone 8 Plus)
4. THE App_Store_Publisher SHALL configure the app's age rating (4+, no objectionable content), pricing (free with in-app purchases), and availability for target regions (US, India, global)
5. WHEN the app uses in-app subscriptions, THE App_Store_Publisher SHALL create subscription products in App Store Connect matching the plan_id values used by the Payment_Gateway
6. THE App_Store_Publisher SHALL submit the app for App Review with a demo account (email + password) and review notes explaining the freemium model and subscription tiers
7. IF App Review rejects the submission, THEN THE App_Store_Publisher SHALL address the rejection reason and resubmit within 5 business days

### Requirement 4: Google Play Store Submission

**User Story:** As a product owner, I want the app submitted to the Google Play Store, so that Android users can discover and install Hypertrophy OS.

#### Acceptance Criteria

1. THE App_Store_Publisher SHALL register a Google Play Developer account ($25 one-time) and create a store listing for Hypertrophy OS
2. THE App_Store_Publisher SHALL provide store listing metadata: title, short description (80 chars), full description (4000 chars), category (Health & Fitness), and privacy policy URL
3. THE App_Store_Publisher SHALL upload screenshots for phone form factor (minimum 2, recommended 8) plus a feature graphic (1024x500)
4. THE App_Store_Publisher SHALL complete the content rating questionnaire (IARC) and data safety section declaring collected data types (email, body measurements, nutrition logs, training logs, photos)
5. THE App_Store_Publisher SHALL configure pricing as free with in-app purchases and set target countries (US, India, global)
6. WHEN the app uses subscriptions, THE App_Store_Publisher SHALL create subscription products in Google Play Console matching the plan_id values used by the Payment_Gateway
7. THE App_Store_Publisher SHALL submit the app through the internal testing track first, then promote to closed testing, then to production after validation

### Requirement 5: Payment Provider Production Integration

**User Story:** As a product owner, I want Stripe and Razorpay fully integrated in production mode, so that users can subscribe and pay for premium features with real money.

#### Acceptance Criteria

1. WHEN a user in the US region initiates a subscription, THE Payment_Gateway SHALL process the payment through Stripe using live API keys (replacing the current stub implementations in `stripe_provider.py`)
2. WHEN a user in the IN region initiates a subscription, THE Payment_Gateway SHALL process the payment through Razorpay using live API keys (replacing the current stub implementations in `razorpay_provider.py`)
3. THE Payment_Gateway SHALL configure production webhook endpoints for both Stripe (`/api/v1/payments/webhook/stripe`) and Razorpay (`/api/v1/payments/webhook/razorpay`) with verified HMAC-SHA256 signatures
4. THE Payment_Gateway SHALL create subscription products and pricing plans in both Stripe Dashboard and Razorpay Dashboard matching the app's plan_id values
5. IF a webhook signature verification fails, THEN THE Payment_Gateway SHALL reject the request and log the failure with the provider name, timestamp, and request metadata
6. THE Payment_Gateway SHALL store production API keys and webhook secrets as encrypted environment variables, separate from development secrets
7. WHEN Apple or Google processes an in-app purchase, THE Payment_Gateway SHALL validate the receipt server-side and reconcile the transaction with the corresponding subscription record

### Requirement 6: Object Storage for User Content

**User Story:** As a user, I want my progress photos and uploaded content stored reliably, so that I can access them across devices and sessions.

#### Acceptance Criteria

1. THE Infrastructure_Provisioner SHALL provision an Object_Storage bucket for user-uploaded files (progress photos from the existing `progress_photos` module, avatars)
2. THE Object_Storage SHALL serve files through the CDN with cache headers for static assets
3. WHEN a user uploads a file, THE Backend_Service SHALL generate a pre-signed upload URL with a maximum file size of 10MB and expiry of 15 minutes
4. THE Object_Storage SHALL enforce access controls so that users can only read their own uploaded files
5. THE Infrastructure_Provisioner SHALL configure lifecycle rules to transition infrequently accessed files to cheaper storage tiers after 90 days

### Requirement 7: Push Notification Service

**User Story:** As a user, I want to receive push notifications for coaching check-ins and workout reminders, so that I stay consistent with my training and nutrition.

#### Acceptance Criteria

1. THE Push_Service SHALL deliver notifications to both iOS (APNs) and Android (FCM) devices
2. WHEN a weekly coaching check-in is due (from the existing `coaching_service.py`), THE Push_Service SHALL send a reminder notification to the user
3. WHEN a subscription status changes (renewal, expiry, payment failure), THE Push_Service SHALL notify the affected user
4. THE Backend_Service SHALL store device push tokens per user and remove invalid tokens when delivery fails
5. THE Push_Service SHALL respect user notification preferences stored in the user profile and not send notifications to users who have opted out

### Requirement 8: Monitoring, Logging, and Crash Reporting

**User Story:** As a developer, I want comprehensive observability for both backend and frontend, so that I can detect and resolve issues before they impact users.

#### Acceptance Criteria

1. THE Monitoring_System SHALL collect structured JSON logs from the Backend_Service with request ID, user ID, endpoint, HTTP method, status code, and response time
2. THE Monitoring_System SHALL capture unhandled exceptions and crashes from the Frontend_App with stack traces, device model, OS version, and app version
3. WHEN the Backend_Service error rate exceeds 5% over a 5-minute window, THE Monitoring_System SHALL trigger an alert to the development team via email or Slack
4. WHEN the Backend_Service p95 response time exceeds 2 seconds over a 5-minute window, THE Monitoring_System SHALL trigger a performance alert
5. THE Monitoring_System SHALL integrate with PostHog (already configured via EXPO_PUBLIC_POSTHOG_KEY) for product analytics on the frontend
6. THE Monitoring_System SHALL retain logs for a minimum of 30 days and metrics for a minimum of 90 days

### Requirement 9: CDN and Static Asset Delivery

**User Story:** As a user, I want fast asset loading regardless of my location, so that exercise images and app content load instantly.

#### Acceptance Criteria

1. THE CDN SHALL cache static assets (exercise images served from `/static/`, app icons) at edge locations
2. THE CDN SHALL terminate TLS and forward API requests to the Backend_Service origin
3. WHEN serving cached content, THE CDN SHALL return responses within 100ms at the edge
4. THE CDN SHALL support cache invalidation for updated static assets via purge API or versioned filenames
5. THE Infrastructure_Provisioner SHALL configure Cache-Control headers: `max-age=31536000, immutable` for hashed filenames, `max-age=3600` for dynamic content

### Requirement 10: Database Production Readiness

**User Story:** As a developer, I want the production database configured for reliability and performance, so that user data is safe and queries are fast.

#### Acceptance Criteria

1. THE Database_Service SHALL use managed PostgreSQL (replacing the current SQLite dev database) with a minimum of 1 vCPU and 1GB RAM for initial launch
2. THE Database_Service SHALL have automated daily backups with point-in-time recovery capability for at least 7 days
3. THE Database_Service SHALL enforce SSL connections from the Backend_Service
4. WHEN the database connection pool is exhausted, THE Backend_Service SHALL queue requests rather than reject them, up to a configured timeout of 30 seconds
5. THE Build_Pipeline SHALL run Alembic migrations as part of the deployment pipeline before starting new Backend_Service instances
6. THE Database_Service SHALL be deployed in the same region and network as the Backend_Service to minimize query latency

### Requirement 11: Security and Compliance

**User Story:** As a product owner, I want the application to meet security best practices and app store privacy requirements, so that user data is protected and the app passes review.

#### Acceptance Criteria

1. THE Backend_Service SHALL enforce HTTPS for all API endpoints with no plaintext HTTP fallback
2. THE Backend_Service SHALL use the existing JWT authentication (bcrypt password hashing, access/refresh token rotation) in production with a strong JWT_SECRET (minimum 256-bit)
3. THE Backend_Service SHALL apply the existing rate_limiter middleware to authentication endpoints to prevent brute-force attacks
4. THE App_Store_Publisher SHALL publish a privacy policy URL that discloses all collected data types: email, body measurements, nutrition logs, training logs, progress photos, device tokens
5. THE App_Store_Publisher SHALL publish terms of service covering subscription billing, auto-renewal, refund policy, and data retention
6. WHEN a user requests account deletion (via the existing `/api/v1/account` endpoint), THE Backend_Service SHALL soft-delete the user record and schedule permanent data removal within 30 days per Apple and Google requirements
7. THE Infrastructure_Provisioner SHALL enable encryption at rest for both the Database_Service and Object_Storage

### Requirement 12: Cost-Optimized Infrastructure Selection

**User Story:** As a bootstrapped founder, I want the cheapest viable infrastructure that can scale from 100 to 100K users, so that I minimize burn rate while maintaining reliability.

#### Acceptance Criteria

1. THE Infrastructure_Provisioner SHALL select providers that cost under $50/month total for the initial launch phase (up to 1,000 users)
2. THE Infrastructure_Provisioner SHALL provide a cost comparison across at least 4 providers (from: Railway, Render, Fly.io, DigitalOcean, Hetzner, AWS, GCP, Neon, Supabase, PlanetScale, Cloudflare) for each infrastructure component
3. WHEN user count exceeds 10,000, THE Infrastructure_Provisioner SHALL support vertical or horizontal scaling without application code changes (because the app already uses async SQLAlchemy and stateless JWT auth)
4. THE Infrastructure_Provisioner SHALL prefer providers with generous free tiers for ancillary services (object storage, CDN, push notifications, analytics)
5. THE Infrastructure_Provisioner SHALL document estimated monthly costs at 100, 1K, 10K, and 100K user scales for each component in the design document

### Requirement 13: Domain and DNS Configuration

**User Story:** As a product owner, I want a custom domain for the API, so that the product has a professional presence and users trust the service.

#### Acceptance Criteria

1. THE Infrastructure_Provisioner SHALL configure DNS A/CNAME records for the API domain (e.g., api.hypertrophyos.com) pointing to the Backend_Service load balancer
2. THE Infrastructure_Provisioner SHALL configure DNS records for the marketing/landing page domain (e.g., hypertrophyos.com)
3. THE SSL_Terminator SHALL provision TLS certificates for all configured domains with automatic renewal
4. WHEN DNS propagation completes, THE Backend_Service SHALL be accessible via the custom domain with valid HTTPS within 24 hours

### Requirement 14: Staging Environment

**User Story:** As a developer, I want a staging environment that mirrors production, so that I can validate payment flows, push notifications, and new features before they reach real users.

#### Acceptance Criteria

1. THE Infrastructure_Provisioner SHALL provision a staging environment with the same architecture as production but with reduced resource allocation (smallest available tier)
2. THE Build_Pipeline SHALL deploy to staging automatically on merge to main, and to production only on manual promotion or tagged release
3. THE staging environment SHALL use separate database, API keys (Stripe test keys, Razorpay test keys), and webhook endpoints from production
4. THE staging environment SHALL be accessible only to the development team via authentication or IP allowlisting
