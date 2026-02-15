/**
 * Readiness score color and label utilities.
 * Pure functions — no side effects.
 */

/** Safely clamp a score to [0, 100], returning 0 for NaN/undefined. */
export function clampScore(score: number | null | undefined): number {
  if (score === null || score === undefined || Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(Math.round(score), 100));
}

export function getReadinessColor(score: number | null | undefined): string {
  const s = clampScore(score);
  if (s >= 70) return '#4CAF50';
  if (s >= 40) return '#FFC107';
  return '#F44336';
}

export function getReadinessLabel(score: number | null | undefined): string {
  const s = clampScore(score);
  if (s >= 70) return 'Good';
  if (s >= 40) return 'Moderate';
  return 'Low';
}

/** Safely normalize a factor value to [0, 1], returning 0 for NaN/undefined. */
export function safeNormalized(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(value, 1));
}
