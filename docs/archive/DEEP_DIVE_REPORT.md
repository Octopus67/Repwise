# Repwise (Hypertrophy OS) — Deep Dive Report

**Generated:** 2026-03-16  
**Codebase Location:** `/Users/manavmht/Documents/HOS`

---

## Executive Summary

Repwise is a full-stack fitness/hypertrophy training application with an adaptive nutrition engine, intelligent workout tracking, and comprehensive body composition analytics. It's a feature-rich product targeting serious lifters who want data-driven training and nutrition guidance.

| Dimension | Details |
|-----------|---------|
| **Frontend** | React Native 0.83.2 + Expo SDK 55 + TypeScript |
| **Backend** | FastAPI (Python 3.12) + SQLAlchemy 2.0 async |
| **Database** | PostgreSQL (prod) / SQLite (dev) |
| **Deployment** | Railway (backend) + EAS Build (mobile) |
| **Scale** | 504 TS files (81K lines) + 272 Python files (58K lines) + 228 test files |
| **Architecture** | Full-stack monorepo — `app/` (frontend) + `src/` (backend) |

---

## 1. Architecture Overview

### Repository Structure

```
HOS/
├── app/                    # React Native / Expo frontend
│   ├── screens/            # 35 screens across 18 domains
│   ├── components/         # 130+ components in 19 groups
│   ├── hooks/              # 20 custom hooks
│   ├── store/              # 6 Zustand stores
│   ├── services/           # API client (axios + JWT interceptor)
│   ├── utils/              # 70+ utility modules
│   ├── theme/              # Design token system (dark/light)
│   ├── types/              # TypeScript type definitions
│   ├── navigation/         # React Navigation config
│   ├── __tests__/          # 133 Jest + fast-check test files
│   └── e2e/                # 17 Playwright E2E specs
├── src/                    # FastAPI backend
│   ├── modules/            # 32 feature modules
│   ├── middleware/          # Auth, rate limiting, freemium gate, audit
│   ├── config/             # Database, settings
│   ├── shared/             # Base model, soft delete, audit, storage
│   ├── services/           # Push notifications
│   └── main.py             # App entry point (30+ routers)
├── tests/                  # 95 pytest + Hypothesis test files
├── alembic/                # 30+ database migrations
├── .github/workflows/      # CI/CD (6 backend jobs + mobile build)
├── Dockerfile              # Python 3.12-slim backend container
├── railway.toml            # Railway deployment config
└── dev.sh                  # Local dev startup script
```

### Design Principles

- **Modular domains:** Each backend feature is self-contained (models → schemas → service → router)
- **Pure business logic:** Core algorithms (e1RM, fatigue, adaptive, WNS) are pure functions with zero I/O
- **Soft deletes everywhere:** Records are never physically deleted (`SoftDeleteMixin`)
- **Audit trail:** All state-changing operations logged via `AuditLogMixin`
- **JSONB for extensibility:** Exercises, sets, micro-nutrients stored as JSONB for schema evolution without migrations

---

## 2. Tech Stack

### Frontend

| Category | Technology |
|----------|-----------|
| Framework | React Native 0.83.2 + Expo SDK 55 |
| Language | TypeScript (React 19.2) |
| State | Zustand v4.5 (6 stores) |
| Navigation | React Navigation v6 (bottom tabs + stacks) |
| Animations | react-native-reanimated 4.2.1 |
| Charts | victory-native v41 |
| Bottom Sheets | @gorhom/bottom-sheet v5 |
| HTTP | axios v1.6 |
| Auth | expo-apple-authentication, @react-native-google-signin |
| Analytics | posthog-react-native v3 |
| Error Tracking | @sentry/react-native v7 |
| Testing | Jest 29.7 + fast-check + Playwright |

### Backend

| Category | Technology |
|----------|-----------|
| Framework | FastAPI (Python 3.12) |
| ORM | SQLAlchemy 2.0 (async) |
| Validation | Pydantic v2 |
| Migrations | Alembic |
| Auth | python-jose (JWT), passlib (bcrypt) |
| OAuth | google-auth, PyJWT (Apple JWKS) |
| Payments | stripe, razorpay |
| Email | boto3 (AWS SES) |
| Storage | boto3 (Cloudflare R2) |
| Error Tracking | sentry-sdk |
| Testing | pytest + Hypothesis (property-based) |
| Linting | ruff + mypy |

---

## 3. Frontend Deep Dive

### Navigation Architecture

