import { useEffect } from 'react';
import { View, Text, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTooltipStore } from '../../store/tooltipStore';
import { radius, spacing, typography, shadows, motion } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface TooltipProps {
  tooltipId: string;
  text: string;
  children: React.ReactNode;
}

export const Tooltip = ({ tooltipId, text, children }: TooltipProps) => {
  const opacity = useSharedValue(0);
  const reduceMotion = useReduceMotion();
  const { isDismissed, dismiss } = useTooltipStore();

  const dismissed = isDismissed(tooltipId);

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (!dismissed) {
      if (reduceMotion) {
        opacity.value = 1;
      } else {
        opacity.value = withTiming(1, { duration: motion.duration.default });
      }
    }
  }, [dismissed, reduceMotion]);

  if (dismissed) return <>{children}</>;

  return (
    <View style={getStyles().container}>
      {children}
      <TouchableWithoutFeedback onPress={() => dismiss(tooltipId)}>
        <Animated.View style={[getStyles().bubble, animatedBubbleStyle]}>
          <Text style={getStyles().text}>{text}</Text>
          <View style={getStyles().arrow} />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginBottom: spacing[1],
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.default,
    borderRadius: radius.sm,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    ...shadows.md,
  },
  text: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  arrow: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: c.bg.surfaceRaised,
  },
});
