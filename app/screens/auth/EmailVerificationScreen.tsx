import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { getThemeColors, ThemeColors, useThemeColors} from '../../hooks/useThemeColors';
import { Button } from '../../components/common/Button';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import api from '../../services/api';
import Animated from 'react-native-reanimated';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { createRateLimiter } from '../../utils/rateLimiter';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const verifyLimiter = createRateLimiter(5, 60000);

interface EmailVerificationScreenProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

export function EmailVerificationScreen({ email, onVerified, onBack }: EmailVerificationScreenProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const titleAnim = useStaggeredEntrance(0, 80);
  const subtitleAnim = useStaggeredEntrance(1, 80);
  const formAnim = useStaggeredEntrance(2, 80);
  const buttonAnim = useStaggeredEntrance(3, 80);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const submitCode = useCallback(async (verificationCode: string) => {
    setError('');
    if (!verifyLimiter.canAttempt()) {
      setError(`Too many attempts. Try again in ${Math.ceil(verifyLimiter.remainingMs() / 1000)}s`);
      return;
    }
    setLoading(true);
    verifyLimiter.recordAttempt();
    try {
      await api.post('auth/verify-email', { code: verificationCode });
      Alert.alert('Email Verified!', 'Your email has been verified successfully.', [
        { text: 'Continue', onPress: onVerified },
      ]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invalid verification code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [email, onVerified]);

  const handleCodeChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError('');
    if (digits.length === CODE_LENGTH) {
      submitCode(digits);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await api.post('auth/resend-verification');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to resend code';
      setError(msg);
    } finally {
      setResending(false);
    }
  };


  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg.base }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={titleAnim}>
          <Text style={[styles.title, { color: c.text.primary }]}>Verify Your Email</Text>
        </Animated.View>
        <Animated.View style={subtitleAnim}>
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={{ color: c.accent.primary }}>{email}</Text>
          </Text>
        </Animated.View>

        <Animated.View style={formAnim}>
          {error ? <ErrorBanner testID="verify-error-message" message={error} onDismiss={() => setError('')} /> : null}

          {/* Hidden input that captures keyboard */}
          <TextInput
            ref={inputRef}
            testID="verify-code-input"
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            style={styles.hiddenInput}
            autoFocus
            accessibilityLabel="Verification code"
            accessibilityHint="Enter the 6-digit verification code"
          />

          {/* Visual digit boxes */}
          <TouchableOpacity
            style={styles.codeRow}
            onPress={() => inputRef.current?.focus()}
            activeOpacity={0.8}
            accessibilityRole="none"
          >
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const digit = code[i] ?? '';
              const isFocused = code.length === i;
              return (
                <View
                  key={i}
                  style={[
                    styles.digitBox,
                    {
                      backgroundColor: c.bg.surfaceRaised,
                      borderColor: isFocused ? c.accent.primary : digit ? c.border.default : c.border.subtle,
                    },
                  ]}
                >
                  <Text style={[styles.digit, { color: c.text.primary }]}>{digit}</Text>
                </View>
              );
            })}
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={buttonAnim}>
          <Button
            testID="verify-submit-button"
            title="Verify"
            onPress={() => submitCode(code)}
            loading={loading}
            disabled={code.length < CODE_LENGTH || loading}
            style={styles.btn}
          />

          <TouchableOpacity
            testID="verify-resend-button"
            onPress={handleResend}
            disabled={resendCooldown > 0 || resending}
            style={styles.resendLink}
            accessibilityLabel={resendCooldown > 0 ? `Resend code available in ${resendCooldown} seconds` : 'Resend verification code'}
            accessibilityRole="button"
          >
            <Text style={[styles.resendText, { color: resendCooldown > 0 ? c.text.muted : c.accent.primary }]}>
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onBack} style={styles.backLink}>
            <Text style={[styles.backText, { color: c.text.secondary }]}>← Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getThemedStyles = (c: ReturnType<typeof getThemeColors>) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[6] },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    lineHeight: typography.lineHeight['2xl'],
  },
  subtitle: {
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[8],
    lineHeight: typography.lineHeight.base,
  },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  digitBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.xl,
  },
  btn: { marginTop: spacing[2] },
  resendLink: { alignItems: 'center', marginTop: spacing[4], minHeight: 44, justifyContent: 'center' },
  resendText: { fontSize: typography.size.base, fontWeight: typography.weight.medium },
  backLink: { alignItems: 'center', marginTop: spacing[3], minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: typography.size.base },
});
