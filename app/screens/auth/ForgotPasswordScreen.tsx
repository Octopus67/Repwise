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
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Button } from '../../components/common/Button';
import api from '../../services/api';
import { isValidEmail, trimEmail } from '../../utils/validation';

interface ForgotPasswordScreenProps {
  onNavigateBack: () => void;
}

export function ForgotPasswordScreen({ onNavigateBack }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.successMessage}>
            If an account with that email exists, we've sent a reset link.
          </Text>
          <TouchableOpacity onPress={onNavigateBack} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back to Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email and we'll send a reset link.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          testID="forgot-email-input"
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.text.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(text) => { setEmail(text); setError(''); }}
        />

        <Button
          testID="forgot-submit-button"
          title="Send Reset Link"
          onPress={handleSubmit}
          loading={loading}
          style={styles.btn}
        />

        <TouchableOpacity onPress={onNavigateBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back to Sign In</Text>
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
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[8],
  },
  error: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[4],
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
  },
  btn: { marginTop: spacing[2] },
  successMessage: {
    color: colors.text.secondary,
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
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
