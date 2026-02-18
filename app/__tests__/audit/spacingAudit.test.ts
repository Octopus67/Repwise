import * as fs from 'fs';
import * as path from 'path';

/**
 * Spacing Audit — Property-Based Tests
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
 * Looks for patterns like:  styleName: { ... property: <value>, ... }
 */
function extractStyleProperty(
  source: string,
  styleName: string,
  property: string,
): string | null {
  // Match the style block: styleName: { ... }
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

/**
 * Extract horizontal padding from a style block.
 * Checks for paddingHorizontal first, then falls back to padding shorthand.
 */
function extractHorizontalPadding(source: string, styleName: string): string | null {
  // First check for explicit paddingHorizontal
  const paddingH = extractStyleProperty(source, styleName, 'paddingHorizontal');
  if (paddingH) return paddingH;

  // Fall back to padding shorthand (which sets all sides)
  const padding = extractStyleProperty(source, styleName, 'padding');
  if (padding) return padding;

  return null;
}

// ── Property 13: Screen Horizontal Padding Consistency ───────────────────────

describe('Property 13 — Screen Horizontal Padding Consistency', () => {
  /**
   * Validates: Requirements 5.2
   *
   * For the 4 primary tab screens, parse the source files and extract
   * the paddingHorizontal value from the root content container style.
   * Assert all 4 use the same spacing token.
   */

  const primaryScreens = [
    {
      name: 'DashboardScreen',
      path: 'screens/dashboard/DashboardScreen.tsx',
      contentStyleName: 'content',
    },
    {
      name: 'LogsScreen',
      path: 'screens/logs/LogsScreen.tsx',
      contentStyleName: 'listContent',
    },
    {
      name: 'AnalyticsScreen',
      path: 'screens/analytics/AnalyticsScreen.tsx',
      contentStyleName: 'content',
    },
    {
      name: 'ProfileScreen',
      path: 'screens/profile/ProfileScreen.tsx',
      contentStyleName: 'content',
    },
  ];

  const paddingValues = primaryScreens.map((screen) => {
    const source = readSource(screen.path);
    const value = extractHorizontalPadding(source, screen.contentStyleName);
    return { name: screen.name, value };
  });

  test('all 4 primary tab screens have a horizontal padding value defined', () => {
    for (const { name, value } of paddingValues) {
      expect(value).not.toBeNull();
    }
  });

  test('all 4 primary tab screens use identical horizontal padding', () => {
    const values = paddingValues.map((p) => p.value);
    const unique = new Set(values);
    expect(unique.size).toBe(1);
  });

  test('horizontal padding references a spacing token', () => {
    const firstValue = paddingValues[0].value;
    expect(firstValue).toContain('spacing');
  });

  test('horizontal padding uses spacing[4] (16px)', () => {
    for (const { name, value } of paddingValues) {
      expect(value).toBe('spacing[4]');
    }
  });
});
