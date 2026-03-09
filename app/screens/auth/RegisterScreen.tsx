import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Linking,
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
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Button } from '../../components/common/Button';
import api from '../../services/api';
import { useStore } from '../../store';
import { isValidEmail, trimEmail } from '../../utils/validation';
import { getPasswordStrength } from '../../utils/passwordStrength';
import { extractApiError } from '../../utils/extractApiError';
import { PasswordStrengthMeter } from '../../components/auth/PasswordStrengthMeter';
import Animated from 'react-native-reanimated';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { SocialLoginButtons } from '../../components/auth/SocialLoginButtons';

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
  onRegisterSuccess: (email: string) => void;
}

export function RegisterScreen({ onNavigateLogin, onRegisterSuccess }: RegisterScreenProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
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
  const titleAnim = useStaggeredEntrance(0, 80);
  const subtitleAnim = useStaggeredEntrance(1, 80);
  const formAnim = useStaggeredEntrance(2, 80);
  const buttonAnim = useStaggeredEntrance(3, 80);
  const linkAnim = useStaggeredEntrance(4, 80);

  const strengthResult = useMemo(() => getPasswordStrength(password), [password]);

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
    if (!strengthResult.isValid) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('auth/register', { email: cleanEmail, password });
      // Don't set auth until email is verified — just store tokens for post-verification
      if (data.access_token && data.refresh_token) {
        await secureSet('rw_access_token', data.access_token);
        await secureSet('rw_refresh_token', data.refresh_token);
      }
      onRegisterSuccess(cleanEmail);
    } catch (err: unknown) {
      const msg = extractApiError(err, 'Registration failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSuccess = async (tokens: { access_token: string; refresh_token: string; expires_in: number }) => {
    await secureSet('rw_access_token', tokens.access_token);
    await secureSet('rw_refresh_token', tokens.refresh_token);
    // OAuth users are pre-verified — set auth immediately with onboarding flag
    setAuth(
      { id: parseJwtSub(tokens.access_token), email: '', role: 'user' },
      { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in },
    );
    useStore.getState().setNeedsOnboarding(true);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg.base }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={titleAnim}>
          <Text style={[styles.title, { color: c.text.primary }]}>Create Account</Text>
        </Animated.View>
        <Animated.View style={subtitleAnim}>
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>Start your optimization journey</Text>
        </Animated.View>

        <Animated.View style={formAnim}>
        {error ? <ErrorBanner testID="register-error-message" message={error} onDismiss={() => setError('')} /> : null}

        <SocialLoginButtons onSuccess={handleSocialSuccess} onError={setError} />

        <TextInput
          testID="register-email-input"
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
          accessibilityHint="Enter your email to create an account"
        />
        {emailError ? <Text style={[styles.emailError, { color: c.semantic.negative }]}>{emailError}</Text> : null}
        <View style={{ position: 'relative' }}>
          <TextInput
            testID="register-password-input"
            style={[styles.input, { paddingRight: spacing[10] }]}
            placeholder="Password"
            placeholderTextColor={c.text.muted}
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
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={c.text.muted} />
          </TouchableOpacity>
        </View>

        <PasswordStrengthMeter result={strengthResult} password={password} />

        <View style={{ position: 'relative' }}>
          <TextInput
            testID="register-confirm-password-input"
            style={[styles.input, { paddingRight: spacing[10] }]}
            placeholder="Confirm Password"
            placeholderTextColor={c.text.muted}
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
            <Icon name={showConfirm ? 'eye-off' : 'eye'} size={20} color={c.text.muted} />
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && password !== confirmPassword && (
          <Text style={[styles.emailError, { color: c.semantic.negative }]}>Passwords do not match</Text>
        )}
        </Animated.View>

        <Animated.View style={buttonAnim}>
        <TouchableOpacity testID="register-tos-checkbox" onPress={() => setTosAccepted(!tosAccepted)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3], gap: spacing[2], minHeight: 44 }} accessibilityRole="checkbox" accessibilityState={{ checked: tosAccepted }} accessibilityLabel="Accept Terms of Service and Privacy Policy">
          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: tosAccepted ? c.accent.primary : c.border.default, backgroundColor: tosAccepted ? c.accent.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {tosAccepted && <Text style={{ color: c.text.primary, fontSize: typography.size.base }}>✓</Text>}
          </View>
          <Text style={{ color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, flex: 1 }}>
            I agree to the{' '}
            <Text style={{ color: c.accent.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://www.termsfeed.com/blog/sample-terms-of-service-template/')} accessibilityRole="link">Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: c.accent.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://www.termsfeed.com/blog/sample-privacy-policy-template/')} accessibilityRole="link">Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        <Button testID="register-submit-button" title="Register" onPress={handleRegister} loading={loading} disabled={!tosAccepted || loading} style={styles.btn} />
        </Animated.View>

        <Animated.View style={linkAnim}>
        <TouchableOpacity testID="register-login-link" onPress={onNavigateLogin} style={styles.link}>
          <Text style={[styles.linkText, { color: c.text.secondary }]}>
            Already have an account? <Text style={[styles.linkAccent, { color: c.accent.primary }]}>Sign In</Text>
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
  link: { alignItems: 'center', marginTop: spacing[6], minHeight: 44, justifyContent: 'center' },
  linkText: { color: c.text.secondary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base },
  linkAccent: { color: c.accent.primary, fontWeight: typography.weight.semibold },
});
