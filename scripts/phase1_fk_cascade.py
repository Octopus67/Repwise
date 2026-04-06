"""Phase 1: Fix FK CASCADE on 10 foreign keys.

Checks for orphans, deletes them, drops NO ACTION FKs, re-adds with CASCADE.
"""
import os
import asyncio
import asyncpg

NEON_DIRECT = os.environ["DATABASE_URL"]  # Never hardcode credentials

# (child_table, child_col, parent_table, parent_col, on_delete)
FK_FIXES = [
    ("coach_profiles", "user_id", "users", "id", "CASCADE"),
    ("coaching_requests", "user_id", "users", "id", "CASCADE"),
    ("custom_exercises", "user_id", "users", "id", "CASCADE"),
    ("personal_records", "user_id", "users", "id", "CASCADE"),
    ("user_volume_landmarks", "user_id", "users", "id", "CASCADE"),
    ("article_favorites", "article_id", "content_articles", "id", "CASCADE"),
    ("article_versions", "article_id", "content_articles", "id", "CASCADE"),
    ("coaching_sessions", "coach_id", "coach_profiles", "id", "CASCADE"),
    ("coaching_sessions", "request_id", "coaching_requests", "id", "CASCADE"),
    ("content_articles", "module_id", "content_modules", "id", "SET NULL"),
]


async def main():
    conn = await asyncpg.connect(NEON_DIRECT)
    try:
        # Step 1: Find existing FK constraint names
        fk_info = await conn.fetch("""
            SELECT tc.table_name, kcu.column_name, tc.constraint_name,
                   rc.delete_rule
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.referential_constraints rc
              ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
            ORDER BY tc.table_name, kcu.column_name
        """)

        # Build lookup: (table, col) -> (constraint_name, delete_rule)
        fk_map = {}
        for row in fk_info:
            fk_map[(row["table_name"], row["column_name"])] = (
                row["constraint_name"], row["delete_rule"]
            )

        for child_table, child_col, parent_table, parent_col, on_delete in FK_FIXES:
            key = (child_table, child_col)
            if key not in fk_map:
                print(f"  SKIP {child_table}.{child_col} — FK not found in DB")
                continue

            constraint_name, current_rule = fk_map[key]
            print(f"\n{'='*60}")
            print(f"  {child_table}.{child_col} → {parent_table}.{parent_col}")
            print(f"  Current: {current_rule}, Target: {on_delete}")

            if current_rule == on_delete:
                print(f"  ✅ Already {on_delete}")
                continue

            # Check for orphans
            orphan_count = await conn.fetchval(f"""
                SELECT COUNT(*) FROM {child_table} c
                LEFT JOIN {parent_table} p ON c.{child_col} = p.{parent_col}
                WHERE p.{parent_col} IS NULL AND c.{child_col} IS NOT NULL
            """)
            if orphan_count > 0:
                print(f"  ⚠️  Found {orphan_count} orphaned rows — deleting")
                await conn.execute(f"""
                    DELETE FROM {child_table}
                    WHERE {child_col} NOT IN (SELECT {parent_col} FROM {parent_table})
                      AND {child_col} IS NOT NULL
                """)
            else:
                print(f"  ✅ No orphans")

            # Drop and re-add FK
            await conn.execute(f"ALTER TABLE {child_table} DROP CONSTRAINT {constraint_name}")
            nullable = "TRUE" if on_delete == "SET NULL" else "FALSE"
            # For SET NULL, ensure column is nullable
            if on_delete == "SET NULL":
                await conn.execute(f"""
                    ALTER TABLE {child_table}
                    ALTER COLUMN {child_col} DROP NOT NULL
                """)
            await conn.execute(f"""
                ALTER TABLE {child_table}
                ADD CONSTRAINT {constraint_name}
                FOREIGN KEY ({child_col}) REFERENCES {parent_table}({parent_col})
                ON DELETE {on_delete}
            """)
            print(f"  ✅ Changed to ON DELETE {on_delete}")

        # Verify
        print(f"\n{'='*60}")
        print("VERIFICATION — All target FKs:")
        for child_table, child_col, parent_table, parent_col, on_delete in FK_FIXES:
            row = await conn.fetchrow("""
                SELECT rc.delete_rule
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.referential_constraints rc
                  ON tc.constraint_name = rc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = $1
                  AND kcu.column_name = $2
            """, child_table, child_col)
            rule = row["delete_rule"] if row else "NOT FOUND"
            expected = on_delete.replace("_", " ")  # SET NULL -> SET NULL
            status = "✅" if rule == expected else "❌"
            print(f"  {status} {child_table}.{child_col}: {rule} (expected {expected})")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
