import * as fc from 'fast-check';
import { colors, spacing } from '../../theme/tokens';

/**
 * Feature: ux-redesign-v1, Property 7: Surface luminance hierarchy
 * Feature: ux-redesign-v1, Property 15: Spacing scale compliance
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a hex color string (#RRGGBB) to [r, g, b] in 0-255. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Compute relative luminance per WCAG 2.0.
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ─── Property 7: Surface luminance hierarchy ─────────────────────────────────

describe('Property 7: Surface luminance hierarchy', () => {
  /** Validates: Requirements 5.1 */

  test('bg.base < bg.surface < bg.surfaceRaised in relative luminance', () => {
    const lumBase = relativeLuminance(colors.bg.base);
    const lumSurface = relativeLuminance(colors.bg.surface);
    const lumRaised = relativeLuminance(colors.bg.surfaceRaised);

    expect(lumBase).toBeLessThan(lumSurface);
    expect(lumSurface).toBeLessThan(lumRaised);
  });

  test('luminance helper is correct for known values', () => {
    // Black should be 0, white should be 1
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  test('luminance helper preserves ordering for arbitrary hex colors', () => {
    fc.assert(
      fc.property(
        // Generate two channel values where a < b, guaranteeing darker < lighter
        fc.integer({ min: 0, max: 254 }),
        fc.integer({ min: 1, max: 255 }),
        (lo, hi) => {
          // Ensure lo < hi
          const a = Math.min(lo, hi);
          const b = Math.max(lo, hi);
          if (a === b) return; // skip equal

          const hexA = '#' + [a, a, a].map((c) => c.toString(16).padStart(2, '0')).join('');
          const hexB = '#' + [b, b, b].map((c) => c.toString(16).padStart(2, '0')).join('');

          expect(relativeLuminance(hexA)).toBeLessThan(relativeLuminance(hexB));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 15: Spacing scale compliance ───────────────────────────────────

describe('Property 15: Spacing scale compliance', () => {
  /** Validates: Requirements 13.1 */

  const ALLOWED_SPACING = new Set([0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);

  test('all spacing token values are members of the allowed set', () => {
    const spacingValues = Object.values(spacing);

    for (const val of spacingValues) {
      expect(ALLOWED_SPACING.has(val)).toBe(true);
    }
  });

  test('property: any value from the spacing object is in the allowed set', () => {
    const spacingKeys = Object.keys(spacing) as Array<keyof typeof spacing>;

    fc.assert(
      fc.property(
        fc.constantFrom(...spacingKeys),
        (key) => {
          expect(ALLOWED_SPACING.has(spacing[key])).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('spacing object is non-empty', () => {
    expect(Object.keys(spacing).length).toBeGreaterThan(0);
  });
});
