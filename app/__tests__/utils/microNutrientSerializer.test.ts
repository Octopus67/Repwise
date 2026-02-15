import * as fc from 'fast-check';
import {
  serializeMicroNutrients,
  countFilledFields,
  MICRO_FIELDS,
  groupMicroFields,
} from '../../utils/microNutrientSerializer';

// Feature: competitive-parity-v1, Property 21: Expanded nutrient set coverage
// Validates: Requirements 11.1.1

const REQUIRED_KEYS = [
  'vitamin_a_mcg', 'vitamin_c_mg', 'vitamin_d_mcg', 'vitamin_e_mg', 'vitamin_k_mcg',
  'thiamin_mg', 'riboflavin_mg', 'niacin_mg', 'pantothenic_acid_mg', 'vitamin_b6_mg',
  'biotin_mcg', 'folate_mcg', 'vitamin_b12_mcg',
  'calcium_mg', 'iron_mg', 'zinc_mg', 'magnesium_mg', 'potassium_mg',
  'selenium_mcg', 'sodium_mg', 'phosphorus_mg', 'manganese_mg', 'copper_mg',
  'omega_3_g', 'omega_6_g', 'cholesterol_mg', 'fibre_g',
];

const VALID_GROUPS = ['vitamins', 'minerals', 'fatty_acids', 'other'];

describe('Property 21: Expanded nutrient set coverage', () => {
  it('MICRO_FIELDS has exactly 27 entries', () => {
    expect(MICRO_FIELDS.length).toBe(27);
  });

  it('every entry has non-empty key, label, unit, and valid group', () => {
    for (const field of MICRO_FIELDS) {
      expect(field.key.length).toBeGreaterThan(0);
      expect(field.label.length).toBeGreaterThan(0);
      expect(field.unit.length).toBeGreaterThan(0);
      expect(VALID_GROUPS).toContain(field.group);
    }
  });

  it('all keys are unique', () => {
    const keys = MICRO_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('contains all required nutrient keys', () => {
    const keys = new Set(MICRO_FIELDS.map((f) => f.key));
    for (const required of REQUIRED_KEYS) {
      expect(keys.has(required)).toBe(true);
    }
  });

  it('groupMicroFields returns 4 sections covering all fields', () => {
    const sections = groupMicroFields();
    expect(sections.length).toBe(4);
    const totalFields = sections.reduce((sum, s) => sum + s.data.length, 0);
    expect(totalFields).toBe(27);
  });
});

/**
 * Property 6: Micronutrient, fibre, and water serialization
 * Validates: Requirements 5.2, 5.4, 5.9, 5.10
 */
describe('Property 6: Micronutrient, fibre, and water serialization', () => {
  const microKeyArb = fc.constantFrom(...MICRO_FIELDS.map((f) => f.key));
  const positiveFloatStr = fc.integer({ min: 1, max: 50000 }).map((v) => String(v / 10));

  it('water_ml equals glasses * 250 when glasses > 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (glasses) => {
        const result = serializeMicroNutrients({}, '', glasses);
        expect(result.water_ml).toBe(glasses * 250);
      }),
      { numRuns: 200 },
    );
  });

  it('water_ml absent when glasses is 0', () => {
    const result = serializeMicroNutrients({}, '', 0);
    expect(result.water_ml).toBeUndefined();
  });

  it('fibre_g present when fibre string is a positive number', () => {
    fc.assert(
      fc.property(positiveFloatStr, (fibreStr) => {
        const result = serializeMicroNutrients({}, fibreStr, 0);
        const expected = parseFloat(fibreStr);
        if (!isNaN(expected) && expected > 0) {
          expect(result.fibre_g).toBe(expected);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('fibre_g absent when fibre string is empty or zero', () => {
    expect(serializeMicroNutrients({}, '', 0).fibre_g).toBeUndefined();
    expect(serializeMicroNutrients({}, '0', 0).fibre_g).toBeUndefined();
    expect(serializeMicroNutrients({}, 'abc', 0).fibre_g).toBeUndefined();
  });

  it('includes all positive micro values and excludes zero/empty/NaN', () => {
    fc.assert(
      fc.property(
        fc.dictionary(microKeyArb, fc.oneof(positiveFloatStr, fc.constant(''), fc.constant('0'), fc.constant('abc'))),
        fc.integer({ min: 0, max: 12 }),
        (micros, glasses) => {
          const result = serializeMicroNutrients(micros, '', glasses);
          for (const [key, val] of Object.entries(micros)) {
            const num = parseFloat(val);
            if (!isNaN(num) && num > 0) {
              expect(result[key]).toBe(num);
            } else {
              expect(result[key]).toBeUndefined();
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 9: Filled micronutrient field count
 * Validates: Requirements 5.2, 5.4, 5.9, 5.10
 */
describe('Property 9: Filled micronutrient field count', () => {
  const microKeyArb = fc.constantFrom(...MICRO_FIELDS.map((f) => f.key));
  const valueArb = fc.oneof(
    fc.integer({ min: 1, max: 50000 }).map((v) => String(v / 10)),
    fc.constant(''),
    fc.constant('0'),
    fc.constant('abc'),
  );

  it('countFilledFields equals count of non-empty non-zero values', () => {
    fc.assert(
      fc.property(fc.dictionary(microKeyArb, valueArb), (micros) => {
        const count = countFilledFields(micros);
        const expected = Object.values(micros).filter((v) => {
          const n = parseFloat(v);
          return !isNaN(n) && n > 0;
        }).length;
        expect(count).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('returns 0 for empty record', () => {
    expect(countFilledFields({})).toBe(0);
  });

  it('returns 0 when all values are empty strings', () => {
    const micros: Record<string, string> = {};
    MICRO_FIELDS.forEach((f) => { micros[f.key] = ''; });
    expect(countFilledFields(micros)).toBe(0);
  });
});
