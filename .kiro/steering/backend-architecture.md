---
inclusion: manual
---

# Backend Architecture

## Entry Point
`src/main.py` — Registers all routers, configures CORS, Sentry, exception handlers.

## API Modules (25 total)

All mounted at `/api/v1/<prefix>`:

| Module | Prefix | Purpose | Key Files |
|--------|--------|---------|-----------|
| auth | `/auth` | JWT auth, OAuth, password reset | register, login, refresh, forgot-password |
| user | `/users` | Profile, metrics, bodyweight, goals | profile CRUD, bodyweight history |
| nutrition | `/nutrition` | Food logging, entries CRUD | entries, batch, copy, micronutrient-dashboard |
| training | `/training` | Sessions, exercises, volume, analytics | sessions CRUD, exercises, templates, volume, fatigue |
| adaptive | `/adaptive` | Daily targets, adaptive macros | daily-targets, sync engine |
| food | `/food` | Food search, barcode lookup | search (FTS5), barcode (OFF→USDA fallback) |
| meals | `/meals` | Custom meals, favorites | CRUD, favorites |
| payments | `/payments` | Stripe + Razorpay subscriptions | checkout, webhook, subscription status |
| content | `/content` | Research articles, modules | articles CRUD, favorites, versioning |
| coaching | `/coaching` | Coach profiles, sessions | requests, suggestions |
| health | `/health` | Health marker reports | reports, reference ranges |
| dietary | `/dietary` | Dietary trend analysis, gaps | trends, gaps, recommendations |
| onboarding | `/onboarding` | User onboarding wizard | status, steps, completion |
| achievements | `/achievements` | Gamification, badges | progress, unlock evaluation |
| feature_flags | `/feature-flags` | Runtime feature toggles | check, CRUD (admin) |
| progress_photos | `/progress-photos` | Body progress photos | upload, gallery, comparison |
| periodization | `/periodization` | Training block planning | blocks, phases |
| readiness | `/readiness` | Daily readiness scoring | scores, checkins |
| reports | `/reports` | Weekly intelligence reports | generation, history |
| founder | `/founder` | Founder story content | content |
| community | `/community` | Community features | (placeholder) |
| account | `/account` | Account management | deletion, export |
| recomp | `/recomp` | Body recomposition tracking | measurements |
| meal_plans | `/meal-plans` | Meal planning | plans, items |
| notifications | `/notifications` | Push notifications | device tokens, preferences |

## Shared Infrastructure (`src/shared/`)

| File | Purpose |
|------|---------|
| `base_model.py` | SQLAlchemy Base with UUID primary key, created_at, updated_at |
| `soft_delete.py` | SoftDeleteMixin — adds deleted_at, not_deleted() filter |
| `audit.py` | AuditLogMixin — writes to audit_logs table on changes |
| `errors.py` | ApiError, NotFoundError, UnprocessableError, ForbiddenError |
| `pagination.py` | PaginatedResult, PaginationParams (limit max 500) |
| `types.py` | Enums: UserRole, AuthProvider, AuditAction |

## Middleware (`src/middleware/`)

| File | Purpose |
|------|---------|
| `authenticate.py` | `get_current_user` dependency — JWT validation |
| `freemium_gate.py` | `require_premium` dependency — checks subscription |
| `rate_limiter.py` | Rate limiting on auth endpoints |
| `structured_logging.py` | Request/response logging middleware |

## Database

- Models use JSONB for extensible fields (exercises, micro_nutrients, tags)
- All models inherit from `Base` (UUID pk, timestamps)
- Most models use `SoftDeleteMixin` (soft delete via deleted_at)
- Queries MUST use `Model.not_deleted(stmt)` to filter deleted records
- Dev: SQLite with JSONB→JSON patching in tests
- Prod: PostgreSQL with asyncpg

## Key Services

### WNS Volume Engine (`src/modules/training/`)
- `wns_engine.py` — Pure functions: stimulating_reps, diminishing_returns (K=0.96), atrophy
- `wns_volume_service.py` — DB-backed WNS calculation per muscle group
- `exercise_coefficients.py` — Direct (1.0) / fractional (0.5) muscle attribution
- `volume_service.py` — Legacy volume calculation (RPE-tier based)
- Feature flag `wns_engine` controls which engine is used (currently ON by default)
- Constants: MAX_STIM_REPS=5, DEFAULT_RIR=2.0 (RPE 8), DIMINISHING_K=0.96

### Fatigue Engine (`src/modules/training/`)
- `fatigue_engine.py` — Pure functions: e1RM regression, composite fatigue score
- `fatigue_service.py` — DB-backed fatigue analysis
- Components: regression (35%), volume (30%), frequency (20%), nutrition (15%)

### Micronutrient Dashboard (`src/modules/nutrition/`)
- `micro_dashboard_service.py` — Weekly aggregation, nutrient score (0-100), deficiency alerts
- 27 tracked nutrients with age/sex-specific RDA values
- Score=0 when no data logged; sodium/cholesterol inverted in scoring
- Endpoint: `GET /nutrition/micronutrient-dashboard`

### Weekly Intelligence Report (`src/modules/reports/`)
- Integrates WNS HU, nutrient score, compliance, weight-goal alignment
- Up to 5 actionable recommendations; compliance threshold ±10%

### Adaptive Engine (`src/modules/adaptive/`)
- Daily macro targets adjusted by training volume and body composition goals

### User/Profile (`src/modules/user/`)
- Bodyweight: upsert by date (no duplicates)
- display_name: min_length=1 enforced

### Nutrition (`src/modules/nutrition/`)
- `food_name` field on entries (optional, nullable)
- Pagination limit max 500; macro-calorie mismatch logged as warning
- Copy entries preserves source_meal_id and food_name
