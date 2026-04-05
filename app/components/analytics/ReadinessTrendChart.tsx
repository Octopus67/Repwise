import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { TrendLineChart } from '../../components/charts/TrendLineChart';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon } from '../../components/common/Icon';
import { getReadinessColor } from '../../utils/readinessScoreLogic';
import api from '../../services/api';
import type { TrendPoint } from '../../types/analytics';

interface Props {
  timeRange: string;
}

export function ReadinessTrendChart({ timeRange }: Props) {
  const c = useThemeColors();
  const [data, setData] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange] ?? 30;
    const end = getLocalDateString();
    const start = getLocalDateString(new Date(Date.now() - days * 86400000));

    api.get('readiness/history', { params: { start_date: start, end_date: end } })
      .then(({ data: res }) => {
        const items = (res.items ?? [])
          .filter((i: { score: number | null }) => i.score !== null)
          .map((i: { score_date: string; score: number }) => ({ date: i.score_date, value: i.score }))
          .reverse();
        setData(items);
      })
      .catch((err: unknown) => {
        console.warn('[ReadinessTrendChart] Failed to load history:', String(err));
        setData([]);
      })
      .finally(() => setIsLoading(false));
  }, [timeRange]);

  if (isLoading) return null;

  if (data.length < 2) {
    return (
      <Card>
        <EmptyState
          icon={<Icon name="heart" />}
          title="Not enough data"
          description="Complete at least 2 recovery check-ins to see trends"
        />
      </Card>
    );
  }

  return (
    <Card>
      <TrendLineChart
        data={data}
        color={c.semantic.positive}
        suffix=""
        emptyMessage="No readiness data for this period"
      />
    </Card>
  );
}
