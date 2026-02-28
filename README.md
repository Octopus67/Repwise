# Repwise

A science-based fitness platform combining adaptive nutrition tracking, intelligent training logging, and evidence-based coaching. Built for serious lifters who want data-driven results.

---

## What This App Does

Repwise is a full-stack mobile + web app (React Native / Expo frontend, FastAPI backend) that helps users:

- Track training sessions with progressive overload suggestions
- Log nutrition with adaptive TDEE targets that adjust weekly
- Monitor body composition trends using EMA smoothing
- Get AI-driven coaching recommendations based on actual data
- Access evidence-based hypertrophy content

---

## Architecture

```
HOS/
├── app/                    # React Native (Expo SDK 53) frontend
│   ├── screens/            # Screen components by feature
│   ├── components/         # Reusable UI components
│   ├── store/              # Zustand state management
│   ├── services/api.ts     # Axios client with JWT refresh
│   ├── navigation/         # Bottom tab + stack navigation
│   └── __tests__/          # Jest + fast-check property tests
│
├── src/                    # FastAPI backend
│   ├── modules/            # Feature modules (auth, training, nutrition, etc.)
│   ├── middleware/         # Auth, rate limiting, freemium gate, audit log
│   └── config/             # Database, settings
│
├── tests/                  # Backend pytest + Hypothesis property tests
├── alembic/                # Database migrations
└── dev.db                  # SQLite dev database
```

**Tech stack:**
- Frontend: React Native + Expo SDK 53, TypeScript, Zustand, React Navigation, Reanimated 4
- Backend: FastAPI, SQLAlchemy (async), SQLite (dev) / PostgreSQL (prod), Alembic
- Auth: JWT (access + refresh tokens), bcrypt
- Payments: Stripe (global) + Razorpay (India)
- Tests: Jest + fast-check (frontend), pytest + Hypothesis (backend)

---

## Local Development

### Prerequisites
- Python 3.9+ with `.venv` virtualenv
- Node 18+ with yarn/npm
- Expo CLI

### Start both servers (run in separate terminals)

**Backend** — auto-reloads on any Python file change:
```bash
lsof -ti:8000 | xargs kill -9 2>/dev/null
.venv/bin/uvicorn src.main:app --reload --port 8000 --host 0.0.0.0
```

**Frontend** — hot reloads on any JS/TS file change:
```bash
lsof -ti:8081 | xargs kill -9 2>/dev/null
cd app && npx expo start --port 8081
```

Open `http://localhost:8081` in browser, or scan the QR code with Expo Go on your phone.

### Environment
The `.env` file at the root configures the backend:
```
DATABASE_URL=sqlite+aiosqlite:///./dev.db
JWT_SECRET=local-dev-secret-change-in-prod
DEBUG=true
USDA_API_KEY=DEMO_KEY
```

The frontend reads `EXPO_PUBLIC_API_URL` from `app/eas.json` — defaults to `http://localhost:8000` in dev.

### Running tests

**Backend:**
```bash
DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v
```

**Frontend:**
```bash
cd app && npx jest --passWithNoTests
```

---

## Feature Map

### Authentication
- Email/password registration and login
- JWT access tokens (15 min) + refresh tokens (7 days)
- Secure token storage (SecureStore on mobile, localStorage on web)
- Forgot password / reset password flow
- Rate limiting on login attempts

### Onboarding (10-step wizard)
1. Intent — cutting / bulking / maintaining / recomposition
2. Body basics — sex, birth year
3. Body measurements — height, weight
4. Body composition — body fat % (optional)
5. Lifestyle — activity level, exercise sessions/week, exercise types
6. TDEE reveal — calculated maintenance calories
7. Goal — target weight, rate of change
8. Diet style — standard / keto / vegan / etc.
9. Food DNA — cuisine preferences, allergies, dietary restrictions
10. Summary — review and confirm

After onboarding, the adaptive engine computes personalized macro targets.

