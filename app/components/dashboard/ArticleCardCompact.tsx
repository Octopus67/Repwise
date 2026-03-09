import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Card } from '../common/Card';
import { typography, spacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface Article {
  id: string;
  title: string;
  module_name: string;
  estimated_read_time_min: number;
}

interface ArticleCardCompactProps {
  article: Article;
  onPress: () => void;
}

function getCategoryColor(moduleName: string): string {
  const c = useThemeColors();
  switch (moduleName) {
    case 'nutrition':
      return c.macro.calories;
    case 'training':
      return c.macro.protein;
    case 'recovery':
      return c.macro.carbs;
    default:
      return c.accent.primary;
  }
}

export function ArticleCardCompact({ article, onPress }: ArticleCardCompactProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const categoryColor = getCategoryColor(article.module_name);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={[styles.card, { borderTopColor: categoryColor }]}>
        <Text style={[styles.title, { color: c.text.primary }]} numberOfLines={2}>
          {article.title}
        </Text>
        <View style={styles.footer}>
          <Text style={[styles.readTime, { color: c.text.muted }]}>
            {article.estimated_read_time_min} min read
          </Text>
          <Text style={[styles.arrow, { color: c.text.muted }]}>→</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    width: 200,
    borderTopWidth: 4,
  },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
    marginBottom: spacing[2],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto' as any,
  },
  readTime: {
    fontSize: typography.size.xs,
    color: c.text.muted,
  },
  arrow: {
    fontSize: typography.size.md,
    color: c.text.muted,
  },
});
