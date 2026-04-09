import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon, type IconName } from '../common/Icon';
import { ProgressBar } from '../common/ProgressBar';
import type { Challenge } from '../../hooks/useDashboardData';

interface Props {
  challenges: Challenge[];
}

const ICONS: Record<string, IconName> = {
  training_volume: 'dumbbell',
  workout_count: 'muscle',
  nutrition_compliance: 'salad',
};

const DEFAULT_ICON: IconName = 'target';

export function WeeklyChallengeCard({ challenges }: Props) {
  const c = useThemeColors();
  const s = getThemedStyles(c);

  if (challenges.length === 0) return null;

  return (
    <View style={s.card} accessibilityRole="summary" accessibilityLabel="This week's challenges">
      <Text style={[s.header, { color: c.text.primary }]}>This Week's Challenges</Text>
      {challenges.map((ch) => (
        <View key={ch.id} style={s.row}>
          <View style={s.rowHeader}>
            <Icon name={ICONS[ch.challenge_type] ?? DEFAULT_ICON} size={16} color={c.accent.primary} />
            <Text style={[s.title, { color: c.text.primary }]} numberOfLines={1}>{ch.title}</Text>
            {ch.completed && <Icon name="check" size={14} color={c.semantic.positive} />}
          </View>
          <ProgressBar
            value={ch.current_value}
            target={ch.target_value}
            color={ch.completed ? c.semantic.positive : c.accent.primary}
            trackColor={c.bg.surfaceRaised}
            height={6}
          />
        </View>
      ))}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  header: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  row: { marginBottom: spacing[2] },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4 },
  icon: { fontSize: 16 },
  title: { flex: 1, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  check: { fontSize: 14 },
});
