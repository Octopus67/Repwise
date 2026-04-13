import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import api from '../../services/api';

interface ReactionButtonProps {
  eventId: string;
  count: number;
  reacted: boolean;
}

export function ReactionButton({ eventId, count, reacted }: ReactionButtonProps) {
  const c = useThemeColors();
  const s = styles(c);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationKey: ['reaction', eventId], // Audit fix 4.4 — offline persistence
    mutationFn: ({ wasReacted }: { wasReacted: boolean }) =>
      wasReacted
        ? api.delete(`social/feed/${eventId}/reactions`)
        : api.post(`social/feed/${eventId}/reactions`, { emoji: '💪' }),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      const previous = qc.getQueryData(['feed']);
      const updateItem = (item: Record<string, unknown>) =>
        item.id === eventId
          ? { ...item, reacted: !variables.wasReacted, reaction_count: Math.max(0, ((item.reaction_count as number) ?? 0) + (variables.wasReacted ? -1 : 1)) }
          : item;
      qc.setQueryData(['feed'], (old: { pages?: Array<{ events?: Record<string, unknown>[] }>; items?: Record<string, unknown>[] } | Record<string, unknown>[] | undefined) => {
        if (!old || typeof old !== 'object') return old;
        if ('pages' in old && old.pages) {
          return { ...old, pages: old.pages.map((page) => ({ ...page, events: (page.events || []).map(updateItem) })) };
        }
        if (Array.isArray(old)) return old.map(updateItem);
        if ('items' in old) return { ...old, items: (old.items || []).map(updateItem) };
        return old;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['feed'], context.previous);
      Alert.alert('Error', 'Reaction failed — please try again.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  return (
    <TouchableOpacity
      style={[s.btn, reacted && s.btnActive]}
      onPress={() => mutation.mutate({ wasReacted: reacted })}
      disabled={mutation.isPending}
      accessibilityLabel={reacted ? 'Remove reaction' : 'React to workout'}
      accessibilityRole="button"
    >
      <Icon name="muscle" size={16} color={c.accent.primary} />
      {count > 0 && (
        <Text style={[s.count, reacted && { color: c.accent.primary }]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = (c: ThemeColors) =>
  StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border.subtle,
      minHeight: 44,
    },
    btnActive: {
      backgroundColor: c.accent.primaryMuted,
      borderColor: c.accent.primary,
    },
    emoji: { fontSize: typography.size.md },
    count: {
      fontSize: typography.size.sm,
      color: c.text.secondary,
      fontWeight: typography.weight.medium,
      lineHeight: typography.lineHeight.sm,
    },
  });
