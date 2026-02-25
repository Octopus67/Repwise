/**
 * BarcodeScanner — Camera-based barcode scanning for instant food logging.
 *
 * Flow:
 * 1. Request camera permission on first use
 * 2. Show CameraView with overlay
 * 3. On scan → debounce → vibrate → lookup via API
 * 4. Show confirmation card or "not found" fallback
 *
 * Hidden on web (Platform.OS === 'web') — barcode scanning is mobile-only.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import api from '../../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
  source?: string;
  barcode?: string;
  micro_nutrients?: Record<string, any> | null;
}

interface Props {
  onFoodSelected: (item: FoodItem, multiplier: number) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type ScanState = 'permission' | 'scanning' | 'loading' | 'found' | 'not_found' | 'denied';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

export function BarcodeScanner({ onFoodSelected, onClose }: Props) {
  const [state, setState] = useState<ScanState>('permission');
  const [scannedFood, setScannedFood] = useState<FoodItem | null>(null);
  const [multiplier, setMultiplier] = useState('1');
  const [error, setError] = useState('');
  const lastScanRef = useRef<number>(0);
  const [permission, requestPermission] = useCameraPermissions();

  // ── Web guard ──────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>Barcode Scanner</Text>
          <Text style={styles.messageText}>
            Barcode scanning is only available on mobile devices.
          </Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Permission handling ────────────────────────────────────────────────
  useEffect(() => {
    if (!permission) return; // still loading
    if (permission.granted) {
      setState('scanning');
    } else if (permission.canAskAgain) {
      requestPermission().then((result: { granted: boolean }) => {
        setState(result.granted ? 'scanning' : 'denied');
      });
    } else {
      setState('denied');
    }
  }, [permission?.status]);

  // ── Barcode scan handler ───────────────────────────────────────────────
  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      // Debounce: ignore scans within 2 seconds of last scan
      const now = Date.now();
      if (now - lastScanRef.current < 2000) return;
      lastScanRef.current = now;

      // Vibrate on scan
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Haptics not available — ignore
      }

      setState('loading');
      setError('');

      try {
        const res = await api.get(`food/barcode/${data}`);
        const result = res.data;

        if (result.found && result.food_item) {
          setScannedFood(result.food_item);
          setMultiplier('1');
          setState('found');
        } else {
          setState('not_found');
        }
      } catch {
        setError('Failed to look up barcode. Please try again.');
        setState('not_found');
      }
    },
    [],
  );

  // ── Confirm selection ──────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!scannedFood) return;
    const mult = parseFloat(multiplier);
    if (isNaN(mult) || mult <= 0) return;
    onFoodSelected(scannedFood, mult);
  };

  // ── Render: Permission denied ──────────────────────────────────────────
  if (state === 'denied') {
    return (
      <View style={styles.container}>
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>Camera Access Required</Text>
          <Text style={styles.messageText}>
            Enable camera access in your device settings to scan barcodes.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: Loading ────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <View style={styles.container}>
        <View style={styles.messageCard}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={[styles.messageText, { marginTop: spacing[3] }]}>
            Looking up barcode…
          </Text>
        </View>
      </View>
    );
  }

  // ── Render: Food found — confirmation card ─────────────────────────────
  if (state === 'found' && scannedFood) {
    const mult = parseFloat(multiplier) || 1;
    const scaled = {
      calories: Math.round(scannedFood.calories * mult),
      protein_g: Math.round(scannedFood.protein_g * mult * 10) / 10,
      carbs_g: Math.round(scannedFood.carbs_g * mult * 10) / 10,
      fat_g: Math.round(scannedFood.fat_g * mult * 10) / 10,
    };

    return (
      <View style={styles.container}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{scannedFood.name}</Text>
          <Text style={styles.confirmServing}>
            {scannedFood.serving_size}{scannedFood.serving_unit} per serving
          </Text>

          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{scaled.calories}</Text>
              <Text style={styles.macroLabel}>kcal</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{scaled.protein_g}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{scaled.carbs_g}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{scaled.fat_g}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>

          <View style={styles.servingAdjuster}>
            <Text style={styles.servingLabel}>Servings:</Text>
            <TextInput
              style={styles.servingInput}
              value={multiplier}
              onChangeText={setMultiplier}
              keyboardType="numeric"
              selectTextOnFocus
            />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm}>
              <Text style={styles.primaryBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Render: Not found ──────────────────────────────────────────────────
  if (state === 'not_found') {
    return (
      <View style={styles.container}>
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>Not Found</Text>
          <Text style={styles.messageText}>
            {error || 'This barcode was not found in our database.'}
          </Text>
          <Text style={styles.messageText}>
            Try searching manually or enter macros directly.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setState('scanning');
              setError('');
            }}
          >
            <Text style={styles.primaryBtnText}>Scan Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Search Manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: Scanning ───────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'],
        }}
      />

      {/* Semi-transparent overlay with scan area cutout */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.instructionText}>
            Point camera at barcode
          </Text>
          <TouchableOpacity style={styles.cancelScanBtn} onPress={onClose}>
            <Text style={styles.cancelScanBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}


// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  // ── Overlay ──────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_AREA_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
  },
  overlayBottom: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: spacing[4],
  },
  // ── Corner markers ───────────────────────────────────────────────────
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.accent.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
  instructionText: {
    color: '#fff',
    fontSize: typography.size.base,
    textAlign: 'center',
  },
  cancelScanBtn: {
    marginTop: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  cancelScanBtnText: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: '600',
  },
  // ── Message card ─────────────────────────────────────────────────────
  messageCard: {
    margin: spacing[4],
    marginTop: 'auto',
    marginBottom: 'auto',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing[5],
    alignItems: 'center',
  },
  messageTitle: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: '700',
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  messageText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginBottom: spacing[3],
    lineHeight: 22,
  },
  // ── Confirmation card ────────────────────────────────────────────────
  confirmCard: {
    margin: spacing[4],
    marginTop: 'auto',
    marginBottom: 'auto',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing[5],
  },
  confirmTitle: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: '700',
    marginBottom: spacing[1],
  },
  confirmServing: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginBottom: spacing[3],
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: '700',
  },
  macroLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  servingAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  servingLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    marginRight: spacing[2],
  },
  servingInput: {
    backgroundColor: colors.bg.surfaceRaised,
    color: colors.text.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.base,
    width: 80,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  // ── Buttons ──────────────────────────────────────────────────────────
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: '600',
  },
  closeBtn: {
    flex: 1,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    fontWeight: '600',
  },
});
