"""Static block template definitions for periodization."""

from __future__ import annotations
from typing import Optional

from datetime import date, timedelta

BLOCK_TEMPLATES = [
    {
        "id": "hypertrophy-4-1",
        "name": "4-Week Hypertrophy + 1-Week Deload",
        "description": "4 weeks accumulation, 1 week deload",
        "phases": [
            {"phase_type": "accumulation", "duration_weeks": 4},
            {"phase_type": "deload", "duration_weeks": 1},
        ],
    },
    {
        "id": "strength-6",
        "name": "6-Week Strength Block",
        "description": "4 weeks accumulation, 1 week intensification, 1 week deload",
        "phases": [
            {"phase_type": "accumulation", "duration_weeks": 4},
            {"phase_type": "intensification", "duration_weeks": 1},
            {"phase_type": "deload", "duration_weeks": 1},
        ],
    },
    {
        "id": "hypertrophy-8",
        "name": "8-Week Hypertrophy Mesocycle",
        "description": "3+3 weeks accumulation with deload breaks",
        "phases": [
            {"phase_type": "accumulation", "duration_weeks": 3},
            {"phase_type": "deload", "duration_weeks": 1},
            {"phase_type": "accumulation", "duration_weeks": 3},
            {"phase_type": "deload", "duration_weeks": 1},
        ],
    },
    {
        "id": "peaking-3",
        "name": "3-Week Peaking Block",
        "description": "2 weeks intensification, 1 week peak",
        "phases": [
            {"phase_type": "intensification", "duration_weeks": 2},
            {"phase_type": "peak", "duration_weeks": 1},
        ],
    },
]


def get_templates() -> list[dict]:
    """Return all available block templates."""
    return BLOCK_TEMPLATES


def get_template_by_id(template_id: str) -> Optional[dict]:
    """Return a single template by ID, or None if not found."""
    for t in BLOCK_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None


def expand_template(template_id: str, start_date: date) -> list[dict]:
    """Expand a template into a list of block creation dicts.

    Each block is contiguous: the first starts on start_date, each subsequent
    block starts the day after the previous one ends.

    Returns a list of dicts with keys: name, phase_type, start_date, end_date.
    """
    template = get_template_by_id(template_id)
    if template is None:
        return []

    blocks: list[dict] = []
    current_start = start_date

    for phase in template["phases"]:
        duration_weeks = phase["duration_weeks"]
        if not isinstance(duration_weeks, int) or duration_weeks <= 0:
            continue
        duration_days = duration_weeks * 7
        block_end = current_start + timedelta(days=duration_days - 1)
        blocks.append(
            {
                "name": f"{template['name']} — {phase['phase_type'].title()}",
                "phase_type": phase["phase_type"],
                "start_date": current_start,
                "end_date": block_end,
            }
        )
        current_start = block_end + timedelta(days=1)

    return blocks
