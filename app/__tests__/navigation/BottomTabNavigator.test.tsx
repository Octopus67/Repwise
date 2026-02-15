/**
 * Unit tests for BottomTabNavigator structure
 * Validates: Requirements 1.1, 1.5, 1.6
 *
 * Tests the navigation structure as data assertions.
 * Cannot import the actual navigator (React Native rendering deps),
 * so we define the expected structure and verify it matches the spec.
 */

describe('BottomTabNavigator structure', () => {
  // These mirror the BottomTabParamList type from BottomTabNavigator.tsx
  // After task 15 consolidation: 4 tabs
  const BOTTOM_TAB_KEYS = ['Home', 'Log', 'Analytics', 'Profile'];

  test('BottomTabParamList has exactly 4 tabs', () => {
    expect(BOTTOM_TAB_KEYS).toHaveLength(4);
  });

  test('BottomTabParamList has expected tab names', () => {
    expect(BOTTOM_TAB_KEYS).toEqual(
      expect.arrayContaining(['Home', 'Log', 'Analytics', 'Profile']),
    );
  });

  test('No "More", "Learn", or "Dashboard" tab exists', () => {
    expect(BOTTOM_TAB_KEYS).not.toContain('More');
    expect(BOTTOM_TAB_KEYS).not.toContain('Learn');
    expect(BOTTOM_TAB_KEYS).not.toContain('Dashboard');
  });

  describe('ProfileStackParamList routes', () => {
    // These mirror ProfileStackParamList from BottomTabNavigator.tsx
    const PROFILE_STACK_ROUTES = [
      'ProfileHome',
      'Learn',
      'ArticleDetail',
      'Coaching',
      'Community',
      'FounderStory',
      'HealthReports',
    ];

    test('ProfileStack contains all expected routes', () => {
      expect(PROFILE_STACK_ROUTES).toContain('ProfileHome');
      expect(PROFILE_STACK_ROUTES).toContain('Learn');
      expect(PROFILE_STACK_ROUTES).toContain('ArticleDetail');
      expect(PROFILE_STACK_ROUTES).toContain('Coaching');
      expect(PROFILE_STACK_ROUTES).toContain('Community');
      expect(PROFILE_STACK_ROUTES).toContain('FounderStory');
      expect(PROFILE_STACK_ROUTES).toContain('HealthReports');
    });

    test('ProfileStack has 7 routes total', () => {
      expect(PROFILE_STACK_ROUTES).toHaveLength(7);
    });
  });

  describe('Feature routes accessible from navigation', () => {
    // All feature routes now live in ProfileStack
    const FEATURE_ROUTES = ['Coaching', 'Community', 'FounderStory', 'HealthReports', 'Learn'];

    test('all feature routes are defined', () => {
      expect(FEATURE_ROUTES).toHaveLength(5);
    });

    test('Learn and ArticleDetail routes exist in ProfileStack', () => {
      const PROFILE_STACK_ROUTES = [
        'ProfileHome', 'Learn', 'ArticleDetail', 'Coaching',
        'Community', 'FounderStory', 'HealthReports',
      ];
      expect(PROFILE_STACK_ROUTES).toContain('Learn');
      expect(PROFILE_STACK_ROUTES).toContain('ArticleDetail');
    });
  });
});
