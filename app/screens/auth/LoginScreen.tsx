import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import * as SecureStore from 'expo-secure-store';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Button } from '../../components/common/Button';
import api, { setTokenProvider } from '../../services/api';
import { isValidEmail, trimEmail } from '../../utils/validation';
import Animated from 'react-native-reanimated';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { SocialLoginButtons } from '../../components/auth/SocialLoginButtons';

const TOKEN_KEYS = { access: 'rw_access_token', refresh: 'rw_refresh_token' };

async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); }
  else { await SecureStore.setItemAsync(key, value); }
}
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') { return localStorage.getItem(key); }
  return SecureStore.getItemAsync(key);
}
async function secureDelete(key: string) {
  if (Platform.OS === 'web') { localStorage.removeItem(key); }
  else { await SecureStore.deleteItemAsync(key); }
}

async function saveTokens(access: string, refresh: string) {
  await secureSet(TOKEN_KEYS.access, access);
  await secureSet(TOKEN_KEYS.refresh, refresh);
}

/** Decode the user ID from a JWT access token (no verification — just parsing). */
function parseJwtSub(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? '';
  } catch {
    return '';
  }
}

export function initTokenProvider(clearAuth: () => void) {
  setTokenProvider({
    getAccess: () => secureGet(TOKEN_KEYS.access),
    getRefresh: () => secureGet(TOKEN_KEYS.refresh),
    onRefreshed: saveTokens,
    onRefreshFailed: () => {
      secureDelete(TOKEN_KEYS.access);
      secureDelete(TOKEN_KEYS.refresh);
      clearAuth();
    },
  });
}

interface LoginScreenProps {
  onNavigateRegister: () => void;
  onLoginSuccess: (user: { id: string; email: string }, tokens: { accessToken: string; refreshToken: string; expiresIn: number }) => void;
  onNavigateForgotPassword?: () => void;
  onNavigateEmailVerification?: (email: string) => void;
}

export function LoginScreen({ onNavigateRegister, onLoginSuccess, onNavigateForgotPassword, onNavigateEmailVerification }: LoginScreenProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const titleAnim = useStaggeredEntrance(0, 80);
  const subtitleAnim = useStaggeredEntrance(1, 80);
  const formAnim = useStaggeredEntrance(2, 80);
  const buttonAnim = useStaggeredEntrance(3, 80);
  const linkAnim = useStaggeredEntrance(4, 80);

  const handleLogin = async () => {
    setError('');
    setEmailError('');
    setUnverifiedEmail('');
    setResendSuccess('');
    const cleanEmail = trimEmail(email);
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!cleanEmail || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('auth/login', { email: cleanEmail, password });
      await saveTokens(data.access_token, data.refresh_token);
      onLoginSuccess(
        { id: parseJwtSub(data.access_token), email: cleanEmail },
        {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        },
      );
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(cleanEmail);
        setError('');
      } else {
        setError(err?.response?.data?.message ?? err?.response?.data?.detail ?? 'Login failed. Please check your credentials.');
      }
      setEmailError('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendSuccess('');
    try {
      await api.post('auth/resend-verification-email', { email: unverifiedEmail });
      setResendSuccess('Verification code sent! Check your email.');
      if (onNavigateEmailVerification) {
        onNavigateEmailVerification(unverifiedEmail);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to resend verification email');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSocialSuccess = async (tokens: { access_token: string; refresh_token: string; expires_in: number }) => {
    await saveTokens(tokens.access_token, tokens.refresh_token);
    onLoginSuccess(
      { id: parseJwtSub(tokens.access_token), email: '' },
      { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in },
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg.base }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={titleAnim}>
          <Text style={[styles.title, { color: c.text.primary }]}>Repwise</Text>
        </Animated.View>
        <Animated.View style={subtitleAnim}>
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>Sign in to continue</Text>
        </Animated.View>

        <Animated.View style={formAnim}>
        {error ? <ErrorBanner testID="login-error-message" message={error} onDismiss={() => setError('')} /> : null}

        {unverifiedEmail ? (
          <View testID="unverified-banner" style={[styles.unverifiedBanner, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}>
            <Text style={[styles.unverifiedText, { color: c.text.primary }]}>
              Your email is not verified yet. Please verify to continue.
            </Text>
            {resendSuccess ? (
              <Text style={[styles.resendSuccess, { color: c.semantic.positive }]}>{resendSuccess}</Text>
            ) : null}
            <Button
              testID="resend-verification-button"
              title={resendLoading ? 'Sending…' : 'Resend Verification Email'}
              onPress={handleResendVerification}
              loading={resendLoading}
              style={styles.resendBtn}
            />
          </View>
        ) : null}

        <TextInput
          testID="login-email-input"
          style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}
          placeholder="Email"
          placeholderTextColor={c.text.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(text) => { setEmail(text); setEmailError(''); }}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          accessibilityLabel="Email address"
          accessibilityHint="Enter your email to sign in"
        />
        {emailError ? <Text style={[styles.emailError, { color: c.semantic.negative }]}>{emailError}</Text> : null}
        <View style={{ position: 'relative' }}>
          <TextInput
            ref={passwordRef}
            testID="login-password-input"
            style={[styles.input, { paddingRight: spacing[10], marginBottom: 0 }]}
            placeholder="Password"
            placeholderTextColor={c.text.muted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            accessibilityLabel="Password"
            accessibilityHint="Enter your password"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: spacing[3], top: spacing[3], minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={c.text.muted} />
          </TouchableOpacity>
        </View>
        <View style={{ marginBottom: spacing[3] }} />
        </Animated.View>

        <Animated.View style={buttonAnim}>
        {onNavigateForgotPassword ? (
          <TouchableOpacity testID="forgot-password-link" onPress={onNavigateForgotPassword} style={{ alignItems: 'flex-end', marginBottom: spacing[3], minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: c.accent.primary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm }}>Forgot Password?</Text>
          </TouchableOpacity>
        ) : null}

        <Button testID="login-submit-button" title="Sign In" onPress={handleLogin} loading={loading} style={styles.btn} />
        <SocialLoginButtons onSuccess={handleSocialSuccess} onError={setError} />
        </Animated.View>

        <Animated.View style={linkAnim}>
        <TouchableOpacity testID="login-register-link" onPress={onNavigateRegister} style={styles.link}>
          <Text style={[styles.linkText, { color: c.text.secondary }]}>
            Don't have an account? <Text style={[styles.linkAccent, { color: c.accent.primary }]}>Register</Text>
          </Text>
        </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.base },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing[6],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    lineHeight: typography.lineHeight['2xl'],
  },
  subtitle: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[8],
    lineHeight: typography.lineHeight.base,
  },
  error: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[4],
    lineHeight: typography.lineHeight.sm,
  },
  emailError: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    marginBottom: spacing[2],
    marginTop: -spacing[2],
    lineHeight: typography.lineHeight.sm,
  },
  input: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    color: c.text.primary,
    fontSize: typography.size.base,
    padding: spacing[4],
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.base,
  },
  btn: { marginTop: spacing[2] },
  resendBtn: { marginTop: spacing[3] },
  unverifiedBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  unverifiedText: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  resendSuccess: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  link: { alignItems: 'center', marginTop: spacing[6], minHeight: 44, justifyContent: 'center' },
  linkText: { color: c.text.secondary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base },
  linkAccent: { color: c.accent.primary, fontWeight: typography.weight.semibold },
});
