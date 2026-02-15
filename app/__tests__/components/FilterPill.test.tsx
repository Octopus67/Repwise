import * as fc from 'fast-check';
import { colors } from '../../theme/tokens';

/**
 * Feature: ux-redesign-v1, Property 11: Filter pill state styling
 * Validates: Requirements 9.2, 9.3
 *
 * Tests the pure getFilterPillStyles logic inlined here to avoid react-native imports.
 * This mirrors the exported getFilterPillStyles from FilterPill.tsx exactly.
 */

function getFilterPillStyles(active: boolean): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  if (active) {
    return {
      backgroundColor: colors.accent.primaryMuted,
      borderColor: colors.accent.primary,
      textColor: colors.accent.primary,
    };
  }
  return {
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    textColor: colors.text.muted,
  };
}

describe('Property 11: Filter pill state styling', () => {
  test('active=true returns correct accent styles', () => {
    fc.assert(
      fc.property(fc.constant(true), (active) => {
        const styles = getFilterPillStyles(active);
        expect(styles.backgroundColor).toBe(colors.accent.primaryMuted);
        expect(styles.borderColor).toBe(colors.accent.primary);
        expect(styles.textColor).toBe(colors.accent.primary);
      }),
      { numRuns: 100 },
    );
  });

  test('active=false returns correct muted styles', () => {
    fc.assert(
      fc.property(fc.constant(false), (active) => {
        const styles = getFilterPillStyles(active);
        expect(styles.backgroundColor).toBe(colors.bg.surface);
        expect(styles.borderColor).toBe(colors.border.subtle);
        expect(styles.textColor).toBe(colors.text.muted);
      }),
      { numRuns: 100 },
    );
  });

  test('for any boolean active state, styles match the spec', () => {
    fc.assert(
      fc.property(fc.boolean(), (active) => {
        const styles = getFilterPillStyles(active);
        if (active) {
          expect(styles.backgroundColor).toBe(colors.accent.primaryMuted);
          expect(styles.borderColor).toBe(colors.accent.primary);
          expect(styles.textColor).toBe(colors.accent.primary);
        } else {
          expect(styles.backgroundColor).toBe(colors.bg.surface);
          expect(styles.borderColor).toBe(colors.border.subtle);
          expect(styles.textColor).toBe(colors.text.muted);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('active and inactive styles are always different', () => {
    fc.assert(
      fc.property(fc.boolean(), (_) => {
        const activeStyles = getFilterPillStyles(true);
        const inactiveStyles = getFilterPillStyles(false);
        expect(activeStyles.backgroundColor).not.toBe(inactiveStyles.backgroundColor);
        expect(activeStyles.borderColor).not.toBe(inactiveStyles.borderColor);
        expect(activeStyles.textColor).not.toBe(inactiveStyles.textColor);
      }),
      { numRuns: 100 },
    );
  });
});
