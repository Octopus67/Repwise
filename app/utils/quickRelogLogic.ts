/**
 * Quick Re-log scoring logic.
 *
 * Pure functions — no React Native imports, no API calls.
 * Computes a ranked list of foods the user logs frequently,
 * weighted by recency so stale items decay out.
 */

import type { NutritionEntry } from '../utils/mealSlotLogic';

export interface QuickRelogItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealFavorite {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface ScoredMeal {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  score: number;
}

/**
 * Compute a ranked list of quick re-log items from recent entries
 * and explicit favorites.
 *
 * Algorithm:
 *  1. Group entries by meal_name (case-insensitive), count frequency.
 *  2. For each unique meal: score = count × recencyWeight
 *     where recencyWeight = max(0, 1 - daysSinceLastLog × 0.07)
 *  3. Sort by score descending, take top maxItems.
 *  4. If fewer than 3 behavioral items, backfill from favorites
 *     (skip duplicates by name).
 *  5. Return empty array if both inputs are empty.
 */
export function computeQuickRelogItems(
  recentEntries: NutritionEntry[],
  favorites: MealFavorite[],
  maxItems: number = 5,
): QuickRelogItem[] {
  const now = new Date();
  const todayStr = toDateStr(now);

  // --- 1. Group entries by normalised meal_name ---
  const groups = new Map<
    string,
    { count: number; lastDate: string; variants: NutritionEntry[] }
  >();

  for (const entry of recentEntries) {
    const raw = (entry.meal_name ?? '').trim();
    if (raw === '') continue; // skip empty names (edge case 1.3)

    const key = raw.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (entry.entry_date > existing.lastDate) {
        existing.lastDate = entry.entry_date;
      }
      existing.variants.push(entry);
    } else {
      groups.set(key, {
        count: 1,
        lastDate: entry.entry_date,
        variants: [entry],
      });
    }
  }

  // --- 2. Score each unique meal ---
  const scored: ScoredMeal[] = [];

  for (const [, group] of groups) {
    const daysSince = daysBetween(group.lastDate, todayStr);
    const recencyWeight = Math.max(0, 1 - daysSince * 0.07);
    const score = group.count * recencyWeight;

    // Pick the highest-calorie variant (edge case 1.3)
    const best = pickHighestCalorie(group.variants);

    scored.push({
      name: best.meal_name,
      calories: best.calories,
      protein_g: best.protein_g,
      carbs_g: best.carbs_g,
      fat_g: best.fat_g,
      score,
    });
  }

  // --- 3. Sort descending by score, take top maxItems ---
  scored.sort((a, b) => b.score - a.score);
  const behavioralItems = scored.slice(0, maxItems);

  // --- 4. Backfill from favorites if fewer than 3 behavioral items ---
  const result: QuickRelogItem[] = behavioralItems.map(toQuickRelogItem);

  if (result.length < 3) {
    const existingNames = new Set(result.map((r) => r.name.toLowerCase()));
    for (const fav of favorites) {
      if (result.length >= maxItems) break;
      const favKey = (fav.name ?? '').trim().toLowerCase();
      if (favKey === '' || existingNames.has(favKey)) continue;
      existingNames.add(favKey);
      result.push({
        name: fav.name,
        calories: fav.calories,
        protein_g: fav.protein_g,
        carbs_g: fav.carbs_g,
        fat_g: fav.fat_g,
      });
    }
  }

  return result;
}

// ── helpers ──────────────────────────────────────────────

function toQuickRelogItem(s: ScoredMeal): QuickRelogItem {
  return {
    name: s.name,
    calories: s.calories,
    protein_g: s.protein_g,
    carbs_g: s.carbs_g,
    fat_g: s.fat_g,
  };
}

/** Pick the entry with the highest calorie count from a list. */
function pickHighestCalorie(entries: NutritionEntry[]): NutritionEntry {
  let best = entries[0];
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].calories > best.calories) {
      best = entries[i];
    }
  }
  return best;
}

/** Number of days between two YYYY-MM-DD strings (non-negative). */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Format a Date as YYYY-MM-DD. */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
