import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface GoalProgressPillProps {
  goalType: string;
  targetCalories: number;
}

export default function GoalProgressPill({ goalType, targetCalories }: GoalProgressPillProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const getGoalLabel = (type: string) => {
    switch (type) {
      case 'cutting': return 'Cutting';
      case 'bulking': return 'Bulking';
      case 'maintaining': return 'Maintaining';
      case 'recomposition': return 'Recomp';
      default: return 'Goal';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
      <Text style={[styles.text, { color: c.text.secondary }]}>
        {getGoalLabel(goalType)} · {targetCalories} cal
      </Text>
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: c.text.secondary,
    lineHeight: typography.lineHeight.sm,
  },
});