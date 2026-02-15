# Implementation Plan: Periodization Calendar

## Overview

Build the periodization calendar feature following the strict dependency chain from the design document (Layers 0–10). Backend first (Python/FastAPI), then frontend (React Native/TypeScript). Each layer builds only on completed layers below it.

## Tasks

- [x] 1. Database migration and SQLAlchemy model
  - [x] 1.1 Create Alembic migration for `training_blocks` table
    - Create migration file with CREATE TABLE matching design spec exactly: id (UUID PK), user_id (UUID FK to users), name (VARCHAR 100), phase_type (VARCHAR 20), start_date (DATE), end_date (DATE), nutrition_phase (VARCHAR 20 nullable), deleted_at, created_at, updated_at
    - Include CHECK constraint `ck_training_blocks_date_range` (end_date >= start_date)
    - Include indexes: `ix_training_blocks_user_dates` on (user_id, start_date, end_date), `ix_training_blocks_not_deleted` partial index WHERE deleted_at IS NULL
    - Include downgrade: DROP TABLE training_blocks
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 Create `src/modules/periodization/__init__.py` and `src/modules/periodization/models.py`
    - Define `TrainingBlock` model extending `Base`, `SoftDeleteMixin`, `AuditLogMixin`
    - Columns must mirror migration exactly
    - Use `ForeignKey("users.id", ondelete="CASCADE")` for user_id
    - _Requirements: 1.1, 1.5, 2.3_

- [x] 2. Pydantic schemas and static templates
  - [x] 2.1 Create `src/modules/periodization/schemas.py`
    - Define constants: `VALID_PHASE_TYPES`, `VALID_NUTRITION_PHASES`
    - Define `TrainingBlockCreate` with field validators for phase_type, nutrition_phase, and model validator for end_date >= start_date
    - Define `TrainingBlockUpdate` with all optional fields, same validators for non-None
    - Define `TrainingBlockResponse` with `from_attributes=True` and `from_orm_model` classmethod (handle metadata_ alias pattern if needed)
    - Define `TemplatePhase`, `BlockTemplateResponse`, `ApplyTemplateRequest`, `DeloadSuggestion`
    - _Requirements: 1.2, 1.3, 1.5, 7.1, 7.2_

  - [x] 2.2 Create `src/modules/periodization/templates.py`
    - Define `BLOCK_TEMPLATES` list with 4 templates: hypertrophy-4-1, strength-6, hypertrophy-8, peaking-3
    - Implement `get_templates()`, `get_template_by_id(template_id)`, `expand_template(template_id, start_date)`
    - `expand_template` computes contiguous date ranges from start_date using duration_weeks * 7 days per phase
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ]* 2.3 Write property test for template expansion (Property 9)
    - **Property 9: Template expansion correctness**
    - For each template and random start dates, verify: phase types match sequence, blocks contiguous, durations correct, total range correct
    - File: `tests/test_periodization_properties.py`
    - **Validates: Requirements 6.2**

  - [ ]* 2.4 Write property test for serialization round-trip (Property 1)
    - **Property 1: Training block serialization round-trip**
    - Generate random valid TrainingBlockCreate, serialize via model_dump(), reconstruct, assert field equality
    - File: `tests/test_periodization_properties.py`
    - **Validates: Requirements 7.3, 7.1, 7.2, 1.5, 4.2**

  - [ ]* 2.5 Write property tests for validation rejection (Properties 3, 4)
    - **Property 3: Invalid date range rejection** — generate date pairs where end < start, assert ValidationError
    - **Property 4: Invalid phase type rejection** — generate strings not in VALID_PHASE_TYPES, assert ValidationError
    - File: `tests/test_periodization_properties.py`
    - **Validates: Requirements 1.2, 1.3**

