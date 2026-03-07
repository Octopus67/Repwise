import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius, shadows } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TemplateRowProps {
  name: string;
  exerciseCount: number;
  onStart: () => void;
}

export function TemplateRow({ name, exerciseCount, onStart }: TemplateRowProps) {
  const c = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
      <View style={styles.content}>
        <Text style={[styles.name, { color: c.text.primary }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.badge, { color: c.text.secondary }]}>
          {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
        </Text>
      </View>
      <TouchableOpacity style={[styles.startButton, { backgroundColor: c.accent.primary }]} onPress={onStart} activeOpacity={0.8}>
        <Text style={[styles.startText, { color: c.text.inverse }]}>Start</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  name: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  badge: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
  },
  startButton: {
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    marginLeft: spacing[3],
    ...shadows.sm,
  },
  startText: {
    color: colors.text.inverse,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
