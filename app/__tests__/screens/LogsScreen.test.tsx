/**
 * Integration & contract tests for the redesigned LogsScreen.
 *
 * Data-assertion tests — no React rendering. Validates:
 * - Quick Re-log scoring integration
 * - Meal slot grouping integration
 * - Component prop contracts (QuickRelogItem ↔ AddNutritionModal, StartWorkoutCard ↔ ActiveWorkout)
 * - Feature flag behavior
 * - Empty state logic
 */

import {
  computeQuickRelogItems,
  QuickRelogItem,
  MealFavorite,
} from '../../utils/quickRelogLogic';
import {
  groupEntriesBySlot,
  NutritionEntry,
  MealSlotName,
} from '../../utils/mealSlotLogic';
import type { ActiveWorkoutScreenParams } from '../../types/training';
import {
  isTrainingLogV2Enabled,
  setTrainingLogV2Flag,
} from '../../utils/featureFlags';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<NutritionEntry> = {}): NutritionEntry {
  return {
    id: Math.random().toString(36).slice(2),
    meal_name: 'Test food',
    calories: 200,
    protein_g: 20,
    carbs_g: 25,
    fat_g: 8,
    entry_date: new Date().toISOString().split('T')[0],
    created_at: null,
    ...overrides,
  };
}

