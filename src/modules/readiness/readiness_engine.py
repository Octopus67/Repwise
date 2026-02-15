"""Readiness Engine — pure computation functions.

All functions are deterministic with zero side effects.
No database or I/O dependencies.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

FACTOR_NAMES: List[str] = [
    "hrv_trend",
    "resting_hr_trend",
    "sleep_duration",
    "sleep_quality",
    "soreness",
    "stress",
]


def _is_finite(value: Optional[float]) -> bool:
    """Return True if value is a finite number (not None, NaN, or Inf)."""
    if value is None:
        return False
    try:
        return math.isfinite(value)
    except (TypeError, ValueError):
        return False


@dataclass(frozen=True)
class HealthMetrics:
    hrv_ms: Optional[float] = None
    resting_hr_bpm: Optional[float] = None
    sleep_duration_hours: Optional[float] = None


@dataclass(frozen=True)
class UserCheckin:
    soreness: Optional[int] = None       # 1-5 (1=none, 5=very sore)
    stress: Optional[int] = None         # 1-5 (1=none, 5=very stressed)
    sleep_quality: Optional[int] = None  # 1-5 (1=poor, 5=excellent)


@dataclass(frozen=True)
class Baselines:
    hrv_mean: Optional[float] = None
    resting_hr_mean: Optional[float] = None
    hrv_data_days: int = 0
    resting_hr_data_days: int = 0


@dataclass(frozen=True)
class ReadinessWeights:
    hrv_trend: float = 0.25
    resting_hr_trend: float = 0.15
    sleep_duration: float = 0.20
    sleep_quality: float = 0.15
    soreness: float = 0.15
    stress: float = 0.10


@dataclass(frozen=True)
class FactorScore:
    name: str
    normalized: float       # 0.0-1.0 (1.0 = optimal)
    weight: float
    effective_weight: float
    present: bool


@dataclass(frozen=True)
class ReadinessResult:
    score: Optional[int]       # 0-100, None if all factors absent
    factors: List[FactorScore]
    factors_present: int
    factors_total: int


MIN_BASELINE_DAYS = 7


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    """Clamp value to [lo, hi], returning lo if value is NaN."""
    if not _is_finite(value):
        return lo
    return max(lo, min(value, hi))


def compute_baselines(
    hrv_history: List[float],
    resting_hr_history: List[float],
) -> Baselines:
    """Arithmetic mean of up to 30 days of history. Filters out non-finite values."""
    hrv_vals = [v for v in hrv_history[-30:] if _is_finite(v) and v >= 0]
    rhr_vals = [v for v in resting_hr_history[-30:] if _is_finite(v) and v > 0]

    hrv_mean = (sum(hrv_vals) / len(hrv_vals)) if hrv_vals else None
    rhr_mean = (sum(rhr_vals) / len(rhr_vals)) if rhr_vals else None

    logger.debug(
        "Baselines computed: hrv_mean=%s (%d days), rhr_mean=%s (%d days)",
        hrv_mean, len(hrv_vals), rhr_mean, len(rhr_vals),
    )

    return Baselines(
        hrv_mean=hrv_mean,
        resting_hr_mean=rhr_mean,
        hrv_data_days=len(hrv_vals),
        resting_hr_data_days=len(rhr_vals),
    )


def normalize_hrv_factor(current_hrv: float, baseline_hrv: float) -> float:
    """clamp((current/baseline - 0.7) / 0.6, 0, 1). Higher HRV = better."""
    if not _is_finite(current_hrv) or not _is_finite(baseline_hrv):
        return 0.5
    if baseline_hrv <= 0:
        return 0.5
    ratio = current_hrv / baseline_hrv
    return _clamp((ratio - 0.7) / 0.6)


def normalize_resting_hr_factor(current_hr: float, baseline_hr: float) -> float:
    """clamp((baseline/current - 0.85) / 0.3, 0, 1). Lower HR = better."""
    if not _is_finite(current_hr) or not _is_finite(baseline_hr):
        return 0.5
    if current_hr <= 0:
        return 0.5
    ratio = baseline_hr / current_hr
    return _clamp((ratio - 0.85) / 0.3)


def normalize_sleep_duration(hours: float) -> float:
    """clamp((hours - 4) / 4, 0, 1). 4h=0.0, 8h+=1.0."""
    if not _is_finite(hours):
        return 0.0
    return _clamp((hours - 4.0) / 4.0)


def normalize_checkin_factor(value: int) -> float:
    """(5 - value) / 4. For soreness/stress: 1=1.0, 5=0.0. Clamped to [0, 1]."""
    return _clamp((5 - value) / 4.0)


def normalize_sleep_quality(value: int) -> float:
    """(value - 1) / 4. 1=0.0, 5=1.0. Clamped to [0, 1]."""
    return _clamp((value - 1) / 4.0)


def redistribute_weights(
    weights: ReadinessWeights,
    present: Dict[str, bool],
) -> Dict[str, float]:
    """Proportional redistribution. Present factors sum to 1.0. Absent = 0.0."""
    weight_map = {
        "hrv_trend": weights.hrv_trend,
        "resting_hr_trend": weights.resting_hr_trend,
        "sleep_duration": weights.sleep_duration,
        "sleep_quality": weights.sleep_quality,
        "soreness": weights.soreness,
        "stress": weights.stress,
    }
    total_present = sum(w for k, w in weight_map.items() if present.get(k, False))
    if total_present <= 0:
        return {k: 0.0 for k in weight_map}
    return {
        k: (w / total_present if present.get(k, False) else 0.0)
        for k, w in weight_map.items()
    }


def compute_readiness(
    health: HealthMetrics,
    checkin: Optional[UserCheckin],
    baselines: Baselines,
    weights: ReadinessWeights = ReadinessWeights(),
) -> ReadinessResult:
    """Pure computation. None score if all factors absent. Clamped [0, 100]."""
    factors: List[FactorScore] = []
    presence: Dict[str, bool] = {}

    # HRV trend
    hrv_present = (
        _is_finite(health.hrv_ms)
        and _is_finite(baselines.hrv_mean)
        and baselines.hrv_data_days >= MIN_BASELINE_DAYS
    )
    presence["hrv_trend"] = hrv_present
    hrv_norm = normalize_hrv_factor(health.hrv_ms, baselines.hrv_mean) if hrv_present else 0.0

    # Resting HR trend
    rhr_present = (
        _is_finite(health.resting_hr_bpm)
        and _is_finite(baselines.resting_hr_mean)
        and baselines.resting_hr_data_days >= MIN_BASELINE_DAYS
    )
    presence["resting_hr_trend"] = rhr_present
    rhr_norm = normalize_resting_hr_factor(health.resting_hr_bpm, baselines.resting_hr_mean) if rhr_present else 0.0

    # Sleep duration
    sleep_dur_present = _is_finite(health.sleep_duration_hours)
    presence["sleep_duration"] = sleep_dur_present
    sleep_dur_norm = normalize_sleep_duration(health.sleep_duration_hours) if sleep_dur_present else 0.0

    # Checkin factors
    c = checkin or UserCheckin()

    sq_present = c.sleep_quality is not None
    presence["sleep_quality"] = sq_present
    sq_norm = normalize_sleep_quality(c.sleep_quality) if sq_present else 0.0

    sore_present = c.soreness is not None
    presence["soreness"] = sore_present
    sore_norm = normalize_checkin_factor(c.soreness) if sore_present else 0.0

    stress_present = c.stress is not None
    presence["stress"] = stress_present
    stress_norm = normalize_checkin_factor(c.stress) if stress_present else 0.0

    factors_present = sum(1 for v in presence.values() if v)
    if factors_present == 0:
        logger.info("All readiness factors absent — returning None score")
        for name in FACTOR_NAMES:
            factors.append(FactorScore(
                name=name, normalized=0.0,
                weight=getattr(weights, name), effective_weight=0.0, present=False,
            ))
        return ReadinessResult(score=None, factors=factors, factors_present=0, factors_total=6)

    eff_weights = redistribute_weights(weights, presence)

    norm_map = {
        "hrv_trend": hrv_norm,
        "resting_hr_trend": rhr_norm,
        "sleep_duration": sleep_dur_norm,
        "sleep_quality": sq_norm,
        "soreness": sore_norm,
        "stress": stress_norm,
    }

    raw = 0.0
    for name in FACTOR_NAMES:
        w = getattr(weights, name)
        ew = eff_weights[name]
        n = norm_map[name]
        p = presence[name]
        factors.append(FactorScore(name=name, normalized=n, weight=w, effective_weight=ew, present=p))
        if p:
            raw += n * ew

    # Clamp final score to [0, 100]
    score = max(0, min(round(raw * 100), 100))
    logger.debug(
        "Readiness computed: score=%d, factors_present=%d/%d, raw=%.4f",
        score, factors_present, 6, raw,
    )
    return ReadinessResult(score=score, factors=factors, factors_present=factors_present, factors_total=6)
