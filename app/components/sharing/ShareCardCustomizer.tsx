/**
 * ShareCardCustomizer — Modal to customize share card options before sharing.
 *
 * Allows toggling: show exercises, show weights, show PRs, color theme.
 * Previews the card in real-time and provides Share / Save actions.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert,
} from 'react-native';
import type ViewShot from 'react-native-view-shot';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors } from '../../hooks/useThemeColors';
import { ModalContainer } from '../common/ModalContainer';
import { Button } from '../common/Button';
import {
  WorkoutShareCard,
  type ShareCardOptions,
  type ShareCardTheme,
} from './WorkoutShareCard';
import { captureWorkoutAsImage, shareImage, saveImageToGallery } from '../../services/sharing';
import { trackShareCustomizationOpened, trackWorkoutShared } from '../../services/analytics';
import type { TrainingSessionResponse } from '../../types/training';
import type { UnitSystem } from '../../utils/unitConversion';
import { useStore } from '../../store';

interface ShareCardCustomizerProps {
  visible: boolean;
  onClose: () => void;
  session: TrainingSessionResponse;
  unitSystem: UnitSystem;
}

const THEMES: { key: ShareCardTheme; label: string; color: string }[] = [
  { key: 'dark', label: 'Dark', color: '#0A0E13' },
  { key: 'midnight', label: 'Midnight', color: '#0F0A1A' },
  { key: 'ocean', label: 'Ocean', color: '#0A1628' },
];

export function ShareCardCustomizer({
  visible, onClose, session, unitSystem,
}: ShareCardCustomizerProps) {
  const c = useThemeColors();
  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const userId = useStore(s => s.user?.id);
  const username = useStore(s => s.profile?.displayName ?? undefined);

  React.useEffect(() => {
    if (visible) trackShareCustomizationOpened(session.id);
  }, [visible, session.id]);

  const [options, setOptions] = useState<ShareCardOptions>({
    showExercises: true,
    showWeights: true,
    showPRs: true,
    theme: 'dark',
  });

  const toggle = useCallback((key: keyof Omit<ShareCardOptions, 'theme'>) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setTheme = useCallback((theme: ShareCardTheme) => {
    setOptions(prev => ({ ...prev, theme }));
  }, []);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const uri = await captureWorkoutAsImage(viewShotRef);
      if (!uri) { Alert.alert('Error', 'Failed to capture image.'); return; }
      await shareImage(uri, { sessionId: session.id, userId: userId ?? undefined });
      trackWorkoutShared(session.id);
    } finally {
      setSharing(false);
    }
  }, [session.id, userId]);

  const handleSave = useCallback(async () => {
    setSharing(true);
    try {
      const uri = await captureWorkoutAsImage(viewShotRef);
      if (!uri) { Alert.alert('Error', 'Failed to capture image.'); return; }
      const saved = await saveImageToGallery(uri);
      if (saved) Alert.alert('Saved', 'Image saved to your photo library.');
    } finally {
      setSharing(false);
    }
  }, []);

  return (
    <ModalContainer visible={visible} onClose={onClose} title="Share Workout">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Preview */}
        <View style={styles.previewWrap}>
          <WorkoutShareCard
            ref={viewShotRef}
            session={session}
            unitSystem={unitSystem}
            options={options}
            sessionId={session.id}
            userId={userId}
            username={username}
          />
        </View>

        {/* Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text.muted }]}>OPTIONS</Text>

          <ToggleRow
            label="Show Exercises"
            value={options.showExercises}
            onToggle={() => toggle('showExercises')}
          />
          <ToggleRow
            label="Show Weights"
            value={options.showWeights}
            onToggle={() => toggle('showWeights')}
          />
          <ToggleRow
            label="Show PRs"
            value={options.showPRs}
            onToggle={() => toggle('showPRs')}
          />
        </View>

        {/* Theme picker */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text.muted }]}>THEME</Text>
          <View style={styles.themeRow}>
            {THEMES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.themeSwatch,
                  { backgroundColor: t.color },
                  options.theme === t.key && { borderColor: c.accent.primary, borderWidth: 2 },
                ]}
                onPress={() => setTheme(t.key)}
                accessibilityLabel={`${t.label} theme`}
                accessibilityRole="button"
              >
                <Text style={styles.themeLabel}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button title="Share" onPress={handleShare} disabled={sharing} style={styles.actionBtn} />
          <Button title="Save to Gallery" onPress={handleSave} disabled={sharing} style={styles.actionBtn} />
        </View>
      </ScrollView>
    </ModalContainer>
  );
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: getThemeColors().text.primary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: getThemeColors().bg.surfaceRaised, true: getThemeColors().accent.primaryMuted }}
        thumbColor={value ? getThemeColors().accent.primary : getThemeColors().text.muted}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing[8] },
  previewWrap: {
    alignItems: 'center',
    marginBottom: spacing[4],
    transform: [{ scale: 0.85 }],
  },
  section: { marginBottom: spacing[4], paddingHorizontal: spacing[4] },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 1.2,
    marginBottom: spacing[2],
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  toggleLabel: {
    fontSize: typography.size.base,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  themeSwatch: {
    flex: 1,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  themeLabel: {
    color: '#F1F5F9',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
  },
  actionBtn: { flex: 1 },
});
