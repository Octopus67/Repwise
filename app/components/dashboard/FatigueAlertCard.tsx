import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { getFatigueColor } from '../../utils/fatigueColorMapping';
import { Icon } from '../common/Icon';

interface DeloadSuggestion {
  muscle_group: string;
  fatigue_score: number;
  top_regressed_exercise: string;
  decline_pct: number;
  decline_sessions: number;
  message: string;
}

interface Props {
  suggestions: DeloadSuggestion[];
  onPress: () => void;
}

export function FatigueAlertCard({ suggestions, onPress }: Props) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;

  // Filter out malformed entries before sorting
  const valid = suggestions.filter(
    (s) =>
      s &&
      typeof s.fatigue_score === 'number' &&
      !Number.isNaN(s.fatigue_score) &&
      typeof s.muscle_group === 'string',
  );
  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => b.fatigue_score - a.fatigue_score);
  const top = sorted[0];
  const borderColor = getFatigueColor(top.fatigue_score);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: borderColor }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Fatigue alert for ${top.muscle_group}`}
      testID="fatigue-alert-card"
    >
      <View style={styles.header}>
        <Icon name="alert-triangle" size={16} color={borderColor} />
        <Text style={styles.title}>Fatigue Alert</Text>
      </View>
      <Text style={styles.muscle}>{top.muscle_group}</Text>
      <Text style={styles.message} numberOfLines={2}>
        {top.message || 'Consider reducing volume for this muscle group.'}
      </Text>
      {valid.length > 1 && (
        <Text style={styles.more}>+{valid.length - 1} more muscle groups</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[3],
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  muscle: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    textTransform: 'capitalize',
    marginBottom: spacing[1],
  },
  message: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  more: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
  },
});
