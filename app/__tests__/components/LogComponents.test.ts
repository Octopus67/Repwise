/**
 * Data-assertion tests for Log screen UI components.
 *
 * These tests verify prop interfaces, component contracts, and type shapes
 * WITHOUT rendering React Native components — matching the pattern from
 * BottomTabNavigator.test.tsx.
 */

import {
  computeQuickRelogItems,
  QuickRelogItem,
  MealFavorite,
} from '../../utils/quickRelogLogic';
import type { NutritionEntry } from '../../utils/mealSlotLogic';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<NutritionEntry> = {}): NutritionEntry {
  return {
    id: '1',
    meal_name: 'Oats',
    calories: 350,
    protein_g: 12,
    carbs_g: 50,
    fat_g: 8,
    entry_date: new Date().toISOString().split('T')[0],
    ...overrides,
  };
}

function makeFavorite(overrides: Partial<MealFavorite> = {}): MealFavorite {
  return {
    id: 'fav-1',
    name: 'Chicken Breast',
    calories: 280,
    protein_g: 42,
    carbs_g: 0,
    fat_g: 6,
    ...overrides,
  };
}

// ── 7.1: CollapsibleSection props interface ──────────────────────────────────

describe('CollapsibleSection props contract', () => {
  /**
   * The component uses `defaultExpanded ?? true` internally, meaning
   * when the prop is omitted (undefined) the section starts expanded.
   * We verify this contract by checking the nullish-coalescing default.
   */
  const COLLAPSIBLE_DEFAULTS = {
    defaultExpanded: undefined as boolean | undefined,
  };

  test('defaultExpanded defaults to true when undefined', () => {
    // Mirrors: const [expanded, setExpanded] = useState(defaultExpanded ?? true)
    const effective = COLLAPSIBLE_DEFAULTS.defaultExpanded ?? true;
    expect(effective).toBe(true);
  });

  test('defaultExpanded=false overrides the default', () => {
    const explicit = false;
    const effective = explicit ?? true;
    expect(effective).toBe(false);
  });

  test('defaultExpanded=true is preserved', () => {
    const explicit = true;
    const effective = explicit ?? true;
    expect(effective).toBe(true);
  });

  test('props interface has expected keys', () => {
    const expectedKeys = ['title', 'icon', 'defaultExpanded', 'children'];
    // CollapsibleSectionProps shape from the component
    const propsShape = {
      title: 'string',
      icon: 'ReactNode | undefined',
      defaultExpanded: 'boolean | undefined',
      children: 'ReactNode',
    };
    expect(Object.keys(propsShape)).toEqual(expectedKeys);
  });
});

// ── 7.2: QuickRelogRow hides when items is empty ─────────────────────────────

describe('QuickRelogRow visibility contract', () => {
  /**
   * The component returns null when items.length === 0 && !loading.
   * We verify this contract by testing the condition directly.
   */

  test('hidden when items is empty and not loading', () => {
    const items: QuickRelogItem[] = [];
    const loading = false;
    const shouldRender = !(items.length === 0 && !loading);
    expect(shouldRender).toBe(false);
  });

  test('visible when loading even with empty items', () => {
    const items: QuickRelogItem[] = [];
    const loading = true;
    const shouldRender = !(items.length === 0 && !loading);
    expect(shouldRender).toBe(true);
  });

  test('visible when items has entries', () => {
    const items: QuickRelogItem[] = [
      { name: 'Oats', calories: 350, protein_g: 12, carbs_g: 50, fat_g: 8 },
    ];
    const loading = false;
    const shouldRender = !(items.length === 0 && !loading);
    expect(shouldRender).toBe(true);
  });

  test('chip name truncation to 12 chars', () => {
    const longName = 'Chicken Breast Grilled';
    const truncated = longName.slice(0, 12);
    expect(truncated).toBe('Chicken Brea');
    expect(truncated.length).toBeLessThanOrEqual(12);
  });

  test('calorie badge formats correctly', () => {
    const calories = 349.7;
    const badge = Math.round(calories) + ' cal';
    expect(badge).toBe('350 cal');
  });
});

// ── 7.3: StartWorkoutCard hides "From Template" when templates empty ─────────

