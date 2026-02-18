import { ReactNode } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, radius, spacing, typography, letterSpacing, shadows, opacityScale } from '../../theme/tokens';
import { usePressAnimation } from '../../hooks/usePressAnimation';
import { useHoverState } from '../../hooks/useHoverState';
import { useHaptics } from '../../hooks/useHaptics';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * Returns computed styles for a given button variant and disabled state.
 * Exported for testing (Property 8).
 */
export function getButtonStyles(
  variant: ButtonVariant,
  disabled: boolean,
): { container: ViewStyle; text: TextStyle } {
  const container: ViewStyle = {
    ...baseStyle,
  };
  const text: TextStyle = {
    ...baseTextStyle,
  };

  switch (variant) {
    case 'primary':
      container.backgroundColor = colors.accent.primary;
      Object.assign(container, shadows.md);
      text.color = colors.text.primary;
      break;
    case 'secondary':
      container.backgroundColor = 'transparent';
      container.borderWidth = 1;
      container.borderColor = colors.border.default;
      text.color = colors.accent.primary;
      break;
    case 'ghost':
      container.backgroundColor = 'transparent';
      text.color = colors.accent.primary;
      break;
    case 'danger':
      container.backgroundColor = colors.semantic.negativeSubtle;
      container.borderWidth = 1;
      container.borderColor = colors.semantic.negative;
      text.color = colors.semantic.negative;
      break;
  }

  if (disabled) {
    container.opacity = opacityScale.disabled;
  }

  return { container, text };
}


const baseStyle: ViewStyle = {
  borderRadius: radius.lg,
  paddingVertical: spacing[3],
  paddingHorizontal: spacing[6],
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
};

const baseTextStyle: TextStyle = {
  color: colors.text.primary,
  fontSize: typography.size.base,
  fontWeight: typography.weight.semibold,
  letterSpacing: letterSpacing.wide,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();
  const { isHovered, hoverProps } = useHoverState();
  const { impact } = useHaptics();
  const computed = getButtonStyles(variant, isDisabled);

  const handlePress = () => {
    if (variant === 'primary') {
      impact('light');
    }
    onPress();
  };

  const hoverStyle: ViewStyle | undefined =
    isHovered && !isDisabled
      ? { borderWidth: 1, borderColor: colors.border.hover }
      : undefined;

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        testID={testID}
        style={[computed.container, hoverStyle, style]}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        {...hoverProps}
      >
        {loading ? (
          <ActivityIndicator color={colors.text.primary} size="small" />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.icon}>{icon}</View>}
            <Text style={[computed.text, textStyle]}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing[2],
  },
});
