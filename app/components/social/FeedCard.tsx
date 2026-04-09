import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';
import { Icon, type IconName } from '../common/Icon';
import { ReactionButton } from './ReactionButton';

export interface FeedEvent {
  id: string;
  user: { id: string; display_name: string; avatar_url: string | null };
  event_type: 'workout_completed' | 'pr_achieved' | 'streak_milestone' | 'post';
  summary: string;
  created_at: string;
  reaction_count: number;
  user_reacted: boolean;
}

const EVENT_ICONS: Record<FeedEvent['event_type'], IconName> = {
  workout_completed: 'dumbbell',
  pr_achieved: 'trophy',
  streak_milestone: 'flame',
  post: 'chat',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface FeedCardProps {
  event: FeedEvent;
  onPress?: (event: FeedEvent) => void;
}

export function FeedCard({ event, onPress }: FeedCardProps) {
  const c = useThemeColors();
  const s = styles(c);
  const [avatarError, setAvatarError] = useState(false);

  const initials = event.user.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => onPress?.(event)}
      activeOpacity={0.7}
      accessibilityLabel={`${event.user.display_name} ${event.summary}`}
      accessibilityRole="button"
    >
      <View style={s.row}>
        <View style={s.avatar}>
          {event.user?.avatar_url && !avatarError ? (
            <Image source={{ uri: event.user.avatar_url }} style={s.avatarImage} onError={() => setAvatarError(true)} />
          ) : (
            <Text style={s.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={s.body}>
          <View style={s.headerRow}>
            <Text style={s.name} numberOfLines={1}>{event.user.display_name}</Text>
            <Text style={s.time}>{timeAgo(event.created_at)}</Text>
          </View>
          <View style={s.eventRow}>
            <Icon name={EVENT_ICONS[event.event_type] ?? 'clipboard'} size={16} color={c.accent.primary} />
            <Text style={s.summary} numberOfLines={2}>{event.summary}</Text>
          </View>
        </View>
      </View>
      <View style={s.footer}>
        <ReactionButton
          eventId={event.id}
          count={event.reaction_count}
          reacted={event.user_reacted}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bg.surface,
      borderRadius: radius.md,
      padding: spacing[4],
      marginBottom: spacing[3],
      borderWidth: 1,
      borderColor: c.border.subtle,
    },
    row: { flexDirection: 'row', gap: spacing[3] },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.accent.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: c.accent.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
      lineHeight: typography.lineHeight.sm,
    },
    avatarImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    body: { flex: 1 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: {
      color: c.text.primary,
      fontSize: typography.size.base,
      fontWeight: typography.weight.semibold,
      lineHeight: typography.lineHeight.base,
      flex: 1,
    },
    time: {
      color: c.text.muted,
      fontSize: typography.size.xs,
      lineHeight: typography.lineHeight.xs,
    },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[1] },
    icon: { fontSize: typography.size.md },
    summary: {
      color: c.text.secondary,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
      flex: 1,
    },
    footer: { flexDirection: 'row', marginTop: spacing[3] },
  });