```
App.tsx
├── AuthNavigator (unauthenticated)
│   ├── Login
│   ├── Register
│   ├── ForgotPassword
│   ├── ResetPassword
│   └── EmailVerification
├── OnboardingWizard (first-time, 10 steps)
│   ├── IntentStep → BodyBasicsStep → BodyCompositionStep
│   ├── LifestyleStep → TDEERevealStep → GoalStep
│   └── DietStyleStep → FoodDNAStep → BodyMeasurementsStep → SummaryStep
└── BottomTabNavigator (authenticated)
    ├── Home → DashboardStack
    │   ├── DashboardHome, ExercisePicker, ActiveWorkout
    │   ├── WorkoutSummary, WeeklyReport, ArticleDetail, Learn
    ├── Log → LogsStack
    │   ├── LogsHome, ExercisePicker, ActiveWorkout
    │   ├── WorkoutSummary, SessionDetail
    ├── Analytics → AnalyticsStack
    │   ├── AnalyticsHome (tabs: nutrition/training/body/volume)
    │   ├── NutritionReport, MicronutrientDashboard
    │   ├── WeeklyReport, MonthlyReport, ExerciseHistory
    └── Profile → ProfileStack
        ├── ProfileHome, Learn, ArticleDetail, Coaching
        ├── Community, FounderStory, ProgressPhotos
        ├── Measurements, MealPlan, ShoppingList, PrepSunday
        ├── NotificationSettings, DataExport, PRHistory
        └── YearInReview
```

### State Management (6 Zustand Stores)

| Store | Purpose | Persisted? |
|-------|---------|-----------|
| `useStore` | Auth, profile, subscription, onboarding, units, RPE mode, adaptive targets, coaching mode, goals, metrics | No |
| `useActiveWorkoutStore` | Active workout exercises, sets, supersets, rest timer, overload suggestions, volume | Yes (crash recovery) |
| `useThemeStore` | Dark/light/system theme | Yes |
| `useTooltipStore` | One-time tooltip dismissals | Yes |
| `useWorkoutPreferencesStore` | RPE column visibility, preferences | Yes |
| `useOnboardingStore` | 10-step onboarding wizard data | Yes |

### Component Library (130+ components, 19 groups)

Key component groups:
- **training/ (28):** Rest timers (5 variants), RPE picker, plate calculator, PR celebration, overload badges, set rows, exercise detail sheets, warm-up suggestions
- **dashboard/ (17):** Date scroller, macro rings, meal slot diary, fatigue alerts, readiness gauge, streak indicator, weekly training calendar
- **nutrition/ (11):** Barcode scanner, food search, meal builder, serving selector, water tracker, macro budget pills
- **common/ (17):** Button, Card, ErrorBoundary, Skeleton, SwipeableRow, Tooltip, ProgressBar, ProgressRing
- **analytics/ (11):** Body heat map, fatigue breakdown, strength standards, expenditure trends
- **photos/ (6):** Guided camera, pose overlay, aligned comparison, timeline slider
- **premium/ (7):** Upgrade modal, trial countdown, premium badges

### Custom Hooks (20)

Notable hooks:
- `useDashboardData` — Fetches all dashboard data with date-based debouncing
- `useFeatureFlag` — Server-side feature flag check
- `useHealthData` — Platform-branched health data (HRV, HR, sleep)
- `usePressAnimation` — Spring-based press animation (respects reduce-motion)
- `useWNSVolume` — Weekly volume data with WNS engine
- `useReduceMotion` — OS accessibility setting wrapper
- `useStaggeredEntrance` — Staggered fade-in for list items

### Design Token System

