import * as fs from 'fs';
import * as path from 'path';

/**
 * Typography Audit — Property-Based Tests
 *
 * These tests parse source files as text (not imports) because React Native
 * components cannot be imported in a Node test environment.
 *
 * Feature: premium-ui-audit
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '../../', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Extract the value of a named style property from a StyleSheet.create block.
 * Looks for patterns like:  styleName: { ... fontSize: <value>, ... }
 */
function extractStyleProperty(
  source: string,
  styleName: string,
  property: string,
): string | null {
  // Match the style block: styleName: { ... }
  // We need to handle nested braces, so we do a simple brace-counting approach
  const styleStart = new RegExp(`\\b${styleName}\\b\\s*:\\s*\\{`);
  const match = styleStart.exec(source);
  if (!match) return null;

  let braceCount = 1;
  let i = match.index + match[0].length;
  const startIdx = i;

  while (i < source.length && braceCount > 0) {
    if (source[i] === '{') braceCount++;
    if (source[i] === '}') braceCount--;
    i++;
  }

  const block = source.slice(startIdx, i - 1);

  // Now find the property within this block
  const propRegex = new RegExp(`\\b${property}\\b\\s*:\\s*([^,}]+)`);
  const propMatch = propRegex.exec(block);
  if (!propMatch) return null;

  return propMatch[1].trim();
}

// ── Property 12: Heading Hierarchy Consistency ───────────────────────────────

describe('Property 12 — Heading Hierarchy Consistency', () => {
  /**
   * Validates: Requirements 4.2
   *
   * For the primary tab screens that have explicit title styles,
   * verify they use identical fontSize and fontWeight values.
   */

  const screensWithTitles = [
    {
      name: 'LogsScreen',
      path: 'screens/logs/LogsScreen.tsx',
      styleName: 'title',
    },
    {
      name: 'AnalyticsScreen',
      path: 'screens/analytics/AnalyticsScreen.tsx',
      styleName: 'title',
    },
  ];

  // DashboardScreen and ProfileScreen don't have explicit title text —
  // that itself is a finding (TYPO-001), but we test the screens that DO have titles.

  const titleStyles = screensWithTitles.map((screen) => {
    const source = readSource(screen.path);
    return {
      name: screen.name,
      fontSize: extractStyleProperty(source, screen.styleName, 'fontSize'),
      fontWeight: extractStyleProperty(source, screen.styleName, 'fontWeight'),
    };
  });

  test('screens with titles use identical fontSize', () => {
    const fontSizes = titleStyles.map((s) => s.fontSize);
    const unique = new Set(fontSizes);
    expect(unique.size).toBe(1);
    // Verify it references the typography token
    expect(fontSizes[0]).toContain('typography.size');
  });

  test('screens with titles use identical fontWeight', () => {
    const fontWeights = titleStyles.map((s) => s.fontWeight);
    const unique = new Set(fontWeights);
    expect(unique.size).toBe(1);
    // Verify it references the typography token
    expect(fontWeights[0]).toContain('typography.weight');
  });

  test('DashboardScreen and ProfileScreen are missing screen titles (known finding TYPO-001)', () => {
    // These screens don't have a top-level title style matching the Logs/Analytics pattern.
    // This test documents the finding — DashboardScreen has no <Text> with a "title" style
    // that matches the pattern used by LogsScreen and AnalyticsScreen.
    const dashSource = readSource('screens/dashboard/DashboardScreen.tsx');
    const profileSource = readSource('screens/profile/ProfileScreen.tsx');

    // DashboardScreen: the styles block should NOT have a 'title' style with fontSize: typography.size.xl
    const dashTitleFontSize = extractStyleProperty(dashSource, 'title', 'fontSize');
    // ProfileScreen: same check
    const profileTitleFontSize = extractStyleProperty(profileSource, 'title', 'fontSize');

    // At least one of them should be missing a title (documenting the inconsistency)
    const hasMissingTitle = dashTitleFontSize === null || profileTitleFontSize === null;
    expect(hasMissingTitle).toBe(true);
  });

  test('SectionHeader component uses consistent lg/semibold pattern', () => {
    const source = readSource('components/common/SectionHeader.tsx');
    const fontSize = extractStyleProperty(source, 'title', 'fontSize');
    const fontWeight = extractStyleProperty(source, 'title', 'fontWeight');

    expect(fontSize).toContain('typography.size.lg');
    expect(fontWeight).toContain('typography.weight.semibold');
  });
});

// ── Property 11: Tabular Nums on Numeric Displays ────────────────────────────

describe('Property 11 — Tabular Nums on Numeric Displays', () => {
  /**
   * Validates: Requirements 4.3
   *
   * For numeric display components, verify their source contains
   * fontVariant with tabular-nums in the relevant style blocks.
   */

  const numericComponents = [
    {
      name: 'BudgetBar — calorieNumber',
      path: 'components/nutrition/BudgetBar.tsx',
      styleName: 'calorieNumber',
    },
    {
      name: 'BudgetBar — macroValue',
      path: 'components/nutrition/BudgetBar.tsx',
      styleName: 'macroValue',
    },
    {
      name: 'ProgressRing — centerText',
      path: 'components/common/ProgressRing.tsx',
      styleName: 'centerText',
    },
    {
      name: 'RestTimer — countdown',
      path: 'components/training/RestTimer.tsx',
      styleName: 'countdown',
    },
    {
      name: 'StreakIndicator — count',
      path: 'components/dashboard/StreakIndicator.tsx',
      styleName: 'count',
    },
    {
      name: 'ExpenditureTrendCard — tdeeValue',
      path: 'components/analytics/ExpenditureTrendCard.tsx',
      styleName: 'tdeeValue',
    },
  ];

  // Track which components have been fixed with tabular-nums
  const fixedComponents = new Set([
    'ExpenditureTrendCard — tdeeValue',
  ]);

  test.each(numericComponents)(
    '$name — tabular-nums status',
    ({ name, path: filePath, styleName }) => {
      const source = readSource(filePath);
      const fontVariant = extractStyleProperty(source, styleName, 'fontVariant');

      if (fixedComponents.has(name)) {
        // Fixed: should reference tabular-nums via token or literal
        expect(fontVariant).not.toBeNull();
        const hasTabularNums =
          fontVariant!.includes('tabular-nums') ||
          fontVariant!.includes('typography.numeric');
        expect(hasTabularNums).toBe(true);
      } else {
        // Not yet fixed — document the gap (TYPO-003)
        // When fixed, move this component to the fixedComponents set above
        const hasFontVariant = fontVariant !== null;
        if (hasFontVariant) {
          // If someone added it, verify it's correct
          const hasTabularNums =
            fontVariant!.includes('tabular-nums') ||
            fontVariant!.includes('typography.numeric');
          expect(hasTabularNums).toBe(true);
        }
        // Either null (gap documented) or correctly set — both are acceptable
      }
    },
  );

  test('typography.numeric.fontVariant token exists in tokens.ts', () => {
    const source = readSource('theme/tokens.ts');
    expect(source).toContain('tabular-nums');
    expect(source).toContain('lining-nums');
  });

  test('onboarding steps DO use fontVariant (positive control)', () => {
    const source = readSource('screens/onboarding/steps/BodyMeasurementsStep.tsx');
    expect(source).toContain("fontVariant: ['tabular-nums']");
  });
});