### Dashboard (Home tab)
- Date scroller — scroll back to view/edit any past day
- Macro rings — calories, protein, carbs, fat vs targets
- Budget bar — visual calorie/macro budget remaining
- Meal slot diary — breakfast / lunch / dinner / snacks with per-slot logging
- Quick log buttons — Log Food, Build Meal, Training, Bodyweight
- Trend weight — EMA-smoothed bodyweight with weekly change
- Readiness gauge — recovery score from HRV/sleep/soreness
- Weekly check-in card — adaptive target suggestions (accept/modify/dismiss)
- Fatigue alert card — muscle group fatigue warnings
- Featured articles — curated content from the Learn library
- Weekly Intelligence Report link

### Training (Log tab)
- Active workout screen — full-screen logging with exercise cards
  - Previous performance shown inline for each exercise
  - Set completion with haptic feedback + PR detection
  - Rest timer bar (floating, auto-starts after each set)
  - Progressive overload suggestions per exercise
  - Superset grouping
  - Warm-up set generation
  - Exercise swap (same muscle group)
  - Per-exercise notes
  - Copy from date / copy last workout
- Exercise picker — browse by muscle group or search, long-press for detail sheet
- Custom exercises — create your own
- Templates — save workouts as templates, apply system templates
- Session history — view past sessions with full set/rep/weight detail
- Periodization calendar — training blocks with phase types (accumulation / intensification / deload / peak)

### Nutrition (accessed via Dashboard)
- Log Nutrition modal with 3 tabs:
  - Quick Log — food search (USDA + Open Food Facts + community), barcode scanner, favorites, manual entry
  - Meal Plans — saved custom meal plans, create new plans
  - Recipes — user-created recipes with ingredient scaling
- Food search ranking: exact match → starts-with → contains, then by name length
- Barcode scanner (mobile only) — instant food lookup via camera
- Water tracking — glasses logged per day
- Micronutrient tracking — 27 nutrients including vitamins, minerals, fibre
- Quick Add — calories-only fast entry with optional macros
- Copy meals — copy yesterday's meals to today

### Analytics (Analytics tab)
- Nutrition tab: calorie trend, protein trend, weekly summary, target vs actual, dietary gaps (premium)
- Training tab: volume trend, muscle volume heat map, fatigue overlay, strength progression, e1RM trend, strength standards, leaderboard
- Body tab: periodization calendar, readiness trend, bodyweight trend with EMA, TDEE expenditure trend
- Time range selector: 7d / 14d / 30d / 90d
- Weekly Intelligence Report — full weekly breakdown of training + nutrition + body

### Profile (Profile tab)
- Edit plan panel — 2-step flow to update body stats + goals, recalculates targets
- Preferences — unit system (metric/imperial), coaching mode, timezone
- Goals section — goal type, target weight, rate of change
- Body stats — height, weight, body fat %, activity level with inline editing
- Achievements grid — PR badges, streaks, volume milestones, nutrition achievements
- Subscription status — free / premium, upgrade flow
- Feature navigation — Coaching, Community, Founder's Story, Health Reports, Learn, Progress Photos

### Coaching (Premium)
- Submit coaching requests with goals description
- View request status (pending / approved / rejected)
- View scheduled sessions
- Coaching modes: manual / coached / collaborative / recomp

### Learn
- Article library with categories: Hypertrophy, Nutrition, Programming, Recovery, Recomp, Supplements
- Search and filter by category
- Favorites — star articles, filter to favorites
- Article detail with scroll progress bar, YouTube embeds, inline charts
- Estimated read time

### Health Reports (Premium)
- Upload blood test reports
- Flagged marker analysis (low/high/normal)
- Nutrition correlation analysis — links deficiencies to dietary gaps

### Progress Photos
- Photo comparison side-by-side
- Timeline view

### Community
- Telegram community link
- Contact email

---

## Adaptive Engine

The core intelligence layer that drives personalized targets:

1. **TDEE calculation** — Mifflin-St Jeor BMR × activity multiplier + exercise activity
2. **Weekly check-in** — every 7 days with sufficient data, analyzes weight trend vs calorie intake
3. **Target adjustment** — suggests new calorie/macro targets based on actual vs expected weight change
4. **Coaching modes:**
   - `manual` — user sets their own targets, no suggestions
   - `coached` — engine adjusts automatically, shows results
   - `collaborative` — engine suggests, user accepts/modifies/dismisses
   - `recomp` — body recomposition mode with recomp score tracking

