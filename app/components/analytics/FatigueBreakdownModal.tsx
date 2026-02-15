import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { getFatigueColor, getFatigueLabel } from '../../utils/fatigueColorMapping';

interface FatigueScore {
  muscle_group: string;
  score: number;
  regression_component: number;
  volume_component: number;
  frequency_component: number;
  nutrition_component: number;
}

interface Props {
  visible: boolean;
  score: FatigueScore | null;
  onClose: () => void;
}

function BarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.min(value * 100, 100);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.barValue}>{(value * 100).toFixed(0)}%</Text>
    </View>
  );
}

export function FatigueBreakdownModal({ visible, score, onClose }: Props) {
  if (!score) return null;

  const color = getFatigueColor(score.score);
  const label = getFatigueLabel(score.score);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{score.muscle_group}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color }]}>{score.score.toFixed(0)}</Text>
            <Text style={[styles.scoreLabel, { color }]}>{label} Fatigue</Text>
          </View>
          <BarRow label="Regression" value={score.regression_component} />
          <BarRow label="Volume" value={score.volume_component} />
          <BarRow label="Frequency" value={score.frequency_component} />
          <BarRow label="Nutrition" value={score.nutrition_component} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textTransform: 'capitalize',
  },
  close: { color: colors.text.muted, fontSize: 20 },
  scoreRow: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  scoreValue: {
    fontSize: 40,
    fontWeight: typography.weight.bold,
  },
  scoreLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  barLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    width: 80,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: radius.full,
  },
  barValue: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    width: 40,
    textAlign: 'right',
  },
});
