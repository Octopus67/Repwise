"""Build SQLite FTS5 virtual table for food_items search.

This script creates a food_items_fts virtual table using FTS5 and populates
it from the existing food_items table. This replaces the slow LIKE '%query%'
full-table scan with an inverted index lookup — ~100x faster for 2M+ rows.

Usage:
    python scripts/build_fts_index.py [--db dev.db]

The FTS table stores (rowid, name, category, source) and uses the food_items
rowid as the implicit join key. Searches use MATCH for tokenized full-text
queries, with BM25 ranking for relevance.
"""

import argparse
import sqlite3
import time
import sys


def build_fts_index(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check food_items count
    cursor.execute("SELECT count(*) FROM food_items")
    total = cursor.fetchone()[0]
    print(f"food_items table has {total:,} rows")

    if total == 0:
        print("No food items to index. Exiting.")
        conn.close()
        return

    # Drop existing FTS table if it exists
    cursor.execute("DROP TABLE IF EXISTS food_items_fts")

    # Create FTS5 virtual table
    # content='' makes it an external-content FTS table (no data duplication)
    # We use content_rowid to join back to food_items
    print("Creating FTS5 virtual table...")
    cursor.execute("""
        CREATE VIRTUAL TABLE food_items_fts USING fts5(
            name,
            category,
            source,
            content='food_items',
            content_rowid='rowid',
            tokenize='porter unicode61 remove_diacritics 2'
        )
    """)

    # Populate FTS table from food_items (only non-deleted items)
    print("Populating FTS index...")
    start = time.time()
    cursor.execute("""
        INSERT INTO food_items_fts(rowid, name, category, source)
        SELECT rowid, name, category, source
        FROM food_items
        WHERE deleted_at IS NULL
    """)
    conn.commit()
    elapsed = time.time() - start
    print(f"Indexed {total:,} rows in {elapsed:.1f}s")

    # Verify with a test query
    test_queries = ["chicken", "rice", "egg", "protein bar"]
    for q in test_queries:
        start = time.time()
        cursor.execute("""
            SELECT fi.name, fi.source, fi.calories
            FROM food_items_fts fts
            JOIN food_items fi ON fi.rowid = fts.rowid
            WHERE fts.name MATCH ?
            ORDER BY bm25(food_items_fts)
            LIMIT 20
        """, (q,))
        rows = cursor.fetchall()
        elapsed = time.time() - start
        print(f"  FTS '{q}': {elapsed*1000:.1f}ms ({len(rows)} results)")

    # Optimize the FTS index
    print("Optimizing FTS index...")
    cursor.execute("INSERT INTO food_items_fts(food_items_fts) VALUES('optimize')")
    conn.commit()

    conn.close()
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build FTS5 index for food search")
    parser.add_argument("--db", default="dev.db", help="Path to SQLite database")
    args = parser.parse_args()
    build_fts_index(args.db)
