import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { FilterPill } from '../../components/common/FilterPill';
import { EmptyState } from '../../components/common/EmptyState';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { ProfileStackParamList } from '../../navigation/BottomTabNavigator';
import { Icon, IconName } from '../../components/common/Icon';
import api from '../../services/api';
import { stripMarkdown } from '../../utils/textHelpers';

interface Article {
  id: string;
  title: string;
  module_name?: string;
  content_markdown?: string;
  tags: string[];
  is_premium: boolean;
  estimated_read_time_min: number;
  published_at: string;
}

const CATEGORIES = ['All', '★ Favorites', 'Hypertrophy', 'Nutrition', 'Programming', 'Recovery', 'Recomp', 'Supplements'];

const CATEGORY_TO_MODULE: Record<string, string> = {
  Hypertrophy: 'Hypertrophy Science',
  Nutrition: 'Nutrition & Protein',
  Programming: 'Strength & Programming',
  Recovery: 'Recovery & Lifestyle',
  Recomp: 'Body Recomposition',
  Supplements: 'Supplements',
};

const CATEGORY_COLORS: Record<string, string> = {
  Hypertrophy: colors.accent.primary,
  Nutrition: colors.macro.calories,
  Programming: colors.macro.protein,
  Recovery: colors.macro.carbs,
  Recomp: colors.macro.fat,
  Supplements: '#8B5CF6',
};

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
  const animatedStyle = useStaggeredEntrance(index, 40);
  // Reverse-map full module name to short category key for color/icon lookup
  const MODULE_TO_CATEGORY: Record<string, string> = Object.fromEntries(
    Object.entries(CATEGORY_TO_MODULE).map(([k, v]) => [v, k]),
  );
  const categoryKey = MODULE_TO_CATEGORY[item.module_name ?? ''] ?? (item.module_name ?? '');
  const categoryColor = CATEGORY_COLORS[categoryKey] ?? colors.accent.primary;
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
              <View style={styles.readTimePill}>
                <Text style={styles.readTimeIcon}>◷</Text>
                <Text style={styles.readTimeText}>{item.estimated_read_time_min} min</Text>
              </View>
            </View>
            {item.is_premium && (
              <View style={styles.lockBadge}>
                <Icon name="lock" size={14} />
              </View>
            )}
          </View>

          <Text style={styles.articleTitle}>{item.title}</Text>

          {preview ? (
            <Text style={styles.articlePreview} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}

          <View style={styles.articleFooter}>
            <View style={styles.tags}>
              {item.tags?.slice(0, 3).map((tag) => (
                <Text key={tag} style={styles.tag}>{tag}</Text>
              ))}
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.readIndicator}>Read →</Text>
              <TouchableOpacity onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadArticles = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '50', status: 'published' };
      if (category !== 'All' && category !== '★ Favorites') {
        params.category = CATEGORY_TO_MODULE[category] ?? category;
      }
      if (searchQuery.trim()) params.q = searchQuery.trim();
      const { data } = await api.get('content/articles', { params });
      setArticles(data.items ?? []);
    } catch { /* best-effort */ }
  }, [category, searchQuery]);

  const loadFavorites = useCallback(async () => {
    try {
      const { data } = await api.get('content/favorites');
      setFavorites(new Set((data.items ?? []).map((a: Article) => a.id)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadArticles(); }, [loadArticles]);
  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadArticles();
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const displayArticles = category === '★ Favorites'
    ? articles.filter((a) => favorites.has(a.id))
    : articles;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadArticles(), loadFavorites()]);
    setRefreshing(false);
  };

  const toggleFavorite = async (articleId: string) => {
    const isFav = favorites.has(articleId);
    try {
      if (isFav) {
        await api.delete(`content/articles/${articleId}/favorite`);
        setFavorites((prev) => { const next = new Set(prev); next.delete(articleId); return next; });
      } else {
        await api.post(`content/articles/${articleId}/favorite`);
        setFavorites((prev) => new Set(prev).add(articleId));
      }
    } catch { /* ignore */ }
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
    <SafeAreaView style={styles.safe} edges={['top']} testID="learn-screen">
      <Text style={styles.title}>Learn</Text>

      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search articles..."
        placeholderTextColor={colors.text.muted}
        testID="learn-search-input"
      />

      {/* Category filter pills — horizontal FlatList with FilterPill components */}
      <FlatList
        testID="learn-filter-pills"
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: cat }) => (
          <FilterPill
            label={cat}
            active={category === cat}
            onPress={() => setCategory(cat)}
          />
        )}
      />

      <FlatList
        testID="learn-article-list"
        data={displayArticles}
        keyExtractor={(a) => a.id}
        renderItem={renderArticle}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
        }
        ListEmptyComponent={
          <View testID="learn-empty-state">
          <EmptyState
            icon={<Icon name="book" />}
            title="No articles yet"
            description="Try a different category or check back later"
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
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    padding: spacing[4],
    paddingBottom: spacing[2],
  },
  filterRow: { paddingHorizontal: spacing[4], gap: spacing[2], marginBottom: spacing[3] },
  searchInput: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.size.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  listContent: { padding: spacing[4], paddingTop: 0, paddingBottom: spacing[12] },
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
  },
  readTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  readTimeIcon: {
    fontSize: 10,
    color: colors.text.muted,
  },
  readTimeText: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  lockBadge: {
    backgroundColor: colors.premium.goldSubtle,
    borderRadius: radius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    lineHeight: typography.size.lg * typography.lineHeight.tight,
  },
  articlePreview: {
    color: colors.text.secondary,
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
    color: colors.text.muted,
    fontSize: typography.size.xs,
    backgroundColor: colors.bg.surfaceRaised,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  readIndicator: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    opacity: 0.7,
  },
  favIcon: { fontSize: typography.size.xl, color: colors.text.muted },
  favActive: { color: colors.semantic.warning },
  emptyPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'center',
    marginTop: spacing[2],
  },
});
