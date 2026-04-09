import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation } from '@tanstack/react-query';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon, type IconName } from '../../components/common/Icon';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { capture } from '../../services/analytics';
import api from '../../services/api';

type Source = 'strong' | 'hevy' | 'fitnotes';
type Step = 'source' | 'file' | 'preview' | 'result';

const SOURCES: { id: Source; label: string; icon: IconName }[] = [
  { id: 'strong', label: 'Strong', icon: 'muscle' },
  { id: 'hevy', label: 'Hevy', icon: 'dumbbell' },
  { id: 'fitnotes', label: 'FitNotes', icon: 'clipboard' },
];

interface PreviewData {
  session_count: number;
  date_range: [string, string];
  exercise_mappings: { imported_name: string; matched: string | null; create_as_custom: boolean }[];
  unmapped_count: number;
}

interface ImportResult { sessions_imported: number; exercises_created: number }

export function ImportDataScreen() {
  const c = useThemeColors();
  const s = getStyles(c);
  const nav = useNavigation();
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<Source | null>(null);
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const previewMut = useMutation({
    mutationKey: ['import', 'upload'], // Audit fix 4.4 — offline persistence
    mutationFn: async () => {
      if (!file?.uri) throw new Error('No file selected');
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name, type: 'text/csv' } as any);
      form.append('weight_unit', weightUnit);
      const { data } = await api.post('import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      return data as PreviewData;
    },
    onSuccess: (data) => { setPreview(data); setStep('preview'); },
    onError: () => Alert.alert('Error', 'Failed to parse file. Check the format.'),
  });

  const executeMut = useMutation({
    mutationKey: ['import', 'process'], // Audit fix 4.4 — offline persistence
    mutationFn: async () => {
      if (!file?.uri) throw new Error('No file');
      capture('import_started', { source });
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name, type: 'text/csv' } as any);
      form.append('weight_unit', weightUnit);
      const { data } = await api.post('import/execute', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      return data as ImportResult;
    },
    onSuccess: (data) => { capture('import_completed', { ...data, source }); setStep('result'); },
    onError: () => { capture('import_failed', { source }); Alert.alert('Error', 'Import failed. Please try again.'); },
  });

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      setFile(result.assets[0]);
      setStep('file');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => step === 'source' ? nav.goBack() : setStep(step === 'file' ? 'source' : step === 'preview' ? 'file' : 'source')} style={s.back}>
          <Text style={[s.backText, { color: c.accent.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Import Workouts</Text>

        {step === 'source' && (
          <View style={s.section}>
            <Text style={s.subtitle}>Select your app</Text>
            {SOURCES.map((src) => (
              <TouchableOpacity key={src.id} onPress={() => { setSource(src.id); pickFile(); }} style={s.sourceRow}>
                <Card><View style={s.sourceInner}><Icon name={src.icon} size={20} color={c.accent.primary} /><Text style={s.sourceLabel}>{src.label}</Text><Text style={s.chevron}>›</Text></View></Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 'file' && file && (
          <View style={s.section}>
            <Text style={s.subtitle}>File selected</Text>
            <Card><Text style={s.fileName}>{file.name}</Text></Card>
            {source === 'strong' && (
              <View style={s.unitRow}>
                <Text style={s.unitLabel}>Weight unit in export:</Text>
                {(['kg', 'lbs'] as const).map((u) => (
                  <TouchableOpacity key={u} onPress={() => setWeightUnit(u)} style={[s.unitBtn, weightUnit === u && { backgroundColor: c.accent.primary }]}>
                    <Text style={[s.unitText, weightUnit === u && { color: '#fff' }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Button title="Preview Import" onPress={() => previewMut.mutate()} loading={previewMut.isPending} />
          </View>
        )}

        {step === 'preview' && preview && (
          <View style={s.section}>
            <Text style={s.subtitle}>Preview</Text>
            <Card>
              <Text style={s.stat}>{preview.session_count} sessions</Text>
              <Text style={s.statSub}>{preview.date_range[0]} → {preview.date_range[1]}</Text>
              <Text style={s.stat}>{preview.exercise_mappings.length} exercises ({preview.unmapped_count} new)</Text>
            </Card>
            <Button title={`Import ${preview.session_count} Sessions`} onPress={() => executeMut.mutate()} loading={executeMut.isPending} />
          </View>
        )}

        {step === 'result' && executeMut.data && (
          <View style={s.section}>
            <Icon name="check" size={40} color={c.semantic.positive} />
            <Text style={s.successTitle}>Import Complete</Text>
            <Card>
              <Text style={s.stat}>{executeMut.data.sessions_imported} sessions imported</Text>
              <Text style={s.stat}>{executeMut.data.exercises_created} exercises created</Text>
            </Card>
            <Button title="Done" onPress={() => nav.goBack()} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[3] },
  back: { marginBottom: spacing[1] },
  backText: { fontSize: typography.size.base, fontWeight: typography.weight.medium },
  title: { color: c.text.primary, fontSize: typography.size.xl, fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  subtitle: { color: c.text.secondary, fontSize: typography.size.base, marginBottom: spacing[2] },
  section: { gap: spacing[3] },
  sourceRow: { marginBottom: spacing[1] },
  sourceInner: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  icon: { fontSize: 24 },
  sourceLabel: { flex: 1, color: c.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium },
  chevron: { color: c.text.muted, fontSize: typography.size.lg },
  fileName: { color: c.text.primary, fontSize: typography.size.sm },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  unitLabel: { color: c.text.secondary, fontSize: typography.size.sm },
  unitBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  unitText: { color: c.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  stat: { color: c.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  statSub: { color: c.text.muted, fontSize: typography.size.sm, marginTop: spacing[0.5] },
  successIcon: { fontSize: 48, textAlign: 'center' },
  successTitle: { color: c.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.bold, textAlign: 'center' },
});

export default ImportDataScreen;
