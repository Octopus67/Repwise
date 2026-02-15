export type NutrientGroup = 'vitamins' | 'minerals' | 'fatty_acids' | 'other';

export interface MicroField {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly group: NutrientGroup;
}

export const MICRO_FIELDS: readonly MicroField[] = [
  // Vitamins (13)
  { key: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'mcg', group: 'vitamins' },
  { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg', group: 'vitamins' },
  { key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg', group: 'vitamins' },
  { key: 'vitamin_e_mg', label: 'Vitamin E', unit: 'mg', group: 'vitamins' },
  { key: 'vitamin_k_mcg', label: 'Vitamin K', unit: 'mcg', group: 'vitamins' },
  { key: 'thiamin_mg', label: 'Thiamin (B1)', unit: 'mg', group: 'vitamins' },
  { key: 'riboflavin_mg', label: 'Riboflavin (B2)', unit: 'mg', group: 'vitamins' },
  { key: 'niacin_mg', label: 'Niacin (B3)', unit: 'mg', group: 'vitamins' },
  { key: 'pantothenic_acid_mg', label: 'Pantothenic Acid (B5)', unit: 'mg', group: 'vitamins' },
  { key: 'vitamin_b6_mg', label: 'Vitamin B6', unit: 'mg', group: 'vitamins' },
  { key: 'biotin_mcg', label: 'Biotin (B7)', unit: 'mcg', group: 'vitamins' },
  { key: 'folate_mcg', label: 'Folate (B9)', unit: 'mcg', group: 'vitamins' },
  { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg', group: 'vitamins' },
  // Minerals (10)
  { key: 'calcium_mg', label: 'Calcium', unit: 'mg', group: 'minerals' },
  { key: 'iron_mg', label: 'Iron', unit: 'mg', group: 'minerals' },
  { key: 'zinc_mg', label: 'Zinc', unit: 'mg', group: 'minerals' },
  { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg', group: 'minerals' },
  { key: 'potassium_mg', label: 'Potassium', unit: 'mg', group: 'minerals' },
  { key: 'selenium_mcg', label: 'Selenium', unit: 'mcg', group: 'minerals' },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg', group: 'minerals' },
  { key: 'phosphorus_mg', label: 'Phosphorus', unit: 'mg', group: 'minerals' },
  { key: 'manganese_mg', label: 'Manganese', unit: 'mg', group: 'minerals' },
  { key: 'copper_mg', label: 'Copper', unit: 'mg', group: 'minerals' },
  // Fatty Acids (2)
  { key: 'omega_3_g', label: 'Omega-3', unit: 'g', group: 'fatty_acids' },
  { key: 'omega_6_g', label: 'Omega-6', unit: 'g', group: 'fatty_acids' },
  // Other (2)
  { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg', group: 'other' },
  { key: 'fibre_g', label: 'Fibre', unit: 'g', group: 'other' },
] as const;

/** Set of all valid micro field keys for quick lookup */
const MICRO_KEY_SET = new Set(MICRO_FIELDS.map((f) => f.key));

export function serializeMicroNutrients(
  micros: Record<string, string>,
  fibreG: string,
  waterGlasses: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(micros)) {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) result[key] = num;
  }
  const fibre = parseFloat(fibreG);
  if (!isNaN(fibre) && fibre > 0) result.fibre_g = fibre;
  if (waterGlasses > 0) result.water_ml = waterGlasses * 250;
  return result;
}

export function countFilledFields(micros: Record<string, string>): number {
  return Object.values(micros).filter((v) => {
    const n = parseFloat(v);
    return !isNaN(n) && n > 0;
  }).length;
}

/** Group MICRO_FIELDS by their group for SectionList rendering */
export function groupMicroFields(): { title: string; data: MicroField[] }[] {
  const groups: Record<NutrientGroup, MicroField[]> = {
    vitamins: [],
    minerals: [],
    fatty_acids: [],
    other: [],
  };
  for (const field of MICRO_FIELDS) {
    groups[field.group].push(field);
  }
  return [
    { title: 'Vitamins', data: groups.vitamins },
    { title: 'Minerals', data: groups.minerals },
    { title: 'Fatty Acids', data: groups.fatty_acids },
    { title: 'Other', data: groups.other },
  ];
}
