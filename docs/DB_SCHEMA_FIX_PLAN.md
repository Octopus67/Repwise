# Repwise Database Schema Fix Plan

**Date:** April 5, 2026
**Source:** Database Schema Audit (`db-schema-audit.md` — 21 findings)
**Already Fixed:** 11 findings (applied inline during audit)
**Remaining:** 10 findings across 4 phases
**Estimated Effort:** 11–16 hours

---

## Already Completed ✅

These 11 fixes were applied during the audit session and are live in production:

| # | Finding | Fix Applied |
|---|---------|-------------|
| 1 | `users.email` missing UNIQUE constraint (Finding #4) | Added `UNIQUE` constraint via Alembic migration |
| 2 | `coaching_suggestions.snapshot_id` missing FK index (Finding #1) | Added B-tree index |
| 3 | `food_items.created_by` missing FK index (Finding #1) | Added B-tree index |
| 4 | `personal_records.session_id` missing FK index (Finding #1) | Added B-tree index |
| 5 | `barcode_cache.food_item_id` missing FK index (Finding #1) | Added B-tree index |
| 6 | `meal_plan_items.food_item_id` missing FK index (Finding #1) | Added B-tree index |
| 7 | `meal_favorites.meal_id` missing FK index (Finding #1) | Added B-tree index |
| 8 | `referrals.id` missing `gen_random_uuid()` default (Finding #13) | Added `DEFAULT gen_random_uuid()` |
| 9 | `share_events.id` missing `gen_random_uuid()` default (Finding #13) | Added `DEFAULT gen_random_uuid()` |
| 10 | `device_tokens` duplicate index `ix_device_tokens_token` (Finding #7) | Dropped duplicate (kept constraint-backed `device_tokens_token_key`) |
| 11 | `notification_preferences` duplicate index `ix_notification_prefs_user_id` (Finding #7) | Dropped duplicate (kept constraint-backed `uq_notification_preferences_user_id`) |

**Findings that passed with no issues (no action needed):**
- Finding #2: All tables have primary keys ✅
- Finding #3: All critical columns are NOT NULL ✅
- Finding #11: Empty tables — expected for fresh launch ✅
- Finding #15: No orphaned data found ✅

---

## Phase 1: Critical — FK CASCADE Changes (Finding #9)

**Priority:** 🔴 CRITICAL
**Estimated Effort:** 2–3 hours
**Risk:** MEDIUM

### 1.1 Add ON DELETE CASCADE to 5 User-Facing FKs

**Root Cause:** Tables were created via `Base.metadata.create_all()` on April 5. The SQLAlchemy models already specify `ondelete="CASCADE"` in the Python code, but the actual database constraints were created as `NO ACTION` (PostgreSQL default). This is a known `create_all()` behavior — it doesn't always honor `ondelete` kwargs when the FK already exists.

**Schema Drift Confirmed:**
- `coach_profiles.user_id` → Model says `CASCADE`, DB has `NO ACTION`
- `coaching_requests.user_id` → Model says `CASCADE`, DB has `NO ACTION`
- `custom_exercises.user_id` → Model says `CASCADE`, DB has `NO ACTION`
- `personal_records.user_id` → Model says `CASCADE`, DB has `NO ACTION`
- `user_volume_landmarks.user_id` → Model says `CASCADE`, DB has `NO ACTION`

**Impact of NOT fixing:** When a user deletes their account (GDPR), the DELETE on `users` will be blocked by these FK constraints, leaving orphaned PII in 5 tables. The `permanent_deletion.py` cron job will fail silently.

**Affected Files:**
- `src/database/migrations/versions/` — new Alembic migration
- `src/modules/account/service.py` — verify deletion flow works after fix

**Implementation Steps:**

1. Create Alembic migration `fix_fk_cascade_user_tables`:
```python
def upgrade():
    # Step 1: Clean up any orphaned rows (safety net)
    op.execute("""
        DELETE FROM coach_profiles WHERE user_id NOT IN (SELECT id FROM users);
        DELETE FROM coaching_requests WHERE user_id NOT IN (SELECT id FROM users);
        DELETE FROM custom_exercises WHERE user_id NOT IN (SELECT id FROM users);
        DELETE FROM personal_records WHERE user_id NOT IN (SELECT id FROM users);
        DELETE FROM user_volume_landmarks WHERE user_id NOT IN (SELECT id FROM users);
    """)

    # Step 2: Drop and re-add FKs with CASCADE
    for table in ['coach_profiles', 'coaching_requests', 'custom_exercises',
                  'personal_records', 'user_volume_landmarks']:
        # Find and drop existing FK
        op.drop_constraint(f'{table}_user_id_fkey', table, type_='foreignkey')
        # Re-add with CASCADE
        op.create_foreign_key(
            f'{table}_user_id_fkey', table, 'users',
            ['user_id'], ['id'], ondelete='CASCADE'
        )

def downgrade():
    for table in ['coach_profiles', 'coaching_requests', 'custom_exercises',
                  'personal_records', 'user_volume_landmarks']:
        op.drop_constraint(f'{table}_user_id_fkey', table, type_='foreignkey')
        op.create_foreign_key(
            f'{table}_user_id_fkey', table, 'users',
            ['user_id'], ['id'], ondelete='NO ACTION'
        )
```

2. Also fix the 5 non-user FKs from Finding #9 that are content-related:
   - `article_favorites.article_id` → `content_articles` (NO ACTION → CASCADE)
   - `article_versions.article_id` → `content_articles` (NO ACTION → CASCADE)
   - `coaching_sessions.coach_id` → `coach_profiles` (NO ACTION → CASCADE)
   - `coaching_sessions.request_id` → `coaching_requests` (NO ACTION → CASCADE)
   - `content_articles.module_id` → `content_modules` (NO ACTION → SET NULL)

3. Test: Create a test user with data in all 5 tables, delete user, verify all child rows cascade.

**Ripple Effects:**
- `src/modules/account/service.py` — the `permanent_deletion.py` job currently may manually delete from these tables before deleting the user. After this fix, the manual deletes become redundant (but harmless). Review and simplify.
- Any code that catches `IntegrityError` on user deletion expecting FK violations will now silently succeed.

**Regression Risk:** MEDIUM — If any business logic depends on FK blocking deletion (e.g., "can't delete user with active coaching session"), that logic will break. Review `account/service.py` deletion flow.

**Testing:**
- Create test user → add coach_profile, coaching_request, custom_exercise, personal_record, user_volume_landmark
- DELETE user → verify all 5 child tables have 0 rows for that user
- Run full backend test suite: `DATABASE_URL=sqlite+aiosqlite:///./test.db .venv/bin/pytest tests/ -v`

**Rollback:** `alembic downgrade -1` reverts all FKs to NO ACTION.

---

## Phase 2: Critical — Timestamp Standardization (Finding #10)

**Priority:** 🔴 CRITICAL
**Estimated Effort:** 6–8 hours
**Risk:** HIGH

### 2.1 Migrate 141 TIMESTAMP WITHOUT TIME ZONE → WITH TIME ZONE

**Root Cause:** The original `Base` class in `src/shared/base_model.py` used `DateTime` without `timezone=True`. All 63 tables inherited `created_at` and `updated_at` as `TIMESTAMP WITHOUT TIME ZONE`. Tables were created via `create_all()` with this definition. The model has since been updated to `DateTime(timezone=True)`, but no migration has been run to alter the existing 141 columns.

**Current State (as of April 5, 2026):**
- **Python models:** ✅ Already fixed — `base_model.py` uses `DateTime(timezone=True)`, `soft_delete.py` uses `DateTime(timezone=True)`, all 25 model files use `DateTime(timezone=True)` for explicit columns
- **Python code:** ✅ Already fixed — 74 occurrences of `datetime.now(timezone.utc)` across 38 files (no `datetime.utcnow()` remaining)
- **Database columns:** ❌ NOT fixed — 141 columns are still `TIMESTAMP WITHOUT TIME ZONE` in production

**Dangerous Pairs (same query, different types):**
- `readiness_scores.created_at` (WITH TZ) vs `training_sessions.created_at` (WITHOUT TZ)
- `recovery_checkins.created_at` (WITH TZ) vs `nutrition_entries.created_at` (WITHOUT TZ)
- `users.trial_ends_at` (WITH TZ) vs `users.created_at` (WITHOUT TZ) — **same table!**

**Affected Files:**
- `src/database/migrations/versions/` — new Alembic migration (large)
- No Python code changes needed (already timezone-aware)

**Implementation Steps:**

1. **Generate the column list** — Query production to get exact table/column pairs:
```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone'
ORDER BY table_name, column_name;
```

2. **Create Alembic migration** `standardize_timestamps_to_timestamptz`:
```python
def upgrade():
    # All existing data is UTC (server runs in UTC, code uses datetime.now(timezone.utc))
    # USING col AT TIME ZONE 'UTC' tells PostgreSQL to interpret naive timestamps as UTC
    columns = [
        # Generated from the query above — all 141 columns
        ("users", "created_at"),
        ("users", "updated_at"),
        ("training_sessions", "created_at"),
        ("training_sessions", "updated_at"),
        ("training_sessions", "start_time"),
        ("training_sessions", "end_time"),
        # ... (full list from query)
    ]
    for table, col in columns:
        op.execute(f"""
            ALTER TABLE {table}
            ALTER COLUMN {col}
            TYPE TIMESTAMP WITH TIME ZONE
            USING {col} AT TIME ZONE 'UTC'
        """)

def downgrade():
    # Reverse: strip timezone info
    for table, col in columns:
        op.execute(f"""
            ALTER TABLE {table}
            ALTER COLUMN {col}
            TYPE TIMESTAMP WITHOUT TIME ZONE
        """)
```

3. **Execution considerations:**
   - `ALTER COLUMN ... TYPE` takes an `ACCESS EXCLUSIVE` lock on each table
   - For small tables (< 10K rows): instant, no concern
   - For `food_items` (8K rows, 116 MB): may take a few seconds
   - Run during low-traffic window (early morning IST or late night)
   - Consider batching: do the 5 largest tables first, then the rest

4. **Verify after migration:**
```sql
-- Should return 0 rows
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone';
```

**Why No Python Code Changes Are Needed:**
The code was already updated to use `datetime.now(timezone.utc)` (timezone-aware). When writing to a `TIMESTAMPTZ` column, PostgreSQL correctly stores the UTC value. When reading, asyncpg returns timezone-aware datetime objects. The only change is the DB column type.

**Ripple Effects:**
- asyncpg will now return `datetime` objects with `tzinfo=UTC` instead of naive datetimes
- Any code that compares `datetime.now(timezone.utc)` with a DB-returned value will now work correctly (currently it's comparing aware vs naive, which Python 3.12 warns about)
- Test fixtures that create naive datetimes may need updating — check `tests/conftest.py`

**Regression Risk:** HIGH
- Touches all 63 tables
- Lock contention during migration (brief per table)
- Test suite may have naive datetime comparisons that break
- SQLite (dev/test) doesn't distinguish TIMESTAMP vs TIMESTAMPTZ — tests may pass but prod could differ

**Testing:**
1. Run migration on a Neon branch (Neon supports branching for safe testing)
2. Verify all 141 columns are now `TIMESTAMPTZ`
3. Run full backend test suite
4. Manual smoke test: create user, log nutrition, log training, check timestamps in DB
5. Verify `weekly_report` and `adaptive` modules (they compare timestamps across tables)

**Rollback:** `alembic downgrade -1` reverts all columns to `TIMESTAMP WITHOUT TIME ZONE`. No code changes needed for rollback since `datetime.now(timezone.utc)` works with both column types (PostgreSQL silently strips tzinfo when writing to naive columns).

---

## Phase 3: High — GIN Indexes on JSONB Columns (Finding #8)

**Priority:** 🟠 HIGH
**Estimated Effort:** 1–2 hours
**Risk:** LOW

### 3.1 Add GIN Indexes on 7 Key JSONB Columns

**Root Cause:** `create_all()` created the tables but did not create GIN indexes. The database analysis doc claims these indexes exist, but the audit confirmed only `content_articles.tags` has a GIN index. This is schema drift between documentation and reality.

**Current State:**
- 34 total JSONB columns across all tables
- Only 1 has a GIN index (`content_articles.tags`)
- 7 are high-priority (frequently queried in analytics, dashboards, search)
- 26 are low-priority (audit logs, raw responses, etc. — rarely queried by JSONB operators)

**Affected Tables and Columns:**

| Table | Column | Query Pattern | Priority |
|-------|--------|--------------|----------|
| `food_items` | `micro_nutrients` | Micronutrient dashboard aggregation, deficiency detection | HIGH |
| `training_sessions` | `exercises` | Volume analytics, exercise lookups, WNS engine | HIGH |
| `training_sessions` | `metadata` | Session metadata filtering | MEDIUM |
| `nutrition_entries` | `micro_nutrients` | Micronutrient tracking, weekly aggregation | HIGH |
| `user_profiles` | `preferences` | Preference-based queries, coaching mode | MEDIUM |
| `workout_templates` | `exercises` | Template exercise lookups, sharing | MEDIUM |
| `feed_events` | `metadata` | Feed filtering by event type metadata | MEDIUM |

**Affected Files:**
- `src/database/migrations/versions/` — new Alembic migration

**Implementation Steps:**

1. **Create Alembic migration** `add_gin_indexes_jsonb`:
```python
def upgrade():
    # Use CONCURRENTLY to avoid locking tables during index creation
    # NOTE: CONCURRENTLY cannot run inside a transaction — use op.execute()
    # with autocommit or split into separate migrations
    indexes = [
        ("ix_food_items_micro_gin", "food_items", "micro_nutrients"),
        ("ix_training_sessions_exercises_gin", "training_sessions", "exercises"),
        ("ix_training_sessions_metadata_gin", "training_sessions", "metadata"),
        ("ix_nutrition_entries_micro_gin", "nutrition_entries", "micro_nutrients"),
        ("ix_user_profiles_preferences_gin", "user_profiles", "preferences"),
        ("ix_workout_templates_exercises_gin", "workout_templates", "exercises"),
        ("ix_feed_events_metadata_gin", "feed_events", "metadata"),
    ]
    for name, table, column in indexes:
        op.execute(f'CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} USING gin ({column})')

def downgrade():
    for name in ['ix_food_items_micro_gin', 'ix_training_sessions_exercises_gin',
                  'ix_training_sessions_metadata_gin', 'ix_nutrition_entries_micro_gin',
                  'ix_user_profiles_preferences_gin', 'ix_workout_templates_exercises_gin',
                  'ix_feed_events_metadata_gin']:
        op.execute(f'DROP INDEX IF EXISTS {name}')
```

2. **Important:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Alembic runs migrations in a transaction by default. Options:
   - Set `transaction_per_migration = False` in `env.py` for this migration
   - Or use `op.get_bind().execution_options(isolation_level="AUTOCOMMIT")` at the top of `upgrade()`

3. **Verify after migration:**
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('food_items', 'training_sessions', 'nutrition_entries',
                     'user_profiles', 'workout_templates', 'feed_events')
  AND indexdef LIKE '%gin%';
```

4. **Performance validation:**
```sql
-- Before: sequential scan on food_items.micro_nutrients
EXPLAIN ANALYZE SELECT * FROM food_items WHERE micro_nutrients @> '{"vitamin_d_mcg": 10}';
-- After: should show GIN index scan
```

**Ripple Effects:** None — adding indexes is a read-only schema change. No application code changes needed. Queries that use JSONB operators (`@>`, `?`, `?|`, `?&`) will automatically use the GIN indexes.

**Regression Risk:** LOW — Indexes only affect query plans, not data. Worst case: a query plan changes and becomes slightly slower for a specific edge case (extremely unlikely with GIN).

**Testing:**
- Run `EXPLAIN ANALYZE` on key queries before and after
- Verify `micro_dashboard_service.py` queries benefit from the `nutrition_entries.micro_nutrients` GIN index
- Full backend test suite should pass unchanged

**Rollback:** `alembic downgrade -1` drops all 7 indexes. No data loss.

---

## Phase 4: Medium/Low — CHECK Constraints, Column Verification, Monitoring (Findings #6, #12, #14, #5)

**Priority:** 🟡 MEDIUM / 🟢 LOW
**Estimated Effort:** 2–3 hours
**Risk:** LOW

### 4.1 Add CHECK Constraints (Finding #14)

**Root Cause:** Only 3 CHECK constraints exist in the entire schema (`no_self_follow`, `ck_photo_type_valid`, `ck_training_blocks_date_range`). No numeric bounds or enum validation at the database level. Application-level validation (Pydantic schemas) exists but can be bypassed by direct DB access, migrations, or seed scripts.

**Current Application-Level Validation (Pydantic):**
- `NutritionEntryCreate`: `calories >= 0, <= 50000`, `protein_g/carbs_g/fat_g >= 0, <= 5000`
- `BodyweightLogCreate`: `weight_kg > 0` (via `Field(..., gt=0)`)
- `SubscriptionStatus`: enum with values `free, pending_payment, active, past_due, cancelled`
- `CoachingRequestStatus`: enum with values `pending, approved, rejected, cancelled`

**Affected Files:**
- `src/database/migrations/versions/` — new Alembic migration

**Implementation Steps:**

1. **Pre-check for existing violations** (run before migration):
```sql
-- Any negative calories?
SELECT COUNT(*) FROM nutrition_entries WHERE calories < 0;
-- Any invalid weights?
SELECT COUNT(*) FROM bodyweight_logs WHERE weight_kg <= 0 OR weight_kg >= 500;
-- Any invalid subscription statuses?
SELECT DISTINCT status FROM subscriptions
WHERE status NOT IN ('free', 'pending_payment', 'active', 'past_due', 'cancelled');
-- Any invalid readiness scores?
SELECT COUNT(*) FROM readiness_scores WHERE score < 0 OR score > 100;
-- Any invalid leaderboard ranks?
SELECT COUNT(*) FROM leaderboard_entries WHERE rank IS NOT NULL AND rank <= 0;
```

2. **Create Alembic migration** `add_check_constraints`:
```python
def upgrade():
    # Nutrition bounds
    op.create_check_constraint('ck_nutrition_calories_positive', 'nutrition_entries',
                               'calories >= 0')
    op.create_check_constraint('ck_nutrition_protein_positive', 'nutrition_entries',
                               'protein_g >= 0')
    op.create_check_constraint('ck_nutrition_carbs_positive', 'nutrition_entries',
                               'carbs_g >= 0')
    op.create_check_constraint('ck_nutrition_fat_positive', 'nutrition_entries',
                               'fat_g >= 0')

    # Bodyweight bounds
    op.create_check_constraint('ck_bodyweight_range', 'bodyweight_logs',
                               'weight_kg > 0 AND weight_kg < 500')

    # Readiness score bounds (column is 'score', not 'overall_score')
    op.create_check_constraint('ck_readiness_score_range', 'readiness_scores',
                               'score >= 0 AND score <= 100')

    # Leaderboard rank (nullable, but when set must be positive)
    op.create_check_constraint('ck_leaderboard_rank_positive', 'leaderboard_entries',
                               'rank IS NULL OR rank > 0')

    # Subscription status enum
    op.create_check_constraint('ck_subscription_status_valid', 'subscriptions',
                               "status IN ('free', 'pending_payment', 'active', 'past_due', 'cancelled')")

    # Coaching request status enum
    op.create_check_constraint('ck_coaching_request_status_valid', 'coaching_requests',
                               "status IN ('pending', 'approved', 'rejected', 'cancelled')")

    # Email basic format (defense-in-depth — Pydantic validates more strictly)
    op.create_check_constraint('ck_users_email_format', 'users',
                               "email LIKE '%@%.%'")

def downgrade():
    for name in ['ck_nutrition_calories_positive', 'ck_nutrition_protein_positive',
                 'ck_nutrition_carbs_positive', 'ck_nutrition_fat_positive',
                 'ck_bodyweight_range', 'ck_readiness_score_range',
                 'ck_leaderboard_rank_positive', 'ck_subscription_status_valid',
                 'ck_coaching_request_status_valid', 'ck_users_email_format']:
        op.drop_constraint(name, ...)  # table name needed per constraint
```

**Ripple Effects:** If any existing data violates these constraints, the migration will fail. The pre-check queries (step 1) must be run first. If violations exist, clean them up before migrating.

**Regression Risk:** LOW — These constraints only reject invalid data. All application code already validates via Pydantic before writing. The only risk is seed scripts or test fixtures that insert invalid data directly.

**Testing:**
- Run pre-check queries to verify no existing violations
- Run migration
- Attempt to insert invalid data via raw SQL — verify rejection
- Full backend test suite (some tests may insert edge-case data that now violates constraints)

**Rollback:** `alembic downgrade -1` drops all CHECK constraints.

---

### 4.2 Verify Column Counts on 3 Suspicious Tables (Finding #12)

**Root Cause:** The audit flagged 3 tables with suspiciously few columns. This could indicate missing columns from the `create_all()` issue (same bug that caused `users` to have 9 instead of 15 columns initially).

**Tables to Verify:**

| Table | DB Columns | Model Columns | Status |
|-------|-----------|---------------|--------|
| `rate_limit_entries` | 5 | 5 (`id`, `key`, `endpoint`, `created_at`, `updated_at`) | ✅ **Matches** — verified against `src/middleware/rate_limit_models.py` |
| `referrals` | 6 | 6 (`id`, `referrer_id`, `visitor_ip`, `user_agent`, `created_at`, `updated_at`) | ✅ **Matches** — verified against `src/modules/sharing/models.py`. Note: uses legacy `Column()` syntax, not `mapped_column()`. The `created_at` is explicitly defined (overrides Base), but `updated_at` comes from Base. |
| `reactions` | 6 | 6 (`id` (nullable, non-PK), `user_id` (PK), `feed_event_id` (PK), `emoji`, `created_at`, `updated_at`) | ✅ **Matches** — verified against `src/modules/social/models.py`. Composite PK overrides Base.id. |

**Result:** All 3 tables match their SQLAlchemy models. No action needed.

**Implementation Steps:**
1. Confirm via production query:
```sql
SELECT table_name, COUNT(*) as col_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('rate_limit_entries', 'referrals', 'reactions')
GROUP BY table_name;
```
2. If any mismatch: `ALTER TABLE ADD COLUMN` via Alembic migration.

**Regression Risk:** None — read-only verification.

---

### 4.3 Monitor Unused Indexes (Finding #6)

**Root Cause:** 138 indexes have zero scans. This is expected for a freshly deployed database with minimal traffic. Most will become active as users onboard.

**Implementation Steps:**

1. **Create a monitoring script** at `scripts/check_unused_indexes.sql`:
```sql
-- Run monthly after traffic ramp-up
-- Indexes with 0 scans after 30+ days of traffic are candidates for removal
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

2. **Set calendar reminder:** Re-run after 30 days of production traffic (May 5, 2026).

3. **Decision criteria for dropping:**
   - Index has 0 scans after 30 days of real traffic
   - Index is not a PK, UNIQUE constraint, or FK support index
   - Index size > 1 MB (not worth optimizing tiny indexes)
   - Confirm no query in the codebase uses the indexed column pattern

**Regression Risk:** None — monitoring only.

---

### 4.4 Review Table Sizes After Data Growth (Finding #5)

**Root Cause:** Currently only `food_items` (116 MB) has meaningful data. All other tables are < 100 KB. Index-to-data ratios are very high on small tables (expected).

**Implementation Steps:**

1. **Re-run size check after 1K users** (estimated: 2–4 weeks post-launch):
```sql
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS data_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
```

2. **Watch for:** `nutrition_entries` and `training_sessions` growing faster than expected (these are the highest-write tables).

3. **Neon plan threshold:** Free tier = 0.5 GB. Upgrade to Launch ($6/mo) when total DB size approaches 400 MB.

**Regression Risk:** None — monitoring only.

---

## Dependency Graph

```
Phase 1 (FK CASCADE)     ──→ independent, do FIRST (unblocks GDPR deletion)
Phase 2 (Timestamps)     ──→ independent, do SECOND (highest risk, needs testing window)
Phase 3 (GIN Indexes)    ──→ independent, can run anytime (zero risk)
Phase 4 (CHECK + Monitor) ──→ independent, do LAST (lowest priority)
```

No phase depends on another. Recommended order is by risk/impact:
1. Phase 1 first — unblocks account deletion compliance
2. Phase 3 next — quick win, zero risk, improves query performance
3. Phase 2 next — highest effort, needs careful testing
4. Phase 4 last — defense-in-depth, monitoring setup

---

## Execution Timeline

| Phase | Focus | Tasks | Est. Hours | Risk | Blocking? |
|-------|-------|-------|-----------|------|-----------|
| 1 | FK CASCADE (10 FKs across 8 tables) | 1.1 | 2–3h | MEDIUM | Yes — GDPR |
| 2 | Timestamp migration (141 columns) | 2.1 | 6–8h | HIGH | No — correctness |
| 3 | GIN indexes (7 JSONB columns) | 3.1 | 1–2h | LOW | No — performance |
| 4 | CHECK constraints + monitoring | 4.1–4.4 | 2–3h | LOW | No — defense-in-depth |
| **Total** | | **7 tasks** | **11–16h** | | |

---

## Cross-Reference: All 21 Findings → Resolution

| Finding # | Severity | Description | Resolution |
|-----------|----------|-------------|------------|
| 1 | HIGH | 6 FK columns missing indexes | ✅ **Already Fixed** — 6 B-tree indexes added |
| 2 | ✅ PASS | All tables have primary keys | No action needed |
| 3 | ✅ PASS | Critical columns are NOT NULL | No action needed |
| 4 | CRITICAL | `users.email` missing UNIQUE constraint | ✅ **Already Fixed** — UNIQUE constraint added |
| 5 | LOW | Table sizes (informational) | → **Task 4.4** — Monitor after data growth |
| 6 | MEDIUM | 138 unused indexes (fresh DB) | → **Task 4.3** — Monitor after 30 days of traffic |
| 7 | MEDIUM | 2 duplicate index pairs | ✅ **Already Fixed** — 2 duplicates dropped |
| 8 | HIGH | 33 of 34 JSONB columns lack GIN indexes | → **Task 3.1** — Add 7 high-priority GIN indexes |
| 9 | CRITICAL | 10 FKs use NO ACTION on user-facing tables | → **Task 1.1** — Change to CASCADE (5 user FKs + 5 content FKs) |
| 10 | CRITICAL | 141 TIMESTAMP WITHOUT TZ vs 29 WITH TZ | → **Task 2.1** — Migrate all 141 to TIMESTAMPTZ |
| 11 | LOW | 45 of 64 tables empty | No action needed — expected for fresh launch |
| 12 | MEDIUM | 3 tables with suspicious column counts | → **Task 4.2** — Verified all 3 match models ✅ |
| 13 | HIGH | 2 UUID PKs missing `gen_random_uuid()` default | ✅ **Already Fixed** — defaults added to `referrals.id` and `share_events.id` |
| 14 | MEDIUM | Only 3 CHECK constraints in entire schema | → **Task 4.1** — Add 10 CHECK constraints |
| 15 | ✅ PASS | No orphaned data found | No action needed |

**Summary:** 21 findings total → 11 already fixed + 4 passed (no action) + 6 remaining tasks across 4 phases.

---

## Notes for Implementers

1. **Alembic + PostgreSQL:** Many existing migrations have SQLite-specific code. New migrations should target PostgreSQL only (production DB). Use `op.execute()` for raw SQL when Alembic's API doesn't support the operation (e.g., `CREATE INDEX CONCURRENTLY`).

2. **Neon Branching:** Use Neon's branch feature to test migrations safely before running on the main database. Create a branch, run migration, verify, then run on main.

3. **Migration Order:** Run Phase 1 → Phase 3 → Phase 2 → Phase 4. Phase 3 (GIN indexes) is quick and safe, so do it before the risky Phase 2 (timestamps).

4. **Test Suite Awareness:** The backend test suite uses SQLite, which doesn't enforce `TIMESTAMPTZ` vs `TIMESTAMP` or CHECK constraints. Production-only issues may not surface in tests. Always verify on a Neon branch.

5. **Rollback Strategy:** Every migration has a `downgrade()`. If anything goes wrong, `alembic downgrade -1` reverts the last migration. For Phase 2 (timestamps), consider taking a Neon snapshot before running.