- [x] 3. Service layer with overlap detection
  - [x] 3.1 Create `src/modules/periodization/service.py`
    - Implement `PeriodizationService` class with `__init__(self, session: AsyncSession)`
    - Implement `create_block`: validate, check overlap via `_check_overlap`, persist, audit log
    - Implement `list_blocks`: query non-deleted blocks for user, optional date range, ORDER BY start_date ASC
    - Implement `get_block`: single lookup, raise NotFoundError if missing/not owned
    - Implement `update_block`: fetch, apply partial updates, check overlap excluding self if dates changed, audit, flush
    - Implement `soft_delete_block`: fetch, set deleted_at, audit, flush
    - Implement `apply_template`: get template, expand, check overlap for full range, create all blocks atomically
    - Implement `check_deload_suggestions`: list blocks, walk consecutive non-deload spans, emit suggestion if > 4 weeks
    - Implement `_check_overlap`: SQL query for overlapping non-deleted blocks, raise ConflictError if found
    - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 5.3, 6.2, 6.3_

  - [ ]* 3.2 Write property test for overlap invariant (Property 2)
    - **Property 2: Overlap invariant**
    - Generate two blocks with overlapping date ranges for same user, create first, assert second raises ConflictError
    - File: `tests/test_periodization_properties.py`
    - **Validates: Requirements 1.4, 2.2, 6.3**

  - [ ]* 3.3 Write property test for soft delete and list ordering (Property 5)
    - **Property 5: Soft delete exclusion and list ordering**
    - Generate N blocks, soft-delete random subset, list, assert only non-deleted returned and sorted by start_date
    - File: `tests/test_periodization_properties.py`
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 3.4 Write property test for deload suggestion (Property 8)
    - **Property 8: Deload suggestion trigger**
    - Generate consecutive non-deload blocks spanning > 4 weeks, assert suggestion produced
    - File: `tests/test_periodization_properties.py`
    - **Validates: Requirements 5.3**

  - [ ]* 3.5 Write unit tests for service edge cases
    - Test adjacent blocks (end day N, start day N+1) are NOT overlapping
    - Test single-day block (start == end) is valid
    - Test two blocks sharing exactly one day ARE overlapping
    - Test template apply rolls back all blocks if overlap detected mid-expansion
    - Test deload suggestion NOT triggered for <= 4 consecutive non-deload weeks
    - Test update only name preserves other fields
    - Test nutrition_phase persists and returns correctly
    - File: `tests/test_periodization_unit.py`
    - _Requirements: 1.4, 2.1, 2.2, 4.2, 5.3, 6.3_

- [ ] 4. Checkpoint — Backend service tests
  - Run `pytest tests/test_periodization_properties.py tests/test_periodization_unit.py -v`
  - All tests must pass before proceeding to router
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Router and main.py registration
  - [x] 5.1 Create `src/modules/periodization/router.py`
    - Define FastAPI APIRouter with all 8 endpoints from design
    - POST /blocks (201), GET /blocks (200), GET /blocks/deload-suggestions (200), GET /blocks/{block_id} (200), PUT /blocks/{block_id} (200), DELETE /blocks/{block_id} (204), GET /templates (200), POST /templates/apply (201)
    - Define `/blocks/deload-suggestions` BEFORE `/blocks/{block_id}` to avoid path conflict
    - All endpoints use `Depends(get_current_user)` for auth
    - Use dependency injection for PeriodizationService via `Depends(get_db)`
    - _Requirements: 1.1, 2.1, 2.3, 2.4, 5.3, 6.1, 6.2_

  - [x] 5.2 Register router in `src/main.py`
    - Import periodization router
    - Add `app.include_router(periodization_router, prefix="/periodization", tags=["periodization"])`
    - _Requirements: all_

