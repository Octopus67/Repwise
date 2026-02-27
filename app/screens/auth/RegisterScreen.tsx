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

async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Button } from '../../components/common/Button';
import api from '../../services/api';
import { useStore } from '../../store';
import { isValidEmail, trimEmail } from '../../utils/validation';

/** Decode the user ID from a JWT access token. */
function parseJwtSub(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? '';
  } catch {
    return '';
  }
}

interface RegisterScreenProps {
  onNavigateLogin: () => void;
  onRegisterSuccess: () => void;
}

export function RegisterScreen({ onNavigateLogin, onRegisterSuccess }: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const setAuth = useStore((s) => s.setAuth);

  const handleRegister = async () => {
    setError('');
    setEmailError('');
    const cleanEmail = trimEmail(email);
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!cleanEmail || !password) {
      setError('All fields are required');
      return;
    }
    if (!tosAccepted) {
      setError('Please accept the Terms of Service');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('auth/register', { email: cleanEmail, password });
      await secureSet('rw_access_token', data.access_token);
      await secureSet('rw_refresh_token', data.refresh_token);
      setAuth(
        { id: parseJwtSub(data.access_token), email: cleanEmail, role: 'user' },
        {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        },
      );
      onRegisterSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Registration failed';
      setError(msg);
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
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start your optimization journey</Text>

        {error ? <ErrorBanner testID="register-error-message" message={error} onDismiss={() => setError('')} /> : null}

        <TextInput
          testID="register-email-input"
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
          accessibilityHint="Enter your email to create an account"
        />
        {emailError ? <Text style={styles.emailError}>{emailError}</Text> : null}
        <View style={{ position: 'relative' }}>
          <TextInput
            testID="register-password-input"
            style={[styles.input, { paddingRight: spacing[10] }]}
            placeholder="Password"
            placeholderTextColor={colors.text.muted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            ref={passwordRef}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            accessibilityLabel="Password"
            accessibilityHint="Create a password with at least 8 characters"
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
        <View style={{ position: 'relative' }}>
          <TextInput
            testID="register-confirm-password-input"
            style={[styles.input, { paddingRight: spacing[10] }]}
            placeholder="Confirm Password"
            placeholderTextColor={colors.text.muted}
            secureTextEntry={!showConfirm}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            ref={confirmRef}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            accessibilityLabel="Confirm password"
            accessibilityHint="Re-enter your password to confirm"
          />
          <TouchableOpacity
            onPress={() => setShowConfirm(!showConfirm)}
            style={{ position: 'absolute', right: spacing[3], top: spacing[3], minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
            accessibilityRole="button"
          >
            <Icon name={showConfirm ? 'eye-off' : 'eye'} size={20} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity testID="register-tos-checkbox" onPress={() => setTosAccepted(!tosAccepted)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3], gap: spacing[2], minHeight: 44 }} accessibilityRole="checkbox" accessibilityState={{ checked: tosAccepted }} accessibilityLabel="Accept Terms of Service and Privacy Policy">
          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: tosAccepted ? colors.accent.primary : colors.border.default, backgroundColor: tosAccepted ? colors.accent.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {tosAccepted && <Text style={{ color: colors.text.primary, fontSize: typography.size.base }}>✓</Text>}
          </View>
          <Text style={{ color: colors.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, flex: 1 }}>I agree to the Terms of Service and Privacy Policy</Text>
        </TouchableOpacity>

        <Button testID="register-submit-button" title="Register" onPress={handleRegister} loading={loading} disabled={!tosAccepted || loading} style={styles.btn} />

        <TouchableOpacity testID="register-login-link" onPress={onNavigateLogin} style={styles.link}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkAccent}>Sign In</Text>
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
