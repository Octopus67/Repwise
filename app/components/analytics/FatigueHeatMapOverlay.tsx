import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
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
  scores: FatigueScore[];
  onMuscleGroupPress: (muscleGroup: string) => void;
}

export function FatigueHeatMapOverlay({ scores, onMuscleGroupPress }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  if (!scores || scores.length === 0) return null;

  const sorted = [...scores].sort((a, b) => b.score - a.score);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {sorted.map((s) => {
          const bg = getFatigueColor(s.score);
          const label = getFatigueLabel(s.score);
          return (
            <TouchableOpacity
              key={s.muscle_group}
              style={[styles.cell, { borderColor: bg }]}
              onPress={() => onMuscleGroupPress(s.muscle_group)}
              activeOpacity={0.7}
            >
              <View style={[styles.dot, { backgroundColor: bg }]} />
              <Text style={[styles.name, { color: c.text.primary }]}>{s.muscle_group}</Text>
              <Text style={[styles.score, { color: bg }]}>{s.score.toFixed(0)}</Text>
              <Text style={[styles.label, { color: c.text.muted }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { marginTop: spacing[2] },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  cell: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[2],
    borderWidth: 1,
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: spacing[1],
  },
  name: {
    color: c.text.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  score: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  label: {
    color: c.text.muted,
    fontSize: 10,
  },
});
