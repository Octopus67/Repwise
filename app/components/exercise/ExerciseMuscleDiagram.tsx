import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { BodySilhouette } from '../analytics/BodySilhouette';
import { MUSCLE_REGIONS, BODY_OUTLINES } from '../analytics/anatomicalPathsV2';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { MuscleGroupVolume } from '../../types/analytics';

interface Props {
  primaryMuscle: string;
  secondaryMuscles: string[];
}

const NOOP = () => {};

export function ExerciseMuscleDiagram({ primaryMuscle, secondaryMuscles }: Props) {
  const c = useThemeColors();

  const volumeMap = useMemo(() => {
    const map = new Map<string, MuscleGroupVolume>();
    const base = { mev: 1, mrv: 10, mav: 5, frequency: 0, volume_status: '' };
    map.set(primaryMuscle, { muscle_group: primaryMuscle, effective_sets: 11, ...base });
    secondaryMuscles.forEach((m) => {
      if (!map.has(m)) {
        map.set(m, { muscle_group: m, effective_sets: 5, ...base });
      }
    });
    return map;
  }, [primaryMuscle, secondaryMuscles]);

  const frontRegions = useMemo(() => MUSCLE_REGIONS.filter((r) => r.view === 'front'), []);
  const backRegions = useMemo(() => MUSCLE_REGIONS.filter((r) => r.view === 'back'), []);
  const frontOutline = BODY_OUTLINES.find((o) => o.view === 'front')!;
  const backOutline = BODY_OUTLINES.find((o) => o.view === 'back')!;

  return (
    <View style={[styles.row, { backgroundColor: c.bg.surface }]}>
      <View style={styles.half}>
        <BodySilhouette
          view="front"
          regions={frontRegions}
          outline={frontOutline}
          volumeMap={volumeMap}
          onRegionPress={NOOP}
        />
      </View>
      <View style={styles.half}>
        <BodySilhouette
          view="back"
          regions={backRegions}
          outline={backOutline}
          volumeMap={volumeMap}
          onRegionPress={NOOP}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', padding: 8 },
  half: { flex: 1 },
});
