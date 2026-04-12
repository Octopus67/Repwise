import React, { useEffect, useState, useCallback } from 'react';
import { getLocalDateString } from '../../utils/localDate';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { SwipeableRow } from '../../components/common/SwipeableRow';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AnimatedTabIndicator } from '../../components/common/AnimatedTabIndicator';

import { BudgetBar } from '../../components/nutrition/BudgetBar';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { useHaptics } from '../../hooks/useHaptics';
import { AddNutritionModal } from '../../components/modals/AddNutritionModal';
import { AddTrainingModal } from '../../components/modals/AddTrainingModal';
import { formatEntryTime } from '../../utils/timestampFormat';
import { hasMorePages } from '../../utils/pagination';
import { groupSessionsByDate } from '../../utils/sessionGrouping';
import { sessionHasPR } from '../../utils/sessionEditConversion';
import { useStore } from '../../store';
import { formatWeight } from '../../utils/unitConversion';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import type { TrainingSessionResponse, WorkoutTemplateResponse } from '../../types/training';
import type { MealFavorite } from '../../types/nutrition';
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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const pillStyles = getPillStyles(c);
  const { showToast } = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<LogsStackParamList>>();
  const fabAnim = useStaggeredEntrance(0, 200);
  const { impact } = useHaptics();
  const [tab, setTab] = useState<Tab>('nutrition');
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [prefilledMealName, setPrefilledMealName] = useState<string | undefined>(undefined);
  const [tabContainerWidth, setTabContainerWidth] = useState(0);

  // Training pagination state
  const [trainingSessions, setTrainingSessions] = useState<TrainingSessionResponse[]>([]);
  const [trainingPage, setTrainingPage] = useState(1);
  const [trainingTotalCount, setTrainingTotalCount] = useState(0);
  const [trainingLoadingMore, setTrainingLoadingMore] = useState(false);

  // ── New state: Quick Re-log, favorites, templates ─────────────────────────
  const [favorites, setFavorites] = useState<MealFavorite[]>([]);
  const [recentEntries, setRecentEntries] = useState<NutritionEntry[]>([]);
  const [quickRelogItems, setQuickRelogItems] = useState<QuickRelogItem[]>([]);
  const [quickRelogLoading, setQuickRelogLoading] = useState(true);
  const [userTemplates, setUserTemplates] = useState<WorkoutTemplateResponse[]>([]);
  const [staticTemplates, setStaticTemplates] = useState<WorkoutTemplateResponse[]>([]);

  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const adaptiveTargets = useStore((s) => s.adaptiveTargets);
  const unitSystem = useStore((s) => s.unitSystem);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(getLocalDateString(d));
  };

  const formatDisplayDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const loadNutritionData = useCallback(async () => {
    try {
      const start = selectedDate;
      const end = selectedDate;
      const res = await api.get('nutrition/entries', { params: { start_date: start, end_date: end, limit: 50 } });
      setNutritionEntries(res.data?.items ?? []);
    } catch {
      // best-effort
    }
  }, [selectedDate]);

  const loadTrainingPage = useCallback(async (page: number, replace: boolean) => {
    try {
      const res = await api.get('training/sessions', {
        params: { 
          start_date: selectedDate, 
          end_date: selectedDate, 
          page, 
          limit: TRAINING_PAGE_SIZE 
        },
      });
      const items: TrainingSessionResponse[] = res.data?.items ?? [];
      const totalCount: number = res.data?.total_count ?? 0;

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
  }, [selectedDate]);

  const loadData = useCallback(async () => {
    // Compute 14-day window for Quick Re-log
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const recentStart = getLocalDateString(fourteenDaysAgo);
    const today = getLocalDateString();

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

      if (favoritesRes.status === 'fulfilled') setFavorites(favoritesRes.value.data?.items ?? []);
      if (recentRes.status === 'fulfilled') setRecentEntries(recentRes.value.data?.items ?? []);
      if (userTemplatesRes.status === 'fulfilled') setUserTemplates(userTemplatesRes.value.data ?? []);
      if (staticTemplatesRes.status === 'fulfilled') setStaticTemplates(staticTemplatesRes.value.data ?? []);
    } catch {
      setError('Unable to load logs. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [loadNutritionData, loadTrainingPage]);

  useEffect(() => { loadData(); }, [loadData, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

  const handleDeleteNutrition = (id: string) => {
    Alert.alert('Delete Entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`nutrition/entries/${id}`);
          loadNutritionData();
          showToast('Deleted');
        } catch (err: unknown) { Alert.alert('Error', 'Failed to delete. Please try again.'); }
      }},
    ]);
  };

  const handleDeleteTraining = (id: string) => {
    Alert.alert('Delete Entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`training/sessions/${id}`);
          setTrainingSessions((prev) => prev.filter((s) => s.id !== id));
          showToast('Deleted');
        } catch (err: unknown) { Alert.alert('Error', 'Failed to delete. Please try again.'); }
      }},
    ]);
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
        <Text style={[styles.dateHeader, { color: c.text.secondary }]}>
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
                  accessibilityLabel="View session detail" // Audit fix 7.10
                  accessibilityRole="button" // Audit fix 7.10
                >
                  <Card style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                      <Text style={[styles.entryName, { color: c.text.primary }]}>
                        {session.exercises?.length ?? 0} exercises
                      </Text>
                      {hasPR && (
                        <Icon name="star" size={16} color={c.semantic.warning} />
                      )}
                    </View>
                    {session.exercises?.slice(0, 3).map((ex, i) => (
                      <Text key={i} style={[styles.exerciseText, { color: c.text.secondary }]}>
                        {ex.exercise_name} — {ex.sets.length} sets{ex.sets.length > 0 ? ` · ${formatWeight(ex.sets[0].weight_kg, unitSystem)} × ${ex.sets[0].reps}` : ''}
                      </Text>
                    ))}
                    {(session.exercises?.length ?? 0) > 3 && (
                      <Text style={[styles.moreText, { color: c.text.muted }]}>
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
        <ActivityIndicator size="small" color={c.accent.primary} />
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
          <View style={styles.templateGap}>
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
              accessibilityLabel="Browse all templates" // Audit fix 7.10
              accessibilityRole="button" // Audit fix 7.10
            >
              <Text style={[styles.browseLinkText, { color: c.accent.primary }]}>Browse all templates →</Text>
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
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="logs-screen">
      <Text style={[styles.title, { color: c.text.primary }]}>Logs</Text>

      <View style={[styles.tabs, { backgroundColor: c.bg.surface }]}
        onLayout={(e) => setTabContainerWidth(e.nativeEvent.layout.width)}>
        <TouchableOpacity
          style={[styles.tab, tab === 'nutrition' && styles.tabActive]}
          onPress={() => { impact('light'); setTab('nutrition'); }}
          testID="logs-nutrition-tab"
          accessibilityLabel="Nutrition tab" // Audit fix 7.10
          accessibilityRole="button" // Audit fix 7.10
        >
          <Text style={[styles.tabText, tab === 'nutrition' && styles.tabTextActive]}>Nutrition</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'training' && styles.tabActive]}
          onPress={() => { impact('light'); setTab('training'); }}
          testID="logs-training-tab"
          accessibilityLabel="Training tab" // Audit fix 7.10
          accessibilityRole="button" // Audit fix 7.10
        >
          <Text style={[styles.tabText, tab === 'training' && styles.tabTextActive]}>Training</Text>
        </TouchableOpacity>
        <AnimatedTabIndicator
          activeIndex={tab === 'nutrition' ? 0 : 1}
          tabCount={2}
          containerWidth={tabContainerWidth}
        />
      </View>

      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => changeDate(-1)} accessibilityLabel="Previous day" accessibilityRole="button">{/* Audit fix 7.10 */}
          <Text style={[styles.dateArrow, { color: c.accent.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.dateText, { color: c.text.primary }]}>{formatDisplayDate(selectedDate)}</Text>
        <TouchableOpacity onPress={() => changeDate(1)} disabled={selectedDate >= getLocalDateString()} accessibilityLabel="Next day" accessibilityRole="button">{/* Audit fix 7.10 */}
          <Text style={[styles.dateArrow, { color: selectedDate >= getLocalDateString() ? c.text.muted : c.accent.primary }]}>›</Text>
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
        <SectionList
          sections={mealSlots.map((slot) => ({ key: slot.name, name: slot.name, totals: slot.totals, data: slot.entries }))}
          keyExtractor={(entry) => entry.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent.primary} />}
          ListHeaderComponent={
            <>
              <QuickRelogRow items={quickRelogItems} onTapItem={handleQuickRelogTap} loading={quickRelogLoading} />
              <BudgetBar consumed={consumed} targets={targets} />
            </>
          }
          renderSectionHeader={({ section }) => (
            <View style={[styles.slotContainer, { backgroundColor: c.bg.surface }]}>
              <View style={[styles.slotHeader, { backgroundColor: c.bg.surfaceRaised }]}>
                <Text style={[styles.slotName, { color: c.text.primary }]}>{section.name}</Text>
                <Text style={[styles.slotCalories, { color: c.text.secondary }]}>
                  {Math.round(section.totals.calories)} kcal
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item: entry }) => {
            const idx = cardIndex++;
            return (
              <Animated.View key={entry.id} entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(150)}>
                <StaggeredCard index={idx}>
                  <SwipeableRow onDelete={() => handleDeleteNutrition(entry.id)}>
                    <Card style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <View style={styles.entryNameRow}>
                          <Text style={[styles.entryName, { color: c.text.primary }]}>{entry.food_name || entry.meal_name || 'Unnamed entry'}</Text>
                          {entry.created_at && (
                            <Text style={[styles.entryTimestamp, { color: c.text.muted }]}>
                              {formatEntryTime(entry.created_at)}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.macroRow}>
                        <MacroPill label="Cal" value={entry.calories} color={c.chart.calories} />
                        <MacroPill label="P" value={entry.protein_g} color={c.semantic.positive} />
                        <MacroPill label="C" value={entry.carbs_g} color={c.semantic.warning} />
                        <MacroPill label="F" value={entry.fat_g} color={c.semantic.negative} />
                      </View>
                    </Card>
                  </SwipeableRow>
                </StaggeredCard>
              </Animated.View>
            );
          }}
          renderSectionFooter={({ section }) => (
            <TouchableOpacity
              style={[styles.slotAddButton, { borderTopColor: c.border.subtle }]}
              onPress={() => handleAddToSlot(section.name as MealSlotName)}
              activeOpacity={0.7}
              accessibilityLabel={`Add to ${section.name}`}
              accessibilityRole="button"
            >
              <Text style={[styles.slotAddText, { color: c.accent.primary }]}>+ Add to {section.name}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <CollapsibleSection
              title="★ Favorites"
              defaultExpanded={quickRelogItems.length < 3}
            >
              {favorites.length > 0 ? (
                <View style={styles.templateGap}>
                  {favorites.map((fav) => (
                    <TouchableOpacity
                      key={fav.id}
                      style={[styles.favoriteRow, { borderBottomColor: c.border.subtle }]}
                      onPress={() => {
                        setPrefilledMealName(fav.name);
                        setShowNutritionModal(true);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel={`Log ${fav.name}`}
                      accessibilityRole="button"
                    >
                      <View style={styles.flexOne}>
                        <Text style={[styles.favoriteName, { color: c.text.primary }]}>{fav.name}</Text>
                        <Text style={[styles.favoriteMacros, { color: c.text.secondary }]}>
                          {Math.round(fav.calories)} kcal
                        </Text>
                      </View>
                      <Text style={[styles.favoriteLogBtn, { color: c.accent.primary }]}>Log</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={[styles.emptyFavText, { color: c.text.muted }]}>
                  Star foods when logging to save them here
                </Text>
              )}
            </CollapsibleSection>
          }
        />
      ) : (
        /* ── Training Tab ──────────────────────────────────────────────── */
        groupedTraining.length === 0 && userTemplates.length === 0 ? (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent.primary} />}
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent.primary} />}
            onEndReached={loadMoreTraining}
            onEndReachedThreshold={0.5}
            ListFooterComponent={trainingListFooter}
          />
        )
      )}

      <Animated.View style={[styles.fab, fabAnim]}>
        <TouchableOpacity
          style={[styles.fabInner, { backgroundColor: c.accent.primary }]}
          activeOpacity={0.8}
          onPress={openAddModal}
          testID="logs-add-button"
          accessibilityLabel="Add entry" // Audit fix 7.10
          accessibilityRole="button" // Audit fix 7.10
        >
          <Text style={[styles.fabText, { color: c.text.primary }]}>+</Text>
        </TouchableOpacity>
      </Animated.View>

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
  const c = useThemeColors();
  const pillStyles = getPillStyles(c);
  return (
    <View style={[pillStyles.pill, { borderColor: color }]}>
      <Text style={[pillStyles.value, { color }]}>{Math.round(value)}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

const getPillStyles = (c: ThemeColors) => StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    alignItems: 'center',
    minWidth: 52,
  },
  value: { fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  label: { fontSize: typography.size.xs, color: c.text.muted },
});

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
  templateGap: { gap: spacing[2] },
  flexOne: { flex: 1 },
  title: {
    color: c.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    padding: spacing[4],
    paddingBottom: spacing[2],
    lineHeight: typography.lineHeight.xl,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    backgroundColor: c.bg.surface,
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
  tabActive: { backgroundColor: c.accent.primaryMuted },
  tabText: { color: c.text.muted, fontSize: typography.size.base, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.base },
  tabTextActive: { color: c.accent.primary },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  dateArrow: {
    color: c.accent.primary,
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
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  list: { flex: 1 },
  listContent: { padding: spacing[4], paddingTop: 0, paddingBottom: spacing[12] },
  dateHeader: {
    color: c.text.secondary,
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
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  entryTimestamp: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
  macroRow: { flexDirection: 'row', gap: spacing[2] },
  exerciseText: { color: c.text.secondary, fontSize: typography.size.sm, marginTop: spacing[1], lineHeight: typography.lineHeight.sm },
  moreText: { color: c.text.muted, fontSize: typography.size.xs, marginTop: spacing[1], lineHeight: typography.lineHeight.xs },
  fab: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[4],
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: c.bg.base,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fabText: {
    color: c.text.primary,
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
    backgroundColor: c.bg.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: c.bg.surfaceRaised,
  },
  slotName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
    lineHeight: typography.lineHeight.base,
  },
  slotCalories: {
    fontSize: typography.size.sm,
    color: c.text.secondary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  slotAddButton: {
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
    minHeight: 44,
    justifyContent: 'center',
  },
  slotAddText: {
    fontSize: typography.size.sm,
    color: c.accent.primary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  // ── Favorites styles ──────────────────────────────────────────────────
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  favoriteName: {
    fontSize: typography.size.base,
    color: c.text.primary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  favoriteMacros: {
    fontSize: typography.size.sm,
    color: c.text.secondary,
    lineHeight: typography.lineHeight.sm,
  },
  favoriteLogBtn: {
    fontSize: typography.size.sm,
    color: c.accent.primary,
    fontWeight: typography.weight.semibold,
    paddingHorizontal: spacing[3],
    lineHeight: typography.lineHeight.sm,
  },
  emptyFavText: {
    fontSize: typography.size.sm,
    color: c.text.muted,
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
    color: c.accent.primary,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
});
