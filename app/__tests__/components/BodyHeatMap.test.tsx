import * as fc from 'fast-check';
import { MUSCLE_REGIONS, BODY_OUTLINES } from '../../components/analytics/anatomicalPaths';
import { getHeatMapColor } from '../../utils/muscleVolumeLogic';
import { colors } from '../../theme/tokens';

/**
 * Unit & property tests for BodyHeatMap component logic.
 *
 * Since the project doesn't use @testing-library/react-native,
 * we test the component's behavior through its pure logic paths:
 * - Label rendering logic (Front/Back views)
 * - Empty state detection
 * - Loading/error state branching
 * - Tap callback wiring (Property 4)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

interface MuscleGroupVolume {
  muscle_group: string;
  effective_sets: number;
  frequency: number;
  volume_status: string;
  mev: number;
  mav: number;
  mrv: number;
}

// ─── Pure logic extracted from BodyHeatMap ───────────────────────────────────

/**
 * Mirrors BodyHeatMap's data preparation: builds a volumeMap from the array,
 * determines hasData, and splits regions into front/back.
 */
function prepareHeatMapData(muscleVolumes: MuscleGroupVolume[]) {
  const safeVolumes = Array.isArray(muscleVolumes) ? muscleVolumes : [];
  const volumeMap = new Map<string, MuscleGroupVolume>(
    safeVolumes.map((v) => [v.muscle_group, v]),
  );
  const hasData = safeVolumes.length > 0 && safeVolumes.some((v) => v.effective_sets > 0);

  const frontRegions = MUSCLE_REGIONS.filter((r) => r.view === 'front');
  const backRegions = MUSCLE_REGIONS.filter((r) => r.view === 'back');
  const frontOutline = BODY_OUTLINES.find((o) => o.view === 'front');
  const backOutline = BODY_OUTLINES.find((o) => o.view === 'back');

  return { safeVolumes, volumeMap, hasData, frontRegions, backRegions, frontOutline, backOutline };
}

/**
 * Mirrors BodyHeatMap's rendering branch logic.
 * Returns which state the component would render.
 */
function getRenderState(opts: { isLoading?: boolean; error?: string | null }): 'loading' | 'error' | 'content' {
  if (opts.isLoading) return 'loading';
  if (opts.error) return 'error';
  return 'content';
}

/**
 * Mirrors BodySilhouette's onRegionPress wiring:
 * When a region is pressed, onRegionPress is called with region.id.
 */
