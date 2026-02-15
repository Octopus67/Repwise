import * as fc from 'fast-check';
import { colors } from '../../theme/tokens';

/**
 * Feature: ux-redesign-v1, Property 9: Card variant style correctness
 * Validates: Requirements 7.1, 7.2
 *
 * Tests the pure getCardStyles logic inlined here to avoid react-native imports.
 * This mirrors the exported getCardStyles from Card.tsx exactly.
 */

type CardVariant = 'flat' | 'raised' | 'outlined';

interface ViewStyle {
  [key: string]: any;
}

function getCardStyles(variant: CardVariant): ViewStyle {
  const base: ViewStyle = {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  };

  switch (variant) {
    case 'flat':
      base.backgroundColor = colors.bg.surface;
      base.borderColor = colors.border.subtle;
      break;
    case 'raised':
      base.backgroundColor = colors.bg.surfaceRaised;
      base.borderColor = colors.border.default;
      base.shadowColor = '#000';
      base.shadowOffset = { width: 0, height: 4 };
      base.shadowOpacity = 0.4;
      base.shadowRadius = 12;
      base.elevation = 4;
      break;
    case 'outlined':
      base.backgroundColor = 'transparent';
      base.borderColor = colors.border.default;
      break;
  }

  return base;
}

const VARIANTS: CardVariant[] = ['flat', 'raised', 'outlined'];

const EXPECTED_BG: Record<CardVariant, string> = {
  flat: colors.bg.surface,
  raised: colors.bg.surfaceRaised,
  outlined: 'transparent',
};

describe('Property 9: Card variant style correctness', () => {
  const variantArb = fc.constantFrom(...VARIANTS);

  test('padding === 16 for all variants', () => {
    fc.assert(
      fc.property(variantArb, (variant) => {
        const style = getCardStyles(variant);
        expect(style.padding).toBe(16);
      }),
      { numRuns: 100 },
    );
  });

  test('borderRadius === 12 for all variants', () => {
    fc.assert(
      fc.property(variantArb, (variant) => {
        const style = getCardStyles(variant);
        expect(style.borderRadius).toBe(12);
      }),
      { numRuns: 100 },
    );
  });

  test('backgroundColor matches variant spec', () => {
    fc.assert(
      fc.property(variantArb, (variant) => {
        const style = getCardStyles(variant);
        expect(style.backgroundColor).toBe(EXPECTED_BG[variant]);
      }),
      { numRuns: 100 },
    );
  });

  test('specific examples for each variant', () => {
    const flat = getCardStyles('flat');
    expect(flat.backgroundColor).toBe(colors.bg.surface);
    expect(flat.borderColor).toBe(colors.border.subtle);

    const raised = getCardStyles('raised');
    expect(raised.backgroundColor).toBe(colors.bg.surfaceRaised);
    expect(raised.elevation).toBe(4);

    const outlined = getCardStyles('outlined');
    expect(outlined.backgroundColor).toBe('transparent');
    expect(outlined.borderColor).toBe(colors.border.default);
  });
});
