import { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { generateWarmUpSets, WarmUpSet } from '../../utils/warmUpGenerator';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

interface WarmUpSuggestionProps {
  workingWeightKg: number;
  barWeightKg: number;
  onGenerate: (sets: WarmUpSet[]) => void;
  previousBestWeight?: number;
}

export function WarmUpSuggestion({ workingWeightKg, barWeightKg, onGenerate, previousBestWeight }: WarmUpSuggestionProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [generated, setGenerated] = useState(false);
  const { enabled: predictiveEnabled } = useFeatureFlag('predictive_warmup');

  // Reset generated state when exercise changes (weight or previous best changes)
  useEffect(() => { setGenerated(false); }, [previousBestWeight, workingWeightKg]);

  if (generated) return null;

  const hasWorkingWeight = workingWeightKg > barWeightKg;
  const hasPredictive = predictiveEnabled && !hasWorkingWeight && previousBestWeight != null && previousBestWeight > barWeightKg;

  if (!hasWorkingWeight && !hasPredictive) return null;

  const handlePress = () => {
    const sets = hasWorkingWeight
      ? generateWarmUpSets(workingWeightKg, barWeightKg)
      : generateWarmUpSets(undefined, { previousBestWeight, barWeightKg });
    onGenerate(sets);
    setGenerated(true);
  };

  const label = hasWorkingWeight ? 'Generate Warm-Up →' : 'Generate Warm-Up (based on last session) →';

  return (
    <TouchableOpacity onPress={handlePress} style={styles.button} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.text, { color: c.accent.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  button: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: c.accent.primary,
  },
});
