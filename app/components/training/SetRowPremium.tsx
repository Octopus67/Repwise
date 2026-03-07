/**
 * SetRowPremium — Enhanced set row for the premium workout logger.
 *
 * Layout: [#] [Prev ⬅] [Reps] [Weight ±] [RPE] [RIR] [✓]
 *
 * RPE and RIR are both shown when showRpeRir is true — neither is mandatory.
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { ActiveSet } from '../../types/training';
import type { UnitSystem } from '../../utils/unitConversion';
import { convertWeight } from '../../utils/unitConversion';
import { colors, typography, spacing, radius, springs } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useHaptics } from '../../hooks/useHaptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SetRowPremiumProps {
  set: ActiveSet;
  setIndex: number;
  exerciseLocalId: string;
  previousSet: { weightKg: number; reps: number } | null;
  isCompleted: boolean;
  unitSystem: UnitSystem;
  showRpeRir: boolean;
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
  onToggleComplete,
  onCopyPrevious,
  onUpdateField,
  onWeightStep,
}) => {
  const c = useThemeColors();
  const weightRef = useRef<TextInput>(null);
  const rpeRef = useRef<TextInput>(null);
  const rirRef = useRef<TextInput>(null);

  const { impact, notification } = useHaptics();
  const reduceMotion = useReduceMotion();
  const checkScale = useSharedValue(1);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const handleRepsSubmit = React.useCallback(() => {
    weightRef.current?.focus();
  }, []);

  const handleWeightSubmit = React.useCallback(() => {
    if (showRpeRir) {
      rpeRef.current?.focus();
    } else {
      onToggleComplete();
    }
  }, [showRpeRir, onToggleComplete]);

  const handleRpeSubmit = React.useCallback(() => {
    rirRef.current?.focus();
  }, []);

  const handleRirSubmit = React.useCallback(() => {
    onToggleComplete();
    notification('success');
    if (!reduceMotion) {
      checkScale.value = withSpring(1.3, springs.snappy, () => {
        checkScale.value = withSpring(1, springs.gentle);
      });
    }
  }, [onToggleComplete, notification, reduceMotion, checkScale]);

  const handleStepUp = React.useCallback(() => {
    impact('light');
    onWeightStep('up');
  }, [onWeightStep, impact]);

  const handleStepDown = React.useCallback(() => {
    impact('light');
    onWeightStep('down');
  }, [onWeightStep, impact]);

  const previousText = previousSet
    ? `${convertWeight(previousSet.weightKg, unitSystem)}${unitSystem === 'metric' ? 'kg' : 'lb'}×${previousSet.reps}`
    : null;

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

      {/* Previous performance */}
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
        placeholderTextColor={c.text.muted}
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
          placeholderTextColor={c.text.muted}
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

      {/* RPE input */}
      {showRpeRir && (
        <TextInput
          ref={rpeRef}
          style={[styles.input, styles.intensityInput]}
          value={set.rpe}
          onChangeText={(v) => onUpdateField('rpe', v)}
          onSubmitEditing={handleRpeSubmit}
          keyboardType="decimal-pad"
          returnKeyType="next"
          placeholder="RPE"
          placeholderTextColor={c.text.muted}
          accessibilityLabel={`RPE for set ${setIndex + 1}`}
          blurOnSubmit={false}
          maxLength={4}
        />
      )}

      {/* RIR input */}
      {showRpeRir && (
        <TextInput
          ref={rirRef}
          style={[styles.input, styles.intensityInput]}
          value={set.rir}
          onChangeText={(v) => onUpdateField('rir', v)}
          onSubmitEditing={handleRirSubmit}
          keyboardType="number-pad"
          returnKeyType="done"
          placeholder="RIR"
          placeholderTextColor={c.text.muted}
          accessibilityLabel={`RIR for set ${setIndex + 1}`}
          blurOnSubmit={false}
          maxLength={2}
        />
      )}

      {/* Completion checkmark */}
      <Animated.View style={checkAnimatedStyle}>
        <TouchableOpacity
          onPress={() => {
            onToggleComplete();
            notification('success');
            if (!reduceMotion) {
              checkScale.value = withSpring(1.3, springs.snappy, () => {
                checkScale.value = withSpring(1, springs.gentle);
              });
            }
          }}
          style={[styles.checkBtn, isCompleted && styles.checkBtnCompleted]}
          accessibilityLabel={`Complete set ${setIndex + 1}`}
          accessibilityRole="button"
        >
          <Text style={[styles.checkText, isCompleted && styles.checkTextCompleted]}>✓</Text>
        </TouchableOpacity>
      </Animated.View>
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
    gap: spacing[1],
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
    width: 18,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.muted,
    textAlign: 'center',
  },

  previousContainer: {
    width: 68,
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
    width: 48,
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
    width: 56,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.accent.primary,
  },
  stepperBtn: {
    width: 26,
    height: 26,
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

  intensityInput: {
    width: 44,
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
