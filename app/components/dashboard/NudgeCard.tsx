import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
  const handleAction = () => {
    onAction(nudge.action);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{nudge.title}</Text>
        <Text style={styles.message}>{nudge.message}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
          <Text style={styles.actionText}>Take Action</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  content: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#856404',
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
    color: '#856404',
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#FFC107',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#212529',
    fontWeight: '600',
  },
});