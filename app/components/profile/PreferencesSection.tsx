import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../common/Card';
import { EditableField } from '../common/EditableField';
import { CoachingModeSelector, type CoachingMode } from '../coaching/CoachingModeSelector';
import { useStore, type UserProfile } from '../../store';
import api from '../../services/api';

// ─── SegmentedControl (inline) ───────────────────────────────────────────────

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  selected: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function SegmentedControl({ options, selected, onChange, disabled }: SegmentedControlProps) {
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
  const store = useStore();
  const [savingUnit, setSavingUnit] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);
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
        .catch(() => {
          // Silent fail — user can set manually
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
      setSavingTimezone(true);
      setError(null);
      try {
        const { data } = await api.put('users/profile', { timezone: newValue });
        const mapped = mapProfileResponse(data);
        store.setProfile(mapped);
      } catch {
        throw new Error("Couldn't save timezone.");
      } finally {
        setSavingTimezone(false);
      }
    },
    [store],
  );

  // ── Region change ──
  const handleRegionSave = useCallback(
    async (newValue: string) => {
      setError(null);
      try {
        const { data } = await api.put('users/profile', { region: newValue });
        const mapped = mapProfileResponse(data);
        store.setProfile(mapped);
      } catch {
        throw new Error("Couldn't save region.");
      }
    },
    [store],
  );

  // ── Currency change ──
  const handleCurrencySave = useCallback(
    async (newValue: string) => {
      setError(null);
      try {
        const { data } = await api.put('users/profile', { preferred_currency: newValue });
        const mapped = mapProfileResponse(data);
        store.setProfile(mapped);
      } catch {
        throw new Error("Couldn't save currency.");
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

  const timezoneDisplay = profile.timezone ?? detectTimezone();

  return (
    <Card>
      <Text style={styles.sectionTitle}>Preferences</Text>

      {/* 1. Unit System — SegmentedControl */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Unit System</Text>
        <View style={styles.rowControl}>
          {savingUnit ? (
            <ActivityIndicator color={colors.accent.primary} size="small" />
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

      {/* 2. Timezone */}
      <EditableField
        label="Timezone"
        value={timezoneDisplay}
        onSave={handleTimezoneSave}
      />

      {/* 3. Region */}
      <EditableField
        label="Region"
        value={profile.region ?? '—'}
        onSave={handleRegionSave}
      />

      {/* 4. Currency */}
      <EditableField
        label="Currency"
        value={profile.preferredCurrency ?? '—'}
        onSave={handleCurrencySave}
      />

      {/* 5. Coaching Mode */}
      <View style={styles.coachingContainer}>
        {savingCoaching && (
          <View style={styles.coachingOverlay}>
            <ActivityIndicator color={colors.accent.primary} size="small" />
          </View>
        )}
        <CoachingModeSelector
          value={coachingMode as CoachingMode}
          onChange={handleCoachingChange}
        />
      </View>

      {/* Inline error */}
      {error && <Text style={styles.error}>{error}</Text>}
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

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text.primary,
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
    borderBottomColor: colors.border.subtle,
  },
  rowLabel: {
    color: colors.text.muted,
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
    backgroundColor: colors.bg.overlay,
    borderRadius: radius.md,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[2],
  },
});

const segStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  segment: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.accent.primaryMuted,
    borderColor: colors.accent.primary,
  },
  segmentText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  segmentTextActive: {
    color: colors.accent.primary,
    fontWeight: typography.weight.semibold,
  },
});
