import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

interface MacroBudgetPillsProps {
  consumed: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}

export function MacroBudgetPills({ consumed, targets }: MacroBudgetPillsProps) {
  const c = useThemeColors();

  if (!targets || targets.calories <= 0) return null;

  const over = consumed.calories > targets.calories;

  return (
    <View style={[styles.row, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
      <Text style={[styles.cal, { color: over ? c.semantic.overTarget : c.accent.primary }]}>
        {Math.round(consumed.calories)}{' '}
        <Text style={[styles.dim, { color: c.text.muted }]}>/ {Math.round(targets.calories)} cal</Text>
      </Text>
      <View style={styles.macros}>
        <Text style={[styles.pill, { color: c.text.secondary }]}>{Math.round(consumed.protein_g)}g P</Text>
        <Text style={[styles.pill, { color: c.text.secondary }]}>{Math.round(consumed.carbs_g)}g C</Text>
        <Text style={[styles.pill, { color: c.text.secondary }]}>{Math.round(consumed.fat_g)}g F</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[3],
  },
  cal: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  dim: {
    fontWeight: typography.weight.regular,
  },
  macros: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  pill: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
