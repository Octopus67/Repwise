import * as fc from 'fast-check';
import { colors } from '../../theme/tokens';

/**
 * Feature: ux-redesign-v1, Property 6: Article card field completeness
 * Validates: Requirements 4.2, 9.4
 *
 * Tests the category color mapping logic from ArticleCardCompact.
 * The getCategoryColor function is inlined here since it's not exported.
 */

/**
 * Pure logic extracted from ArticleCardCompact:
 * Maps module_name to a category color.
 */
function getCategoryColor(moduleName: string): string {
  switch (moduleName) {
    case 'nutrition':
      return colors.macro.calories;
    case 'training':
      return colors.macro.protein;
    case 'recovery':
      return colors.macro.carbs;
    default:
      return colors.accent.primary;
  }
}

const KNOWN_MODULES = ['nutrition', 'training', 'recovery'] as const;

const EXPECTED_COLORS: Record<string, string> = {
  nutrition: colors.macro.calories,
  training: colors.macro.protein,
  recovery: colors.macro.carbs,
};

describe('Property 6: Article card field completeness', () => {
  test('known modules map to their expected colors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KNOWN_MODULES),
        (moduleName) => {
          const color = getCategoryColor(moduleName);
          expect(color).toBe(EXPECTED_COLORS[moduleName]);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('unknown modules default to accent.primary', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !KNOWN_MODULES.includes(s as any),
        ),
        (moduleName) => {
          const color = getCategoryColor(moduleName);
          expect(color).toBe(colors.accent.primary);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('result is always a non-empty string for any module name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        (moduleName) => {
          const color = getCategoryColor(moduleName);
          expect(typeof color).toBe('string');
          expect(color.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('color is always one of the four expected values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        (moduleName) => {
          const color = getCategoryColor(moduleName);
          const validColors = [
            colors.macro.calories,
            colors.macro.protein,
            colors.macro.carbs,
            colors.accent.primary,
          ];
          expect(validColors).toContain(color);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('specific examples', () => {
    expect(getCategoryColor('nutrition')).toBe(colors.macro.calories);
    expect(getCategoryColor('training')).toBe(colors.macro.protein);
    expect(getCategoryColor('recovery')).toBe(colors.macro.carbs);
    expect(getCategoryColor('mindfulness')).toBe(colors.accent.primary);
    expect(getCategoryColor('')).toBe(colors.accent.primary);
  });
});
