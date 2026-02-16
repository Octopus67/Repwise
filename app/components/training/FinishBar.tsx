import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatMiniSummary } from '../../utils/workoutSummaryFormatter';
import { colors, radius, spacing, typography } from '../../theme/tokens';

interface FinishBarProps {
  exerciseCount: number;
  completedSetCount: number;
  elapsedSeconds: number;
  saving: boolean;
  isEditMode: boolean;
  onFinish: () => void;
}

export const FinishBar = ({
  exerciseCount,
  completedSetCount,
  elapsedSeconds,
  saving,
  isEditMode,
  onFinish,
}: FinishBarProps) => {
  const summary = formatMiniSummary({
    exerciseCount,
    completedSetCount,
    totalVolumeKg: 0,
    durationSeconds: elapsedSeconds,
  });

  const buttonText = saving
    ? 'Saving...'
    : isEditMode
      ? 'Save Changes'
      : 'Finish Workout';

  return (
    <View style={styles.container}>
      <Text style={styles.summaryText}>{summary}</Text>
      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={onFinish}
        disabled={saving}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 72,
    backgroundColor: colors.bg.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingHorizontal: spacing[4],
    justifyContent: 'center',
  },
  summaryText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginBottom: spacing[1],
  },
  button: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.md,
  },
});
