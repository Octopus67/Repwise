import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { Icon } from '../../components/common/Icon';

const TELEGRAM_URL = 'https://t.me/repwiseCommunity';

export function CommunityScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="community-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Community</Text>

        <View style={styles.comingSoonBox}>
          <Text style={styles.comingSoonBadge}>Coming Soon</Text>
          <Text style={styles.comingSoonTitle}>Community features are in development</Text>
          <Text style={styles.comingSoonDesc}>
            We're building a space for serious lifters to share progress, exchange training insights, and support each other.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Join Us Now</Text>
        <TouchableOpacity onPress={() => Linking.openURL(TELEGRAM_URL)} activeOpacity={0.8}>
          <Card style={styles.linkCard}>
            <Icon name="chat" size={22} color={colors.accent.primary} />
            <View style={styles.linkContent}>
              <Text style={styles.linkTitle}>Telegram Community</Text>
              <Text style={styles.linkDesc}>Join our active group of lifters</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  backBtn: { paddingVertical: spacing[2], marginBottom: spacing[2] },
  backText: { color: colors.accent.primary, fontSize: typography.size.base },
  title: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[4] },
  comingSoonBox: { backgroundColor: colors.bg.surface, borderRadius: radius.lg, padding: spacing[6], alignItems: 'center', marginBottom: spacing[6], borderWidth: 1, borderColor: colors.border.subtle },
  comingSoonBadge: { color: colors.accent.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, backgroundColor: colors.accent.primaryMuted, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, overflow: 'hidden', marginBottom: spacing[3] },
  comingSoonTitle: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold, textAlign: 'center', marginBottom: spacing[2] },
  comingSoonDesc: { color: colors.text.secondary, fontSize: typography.size.sm, textAlign: 'center', lineHeight: 20 },
  sectionTitle: { color: colors.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginBottom: spacing[2] },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  linkContent: { flex: 1 },
  linkTitle: { color: colors.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium },
  linkDesc: { color: colors.text.muted, fontSize: typography.size.sm },
  arrow: { color: colors.text.muted, fontSize: typography.size.lg },
});
