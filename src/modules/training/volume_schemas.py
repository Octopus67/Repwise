"""Volume tracking Pydantic schemas for muscle group volume and landmarks."""

from __future__ import annotations
from typing import Literal, Optional

from datetime import date

from pydantic import BaseModel, Field, model_validator

# Valid volume status values
VolumeStatus = Literal["below_mev", "optimal", "approaching_mrv", "above_mrv"]

# Upper bound for set counts per muscle group per week (generous safety cap)
_MAX_SETS = 200
_MAX_WEIGHT_KG = 1000.0
_MAX_REPS = 500
_MAX_LANDMARK = 50000


class VolumeLandmark(BaseModel):
    """Volume landmark thresholds for a single muscle group."""

    muscle_group: str
    mev: int = Field(ge=0, le=_MAX_LANDMARK, description="Minimum Effective Volume (sets/week)")
    mav: int = Field(ge=0, le=_MAX_LANDMARK, description="Maximum Adaptive Volume (sets/week)")
    mrv: int = Field(ge=0, le=_MAX_LANDMARK, description="Maximum Recoverable Volume (sets/week)")
    is_custom: bool = False


class SetDetail(BaseModel):
    """Individual set data with computed effort."""

    weight_kg: float = Field(ge=0, le=_MAX_WEIGHT_KG)
    reps: int = Field(ge=0, le=_MAX_REPS)
    rpe: Optional[float] = Field(default=None, ge=1, le=10)
    effort: float = Field(ge=0, le=1.0)


class ExerciseVolumeDetail(BaseModel):
    """Per-exercise volume breakdown."""

    exercise_name: str
    working_sets: int = Field(ge=0, le=_MAX_SETS)
    effective_sets: float = Field(ge=0)
    sets: list[SetDetail]


class MuscleGroupVolume(BaseModel):
    """Weekly volume summary for a single muscle group."""

    muscle_group: str
    effective_sets: float = Field(ge=0)
    frequency: int = Field(ge=0, le=14)
    volume_status: VolumeStatus
    mev: int = Field(ge=0, le=_MAX_LANDMARK)
    mav: int = Field(ge=0, le=_MAX_LANDMARK)
    mrv: int = Field(ge=0, le=_MAX_LANDMARK)


class MuscleGroupDetail(BaseModel):
    """Detailed per-exercise breakdown for a muscle group."""

    muscle_group: str
    effective_sets: float = Field(ge=0)
    frequency: int = Field(ge=0, le=14)
    volume_status: VolumeStatus
    mev: int = Field(ge=0, le=_MAX_LANDMARK)
    mav: int = Field(ge=0, le=_MAX_LANDMARK)
    mrv: int = Field(ge=0, le=_MAX_LANDMARK)
    exercises: list[ExerciseVolumeDetail]


class WeeklyVolumeResponse(BaseModel):
    """Response for the weekly muscle volume endpoint."""

    week_start: date
    week_end: date
    muscle_groups: list[MuscleGroupVolume]
    engine: Literal["legacy"] = "legacy"


class LandmarkUpdateRequest(BaseModel):
    """Request to set custom landmarks for a muscle group."""

    muscle_group: str
    mev: int = Field(ge=0, le=_MAX_LANDMARK)
    mav: int = Field(ge=0, le=_MAX_LANDMARK)
    mrv: int = Field(ge=0, le=_MAX_LANDMARK)

    @model_validator(mode="after")
    def _mev_lt_mav_lt_mrv(self) -> "LandmarkUpdateRequest":
        if not (self.mev < self.mav < self.mrv):
            raise ValueError("Landmarks must satisfy MEV < MAV < MRV")
        return self


class LandmarkConfigResponse(BaseModel):
    """Response containing all landmarks for a user."""

    landmarks: list[VolumeLandmark]


# ─── WNS Schemas ──────────────────────────────────────────────────────────────


class WNSLandmarks(BaseModel):
    """WNS volume landmark thresholds in Hypertrophy Units."""

    mv: float = Field(ge=0, description="Maintenance Volume in HU")
    mev: float = Field(ge=0, description="Minimum Effective Volume in HU")
    mav_low: float = Field(ge=0, description="MAV lower bound in HU")
    mav_high: float = Field(ge=0, description="MAV upper bound in HU")
    mrv: float = Field(ge=0, description="Maximum Recoverable Volume in HU")


class WNSExerciseContribution(BaseModel):
    """Per-exercise contribution to muscle group stimulus."""

    exercise_name: str
    coefficient: float = Field(ge=0, le=1.0)
    sets_count: int = Field(ge=0)
    stimulating_reps_total: float = Field(ge=0)
    contribution_hu: float = Field(ge=0)


class WNSWeeklyTrendPoint(BaseModel):
    """Single week's volume in a 4-week trend."""

    week: date
    volume: float = Field(ge=0)


class WNSMuscleVolume(BaseModel):
    """Weekly Net Stimulus volume for a single muscle group."""

    muscle_group: str
    gross_stimulus: float = Field(ge=0)
    atrophy_effect: float = Field(ge=0)
    net_stimulus: float = Field(ge=0)
    hypertrophy_units: float = Field(ge=0)
    status: VolumeStatus
    session_count: int = Field(ge=0)
    frequency: int = Field(ge=0, le=14)
    landmarks: WNSLandmarks
    exercises: list[WNSExerciseContribution]
    trend: list[WNSWeeklyTrendPoint] = Field(default_factory=list)


LANDMARK_DESCRIPTIONS: dict[str, str] = {
    "mv": "Maintenance Volume: Lowest dose to maintain current muscle mass",
    "mev": "Minimum Effective Volume: Threshold where growth begins",
    "mav": "Maximum Adaptive Volume: Optimal growth zone with manageable fatigue",
    "mrv": "Maximum Recoverable Volume: Upper limit before overtraining risk",
}


class WNSWeeklyResponse(BaseModel):
    """Response for the WNS weekly muscle volume endpoint."""

    week_start: date
    week_end: date
    muscle_groups: list[WNSMuscleVolume]
    landmark_descriptions: dict[str, str] = Field(default_factory=lambda: LANDMARK_DESCRIPTIONS)
    engine: Literal["wns"] = "wns"
