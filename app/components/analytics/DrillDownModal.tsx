import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { getStatusColor, getStatusLabel } from '../../utils/muscleVolumeLogic';
import api from '../../services/api';

interface SetDetail {
  weight_kg: number;
  reps: number;
  rpe: number | null;
  effort: number;
}

interface ExerciseDetail {
  exercise_name: string;
  working_sets: number;
  effective_sets: number;
  sets: SetDetail[];
}

interface DetailData {
  muscle_group: string;
  effective_sets: number;
  frequency: number;
  volume_status: string;
  mev: number;
  mav: number;
  mrv: number;
  exercises: ExerciseDetail[];
}

interface DrillDownModalProps {
  visible: boolean;
  muscleGroup: string | null;
  weekStart: string;
  onClose: () => void;
}

export function DrillDownModal({ visible, muscleGroup, weekStart, onClose }: DrillDownModalProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && muscleGroup) {
      setLoading(true);
      api
        .get(`training/analytics/muscle-volume/${encodeURIComponent(muscleGroup)}/detail`, {
          params: { week_start: weekStart },
        })
        .then((res) => setData(res.data))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [visible, muscleGroup, weekStart]);

  const title = muscleGroup
    ? muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1)
    : 'Detail';

  return (
    <ModalContainer visible={visible} onClose={onClose} title={title}>
      <ScrollView style={styles.scroll}>
        {loading ? (
          <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing[6] }} />
        ) : !data || data.exercises.length === 0 ? (
          <Text style={styles.empty}>No training data for this muscle group this week.</Text>
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryRow}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(data.volume_status) }]}>
                <Text style={styles.statusText}>{getStatusLabel(data.volume_status)}</Text>
              </View>
              <Text style={styles.setsText}>{data.effective_sets} effective sets</Text>
            </View>
            <Text style={styles.landmarkText}>
              MEV {data.mev} · MAV {data.mav} · MRV {data.mrv}
            </Text>

            {/* Exercises */}
            {data.exercises.map((ex) => (
              <View key={ex.exercise_name} style={styles.exerciseBlock}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
                  <Text style={styles.exerciseSets}>
                    {ex.working_sets} sets · {ex.effective_sets} eff
                  </Text>
                </View>
                {ex.sets.map((s, i) => (
                  <View key={i} style={styles.setRow}>
                    <Text style={styles.setDetail}>
                      {s.weight_kg}kg × {s.reps}
                      {s.rpe != null ? ` @RPE ${s.rpe}` : ''}
                    </Text>
                    <Text style={styles.setEffort}>×{s.effort}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 400 },
  empty: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing[6],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  setsText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  landmarkText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    marginBottom: spacing[4],
  },
  exerciseBlock: {
    marginBottom: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  exerciseSets: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: spacing[3],
    marginBottom: 2,
  },
  setDetail: { color: colors.text.secondary, fontSize: typography.size.xs },
  setEffort: { color: colors.text.muted, fontSize: typography.size.xs },
});
