import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, shadows } from '../../theme/tokens';

interface StickyFinishBarProps {
  exerciseCount: number;
  setCount: number;
  durationFormatted: string;
  onFinish: () => void;
  loading: boolean;
}

export function StickyFinishBar({
  exerciseCount,
  setCount,
  durationFormatted,
  onFinish,
  loading,
}: StickyFinishBarProps) {
  const summaryText = `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} · ${setCount} set${setCount !== 1 ? 's' : ''} · ${durationFormatted}`;

  return (
    <View style={styles.container}>
      <Text style={styles.summary} numberOfLines={1} accessibilityRole="text" accessibilityLabel={summaryText}>{summaryText}</Text>
      <TouchableOpacity
        style={[styles.finishBtn, loading && styles.finishBtnDisabled]}
        onPress={onFinish}
        disabled={loading}
        accessibilityLabel="Finish Workout"
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <Text style={styles.finishText}>
          {loading ? 'Saving…' : 'Finish Workout'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: colors.bg.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    ...shadows.md,
  },
  summary: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  finishBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  finishBtnDisabled: {
    opacity: 0.5,
  },
  finishText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
});
