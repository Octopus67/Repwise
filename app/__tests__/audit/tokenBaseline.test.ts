import { colors, spacing, typography, springs, radius } from '../../theme/tokens';

describe('Token Baseline', () => {
  test('(a) colors object has exactly 14 top-level groups', () => {
    const expectedGroups = [
      'bg',
      'border',
      'text',
      'accent',
      'semantic',
      'premium',
      'gradient',
      'gradientArrays',
      'chart',
      'macro',
      'error',
      'warning',
      'success',
      'heatmap',
    ];
    const actualGroups = Object.keys(colors);
    expect(actualGroups).toHaveLength(14);
    expect(actualGroups.sort()).toEqual(expectedGroups.sort());
  });

  test('(b) spacing has keys 0 through 16', () => {
    const expectedKeys = [0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
    const actualKeys = Object.keys(spacing).map(Number).sort((a, b) => a - b);
    expect(actualKeys).toEqual(expectedKeys);
    // Verify the range spans 0 to 16
    expect(Math.min(...actualKeys)).toBe(0);
    expect(Math.max(...actualKeys)).toBe(16);
  });

  test('(c) typography.size has 10 entries', () => {
    const sizeKeys = Object.keys(typography.size);
    expect(sizeKeys).toHaveLength(10);
    expect(sizeKeys.sort()).toEqual(
      ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'].sort()
    );
  });

  test('(d) springs has exactly 3 presets (gentle, snappy, bouncy)', () => {
    const springKeys = Object.keys(springs);
    expect(springKeys).toHaveLength(3);
    expect(springKeys.sort()).toEqual(['bouncy', 'gentle', 'snappy']);
  });

  test('(e) radius has 6 values', () => {
    const radiusKeys = Object.keys(radius);
    expect(radiusKeys).toHaveLength(6);
    expect(radiusKeys.sort()).toEqual(['full', 'lg', 'md', 'none', 'sm', 'xl']);
  });
});
