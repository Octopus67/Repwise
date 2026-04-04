import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import {
  groupEntriesBySlot,
  NutritionEntry,
  MealSlotName,
} from '../../utils/mealSlotLogic';
import { MealSlotGroup } from './MealSlotGroup';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';

interface MealSlotDiaryProps {
  entries: NutritionEntry[];
  onAddToSlot: (slotName: MealSlotName) => void;
}

function MealSlotWrapper({ index, children }: { index: number; children: React.ReactNode }) {
  const style = useStaggeredEntrance(index, 60);
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function MealSlotDiary({ entries, onAddToSlot }: MealSlotDiaryProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const slots = groupEntriesBySlot(entries);
  const dailyTotals = slots.reduce(
    (acc, slot) => ({
      calories: acc.calories + slot.totals.calories,
      protein_g: acc.protein_g + slot.totals.protein_g,
      carbs_g: acc.carbs_g + slot.totals.carbs_g,
      fat_g: acc.fat_g + slot.totals.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return (
    <View style={styles.container}>
      {/* Daily total header */}
      <View style={[styles.totalHeader, { borderBottomColor: c.border.subtle }]}>
        <Text style={[styles.totalLabel, { color: c.text.primary }]}>Daily Total</Text>
        <Text style={[styles.totalValue, { color: c.text.primary }]}>
          {Math.round(dailyTotals.calories)} kcal
          {'  '}
          <Text style={[styles.totalMacros, { color: c.text.secondary }]}>
            P {Math.round(dailyTotals.protein_g)}g · C {Math.round(dailyTotals.carbs_g)}g · F {Math.round(dailyTotals.fat_g)}g
          </Text>
        </Text>
      </View>

      {/* Meal slot groups */}
      {slots.map((slot, idx) => (
        <MealSlotWrapper key={slot.name} index={idx}>
          <MealSlotGroup slot={slot} onAddToSlot={onAddToSlot} />
        </MealSlotWrapper>
      ))}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
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
    borderBottomColor: c.border.subtle,
  },
  totalLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: c.text.primary,
  },
  totalValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
  },
  totalMacros: {
    fontSize: typography.size.xs,
    color: c.text.secondary,
    fontWeight: typography.weight.regular,
  },
});
