import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card } from '../common/Card';
import { usePressAnimation } from '../../hooks/usePressAnimation';
import { colors, typography, spacing } from '../../theme/tokens';
import { Icon, IconName } from '../common/Icon';

interface QuickActionButtonProps {
  icon: IconName;
  label: string;
  accentColor: string;
  completed: boolean;
  onPress: () => void;
}

export function QuickActionButton({
  icon,
  label,
  accentColor,
  completed,
  onPress,
}: QuickActionButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.7}
      >
        <Card style={[styles.card, { borderLeftColor: accentColor }]}>
          <View style={styles.iconArea}>
            <Icon name={icon} size={24} color={accentColor} />
          </View>
          <Text style={styles.label}>{label}</Text>
          {completed && (
            <View style={styles.badge} testID="checkmark-badge">
              <Icon name="check" size={12} color={colors.semantic.positive} />
            </View>
          )}
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
    position: 'relative' as const,
  },
  iconArea: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.semantic.positive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {},
});
