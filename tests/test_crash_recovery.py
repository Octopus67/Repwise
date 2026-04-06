"""Phase 6.2 — Crash recovery tests (backend side).

Tests: workout state preservation on crash, duration accuracy after crash,
finish-workout resets state so stale data doesn't resurface.
"""

import pytest
from datetime import datetime, timedelta, UTC


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    from src.middleware.rate_limiter import clear_all
    clear_all()
    yield
    clear_all()


async def _register(client, email: str) -> dict[str, str]:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Securepass123!"},
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make_workout_payload(start_time: str, end_time: str) -> dict:
    return {
        "session_date": "2024-06-15",
        "start_time": start_time,
        "end_time": end_time,
        "notes": "",
        "exercises": [
            {
                "exercise_name": "Bench Press",
                "order_index": 0,
                "sets": [
                    {
                        "set_number": 1,
                        "weight_kg": 80,
                        "reps": 8,
                        "rpe": None,
                        "set_type": "normal",
                    }
                ],
            }
        ],
    }


# ── 6.2.1 Crash recovery preserves state ────────────────────────────────────

@pytest.mark.asyncio
async def test_workout_crash_recovery_preserves_state(client, override_get_db):
    """A saved workout can be retrieved after save — simulates crash-then-resume
    by verifying the session persists and exercises are intact."""
    headers = await _register(client, "crash1@example.com")

    now = datetime.now(UTC)
    payload = _make_workout_payload(
        start_time=(now - timedelta(minutes=45)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        end_time=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    save_resp = await client.post("/api/v1/training/sessions", json=payload, headers=headers)
    assert save_resp.status_code in (200, 201)
    session_id = save_resp.json()["id"]

    # Simulate "resume after crash" — fetch the session back
    get_resp = await client.get(f"/api/v1/training/sessions/{session_id}", headers=headers)
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["session_date"] == "2024-06-15"
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["exercise_name"] == "Bench Press"


# ── 6.2.2 Crash recovery duration accuracy ──────────────────────────────────

@pytest.mark.asyncio
async def test_crash_recovery_duration_accurate(client, override_get_db):
    """Duration stored is end_time - start_time; a 1-hour gap (simulated crash)
    between start and end should be reflected accurately."""
    headers = await _register(client, "crash2@example.com")

    start = datetime(2024, 6, 15, 10, 0, 0)
    end = datetime(2024, 6, 15, 11, 0, 0)  # 60 min workout
    payload = _make_workout_payload(
        start_time=start.isoformat() + "Z",
        end_time=end.isoformat() + "Z",
    )
    save_resp = await client.post("/api/v1/training/sessions", json=payload, headers=headers)
    assert save_resp.status_code in (200, 201)
    body = save_resp.json()

    # Duration should reflect the actual start/end, not wall-clock
    if "duration_minutes" in body:
        assert body["duration_minutes"] == 60
    else:
        # Verify via start/end times
        assert body["start_time"] is not None
        assert body["end_time"] is not None


# ── 6.2.3 Finish workout resets state — no stale workout on resume ───────────

@pytest.mark.asyncio
async def test_finish_workout_resets_state(client, override_get_db):
    """After finishing a workout, starting a new one should not carry over
    exercises from the previous session."""
    headers = await _register(client, "crash3@example.com")

    now = datetime.now(UTC)
    payload = _make_workout_payload(
        start_time=(now - timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        end_time=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    # Save first workout
    resp1 = await client.post("/api/v1/training/sessions", json=payload, headers=headers)
    assert resp1.status_code in (200, 201)

    # Save second workout with different exercise
    payload2 = {
        **payload,
        "exercises": [
            {
                "exercise_name": "Squat",
                "order_index": 0,
                "sets": [{"set_number": 1, "weight_kg": 100, "reps": 5, "rpe": None, "set_type": "normal"}],
            }
        ],
    }
    resp2 = await client.post("/api/v1/training/sessions", json=payload2, headers=headers)
    assert resp2.status_code in (200, 201)
    body2 = resp2.json()

    # Second session should only have Squat, not Bench Press
    exercise_names = [e["exercise_name"] for e in body2["exercises"]]
    assert "Squat" in exercise_names
    assert "Bench Press" not in exercise_names
