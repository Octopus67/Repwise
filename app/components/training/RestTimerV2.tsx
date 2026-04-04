import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatRestTimer } from '../../utils/durationFormat';
import { getTimerRingColor } from '../../utils/restDurationV2';
import { spacing, typography, radius, motion } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import type { TimerState } from '../../types/training';

interface RestTimerV2Props {
  durationSeconds: number;
  visible: boolean;
  onDismiss: () => void;
  onComplete: () => void;
}

const RING_SIZE = 200;
const STROKE_WIDTH = 10;
const R = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const CENTER = RING_SIZE / 2;

export function RestTimerV2({
  durationSeconds,
  visible,
  onDismiss,
  onComplete,
}: RestTimerV2Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [state, setState] = useState<TimerState>('IDLE');
  const [remaining, setRemaining] = useState(durationSeconds);
  const [originalDuration, setOriginalDuration] = useState(durationSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Animated strokeDashoffset
  const animatedOffset = useRef(new Animated.Value(0)).current;

  // Reset when visibility or duration changes
  useEffect(() => {
    if (visible) {
      setRemaining(durationSeconds);
      setOriginalDuration(durationSeconds);
      setState('RUNNING');
      animatedOffset.setValue(0);
    } else {
      clearTimer();
      setState('IDLE');
    }
  }, [visible, durationSeconds]);

  // Animate ring offset when remaining changes
  useEffect(() => {
    if (originalDuration <= 0) return;
    const target = CIRCUMFERENCE * (1 - remaining / originalDuration);
    Animated.timing(animatedOffset, {
      toValue: target,
      duration: motion.duration.slow,
      useNativeDriver: false,
    }).start();
  }, [remaining, originalDuration]);

  // Countdown interval
  useEffect(() => {
    if (state !== 'RUNNING') {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setState('COMPLETED');
          playCompletionSound();
          setTimeout(() => onCompleteRef.current(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [state]);

  function clearTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const handlePauseResume = useCallback(() => {
    setState((s) => (s === 'RUNNING' ? 'PAUSED' : 'RUNNING'));
  }, []);

  const handleSkip = useCallback(() => {
    clearTimer();
    setState('IDLE');
    onDismiss();
  }, [onDismiss]);

  const handleAdjust = useCallback((delta: number) => {
    setRemaining((prev) => Math.max(0, prev + delta));
    setOriginalDuration((prev) => Math.max(1, prev + delta));
  }, []);

  if (!visible) return null;

  const timerColor = getTimerRingColor(remaining);
  const ringColor =
    timerColor === 'green'
      ? c.semantic.positive
      : timerColor === 'yellow'
        ? c.semantic.warning
        : c.semantic.negative;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={[styles.overlay, { backgroundColor: c.bg.overlay }]}>
        <View style={[styles.container, { backgroundColor: c.bg.surfaceRaised }]}>
          <Text style={[styles.label, { color: c.text.secondary }]}>Rest Timer</Text>

          {/* Progress Ring */}
          <View style={styles.ringContainer}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {/* Track */}
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={R}
                stroke={c.border.default}
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              {/* Progress */}
              <AnimatedCircle
                cx={CENTER}
                cy={CENTER}
                r={R}
                stroke={ringColor}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={animatedOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              />
            </Svg>
            <View style={styles.timerTextContainer}>
              <Text style={[styles.timerText, { color: ringColor }]}>
                {formatRestTimer(remaining)}
              </Text>
              {state === 'COMPLETED' && (
                <Text style={[styles.completeText, { color: c.semantic.positive }]}>Rest Complete</Text>
              )}
            </View>
          </View>

          {/* Adjust buttons */}
          <View style={styles.adjustRow}>
            <TouchableOpacity
              style={[styles.adjustBtn, { backgroundColor: c.bg.surface, borderColor: c.border.default }]}
              onPress={() => handleAdjust(-15)}
              activeOpacity={0.7}
            >
              <Text style={[styles.adjustText, { color: c.text.secondary }]}>-15s</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adjustBtn, { backgroundColor: c.bg.surface, borderColor: c.border.default }]}
              onPress={() => handleAdjust(15)}
              activeOpacity={0.7}
            >
              <Text style={[styles.adjustText, { color: c.text.secondary }]}>+15s</Text>
            </TouchableOpacity>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            {state !== 'COMPLETED' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: c.accent.primary }]}
                onPress={handlePauseResume}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionText, { color: c.text.primary }]}>
                  {state === 'PAUSED' ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.skipBtn, { backgroundColor: c.bg.surface, borderColor: c.border.default }]}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipText, { color: c.text.secondary }]}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function playCompletionSound() {
  try {
    const { Audio } = require('expo-av');
    Audio.Sound.createAsync(require('../../assets/timer-done.mp3')).catch(() => {}); // Intentional: audio playback failure is non-critical
  } catch {
    // Intentional: expo-av not available — audio is non-critical
  }
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: c.bg.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    padding: spacing[8],
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.lg,
    minWidth: 280,
  },
  label: {
    color: c.text.secondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[4],
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  timerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
  },
  completeText: {
    color: c.semantic.positive,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginTop: spacing[1],
  },
  adjustRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  adjustBtn: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: c.border.default,
  },
  adjustText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  actionBtn: {
    backgroundColor: c.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  actionText: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  skipBtn: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: c.border.default,
  },
  skipText: {
    color: c.text.secondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
});
