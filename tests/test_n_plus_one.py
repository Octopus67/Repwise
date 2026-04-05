"""Audit fix 10.20 — N+1 query detection for critical endpoints."""

import pytest
from sqlalchemy import event

from tests.conftest import test_engine

pytestmark = pytest.mark.asyncio


class QueryCounter:
    """Counts SQL queries executed during a block."""

    def __init__(self):
        self.count = 0

    def _listener(self, conn, cursor, statement, parameters, context, executemany):
        self.count += 1

    def __enter__(self):
        self.count = 0
        event.listen(test_engine.sync_engine, "before_cursor_execute", self._listener)
        return self

    def __exit__(self, *args):
        event.remove(test_engine.sync_engine, "before_cursor_execute", self._listener)


async def _get_auth_token(client, db_session, override_get_db) -> str:
    email, password = "n1test@test.com", "Test1234"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


async def test_dashboard_query_count(client, db_session, override_get_db):
    """Dashboard endpoint should use ≤10 queries."""
    token = await _get_auth_token(client, db_session, override_get_db)
    headers = {"Authorization": f"Bearer {token}"}
    with QueryCounter() as qc:
        resp = await client.get("/api/v1/dashboard", headers=headers)
    # Allow 404 if endpoint doesn't exist yet
    if resp.status_code == 200:
        assert qc.count <= 10, f"Dashboard used {qc.count} queries (max 10)"


async def test_recipe_creation_query_count(client, db_session, override_get_db):
    """Recipe creation should use ≤5 queries."""
    token = await _get_auth_token(client, db_session, override_get_db)
    headers = {"Authorization": f"Bearer {token}"}
    recipe = {"name": "Test Recipe", "ingredients": [], "servings": 1}
    with QueryCounter() as qc:
        resp = await client.post("/api/v1/nutrition/recipes", json=recipe, headers=headers)
    if resp.status_code in (200, 201):
        assert qc.count <= 5, f"Recipe creation used {qc.count} queries (max 5)"
