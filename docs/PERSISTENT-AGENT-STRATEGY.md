# Persistent Development Agent Strategy for Repwise

## Problem Statement

**Current issue:** Each new agent session loses context, requiring:
- Re-discovering file locations
- Re-understanding architecture
- Re-learning patterns and conventions
- Wasted time searching for the right files

**Goal:** Create a persistent agent that maintains full codebase context across sessions.

---

## Strategy 1: Codebase Knowledge Base (Recommended)

### Overview
Create a structured knowledge base that the agent loads on startup, providing instant context about the entire application.

### Implementation

#### 1.1 Create Codebase Map
**File:** `.kiro/codebase-map.md`

```markdown
# Repwise Codebase Map

## Architecture Overview
- **Frontend:** React Native (Expo), TypeScript, Zustand state management
- **Backend:** FastAPI (Python), PostgreSQL, SQLAlchemy async
- **Auth:** JWT tokens, OAuth (Google/Apple), email verification
- **Payments:** Stripe + Razorpay, freemium model

## Key Entry Points

### Frontend
- **App Root:** `app/App.tsx` - Auth flow, session restoration, navigation
- **Navigation:** `app/navigation/BottomTabNavigator.tsx` - 4 tabs (Home, Log, Analytics, Profile)
- **State:** `app/store/index.ts` - Main Zustand store
- **API Client:** `app/services/api.ts` - Axios with token interceptor

### Backend
- **Main:** `src/main.py` - FastAPI app, middleware, router registration
- **Database:** `src/config/database.py` - Async SQLAlchemy engine
- **Settings:** `src/config/settings.py` - Environment configuration

## Module Structure

### Frontend Modules
```
app/
├── screens/          # Screen components (one per route)
│   ├── auth/         # Login, Register, EmailVerification, ForgotPassword, ResetPassword
│   ├── dashboard/    # DashboardScreen (refactored with 3 hooks)
│   ├── logs/         # LogsScreen (nutrition + training history)
│   ├── analytics/    # AnalyticsScreen (4 tabs: nutrition, training, body, volume)
│   ├── profile/      # ProfileScreen, ProgressPhotos, DataExport
│   ├── training/     # ActiveWorkoutScreen, SessionDetailScreen, WorkoutSummary
│   ├── nutrition/    # RecipeBuilderScreen, MicronutrientDashboard
│   └── onboarding/   # OnboardingWizard (11 steps)
├── components/       # Reusable components
│   ├── common/       # Button, Card, Modal, Icon, ErrorBoundary, etc.
│   ├── training/     # ExerciseCard, SetRow, RestTimer, RPEPicker, etc.
│   ├── nutrition/    # FoodSearchPanel, MealBuilder, BarcodeScanner, etc.
│   ├── dashboard/    # QuickActions, MacroRings, MealSlots, etc.
│   └── profile/      # EditPlanPanel, PreferencesSection, etc.
├── hooks/            # Custom React hooks
│   ├── useDashboardData.ts      # Dashboard data fetching (refactored)
│   ├── useDashboardModals.ts    # Modal state management
│   ├── useRecalculate.ts        # Debounced profile recalculation
│   ├── useRecoveryScore.ts      # Combined fatigue/readiness
│   └── useThemeColors.ts        # Theme system
├── store/            # Zustand stores
│   ├── index.ts                 # Main store (auth, profile, preferences)
│   ├── activeWorkoutSlice.ts    # Active workout state (persisted)
│   └── onboardingSlice.ts       # Onboarding wizard state (persisted)
├── utils/            # Pure utility functions
│   ├── onboardingCalculations.ts  # BMR, TDEE, macro splits
│   ├── wnsCalculator.ts           # WNS algorithm (frontend mirror)
│   ├── warmUpGenerator.ts         # Warm-up set generation
│   └── unitConversion.ts          # kg↔lbs, cm↔ft/in
└── types/            # TypeScript interfaces
    ├── training.ts   # ActiveSet, ActiveExercise, WorkoutTemplate
    └── nutrition.ts  # FoodItem, Recipe, MealPlan
