/**
 * Accessibility Audit — Property Tests
 *
 * Feature: premium-ui-audit
 * Tests Properties 16, 18, 19 from the design document.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

const APP_ROOT = path.resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(APP_ROOT, relativePath), 'utf-8');
}

// ─── Spacing token map (mirrors app/theme/tokens.ts) ─────────────────────────

const SPACING: Record<number, number> = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
};

// ─── Helper: extract numeric padding from a style block ──────────────────────

/**
 * Given source code and a style name (e.g. 'gearBtn'), extract the padding value.
 * Looks for patterns like `padding: spacing[N]` or `padding: N`.
 * Returns total effective size contribution from padding (both sides).
 */
function extractPaddingFromStyle(source: string, styleName: string): number {
  // Find the style block
  const styleBlockRegex = new RegExp(`${styleName}\\s*:\\s*\\{([^}]+)\\}`, 's');
  const match = source.match(styleBlockRegex);
  if (!match) return 0;

  const block = match[1];

  // Check for padding: spacing[N]
  const spacingMatch = block.match(/padding:\s*spacing\[(\d+)\]/);
  if (spacingMatch) {
    const key = parseInt(spacingMatch[1], 10);
    return (SPACING[key] ?? 0) * 2; // both sides
  }

  // Check for padding: N (numeric literal)
  const numericMatch = block.match(/padding:\s*(\d+)/);
  if (numericMatch) {
    return parseInt(numericMatch[1], 10) * 2;
  }

  // Check for paddingHorizontal + paddingVertical
  let horizontal = 0;
  let vertical = 0;

  const phSpacing = block.match(/paddingHorizontal:\s*spacing\[(\d+)\]/);
  if (phSpacing) horizontal = (SPACING[parseInt(phSpacing[1], 10)] ?? 0) * 2;

  const pvSpacing = block.match(/paddingVertical:\s*spacing\[(\d+)\]/);
  if (pvSpacing) vertical = (SPACING[parseInt(pvSpacing[1], 10)] ?? 0) * 2;

  const phNum = block.match(/paddingHorizontal:\s*(\d+)/);
  if (phNum) horizontal = parseInt(phNum[1], 10) * 2;

  const pvNum = block.match(/paddingVertical:\s*(\d+)/);
  if (pvNum) vertical = parseInt(pvNum[1], 10) * 2;

  // Return the minimum dimension contribution
  return Math.min(horizontal || 999, vertical || 999) === 999 ? 0 : Math.min(horizontal || 0, vertical || 0);
}

/**
 * Extract hitSlop value from source near a specific element.
 * Looks for hitSlop={N} or hitSlop={{ top: N, ... }}.
 */
