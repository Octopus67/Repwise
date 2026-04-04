/**
 * Canonical nutrition types — single source of truth.
 *
 * Previously duplicated across 6+ files. Any new nutrition-related
 * type should be added here.
 */

export interface MicroNutrients {
  [key: string]: number | string | boolean | null | undefined | ServingOptionRaw[];
  fibre_g?: number;
  water_ml?: number;
  _serving_options?: ServingOptionRaw[];
}

interface ServingOptionRaw {
  label: string;
  grams: number;
  is_default?: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
  source?: 'usda' | 'verified' | 'community' | 'custom';
  micro_nutrients?: MicroNutrients | null;
  is_recipe?: boolean;
  total_servings?: number | null;
  barcode?: string;
  frequency?: number;
}

export interface NutritionEntry {
  id?: string;
  meal_name?: string;
  food_name?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entry_date: string;
  created_at?: string | null;
  micro_nutrients?: Record<string, number> | null;
}

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MacroValues {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealFavorite {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
