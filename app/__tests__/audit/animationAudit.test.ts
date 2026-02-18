import * as fs from 'fs';
import * as path from 'path';

/**
 * Animation Audit — Property-Based Tests
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

// ── Spring presets from tokens.ts ────────────────────────────────────────────

const SPRING_PRESETS = {
  gentle: { damping: 20, stiffness: 200, mass: 0.5 },
  snappy: { damping: 15, stiffness: 400, mass: 0.3 },
  bouncy: { damping: 10, stiffness: 300, mass: 0.5 },
};

// ── Property 10: Spring Preset Compliance ────────────────────────────────────

describe('Property 10 — Spring Preset Compliance', () => {
  /**
   * Validates: Requirements 6.3, 6.5
   *
   * For files using withSpring, verify config objects either reference
   * a springs.* token or match one of the 3 preset values.
   */

  const filesWithWithSpring = [
    { name: 'usePressAnimation', path: 'hooks/usePressAnimation.ts' },
    { name: 'ProgressRing', path: 'components/common/ProgressRing.tsx' },
  ];

  test.each(filesWithWithSpring)(
    '$name — withSpring calls should reference springs.* token',
    ({ path: filePath }) => {
      const source = readSource(filePath);
      // Verify the file imports springs from tokens
      expect(source).toMatch(/springs/);
      // Verify withSpring calls use springs.gentle, springs.snappy, or springs.bouncy
      const withSpringCalls = source.match(/withSpring\([^)]+\)/g) || [];
      expect(withSpringCalls.length).toBeGreaterThan(0);
      for (const call of withSpringCalls) {
        expect(call).toMatch(/springs\.(gentle|snappy|bouncy)/);
      }
    },
  );

  // Files that previously had inline spring configs — now consolidated to use token references
  const filesNowUsingTokenSprings = [
    {
      name: 'PRBanner',
      path: 'components/training/PRBanner.tsx',
      preset: 'bouncy',
      note: 'Migrated from inline {damping:12, stiffness:200} to springs.bouncy',
    },
    {
      name: 'RestTimerBar',
      path: 'components/training/RestTimerBar.tsx',
      preset: 'gentle',
      note: 'Migrated from inline {damping:20, stiffness:200, mass:0.5} to springs.gentle',
    },
  ];

  test.each(filesNowUsingTokenSprings)(
    '$name — now uses springs.* token ($note)',
    ({ path: filePath, preset }) => {
      const source = readSource(filePath);
      // Verify the file imports springs from tokens
      expect(source).toMatch(/springs/);
      // Verify it references the correct preset
      expect(source).toContain(`springs.${preset}`);
      // Verify no inline damping/stiffness values remain
      expect(source).not.toMatch(/damping:\s*\d+/);
      expect(source).not.toMatch(/stiffness:\s*\d+/);
    },
  );
});

// ── Property 14: Skeleton Loading Coverage ───────────────────────────────────

describe('Property 14 — Skeleton Loading Coverage', () => {
  /**
   * Validates: Requirements 6.4
   *
   * For async screens that fetch data, verify they import Skeleton
   * or a skeleton pattern before data is available.
   */

  const asyncScreensWithSkeleton = [
    { name: 'DashboardScreen', path: 'screens/dashboard/DashboardScreen.tsx', hasSkeleton: true },
    { name: 'LogsScreen', path: 'screens/logs/LogsScreen.tsx', hasSkeleton: true },
    { name: 'AnalyticsScreen', path: 'screens/analytics/AnalyticsScreen.tsx', hasSkeleton: true },
  ];

  test.each(asyncScreensWithSkeleton)(
    '$name — should import Skeleton component',
    ({ path: filePath }) => {
      const source = readSource(filePath);
      expect(source).toMatch(/import.*\{[^}]*Skeleton[^}]*\}.*from/);
    },
  );

  const asyncScreensMissingSkeleton = [
    { name: 'ProfileScreen', path: 'screens/profile/ProfileScreen.tsx' },
    { name: 'CoachingScreen', path: 'screens/coaching/CoachingScreen.tsx' },
    { name: 'CommunityScreen', path: 'screens/community/CommunityScreen.tsx' },
    { name: 'LearnScreen', path: 'screens/learn/LearnScreen.tsx' },
    { name: 'HealthReportsScreen', path: 'screens/health/HealthReportsScreen.tsx' },
  ];

  test.each(asyncScreensMissingSkeleton)(
    '$name — missing Skeleton import (ANIM-015 through ANIM-019)',
    ({ path: filePath }) => {
      const source = readSource(filePath);
      // Document the finding: Skeleton is NOT imported
      expect(source).not.toMatch(/import.*\{[^}]*Skeleton[^}]*\}.*from/);
    },
  );

  test('NutritionReportScreen uses ActivityIndicator instead of Skeleton (ANIM-020)', () => {
    const source = readSource('screens/nutrition/NutritionReportScreen.tsx');
    expect(source).toContain('ActivityIndicator');
    expect(source).not.toMatch(/import.*\{[^}]*Skeleton[^}]*\}.*from/);
  });
});

// ── Property 15: Empty State Coverage ────────────────────────────────────────

describe('Property 15 — Empty State Coverage', () => {
  /**
   * Validates: Requirements 6.7
   *
   * For data-list screens that can have zero data, verify they import
   * the EmptyState component.
   */

  const screensWithEmptyState = [
    { name: 'LogsScreen', path: 'screens/logs/LogsScreen.tsx' },
    { name: 'AnalyticsScreen', path: 'screens/analytics/AnalyticsScreen.tsx' },
    { name: 'LearnScreen', path: 'screens/learn/LearnScreen.tsx' },
    { name: 'CoachingScreen', path: 'screens/coaching/CoachingScreen.tsx' },
    { name: 'HealthReportsScreen', path: 'screens/health/HealthReportsScreen.tsx' },
  ];

  test.each(screensWithEmptyState)(
    '$name — should import EmptyState component',
    ({ path: filePath }) => {
      const source = readSource(filePath);
      expect(source).toMatch(/import.*\{[^}]*EmptyState[^}]*\}.*from/);
    },
  );

  const screensMissingEmptyState = [
    { name: 'ProgressPhotosScreen', path: 'screens/profile/ProgressPhotosScreen.tsx' },
    { name: 'CommunityScreen', path: 'screens/community/CommunityScreen.tsx' },
  ];

  test.each(screensMissingEmptyState)(
    '$name — missing EmptyState import (ANIM-025/026)',
    ({ path: filePath }) => {
      const source = readSource(filePath);
      // Document the finding: EmptyState is NOT imported
      expect(source).not.toMatch(/import.*\{[^}]*EmptyState[^}]*\}.*from/);
    },
  );
});
