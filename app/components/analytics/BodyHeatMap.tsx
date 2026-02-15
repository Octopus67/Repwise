import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { Skeleton } from '../common/Skeleton';
import { BODY_REGIONS, VIEWBOX } from './bodySvgPaths';
import { getStatusColor, getStatusLabel } from '../../utils/muscleVolumeLogic';

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

const LEGEND_ITEMS = [
  { status: 'below_mev', label: 'Below MEV' },
  { status: 'optimal', label: 'Optimal' },
  { status: 'approaching_mrv', label: 'Near MRV' },
  { status: 'above_mrv', label: 'Above MRV' },
];

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

  // Guard against null/undefined muscleVolumes
  const safeVolumes = Array.isArray(muscleVolumes) ? muscleVolumes : [];
  const volumeMap = new Map(safeVolumes.map((v) => [v.muscle_group, v]));
  const hasData = safeVolumes.some((v) => v.effective_sets > 0);

  const frontRegions = BODY_REGIONS.filter((r) => r.view === 'front');
  const backRegions = BODY_REGIONS.filter((r) => r.view === 'back');

  const renderRegions = (regions: typeof BODY_REGIONS) =>
    regions.map((region) => {
      const vol = volumeMap.get(region.muscleGroup);
      const fillColor = vol ? getStatusColor(vol.volume_status) : '#6B7280';
      return (
        <G key={`${region.view}-${region.muscleGroup}`}>
          <Path
            d={region.pathData}
            fill={fillColor}
            opacity={0.8}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={0.5}
            onPress={() => onMusclePress(region.muscleGroup)}
          />
        </G>
      );
    });

  return (
    <View>
      {!hasData && (
        <Text style={styles.noDataText}>No training data for this week</Text>
      )}
      <View style={styles.diagramRow}>
        <View style={styles.diagramCol}>
          <Text style={styles.viewLabel}>Front</Text>
          <Svg viewBox={VIEWBOX} style={styles.svg}>
            {renderRegions(frontRegions)}
          </Svg>
        </View>
        <View style={styles.diagramCol}>
          <Text style={styles.viewLabel}>Back</Text>
          <Svg viewBox={VIEWBOX} style={styles.svg}>
            {renderRegions(backRegions)}
          </Svg>
        </View>
      </View>
      {/* Legend */}
      <View style={styles.legend}>
        {LEGEND_ITEMS.map((item) => (
          <View key={item.status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
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
  svg: { width: '100%', height: 250 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.text.secondary, fontSize: typography.size.xs },
});
