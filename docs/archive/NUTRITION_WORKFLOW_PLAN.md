# Repwise — Nutrition Workflow Fix Plan
### Fix Critical Bugs + Product-Level UX Improvements

---

## Overview

4 phases, ordered by dependency. Each phase is independently shippable.

**Phase 1 — Fix MealBuilder Core Flow (Critical, ~2 hours)**
Make "Add Item" actually add items to the meal builder instead of logging directly.

**Phase 2 — Clean Up Modal Interactions (~1 hour)**
Fix recipe builder overlap, Done button guard, and modal layering.

**Phase 3 — Simplify Tabs & Move Create Recipe (~1.5 hours)**
Remove confusing options, move Create Recipe to the right place.

**Phase 4 — Add Macro Budget to MealBuilder (~30 min)**
Show remaining daily macros while building a meal.

---

## Phase 1 — Fix MealBuilder Core Flow

### Problem
MealBuilder's "Add Item" opens AddNutritionModal which POSTs food directly to the API. The food never gets added to MealBuilder's item list. The `handleAddItem` function exists but is never called.

### Solution
Add an `onAddItem` callback prop to AddNutritionModal. When provided, the modal returns food data to the parent instead of logging to the API.

### Files to Change

| File | Change |
|------|--------|
| `app/components/modals/AddNutritionModal.tsx` | Add `onAddItem?` prop. In `handleSubmit`, if `onAddItem` is provided, call it with food data and skip the API POST. |
| `app/components/nutrition/MealBuilder.tsx` | Pass `onAddItem={handleAddItem}` to AddNutritionModal. Remove the broken `handleFoodSearchSuccess`. |

### Design

**AddNutritionModal props change:**
```typescript
interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledMealName?: string;
  onAddItem?: (food: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
}
```

**handleSubmit change (AddNutritionModal):**
```typescript
// At the end of handleSubmit, BEFORE the API call:
if (onAddItem) {
  // Select mode: return food data to parent, don't log to API
  onAddItem({
    name: selectedFood?.name ?? notes.trim() || 'Quick entry',
    calories: Number(calories) || 0,
    protein_g: Number(protein) || 0,
    carbs_g: Number(carbs) || 0,
    fat_g: Number(fat) || 0,
  });
  clearForm();
  onSuccess();
  return;  // Skip API POST
}
// ... existing API POST code ...
```

**MealBuilder change:**
```tsx
<AddNutritionModal
  visible={showFoodSearch}
  onClose={() => setShowFoodSearch(false)}
  onSuccess={() => setShowFoodSearch(false)}
  onAddItem={handleAddItem}  // NEW: passes food back to builder
/>
```

### Behavior Change
- When opened from **Dashboard "Log Food"**: `onAddItem` is undefined → logs to API (existing behavior)
- When opened from **MealBuilder "Add Item"**: `onAddItem` is provided → returns food to builder (new behavior)
- When opened from **MealSlotDiary "+"**: `onAddItem` is undefined → logs to API (existing behavior)

### Acceptance Criteria
- [ ] MealBuilder "Add Item" → search food → food appears in MealBuilder item list
- [ ] MealBuilder item list shows name, macros, serving multiplier
- [ ] Running totals update as items are added
- [ ] "Save Meal" batch-logs all items
- [ ] "Log Food" from dashboard still logs directly to API (no regression)
- [ ] MealSlotDiary "+" still logs directly to API (no regression)

---

## Phase 2 — Clean Up Modal Interactions

### Problem
1. When MealBuilder opens AddNutritionModal, and user clicks "Create Recipe", the modals overlap confusingly
2. The "Done" button in AddNutritionModal bypasses the unsaved data guard
3. When in "select" mode (from MealBuilder), showing "Create Recipe" makes no sense

### Solution

**2a: Hide "Create Recipe" when in select mode**
```tsx
// In AddNutritionModal, Quick Log tab:
{!onAddItem && (
  <TouchableOpacity onPress={() => setShowRecipeBuilder(true)}>
    <Text>Create Recipe</Text>
  </TouchableOpacity>
)}
```
When `onAddItem` is provided (select mode), hide the Create Recipe button entirely. Users are selecting food for a meal, not creating recipes.

**2b: Fix "Done" button to check unsaved data**
```tsx
// Change Done button from:
<TouchableOpacity onPress={() => { reset(); onClose(); }}>
// To:
<TouchableOpacity onPress={handleClose}>
```
Reuse the same `handleClose` that the X button uses (which checks for unsaved data).

