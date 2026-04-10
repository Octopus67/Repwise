import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { FilterPill } from '../../components/common/FilterPill';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { ProfileStackParamList } from '../../navigation/BottomTabNavigator';
import { Icon, IconName } from '../../components/common/Icon';
import api from '../../services/api';
import type { AxiosError } from 'axios';
import { getApiErrorMessage } from '../../utils/errors';
import { stripMarkdown } from '../../utils/textHelpers';
import type { Article } from '../../types/common';

const CATEGORIES = ['All', '★ Favorites', 'Hypertrophy', 'Nutrition', 'Programming', 'Recovery', 'Recomp', 'Supplements'];

const CATEGORY_TO_MODULE: Record<string, string> = {
  Hypertrophy: 'Hypertrophy Science',
  Nutrition: 'Nutrition & Protein',
  Programming: 'Strength & Programming',
  Recovery: 'Recovery & Lifestyle',
  Recomp: 'Body Recomposition',
  Supplements: 'Supplements',
};

const getCATEGORY_COLORS = (c: ThemeColors): Record<string, string> => ({
  Hypertrophy: c.accent.primary,
  Nutrition: c.macro.calories,
  Programming: c.macro.protein,
  Recovery: c.macro.carbs,
  Recomp: c.macro.fat,
  Supplements: c.semantic.caution,
});

const CATEGORY_ICONS: Record<string, IconName> = {
  Hypertrophy: 'muscle',
  Nutrition: 'utensils',
  Programming: 'dumbbell',
  Recovery: 'moon',
  Recomp: 'scale',
  Supplements: 'droplet',
};

/**
 * Extract a meaningful preview from article markdown.
 * Skips the title heading and "The Study" section, preferring
 * "What They Found" or the first substantive paragraph.
 */
function getArticlePreview(markdown: string | undefined | null): string {
  if (!markdown) return '';

  // Try to find "What They Found" section content
  const whatTheyFoundMatch = markdown.match(
    /#{1,3}\s*What They Found[\s\S]*?\n([\s\S]*?)(?=\n#{1,3}\s|\n---|\n\*\*\*|$)/i,
  );
  if (whatTheyFoundMatch?.[1]?.trim()) {
    return stripMarkdown(whatTheyFoundMatch[1].trim(), 200);
  }

  // Otherwise skip the first ~120 chars (usually the title + intro) and show the rest
  const stripped = stripMarkdown(markdown, 400);
  if (stripped.length > 120) {
    // Find the first sentence boundary after char 80 to get a clean cut
    const cutPoint = stripped.indexOf('. ', 80);
    if (cutPoint > 0 && cutPoint < 200) {
      const preview = stripped.slice(cutPoint + 2).trim();
      return preview.length > 200 ? preview.slice(0, 200) + '...' : preview;
    }
    // Fallback: just skip first 100 chars
    const preview = stripped.slice(100).trim();
    return preview.length > 200 ? preview.slice(0, 200) + '...' : preview;
  }

  return stripMarkdown(markdown, 200);
}

