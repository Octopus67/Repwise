import * as fc from 'fast-check';
import {
  resolveScannerMode,
  shouldProcessScan,
  scaleBarcodeResult,
  isValidBarcode,
  isValidMultiplier,
} from '../../utils/barcodeUtils';

/**
 * Feature: camera-barcode-scanner, Property 1: Scanner mode selection
 * **Validates: Requirements 1.1, 1.2, 6.1**
 *
 * For any combination of feature flag state (enabled/disabled) and platform
 * (ios, android, web, windows, macos), resolveScannerMode returns 'camera'
 * if and only if the platform is mobile (ios or android) AND the flag is enabled.
 */
describe('Feature: camera-barcode-scanner, Property 1: Scanner mode selection', () => {
  const platformArb = fc.constantFrom('ios', 'android', 'web', 'windows', 'macos') as fc.Arbitrary<
    'ios' | 'android' | 'web' | 'windows' | 'macos'
  >;
  const flagArb = fc.boolean();

  const MOBILE_PLATFORMS = new Set(['ios', 'android']);

  it('returns camera iff platform is mobile AND flag is enabled', () => {
    fc.assert(
      fc.property(platformArb, flagArb, (platform, flagEnabled) => {
        const result = resolveScannerMode(platform, flagEnabled);
        const expectCamera = MOBILE_PLATFORMS.has(platform) && flagEnabled;

        if (expectCamera) {
          expect(result).toBe('camera');
        } else {
          expect(result).toBe('manual');
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: camera-barcode-scanner, Property 2: Scan debounce correctness
 * **Validates: Requirements 3.3**
 *
 * For any pair of timestamps (now, lastScanTime) where now >= 0 and
 * lastScanTime >= 0, and a debounce window debounceMs > 0,
 * shouldProcessScan(now, lastScanTime, debounceMs) returns true
 * if and only if now - lastScanTime >= debounceMs.
 */
describe('Feature: camera-barcode-scanner, Property 2: Scan debounce correctness', () => {
  it('returns true iff now - lastScanTime >= debounceMs', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        fc.integer({ min: 1 }),
        (now, lastScanTime, debounceMs) => {
          const result = shouldProcessScan(now, lastScanTime, debounceMs);
          const expected = now - lastScanTime >= debounceMs;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: camera-barcode-scanner, Property 3: Macro scaling correctness
 * **Validates: Requirements 4.3, 5.1**
 *
 * For any food item with non-negative macro values and any positive multiplier,
 * scaleBarcodeResult(food, multiplier) should produce:
 *   calories === Math.round(food.calories * multiplier)
 *   x_g === Math.round(food.x_g * multiplier * 10) / 10
 * Additionally, scaling by multiplier 1 returns original values (identity).
 */
describe('Feature: camera-barcode-scanner, Property 3: Macro scaling correctness', () => {
  const macroArb = fc.float({ min: 0, max: 10000, noNaN: true });
  const multiplierArb = fc.float({ min: Math.fround(0.01), max: 100, noNaN: true });

  const foodArb = fc.record({
    calories: macroArb,
    protein_g: macroArb,
    carbs_g: macroArb,
    fat_g: macroArb,
  });

  it('scaled fields match the rounding formula for any food and positive multiplier', () => {
    fc.assert(
      fc.property(foodArb, multiplierArb, (food, multiplier) => {
        const result = scaleBarcodeResult(food, multiplier);

        expect(result.calories).toBe(Math.round(food.calories * multiplier));
        expect(result.protein_g).toBeCloseTo(
          Math.round(food.protein_g * multiplier * 10) / 10,
          5,
        );
        expect(result.carbs_g).toBeCloseTo(
          Math.round(food.carbs_g * multiplier * 10) / 10,
          5,
        );
        expect(result.fat_g).toBeCloseTo(
          Math.round(food.fat_g * multiplier * 10) / 10,
          5,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('scaling by multiplier 1 returns original values (identity)', () => {
    fc.assert(
      fc.property(foodArb, (food) => {
        const result = scaleBarcodeResult(food, 1);

        expect(result.calories).toBe(Math.round(food.calories));
        expect(result.protein_g).toBeCloseTo(
          Math.round(food.protein_g * 10) / 10,
          5,
        );
        expect(result.carbs_g).toBeCloseTo(
          Math.round(food.carbs_g * 10) / 10,
          5,
        );
        expect(result.fat_g).toBeCloseTo(
          Math.round(food.fat_g * 10) / 10,
          5,
        );
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: camera-barcode-scanner, Property 4: Barcode format validation (client)
 * **Validates: Requirements 8.1, 6.3, 8.3**
 *
 * For any string s, isValidBarcode(s) returns true iff s consists entirely of
 * ASCII digits (0-9) and has length between 8 and 14 inclusive.
 * Must agree with the backend regex ^\d{8,14}$.
 */
describe('Feature: camera-barcode-scanner, Property 4: Barcode format validation', () => {
  const BARCODE_RE = /^\d{8,14}$/;

  it('agrees with regex for valid digit strings of correct length', () => {
    // Generate 8-14 digit strings by building from digit characters
    const digitArb = fc.array(
      fc.integer({ min: 0, max: 9 }).map(String),
      { minLength: 8, maxLength: 14 },
    ).map((digits) => digits.join(''));
    fc.assert(
      fc.property(digitArb, (s) => {
        expect(isValidBarcode(s)).toBe(BARCODE_RE.test(s));
      }),
      { numRuns: 100 },
    );
  });

  it('agrees with regex for arbitrary strings (mostly invalid)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(isValidBarcode(s)).toBe(BARCODE_RE.test(s));
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Unit tests for isValidMultiplier edge cases
 * **Validates: Requirements 4.3**
 */
describe('isValidMultiplier edge cases', () => {
  it.each([
    ['0', false],
    ['-1', false],
    ['abc', false],
    ['', false],
    ['Infinity', false],
    ['NaN', false],
    ['0.01', true],
    ['1', true],
    ['99', true],
    ['0.001', true],
  ])('isValidMultiplier(%s) === %s', (input, expected) => {
    expect(isValidMultiplier(input)).toBe(expected);
  });
});
