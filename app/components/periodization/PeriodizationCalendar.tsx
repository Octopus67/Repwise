import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { Card } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { Icon } from '../common/Icon';
import { BlockCreationModal } from './BlockCreationModal';
import { BlockTemplateModal } from './BlockTemplateModal';
import {
  buildWeekRows,
  needsDeloadSuggestion,
  getPhaseColor,
  TrainingBlock,
  WeekRow,
} from '../../utils/periodizationUtils';
import api from '../../services/api';

export function PeriodizationCalendar() {
  const [blocks, setBlocks] = useState<TrainingBlock[]>([]);
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [editBlock, setEditBlock] = useState<TrainingBlock | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [blocksRes, sessionsRes] = await Promise.allSettled([
        api.get('periodization/blocks'),
        api.get('training/sessions', { params: { limit: 100 } }),
      ]);
      if (blocksRes.status === 'fulfilled') setBlocks(blocksRes.value.data);
      if (sessionsRes.status === 'fulfilled') {
        const items = sessionsRes.value.data.items ?? sessionsRes.value.data ?? [];
        setSessionDates(items.map((s: any) => s.session_date));
      }
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().split('T')[0];
  const rows = buildWeekRows(blocks, sessionDates, today);
  const showDeloadBanner = needsDeloadSuggestion(blocks);

  return (
    <View>
      {/* Header row */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowTemplate(true)}>
          <Text style={styles.headerBtnText}>Templates</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => { setEditBlock(null); setShowCreate(true); }}>
          <Text style={styles.fabText}>+ Block</Text>
        </TouchableOpacity>
      </View>

      {/* Deload suggestion banner */}
      {showDeloadBanner && (
        <View style={styles.deloadBanner}>
          <Icon name="alert" />
          <Text style={styles.deloadText}>Consider scheduling a deload week</Text>
        </View>
      )}

      {/* Calendar rows */}
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="calendar" />}
            title="No training blocks"
            description="Create a block or apply a template to plan your training"
            actionLabel="Create Block"
            onAction={() => { setEditBlock(null); setShowCreate(true); }}
          />
        </Card>
      ) : (
        <Card>
          {rows.map((row, i) => (
            <View key={`${row.weekStart}-${i}`} style={[styles.weekRow, row.isCurrentWeek && styles.currentWeek]}>
              <View style={[styles.phaseBand, { backgroundColor: row.phaseColor ?? 'transparent' }]} />
              <View style={styles.weekContent}>
                <View style={styles.weekTop}>
                  <Text style={styles.blockName} numberOfLines={1}>{row.blockName}</Text>
                  {row.nutritionLabel && (
                    <View style={styles.nutritionBadge}>
                      <Text style={styles.nutritionText}>{row.nutritionLabel}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.weekLabel}>
                  Week {row.weekNumber}/{row.totalWeeks} · {row.weekStart}
                </Text>
                {row.sessionDates.length > 0 && (
                  <View style={styles.dots}>
                    {row.sessionDates.map((d) => (
                      <View key={d} style={styles.dot} />
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </Card>
      )}

      <BlockCreationModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={loadData}
        block={editBlock}
      />
      <BlockTemplateModal
        visible={showTemplate}
        onClose={() => setShowTemplate(false)}
        onApplied={loadData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  headerBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, backgroundColor: colors.bg.surfaceRaised, borderWidth: 1, borderColor: colors.border.subtle },
  headerBtnText: { color: colors.text.secondary, fontSize: typography.size.sm },
  fab: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, backgroundColor: colors.accent.primaryMuted, borderWidth: 1, borderColor: colors.accent.primary },
  fabText: { color: colors.accent.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  deloadBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: colors.semantic.warningSubtle, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2] },
  deloadText: { color: colors.semantic.warning, fontSize: typography.size.sm },
  weekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border.subtle, paddingVertical: spacing[2] },
  currentWeek: { backgroundColor: colors.accent.primaryMuted, borderRadius: radius.sm },
  phaseBand: { width: 4, borderRadius: 2, marginRight: spacing[2] },
  weekContent: { flex: 1 },
  weekTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockName: { color: colors.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium, flex: 1 },
  nutritionBadge: { backgroundColor: colors.bg.surfaceRaised, paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full },
  nutritionText: { color: colors.text.secondary, fontSize: typography.size.xs },
  weekLabel: { color: colors.text.muted, fontSize: typography.size.xs, marginTop: 2 },
  dots: { flexDirection: 'row', gap: 4, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.primary },
});
