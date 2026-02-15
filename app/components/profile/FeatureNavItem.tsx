import { ReactNode } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '../../hooks/usePressAnimation';
import { colors, typography, spacing } from '../../theme/tokens';

interface FeatureNavItemProps {
  icon: ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  testID?: string;
}

export function FeatureNavItem({ icon, label, description, onPress, testID }: FeatureNavItemProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.7}
        testID={testID}
      >
        <View style={styles.iconWrap}>{icon}</View>
        <View style={styles.content}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
  },
  description: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    marginTop: spacing[1],
  },
  chevron: {
    fontSize: typography.size.md,
    color: colors.text.muted,
    marginLeft: spacing[2],
  },
});
