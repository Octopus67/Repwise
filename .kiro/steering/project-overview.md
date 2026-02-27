---
inclusion: always
---

# Repwise — Project Steering

This is a science-based fitness platform. Full details are in `README.md`. Key points for Kiro:

## Stack
- **Frontend:** React Native + Expo SDK 52, TypeScript, Zustand, React Navigation, Reanimated 3 — lives in `app/`
- **Backend:** FastAPI + SQLAlchemy async + SQLite (dev) / PostgreSQL (prod) — lives in `src/`
- **Tests:** Jest + fast-check (frontend), pytest + Hypothesis (backend)

## Dev Servers
```bash
# Backend (auto-reload)
.venv/bin/uvicorn src.main:app --reload --port 8000 --host 0.0.0.0

# Frontend (hot reload)
cd app && npx expo start --port 8081
```

## Critical Rules

**Frontend:**
- All modals need `onRequestClose` prop
- `ErrorBanner` needs `onDismiss` prop
- Submit buttons need `disabled={loading}` during async ops
- State must reset when modals close (`useEffect` on `visible`)
- `useCallback`/`useEffect` must be declared before they're used (no temporal dead zone)
- Use local date arithmetic, not `toISOString()`, for date comparisons (timezone bugs)

**Backend:**
- Business logic in `service.py`, routing only in `router.py`
- All errors via `ApiError` subclasses from `src/shared/errors.py`
- Never hard-delete user data — use `deleted_at` soft delete
- Food search ranking: exact match (tier 0) → starts-with (tier 1) → contains (tier 2) → by name length

**Tests:**
- Run backend: `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`
- Run frontend: `cd app && npx jest --passWithNoTests`
- All tests must pass before committing

## Feature Locations
| Feature | Frontend | Backend |
|---------|----------|---------|
| Training | `app/screens/training/`, `app/screens/logs/` | `src/modules/training/` |
| Nutrition | `app/components/modals/AddNutritionModal.tsx` | `src/modules/nutrition/`, `src/modules/food_database/` |
| Dashboard | `app/screens/dashboard/DashboardScreen.tsx` | multiple modules |
| Analytics | `app/screens/analytics/AnalyticsScreen.tsx` | `src/modules/training/analytics_service.py` |
| Adaptive engine | `app/components/coaching/WeeklyCheckinCard.tsx` | `src/modules/adaptive/` |
| Auth | `app/screens/auth/` | `src/modules/auth/` |
| Profile | `app/screens/profile/`, `app/components/profile/` | `src/modules/user/` |
| Payments | `app/components/premium/` | `src/modules/payments/` |
