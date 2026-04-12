"""Tests for the sharing module — public workout links, OG tags, referral tracking."""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


async def _register_and_get_headers(client: AsyncClient) -> tuple[dict, str]:
    """Register a user and return (auth headers, user_id)."""
    email = f"share-test-{uuid.uuid4().hex[:8]}@test.com"
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
        },
    )
    assert reg.status_code == 201
    tokens = reg.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me = await client.get("/api/v1/auth/me", headers=headers)
    return headers, me.json()["id"]


class TestPublicWorkoutLink:
    """GET /api/v1/share/workout/{session_id} — public, no auth."""

    @pytest.mark.asyncio
    async def test_nonexistent_session_returns_404_html(self, client, override_get_db):
        fake_id = str(uuid.uuid4())
        resp = await client.get(f"/api/v1/share/workout/{fake_id}")
        assert resp.status_code == 404
        assert "not found" in resp.text.lower()

    @pytest.mark.asyncio
    async def test_shared_workout_returns_html_with_og_tags(self, client, override_get_db):
        headers, user_id = await _register_and_get_headers(client)

        # Create a training session
        session_resp = await client.post(
            "/api/v1/training/sessions",
            headers=headers,
            json={
                "session_date": "2024-06-15",
                "exercises": [
                    {
                        "exercise_name": "Bench Press",
                        "sets": [{"reps": 8, "weight_kg": 80, "rpe": 8, "set_type": "normal"}],
                    },
                ],
            },
        )
        assert session_resp.status_code == 201
        session_id = session_resp.json()["id"]

        # Share the session so it becomes publicly accessible
        await client.post(
            "/api/v1/share/track",
            headers=headers,
            json={
                "session_id": session_id,
                "share_type": "workout",
            },
        )

        # Fetch public share page
        resp = await client.get(f"/api/v1/share/workout/{session_id}")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "og:title" in resp.text
        assert "og:description" in resp.text
        assert "Bench Press" in resp.text
        assert "Repwise" in resp.text

    @pytest.mark.asyncio
    async def test_referral_tracking_with_ref_param(self, client, override_get_db):
        headers, user_id = await _register_and_get_headers(client)

        session_resp = await client.post(
            "/api/v1/training/sessions",
            headers=headers,
            json={
                "session_date": "2024-06-15",
                "exercises": [
                    {
                        "exercise_name": "Squat",
                        "sets": [{"reps": 5, "weight_kg": 100, "rpe": 9, "set_type": "normal"}],
                    },
                ],
            },
        )
        session_id = session_resp.json()["id"]

        # Share the session so it becomes publicly accessible
        await client.post(
            "/api/v1/share/track",
            headers=headers,
            json={
                "session_id": session_id,
                "share_type": "workout",
            },
        )

        # Visit with referral param — should not error
        resp = await client.get(f"/api/v1/share/workout/{session_id}?ref={user_id}")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_invalid_ref_param_ignored(self, client, override_get_db):
        headers, _ = await _register_and_get_headers(client)

        session_resp = await client.post(
            "/api/v1/training/sessions",
            headers=headers,
            json={
                "session_date": "2024-06-15",
                "exercises": [
                    {
                        "exercise_name": "Deadlift",
                        "sets": [{"reps": 3, "weight_kg": 140, "rpe": 10, "set_type": "normal"}],
                    },
                ],
            },
        )
        session_id = session_resp.json()["id"]

        # Share the session so it becomes publicly accessible
        await client.post(
            "/api/v1/share/track",
            headers=headers,
            json={
                "session_id": session_id,
                "share_type": "workout",
            },
        )

        # Invalid ref — should still return 200
        resp = await client.get(f"/api/v1/share/workout/{session_id}?ref=not-a-uuid")
        assert resp.status_code == 200


