# 6 Feature Enhancements - Detailed Implementation Plan

**Date:** 2026-03-09 19:06  
**Target:** Complete all 6 features today  
**Total Estimated Time:** ~40 hours (aggressive parallel execution needed)

---

## Implementation Strategy

Execute in 3 parallel tracks to maximize throughput:
- **Track A:** Refactoring (Dashboard, AddNutritionModal)
- **Track B:** New Features (Barcode, ML ranking)
- **Track C:** Algorithm Integration (Warm-up, Fatigue/Readiness)

---

## TRACK A: Component Refactoring (2 features - 16h)

### Feature A1: DashboardScreen Refactor (M18)
**Current:** 500 LOC, 30+ useState hooks  
**Target:** <200 LOC with custom hooks  
**Effort:** 8 hours

#### Phase A1.1: Extract Data Fetching Hook (2h)
**Create:** `app/hooks/useDashboardData.ts`

```typescript
export function useDashboardData(selectedDate: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  
  useEffect(() => {
    // Fetch from new /dashboard/summary endpoint
    // Returns: nutrition, adaptive, training, bodyweight, streak
  }, [selectedDate]);
  
  return { data, loading, error, refetch };
}
```

**Steps:**
1. Create hook file
2. Move all API calls from DashboardScreen
3. Use new `/api/v1/dashboard/summary` endpoint
4. Handle loading/error states
5. Return structured data

**Success Criteria:**
- Single API call instead of 12
- Clean data structure
- Proper error handling
- Loading states

---

#### Phase A1.2: Extract Modal Management Hook (2h)
**Create:** `app/hooks/useDashboardModals.ts`

```typescript
export function useDashboardModals() {
  const [addNutritionVisible, setAddNutritionVisible] = useState(false);
  const [addTrainingVisible, setAddTrainingVisible] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  // ... 8 total modals
  
  return {
    modals: { addNutritionVisible, addTrainingVisible, ... },
    open: { openAddNutrition, openAddTraining, ... },
    close: { closeAddNutrition, closeAddTraining, ... },
  };
}
```

**Steps:**
1. Extract all modal visibility state
2. Create open/close handlers
3. Return organized object
4. Update DashboardScreen to use hook

**Success Criteria:**
- All 8 modals managed
- Clean API
- No state duplication

---

#### Phase A1.3: Extract KPI Computation Hook (2h)
**Create:** `app/hooks/useDashboardKPIs.ts`

```typescript
export function useDashboardKPIs(data: DashboardData | null) {
  const kpis = useMemo(() => {
    if (!data) return null;
    return {
      calories: { consumed: X, target: Y, percentage: Z },
      protein: { ... },
      workouts: { ... },
      streak: { ... },
    };
  }, [data]);
  
  return kpis;
}
```

**Steps:**
1. Extract KPI calculation logic
2. Use useMemo for performance
3. Return structured KPI object
4. Update DashboardScreen

**Success Criteria:**
- All KPIs computed
- Memoized for performance
- Clean data structure

---

#### Phase A1.4: Refactor DashboardScreen (2h)
**Update:** `app/screens/dashboard/DashboardScreen.tsx`

```typescript
export function DashboardScreen() {
  const [selectedDate, setSelectedDate] = useState(today);
  const { data, loading, error, refetch } = useDashboardData(selectedDate);
  const { modals, open, close } = useDashboardModals();
  const kpis = useDashboardKPIs(data);
  
  // Render logic only - no state management
  return (
    <ScrollView>
      <DateScroller />
      <MacroRingsRow kpis={kpis} />
      <MealSlotDiary />
      {/* ... */}
    </ScrollView>
  );
}
```

**Steps:**
1. Replace useState hooks with custom hooks
2. Simplify render logic
3. Remove inline API calls
4. Test all functionality

**Success Criteria:**
- <200 LOC
- <10 useState hooks
- All features work
- No regressions

---

### Feature A2: AddNutritionModal Decomposition
**Current:** 1,959 LOC, 30+ useState hooks  
**Target:** 6 sub-components, <300 LOC each  
**Effort:** 8 hours

#### Phase A2.1: Extract FoodSearchPanel (2h)
**Create:** `app/components/nutrition/FoodSearchPanel.tsx`

```typescript
interface FoodSearchPanelProps {
  onSelectFood: (food: FoodItem) => void;
  onSelectRecipe: (recipe: Recipe) => void;
}

export function FoodSearchPanel({ onSelectFood, onSelectRecipe }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  
  // Search logic, debouncing, FTS5 queries
  // Renders: SearchBar + ResultsList + Tabs (quick/meals/recipes)
}
```

