import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, radius, spacing, typography } from '../../theme/tokens';

interface ExercisePickerSheetProps {
  visible: boolean;
  onSelect: (exerciseName: string) => void;
  onClose: () => void;
  exercises?: string[];
  recentExercises?: string[];
}

export function ExercisePickerSheet({
  visible,
  onSelect,
  onClose,
  exercises = [],
  recentExercises = [],
}: ExercisePickerSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [search, setSearch] = useState('');

  // Reset search when sheet opens/closes
  useEffect(() => {
    if (visible) {
      setSearch('');
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1 && visible) {
        onClose();
      }
    },
    [visible, onClose],
  );

  const handleSelect = useCallback(
    (name: string) => {
      onSelect(name);
    },
    [onSelect],
  );

  const query = search.trim().toLowerCase();

  const filteredExercises = query
    ? exercises.filter((e) => e.toLowerCase().includes(query))
    : exercises;

  const showRecent = !query && recentExercises.length > 0;

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={styles.exerciseItem}
        onPress={() => handleSelect(item)}
        accessibilityLabel={`Select ${item}`}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <Text style={styles.exerciseName}>{item}</Text>
      </TouchableOpacity>
    ),
    [handleSelect],
  );

  const keyExtractor = useCallback((item: string, index: number) => `${item}-${index}`, []);

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
      <BottomSheetView style={styles.content}>
        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises…"
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search exercises"
        />

        {/* Recent exercises */}
        {showRecent && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {recentExercises.map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.exerciseItem}
                onPress={() => handleSelect(name)}
                accessibilityLabel={`Select recent exercise ${name}`}
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <Text style={styles.exerciseName}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Exercise list */}
        <FlatList
          data={filteredExercises}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query ? 'No exercises found' : 'No exercises available'}
            </Text>
          }
        />
      </BottomSheetView>
    </BottomSheet>
  );
}


const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.bg.surfaceRaised,
  },
  handleIndicator: {
    backgroundColor: colors.text.muted,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  searchInput: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.text.primary,
    fontSize: typography.size.base,
    marginBottom: spacing[3],
  },
  recentSection: {
    marginBottom: spacing[3],
  },
  sectionTitle: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  list: {
    flex: 1,
  },
  exerciseItem: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing[8],
  },
});
