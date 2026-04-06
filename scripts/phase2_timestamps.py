"""Phase 2: Migrate all TIMESTAMP WITHOUT TIME ZONE → WITH TIME ZONE."""
import os
import asyncio
import asyncpg

NEON_DIRECT = os.environ["DATABASE_URL"]  # Never hardcode credentials


async def main():
    conn = await asyncpg.connect(NEON_DIRECT)
    try:
        # Find all timestamp without time zone columns
        rows = await conn.fetch("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type = 'timestamp without time zone'
            ORDER BY table_name, column_name
        """)
        print(f"Found {len(rows)} columns to migrate")

        for row in rows:
            table = row["table_name"]
            col = row["column_name"]
            await conn.execute(f"""
                ALTER TABLE {table}
                ALTER COLUMN {col}
                TYPE TIMESTAMP WITH TIME ZONE
                USING {col} AT TIME ZONE 'UTC'
            """)
            print(f"  ✅ {table}.{col}")

        # Verify
        remaining = await conn.fetchval("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type = 'timestamp without time zone'
              AND table_name != 'alembic_version'
        """)
        print(f"\nRemaining TIMESTAMP WITHOUT TZ columns (excl alembic): {remaining}")
        if remaining == 0:
            print("✅ All timestamps standardized to TIMESTAMPTZ")
        else:
            print("❌ Some columns still WITHOUT TIME ZONE")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
