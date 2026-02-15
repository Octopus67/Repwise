import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { colors, spacing, typography } from '../../theme/tokens';
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
}

export function HeatMapCard() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [volumes, setVolumes] = useState<MuscleGroupVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchVolume = async (ws: string) => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get('training/analytics/muscle-volume', {
        params: { week_start: ws },
      });
      setVolumes(data.muscle_groups ?? []);
    } catch {
      setError(true);
      setVolumes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVolume(weekStart);
  }, [weekStart]);

  const handleMusclePress = (mg: string) => {
    setSelectedMuscle(mg);
    setModalVisible(true);
  };

  // Show top muscle groups with volume > 0 as frequency summary
  const activeGroups = volumes
    .filter((v) => v.effective_sets > 0)
    .sort((a, b) => b.effective_sets - a.effective_sets)
    .slice(0, 6);

  return (
    <Card>
      <WeekNavigator currentWeekStart={weekStart} onWeekChange={setWeekStart} />

      {error ? (
        <Text style={styles.errorText}>Failed to load volume data. Pull to retry.</Text>
      ) : (
        <>
          <BodyHeatMap
            muscleVolumes={volumes}
            onMusclePress={handleMusclePress}
            isLoading={loading}
          />

          {/* Frequency summary */}
          {!loading && activeGroups.length > 0 && (
            <View style={styles.frequencyList}>
              {activeGroups.map((v) => (
                <Text key={v.muscle_group} style={styles.frequencyItem}>
                  {formatFrequency(
                    v.muscle_group.charAt(0).toUpperCase() + v.muscle_group.slice(1),
                    v.frequency,
                    Math.round(v.effective_sets),
                  )}
                </Text>
              ))}
            </View>
          )}
        </>
      )}

      <DrillDownModal
        visible={modalVisible}
        muscleGroup={selectedMuscle}
        weekStart={weekStart}
        onClose={() => setModalVisible(false)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    textAlign: 'center',
    padding: spacing[4],
  },
  frequencyList: {
    marginTop: spacing[3],
    gap: 2,
  },
  frequencyItem: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },
});