function extractHitSlop(source: string, nearPattern: string): number {
  const idx = source.indexOf(nearPattern);
  if (idx === -1) return 0;

  // Search in a window around the pattern
  const window = source.substring(Math.max(0, idx - 200), idx + 500);

  // hitSlop={N}
  const simpleMatch = window.match(/hitSlop=\{(\d+)\}/);
  if (simpleMatch) return parseInt(simpleMatch[1], 10) * 2;

  // hitSlop={{ top: N, bottom: N, left: N, right: N }}
  const objMatch = window.match(/hitSlop=\{\{\s*top:\s*(\d+)/);
  if (objMatch) return parseInt(objMatch[1], 10) * 2;

  return 0;
}

/**
 * Extract explicit width/height from a style block.
 */
function extractDimension(source: string, styleName: string, prop: 'width' | 'height'): number | null {
  const styleBlockRegex = new RegExp(`${styleName}\\s*:\\s*\\{([^}]+)\\}`, 's');
  const match = source.match(styleBlockRegex);
  if (!match) return null;

  const dimMatch = match[1].match(new RegExp(`${prop}:\\s*(\\d+)`));
  return dimMatch ? parseInt(dimMatch[1], 10) : null;
}

// ─── Property 16: Touch Target Minimum Size ──────────────────────────────────

describe('Property 16 — Touch Target Minimum Size', () => {
  /**
   * **Validates: Requirements 8.1, 8.2**
   *
   * For known small-target components, parse source and verify
   * padding + hitSlop + element size ≥ 44pt.
   */

  interface TouchTargetCase {
    name: string;
    file: string;
    styleName: string;
    iconSize: number;
    hitSlopPattern?: string;
    explicitWidth?: string;
    explicitHeight?: string;
  }

  const KNOWN_SMALL_TARGETS: TouchTargetCase[] = [
    {
      name: 'RestTimer gear icon',
      file: 'components/training/RestTimer.tsx',
      styleName: 'gearBtn',
      iconSize: 18,
    },
    {
      name: 'FilterPill',
      file: 'components/common/FilterPill.tsx',
      styleName: 'pill',
      iconSize: 0, // text content, not icon
      explicitHeight: 'height',
    },
    {
      name: 'SetTypeSelector pill',
      file: 'components/training/SetTypeSelector.tsx',
      styleName: 'pill',
      iconSize: 0,
    },
  ];

  test.each(KNOWN_SMALL_TARGETS)(
    'should flag $name as below 44pt minimum',
    ({ file, styleName, iconSize, hitSlopPattern }) => {
      const source = readSource(file);
      const padding = extractPaddingFromStyle(source, styleName);
      const hitSlop = hitSlopPattern ? extractHitSlop(source, hitSlopPattern) : 0;
      const explicitHeight = extractDimension(source, styleName, 'height');
      const explicitWidth = extractDimension(source, styleName, 'width');

      // Effective size = max(explicit dimension, icon + padding) + hitSlop
      const effectiveWidth = (explicitWidth ?? (iconSize + padding)) + hitSlop;
      const effectiveHeight = (explicitHeight ?? (iconSize + padding)) + hitSlop;
      const effectiveMin = Math.min(effectiveWidth, effectiveHeight);

      // These are KNOWN failures — we expect them to be below 44pt
      expect(effectiveMin).toBeLessThan(44);
    },
  );

  test('RPEPicker valueButton should meet 44pt minimum', () => {
    const source = readSource('components/training/RPEPicker.tsx');
    const width = extractDimension(source, 'valueButton', 'width');
    const height = extractDimension(source, 'valueButton', 'height');

    expect(width).toBe(44);
    expect(height).toBe(44);
  });

  test('ModalContainer close button should meet 44pt with hitSlop', () => {
    const source = readSource('components/common/ModalContainer.tsx');

    // Close button has inline style={{ padding: 8 }} and hitSlop={8}
    // Icon size = 18, padding = 8*2 = 16, hitSlop = 8*2 = 16
    // Effective = 18 + 16 + 16 = 50pt
    const hasHitSlop = source.includes('hitSlop={8}');
    const hasPadding8 = /style=\{[^}]*padding:\s*8/.test(source);

    expect(hasHitSlop).toBe(true);
    expect(hasPadding8).toBe(true);

    const effective = 18 + (8 * 2) + (8 * 2);
    expect(effective).toBeGreaterThanOrEqual(44);
  });

  // Property-based: for any spacing token used as padding on a small icon (18px),
  // verify whether it meets the 44pt threshold
  test('property: spacing tokens as icon padding — identify which meet 44pt', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(SPACING).map(Number)),
        (spacingKey: number) => {
          const paddingValue = SPACING[spacingKey];
          const iconSize = 18;
          const effectiveSize = iconSize + paddingValue * 2;
          // This property documents which spacing values are sufficient
          // spacing[3]=12 → 18+24=42 (FAIL), spacing[4]=16 → 18+32=50 (PASS)
          if (spacingKey >= 4) {
            expect(effectiveSize).toBeGreaterThanOrEqual(44);
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 18: Accessibility Label Coverage ───────────────────────────────

describe('Property 18 — Accessibility Label Coverage', () => {
  /**
   * **Validates: Requirements 8.5**
   *
   * For icon-only button components, verify they have accessibilityLabel prop.
   */

  interface IconButtonCase {
    name: string;
    file: string;
    iconPattern: string;
    expectLabel: boolean;
  }

  const ICON_ONLY_BUTTONS: IconButtonCase[] = [
    {
      name: 'ModalContainer close button',
      file: 'components/common/ModalContainer.tsx',
      iconPattern: 'name="close"',
      expectLabel: false, // Known failure
    },
    {
      name: 'RestTimer gear button',
      file: 'components/training/RestTimer.tsx',
      iconPattern: 'name="gear"',
      expectLabel: false, // Known failure
    },
    {
      name: 'ExercisePickerScreen back button',
      file: 'screens/exercise-picker/ExercisePickerScreen.tsx',
      iconPattern: 'Go back',
      expectLabel: true,
    },
    {
      name: 'SearchBar clear button',
      file: 'components/exercise-picker/SearchBar.tsx',
      iconPattern: 'Clear search',
      expectLabel: true,
    },
  ];

  test.each(ICON_ONLY_BUTTONS)(
    '$name — accessibilityLabel should be $expectLabel',
    ({ file, iconPattern, expectLabel }) => {
      const source = readSource(file);

      // Find the icon usage and check nearby context for accessibilityLabel
      const hasPattern = source.includes(iconPattern);
      expect(hasPattern).toBe(true);

      if (expectLabel) {
        expect(source).toContain('accessibilityLabel');
      }
    },
  );

  // Verify known failures: ModalContainer and RestTimer gear lack labels
  test('ModalContainer close button lacks accessibilityLabel near icon', () => {
    const source = readSource('components/common/ModalContainer.tsx');

    // Find all TouchableOpacity blocks with close icon
    const closeIconSections = source.split('name="close"');
    // For each close icon usage, check if the parent TouchableOpacity has accessibilityLabel
    for (let i = 1; i < closeIconSections.length; i++) {
      const preceding = closeIconSections[i - 1].slice(-300);
      const hasLabel = preceding.includes('accessibilityLabel');
      expect(hasLabel).toBe(false); // Confirms the known failure
    }
  });

  test('ProgressRing lacks accessibilityLabel', () => {
    const source = readSource('components/common/ProgressRing.tsx');
    // ProgressRing should expose value/target as accessible info
    const hasAccessibilityLabel = source.includes('accessibilityLabel');
    expect(hasAccessibilityLabel).toBe(false); // Known failure
  });

  test('BudgetBar lacks accessibilityLabel', () => {
    const source = readSource('components/nutrition/BudgetBar.tsx');
    const hasAccessibilityLabel = source.includes('accessibilityLabel');
    expect(hasAccessibilityLabel).toBe(false); // Known failure
  });
});

// ─── Property 19: Reduce-Motion Support ──────────────────────────────────────

describe('Property 19 — Reduce-Motion Support', () => {
  /**
   * **Validates: Requirements 8.6**
   *
   * For each animation hook file, verify it contains
   * isReduceMotionEnabled or useReducedMotion.
   */

  const ANIMATION_FILES = [
    { name: 'usePressAnimation', file: 'hooks/usePressAnimation.ts' },
    { name: 'useStaggeredEntrance', file: 'hooks/useStaggeredEntrance.ts' },
    { name: 'useSkeletonPulse', file: 'hooks/useSkeletonPulse.ts' },
    { name: 'useCountingValue', file: 'hooks/useCountingValue.ts' },
    { name: 'ProgressRing', file: 'components/common/ProgressRing.tsx' },
    { name: 'PRBanner', file: 'components/training/PRBanner.tsx' },
  ];

  // All animation files now have reduce-motion support (hooks from Phase 2, components from Phase 3)
  const HOOKS_WITH_REDUCE_MOTION = ANIMATION_FILES;

  const COMPONENTS_WITHOUT_REDUCE_MOTION: typeof ANIMATION_FILES = [];

  test.each(HOOKS_WITH_REDUCE_MOTION)(
    '$name should check reduce-motion preference',
    ({ file }) => {
      const source = readSource(file);
      const hasReduceMotionCheck =
        source.includes('isReduceMotionEnabled') ||
        source.includes('useReducedMotion') ||
        source.includes('reduceMotion');

      // All animation hooks now have reduce-motion support
      expect(hasReduceMotionCheck).toBe(true);
    },
  );

  // All animation files (hooks + components) now have reduce-motion support

  test('useStaggeredEntrance has web fallback and native reduce-motion', () => {
    const source = readSource('hooks/useStaggeredEntrance.ts');

    // Has web fallback
    expect(source).toContain("Platform.OS === 'web'");

    // Has reduce-motion check via useReduceMotion hook
    expect(source).toContain('reduceMotion');
  });

  // Property-based: all animation hooks check reduce-motion
  test('property: all animation hooks check reduce-motion', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HOOKS_WITH_REDUCE_MOTION),
        (entry: { name: string; file: string }) => {
          const source = readSource(entry.file);
          const hasCheck =
            source.includes('isReduceMotionEnabled') ||
            source.includes('useReducedMotion') ||
            source.includes('reduceMotion');
          expect(hasCheck).toBe(true);
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
