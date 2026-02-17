import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { Skeleton } from '../common/Skeleton';
import { MUSCLE_REGIONS, BODY_OUTLINES } from './anatomicalPaths';
import { BodySilhouette } from './BodySilhouette';
import { HeatMapLegend } from './HeatMapLegend';

interface MuscleGroupVolume {
  muscle_group: string;
  effective_sets: number;
  frequency: number;
  volume_status: string;
  mev: number;
  mav: number;
  mrv: number;
}

interface BodyHeatMapProps {
  muscleVolumes: MuscleGroupVolume[];
  onMusclePress: (muscleGroup: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function BodyHeatMap({ muscleVolumes, onMusclePress, isLoading, error }: BodyHeatMapProps) {
  if (isLoading) {
    return (
      <View style={styles.skeletonContainer}>
        <Skeleton width="100%" height={300} borderRadius={8} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Unable to load volume data</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  const safeVolumes = Array.isArray(muscleVolumes) ? muscleVolumes : [];
  const volumeMap = new Map<string, MuscleGroupVolume>(
    safeVolumes.map((v) => [v.muscle_group, v]),
  );
  const hasData = safeVolumes.length > 0 && safeVolumes.some((v) => v.effective_sets > 0);

  const frontRegions = MUSCLE_REGIONS.filter((r) => r.view === 'front');
  const backRegions = MUSCLE_REGIONS.filter((r) => r.view === 'back');
  const frontOutline = BODY_OUTLINES.find((o) => o.view === 'front')!;
  const backOutline = BODY_OUTLINES.find((o) => o.view === 'back')!;

  return (
    <View>
      {!hasData && (
        <Text style={styles.noDataText}>No training data for this week</Text>
      )}
      <View style={styles.diagramRow}>
        <View style={styles.diagramCol}>
          <Text style={styles.viewLabel}>Front</Text>
          <BodySilhouette
            view="front"
            regions={frontRegions}
            outline={frontOutline}
            volumeMap={volumeMap}
            onRegionPress={onMusclePress}
          />
        </View>
        <View style={styles.diagramCol}>
          <Text style={styles.viewLabel}>Back</Text>
          <BodySilhouette
            view="back"
            regions={backRegions}
            outline={backOutline}
            volumeMap={volumeMap}
            onRegionPress={onMusclePress}
          />
        </View>
      </View>
      <HeatMapLegend />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonContainer: { padding: spacing[4] },
  errorContainer: {
    padding: spacing[4],
    alignItems: 'center',
  },
  errorText: {
    color: colors.semantic.negative,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  errorDetail: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  noDataText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  diagramRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  diagramCol: { flex: 1, alignItems: 'center' },
  viewLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
});
