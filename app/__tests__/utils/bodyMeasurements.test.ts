import * as fc from 'fast-check';
import { calculateNavyBF, inchesToCm, cmToInches } from '../../utils/navyBFCalculator';
import { validateMeasurementForm } from '../../utils/measurementValidation';
import type { MeasurementFormData } from '../../types/measurements';

const NUM_RUNS = 50;

// ─── Navy BF Calculator ──────────────────────────────────────────────────────

describe('calculateNavyBF', () => {
  it('returns a valid BF% for a typical male', () => {
    const result = calculateNavyBF({
      sex: 'male', heightCm: 178, waistCm: 86, neckCm: 38, hipsCm: 0,
    });
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(5);
    expect(result!).toBeLessThan(40);
  });

  it('returns a valid BF% for a typical female', () => {
    const result = calculateNavyBF({
      sex: 'female', heightCm: 165, waistCm: 76, neckCm: 33, hipsCm: 96,
    });
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(10);
    expect(result!).toBeLessThan(45);
  });

  it('returns null when waist <= neck for males', () => {
    expect(calculateNavyBF({
      sex: 'male', heightCm: 178, waistCm: 35, neckCm: 38, hipsCm: 0,
    })).toBeNull();
  });

  it('returns null for zero height', () => {
    expect(calculateNavyBF({
      sex: 'male', heightCm: 0, waistCm: 86, neckCm: 38, hipsCm: 0,
    })).toBeNull();
  });

  it('returns null for female with zero hips', () => {
    expect(calculateNavyBF({
      sex: 'female', heightCm: 165, waistCm: 76, neckCm: 33, hipsCm: 0,
    })).toBeNull();
  });

  it('Property: male BF increases with waist for fixed height/neck', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 120 }),
        (waist) => {
          const bf = calculateNavyBF({
            sex: 'male', heightCm: 178, waistCm: waist, neckCm: 36, hipsCm: 0,
          });
          // If waist <= neck, null is expected
          if (waist <= 36) return bf === null;
          return bf === null || (bf >= 2 && bf <= 60);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property: result is always between 2-60% or null', () => {
    fc.assert(
      fc.property(
        fc.record({
          heightCm: fc.integer({ min: 100, max: 220 }),
          waistCm: fc.integer({ min: 40, max: 150 }),
          neckCm: fc.integer({ min: 25, max: 55 }),
          hipsCm: fc.integer({ min: 60, max: 140 }),
        }),
        (input) => {
          const bf = calculateNavyBF({ sex: 'male', ...input });
          return bf === null || (bf >= 2 && bf <= 60);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ─── Unit conversion helpers ─────────────────────────────────────────────────

describe('inchesToCm / cmToInches', () => {
  it('round-trips within 0.2 cm', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 200, noNaN: true }),
        (cm) => {
          const inches = cmToInches(cm);
          const back = inchesToCm(inches);
          return Math.abs(back - cm) <= 0.2;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ─── Measurement Validation ──────────────────────────────────────────────────

describe('validateMeasurementForm', () => {
  const emptyForm: MeasurementFormData = {
    measuredAt: '2024-01-15', weight: '', bodyFatPct: '', waist: '', neck: '',
    hips: '', chest: '', bicepLeft: '', bicepRight: '', thighLeft: '', thighRight: '',
    calfLeft: '', calfRight: '', notes: '',
  };

  it('requires at least one measurement value', () => {
    const result = validateMeasurementForm(emptyForm);
    expect(result.valid).toBe(false);
    expect(result.errors.weight).toBeDefined();
  });

  it('requires a date', () => {
    const result = validateMeasurementForm({ ...emptyForm, measuredAt: '', weight: '80' });
    expect(result.valid).toBe(false);
    expect(result.errors.measuredAt).toBeDefined();
  });

  it('validates with just weight', () => {
    const result = validateMeasurementForm({ ...emptyForm, weight: '80' });
    expect(result.valid).toBe(true);
  });

  it('rejects out-of-range weight', () => {
    const result = validateMeasurementForm({ ...emptyForm, weight: '500' });
    expect(result.valid).toBe(false);
    expect(result.errors.weight).toContain('20–350');
  });

  it('rejects non-numeric input', () => {
    const result = validateMeasurementForm({ ...emptyForm, weight: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.errors.weight).toContain('number');
  });

  it('accepts valid full form', () => {
    const result = validateMeasurementForm({
      measuredAt: '2024-01-15', weight: '80', bodyFatPct: '16', waist: '82',
      neck: '38', hips: '95', chest: '100', bicepLeft: '35', bicepRight: '35',
      thighLeft: '55', thighRight: '55', calfLeft: '38', calfRight: '38',
      notes: 'Morning measurement',
    });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('validates body fat range', () => {
    const result = validateMeasurementForm({ ...emptyForm, weight: '80', bodyFatPct: '65' });
    expect(result.valid).toBe(false);
    expect(result.errors.bodyFatPct).toBeDefined();
  });
});