- **Philosophy:** "Bloomberg Terminal × modern fintech × elite training brand"
- **Colors:** Semantic groups (bg, border, text, accent, semantic, premium, macro, heatmap, chart)
- **Typography:** Inter (sans), SF Pro Display (iOS), JetBrains Mono (mono)
- **Spacing:** 8px grid (0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- **Motion:** Spring configs (gentle, snappy, bouncy) with reduce-motion support
- **Themes:** Dark-first with WCAG AA compliant light mode
- **No external UI library** — everything custom-built

---

## 4. Backend Deep Dive

### 32 Feature Modules

```
src/modules/
├── account/          # Account management, deletion
├── achievements/     # Gamification, streaks, challenges
├── adaptive/         # TDEE engine, coaching modes, macro computation
├── analytics/        # Training analytics aggregation
├── auth/             # JWT, OAuth (Google/Apple), email verification
├── challenges/       # Weekly micro-challenges
├── coaching/         # 3 coaching modes, coach profiles
├── community/        # Community features
├── content/          # Educational articles, modules
├── dashboard/        # Dashboard data aggregation
├── dietary_analysis/ # Dietary gap analysis
├── export/           # GDPR data export (JSON/CSV/PDF)
├── feature_flags/    # Server-side feature flags
├── food_database/    # USDA, Open Food Facts, barcode scanning
├── founder/          # Founder story content
├── health_reports/   # Health marker tracking
├── meal_plans/       # Meal plan generation, scaling, shopping lists
├── meals/            # Meal logging, favorites
├── measurements/     # Body measurements, Navy BF calculator
├── notifications/    # Push notifications, preferences
├── nutrition/        # Macro/micro tracking, daily targets
├── onboarding/       # Onboarding data processing
├── payments/         # Stripe + Razorpay, subscriptions, trials
├── periodization/    # Training blocks, phases
├── progress_photos/  # Photo metadata, comparisons
├── readiness/        # Recovery check-ins, readiness scoring
├── recomp/           # Body recomposition tracking
├── reports/          # Weekly/monthly/yearly reports
├── sharing/          # Social sharing, referrals
├── training/         # Session logging, templates, PRs, volume, fatigue
└── user/             # User profile, preferences
```

### Database Schema (40+ tables)

**Core Training:** TrainingSession (JSONB exercises+sets), WorkoutTemplate, CustomExercise, PersonalRecord  
**User:** User, UserProfile, UserMetric, BodyweightLog, UserGoal  
**Nutrition:** NutritionEntry, FoodItem, RecipeIngredient, UserFoodFrequency, BarcodeCache, CustomMeal, MealFavorite  
**Adaptive:** AdaptiveSnapshot, CoachingSuggestion, DailyTargetOverride  
**Payments:** Subscription, PaymentTransaction, WebhookEventLog  
**Volume:** UserVolumeLandmark  
**Achievements:** UserAchievement, AchievementProgress, StreakFreeze, WeeklyChallenge  
**Readiness:** RecoveryCheckin, ReadinessScore  
**Body:** BodyMeasurement, MeasurementProgressPhoto, RecompMeasurement, ProgressPhoto  
**Content:** ContentModule, ContentArticle, ArticleVersion, ArticleFavorite  
**Coaching:** CoachProfile, CoachingRequest, CoachingSession  
**Notifications:** DeviceToken, NotificationPreference, NotificationLog  
**Other:** ShareEvent, Referral, ExportRequest, HealthReport, AuditLog

### Authentication & Authorization

| Layer | Implementation |
|-------|---------------|
| JWT | HS256, 15min access + 7day refresh, JTI blacklisting |
| Email/Password | bcrypt hashing |
| Google OAuth | ID token verification via google-auth |
| Apple Sign-In | JWKS RS256 verification via PyJWT |
| Email Verification | 6-digit OTP via AWS SES |
| Password Reset | 6-digit OTP via AWS SES |
| RBAC | user / premium / admin roles |
| Freemium Gate | Middleware checks subscription status |
| Rate Limiting | Login (5/15min), verification resend (3/15min) |

### Core Business Logic Engines

#### Adaptive Nutrition Engine
5-step pure computation:
1. **BMR** — Mifflin-St Jeor (or Katch-McArdle if body fat available)
2. **TDEE** — BMR × activity multiplier (5 levels)
3. **EMA-7 Smoothing** — Bodyweight trend with >2kg/day outlier filtering
4. **Adaptive Adjustment** — Caloric adjustment based on weight trend vs target (±300kcal clamp, 500kcal/kg discrepancy threshold)
5. **Macro Distribution** — 4 diet styles (balanced, high_protein, low_carb, keto), minimum 1200 cal floor

#### Volume Tracking (Dual Engine)
- **Legacy:** RPE-based effort multipliers (RPE≥8=1.0, 6-8=0.75, <6=0.5), effective sets per muscle group, MEV/MAV/MRV classification
- **WNS (Weekly Net Stimulus):** Stimulating reps per set based on RIR, diminishing returns curve (K=0.96), atrophy between sessions. User-customizable landmarks for 15 muscle groups

#### Progressive Overload Engine
- Analyzes 3-5 recent sessions per exercise
- RPE < 7 → increase weight (barbell +2.5kg, dumbbell/cable +1.0kg)
- RPE 7-9 → add 1 rep
- RPE > 9 → maintain current load

#### Fatigue Detection System
Multi-factor scoring (0-100):
- Regression component (35%) — e1RM decline detection
- Volume component (30%) — sets/MRV ratio
- Frequency component (20%) — sessions/5
- Nutrition component (15%) — compliance < 80%
- Score > 70 → deload suggestion

#### Other Engines
- **e1RM Calculator:** Epley, Brzycki, Lombardi formulas
- **PR Detection:** Historical best comparison per exercise + rep count
- **Strength Standards:** Bodyweight-ratio classification (beginner → elite)
- **Readiness Scoring:** Recovery check-ins + HRV + sleep → combined score

---

## 5. Payment System

| Feature | Details |
|---------|---------|
| Providers | Stripe (USD/global) + Razorpay (INR/India) |
| Pattern | Provider interface abstraction |
| Lifecycle | free → pending → active → past_due → cancelled |
| Webhooks | HMAC-SHA256 verification, idempotent processing (WebhookEventLog) |
| Trial | 7-day free trial (one-time use) |
| Winback | Re-engagement service for churned users |

### Freemium Model

**Free tier:** Training logging, basic nutrition, dashboard, analytics, learn  
**Premium tier:** Coaching, health reports, dietary gap analysis, micronutrients, advanced analytics, meal plans, progress photos

---

## 6. Third-Party Integrations

| Service | Purpose |
|---------|---------|
| AWS SES | Transactional emails (verification, password reset) |
| Cloudflare R2 | Object storage (photos, exports) via S3-compatible API |
| Stripe | Global payment processing |
| Razorpay | India market payment processing |
| USDA FoodData Central | 300K+ food database API |
| Open Food Facts | Barcode scanning API |
| Google OAuth | Social sign-in |
| Apple Sign-In | Social sign-in (JWKS) |
| Expo Push API | Cross-platform push notifications |
| Sentry | Error tracking + performance monitoring |
| PostHog | Product analytics |
| Railway | Backend deployment platform |
| EAS Build | Mobile app builds (iOS + Android) |

---

## 7. CI/CD Pipeline

### Backend (GitHub Actions — 6 jobs)
1. **Ruff lint** — Code style enforcement
2. **Mypy type check** — Static type analysis
3. **Unit tests** — pytest suite
4. **Property tests** — Hypothesis-based property testing
5. **Coverage check** — >80% threshold
6. **Migration round-trip** — Alembic upgrade/downgrade verification

### Frontend
- **Mobile build** — Triggers on `app/` changes to `main`, uses EAS Build for staging/production profiles
- **E2E tests** — 17 Playwright specs for web

---

## 8. Testing Strategy

| Layer | Framework | Count | Approach |
|-------|-----------|-------|----------|
| Backend unit | pytest | ~978 tests | Standard unit + integration |
| Backend property | Hypothesis | Included above | Property-based testing for algorithms |
| Frontend unit | Jest | ~1488 tests | Component + utility testing |
| Frontend property | fast-check | Included above | Property-based for pure logic |
| E2E | Playwright | 17 specs | Web-based end-to-end |

---

## 9. Key Observations & Recommendations

### Strengths
1. **Pure function architecture** — Core algorithms are fully testable with zero I/O dependencies
2. **Comprehensive testing** — Property-based testing on both sides (Hypothesis + fast-check), >80% coverage enforced
3. **Dual payment provider** — Clean abstraction supporting global + India markets
4. **Design token system** — Professional-grade with WCAG AA compliance and reduce-motion accessibility
5. **Soft deletes + audit trail** — Enterprise-grade data safety patterns
6. **Feature flags** — Server-side gating for progressive rollouts
7. **Crash recovery** — Active workout persisted to AsyncStorage

### Areas for Improvement
1. **No offline sync** — Pure client-server architecture; active workout is the only local persistence
2. **Type drift risk** — Frontend TypeScript types manually mirror backend Pydantic schemas (no auto-generation)
3. **Dual volume engines** — Legacy effective-sets and WNS coexist; consider deprecating legacy
4. **Limited rate limiting** — Only login and verification endpoints are rate-limited; no general API rate limiting
5. **Progress photos on-device only** — Photo files stored locally via expo-file-system, no cross-device sync
6. **SQLite dev divergence** — JSONB→JSON patching in dev mode adds complexity; consider using Alembic for dev too

---

## 10. Codebase Metrics

| Metric | Value |
|--------|-------|
| Frontend files | 504 TypeScript/TSX |
| Frontend lines | 81,525 |
| Backend files | 272 Python |
| Backend lines | 58,239 |
| Test files | 228 total |
| Backend modules | 32 |
| Screen domains | 18 |
| Total screens | 35 |
| Components | 130+ |
| Custom hooks | 20 |
| Utility modules | 70+ |
| Database tables | 40+ |
| API route groups | 30+ |
| Alembic migrations | 30+ |

---

*Report generated by deep dive analysis of the Repwise codebase.*
