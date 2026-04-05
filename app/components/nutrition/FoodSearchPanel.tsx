import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, FlatList, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureSet, secureGet } from '../../utils/secureStorage'; // Audit fix 10.15 — encrypted barcode history
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { SourceBadge } from './SourceBadge';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { resolveScannerMode } from '../../utils/barcodeUtils';
import { searchCachedFoods, cacheFoodItems } from '../../services/offlineFoodCache';
import { onlineManager } from '@tanstack/react-query';
import api from '../../services/api';
import type { FoodItem } from '../../types/nutrition';

interface Props {
  onFoodSelected: (item: FoodItem) => void;
  onBarcodePress: () => void;
  onManualBarcodeResult: (item: FoodItem) => void;
}

const SCAN_HISTORY_KEY = 'barcode_scan_history';
const MAX_SCAN_HISTORY = 5;
const SCAN_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface ScanHistoryEntry {
  item: FoodItem;
  timestamp: number;
}

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

  // F9: Favorites
  const [favorites, setFavorites] = useState<FoodItem[]>([]);

  useEffect(() => {
    secureGet(SCAN_HISTORY_KEY).then((raw) => {
      if (raw && mountedRef.current) { 
        try {
          const parsed: ScanHistoryEntry[] = JSON.parse(raw);
          const now = Date.now();
          const valid = parsed
            .filter((e) => now - e.timestamp < SCAN_HISTORY_TTL_MS)
            .map((e) => e.item);
          setScanHistory(valid);
        } catch {
          // Intentional: malformed scan history is non-critical, reset to empty array
        }
      }
    });
    // F9: Fetch favorites on mount
    api.get('food/favorites').then((res) => {
      if (mountedRef.current) {
        const items = res.data ?? [];
        const seen = new Set<string>();
        setFavorites(items.filter((f: FoodItem) => {
          if (seen.has(f.id)) return false;
          seen.add(f.id);
          return true;
        }));
      }
    }).catch((err: unknown) => { console.warn('[FoodSearch] favorites load failed:', String(err)); });
    return () => { 
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current); 
    };
  }, []);

  const addToScanHistory = useCallback(async (item: FoodItem) => {
    setScanHistory((prev) => {
      const updated = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, MAX_SCAN_HISTORY);
      const entries: ScanHistoryEntry[] = updated.map((i) => ({ item: i, timestamp: Date.now() }));
      secureSet(SCAN_HISTORY_KEY, JSON.stringify(entries)).catch((err: unknown) => { console.warn('[FoodSearch] scan history save failed:', String(err)); });
      return updated;
    });
  }, []);

  // F9: Toggle favorite
  const toggleFavorite = useCallback(async (item: FoodItem) => {
    try {
      const res = await api.post(`food/favorites/${item.id}/toggle`);
      const isFav: boolean = res.data?.is_favorite;
      setFavorites((prev) =>
        isFav ? [item, ...prev.filter((f) => f.id !== item.id)] : prev.filter((f) => f.id !== item.id)
      );
    } catch (err: unknown) { console.warn('[FoodSearch] toggle favorite failed:', String(err)); }
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
      // Offline fallback: search cached foods
      if (!onlineManager.isOnline()) {
        const cached = searchCachedFoods(text.trim());
        if (mountedRef.current) {
          setSearchResults(cached);
          setSearchEmpty(cached.length === 0);
          setSearchLoading(false);
        }
        return;
      }
      try {
        const res = await api.get('food/search', { params: { q: text.trim(), limit: 50 } });
        const items = res.data?.items ?? res.data ?? [];
        const safeItems = Array.isArray(items) ? items : [];
        if (mountedRef.current) {
          setSearchResults(safeItems);
          setSearchEmpty(safeItems.length === 0);
          setSearchError('');
          if (safeItems.length > 0) cacheFoodItems(safeItems);
        }
      } catch {
        // Fallback to cache on network error
        const cached = searchCachedFoods(text.trim());
        if (mountedRef.current) {
          if (cached.length > 0) {
            setSearchResults(cached);
            setSearchEmpty(false);
          } else {
            setSearchError('Search failed. You can still enter macros manually.');
            setSearchResults([]);
            setSearchEmpty(false);
          }
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
    const mode = resolveScannerMode(Platform.OS, cameraFlagEnabled);
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

      {/* F9: Favorite chips */}
      {favorites.length > 0 && searchResults.length === 0 && !searchQuery && (
        <View style={styles.historyRow}>
          <Text style={[styles.historyLabel, { color: c.text.muted }]}>⭐ Favorites:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {favorites.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.historyChip, { backgroundColor: c.accent.primaryMuted, borderColor: c.accent.primary }]}
                onPress={() => handleFoodSelect(item)} activeOpacity={0.7}>
                <Text style={[styles.historyChipText, { color: c.accent.primary }]} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

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
        <View style={styles.manualBarcodeContainer}>
          <View style={styles.manualBarcodeRow}>
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
      {!onlineManager.isOnline() && searchQuery.trim().length >= 2 && (
        <View style={styles.offlineBanner} accessibilityRole="alert">
          <Text style={styles.offlineBannerText}>Offline — showing saved foods only</Text>
        </View>
      )}
      {searchError ? <Text style={[styles.errorText, { color: c.semantic.warning }]}>{searchError}</Text> : null}

      {searchResults.length > 0 && (
        <FlatList
          data={searchResults.slice(0, 50)}
          keyExtractor={(item) => item.id}
          style={[styles.resultsList, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={[styles.resultItem, { borderBottomColor: c.border.subtle, flexDirection: 'row' }]}>
              <TouchableOpacity onPress={() => handleFoodSelect(item)} activeOpacity={0.7} style={styles.resultItemTouchable}>
                <View style={styles.resultItemNameRow}>
                  <Text style={[styles.resultName, { color: c.text.primary }]} numberOfLines={1}>{item.name}</Text>
                  <SourceBadge source={item.source || 'community'} />
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
              <TouchableOpacity onPress={() => toggleFavorite(item)} hitSlop={8}
                style={styles.favoriteToggle}
                accessibilityLabel={favorites.some((f) => f.id === item.id) ? 'Remove from favorites' : 'Add to favorites'}
                accessibilityRole="button">
                <Ionicons name={favorites.some((f) => f.id === item.id) ? 'heart' : 'heart-outline'} size={18} color={c.accent.primary} />
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={searchResults.length > 50 ? (
            <Text style={[styles.truncationText, { color: c.text.muted }]}>Showing 50 of {searchResults.length} results. Refine your search for more.</Text>
          ) : null}
        />
      )}

      {searchEmpty && !searchLoading && (
        <Text style={[styles.emptyText, { color: c.text.muted }]}>No results found — try a different term or enter macros manually</Text>
      )}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  searchSection: { marginBottom: spacing[3], zIndex: 10, position: 'relative' as const },
  manualBarcodeContainer: { marginTop: spacing[2] },
  manualBarcodeRow: { flexDirection: 'row' as const, gap: spacing[1] },
  resultItemTouchable: { flex: 1 },
  resultItemNameRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  favoriteToggle: { paddingLeft: 12, justifyContent: 'center' as const },
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
  offlineBanner: { backgroundColor: c.semantic.warning + '20', borderRadius: radius.sm, padding: spacing[2], marginTop: spacing[1] },
  offlineBannerText: { color: c.semantic.warning, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, textAlign: 'center' as const },
});
