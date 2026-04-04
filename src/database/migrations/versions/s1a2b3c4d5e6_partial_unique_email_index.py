"""Replace global unique email constraint with partial unique index.

Allows soft-deleted users to re-register with the same email.

Revision ID: s1a2b3c4d5e6
"""

from alembic import op

revision = "s1a2b3c4d5e6"
down_revision = "r1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # Constraint/index may not exist on fresh PostgreSQL databases
    if conn.dialect.name == 'postgresql':
        op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_email")
        op.execute("DROP INDEX IF EXISTS ix_users_email")
    else:
        op.drop_constraint("uq_users_email", "users", type_="unique")
        op.drop_index("ix_users_email", table_name="users")
    op.create_index(
        "ix_users_email_active",
        "users",
        ["email"],
        unique=True,
        postgresql_where="deleted_at IS NULL",
    )


def downgrade() -> None:
    op.drop_index("ix_users_email_active", table_name="users")
    op.create_index("ix_users_email", "users", ["email"])
    op.create_unique_constraint("uq_users_email", "users", ["email"])
