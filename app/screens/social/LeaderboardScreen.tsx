import React, { useState } from 'react';
import { getLocalDateString } from '../../utils/localDate';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';
import { LeaderboardRow, type LeaderboardEntry } from '../../components/social/LeaderboardRow';
import { useStore } from '../../store';
import api from '../../services/api';

type BoardType = 'weekly_volume' | 'streak' | 'exercise_1rm';

const TABS: { key: BoardType; label: string }[] = [
  { key: 'weekly_volume', label: 'Weekly Volume' },
  { key: 'streak', label: 'Streak' },
  { key: 'exercise_1rm', label: '1RM' },
];

export function LeaderboardScreen() {
  const c = useThemeColors();
  const s = styles(c);
  const [boardType, setBoardType] = useState<BoardType>('weekly_volume');
  const userId = useStore((st) => st.user?.id);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leaderboard', boardType],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const now = new Date();
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      const periodStart = getLocalDateString(monday);
      const { data } = await api.get<{ entries: LeaderboardEntry[] }>(
        `social/leaderboard/${boardType}`,
        { params: { period_start: periodStart } },
      );
      return data.entries;
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.tabs} accessibilityRole="tablist">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, boardType === tab.key && s.tabActive]}
            onPress={() => setBoardType(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: boardType === tab.key }}
            accessibilityLabel={tab.label}
          >
            <Text style={[s.tabText, boardType === tab.key && s.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing[8] }} color={c.accent.primary} />
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load leaderboard</Text>
          <Text style={[s.errorText, { color: c.accent.primary }]} onPress={() => refetch()}>
            Tap to retry
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => `${item.rank}-${item.user.id}`}
          renderItem={({ item }) => (
            <LeaderboardRow entry={item} isCurrentUser={item.user.id === userId} />
          )}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={c.accent.primary} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.errorText}>No entries yet</Text>
            </View>
          }
          accessibilityLabel={`${TABS.find((t) => t.key === boardType)?.label} leaderboard`}
        />
      )}
    </SafeAreaView>
  );
}

const styles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg.base },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      gap: spacing[2],
    },
    tab: {
      flex: 1,
      paddingVertical: spacing[2],
      borderRadius: radius.sm,
      backgroundColor: c.bg.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border.subtle,
    },
    tabActive: {
      backgroundColor: c.accent.primaryMuted,
      borderColor: c.accent.primary,
    },
    tabText: {
      color: c.text.secondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
      lineHeight: typography.lineHeight.sm,
    },
    tabTextActive: { color: c.accent.primary, fontWeight: typography.weight.semibold },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[8] },
    errorText: {
      color: c.text.muted,
      fontSize: typography.size.sm,
      textAlign: 'center',
      lineHeight: typography.lineHeight.sm,
    },
  });
