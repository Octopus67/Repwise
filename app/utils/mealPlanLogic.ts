/**
 * Pure functions for meal plan aggregation.
 *
 * Feature: app-fixes-and-nutrition-v2
 */

export interface MealPlanItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_multiplier: number;
}

export function aggregateMealPlan(items: MealPlanItem[]): {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} {
  return items.reduce(
    (acc, item) => {
      const mult = Math.max(0, item.serving_multiplier ?? 1);
      return {
        calories: acc.calories + item.calories * mult,
        protein_g: acc.protein_g + item.protein_g * mult,
        carbs_g: acc.carbs_g + item.carbs_g * mult,
        fat_g: acc.fat_g + item.fat_g * mult,
      };
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}
