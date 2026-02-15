/**
 * Meal slot assignment and grouping logic.
 *
 * Pure functions — no React Native imports.
 */

export type MealSlotName = 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';

export interface NutritionEntry {
  id: string;
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entry_date: string;
  created_at?: string | null;
  micro_nutrients?: Record<string, number> | null;
}

export interface SlotTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealSlotData {
  name: MealSlotName;
  entries: NutritionEntry[];
  totals: SlotTotals;
}

const SLOT_ORDER: MealSlotName[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

/**
 * Assign a meal slot based on the meal_name field.
 * Case-insensitive substring matching; defaults to Snack.
 */
export function assignMealSlot(mealName: string): MealSlotName {
  const lower = mealName.toLowerCase();
  if (lower.includes('breakfast')) return 'Breakfast';
  if (lower.includes('lunch')) return 'Lunch';
  if (lower.includes('dinner')) return 'Dinner';
  return 'Snack';
}

/**
 * Group entries into the 4 meal slots with per-slot totals.
 */
export function groupEntriesBySlot(entries: NutritionEntry[]): MealSlotData[] {
  const groups: Record<MealSlotName, NutritionEntry[]> = {
    Breakfast: [],
    Lunch: [],
    Snack: [],
    Dinner: [],
  };

  for (const entry of entries) {
    const slot = assignMealSlot(entry.meal_name);
    groups[slot].push(entry);
  }

  return SLOT_ORDER.map((name) => ({
    name,
    entries: groups[name],
    totals: computeSlotTotals(groups[name]),
  }));
}

/**
 * Sum calories and macros for a list of entries.
 */
export function computeSlotTotals(entries: NutritionEntry[]): SlotTotals {
  let calories = 0;
  let protein_g = 0;
  let carbs_g = 0;
  let fat_g = 0;

  for (const e of entries) {
    calories += e.calories;
    protein_g += e.protein_g;
    carbs_g += e.carbs_g;
    fat_g += e.fat_g;
  }

  return { calories, protein_g, carbs_g, fat_g };
}
