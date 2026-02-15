import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Card } from '../common/Card';
import { colors, typography, spacing } from '../../theme/tokens';

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
  switch (moduleName) {
    case 'nutrition':
      return colors.macro.calories;
    case 'training':
      return colors.macro.protein;
    case 'recovery':
      return colors.macro.carbs;
    default:
      return colors.accent.primary;
  }
}

export function ArticleCardCompact({ article, onPress }: ArticleCardCompactProps) {
  const categoryColor = getCategoryColor(article.module_name);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={[styles.card, { borderTopColor: categoryColor }]}>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.readTime}>
            {article.estimated_read_time_min} min read
          </Text>
          <Text style={styles.arrow}>→</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    borderTopWidth: 4,
  },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
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
    color: colors.text.muted,
  },
  arrow: {
    fontSize: typography.size.md,
    color: colors.text.muted,
  },
});
