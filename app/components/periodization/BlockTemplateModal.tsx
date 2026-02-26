import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { ModalContainer } from '../common/ModalContainer';
import { Button } from '../common/Button';
import api from '../../services/api';

interface TemplatePhase {
  phase_type: string;
  duration_weeks: number;
}

interface BlockTemplate {
  id: string;
  name: string;
  description: string;
  phases: TemplatePhase[];
}

interface BlockTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export function BlockTemplateModal({ visible, onClose, onApplied }: BlockTemplateModalProps) {
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (visible) {
      setError(null);
      setSelectedId(null);
      setStartDate(new Date().toISOString().split('T')[0]);
      setLoadingTemplates(true);
      api.get('periodization/templates')
        .then(({ data }) => setTemplates(data))
        .catch(() => setError('Failed to load templates'))
        .finally(() => setLoadingTemplates(false));
    }
  }, [visible]);

  const handleApply = async () => {
    if (!selectedId) { setError('Select a template'); return; }
    if (!startDate) { setError('Enter a start date'); return; }
    setError(null);
    setApplying(true);
    try {
      await api.post('periodization/templates/apply', { template_id: selectedId, start_date: startDate });
      onApplied();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  return (
    <ModalContainer visible={visible} onClose={onClose} title="Apply Block Template">
      <ScrollView style={styles.content}>
        {loadingTemplates ? (
          <ActivityIndicator color={colors.accent.primary} style={{ marginVertical: spacing[4] }} />
        ) : (
          templates.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.card, selectedId === t.id && styles.cardSelected]}
              onPress={() => setSelectedId(t.id)}
            >
              <Text style={styles.cardTitle}>{t.name}</Text>
              <Text style={styles.cardDesc}>{t.description}</Text>
              <View style={styles.phases}>
                {t.phases.map((p, i) => (
                  <Text key={i} style={styles.phaseTag}>
                    {p.phase_type} ({p.duration_weeks}w)
                  </Text>
                ))}
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.label}>Start Date</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text.muted}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button title="Apply Template" onPress={handleApply} variant="primary" disabled={applying} loading={applying} />
      </ScrollView>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  card: { backgroundColor: colors.bg.surfaceRaised, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2], borderWidth: 1, borderColor: colors.border.subtle },
  cardSelected: { borderColor: colors.accent.primary, backgroundColor: colors.accent.primaryMuted },
  cardTitle: { color: colors.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  cardDesc: { color: colors.text.secondary, fontSize: typography.size.sm, marginTop: spacing[1] },
  phases: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[2] },
  phaseTag: { color: colors.text.muted, fontSize: typography.size.xs, backgroundColor: colors.bg.surface, paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full },
  label: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginTop: spacing[3], marginBottom: spacing[1] },
  input: { backgroundColor: colors.bg.surfaceRaised, color: colors.text.primary, borderRadius: radius.sm, padding: spacing[3], fontSize: typography.size.base, borderWidth: 1, borderColor: colors.border.subtle, marginBottom: spacing[3] },
  error: { color: colors.semantic.negative, fontSize: typography.size.sm, marginBottom: spacing[2] },
});
