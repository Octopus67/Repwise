// Semantic color constants matching the design token system
const POSITIVE = '#22C55E';
const WARNING = '#F59E0B';
const NEGATIVE = '#EF4444';
const MUTED = '#64748B';

/**
 * Returns a semantic color based on how close `actual` is to `target`.
 * - [90, 110]%  → positive (green)
 * - [70, 89]% or [111, 130]% → warning (amber)
 * - <70% or >130% → negative (red)
 * - target=0 → muted (grey)
 */
export function getComparisonColor(actual: number, target: number): string {
  if (target <= 0) return MUTED;

  const percentage = Math.round((actual / target) * 100);

  if (percentage >= 90 && percentage <= 110) return POSITIVE;
  if ((percentage >= 70 && percentage <= 89) || (percentage >= 111 && percentage <= 130)) return WARNING;
  return NEGATIVE;
}