---

## Freemium Model

Free tier includes: training logging, basic nutrition tracking, dashboard, analytics, learn library.

Premium unlocks: coaching, health reports, dietary gap analysis, micronutrient tracking, advanced analytics.

Premium is gated via `src/middleware/freemium_gate.py`. The `isPremium()` selector in `app/store/index.ts` controls frontend gating.

---

## API Structure

All endpoints are under `/api/v1/`. Key modules:

| Module | Prefix | Description |
|--------|--------|-------------|
| auth | `/auth` | Register, login, refresh, logout, password reset |
| users | `/users` | Profile, metrics, goals, bodyweight history |
| nutrition | `/nutrition` | Entries CRUD |
| training | `/training` | Sessions, exercises, templates, analytics |
| adaptive | `/adaptive` | Snapshots, weekly check-in, suggestions |
| food | `/food` | Search, barcode lookup, recipes |
| meals | `/meals` | Favorites, custom meal plans |
| coaching | `/coaching` | Requests, sessions |
| content | `/content` | Articles, favorites |
| readiness | `/readiness` | Check-ins, scores, history |
| periodization | `/periodization` | Blocks, templates |
| achievements | `/achievements` | Grid, streak |
| reports | `/reports` | Weekly intelligence report |
| health-reports | `/health-reports` | Blood test analysis |
| payments | `/payments` | Stripe + Razorpay subscriptions |

Error responses follow a consistent shape:
```json
{ "status": 401, "code": "UNAUTHORIZED", "message": "Invalid email or password", "request_id": "..." }
```

---

## Data Models

Key relationships:
- `User` → has one `UserProfile`, many `UserMetrics`, one `UserGoals`
- `User` → many `TrainingSession` → many `TrainingExercise` → many `TrainingSet`
- `User` → many `NutritionEntry` (daily food logs)
- `User` → many `AdaptiveSnapshot` (weekly TDEE/target snapshots)
- `FoodItem` → can be a recipe (`is_recipe=True`) with `RecipeIngredient` rows
- `TrainingBlock` → many weeks of periodization planning

---

## Kiro Development Guidelines

When working on this codebase:

**Frontend patterns:**
- All screens live in `app/screens/<feature>/`
- Reusable components in `app/components/<category>/`
- State is managed in Zustand stores (`app/store/`)
- API calls go through `app/services/api.ts` (handles JWT refresh automatically)
- Use `useCallback` for all event handlers, `useEffect` deps must be complete
- Modals must have `onRequestClose` prop for Android back button
- `ErrorBanner` components must have `onDismiss` prop
- Submit buttons must be `disabled` during loading states
- State must reset when modals close (use `useEffect` on `visible`)

**Backend patterns:**
- Each feature is a module in `src/modules/<feature>/` with `router.py`, `service.py`, `models.py`, `schemas.py`
- Business logic lives in `service.py`, never in `router.py`
- All errors use custom `ApiError` subclasses from `src/shared/errors.py`
- Database access is async SQLAlchemy — always `await` queries
- Soft deletes via `deleted_at` timestamp, never hard delete user data
- `FoodDatabaseService.search()` uses FTS5 on SQLite with re-ranking: exact match → starts-with → contains → by name length

**Testing:**
- Backend: `pytest` + `Hypothesis` property tests in `tests/`
- Frontend: `Jest` + `fast-check` property tests in `app/__tests__/`
- Run backend tests: `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
- Run frontend tests: `cd app && npx jest --passWithNoTests`
- All 1488 frontend tests and ~978 backend tests should pass before merging

**Common pitfalls to avoid:**
- Don't declare `useCallback`/`useEffect` before the functions they depend on (temporal dead zone)
- Don't use `toISOString()` for date comparisons — use local date arithmetic to avoid timezone bugs
- Don't use `fc.date()` in fast-check without min/max bounds — generates invalid dates
- The `__DEV__` global must be defined in Jest environments that test React Native code
- Reanimated on web requires `react-native-reanimated` to be imported before any animated components (handled by `app/index.js`)
