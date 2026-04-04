import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../common/Card';
import { EditableField } from '../common/EditableField';
import { PickerField } from '../common/PickerField';
import { CoachingModeSelector, type CoachingMode } from '../coaching/CoachingModeSelector';
import { useStore, type UserProfile } from '../../store';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';
import { useThemeStore } from '../../store/useThemeStore';
import { TIMEZONE_OPTIONS } from '../../constants/pickerOptions';
import api from '../../services/api';

// ─── SegmentedControl (inline) ───────────────────────────────────────────────

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  selected: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function SegmentedControl({ options, selected, onChange, disabled }: SegmentedControlProps) {
  const c = useThemeColors();
  const segStyles = getSegStyles(c);
  return (
    <View style={segStyles.track}>
      {options.map((opt) => {
        const isActive = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[segStyles.segment, isActive && segStyles.segmentActive]}
            onPress={() => !disabled && onChange(opt.value)}
            activeOpacity={disabled ? 1 : 0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
            accessibilityLabel={`${opt.label}${isActive ? ', selected' : ''}`}
          >
            <Text style={[segStyles.segmentText, isActive && segStyles.segmentTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PreferencesSectionProps {
  profile: UserProfile;
  unitSystem: 'metric' | 'imperial';
  coachingMode: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'UTC';
  } catch {
    return 'UTC';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PreferencesSection({ profile, unitSystem, coachingMode }: PreferencesSectionProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const segStyles = getSegStyles(c);
  const store = useStore();
  const showRpeRirTooltip = useWorkoutPreferencesStore((s) => s.showRpeRirTooltip);
  const dismissRpeRirTooltip = useWorkoutPreferencesStore((s) => s.dismissRpeRirTooltip);
  const simpleMode = useWorkoutPreferencesStore((s) => s.simpleMode);
  const toggleSimpleMode = useWorkoutPreferencesStore((s) => s.toggleSimpleMode);
  const themeMode = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [savingUnit, setSavingUnit] = useState(false);
  const [savingCoaching, setSavingCoaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect timezone on first load if null
  useEffect(() => {
    if (profile.timezone == null) {
      const detected = detectTimezone();
      // Persist auto-detected timezone
      api
        .put('users/profile', { timezone: detected })
        .then(({ data }) => {
          const mapped = mapProfileResponse(data);
          store.setProfile(mapped);
        })
        .catch((err: unknown) => {
          console.warn('[Preferences] timezone persist failed:', String(err));
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unit System change ──
  const handleUnitChange = useCallback(
    async (newSystem: string) => {
      if (newSystem === unitSystem) return;
      setSavingUnit(true);
      setError(null);
      try {
        const existingPrefs = profile.preferences ?? {};
        const { data } = await api.put('users/profile', {
          preferences: { ...existingPrefs, unit_system: newSystem },
        });
        const mapped = mapProfileResponse(data);
        store.setUnitSystem(newSystem as 'metric' | 'imperial');
        store.setProfile(mapped);
      } catch {
        setError("Couldn't save unit preference.");
      } finally {
        setSavingUnit(false);
      }
    },
    [unitSystem, profile, store],
  );

  // ── Timezone change ──
  const handleTimezoneSave = useCallback(
    async (newValue: string) => {
      setError(null);
      try {
        const { data } = await api.put('users/profile', { timezone: newValue });
        const mapped = mapProfileResponse(data);
        store.setProfile(mapped);
      } catch {
        throw new Error("Couldn't save timezone.");
      }
    },
    [store],
  );

  // ── Coaching Mode change ──
  const handleCoachingChange = useCallback(
    async (mode: CoachingMode) => {
      if (mode === coachingMode) return;
      setSavingCoaching(true);
      setError(null);
      try {
        const { data } = await api.put('users/profile', { coaching_mode: mode });
        const mapped = mapProfileResponse(data);
        store.setCoachingMode(mode);
        store.setProfile(mapped);
      } catch {
        setError("Couldn't save coaching mode.");
      } finally {
        setSavingCoaching(false);
      }
    },
    [coachingMode, store],
  );

  // ── Reset RPE/RIR tooltip ──
  const handleResetRpeTooltip = useCallback(() => {
    // Reset to true to show tooltip again
    useWorkoutPreferencesStore.setState({ showRpeRirTooltip: true });
  }, []);

  const timezoneDisplay = profile.timezone ?? detectTimezone();

  return (
    <Card>
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Preferences</Text>

      {/* 1. Unit System — SegmentedControl */}
      <View style={[styles.row, { borderBottomColor: c.border.subtle }]}>
        <Text style={[styles.rowLabel, { color: c.text.muted }]}>Unit System</Text>
        <View style={styles.rowControl}>
          {savingUnit ? (
            <ActivityIndicator color={c.accent.primary} size="small" />
          ) : (
            <SegmentedControl
              options={[
                { value: 'metric', label: 'Metric' },
                { value: 'imperial', label: 'Imperial' },
              ]}
              selected={unitSystem}
              onChange={handleUnitChange}
            />
          )}
        </View>
      </View>

      {/* 1.5 Theme */}
      <View style={[styles.row, { borderBottomColor: c.border.subtle }]}>
        <Text style={[styles.rowLabel, { color: c.text.muted }]}>Appearance</Text>
        <View style={styles.rowControl}>
          <SegmentedControl
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            selected={themeMode}
            onChange={(v) => setTheme(v as 'dark' | 'light')}
          />
        </View>
      </View>

      {/* Simple Mode */}
      <View style={[styles.row, { borderBottomColor: c.border.subtle }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: c.text.muted }]}>Simple Mode</Text>
          <Text style={{ color: c.text.muted, fontSize: typography.size.xs, marginTop: 2 }}>
            Show traffic lights instead of numbers
          </Text>
        </View>
        <Switch
          value={simpleMode}
          onValueChange={toggleSimpleMode}
          trackColor={{ false: c.border.default, true: c.accent.primaryMuted }}
          thumbColor={simpleMode ? c.accent.primary : c.text.muted}
          accessibilityLabel="Toggle simple mode"
        />
      </View>

      {/* 2. Timezone */}
      <PickerField
        label="Timezone"
        value={timezoneDisplay}
        options={TIMEZONE_OPTIONS}
        onSelect={handleTimezoneSave}
      />

      {/* 3. Coaching Mode */}
      <View style={styles.coachingContainer}>
        {savingCoaching && (
          <View style={[styles.coachingOverlay, { backgroundColor: c.bg.overlay }]}>
            <ActivityIndicator color={c.accent.primary} size="small" />
          </View>
        )}
        <CoachingModeSelector
          value={coachingMode as CoachingMode}
          onChange={handleCoachingChange}
        />
      </View>

      {/* 6. Reset RPE/RIR Guide */}
      {!showRpeRirTooltip && (
        <View style={[styles.row, { borderBottomColor: c.border.subtle }]}>
          <Text style={[styles.rowLabel, { color: c.text.muted }]}>RPE/RIR Guide</Text>
          <TouchableOpacity
            onPress={handleResetRpeTooltip}
            style={[styles.resetButton, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
            accessibilityLabel="Reset RPE/RIR guide"
            accessibilityRole="button"
          >
            <Text style={[styles.resetButtonText, { color: c.text.secondary }]}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inline error */}
      {error && <Text style={[styles.error, { color: c.semantic.negative }]}>{error}</Text>}
    </Card>
  );
}

// ─── Profile response mapper ─────────────────────────────────────────────────

function mapProfileResponse(data: Record<string, unknown>): UserProfile {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    displayName: (data.display_name as string) ?? null,
    avatarUrl: (data.avatar_url as string) ?? null,
    timezone: (data.timezone as string) ?? null,
    preferredCurrency: (data.preferred_currency as string) ?? null,
    region: (data.region as string) ?? null,
    coachingMode: (data.coaching_mode as string) ?? undefined,
    preferences: (data.preferences as UserProfile['preferences']) ?? null,
  };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
    marginBottom: spacing[2],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  rowLabel: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  rowControl: {
    flexShrink: 0,
  },
  coachingContainer: {
    marginTop: spacing[4],
    position: 'relative',
  },
  coachingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.bg.overlay,
    borderRadius: radius.md,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[2],
  },
  resetButton: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderColor: c.border.default,
  },
  resetButtonText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});

const getSegStyles = (c: ThemeColors) => StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    overflow: 'hidden',
  },
  segment: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: c.accent.primaryMuted,
    borderColor: c.accent.primary,
  },
  segmentText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  segmentTextActive: {
    color: c.accent.primary,
    fontWeight: typography.weight.semibold,
  },
});
