/**
 * Recommended Daily Allowance (RDA) values for 27 tracked nutrients.
 * Source: NIH Office of Dietary Supplements — Dietary Reference Intakes (DRIs)
 * https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx
 *
 * Where no RDA is established, Adequate Intake (AI) values are used.
 * Values are for adults only (19+). Pregnancy/lactation not included.
 */

export type AgeBracket = '19-30' | '31-50' | '51+';
export type Sex = 'male' | 'female';

export interface RDAEntry {
  male: Record<AgeBracket, number>;
  female: Record<AgeBracket, number>;
}

/**
 * RDA_TABLE maps nutrient keys to sex- and age-specific daily values.
 * Units match the corresponding MICRO_FIELDS entry.
 */
export const RDA_TABLE: Record<string, RDAEntry> = {
  // Vitamins
  vitamin_a_mcg: {
    male:   { '19-30': 900, '31-50': 900, '51+': 900 },
    female: { '19-30': 700, '31-50': 700, '51+': 700 },
  },
  vitamin_c_mg: {
    male:   { '19-30': 90, '31-50': 90, '51+': 90 },
    female: { '19-30': 75, '31-50': 75, '51+': 75 },
  },
  vitamin_d_mcg: {
    male:   { '19-30': 15, '31-50': 15, '51+': 20 },
    female: { '19-30': 15, '31-50': 15, '51+': 20 },
  },
  vitamin_e_mg: {
    male:   { '19-30': 15, '31-50': 15, '51+': 15 },
    female: { '19-30': 15, '31-50': 15, '51+': 15 },
  },
  vitamin_k_mcg: {
    // AI values (no RDA established)
    male:   { '19-30': 120, '31-50': 120, '51+': 120 },
    female: { '19-30': 90, '31-50': 90, '51+': 90 },
  },
  thiamin_mg: {
    male:   { '19-30': 1.2, '31-50': 1.2, '51+': 1.2 },
    female: { '19-30': 1.1, '31-50': 1.1, '51+': 1.1 },
  },
  riboflavin_mg: {
    male:   { '19-30': 1.3, '31-50': 1.3, '51+': 1.3 },
    female: { '19-30': 1.1, '31-50': 1.1, '51+': 1.1 },
  },
  niacin_mg: {
    male:   { '19-30': 16, '31-50': 16, '51+': 16 },
    female: { '19-30': 14, '31-50': 14, '51+': 14 },
  },
  pantothenic_acid_mg: {
    // AI values (no RDA established)
    male:   { '19-30': 5, '31-50': 5, '51+': 5 },
    female: { '19-30': 5, '31-50': 5, '51+': 5 },
  },
  vitamin_b6_mg: {
    male:   { '19-30': 1.3, '31-50': 1.3, '51+': 1.7 },
    female: { '19-30': 1.3, '31-50': 1.3, '51+': 1.5 },
  },
  biotin_mcg: {
    // AI values (no RDA established)
    male:   { '19-30': 30, '31-50': 30, '51+': 30 },
    female: { '19-30': 30, '31-50': 30, '51+': 30 },
  },
  folate_mcg: {
    male:   { '19-30': 400, '31-50': 400, '51+': 400 },
    female: { '19-30': 400, '31-50': 400, '51+': 400 },
  },
  vitamin_b12_mcg: {
    male:   { '19-30': 2.4, '31-50': 2.4, '51+': 2.4 },
    female: { '19-30': 2.4, '31-50': 2.4, '51+': 2.4 },
  },
  // Minerals
  calcium_mg: {
    male:   { '19-30': 1000, '31-50': 1000, '51+': 1200 },
    female: { '19-30': 1000, '31-50': 1000, '51+': 1200 },
  },
  iron_mg: {
    male:   { '19-30': 8, '31-50': 8, '51+': 8 },
    female: { '19-30': 18, '31-50': 18, '51+': 8 },
  },
  zinc_mg: {
    male:   { '19-30': 11, '31-50': 11, '51+': 11 },
    female: { '19-30': 8, '31-50': 8, '51+': 8 },
  },
  magnesium_mg: {
    male:   { '19-30': 400, '31-50': 420, '51+': 420 },
    female: { '19-30': 310, '31-50': 320, '51+': 320 },
  },
  potassium_mg: {
    // AI values
    male:   { '19-30': 3400, '31-50': 3400, '51+': 3400 },
    female: { '19-30': 2600, '31-50': 2600, '51+': 2600 },
  },
  selenium_mcg: {
    male:   { '19-30': 55, '31-50': 55, '51+': 55 },
    female: { '19-30': 55, '31-50': 55, '51+': 55 },
  },
  sodium_mg: {
    // AI values — upper limit is 2300mg, AI is 1500mg
    male:   { '19-30': 1500, '31-50': 1500, '51+': 1500 },
    female: { '19-30': 1500, '31-50': 1500, '51+': 1500 },
  },
  phosphorus_mg: {
    male:   { '19-30': 700, '31-50': 700, '51+': 700 },
    female: { '19-30': 700, '31-50': 700, '51+': 700 },
  },
  manganese_mg: {
    // AI values
    male:   { '19-30': 2.3, '31-50': 2.3, '51+': 2.3 },
    female: { '19-30': 1.8, '31-50': 1.8, '51+': 1.8 },
  },
  copper_mg: {
    male:   { '19-30': 0.9, '31-50': 0.9, '51+': 0.9 },
    female: { '19-30': 0.9, '31-50': 0.9, '51+': 0.9 },
  },
  // Fatty Acids
  omega_3_g: {
    // AI values (ALA)
    male:   { '19-30': 1.6, '31-50': 1.6, '51+': 1.6 },
    female: { '19-30': 1.1, '31-50': 1.1, '51+': 1.1 },
  },
  omega_6_g: {
    // AI values (linoleic acid)
    male:   { '19-30': 17, '31-50': 17, '51+': 14 },
    female: { '19-30': 12, '31-50': 12, '51+': 11 },
  },
  // Other
  cholesterol_mg: {
    // No RDA — use 300mg as general guideline (AHA recommendation)
    male:   { '19-30': 300, '31-50': 300, '51+': 300 },
    female: { '19-30': 300, '31-50': 300, '51+': 300 },
  },
  fibre_g: {
    // AI values
    male:   { '19-30': 38, '31-50': 38, '51+': 30 },
    female: { '19-30': 25, '31-50': 25, '51+': 21 },
  },
};

/** Map age to bracket. Clamps to 19+ (adult brackets only). */
export function getAgeBracket(age: number): AgeBracket {
  if (age <= 30) return '19-30';
  if (age <= 50) return '31-50';
  return '51+';
}

/** Get the RDA value for a nutrient given sex and age. Returns 0 if not found. */
export function getRDA(key: string, sex: Sex, age: number): number {
  const entry = RDA_TABLE[key];
  if (!entry) return 0;
  const bracket = getAgeBracket(age);
  return entry[sex]?.[bracket] ?? 0;
}

/** Compute intake as percentage of RDA. Returns 0 if rda <= 0. */
export function computeRDAPercentage(intake: number, rda: number): number {
  if (rda <= 0) return 0;
  return (intake / rda) * 100;
}

/** Color code based on RDA percentage: green ≥80%, yellow 50-79%, red <50%. */
export function rdaColor(percentage: number): 'green' | 'yellow' | 'red' {
  if (percentage >= 80) return 'green';
  if (percentage >= 50) return 'yellow';
  return 'red';
}