```

### Backend Modules
```
src/
├── modules/          # Domain modules (one per feature)
│   ├── auth/         # Registration, login, OAuth, password reset
│   ├── user/         # Profile, metrics, goals, bodyweight logs
│   ├── nutrition/    # Nutrition entries, meal plans, recipes
│   ├── training/     # Sessions, exercises, templates, PRs, analytics
│   ├── adaptive/     # TDEE calculation, macro targets, coaching
│   ├── readiness/    # Recovery scoring, combined fatigue/readiness
│   ├── food_database/  # Food items, search (FTS5), barcode lookup
│   ├── dashboard/    # Consolidated summary endpoint
│   └── payments/     # Stripe, Razorpay, subscriptions, trials
├── middleware/       # Request/response middleware
│   ├── authenticate.py      # JWT validation, token blacklist
│   ├── https_redirect.py    # HTTPS enforcement (production)
│   └── rate_limiter.py      # In-memory rate limiting
├── services/         # External service integrations
│   ├── email_service.py     # AWS SES (verification, password reset)
│   └── push_notifications.py  # Expo Push API
└── shared/           # Shared utilities
    ├── base_model.py   # SQLAlchemy Base with UUID PK
    ├── errors.py       # Custom exception hierarchy
    └── types.py        # Enums (GoalType, ActivityLevel, etc.)
```

## Key Patterns

### Frontend Patterns
1. **Themed Styles:** `getThemedStyles(c: ThemeColors)` - Pass `c` param, don't call `getThemeColors()` inside
2. **State Management:** Zustand with persistence (AsyncStorage)
3. **API Calls:** Always use `api.get/post/put/delete` with AbortController for cleanup
4. **Hooks:** Extract complex logic into custom hooks (useDashboardData pattern)
5. **Components:** Pure presentational components, logic in hooks/utils

### Backend Patterns
1. **Module Structure:** `router.py` → `service.py` → `models.py` + `schemas.py`
2. **Pure Engines:** Separate pure functions (e.g., `wns_engine.py`) from async services
3. **Error Handling:** Custom `ApiError` hierarchy, global exception handlers
4. **Feature Flags:** Gate new features, check with `FeatureFlagService`
5. **Soft Delete:** Use `SoftDeleteMixin`, filter with `.not_deleted()`

## Common Tasks

### Adding a New Feature
1. Backend: Create migration → model → schemas → service → router → tests
2. Frontend: Create types → API calls → hooks → components → screens
3. Wire: Add to navigation, update store if needed
4. Test: Unit tests (pure logic) + integration tests (API) + e2e tests (flow)

### Fixing a Bug
1. Identify: Which module? Frontend or backend?
2. Locate: Use module map above to find relevant files
3. Fix: Make minimal change, add test
4. Verify: TypeScript/Python compile, tests pass, manual test

### Refactoring
1. Extract: Move logic to hooks/utils (frontend) or pure functions (backend)
2. Test: Ensure existing tests still pass
3. Audit: Independent review for regressions

## Recent Major Changes (Context for Next Session)

### Bug Fixes (87 total)
- Security: OTP crypto-secure, token blacklisting, OAuth linking, HTTPS
- Performance: PR detection, previous performance, FTS5 auto-sync, dashboard endpoint
- UX: Rest timer auto-start, theme switching (180+ files), RPE picker, notes persist

### Features (6 total)
- DashboardScreen refactor (999 → 142 LOC)
- AddNutritionModal decomposition (2,002 → 350 LOC)
- Barcode scanner integration
- Food search ML ranking
- Warm-up generation (predictive)
- Fatigue/readiness integration

### Known Issues (Acceptable)
- Dashboard frontend doesn't use consolidated endpoint yet (deferred)
- Rate limiter in-memory (needs Redis for multi-worker prod)
- Photo-based food logging not implemented (AI integration required)

## File Locations Quick Reference

### Most Frequently Modified
- `app/screens/training/ActiveWorkoutScreen.tsx` - Main workout logging
- `app/components/training/SetRowPremium.tsx` - Set input row
- `app/screens/dashboard/DashboardScreen.tsx` - Dashboard (refactored)
- `app/screens/onboarding/OnboardingWizard.tsx` - Onboarding flow
- `src/modules/auth/service.py` - Auth logic
- `src/modules/training/service.py` - Training logic
- `src/modules/adaptive/engine.py` - TDEE/macro calculation

### Configuration
- `.env` - Environment variables (not in git)
- `src/config/settings.py` - Settings class
- `app/theme/tokens.ts` - Design tokens
- `app/navigation/BottomTabNavigator.tsx` - Route definitions

### Testing
- `app/__tests__/` - Frontend tests (Jest)
- `tests/` - Backend tests (pytest)
- `scripts/generate_test_data.py` - Generate 90 days of test data

## Database Schema

### Key Tables
- `users` - Auth, email verification, trial status, metadata_ (OAuth links)
- `user_profiles` - Display name, preferences (JSONB)
- `user_metrics` - Height, weight, body fat, activity level (append-only)
- `user_goals` - Goal type, target weight, rate (upsert)
- `bodyweight_logs` - Daily weight entries (recorded_date)
- `nutrition_entries` - Meal logging (entry_date, macros, micro_nutrients JSONB)
- `training_sessions` - Workout sessions (exercises JSONB array)
- `food_items` - Food database (FTS5 indexed, barcode)
- `user_food_frequency` - Search ranking (log_count, last_logged_at)
- `workout_templates` - User and system templates
- `custom_exercises` - User-created exercises
- `token_blacklist` - Invalidated JWT tokens (JTI, expires_at)

### Migrations
- Location: `src/database/migrations/versions/`
- Tool: Alembic
- Latest: `add_user_metadata.py`, `fts5_auto_sync.py`, `t1a2b3c4d5e6_create_user_food_frequency_table.py`

## API Endpoints

### Auth
- POST /auth/register - Email/password registration
- POST /auth/login - Email/password login
- POST /auth/oauth/{provider} - Google/Apple OAuth
- POST /auth/refresh - Token refresh (blacklists old refresh token)
- POST /auth/logout - Blacklist both tokens
- POST /auth/verify-email - 6-digit OTP verification
- POST /auth/resend-verification - Resend OTP
- POST /auth/resend-verification-email - Unauthenticated resend (for locked-out users)
- POST /auth/forgot-password - Request password reset
- POST /auth/reset-password - Reset with OTP

### Dashboard
- GET /dashboard/summary - Consolidated endpoint (nutrition, training, bodyweight, streak)

### Nutrition
- GET /nutrition/entries - List entries (date range filter)
- POST /nutrition/entries - Create entry (triggers frequency tracking)
- GET /food/search - Search foods (FTS5, frequency ranking if authenticated)
- GET /food/barcode/{barcode} - Barcode lookup (cache → OFF → USDA)

### Training
- GET /training/sessions - List sessions (pagination, date filter)
- POST /training/sessions - Create session (detects PRs, triggers achievements)
- GET /training/previous-performance - Last performance for exercise
- GET /training/exercises/batch-overload-suggestions - Progressive overload suggestions

### Adaptive
- GET /adaptive/snapshots - Latest adaptive snapshot (TDEE, macros)
- POST /users/recalculate - Recalculate targets (debounced 500ms frontend)
- GET /adaptive/daily-targets - Date-specific targets (baseline used for flat targets)

### Readiness
- GET /readiness/combined - Combined fatigue + readiness score (feature flag: combined_readiness)

## Feature Flags

### Active Flags
- `food_search_ranking` - Frequency-based search (disabled by default)
- `combined_readiness` - Combined recovery score (disabled by default)
- `predictive_warmup` - Warm-up from history (disabled by default)
- `camera_barcode_scanner` - Barcode scanning (disabled by default)
- `volume_landmarks` - WNS volume tracking (enabled)
- `social_sharing` - Share workout cards (enabled)
- `wns_engine` - WNS vs legacy volume (enabled)

### Rollout Order
1. `food_search_ranking` (lowest risk)
2. `predictive_warmup`
3. `combined_readiness` (most visible)

## Development Workflow

### Starting Development
1. Backend: `cd /Users/manavmht/Documents/HOS && source .venv/bin/activate && uvicorn src.main:app --reload --port 8000`
2. Frontend: `cd /Users/manavmht/Documents/HOS/app && npm start`
3. Database: SQLite (`dev.db`) auto-creates on startup

### Making Changes
1. **Find files:** Use this map to locate relevant modules
2. **Make changes:** Follow patterns documented here
3. **Test:** `npx tsc --noEmit` (frontend), `pytest tests/` (backend)
4. **Commit:** Descriptive message with context

### Common Commands
```bash
# TypeScript check
cd app && npx tsc --noEmit

