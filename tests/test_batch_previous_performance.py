"""Tests for batch previous performance endpoint and single session fetch.

Validates: Requirements 3.1, 3.5, 8.1
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest

from src.modules.training.schemas import (
    ExerciseEntry,
    SetEntry,
    TrainingSessionCreate,
)
from src.modules.training.service import TrainingService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _register_user(client, email: str) -> dict:
    """Register a user and return auth_headers."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    token = data["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_session(client, headers: dict, session_data: dict) -> dict:
    """Create a training session via the API."""
    resp = await client.post(
        "/api/v1/training/sessions",
        json=session_data,
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Batch Previous Performance Tests
# ---------------------------------------------------------------------------


class TestBatchPreviousPerformance:
    """Tests for POST /api/v1/training/previous-performance/batch.

    **Validates: Requirements 3.1, 3.5**
    """

    @pytest.mark.asyncio
    async def test_batch_with_mixed_history(self, client, override_get_db, db_session):
        """Batch with 3 exercises: 2 have history, 1 doesn't → 2 non-null, 1 null."""
        headers = await _register_user(client, "batch1@example.com")
        await db_session.commit()

        # Create a session with Bench Press and Squat
        await _create_session(client, headers, {
            "session_date": "2024-01-15",
            "exercises": [
                {
                    "exercise_name": "Barbell Bench Press",
                    "sets": [
                        {"reps": 8, "weight_kg": 80.0, "rpe": 7.0},
                        {"reps": 8, "weight_kg": 80.0, "rpe": 8.0},
                        {"reps": 6, "weight_kg": 82.5, "rpe": 9.0},
                    ],
                },
                {
                    "exercise_name": "Barbell Squat",
                    "sets": [
                        {"reps": 5, "weight_kg": 120.0},
                    ],
                },
            ],
        })
        await db_session.commit()

        # Batch request for 3 exercises (2 exist, 1 doesn't)
        resp = await client.post(
            "/api/v1/training/previous-performance/batch",
            json={
                "exercise_names": [
                    "Barbell Bench Press",
                    "Barbell Squat",
                    "Overhead Press",
                ]
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        results = data["results"]

        # Bench Press should have data
        assert results["Barbell Bench Press"] is not None
        assert results["Barbell Bench Press"]["exercise_name"] == "Barbell Bench Press"
        assert results["Barbell Bench Press"]["session_date"] == "2024-01-15"

        # Squat should have data
        assert results["Barbell Squat"] is not None
        assert results["Barbell Squat"]["exercise_name"] == "Barbell Squat"

        # Overhead Press should be null
        assert results["Overhead Press"] is None

    @pytest.mark.asyncio
    async def test_batch_empty_list_returns_400(self, client, override_get_db, db_session):
        """Batch with empty exercise list → 400 validation error."""
        headers = await _register_user(client, "batch2@example.com")
        await db_session.commit()

        resp = await client.post(
            "/api/v1/training/previous-performance/batch",
            json={"exercise_names": []},
            headers=headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_batch_too_many_exercises_returns_400(self, client, override_get_db, db_session):
        """Batch with 21 exercises → 400 validation error."""
        headers = await _register_user(client, "batch3@example.com")
        await db_session.commit()

        names = [f"Exercise {i}" for i in range(21)]
        resp = await client.post(
            "/api/v1/training/previous-performance/batch",
            json={"exercise_names": names},
            headers=headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_batch_returns_all_sets(self, client, override_get_db, db_session):
        """Batch returns ALL sets for each exercise, not just the last set."""
        headers = await _register_user(client, "batch4@example.com")
        await db_session.commit()

        # Create a session with 3 sets of bench press
        await _create_session(client, headers, {
            "session_date": "2024-01-20",
            "exercises": [
                {
                    "exercise_name": "Barbell Bench Press",
                    "sets": [
                        {"reps": 8, "weight_kg": 80.0, "rpe": 7.0},
                        {"reps": 8, "weight_kg": 82.5, "rpe": 8.0},
                        {"reps": 6, "weight_kg": 85.0, "rpe": 9.0},
                    ],
                },
            ],
        })
        await db_session.commit()

        resp = await client.post(
            "/api/v1/training/previous-performance/batch",
            json={"exercise_names": ["Barbell Bench Press"]},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        result = data["results"]["Barbell Bench Press"]

        assert result is not None
        assert len(result["sets"]) == 3
        assert result["sets"][0]["weight_kg"] == 80.0
        assert result["sets"][0]["reps"] == 8
        assert result["sets"][1]["weight_kg"] == 82.5
        assert result["sets"][2]["weight_kg"] == 85.0


# ---------------------------------------------------------------------------
# Single Session Fetch Tests
# ---------------------------------------------------------------------------


class TestSingleSessionFetch:
    """Tests for GET /api/v1/training/sessions/{session_id}.

    **Validates: Requirements 8.1**
    """

    @pytest.mark.asyncio
    async def test_fetch_valid_session(self, client, override_get_db, db_session):
        """Fetch session with valid ID → 200 with full session data."""
        headers = await _register_user(client, "fetch1@example.com")
        await db_session.commit()

        created = await _create_session(client, headers, {
            "session_date": "2024-02-01",
            "exercises": [
                {
                    "exercise_name": "Deadlift",
                    "sets": [{"reps": 5, "weight_kg": 180.0}],
                },
            ],
        })
        await db_session.commit()
        session_id = created["id"]

        resp = await client.get(
            f"/api/v1/training/sessions/{session_id}",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == session_id
        assert data["session_date"] == "2024-02-01"
        assert len(data["exercises"]) == 1
        assert data["exercises"][0]["exercise_name"] == "Deadlift"

    @pytest.mark.asyncio
    async def test_fetch_nonexistent_session(self, client, override_get_db, db_session):
        """Fetch session with non-existent ID → 404."""
        headers = await _register_user(client, "fetch2@example.com")
        await db_session.commit()

        fake_id = str(uuid.uuid4())
        resp = await client.get(
            f"/api/v1/training/sessions/{fake_id}",
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_fetch_other_users_session(self, client, override_get_db, db_session):
        """Fetch another user's session → 404 (no data leak)."""
        # User A creates a session
        headers_a = await _register_user(client, "fetch3a@example.com")
        await db_session.commit()

        created = await _create_session(client, headers_a, {
            "session_date": "2024-02-01",
            "exercises": [
                {
                    "exercise_name": "Squat",
                    "sets": [{"reps": 5, "weight_kg": 100.0}],
                },
            ],
        })
        await db_session.commit()
        session_id = created["id"]

        # User B tries to fetch User A's session
        headers_b = await _register_user(client, "fetch3b@example.com")
        await db_session.commit()

        resp = await client.get(
            f"/api/v1/training/sessions/{session_id}",
            headers=headers_b,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_fetch_soft_deleted_session(self, client, override_get_db, db_session):
        """Fetch a soft-deleted session → 404."""
        headers = await _register_user(client, "fetch4@example.com")
        await db_session.commit()

        created = await _create_session(client, headers, {
            "session_date": "2024-02-01",
            "exercises": [
                {
                    "exercise_name": "Bench Press",
                    "sets": [{"reps": 8, "weight_kg": 80.0}],
                },
            ],
        })
        await db_session.commit()
        session_id = created["id"]

        # Soft-delete the session
        del_resp = await client.delete(
            f"/api/v1/training/sessions/{session_id}",
            headers=headers,
        )
        assert del_resp.status_code == 204
        await db_session.commit()

        # Try to fetch the deleted session
        resp = await client.get(
            f"/api/v1/training/sessions/{session_id}",
            headers=headers,
        )
        assert resp.status_code == 404