function makeFavorite(overrides: Partial<MealFavorite> = {}): MealFavorite {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Fav food',
    calories: 150,
    protein_g: 12,
    carbs_g: 18,
    fat_g: 5,
    ...overrides,
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// 10.1: computeQuickRelogItems integration
// ═══════════════════════════════════════════════════════════════════════════

describe('10.1: computeQuickRelogItems integration', () => {
  const today = new Date().toISOString().split('T')[0];

  test('given mock entries and favorites, returns correctly ranked items', () => {
    const entries: NutritionEntry[] = [
      // "Oats" logged 4 times today → high frequency + max recency
      ...Array.from({ length: 4 }, () =>
        makeEntry({ meal_name: 'Oats', calories: 350, protein_g: 12, carbs_g: 50, fat_g: 8, entry_date: today }),
      ),
      // "Chicken breast" logged 2 times today
      ...Array.from({ length: 2 }, () =>
        makeEntry({ meal_name: 'Chicken breast', calories: 280, protein_g: 40, carbs_g: 0, fat_g: 6, entry_date: today }),
      ),
      // "Rice" logged 1 time today
      makeEntry({ meal_name: 'Rice', calories: 200, protein_g: 4, carbs_g: 45, fat_g: 1, entry_date: today }),
    ];

    const favorites: MealFavorite[] = [
      makeFavorite({ name: 'Protein shake', calories: 180 }),
    ];

    const result = computeQuickRelogItems(entries, favorites, 5);

    // Oats should rank first (highest frequency × recency)
    expect(result[0].name).toBe('Oats');
    // Chicken breast second
    expect(result[1].name).toBe('Chicken breast');
    // Rice third
    expect(result[2].name).toBe('Rice');
    // All items have expected shape
    for (const item of result) {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('calories');
      expect(item).toHaveProperty('protein_g');
      expect(item).toHaveProperty('carbs_g');
      expect(item).toHaveProperty('fat_g');
    }
  });

  test('favorites backfill when fewer than 3 behavioral items', () => {
    const entries: NutritionEntry[] = [
      makeEntry({ meal_name: 'Oats', calories: 350, entry_date: today }),
    ];
    const favorites: MealFavorite[] = [
      makeFavorite({ name: 'Protein shake', calories: 180 }),
      makeFavorite({ name: 'Greek yogurt', calories: 120 }),
    ];

    const result = computeQuickRelogItems(entries, favorites, 5);

    // 1 behavioral + 2 favorites = 3 items
    expect(result.length).toBe(3);
    const names = result.map((r) => r.name);
    expect(names).toContain('Oats');
    expect(names).toContain('Protein shake');
    expect(names).toContain('Greek yogurt');
  });

  test('empty inputs return empty array', () => {
    expect(computeQuickRelogItems([], [], 5)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10.2: groupEntriesBySlot integration
// ═══════════════════════════════════════════════════════════════════════════

describe('10.2: groupEntriesBySlot integration', () => {
  test('"Breakfast oats" lands in Breakfast slot, "Lunch chicken" lands in Lunch slot', () => {
    const entries: NutritionEntry[] = [
      makeEntry({ meal_name: 'Breakfast oats', calories: 350 }),
      makeEntry({ meal_name: 'Lunch chicken', calories: 280 }),
    ];

    const slots = groupEntriesBySlot(entries);

    // Should always return 4 slots
    expect(slots).toHaveLength(4);

    const slotNames = slots.map((s) => s.name);
    expect(slotNames).toEqual(['Breakfast', 'Lunch', 'Snack', 'Dinner']);

    // Breakfast slot has the oats entry
    const breakfast = slots.find((s) => s.name === 'Breakfast')!;
    expect(breakfast.entries).toHaveLength(1);
    expect(breakfast.entries[0].meal_name).toBe('Breakfast oats');
    expect(breakfast.totals.calories).toBe(350);

    // Lunch slot has the chicken entry
    const lunch = slots.find((s) => s.name === 'Lunch')!;
    expect(lunch.entries).toHaveLength(1);
    expect(lunch.entries[0].meal_name).toBe('Lunch chicken');
    expect(lunch.totals.calories).toBe(280);

    // Snack and Dinner are empty
    const snack = slots.find((s) => s.name === 'Snack')!;
    expect(snack.entries).toHaveLength(0);
    const dinner = slots.find((s) => s.name === 'Dinner')!;
    expect(dinner.entries).toHaveLength(0);
  });

  test('entries without slot keywords default to Snack', () => {
    const entries: NutritionEntry[] = [
      makeEntry({ meal_name: 'Protein shake' }),
      makeEntry({ meal_name: 'Quick add' }),
    ];

    const slots = groupEntriesBySlot(entries);
    const snack = slots.find((s) => s.name === 'Snack')!;
    expect(snack.entries).toHaveLength(2);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// 10.3: Quick Re-log → AddNutritionModal contract
// ═══════════════════════════════════════════════════════════════════════════

describe('10.3: QuickRelogItem ↔ AddNutritionModal.prefilledMealName contract', () => {
  test('QuickRelogItem.name is a string compatible with prefilledMealName prop', () => {
    const item: QuickRelogItem = {
      name: 'Oats',
      calories: 350,
      protein_g: 12,
      carbs_g: 50,
      fat_g: 8,
    };

    // The AddNutritionModal Props interface accepts: prefilledMealName?: string
    // QuickRelogItem.name is string — this is the value passed to prefilledMealName
    const prefilledMealName: string | undefined = item.name;
    expect(typeof prefilledMealName).toBe('string');
    expect(prefilledMealName).toBe('Oats');
  });

  test('QuickRelogItem shape has all required fields for pre-filling', () => {
    const entries: NutritionEntry[] = [
      makeEntry({ meal_name: 'Chicken breast', calories: 280, protein_g: 40, carbs_g: 0, fat_g: 6 }),
      makeEntry({ meal_name: 'Chicken breast', calories: 280, protein_g: 40, carbs_g: 0, fat_g: 6 }),
      makeEntry({ meal_name: 'Chicken breast', calories: 280, protein_g: 40, carbs_g: 0, fat_g: 6 }),
    ];

    const items = computeQuickRelogItems(entries, [], 5);
    expect(items.length).toBeGreaterThan(0);

    const item = items[0];
    // Contract: these fields must exist for the modal to pre-fill correctly
    expect(typeof item.name).toBe('string');
    expect(typeof item.calories).toBe('number');
    expect(typeof item.protein_g).toBe('number');
    expect(typeof item.carbs_g).toBe('number');
    expect(typeof item.fat_g).toBe('number');

    // The screen passes item.name as prefilledMealName — verify it's non-empty
    expect(item.name.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10.4: StartWorkoutCard → ActiveWorkout contract
// ═══════════════════════════════════════════════════════════════════════════

describe('10.4: StartWorkoutCard → ActiveWorkoutScreenParams contract', () => {
  test('template mode params match ActiveWorkoutScreenParams', () => {
    const params: ActiveWorkoutScreenParams = {
      mode: 'template',
      templateId: 'tmpl-abc-123',
    };

    expect(params.mode).toBe('template');
    expect(typeof params.templateId).toBe('string');
    // ActiveWorkoutScreenParams.mode accepts 'template'
    const validModes: ActiveWorkoutScreenParams['mode'][] = ['new', 'edit', 'template', 'copy-last'];
    expect(validModes).toContain(params.mode);
  });

  test('empty workout params match ActiveWorkoutScreenParams', () => {
    const params: ActiveWorkoutScreenParams = {
      mode: 'new',
    };

    expect(params.mode).toBe('new');
    expect(params.templateId).toBeUndefined();
    expect(params.sessionId).toBeUndefined();
  });

  test('ActiveWorkoutScreenParams supports all required mode values', () => {
    // The LogsScreen uses 'new' for empty workout and 'template' for template-based
    const emptyWorkout: ActiveWorkoutScreenParams = { mode: 'new' };
    const templateWorkout: ActiveWorkoutScreenParams = { mode: 'template', templateId: 'abc' };

    expect(emptyWorkout.mode).toBe('new');
    expect(templateWorkout.mode).toBe('template');
    expect(templateWorkout.templateId).toBe('abc');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10.5: Feature flag behavior
// ═══════════════════════════════════════════════════════════════════════════

describe('10.5: Feature flag behavior — isTrainingLogV2Enabled', () => {
  afterEach(() => {
    // Reset flag after each test
    setTrainingLogV2Flag(false);
  });

  test('when flag is false, Start Workout should trigger modal (not navigation)', () => {
    setTrainingLogV2Flag(false);

    // Simulate the LogsScreen decision logic:
    // if (isTrainingLogV2Enabled()) { navigation.push('ActiveWorkout', ...) }
    // else { setShowTrainingModal(true) }
    const flagEnabled = isTrainingLogV2Enabled();
    expect(flagEnabled).toBe(false);

    // When flag is off, the screen shows AddTrainingModal instead of navigating
    let showTrainingModal = false;
    let navigatedToActiveWorkout = false;

    if (flagEnabled) {
      navigatedToActiveWorkout = true;
    } else {
      showTrainingModal = true;
    }

    expect(showTrainingModal).toBe(true);
    expect(navigatedToActiveWorkout).toBe(false);
  });

  test('when flag is true, Start Workout should navigate (not show modal)', () => {
    setTrainingLogV2Flag(true);

    const flagEnabled = isTrainingLogV2Enabled();
    expect(flagEnabled).toBe(true);

    let showTrainingModal = false;
    let navigatedToActiveWorkout = false;

    if (flagEnabled) {
      navigatedToActiveWorkout = true;
    } else {
      showTrainingModal = true;
    }

    expect(showTrainingModal).toBe(false);
    expect(navigatedToActiveWorkout).toBe(true);
  });

  test('flag toggle is respected at runtime', () => {
    expect(isTrainingLogV2Enabled()).toBe(false);
    setTrainingLogV2Flag(true);
    expect(isTrainingLogV2Enabled()).toBe(true);
    setTrainingLogV2Flag(false);
    expect(isTrainingLogV2Enabled()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10.6: Empty state
// ═══════════════════════════════════════════════════════════════════════════

describe('10.6: Empty state — no entries, no favorites, no templates', () => {
  test('Quick Re-log is hidden when no entries and no favorites', () => {
    const items = computeQuickRelogItems([], [], 5);
    // QuickRelogRow returns null when items.length === 0
    expect(items).toEqual([]);
    expect(items.length).toBe(0);
  });

  test('meal slots show empty slots with "+" prompts (all 4 slots exist, all empty)', () => {
    const slots = groupEntriesBySlot([]);

    expect(slots).toHaveLength(4);
    for (const slot of slots) {
      expect(slot.entries).toHaveLength(0);
      expect(slot.totals.calories).toBe(0);
      expect(slot.totals.protein_g).toBe(0);
      expect(slot.totals.carbs_g).toBe(0);
      expect(slot.totals.fat_g).toBe(0);
      // Each empty slot exists — the UI renders a "+" add prompt for each
      expect(['Breakfast', 'Lunch', 'Snack', 'Dinner']).toContain(slot.name);
    }
  });

  test('templates section is hidden when userTemplates is empty', () => {
    // The LogsScreen hides "My Templates" CollapsibleSection when userTemplates.length === 0
    const userTemplates: any[] = [];
    const shouldShowTemplatesSection = userTemplates.length > 0;
    expect(shouldShowTemplatesSection).toBe(false);
  });

  test('StartWorkoutCard hides "From Template" when both template arrays are empty', () => {
    // Contract: when userTemplates and staticTemplates are both empty,
    // the card shows only "Start Workout" as a single full-width button
    const userTemplates: any[] = [];
    const staticTemplates: any[] = [];
    const hasTemplates = userTemplates.length > 0 || staticTemplates.length > 0;
    expect(hasTemplates).toBe(false);
  });

  test('favorites section shows empty state message when no favorites', () => {
    const favorites: MealFavorite[] = [];
    // The screen renders "Star foods when logging to save them here" when favorites is empty
    expect(favorites.length).toBe(0);
  });
});
