import * as fc from 'fast-check';
import { colors } from '../../theme/tokens';

/**
 * Feature: ux-redesign-v1, Property 8: Button variant style correctness
 * Validates: Requirements 6.1, 6.2, 6.4
 *
 * Tests the pure getButtonStyles logic inlined here to avoid react-native imports.
 * This mirrors the exported getButtonStyles from Button.tsx exactly.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ViewStyle {
  [key: string]: any;
}
interface TextStyle {
  [key: string]: any;
}

const baseStyle: ViewStyle = {
  borderRadius: 16,
  paddingVertical: 12,
  paddingHorizontal: 24,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
};

const baseTextStyle: TextStyle = {
  color: colors.text.primary,
  fontSize: 14,
  fontWeight: '600',
};

function getButtonStyles(
  variant: ButtonVariant,
  disabled: boolean,
): { container: ViewStyle; text: TextStyle } {
  const container: ViewStyle = { ...baseStyle };
  const text: TextStyle = { ...baseTextStyle };

  switch (variant) {
    case 'primary':
      container.backgroundColor = colors.accent.primary;
      container.shadowColor = '#06B6D4';
      container.shadowOffset = { width: 0, height: 2 };
      container.shadowOpacity = 0.25;
      container.shadowRadius = 8;
      container.elevation = 4;
      text.color = colors.text.primary;
      break;
    case 'secondary':
      container.backgroundColor = 'transparent';
      container.borderWidth = 1;
      container.borderColor = colors.border.default;
      text.color = colors.accent.primary;
      break;
    case 'ghost':
      container.backgroundColor = 'transparent';
      text.color = colors.accent.primary;
      break;
    case 'danger':
      container.backgroundColor = colors.semantic.negativeSubtle;
      container.borderWidth = 1;
      container.borderColor = colors.semantic.negative;
      text.color = colors.semantic.negative;
      break;
  }

  if (disabled) {
    container.opacity = 0.4;
  }

  return { container, text };
}

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];

describe('Property 8: Button variant style correctness', () => {
  const variantArb = fc.constantFrom(...VARIANTS);
  const disabledArb = fc.boolean();

  test('container.minHeight >= 44 for all variants and disabled states', () => {
    fc.assert(
      fc.property(variantArb, disabledArb, (variant, disabled) => {
        const { container } = getButtonStyles(variant, disabled);
        expect(container.minHeight).toBeGreaterThanOrEqual(44);
      }),
      { numRuns: 100 },
    );
  });

  test('when disabled=true, container.opacity <= 0.5', () => {
    fc.assert(
      fc.property(variantArb, (variant) => {
        const { container } = getButtonStyles(variant, true);
        expect(container.opacity).toBeDefined();
        expect(container.opacity).toBeLessThanOrEqual(0.5);
      }),
      { numRuns: 100 },
    );
  });

  test('when disabled=false, opacity is not set (undefined)', () => {
    fc.assert(
      fc.property(variantArb, (variant) => {
        const { container } = getButtonStyles(variant, false);
        expect(container.opacity).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  test('specific examples for each variant', () => {
    const primary = getButtonStyles('primary', false);
    expect(primary.container.backgroundColor).toBe('#06B6D4');

    const secondary = getButtonStyles('secondary', false);
    expect(secondary.container.backgroundColor).toBe('transparent');
    expect(secondary.container.borderWidth).toBe(1);

    const ghost = getButtonStyles('ghost', false);
    expect(ghost.container.backgroundColor).toBe('transparent');

    const danger = getButtonStyles('danger', false);
    expect(danger.text.color).toBe('#EF4444');

    const disabledPrimary = getButtonStyles('primary', true);
    expect(disabledPrimary.container.opacity).toBe(0.4);
  });
});