# Run frontend tests
cd app && npm test

# Run backend tests
pytest tests/ -x

# Generate test data
PYTHONPATH=. python scripts/generate_test_data.py --email EMAIL --days 90

# Apply migrations
alembic upgrade head

# Create migration
alembic revision -m "description"
```

---

## Strategy 2: Context Files System

### Create Context Files for Each Module

**Example:** `.kiro/context/training-module.md`

```markdown
# Training Module Context

## Purpose
Handles workout logging, session history, exercise database, PR detection, volume tracking, and training analytics.

## Key Files
- `src/modules/training/service.py` - TrainingService (CRUD, PR detection)
- `src/modules/training/pr_detector.py` - PR detection algorithm
- `src/modules/training/wns_engine.py` - WNS volume calculation
- `app/screens/training/ActiveWorkoutScreen.tsx` - Main workout logging UI
- `app/components/training/SetRowPremium.tsx` - Set input row
- `app/store/activeWorkoutSlice.ts` - Workout state (persisted for crash recovery)

## Recent Changes
- Rest timer now auto-starts after set completion
- RPE picker integrated (tap-to-select, range 2-10)
- Plate calculator accessible via long-press
- Exercise notes persist with debounce
- Imperial unit conversion fixed

## Common Tasks
- Add exercise: Update `exercises.py` static data
- Modify set validation: `setCompletionLogic.ts`
- Change PR detection: `pr_detector.py`
- Adjust volume calculation: `wns_engine.py` + `wnsCalculator.ts` (keep in sync!)

