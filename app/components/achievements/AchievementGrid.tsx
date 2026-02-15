import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { AchievementCard } from './AchievementCard';
import { Skeleton } from '../common/Skeleton';
import api from '../../services/api';

interface AchievementItem {
  definition: {
    id: string;
    category: string;
    title: string;
    description: string;
    icon: string;
    threshold: number;
  };
  unlocked: boolean;
  unlocked_at: string | null;
  progress: number | null;
  current_value: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  pr_badge: 'Personal Records',
  streak: 'Streaks',
  volume: 'Volume Milestones',
  nutrition: 'Nutrition',
};

export function groupAchievementsByCategory(
  items: AchievementItem[]
): { category: string; label: string; data: AchievementItem[] }[] {
  const map = new Map<string, AchievementItem[]>();
  for (const item of items) {
    const cat = item.definition.category;
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return Array.from(map.entries()).map(([category, data]) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    data,
  }));
}

export function AchievementGrid() {
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const numColumns = width > 500 ? 4 : 3;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('achievements/');
        setAchievements(data);
      } catch {
        // graceful degradation
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.skeletonRow}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={90} height={100} borderRadius={12} />
        ))}
      </View>
    );
  }

  if (achievements.length === 0) {
    return <Text style={styles.empty}>No achievements yet. Start training!</Text>;
  }

  const groups = groupAchievementsByCategory(achievements);

  return (
    <View>
      {groups.map((group) => (
        <View key={group.category} style={styles.section}>
          <Text style={styles.sectionTitle}>{group.label}</Text>
          <FlatList
            data={group.data}
            keyExtractor={(item) => item.definition.id}
            numColumns={numColumns}
            scrollEnabled={false}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <View style={{ flex: 1, maxWidth: `${100 / numColumns}%` }}>
                <AchievementCard
                  definition={item.definition}
                  unlocked={item.unlocked}
                  unlockedAt={item.unlocked_at}
                  progress={item.progress}
                />
              </View>
            )}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  empty: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing[4],
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    gap: spacing[1],
  },
});
