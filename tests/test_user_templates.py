"""Tests for user-created workout template CRUD.

Validates: Requirements 11.2, 11.4, 11.6
"""

from __future__ import annotations

import uuid

import pytest

from src.modules.training.schemas import (
    ExerciseEntry,
    SetEntry,
    WorkoutTemplateCreate,
    UserWorkoutTemplateResponse,
)
from src.modules.training.template_service import TemplateService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_template_data(
    name: str = "Push Day",
    description: str | None = "Chest and triceps",
) -> WorkoutTemplateCreate:
    return WorkoutTemplateCreate(
        name=name,
        description=description,
        exercises=[
            ExerciseEntry(
                exercise_name="Barbell Bench Press",
                sets=[SetEntry(reps=8, weight_kg=80.0)],
            ),
            ExerciseEntry(
                exercise_name="Cable Pushdown",
                sets=[SetEntry(reps=12, weight_kg=30.0)],
            ),
        ],
        metadata={"notes": "Start light"},
    )


async def _register_and_get_headers(client) -> dict[str, str]:
    """Register a new user and return auth headers."""
    email = f"tmpl_{uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Service-level tests
# ---------------------------------------------------------------------------


class TestTemplateServiceCreate:
    """Test TemplateService.create_template."""

    @pytest.mark.asyncio
    async def test_create_template_returns_response(self, db_session):
        """Create template → returns UserWorkoutTemplateResponse with correct fields.

        **Validates: Requirements 11.2**
        """
        user_id = uuid.uuid4()
        service = TemplateService(db_session)
        data = _make_template_data()

        result = await service.create_template(user_id=user_id, data=data)

        assert isinstance(result, UserWorkoutTemplateResponse)
        assert result.name == "Push Day"
        assert result.description == "Chest and triceps"
        assert len(result.exercises) == 2
        assert result.exercises[0].exercise_name == "Barbell Bench Press"
        assert result.user_id == user_id
        assert result.is_system is False
        assert result.metadata == {"notes": "Start light"}


class TestTemplateServiceList:
    """Test TemplateService.list_user_templates."""

    @pytest.mark.asyncio
    async def test_list_returns_only_user_templates(self, db_session):
        """List templates → returns only the current user's templates.

        **Validates: Requirements 11.4**
        """
        user_a = uuid.uuid4()
        user_b = uuid.uuid4()
        service = TemplateService(db_session)

        await service.create_template(user_a, _make_template_data("User A Template"))
        await service.create_template(user_b, _make_template_data("User B Template"))

        results_a = await service.list_user_templates(user_a)
        assert len(results_a) == 1
        assert results_a[0].name == "User A Template"

        results_b = await service.list_user_templates(user_b)
        assert len(results_b) == 1
        assert results_b[0].name == "User B Template"

    @pytest.mark.asyncio
    async def test_list_empty_when_none_exist(self, db_session):
        """List templates for user with none → empty list."""
        service = TemplateService(db_session)
        results = await service.list_user_templates(uuid.uuid4())
        assert results == []


class TestTemplateServiceUpdate:
    """Test TemplateService.update_template."""

    @pytest.mark.asyncio
    async def test_update_template_name(self, db_session):
        """Update template name → 200, name changed.

        **Validates: Requirements 11.6**
        """
        user_id = uuid.uuid4()
        service = TemplateService(db_session)
        created = await service.create_template(user_id, _make_template_data())

        from src.modules.training.schemas import WorkoutTemplateUpdate
        updated = await service.update_template(
            user_id, created.id, WorkoutTemplateUpdate(name="Pull Day")
        )
        assert updated.name == "Pull Day"
        assert updated.id == created.id

    @pytest.mark.asyncio
    async def test_update_template_exercises(self, db_session):
        """Update template exercises → exercises changed."""
        user_id = uuid.uuid4()
        service = TemplateService(db_session)
        created = await service.create_template(user_id, _make_template_data())

        from src.modules.training.schemas import WorkoutTemplateUpdate
        new_exercises = [
            ExerciseEntry(
                exercise_name="Barbell Row",
                sets=[SetEntry(reps=8, weight_kg=70.0)],
            )
        ]
        updated = await service.update_template(
            user_id, created.id, WorkoutTemplateUpdate(exercises=new_exercises)
        )
        assert len(updated.exercises) == 1
        assert updated.exercises[0].exercise_name == "Barbell Row"

    @pytest.mark.asyncio
    async def test_update_nonexistent_template_raises_404(self, db_session):
        """Update non-existent template → NotFoundError."""
        from src.shared.errors import NotFoundError
        from src.modules.training.schemas import WorkoutTemplateUpdate

        service = TemplateService(db_session)
        with pytest.raises(NotFoundError):
            await service.update_template(
                uuid.uuid4(), uuid.uuid4(), WorkoutTemplateUpdate(name="X")
            )

    @pytest.mark.asyncio
    async def test_update_another_users_template_raises_404(self, db_session):
        """Update another user's template → NotFoundError (no data leak)."""
        from src.shared.errors import NotFoundError
        from src.modules.training.schemas import WorkoutTemplateUpdate

        user_a = uuid.uuid4()
        user_b = uuid.uuid4()
        service = TemplateService(db_session)
        created = await service.create_template(user_a, _make_template_data())

        with pytest.raises(NotFoundError):
            await service.update_template(
                user_b, created.id, WorkoutTemplateUpdate(name="Stolen")
            )