## Gotchas
- WNS engine exists in BOTH Python and TypeScript - must stay in sync
- ActiveWorkoutScreen is thin orchestrator - logic in store/utils
- Set types: normal, warm-up, drop-set, amrap
- Always pass unitSystem to finishWorkout() for proper conversion
```

### Create Context Files for:
1. `training-module.md`
2. `nutrition-module.md`
3. `auth-module.md`
4. `dashboard-module.md`
5. `adaptive-engine.md`
6. `onboarding-flow.md`

---

## Strategy 3: Agent Initialization Script

### Create `.kiro/agent-init.md`

```markdown
# Agent Initialization - Load This First

## Quick Context
You are working on **Repwise** (Hypertrophy OS) - a fitness tracking app.

**Last session:** 2026-03-10
**Status:** Production-ready, 87 bugs fixed, 6 features implemented
**Commit:** d440329 (pushed to main)

## Load These Files Immediately
1. `.kiro/codebase-map.md` - Full architecture overview
2. `.kiro/context/recent-changes.md` - What changed in last session
3. `docs/COMPLETE-APP-ANALYSIS.md` - Comprehensive analysis report
4. `tasks/todo.md` - Current task tracker

## Current State
- **TypeScript:** 0 errors
- **Tests:** 3,187 passing
- **Database:** SQLite (dev.db) with 90 days of test data
- **Backend:** Running on localhost:8000
- **Frontend:** Running on localhost:8081

## Active Development Areas
- Onboarding UX (recently redesigned Steps 7, 8, 9)
- Workout logging (RPE picker, rest timer, notes)
- Analytics (micronutrient dashboard, weekly summary)

## Known Issues (None Blocking)
- Dashboard frontend doesn't use consolidated endpoint (deferred)
- Rate limiter needs Redis for multi-worker (before prod scale)

## Next Steps
- Monitor analytics with real data
- Test all flows end-to-end
- Prepare for production deployment
```

---

## Strategy 4: Automated Context Updates

### Create Git Hook to Update Context

**File:** `.git/hooks/post-commit`

```bash
#!/bin/bash
# Auto-update recent-changes.md after each commit

COMMIT_MSG=$(git log -1 --pretty=%B)
COMMIT_HASH=$(git log -1 --pretty=%h)
DATE=$(date +%Y-%m-%d)

cat >> .kiro/context/recent-changes.md <<EOF

## $DATE - Commit $COMMIT_HASH
$COMMIT_MSG

EOF

echo "✅ Updated .kiro/context/recent-changes.md"
```

This automatically logs every change for the next agent session.

---

## Strategy 5: Semantic Code Search

### Use Code Intelligence Tools

Instead of searching files manually, use semantic search:

```bash
# Find all workout-related components
rg "ActiveWorkout|SetRow|ExerciseCard" app/components/training/

# Find all API endpoints for training
rg "@router\.(get|post|put|delete)" src/modules/training/

# Find all Zustand stores
fd "Slice\.ts$|Store\.ts$" app/

# Find all hooks
fd "^use[A-Z].*\.ts$" app/hooks/
```

---

## Recommended Implementation

### Phase 1: Create Knowledge Base (1 hour)
1. Create `.kiro/codebase-map.md` (use template above)
2. Create `.kiro/agent-init.md`
3. Create 6 context files for major modules

### Phase 2: Agent Startup Instruction (15 min)
Add to your Kiro config:

```markdown
---
inclusion: always
---

# Repwise Development Agent

**CRITICAL:** Before responding to ANY development task:
1. Read `.kiro/agent-init.md`
2. Read `.kiro/codebase-map.md`
3. Read relevant context file from `.kiro/context/`

You now have full codebase context. Use the maps to locate files quickly.
```

### Phase 3: Maintain Context (Ongoing)
After each session, update:
- `.kiro/context/recent-changes.md` - What changed
- Relevant module context files - New patterns, gotchas

---

## Expected Benefits

**Before (Current):**
- 10-15 min searching for files
- Re-learning architecture each session
- Risk of breaking existing patterns

**After (With Context System):**
- <1 min to locate any file
- Instant architecture understanding
- Consistent with existing patterns

---

## Shall I Implement This?

I can create:
1. Complete codebase map
2. Agent initialization file
3. 6 module context files
4. Git hook for auto-updates

**Estimated time:** 1-2 hours

**This will make all future development sessions 10x faster!**

