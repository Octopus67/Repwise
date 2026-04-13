import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

interface QuickAddFood {
  name: string;
  calories: number;
  payload: object;
}

interface QuickAddFoodsProps {
  recentFoods: QuickAddFood[];
  onQuickAdd: (payload: object) => Promise<void>;
}

export function QuickAddFoods({ recentFoods, onQuickAdd }: QuickAddFoodsProps) {
  const c = useThemeColors();
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  if (!recentFoods.length) return null;

  const items = recentFoods.slice(0, 5);

  const handlePress = async (food: QuickAddFood, idx: number) => {
    if (loadingIdx !== null) return;
    setLoadingIdx(idx);
    try {
      await onQuickAdd(food.payload);
    } finally {
      setLoadingIdx(null);
    }
  };

  return (
    <View style={{ marginTop: spacing[3] }}>
      <Text style={{ color: c.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginBottom: spacing[2] }}>
        Quick Add
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
        {items.map((food, i) => (
          <TouchableOpacity
            key={`${food.name}-${i}`}
            onPress={() => handlePress(food, i)}
            disabled={loadingIdx !== null}
            activeOpacity={0.7}
            accessibilityLabel={`Quick add ${food.name}, ${food.calories} calories`}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              backgroundColor: c.bg.surface,
              borderRadius: radius.full,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderWidth: 1,
              borderColor: c.border.subtle,
            }}
          >
            {loadingIdx === i ? (
              <ActivityIndicator size="small" color={c.accent.primary} />
            ) : (
              <>
                <Text style={{ color: c.text.primary, fontSize: typography.size.sm }} numberOfLines={1}>{food.name}</Text>
                <Text style={{ color: c.text.muted, fontSize: typography.size.xs }}>{food.calories} cal</Text>
              </>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
