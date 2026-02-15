import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from '../common/Icon';

interface PremiumBadgeProps {
  size?: 'sm' | 'md';
}

export function PremiumBadge({ size = 'sm' }: PremiumBadgeProps) {
  return (
    <View style={[styles.badge, size === 'md' && styles.badgeMd]}>
      <Icon name="star" size={14} color={colors.premium.gold} />
      <Text style={[styles.label, size === 'md' && styles.labelMd]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.premium.goldSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    gap: 2,
  },
  badgeMd: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    gap: 4,
  },
  icon: {},
  iconMd: {},
  label: {
    color: colors.premium.gold,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  labelMd: {
    fontSize: typography.size.sm,
  },
});
