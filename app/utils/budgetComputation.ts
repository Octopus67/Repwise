/**
 * Budget computation — remaining macros, progress ratio, over-target color.
 *
 * Pure functions — no React Native imports.
 */

import { colors } from '../theme/tokens';

export interface MacroValues {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * Compute remaining budget: target - consumed for each macro.
 */
export function computeRemaining(targets: MacroValues, consumed: MacroValues): MacroValues {
  return {
    calories: targets.calories - consumed.calories,
    protein_g: targets.protein_g - consumed.protein_g,
    carbs_g: targets.carbs_g - consumed.carbs_g,
    fat_g: targets.fat_g - consumed.fat_g,
  };
}

/**
 * Compute progress ratio clamped to [0, 1].
 */
export function computeProgressRatio(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.max(consumed / target, 0), 1);
}

/**
 * Return overTarget color if value exceeds target, else the standard color.
 */
export function getOverTargetColor(
  value: number,
  target: number,
  standardColor: string,
): string {
  if (value > target) return colors.semantic.overTarget;
  return standardColor;
}
