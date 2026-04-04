import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';

export interface LeaderboardEntry {
  rank: number;
  user: { id: string; display_name: string; avatar_url: string | null };
  score: number;
  unit: string;
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function LeaderboardRow({ entry, isCurrentUser }: LeaderboardRowProps) {
  const c = useThemeColors();
  const s = styles(c);

  const initials = entry.user.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[s.row, isCurrentUser && s.highlighted]}
      accessibilityLabel={`Rank ${entry.rank}, ${entry.user.display_name}, ${entry.score} ${entry.unit}`}
    >
      <Text style={s.rank}>{RANK_MEDALS[entry.rank] ?? `${entry.rank}`}</Text>
      <View style={[s.avatar, isCurrentUser && s.avatarHighlighted]}>
        <Text style={s.avatarText}>{initials}</Text>
      </View>
      <Text style={[s.name, isCurrentUser && { color: c.accent.primary }]} numberOfLines={1}>
        {entry.user.display_name}
      </Text>
      <Text style={s.score}>
        {entry.score.toLocaleString()} {entry.unit}
      </Text>
    </View>
  );
}

const styles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
      gap: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: c.border.subtle,
    },
    highlighted: {
      backgroundColor: c.accent.primaryMuted,
      borderRadius: radius.sm,
      borderBottomColor: 'transparent',
    },
    rank: {
      width: 28,
      textAlign: 'center',
      fontSize: typography.size.base,
      fontWeight: typography.weight.bold,
      color: c.text.secondary,
      lineHeight: typography.lineHeight.base,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bg.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarHighlighted: { backgroundColor: c.accent.primaryMuted },
    avatarText: {
      color: c.accent.primary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
      lineHeight: typography.lineHeight.xs,
    },
    name: {
      flex: 1,
      color: c.text.primary,
      fontSize: typography.size.base,
      fontWeight: typography.weight.medium,
      lineHeight: typography.lineHeight.base,
    },
    score: {
      color: c.text.secondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
      lineHeight: typography.lineHeight.sm,
    },
  });
