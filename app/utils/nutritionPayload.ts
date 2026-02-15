/**
 * Pure function to build a nutrition entry payload with correct field names
 * for the backend NutritionEntryCreate schema.
 */
export function buildNutritionPayload(
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  notes: string,
) {
  return {
    entry_date: new Date().toISOString().split('T')[0],
    meal_name: notes.trim() || 'Quick entry',
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
  };
}
