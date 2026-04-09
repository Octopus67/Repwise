import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { FollowButton } from '../../components/social/FollowButton';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';

interface UserResult {
  id: string;
  display_name: string;
  is_following: boolean;
}

/** User discovery screen for finding and following other users. */
export function DiscoverScreen() {
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['social-discover', debouncedQuery],
    queryFn: async () => {
      const { data: results } = await api.get('social/discover', { params: { q: query, limit: 20 } });
      return results as UserResult[];
    },
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      <View style={[styles.searchBox, { borderColor: c.border.default }]}>
        <Icon name="search" size={18} color={c.text.muted} />
        <TextInput
          style={[styles.input, { color: c.text.primary }]}
          placeholder="Search users..."
          placeholderTextColor={c.text.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>
      {isLoading && <ActivityIndicator style={{ marginTop: spacing[8] }} color={c.accent.primary} />}
      {isError && <Text style={{ textAlign: 'center', marginTop: spacing[8], color: c.semantic.negative }}>Failed to search. Try again.</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: c.border.subtle }]}>
            <View style={[styles.avatar, { backgroundColor: c.accent.primaryMuted }]}>
              <Text style={[styles.initial, { color: c.accent.primary }]}>
                {(item.display_name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.name, { color: c.text.primary }]} numberOfLines={1}>
              {item.display_name}
            </Text>
            <FollowButton userId={item.id} isFollowing={item.is_following} />
          </View>
        )}
        ListEmptyComponent={
          query.length >= 2 && !isLoading ? (
            <Text style={[styles.empty, { color: c.text.muted }]}>No users found</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderRadius: radius.md, margin: spacing[4], paddingHorizontal: spacing[3], gap: spacing[2],
  },
  input: { flex: 1, paddingVertical: spacing[3], fontSize: typography.size.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4],
    paddingVertical: spacing[3], borderBottomWidth: 1, gap: spacing[3],
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  initial: { fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  name: { flex: 1, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  empty: { textAlign: 'center', marginTop: spacing[8], fontSize: typography.size.sm },
});
