import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import {
  computeRemaining,
  computeProgressRatio,
  getOverTargetColor,
  MacroValues,
} from '../../utils/budgetComputation';

interface BudgetBarProps {
  consumed: MacroValues;
  targets: MacroValues;
}

export function BudgetBar({ consumed, targets }: BudgetBarProps) {
  const safeConsumed: MacroValues = {
    calories: Number.isFinite(consumed?.calories) ? consumed.calories : 0,
    protein_g: Number.isFinite(consumed?.protein_g) ? consumed.protein_g : 0,
    carbs_g: Number.isFinite(consumed?.carbs_g) ? consumed.carbs_g : 0,
    fat_g: Number.isFinite(consumed?.fat_g) ? consumed.fat_g : 0,
  };

  // No targets set
  if (!targets || targets.calories <= 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noTargetsText}>Set targets in profile</Text>
      </View>
    );
  }

  const remaining = computeRemaining(targets, safeConsumed);
  const progressRatio = computeProgressRatio(safeConsumed.calories, targets.calories);
  const isOver = remaining.calories < 0;
  const calorieColor = getOverTargetColor(safeConsumed.calories, targets.calories, colors.text.primary);

  return (
    <View style={styles.container}>
      {/* Remaining calories */}
      <View style={styles.calorieRow}>
        <Text style={[styles.calorieNumber, { color: calorieColor }]}>
          {Math.round(remaining.calories)}
        </Text>
        <Text style={styles.calorieLabel}>
          {isOver ? 'kcal over' : 'kcal remaining'}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progressRatio * 100}%`,
              backgroundColor: isOver ? colors.semantic.overTarget : colors.accent.primary,
            },
          ]}
        />
      </View>

      {/* Macro breakdown */}
      <View style={styles.macroRow}>
        <MacroChip label="Protein" value={remaining.protein_g} unit="g" consumed={safeConsumed.protein_g} target={targets.protein_g} />
        <MacroChip label="Carbs" value={remaining.carbs_g} unit="g" consumed={safeConsumed.carbs_g} target={targets.carbs_g} />
        <MacroChip label="Fat" value={remaining.fat_g} unit="g" consumed={safeConsumed.fat_g} target={targets.fat_g} />
      </View>
    </View>
  );
}

function MacroChip({ label, value, unit, consumed, target }: {
  label: string;
  value: number;
  unit: string;
  consumed: number;
  target: number;
}) {
  const chipColor = getOverTargetColor(consumed, target, colors.text.secondary);
  return (
    <View style={styles.macroChip}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={[styles.macroValue, { color: chipColor }]}>
        {Math.round(value)}{unit}
      </Text>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  calorieNumber: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight['2xl'],
  },
  calorieLabel: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.sm,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroChip: {
    alignItems: 'center',
    flex: 1,
  },
  macroLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    lineHeight: typography.lineHeight.xs,
    marginBottom: spacing[0.5],
  },
  macroValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
  noTargetsText: {
    fontSize: typography.size.base,
    color: colors.text.muted,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    paddingVertical: spacing[2],
  },
});
