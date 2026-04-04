import { useEffect, memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Platform } from 'react-native';
import { typography, springs, spacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { computeRingFill, formatRingLabel } from '../../utils/progressRingLogic';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const isWeb = Platform.OS === 'web';
const AnimatedCircle = isWeb ? Circle : Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  value: number;
  target: number;
  color: string;
  trackColor: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  animated?: boolean;
  onTargetMissing?: () => void;
}

export const ProgressRing = memo(function ProgressRing({
  value,
  target,
  color,
  trackColor,
  size = 96,
  strokeWidth = 8,
  label,
  animated = true,
  onTargetMissing,
}: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;

  const fill = computeRingFill(value, target, color);
  const ringLabel = formatRingLabel(value, target, label);
  const reduceMotion = useReduceMotion();
  const c = useThemeColors();

  const progress = useSharedValue(0);

  const [animatedValue, setAnimatedValue] = useState(0);

  useAnimatedReaction(
    () => progress.value,
    (val) => {
      runOnJS(setAnimatedValue)(Math.round(val * (target || 1)));
    },
  );

  useEffect(() => {
    if (animated && !fill.isMissing && !reduceMotion) {
      progress.value = 0;
      const target = fill.percentage / 100;
      progress.value = Platform.OS === 'web'
        ? withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) })
        : withSpring(target, springs.gentle);

      // DEV-only: warn if spring takes >1s to settle (native only, web uses deterministic withTiming)
      if (__DEV__ && Platform.OS !== 'web') {
        const springStart = Date.now();
        const checkSettled = setTimeout(() => {
          const elapsed = Date.now() - springStart;
          if (elapsed >= 1000) {
            console.warn(`[ProgressRing] Spring animation for "${label}" took >1s to settle — potential performance issue`);
          }
        }, 1000);
        return () => clearTimeout(checkSettled);
      }
    } else {
      // Reduce-motion or not animated: set directly, no spring
      progress.value = fill.isMissing ? 0 : fill.percentage / 100;
    }
  }, [fill.percentage, fill.isMissing, animated, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const percentage = fill.isMissing ? 0 : fill.percentage;

  return (
    <View
      style={[getStyles().container, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: percentage,
        text: `${label}: ${value} of ${target}, ${percentage}%`,
      }}
    >
      <Svg width={size} height={size}>
        {/* Track circle */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Fill circle */}
        {!fill.isMissing && (
          isWeb ? (
            <Circle
              cx={center}
              cy={center}
              r={r}
              stroke={fill.fillColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - (fill.percentage / 100))}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          ) : (
            <AnimatedCircle
              cx={center}
              cy={center}
              r={r}
              stroke={fill.fillColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              animatedProps={animatedProps}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          )
        )}
      </Svg>
      <View style={getStyles().labelContainer}>
        {fill.isMissing ? (
          <TouchableOpacity onPress={onTargetMissing}>
            <Text style={getStyles().setTargetsText}>Set targets</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text
              style={[
                getStyles().centerText,
                fill.isOvershoot && { color: c.semantic.warning },
              ]}
            >
              {animated && !reduceMotion ? animatedValue : ringLabel.centerText}
            </Text>
            <Text style={getStyles().subText}>{ringLabel.subText}</Text>
          </>
        )}
      </View>
    </View>
  );
});

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  subText: {
    color: c.text.muted,
    fontSize: typography.size.xs,
  },
  setTargetsText: {
    color: c.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
