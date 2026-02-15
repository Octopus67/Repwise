import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Skeleton } from '../common/Skeleton';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import type { QuickRelogItem } from '../../utils/quickRelogLogic';

interface QuickRelogRowProps {
  items: QuickRelogItem[];
  onTapItem: (item: QuickRelogItem) => void;
  loading?: boolean;
}

export function QuickRelogRow({ items, onTapItem, loading }: QuickRelogRowProps) {
  // AC7: Hidden entirely for brand-new users with no logging history
  if (items.length === 0 && !loading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>⚡ Quick Re-log</Text>

      {loading ? (
        <View style={styles.skeletonRow}>
          <Skeleton width={100} height={44} borderRadius={8} />
          <Skeleton width={100} height={44} borderRadius={8} />
          <Skeleton width={100} height={44} borderRadius={8} />
        </View>
      ) : (
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {items.map((item, index) => (
            <TouchableOpacity
              key={`${item.name}-${index}`}
              style={styles.chip}
              onPress={() => onTapItem(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipName} numberOfLines={1}>
                {item.name.slice(0, 12)}
              </Text>
              <Text style={styles.chipCalories}>
                {Math.round(item.calories) + ' cal'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  sectionLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing[2],
    paddingHorizontal: spacing[4],
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  chip: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  chipName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  chipCalories: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
});
