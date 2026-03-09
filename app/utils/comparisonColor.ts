;
import { getThemeColors, type ThemeColors } from '../hooks/useThemeColors';

/**
 * Returns a semantic color based on how close `actual` is to `target`.
 * - [90, 110]%  → positive (green)
 * - [70, 89]% or [111, 130]% → warning (amber)
 * - <70% or >130% → negative (red)
 * - target=0 → muted (grey)
 */
export function getComparisonColor(actual: number, target: number, c: ThemeColors = getThemeColors()): string {
  if (target <= 0) return c.text.muted;

  const percentage = Math.round((actual / target) * 100);

  if (percentage >= 90 && percentage <= 110) return c.semantic.positive;
  if ((percentage >= 70 && percentage <= 89) || (percentage >= 111 && percentage <= 130)) return c.semantic.warning;
  return c.semantic.negative;
}
