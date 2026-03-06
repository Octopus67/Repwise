/**
 * WNS Calculator — Client-side Hypertrophy Unit estimation
 *
 * Pure functions mirroring src/modules/training/wns_engine.py.
 * Used for real-time volume pill updates during active workouts.
 * Constants and logic MUST match the Python implementation exactly.
 */

// ─── Constants (must match wns_engine.py) ────────────────────────────────────

export const MAX_STIM_REPS = 5.0;
export const DEFAULT_RIR = 2.0; // RPE 8 when user doesn't log RPE/RIR (3 stimulating reps)
export const DIMINISHING_K = 0.96; // Average of Schoenfeld (K=1.69, 6 sets=2x) and Pelland (K=0.24, 6 sets=4x)
export const DEFAULT_STIMULUS_DURATION_DAYS = 2.0;
export const DEFAULT_MAINTENANCE_SETS = 3.0;
export const MAX_SETS_PER_SESSION_PER_MUSCLE = 10; // Beardsley: above 10 sets/session = negative effects

// ─── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Convert RPE to RIR. None → DEFAULT_RIR. Clamps RPE to [1, 10].
 */
export function rirFromRpe(rpe: number | null): number {
  if (rpe === null || rpe === undefined) return DEFAULT_RIR;
  const clamped = Math.max(1.0, Math.min(Number(rpe), 10.0));
  return Math.max(0.0, 10.0 - clamped);
}

/**
 * Calculate stimulating reps for a single set.
 *
 * Heavy loads (≥85% 1RM): all reps stimulating up to MAX_STIM_REPS.
 * Moderate loads: only final reps before failure count, based on RIR.
 * RIR ≥ 4: junk volume (0 stimulating reps).
 */
export function stimulatingRepsPerSet(
  reps: number,
  rir: number | null,
  intensityPct: number | null,
): number {
  const effectiveRir = rir === null || rir === undefined ? DEFAULT_RIR : rir;
  const effectiveIntensity =
    intensityPct === null || intensityPct === undefined || intensityPct === 0
      ? 0.75
      : intensityPct;

  if (reps <= 0) return 0.0;

  if (effectiveIntensity >= 0.85) {
    return Math.min(reps, MAX_STIM_REPS);
  }

  if (effectiveRir >= 4) return 0.0;
  if (effectiveRir >= 3) return Math.min(2.0, reps);
  if (effectiveRir >= 2) return Math.min(3.0, reps);
  if (effectiveRir >= 1) return Math.min(4.0, reps);
  return Math.min(MAX_STIM_REPS, reps);
}

/**
 * Apply diminishing returns curve to ordered stimulating reps.
 * Fitted to Schoenfeld meta-analysis: 6 sets ≈ 2× stimulus of 1 set.
 */
export function diminishingReturns(orderedStimReps: number[]): number {
  let total = 0.0;
  for (let i = 0; i < orderedStimReps.length; i++) {
    const factor = 1.0 / (1.0 + DIMINISHING_K * i);
    total += orderedStimReps[i] * factor;
  }
  return total;
}

/**
 * Estimate session HU for a muscle group from weighted stimulating reps.
 * Each entry is { stimReps, coefficient } where coefficient is 1.0 (direct)
 * or 0.5 (fractional).
 */
export function estimateSessionHU(
  sets: Array<{ stimReps: number; coefficient: number }>,
): number {
  const weighted = sets.map((s) => s.stimReps * s.coefficient);
  return diminishingReturns(weighted);
}
