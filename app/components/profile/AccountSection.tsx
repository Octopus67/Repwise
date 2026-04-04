import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Linking,
} from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';
import Constants from 'expo-constants';
import { spacing, typography } from '../../theme/tokens';
import { secureGet, TOKEN_KEYS } from '../../utils/secureStorage';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useStore } from '../../store';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import api from '../../services/api';
import { LEGAL_URLS } from '../../constants/urls';

interface AccountSectionProps {
  onLogout: () => void | Promise<void>;
}

export function AccountSection({ onLogout }: AccountSectionProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useStore();
  const setNeedsOnboarding = useStore((s) => s.setNeedsOnboarding);
  const reduceMotion = useReduceMotion();
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);

  const toggleDangerZone = useCallback(() => {
    setDangerZoneExpanded((prev) => !prev);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const refreshToken = await secureGet(TOKEN_KEYS.refresh);
      
      // Call backend logout to blacklist both tokens
      await api.post('auth/logout', { refresh_token: refreshToken });
    } catch (error: unknown) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', String(error));
    } finally {
      // Clear local auth state — await onLogout (secureClear) before clearing Zustand
      await onLogout();
      store.clearAuth();
    }
  }, [store, onLogout]);

  const handleRedoOnboarding = useCallback(() => {
    Alert.alert(
      'Retake Setup Wizard',
      'This will reset your goals and preferences. Your training and nutrition history will be preserved. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('users/goals');
              setNeedsOnboarding(true);
            } catch {
              Alert.alert('Error', 'Failed to reset. Please try again.');
            }
          },
        },
      ],
    );
  }, [setNeedsOnboarding]);

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
              await api.delete('account/');
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
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Account</Text>

      {/* Log Out */}
      <View style={styles.logoutRow}>
        <Button title="Log Out" variant="secondary" onPress={handleLogout} />
      </View>

      {/* Retake Setup Wizard */}
      <View style={styles.redoOnboardingRow}>
        <Button title="Retake Setup Wizard" variant="secondary" onPress={handleRedoOnboarding} />
      </View>

      {/* Legal Links */}
      <View style={[styles.legalSection, { borderBottomColor: c.border.subtle }]}>
        <TouchableOpacity
          style={styles.legalLink}
          onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
          accessibilityRole="link"
        >
          <Text style={[styles.legalText, { color: c.accent.primary }]}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalLink}
          onPress={() => Linking.openURL(LEGAL_URLS.terms)}
          accessibilityRole="link"
        >
          <Text style={[styles.legalText, { color: c.accent.primary }]}>Terms of Service</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <TouchableOpacity
        style={[styles.dangerZoneHeader, { borderTopColor: c.border.subtle }]}
        onPress={toggleDangerZone}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: dangerZoneExpanded }}
        accessibilityLabel="Danger Zone"
      >
        <Text style={[styles.dangerZoneText, { color: c.semantic.negative }]}>
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
      <Text style={[styles.version, { color: c.text.muted }]}>App version: {appVersion}</Text>
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
    marginBottom: spacing[2],
  },
  logoutRow: {
    marginBottom: spacing[4],
  },
  redoOnboardingRow: {
    marginBottom: spacing[4],
  },
  legalSection: {
    marginBottom: spacing[4],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  legalLink: {
    paddingVertical: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  legalText: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
  },
  dangerZoneHeader: {
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
    minHeight: 44,
    justifyContent: 'center',
  },
  dangerZoneText: {
    color: c.semantic.negative,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  dangerZoneContent: {
    paddingBottom: spacing[4],
  },
  version: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[4],
    textAlign: 'center',
  },
});
