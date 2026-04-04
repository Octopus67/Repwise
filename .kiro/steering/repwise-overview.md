---
inclusion: always
---

# Repwise — Agent Steering Guide

> Master steering file for AI agents. Read this FIRST, then drill into specific docs.

## What Is Repwise?

A full-stack fitness platform for serious lifters. Adaptive nutrition tracking, intelligent training logging with Weekly Net Stimulus (WNS) volume tracking, evidence-based coaching, micronutrient analysis, and social features (activity feed, leaderboards, reactions, shared templates).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.12), SQLAlchemy async, PostgreSQL (Neon) / SQLite (dev) |
| Server | Gunicorn multi-worker with Uvicorn workers (prod) |
| Frontend | React Native (Expo SDK 55), TypeScript, Zustand, React Navigation |
| Offline | TanStack Query (mutation queue + cache) + MMKV (persistent KV store) |
| Auth | JWT (access + refresh tokens), OAuth (Google, Apple) |
| Payments | RevenueCat (handles App Store + Play Store natively) |
| Feature Flags | PostHog (remote evaluation, percentage rollouts) |
| Rate Limiting | Redis-backed (per-user + per-endpoint sliding windows) |
| Monitoring | Sentry |
| Testing | pytest + Hypothesis (backend), Jest + fast-check (frontend) |

## Project Structure

```
/Users/manavmht/Documents/HOS/
├── src/                    # Backend (FastAPI)
│   ├── main.py             # App entry, router registration
│   ├── config/             # Settings, database config
│   ├── modules/            # 25+ feature modules (see below)
│   ├── middleware/          # Auth, freemium gate, rate limiting, logging
│   ├── shared/             # Base models, errors, pagination, soft delete
│   └── database/           # Alembic migrations
├── app/                    # Frontend (React Native)
│   ├── App.tsx             # Root component, auth flow
│   ├── navigation/         # BottomTabNavigator with 4 tabs
│   ├── screens/            # 17+ screen directories
│   ├── components/         # 20 component categories
│   ├── hooks/              # 11+ custom hooks
│   ├── utils/              # 70+ utility modules
│   ├── store/              # Zustand state management
│   ├── services/           # API client (axios) + TanStack Query config
│   └── theme/              # Design tokens
├── tests/                  # Backend tests (pytest)
├── scripts/                # Seed scripts, data imports
└── data/                   # USDA/OFF cache
```

## Detailed Documentation

| Doc | When to Read | Path |
|-----|-------------|------|
| Backend Architecture | Modifying backend modules | `.kiro/steering/backend-architecture.md` |
| Frontend Architecture | Modifying frontend components | `.kiro/steering/frontend-architecture.md` |
| API Reference | Adding/modifying endpoints | `.kiro/steering/api-reference.md` |
| Database Analysis | Schema, indexes, tables | `.kiro/steering/database-analysis.md` |
| Testing Guide | Writing or running tests | `.kiro/steering/testing-guide.md` |
| Key Algorithms | WNS, fatigue, adaptive engine | `.kiro/steering/algorithms.md` |

## Critical Patterns

### Backend Module Pattern
Every module in `src/modules/<name>/` follows: `router.py` → `models.py` → `schemas.py` → `service.py`

### Frontend Patterns
- Screens: `app/screens/<feature>/` | Components: `app/components/<category>/`
- Logic: `app/utils/` (pure functions) | Data: `app/hooks/` (TanStack Query + custom)
- State: `app/store/` (Zustand slices) | Offline: TanStack Query mutation queue + MMKV

### Database
- Dev: SQLite `./dev.db` | Prod: PostgreSQL via `DATABASE_URL`
- JSONB columns for extensible data (exercises, micro_nutrients, tags, metadata)
- Soft deletes via `SoftDeleteMixin`, audit logging via `AuditLogMixin`
- GIN indexes on JSONB columns, composite indexes on social tables

### Feature Flags (PostHog)
- Backend: `PostHogClient.is_feature_enabled("flag_name", user_id)`
- Frontend: `useFeatureFlag("flag_name")` hook (PostHog React Native SDK)
- Supports percentage rollouts, user targeting, A/B testing

### Error Handling
- Backend: Custom `ApiError` classes in `src/shared/errors.py`
- Format: `{status, code, message, details}`
- Frontend: try/catch with `err?.response?.data?.detail`

## Running the App

```bash
# Quick start
./dev.sh

# Manual — Backend
.venv/bin/python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Manual — Frontend (needs Node 22 via mise)
cd app && npx expo start --web --port 8081

# Tests
.venv/bin/python -m pytest tests/ -v    # Backend
cd app && npx jest                        # Frontend
```

## DO NOT
- Delete/modify existing tests without explicit request
- Use `as any`, `@ts-ignore`, `# type: ignore` unless absolutely necessary
- Commit secrets or API keys
- Modify DB schema without considering migration impact
- Break backward compatibility on API responses (add fields, don't remove)
