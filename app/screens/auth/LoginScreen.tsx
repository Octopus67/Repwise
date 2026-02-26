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
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Button } from '../../components/common/Button';
import api, { setTokenProvider } from '../../services/api';
import { useStore } from '../../store';
import { isValidEmail, trimEmail } from '../../utils/validation';

const TOKEN_KEYS = { access: 'hos_access_token', refresh: 'hos_refresh_token' };

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
  onLoginSuccess: () => void;
  onNavigateForgotPassword?: () => void;
}

export function LoginScreen({ onNavigateRegister, onLoginSuccess, onNavigateForgotPassword }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useStore((s) => s.setAuth);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    setError('');
    setEmailError('');
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
      setAuth(
        { id: parseJwtSub(data.access_token), email: cleanEmail, role: 'user' },
        {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        },
      );
      onLoginSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Login failed');
      setEmailError('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>HypertrophyOS</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {error ? <ErrorBanner testID="login-error-message" message={error} onDismiss={() => setError('')} /> : null}

        <TextInput
          testID="login-email-input"
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.text.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(text) => { setEmail(text); setEmailError(''); }}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          accessibilityLabel="Email address"
          accessibilityHint="Enter your email to sign in"
        />
        {emailError ? <Text style={styles.emailError}>{emailError}</Text> : null}
        <View style={{ position: 'relative' }}>
          <TextInput
            ref={passwordRef}
            testID="login-password-input"
            style={[styles.input, { paddingRight: spacing[10], marginBottom: 0 }]}
            placeholder="Password"
            placeholderTextColor={colors.text.muted}
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
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
        <View style={{ marginBottom: spacing[3] }} />

        {onNavigateForgotPassword ? (
          <TouchableOpacity testID="forgot-password-link" onPress={onNavigateForgotPassword} style={{ alignItems: 'flex-end', marginBottom: spacing[3], minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.accent.primary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm }}>Forgot Password?</Text>
          </TouchableOpacity>
        ) : null}

        <Button testID="login-submit-button" title="Sign In" onPress={handleLogin} loading={loading} style={styles.btn} />

        {/* OAuth buttons hidden until providers are configured */}

        <TouchableOpacity testID="login-register-link" onPress={onNavigateRegister} style={styles.link}>
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkAccent}>Register</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing[6],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    lineHeight: typography.lineHeight['2xl'],
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[8],
    lineHeight: typography.lineHeight.base,
  },
  error: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[4],
    lineHeight: typography.lineHeight.sm,
  },
  emailError: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    marginBottom: spacing[2],
    marginTop: -spacing[2],
    lineHeight: typography.lineHeight.sm,
  },
  input: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    color: colors.text.primary,
    fontSize: typography.size.base,
    padding: spacing[4],
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.base,
  },
  btn: { marginTop: spacing[2] },
  link: { alignItems: 'center', marginTop: spacing[6], minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.text.secondary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base },
  linkAccent: { color: colors.accent.primary, fontWeight: typography.weight.semibold },
});
