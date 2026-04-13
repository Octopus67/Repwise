import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { getVolumeStatusColor, getVolumeStatusLabel } from '../../utils/muscleVolumeLogic';
import { HUExplainerSheet } from '../education/HUExplainerSheet';
import api from '../../services/api';

/** Volume data passed from HeatMapCard — may be legacy MuscleGroupVolume or WNS-enriched */
interface VolumeEntry {
  muscle_group: string;
  effective_sets: number;
  frequency: number;
  volume_status: string;
  mev: number;
  mav: number;
  mrv: number;
  hypertrophy_units?: number;
  gross_stimulus?: number;
  atrophy_effect?: number;
  net_stimulus?: number;
  status?: string;
  landmarks?: { mv: number; mev: number; mav_low: number; mav_high: number; mrv: number };
  exercises?: Array<{ exercise_name: string; coefficient?: number; sets_count?: number; stimulating_reps_total?: number; contribution_hu?: number }>;
}

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
  // WNS fields
  coefficient?: number;
  stimulating_reps_total?: number;
  contribution_hu?: number;
  sets_count?: number;
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
  // WNS fields
  hypertrophy_units?: number;
  gross_stimulus?: number;
  atrophy_effect?: number;
  net_stimulus?: number;
  status?: string;
  landmarks?: { mv: number; mev: number; mav_low: number; mav_high: number; mrv: number };
}

interface DrillDownModalProps {
  visible: boolean;
  muscleGroup: string | null;
  weekStart: string;
  onClose: () => void;
  wnsVolumes?: VolumeEntry[];  // WNS muscle volume data from HeatMapCard
}

