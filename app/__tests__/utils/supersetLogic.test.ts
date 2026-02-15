import * as fc from 'fast-check';
import { createSupersetGroup, shouldStartRestTimer } from '../../utils/supersetLogic';
import type { SupersetGroup } from '../../types/training';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.6
 * **Validates: Requirements 13.1, 13.3, 13.4, 13.5**
 */

describe('Superset Logic Property Tests', () => {
  /**
   * Property: createSupersetGroup with < 2 IDs returns null
   * **Validates: Requirements 13.1**
   */
  it('createSupersetGroup with < 2 IDs returns null', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 1 }),
        (ids) => {
          return createSupersetGroup(ids) === null;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: createSupersetGroup with >= 2 IDs returns group with those IDs
   * **Validates: Requirements 13.1**
   */
  it('createSupersetGroup with >= 2 IDs returns group containing those IDs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 8 }),
        (ids) => {
          const group = createSupersetGroup(ids);
          if (group === null) return false;
          return (
            group.exerciseLocalIds.length === ids.length &&
            ids.every((id, i) => group.exerciseLocalIds[i] === id) &&
            group.id.length > 0
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: shouldStartRestTimer returns true for last exercise in superset
   * **Validates: Requirements 13.4**
   */
  it('shouldStartRestTimer returns true for last exercise in superset', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 6 }),
        (ids) => {
          const group: SupersetGroup = { id: 'ss-1', exerciseLocalIds: ids };
          const lastId = ids[ids.length - 1];
          return shouldStartRestTimer([group], lastId) === true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: shouldStartRestTimer returns false for non-last exercise in superset
   * **Validates: Requirements 13.5**
   */
  it('shouldStartRestTimer returns false for non-last exercise in superset', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 6 }),
        (ids) => {
          const group: SupersetGroup = { id: 'ss-1', exerciseLocalIds: ids };
          // Pick any non-last exercise
          const nonLastId = ids[0];
          return shouldStartRestTimer([group], nonLastId) === false;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: exercise not in any superset → shouldStartRestTimer returns true
   * **Validates: Requirements 13.3**
   */
  it('exercise not in any superset returns true for shouldStartRestTimer', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (exerciseId) => {
          return shouldStartRestTimer([], exerciseId) === true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
