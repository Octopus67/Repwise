# Log Screen Redesign — Design

## Architecture Overview

Transform the Log screen from a flat chronological viewer into a speed-optimized launchpad. Two guiding principles from competitive analysis:

1. **Speed-to-action over browsing** — MacroFactor's FLSI data proves fewer taps = higher retention
2. **Meal-slot mental model** — Every successful nutrition app (MFP, Cronometer, MacroFactor) groups by meal, not flat list

### Layout Structure

```
NUTRITION TAB                    TRAINING TAB
┌──────────────────┐            ┌──────────────────┐
│ ⚡ Quick Re-log   │            │ 🏋️ Start Workout  │
│ [Oats] [Chicken] │            │ Empty / Template  │
├──────────────────┤            ├──────────────────┤
│ 📊 BudgetBar     │            │ 📁 My Templates   │
├──────────────────┤            │ [Push] [Pull]     │
│ 🍳 Breakfast 420 │            │ Browse all →      │
│   Oats 350 [+]   │            ├──────────────────┤
│ 🥗 Lunch    [+]  │            │ 📜 Recent Sessions│
│ 🍎 Snack   [+]   │            │ Feb 15 — Push     │
│ 🍽 Dinner  [+]   │            │ Feb 13 — Legs ⭐  │
├──────────────────┤            │ Feb 11 — Pull     │
│ ★ Favorites  ▸   │            │ ... Load more     │
│ ··· More actions  │            └──────────────────┘
└──────────────────┘
```

## File Changes

### Modified Files

1. **`app/screens/logs/LogsScreen.tsx`** (major rewrite)
   - Nutrition tab: Quick Re-log → BudgetBar → Meal slots → Favorites → More actions
   - Training tab: Start Workout button → My Templates → Session History
   - Add data fetching for favorites and user templates
   - Group nutrition entries by meal slot using existing `groupEntriesBySlot`
   - Reuse `MealSlotGroup` component from Dashboard

2. **`app/navigation/BottomTabNavigator.tsx`** (minor)
   - Tab name stays "Log" (no rename)
   - No structural changes needed

### New Files

3. **`app/components/log/QuickRelogRow.tsx`**
   - Horizontal scrollable row of frequently logged foods
   - Computes frequency from recent nutrition entries (last 14 days)
   - Deduplicates by `meal_name`, ranks by count × recency weight
   - Falls back to favorites if <3 behavioral items
   - Props: `entries: NutritionEntry[]`, `favorites: Favorite[]`, `onRelogItem: (item) => void`

4. **`app/components/log/StartWorkoutCard.tsx`**
   - Prominent card with "Start Workout" CTA
   - Two sub-buttons: "Empty Workout" and "From Template"
   - Template picker modal (user templates + pre-built)
   - Props: `userTemplates: Template[]`, `onStartEmpty: () => void`, `onStartTemplate: (template) => void`

5. **`app/components/log/CollapsibleSection.tsx`**
   - Reusable collapsible wrapper with animated chevron
   - Props: `title: string`, `icon?: ReactNode`, `defaultExpanded?: boolean`, `children: ReactNode`

6. **`app/components/log/TemplateRow.tsx`**
   - Compact template card: name, exercise count, "Start" button
   - Props: `template: Template`, `onStart: () => void`

7. **`app/utils/quickRelogLogic.ts`**
   - Pure function: `computeQuickRelogItems(entries, favorites, maxItems)` 
   - Scoring: `score = frequency × recencyWeight` where recencyWeight decays over 14 days
   - Returns top N items with name, calories, macros, last serving size

## Data Flow

### Nutrition Tab
```
Screen mount → Promise.allSettled([
  GET /nutrition/entries?start_date=X&end_date=X&limit=50,  // today's entries
  GET /nutrition/entries?start_date=14daysAgo&end_date=today&limit=200,  // for Quick Re-log
  GET /meals/favorites?limit=10,  // explicit favorites
])
→ Quick Re-log: computeQuickRelogItems(recentEntries, favorites, 5)
→ BudgetBar: consumed vs adaptiveTargets
→ Meal slots: groupEntriesBySlot(todayEntries)
→ Favorites: favorites response (collapsed section)
```

### Training Tab
```
Screen mount → Promise.allSettled([
  GET /training/user-templates,
  GET /training/templates,  // pre-built (cached)
  GET /training/sessions?page=1&limit=20,
])
→ Start Workout card: always visible
→ My Templates: user-templates (hidden if empty)
→ Recent Sessions: paginated session list
```

## Component Hierarchy

```
LogsScreen
├── TabBar (Nutrition | Training)
├── DateNavigator (‹ date ›)
│
├── NutritionContent (ScrollView)
│   ├── QuickRelogRow
│   ├── BudgetBar
│   ├── MealSlotGroup × 4 (Breakfast/Lunch/Snack/Dinner)
│   ├── CollapsibleSection "Favorites"
│   │   └── FavoritesList
│   └── MoreActionsRow (Copy meals, etc.)
│
└── TrainingContent
    ├── StartWorkoutCard
    ├── CollapsibleSection "My Templates" (if any)
    │   └── TemplateRow × N
    │   └── "Browse all templates →" link
    └── CollapsibleSection "Recent Sessions"
        └── SessionList (FlatList, paginated)
```

## Quick Re-log Algorithm

```typescript
function computeQuickRelogItems(
  recentEntries: NutritionEntry[],  // last 14 days
  favorites: Favorite[],
  maxItems: number = 5
): QuickRelogItem[] {
  // 1. Group entries by meal_name, count frequency
  // 2. For each unique meal: score = count × recencyWeight
  //    recencyWeight = 1.0 for today, decays by 0.07/day (reaches ~0 at 14 days)
  // 3. Sort by score descending, take top maxItems
  // 4. If fewer than 3 behavioral items, backfill from favorites
  // 5. Return: { name, calories, protein_g, carbs_g, fat_g }
}
```

## Interaction Patterns

### Quick Re-log → Log Flow
1. User taps food chip in Quick Re-log row
2. AddNutritionModal opens pre-filled with food name, macros, last serving size
3. User confirms → entry created for `selectedDate` in the appropriate meal slot
4. Quick Re-log row updates (frequency count incremented)

### Start Workout → Active Workout Flow
1. User taps "Start Workout" card
2. If "Empty Workout": navigate to ActiveWorkout `{ mode: 'new' }`
3. If "From Template": show template picker → select → navigate to ActiveWorkout `{ mode: 'template', templateId }`

### Meal Slot → Add Food Flow
1. User taps "+" on a meal slot (e.g., Lunch)
2. AddNutritionModal opens with meal slot pre-selected
3. User searches/scans food → confirms → entry added to that slot

## Migration Notes
- No tab rename — "Log" stays as "Log" in navigation
- `LogsStackParamList` unchanged
- Existing `MealSlotGroup` component reused from Dashboard (already handles expand/collapse, entries, add button)
- `groupEntriesBySlot` and `assignMealSlot` from `mealSlotLogic.ts` reused
- `CopyMealsBar` moved from top-level to "More actions" overflow
- FAB (+) button preserved for quick access
