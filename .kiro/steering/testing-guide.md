---
inclusion: manual
---

# Testing Guide

## Running Tests

```bash
# All backend tests
.venv/bin/python -m pytest tests/ -v --timeout=120

# Specific test file
.venv/bin/python -m pytest tests/test_wns_engine_unit.py -v

# All frontend tests
cd app && npx jest

# Specific frontend test
cd app && npx jest __tests__/utils/wnsCalculator.test.ts --verbose

# TypeScript type check (not tests, but catches errors)
cd app && npx tsc --noEmit
```

## Backend Test Infrastructure

### Fixtures (`tests/conftest.py`)
- **SQLite in-memory** database for tests
- **JSONB→JSON patching** for SQLite compatibility
- **Auto setup/teardown** — tables created before each test, dropped after
- **`db_session`** fixture — yields async session with auto-rollback
- **`client`** fixture — HTTPX async test client for API tests

### Test Patterns

**Unit tests (pure functions):**
```python
class TestMyFunction:
    def test_normal_case(self):
        assert my_function(input) == expected

    def test_edge_case(self):
        assert my_function(None) == default
```

**Integration tests (DB-backed):**
```python
async def test_service_method(self, db_session: AsyncSession):
    user = await _create_user(db_session, "test@test.com")
    # ... create test data ...
    svc = MyService(db_session)
    result = await svc.method(user.id, ...)
    assert result.field == expected
```

**Property-based tests (Hypothesis):**
```python
from hypothesis import given, strategies as st

@given(st.floats(min_value=0, max_value=1000))
def test_property(value):
    result = my_function(value)
    assert result >= 0  # invariant
```

## Frontend Test Infrastructure

### Config (`app/jest.config.js`)
- Preset: `ts-jest`
- Environment: `node`
- Test match: `**/__tests__/**/*.test.ts(x)`

### Test Patterns

**Utility tests:**
```typescript
describe('myFunction', () => {
  test('normal case', () => {
    expect(myFunction(input)).toBe(expected);
  });
});
```

**Property-based tests (fast-check):**
```typescript
import * as fc from 'fast-check';

test('property', () => {
  fc.assert(fc.property(fc.float(), (value) => {
    return myFunction(value) >= 0;
  }));
});
```

## Test File Map

### Backend (`tests/`)

| File | Tests | What It Covers |
|------|-------|---------------|
| `test_wns_engine_unit.py` | 32 | WNS pure functions: stim reps, diminishing returns, atrophy |
| `test_exercise_coefficients_unit.py` | 8 | Direct/fractional muscle attribution |
| `test_volume_service_unit.py` | 107 | Legacy volume + WNS schemas + validation |
| `test_wns_fatigue_simulation.py` | 32 | Month-long workout simulations across 5 athlete profiles |
| `test_wns_integration_simulation.py` | 14 | DB-backed 4-week workout simulations |
| `test_micro_dashboard.py` | 22 | Micronutrient aggregation, scoring, deficiency detection |
| `test_nutrition_bugfixes.py` | 6 | Pagination, validation, copy, date filtering |
| `test_weekly_report_unit.py` | 31 | Report generation, recommendations, schema validation |
| `test_fatigue_engine_unit.py` | ~20 | Fatigue score computation, regression detection |
| `test_auth_unit.py` | ~10 | Auth service unit tests |
| `test_adaptive_engine.py` | ~15 | Adaptive macro calculations |
| `conftest.py` | — | Test fixtures and database setup |

### Frontend (`app/__tests__/`)

| Directory | Key Files | What It Covers |
|-----------|-----------|---------------|
| `utils/` | `wnsCalculator.test.ts` | WNS calculator parity with Python |
| `utils/` | `microDashboardLogic.test.ts` | Nutrient status colors, score labels |
| `utils/` | `volumeAggregator.test.ts` | Real-time volume aggregation |
| `utils/` | `servingOptions.test.ts` | Serving size scaling |
| `utils/` | `muscleHeatmapColor.test.ts` | Heat map color logic |
| `components/` | Various | Component rendering tests |
| `store/` | `activeWorkoutSlice.test.ts` | Workout state management |

## Pre-Commit Checklist

Before declaring any change "done":
1. `pytest tests/ -v --timeout=120` — all backend tests pass
2. `cd app && npx tsc --noEmit` — zero TS errors in modified files
3. `cd app && npx jest` — all frontend tests pass
4. Manual curl verification of modified endpoints
5. No existing tests deleted or modified (unless explicitly requested)
