import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { radius, spacing, typography } from '../../theme/tokens';
import { getThemeColors, useThemeColors} from '../../hooks/useThemeColors';
import { Button } from '../../components/common/Button';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { Icon } from '../../components/common/Icon';
import { PasswordStrengthMeter } from '../../components/auth/PasswordStrengthMeter';
import { getPasswordStrength } from '../../utils/passwordStrength';
import api from '../../services/api';
import Animated from 'react-native-reanimated';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { createRateLimiter } from '../../utils/rateLimiter';
import { extractApiError } from '../../utils/extractApiError';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const resetLimiter = createRateLimiter(5, 60000);

interface ResetPasswordScreenProps {
  email: string;
  onResetSuccess: () => void;
  onBack: () => void;
}

export function ResetPasswordScreen({ email, onResetSuccess, onBack }: ResetPasswordScreenProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const titleAnim = useStaggeredEntrance(0, 80);
  const subtitleAnim = useStaggeredEntrance(1, 80);
  const formAnim = useStaggeredEntrance(2, 80);
  const buttonAnim = useStaggeredEntrance(3, 80);

  const strengthResult = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleCodeChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError('');
  };

  const handleSubmit = useCallback(async () => {
    setError('');
    if (!resetLimiter.canAttempt()) {
      setError(`Too many attempts. Try again in ${Math.ceil(resetLimiter.remainingMs() / 1000)}s`);
      return;
    }
    if (code.length < CODE_LENGTH) {
      setError('Please enter the 6-digit code');
      return;
    }
    if (!strengthResult.isValid) {
      setError('Password does not meet all requirements');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    resetLimiter.recordAttempt();
    try {
      await api.post('auth/reset-password', { email, code, new_password: password });
      onResetSuccess();
    } catch (err: unknown) {
      const msg = extractApiError(err, 'Failed to reset password');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [code, password, confirmPassword, email, strengthResult.isValid, onResetSuccess]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await api.post('auth/forgot-password', { email });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const msg = extractApiError(err, 'Failed to resend code');
      setError(msg);
    }
  };

  const canSubmit = code.length === CODE_LENGTH && strengthResult.isValid && password === confirmPassword && !loading;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg.base }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={titleAnim}>
          <Text style={[styles.title, { color: c.text.primary }]}>Reset Password</Text>
        </Animated.View>
        <Animated.View style={subtitleAnim}>
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={{ color: c.accent.primary }}>{email}</Text>
          </Text>
        </Animated.View>

        <Animated.View style={formAnim}>
          {error ? <ErrorBanner testID="reset-error-message" message={error} onDismiss={() => setError('')} /> : null}

          {/* Hidden input for OTP */}
          <TextInput
            ref={inputRef}
            testID="reset-code-input"
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            style={styles.hiddenInput}
            autoFocus
            accessibilityLabel="Reset code"
            accessibilityHint="Enter the 6-digit reset code"
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

          {/* New password */}
          <View style={styles.inputWrapper}>
            <TextInput
              testID="reset-password-input"
              ref={passwordRef}
              style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle, paddingRight: spacing[10] }]}
              placeholder="New Password"
              placeholderTextColor={c.text.muted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              accessibilityLabel="New password"
              accessibilityHint="Create a new password with at least 8 characters"
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

          {/* Confirm password */}
          <View style={styles.inputWrapper}>
            <TextInput
              testID="reset-confirm-password-input"
              ref={confirmRef}
              style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle, paddingRight: spacing[10] }]}
              placeholder="Confirm Password"
              placeholderTextColor={c.text.muted}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              accessibilityLabel="Confirm new password"
              accessibilityHint="Re-enter your new password to confirm"
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(!showConfirm)}
              style={styles.eyeToggle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
              accessibilityRole="button"
            >
              <Icon name={showConfirm ? 'eye-off' : 'eye'} size={20} color={c.text.muted} />
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <Text style={[styles.mismatch, { color: c.semantic.negative }]}>Passwords do not match</Text>
          )}
        </Animated.View>

        <Animated.View style={buttonAnim}>
          <Button
            testID="reset-submit-button"
            title="Reset Password"
            onPress={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
            style={styles.btn}
          />

          <TouchableOpacity
            testID="reset-resend-button"
            onPress={handleResend}
            disabled={resendCooldown > 0}
            style={styles.resendLink}
            accessibilityLabel={resendCooldown > 0 ? `Resend code available in ${resendCooldown} seconds` : 'Resend reset code'}
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
  inputWrapper: { position: 'relative' as const },
  eyeToggle: { position: 'absolute' as const, right: spacing[3], top: spacing[3], minWidth: 44, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
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
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: typography.size.base,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  mismatch: {
    fontSize: typography.size.xs,
    marginBottom: spacing[3],
    marginTop: -spacing[2],
  },
  btn: { marginTop: spacing[2] },
  resendLink: { alignItems: 'center', marginTop: spacing[4], minHeight: 44, justifyContent: 'center' },
  resendText: { fontSize: typography.size.base, fontWeight: typography.weight.medium },
  backLink: { alignItems: 'center', marginTop: spacing[3], minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: typography.size.base },
});
