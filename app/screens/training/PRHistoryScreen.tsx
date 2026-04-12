import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { Skeleton } from '../../components/common/Skeleton';
import { Icon } from '../../components/common/Icon';
import { convertWeight } from '../../utils/unitConversion';
import { useStore } from '../../store';
import api from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PRRecord {
  id: string;
  exercise_name: string;
  pr_type: string;
  reps: number;
  value_kg: number;
  previous_value_kg: number | null;
  session_id: string | null;
  achieved_at: string;
}

function getPRTypeColor(prType: string, c: ThemeColors): string {
  switch (prType) {
    case 'weight': return c.semantic.positive;
    case 'reps': return c.accent.primary;
    case 'volume': return c.semantic.warning;
    case 'e1rm': return c.premium.gold;
    default: return c.accent.primary;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PRHistoryScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const unitSystem = useStore((s) => s.unitSystem);
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  const [records, setRecords] = useState<PRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;

  const fetchPRs = useCallback(async (offset = 0) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const { data } = await api.get('training/personal-records', { params: { limit: PAGE_SIZE, offset } });
      const items: PRRecord[] = Array.isArray(data) ? data : data.items ?? [];
      setRecords((prev) => offset === 0 ? items : [...prev, ...items]);
      setHasMore(items.length >= PAGE_SIZE);
    } catch (err) {
      console.error('[PRHistory] Load failed:', err);
      setError('Failed to load personal records');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchPRs(); }, [fetchPRs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPRs();
    setRefreshing(false);
  }, [fetchPRs]);

  const exerciseNames = useMemo(
    () => [...new Set(records.map((r) => r.exercise_name))].sort(),
    [records],
  );

  const grouped = useMemo(() => {
    const filtered = filter ? records.filter((r) => r.exercise_name === filter) : records;
    const map = new Map<string, PRRecord[]>();
    for (const r of filtered) {
      const list = map.get(r.exercise_name) ?? [];
      list.push(r);
      map.set(r.exercise_name, list);
    }
    return [...map.entries()];
  }, [records, filter]);

  // ─── Header ──────────────────────────────────────────────────────────────

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Icon name="chevron-left" />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: c.text.primary }]}>PR History</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        {header}
        <View style={styles.content}>
          <Skeleton width="100%" height={48} borderRadius={8} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={120} borderRadius={8} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={120} borderRadius={8} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        {header}
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" />
          <Text style={[styles.errorText, { color: c.text.secondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: c.accent.primaryMuted }]} onPress={() => fetchPRs()}>
            <Text style={[styles.retryText, { color: c.accent.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Empty ───────────────────────────────────────────────────────────────

  if (records.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        {header}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}><Icon name="trophy" size={40} color={c.accent.primary} /></Text>
          <Text style={[styles.emptyText, { color: c.text.muted }]}>
            Hit the gym and set your first PR!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="pr-history-screen">
      {header}
      <FlatList
        data={grouped}
        keyExtractor={([exerciseName]) => exerciseName}
        contentContainerStyle={styles.content}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.chip, !filter && { backgroundColor: c.accent.primary }]}
              onPress={() => setFilter(null)}
            >
              <Text style={[styles.chipText, { color: !filter ? c.text.inverse : c.text.secondary }]}>All</Text>
            </TouchableOpacity>
            {exerciseNames.map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.chip, filter === name && { backgroundColor: c.accent.primary }]}
                onPress={() => setFilter(filter === name ? null : name)}
              >
                <Text style={[styles.chipText, { color: filter === name ? c.text.inverse : c.text.secondary }]} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        }
        renderItem={({ item: [exerciseName, prs] }) => (
          <Card key={exerciseName} style={styles.card}>
            <Text style={[styles.exerciseName, { color: c.text.primary }]}>{exerciseName}</Text>
            {prs.map((pr) => {
              const isWeightBased = pr.pr_type === 'weight' || pr.pr_type === 'e1rm';
              const displayVal = isWeightBased ? convertWeight(pr.value_kg, unitSystem) : pr.value_kg;
              const displayUnit = isWeightBased ? unitLabel : 'reps';
              const date = new Date(pr.achieved_at);
              const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              const badgeColor = getPRTypeColor(pr.pr_type, c);
              const delta = pr.previous_value_kg != null
                ? isWeightBased
                  ? convertWeight(pr.value_kg - pr.previous_value_kg, unitSystem)
                  : pr.value_kg - pr.previous_value_kg
                : null;

              return (
                <View key={pr.id} style={[styles.prRow, { borderBottomColor: c.border.subtle }]}>
                  <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                    <Text style={styles.badgeText}>{pr.pr_type}</Text>
                  </View>
                  <View style={styles.prInfo}>
                    <Text style={[styles.prValue, { color: c.text.primary }]}>
                      {displayVal} {displayUnit}
                      {pr.pr_type !== 'weight' ? '' : ` × ${pr.reps}`}
                    </Text>
                    {delta != null && (
                      <Text style={[styles.delta, { color: delta >= 0 ? c.semantic.positive : c.semantic.negative }]}>
                        {delta >= 0 ? '+' : ''}{delta} {displayUnit}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.prDate, { color: c.text.muted }]}>{dateStr}</Text>
                </View>
              );
            })}
          </Card>
        )}
        ListFooterComponent={hasMore ? (
          <TouchableOpacity
            style={[styles.loadMoreBtn, { backgroundColor: c.bg.surface }]}
            onPress={() => fetchPRs(records.length)}
            disabled={loadingMore}
          >
            <Text style={[styles.loadMoreText, { color: c.accent.primary }]}>
              {loadingMore ? 'Loading…' : 'Load More'}
            </Text>
          </TouchableOpacity>
        ) : null}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  headerSpacer: { width: 32 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  filterRow: { marginBottom: spacing[4] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: c.bg.surface,
    marginRight: spacing[2],
  },
  chipText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  card: { marginBottom: spacing[3] },
  exerciseName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    gap: spacing[2],
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    color: c.text.inverse,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase' as const,
  },
  prInfo: { flex: 1 },
  prValue: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  delta: { fontSize: typography.size.xs },
  prDate: { fontSize: typography.size.xs },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  errorText: { fontSize: typography.size.md, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
  },
  retryText: { fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing[3] },
  emptyText: { fontSize: typography.size.base, textAlign: 'center' },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[3],
  },
  loadMoreText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
