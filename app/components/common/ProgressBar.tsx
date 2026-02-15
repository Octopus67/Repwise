import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '../../theme/tokens';
import { computeBarFill } from '../../utils/progressBarLogic';

interface ProgressBarProps {
  value: number;
  target: number;
  color: string;
  trackColor: string;
  showPercentage?: boolean;
  height?: number;
}

export function ProgressBar({
  value,
  target,
  color,
  trackColor,
  showPercentage = true,
  height = 6,
}: ProgressBarProps) {
  const fill = computeBarFill(value, target, color);
  const widthProgress = useSharedValue(0);

  useEffect(() => {
    widthProgress.value = withTiming(fill.percentage, {
      duration: 400,
      easing: Easing.out(Easing.ease),
    });
  }, [fill.percentage]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${widthProgress.value}%` as any,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        <View style={[styles.track, { height, backgroundColor: trackColor }]}>
          <Animated.View
            style={[
              styles.fill,
              { height, backgroundColor: fill.fillColor },
              animatedFillStyle,
            ]}
          />
        </View>
        {showPercentage && (
          <Text style={styles.label}>{fill.label}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  track: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 4,
  },
  label: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    minWidth: 32,
    textAlign: 'right',
  },
});
