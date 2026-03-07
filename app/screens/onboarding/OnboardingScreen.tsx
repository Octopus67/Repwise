// DEPRECATED: Use OnboardingWizard instead
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { colors, radius, spacing, typography, letterSpacing } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button } from '../../components/common/Button';
import api from '../../services/api';

// ─── Storage helpers (web: localStorage, native: expo-secure-store) ──────────

import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'rw_onboarding_state';

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function storageRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

async function loadPersistedState(): Promise<Partial<OnboardingData> & { step?: number } | null> {
  try {
    const raw = await storageGet(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function persistState(data: Partial<OnboardingData> & { step: number }) {
  try {
    await storageSet(STORAGE_KEY, JSON.stringify(data));
  } catch { /* best-effort */ }
}

async function clearPersistedState() {
  try {
    await storageRemove(STORAGE_KEY);
  } catch { /* best-effort */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type GoalType = 'bulking' | 'cutting' | 'maintaining';
type Sex = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

interface OnboardingData {
  goal_type: GoalType | null;
  height_cm: string;
  weight_kg: string;
  body_fat_pct: string;
  age: string;
  sex: Sex;
  activity_level: ActivityLevel;
}

interface OnboardingResult {
  snapshot: {
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
  };
}

interface OnboardingScreenProps {
  onComplete: () => void;
  onSkip: () => void;
}

const INITIAL_DATA: OnboardingData = {
  goal_type: null,
  height_cm: '',
  weight_kg: '',
  body_fat_pct: '',
  age: '',
  sex: 'male',
  activity_level: 'moderate',
};

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very Active' },
];

// ─── Validation ──────────────────────────────────────────────────────────────

interface ValidationErrors {
  height_cm?: string;
  weight_kg?: string;
  body_fat_pct?: string;
  age?: string;
}

function validateBodyStats(data: OnboardingData): ValidationErrors {
  const errors: ValidationErrors = {};
  const h = parseFloat(data.height_cm);
  const w = parseFloat(data.weight_kg);
  const a = parseInt(data.age, 10);

  if (!data.height_cm || isNaN(h) || h < 100 || h > 250) {
    errors.height_cm = 'Height must be 100–250 cm';
  }
  if (!data.weight_kg || isNaN(w) || w < 30 || w > 300) {
    errors.weight_kg = 'Weight must be 30–300 kg';
  }
  if (data.body_fat_pct) {
    const bf = parseFloat(data.body_fat_pct);
    if (isNaN(bf) || bf < 3 || bf > 60) {
      errors.body_fat_pct = 'Body fat must be 3–60%';
    }
  }
  if (!data.age || isNaN(a) || a < 13 || a > 120) {
    errors.age = 'Age must be 13–120';
  }
  return errors;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OnboardingScreen({ onComplete, onSkip }: OnboardingScreenProps) {
  const c = useThemeColors();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Restore persisted state on mount
  useEffect(() => {
    (async () => {
      const saved = await loadPersistedState();
      if (saved) {
        if (saved.step) setStep(saved.step);
        setData((prev) => ({ ...prev, ...saved, step: undefined } as OnboardingData));
      }
      setRestoring(false);
    })();
  }, []);

  // Persist state on changes
  useEffect(() => {
    if (!restoring) {
      persistState({ ...data, step });
    }
  }, [step, data, restoring]);

  const updateField = useCallback(<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  // ─── Step 1 → 2 ─────────────────────────────────────────────────────────

  const handleNextFromGoal = () => {
    if (!data.goal_type) return;
    setStep(2);
  };

  // ─── Step 2 → 3 (submit) ────────────────────────────────────────────────

  const handleSubmit = async () => {
    const validationErrors = validateBodyStats(data);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setApiError('');
    try {
      const payload = {
        goal_type: data.goal_type,
        height_cm: parseFloat(data.height_cm),
        weight_kg: parseFloat(data.weight_kg),
        body_fat_pct: data.body_fat_pct ? parseFloat(data.body_fat_pct) : null,
        age_years: parseInt(data.age, 10),
        sex: data.sex,
        activity_level: data.activity_level,
        goal_rate_per_week: data.goal_type === 'bulking' ? 0.25 : data.goal_type === 'cutting' ? -0.5 : 0,
      };
      const { data: res } = await api.post('onboarding/complete', payload);
      setResult({
        snapshot: {
          target_calories: res.snapshot?.target_calories ?? 0,
          target_protein_g: res.snapshot?.target_protein_g ?? 0,
          target_carbs_g: res.snapshot?.target_carbs_g ?? 0,
          target_fat_g: res.snapshot?.target_fat_g ?? 0,
        },
      });
      setStep(3);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Something went wrong. Please try again.';
      setApiError(typeof msg === 'string' ? msg : 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGetStarted = async () => {
    await clearPersistedState();
    onComplete();
  };

  const handleSkip = async () => {
    await clearPersistedState();
    onSkip();
  };

  if (restoring) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.bg.base }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={c.accent.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg.base }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Progress indicator */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={[styles.dot, s === step && styles.dotActive, s < step && styles.dotDone]} />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: c.text.muted }]}>Step {step} of 3</Text>

        {step === 1 && (
          <StepGoal
            selected={data.goal_type}
            onSelect={(g) => updateField('goal_type', g)}
            onNext={handleNextFromGoal}
            onSkip={handleSkip}
          />
        )}

        {step === 2 && (
          <StepBodyStats
            data={data}
            errors={errors}
            apiError={apiError}
            loading={loading}
            onUpdate={updateField}
            onSubmit={handleSubmit}
            onBack={() => setStep(1)}
            onSkip={handleSkip}
          />
        )}

        {step === 3 && result && (
          <StepResults
            result={result}
            data={data}
            onGetStarted={handleGetStarted}
            onSkip={handleSkip}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Step 1: Goal Selection ──────────────────────────────────────────────────

const GOALS: { type: GoalType; emoji: string; title: string; desc: string }[] = [
  { type: 'bulking', emoji: '💪', title: 'Bulk', desc: 'Build muscle & gain weight' },
  { type: 'cutting', emoji: '🔥', title: 'Cut', desc: 'Lose fat & get lean' },
  { type: 'maintaining', emoji: '⚖️', title: 'Maintain', desc: 'Stay at current weight' },
];

function StepGoal({
  selected,
  onSelect,
  onNext,
  onSkip,
}: {
  selected: GoalType | null;
  onSelect: (g: GoalType) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const c = useThemeColors();
  return (
    <View>
      <Text style={[styles.heading, { color: c.text.primary }]}>What's your goal?</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>We'll tailor your targets accordingly</Text>

      {GOALS.map((g) => (
        <TouchableOpacity
          key={g.type}
          style={[styles.goalCard, selected === g.type && styles.goalCardSelected]}
          onPress={() => onSelect(g.type)}
          activeOpacity={0.7}
        >
          <Text style={styles.goalEmoji}>{g.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.goalTitle, { color: c.text.primary }]}>{g.title}</Text>
            <Text style={[styles.goalDesc, { color: c.text.secondary }]}>{g.desc}</Text>
          </View>
          {selected === g.type && <Text style={[styles.checkmark, { color: c.accent.primary }]}>✓</Text>}
        </TouchableOpacity>
      ))}

      <Button title="Next" onPress={onNext} disabled={!selected} style={styles.mainBtn} />
      <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
        <Text style={[styles.skipText, { color: c.text.muted }]}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 2: Body Stats ──────────────────────────────────────────────────────

function StepBodyStats({
  data,
  errors,
  apiError,
  loading,
  onUpdate,
  onSubmit,
  onBack,
  onSkip,
}: {
  data: OnboardingData;
  errors: ValidationErrors;
  apiError: string;
  loading: boolean;
  onUpdate: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  onSubmit: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const c = useThemeColors();
  return (
    <View>
      <Text style={[styles.heading, { color: c.text.primary }]}>Your body stats</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>Used to calculate your targets</Text>

      {apiError ? <Text style={[styles.error, { color: c.semantic.negative, backgroundColor: c.semantic.negativeSubtle }]}>{apiError}</Text> : null}

      <Text style={[styles.fieldLabel, { color: c.text.secondary }]}>Height (cm)</Text>
      <TextInput
        style={[styles.input, errors.height_cm ? styles.inputError : null]}
        placeholder="175"
        placeholderTextColor={c.text.muted}
        keyboardType="numeric"
        value={data.height_cm}
        onChangeText={(v) => onUpdate('height_cm', v)}
      />
      {errors.height_cm ? <Text style={[styles.fieldError, { color: c.semantic.negative }]}>{errors.height_cm}</Text> : null}

      <Text style={[styles.fieldLabel, { color: c.text.secondary }]}>Weight (kg)</Text>
      <TextInput
        style={[styles.input, errors.weight_kg ? styles.inputError : null]}
        placeholder="80"
        placeholderTextColor={c.text.muted}
        keyboardType="numeric"
        value={data.weight_kg}
        onChangeText={(v) => onUpdate('weight_kg', v)}
      />
      {errors.weight_kg ? <Text style={[styles.fieldError, { color: c.semantic.negative }]}>{errors.weight_kg}</Text> : null}

      <Text style={[styles.fieldLabel, { color: c.text.secondary }]}>Body Fat % (optional)</Text>
      <TextInput
        style={[styles.input, errors.body_fat_pct ? styles.inputError : null]}
        placeholder="15"
        placeholderTextColor={c.text.muted}
        keyboardType="numeric"
        value={data.body_fat_pct}
        onChangeText={(v) => onUpdate('body_fat_pct', v)}
      />
      {errors.body_fat_pct ? <Text style={[styles.fieldError, { color: c.semantic.negative }]}>{errors.body_fat_pct}</Text> : null}

      <Text style={[styles.fieldLabel, { color: c.text.secondary }]}>Age</Text>
      <TextInput
        style={[styles.input, errors.age ? styles.inputError : null]}
        placeholder="25"
        placeholderTextColor={c.text.muted}
        keyboardType="numeric"
        value={data.age}
        onChangeText={(v) => onUpdate('age', v)}
      />
      {errors.age ? <Text style={[styles.fieldError, { color: c.semantic.negative }]}>{errors.age}</Text> : null}

      {/* Sex toggle */}
      <Text style={[styles.fieldLabel, { color: c.text.secondary }]}>Sex</Text>
      <View style={styles.toggleRow}>
        {(['male', 'female'] as Sex[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.toggleBtn, data.sex === s && styles.toggleBtnActive]}
            onPress={() => onUpdate('sex', s)}
          >
            <Text style={[styles.toggleText, data.sex === s && styles.toggleTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity level */}
      <Text style={[styles.fieldLabel, { color: c.text.secondary }]}>Activity Level</Text>
      <View style={styles.activityRow}>
        {ACTIVITY_LEVELS.map((al) => (
          <TouchableOpacity
            key={al.value}
            style={[styles.activityChip, data.activity_level === al.value && styles.activityChipActive]}
            onPress={() => onUpdate('activity_level', al.value)}
          >
            <Text style={[styles.activityText, data.activity_level === al.value && styles.activityTextActive]}>
              {al.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title="Calculate Targets" onPress={onSubmit} loading={loading} style={styles.mainBtn} />

      <View style={styles.bottomRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={[styles.backText, { color: c.accent.primary }]}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip}>
          <Text style={[styles.skipText, { color: c.text.muted }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Step 3: Results ─────────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function computeBmrAndTdee(data: OnboardingData) {
  const weight = parseFloat(data.weight_kg) || 70;
  const height = parseFloat(data.height_cm) || 175;
  const age = parseInt(data.age, 10) || 25;
  // Mifflin-St Jeor
  const base = 10 * weight + 6.25 * height - 5 * age;
  const bmr = data.sex === 'male' ? base + 5 : base - 161;
  const tdee = bmr * (ACTIVITY_MULTIPLIERS[data.activity_level] ?? 1.55);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

function getGoalExplanation(goal: GoalType | null) {
  switch (goal) {
    case 'cutting':
      return "We've set a moderate deficit of ~500 kcal below your TDEE to lose fat while preserving muscle.";
    case 'bulking':
      return "We've added ~250 kcal above your TDEE to support muscle growth without excessive fat gain.";
    case 'maintaining':
    default:
      return 'Your targets match your TDEE to maintain your current weight and body composition.';
  }
}

function getTrainingCallout(goal: GoalType | null) {
  switch (goal) {
    case 'cutting':
      return '💡 Resistance training while cutting is crucial — it signals your body to preserve muscle mass while losing fat.';
    case 'bulking':
      return "💡 Progressive overload is key — your surplus only builds muscle if you're training hard enough to stimulate growth.";
    case 'maintaining':
    default:
      return '💡 Consistent training with proper nutrition is the foundation of body recomposition.';
  }
}

type MacroKey = 'protein' | 'carbs' | 'fat';

function ProteinRangeBar({ value }: { value: number }) {
  const c = useThemeColors();
  const minRange = 1.2;
  const maxRange = 2.5;
  const clampedValue = Math.min(Math.max(value, minRange), maxRange);
  const pct = ((clampedValue - minRange) / (maxRange - minRange)) * 100;

  return (
    <View style={infoStyles.rangeContainer}>
      <Text style={[infoStyles.rangeLabelLeft, { color: c.text.muted }]}>1.2 g/kg</Text>
      <View style={[infoStyles.rangeTrack, { backgroundColor: c.border.default }]}>
        <View
          style={[
            infoStyles.rangeOptimalZone,
            {
              backgroundColor: c.semantic.positiveSubtle,
              left: `${((1.6 - minRange) / (maxRange - minRange)) * 100}%`,
              width: `${((2.2 - 1.6) / (maxRange - minRange)) * 100}%`,
            },
          ]}
        />
        <View style={[infoStyles.rangeMarker, { left: `${pct}%` }]}>
          <View style={[infoStyles.rangeMarkerDot, { backgroundColor: c.accent.primary, borderColor: c.text.primary }]} />
          <Text style={[infoStyles.rangeMarkerLabel, { color: c.accent.primary }]}>{value.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={[infoStyles.rangeLabelRight, { color: c.text.muted }]}>2.5 g/kg</Text>
    </View>
  );
}

function MacroInfoPanel({
  macro,
  data,
  result,
  weightKg,
  proteinPerKgNum,
}: {
  macro: MacroKey;
  data: OnboardingData;
  result: OnboardingResult;
  weightKg: number;
  proteinPerKgNum: number;
}) {
  const c = useThemeColors();
  const { target_calories, target_protein_g, target_carbs_g, target_fat_g } = result.snapshot;
  const goalLabel = data.goal_type === 'cutting' ? 'cutting' : data.goal_type === 'bulking' ? 'bulking' : 'maintenance';

  if (macro === 'protein') {
    const rangeEnd = data.goal_type === 'cutting' ? 'higher' : data.goal_type === 'bulking' ? 'middle' : 'middle';
    const goalPhrase = data.goal_type === 'cutting' ? 'cut' : data.goal_type === 'bulking' ? 'bulk' : 'maintain';
    return (
      <View style={[infoStyles.panel, { backgroundColor: c.bg.surface }]}>
        <Text style={[infoStyles.sectionHeader, { color: c.text.primary }]}>How we calculated this</Text>
        <Text style={[infoStyles.sectionBody, { color: c.text.secondary }]}>
          We set your protein at {proteinPerKgNum.toFixed(1)} g/kg of bodyweight. Research consistently shows 1.6–2.2 g/kg is optimal for muscle protein synthesis during {goalLabel} phases. We've targeted the {rangeEnd} end of this range based on your goal.
        </Text>
        <Text style={[infoStyles.sectionHeader, { color: c.text.primary }]}>Why protein matters</Text>
        <Text style={[infoStyles.sectionBody, { color: c.text.secondary }]}>
          Protein is the building block of muscle tissue. During a {goalPhrase}, adequate protein:{'\n'}
          (1) maximizes muscle protein synthesis{'\n'}
          (2) preserves lean mass during caloric deficits{'\n'}
          (3) increases satiety helping you feel full longer{'\n'}
          (4) has the highest thermic effect of food (~20-30% of calories burned during digestion).
        </Text>
        <Text style={[infoStyles.sectionHeader, { color: c.text.primary }]}>Optimal range</Text>
        <ProteinRangeBar value={proteinPerKgNum} />
      </View>
    );
  }

  if (macro === 'carbs') {
    const carbKcal = Math.round(target_carbs_g * 4);
    const carbPct = target_calories > 0 ? Math.round((carbKcal / target_calories) * 100) : 0;
    return (
      <View style={[infoStyles.panel, { backgroundColor: c.bg.surface }]}>
        <Text style={[infoStyles.sectionHeader, { color: c.text.primary }]}>How we calculated this</Text>
        <Text style={[infoStyles.sectionBody, { color: c.text.secondary }]}>
          Carbs make up the remaining calories after protein and fat are set. Your {Math.round(target_carbs_g)}g provides {carbKcal} kcal ({carbPct}% of total calories).
        </Text>
        <Text style={[infoStyles.sectionHeader, { color: c.text.primary }]}>Why carbs matter</Text>
        <Text style={[infoStyles.sectionBody, { color: c.text.secondary }]}>
          Carbohydrates are your body's preferred fuel for high-intensity training. They:{'\n'}
          (1) replenish muscle glycogen depleted during resistance training{'\n'}
          (2) support training performance and recovery{'\n'}
          (3) spare protein from being used as fuel{'\n'}
          (4) regulate hormones like leptin and thyroid function — especially important during cutting phases.
        </Text>
        {data.goal_type === 'cutting' && (
          <>
            <Text style={[infoStyles.sectionHeader, { color: c.text.primary }]}>Note for cutting</Text>
            <Text style={[infoStyles.sectionBody, { color: c.text.secondary }]}>
              We keep carbs moderate during a cut to maintain training intensity while still achieving a deficit.
            </Text>
          </>
        )}
      </View>
    );
  }

  // fat
  const fatKcal = Math.round(target_fat_g * 9);
  const fatPct = target_calories > 0 ? Math.round((fatKcal / target_calories) * 100) : 0;
  const fatPerKg = weightKg > 0 ? (target_fat_g / weightKg).toFixed(1) : '—';
  return (
    <View style={[infoStyles.panel, { backgroundColor: c.bg.surface }]}>
      <Text style={[infoStyles.sectionHeader, { color: c.text.primary }]}>How we calculated this</Text>
      <Text style={[infoStyles.sectionBody, { color: c.text.secondary }]}>
        We set fat at ~{fatPct}% of total calories ({fatPerKg} g/kg bodyweight). The minimum recommended is 0.5 g/kg for hormonal health.
      </Text>
      <Text style={[infoStyles.sectionHeader, { color: c.text.primary }]}>Why fat matters</Text>
      <Text style={[infoStyles.sectionBody, { color: c.text.secondary }]}>
        Dietary fat is essential for:{'\n'}
        (1) testosterone and estrogen production — critical for muscle growth and recovery{'\n'}
        (2) absorption of fat-soluble vitamins (A, D, E, K){'\n'}
        (3) brain function and cell membrane integrity{'\n'}
        (4) joint health and inflammation regulation.{'\n\n'}
        Going too low on fat can impair hormonal function and recovery.
      </Text>
    </View>
  );
}

function StepResults({
  result,
  data,
  onGetStarted,
  onSkip,
}: {
  result: OnboardingResult;
  data: OnboardingData;
  onGetStarted: () => void;
  onSkip: () => void;
}) {
  const c = useThemeColors();
  const { target_calories, target_protein_g, target_carbs_g, target_fat_g } = result.snapshot;
  const { bmr, tdee } = computeBmrAndTdee(data);
  const weightKg = parseFloat(data.weight_kg) || 70;
  const proteinPerKgNum = weightKg > 0 ? target_protein_g / weightKg : 0;
  const proteinPerKg = weightKg > 0 ? proteinPerKgNum.toFixed(1) : '—';

  const [expandedMacro, setExpandedMacro] = useState<MacroKey | null>(null);

  const toggleMacro = (macro: MacroKey) => {
    setExpandedMacro((prev) => (prev === macro ? null : macro));
  };

  return (
    <View>
      {/* Personal greeting */}
      <Text style={[styles.heading, { color: c.text.primary }]}>Your plan is ready! 🎯</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>
        Here's what we've built for you — backed by science, tailored to your body.
      </Text>

      {/* TDEE breakdown card */}
      <View style={[resultStyles.card, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}>
        <Text style={[resultStyles.cardTitle, { color: c.text.secondary }]}>Your Energy Expenditure</Text>
        <View style={resultStyles.tdeeRow}>
          <View style={resultStyles.tdeeItem}>
            <Text style={[resultStyles.tdeeValue, { color: c.text.primary }]}>{bmr}</Text>
            <Text style={[resultStyles.tdeeLabel, { color: c.text.muted }]}>BMR (kcal)</Text>
          </View>
          <Text style={[resultStyles.tdeeArrow, { color: c.text.muted }]}>→</Text>
          <View style={resultStyles.tdeeItem}>
            <Text style={[resultStyles.tdeeValue, { color: c.accent.primary }]}>{tdee}</Text>
            <Text style={[resultStyles.tdeeLabel, { color: c.text.muted }]}>TDEE (kcal)</Text>
          </View>
        </View>
        <Text style={[resultStyles.explanation, { color: c.text.secondary }]}>
          Your body burns approximately {bmr} kcal/day at rest (BMR) and ~{tdee} kcal/day with your
          activity level (TDEE).
        </Text>
      </View>

      {/* Goal-adjusted targets card */}
      <View style={[resultStyles.card, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}>
        <Text style={[resultStyles.cardTitle, { color: c.text.secondary }]}>Daily Calorie Target</Text>
        <Text style={[resultStyles.calorieValue, { color: c.chart.calories }]}>
          {Math.round(target_calories)}
          <Text style={resultStyles.calorieUnit}> kcal/day</Text>
        </Text>
        <Text style={[resultStyles.explanation, { color: c.text.secondary }]}>{getGoalExplanation(data.goal_type)}</Text>
      </View>

      {/* Macro breakdown with rationale + expandable info panels */}
      <View style={[resultStyles.card, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}>
        <Text style={[resultStyles.cardTitle, { color: c.text.secondary }]}>Macro Breakdown</Text>

        {/* Protein row */}
        <View style={resultStyles.macroRow}>
          <View style={[resultStyles.macroIndicator, { backgroundColor: c.semantic.positive }]} />
          <View style={resultStyles.macroContent}>
            <View style={resultStyles.macroHeader}>
              <Text style={[resultStyles.macroValue, { color: c.text.primary, flex: 1 }]}>
                {Math.round(target_protein_g)}g Protein
                <Text style={[resultStyles.macroMeta, { color: c.text.muted }]}> ({proteinPerKg} g/kg bodyweight)</Text>
              </Text>
              <TouchableOpacity
                onPress={() => toggleMacro('protein')}
                style={infoStyles.infoBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Protein info"
                accessibilityRole="button"
              >
                <Text style={[infoStyles.infoBtnText, { color: c.accent.primary }, expandedMacro === 'protein' && infoStyles.infoBtnTextActive]}>ⓘ</Text>
              </TouchableOpacity>
            </View>
            <Text style={[resultStyles.macroRationale, { color: c.text.secondary }]}>
              Higher protein supports muscle recovery and satiety
            </Text>
          </View>
        </View>
        {expandedMacro === 'protein' && (
          <MacroInfoPanel macro="protein" data={data} result={result} weightKg={weightKg} proteinPerKgNum={proteinPerKgNum} />
        )}

        {/* Carbs row */}
        <View style={resultStyles.macroRow}>
          <View style={[resultStyles.macroIndicator, { backgroundColor: c.semantic.warning }]} />
          <View style={resultStyles.macroContent}>
            <View style={resultStyles.macroHeader}>
              <Text style={[resultStyles.macroValue, { color: c.text.primary, flex: 1 }]}>
                {Math.round(target_carbs_g)}g Carbs
              </Text>
              <TouchableOpacity
                onPress={() => toggleMacro('carbs')}
                style={infoStyles.infoBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Carbs info"
                accessibilityRole="button"
              >
                <Text style={[infoStyles.infoBtnText, { color: c.accent.primary }, expandedMacro === 'carbs' && infoStyles.infoBtnTextActive]}>ⓘ</Text>
              </TouchableOpacity>
            </View>
            <Text style={[resultStyles.macroRationale, { color: c.text.secondary }]}>
              Fuels your training sessions and recovery
            </Text>
          </View>
        </View>
        {expandedMacro === 'carbs' && (
          <MacroInfoPanel macro="carbs" data={data} result={result} weightKg={weightKg} proteinPerKgNum={proteinPerKgNum} />
        )}

        {/* Fat row */}
        <View style={resultStyles.macroRow}>
          <View style={[resultStyles.macroIndicator, { backgroundColor: c.chart.calories }]} />
          <View style={resultStyles.macroContent}>
            <View style={resultStyles.macroHeader}>
              <Text style={[resultStyles.macroValue, { color: c.text.primary, flex: 1 }]}>
                {Math.round(target_fat_g)}g Fat
              </Text>
              <TouchableOpacity
                onPress={() => toggleMacro('fat')}
                style={infoStyles.infoBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Fat info"
                accessibilityRole="button"
              >
                <Text style={[infoStyles.infoBtnText, { color: c.accent.primary }, expandedMacro === 'fat' && infoStyles.infoBtnTextActive]}>ⓘ</Text>
              </TouchableOpacity>
            </View>
            <Text style={[resultStyles.macroRationale, { color: c.text.secondary }]}>
              Essential for hormones, brain function, and nutrient absorption
            </Text>
          </View>
        </View>
        {expandedMacro === 'fat' && (
          <MacroInfoPanel macro="fat" data={data} result={result} weightKg={weightKg} proteinPerKgNum={proteinPerKgNum} />
        )}
      </View>

      {/* Training importance callout */}
      <View style={[resultStyles.calloutCard, { backgroundColor: c.accent.primaryMuted, borderColor: c.accent.primary }]}>
        <Text style={[resultStyles.calloutText, { color: c.text.primary }]}>{getTrainingCallout(data.goal_type)}</Text>
      </View>

      <Button title="Get Started" onPress={onGetStarted} style={styles.mainBtn} />

      <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
        <Text style={[styles.skipText, { color: c.text.muted }]}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  infoBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 18,
  },
  infoBtnTextActive: {
    opacity: 0.7,
  },
  panel: {
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    marginLeft: 4 + spacing[3],
  },
  sectionHeader: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
    marginTop: spacing[2],
    lineHeight: typography.lineHeight.sm,
  },
  sectionBody: {
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  rangeLabelLeft: {
    fontSize: typography.size.xs,
    marginRight: spacing[2],
    lineHeight: typography.lineHeight.xs,
  },
  rangeLabelRight: {
    fontSize: typography.size.xs,
    marginLeft: spacing[2],
    lineHeight: typography.lineHeight.xs,
  },
  rangeTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    position: 'relative',
  },
  rangeOptimalZone: {
    position: 'absolute',
    top: 0,
    height: 6,
    borderRadius: 3,
  },
  rangeMarker: {
    position: 'absolute',
    top: -5,
    alignItems: 'center',
    marginLeft: -6,
  },
  rangeMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  rangeMarkerLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[0.5],
    lineHeight: typography.lineHeight.xs,
  },
});

const resultStyles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.sm,
  },
  tdeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  tdeeItem: { alignItems: 'center', flex: 1 },
  tdeeValue: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight['2xl'],
  },
  tdeeLabel: {
    fontSize: typography.size.xs,
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.xs,
  },
  tdeeArrow: {
    fontSize: typography.size.xl,
    marginHorizontal: spacing[2],
    lineHeight: typography.lineHeight.xl,
  },
  explanation: {
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  calorieValue: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight['3xl'],
  },
  calorieUnit: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    lineHeight: typography.lineHeight.base,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  macroIndicator: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginRight: spacing[3],
  },
  macroContent: { flex: 1 },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
  },
  macroMeta: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    lineHeight: typography.lineHeight.sm,
  },
  macroRationale: {
    fontSize: typography.size.sm,
    marginTop: spacing[0.5],
    lineHeight: typography.lineHeight.sm,
  },
  calloutCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  calloutText: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing[6], paddingBottom: spacing[12] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Progress
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2], marginTop: spacing[4] },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border.default,
  },
  dotActive: { backgroundColor: colors.accent.primary, width: 24 },
  dotDone: { backgroundColor: colors.accent.primary },
  stepLabel: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[6],
    lineHeight: typography.lineHeight.sm,
  },

  // Headings
  heading: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    lineHeight: typography.lineHeight['2xl'],
  },
  subheading: {
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: spacing[1],
    marginBottom: spacing[6],
    lineHeight: typography.lineHeight.base,
  },

  // Goal cards
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  goalCardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  goalEmoji: { fontSize: 28, marginRight: spacing[3] },
  goalTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
  },
  goalDesc: { fontSize: typography.size.sm, marginTop: spacing[0.5], lineHeight: typography.lineHeight.sm },
  checkmark: { fontSize: 20, fontWeight: typography.weight.semibold },

  // Form
  fieldLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
    marginTop: spacing[3],
    lineHeight: typography.lineHeight.sm,
  },
  input: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    color: colors.text.primary,
    fontSize: typography.size.base,
    padding: spacing[3],
    lineHeight: typography.lineHeight.base,
  },
  inputError: { borderColor: colors.semantic.negative },
  fieldError: {
    fontSize: typography.size.xs,
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.xs,
  },
  error: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[4],
    padding: spacing[3],
    borderRadius: radius.sm,
    lineHeight: typography.lineHeight.sm,
  },

  // Toggles
  toggleRow: { flexDirection: 'row', gap: spacing[2] },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  toggleBtnActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  toggleText: { color: colors.text.secondary, fontSize: typography.size.base, lineHeight: typography.lineHeight.base },
  toggleTextActive: { color: colors.accent.primary, fontWeight: typography.weight.semibold },

  // Activity chips
  activityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  activityChip: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 44,
    justifyContent: 'center',
  },
  activityChipActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  activityText: { color: colors.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  activityTextActive: { color: colors.accent.primary, fontWeight: typography.weight.semibold },

  // Buttons & links
  mainBtn: { marginTop: spacing[6] },
  skipLink: { alignItems: 'center', marginTop: spacing[4], minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  backText: { fontSize: typography.size.base, lineHeight: typography.lineHeight.base },
});
