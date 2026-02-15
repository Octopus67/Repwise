/**
 * Pure state logic for the MealBuilder component.
 *
 * Extracted into a separate module so property-based tests can exercise
 * the reducer without rendering React components.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealBuilderItem {
  tempId: string;
  foodName: string;
  baseMacros: Macros;
  servingMultiplier: number;
  scaledMacros: Macros;
}

export interface MealBuilderState {
  items: MealBuilderItem[];
  mealName: string;
  runningTotals: Macros;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type MealBuilderAction =
  | { type: 'ADD_ITEM'; payload: { tempId: string; foodName: string; macros: Macros } }
  | { type: 'REMOVE_ITEM'; payload: { tempId: string } }
  | { type: 'UPDATE_SERVING'; payload: { tempId: string; multiplier: number } }
  | { type: 'SET_MEAL_NAME'; payload: string }
  | { type: 'RESET' };

// ─── Pure helpers ────────────────────────────────────────────────────────────

export function scaleMacros(base: Macros, multiplier: number): Macros {
  return {
    calories: base.calories * multiplier,
    protein_g: base.protein_g * multiplier,
    carbs_g: base.carbs_g * multiplier,
    fat_g: base.fat_g * multiplier,
  };
}

export function computeRunningTotals(items: MealBuilderItem[]): Macros {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.scaledMacros.calories,
      protein_g: acc.protein_g + item.scaledMacros.protein_g,
      carbs_g: acc.carbs_g + item.scaledMacros.carbs_g,
      fat_g: acc.fat_g + item.scaledMacros.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function getDefaultMealName(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Breakfast';
  if (hour < 14) return 'Lunch';
  if (hour < 17) return 'Snack';
  return 'Dinner';
}

/** Testable version that accepts hour directly. */
export function getDefaultMealNameForHour(hour: number): string {
  if (hour < 11) return 'Breakfast';
  if (hour < 14) return 'Lunch';
  if (hour < 17) return 'Snack';
  return 'Dinner';
}

// ─── Initial state ───────────────────────────────────────────────────────────

export function createInitialState(): MealBuilderState {
  return {
    items: [],
    mealName: getDefaultMealName(),
    runningTotals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function mealBuilderReducer(
  state: MealBuilderState,
  action: MealBuilderAction,
): MealBuilderState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { tempId, foodName, macros } = action.payload;
      const newItem: MealBuilderItem = {
        tempId,
        foodName,
        baseMacros: macros,
        servingMultiplier: 1,
        scaledMacros: { ...macros },
      };
      const newItems = [...state.items, newItem];
      return {
        ...state,
        items: newItems,
        runningTotals: computeRunningTotals(newItems),
      };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter((i) => i.tempId !== action.payload.tempId);
      return {
        ...state,
        items: newItems,
        runningTotals: computeRunningTotals(newItems),
      };
    }

    case 'UPDATE_SERVING': {
      const { tempId, multiplier } = action.payload;
      const clampedMultiplier = Math.max(0.1, multiplier);
      const newItems = state.items.map((item) =>
        item.tempId === tempId
          ? {
              ...item,
              servingMultiplier: clampedMultiplier,
              scaledMacros: scaleMacros(item.baseMacros, clampedMultiplier),
            }
          : item,
      );
      return {
        ...state,
        items: newItems,
        runningTotals: computeRunningTotals(newItems),
      };
    }

    case 'SET_MEAL_NAME':
      return { ...state, mealName: action.payload };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}
