import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { SwipeableRow } from '../../components/common/SwipeableRow';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { CopyMealsBar } from '../../components/nutrition/CopyMealsBar';
import { BudgetBar } from '../../components/nutrition/BudgetBar';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { AddNutritionModal } from '../../components/modals/AddNutritionModal';
import { AddTrainingModal } from '../../components/modals/AddTrainingModal';
import { formatEntryTime } from '../../utils/timestampFormat';
import { hasMorePages } from '../../utils/pagination';
import { groupSessionsByDate } from '../../utils/sessionGrouping';
import { sessionHasPR } from '../../utils/sessionEditConversion';
import { useStore } from '../../store';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import type { TrainingSessionResponse, WorkoutTemplateResponse } from '../../types/training';
import type { LogsStackParamList } from '../../navigation/BottomTabNavigator';

// ── New imports for redesign ────────────────────────────────────────────────
import { QuickRelogRow } from '../../components/log/QuickRelogRow';
import { CollapsibleSection } from '../../components/log/CollapsibleSection';
import { StartWorkoutCard } from '../../components/log/StartWorkoutCard';
import { TemplateRow } from '../../components/log/TemplateRow';
import { computeQuickRelogItems, QuickRelogItem } from '../../utils/quickRelogLogic';
import { groupEntriesBySlot, MealSlotName } from '../../utils/mealSlotLogic';
import type { NutritionEntry } from '../../utils/mealSlotLogic';

type Tab = 'nutrition' | 'training';

const TRAINING_PAGE_SIZE = 20;

import { isTrainingLogV2Enabled } from '../../utils/featureFlags';

function StaggeredCard({ index, children }: { index: number; children: React.ReactNode }) {
  const animatedStyle = useStaggeredEntrance(index, 40);
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

function SkeletonCards() {
  return (
    <View style={{ gap: spacing[3] }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width="100%" height={80} borderRadius={12} />
      ))}
    </View>
  );
}