**Steps:**
1. Extract search state and logic
2. Extract food/recipe selection
3. Extract tab management
4. Create standalone component
5. Wire into parent modal

---

#### Phase A2.2: Extract PortionSelector (1.5h)
**Create:** `app/components/nutrition/PortionSelector.tsx`

```typescript
interface PortionSelectorProps {
  food: FoodItem;
  onConfirm: (portion: Portion) => void;
}

export function PortionSelector({ food, onConfirm }: Props) {
  const [servings, setServings] = useState(1);
  const [unit, setUnit] = useState(food.serving_unit);
  
  // Serving size, unit conversion, quantity stepper
  // Renders: Quantity input + Unit selector + Macro preview
}
```

**Steps:**
1. Extract portion state
2. Extract unit conversion
3. Create component
4. Wire into parent

---

#### Phase A2.3: Extract NutritionFormState Hook (2h)
**Create:** `app/hooks/useNutritionForm.ts`

```typescript
type Action = 
  | { type: 'SELECT_FOOD'; food: FoodItem }
  | { type: 'SET_PORTION'; servings: number }
  | { type: 'SET_MEAL_SLOT'; slot: MealSlot }
  | { type: 'RESET' };

export function useNutritionForm() {
  const [state, dispatch] = useReducer(nutritionFormReducer, initialState);
  
  return {
    state,
    selectFood: (food) => dispatch({ type: 'SELECT_FOOD', food }),
    setPortion: (servings) => dispatch({ type: 'SET_PORTION', servings }),
    // ... other actions
  };
}
```

**Steps:**
1. Create reducer with all actions
2. Extract state management
3. Create hook
4. Update modal to use hook

---

#### Phase A2.4: Refactor AddNutritionModal (2.5h)
**Update:** `app/components/modals/AddNutritionModal.tsx`

```typescript
export function AddNutritionModal({ visible, onClose, date }: Props) {
  const { state, selectFood, setPortion, reset } = useNutritionForm();
  
  return (
    <ModalContainer visible={visible} onClose={onClose}>
      <MacroBudgetPills />
      <FoodSearchPanel onSelectFood={selectFood} />
      {state.selectedFood && (
        <PortionSelector food={state.selectedFood} onConfirm={handleSubmit} />
      )}
    </ModalContainer>
  );
}
```

**Steps:**
1. Replace useState with useNutritionForm
2. Replace inline components with extracted ones
3. Simplify render logic
4. Test all flows

---

## TRACK B: New Features (2 features - 12h)

### Feature B1: Barcode Scanner Integration (M7)
**Effort:** 6 hours

#### Phase B1.1: Wire BarcodeScanner into AddNutritionModal (2h)

**Steps:**
1. Add "Scan Barcode" button/tab in AddNutritionModal
2. Show BarcodeScanner component (already exists)
3. Handle barcode scan result
4. Query backend for food by barcode

**Files to modify:**
- `app/components/modals/AddNutritionModal.tsx`
- `app/components/nutrition/BarcodeScanner.tsx` (already exists)

---

#### Phase B1.2: Backend Barcode Lookup (2h)

**Create:** Endpoint `GET /api/v1/food/barcode/{barcode}`

```python
@router.get("/barcode/{barcode}")
async def get_food_by_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_db),
) -> FoodItemResponse:
    # Query food_items where barcode = barcode
    # If not found, query Open Food Facts API
    # Cache result in database
    # Return food item
```

**Steps:**
1. Add barcode query to FoodDatabaseService
2. Integrate Open Food Facts API (free)
3. Cache results
4. Return food item or 404

---

#### Phase B1.3: Open Food Facts Integration (2h)

**Create:** `src/services/openfoodfacts_client.py`

```python
async def lookup_barcode(barcode: str) -> Optional[FoodItemCreate]:
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    # Fetch product data
    # Map to FoodItemCreate schema
    # Return or None if not found
```

**Steps:**
1. Create HTTP client
2. Map OFF data to our schema
3. Handle errors gracefully
4. Add caching

---

### Feature B2: Food Search ML Ranking (M6)
**Effort:** 6 hours

#### Phase B2.1: Track Food Log Frequency (2h)

**Create:** `user_food_frequency` table

```sql
CREATE TABLE user_food_frequency (
    user_id UUID REFERENCES users(id),
    food_name VARCHAR(255),
    log_count INTEGER DEFAULT 1,
    last_logged_at TIMESTAMP,
    PRIMARY KEY (user_id, food_name)
);
```

**Steps:**
1. Create model
2. Create migration
3. Increment on food log
4. Query for ranking

---

#### Phase B2.2: Weighted Search Ranking (2h)

**Update:** `src/modules/food_database/service.py`

