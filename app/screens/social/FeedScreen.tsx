import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';
import { Skeleton } from '../../components/common/Skeleton';
import { FeedCard, type FeedEvent } from '../../components/social/FeedCard';
import api from '../../services/api';

interface FeedPage {
  events: FeedEvent[];
  next_cursor: string | null;
}

async function fetchFeed({ pageParam }: { pageParam?: { cursor_time: string; cursor_id: string } }): Promise<FeedPage> {
  const params: Record<string, string> = { limit: '20' };
  if (pageParam) {
    params.cursor_time = pageParam.cursor_time;
    params.cursor_id = pageParam.cursor_id;
  }
  const { data } = await api.get<FeedPage>('social/feed', { params });
  return data;
}

export function FeedScreen() {
  const c = useThemeColors();
  const s = styles(c);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
    initialPageParam: undefined as { cursor_time: string; cursor_id: string } | undefined,
    getNextPageParam: (last) => {
      if (!last.events.length) return undefined;
      const lastEvent = last.events[last.events.length - 1];
      return { cursor_time: lastEvent.created_at, cursor_id: lastEvent.id };
    },
  });

  const events = data?.pages.flatMap((p) => p.events) ?? [];

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.container}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: spacing[3] }}>
              <Skeleton width="100%" height={120} borderRadius={12} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <Text style={s.emptyText}>Something went wrong.</Text>
          <Text style={[s.emptyText, { color: c.accent.primary }]} onPress={() => refetch()}>
            Tap to retry
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedCard event={item} />}
        contentContainerStyle={s.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.accent.primary} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={{ padding: spacing[4] }} color={c.accent.primary} />
          ) : null
        }
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={s.emptyEmoji}>👥</Text>
            <Text style={s.emptyTitle}>No activity yet</Text>
            <Text style={s.emptyText}>Follow friends to see their workouts</Text>
          </View>
        }
        accessibilityLabel="Activity feed"
      />
    </SafeAreaView>
  );
}

const styles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg.base },
    container: { padding: spacing[4] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[16] },
    emptyEmoji: { fontSize: 48, marginBottom: spacing[3] },
    emptyTitle: {
      color: c.text.primary,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.semibold,
      marginBottom: spacing[2],
      lineHeight: typography.lineHeight.lg,
    },
    emptyText: {
      color: c.text.muted,
      fontSize: typography.size.sm,
      textAlign: 'center',
      lineHeight: typography.lineHeight.sm,
    },
  });
