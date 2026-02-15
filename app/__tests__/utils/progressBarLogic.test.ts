import * as fc from 'fast-check';
import { computeBarFill } from '../../utils/progressBarLogic';

/**
 * Feature: ux-redesign-v1, Property 12: Progress bar correctness
 * Validates: Requirements 11.1, 11.2
 */

describe('Property 12: Progress bar correctness', () => {
  test('percentage = Math.min(Math.round(value/target*100), 100) for target > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (value, target, color) => {
          const result = computeBarFill(value, target, color);
          const expectedPercentage = Math.min(Math.round((value / target) * 100), 100);
          expect(result.percentage).toBe(expectedPercentage);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('fillColor = #F59E0B when value > target, else the given color', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (value, target, color) => {
          const result = computeBarFill(value, target, color);
          if (value > target) {
            expect(result.fillColor).toBe('#F59E0B');
          } else {
            expect(result.fillColor).toBe(color);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('label = percentage + "%"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (value, target, color) => {
          const result = computeBarFill(value, target, color);
          const expectedPercentage = Math.min(Math.round((value / target) * 100), 100);
          expect(result.label).toBe(expectedPercentage + '%');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples: 0/100, 50/100, 150/100', () => {
    const color = '#06B6D4';

    const r1 = computeBarFill(0, 100, color);
    expect(r1.percentage).toBe(0);
    expect(r1.fillColor).toBe(color);
    expect(r1.label).toBe('0%');

    const r2 = computeBarFill(50, 100, color);
    expect(r2.percentage).toBe(50);
    expect(r2.fillColor).toBe(color);
    expect(r2.label).toBe('50%');

    const r3 = computeBarFill(150, 100, color);
    expect(r3.percentage).toBe(100);
    expect(r3.fillColor).toBe('#F59E0B');
    expect(r3.label).toBe('100%');
  });
});

describe('computeRingFill and formatRingLabel', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { computeRingFill, formatRingLabel } = require('../../utils/progressRingLogic');

  test('computeRingFill with target=0 returns isMissing=true', () => {
    const result = computeRingFill(50, 0, '#06B6D4');
    expect(result.percentage).toBe(0);
    expect(result.isMissing).toBe(true);
    expect(result.isOvershoot).toBe(false);
  });

  test('formatRingLabel with value=0', () => {
    const result = formatRingLabel(0, 100, 'g');
    expect(result.centerText).toBe('0');
    expect(result.subText).toBe('/ 100 g');
  });

  test('formatRingLabel with value=50', () => {
    const result = formatRingLabel(50, 200, 'kcal');
    expect(result.centerText).toBe('50');
    expect(result.subText).toBe('/ 200 kcal');
  });

  test('formatRingLabel with value=100', () => {
    const result = formatRingLabel(100, 100, 'g');
    expect(result.centerText).toBe('100');
    expect(result.subText).toBe('/ 100 g');
  });

  test('formatRingLabel with value=999', () => {
    const result = formatRingLabel(999, 2000, 'ml');
    expect(result.centerText).toBe('999');
    expect(result.subText).toBe('/ 2000 ml');
  });
});
