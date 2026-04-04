import { cacheFoodItem, cacheFoodItems, searchCachedFoods, getCachedFoods } from '../../services/offlineFoodCache';
import { mmkv } from '../../services/mmkvStorage';
import type { FoodItem } from '../../types/nutrition';

const makeFoodItem = (id: string, name = `Food ${id}`): FoodItem =>
  ({ id, name, calories: 100, protein_g: 10, carbs_g: 20, fat_g: 5, serving_size: 100, serving_unit: 'g' } as FoodItem);

beforeEach(() => {
  mmkv.delete('offline_recent_foods');
});

describe('offlineFoodCache', () => {
  it('cacheFoodItem adds item to cache', () => {
    cacheFoodItem(makeFoodItem('1'));
    const foods = getCachedFoods();
    expect(foods).toHaveLength(1);
    expect(foods[0].id).toBe('1');
  });

  it('cacheFoodItem deduplicates by id', () => {
    cacheFoodItem(makeFoodItem('1', 'Old'));
    cacheFoodItem(makeFoodItem('1', 'New'));
    const foods = getCachedFoods();
    expect(foods).toHaveLength(1);
    expect(foods[0].name).toBe('New');
  });

  it('cacheFoodItems deduplicates across new and existing', () => {
    cacheFoodItem(makeFoodItem('1'));
    cacheFoodItems([makeFoodItem('1'), makeFoodItem('2')]);
    const foods = getCachedFoods();
    expect(foods).toHaveLength(2);
  });

  it('searchCachedFoods filters by name', () => {
    cacheFoodItems([makeFoodItem('1', 'Chicken Breast'), makeFoodItem('2', 'Rice')]);
    expect(searchCachedFoods('chicken')).toHaveLength(1);
    expect(searchCachedFoods('chicken')[0].name).toBe('Chicken Breast');
  });

  it('searchCachedFoods with empty query returns up to 20', () => {
    expect(searchCachedFoods('')).toEqual(getCachedFoods().slice(0, 20));
  });

  it('cache respects max size of 200', () => {
    const items = Array.from({ length: 210 }, (_, i) => makeFoodItem(`${i}`));
    cacheFoodItems(items);
    expect(getCachedFoods()).toHaveLength(200);
  });

  it('getCachedFoods returns empty array on parse error', () => {
    mmkv.set('offline_recent_foods', '{invalid json');
    expect(getCachedFoods()).toEqual([]);
  });
});
