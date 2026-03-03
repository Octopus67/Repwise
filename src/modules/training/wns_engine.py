"""Weekly Net Stimulus (WNS) volume calculation engine.

Pure-function module for computing stimulating reps, applying diminishing returns,
and calculating atrophy between sessions. Zero database dependencies.
"""

from __future__ import annotations

# ─── Module Constants ─────────────────────────────────────────────────────────

MAX_STIM_REPS: float = 5.0
DEFAULT_RIR: float = 3.0  # Assumes RPE 7 when user doesn't log RPE/RIR
DIMINISHING_K: float = 1.69  # Fitted to Schoenfeld meta-analysis: 6 sets ≈ 2x stimulus of 1 set
DEFAULT_STIMULUS_DURATION_DAYS: float = 2.0
DEFAULT_MAINTENANCE_SETS: float = 3.0


# ─── Pure Functions ───────────────────────────────────────────────────────────


def rir_from_rpe(rpe: float | None) -> float:
    """Convert RPE to RIR (Reps in Reserve).
    
    Args:
        rpe: RPE value (1-10 scale) or None
        
    Returns:
        RIR value. None → DEFAULT_RIR. Clamps RPE to [1, 10].
        Returns max(0, 10 - clamped_rpe).
    """
    if rpe is None:
        return DEFAULT_RIR
    clamped_rpe = max(1.0, min(float(rpe), 10.0))
    return max(0.0, 10.0 - clamped_rpe)


def stimulating_reps_per_set(
    reps: int, rir: float | None, intensity_pct: float | None
) -> float:
    """Calculate stimulating reps for a single set.
    
    Args:
        reps: Number of reps performed
        rir: Reps in reserve (None → DEFAULT_RIR)
        intensity_pct: Load intensity as percentage (None/0 → 0.75)
        
    Returns:
        Number of stimulating reps for this set
    """
    if rir is None:
        rir = DEFAULT_RIR
    if intensity_pct is None or intensity_pct == 0:
        intensity_pct = 0.75

    # Guard against invalid reps
    if reps <= 0:
        return 0.0
        
    # Heavy load (≥85%) - all reps are stimulating up to max
    if intensity_pct >= 0.85:
        return min(float(reps), MAX_STIM_REPS)
    
    # RIR-based calculation for moderate loads
    if rir >= 4:
        return 0.0
    elif rir >= 3:
        return min(2.0, float(reps))
    elif rir >= 2:
        return min(3.0, float(reps))
    elif rir >= 1:
        return min(4.0, float(reps))
    else:  # rir < 1 (at failure)
        return min(MAX_STIM_REPS, float(reps))


def diminishing_returns(ordered_stim_reps: list[float]) -> float:
    """Apply diminishing returns curve to ordered stimulating reps.
    
    Args:
        ordered_stim_reps: List of stimulating reps per set, in order performed
        
    Returns:
        Total stimulus after applying diminishing returns
    """
    total = 0.0
    for i, stim_reps in enumerate(ordered_stim_reps):
        factor = 1.0 / (1.0 + DIMINISHING_K * i)
        total += stim_reps * factor
    return total


def atrophy_between_sessions(
    gap_days: float,
    stimulus_duration_days: float = DEFAULT_STIMULUS_DURATION_DAYS,
    maintenance_sets_per_week: float = DEFAULT_MAINTENANCE_SETS,
) -> float:
    """Calculate atrophy between training sessions.
    
    Args:
        gap_days: Days between sessions
        stimulus_duration_days: How long stimulus lasts
        maintenance_sets_per_week: Sets needed per week to maintain
        
    Returns:
        Atrophy amount (sets lost)
    """
    atrophy_days = max(0.0, gap_days - stimulus_duration_days)
    daily_atrophy_rate = maintenance_sets_per_week / 7.0
    return atrophy_days * daily_atrophy_rate


def compute_session_muscle_stimulus(
    sets_data: list[dict],
    muscle_group: str,
    exercise_coefficients: dict[str, dict[str, float]],
) -> float:
    """Compute total muscle stimulus for a session.
    
    Args:
        sets_data: List of set dicts with keys: exercise_id, reps, rir (or rpe), 
                  intensity_pct, set_type
        muscle_group: Target muscle group
        exercise_coefficients: Dict mapping exercise_id to muscle coefficients
        
    Returns:
        Total stimulus for the muscle group after diminishing returns
    """
    stim_reps_list: list[float] = []
    
    for set_data in sets_data:
        # Skip warm-up sets
        if set_data.get("set_type") == "warm-up":
            continue
            
        exercise_id = set_data.get("exercise_id", "")
        reps = set_data.get("reps", 0)
        rir = set_data.get("rir")
        rpe = set_data.get("rpe")
        intensity_pct = set_data.get("intensity_pct")
        
        # Convert RPE to RIR if needed
        if rir is None and rpe is not None:
            rir = rir_from_rpe(rpe)
            
        # Get coefficient for this muscle group
        coefficients = exercise_coefficients.get(exercise_id, {})
        coefficient = coefficients.get(muscle_group, 0.0)
        
        if coefficient > 0.0:
            stim_reps = stimulating_reps_per_set(reps, rir, intensity_pct)
            weighted_stim_reps = stim_reps * coefficient
            stim_reps_list.append(weighted_stim_reps)
    
    return diminishing_returns(stim_reps_list)