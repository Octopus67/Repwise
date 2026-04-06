"""Monitor database index usage. Run monthly after traffic ramp-up.

Usage: .venv/bin/python scripts/monitor_db_indexes.py
"""
import os
import asyncio
import asyncpg

NEON_POOLER = os.environ["DATABASE_URL"]  # Never hardcode credentials


async def main():
    conn = await asyncpg.connect(NEON_POOLER)
    try:
        rows = await conn.fetch("""
            SELECT schemaname, relname AS table_name,
                   indexrelname AS index_name,
                   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
                   pg_relation_size(indexrelid) AS size_bytes,
                   idx_scan AS times_used,
                   idx_tup_read AS tuples_read
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
        """)

        unused = [r for r in rows if r["times_used"] == 0]
        used = [r for r in rows if r["times_used"] > 0]

        print(f"Total indexes: {len(rows)}")
        print(f"Used: {len(used)}, Unused: {len(unused)}")
        print(f"\n{'='*70}")
        print("UNUSED INDEXES (candidates for review after 30+ days of traffic):")
        print(f"{'Index':<50} {'Table':<25} {'Size':<10}")
        print("-" * 85)
        for r in unused:
            print(f"{r['index_name']:<50} {r['table_name']:<25} {r['index_size']:<10}")

        total_unused_bytes = sum(r["size_bytes"] for r in unused)
        print(f"\nTotal unused index storage: {total_unused_bytes / 1024 / 1024:.1f} MB")

        if used:
            print(f"\n{'='*70}")
            print("MOST USED INDEXES:")
            print(f"{'Index':<50} {'Scans':<10} {'Tuples':<10}")
            print("-" * 70)
            for r in sorted(used, key=lambda x: x["times_used"], reverse=True)[:10]:
                print(f"{r['index_name']:<50} {r['times_used']:<10} {r['tuples_read']:<10}")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
