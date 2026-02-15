import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { PremiumBadge } from '../../components/premium/PremiumBadge';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { ProfileStackParamList } from '../../navigation/BottomTabNavigator';
import { Icon } from '../../components/common/Icon';
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

const CATEGORIES = ['All', '★ Favorites', 'Nutrition', 'Training', 'Recovery', 'Mindset'];

const CATEGORY_COLORS: Record<string, string> = {
  Nutrition: colors.macro.calories,
  Training: colors.macro.protein,
  Recovery: colors.macro.carbs,
  Mindset: colors.macro.fat,
};

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
  const categoryColor = CATEGORY_COLORS[item.module_name ?? ''] ?? colors.accent.primary;

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        <Card style={[styles.articleCard, { borderLeftWidth: 4, borderLeftColor: categoryColor }]}>
          <View style={styles.articleHeader}>
            <View style={styles.articleMeta}>
              {item.module_name && <Text style={styles.categoryPill}>{item.module_name}</Text>}
              <Text style={styles.readTime}>{item.estimated_read_time_min} min read</Text>
            </View>
            {item.is_premium && (
              <View style={styles.lockBadge}>
                <Icon name="lock" size={14} />
              </View>
            )}
          </View>
          <Text style={styles.articleTitle}>{item.title}</Text>
          {item.content_markdown && (
            <Text style={styles.articlePreview} numberOfLines={2}>
              {stripMarkdown(item.content_markdown)}
            </Text>
          )}
          <View style={styles.articleFooter}>
            <View style={styles.tags}>
              {item.tags?.slice(0, 3).map((tag) => (
                <Text key={tag} style={styles.tag}>{tag}</Text>
              ))}
            </View>
            <TouchableOpacity onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.favIcon, isFavorite && styles.favActive]}>
                {isFavorite ? <Icon name="star" /> : <Icon name="star-outline" />}
              </Text>
            </TouchableOpacity>
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
      if (category !== 'All' && category !== '★ Favorites') params.category = category;
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
  articleCard: { marginBottom: spacing[3] },
  articleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  articleMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  categoryPill: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    backgroundColor: colors.accent.primaryMuted,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  readTime: { color: colors.text.muted, fontSize: typography.size.xs },
  lockBadge: {
    backgroundColor: colors.premium.goldSubtle,
    borderRadius: radius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: { fontSize: 12 },
  articleTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.md * typography.lineHeight.normal,
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
  tags: { flexDirection: 'row', gap: spacing[1] },
  tag: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    backgroundColor: colors.bg.surfaceRaised,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    overflow: 'hidden',
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
