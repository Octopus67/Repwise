"""Combined Recovery Score — pure computation function.

Merges readiness score (0-100) with fatigue scores into a single
recovery metric and volume multiplier for training recommendations.

All functions are deterministic with zero side effects.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class CombinedConfig:
    readiness_weight: float = 0.6  # readiness matters more than fatigue


@dataclass(frozen=True)
class CombinedFactor:
    name: str
    value: float
    source: str  # "readiness" or "fatigue"


@dataclass(frozen=True)
class CombinedRecoveryResult:
    score: int  # 0-100
    volume_multiplier: float  # 0.5-1.2
    label: str  # "Ready to Push", "Train Smart", "Recovery Day"
    factors: List[CombinedFactor]


def compute_combined_recovery(
    readiness_score: Optional[int],
    fatigue_scores: Optional[List] = None,
    config: CombinedConfig = CombinedConfig(),
) -> CombinedRecoveryResult:
    """Compute a combined recovery score from readiness and fatigue data.

    Formula:
        combined = readiness_weight * readiness + (1 - readiness_weight) * (100 - avg_fatigue)

    If readiness is None, uses fatigue-only mode (weight=0.0 for readiness).
    If both are absent, returns a neutral score of 50.
    """
    factors: List[CombinedFactor] = []

    # Compute average fatigue (0-100, higher = more fatigued)
    avg_fatigue: Optional[float] = None
    if fatigue_scores:
        fatigue_vals = []
        for fs in fatigue_scores:
            score_val = getattr(fs, "score", None)
            if score_val is not None:
                fatigue_vals.append(float(score_val))
                factors.append(CombinedFactor(
                    name=getattr(fs, "muscle_group", "unknown"),
                    value=float(score_val),
                    source="fatigue",
                ))
        if fatigue_vals:
            avg_fatigue = sum(fatigue_vals) / len(fatigue_vals)

    # Add readiness factor
    if readiness_score is not None:
        factors.append(CombinedFactor(
            name="readiness",
            value=float(readiness_score),
            source="readiness",
        ))

    # Compute combined score
    if readiness_score is not None and avg_fatigue is not None:
        rw = config.readiness_weight
        combined = rw * readiness_score + (1 - rw) * (100 - avg_fatigue)
    elif readiness_score is not None:
        combined = float(readiness_score)
    elif avg_fatigue is not None:
        combined = 100 - avg_fatigue
    else:
        combined = 50.0

    # Clamp to [0, 100]
    combined = max(0.0, min(100.0, combined))
    score = round(combined)

    # Volume multiplier: 0.5 + (combined / 100) * 0.7 → range [0.5, 1.2]
    volume_multiplier = round(0.5 + (combined / 100.0) * 0.7, 2)
    volume_multiplier = max(0.5, min(1.2, volume_multiplier))

    # Label
    if score >= 70:
        label = "Ready to Push"
    elif score >= 40:
        label = "Train Smart"
    else:
        label = "Recovery Day"

    return CombinedRecoveryResult(
        score=score,
        volume_multiplier=volume_multiplier,
        label=label,
        factors=factors,
    )
