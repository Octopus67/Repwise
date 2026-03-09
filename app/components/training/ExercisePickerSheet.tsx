import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface ExercisePickerSheetProps {
  visible: boolean;
  onSelect: (exerciseName: string) => void;
  onClose: () => void;
  exercises?: string[];
  recentExercises?: string[];
}

type ListItem =
  | { type: 'header'; label: string }
  | { type: 'exercise'; name: string };

export function ExercisePickerSheet({
  visible,
  onSelect,
  onClose,
  exercises = [],
  recentExercises = [],
}: ExercisePickerSheetProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => {
    if (visible) {
      setSearch('');
      setSearchInput('');
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => { if (index === -1 && visible) onClose(); },
    [visible, onClose],
  );

  const handleSelect = useCallback((name: string) => onSelect(name), [onSelect]);

  const query = search.trim().toLowerCase();
  const queryWords = query ? query.split(/\s+/).filter(Boolean) : [];

  // Build a single flat list: optional "Recent" section + results
  const listData: ListItem[] = [];

  if (!query && recentExercises.length > 0) {
    listData.push({ type: 'header', label: 'Recent' });
    recentExercises.forEach((name) => listData.push({ type: 'exercise', name }));
    if (exercises.length > 0) {
      listData.push({ type: 'header', label: 'All Exercises' });
    }
  }

  const filtered = queryWords.length
    ? exercises.filter((e) => {
        const name = e.toLowerCase();
        return queryWords.every((w) => name.includes(w));
      })
    : exercises;

  filtered.forEach((name) => listData.push({ type: 'exercise', name }));

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return <Text style={[styles.sectionTitle, { color: c.text.muted }]}>{item.label}</Text>;
      }
      return (
        <TouchableOpacity
          style={[styles.exerciseItem, { borderBottomColor: c.border.subtle }]}
          onPress={() => handleSelect(item.name)}
          accessibilityLabel={`Select ${item.name}`}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={[styles.exerciseName, { color: c.text.primary }]}>{item.name}</Text>
        </TouchableOpacity>
      );
    },
    [handleSelect],
  );

  const keyExtractor = useCallback(
    (item: ListItem, index: number) =>
      item.type === 'header' ? `header-${item.label}` : `${item.name}-${index}`,
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['75%', '95%']}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, { color: c.text.primary, backgroundColor: c.bg.surface, borderColor: c.border.default }]}
          placeholder="Search exercises…"
          placeholderTextColor={c.text.muted}
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search exercises"
        />
      </View>

      <BottomSheetFlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: c.text.muted }]}>
            {query ? 'No exercises found' : 'No exercises available'}
          </Text>
        }
      />
    </BottomSheet>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  sheetBackground: {
    backgroundColor: c.bg.surfaceRaised,
  },
  handleIndicator: {
    backgroundColor: c.text.muted,
  },
  searchContainer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  searchInput: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: c.text.primary,
    fontSize: typography.size.base,
  },
  listContent: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
  },
  sectionTitle: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: spacing[2],
    marginTop: spacing[2],
  },
  exerciseItem: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  exerciseName: {
    color: c.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  emptyText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing[8],
  },
});
