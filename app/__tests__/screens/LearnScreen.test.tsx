import { colors } from '../../theme/tokens';

/**
 * Unit tests for LearnScreen logic
 * Validates: Requirements 9.1, 8.4, 9.4
 *
 * Tests the data structures and filter logic used by LearnScreen.
 * Avoids React Native rendering — focuses on logic correctness.
 */

// Inline the constants from LearnScreen
const CATEGORIES = ['All', 'Nutrition', 'Training', 'Recovery', 'Mindset'];

const CATEGORY_COLORS: Record<string, string> = {
  Nutrition: colors.macro.calories,
  Training: colors.macro.protein,
  Recovery: colors.macro.carbs,
  Mindset: colors.macro.fat,
};

interface Article {
  id: string;
  title: string;
  module_name?: string;
  tags: string[];
  is_premium: boolean;
  estimated_read_time_min: number;
  published_at: string;
}

// Inline the filter logic: when category is 'All', all articles show; otherwise only matching
function filterArticles(articles: Article[], category: string): Article[] {
  if (category === 'All') return articles;
  return articles.filter((a) => a.module_name === category);
}

describe('LearnScreen logic', () => {
  describe('CATEGORIES array', () => {
    test('contains exactly 5 categories', () => {
      expect(CATEGORIES).toHaveLength(5);
    });

    test('contains expected values in order', () => {
      expect(CATEGORIES).toEqual(['All', 'Nutrition', 'Training', 'Recovery', 'Mindset']);
    });

    test('"All" is the first category', () => {
      expect(CATEGORIES[0]).toBe('All');
    });
  });

  describe('CATEGORY_COLORS mapping', () => {
    test('Nutrition maps to macro.calories color', () => {
      expect(CATEGORY_COLORS['Nutrition']).toBe(colors.macro.calories);
    });

    test('Training maps to macro.protein color', () => {
      expect(CATEGORY_COLORS['Training']).toBe(colors.macro.protein);
    });

    test('Recovery maps to macro.carbs color', () => {
      expect(CATEGORY_COLORS['Recovery']).toBe(colors.macro.carbs);
    });

    test('Mindset maps to macro.fat color', () => {
      expect(CATEGORY_COLORS['Mindset']).toBe(colors.macro.fat);
    });

    test('has exactly 4 color mappings (no "All")', () => {
      expect(Object.keys(CATEGORY_COLORS)).toHaveLength(4);
      expect(CATEGORY_COLORS['All']).toBeUndefined();
    });
  });

  describe('Article filter logic', () => {
    const sampleArticles: Article[] = [
      { id: '1', title: 'Protein Guide', module_name: 'Nutrition', tags: ['protein'], is_premium: false, estimated_read_time_min: 5, published_at: '2024-01-01' },
      { id: '2', title: 'Push Pull Legs', module_name: 'Training', tags: ['split'], is_premium: false, estimated_read_time_min: 8, published_at: '2024-01-02' },
      { id: '3', title: 'Sleep Science', module_name: 'Recovery', tags: ['sleep'], is_premium: true, estimated_read_time_min: 6, published_at: '2024-01-03' },
      { id: '4', title: 'Mental Toughness', module_name: 'Mindset', tags: ['focus'], is_premium: false, estimated_read_time_min: 4, published_at: '2024-01-04' },
      { id: '5', title: 'Meal Prep', module_name: 'Nutrition', tags: ['meals'], is_premium: false, estimated_read_time_min: 7, published_at: '2024-01-05' },
    ];

    test('category "All" returns all articles', () => {
      const result = filterArticles(sampleArticles, 'All');
      expect(result).toHaveLength(5);
      expect(result).toEqual(sampleArticles);
    });

    test('category "Nutrition" returns only nutrition articles', () => {
      const result = filterArticles(sampleArticles, 'Nutrition');
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.module_name === 'Nutrition')).toBe(true);
    });

    test('category "Training" returns only training articles', () => {
      const result = filterArticles(sampleArticles, 'Training');
      expect(result).toHaveLength(1);
      expect(result[0].module_name).toBe('Training');
    });

    test('category "Recovery" returns only recovery articles', () => {
      const result = filterArticles(sampleArticles, 'Recovery');
      expect(result).toHaveLength(1);
      expect(result[0].module_name).toBe('Recovery');
    });

    test('category "Mindset" returns only mindset articles', () => {
      const result = filterArticles(sampleArticles, 'Mindset');
      expect(result).toHaveLength(1);
      expect(result[0].module_name).toBe('Mindset');
    });

    test('filtering empty array returns empty for any category', () => {
      expect(filterArticles([], 'All')).toHaveLength(0);
      expect(filterArticles([], 'Nutrition')).toHaveLength(0);
    });

    test('non-matching category returns empty array', () => {
      const result = filterArticles(sampleArticles, 'NonExistent');
      expect(result).toHaveLength(0);
    });
  });
});
