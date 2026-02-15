const SEMANTIC_WARNING = '#F59E0B';

export interface BarFill {
  percentage: number;
  fillWidth: string;
  fillColor: string;
  label: string;
}

/**
 * Computes the fill state for a horizontal progress bar.
 * - target <= 0 → 0%
 * - value > target → capped at 100%, warning color
 * - otherwise → proportional fill with the given color
 */
export function computeBarFill(
  value: number,
  target: number,
  color: string,
): BarFill {
  const percentage = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0;
  const fillWidth = percentage + '%';
  const fillColor = value > target ? SEMANTIC_WARNING : color;
  const label = percentage + '%';

  return { percentage, fillWidth, fillColor, label };
}
