/**
 * SetRowPremium — Enhanced set row for the premium workout logger.
 *
 * Layout: [#] [Previous: 80kg×8 ⬅] [Reps] [Weight ±] [RPE/RIR] [✓]
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.5, 3.1, 3.2, 3.3, 3.4, 7.2, 7.3, 7.4, 18.2
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { ActiveSet } from '../../types/training';
import type { UnitSystem } from '../../utils/unitConversion';
import { convertWeight } from '../../utils/unitConversion';
import { colors, typography, spacing, radius } from '../../theme/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SetRowPremiumProps {
  set: ActiveSet;
  setIndex: number;
  exerciseLocalId: string;
  previousSet: { weightKg: number; reps: number } | null;
  isCompleted: boolean;
  unitSystem: UnitSystem;
  showRpeRir: boolean;
  rpeMode: 'rpe' | 'rir';
  onToggleComplete: () => void;
  onCopyPrevious: () => void;
  onUpdateField: (field: 'weight' | 'reps' | 'rpe' | 'rir', value: string) => void;
  onWeightStep: (direction: 'up' | 'down') => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SetRowPremium: React.FC<SetRowPremiumProps> = ({
  set,
  setIndex,
  previousSet,
  isCompleted,
  unitSystem,
  showRpeRir,
  rpeMode,
  onToggleComplete,
  onCopyPrevious,
  onUpdateField,
  onWeightStep,
}) => {
  const weightRef = useRef<TextInput>(null);
  const rpeRirRef = useRef<TextInput>(null);

  // ── Callbacks declared before use (project rule: no temporal dead zone) ──

  const handleRepsSubmit = React.useCallback(() => {
    weightRef.current?.focus();
  }, []);

  const handleWeightSubmit = React.useCallback(() => {
    if (showRpeRir) {
      rpeRirRef.current?.focus();
    } else {
      onToggleComplete();
    }
  }, [showRpeRir, onToggleComplete]);

  const handleRpeRirSubmit = React.useCallback(() => {
    onToggleComplete();
  }, [onToggleComplete]);

  const handleStepUp = React.useCallback(() => {
    onWeightStep('up');
  }, [onWeightStep]);

  const handleStepDown = React.useCallback(() => {
    onWeightStep('down');
  }, [onWeightStep]);

  // ── Previous performance display text ──

  const previousText = previousSet
    ? `${convertWeight(previousSet.weightKg, unitSystem)}${unitSystem === 'metric' ? 'kg' : 'lbs'}×${previousSet.reps}`
    : null;

  const intensityField = rpeMode === 'rpe' ? 'rpe' : 'rir';
  const intensityValue = rpeMode === 'rpe' ? set.rpe : set.rir;
  const intensityLabel = rpeMode === 'rpe' ? 'RPE' : 'RIR';

  // ── Render ──

  return (
    <View
      style={[
        styles.row,
        isCompleted ? styles.rowCompleted : styles.rowUncompleted,
      ]}
      accessibilityRole="none"
    >
      {/* Set number */}
      <Text style={styles.setNumber}>{setIndex + 1}</Text>

      {/* Previous performance — tappable to copy */}
      <View style={styles.previousContainer}>
        {previousText ? (
          <TouchableOpacity
            onPress={onCopyPrevious}
            accessibilityLabel={`Copy previous: ${previousText}`}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.previousText}>{previousText} ⬅</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.previousPlaceholder}>—</Text>
        )}
      </View>

      {/* Reps input */}
      <TextInput
        style={styles.input}
        value={set.reps}
        onChangeText={(v) => onUpdateField('reps', v)}
        onSubmitEditing={handleRepsSubmit}
        keyboardType="number-pad"
        returnKeyType="next"
        placeholder="Reps"
        placeholderTextColor={colors.text.muted}
        accessibilityLabel={`Reps for set ${setIndex + 1}`}
        blurOnSubmit={false}
        maxLength={4}
      />

      {/* Weight input with ± steppers */}
      <View style={styles.weightGroup}>
        <TouchableOpacity
          onPress={handleStepDown}
          style={styles.stepperBtn}
          accessibilityLabel="Decrease weight"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={styles.stepperText}>−</Text>
        </TouchableOpacity>

        <TextInput
          ref={weightRef}
          style={[styles.input, styles.weightInput]}
          value={set.weight}
          onChangeText={(v) => onUpdateField('weight', v)}
          onSubmitEditing={handleWeightSubmit}
          keyboardType="decimal-pad"
          returnKeyType={showRpeRir ? 'next' : 'done'}
          placeholder={unitSystem === 'metric' ? 'kg' : 'lbs'}
          placeholderTextColor={colors.text.muted}
          accessibilityLabel={`Weight for set ${setIndex + 1}`}
          blurOnSubmit={false}
          maxLength={6}
        />

        <TouchableOpacity
          onPress={handleStepUp}
          style={styles.stepperBtn}
          accessibilityLabel="Increase weight"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={styles.stepperText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* RPE / RIR input — conditionally rendered */}
      {showRpeRir && (
        <TextInput
          ref={rpeRirRef}
          style={[styles.input, styles.rpeInput]}
          value={intensityValue}
          onChangeText={(v) => onUpdateField(intensityField, v)}
          onSubmitEditing={handleRpeRirSubmit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          placeholder={intensityLabel}
          placeholderTextColor={colors.text.muted}
          accessibilityLabel={`${intensityLabel} for set ${setIndex + 1}`}
          blurOnSubmit={false}
          maxLength={4}
        />
      )}

      {/* Completion checkmark */}
      <TouchableOpacity
        onPress={onToggleComplete}
        style={[
          styles.checkBtn,
          isCompleted && styles.checkBtnCompleted,
        ]}
        accessibilityLabel={`Complete set ${setIndex + 1}`}
        accessibilityRole="button"
      >
        <Text style={[styles.checkText, isCompleted && styles.checkTextCompleted]}>
          ✓
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
    marginBottom: spacing[1],
    gap: spacing[2],
  },
  rowCompleted: {
    backgroundColor: 'rgba(0, 255, 100, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: colors.semantic.positive,
  },
  rowUncompleted: {
    opacity: 0.7,
  },

  setNumber: {
    width: 20,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.muted,
    textAlign: 'center',
  },

  previousContainer: {
    minWidth: 72,
    maxWidth: 90,
  },
  previousText: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
  },
  previousPlaceholder: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textAlign: 'center',
  },

  input: {
    flex: 1,
    minWidth: 44,
    maxWidth: 60,
    height: 36,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    paddingHorizontal: spacing[1],
  },

  weightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  weightInput: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.accent.primary,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text.secondary,
  },

  rpeInput: {
    maxWidth: 48,
  },

  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: colors.semantic.positive,
    borderColor: colors.semantic.positive,
  },
  checkText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text.muted,
  },
  checkTextCompleted: {
    color: colors.text.inverse,
  },
});

export default SetRowPremium;