**2c: Change button label in select mode**
When `onAddItem` is provided, change the "Save" button text from "Save" to "Add to Meal" for clarity.

### Files to Change
| File | Change |
|------|--------|
| `app/components/modals/AddNutritionModal.tsx` | Hide Create Recipe in select mode, fix Done button, change Save label |

### Acceptance Criteria
- [ ] No "Create Recipe" button when opened from MealBuilder
- [ ] "Done" button checks for unsaved data before closing
- [ ] Save button says "Add to Meal" when in select mode
- [ ] No modal overlap issues

---

## Phase 3 — Simplify Tabs & Move Create Recipe

### Problem
1. "Create Recipe" is in the Quick Log tab but should be in the Recipes tab
2. The Recipes tab has no way to create a recipe
3. When opened from MealBuilder (select mode), showing all 3 tabs is confusing — user just needs to search and select food

### Solution

**3a: Move "Create Recipe" to Recipes tab**
Remove the Create Recipe button from Quick Log tab. Add it to the top of the Recipes tab:
```tsx
{activeTab === 'recipes' && (
  <>
    <TouchableOpacity onPress={() => setShowRecipeBuilder(true)}>
      <Text>+ Create New Recipe</Text>
    </TouchableOpacity>
    {/* existing recipe list */}
  </>
)}
```

**3b: In select mode, show only Quick Log tab**
When `onAddItem` is provided, hide the tab bar and only show the Quick Log content (food search). The user is selecting food for a meal — they don't need Meal Plans or Recipes tabs.
```tsx
{!onAddItem && (
  <View style={styles.tabBar}>
    {tabs.map(tab => ...)}
  </View>
)}
```

**3c: Simplify the title in select mode**
Change modal title from "Log Nutrition" to "Add Food" when in select mode.

### Files to Change
| File | Change |
|------|--------|
| `app/components/modals/AddNutritionModal.tsx` | Move Create Recipe, hide tabs in select mode, change title |

### Acceptance Criteria
- [ ] Create Recipe button is in Recipes tab (not Quick Log)
- [ ] Recipes tab has "+ Create New Recipe" at the top
- [ ] When opened from MealBuilder, only food search is shown (no tabs)
- [ ] Modal title says "Add Food" in select mode, "Log Nutrition" otherwise

---

## Phase 4 — Add Macro Budget to MealBuilder

### Problem
MealBuilder doesn't show remaining daily macros. Users building a meal have no visibility into their budget.

### Solution
Pass adaptive targets and day totals to MealBuilder. Show a compact budget bar at the top.

### Files to Change
| File | Change |
|------|--------|
| `app/components/nutrition/MealBuilder.tsx` | Add `targets` and `consumed` props, render MacroBudgetPills |
| `app/screens/dashboard/DashboardScreen.tsx` | Pass targets and consumed to MealBuilder |

### Design
```tsx
// MealBuilder props:
interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targets?: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  consumed?: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

// Render at top of MealBuilder:
{targets && consumed && (
  <MacroBudgetPills targets={targets} consumed={consumed} />
)}
```

### Acceptance Criteria
- [ ] MealBuilder shows remaining macro budget at the top
- [ ] Budget updates as items are added to the meal
- [ ] Budget accounts for already-logged entries today

---

## Summary

| Phase | Items | Effort | Dependencies |
|-------|-------|--------|-------------|
| Phase 1 — Fix Core Flow | 2 files | ~2 hours | None |
| Phase 2 — Clean Up Modals | 1 file | ~1 hour | Phase 1 |
| Phase 3 — Simplify Tabs | 1 file | ~1.5 hours | Phase 1 |
| Phase 4 — Macro Budget | 2 files | ~30 min | Phase 1 |
| **Total** | **~4 files** | **~5 hours** | |

### Key Design Decision
The `onAddItem` prop is the linchpin. It turns AddNutritionModal into a dual-purpose component:
- **Without `onAddItem`**: Logs food directly to API (existing behavior, used by Log Food + MealSlotDiary)
- **With `onAddItem`**: Returns food data to parent (new behavior, used by MealBuilder)

This is a clean, backward-compatible change that doesn't break any existing flows.

---

*Plan grounded in exact code analysis of MealBuilder.tsx, AddNutritionModal.tsx, and mealBuilderLogic.ts.*