function AnimatedArticleCard({
  item,
  index,
  isFavorite,
  onPress,
  onToggleFavorite,
}: {
  item: Article;
  index: number;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const animatedStyle = useStaggeredEntrance(index, 40);
  // Reverse-map full module name to short category key for color/icon lookup
  const MODULE_TO_CATEGORY: Record<string, string> = Object.fromEntries(
    Object.entries(CATEGORY_TO_MODULE).map(([k, v]) => [v, k]),
  );
  const categoryKey = MODULE_TO_CATEGORY[item.module_name ?? ''] ?? (item.module_name ?? '');
  const categoryColor = getCATEGORY_COLORS(c)[categoryKey] ?? c.accent.primary;
  const categoryIcon = CATEGORY_ICONS[categoryKey];
  const preview = getArticlePreview(item.content_markdown);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        <Card style={styles.articleCard}>
          {/* Colored header strip */}
          <View style={[styles.gradientStrip, { backgroundColor: categoryColor }]} />

          <View style={styles.articleHeader}>
            <View style={styles.articleMeta}>
              {item.module_name && (
                <View style={[styles.categoryPillContainer, { backgroundColor: categoryColor + '18' }]}>
                  {categoryIcon && (
                    <Icon name={categoryIcon} size={12} color={categoryColor} />
                  )}
                  <Text style={[styles.categoryPillText, { color: categoryColor }]}>
                    {item.module_name}
                  </Text>
                </View>
              )}
              <View style={[styles.readTimePill, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}>
                <Text style={[styles.readTimeIcon, { color: c.text.muted }]}>◷</Text>
                <Text style={[styles.readTimeText, { color: c.text.secondary }]}>{item.estimated_read_time_min} min</Text>
              </View>
            </View>
            {item.is_premium && (
              <View style={[styles.lockBadge, { backgroundColor: c.premium.goldSubtle }]}>
                <Icon name="lock" size={14} />
              </View>
            )}
          </View>

          <Text style={[styles.articleTitle, { color: c.text.primary }]}>{item.title}</Text>

          {preview ? (
            <Text style={[styles.articlePreview, { color: c.text.secondary }]} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}

          <View style={styles.articleFooter}>
            <View style={styles.tags}>
              {item.tags?.slice(0, 3).map((tag) => (
                <Text key={tag} style={[styles.tag, { color: c.text.muted, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}>{tag}</Text>
              ))}
            </View>
            <View style={styles.footerRight}>
              <Text style={[styles.readIndicator, { color: c.accent.primary }]}>Read →</Text>
              <TouchableOpacity onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[styles.favIcon, isFavorite && styles.favActive]}>
                  {isFavorite ? <Icon name="star" /> : <Icon name="star-outline" />}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function LearnScreen() {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadArticles = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      if (category === '★ Favorites') {
        // Fetch favorites directly from API instead of filtering local list
        const { data } = await api.get('content/favorites');
        setArticles(data.items ?? []);
      } else {
        const params: Record<string, string> = { limit: '50', status: 'published' };
        if (category !== 'All') {
          params.category = CATEGORY_TO_MODULE[category] ?? category;
        }
        if (searchQuery.trim()) params.q = searchQuery.trim();
        const { data } = await api.get('content/articles', { params });
        setArticles(data.items ?? []);
      }
    } catch {
      setError('Unable to load articles. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [category, searchQuery]);

  const loadFavorites = useCallback(async () => {
    try {
      const { data } = await api.get('content/favorites');
      setFavorites(new Set((data.items ?? []).map((a: Article) => a.id)));
    } catch (err: unknown) {
      console.warn('Load favorites failed:', (err as AxiosError)?.response?.status);
    }
  }, []);

  const prevCategoryRef = useRef(category);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  useEffect(() => {
    // Category changed — load immediately
    if (prevCategoryRef.current !== category) {
      prevCategoryRef.current = category;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      loadArticles();
      return;
    }
    // Search changed — debounce
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadArticles();
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [category, searchQuery, loadArticles]);

  const displayArticles = articles;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadArticles(), loadFavorites()]);
    setRefreshing(false);
  };

  const toggleFavorite = async (articleId: string) => {
    const isFav = favorites.has(articleId);
    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) { next.delete(articleId); } else { next.add(articleId); }
      return next;
    });
    
    try {
      if (isFav) {
        await api.delete(`content/articles/${articleId}/favorite`);
      } else {
        await api.post(`content/articles/${articleId}/favorite`);
      }
    } catch (err: unknown) {
      console.warn('Favorite toggle failed:', (err as AxiosError)?.response?.status, getApiErrorMessage(err, 'Favorite toggle failed'));
      // Revert on error - restore original state
      setFavorites((prev) => {
        const reverted = new Set(prev);
        if (isFav) { reverted.add(articleId); } else { reverted.delete(articleId); }
        return reverted;
      });
      Alert.alert('', 'Could not update favorite. Please try again.', [{ text: 'OK' }]);
    }
  };

  const renderArticle = ({ item, index }: { item: Article; index: number }) => (
    <AnimatedArticleCard
      item={item}
      index={index}
      isFavorite={favorites.has(item.id)}
      onPress={() => navigation.navigate('ArticleDetail', { articleId: item.id })}
      onToggleFavorite={() => toggleFavorite(item.id)}
    />
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="learn-screen">
      <Text style={[styles.title, { color: c.text.primary }]}>Learn</Text>

      {error && <ErrorBanner message={error} onRetry={loadArticles} onDismiss={() => setError(null)} />}

      <TextInput
        style={[styles.searchInput, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
        placeholder="Search articles..."
        placeholderTextColor={c.text.muted}
        value={searchQuery}
        onChangeText={setSearchQuery}
        returnKeyType="search"
        accessibilityLabel="Search articles"
        testID="learn-search-input"
      />

      <FlatList
        testID="learn-article-list"
        data={displayArticles}
        keyExtractor={(a) => a.id}
        renderItem={renderArticle}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <FlatList
            horizontal
            data={CATEGORIES}
            keyExtractor={(c) => c}
            renderItem={({ item: c }) => (
              <FilterPill
                key={c}
                label={c}
                active={category === c}
                onPress={() => setCategory(c)}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={{ marginBottom: spacing[3] }}
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: spacing[12], alignItems: 'center' }}>
              <ActivityIndicator size="large" color={c.accent.primary} />
            </View>
          ) : (
          <View testID="learn-empty-state">
          <EmptyState
            icon={<Icon name="book" />}
            title={searchQuery.trim() ? "No articles found" : "No articles yet"}
            description={searchQuery.trim() ? "Try different search terms or check back later" : "Try a different category or check back later"}
          >
            <View style={styles.emptyPills}>
              {CATEGORIES.filter((c) => c !== category).map((c) => (
                <FilterPill
                  key={c}
                  label={c}
                  active={false}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
          </EmptyState>
          </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base, paddingTop: Platform.OS === 'web' ? spacing[4] : 0 },
  title: {
    color: c.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.xl * typography.lineHeight.tight,
    padding: spacing[4],
    paddingBottom: spacing[2],
  },
  filterRow: { paddingHorizontal: spacing[4], gap: spacing[2], marginBottom: spacing[3], height: 40 },
  searchInput: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    color: c.text.primary,
    fontSize: typography.size.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  listContent: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[12] },
  articleCard: {
    marginBottom: spacing[3],
    overflow: 'hidden',
    paddingTop: spacing[4] + 3, // account for gradient strip
  },
  gradientStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  articleMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  categoryPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  categoryPillText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  readTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.subtle,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  readTimeIcon: {
    fontSize: 10,
    lineHeight: 10 * typography.lineHeight.normal,
    color: c.text.muted,
  },
  readTimeText: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  lockBadge: {
    backgroundColor: c.premium.goldSubtle,
    borderRadius: radius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    lineHeight: typography.size.lg * typography.lineHeight.tight,
  },
  articlePreview: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    marginTop: spacing[1],
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  articleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[3],
  },
  tags: { flexDirection: 'row', gap: spacing[1], flexShrink: 1 },
  tag: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
    backgroundColor: c.bg.surfaceRaised,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.subtle,
    overflow: 'hidden',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  readIndicator: {
    color: c.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
    opacity: 0.7,
  },
  favIcon: { fontSize: typography.size.xl, color: c.text.muted },
  favActive: { color: c.semantic.warning },
  emptyPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'center',
    marginTop: spacing[2],
  },
});
