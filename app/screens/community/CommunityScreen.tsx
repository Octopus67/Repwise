import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { Icon } from '../../components/common/Icon';
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

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const { data } = await api.get('community');
      setLinks({
        telegram_url: data.telegram_url ?? DEFAULT_LINKS.telegram_url,
        contact_email: data.contact_email ?? DEFAULT_LINKS.contact_email,
      });
    } catch { /* use defaults */ }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="community-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: spacing[2], marginBottom: spacing[2] }} activeOpacity={0.7}>
            <Text style={{ color: colors.accent.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium }}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>
          Connect with fellow lifters, share progress, and get support.
        </Text>

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
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
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
  },
  linkIcon: { fontSize: typography.size['2xl'] },
  linkContent: { flex: 1 },
  linkTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  linkDesc: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginTop: 2,
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
  },
  infoText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
});
