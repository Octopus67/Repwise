/**
 * SetRowPremium — Enhanced set row for the premium workout logger.
 *
 * Layout: [#] [Prev ⬅] [Reps] [Weight ±] [RPE] [RIR] [✓]
 *
 * RPE and RIR are both shown when showRpeRir is true — neither is mandatory.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { ActiveSet, SetType } from '../../types/training';
import type { UnitSystem } from '../../utils/unitConversion';
import { SetTypeSelector } from './SetTypeSelector';
import { convertWeight } from '../../utils/unitConversion';
import { RPEPicker } from './RPEPicker';
import { rpeToRir } from '../../utils/rpeConversion';
import { typography, spacing, radius, springs } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { useHaptics } from '../../hooks/useHaptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { getProgressionStatus } from '../../utils/progressionLogic';
import { getProgressionBg, getProgressionBorder } from '../../utils/progressionColors';
import { Ionicons } from '@expo/vector-icons';

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
  onSetTypeChange?: (setType: SetType) => void;
  onOpenPlateCalculator?: (weightKg: number) => void;
  onRemoveSet?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SetRowPremium = React.memo<SetRowPremiumProps>(({
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
  onSetTypeChange,
  onOpenPlateCalculator,
  onRemoveSet,
}) => {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const weightRef = useRef<TextInput>(null);
  const rpeRef = useRef<TextInput>(null);
  const rirRef = useRef<TextInput>(null);

  const progressionStatus = isCompleted
    ? getProgressionStatus(set.weight, set.reps, previousSet, set.setType, unitSystem)
    : 'no_data';

  const { impact, notification } = useHaptics();
  const reduceMotion = useReduceMotion();
  const checkScale = useSharedValue(1);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // ── Swipe-to-delete ────────────────────────────────────────────────
  const DELETE_THRESHOLD = -80;
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -120);
      }
    })
    .onEnd(() => {
      if (translateX.value < DELETE_THRESHOLD && onRemoveSet) {
        translateX.value = withTiming(-300, { duration: 200 }, () => {
          runOnJS(onRemoveSet)();
        });
      } else {
        translateX.value = withSpring(0, springs.snappy);
      }
    });

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteRevealStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? withTiming(1, { duration: 150 }) : withTiming(0, { duration: 150 }),
  }));

  // RPE/RIR picker modal state
  const [pickerMode, setPickerMode] = useState<'rpe' | 'rir' | null>(null);

  const handleOpenRpePicker = useCallback(() => setPickerMode('rpe'), []);
  const handleOpenRirPicker = useCallback(() => setPickerMode('rir'), []);
  const handleDismissPicker = useCallback(() => setPickerMode(null), []);

  const handlePickerSelect = useCallback((rpeValue: string) => {
    if (pickerMode === 'rpe') {
      onUpdateField('rpe', rpeValue);
    } else if (pickerMode === 'rir') {
      const rir = rpeToRir(parseFloat(rpeValue));
      onUpdateField('rir', String(rir));
    }
    // Use setTimeout to ensure state update happens after onUpdateField completes
    setTimeout(() => setPickerMode(null), 0);
  }, [pickerMode, onUpdateField]);

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
    // Only celebrate on completion, not un-completion
    if (!isCompleted) {
      notification('success');
      if (!reduceMotion) {
        checkScale.value = withSpring(1.3, springs.snappy, () => {
          checkScale.value = withSpring(1, springs.gentle);
        });
      }
    }
    onToggleComplete();
  }, [isCompleted, onToggleComplete, notification, reduceMotion, checkScale]);

  const handleStepUp = React.useCallback(() => {
    impact('light');
    onWeightStep('up');
  }, [onWeightStep, impact]);

  const handleStepDown = React.useCallback(() => {
    impact('light');
    onWeightStep('down');
  }, [onWeightStep, impact]);

  const handleWeightLongPress = React.useCallback(() => {
    if (!onOpenPlateCalculator) return;
    const weightKg = parseFloat(set.weight) || 0;
    // Don't open calculator for zero/empty weight
    if (weightKg <= 0) return;
    impact('heavy');
    onOpenPlateCalculator(weightKg);
  }, [onOpenPlateCalculator, impact, set.weight]);

  const previousText = previousSet
    ? `${convertWeight(previousSet.weightKg, unitSystem)}${unitSystem === 'metric' ? 'kg' : 'lb'}×${previousSet.reps}`
    : null;

  return (
    <View style={styles.swipeContainer}>
      {/* Delete reveal behind the row */}
      <Animated.View style={[styles.deleteReveal, deleteRevealStyle]}>
        <Text style={styles.deleteRevealText}>Delete</Text>
      </Animated.View>

      <GestureDetector gesture={onRemoveSet ? panGesture : Gesture.Pan()}>
        <Animated.View
          style={[
            styles.row,
            isCompleted
              ? [styles.rowCompleted, { backgroundColor: getProgressionBg(progressionStatus), borderLeftColor: getProgressionBorder(progressionStatus) }]
              : styles.rowUncompleted,
            swipeStyle,
          ]}
          accessibilityRole="none"
        >
      {/* Delete button */}
      {onRemoveSet && (
        <TouchableOpacity
          onPress={onRemoveSet}
          style={styles.deleteBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={`Delete set ${setIndex + 1}`}
          accessibilityRole="button"
        >
          <Ionicons name="close-circle-outline" size={16} color={c.text.muted} />
        </TouchableOpacity>
      )}

      {/* Set number */}
      <Text style={styles.setNumber}>{setIndex + 1}</Text>

      {/* Set type selector */}
      {onSetTypeChange && (
        <SetTypeSelector
          value={set.setType}
          onChange={onSetTypeChange}
        />
      )}

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
        style={[styles.input, styles.repsInput]}
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

        <Pressable onLongPress={handleWeightLongPress} delayLongPress={400}>
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
            accessibilityLabel={`Weight for set ${setIndex + 1}, long press for plate calculator`}
            blurOnSubmit={false}
            maxLength={6}
          />
        </Pressable>

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

      {/* RPE input — tap opens picker */}
      {showRpeRir && (
        <Pressable onPress={handleOpenRpePicker}>
          <TextInput
            ref={rpeRef}
            style={[styles.input, styles.intensityInput]}
            value={set.rpe}
            onChangeText={(v) => onUpdateField('rpe', v)}
            onSubmitEditing={handleRpeSubmit}
            onFocus={handleOpenRpePicker}
            keyboardType="decimal-pad"
            returnKeyType="next"
            placeholder="RPE"
            placeholderTextColor={c.text.muted}
            accessibilityLabel={`RPE for set ${setIndex + 1}, tap to pick`}
            blurOnSubmit={false}
            maxLength={4}
          />
        </Pressable>
      )}

      {/* RIR input — tap opens picker */}
      {showRpeRir && (
        <Pressable onPress={handleOpenRirPicker}>
          <TextInput
            ref={rirRef}
            style={[styles.input, styles.intensityInput]}
            value={set.rir}
            onChangeText={(v) => onUpdateField('rir', v)}
            onSubmitEditing={handleRirSubmit}
            onFocus={handleOpenRirPicker}
            keyboardType="number-pad"
            returnKeyType="done"
            placeholder="RIR"
            placeholderTextColor={c.text.muted}
            accessibilityLabel={`RIR for set ${setIndex + 1}, tap to pick`}
            blurOnSubmit={false}
            maxLength={2}
          />
        </Pressable>
      )}

      {/* RPE/RIR Picker Modal */}
      {showRpeRir && pickerMode !== null && (
        <RPEPicker
          visible
          mode={pickerMode}
          onSelect={handlePickerSelect}
          onDismiss={handleDismissPicker}
        />
      )}

      {/* Completion checkmark */}
      <Animated.View style={checkAnimatedStyle}>
        <TouchableOpacity
          onPress={() => {
            // Only celebrate on completion, not un-completion
            if (!isCompleted) {
              notification('success');
              if (!reduceMotion) {
                checkScale.value = withSpring(1.3, springs.snappy, () => {
                  checkScale.value = withSpring(1, springs.gentle);
                });
              }
            }
            onToggleComplete();
          }}
          style={[styles.checkBtn, isCompleted && styles.checkBtnCompleted]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Complete set ${setIndex + 1}`}
          accessibilityRole="button"
        >
          <Text style={[styles.checkText, isCompleted && styles.checkTextCompleted]}>✓</Text>
        </TouchableOpacity>
      </Animated.View>
      </Animated.View>
      </GestureDetector>
    </View>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.sm,
    marginBottom: spacing[1],
  },
  deleteReveal: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: c.semantic.negative ?? '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  deleteRevealText: {
    color: c.text.onAccent,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
    gap: spacing[1],
  },
  rowCompleted: {
    backgroundColor: 'rgba(0, 255, 100, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: c.semantic.positive,
    opacity: 0.85,
  },
  rowUncompleted: {
  },

  deleteBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  setNumber: {
    width: 18,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: c.text.muted,
    textAlign: 'center',
  },

  previousContainer: {
    width: 68,
    flexShrink: 1,
  },
  previousText: {
    fontSize: typography.size.xs,
    color: c.text.muted,
  },
  previousPlaceholder: {
    fontSize: typography.size.xs,
    color: c.text.muted,
    textAlign: 'center',
  },

  input: {
    width: 48,
    height: 36,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    paddingHorizontal: spacing[1],
  },

  repsInput: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },

  weightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
  },
  weightInput: {
    width: 56,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: c.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: c.text.secondary,
  },

  intensityInput: {
    width: 44,
  },

  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: c.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: c.semantic.positive,
    borderColor: c.semantic.positive,
  },
  checkText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: c.text.muted,
  },
  checkTextCompleted: {
    color: c.text.inverse,
  },
});

export default SetRowPremium;
