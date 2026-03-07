/**
 * MeasurementsScreen — Tabbed screen for body measurements and progress photos.
 * Tabs: Measurements (form + trend chart) | Photos (grid)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { MeasurementInput } from '../../components/measurements/MeasurementInput';
import { NavyBFCalculator } from '../../components/measurements/NavyBFCalculator';
import { MeasurementTrendChart } from '../../components/measurements/MeasurementTrendChart';
import { ProgressPhotoGrid, PhotoItem } from '../../components/measurements/ProgressPhotoGrid';
import api from '../../services/api';
import type { BodyMeasurement, MeasurementFormData } from '../../types/measurements';

type Tab = 'measurements' | 'photos';

const PHOTO_STORAGE_KEY = 'measurement_photo_paths';

export function MeasurementsScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>('measurements');
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNavyCalc, setShowNavyCalc] = useState(false);
  const [calcBodyFatPct, setCalcBodyFatPct] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [measureRes, storedPhotos] = await Promise.all([
        api.get('body-measurements?limit=100').catch(() => ({ data: { items: [] } })),
        AsyncStorage.getItem(PHOTO_STORAGE_KEY),
      ]);

      const items = (measureRes.data?.items ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        measuredAt: m.measured_at as string,
        weightKg: m.weight_kg as number | null,
        bodyFatPct: m.body_fat_pct as number | null,
        waistCm: m.waist_cm as number | null,
        neckCm: m.neck_cm as number | null,
        hipsCm: m.hips_cm as number | null,
        chestCm: m.chest_cm as number | null,
        bicepLeftCm: m.bicep_left_cm as number | null,
        bicepRightCm: m.bicep_right_cm as number | null,
        thighLeftCm: m.thigh_left_cm as number | null,
        thighRightCm: m.thigh_right_cm as number | null,
        calfLeftCm: m.calf_left_cm as number | null,
        calfRightCm: m.calf_right_cm as number | null,
        notes: (m.notes as string) ?? '',
      }));

      setMeasurements(items);
      setPhotos(storedPhotos ? JSON.parse(storedPhotos) : []);
    } catch {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = useCallback(async (data: MeasurementFormData) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { measured_at: data.measuredAt };
      if (data.weight.trim()) payload.weight_kg = parseFloat(data.weight);
      if (data.bodyFatPct.trim()) payload.body_fat_pct = parseFloat(data.bodyFatPct);
      if (data.waist.trim()) payload.waist_cm = parseFloat(data.waist);
      if (data.neck.trim()) payload.neck_cm = parseFloat(data.neck);
      if (data.hips.trim()) payload.hips_cm = parseFloat(data.hips);
      if (data.chest.trim()) payload.chest_cm = parseFloat(data.chest);
      if (data.bicepLeft.trim()) payload.bicep_left_cm = parseFloat(data.bicepLeft);
      if (data.bicepRight.trim()) payload.bicep_right_cm = parseFloat(data.bicepRight);
      if (data.thighLeft.trim()) payload.thigh_left_cm = parseFloat(data.thighLeft);
      if (data.thighRight.trim()) payload.thigh_right_cm = parseFloat(data.thighRight);
      if (data.calfLeft.trim()) payload.calf_left_cm = parseFloat(data.calfLeft);
      if (data.calfRight.trim()) payload.calf_right_cm = parseFloat(data.calfRight);
      if (data.notes.trim()) payload.notes = data.notes;

      await api.post('body-measurements', payload);
      await loadData();
      Alert.alert('Saved', 'Measurement recorded successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save measurement');
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Body Measurements</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['measurements', 'photos'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'measurements' ? 'Measurements' : 'Photos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'measurements' ? (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <MeasurementTrendChart measurements={measurements} />
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>New Entry</Text>
            <MeasurementInput
              onSubmit={handleSubmit}
              loading={saving}
              onOpenNavyCalc={() => setShowNavyCalc(true)}
              bodyFatPctFromCalc={calcBodyFatPct}
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.content}>
          <ProgressPhotoGrid
            photos={photos}
            onPhotosChange={setPhotos}
          />
        </ScrollView>
      )}

      <NavyBFCalculator
        visible={showNavyCalc}
        onClose={() => setShowNavyCalc(false)}
        onResult={(bf) => setCalcBodyFatPct(bf.toFixed(1))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  backBtn: { width: 60, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.accent.primary, fontSize: typography.size.base },
  title: {
    color: colors.text.primary, fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  tabBar: {
    flexDirection: 'row', paddingHorizontal: spacing[4],
    paddingTop: spacing[2], gap: spacing[2],
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[2],
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.accent.primary },
  tabText: {
    color: colors.text.secondary, fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  tabTextActive: { color: colors.accent.primary, fontWeight: typography.weight.semibold },
  content: { flex: 1, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  formSection: { marginTop: spacing[2] },
  sectionTitle: {
    color: colors.text.primary, fontSize: typography.size.md,
    fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.md,
    marginBottom: spacing[3],
  },
});