- [ ] 6. Checkpoint — Backend fully functional
  - Run full backend test suite: `pytest tests/ -v`
  - Verify app starts without import errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend utility functions
  - [x] 7.1 Create `app/utils/periodizationUtils.ts`
    - Define `PHASE_COLORS` mapping (accumulation, intensification, deload, peak → theme colors)
    - Define `NUTRITION_LABELS` mapping (bulk, cut, maintenance → display labels)
    - Define `TrainingBlock` and `WeekRow` TypeScript interfaces
    - Implement `buildWeekRows(blocks, sessionDates, today)`: iterate blocks, compute week boundaries (Monday–Sunday), map each week to a WeekRow with blockName, phaseType, phaseColor, nutritionPhase, nutritionLabel, weekNumber, totalWeeks, isCurrentWeek, sessionDates
    - Implement `needsDeloadSuggestion(blocks)`: walk sorted blocks, track consecutive non-deload weeks, return true if > 4
    - Implement `getPhaseColor(phaseType)` and `getNutritionLabel(nutritionPhase)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.3, 5.1, 5.2, 5.3_

  - [ ]* 7.2 Write property tests for frontend utilities (Properties 6, 7)
    - **Property 6: Block-to-week mapping** — For any block, every week in range maps to row with correct name/phase/color/nutrition
    - **Property 7: Session dots placement** — For any session dates, dots appear on exactly those dates
    - Use `fast-check` library with minimum 100 iterations
    - File: `app/__tests__/utils/periodizationUtils.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.4, 4.1, 4.3**

  - [ ]* 7.3 Write unit tests for frontend utilities
    - Test current week highlight: given specific today date, correct WeekRow has isCurrentWeek=true
    - Test empty blocks → empty array
    - Test deload phase gets correct PHASE_COLORS.deload color
    - Test nutrition label mapping: "bulk" → "Bulk", null → null
    - Test needsDeloadSuggestion returns false for <= 4 non-deload weeks
    - Test needsDeloadSuggestion returns false when deload breaks the chain
    - File: `app/__tests__/utils/periodizationUtils.test.ts`
    - _Requirements: 3.3, 3.5, 5.1, 5.3_

- [ ] 8. Checkpoint — Frontend utilities tested
  - Run `npx jest app/__tests__/utils/periodizationUtils.test.ts --run`
  - All tests must pass before proceeding to components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend components
  - [x] 9.1 Create `app/components/periodization/BlockCreationModal.tsx`
    - Modal with form: name (TextInput, required, 1–100 chars), phase_type (picker with 4 options), start_date (DatePicker), end_date (DatePicker), nutrition_phase (optional picker with 3 options + none)
    - Local validation: name required, end_date >= start_date
    - Submit calls `POST /periodization/blocks` (create) or `PUT /periodization/blocks/{id}` (edit)
    - Display API error messages (overlap 409, validation 422)
    - Accept optional `block` prop for edit mode, pre-fill fields
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 4.2_

  - [x] 9.2 Create `app/components/periodization/BlockTemplateModal.tsx`
    - Fetch templates from `GET /periodization/templates` on mount
    - Display template cards with name, description, phase breakdown
    - User selects template, picks start date via DatePicker
    - Submit calls `POST /periodization/templates/apply`
    - Display error on overlap (409)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.3 Create `app/components/periodization/PeriodizationCalendar.tsx`
    - Fetch blocks via `GET /periodization/blocks` and session dates via existing `GET /training/sessions` (extract dates only)
    - Call `buildWeekRows` to compute display data
    - Render ScrollView of week rows: phase color band (View with backgroundColor), block name + "Week N of M" label, session dots (small circles), nutrition badge
    - Highlight current week row with accent border
    - Show empty state (EmptyState component) when no blocks, with CTA button to open BlockCreationModal
    - FAB or header button to open BlockCreationModal for new block
    - Template button to open BlockTemplateModal
    - Show deload suggestion banner if `needsDeloadSuggestion` returns true
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.3, 5.1, 5.2, 5.3_

  - [x] 9.4 Integrate PeriodizationCalendar into AnalyticsScreen
    - Import PeriodizationCalendar in `app/screens/analytics/AnalyticsScreen.tsx`
    - Add section title "Periodization" and `<PeriodizationCalendar />` between the screen title and the TimeRangeSelector
    - _Requirements: 3.1_

  - [ ]* 9.5 Write component tests for PeriodizationCalendar
    - Test renders empty state when blocks API returns empty array
    - Test renders week rows when blocks exist
    - Test BlockCreationModal opens on FAB press
    - Test BlockTemplateModal opens on template button press
    - File: `app/__tests__/components/PeriodizationCalendar.test.ts`
    - _Requirements: 3.1, 3.5_

- [ ] 10. Final checkpoint — Full feature verification
  - Run full backend test suite: `pytest tests/ -v`
  - Run full frontend test suite: `npx jest --run`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 4, 6, 8, 10 ensure incremental validation
- Property tests validate universal correctness properties (P1–P9)
- Unit tests validate specific examples and edge cases
- Dependency chain: 1 → 2 → 3 → 4(gate) → 5 → 6(gate) → 7 → 8(gate) → 9 → 10(gate)
- Rollback per layer: DB (DROP TABLE), Backend (remove router from main.py), Frontend (remove section from AnalyticsScreen)
