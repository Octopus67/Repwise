import { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Switch, ScrollView, StyleSheet } from 'react-native';
import { ActiveExercise } from '../../types/training';
import { computeWorkoutSummary, formatMiniSummary } from '../../utils/workoutSummaryFormatter';
import { calculateSetProgress } from '../../utils/setProgressCalculator';
import { colors, radius, spacing, typography } from '../../theme/tokens';

interface ConfirmationSheetProps {
  visible: boolean;
  exercises: ActiveExercise[];
  startedAt: string;
  notes: string;
  unitSystem: 'metric' | 'imperial';
  onConfirm: (saveAsTemplate: boolean) => void;
  onCancel: () => void;
}

export const ConfirmationSheet = ({
  visible,
  exercises,
  startedAt,
  notes,
  unitSystem,
  onConfirm,
  onCancel,
}: ConfirmationSheetProps) => {
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  // Reset toggle state whenever the sheet is opened
  useEffect(() => {
    if (visible) {
      setSaveAsTemplate(false);
    }
  }, [visible]);

  const summary = computeWorkoutSummary(exercises, startedAt);
  const durationMin = Math.floor(summary.durationSeconds / 60);

  const volumeDisplay =
    unitSystem === 'imperial'
      ? `${Math.round(summary.totalVolumeKg * 2.205)} lbs`
      : `${Math.round(summary.totalVolumeKg)} kg`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.header}>Workout Summary</Text>

          <ScrollView style={styles.exerciseList}>
            {exercises.map((ex, i) => {
              const progress = calculateSetProgress(ex.sets);
              const skipped = ex.skipped === true;
              return (
                <View key={i} style={styles.exerciseRow}>
                  <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
                  {skipped ? (
                    <Text style={styles.skippedText}>Skipped</Text>
                  ) : (
                    <Text style={styles.setProgress}>
                      {progress.completed}/{progress.total} sets
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.statsRow}>
            <Text style={styles.statText}>{volumeDisplay}</Text>
            <Text style={styles.statDivider}>|</Text>
            <Text style={styles.statText}>{durationMin} min</Text>
          </View>

          <View style={styles.templateRow}>
            <Text style={styles.templateLabel}>Save as Template</Text>
            <Switch value={saveAsTemplate} onValueChange={setSaveAsTemplate} />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => onConfirm(saveAsTemplate)}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.surfaceRaised,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[6],
    maxHeight: '80%',
  },
  header: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  exerciseList: {
    marginBottom: spacing[4],
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    flex: 1,
  },
  setProgress: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  skippedText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[4],
    gap: spacing[3],
  },
  statText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  statDivider: {
    color: colors.text.muted,
    fontSize: typography.size.md,
  },
  templateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  templateLabel: {
    color: colors.text.primary,
    fontSize: typography.size.md,
  },
  saveButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[3],
  },
  saveButtonText: {
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.md,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  cancelText: {
    color: colors.text.muted,
    fontSize: typography.size.md,
  },
});
