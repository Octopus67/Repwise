import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { ProgressRing } from '../common/ProgressRing';
import { colors, spacing } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';

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

function StaggeredRing({ index, children }: { index: number; children: React.ReactNode }) {
  const style = useStaggeredEntrance(index, 100);
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function MacroRingsRow({ calories, protein, carbs, fat, onTargetMissing }: MacroRingsRowProps) {
  const tc = useThemeColors();
  const cal = calories ?? ZERO;
  const p = protein ?? ZERO;
  const cb = carbs ?? ZERO;
  const f = fat ?? ZERO;

  return (
    <View style={styles.container} testID="macro-rings-row">
      <StaggeredRing index={0}>
        <ProgressRing
          value={cal.value ?? 0}
          target={cal.target ?? 0}
          color={tc.macro.calories}
          trackColor={tc.macro.caloriesSubtle}
          label="kcal"
          gradientColors={colors.gradientArrays.calories as [string, string]}
          onTargetMissing={onTargetMissing}
        />
      </StaggeredRing>
      <StaggeredRing index={1}>
        <ProgressRing
          value={p.value ?? 0}
          target={p.target ?? 0}
          color={tc.macro.protein}
          trackColor={tc.macro.proteinSubtle}
          label="Protein"
          gradientColors={colors.gradientArrays.protein as [string, string]}
          onTargetMissing={onTargetMissing}
        />
      </StaggeredRing>
      <StaggeredRing index={2}>
        <ProgressRing
          value={cb.value ?? 0}
          target={cb.target ?? 0}
          color={tc.macro.carbs}
          trackColor={tc.macro.carbsSubtle}
          label="Carbs"
          gradientColors={colors.gradientArrays.carbs as [string, string]}
          onTargetMissing={onTargetMissing}
        />
      </StaggeredRing>
      <StaggeredRing index={3}>
        <ProgressRing
          value={f.value ?? 0}
          target={f.target ?? 0}
          color={tc.macro.fat}
          trackColor={tc.macro.fatSubtle}
          label="Fat"
          gradientColors={colors.gradientArrays.fat as [string, string]}
          onTargetMissing={onTargetMissing}
        />
      </StaggeredRing>
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
