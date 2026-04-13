import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import api from '../../services/api';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
}

/** Toggle follow/unfollow for a user with optimistic UI. */
export function FollowButton({ userId, isFollowing }: FollowButtonProps) {
  const c = useThemeColors();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      isFollowing ? api.delete(`social/follow/${userId}`) : api.post(`social/follow/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['social-discover'] });
    },
  });

  return (
    <TouchableOpacity
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      style={[styles.btn, { backgroundColor: isFollowing ? c.bg.surfaceRaised : c.accent.primary }]}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
    >
      {mutation.isPending ? (
        <ActivityIndicator size="small" color={c.text.onAccent} />
      ) : (
        <Text style={[styles.text, { color: isFollowing ? c.text.primary : c.text.onAccent }]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
