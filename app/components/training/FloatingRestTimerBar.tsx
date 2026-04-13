import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { radius, spacing, typography, shadows, springs, motion } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { adjustTime, getTimerColor } from '../../utils/restTimerLogic';
import { useHaptics } from '../../hooks/useHaptics';
import { haptic } from '../../utils/haptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { Audio } from 'expo-av';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';

interface FloatingRestTimerBarProps {
  durationSeconds: number;
  isActive: boolean;
  exerciseName: string;
  onComplete: () => void;
  onDismiss: () => void;
}

const getTIMER_COLOR_MAP = (c: ThemeColors): Record<'green' | 'yellow' | 'red', string> => ({
  green: c.semantic.positive,
  yellow: c.semantic.warning,
  red: c.semantic.negative,
});

export function FloatingRestTimerBar({
  durationSeconds,
  isActive,
  exerciseName,
  onComplete,
  onDismiss,
}: FloatingRestTimerBarProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [remaining, setRemaining] = useState(durationSeconds);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const startedAtRef = useRef<number>(Date.now());
  const pausedRemainingRef = useRef<number>(durationSeconds);

  const { notification: hapticNotification } = useHaptics();
  const timerSoundEnabled = useWorkoutPreferencesStore((s) => s.timerSoundEnabled);
  const reduceMotion = useReduceMotion();

  const playCompletionSound = useCallback(async () => {
    if (!timerSoundEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/timer-done.mp3'),
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch {
      // Audio not available — haptics still fire
    }
  }, [timerSoundEnabled]);
  const translateY = useSharedValue(reduceMotion ? 0 : 80);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Reset when a new timer starts
  useEffect(() => {
    if (isActive) {
      setRemaining(durationSeconds);
      setPaused(false);
      startedAtRef.current = Date.now();
      pausedRemainingRef.current = durationSeconds;
      if (!reduceMotion) {
        translateY.value = 80;
        translateY.value = withSpring(0, springs.snappy);
      }
    }
  }, [isActive, durationSeconds]);

  // Track remaining for background recovery
  useEffect(() => {
    pausedRemainingRef.current = remaining;
  }, [remaining]);

  // Handle app returning from background — recalculate remaining time
  useEffect(() => {
    if (!isActive) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !paused) {
        const elapsedSinceStart = Math.floor((Date.now() - startedAtRef.current) / 1000);
        const newRemaining = Math.max(0, durationSeconds - elapsedSinceStart);
        setRemaining(newRemaining);
        if (newRemaining <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          haptic.heavy();
          hapticNotification('success');
          playCompletionSound();
          onCompleteRef.current();
        }
      }
    });

    return () => subscription.remove();
  }, [isActive, paused, durationSeconds, hapticNotification, playCompletionSound]);

  // Countdown interval
  useEffect(() => {
    if (!isActive || paused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setTimeout(() => {
            haptic.heavy();
            hapticNotification('success');
            playCompletionSound();
            onCompleteRef.current();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, paused, hapticNotification]);

  const handleAdjust = useCallback((delta: number) => {
    setRemaining((prev) => adjustTime(prev, delta));
  }, []);

  const handleTogglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const handleAnimatedDismiss = useCallback(() => {
    if (reduceMotion) {
      onDismiss();
      return;
    }
    translateY.value = withTiming(80, { duration: motion.duration.default }, () => {
      runOnJS(onDismiss)();
    });
  }, [onDismiss, reduceMotion, translateY]);

  if (!isActive) return null;

  const timerColorKey = getTimerColor(remaining, durationSeconds);
  const timerColor = getTIMER_COLOR_MAP(c)[timerColorKey];
  const clampedRemaining = Math.max(0, remaining);
  const minutes = Math.floor(clampedRemaining / 60);
  const seconds = clampedRemaining % 60;
  const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Progress ring calculations
  const RING_SIZE = 36;
  const RING_STROKE = 3;
  const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const progress = durationSeconds > 0 ? clampedRemaining / durationSeconds : 0;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  const ringColor = progress > 0.5 ? c.semantic.positive : progress > 0.25 ? c.semantic.warning : c.semantic.negative;

  return (
    <Animated.View style={[styles.container, slideStyle]} accessibilityRole="timer" accessibilityLabel={`Rest timer: ${remaining} seconds`}>
      <View style={styles.row}>
        {/* Exercise name */}
        <View style={styles.infoSection}>
          <Text style={[styles.exerciseName, { color: c.text.secondary }]} numberOfLines={1}>{exerciseName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <SvgCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={c.border.subtle}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <SvgCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={ringColor}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={`${RING_CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              />
            </Svg>
            <Text style={[styles.countdown, { color: timerColor }]}>{timeText}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.adjustBtn, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
            onPress={() => handleAdjust(-15)}
            accessibilityLabel="Decrease rest time by 15 seconds"
            accessibilityRole="button"
          >
            <Text style={[styles.adjustText, { color: c.text.secondary }]}>-15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adjustBtn, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
            onPress={() => handleAdjust(15)}
            accessibilityLabel="Increase rest time by 15 seconds"
            accessibilityRole="button"
          >
            <Text style={[styles.adjustText, { color: c.text.secondary }]}>+15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pauseBtn, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
            onPress={handleTogglePause}
            accessibilityLabel={paused ? 'Resume timer' : 'Pause timer'}
            accessibilityRole="button"
          >
            <Text style={[styles.pauseText, { color: c.text.primary }]}>{paused ? '▶' : '⏸'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dismissBtn, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
            onPress={handleAnimatedDismiss}
            accessibilityLabel="Dismiss rest timer"
            accessibilityRole="button"
          >
            <Text style={[styles.dismissText, { color: c.text.muted }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}


const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70, // Above StickyFinishBar
    left: spacing[3],
    right: spacing[3],
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...shadows.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoSection: {
    flex: 1,
    marginRight: spacing[3],
  },
  exerciseName: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  countdown: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.xl,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  adjustBtn: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  adjustText: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  pauseBtn: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  pauseText: {
    color: c.text.primary,
    fontSize: typography.size.base,
  },
  dismissBtn: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  dismissText: {
    color: c.text.muted,
    fontSize: typography.size.base,
  },
});
