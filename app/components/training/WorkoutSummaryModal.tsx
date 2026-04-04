/**
 * WorkoutSummaryModal — Post-workout summary with HU breakdown and recommendations.
 *
 * Shown after ending a workout. Displays HU by muscle group, volume status,
 * and actionable recommendations from the WNS engine.
 *
 * Requirements: Feature 6, Step 12
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { getVolumeStatus, type VolumeLandmarks, type VolumeStatus } from '../../utils/wnsRecommendations';
import { formatMuscle } from '../../utils/formatting';

export interface WorkoutSummaryModalProps {
  visible: boolean;
  durationFormatted: string;
  totalSets: number;
  huByMuscle: Record<string, number>;
  landmarksByMuscle?: Record<string, VolumeLandmarks>;
  recommendations: string[];
  onClose: () => void;
  onShowExplainer?: () => void;
}

const STATUS_LABEL: Record<VolumeStatus, { label: string; emoji: string }> = {
  below_mev: { label: 'Below threshold', emoji: '⚠️' },
  optimal: { label: 'Optimal', emoji: '✅' },
  approaching_mrv: { label: 'Near limit', emoji: '🟠' },
  above_mrv: { label: 'Over limit', emoji: '🔴' },
};

function useVolumeStatusColors(): Record<VolumeStatus, string> {
  const c = useThemeColors();
  return {
    below_mev: c.semantic.warning,
    optimal: c.semantic.positive,
    approaching_mrv: c.semantic.caution,
    above_mrv: c.semantic.negative,
  };
}

export function WorkoutSummaryModal({
  visible,
  durationFormatted,
  totalSets,
  huByMuscle,
  landmarksByMuscle,
  recommendations,
  onClose,
  onShowExplainer,
}: WorkoutSummaryModalProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const STATUS_COLORS = useVolumeStatusColors();
  const muscleEntries = Object.entries(huByMuscle).filter(([, hu]) => hu > 0);
  const totalHU = muscleEntries.reduce((sum, [, hu]) => sum + hu, 0);

  return (
    <ModalContainer visible={visible} onClose={onClose} title="Workout Complete! 💪">
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: c.accent.primary }]}>{durationFormatted}</Text>
            <Text style={[styles.statLabel, { color: c.text.muted }]}>Duration</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: c.accent.primary }]}>{totalSets}</Text>
            <Text style={[styles.statLabel, { color: c.text.muted }]}>Sets</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: c.accent.primary }]}>{totalHU.toFixed(1)}</Text>
            <Text style={[styles.statLabel, { color: c.text.muted }]}>Total HU</Text>
          </View>
        </View>

        {/* HU by muscle */}
        {muscleEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Stimulus by Muscle</Text>
            {muscleEntries.map(([muscle, hu]) => {
              const lm = landmarksByMuscle?.[muscle];
              const status = lm ? getVolumeStatus(hu, lm) : 'optimal';
              const statusInfo = STATUS_LABEL[status];
              return (
                <View key={muscle} style={styles.muscleRow}>
                  <Text style={[styles.muscleName, { color: c.text.primary }]}>{formatMuscle(muscle)}</Text>
                  <View style={styles.muscleRight}>
                    <Text style={[styles.muscleHU, { color: STATUS_COLORS[status] }]}>
                      {hu.toFixed(1)} HU
                    </Text>
                    <Text style={styles.muscleStatus}>
                      {statusInfo.emoji} {statusInfo.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Recommendations</Text>
            {recommendations.map((rec, i) => (
              <Text key={i} style={[styles.recText, { color: c.text.secondary }]}>
                • {rec}
              </Text>
            ))}
          </View>
        )}

        {/* Why? link */}
        {onShowExplainer && (
          <TouchableOpacity
            onPress={onShowExplainer}
            style={styles.whyButton}
            accessibilityRole="button"
            accessibilityLabel="Learn about Hard Units"
          >
            <Text style={[styles.whyText, { color: c.accent.primary }]}>Why these numbers? →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.doneButton, { backgroundColor: c.accent.primary }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={[styles.doneText, { color: c.text.inverse }]}>Done</Text>
      </TouchableOpacity>
    </ModalContainer>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { maxHeight: 420 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
    backgroundColor: c.bg.surfaceRaised,
  },
  stat: { alignItems: 'center' },
  statValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginTop: spacing[0.5],
  },
  section: { marginBottom: spacing[4] },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  muscleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  muscleName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  muscleRight: { alignItems: 'flex-end' },
  muscleHU: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  muscleStatus: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  recText: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    marginBottom: spacing[1],
  },
  whyButton: {
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  whyText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  doneButton: {
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[4],
  },
  doneText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