```python
async def search(self, query: str, user_id: Optional[UUID] = None):
    # Base FTS5 search
    results = await self._search_fts(query, ...)
    
    if user_id:
        # Get user's frequency data
        freq_map = await self._get_user_frequencies(user_id)
        
        # Re-rank results: base_score + (log_count * 0.3)
        results = self._apply_frequency_boost(results, freq_map)
    
    return results
```

**Steps:**
1. Add frequency query
2. Implement ranking algorithm
3. Apply boost to search results
4. Test with real data

---

#### Phase B2.3: Frontend Integration (2h)

**Update:** Search components to show "Frequently logged" badge

**Steps:**
1. Backend returns `is_frequent` flag
2. Add badge to search results
3. Sort frequently logged to top
4. Test UX

---

## TRACK C: Algorithm Integration (2 features - 12h)

### Feature C1: Warm-Up Generation UX (M11)
**Effort:** 4 hours

#### Phase C1.1: Predictive Warm-Up from History (2h)

**Update:** `src/modules/training/overload_service.py`

```python
async def suggest_warmup_sets(
    self, 
    user_id: UUID, 
    exercise_name: str,
    working_weight_kg: Optional[float] = None
) -> List[WarmUpSet]:
    # If working_weight provided, use it
    # Else, get last working weight from previous performance
    # Generate 2-3 warm-up sets: 50%, 70%, 85% of working weight
    # Return set suggestions
```

**Steps:**
1. Add warmup suggestion method
2. Query previous performance
3. Generate percentage-based sets
4. Return suggestions

---

#### Phase C1.2: Frontend Warm-Up Flow (2h)

**Update:** `app/components/training/ExerciseCardPremium.tsx`

**Steps:**
1. Call warmup API when "Generate Warm-Up" tapped
2. Show suggestions even without working weight
3. Auto-insert warm-up sets
4. Allow manual editing

---

### Feature C2: Fatigue/Readiness Integration (M14)
**Effort:** 8 hours

#### Phase C2.1: Cross-Reference Algorithm (3h)

**Create:** `src/modules/training/recovery_integration.py`

```python
def compute_integrated_recovery_score(
    fatigue_score: float,  # 0-100
    readiness_score: float,  # 0-100
) -> dict:
    # Weighted combination: 60% readiness, 40% fatigue
    combined = (readiness_score * 0.6) + ((100 - fatigue_score) * 0.4)
    
    # Adjust training recommendations
    if combined < 40:
        return {
            "status": "high_fatigue_low_readiness",
            "recommendation": "Rest day or deload",
            "volume_multiplier": 0.5,
        }
    elif combined < 60:
        return {
            "status": "moderate_recovery",
            "recommendation": "Reduce volume by 20-30%",
            "volume_multiplier": 0.7,
        }
    else:
        return {
            "status": "recovered",
            "recommendation": "Train as planned",
            "volume_multiplier": 1.0,
        }
```

**Steps:**
1. Create integration module
2. Define scoring algorithm
3. Generate recommendations
4. Return volume multiplier

---

#### Phase C2.2: Backend Integration (2h)

**Update:** `src/modules/training/fatigue_service.py`

```python
async def get_fatigue_analysis(self, user_id: UUID):
    # Existing fatigue computation
    fatigue_score = ...
    
    # Fetch readiness score
    readiness_svc = ReadinessService(self.db)
    readiness_score = await readiness_svc.get_latest_score(user_id)
    
    # Compute integrated recovery
    if readiness_score:
        recovery = compute_integrated_recovery_score(
            fatigue_score, 
            readiness_score
        )
        return {
            "fatigue": fatigue_score,
            "readiness": readiness_score,
            "integrated": recovery,
        }
```

**Steps:**
1. Import readiness service
2. Fetch readiness score
3. Call integration function
4. Return combined data

---

#### Phase C2.3: Frontend Display (3h)

**Create:** `app/components/dashboard/RecoveryStatusCard.tsx`

```typescript
export function RecoveryStatusCard({ recovery }: Props) {
  // Shows combined recovery score
  // Color-coded status (red/yellow/green)
  // Recommendation text
  // Links to fatigue and readiness details
}
```

**Steps:**
1. Create card component
2. Add to DashboardScreen
3. Show recommendations
4. Link to detail screens

---

## DETAILED PHASE-BY-PHASE EXECUTION PLAN

### Phase 1: Quick Wins (4h - Parallel)
**Execute simultaneously:**
- A1.1: Dashboard data hook (2h)
- C1.1: Predictive warm-up backend (2h)
- B2.1: Food frequency tracking (2h)

**Deliverables:**
- useDashboardData.ts
- Warm-up suggestion endpoint
- user_food_frequency table

---

