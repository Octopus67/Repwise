/**
 * Serving option utilities for multi-unit food serving support.
 *
 * Each food item can define custom serving options (e.g. "1 piece", "1 katori").
 * This module builds the full option list and handles nutrition scaling.
 */

export interface ServingOption {
  label: string; // e.g. "1 piece", "1 cup", "100g", "1 oz"
  grams: number; // gram equivalent of this serving
  isDefault?: boolean; // which option is selected by default
}

// Standard options available for all foods
export const UNIVERSAL_OPTIONS: ServingOption[] = [
  { label: '1 oz', grams: 28.35 },
];

/**
 * Convert a nutrition value from the base serving to a selected serving.
 * E.g. if base is 100g and selected is 150g, a value of 200 kcal becomes 300 kcal.
 */
export function scaleToServing(
  baseServingGrams: number,
  selectedServingGrams: number,
  value: number,
): number {
  if (baseServingGrams <= 0) return value;
  return Math.round(((value * selectedServingGrams) / baseServingGrams) * 10) / 10;
}

/**
 * Build the full list of serving options for a food item.
 *
 * @param servingSize - the food's base serving size in grams/ml
 * @param servingUnit - the food's base serving unit (g, ml, etc.)
 * @param customOptions - optional custom options from the food's data (e.g. "1 piece", "1 katori")
 */
export function buildServingOptions(
  servingSize: number,
  servingUnit: string,
  customOptions?: ServingOption[],
): ServingOption[] {
  const options: ServingOption[] = [];

  // Add custom options (e.g. "1 piece", "1 katori") — these come from the food data
  if (customOptions) {
    options.push(...customOptions);
  }

  // Add the base serving as default if no custom option is marked default
  const hasDefault = options.some((o) => o.isDefault);
  if (!hasDefault) {
    const baseGrams = servingSize > 0 ? servingSize : 100;
    options.unshift({
      label: `${baseGrams}${servingUnit}`,
      grams: baseGrams,
      isDefault: true,
    });
  }

  // Add gram option if not already present
  if (!options.some((o) => o.label === 'g' || o.label.endsWith('g)'))) {
    options.push({ label: 'Custom (g)', grams: 1 }); // 1g = user enters grams directly
  }

  // Add universal options, deduplicating by label
  const existingLabels = new Set(options.map(o => o.label));
  for (const u of UNIVERSAL_OPTIONS) {
    if (!existingLabels.has(u.label)) {
      options.push(u);
    }
  }

  return options;
}
