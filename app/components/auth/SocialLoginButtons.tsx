import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { getThemeColors, useThemeColors} from '../../hooks/useThemeColors';
import {
  signInWithGoogle,
  getGoogleSignInError,
  signInWithApple,
  getAppleSignInError,
  isAppleAuthAvailable,
  isGoogleSignInAvailable,
} from '../../services/socialAuth';

interface SocialLoginButtonsProps {
  onSuccess: (tokens: { access_token: string; refresh_token: string; expires_in: number }) => void;
  onError: (message: string) => void;
}

export function SocialLoginButtons({ onSuccess, onError }: SocialLoginButtonsProps) {
  const c = useThemeColors();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const tokens = await signInWithGoogle();
      onSuccess(tokens);
    } catch (err: unknown) {
      const msg = getGoogleSignInError(err);
      if (msg) onError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleApple = async () => {
    setAppleLoading(true);
    try {
      const tokens = await signInWithApple();
      onSuccess(tokens);
    } catch (err: unknown) {
      const msg = getAppleSignInError(err);
      if (msg) onError(msg);
    } finally {
      setAppleLoading(false);
    }
  };

  const isLoading = googleLoading || appleLoading;

  return (
    <View style={styles.container}>
      {isGoogleSignInAvailable && (
        <TouchableOpacity
          testID="google-signin-button"
          style={[styles.socialBtn, { borderColor: c.border.default, backgroundColor: c.bg.surfaceRaised }]}
          onPress={handleGoogle}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={c.text.primary} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[styles.socialBtnText, { color: c.text.primary }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {isAppleAuthAvailable && (
        <TouchableOpacity
          testID="apple-signin-button"
          style={[styles.socialBtn, { borderColor: c.border.default, backgroundColor: c.bg.surfaceRaised }]}
          onPress={handleApple}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
        >
          {appleLoading ? (
            <ActivityIndicator size="small" color={c.text.primary} />
          ) : (
            <>
              <Text style={[styles.appleIcon, { color: c.text.primary }]}>{'\uF8FF'}</Text>
              <Text style={[styles.socialBtnText, { color: c.text.primary }]}>
                Continue with Apple
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: c.border.subtle }]} />
        <Text style={[styles.dividerText, { color: c.text.muted }]}>or continue with email</Text>
        <View style={[styles.dividerLine, { backgroundColor: c.border.subtle }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[2],
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: spacing[3],
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
    minHeight: 48,
  },
  socialBtnText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  googleIcon: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: '#4285F4',
    marginRight: spacing[2],
  },
  appleIcon: {
    fontSize: typography.size.lg,
    marginRight: spacing[2],
    ...Platform.select({
      ios: { fontFamily: 'System' },
      default: {},
    }),
  },
});
