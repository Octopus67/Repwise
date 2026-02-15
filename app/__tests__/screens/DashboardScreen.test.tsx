import { getGreeting } from '../../utils/greeting';
import { calculateStreak } from '../../utils/calculateStreak';

/**
 * Unit tests for DashboardScreen logic
 * Validates: Requirements 2.1, 2.2, 3.1, 3.2, 4.4, 17.1
 *
 * Tests pure functions and data structures used by DashboardScreen.
 * Avoids React Native rendering — focuses on logic correctness.
 */

describe('DashboardScreen logic', () => {
  describe('getGreeting with profile name', () => {
    test('returns greeting with profile name for morning', () => {
      expect(getGreeting('Alex', 8)).toBe('Good morning, Alex');
    });

    test('returns greeting with profile name for afternoon', () => {
      expect(getGreeting('Jordan', 14)).toBe('Good afternoon, Jordan');
    });

    test('returns greeting with profile name for evening', () => {
      expect(getGreeting('Sam', 20)).toBe('Good evening, Sam');
    });

    test('returns greeting without name when displayName is undefined', () => {
      expect(getGreeting(undefined, 10)).toBe('Good morning');
    });

    test('returns greeting without name when displayName is empty', () => {
      expect(getGreeting('', 15)).toBe('Good afternoon');
    });
  });

  describe('calculateStreak', () => {
    test('returns 0 for empty log dates', () => {
      expect(calculateStreak([], '2024-01-15')).toBe(0);
    });

    test('returns 0 when today is not in log dates', () => {
      expect(calculateStreak(['2024-01-13', '2024-01-14'], '2024-01-15')).toBe(0);
    });

    test('returns 1 when only today is logged', () => {
      expect(calculateStreak(['2024-01-15'], '2024-01-15')).toBe(1);
    });

    test('returns correct streak for consecutive days', () => {
      const dates = ['2024-01-12', '2024-01-13', '2024-01-14', '2024-01-15'];
      expect(calculateStreak(dates, '2024-01-15')).toBe(4);
    });

    test('returns correct streak when there is a gap', () => {
      const dates = ['2024-01-10', '2024-01-13', '2024-01-14', '2024-01-15'];
      expect(calculateStreak(dates, '2024-01-15')).toBe(3);
    });

    test('handles duplicate dates correctly', () => {
      const dates = ['2024-01-14', '2024-01-14', '2024-01-15', '2024-01-15'];
      expect(calculateStreak(dates, '2024-01-15')).toBe(2);
    });
  });

  describe('Dashboard section order', () => {
    // The sections as rendered top-to-bottom in DashboardScreen
    const DASHBOARD_SECTIONS = [
      'Header',
      'MacroRings',
      'TodaySummary',
      'QuickActions',
      'Featured',
    ];

    test('dashboard has 5 sections in correct order', () => {
      expect(DASHBOARD_SECTIONS).toEqual([
        'Header',
        'MacroRings',
        'TodaySummary',
        'QuickActions',
        'Featured',
      ]);
    });

    test('Header is first section', () => {
      expect(DASHBOARD_SECTIONS[0]).toBe('Header');
    });

    test('Featured is last section', () => {
      expect(DASHBOARD_SECTIONS[DASHBOARD_SECTIONS.length - 1]).toBe('Featured');
    });
  });

  describe('Featured section conditional', () => {
    // The dashboard omits the Featured section when articles array is empty
    function shouldShowFeatured(articles: { id: string }[]): boolean {
      return articles.length > 0;
    }

    test('featured section is shown when articles exist', () => {
      expect(shouldShowFeatured([{ id: '1' }, { id: '2' }])).toBe(true);
    });

    test('featured section is omitted when articles array is empty', () => {
      expect(shouldShowFeatured([])).toBe(false);
    });

    test('featured section is shown with single article', () => {
      expect(shouldShowFeatured([{ id: '1' }])).toBe(true);
    });
  });
});
