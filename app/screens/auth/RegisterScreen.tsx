import React, { useRef, useState, useEffect, useMemo } from 'react';
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
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Button } from '../../components/common/Button';
import api from '../../services/api';
import { LEGAL_URLS } from '../../constants/urls';
import { useStore } from '../../store';
import { isValidEmail, trimEmail } from '../../utils/validation';
import { getPasswordStrength } from '../../utils/passwordStrength';
import { extractApiError } from '../../utils/extractApiError';
import { PasswordStrengthMeter } from '../../components/auth/PasswordStrengthMeter';
import Animated from 'react-native-reanimated';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { SocialLoginButtons } from '../../components/auth/SocialLoginButtons';
import { secureSet, TOKEN_KEYS } from '../../utils/secureStorage';
import { parseJwtSub } from '../../utils/jwtUtils';
import { createRateLimiter } from '../../utils/rateLimiter';

const registerLimiter = createRateLimiter(5, 60000);

interface RegisterScreenProps {
  onNavigateLogin: () => void;
  onRegisterSuccess: (email: string) => void;
}

export function RegisterScreen({ onNavigateLogin, onRegisterSuccess }: RegisterScreenProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
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
    if (!registerLimiter.canAttempt()) {
      setError(`Too many attempts. Try again in ${Math.ceil(registerLimiter.remainingMs() / 1000)}s`);
      return;
    }
    const cleanEmail = trimEmail(email);
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!cleanEmail || !password) {
      setError('All fields are required');
      return;
    }
    if (!strengthResult.isValid) {
      const missing: string[] = [];
      if (!strengthResult.validation.minLength) missing.push('at least 8 characters');
      if (!strengthResult.validation.hasUppercase) missing.push('an uppercase letter');
      if (!strengthResult.validation.hasLowercase) missing.push('a lowercase letter');
      if (!strengthResult.validation.hasDigit) missing.push('a number');
      if (!strengthResult.validation.hasSpecialChar) missing.push('a special character (!@#$...)');
      setError(missing.length > 0 ? `Password needs ${missing.join(', ')}.` : 'Password is too weak. Try a more unique combination.');
      return;
    }

    setLoading(true);
    registerLimiter.recordAttempt();
    try {
      const { data } = await api.post('auth/register', { email: cleanEmail, password });
      if (data.access_token && data.refresh_token) {
        await secureSet(TOKEN_KEYS.access, data.access_token);
        await secureSet(TOKEN_KEYS.refresh, data.refresh_token);
        // Log user in immediately — email verification is deferrable
        setAuth(
          { id: parseJwtSub(data.access_token), email: cleanEmail, role: 'user', emailVerified: false },
          { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in },
        );
        useStore.getState().setNeedsOnboarding(true);
      } else {
        // Email already exists — generic message shown by backend
        onRegisterSuccess(cleanEmail);
      }
    } catch (err: unknown) {
      const msg = extractApiError(err, 'Registration failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSuccess = async (tokens: { access_token: string; refresh_token: string; expires_in: number }) => {
    await secureSet(TOKEN_KEYS.access, tokens.access_token);
    await secureSet(TOKEN_KEYS.refresh, tokens.refresh_token);
    // OAuth users are pre-verified — set auth immediately with onboarding flag
    setAuth(
      { id: parseJwtSub(tokens.access_token), email: '', role: 'user', emailVerified: true },
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
        <View style={styles.inputWrapper}>
          <TextInput
            testID="register-password-input"
            style={[styles.input, { paddingRight: spacing[10] }]}
            placeholder="Password"
            placeholderTextColor={c.text.muted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            ref={passwordRef}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            accessibilityLabel="Password"
            accessibilityHint="Create a password with at least 8 characters"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeToggle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={c.text.muted} />
          </TouchableOpacity>
        </View>

        <PasswordStrengthMeter result={strengthResult} password={password} />

        </Animated.View>

        <Animated.View style={buttonAnim}>
        <Text style={[styles.legalText, { color: c.text.muted }]}>
          By registering, you agree to our{' '}
          <Text style={[styles.legalLink, { color: c.accent.primary }]} onPress={() => Linking.openURL(LEGAL_URLS.terms)} accessibilityRole="link">Terms of Service</Text>
          {' '}and{' '}
          <Text style={[styles.legalLink, { color: c.accent.primary }]} onPress={() => Linking.openURL(LEGAL_URLS.privacy)} accessibilityRole="link">Privacy Policy</Text>
        </Text>

        <Button testID="register-submit-button" title="Register" onPress={handleRegister} loading={loading} disabled={loading} style={styles.btn} />
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
  inputWrapper: { position: 'relative' as const },
  eyeToggle: { position: 'absolute' as const, right: spacing[3], top: spacing[3], minWidth: 44, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  legalText: { fontSize: typography.size.xs, textAlign: 'center' as const, marginBottom: spacing[3], lineHeight: typography.lineHeight.sm },
  legalLink: { textDecorationLine: 'underline' as const },
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
