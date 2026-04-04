import { getThemeColors } from '../hooks/useThemeColors';

export interface RingFill {
  percentage: number;
  fillColor: string;
  isOvershoot: boolean;
  isMissing: boolean;
}

export interface RingLabel {
  centerText: string;
  subText: string;
}

/**
 * Computes the fill state for a progress ring.
 * - target=0 → missing (ring won't render meaningfully)
 * - value > target → overshoot at 100%, warning color
 * - otherwise → proportional fill with the given color
 */
export function computeRingFill(
  value: number,
  target: number,
  color: string,
): RingFill {
  if (value < 0) value = 0;
  if (target === 0) {
    return { percentage: 0, fillColor: color, isOvershoot: false, isMissing: true };
  }

  if (value > target) {
    return { percentage: 100, fillColor: getThemeColors().semantic.overTarget, isOvershoot: true, isMissing: false };
  }

  return {
    percentage: Math.round((value / target) * 100),
    fillColor: color,
    isOvershoot: false,
    isMissing: false,
  };
}

/**
 * Formats the center and sub labels for a progress ring.
 */
export function formatRingLabel(
  value: number,
  target: number,
  unit: string,
): RingLabel {
  return {
    centerText: String(value),
    subText: `/ ${target} ${unit}`,
  };
}
