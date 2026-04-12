import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, shadows } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface StickyFinishBarProps {
  exerciseCount: number;
  setCount: number;
  durationFormatted: string;
  onFinish: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function StickyFinishBar({
  exerciseCount,
  setCount,
  durationFormatted,
  onFinish,
  loading,
  disabled,
}: StickyFinishBarProps) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = getThemedStyles(c);
  const summaryText = `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} · ${setCount} set${setCount !== 1 ? 's' : ''} · ${durationFormatted}`;

  return (
    <View style={[styles.container, { backgroundColor: c.bg.surfaceRaised, borderTopColor: c.border.default, paddingBottom: insets.bottom }]}>
      <Text style={[styles.summary, { color: c.text.secondary }]} numberOfLines={1} accessibilityRole="text" accessibilityLabel={summaryText}>{summaryText}</Text>
      <TouchableOpacity
        style={[styles.finishBtn, loading && styles.finishBtnDisabled]}
        onPress={onFinish}
        disabled={loading || disabled}
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

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: c.bg.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: c.border.default,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    ...shadows.md,
  },
  summary: {
    flex: 1,
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  finishBtn: {
    backgroundColor: c.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  finishBtnDisabled: {
    opacity: 0.5,
  },
  finishText: {
    color: '#FFFFFF',
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
});
