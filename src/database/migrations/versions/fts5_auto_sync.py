"""Add FTS5 triggers for auto-sync

Revision ID: fts5_auto_sync
Revises: (latest)
Create Date: 2026-03-09

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "fts5_auto_sync"
down_revision = "b16a1_password_changed_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite-only: Create FTS5 triggers for auto-sync
    # These triggers keep food_items_fts in sync with food_items table
    # FTS5 is a SQLite extension — skip on PostgreSQL (food search uses LIKE/ILIKE fallback)
    conn = op.get_bind()
    if conn.dialect.name != "sqlite":
        return

    op.execute("""
        -- Trigger: Insert into FTS when new food item is added
        CREATE TRIGGER IF NOT EXISTS food_items_ai AFTER INSERT ON food_items
        BEGIN
            INSERT INTO food_items_fts(rowid, name, category, source)
            VALUES (new.rowid, new.name, new.category, new.source);
        END;
    """)

    op.execute("""
        -- Trigger: Update FTS when food item is updated
        CREATE TRIGGER IF NOT EXISTS food_items_au AFTER UPDATE ON food_items
        BEGIN
            UPDATE food_items_fts
            SET name = new.name, category = new.category, source = new.source
            WHERE rowid = old.rowid;
        END;
    """)

    op.execute("""
        -- Trigger: Delete from FTS when food item is soft-deleted
        CREATE TRIGGER IF NOT EXISTS food_items_ad AFTER UPDATE OF deleted_at ON food_items
        WHEN new.deleted_at IS NOT NULL
        BEGIN
            DELETE FROM food_items_fts WHERE rowid = old.rowid;
        END;
    """)


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "sqlite":
        return
    op.execute("DROP TRIGGER IF EXISTS food_items_ai")
    op.execute("DROP TRIGGER IF EXISTS food_items_au")
    op.execute("DROP TRIGGER IF EXISTS food_items_ad")
