import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { Icon } from '../../components/common/Icon';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import api from '../../services/api';

interface CommunityLinks {
  telegram_url: string;
  contact_email: string;
}

const DEFAULT_LINKS: CommunityLinks = {
  telegram_url: 'https://t.me/hypertrophyos',
  contact_email: 'community@hypertrophyos.com',
};

export function CommunityScreen() {
  const navigation = useNavigation();
  const [links, setLinks] = useState<CommunityLinks>(DEFAULT_LINKS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setError(null);
      const { data } = await api.get('community');
      setLinks({
        telegram_url: data.telegram_url ?? DEFAULT_LINKS.telegram_url,
        contact_email: data.contact_email ?? DEFAULT_LINKS.contact_email,
      });
    } catch {
      setError('Unable to load community links. Check your connection.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="community-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>
          Connect with fellow lifters, share progress, and get support.
        </Text>

        {error && <ErrorBanner message={error} onRetry={loadLinks} />}

        <TouchableOpacity
          onPress={() => Linking.openURL(links.telegram_url)}
          activeOpacity={0.8}
          testID="community-telegram-link"
        >
          <Card style={styles.linkCard}>
            <Icon name="chat" />
            <View style={styles.linkContent}>
              <Text style={styles.linkTitle}>Telegram Community</Text>
              <Text style={styles.linkDesc}>
                Join our active community of serious lifters
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL(`mailto:${links.contact_email}`)}
          activeOpacity={0.8}
          testID="community-email-link"
        >
          <Card style={styles.linkCard}>
            <Icon name="mail" />
            <View style={styles.linkContent}>
              <Text style={styles.linkTitle}>Contact Us</Text>
              <Text style={styles.linkDesc}>{links.contact_email}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </Card>
        </TouchableOpacity>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Community Guidelines</Text>
          <Text style={styles.infoText}>
            • Be respectful and supportive{'\n'}
            • Share evidence-based information{'\n'}
            • No spam or self-promotion{'\n'}
            • Keep discussions on topic{'\n'}
            • Help newcomers feel welcome
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  backButton: { paddingVertical: spacing[2], marginBottom: spacing[2], minHeight: 44, justifyContent: 'center' as const },
  backButtonText: { color: colors.accent.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium, lineHeight: typography.size.base * typography.lineHeight.normal },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.xl * typography.lineHeight.tight,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    marginTop: spacing[2],
    marginBottom: spacing[6],
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[3],
    minHeight: 44,
  },
  linkIcon: { fontSize: typography.size['2xl'] },
  linkContent: { flex: 1 },
  linkTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.md * typography.lineHeight.tight,
  },
  linkDesc: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginTop: spacing[1],
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  arrow: {
    color: colors.accent.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  infoCard: { marginTop: spacing[6] },
  infoTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[3],
    lineHeight: typography.size.md * typography.lineHeight.tight,
  },
  infoText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
});
