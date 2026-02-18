import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ProgressRing } from '../common/ProgressRing';
import { colors, spacing } from '../../theme/tokens';

interface MacroValue {
  value: number;
  target: number;
}

interface MacroRingsRowProps {
  calories: MacroValue;
  protein: MacroValue;
  carbs: MacroValue;
  fat: MacroValue;
  onTargetMissing?: () => void;
}

const ZERO: MacroValue = { value: 0, target: 0 };

export function MacroRingsRow({ calories, protein, carbs, fat, onTargetMissing }: MacroRingsRowProps) {
  const c = calories ?? ZERO;
  const p = protein ?? ZERO;
  const cb = carbs ?? ZERO;
  const f = fat ?? ZERO;

  return (
    <View style={styles.container} testID="macro-rings-row">
      <ProgressRing
        value={c.value ?? 0}
        target={c.target ?? 0}
        color={colors.macro.calories}
        trackColor={colors.macro.caloriesSubtle}
        label="kcal"
        onTargetMissing={onTargetMissing}
      />
      <ProgressRing
        value={p.value ?? 0}
        target={p.target ?? 0}
        color={colors.macro.protein}
        trackColor={colors.macro.proteinSubtle}
        label="Protein"
        onTargetMissing={onTargetMissing}
      />
      <ProgressRing
        value={cb.value ?? 0}
        target={cb.target ?? 0}
        color={colors.macro.carbs}
        trackColor={colors.macro.carbsSubtle}
        label="Carbs"
        onTargetMissing={onTargetMissing}
      />
      <ProgressRing
        value={f.value ?? 0}
        target={f.target ?? 0}
        color={colors.macro.fat}
        trackColor={colors.macro.fatSubtle}
        label="Fat"
        onTargetMissing={onTargetMissing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'center',
  },
});
