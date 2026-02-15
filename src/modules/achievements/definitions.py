"""Static registry of all achievement definitions.

Achievement definitions are version-controlled in code rather than stored
in the database.  This avoids migrations when adding new achievements and
keeps the source of truth in the repository.
"""

from __future__ import annotations
from typing import Optional, Union

from dataclasses import dataclass
from src.shared.types import StrEnum


class AchievementCategory(StrEnum):
    PR_BADGE = "pr_badge"
    STREAK = "streak"
    VOLUME = "volume"
    NUTRITION = "nutrition"


@dataclass(frozen=True)
class AchievementDef:
    """Immutable definition of a single achievement."""

    id: str
    category: AchievementCategory
    title: str
    description: str
    icon: str
    threshold: Union[float, int]
    exercise_group: Optional[str] = None  # PR badges only


# ---------------------------------------------------------------------------
# Registry — 23 achievements total
# ---------------------------------------------------------------------------

_DEFS: list[AchievementDef] = [
    # ── PR Badges (10) ────────────────────────────────────────────────────
    AchievementDef(id="pr_bench_1plate", category=AchievementCategory.PR_BADGE, title="1-Plate Bench", description="Bench press 60 kg", icon="badge-bench-1", threshold=60, exercise_group="bench_press"),
    AchievementDef(id="pr_bench_2plate", category=AchievementCategory.PR_BADGE, title="2-Plate Bench", description="Bench press 100 kg", icon="badge-bench-2", threshold=100, exercise_group="bench_press"),
    AchievementDef(id="pr_bench_3plate", category=AchievementCategory.PR_BADGE, title="3-Plate Bench", description="Bench press 140 kg", icon="badge-bench-3", threshold=140, exercise_group="bench_press"),
    AchievementDef(id="pr_squat_2plate", category=AchievementCategory.PR_BADGE, title="2-Plate Squat", description="Squat 100 kg", icon="badge-squat-2", threshold=100, exercise_group="squat"),
    AchievementDef(id="pr_squat_3plate", category=AchievementCategory.PR_BADGE, title="3-Plate Squat", description="Squat 140 kg", icon="badge-squat-3", threshold=140, exercise_group="squat"),
    AchievementDef(id="pr_squat_4plate", category=AchievementCategory.PR_BADGE, title="4-Plate Squat", description="Squat 180 kg", icon="badge-squat-4", threshold=180, exercise_group="squat"),
    AchievementDef(id="pr_deadlift_2plate", category=AchievementCategory.PR_BADGE, title="2-Plate Deadlift", description="Deadlift 100 kg", icon="badge-dl-2", threshold=100, exercise_group="deadlift"),
    AchievementDef(id="pr_deadlift_3plate", category=AchievementCategory.PR_BADGE, title="3-Plate Deadlift", description="Deadlift 140 kg", icon="badge-dl-3", threshold=140, exercise_group="deadlift"),
    AchievementDef(id="pr_deadlift_4plate", category=AchievementCategory.PR_BADGE, title="4-Plate Deadlift", description="Deadlift 180 kg", icon="badge-dl-4", threshold=180, exercise_group="deadlift"),
    AchievementDef(id="pr_deadlift_5plate", category=AchievementCategory.PR_BADGE, title="5-Plate Deadlift", description="Deadlift 220 kg", icon="badge-dl-5", threshold=220, exercise_group="deadlift"),
    # ── Streak Badges (4) ─────────────────────────────────────────────────
    AchievementDef(id="streak_7", category=AchievementCategory.STREAK, title="Week Warrior", description="7-day activity streak", icon="badge-streak-7", threshold=7),
    AchievementDef(id="streak_30", category=AchievementCategory.STREAK, title="Monthly Machine", description="30-day activity streak", icon="badge-streak-30", threshold=30),
    AchievementDef(id="streak_90", category=AchievementCategory.STREAK, title="Quarter Crusher", description="90-day activity streak", icon="badge-streak-90", threshold=90),
    AchievementDef(id="streak_365", category=AchievementCategory.STREAK, title="Year of Iron", description="365-day activity streak", icon="badge-streak-365", threshold=365),
    # ── Volume Milestones (5) ─────────────────────────────────────────────
    AchievementDef(id="volume_10k", category=AchievementCategory.VOLUME, title="10K Club", description="Lift 10,000 kg total", icon="badge-vol-10k", threshold=10_000),
    AchievementDef(id="volume_50k", category=AchievementCategory.VOLUME, title="50K Club", description="Lift 50,000 kg total", icon="badge-vol-50k", threshold=50_000),
    AchievementDef(id="volume_100k", category=AchievementCategory.VOLUME, title="100K Club", description="Lift 100,000 kg total", icon="badge-vol-100k", threshold=100_000),
    AchievementDef(id="volume_500k", category=AchievementCategory.VOLUME, title="500K Club", description="Lift 500,000 kg total", icon="badge-vol-500k", threshold=500_000),
    AchievementDef(id="volume_1m", category=AchievementCategory.VOLUME, title="Million KG Club", description="Lift 1,000,000 kg total", icon="badge-vol-1m", threshold=1_000_000),
    # ── Nutrition Compliance (3) ──────────────────────────────────────────
    AchievementDef(id="nutrition_7", category=AchievementCategory.NUTRITION, title="Week of Discipline", description="7 consecutive compliant days", icon="badge-nutr-7", threshold=7),
    AchievementDef(id="nutrition_14", category=AchievementCategory.NUTRITION, title="Fortnight Focus", description="14 consecutive compliant days", icon="badge-nutr-14", threshold=14),
    AchievementDef(id="nutrition_30", category=AchievementCategory.NUTRITION, title="Monthly Macro Master", description="30 consecutive compliant days", icon="badge-nutr-30", threshold=30),
]

ACHIEVEMENT_REGISTRY: dict[str, AchievementDef] = {d.id: d for d in _DEFS}
