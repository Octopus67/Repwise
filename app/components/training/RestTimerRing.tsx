/**
 * RestTimerRing — SVG circular progress arc for rest timer.
 *
 * Renders a ring that depletes as time passes, with color transitions:
 *   green (>10s) → yellow (5-10s) → red (≤5s)
 *
 * Center text shows remaining time in M:SS format.
 * Accepts optional `size` prop for compact rendering (e.g. in RestTimerBar).
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import { getTimerColor } from '../../utils/restDurationV2';
import { formatRestTimer } from '../../utils/durationFormat';
import { colors, typography } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

export { getTimerColor };

// ─── Default geometry (backward compat) ──────────────────────────────────────

const DEFAULT_SIZE = 220;
const STROKE_WIDTH = 12;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface RestTimerRingProps {
  /** Total rest duration in seconds */
  durationSeconds: number;
  /** Seconds remaining */
  remainingSeconds: number;
  /** Whether the timer is paused */
  paused: boolean;
  /** Ring diameter in px (default 220) */
  size?: number;
}

// ─── Animated SVG circle ─────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Component ───────────────────────────────────────────────────────────────

export function RestTimerRing({
  durationSeconds,
  remainingSeconds,
  paused,
  size = DEFAULT_SIZE,
}: RestTimerRingProps) {
  // Geometry derived from size prop
  const strokeWidth = Math.round(size * STROKE_WIDTH / DEFAULT_SIZE);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;
  const compact = size < 80;
  const reduceMotion = useReduceMotion();

  const animatedOffset = useSharedValue(0);

  // Animate the arc offset when remaining changes
  useEffect(() => {
    if (durationSeconds <= 0) return;
    const progress = 1 - remainingSeconds / durationSeconds;
    const target = circumference * Math.min(1, Math.max(0, progress));

    if (reduceMotion || paused) {
      animatedOffset.value = target;
    } else {
      animatedOffset.value = withTiming(target, { duration: 300 });
    }
  }, [remainingSeconds, durationSeconds, paused, circumference, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedOffset.value,
  }));

  const colorName = getTimerColor(remainingSeconds);
  const ringColor =
    colorName === 'green'
      ? colors.semantic.positive
      : colorName === 'yellow'
        ? colors.semantic.warning
        : colors.semantic.negative;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={colors.border.default}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      {/* Center text — hidden in compact mode (time shown externally) */}
      {!compact && (
        <View style={styles.centerText}>
          <Text style={[styles.timeText, { color: ringColor }]}>
            {formatRestTimer(remainingSeconds)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
