/**
 * ExerciseCardPremium — Exercise card for the premium workout logger.
 *
 * Renders exercise name (bold/large), progress dots, overload badge,
 * action menu, per-exercise notes, and SetRowPremium for each set.
 * Skipped state: opacity 0.4 with "SKIPPED" badge overlay.
 *
 * Requirements: 2.4, 4.1, 12.1, 13.1, 17.1, 17.2, 17.4, 17.5, 18.1
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Pressable,
} from 'react-native';
import type {
  ActiveExercise,
  PreviousPerformanceData,
  OverloadSuggestion,
  UnitSystem,
} from '../../types/training';
import { SetRowPremium } from './SetRowPremium';
import { OverloadBadge } from './OverloadBadge';
import { colors, typography, spacing, radius } from '../../theme/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExerciseCardPremiumProps {
  exercise: ActiveExercise;
  previousPerformance: PreviousPerformanceData | null;
  overloadSuggestion: OverloadSuggestion | null;
  unitSystem: UnitSystem;
  showRpeRir: boolean;
  rpeMode: 'rpe' | 'rir';
  onSwap: () => void;
  onSkip: () => void;
  onGenerateWarmUp: () => void;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setLocalId: string) => void;
  onReorder: () => void;
  onUpdateSetField: (
    setLocalId: string,
    field: 'weight' | 'reps' | 'rpe' | 'rir',
    value: string,
  ) => void;
  onToggleSetCompleted: (setLocalId: string) => void;
  onCopyPreviousToSet: (setLocalId: string) => void;
  onWeightStep: (setLocalId: string, direction: 'up' | 'down') => void;
  onApplyOverload?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ExerciseCardPremium: React.FC<ExerciseCardPremiumProps> = ({
  exercise,
  previousPerformance,
  overloadSuggestion,
  unitSystem,
  showRpeRir,
  rpeMode,
  onSwap,
  onSkip,
  onGenerateWarmUp,
  onRemove,
  onAddSet,
  onRemoveSet,
  onReorder,
  onUpdateSetField,
  onToggleSetCompleted,
  onCopyPreviousToSet,
  onWeightStep,
  onApplyOverload,
}) => {
  const [notesVisible, setNotesVisible] = useState(false);
  const [notesText, setNotesText] = useState(exercise.notes ?? '');
  const [menuVisible, setMenuVisible] = useState(false);

  // ── Callbacks declared before use (project rule: no temporal dead zone) ──

  const handleActionMenu = useCallback(() => {
    setMenuVisible((v) => !v);
  }, []);

  const handleMenuAction = useCallback((index: number) => {
    setMenuVisible(false);
    switch (index) {
      case 0: onSwap(); break;
      case 1: onSkip(); break;
      case 2: onGenerateWarmUp(); break;
      case 3: setNotesVisible((v) => !v); break;
      case 4: onRemove(); break;
    }
  }, [onSwap, onSkip, onGenerateWarmUp, onRemove]);

  const handleApplyOverload = useCallback(() => {
    onApplyOverload?.();
  }, [onApplyOverload]);

  // ── Derived state ──

  const completedCount = exercise.sets.filter((s) => s.completed).length;
  const totalCount = exercise.sets.length;
  const isSkipped = exercise.skipped === true;

  // ── Render ──

  return (
    <View
      style={[styles.card, isSkipped && styles.cardSkipped]}
      accessibilityLabel={`Exercise: ${exercise.exerciseName}`}
      accessibilityRole="summary"
    >
      {/* Skipped overlay badge */}
      {isSkipped && (
        <View style={styles.skippedBadge}>
          <Text style={styles.skippedBadgeText}>SKIPPED</Text>
        </View>
      )}

      {/* Header row: drag handle, name, progress, action menu */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onReorder}
          style={styles.dragHandle}
          accessibilityLabel="Reorder exercise"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.dragHandleText}>☰</Text>
        </TouchableOpacity>

        <View style={styles.nameBlock}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {exercise.exerciseName}
          </Text>

          {/* Progress indicator: "2/4 sets ●●○○" */}
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {completedCount}/{totalCount} sets{' '}
            </Text>
            {exercise.sets.map((s) => (
              <Text
                key={s.localId}
                style={s.completed ? styles.dotFilled : styles.dotEmpty}
              >
                ●
              </Text>
            ))}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleActionMenu}
          style={styles.menuBtn}
          accessibilityLabel="Exercise actions"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.menuBtnText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown action menu (cross-platform) */}
      {menuVisible && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)} />
          <View style={styles.actionMenu}>
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction(0)}>
              <Text style={styles.actionMenuItemText}>Swap Exercise</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction(1)}>
              <Text style={styles.actionMenuItemText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction(2)}>
              <Text style={styles.actionMenuItemText}>Generate Warm-Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction(3)}>
              <Text style={styles.actionMenuItemText}>Add Note</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction(4)}>
              <Text style={styles.actionMenuItemTextDanger}>Remove</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Overload badge */}
      {overloadSuggestion && (
        <View style={styles.badgeRow}>
          <OverloadBadge
            suggestion={overloadSuggestion}
            unitSystem={unitSystem}
            onApply={handleApplyOverload}
          />
        </View>
      )}

      {/* Set rows */}
      {exercise.sets.map((set, idx) => {
        const prevSet = previousPerformance?.sets[idx] ?? null;
        return (
          <SetRowPremium
            key={set.localId}
            set={set}
            setIndex={idx}
            exerciseLocalId={exercise.localId}
            previousSet={prevSet ? { weightKg: prevSet.weightKg, reps: prevSet.reps } : null}
            isCompleted={set.completed}
            unitSystem={unitSystem}
            showRpeRir={showRpeRir}
            rpeMode={rpeMode}
            onToggleComplete={() => onToggleSetCompleted(set.localId)}
            onCopyPrevious={() => onCopyPreviousToSet(set.localId)}
            onUpdateField={(field, value) => onUpdateSetField(set.localId, field, value)}
            onWeightStep={(dir) => onWeightStep(set.localId, dir)}
          />
        );
      })}

      {/* Add set button */}
      <TouchableOpacity
        onPress={onAddSet}
        style={styles.addSetBtn}
        accessibilityLabel="Add set"
        accessibilityRole="button"
      >
        <Text style={styles.addSetText}>+ Add Set</Text>
      </TouchableOpacity>

      {/* Collapsible per-exercise notes */}
      {notesVisible && (
        <TextInput
          style={styles.notesInput}
          value={notesText}
          onChangeText={setNotesText}
          placeholder="Exercise notes..."
          placeholderTextColor={colors.text.muted}
          multiline
          accessibilityLabel={`Notes for ${exercise.exerciseName}`}
          accessibilityRole="text"
        />
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardSkipped: {
    opacity: 0.4,
  },

  skippedBadge: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    backgroundColor: colors.semantic.negativeSubtle,
    paddingVertical: 2,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    zIndex: 1,
  },
  skippedBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.semantic.negative,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  dragHandle: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleText: {
    fontSize: typography.size.md,
    color: colors.text.muted,
  },
  nameBlock: {
    flex: 1,
  },
  exerciseName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  progressText: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
  },
  dotFilled: {
    fontSize: 8,
    color: colors.semantic.positive,
    marginHorizontal: 1,
  },
  dotEmpty: {
    fontSize: 8,
    color: colors.text.muted,
    marginHorizontal: 1,
  },

  menuBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text.secondary,
  },

  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  actionMenu: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    zIndex: 100,
    minWidth: 180,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  actionMenuItem: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  actionMenuItemText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  actionMenuItemTextDanger: {
    color: colors.semantic.negative,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },

  badgeRow: {
    marginBottom: spacing[2],
  },

  addSetBtn: {
    alignItems: 'center',
    paddingVertical: spacing[2],
    marginTop: spacing[1],
  },
  addSetText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.accent.primary,
  },

  notesInput: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing[2],
    marginTop: spacing[2],
    color: colors.text.primary,
    fontSize: typography.size.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});

export default ExerciseCardPremium;
