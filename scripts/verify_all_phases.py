"""Final verification: check all 4 phases are complete."""
import os
import asyncio
import asyncpg

NEON_DIRECT = os.environ["DATABASE_URL"]  # Never hardcode credentials

FK_TARGETS = [
    ("coach_profiles", "user_id", "CASCADE"),
    ("coaching_requests", "user_id", "CASCADE"),
    ("custom_exercises", "user_id", "CASCADE"),
    ("personal_records", "user_id", "CASCADE"),
    ("user_volume_landmarks", "user_id", "CASCADE"),
    ("article_favorites", "article_id", "CASCADE"),
    ("article_versions", "article_id", "CASCADE"),
    ("coaching_sessions", "coach_id", "CASCADE"),
    ("coaching_sessions", "request_id", "CASCADE"),
    ("content_articles", "module_id", "SET NULL"),
]

GIN_INDEXES = [
    "ix_food_items_micro_gin",
    "ix_training_sessions_exercises_gin",
    "ix_training_sessions_metadata_gin",
    "ix_nutrition_entries_micro_gin",
    "ix_user_profiles_prefs_gin",
    "ix_workout_templates_exercises_gin",
    "ix_feed_events_metadata_gin",
]

CHECK_CONSTRAINTS = [
    "ck_nutrition_calories_positive",
    "ck_nutrition_protein_positive",
    "ck_nutrition_carbs_positive",
    "ck_nutrition_fat_positive",
    "ck_bodyweight_range",
    "ck_leaderboard_rank_positive",
    "ck_readiness_score_range",
    "ck_subscription_status_valid",
]


async def main():
    conn = await asyncpg.connect(NEON_DIRECT)
    try:
        all_pass = True

        # Phase 1: FK CASCADE
        print("=== PHASE 1: FK CASCADE ===")
        for table, col, expected in FK_TARGETS:
            row = await conn.fetchrow("""
                SELECT rc.delete_rule
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
                  AND tc.table_name = $1 AND kcu.column_name = $2
            """, table, col)
            rule = row["delete_rule"] if row else "NOT FOUND"
            ok = rule == expected.replace("_", " ")
            if not ok: all_pass = False
            print(f"  {'✅' if ok else '❌'} {table}.{col}: {rule}")

        # Phase 2: Timestamps
        print("\n=== PHASE 2: TIMESTAMPS ===")
        remaining = await conn.fetchval("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type = 'timestamp without time zone'
              AND table_name != 'alembic_version'
        """)
        ok = remaining == 0
        if not ok: all_pass = False
        print(f"  {'✅' if ok else '❌'} Remaining WITHOUT TZ: {remaining}")

        # Phase 3: GIN Indexes
        print("\n=== PHASE 3: GIN INDEXES ===")
        for name in GIN_INDEXES:
            exists = await conn.fetchval("SELECT 1 FROM pg_indexes WHERE indexname = $1", name)
            ok = exists is not None
            if not ok: all_pass = False
            print(f"  {'✅' if ok else '❌'} {name}")

        # Phase 4: CHECK Constraints
        print("\n=== PHASE 4: CHECK CONSTRAINTS ===")
        for name in CHECK_CONSTRAINTS:
            exists = await conn.fetchval("SELECT 1 FROM pg_constraint WHERE conname = $1", name)
            ok = exists is not None
            if not ok: all_pass = False
            print(f"  {'✅' if ok else '❌'} {name}")

        print(f"\n{'='*50}")
        print(f"OVERALL: {'✅ ALL PHASES PASS' if all_pass else '❌ SOME CHECKS FAILED'}")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