export function LogsScreen() {
  const navigation = useNavigation<StackNavigationProp<LogsStackParamList>>();
  const [tab, setTab] = useState<Tab>('nutrition');
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [prefilledMealName, setPrefilledMealName] = useState<string | undefined>(undefined);

  // Training pagination state
  const [trainingSessions, setTrainingSessions] = useState<TrainingSessionResponse[]>([]);
  const [trainingPage, setTrainingPage] = useState(1);
  const [trainingTotalCount, setTrainingTotalCount] = useState(0);
  const [trainingLoadingMore, setTrainingLoadingMore] = useState(false);

  // ── New state: Quick Re-log, favorites, templates ─────────────────────────
  const [favorites, setFavorites] = useState<any[]>([]);
  const [recentEntries, setRecentEntries] = useState<NutritionEntry[]>([]);
  const [quickRelogItems, setQuickRelogItems] = useState<QuickRelogItem[]>([]);
  const [quickRelogLoading, setQuickRelogLoading] = useState(true);
  const [userTemplates, setUserTemplates] = useState<WorkoutTemplateResponse[]>([]);
  const [staticTemplates, setStaticTemplates] = useState<any[]>([]);

  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const adaptiveTargets = useStore((s) => s.adaptiveTargets);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formatDisplayDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const loadNutritionData = useCallback(async () => {
    try {
      const start = selectedDate;
      const end = selectedDate;
      const res = await api.get('nutrition/entries', { params: { start_date: start, end_date: end, limit: 50 } });
      setNutritionEntries(res.data.items ?? []);
    } catch {
      // best-effort
    }
  }, [selectedDate]);

  const loadTrainingPage = useCallback(async (page: number, replace: boolean) => {
    try {
      const res = await api.get('training/sessions', {
        params: { page, limit: TRAINING_PAGE_SIZE },
      });
      const items: TrainingSessionResponse[] = res.data.items ?? [];
      const totalCount: number = res.data.total_count ?? 0;

      if (replace) {
        setTrainingSessions(items);
      } else {
        setTrainingSessions((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newItems = items.filter((s) => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
      }
      setTrainingTotalCount(totalCount);
      setTrainingPage(page);
    } catch {
      // best-effort
    }
  }, []);

  const loadData = useCallback(async () => {
    // Compute 14-day window for Quick Re-log
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const recentStart = fourteenDaysAgo.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    setError(null);

    try {
      const [nutritionRes, trainingRes, favoritesRes, recentRes, userTemplatesRes, staticTemplatesRes] = await Promise.allSettled([
        loadNutritionData(),
        loadTrainingPage(1, true),
        api.get('meals/favorites', { params: { limit: 10 } }),
        api.get('nutrition/entries', { params: { start_date: recentStart, end_date: today, limit: 200 } }),
        api.get('training/user-templates'),
        api.get('training/templates'),
      ]);

      if (favoritesRes.status === 'fulfilled') setFavorites(favoritesRes.value.data.items ?? []);
      if (recentRes.status === 'fulfilled') setRecentEntries(recentRes.value.data.items ?? []);
      if (userTemplatesRes.status === 'fulfilled') setUserTemplates(userTemplatesRes.value.data ?? []);
      if (staticTemplatesRes.status === 'fulfilled') setStaticTemplates(staticTemplatesRes.value.data ?? []);
    } catch {
      setError('Unable to load logs. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [loadNutritionData, loadTrainingPage]);

  useEffect(() => { loadData(); }, [loadData, selectedDate]);

  // ── Compute Quick Re-log items when data changes ──────────────────────────
  useEffect(() => {
    const items = computeQuickRelogItems(recentEntries, favorites, 5);
    setQuickRelogItems(items);
    setQuickRelogLoading(false);
  }, [recentEntries, favorites]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadMoreTraining = useCallback(async () => {
    if (trainingLoadingMore) return;
    if (!hasMorePages(trainingTotalCount, trainingPage, TRAINING_PAGE_SIZE)) return;
    setTrainingLoadingMore(true);
    await loadTrainingPage(trainingPage + 1, false);
    setTrainingLoadingMore(false);
  }, [trainingLoadingMore, trainingTotalCount, trainingPage, loadTrainingPage]);

  const handleDeleteNutrition = async (id: string) => {
    try {
      await api.delete(`nutrition/entries/${id}`);
      setNutritionEntries((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore */ }
  };

  const handleDeleteTraining = async (id: string) => {
    try {
      await api.delete(`training/sessions/${id}`);
      setTrainingSessions((prev) => prev.filter((s) => s.id !== id));
    } catch { /* ignore */ }
  };

  // Group training sessions by date using utility
  const groupedTraining = groupSessionsByDate(trainingSessions);

  // Compute consumed totals for BudgetBar (selected day's entries)
  const todayEntries = nutritionEntries.filter((e) => e.entry_date === selectedDate);
  const consumed = todayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories ?? 0),
      protein_g: acc.protein_g + (e.protein_g ?? 0),
      carbs_g: acc.carbs_g + (e.carbs_g ?? 0),
      fat_g: acc.fat_g + (e.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const targets = adaptiveTargets ?? { calories: 2400, protein_g: 180, carbs_g: 250, fat_g: 65 };

  // ── Meal slot grouping ────────────────────────────────────────────────────
  const mealSlots = groupEntriesBySlot(todayEntries);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openAddModal = () => {
    if (tab === 'nutrition') {
      setPrefilledMealName(undefined);
      setShowNutritionModal(true);
    } else {
      if (isTrainingLogV2Enabled()) {
        navigation.push('ActiveWorkout', { mode: 'new' });
      } else {
        setShowTrainingModal(true);
      }
    }
  };

  const handleAddToSlot = (slotName: MealSlotName) => {
    setPrefilledMealName(slotName);
    setShowNutritionModal(true);
  };

  const handleQuickRelogTap = (item: QuickRelogItem) => {
    setPrefilledMealName(item.name);
    setShowNutritionModal(true);
  };

  const handleStartEmpty = () => {
    if (isTrainingLogV2Enabled()) {
      navigation.push('ActiveWorkout', { mode: 'new' });
    } else {
      setShowTrainingModal(true);
    }
  };

  const handleStartTemplate = (templateId: string) => {
    navigation.push('ActiveWorkout', { mode: 'template', templateId });
  };

  const handleNutritionModalClose = () => {
    setShowNutritionModal(false);
    setPrefilledMealName(undefined);
  };

  let cardIndex = 0;

  // Render a training session card (used by FlatList)
  const renderTrainingGroup = ({ item }: { item: { date: string; sessions: TrainingSessionResponse[] } }) => {
    return (
      <View key={item.date}>
        <Text style={styles.dateHeader}>
          {new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>
        {item.sessions.map((session) => {
          const idx = cardIndex++;
          const hasPR = sessionHasPR(session);
          return (
            <StaggeredCard key={session.id} index={idx}>
              <SwipeableRow onDelete={() => handleDeleteTraining(session.id)}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigation.push('SessionDetail', { sessionId: session.id })}
                >
                  <Card style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryName}>
                        {session.exercises?.length ?? 0} exercises
                      </Text>
                      {hasPR && (
                        <Icon name="star" size={16} color={colors.semantic.warning} />
                      )}
                    </View>
                    {session.exercises?.slice(0, 3).map((ex, i) => (
                      <Text key={i} style={styles.exerciseText}>
                        {ex.exercise_name} — {ex.sets.length} sets{ex.sets.length > 0 ? ` · ${ex.sets[0].weight_kg}kg × ${ex.sets[0].reps}` : ''}
                      </Text>
                    ))}
                    {(session.exercises?.length ?? 0) > 3 && (
                      <Text style={styles.moreText}>
                        +{(session.exercises?.length ?? 0) - 3} more
                      </Text>
                    )}
                  </Card>
                </TouchableOpacity>
              </SwipeableRow>
            </StaggeredCard>
          );
        })}
      </View>
    );
  };

  const trainingListFooter = () => {
    if (!trainingLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.accent.primary} />
      </View>
    );
  };

  // ── Training tab header (rendered above FlatList) ─────────────────────────
  const trainingListHeader = () => (
    <View>
      {/* Start Workout Card */}
      <StartWorkoutCard
        userTemplates={userTemplates}
        staticTemplates={staticTemplates}
        onStartEmpty={handleStartEmpty}
        onStartTemplate={handleStartTemplate}
      />

      {/* My Templates section — hidden if empty */}
      {userTemplates.length > 0 && (
        <CollapsibleSection title="My Templates" defaultExpanded={true}>
          <View style={{ gap: spacing[2] }}>
            {userTemplates.map((t) => (
              <TemplateRow
                key={t.id}
                name={t.name}
                exerciseCount={t.exercises.length}
                onStart={() => handleStartTemplate(t.id)}
              />
            ))}
            <TouchableOpacity
              style={styles.browseLink}
              onPress={() => {
                navigation.push('ActiveWorkout', { mode: 'template' });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.browseLinkText}>Browse all templates →</Text>
            </TouchableOpacity>
          </View>
        </CollapsibleSection>
      )}

      {/* Section header for session history */}
      {groupedTraining.length > 0 && (
        <Text style={[styles.dateHeader, { marginTop: spacing[4] }]}>Recent Sessions</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="logs-screen">
      <Text style={styles.title}>Logs</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'nutrition' && styles.tabActive]}
          onPress={() => setTab('nutrition')}
          testID="logs-nutrition-tab"
        >
          <Text style={[styles.tabText, tab === 'nutrition' && styles.tabTextActive]}>Nutrition</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'training' && styles.tabActive]}
          onPress={() => setTab('training')}
          testID="logs-training-tab"
        >
          <Text style={[styles.tabText, tab === 'training' && styles.tabTextActive]}>Training</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => changeDate(-1)}>
          <Text style={styles.dateArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
        <TouchableOpacity onPress={() => changeDate(1)}>
          <Text style={styles.dateArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={loadData}
          onDismiss={() => setError(null)}
        />
      )}

      {isLoading ? (
        <View style={[styles.list, styles.listContent]}>
          <SkeletonCards />
        </View>
      ) : tab === 'nutrition' ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
        >
          {/* 1. Quick Re-log row at top */}
          <QuickRelogRow
            items={quickRelogItems}
            onTapItem={handleQuickRelogTap}
            loading={quickRelogLoading}
          />

          {/* 2. BudgetBar (unchanged) */}
          <BudgetBar consumed={consumed} targets={targets} />

          {/* 3. Inline meal-slot rendering with swipe-to-delete */}
          {mealSlots.map((slot) => (
            <View key={slot.name} style={styles.slotContainer}>
              {/* Slot header */}
              <View style={styles.slotHeader}>
                <Text style={styles.slotName}>{slot.name}</Text>
                <Text style={styles.slotCalories}>
                  {Math.round(slot.totals.calories)} kcal
                </Text>
              </View>

              {/* Entries with swipe-to-delete */}
              {slot.entries.length > 0 ? (
                slot.entries.map((entry) => {
                  const idx = cardIndex++;
                  return (
                    <StaggeredCard key={entry.id} index={idx}>
                      <SwipeableRow onDelete={() => handleDeleteNutrition(entry.id)}>
                        <Card style={styles.entryCard}>
                          <View style={styles.entryHeader}>
                            <View style={styles.entryNameRow}>
                              <Text style={styles.entryName}>{entry.meal_name}</Text>
                              {entry.created_at && (
                                <Text style={styles.entryTimestamp}>
                                  {formatEntryTime(entry.created_at)}
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.macroRow}>
                            <MacroPill label="Cal" value={entry.calories} color={colors.chart.calories} />
                            <MacroPill label="P" value={entry.protein_g} color={colors.semantic.positive} />
                            <MacroPill label="C" value={entry.carbs_g} color={colors.semantic.warning} />
                            <MacroPill label="F" value={entry.fat_g} color={colors.semantic.negative} />
                          </View>
                        </Card>
                      </SwipeableRow>
                    </StaggeredCard>
                  );
                })
              ) : null}

              {/* Add button for slot — always visible */}
              <TouchableOpacity
                style={styles.slotAddButton}
                onPress={() => handleAddToSlot(slot.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.slotAddText}>+ Add to {slot.name}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* 4. Favorites section — collapsed if Quick Re-log has ≥3 items */}
          <CollapsibleSection
            title="★ Favorites"
            defaultExpanded={quickRelogItems.length < 3}
          >
            {favorites.length > 0 ? (
              <View style={{ gap: spacing[2] }}>
                {favorites.map((fav: any) => (
                  <TouchableOpacity
                    key={fav.id}
                    style={styles.favoriteRow}
                    onPress={() => {
                      setPrefilledMealName(fav.name);
                      setShowNutritionModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.favoriteName}>{fav.name}</Text>
                      <Text style={styles.favoriteMacros}>
                        {Math.round(fav.calories)} kcal
                      </Text>
                    </View>
                    <Text style={styles.favoriteLogBtn}>Log</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyFavText}>
                Star foods when logging to save them here
              </Text>
            )}
          </CollapsibleSection>

          {/* 5. CopyMealsBar at bottom */}
          <View style={{ marginTop: spacing[3] }}>
            <CopyMealsBar targetDate={selectedDate} onCopyComplete={loadData} />
          </View>
        </ScrollView>
      ) : (
        /* ── Training Tab ──────────────────────────────────────────────── */
        groupedTraining.length === 0 && userTemplates.length === 0 ? (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
          >
            {/* Start Workout card even in empty state */}
            <StartWorkoutCard
              userTemplates={userTemplates}
              staticTemplates={staticTemplates}
              onStartEmpty={handleStartEmpty}
              onStartTemplate={handleStartTemplate}
            />
            <View testID="logs-empty-state">
              <EmptyState
                icon={<Icon name="dumbbell" />}
                title="No training sessions yet"
                description="Tap Start Workout above or the + button to log your first workout"
                actionLabel="Log Training"
                onAction={handleStartEmpty}
              />
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={groupedTraining}
            keyExtractor={(item) => item.date}
            renderItem={renderTrainingGroup}
            ListHeaderComponent={trainingListHeader}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
            onEndReached={loadMoreTraining}
            onEndReachedThreshold={0.5}
            ListFooterComponent={trainingListFooter}
          />
        )
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={openAddModal}
        testID="logs-add-button"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddNutritionModal
        visible={showNutritionModal}
        onClose={handleNutritionModalClose}
        onSuccess={loadData}
        prefilledMealName={prefilledMealName}
      />
      {!isTrainingLogV2Enabled() && (
        <AddTrainingModal
          visible={showTrainingModal}
          onClose={() => setShowTrainingModal(false)}
          onSuccess={loadData}
        />
      )}
    </SafeAreaView>
  );
}

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[pillStyles.pill, { borderColor: color }]}>
      <Text style={[pillStyles.value, { color }]}>{Math.round(value)}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    alignItems: 'center',
    minWidth: 52,
  },
  value: { fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  label: { fontSize: typography.size.xs, color: colors.text.muted },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    padding: spacing[4],
    paddingBottom: spacing[2],
    lineHeight: typography.lineHeight.xl,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[1],
    marginBottom: spacing[2],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.accent.primaryMuted },
  tabText: { color: colors.text.muted, fontSize: typography.size.base, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.base },
  tabTextActive: { color: colors.accent.primary },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  dateArrow: {
    color: colors.accent.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    paddingHorizontal: spacing[3],
    minWidth: 44,
    minHeight: 44,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: typography.lineHeight['2xl'],
  },
  dateText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  list: { flex: 1 },
  listContent: { padding: spacing[4], paddingTop: 0, paddingBottom: spacing[12] },
  dateHeader: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[4],
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight.sm,
  },
  entryCard: { marginBottom: spacing[2] },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  entryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  entryName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  entryTimestamp: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
  macroRow: { flexDirection: 'row', gap: spacing[2] },
  exerciseText: { color: colors.text.secondary, fontSize: typography.size.sm, marginTop: spacing[1], lineHeight: typography.lineHeight.sm },
  moreText: { color: colors.text.muted, fontSize: typography.size.xs, marginTop: spacing[1], lineHeight: typography.lineHeight.xs },
  fab: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[4],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.bg.base,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fabText: {
    color: colors.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    lineHeight: 28,
  },
  loadingMore: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  // ── Meal slot styles ────────────────────────────────────────────────────
  slotContainer: {
    marginBottom: spacing[3],
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.bg.surfaceRaised,
  },
  slotName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    lineHeight: typography.lineHeight.base,
  },
  slotCalories: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  slotAddButton: {
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    minHeight: 44,
    justifyContent: 'center',
  },
  slotAddText: {
    fontSize: typography.size.sm,
    color: colors.accent.primary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  // ── Favorites styles ──────────────────────────────────────────────────
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  favoriteName: {
    fontSize: typography.size.base,
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  favoriteMacros: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.sm,
  },
  favoriteLogBtn: {
    fontSize: typography.size.sm,
    color: colors.accent.primary,
    fontWeight: typography.weight.semibold,
    paddingHorizontal: spacing[3],
    lineHeight: typography.lineHeight.sm,
  },
  emptyFavText: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing[2],
    lineHeight: typography.lineHeight.sm,
  },
  // ── Template browse link ──────────────────────────────────────────────
  browseLink: {
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  browseLinkText: {
    fontSize: typography.size.sm,
    color: colors.accent.primary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
});
