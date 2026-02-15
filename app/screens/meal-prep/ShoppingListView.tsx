import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';

interface ShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'other'];

export function ShoppingListView({ route }: any) {
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
    fetch(`/api/v1/meal-plans/${planId}/shopping-list`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load shopping list');
        return r.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch((e: any) => setError(e.message ?? 'Failed to load shopping list'))
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

  const grouped = CATEGORY_ORDER.reduce<Record<string, ShoppingItem[]>>((acc, cat) => {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Shopping List</Text>
      {Object.entries(grouped).map(([category, catItems]) => (
        <View key={category} style={styles.section}>
          <Text style={styles.categoryLabel}>{category.charAt(0).toUpperCase() + category.slice(1)}</Text>
          {catItems.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.itemRow}
              onPress={() => toggleCheck(item.name)}
            >
              <View style={[styles.checkbox, checked.has(item.name) && styles.checkboxChecked]} />
              <Text style={[styles.itemName, checked.has(item.name) && styles.strikethrough]}>
                {item.name}
              </Text>
              <Text style={styles.itemQty}>
                {item.quantity} {item.unit}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base, padding: spacing[4] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.semantic.negative, fontSize: typography.size.base, textAlign: 'center' },
  title: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.text.primary, marginBottom: spacing[4] },
  section: { marginBottom: spacing[4] },
  categoryLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.accent.primary, marginBottom: spacing[2] },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2] },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.text.muted, marginRight: spacing[3] },
  checkboxChecked: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
  itemName: { flex: 1, fontSize: typography.size.base, color: colors.text.primary },
  strikethrough: { textDecorationLine: 'line-through', color: colors.text.muted },
  itemQty: { fontSize: typography.size.sm, color: colors.text.secondary },
});
