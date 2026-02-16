import { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { generateWarmUpSets, WarmUpSet } from '../../utils/warmUpGenerator';
import { colors, spacing, typography } from '../../theme/tokens';

interface WarmUpSuggestionProps {
  workingWeightKg: number;
  barWeightKg: number;
  onGenerate: (sets: WarmUpSet[]) => void;
}

export function WarmUpSuggestion({ workingWeightKg, barWeightKg, onGenerate }: WarmUpSuggestionProps) {
  const [generated, setGenerated] = useState(false);

  if (generated || workingWeightKg <= barWeightKg) return null;

  const handlePress = () => {
    const sets = generateWarmUpSets(workingWeightKg, barWeightKg);
    onGenerate(sets);
    setGenerated(true);
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.button}>
      <Text style={styles.text}>Generate Warm-Up →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.accent.primary,
  },
});
