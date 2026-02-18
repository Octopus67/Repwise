// Feature: premium-ui-implementation, Property 4: WCAG AA contrast ratio compliance
/**
 * Validates: Requirements 1.2, 11.1
 *
 * Property: For every (foreground, background) text/surface pair in the token system,
 * the WCAG 2.1 contrast ratio meets AA thresholds:
 *   - Normal text: ≥ 4.5:1
 *   - Interactive elements (large text / UI components): ≥ 3:1
 *
 * Contrast ratio algorithm (WCAG 2.1):
 *   1. Parse hex color to sRGB channels [0..1]
 *   2. Linearize each channel: c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4
 *   3. Relative luminance L = 0.2126*R + 0.7152*G + 0.0722*B
 *   4. Ratio = (L_lighter + 0.05) / (L_darker + 0.05)
 */

import * as fc from 'fast-check';
import { colors } from '../../theme/tokens';

// ─── WCAG 2.1 Contrast Ratio Helpers ─────────────────────────────────────────

/** Parse a hex color string (#RRGGBB) to [r, g, b] in 0..1 range */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  return [r, g, b];
}

/** Linearize an sRGB channel value */
function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Compute WCAG 2.1 relative luminance from a hex color */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Compute WCAG 2.1 contrast ratio between two hex colors */
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Token Pairs ─────────────────────────────────────────────────────────────

/** Normal text pairs — must meet ≥ 4.5:1 */
const normalTextPairs: Array<{ fg: string; bg: string; label: string }> = [
  { fg: colors.text.muted, bg: colors.bg.base, label: 'text.muted on bg.base' },
  { fg: colors.text.muted, bg: colors.bg.surface, label: 'text.muted on bg.surface' },
  { fg: colors.text.secondary, bg: colors.bg.base, label: 'text.secondary on bg.base' },
  { fg: colors.text.secondary, bg: colors.bg.surface, label: 'text.secondary on bg.surface' },
  { fg: colors.text.primary, bg: colors.bg.base, label: 'text.primary on bg.base' },
  { fg: colors.text.primary, bg: colors.bg.surface, label: 'text.primary on bg.surface' },
];

/** Interactive element pairs — must meet ≥ 3:1 */
const interactivePairs: Array<{ fg: string; bg: string; label: string }> = [
  { fg: colors.accent.primary, bg: colors.bg.base, label: 'accent.primary on bg.base' },
  { fg: colors.accent.primary, bg: colors.bg.surface, label: 'accent.primary on bg.surface' },
];

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('WCAG AA Contrast Ratio Compliance', () => {
  // Property: normal text pairs meet ≥ 4.5:1
  it('every normal-text foreground/background pair has contrast ratio ≥ 4.5:1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...normalTextPairs),
        (pair) => {
          const ratio = contrastRatio(pair.fg, pair.bg);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property: interactive element pairs meet ≥ 3:1
  it('every interactive element foreground/background pair has contrast ratio ≥ 3:1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...interactivePairs),
        (pair) => {
          const ratio = contrastRatio(pair.fg, pair.bg);
          expect(ratio).toBeGreaterThanOrEqual(3);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Sanity: verify the contrast ratio helper itself is correct
  describe('contrast ratio calculation sanity checks', () => {
    it('black on white is 21:1', () => {
      const ratio = contrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('white on white is 1:1', () => {
      const ratio = contrastRatio('#FFFFFF', '#FFFFFF');
      expect(ratio).toBeCloseTo(1, 1);
    });

    it('is symmetric — order of fg/bg does not matter', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...[...normalTextPairs, ...interactivePairs]),
          (pair) => {
            const r1 = contrastRatio(pair.fg, pair.bg);
            const r2 = contrastRatio(pair.bg, pair.fg);
            expect(r1).toBeCloseTo(r2, 5);
          },
        ),
      );
    });
  });

  // Log actual ratios for visibility
  describe('actual contrast ratios (informational)', () => {
    [...normalTextPairs, ...interactivePairs].forEach((pair) => {
      it(`${pair.label}: ratio = ${contrastRatio(pair.fg, pair.bg).toFixed(2)}:1`, () => {
        const ratio = contrastRatio(pair.fg, pair.bg);
        expect(ratio).toBeGreaterThan(1);
      });
    });
  });
});
