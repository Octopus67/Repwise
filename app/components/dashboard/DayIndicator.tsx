import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { Icon } from '../common/Icon';

interface DayIndicatorProps {
  dayClassification: string | null;
  explanation: string | null;
  isOverride: boolean;
  isLoading?: boolean;
}

export function DayIndicator({
  dayClassification,
  explanation,
  isOverride,
  isLoading,
}: DayIndicatorProps) {
  if (isLoading || !dayClassification) return null;

  const isTraining = dayClassification === 'training' || dayClassification === 'training_day';
  const label = isTraining ? 'Training Day' : 'Rest Day';
  const pillColor = isTraining ? colors.accent.primary : colors.text.muted;

  return (
    <View style={styles.container}>
      <View style={[styles.pill, { borderColor: pillColor }]}>
        <View style={[styles.dot, { backgroundColor: pillColor }]} />
        <Text style={[styles.label, { color: pillColor }]}>{label}</Text>
        {isOverride && (
          <Icon name="edit" size={12} color={colors.semantic.warning} />
        )}
      </View>
      {explanation ? (
        <Text style={styles.explanation} numberOfLines={1}>
          {explanation}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: spacing[2],
    gap: spacing[1],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    gap: spacing[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  explanation: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
});
