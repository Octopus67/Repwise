/**
 * Pure meal prep utility functions — mirrors backend logic for real-time UI.
 */

export interface MacroSummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealAssignment {
  slot: string;
  food_item_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  scale_factor: number;
  is_recipe: boolean;
}

export interface Ingredient {
  food_item_id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ScaledIngredient {
  food_item_id: string;
  name: string;
  original_quantity: number;
  scaled_quantity: number;
  unit: string;
}

/**
 * Compute scale factor. Throws if original <= 0. Returns 0 if target is not finite.
 */
export function computeScaleFactor(original: number, target: number): number {
  if (original <= 0) {
    throw new Error(`Cannot scale from non-positive value: ${original}`);
  }
  if (!Number.isFinite(target)) {
    return 0;
  }
  return target / original;
}

/**
 * Scale all ingredient quantities by the given factor.
 */
export function scaleIngredients(
  ingredients: Ingredient[],
  factor: number,
): ScaledIngredient[] {
  return ingredients.map((ing) => ({
    food_item_id: ing.food_item_id,
    name: ing.name,
    original_quantity: ing.quantity,
    scaled_quantity: Math.round(ing.quantity * factor * 100) / 100,
    unit: ing.unit,
  }));
}

/**
 * Sum macros across all assignments for a single day.
 * Guards against NaN/Infinity in individual assignment values.
 */
export function computeDaySummary(assignments: MealAssignment[]): MacroSummary {
  return {
    calories: round2(assignments.reduce((s, a) => s + (Number.isFinite(a.calories) ? a.calories : 0), 0)),
    protein_g: round2(assignments.reduce((s, a) => s + (Number.isFinite(a.protein_g) ? a.protein_g : 0), 0)),
    carbs_g: round2(assignments.reduce((s, a) => s + (Number.isFinite(a.carbs_g) ? a.carbs_g : 0), 0)),
    fat_g: round2(assignments.reduce((s, a) => s + (Number.isFinite(a.fat_g) ? a.fat_g : 0), 0)),
  };
}

/**
 * Sum macros across all day summaries for the week.
 * Guards against NaN/Infinity in individual day values.
 */
export function computeWeeklySummary(daySummaries: MacroSummary[]): MacroSummary {
  return {
    calories: round2(daySummaries.reduce((s, d) => s + (Number.isFinite(d.calories) ? d.calories : 0), 0)),
    protein_g: round2(daySummaries.reduce((s, d) => s + (Number.isFinite(d.protein_g) ? d.protein_g : 0), 0)),
    carbs_g: round2(daySummaries.reduce((s, d) => s + (Number.isFinite(d.carbs_g) ? d.carbs_g : 0), 0)),
    fat_g: round2(daySummaries.reduce((s, d) => s + (Number.isFinite(d.fat_g) ? d.fat_g : 0), 0)),
  };
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