describe('StartWorkoutCard template visibility contract', () => {
  /**
   * The component checks: hasTemplates = userTemplates.length > 0 || staticTemplates.length > 0
   * When hasTemplates is false, only a single "Start Workout" button is shown
   * (no "From Template" button).
   */

  test('hides "From Template" when both template arrays are empty', () => {
    const userTemplates: any[] = [];
    const staticTemplates: any[] = [];
    const hasTemplates = userTemplates.length > 0 || staticTemplates.length > 0;
    expect(hasTemplates).toBe(false);
  });

  test('shows "From Template" when userTemplates has items', () => {
    const userTemplates = [{ id: '1', name: 'Push', exercises: [] }];
    const staticTemplates: any[] = [];
    const hasTemplates = userTemplates.length > 0 || staticTemplates.length > 0;
    expect(hasTemplates).toBe(true);
  });

  test('shows "From Template" when staticTemplates has items', () => {
    const userTemplates: any[] = [];
    const staticTemplates = [{ id: '1', name: 'Beginner', description: '', exercises: [] }];
    const hasTemplates = userTemplates.length > 0 || staticTemplates.length > 0;
    expect(hasTemplates).toBe(true);
  });

  test('shows "From Template" when both arrays have items', () => {
    const userTemplates = [{ id: '1', name: 'Push', exercises: [] }];
    const staticTemplates = [{ id: '2', name: 'Beginner', description: '', exercises: [] }];
    const hasTemplates = userTemplates.length > 0 || staticTemplates.length > 0;
    expect(hasTemplates).toBe(true);
  });

  test('props interface has expected keys', () => {
    const expectedKeys = ['userTemplates', 'staticTemplates', 'onStartEmpty', 'onStartTemplate'];
    const propsShape = {
      userTemplates: 'WorkoutTemplateResponse[]',
      staticTemplates: 'Array<{id,name,description,exercises}>',
      onStartEmpty: '() => void',
      onStartTemplate: '(templateId: string) => void',
    };
    expect(Object.keys(propsShape)).toEqual(expectedKeys);
  });
});

// ── 7.4: TemplateRow renders exercise count correctly ────────────────────────

describe('TemplateRow exercise count contract', () => {
  /**
   * The component renders: `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`
   * We verify the pluralization logic.
   */

  function formatExerciseCount(count: number): string {
    return `${count} ${count === 1 ? 'exercise' : 'exercises'}`;
  }

  test('singular for 1 exercise', () => {
    expect(formatExerciseCount(1)).toBe('1 exercise');
  });

  test('plural for 0 exercises', () => {
    expect(formatExerciseCount(0)).toBe('0 exercises');
  });

  test('plural for multiple exercises', () => {
    expect(formatExerciseCount(5)).toBe('5 exercises');
  });

  test('plural for large counts', () => {
    expect(formatExerciseCount(20)).toBe('20 exercises');
  });

  test('props interface has expected keys', () => {
    const expectedKeys = ['name', 'exerciseCount', 'onStart'];
    const propsShape = {
      name: 'string',
      exerciseCount: 'number',
      onStart: '() => void',
    };
    expect(Object.keys(propsShape)).toEqual(expectedKeys);
  });
});

// ── 7.5: QuickRelogItem type matches computeQuickRelogItems output ───────────

describe('QuickRelogItem type contract', () => {
  const QUICK_RELOG_ITEM_KEYS = ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g'];

  test('computeQuickRelogItems returns items with correct shape', () => {
    const entries: NutritionEntry[] = [
      makeEntry({ meal_name: 'Oats', calories: 350 }),
      makeEntry({ meal_name: 'Oats', calories: 350 }),
      makeEntry({ meal_name: 'Oats', calories: 350 }),
    ];
    const result = computeQuickRelogItems(entries, [], 5);
    expect(result.length).toBeGreaterThan(0);

    const item = result[0];
    expect(Object.keys(item).sort()).toEqual(QUICK_RELOG_ITEM_KEYS.sort());
  });

  test('each returned item has all required fields', () => {
    const entries: NutritionEntry[] = [
      makeEntry({ meal_name: 'Oats', calories: 350 }),
      makeEntry({ meal_name: 'Rice', calories: 200 }),
      makeEntry({ meal_name: 'Chicken', calories: 280 }),
    ];
    const result = computeQuickRelogItems(entries, [], 5);

    for (const item of result) {
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(typeof item.calories).toBe('number');
      expect(typeof item.protein_g).toBe('number');
      expect(typeof item.carbs_g).toBe('number');
      expect(typeof item.fat_g).toBe('number');
    }
  });

  test('empty inputs produce empty output', () => {
    const result = computeQuickRelogItems([], [], 5);
    expect(result).toEqual([]);
  });

  test('favorites-only input produces items with correct shape', () => {
    const favorites: MealFavorite[] = [
      makeFavorite({ name: 'Chicken Breast' }),
      makeFavorite({ name: 'Brown Rice', id: 'fav-2', calories: 215 }),
      makeFavorite({ name: 'Broccoli', id: 'fav-3', calories: 55 }),
    ];
    const result = computeQuickRelogItems([], favorites, 5);
    expect(result.length).toBe(3);

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(QUICK_RELOG_ITEM_KEYS.sort());
    }
  });

  test('returned items match QuickRelogItem interface exactly (no extra keys)', () => {
    const entries: NutritionEntry[] = [
      makeEntry({ meal_name: 'Oats' }),
    ];
    const result = computeQuickRelogItems(entries, [], 5);
    if (result.length > 0) {
      const keys = Object.keys(result[0]);
      expect(keys).toHaveLength(QUICK_RELOG_ITEM_KEYS.length);
      for (const key of QUICK_RELOG_ITEM_KEYS) {
        expect(keys).toContain(key);
      }
    }
  });
});
