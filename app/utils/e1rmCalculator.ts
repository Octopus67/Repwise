/**
 * Client-side e1RM (estimated 1-rep max) calculator.
 *
 * Uses the Epley formula: weight × (1 + reps / 30)
 * Mirrors the backend computation in e1rm_calculator.py.
 */

/** Maximum reps accepted by the calculator. */
export const MAX_REPS = 30;

/**
 * Compute estimated 1RM using the Epley formula.
 * - Returns 0 for any invalid input (NaN, Infinity, negative, reps > MAX_REPS)
 * - reps === 0 or weightKg === 0: returns 0
 * - reps === 1: returns weightKg as-is
 */
export function computeE1RM(weightKg: number, reps: number): number {
  // Guard against NaN, Infinity, and negative values
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0;
  if (weightKg < 0 || reps < 0) return 0;
  if (reps > MAX_REPS) return 0;

  if (reps === 0 || weightKg === 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * Find the highest e1RM across a list of sets.
 * Returns null if no valid sets (weight_kg > 0 and reps in [1, MAX_REPS]).
 */
export function bestE1RMForExercise(
  sets: Array<{ weight_kg: number; reps: number }>,
): number | null {
  let best: number | null = null;

  for (const s of sets) {
    if (
      !Number.isFinite(s.weight_kg) ||
      !Number.isFinite(s.reps) ||
      s.weight_kg <= 0 ||
      s.reps <= 0 ||
      s.reps > MAX_REPS
    ) {
      continue;
    }
    const e1rm = computeE1RM(s.weight_kg, s.reps);
    if (best === null || e1rm > best) {
      best = e1rm;
    }
  }

  return best;
}
