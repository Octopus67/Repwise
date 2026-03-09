import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors, getThemeColors } from '../../hooks/useThemeColors';

interface Nudge {
  type: string;
  title: string;
  message: string;
  action: string;
}

interface NudgeCardProps {
  nudge: Nudge;
  onDismiss: () => void;
  onAction: (action: string) => void;
}

export default function NudgeCard({ nudge, onDismiss, onAction }: NudgeCardProps) {
  const c = useThemeColors();
  const handleAction = () => {
    onAction(nudge.action);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.semantic.warningSubtle, borderLeftColor: c.semantic.warning }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: c.text.primary }]}>{nudge.title}</Text>
        <Text style={[styles.message, { color: c.text.secondary }]}>{nudge.message}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={[styles.dismissText, { color: c.text.muted }]}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: c.semantic.warning }]} onPress={handleAction}>
          <Text style={[styles.actionText, { color: c.text.inverse }]}>Take Action</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  content: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});