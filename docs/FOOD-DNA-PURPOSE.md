# Food DNA Step - Purpose & Impact

## What Food DNA Does

**Step 10 collects:**
1. Dietary restrictions (Vegetarian, Vegan, Pescatarian, etc.)
2. Allergies (Dairy, Gluten, Nuts, Soy, Eggs, Shellfish)
3. Cuisine preferences (Indian, Mediterranean, East Asian, etc.)

## How It's Used

### 1. Food Search Ranking (Backend)
**File:** `src/modules/food_database/service.py`

**Allergies:**
- Foods containing allergens get **0.2× score** (80% demotion)
- Example: User allergic to nuts → "Peanut Butter" drops to bottom of results

**Dietary Restrictions:**
- Meat items get **0.5× score** for vegetarians (50% demotion)
- Example: Vegetarian user → "Chicken Breast" ranks lower than "Tofu"

**Cuisine Preferences:**
- Matching cuisines get boosted in search results
- Example: User prefers Indian → "Paneer Tikka" ranks higher than "Cheddar Cheese"

### 2. Meal Plan Generation (Future)
**Potential use:** Generate meal plans that respect restrictions and preferences

### 3. Recipe Recommendations (Future)
**Potential use:** Suggest recipes matching cuisine preferences

---

## Current Impact

**YES, it matters!**

Without Food DNA:
- User allergic to dairy sees "Greek Yogurt" at top of search
- Vegetarian user sees "Chicken Breast" prominently
- User who loves Indian food sees generic Western foods first

With Food DNA:
- Allergens automatically demoted (80% score reduction)
- Restricted foods deprioritized (50% score reduction)
- Preferred cuisines boosted

---

## Recommendation

**Keep Step 10** - it provides real value by personalizing food search.

**Potential improvements:**
1. Show preview: "We'll prioritize Indian foods and hide dairy items"
2. Add "Why we ask" tooltip
3. Make it more visual (show example search results before/after)

**The step is functional and valuable - it's not just collecting data for nothing!**

