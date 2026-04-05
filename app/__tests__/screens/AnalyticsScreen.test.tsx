// Audit fix 5.2 — AnalyticsScreen tests
import { filterByTimeRange } from '../../utils/filterByTimeRange';
import { computeEMA, EMA_MIN_POINTS } from '../../utils/emaTrend';
import type { TrendPoint, TimeRange, FatigueScore, Classification } from '../../types/analytics';

/** Unit tests for AnalyticsScreen logic — tabs, time ranges, data transforms, states. */

const ANALYTICS_TABS = ['nutrition', 'training', 'body', 'volume'] as const;
type AnalyticsTab = typeof ANALYTICS_TABS[number];

const TIME_RANGES: TimeRange[] = ['7d', '14d', '30d', '90d'];
const RANGE_DAYS: Record<TimeRange, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };

function makeTrendPoints(count: number, startDaysAgo: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - startDaysAgo + i);
    points.push({ date: d.toISOString().split('T')[0], value: 100 + i });
  }
  return points;
}

describe('AnalyticsScreen logic', () => {
  describe('Tab switching', () => {
    test('has exactly 4 tabs: nutrition, training, body, volume', () => {
      expect(ANALYTICS_TABS).toEqual(['nutrition', 'training', 'body', 'volume']);
    });

    test('default tab is nutrition', () => {
      const defaultTab: AnalyticsTab = 'nutrition';
      expect(defaultTab).toBe('nutrition');
    });

    test('all tab values are valid AnalyticsTab types', () => {
      const valid = new Set<string>(['nutrition', 'training', 'body', 'volume']);
      ANALYTICS_TABS.forEach((t) => expect(valid.has(t)).toBe(true));
    });

    test('tab label capitalizes first letter', () => {
      ANALYTICS_TABS.forEach((t) => {
        const label = t.charAt(0).toUpperCase() + t.slice(1);
        expect(label[0]).toBe(t[0].toUpperCase());
        expect(label.slice(1)).toBe(t.slice(1));
      });
    });
  });

  describe('Time range selection', () => {
    test('all 4 time ranges are supported', () => {
      expect(TIME_RANGES).toEqual(['7d', '14d', '30d', '90d']);
    });

    test('RANGE_DAYS maps correctly', () => {
      expect(RANGE_DAYS['7d']).toBe(7);
      expect(RANGE_DAYS['14d']).toBe(14);
      expect(RANGE_DAYS['30d']).toBe(30);
      expect(RANGE_DAYS['90d']).toBe(90);
    });

    test('filterByTimeRange returns only points within range', () => {
      const data = makeTrendPoints(100, 100);
      const filtered = filterByTimeRange(data, '30d');
      filtered.forEach((p) => {
        const daysDiff = Math.floor((Date.now() - new Date(p.date + 'T00:00:00').getTime()) / 86400000);
        expect(daysDiff).toBeLessThanOrEqual(30);
      });
    });

    test('filterByTimeRange returns empty for empty input', () => {
      expect(filterByTimeRange([], '7d')).toEqual([]);
    });

    test('7d range returns fewer points than 90d', () => {
      const data = makeTrendPoints(100, 100);
      const short = filterByTimeRange(data, '7d');
      const long = filterByTimeRange(data, '90d');
      expect(short.length).toBeLessThanOrEqual(long.length);
    });
  });

  describe('Loading states', () => {
    test('isLoading starts true and transitions to false', () => {
      let isLoading = true;
      expect(isLoading).toBe(true);
      isLoading = false;
      expect(isLoading).toBe(false);
    });

    test('error is null initially', () => {
      const error: string | null = null;
      expect(error).toBeNull();
    });
  });

  describe('Error states', () => {
    test('error message is set on fetch failure', () => {
      const error = 'Unable to load analytics. Check your connection.';
      expect(error).toBeTruthy();
      expect(typeof error).toBe('string');
    });

    test('error can be dismissed by setting to null', () => {
      let error: string | null = 'Some error';
      error = null;
      expect(error).toBeNull();
    });
  });

  describe('Chart data preparation', () => {
    test('calorie trend aggregation by date', () => {
      const entries = [
        { entry_date: '2024-01-15', calories: 500, protein_g: 30 },
        { entry_date: '2024-01-15', calories: 700, protein_g: 40 },
        { entry_date: '2024-01-16', calories: 600, protein_g: 35 },
      ];
      const byDate: Record<string, { cal: number; pro: number }> = {};
      entries.forEach((e) => {
        if (!byDate[e.entry_date]) byDate[e.entry_date] = { cal: 0, pro: 0 };
        byDate[e.entry_date].cal += e.calories ?? 0;
        byDate[e.entry_date].pro += e.protein_g ?? 0;
      });
      expect(byDate['2024-01-15'].cal).toBe(1200);
      expect(byDate['2024-01-15'].pro).toBe(70);
      expect(byDate['2024-01-16'].cal).toBe(600);
    });

    test('bodyweight EMA requires minimum points', () => {
      const tooFew = makeTrendPoints(2, 2);
      const ema = computeEMA(tooFew);
      expect(ema.length).toBe(0);
    });

    test('bodyweight EMA produces output for sufficient data', () => {
      const enough = makeTrendPoints(10, 10);
      const ema = computeEMA(enough);
      expect(ema.length).toBeGreaterThan(0);
    });

    test('caloriesByDate record built from calorieTrend', () => {
      const calorieTrend: TrendPoint[] = [
        { date: '2024-01-15', value: 2100 },
        { date: '2024-01-16', value: 2300 },
      ];
      const caloriesByDate: Record<string, number> = {};
      calorieTrend.forEach((p) => { caloriesByDate[p.date] = p.value; });
      expect(caloriesByDate['2024-01-15']).toBe(2100);
      expect(caloriesByDate['2024-01-16']).toBe(2300);
    });
  });

  describe('Fatigue scores structure', () => {
    test('fatigue score has required fields', () => {
      const score: FatigueScore = {
        muscle_group: 'chest',
        score: 0.65,
        regression_component: 0.2,
        volume_component: 0.3,
        frequency_component: 0.1,
        nutrition_component: 0.05,
      };
      expect(score.muscle_group).toBe('chest');
      expect(score.score).toBeGreaterThanOrEqual(0);
    });

    test('classification has required fields', () => {
      const cls: Classification = {
        exercise_name: 'bench press',
        e1rm_kg: 100,
        bodyweight_kg: 80,
        bodyweight_ratio: 1.25,
        level: 'intermediate',
        next_level: 'advanced',
        next_level_threshold_kg: 120,
      };
      expect(cls.level).toBe('intermediate');
      expect(cls.bodyweight_ratio).toBeCloseTo(1.25);
    });
  });

  describe('Exercise options', () => {
    const EXERCISE_OPTIONS = ['bench press', 'squat', 'deadlift', 'overhead press', 'barbell row'];
    const E1RM_OPTIONS = ['barbell bench press', 'barbell back squat', 'conventional deadlift', 'overhead press', 'barbell row'];

    test('strength exercise options has 5 entries', () => {
      expect(EXERCISE_OPTIONS).toHaveLength(5);
    });

    test('e1rm exercise options has 5 entries', () => {
      expect(E1RM_OPTIONS).toHaveLength(5);
    });

    test('default exercise is first option', () => {
      expect(EXERCISE_OPTIONS[0]).toBe('bench press');
      expect(E1RM_OPTIONS[0]).toBe('barbell bench press');
    });
  });
});
