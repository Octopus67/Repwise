/**
 * Fatigue score color and label mapping utilities.
 * All functions clamp inputs to [0, 100] and guard against NaN/undefined.
 */

import { getThemeColors, type ThemeColors } from '../hooks/useThemeColors';

export function getFatigueColor(score: number, c: ThemeColors = getThemeColors()): string {
  const s = clampScore(score);
  if (s <= 30) return c.semantic.positive;
  if (s <= 60) return c.semantic.warning;
  return c.semantic.negative;
}

export function getFatigueLabel(score: number): string {
  const s = clampScore(score);
  if (s <= 30) return 'Low';
  if (s <= 60) return 'Moderate';
  return 'High';
}

function clampScore(score: number): number {
  if (typeof score !== 'number' || Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(score, 100));
}
