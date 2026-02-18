import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';
import Constants from 'expo-constants';
import { colors, spacing, typography } from '../../theme/tokens';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useStore } from '../../store';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import api from '../../services/api';

interface AccountSectionProps {
  onLogout: () => void;
}

export function AccountSection({ onLogout }: AccountSectionProps) {
  const store = useStore();
  const reduceMotion = useReduceMotion();
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);

  const toggleDangerZone = useCallback(() => {
    setDangerZoneExpanded((prev) => !prev);
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'Your account will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('users/account');
              store.clearAuth();
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ],
    );
  }, [store]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Card>
      <Text style={styles.sectionTitle}>Account</Text>

      {/* Log Out */}
      <View style={styles.logoutRow}>
        <Button title="Log Out" variant="secondary" onPress={onLogout} />
      </View>

      {/* Danger Zone */}
      <TouchableOpacity
        style={styles.dangerZoneHeader}
        onPress={toggleDangerZone}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: dangerZoneExpanded }}
        accessibilityLabel="Danger Zone"
      >
        <Text style={styles.dangerZoneText}>
          {dangerZoneExpanded ? '▾' : '▸'} Danger Zone
        </Text>
      </TouchableOpacity>

      {dangerZoneExpanded && (
        <Animated.View layout={reduceMotion ? undefined : Layout} style={styles.dangerZoneContent}>
          <Button
            title="Delete Account"
            variant="danger"
            onPress={handleDeleteAccount}
          />
        </Animated.View>
      )}

      {/* App Version */}
      <Text style={styles.version}>App version: {appVersion}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
    marginBottom: spacing[2],
  },
  logoutRow: {
    marginBottom: spacing[4],
  },
  dangerZoneHeader: {
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    minHeight: 44,
    justifyContent: 'center',
  },
  dangerZoneText: {
    color: colors.semantic.negative,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  dangerZoneContent: {
    paddingBottom: spacing[4],
  },
  version: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[4],
    textAlign: 'center',
  },
});
