import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { getFatigueColor, getFatigueLabel } from '../../utils/fatigueColorMapping';
import type { FatigueScore } from '../../types/analytics';

interface Props {
  visible: boolean;
  score: FatigueScore | null;
  onClose: () => void;
}

function BarRow({ label, value }: { label: string; value: number }) {
  const c = useThemeColors();
  const pct = Math.min(value * 100, 100);
  return (
    <View style={getStyles().barRow}>
      <Text style={[getStyles().barLabel, { color: c.text.secondary }]}>{label}</Text>
      <View style={[getStyles().barTrack, { backgroundColor: c.bg.surfaceRaised }]}>
        <View style={[getStyles().barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={[getStyles().barValue, { color: c.text.secondary }]}>{(value * 100).toFixed(0)}%</Text>
    </View>
  );
}

export function FatigueBreakdownModal({ visible, score, onClose }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  if (!score) return null;

  const color = getFatigueColor(score.score);
  const label = getFatigueLabel(score.score);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={getStyles().overlay}>
        <View style={[getStyles().sheet, { backgroundColor: c.bg.surface }]}>
          <View style={getStyles().header}>
            <Text style={[getStyles().title, { color: c.text.primary }]}>{score.muscle_group}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[getStyles().close, { color: c.text.muted }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={getStyles().scoreRow}>
            <Text style={[getStyles().scoreValue, { color }]}>{score.score.toFixed(0)}</Text>
            <Text style={[getStyles().scoreLabel, { color }]}>{label} Fatigue</Text>
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

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: c.bg.surface,
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
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textTransform: 'capitalize',
  },
  close: { color: c.text.muted, fontSize: 20 },
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
    color: c.text.secondary,
    fontSize: typography.size.sm,
    width: 80,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: c.accent.primary,
    borderRadius: radius.full,
  },
  barValue: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    width: 40,
    textAlign: 'right',
  },
});
