/**
 * RestTimerRing — SVG circular progress arc for rest timer.
 *
 * Renders a ring that depletes as time passes, with color transitions:
 *   green (>10s) → yellow (5-10s) → red (≤5s)
 *
 * Center text shows remaining time in M:SS format.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getTimerColor } from '../../utils/restDurationV2';
import { formatRestTimer } from '../../utils/durationFormat';
import { colors, typography } from '../../theme/tokens';

export { getTimerColor };

// ─── Ring geometry ───────────────────────────────────────────────────────────

const RING_SIZE = 220;
const STROKE_WIDTH = 12;
const R = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const CENTER = RING_SIZE / 2;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface RestTimerRingProps {
  /** Total rest duration in seconds */
  durationSeconds: number;
  /** Seconds remaining */
  remainingSeconds: number;
  /** Whether the timer is paused */
  paused: boolean;
}

// ─── Animated SVG circle ─────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Component ───────────────────────────────────────────────────────────────

export function RestTimerRing({
  durationSeconds,
  remainingSeconds,
  paused,
}: RestTimerRingProps) {
  const animatedOffset = useRef(new Animated.Value(0)).current;

  // Animate the arc offset when remaining changes
  useEffect(() => {
    if (durationSeconds <= 0) return;
    const progress = 1 - remainingSeconds / durationSeconds;
    const target = CIRCUMFERENCE * Math.min(1, Math.max(0, progress));

    Animated.timing(animatedOffset, {
      toValue: target,
      duration: paused ? 0 : 300,
      useNativeDriver: false,
    }).start();
  }, [remainingSeconds, durationSeconds, paused]);

  const colorName = getTimerColor(remainingSeconds);
  const ringColor =
    colorName === 'green'
      ? colors.semantic.positive
      : colorName === 'yellow'
        ? colors.semantic.warning
        : colors.semantic.negative;

  return (
    <View style={styles.container}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Background track */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          stroke={colors.border.default}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress arc */}
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

      {/* Center text */}
      <View style={styles.centerText}>
        <Text style={[styles.timeText, { color: ringColor }]}>
          {formatRestTimer(remainingSeconds)}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
  },
});