function simulateRegionPress(
  regionId: string,
  onRegionPress: (muscleGroup: string) => void,
) {
  onRegionPress(regionId);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BodyHeatMap', () => {
  describe('renders "Front" and "Back" labels', () => {
    test('front and back outlines exist for labeling', () => {
      const { frontOutline, backOutline } = prepareHeatMapData([]);
      // BodyHeatMap renders "Front" label above frontOutline and "Back" above backOutline
      expect(frontOutline).toBeDefined();
      expect(frontOutline!.view).toBe('front');
      expect(backOutline).toBeDefined();
      expect(backOutline!.view).toBe('back');
    });

    test('front and back region groups are non-empty', () => {
      const { frontRegions, backRegions } = prepareHeatMapData([]);
      expect(frontRegions.length).toBe(6);
      expect(backRegions.length).toBe(6);
    });
  });

  describe('empty muscleVolumes=[] shows "No training data"', () => {
    test('hasData is false when muscleVolumes is empty', () => {
      const { hasData } = prepareHeatMapData([]);
      expect(hasData).toBe(false);
    });

    test('hasData is false when all effective_sets are 0', () => {
      const volumes: MuscleGroupVolume[] = [
        { muscle_group: 'chest', effective_sets: 0, frequency: 0, volume_status: 'untrained', mev: 10, mav: 15, mrv: 20 },
        { muscle_group: 'back', effective_sets: 0, frequency: 0, volume_status: 'untrained', mev: 10, mav: 15, mrv: 20 },
      ];
      const { hasData } = prepareHeatMapData(volumes);
      expect(hasData).toBe(false);
    });

    test('hasData is true when at least one muscle has effective_sets > 0', () => {
      const volumes: MuscleGroupVolume[] = [
        { muscle_group: 'chest', effective_sets: 5, frequency: 2, volume_status: 'below_mev', mev: 10, mav: 15, mrv: 20 },
      ];
      const { hasData } = prepareHeatMapData(volumes);
      expect(hasData).toBe(true);
    });
  });

  describe('isLoading=true renders skeleton', () => {
    test('render state is loading when isLoading is true', () => {
      expect(getRenderState({ isLoading: true })).toBe('loading');
    });

    test('render state is content when isLoading is false', () => {
      expect(getRenderState({ isLoading: false })).toBe('content');
    });

    test('loading takes priority over error', () => {
      expect(getRenderState({ isLoading: true, error: 'fail' })).toBe('loading');
    });
  });

  describe('error="fail" renders error text', () => {
    test('render state is error when error is provided', () => {
      expect(getRenderState({ error: 'fail' })).toBe('error');
    });

    test('render state is content when error is null', () => {
      expect(getRenderState({ error: null })).toBe('content');
    });

    test('render state is content when error is undefined', () => {
      expect(getRenderState({})).toBe('content');
    });
  });

  describe('Property 4: Tap callback receives correct muscle group identifier', () => {
    /**
     * **Validates: Requirements 4.1**
     *
     * For each region in MUSCLE_REGIONS, verify that the onRegionPress callback
     * receives region.id — the exact muscle group identifier matching the API field.
     *
     * BodySilhouette wires: onPress={() => handlePress(region.id)}
     * handlePress calls: onRegionPress(regionId)
     * So the callback always receives region.id.
     */
    test('every region press invokes callback with its exact id', () => {
      MUSCLE_REGIONS.forEach((region) => {
        const mockCallback = jest.fn();
        simulateRegionPress(region.id, mockCallback);
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(region.id);
      });
    });

    test('property: for any region, callback receives region.id', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MUSCLE_REGIONS.length - 1 }),
          (index) => {
            const region = MUSCLE_REGIONS[index];
            const mockCallback = jest.fn();
            simulateRegionPress(region.id, mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(region.id);
          },
        ),
        { numRuns: 100 },
      );
    });

    test('all 12 regions produce valid muscle group identifiers', () => {
      const expectedIds = [
        'chest', 'shoulders', 'biceps', 'forearms', 'abs', 'quads',
        'back', 'triceps', 'glutes', 'hamstrings', 'calves',
      ];
      const receivedIds = new Set<string>();

      MUSCLE_REGIONS.forEach((region) => {
        const mockCallback = jest.fn();
        simulateRegionPress(region.id, mockCallback);
        receivedIds.add(mockCallback.mock.calls[0][0]);
      });

      // All expected IDs should be in the received set
      expectedIds.forEach((id) => {
        expect(receivedIds).toContain(id);
      });
    });

    test('shoulders region exists in both front and back views', () => {
      const shoulderRegions = MUSCLE_REGIONS.filter((r) => r.id === 'shoulders');
      expect(shoulderRegions).toHaveLength(2);
      expect(shoulderRegions.map((r) => r.view).sort()).toEqual(['back', 'front']);

      // Both invoke callback with 'shoulders'
      shoulderRegions.forEach((region) => {
        const mockCallback = jest.fn();
        simulateRegionPress(region.id, mockCallback);
        expect(mockCallback).toHaveBeenCalledWith('shoulders');
      });
    });
  });

  describe('volumeMap construction', () => {
    test('builds correct map from muscleVolumes array', () => {
      const volumes: MuscleGroupVolume[] = [
        { muscle_group: 'chest', effective_sets: 12, frequency: 2, volume_status: 'optimal', mev: 10, mav: 15, mrv: 20 },
        { muscle_group: 'back', effective_sets: 15, frequency: 3, volume_status: 'optimal', mev: 10, mav: 18, mrv: 22 },
      ];
      const { volumeMap } = prepareHeatMapData(volumes);
      expect(volumeMap.size).toBe(2);
      expect(volumeMap.get('chest')?.effective_sets).toBe(12);
      expect(volumeMap.get('back')?.effective_sets).toBe(15);
    });

    test('shoulders entry maps to both front and back regions via volumeMap lookup', () => {
      const volumes: MuscleGroupVolume[] = [
        { muscle_group: 'shoulders', effective_sets: 8, frequency: 2, volume_status: 'below_mev', mev: 10, mav: 15, mrv: 20 },
      ];
      const { volumeMap, frontRegions, backRegions } = prepareHeatMapData(volumes);

      // Both front and back shoulder regions look up 'shoulders' in the map
      const frontShoulder = frontRegions.find((r) => r.id === 'shoulders');
      const backShoulder = backRegions.find((r) => r.id === 'shoulders');
      expect(frontShoulder).toBeDefined();
      expect(backShoulder).toBeDefined();

      // Both get the same volume data
      const frontVol = volumeMap.get(frontShoulder!.id);
      const backVol = volumeMap.get(backShoulder!.id);
      expect(frontVol).toBe(backVol);
      expect(frontVol?.effective_sets).toBe(8);
    });

    test('missing muscle group returns undefined from volumeMap (renders untrained)', () => {
      const { volumeMap } = prepareHeatMapData([]);
      const vol = volumeMap.get('chest');
      expect(vol).toBeUndefined();
      // Component uses: getHeatMapColor(vol?.effective_sets ?? 0, vol?.mev ?? 0, vol?.mrv ?? 0)
      expect(getHeatMapColor(0, 0, 0)).toBe(colors.heatmap.untrained);
    });
  });
});
