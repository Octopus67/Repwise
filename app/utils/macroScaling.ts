/**
 * Macro scaling utility for nutrition entries.
 * Extracted to avoid circular dependency between AddNutritionModal and RecipeTab.
 */

import { Macros } from '../types/nutrition';
export type { Macros };

/**
 * Scale macros by a multiplier (e.g., for serving size adjustments).
 */
export function scaleMacros(base: Macros, multiplier: number): Macros {
  return {
    calories: base.calories * multiplier,
    protein_g: base.protein_g * multiplier,
    carbs_g: base.carbs_g * multiplier,
    fat_g: base.fat_g * multiplier,
  };
}
