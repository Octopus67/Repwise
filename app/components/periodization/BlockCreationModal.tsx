import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { ModalContainer } from '../common/ModalContainer';
import { Button } from '../common/Button';
import api from '../../services/api';

const PHASE_OPTIONS = ['accumulation', 'intensification', 'deload', 'peak'] as const;
const NUTRITION_OPTIONS = [null, 'bulk', 'cut', 'maintenance'] as const;

interface BlockCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  block?: {
    id: string;
    name: string;
    phase_type: string;
    start_date: string;
    end_date: string;
    nutrition_phase: string | null;
  } | null;
}

export function BlockCreationModal({ visible, onClose, onSaved, block }: BlockCreationModalProps) {
  const isEdit = !!block;
  const [name, setName] = useState('');
  const [phaseType, setPhaseType] = useState<string>('accumulation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nutritionPhase, setNutritionPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (block) {
      setName(block.name);
      setPhaseType(block.phase_type);
      setStartDate(block.start_date);
      setEndDate(block.end_date);
      setNutritionPhase(block.nutrition_phase);
    } else {
      setName('');
      setPhaseType('accumulation');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
      setNutritionPhase(null);
    }
    setError(null);
  }, [block, visible]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (name.length > 100) { setError('Name must be 100 characters or less'); return; }
    if (endDate < startDate) { setError('End date must be on or after start date'); return; }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phase_type: phaseType,
        start_date: startDate,
        end_date: endDate,
        nutrition_phase: nutritionPhase,
      };
      if (isEdit && block) {
        await api.put(`periodization/blocks/${block.id}`, payload);
      } else {
        await api.post('periodization/blocks', payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to save block';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalContainer visible={visible} onClose={onClose} title={isEdit ? 'Edit Block' : 'New Training Block'}>
      <ScrollView style={styles.form}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Hypertrophy Phase 1"
          placeholderTextColor={colors.text.muted}
          maxLength={100}
        />

        <Text style={styles.label}>Phase Type</Text>
        <View style={styles.pills}>
          {PHASE_OPTIONS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.pill, phaseType === p && styles.pillActive]}
              onPress={() => setPhaseType(p)}
            >
              <Text style={[styles.pillText, phaseType === p && styles.pillTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Start Date</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text.muted}
        />

        <Text style={styles.label}>End Date</Text>
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text.muted}
        />

        <Text style={styles.label}>Nutrition Phase (optional)</Text>
        <View style={styles.pills}>
          {NUTRITION_OPTIONS.map((n) => (
            <TouchableOpacity
              key={n ?? 'none'}
              style={[styles.pill, nutritionPhase === n && styles.pillActive]}
              onPress={() => setNutritionPhase(n)}
            >
              <Text style={[styles.pillText, nutritionPhase === n && styles.pillTextActive]}>
                {n ? n.charAt(0).toUpperCase() + n.slice(1) : 'None'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button title={saving ? 'Saving...' : isEdit ? 'Update' : 'Create'} onPress={handleSave} variant="primary" />
      </ScrollView>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  label: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginTop: spacing[3], marginBottom: spacing[1] },
  input: { backgroundColor: colors.bg.surfaceRaised, color: colors.text.primary, borderRadius: radius.sm, padding: spacing[3], fontSize: typography.size.base, borderWidth: 1, borderColor: colors.border.subtle },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pill: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, backgroundColor: colors.bg.surfaceRaised, borderWidth: 1, borderColor: colors.border.subtle },
  pillActive: { backgroundColor: colors.accent.primaryMuted, borderColor: colors.accent.primary },
  pillText: { color: colors.text.secondary, fontSize: typography.size.sm },
  pillTextActive: { color: colors.accent.primary },
  error: { color: colors.semantic.negative, fontSize: typography.size.sm, marginTop: spacing[2], marginBottom: spacing[2] },
});
