import { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { calculatePlates } from '../../utils/plateCalculator';
import { convertWeight } from '../../utils/unitConversion';
import type { UnitSystem } from '../../utils/unitConversion';

/** Color map for plate weights (kg) — visual distinction per plate size */
const PLATE_COLORS: Record<number, string> = {
  25: '#EF4444',    // Red
  20: '#3B82F6',    // Blue
  15: '#F59E0B',    // Yellow
  10: '#22C55E',    // Green
  5: '#F1F5F9',     // White
  2.5: '#6B7280',   // Gray
  1.25: '#A78BFA',  // Purple
  // Imperial equivalents (kg values)
  20.4117: '#EF4444',
  15.876: '#3B82F6',
  11.34: '#F59E0B',
  4.536: '#22C55E',
  2.268: '#F1F5F9',
  1.134: '#6B7280',
};

interface PlateCalculatorSheetProps {
  weightKg: number;
  unitSystem: UnitSystem;
  visible: boolean;
  onClose: () => void;
}

export function PlateCalculatorSheet({
  weightKg,
  unitSystem,
  visible,
  onClose,
}: PlateCalculatorSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (visible) {
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

  const breakdown = useMemo(
    () => calculatePlates(weightKg, 20, unitSystem),
    [weightKg, unitSystem],
  );

  const suffix = unitSystem === 'metric' ? 'kg' : 'lbs';
  const displayWeight = convertWeight(breakdown.achievableWeightKg, unitSystem);
  const displayBar = convertWeight(breakdown.barWeightKg, unitSystem);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['40%']}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>Plate Calculator</Text>
        <Text style={styles.subtitle}>
          {displayWeight} {suffix} — Bar: {displayBar} {suffix}
        </Text>

        {!breakdown.isExact && (
          <Text style={styles.inexactNote}>
            Nearest achievable: {displayWeight} {suffix}
          </Text>
        )}

        {breakdown.platesPerSide.length === 0 ? (
          <Text style={styles.barOnly} accessibilityRole="text" accessibilityLabel="Bar only, no plates needed">Bar only — no plates needed</Text>
        ) : (
          <View style={styles.plateRow} accessibilityLabel={`Plates per side for ${displayWeight} ${suffix}`}>
            <Text style={styles.perSideLabel}>Per side:</Text>
            <View style={styles.plates}>
              {breakdown.platesPerSide.map((plate, i) => {
                const plateColor = PLATE_COLORS[plate.weightKg] || colors.text.muted;
                const plateDisplay = convertWeight(plate.weightKg, unitSystem);
                return (
                  <View key={`${plate.weightKg}-${i}`} style={styles.plateGroup}>
                    {Array.from({ length: plate.count }).map((_, j) => (
                      <View
                        key={`${plate.weightKg}-${i}-${j}`}
                        style={[styles.plate, { backgroundColor: plateColor }]}
                        accessibilityLabel={`${plateDisplay} ${suffix} plate`}
                        accessibilityRole="text"
                      >
                        <Text style={styles.plateText}>
                          {plateDisplay}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </View>
        )}
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
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.lg,
    marginBottom: spacing[1],
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[3],
  },
  inexactNote: {
    color: colors.semantic.warning,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[3],
  },
  barOnly: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    marginTop: spacing[6],
  },
  plateRow: {
    marginTop: spacing[2],
  },
  perSideLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  plates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  plateGroup: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  plate: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minWidth: 48,
    alignItems: 'center',
  },
  plateText: {
    color: colors.bg.base,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.sm,
  },
});
