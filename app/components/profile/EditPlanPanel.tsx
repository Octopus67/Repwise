import { useState } from 'react';
import { colors } from '../../theme/tokens';
import { Icon } from '../common/Icon';
import { EmptyState } from '../common/EmptyState';
import { PlanSummaryCard } from './PlanSummaryCard';
import { PlanEditFlow } from './PlanEditFlow';
import { useStore } from '../../store';

interface EditPlanPanelProps {
  metrics: {
    id: string;
    heightCm: number | null;
    weightKg: number | null;
    bodyFatPct: number | null;
    activityLevel: string | null;
    recordedAt: string;
  } | null;
  goals: {
    id: string;
    userId: string;
    goalType: string;
    targetWeightKg: number | null;
    goalRatePerWeek: number | null;
  } | null;
  adaptiveTargets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;
  unitSystem: 'metric' | 'imperial';
}

export function EditPlanPanel({
  metrics,
  goals,
  adaptiveTargets,
  unitSystem,
}: EditPlanPanelProps) {
  const [editing, setEditing] = useState(false);
  const store = useStore();

  const handleSave = (result: {
    metrics: {
      id: string;
      heightCm: number | null;
      weightKg: number | null;
      bodyFatPct: number | null;
      activityLevel: string | null;
      recordedAt: string;
    };
    goals: {
      id: string;
      userId: string;
      goalType: string;
      targetWeightKg: number | null;
      goalRatePerWeek: number | null;
    };
    targets: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
  }) => {
    store.setLatestMetrics(result.metrics);
    store.setGoals(result.goals);
    store.setAdaptiveTargets(result.targets);
    setEditing(false);
  };

  if (editing) {
    return (
      <PlanEditFlow
        metrics={metrics}
        goals={goals}
        unitSystem={unitSystem}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (!metrics && !goals) {
    return (
      <EmptyState
        icon={<Icon name="target" size={28} color={colors.accent.primary} />}
        title="My Plan"
        description="Set up your body stats and goals to get personalized targets"
        actionLabel="Set Up My Plan"
        onAction={() => setEditing(true)}
      />
    );
  }

  return (
    <PlanSummaryCard
      metrics={metrics}
      goals={goals}
      adaptiveTargets={adaptiveTargets}
      unitSystem={unitSystem}
      onEdit={() => setEditing(true)}
    />
  );
}
