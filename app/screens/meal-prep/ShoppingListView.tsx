import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { typography, spacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import api from '../../services/api';
import { extractApiError } from '../../utils/extractApiError';
import type { ProfileScreenProps } from '../../types/navigation';

interface ShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'other'];

export function ShoppingListView({ route }: ProfileScreenProps<'ShoppingList'>) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const planId = route?.params?.planId;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) {
      setLoading(false);
      setError('No plan selected');
      return;
    }
    api.get(`meal-plans/${planId}/shopping-list`)
      .then(({ data }) => setItems(data.items ?? []))
      .catch((e: unknown) => setError(extractApiError(e, 'Failed to load shopping list')))
      .finally(() => setLoading(false));
  }, [planId]);

  const toggleCheck = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const sections = CATEGORY_ORDER
    .filter((cat) => items.some((i) => i.category === cat))
    .map((cat) => ({
      title: cat.charAt(0).toUpperCase() + cat.slice(1),
      data: items.filter((i) => i.category === cat),
    }));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.accent.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.errorText, { color: c.semantic.negative }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: c.accent.primary }]}
          onPress={() => {
            setError(null);
            setLoading(true);
            api.get(`meal-plans/${planId}/shopping-list`)
              .then(({ data }) => setItems(data.items ?? []))
              .catch((e: unknown) => setError(extractApiError(e, 'Failed to load shopping list')))
              .finally(() => setLoading(false));
          }}
        >
          <Text style={[styles.retryText, { color: c.text.primary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SectionList
      style={[styles.container, { backgroundColor: c.bg.base }]}
      sections={sections}
      keyExtractor={(item) => item.name}
      ListHeaderComponent={<Text style={[styles.title, { color: c.text.primary }]}>Shopping List</Text>}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.categoryLabel, { color: c.accent.primary }]}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => toggleCheck(item.name)}
        >
          <View style={[styles.checkbox, checked.has(item.name) && styles.checkboxChecked]} />
          <Text style={[styles.itemName, checked.has(item.name) && styles.strikethrough]}>
            {item.name}
          </Text>
          <Text style={[styles.itemQty, { color: c.text.secondary }]}>
            {item.quantity} {item.unit}
          </Text>
        </TouchableOpacity>
      )}
      stickySectionHeadersEnabled={false}
      SectionSeparatorComponent={() => <View style={styles.sectionSpacer} />}
    />
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.base, padding: spacing[4] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: c.semantic.negative, fontSize: typography.size.base, textAlign: 'center', marginBottom: spacing[3] },
  retryBtn: { backgroundColor: c.accent.primary, paddingHorizontal: spacing[5], paddingVertical: spacing[2], borderRadius: 8 },
  retryText: { color: c.text.primary, fontWeight: typography.weight.semibold },
  title: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: c.text.primary, marginBottom: spacing[4] },
  section: { marginBottom: spacing[4] },
  sectionSpacer: { height: spacing[4] },
  categoryLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: c.accent.primary, marginBottom: spacing[2] },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2] },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: c.text.muted, marginRight: spacing[3] },
  checkboxChecked: { backgroundColor: c.accent.primary, borderColor: c.accent.primary },
  itemName: { flex: 1, fontSize: typography.size.base, color: c.text.primary },
  strikethrough: { textDecorationLine: 'line-through', color: c.text.muted },
  itemQty: { fontSize: typography.size.sm, color: c.text.secondary },
});
