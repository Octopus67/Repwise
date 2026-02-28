import { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Modal, Pressable } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { WorkoutSummaryResult } from '../../utils/workoutSummary';
import type { PersonalRecordResponse } from '../../types/training';

interface FinishConfirmationSheetProps {
  visible: boolean;
  summary: WorkoutSummaryResult;
  prs: PersonalRecordResponse[];
  onConfirm: () => void;
  onSaveAsTemplate: () => void;
  onCancel: () => void;
}

export function FinishConfirmationSheet({
  visible,
  summary,
  prs,
  onConfirm,
  onSaveAsTemplate,
  onCancel,
}: FinishConfirmationSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return; // Modal handles visibility on web
    if (visible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1 && visible) {
        onCancel();
      }
    },
    [visible, onCancel],
  );

  const volumeDisplay = `${Math.round(summary.totalVolumeKg).toLocaleString()} kg`;

  // ── Shared content (used by both native bottom sheet and web modal) ──
  const sheetContent = (
    <>
      <Text style={styles.title}>Workout Summary</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.exerciseCount}</Text>
          <Text style={styles.statLabel}>Exercises</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.setCount}</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{volumeDisplay}</Text>
          <Text style={styles.statLabel}>Volume</Text>
        </View>
      </View>

      {/* PRs */}
      {prs.length > 0 && (
        <View style={styles.prSection}>
          <Text style={styles.prTitle}>🏆 Personal Records</Text>
          <ScrollView style={styles.prList} nestedScrollEnabled>
            {prs.map((pr, i) => (
              <Text key={`${pr.exercise_name}-${i}`} style={styles.prItem}>
                {pr.exercise_name}: {pr.new_weight_kg}kg × {pr.reps}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.templateBtn}
          onPress={onSaveAsTemplate}
          accessibilityLabel="Save as Template"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={styles.templateBtnText}>Save as Template</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={onConfirm}
          accessibilityLabel="Confirm and save workout"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={styles.confirmBtnText}>Confirm</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onCancel}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ── Web: use Modal overlay (bottom-sheet doesn't work on web) ──
  if (Platform.OS === 'web') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
      >
        <Pressable style={styles.webOverlay} onPress={onCancel}>
          <Pressable style={styles.webSheet} onPress={(e) => e.stopPropagation()}>
            {sheetContent}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── Native: use @gorhom/bottom-sheet ──
  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['55%']}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.content}>
        {sheetContent}
      </BottomSheetView>
    </BottomSheet>
  );
}


const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.bg.surfaceRaised,
  },
  handleIndicator: {
    backgroundColor: colors.text.muted,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.xl,
    marginBottom: spacing[4],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.lg,
  },
  statLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: 2,
  },
  prSection: {
    marginBottom: spacing[4],
  },
  prTitle: {
    color: colors.premium.gold,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
    marginBottom: spacing[2],
  },
  prList: {
    maxHeight: 100,
  },
  prItem: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[1],
  },
  actions: {
    gap: spacing[3],
    marginTop: 'auto' as unknown as number,
  },
  templateBtn: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  templateBtnText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  confirmBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  confirmBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  cancelBtn: {
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  webOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  webSheet: {
    backgroundColor: colors.bg.surfaceRaised,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    paddingBottom: spacing[6],
    maxHeight: '55%',
  },
});
