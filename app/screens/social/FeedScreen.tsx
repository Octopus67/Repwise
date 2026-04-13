import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';
import { Skeleton } from '../../components/common/Skeleton';
import { FeedCard, type FeedEvent } from '../../components/social/FeedCard';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import { useStore } from '../../store';

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
  const user = useStore((st) => st.user);
  const navigation = useNavigation<any>();

  const handleFeedCardPress = useCallback((event: FeedEvent) => {
    if (event.event_type === 'workout_completed' && event.id) {
      navigation.navigate('Home', { screen: 'SessionDetail', params: { sessionId: event.id } });
    }
  }, [navigation]);

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

  // ── Compose post ──
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [postText, setPostText] = useState('');

  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post('social/feed', { content, post_type: 'text' });
      return data;
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previous = queryClient.getQueryData(['feed']);
      const optimistic: FeedEvent = {
        id: `temp-${Date.now()}`,
        event_type: 'post',
        summary: content,
        created_at: new Date().toISOString(),
        reaction_count: 0,
        user_reacted: false,
        user: { id: user?.id ?? '', display_name: 'You', avatar_url: null },
      };
      queryClient.setQueryData(['feed'], (old: InfiniteData<FeedPage> | undefined) => {
        if (!old?.pages?.length) return old;
        const first = { ...old.pages[0], events: [optimistic, ...old.pages[0].events] };
        return { ...old, pages: [first, ...old.pages.slice(1)] };
      });
      return { previous };
    },
    onError: (_err, _content, context) => {
      if (context?.previous) queryClient.setQueryData(['feed'], context.previous);
    },
    onSuccess: () => {
      setPostText('');
      setComposing(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handlePost = useCallback(() => {
    const trimmed = postText.trim();
    if (!trimmed) return;
    postMutation.mutate(trimmed);
  }, [postText, postMutation]);

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
      {/* Compose area */}
      {composing && (
        <View style={[s.composeBox, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
          <TextInput
            style={[s.composeInput, { color: c.text.primary, borderColor: c.border.default }]}
            placeholder="What's on your mind?"
            placeholderTextColor={c.text.muted}
            value={postText}
            onChangeText={setPostText}
            multiline
            maxLength={500}
            autoFocus
          />
          <View style={s.composeActions}>
            <TouchableOpacity onPress={() => { setComposing(false); setPostText(''); }}>
              <Text style={{ color: c.text.muted }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePost}
              disabled={!postText.trim() || postMutation.isPending}
              style={[s.postBtn, { backgroundColor: postText.trim() ? c.accent.primary : c.border.default }]}
            >
              {postMutation.isPending ? (
                <ActivityIndicator size="small" color={c.text.onAccent} />
              ) : (
                <Text style={s.postBtnText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedCard event={item} onPress={handleFeedCardPress} />}
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
            <Icon name="heart" size={48} color={c.text.muted} />
            <Text style={s.emptyTitle}>No activity yet</Text>
            <Text style={s.emptyText}>Follow friends to see their workouts</Text>
          </View>
        }
        accessibilityLabel="Activity feed"
      />
      {/* FAB */}
      {!composing && (
        <TouchableOpacity
          style={[s.fab, { backgroundColor: c.accent.primary }]}
          onPress={() => setComposing(true)}
          accessibilityLabel="Create post"
          accessibilityRole="button"
        >
          <Text style={s.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg.base },
    container: { padding: spacing[4] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[16] },
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
    composeBox: {
      padding: spacing[4],
      borderBottomWidth: 1,
    },
    composeInput: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing[3],
      fontSize: typography.size.sm,
      minHeight: 80,
      textAlignVertical: 'top',
      marginBottom: spacing[3],
    },
    composeActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    postBtn: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radius.md,
      minWidth: 60,
      alignItems: 'center',
    },
    postBtnText: {
      color: c.text.onAccent,
      fontWeight: typography.weight.semibold,
      fontSize: typography.size.sm,
    },
    fab: {
      position: 'absolute',
      bottom: spacing[6],
      right: spacing[4],
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
        android: { elevation: 6 },
        default: {},
      }),
    },
    fabIcon: {
      color: c.text.onAccent,
      fontSize: 28,
      fontWeight: typography.weight.bold,
      lineHeight: 30,
    },
  });
