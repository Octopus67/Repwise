import { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from '../../components/common/Icon';
import { ArticleChart } from '../../components/learn/ArticleChart';
import api from '../../services/api';

interface ArticleDetail {
  id: string;
  title: string;
  content_markdown: string;
  tags: string[];
  is_premium: boolean;
  estimated_read_time_min: number;
  youtube_links: string[];
  published_at: string;
}

interface ArticleDetailScreenProps {
  articleId: string;
  onBack: () => void;
}

export function ArticleDetailScreen({ articleId, onBack }: ArticleDetailScreenProps) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadArticle();
  }, [articleId]);

  const loadArticle = async () => {
    setError(null);
    try {
      const { data } = await api.get(`content/articles/${articleId}`);
      setArticle(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load article';
      setError(msg);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const maxScroll = contentSize.height - layoutMeasurement.height;
    if (maxScroll > 0) {
      const progress = Math.min(contentOffset.y / maxScroll, 1);
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 50,
        useNativeDriver: false,
      }).start();
    }
  };

  const toggleFavorite = async () => {
    try {
      if (isFavorite) {
        await api.delete(`content/articles/${articleId}/favorite`);
      } else {
        await api.post(`content/articles/${articleId}/favorite`);
      }
      setIsFavorite(!isFavorite);
    } catch { /* ignore */ }
  };

  /** Split markdown at <!-- chart:ID --> markers into alternating text/chart segments */
  const contentSections = useMemo(() => {
    if (!article) return [];
    const md = article.content_markdown;
    const chartPattern = /<!--\s*chart:([\w-]+)\s*-->/g;
    const sections: { type: 'markdown' | 'chart'; content: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = chartPattern.exec(md)) !== null) {
      const before = md.slice(lastIndex, match.index).trim();
      if (before) sections.push({ type: 'markdown', content: before });
      sections.push({ type: 'chart', content: match[1] });
      lastIndex = match.index + match[0].length;
    }

    const remaining = md.slice(lastIndex).trim();
    if (remaining) sections.push({ type: 'markdown', content: remaining });

    return sections.length > 0 ? sections : [{ type: 'markdown' as const, content: md }];
  }, [article]);

  if (!article) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']} testID="article-detail-screen">
        <View style={styles.header}>
          <TouchableOpacity testID="article-detail-back" onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
        </View>
        {error ? (
          <View testID="article-detail-error" style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity testID="article-detail-retry" onPress={loadArticle} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator size="large" color={colors.accent.primary} />
        )}
      </SafeAreaView>
    );
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="article-detail-screen">
      {/* Scroll progress bar */}
      <View style={styles.progressBar}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="article-detail-back" onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="article-detail-favorite" onPress={toggleFavorite}>
          <Text style={[styles.favBtn, isFavorite && styles.favActive]}>
            {isFavorite ? <Icon name="star" /> : <Icon name="star-outline" />}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>{article.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.readTime}>{article.estimated_read_time_min} min read</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.date}>
            {new Date(article.published_at).toLocaleDateString()}
          </Text>
        </View>

        {/* YouTube embeds */}
        {article.youtube_links?.map((url, i) => (
          <TouchableOpacity
            key={i}
            style={styles.videoCard}
            onPress={() => Linking.openURL(url)}
            activeOpacity={0.8}
          >
            <Text style={styles.videoIcon}>▶</Text>
            <Text style={styles.videoText}>Watch Video</Text>
          </TouchableOpacity>
        ))}

        {/* Markdown content with inline charts */}
        {contentSections.map((section, idx) =>
          section.type === 'chart' ? (
            <ArticleChart key={`chart-${idx}`} chartId={section.content} />
          ) : (
            <Markdown key={`md-${idx}`} style={markdownStyles}>{section.content}</Markdown>
          ),
        )}

        {/* Tags */}
        <View style={styles.tags}>
          {article.tags?.map((tag) => (
            <Text key={tag} style={styles.tag}>{tag}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: colors.text.primary, fontSize: typography.size.base, lineHeight: typography.size.base * typography.lineHeight.relaxed },
  heading1: { color: colors.text.primary, fontSize: typography.size.xl, fontWeight: typography.weight.semibold, marginTop: spacing[6], marginBottom: spacing[3] },
  heading2: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold, marginTop: spacing[5], marginBottom: spacing[2] },
  heading3: { color: colors.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold, marginTop: spacing[4], marginBottom: spacing[2] },
  paragraph: { marginBottom: spacing[4] },
  strong: { fontWeight: typography.weight.semibold },
  link: { color: colors.accent.primary },
  blockquote: { borderLeftWidth: 3, borderLeftColor: colors.accent.primary, paddingLeft: spacing[4], marginVertical: spacing[3] },
  code_inline: { backgroundColor: colors.bg.surfaceRaised, color: colors.text.primary, paddingHorizontal: 4, borderRadius: 4, fontSize: typography.size.sm },
  fence: { backgroundColor: colors.bg.surfaceRaised, padding: spacing[4], borderRadius: radius.sm, marginVertical: spacing[3] },
  code_block: { color: colors.text.primary, fontSize: typography.size.sm },
  list_item: { marginBottom: spacing[1] },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  loading: { color: colors.text.muted, textAlign: 'center', marginTop: spacing[10], fontSize: typography.size.base },
  errorContainer: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: spacing[8] },
  errorText: { color: colors.semantic.negative, fontSize: typography.size.base, textAlign: 'center', marginBottom: spacing[4] },
  retryBtn: { backgroundColor: colors.accent.primary, paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.sm },
  retryText: { color: colors.text.inverse, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  progressBar: {
    height: 3,
    backgroundColor: colors.bg.surface,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
  },
  backBtn: { color: colors.accent.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium },
  favBtn: { fontSize: typography.size.xl, color: colors.text.muted },
  favActive: { color: colors.semantic.warning },
  scroll: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.xl * typography.lineHeight.tight,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
    marginBottom: spacing[6],
  },
  readTime: { color: colors.text.muted, fontSize: typography.size.sm },
  dot: { color: colors.text.muted },
  date: { color: colors.text.muted, fontSize: typography.size.sm },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  videoIcon: { color: colors.semantic.negative, fontSize: typography.size.xl },
  videoText: { color: colors.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[6] },
  tag: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    backgroundColor: colors.bg.surfaceRaised,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    overflow: 'hidden',
  },
});
