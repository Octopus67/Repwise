import { mmkv } from './mmkvStorage';
import type { FoodItem } from '../types/nutrition';

const RECENT_FOODS_KEY = 'offline_recent_foods';
const MAX_CACHED_FOODS = 200;

export function getCachedFoods(): FoodItem[] {
  const data = mmkv.getString(RECENT_FOODS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('[offlineFoodCache] Failed to parse cached foods:', e);
    return [];
  }
}

export function cacheFoodItem(item: FoodItem) {
  const foods = getCachedFoods();
  const filtered = foods.filter((f) => f.id !== item.id);
  filtered.unshift(item);
  const trimmed = filtered.slice(0, MAX_CACHED_FOODS);
  mmkv.set(RECENT_FOODS_KEY, JSON.stringify(trimmed));
}

export function cacheFoodItems(items: FoodItem[]) {
  if (items.length === 0) return;
  const foods = getCachedFoods();
  const seen = new Set<string>();
  const merged: FoodItem[] = [];
  for (const item of [...items, ...foods]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  mmkv.set(RECENT_FOODS_KEY, JSON.stringify(merged.slice(0, MAX_CACHED_FOODS)));
}

export function searchCachedFoods(query: string): FoodItem[] {
  if (!query.trim()) return getCachedFoods().slice(0, 20);
  const lower = query.toLowerCase();
  return getCachedFoods().filter((f) =>
    f.name?.toLowerCase().includes(lower)
  ).slice(0, 20);
}