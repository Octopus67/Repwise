import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from '../common/Card';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { WeekNavigator } from './WeekNavigator';
import { BodyHeatMap } from './BodyHeatMap';
import { DrillDownModal } from './DrillDownModal';
import { getWeekStart, formatFrequency } from '../../utils/muscleVolumeLogic';
import api from '../../services/api';

interface MuscleGroupVolume {
  muscle_group: string;
  effective_sets: number;
  frequency: number;
  volume_status: string;
  mev: number;
  mav: number;
  mrv: number;
  // WNS fields (present when engine='wns')
  hypertrophy_units?: number;
  gross_stimulus?: number;
  atrophy_effect?: number;
}

export function HeatMapCard() {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [volumes, setVolumes] = useState<MuscleGroupVolume[]>([]);
  const [isWNS, setIsWNS] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchVolume = useCallback(async (ws: string) => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get('training/analytics/muscle-volume', {
        params: { week_start: ws },
      });
      setVolumes(data?.muscle_groups ?? []);
      setIsWNS(data?.engine === 'wns');
    } catch {
      setError(true);
      setVolumes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVolume(weekStart);
  }, [weekStart, fetchVolume]);

  const handleMusclePress = (mg: string) => {
    setSelectedMuscle(mg);
    setModalVisible(true);
  };

  // Show top muscle groups with volume > 0 as frequency summary
  const activeGroups = volumes
    .filter((v) => isWNS ? (v.hypertrophy_units ?? 0) > 0 : v.effective_sets > 0)
    .sort((a, b) => isWNS
      ? (b.hypertrophy_units ?? 0) - (a.hypertrophy_units ?? 0)
      : b.effective_sets - a.effective_sets)
    .slice(0, 6);

  const formatSummary = (v: MuscleGroupVolume) => {
    const name = v.muscle_group.charAt(0).toUpperCase() + v.muscle_group.slice(1);
    if (isWNS) {
      return `${name}: ${v.frequency}×/week, ${(v.hypertrophy_units ?? 0).toFixed(1)} HU`;
    }
    return formatFrequency(name, v.frequency, Math.round(v.effective_sets));
  };

  return (
    <Card>
      <WeekNavigator currentWeekStart={weekStart} onWeekChange={setWeekStart} />

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: c.semantic.negative }]}>Failed to load volume data.</Text>
          <TouchableOpacity onPress={() => fetchVolume(weekStart)} style={[styles.retryButton, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
            <Text style={[styles.retryText, { color: c.text.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={loading ? styles.loadingContainer : undefined}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={c.accent.primary} />
            </View>
          )}
          <BodyHeatMap
            muscleVolumes={volumes}
            onMusclePress={handleMusclePress}
            isLoading={false}
          />

          {/* Frequency summary */}
          {!loading && activeGroups.length > 0 && (
            <View style={styles.frequencyList}>
              {activeGroups.map((v) => (
                <Text key={v.muscle_group} style={[styles.frequencyItem, { color: c.text.secondary }]}>
                  {formatSummary(v)}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      <DrillDownModal
        visible={modalVisible}
        muscleGroup={selectedMuscle}
        weekStart={weekStart}
        onClose={() => setModalVisible(false)}
        wnsVolumes={isWNS ? volumes : undefined}
      />
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  errorContainer: {
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[2],
  },
  errorText: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 6,
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  retryText: {
    color: c.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  frequencyList: {
    marginTop: spacing[3],
    gap: 2,
  },
  frequencyItem: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
  },
  loadingContainer: {
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
