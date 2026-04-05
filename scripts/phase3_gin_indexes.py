"""Phase 3: Add GIN indexes on 7 key JSONB columns.

Uses raw asyncpg with autocommit for CONCURRENTLY support.
"""
import asyncio
import asyncpg

NEON_DIRECT = "postgresql://neondb_owner:npg_yVzuCrjh7TL4@ep-steep-bonus-ai7arlzn.c-4.us-east-1.aws.neon.tech/neondb?ssl=require"

INDEXES = [
    ("ix_food_items_micro_gin", "food_items", "micro_nutrients"),
    ("ix_training_sessions_exercises_gin", "training_sessions", "exercises"),
    ("ix_training_sessions_metadata_gin", "training_sessions", "metadata"),
    ("ix_nutrition_entries_micro_gin", "nutrition_entries", "micro_nutrients"),
    ("ix_user_profiles_prefs_gin", "user_profiles", "preferences"),
    ("ix_workout_templates_exercises_gin", "workout_templates", "exercises"),
    ("ix_feed_events_metadata_gin", "feed_events", "metadata"),
]


async def main():
    conn = await asyncpg.connect(NEON_DIRECT)
    try:
        for name, table, column in INDEXES:
            # Check if index already exists
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_indexes WHERE indexname = $1", name
            )
            if exists:
                print(f"  ✅ {name} already exists")
                continue

            # CREATE INDEX CONCURRENTLY cannot run in a transaction
            # asyncpg doesn't auto-wrap in transactions, so this works
            await conn.execute(
                f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} USING gin ({column})"
            )
            print(f"  ✅ Created {name}")

        # Verify
        print(f"\nVERIFICATION:")
        for name, table, column in INDEXES:
            row = await conn.fetchrow(
                "SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size "
                "FROM pg_indexes WHERE indexname = $1", name
            )
            if row:
                print(f"  ✅ {row['indexname']} — {row['size']}")
            else:
                print(f"  ❌ {name} NOT FOUND")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
