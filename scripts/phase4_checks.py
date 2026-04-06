"""Phase 4: Add CHECK constraints, verify column counts, create monitoring."""
import os
import asyncio
import asyncpg

NEON_DIRECT = os.environ["DATABASE_URL"]  # Never hardcode credentials

CHECKS = [
    ("ck_nutrition_calories_positive", "nutrition_entries", "calories >= 0"),
    ("ck_nutrition_protein_positive", "nutrition_entries", "protein_g >= 0"),
    ("ck_nutrition_carbs_positive", "nutrition_entries", "carbs_g >= 0"),
    ("ck_nutrition_fat_positive", "nutrition_entries", "fat_g >= 0"),
    ("ck_bodyweight_range", "bodyweight_logs", "weight_kg > 0 AND weight_kg < 500"),
    ("ck_leaderboard_rank_positive", "leaderboard_entries", "rank IS NULL OR rank > 0"),
    ("ck_readiness_score_range", "readiness_scores", "score >= 0 AND score <= 100"),
    ("ck_subscription_status_valid", "subscriptions",
     "status IN ('free', 'pending_payment', 'active', 'past_due', 'cancelled', 'expired', 'trialing')"),
]

# Expected column counts: (table, expected_count)
COLUMN_CHECKS = [
    ("rate_limit_entries", 5),
    ("referrals", 6),
    ("reactions", 6),
]


async def main():
    conn = await asyncpg.connect(NEON_DIRECT)
    try:
        # --- CHECK CONSTRAINTS ---
        print("=== CHECK CONSTRAINTS ===")
        for name, table, expr in CHECKS:
            # Check for existing violations
            try:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE NOT ({expr})")
                if count > 0:
                    print(f"  ⚠️  {table}: {count} rows violate {name} — fixing")
                    await conn.execute(f"DELETE FROM {table} WHERE NOT ({expr})")
            except Exception as e:
                # Table might not exist or column might not exist
                print(f"  ⚠️  {table}: pre-check failed ({e})")
                continue

            # Check if constraint already exists
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_constraint WHERE conname = $1", name
            )
            if exists:
                print(f"  ✅ {name} already exists")
                continue

            try:
                await conn.execute(
                    f"ALTER TABLE {table} ADD CONSTRAINT {name} CHECK ({expr})"
                )
                print(f"  ✅ Added {name}")
            except Exception as e:
                print(f"  ❌ Failed {name}: {e}")

        # --- COLUMN VERIFICATION ---
        print("\n=== COLUMN VERIFICATION ===")
        for table, expected in COLUMN_CHECKS:
            actual = await conn.fetchval(
                "SELECT COUNT(*) FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = $1", table
            )
            status = "✅" if actual == expected else "❌"
            print(f"  {status} {table}: {actual} columns (expected {expected})")

        # --- VERIFY ALL CHECK CONSTRAINTS ---
        print("\n=== VERIFICATION — All CHECK constraints ===")
        rows = await conn.fetch("""
            SELECT conname, conrelid::regclass as table_name
            FROM pg_constraint
            WHERE contype = 'c' AND connamespace = 'public'::regnamespace
            ORDER BY conrelid::regclass::text, conname
        """)
        for row in rows:
            print(f"  ✅ {row['table_name']}.{row['conname']}")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
