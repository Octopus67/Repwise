import * as fc from 'fast-check';
import { computeRingFill } from '../../utils/progressRingLogic';

/**
 * Feature: ux-redesign-v1, Property 2: Progress ring correctness
 * Validates: Requirements 2.3, 2.4, 2.5, 2.6, 5.5
 */

describe('Property 2: Progress ring correctness', () => {
  const testColor = '#06B6D4';

  test('target=0 → percentage=0, isMissing=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (value, color) => {
          const result = computeRingFill(value, 0, color);
          expect(result.percentage).toBe(0);
          expect(result.isMissing).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('value > target (target > 0) → percentage=100, isOvershoot=true, fillColor=#6B8FBF (adherence-neutral)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (target, color) => {
          const value = target + 1; // always overshoot
          const result = computeRingFill(value, target, color);
          expect(result.percentage).toBe(100);
          expect(result.isOvershoot).toBe(true);
          expect(result.fillColor).toBe('#6B8FBF');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('value <= target (target > 0) → percentage=Math.round(value/target*100), fillColor=color', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (rawValue, target, color) => {
          const value = Math.min(rawValue, target); // ensure value <= target
          const result = computeRingFill(value, target, color);
          const expectedPercentage = Math.round((value / target) * 100);
          expect(result.percentage).toBe(expectedPercentage);
          expect(result.fillColor).toBe(color);
          expect(result.isOvershoot).toBe(false);
          expect(result.isMissing).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples: 0/2400, 1200/2400, 2500/2400, 0/0', () => {
    const r1 = computeRingFill(0, 2400, testColor);
    expect(r1.percentage).toBe(0);
    expect(r1.fillColor).toBe(testColor);

    const r2 = computeRingFill(1200, 2400, testColor);
    expect(r2.percentage).toBe(50);
    expect(r2.fillColor).toBe(testColor);

    const r3 = computeRingFill(2500, 2400, testColor);
    expect(r3.percentage).toBe(100);
    expect(r3.isOvershoot).toBe(true);
    expect(r3.fillColor).toBe('#6B8FBF');

    const r4 = computeRingFill(0, 0, testColor);
    expect(r4.percentage).toBe(0);
    expect(r4.isMissing).toBe(true);
  });
});
