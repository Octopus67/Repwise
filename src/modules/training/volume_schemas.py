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