export function DrillDownModal({ visible, muscleGroup, weekStart, onClose, wnsVolumes }: DrillDownModalProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explainerVisible, setExplainerVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setData(null);
      setError(null);
      return;
    }
    if (!muscleGroup) return;

    // If WNS data is available from parent, use it directly for the summary
    const wnsMatch = wnsVolumes?.find(
      (v) => v.muscle_group === muscleGroup
    );

    setLoading(true);
    setError(null);
    api
      .get(`training/analytics/muscle-volume/${encodeURIComponent(muscleGroup)}/detail`, {
        params: { week_start: weekStart },
      })
      .then((res) => {
        const merged = { ...res.data };
        // Overlay WNS fields from the weekly endpoint if available
        if (wnsMatch) {
          merged.hypertrophy_units = wnsMatch.hypertrophy_units;
          merged.gross_stimulus = wnsMatch.gross_stimulus;
          merged.atrophy_effect = wnsMatch.atrophy_effect;
          merged.net_stimulus = wnsMatch.net_stimulus;
          merged.status = wnsMatch.status;
          merged.landmarks = wnsMatch.landmarks;
          // Use WNS exercise contributions if the detail endpoint doesn't have them
          if (wnsMatch.exercises?.length && !merged.exercises?.[0]?.contribution_hu) {
            merged.exercises = wnsMatch.exercises;
          }
        }
        setData(merged);
      })
      .catch(() => {
        setError('Failed to load detailed muscle data');
        setData(wnsMatch ? { ...wnsMatch, exercises: [] } as DetailData : null);
      })
      .finally(() => setLoading(false));
  }, [visible, muscleGroup, weekStart, wnsVolumes]);

  const title = muscleGroup
    ? muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1)
    : 'Detail';

  return (
    <ModalContainer visible={visible} onClose={onClose} title={title}>
      <ScrollView style={styles.scroll}>
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: c.semantic.warningSubtle }]}>
            <Text style={[styles.errorText, { color: c.semantic.warning }]}><Icon name="alert-triangle" size={14} color={c.semantic.warning} /> {error}</Text>
          </View>
        )}
        {loading ? (
          <ActivityIndicator color={c.accent.primary} style={{ marginTop: spacing[6] }} />
        ) : !data || data.exercises.length === 0 ? (
          <Text style={[styles.empty, { color: c.text.muted }]}>No training data for this muscle group this week.</Text>
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryRow}>
              <View style={[styles.statusBadge, { backgroundColor: getVolumeStatusColor(data.status ?? data.volume_status) }]}>
                <Text style={styles.statusText}>{getVolumeStatusLabel(data.status ?? data.volume_status)}</Text>
              </View>
              <Text style={[styles.setsText, { color: c.text.primary }]}>
                {data.hypertrophy_units != null
                  ? `${data.hypertrophy_units} HU`
                  : `${data.effective_sets} effective sets`}
              </Text>
            </View>
            {data.landmarks ? (
              <Text style={[styles.landmarkText, { color: c.text.muted }]}>
                MEV {data.landmarks.mev} · MAV {data.landmarks.mav_low}–{data.landmarks.mav_high} · MRV {data.landmarks.mrv} HU
              </Text>
            ) : (
              <Text style={[styles.landmarkText, { color: c.text.muted }]}>
                MEV {data.mev} · MAV {data.mav} · MRV {data.mrv}
              </Text>
            )}
            {data.gross_stimulus != null && (
              <Text style={[styles.landmarkText, { color: c.text.muted }]}>
                Gross stimulus: {data.gross_stimulus} · Atrophy: −{data.atrophy_effect}
              </Text>
            )}

            {/* Exercises */}
            {data.exercises.map((ex) => (
              <View key={ex.exercise_name} style={[styles.exerciseBlock, { borderTopColor: c.border.subtle }]}>
                <View style={styles.exerciseHeader}>
                  <Text style={[styles.exerciseName, { color: c.text.primary }]}>
                    {ex.exercise_name}
                    {ex.coefficient != null && (
                      <Text style={[styles.coeffBadge, { color: c.text.muted }]}>
                        {' '}{ex.coefficient === 1.0 ? '(Direct)' : `(${ex.coefficient}×)`}
                      </Text>
                    )}
                  </Text>
                  <Text style={[styles.exerciseSets, { color: c.text.secondary }]}>
                    {ex.contribution_hu != null
                      ? `${ex.contribution_hu} HU · ${ex.sets_count ?? ex.working_sets} sets`
                      : `${ex.working_sets} sets · ${ex.effective_sets} eff`}
                  </Text>
                </View>
                {ex.sets?.map((s, i) => (
                  <View key={i} style={styles.setRow}>
                    <Text style={[styles.setDetail, { color: c.text.secondary }]}>
                      {s.weight_kg}kg × {s.reps}
                      {s.rpe != null ? ` @RPE ${s.rpe}` : ''}
                    </Text>
                    <Text style={[styles.setEffort, { color: c.text.muted }]}>×{s.effort}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
      {data?.hypertrophy_units != null && (
        <TouchableOpacity
          onPress={() => setExplainerVisible(true)}
          style={styles.explainerLink}
          accessibilityLabel="How Hypertrophy Units are calculated"
          accessibilityRole="button"
        >
          <Text style={[styles.explainerText, { color: c.accent.primary }]}>ⓘ How is this calculated?</Text>
        </TouchableOpacity>
      )}
      <HUExplainerSheet visible={explainerVisible} onClose={() => setExplainerVisible(false)} />
    </ModalContainer>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { maxHeight: 400 },
  errorBanner: {
    backgroundColor: c.semantic.warningSubtle,
    padding: spacing[3],
    borderRadius: 6,
    marginBottom: spacing[3],
  },
  errorText: {
    color: c.semantic.warning,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  empty: {
    color: c.text.muted,
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
    color: c.text.onAccent,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  setsText: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  landmarkText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    marginBottom: spacing[4],
  },
  exerciseBlock: {
    marginBottom: spacing[3],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
    paddingTop: spacing[3],
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  exerciseName: {
    color: c.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  exerciseSets: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: spacing[3],
    marginBottom: 2,
  },
  setDetail: { color: c.text.secondary, fontSize: typography.size.xs },
  setEffort: { color: c.text.muted, fontSize: typography.size.xs },
  coeffBadge: { color: c.text.muted, fontSize: typography.size.xs, fontWeight: typography.weight.regular },
  explainerLink: { paddingVertical: spacing[3], alignItems: 'center' },
  explainerText: { color: c.accent.primary, fontSize: typography.size.sm },
});
