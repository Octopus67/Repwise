import { View, Text, StyleSheet } from 'react-native';
import { SetType } from '../../types/training';
import { colors, radius, typography } from '../../theme/tokens';

interface TypeBadgeProps {
  setType: SetType;
}

const labelMap: Record<string, string> = {
  'warm-up': 'W',
  'drop-set': 'D',
  'amrap': 'A',
};

export function TypeBadge({ setType }: TypeBadgeProps) {
  const label = labelMap[setType];
  if (!label) return null;

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.accent.primary,
  },
});
