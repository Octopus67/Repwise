import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { SourceBadge } from './SourceBadge';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { resolveScannerMode } from '../../utils/barcodeUtils';
import api from '../../services/api';

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
  micro_nutrients?: Record<string, any> | null;
  source?: 'usda' | 'verified' | 'community' | 'custom';
  is_recipe?: boolean;
  total_servings?: number | null;
  frequency?: number;
}

interface Props {
  onFoodSelected: (item: FoodItem) => void;
  onBarcodePress: () => void;
  onManualBarcodeResult: (item: FoodItem) => void;
}

const SCAN_HISTORY_KEY = 'barcode_scan_history';
const MAX_SCAN_HISTORY = 5;

export function FoodSearchPanel({ onFoodSelected, onBarcodePress, onManualBarcodeResult }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const { enabled: cameraFlagEnabled } = useFeatureFlag('camera_barcode_scanner');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchEmpty, setSearchEmpty] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Manual barcode state
  const [showManualBarcode, setShowManualBarcode] = useState(false);
  const [manualBarcodeValue, setManualBarcodeValue] = useState('');
  const [manualBarcodeError, setManualBarcodeError] = useState('');
  const [manualBarcodeLoading, setManualBarcodeLoading] = useState(false);

  // Task 3.2: Barcode scan history
  const [scanHistory, setScanHistory] = useState<FoodItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(SCAN_HISTORY_KEY).then((raw) => {
      if (raw && mountedRef.current) { 
        try { setScanHistory(JSON.parse(raw)); } catch {} 
      }
    });
    return () => { 
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current); 
    };
  }, []);

  const addToScanHistory = useCallback(async (item: FoodItem) => {
    setScanHistory((prev) => {
      const updated = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, MAX_SCAN_HISTORY);
      AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setSearchError('');
    setSearchEmpty(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('food/search', { params: { q: text.trim(), limit: 50 } });
        const items = res.data?.items ?? res.data ?? [];
        const safeItems = Array.isArray(items) ? items : [];
        if (mountedRef.current) {
          setSearchResults(safeItems);
          setSearchEmpty(safeItems.length === 0);
          setSearchError('');
        }
      } catch {
        if (mountedRef.current) {
          setSearchError('Search failed. You can still enter macros manually.');
          setSearchResults([]);
          setSearchEmpty(false);
        }
      } finally {
        if (mountedRef.current) {
          setSearchLoading(false);
        }
      }
    }, 300);
  }, []);

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setSearchEmpty(false);
  };

  // Task 3.1: Wire barcode scan result — handles both camera and manual entry
  const handleManualBarcodeEntry = async (barcode: string) => {
    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await api.get(`food/barcode/${barcode}`);
      if (res.data?.found && res.data?.food_item) {
        const item = res.data.food_item;
        addToScanHistory(item);
        onManualBarcodeResult(item);
        setShowManualBarcode(false);
        setManualBarcodeValue('');
      } else {
        setSearchError('No food found for this barcode. Try searching by name.');
      }
    } catch {
      setSearchError('Barcode lookup failed. Try searching by name.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleBarcodeButton = () => {
    const mode = resolveScannerMode(Platform.OS as any, cameraFlagEnabled);
    if (mode === 'camera') {
      onBarcodePress();
    } else {
      setShowManualBarcode(true);
    }
  };

  // Task 3.1: Handle camera barcode scan result (called from parent via onFoodSelected)
  const handleFoodSelect = useCallback((item: FoodItem) => {
    onFoodSelected(item);
    handleClearSearch();
  }, [onFoodSelected]);

  return (
    <View style={styles.searchSection}>
      <Text style={[styles.sectionLabel, { color: c.text.secondary }]}>Search Food</Text>

      {/* Task 3.2: Scan history chips */}
      {scanHistory.length > 0 && searchResults.length === 0 && !searchQuery && (
        <View style={styles.historyRow}>
          <Text style={[styles.historyLabel, { color: c.text.muted }]}>Recent scans:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {scanHistory.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.historyChip, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
                onPress={() => handleFoodSelect(item)} activeOpacity={0.7}>
                <Text style={[styles.historyChipText, { color: c.text.primary }]} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search foods (min 2 chars)..."
          placeholderTextColor={c.text.muted}
          autoCorrect={false}
          testID="nutrition-food-name-input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn}>
            <Ionicons name="close" size={16} color={c.text.muted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleBarcodeButton} style={styles.barcodeBtn} activeOpacity={0.7}>
          <Ionicons name="barcode-outline" size={24} color={c.accent.primary} />
        </TouchableOpacity>
      </View>

      {showManualBarcode && (
        <View style={{ marginTop: spacing[2] }}>
          <View style={{ flexDirection: 'row', gap: spacing[1] }}>
            <TextInput
              style={[styles.input, { flex: 1, borderColor: c.accent.primary }]}
              placeholder="Enter barcode (8-14 digits)"
              placeholderTextColor={c.text.muted}
              value={manualBarcodeValue}
              onChangeText={(t) => { setManualBarcodeValue(t); setManualBarcodeError(''); }}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
              maxLength={14}
            />
            <TouchableOpacity style={[styles.barcodeBtn, { opacity: manualBarcodeLoading ? 0.5 : 1 }]}
              disabled={manualBarcodeLoading}
              onPress={async () => {
                if (!/^\d{8,14}$/.test(manualBarcodeValue)) { setManualBarcodeError('Enter 8-14 digits'); return; }
                setManualBarcodeLoading(true);
                await handleManualBarcodeEntry(manualBarcodeValue);
                setManualBarcodeLoading(false);
              }} activeOpacity={0.7}>
              <Ionicons name="search-outline" size={20} color={c.accent.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.barcodeBtn}
              onPress={() => { setShowManualBarcode(false); setManualBarcodeValue(''); setManualBarcodeError(''); }} activeOpacity={0.7}>
              <Ionicons name="close-outline" size={20} color={c.text.secondary} />
            </TouchableOpacity>
          </View>
          {manualBarcodeError ? <Text style={[styles.errorText, { marginTop: 4 }]}>{manualBarcodeError}</Text> : null}
        </View>
      )}

      {searchLoading && <ActivityIndicator color={c.accent.primary} style={styles.searchSpinner} />}
      {searchError ? <Text style={[styles.errorText, { color: c.semantic.warning }]}>{searchError}</Text> : null}

      {searchResults.length > 0 && (
        <ScrollView style={[styles.resultsList, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {searchResults.slice(0, 50).map((item) => (
            <TouchableOpacity key={item.id} style={[styles.resultItem, { borderBottomColor: c.border.subtle }]}
              onPress={() => handleFoodSelect(item)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.resultName, { color: c.text.primary }]} numberOfLines={1}>{item.name}</Text>
                <SourceBadge source={item.source || 'community'} />
                {/* Task 3.3: Frequency badge */}
                {(item.frequency ?? 0) > 0 && (
                  <View style={[styles.freqBadge, { backgroundColor: c.accent.primaryMuted }]}>
                    <Text style={[styles.freqBadgeText, { color: c.accent.primary }]}>⭐ Frequent</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.resultMeta, { color: c.text.muted }]}>
                {Math.round(item.calories)} kcal · {item.protein_g}g protein
                {item.serving_size ? ` · ${item.serving_size}${item.serving_unit}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
          {searchResults.length > 50 && (
            <Text style={[styles.truncationText, { color: c.text.muted }]}>Showing 50 of {searchResults.length} results. Refine your search for more.</Text>
          )}
        </ScrollView>
      )}

      {searchEmpty && !searchLoading && (
        <Text style={[styles.emptyText, { color: c.text.muted }]}>No results found — try a different term or enter macros manually</Text>
      )}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  searchSection: { marginBottom: spacing[3], zIndex: 10, position: 'relative' as const },
  sectionLabel: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1 },
  clearBtn: { marginLeft: spacing[2], padding: spacing[2] },
  barcodeBtn: { marginLeft: spacing[2], padding: spacing[2], justifyContent: 'center', alignItems: 'center' },
  searchSpinner: { marginTop: spacing[2] },
  errorText: { color: c.semantic.warning, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, marginTop: spacing[1] },
  emptyText: { color: c.text.muted, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, marginTop: spacing[1], textAlign: 'center' as const },
  resultsList: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, marginTop: spacing[1], maxHeight: 300, overflow: 'hidden' as const, zIndex: 10 },
  resultItem: { padding: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  resultName: { color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, fontWeight: typography.weight.medium },
  resultMeta: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, marginTop: spacing[1] },
  truncationText: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, textAlign: 'center', padding: spacing[2], fontStyle: 'italic' },
  input: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default, color: c.text.primary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base, padding: spacing[3] },
  // Task 3.2: Scan history styles
  historyRow: { marginBottom: spacing[2] },
  historyLabel: { fontSize: typography.size.xs, marginBottom: spacing[1] },
  historyChip: { borderRadius: radius.full, borderWidth: 1, paddingVertical: spacing[1], paddingHorizontal: spacing[2], marginRight: spacing[1] },
  historyChipText: { fontSize: typography.size.xs },
  // Task 3.3: Frequency badge styles
  freqBadge: { borderRadius: radius.full, paddingVertical: 1, paddingHorizontal: spacing[1] },
  freqBadgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.medium },
});
