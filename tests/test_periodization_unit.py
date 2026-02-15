"""Unit tests for the periodization module.

Covers: block creation validation, template application, date range calculations,
overlap detection, deload suggestions, and edge cases.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest

from src.modules.periodization.schemas import (
    VALID_NUTRITION_PHASES,
    VALID_PHASE_TYPES,
    TrainingBlockCreate,
    TrainingBlockUpdate,
    DeloadSuggestion,
)
from src.modules.periodization.templates import (
    expand_template,
    get_template_by_id,
    get_templates,
)


# ═══════════════════════════════════════════════════════════════════════
# Schema validation tests
# ═══════════════════════════════════════════════════════════════════════


class TestTrainingBlockCreateSchema:
    """Validation tests for TrainingBlockCreate."""

    def test_valid_block_create(self):
        block = TrainingBlockCreate(
            name="Test Block",
            phase_type="accumulation",
            start_date=date(2025, 1, 6),
            end_date=date(2025, 2, 2),
        )
        assert block.name == "Test Block"
        assert block.phase_type == "accumulation"
        assert block.nutrition_phase is None

    def test_valid_block_with_nutrition_phase(self):
        block = TrainingBlockCreate(
            name="Bulk Block",
            phase_type="accumulation",
            start_date=date(2025, 1, 6),
            end_date=date(2025, 2, 2),
            nutrition_phase="bulk",
        )
        assert block.nutrition_phase == "bulk"

    def test_all_valid_phase_types(self):
        for pt in VALID_PHASE_TYPES:
            block = TrainingBlockCreate(
                name="Test",
                phase_type=pt,
                start_date=date(2025, 1, 6),
                end_date=date(2025, 1, 12),
            )
            assert block.phase_type == pt

    def test_all_valid_nutrition_phases(self):
        for np in VALID_NUTRITION_PHASES:
            block = TrainingBlockCreate(
                name="Test",
                phase_type="accumulation",
                start_date=date(2025, 1, 6),
                end_date=date(2025, 1, 12),
                nutrition_phase=np,
            )
            assert block.nutrition_phase == np

    def test_invalid_phase_type_rejected(self):
        with pytest.raises(ValueError, match="phase_type must be one of"):
            TrainingBlockCreate(
                name="Bad",
                phase_type="invalid_phase",
                start_date=date(2025, 1, 6),
                end_date=date(2025, 1, 12),
            )

    def test_invalid_nutrition_phase_rejected(self):
        with pytest.raises(ValueError, match="nutrition_phase must be one of"):
            TrainingBlockCreate(
                name="Bad",
                phase_type="accumulation",
                start_date=date(2025, 1, 6),
                end_date=date(2025, 1, 12),
                nutrition_phase="invalid_nutrition",
            )

    def test_end_date_before_start_date_rejected(self):
        with pytest.raises(ValueError, match="end_date must be on or after start_date"):
            TrainingBlockCreate(
                name="Bad",
                phase_type="accumulation",
                start_date=date(2025, 2, 1),
                end_date=date(2025, 1, 1),
            )

    def test_same_start_and_end_date_accepted(self):
        """Single-day block is valid."""
        block = TrainingBlockCreate(
            name="One Day",
            phase_type="peak",
            start_date=date(2025, 3, 1),
            end_date=date(2025, 3, 1),
        )
        assert block.start_date == block.end_date

    def test_empty_name_rejected(self):
        with pytest.raises(ValueError):
            TrainingBlockCreate(
                name="",
                phase_type="accumulation",
                start_date=date(2025, 1, 6),
                end_date=date(2025, 1, 12),
            )

    def test_name_too_long_rejected(self):
        with pytest.raises(ValueError):
            TrainingBlockCreate(
                name="A" * 101,
                phase_type="accumulation",
                start_date=date(2025, 1, 6),
                end_date=date(2025, 1, 12),
            )

    def test_block_exceeding_365_days_rejected(self):
        with pytest.raises(ValueError, match="Block duration cannot exceed 365 days"):
            TrainingBlockCreate(
                name="Too Long",
                phase_type="accumulation",
                start_date=date(2025, 1, 1),
                end_date=date(2026, 1, 2),
            )

    def test_block_exactly_365_days_accepted(self):
        block = TrainingBlockCreate(
            name="Full Year",
            phase_type="accumulation",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
        )
        assert (block.end_date - block.start_date).days == 364  # 365 days inclusive


class TestTrainingBlockUpdateSchema:
    """Validation tests for TrainingBlockUpdate."""

    def test_all_fields_optional(self):
        update = TrainingBlockUpdate()
        assert update.name is None
        assert update.phase_type is None
        assert update.start_date is None
        assert update.end_date is None
        assert update.nutrition_phase is None

    def test_partial_update_name_only(self):
        update = TrainingBlockUpdate(name="New Name")
        assert update.name == "New Name"
        assert update.phase_type is None

    def test_invalid_phase_type_in_update_rejected(self):
        with pytest.raises(ValueError, match="phase_type must be one of"):
            TrainingBlockUpdate(phase_type="bogus")

    def test_invalid_nutrition_phase_in_update_rejected(self):
        with pytest.raises(ValueError, match="nutrition_phase must be one of"):
            TrainingBlockUpdate(nutrition_phase="bogus")

    def test_valid_update_with_dates(self):
        update = TrainingBlockUpdate(
            start_date=date(2025, 3, 1),
            end_date=date(2025, 3, 28),
        )
        assert update.start_date == date(2025, 3, 1)
        assert update.end_date == date(2025, 3, 28)


# ═══════════════════════════════════════════════════════════════════════
# Template tests
# ═══════════════════════════════════════════════════════════════════════


class TestTemplates:
    """Tests for template listing, lookup, and expansion."""

    def test_get_templates_returns_list(self):
        templates = get_templates()
        assert isinstance(templates, list)
        assert len(templates) >= 4

    def test_get_template_by_valid_id(self):
        t = get_template_by_id("hypertrophy-4-1")
        assert t is not None
        assert t["id"] == "hypertrophy-4-1"
        assert "phases" in t

    def test_get_template_by_invalid_id_returns_none(self):
        assert get_template_by_id("nonexistent") is None

    def test_expand_hypertrophy_4_1(self):
        """4-week accumulation + 1-week deload = 5 weeks total, 2 blocks."""
        blocks = expand_template("hypertrophy-4-1", date(2025, 1, 6))
        assert len(blocks) == 2

        # First block: 4 weeks accumulation
        assert blocks[0]["phase_type"] == "accumulation"
        assert blocks[0]["start_date"] == date(2025, 1, 6)
        assert blocks[0]["end_date"] == date(2025, 2, 2)
        duration_0 = (blocks[0]["end_date"] - blocks[0]["start_date"]).days + 1
        assert duration_0 == 28  # 4 weeks

        # Second block: 1 week deload
        assert blocks[1]["phase_type"] == "deload"
        assert blocks[1]["start_date"] == date(2025, 2, 3)
        duration_1 = (blocks[1]["end_date"] - blocks[1]["start_date"]).days + 1
        assert duration_1 == 7  # 1 week

    def test_expand_strength_6(self):
        """6-week strength: 4 accum + 1 intens + 1 deload = 3 blocks."""
        blocks = expand_template("strength-6", date(2025, 3, 3))
        assert len(blocks) == 3
        assert blocks[0]["phase_type"] == "accumulation"
        assert blocks[1]["phase_type"] == "intensification"
        assert blocks[2]["phase_type"] == "deload"

        # Blocks are contiguous
        for i in range(1, len(blocks)):
            assert blocks[i]["start_date"] == blocks[i - 1]["end_date"] + timedelta(days=1)

    def test_expand_hypertrophy_8(self):
        """8-week mesocycle: 3+1+3+1 = 4 blocks, 8 weeks total."""
        blocks = expand_template("hypertrophy-8", date(2025, 6, 2))
        assert len(blocks) == 4
        total_days = sum(
            (b["end_date"] - b["start_date"]).days + 1 for b in blocks
        )
        assert total_days == 56  # 8 weeks

    def test_expand_peaking_3(self):
        """3-week peaking: 2 intens + 1 peak = 2 blocks."""
        blocks = expand_template("peaking-3", date(2025, 9, 1))
        assert len(blocks) == 2
        assert blocks[0]["phase_type"] == "intensification"
        assert blocks[1]["phase_type"] == "peak"

    def test_expand_nonexistent_template_returns_empty(self):
        blocks = expand_template("does-not-exist", date(2025, 1, 1))
        assert blocks == []

    def test_expanded_blocks_have_names(self):
        blocks = expand_template("hypertrophy-4-1", date(2025, 1, 6))
        for b in blocks:
            assert "name" in b
            assert len(b["name"]) > 0

    def test_expanded_blocks_contiguous(self):
        """All expanded blocks are contiguous — no gaps, no overlaps."""
        for template in get_templates():
            blocks = expand_template(template["id"], date(2025, 1, 6))
            for i in range(1, len(blocks)):
                expected_start = blocks[i - 1]["end_date"] + timedelta(days=1)
                assert blocks[i]["start_date"] == expected_start, (
                    f"Template {template['id']}: gap between block {i-1} and {i}"
                )


# ═══════════════════════════════════════════════════════════════════════
# DeloadSuggestion schema tests
# ═══════════════════════════════════════════════════════════════════════


class TestDeloadSuggestionSchema:
    def test_deload_suggestion_creation(self):
        s = DeloadSuggestion(
            message="5 consecutive weeks",
            suggested_start_date=date(2025, 2, 3),
            consecutive_weeks=5,
        )
        assert s.consecutive_weeks == 5
        assert s.suggested_start_date == date(2025, 2, 3)


# ═══════════════════════════════════════════════════════════════════════
# Integration tests (API-level via test client)
# ═══════════════════════════════════════════════════════════════════════


async def _register_and_get_headers(client, email: str = "period@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


VALID_BLOCK = {
    "name": "Hypertrophy A",
    "phase_type": "accumulation",
    "start_date": "2025-01-06",
    "end_date": "2025-02-02",
    "nutrition_phase": "bulk",
}


@pytest.mark.asyncio
async def test_create_block_happy_path(client, override_get_db):
    headers = await _register_and_get_headers(client)
    resp = await client.post("/api/v1/periodization/blocks", json=VALID_BLOCK, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Hypertrophy A"
    assert body["phase_type"] == "accumulation"
    assert body["nutrition_phase"] == "bulk"
    assert "id" in body


@pytest.mark.asyncio
async def test_create_block_invalid_phase_type(client, override_get_db):
    headers = await _register_and_get_headers(client, "bad_phase@example.com")
    payload = {**VALID_BLOCK, "phase_type": "invalid"}
    resp = await client.post("/api/v1/periodization/blocks", json=payload, headers=headers)
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_create_block_end_before_start(client, override_get_db):
    headers = await _register_and_get_headers(client, "bad_dates@example.com")
    payload = {**VALID_BLOCK, "start_date": "2025-02-01", "end_date": "2025-01-01"}
    resp = await client.post("/api/v1/periodization/blocks", json=payload, headers=headers)
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_list_blocks_empty(client, override_get_db):
    headers = await _register_and_get_headers(client, "empty_list@example.com")
    resp = await client.get("/api/v1/periodization/blocks", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_blocks_with_date_filter(client, override_get_db):
    headers = await _register_and_get_headers(client, "filter@example.com")
    # Create a block
    await client.post("/api/v1/periodization/blocks", json=VALID_BLOCK, headers=headers)

    # Filter that includes the block
    resp = await client.get(
        "/api/v1/periodization/blocks?start_date=2025-01-01&end_date=2025-03-01",
        headers=headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # Filter that excludes the block
    resp = await client.get(
        "/api/v1/periodization/blocks?start_date=2025-06-01&end_date=2025-07-01",
        headers=headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 0


@pytest.mark.asyncio
async def test_get_block_by_id(client, override_get_db):
    headers = await _register_and_get_headers(client, "getone@example.com")
    create_resp = await client.post("/api/v1/periodization/blocks", json=VALID_BLOCK, headers=headers)
    block_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/periodization/blocks/{block_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == block_id


@pytest.mark.asyncio
async def test_get_nonexistent_block_returns_404(client, override_get_db):
    headers = await _register_and_get_headers(client, "no_block@example.com")
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/periodization/blocks/{fake_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="SQLite async greenlet limitation with onupdate=func.now() on updated_at — works on PostgreSQL",
    strict=False,
)
async def test_update_block(client, override_get_db):
    headers = await _register_and_get_headers(client, "update@example.com")
    create_resp = await client.post("/api/v1/periodization/blocks", json=VALID_BLOCK, headers=headers)
    block_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/periodization/blocks/{block_id}",
        json={"name": "Updated Name", "phase_type": "deload"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_block(client, override_get_db):
    headers = await _register_and_get_headers(client, "delete@example.com")
    create_resp = await client.post("/api/v1/periodization/blocks", json=VALID_BLOCK, headers=headers)
    block_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/periodization/blocks/{block_id}", headers=headers)
    assert resp.status_code == 204

    # Should be gone now
    resp = await client.get(f"/api/v1/periodization/blocks/{block_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_overlap_detection(client, override_get_db):
    headers = await _register_and_get_headers(client, "overlap@example.com")
    await client.post("/api/v1/periodization/blocks", json=VALID_BLOCK, headers=headers)

    # Overlapping block
    overlap = {**VALID_BLOCK, "name": "Overlap", "start_date": "2025-01-20", "end_date": "2025-02-15"}
    resp = await client.post("/api/v1/periodization/blocks", json=overlap, headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_apply_template_happy_path(client, override_get_db):
    headers = await _register_and_get_headers(client, "template@example.com")
    resp = await client.post(
        "/api/v1/periodization/templates/apply",
        json={"template_id": "hypertrophy-4-1", "start_date": "2025-01-06"},
        headers=headers,
    )
    assert resp.status_code == 201
    blocks = resp.json()
    assert len(blocks) == 2
    assert blocks[0]["phase_type"] == "accumulation"
    assert blocks[1]["phase_type"] == "deload"


@pytest.mark.asyncio
async def test_apply_nonexistent_template_returns_404(client, override_get_db):
    headers = await _register_and_get_headers(client, "bad_tmpl@example.com")
    resp = await client.post(
        "/api/v1/periodization/templates/apply",
        json={"template_id": "nonexistent", "start_date": "2025-01-06"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_templates(client, override_get_db):
    headers = await _register_and_get_headers(client, "tmpl_list@example.com")
    resp = await client.get("/api/v1/periodization/templates", headers=headers)
    assert resp.status_code == 200
    templates = resp.json()
    assert len(templates) >= 4
    assert all("id" in t for t in templates)


@pytest.mark.asyncio
async def test_deload_suggestions_empty_when_no_blocks(client, override_get_db):
    headers = await _register_and_get_headers(client, "deload_empty@example.com")
    resp = await client.get("/api/v1/periodization/blocks/deload-suggestions", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_deload_suggestions_triggered(client, override_get_db):
    """5 consecutive non-deload weeks should trigger a deload suggestion."""
    headers = await _register_and_get_headers(client, "deload_trigger@example.com")

    # Create a 5-week accumulation block
    block = {
        "name": "Long Accum",
        "phase_type": "accumulation",
        "start_date": "2025-01-06",
        "end_date": "2025-02-09",
    }
    resp = await client.post("/api/v1/periodization/blocks", json=block, headers=headers)
    assert resp.status_code == 201

    resp = await client.get("/api/v1/periodization/blocks/deload-suggestions", headers=headers)
    assert resp.status_code == 200
    suggestions = resp.json()
    assert len(suggestions) >= 1
    assert suggestions[0]["consecutive_weeks"] >= 5


@pytest.mark.asyncio
async def test_unauthenticated_block_create_returns_401(client, override_get_db):
    resp = await client.post("/api/v1/periodization/blocks", json=VALID_BLOCK)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_block_empty_name_rejected(client, override_get_db):
    headers = await _register_and_get_headers(client, "empty_name@example.com")
    payload = {**VALID_BLOCK, "name": ""}
    resp = await client.post("/api/v1/periodization/blocks", json=payload, headers=headers)
    assert resp.status_code in (400, 422)
