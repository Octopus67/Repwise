import { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { calculatePlates } from '../../utils/plateCalculator';
import { convertWeight } from '../../utils/unitConversion';
import type { UnitSystem } from '../../utils/unitConversion';

/** Color map for plate weights (kg) — visual distinction per plate size */
const PLATE_COLORS: Record<number, { bg: string; needsBorder: boolean }> = {
  25: { bg: '#EF4444', needsBorder: false },
  20: { bg: '#3B82F6', needsBorder: false },
  15: { bg: '#F59E0B', needsBorder: false },
  10: { bg: '#22C55E', needsBorder: false },
  5: { bg: '#F1F5F9', needsBorder: true },
  2.5: { bg: '#6B7280', needsBorder: false },
  1.25: { bg: '#A78BFA', needsBorder: false },
  // Imperial equivalents (kg values)
  20.4117: { bg: '#EF4444', needsBorder: false },
  15.876: { bg: '#3B82F6', needsBorder: false },
  11.34: { bg: '#F59E0B', needsBorder: false },
  4.536: { bg: '#22C55E', needsBorder: false },
  2.268: { bg: '#F1F5F9', needsBorder: true },
  1.134: { bg: '#6B7280', needsBorder: false },
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
  const c = useThemeColors();
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
        <Text style={[styles.title, { color: c.text.primary }]}>Plate Calculator</Text>
        <Text style={[styles.subtitle, { color: c.text.secondary }]}>
          {displayWeight} {suffix} — Bar: {displayBar} {suffix}
        </Text>

        {!breakdown.isExact && (
          <Text style={[styles.inexactNote, { color: c.semantic.warning }]}>
            Nearest achievable: {displayWeight} {suffix}
          </Text>
        )}

        {breakdown.platesPerSide.length === 0 ? (
          <Text style={[styles.barOnly, { color: c.text.muted }]} accessibilityRole="text" accessibilityLabel="Bar only, no plates needed">Bar only — no plates needed</Text>
        ) : (
          <View style={styles.plateRow} accessibilityLabel={`Plates per side for ${displayWeight} ${suffix}`}>
            <Text style={[styles.perSideLabel, { color: c.text.muted }]}>Per side:</Text>
            <View style={styles.plates}>
              {breakdown.platesPerSide.map((plate, i) => {
                const plateInfo = PLATE_COLORS[plate.weightKg];
                const plateColor = plateInfo?.bg || c.text.muted;
                const needsBorder = plateInfo?.needsBorder ?? false;
                const plateDisplay = convertWeight(plate.weightKg, unitSystem);
                return (
                  <View key={`${plate.weightKg}-${i}`} style={styles.plateGroup}>
                    {Array.from({ length: plate.count }).map((_, j) => (
                      <View
                        key={`${plate.weightKg}-${i}-${j}`}
                        style={[
                          styles.plate,
                          { backgroundColor: plateColor },
                          needsBorder && { borderWidth: 1, borderColor: c.border.default },
                        ]}
                        accessibilityLabel={`${plateDisplay} ${suffix} plate`}
                        accessibilityRole="text"
                      >
                        <Text style={[styles.plateText, { color: needsBorder ? c.text.primary : c.bg.base }]}>
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
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.lg,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[3],
  },
  inexactNote: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[3],
  },
  barOnly: {
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    marginTop: spacing[6],
  },
  plateRow: {
    marginTop: spacing[2],
  },
  perSideLabel: {
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.sm,
  },
});
