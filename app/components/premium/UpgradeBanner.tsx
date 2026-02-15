import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from '../common/Icon';

interface UpgradeBannerProps {
  onPress: () => void;
}

export function UpgradeBanner({ onPress }: UpgradeBannerProps) {
  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.content}>
        <Icon name="star" size={16} color={colors.premium.gold} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Unlock Premium</Text>
          <Text style={styles.subtitle}>
            Coaching, advanced analytics, health reports & more
          </Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  icon: {},
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginTop: 2,
  },
  arrow: {
    color: colors.accent.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
});
