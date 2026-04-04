import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';

const RECOVERY_TIPS = [
  'Focus on stretching and mobility work today.',
  'Aim for 7-9 hours of quality sleep tonight.',
  'Stay hydrated — drink at least 2-3L of water.',
  'Try a 15-minute walk to promote active recovery.',
  'Foam roll any tight muscle groups from recent sessions.',
  'Take a contrast shower to boost circulation.',
  'Practice deep breathing or meditation for 10 minutes.',
];

interface RestDayCardProps {
  proteinTarget?: number;
}

function RestDayCardComponent({ proteinTarget }: RestDayCardProps) {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const tip = RECOVERY_TIPS[new Date().getDay()];

  return (
    <Card variant="flat" style={s.card}>
      <View style={s.header}>
        <Icon name="moon" size={16} color={c.accent.primary} />
        <Text style={s.title}>Rest Day</Text>
      </View>
      {proteinTarget != null && proteinTarget > 0 && (
        <Text style={s.protein}>Make sure you hit {proteinTarget}g protein today</Text>
      )}
      <Text style={s.tip}>{tip}</Text>
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: { marginBottom: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  title: { color: c.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.md },
  protein: { color: c.text.secondary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, marginBottom: spacing[2] },
  tip: { color: c.text.muted, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontStyle: 'italic' },
});

export const RestDayCard = React.memo(RestDayCardComponent);