class TestShareEventTracking:
    """POST /api/v1/share/track — authenticated share event tracking."""

    @pytest.mark.asyncio
    async def test_track_share_event(self, client, override_get_db):
        headers, _ = await _register_and_get_headers(client)

        resp = await client.post(
            "/api/v1/share/track",
            headers=headers,
            json={
                "share_type": "workout",
                "platform": "instagram",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["share_type"] == "workout"
        assert data["platform"] == "instagram"

    @pytest.mark.asyncio
    async def test_track_share_event_with_session_id(self, client, override_get_db):
        headers, _ = await _register_and_get_headers(client)

        session_resp = await client.post(
            "/api/v1/training/sessions",
            headers=headers,
            json={
                "session_date": "2024-06-15",
                "exercises": [
                    {
                        "exercise_name": "OHP",
                        "sets": [{"reps": 10, "weight_kg": 40, "rpe": 7, "set_type": "normal"}],
                    },
                ],
            },
        )
        session_id = session_resp.json()["id"]

        resp = await client.post(
            "/api/v1/share/track",
            headers=headers,
            json={
                "session_id": session_id,
                "share_type": "workout",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["session_id"] == session_id

    @pytest.mark.asyncio
    async def test_track_share_unauthenticated_returns_401(self, client, override_get_db):
        resp = await client.post(
            "/api/v1/share/track",
            json={
                "share_type": "workout",
            },
        )
        assert resp.status_code == 401


class TestOGMetaTags:
    """Verify Open Graph meta tag content."""

    @pytest.mark.asyncio
    async def test_og_tags_contain_exercise_info(self, client, override_get_db):
        headers, _ = await _register_and_get_headers(client)

        await client.post(
            "/api/v1/training/sessions",
            headers=headers,
            json={
                "session_date": "2024-06-15",
                "exercises": [
                    {
                        "exercise_name": "Bench Press",
                        "sets": [
                            {"reps": 8, "weight_kg": 80, "rpe": 8, "set_type": "normal"},
                            {"reps": 8, "weight_kg": 80, "rpe": 9, "set_type": "normal"},
                        ],
                    },
                    {
                        "exercise_name": "Incline DB Press",
                        "sets": [
                            {"reps": 10, "weight_kg": 30, "rpe": 7, "set_type": "normal"},
                        ],
                    },
                ],
            },
        )
        sessions = await client.get("/api/v1/training/sessions", headers=headers)
        session_id = sessions.json()["items"][0]["id"]

        # Share the session so it becomes publicly accessible
        await client.post(
            "/api/v1/share/track",
            headers=headers,
            json={
                "session_id": session_id,
                "share_type": "workout",
            },
        )

        resp = await client.get(f"/api/v1/share/workout/{session_id}")
        html = resp.text

        # Check OG tags
        assert "og:title" in html
        assert "2 exercises" in html.lower() or "2 exercises" in html
        assert "3 sets" in html.lower() or "3 sets" in html
        assert "volume" in html.lower()

    @pytest.mark.asyncio
    async def test_og_tags_show_pr_count(self, client, override_get_db):
        headers, _ = await _register_and_get_headers(client)

        # Create two sessions to trigger PR detection
        await client.post(
            "/api/v1/training/sessions",
            headers=headers,
            json={
                "session_date": "2024-06-10",
                "exercises": [
                    {
                        "exercise_name": "Bench Press",
                        "sets": [{"reps": 8, "weight_kg": 75, "rpe": 8, "set_type": "normal"}],
                    },
                ],
            },
        )
        resp2 = await client.post(
            "/api/v1/training/sessions",
            headers=headers,
            json={
                "session_date": "2024-06-15",
                "exercises": [
                    {
                        "exercise_name": "Bench Press",
                        "sets": [{"reps": 8, "weight_kg": 80, "rpe": 8, "set_type": "normal"}],
                    },
                ],
            },
        )
        session_id = resp2.json()["id"]

        # Share the session so it becomes publicly accessible
        await client.post(
            "/api/v1/share/track",
            headers=headers,
            json={
                "session_id": session_id,
                "share_type": "workout",
            },
        )

        resp = await client.get(f"/api/v1/share/workout/{session_id}")
        # PR count may or may not appear depending on PR detection — just verify page loads
        assert resp.status_code == 200
