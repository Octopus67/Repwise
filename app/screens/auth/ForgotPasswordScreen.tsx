import React, { useState } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Button } from '../../components/common/Button';
import api from '../../services/api';
import { isValidEmail, trimEmail } from '../../utils/validation';
import { extractApiError } from '../../utils/extractApiError';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import Animated from 'react-native-reanimated';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';

interface ForgotPasswordScreenProps {
  onNavigateBack: () => void;
  onNavigateResetPassword?: (email: string) => void;
}

export function ForgotPasswordScreen({ onNavigateBack, onNavigateResetPassword }: ForgotPasswordScreenProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const titleAnim = useStaggeredEntrance(0, 80);
  const subtitleAnim = useStaggeredEntrance(1, 80);
  const formAnim = useStaggeredEntrance(2, 80);
  const buttonAnim = useStaggeredEntrance(3, 80);

  const handleSubmit = async () => {
    setError('');
    const cleanEmail = trimEmail(email);
    if (!cleanEmail) {
      setError('Please enter your email address');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await api.post('auth/forgot-password', { email: cleanEmail });
      if (onNavigateResetPassword) {
        onNavigateResetPassword(cleanEmail);
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      setError(extractApiError(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: c.bg.base }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={titleAnim}>
            <Text style={[styles.title, { color: c.text.primary }]}>Check Your Email</Text>
          </Animated.View>
          <Animated.View style={subtitleAnim}>
            <Text style={[styles.successMessage, { color: c.text.secondary }]}>
              If an account with that email exists, we've sent a reset link.
            </Text>
          </Animated.View>
          <Animated.View style={formAnim}>
            <TouchableOpacity onPress={onNavigateBack} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: c.accent.primary }]}>← Back to Sign In</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>Enter your email and we'll send a reset link.</Text>
        </Animated.View>

        <Animated.View style={formAnim}>
        {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

        <TextInput
          testID="forgot-email-input"
          style={[styles.input, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}
          placeholder="Email"
          placeholderTextColor={c.text.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(text) => { setEmail(text); setError(''); }}
        />
        </Animated.View>

        <Animated.View style={buttonAnim}>
        <Button
          testID="forgot-submit-button"
          title="Send Reset Link"
          onPress={handleSubmit}
          loading={loading}
          style={styles.btn}
        />

        <TouchableOpacity onPress={onNavigateBack} style={styles.backLink}>
          <Text style={[styles.backLinkText, { color: c.accent.primary }]}>← Back to Sign In</Text>
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
  },
  subtitle: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[8],
  },
  error: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[4],
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
  },
  btn: { marginTop: spacing[2] },
  successMessage: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[8],
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
  backLink: {
    alignItems: 'center',
    marginTop: spacing[6],
  },
  backLinkText: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
