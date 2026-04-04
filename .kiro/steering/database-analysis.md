---
inclusion: always
---

# Database Analysis for Repwise

## Current Production Status
- **Provider:** Neon (Launch plan, $14-17/mo at 10K users)
- **Items:** 8,034 food items (7,890 USDA + 144 verified)
- **Coverage:** All whole foods with rich micronutrients (15-20 per item)
- **Status:** ✅ Production-ready

## Storage Requirements (10K users)

| Category | Size | Details |
|----------|------|---------|
| Food database (2.37M items) | 1.28 GB | Raw 660MB + JSONB 99MB + indexes 496MB |
| Nutrition entries | 3.5 GB | 7.3M entries @ 500 bytes |
| Training sessions | 2.9 GB | 1.5M sessions @ 2KB |
| Other tables | 477 MB | Profiles, goals, achievements, social |
| **Total** | **~8 GB** | |

## Provider Decision: Neon Launch

**Why Neon:** Full PostgreSQL (all extensions), usage-based pricing, zero migration, Databricks-backed stability.

| Provider | 1K Users | 10K Users | 50K Users |
|----------|----------|-----------|-----------|
| Neon Launch | $6 | $15 | $57 |
| CockroachDB | $8 | $169 | $796 |
| Railway PG | $5 | $7 | $15 |
| Lazy-loading | $0 | $0 | $0 |

**Scale path:** Stay Neon to 50K, consider Railway/self-hosted beyond.

## Core Tables

### User & Auth
- `users` — UUID PK, email (unique), hashed_password, role, OAuth fields
- `user_profiles` — 1:1 with users, JSONB preferences, goals, metrics
- `token_blacklist` — Invalidated JWTs, expires_at for cleanup

### Nutrition
- `nutrition_entries` — UUID PK, user_id FK, meal_name, food_name, calories, JSONB macros/micros
- `food_items` — UUID PK, name, barcode (unique), source, JSONB micro_nutrients

### Training
- `training_sessions` — UUID PK, user_id FK, date, JSONB exercises array
- `exercises` — UUID PK, name, muscle_group, equipment, 1200+ seeded

### Content & Adaptive
- `content_articles` — UUID PK, title, body, JSONB tags, premium_only flag
- `adaptive_targets` — UUID PK, user_id FK, daily macro targets, recalc metadata

### Payments (RevenueCat Only)
- `subscriptions` — UUID PK, user_id FK, revenuecat_id, plan, status, period dates
- No Stripe/Razorpay provider references — RevenueCat handles all payment processing natively

### Social Tables (NEW)
- `follows` — Composite PK (follower_id, following_id), CHECK constraint no_self_follow, idx on following_id
- `feed_events` — UUID PK, user_id FK, event_type, ref_id, JSONB metadata, composite idx (user_id, created_at)
- `reactions` — Composite PK (user_id, feed_event_id), emoji column default '💪'
- `leaderboard_entries` — UUID PK, unique (board_type, period_start, user_id), composite idx (board_type, period_start, rank)
- `shared_templates` — UUID PK, owner_id FK, template_id FK (CASCADE), unique share_code, idx on owner_id + template_id

## Indexes

### GIN Indexes (JSONB search)
- `training_sessions.exercises` — Fast exercise lookup within session JSON
- `food_items.micro_nutrients` — Micronutrient filtering/search
- `user_profiles.preferences` — Preference-based queries
- `content_articles.tags` — Tag-based article filtering

### B-tree Indexes
- `token_blacklist.expires_at` — Efficient expired token cleanup
- `nutrition_entries(user_id, date)` — Daily entry lookups
- `training_sessions(user_id, date)` — Session history queries

### Composite Indexes (Social)
- `feed_events(user_id, created_at)` — Feed pagination
- `leaderboard_entries(board_type, period_start, rank)` — Leaderboard queries

## Key Patterns
- **Soft deletes:** `SoftDeleteMixin` (deleted_at column) on user-facing tables
- **Audit logging:** `AuditLogMixin` on mutable tables
- **JSONB columns:** exercises, micro_nutrients, tags, preferences, metadata
- **Dev:** SQLite at `./dev.db` (auto-created from models)
- **Prod:** PostgreSQL via `DATABASE_URL` env var
- **Migrations:** Alembic in `src/database/`
