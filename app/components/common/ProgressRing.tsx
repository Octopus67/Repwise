import { useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
} from 'react-native-reanimated';
import { colors, typography, springs } from '../../theme/tokens';
import { computeRingFill, formatRingLabel } from '../../utils/progressRingLogic';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

  const progress = useSharedValue(0);

  useEffect(() => {
    if (animated && !fill.isMissing) {
      progress.value = 0;
      progress.value = withSpring(fill.percentage / 100, springs.gentle);
    } else {
      progress.value = fill.isMissing ? 0 : fill.percentage / 100;
    }
  }, [fill.percentage, fill.isMissing, animated]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
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
        )}
      </Svg>
      <View style={styles.labelContainer}>
        {fill.isMissing ? (
          <TouchableOpacity onPress={onTargetMissing}>
            <Text style={styles.setTargetsText}>Set targets</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text
              style={[
                styles.centerText,
                fill.isOvershoot && { color: colors.semantic.warning },
              ]}
            >
              {ringLabel.centerText}
            </Text>
            <Text style={styles.subText}>{ringLabel.subText}</Text>
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  subText: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
  },
  setTargetsText: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
