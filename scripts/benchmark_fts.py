"""Benchmark FTS5 vs LIKE search performance."""
import sqlite3
import time

conn = sqlite3.connect("dev.db")
c = conn.cursor()

queries = ["chicken", "rice", "egg", "protein", "banana"]

for q in queries:
    # FTS5: get rowids then batch fetch
    start = time.time()
    c.execute(
        "SELECT rowid FROM food_items_fts WHERE name MATCH ? ORDER BY bm25(food_items_fts) LIMIT 20",
        (q,),
    )
    rowids = [r[0] for r in c.fetchall()]
    fts_ms = (time.time() - start) * 1000

    start = time.time()
    if rowids:
        ph = ",".join("?" * len(rowids))
        c.execute(f"SELECT id, name, calories FROM food_items WHERE rowid IN ({ph})", rowids)
        rows = c.fetchall()
    else:
        rows = []
    fetch_ms = (time.time() - start) * 1000

    # Old LIKE
    start = time.time()
    c.execute(
        "SELECT id, name FROM food_items WHERE lower(name) LIKE ? ORDER BY length(name) LIMIT 20",
        (f"%{q}%",),
    )
    like_rows = c.fetchall()
    like_ms = (time.time() - start) * 1000

    total_fts = fts_ms + fetch_ms
    speedup = like_ms / total_fts if total_fts > 0 else 0
    print(f"{q:15s} | FTS: {total_fts:7.1f}ms (fts={fts_ms:.0f}+fetch={fetch_ms:.0f}) | LIKE: {like_ms:7.1f}ms | {speedup:.0f}x faster")

conn.close()
