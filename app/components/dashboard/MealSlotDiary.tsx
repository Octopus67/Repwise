import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  groupEntriesBySlot,
  computeSlotTotals,
  NutritionEntry,
  MealSlotName,
} from '../../utils/mealSlotLogic';
import { MealSlotGroup } from './MealSlotGroup';

interface MealSlotDiaryProps {
  entries: NutritionEntry[];
  onAddToSlot: (slotName: MealSlotName) => void;
}

export function MealSlotDiary({ entries, onAddToSlot }: MealSlotDiaryProps) {
  const slots = groupEntriesBySlot(entries);
  const dailyTotals = computeSlotTotals(entries);

  return (
    <View style={styles.container}>
      {/* Daily total header */}
      <View style={styles.totalHeader}>
        <Text style={styles.totalLabel}>Daily Total</Text>
        <Text style={styles.totalValue}>
          {Math.round(dailyTotals.calories)} kcal
          {'  '}
          <Text style={styles.totalMacros}>
            P {Math.round(dailyTotals.protein_g)}g · C {Math.round(dailyTotals.carbs_g)}g · F {Math.round(dailyTotals.fat_g)}g
          </Text>
        </Text>
      </View>

      {/* Meal slot groups */}
      {slots.map((slot) => (
        <MealSlotGroup key={slot.name} slot={slot} onAddToSlot={onAddToSlot} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  totalLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  totalMacros: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.regular,
  },
});
