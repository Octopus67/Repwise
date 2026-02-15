/**
 * Periodization calendar utility functions.
 *
 * Pure functions for building week rows, phase colors, nutrition labels,
 * and deload suggestions from training block data.
 */

import { colors } from '../theme/tokens';

// ─── Constants ───────────────────────────────────────────────────────────────

export const PHASE_COLORS: Record<string, string> = {
  accumulation: colors.chart.calories,
  intensification: colors.accent.primary,
  deload: colors.semantic.positive,
  peak: colors.semantic.warning,
};

export const NUTRITION_LABELS: Record<string, string> = {
  bulk: 'Bulk',
  cut: 'Cut',
  maintenance: 'Maint',
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrainingBlock {
  id: string;
  name: string;
  phase_type: string;
  start_date: string;
  end_date: string;
  nutrition_phase: string | null;
}

export interface WeekRow {
  weekStart: string;
  weekEnd: string;
  blockName: string | null;
  phaseType: string | null;
  phaseColor: string | null;
  nutritionPhase: string | null;
  nutritionLabel: string | null;
  weekNumber: number | null;
  totalWeeks: number | null;
  isCurrentWeek: boolean;
  sessionDates: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─── Public Functions ────────────────────────────────────────────────────────

export function getPhaseColor(phaseType: string): string {
  return PHASE_COLORS[phaseType] ?? colors.text.muted;
}

export function getNutritionLabel(nutritionPhase: string | null): string | null {
  if (nutritionPhase == null) return null;
  return NUTRITION_LABELS[nutritionPhase] ?? null;
}

export function needsDeloadSuggestion(blocks: TrainingBlock[]): boolean {
  if (!blocks || blocks.length === 0) return false;
  const sorted = [...blocks].sort((a, b) => a.start_date.localeCompare(b.start_date));
  let consecutiveStart: Date | null = null;
  let consecutiveEnd: Date | null = null;

  for (const block of sorted) {
    if (block.phase_type === 'deload') {
      consecutiveStart = null;
      consecutiveEnd = null;
      continue;
    }
    if (consecutiveStart === null) {
      consecutiveStart = parseDate(block.start_date);
      consecutiveEnd = parseDate(block.end_date);
    } else {
      consecutiveEnd = parseDate(block.end_date);
    }
    const totalDays = (consecutiveEnd!.getTime() - consecutiveStart.getTime()) / 86400000 + 1;
    if (isNaN(totalDays)) return false;
    if (totalDays / 7 > 4) return true;
  }
  return false;
}

export function buildWeekRows(
  blocks: TrainingBlock[],
  sessionDates: string[],
  today: string,
): WeekRow[] {
  if (!blocks || blocks.length === 0) return [];
  if (!today) return [];

  const todayDate = parseDate(today);
  if (isNaN(todayDate.getTime())) return [];
  const todayMonday = formatDate(getMonday(todayDate));
  const sessionSet = new Set(sessionDates);
  const rows: WeekRow[] = [];

  for (const block of blocks) {
    const blockStart = parseDate(block.start_date);
    const blockEnd = parseDate(block.end_date);
    const firstMonday = getMonday(blockStart);
    const lastMonday = getMonday(blockEnd);
    const totalWeeks = Math.round(
      (lastMonday.getTime() - firstMonday.getTime()) / (7 * 86400000),
    ) + 1;
    const safeTotalWeeks = isNaN(totalWeeks) || totalWeeks < 1 ? 1 : totalWeeks;

    let weekStart = firstMonday;
    let weekNum = 1;

    while (weekStart <= blockEnd) {
      const weekEnd = addDays(weekStart, 6);
      const weekStartStr = formatDate(weekStart);
      const weekEndStr = formatDate(weekEnd);

      // Collect session dates in this week
      const weekSessions: string[] = [];
      for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
        const ds = formatDate(d);
        if (sessionSet.has(ds)) weekSessions.push(ds);
      }

      rows.push({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        blockName: block.name,
        phaseType: block.phase_type,
        phaseColor: getPhaseColor(block.phase_type),
        nutritionPhase: block.nutrition_phase,
        nutritionLabel: getNutritionLabel(block.nutrition_phase),
        weekNumber: weekNum,
        totalWeeks: safeTotalWeeks,
        isCurrentWeek: weekStartStr === todayMonday,
        sessionDates: weekSessions,
      });

      weekStart = addDays(weekStart, 7);
      weekNum++;
    }
  }

  return rows;
}