class TestTemplateServiceDelete:
    """Test TemplateService.soft_delete_template."""

    @pytest.mark.asyncio
    async def test_delete_template(self, db_session):
        """Delete template → no longer appears in list."""
        user_id = uuid.uuid4()
        service = TemplateService(db_session)
        created = await service.create_template(user_id, _make_template_data())

        await service.soft_delete_template(user_id, created.id)

        results = await service.list_user_templates(user_id)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_delete_already_deleted_raises_404(self, db_session):
        """Delete already-deleted template → NotFoundError."""
        from src.shared.errors import NotFoundError

        user_id = uuid.uuid4()
        service = TemplateService(db_session)
        created = await service.create_template(user_id, _make_template_data())
        await service.soft_delete_template(user_id, created.id)

        with pytest.raises(NotFoundError):
            await service.soft_delete_template(user_id, created.id)


# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------


class TestTemplateSchemaValidation:
    """Test WorkoutTemplateCreate schema validation."""

    def test_empty_name_rejected(self):
        """Create template with empty name → ValidationError."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            WorkoutTemplateCreate(
                name="",
                exercises=[
                    ExerciseEntry(
                        exercise_name="Squat",
                        sets=[SetEntry(reps=5, weight_kg=100.0)],
                    )
                ],
            )

    def test_no_exercises_rejected(self):
        """Create template with no exercises → ValidationError."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            WorkoutTemplateCreate(name="Empty", exercises=[])

    def test_name_too_long_rejected(self):
        """Create template with name > 200 chars → ValidationError."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            WorkoutTemplateCreate(
                name="A" * 201,
                exercises=[
                    ExerciseEntry(
                        exercise_name="Squat",
                        sets=[SetEntry(reps=5, weight_kg=100.0)],
                    )
                ],
            )


# ---------------------------------------------------------------------------
# HTTP route tests
# ---------------------------------------------------------------------------


class TestUserTemplateRoutes:
    """Integration tests for user template CRUD routes."""

    @pytest.mark.asyncio
    async def test_create_template_route(self, client, override_get_db, db_session):
        """POST /user-templates → 201 with correct response.

        **Validates: Requirements 11.2**
        """
        headers = await _register_and_get_headers(client)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/training/user-templates",
            json={
                "name": "My Push Day",
                "description": "Heavy bench",
                "exercises": [
                    {
                        "exercise_name": "Barbell Bench Press",
                        "sets": [{"reps": 5, "weight_kg": 100.0}],
                    }
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "My Push Day"
        assert body["is_system"] is False
        assert len(body["exercises"]) == 1

    @pytest.mark.asyncio
    async def test_list_user_templates_route(self, client, override_get_db, db_session):
        """GET /user-templates → 200 with user's templates.

        **Validates: Requirements 11.4**
        """
        headers = await _register_and_get_headers(client)
        await db_session.commit()

        # Create a template first
        await client.post(
            "/api/v1/training/user-templates",
            json={
                "name": "Template A",
                "exercises": [
                    {
                        "exercise_name": "Squat",
                        "sets": [{"reps": 5, "weight_kg": 100.0}],
                    }
                ],
            },
            headers=headers,
        )

        resp = await client.get(
            "/api/v1/training/user-templates",
            headers=headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["name"] == "Template A"

    @pytest.mark.asyncio
    async def test_update_user_template_route(self, client, override_get_db, db_session):
        """PUT /user-templates/{id} → 200 with updated data.

        **Validates: Requirements 11.6**
        """
        headers = await _register_and_get_headers(client)
        await db_session.commit()

        create_resp = await client.post(
            "/api/v1/training/user-templates",
            json={
                "name": "Old Name",
                "exercises": [
                    {
                        "exercise_name": "Squat",
                        "sets": [{"reps": 5, "weight_kg": 100.0}],
                    }
                ],
            },
            headers=headers,
        )
        template_id = create_resp.json()["id"]

        resp = await client.put(
            f"/api/v1/training/user-templates/{template_id}",
            json={"name": "New Name"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_delete_user_template_route(self, client, override_get_db, db_session):
        """DELETE /user-templates/{id} → 204."""
        headers = await _register_and_get_headers(client)
        await db_session.commit()

        create_resp = await client.post(
            "/api/v1/training/user-templates",
            json={
                "name": "To Delete",
                "exercises": [
                    {
                        "exercise_name": "Squat",
                        "sets": [{"reps": 5, "weight_kg": 100.0}],
                    }
                ],
            },
            headers=headers,
        )
        template_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/v1/training/user-templates/{template_id}",
            headers=headers,
        )
        assert resp.status_code == 204

        # Verify it's gone from list
        list_resp = await client.get(
            "/api/v1/training/user-templates",
            headers=headers,
        )
        assert len(list_resp.json()) == 0

    @pytest.mark.asyncio
    async def test_static_templates_still_accessible(self, client, override_get_db, db_session):
        """GET /templates → still returns static templates (backward compat).

        **Validates: Requirements 11.4**
        """
        resp = await client.get("/api/v1/training/templates")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 6  # 6 static templates
        ids = [t["id"] for t in body]
        assert "push" in ids
        assert "pull" in ids

    @pytest.mark.asyncio
    async def test_create_template_without_auth_returns_401(self, client, override_get_db):
        """POST /user-templates without auth → 401."""
        resp = await client.post(
            "/api/v1/training/user-templates",
            json={
                "name": "No Auth",
                "exercises": [
                    {
                        "exercise_name": "Squat",
                        "sets": [{"reps": 5, "weight_kg": 100.0}],
                    }
                ],
            },
        )
        assert resp.status_code == 401
