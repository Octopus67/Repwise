/**
 * ExerciseCardPremium — Exercise card for the premium workout logger.
 *
 * Renders exercise name (bold/large), progress dots, overload badge,
 * action menu, per-exercise notes, and SetRowPremium for each set.
 * Skipped state: opacity 0.4 with "SKIPPED" badge overlay.
 *
 * Requirements: 2.4, 4.1, 12.1, 13.1, 17.1, 17.2, 17.4, 17.5, 18.1
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  SetType,
} from '../../types/training';
import { SetRowPremium } from './SetRowPremium';
import { OverloadBadge } from './OverloadBadge';
import { WarmUpSuggestion } from './WarmUpSuggestion';
import type { WarmUpSet } from '../../utils/warmUpGenerator';
import { typography, spacing, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../utils/haptics';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExerciseCardPremiumProps {
  exercise: ActiveExercise;
  previousPerformance: PreviousPerformanceData | null;
  overloadSuggestion: OverloadSuggestion | null;
  unitSystem: UnitSystem;
  showRpeRir: boolean;
  rpeMode?: 'rpe' | 'rir'; // kept for backward compat, no longer used
  /** Per-exercise HU (shown as badge below exercise name) */
  currentHU?: number;
  onSwap: () => void;
  onSkip: () => void;
  onGenerateWarmUp: (sets?: WarmUpSet[]) => void;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setLocalId: string) => void;
  onReorder: (direction: 'up' | 'down') => void;
  isFirst?: boolean;
  isLast?: boolean;
  onUpdateSetField: (
    setLocalId: string,
    field: 'weight' | 'reps' | 'rpe' | 'rir',
    value: string,
  ) => void;
  onToggleSetCompleted: (setLocalId: string) => void;
  onCopyPreviousToSet: (setLocalId: string) => void;
  onWeightStep: (setLocalId: string, direction: 'up' | 'down') => void;
  onUpdateSetType?: (setLocalId: string, setType: SetType) => void;
  onApplyOverload?: () => void;
  onShowRpeEducation?: () => void;
  onSetExerciseNotes?: (localId: string, notes: string) => void;
  onShowHUExplainer?: () => void;
  onOpenPlateCalculator?: (weightKg: number) => void;
  onLinkSuperset?: () => void;
  onUnlinkSuperset?: () => void;
  isSupersetMember?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ExerciseCardPremium = React.memo<ExerciseCardPremiumProps>(({
  exercise,
  previousPerformance,
  overloadSuggestion,
  unitSystem,
  showRpeRir,
  rpeMode,
  currentHU,
  onSwap,
  onSkip,
  onGenerateWarmUp,
  onRemove,
  onAddSet,
  onRemoveSet,
  onReorder,
  isFirst,
  isLast,
  onUpdateSetField,
  onToggleSetCompleted,
  onCopyPreviousToSet,
  onWeightStep,
  onUpdateSetType,
  onApplyOverload,
  onShowRpeEducation,
  onSetExerciseNotes,
  onShowHUExplainer,
  onOpenPlateCalculator,
  onLinkSuperset,
  onUnlinkSuperset,
  isSupersetMember,
}) => {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [notesVisible, setNotesVisible] = useState(false);
  const [notesText, setNotesText] = useState(exercise.notes ?? '');
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Sync notes from props (handles store rehydration)
  useEffect(() => {
    setNotesText(exercise.notes ?? '');
  }, [exercise.notes]);
  
  // Debounce store updates to avoid re-render on every keystroke
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const debouncedSetNotes = useCallback((localId: string, text: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onSetExerciseNotes?.(localId, text);
    }, 300);
  }, [onSetExerciseNotes]);

  // ── Callbacks declared before use (project rule: no temporal dead zone) ──

  const handleActionMenu = useCallback(() => {
    setMenuVisible((v) => !v);
  }, []);

  const handleMenuAction = useCallback((action: string) => {
    setMenuVisible(false);
    switch (action) {
      case 'swap': onSwap(); break;
      case 'skip': onSkip(); break;
      case 'warmup': onGenerateWarmUp(); break;
      case 'notes': setNotesVisible((v) => !v); break;
      case 'remove': onRemove(); break;
      case 'link-superset': onLinkSuperset?.(); break;
      case 'unlink-superset': onUnlinkSuperset?.(); break;
    }
  }, [onSwap, onSkip, onGenerateWarmUp, onRemove, onLinkSuperset, onUnlinkSuperset]);

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
        <View style={styles.reorderButtons}>
          <TouchableOpacity
            onPress={() => onReorder('up')}
            style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
            disabled={isFirst}
            accessibilityLabel="Move exercise up"
            accessibilityRole="button"
            hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
          >
            <Text style={[styles.reorderBtnText, isFirst && styles.reorderBtnTextDisabled]}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onReorder('down')}
            style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
            disabled={isLast}
            accessibilityLabel="Move exercise down"
            accessibilityRole="button"
            hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
          >
            <Text style={[styles.reorderBtnText, isLast && styles.reorderBtnTextDisabled]}>▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {exercise.exerciseName}
          </Text>

          {/* Progress indicator: "2/4 sets ●●○○" */}
          <View
            style={styles.progressRow}
            accessibilityLabel={`Set ${completedCount} of ${totalCount} completed`}
            accessibilityRole="text"
          >
            <Text style={styles.progressText}>
              {completedCount}/{totalCount} sets{' '}
            </Text>
            {exercise.sets.map((s) => (
              <Text
                key={s.localId}
                style={s.completed ? styles.dotFilled : styles.dotEmpty}
                importantForAccessibility="no"
                accessibilityElementsHidden
              >
                ●
              </Text>
            ))}
          </View>

          {/* HU badge (shown after first completed set) */}
          {currentHU != null && currentHU > 0 && (
            <TouchableOpacity
              style={styles.huBadge}
              onPress={onShowHUExplainer}
              accessibilityLabel={`${currentHU.toFixed(1)} Hard Units for ${exercise.exerciseName}`}
              accessibilityRole="button"
              accessibilityHint="Tap to learn about Hard Units"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.huBadgeText}>{currentHU.toFixed(1)} HU</Text>
              <Text style={styles.huInfoIcon}>ⓘ</Text>
            </TouchableOpacity>
          )}
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
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction('swap')}>
              <Text style={styles.actionMenuItemText}>Swap Exercise</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction('skip')}>
              <Text style={styles.actionMenuItemText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction('warmup')}>
              <Text style={styles.actionMenuItemText}>Generate Warm-Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction('notes')}>
              <Text style={styles.actionMenuItemText}>Add Note</Text>
            </TouchableOpacity>
            {isSupersetMember ? (
              <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction('unlink-superset')}>
                <Text style={styles.actionMenuItemText}>Unlink Superset</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction('link-superset')}>
                <Text style={styles.actionMenuItemText}>Link Superset</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleMenuAction('remove')}>
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

      {/* Warm-up suggestion (predictive from previous performance) */}
      <WarmUpSuggestion
        workingWeightKg={(() => {
          const ws = exercise.sets.find((s) => s.setType === 'normal' && s.weight !== '');
          return ws ? parseFloat(ws.weight) || 0 : 0;
        })()}
        barWeightKg={20}
        previousBestWeight={previousPerformance?.sets?.reduce((max, s) => Math.max(max, s.weightKg || 0), 0) || undefined}
        onGenerate={onGenerateWarmUp}
      />

      {/* Column headers */}
      <View style={styles.columnHeaders}>
        <Text style={styles.columnHeaderSetNum}>#</Text>
        {onUpdateSetType && <Text style={styles.columnHeaderType}>Type</Text>}
        <Text style={styles.columnHeaderPrev}>Prev</Text>
        <Text style={styles.columnHeaderReps}>Reps</Text>
        <Text style={styles.columnHeaderWeight}>Weight</Text>
        {showRpeRir && (
          <View style={styles.rpeHeaderContainer}>
            <Text style={styles.columnHeaderIntensity}>RPE</Text>
            <Text style={styles.columnHeaderIntensity}>RIR</Text>
            {onShowRpeEducation && (
              <TouchableOpacity
                onPress={onShowRpeEducation}
                style={styles.infoButton}
                accessibilityLabel="Learn about RPE and RIR"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.infoButtonText}>ⓘ</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <Text style={styles.columnHeaderDone}>Done</Text>
      </View>

      {/* Set rows */}
      {exercise.sets.map((set, idx) => {
        const prevSet = previousPerformance?.sets?.[idx] ?? null;
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
            onToggleComplete={() => { haptic.success(); onToggleSetCompleted(set.localId); }}
            onCopyPrevious={() => onCopyPreviousToSet(set.localId)}
            onUpdateField={(field, value) => onUpdateSetField(set.localId, field, value)}
            onWeightStep={(dir) => { haptic.light(); onWeightStep(set.localId, dir); }}
            onSetTypeChange={onUpdateSetType ? (type) => onUpdateSetType(set.localId, type) : undefined}
            onOpenPlateCalculator={onOpenPlateCalculator}
            onRemoveSet={() => onRemoveSet(set.localId)}
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
          onChangeText={(text) => {
            setNotesText(text);
            debouncedSetNotes(exercise.localId, text);
          }}
          placeholder="Exercise notes..."
          placeholderTextColor={c.text.muted}
          multiline
          accessibilityLabel={`Notes for ${exercise.exerciseName}`}
          accessibilityRole="text"
        />
      )}
    </View>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  cardSkipped: {
    opacity: 0.4,
  },

  skippedBadge: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    backgroundColor: c.semantic.negativeSubtle,
    paddingVertical: 2,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    zIndex: 1,
  },
  skippedBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: c.semantic.negative,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  reorderButtons: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  reorderBtn: {
    width: 24,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.25,
  },
  reorderBtnText: {
    fontSize: 10,
    color: c.text.muted,
  },
  reorderBtnTextDisabled: {
    color: c.text.muted,
  },
  nameBlock: {
    flex: 1,
  },
  exerciseName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: c.text.primary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  progressText: {
    fontSize: typography.size.xs,
    color: c.text.muted,
  },
  dotFilled: {
    fontSize: 8,
    color: c.semantic.positive,
    marginHorizontal: 1,
  },
  dotEmpty: {
    fontSize: 8,
    color: c.text.muted,
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
    color: c.text.secondary,
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
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
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
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  actionMenuItemTextDanger: {
    color: c.semantic.negative,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },

  badgeRow: {
    marginBottom: spacing[2],
  },

  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    marginBottom: spacing[1],
    gap: spacing[1],
  },
  columnHeader: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.text.muted,
    textAlign: 'center',
  },
  columnHeaderSetNum: {
    width: 18,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.text.muted,
    textAlign: 'center',
  },
  columnHeaderType: {
    width: 32,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.text.muted,
    textAlign: 'center',
  },
  columnHeaderPrev: {
    width: 60,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.text.muted,
    textAlign: 'center',
  },
  columnHeaderReps: {
    width: 48,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.text.muted,
    textAlign: 'center',
  },
  columnHeaderWeight: {
    width: 108, // 26 + 56 + 26 (steppers + input)
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.text.muted,
    textAlign: 'center',
  },
  columnHeaderIntensity: {
    width: 44,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.text.muted,
    textAlign: 'center',
  },
  columnHeaderDone: {
    width: 32,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.text.muted,
    textAlign: 'center',
  },
  rpeHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  infoButton: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    fontSize: 12,
    color: c.text.muted,
  },

  addSetBtn: {
    alignItems: 'center',
    paddingVertical: spacing[2],
    marginTop: spacing[1],
  },
  addSetText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: c.accent.primary,
  },

  huBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: c.accent.primaryMuted,
    borderRadius: radius.full,
    paddingVertical: 2,
    paddingHorizontal: spacing[2],
    marginTop: 2,
    gap: spacing[1],
  },
  huBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: c.accent.primary,
    fontVariant: ['tabular-nums'],
  },
  huInfoIcon: {
    fontSize: 10,
    color: c.accent.primary,
  },

  notesInput: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing[2],
    marginTop: spacing[2],
    color: c.text.primary,
    fontSize: typography.size.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});

export default ExerciseCardPremium;