### Phase 2: Component Extraction (4h - Parallel)
**Execute simultaneously:**
- A1.2: Dashboard modals hook (2h)
- A2.1: FoodSearchPanel component (2h)
- C1.2: Warm-up frontend (2h)

**Deliverables:**
- useDashboardModals.ts
- FoodSearchPanel.tsx
- Warm-up UI integration

---

### Phase 3: State Management (4h - Parallel)
**Execute simultaneously:**
- A1.3: Dashboard KPIs hook (2h)
- A2.2: PortionSelector component (1.5h)
- B2.2: Search ranking algorithm (2h)

**Deliverables:**
- useDashboardKPIs.ts
- PortionSelector.tsx
- Frequency-based ranking

---

### Phase 4: Integration (4h - Parallel)
**Execute simultaneously:**
- A1.4: Refactor DashboardScreen (2h)
- A2.3: NutritionFormState hook (2h)
- C2.1: Recovery integration algorithm (3h)

**Deliverables:**
- Refactored DashboardScreen
- useNutritionForm.ts
- recovery_integration.py

---

### Phase 5: Barcode Feature (4h - Sequential)
**Execute in order:**
- B1.1: Wire BarcodeScanner (2h)
- B1.2: Backend barcode lookup (2h)

**Deliverables:**
- Barcode integration in modal
- Barcode lookup endpoint

---

### Phase 6: Advanced Features (4h - Parallel)
**Execute simultaneously:**
- B1.3: Open Food Facts integration (2h)
- C2.2: Backend recovery integration (2h)
- B2.3: Frontend search badges (2h)

**Deliverables:**
- OFF API client
- Fatigue/readiness combined
- Frequency badges in search

---

### Phase 7: Final Integration (4h - Sequential)
**Execute in order:**
- A2.4: Refactor AddNutritionModal (2.5h)
- C2.3: Recovery status card (3h)

**Deliverables:**
- Refactored AddNutritionModal
- RecoveryStatusCard component

---

### Phase 8: Testing & Audit (4h)
**Execute:**
- Run all tests
- TypeScript compilation
- Independent audit of all 6 features
- Fix any issues found
- Final verification

---

## Execution Timeline (Aggressive - 8 hours with parallel execution)

**Hour 1-2:** Phase 1 (3 parallel tasks)  
**Hour 3-4:** Phase 2 (3 parallel tasks)  
**Hour 5-6:** Phase 3 (3 parallel tasks)  
**Hour 7-8:** Phase 4 (3 parallel tasks)  
**Hour 9-10:** Phase 5 (sequential)  
**Hour 11-12:** Phase 6 (3 parallel tasks)  
**Hour 13-14:** Phase 7 (sequential)  
**Hour 15-16:** Phase 8 (testing & audit)

**Total: 16 hours with aggressive parallelization**

---

## Success Criteria

### Feature A1: DashboardScreen Refactor
- [ ] <200 LOC in main component
- [ ] <10 useState hooks
- [ ] 3 custom hooks extracted
- [ ] All features work
- [ ] Single API call
- [ ] TypeScript: 0 errors

### Feature A2: AddNutritionModal Decomposition
- [ ] 6 sub-components created
- [ ] <300 LOC per component
- [ ] useReducer state management
- [ ] All features work
- [ ] TypeScript: 0 errors

### Feature B1: Barcode Scanner
- [ ] Scan barcode opens from modal
- [ ] Backend lookup works
- [ ] Open Food Facts integration
- [ ] Cache results
- [ ] Fallback for unknown barcodes

### Feature B2: Food Search Ranking
- [ ] Frequency tracking works
- [ ] Search results ranked
- [ ] "Frequently logged" badges
- [ ] Performance acceptable

### Feature C1: Warm-Up Generation
- [ ] Works without working weight
- [ ] Uses previous performance
- [ ] Generates 2-3 sets
- [ ] Auto-inserts into workout

### Feature C2: Fatigue/Readiness Integration
- [ ] Combined recovery score
- [ ] Volume multiplier applied
- [ ] Recommendations shown
- [ ] Dashboard card displays

---

## Risk Mitigation

**High Risk Items:**
1. AddNutritionModal refactor (complex state, many flows)
2. Fatigue/readiness integration (algorithm changes)

**Mitigation:**
- Implement behind feature flags
- Extensive testing before enabling
- Keep old code as fallback

**Medium Risk Items:**
1. DashboardScreen refactor (many components)
2. Barcode scanner (external API dependency)

**Mitigation:**
- Incremental refactoring
- Graceful API failures

---

## READY TO START

This plan breaks down 6 features into 8 phases with 28 discrete tasks. With parallel execution using subagents, we can complete in ~16 hours.

**Shall I begin implementation?**

