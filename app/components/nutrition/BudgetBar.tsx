import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const safeConsumed: MacroValues = {
    calories: Number.isFinite(consumed?.calories) ? consumed.calories : 0,
    protein_g: Number.isFinite(consumed?.protein_g) ? consumed.protein_g : 0,
    carbs_g: Number.isFinite(consumed?.carbs_g) ? consumed.carbs_g : 0,
    fat_g: Number.isFinite(consumed?.fat_g) ? consumed.fat_g : 0,
  };

  // No targets set
  if (!targets || targets.calories <= 0) {
    return (
      <View style={[getStyles().container, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
        <Text style={[getStyles().noTargetsText, { color: c.text.muted }]}>Set targets in profile</Text>
      </View>
    );
  }

  const remaining = computeRemaining(targets, safeConsumed);
  const progressRatio = computeProgressRatio(safeConsumed.calories, targets.calories);
  const isOver = remaining.calories < 0;
  const calorieColor = getOverTargetColor(safeConsumed.calories, targets.calories, c.text.primary);

  return (
    <View style={[getStyles().container, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
      {/* Remaining calories */}
      <View style={getStyles().calorieRow}>
        <Text style={[getStyles().calorieNumber, { color: calorieColor }]}>
          {Math.abs(Math.round(remaining.calories))}
        </Text>
        <Text style={[getStyles().calorieLabel, { color: c.text.secondary }]}>
          {isOver ? 'kcal over' : 'kcal remaining'}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[getStyles().progressTrack, { backgroundColor: c.bg.surfaceRaised }]}>
        <View
          style={[
            getStyles().progressFill,
            {
              width: `${progressRatio * 100}%`,
              backgroundColor: isOver ? c.semantic.overTarget : c.accent.primary,
            },
          ]}
        />
      </View>

      {/* Macro breakdown */}
      <View style={getStyles().macroRow}>
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
  const c = useThemeColors();
  const chipColor = getOverTargetColor(consumed, target, c.text.secondary);
  const isOver = value < 0;
  return (
    <View style={getStyles().macroChip}>
      <Text style={[getStyles().macroLabel, { color: c.text.muted }]}>{label}</Text>
      <Text style={[getStyles().macroValue, { color: chipColor }]}>
        {Math.abs(Math.round(value))}{unit}{isOver ? ' over' : ''}
      </Text>
    </View>
  );
}


/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
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
    color: c.text.secondary,
    lineHeight: typography.lineHeight.sm,
  },
  progressTrack: {
    height: 6,
    backgroundColor: c.bg.surfaceRaised,
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
    color: c.text.muted,
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
    color: c.text.muted,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    paddingVertical: spacing[2],
  },
});
