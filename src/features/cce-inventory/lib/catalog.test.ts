import { expect, it } from 'vitest';
import { equipmentTypes, makeModelLabel, modelsOfType } from '@/features/cce-inventory/lib/catalog';
import type { CatalogItem } from '@/features/cce-inventory/lib/types';

const item = (id: string, type: string, manufacturer: string, model: string): CatalogItem => ({
  id,
  type,
  manufacturer,
  model,
  energySource: 'ELECTRIC',
});

const CATALOG = [
  item('1', 'Walk-in freezer', 'Zanotti', 'WF-1'),
  item('2', 'Freezer', 'Vestfrost', 'A-1'),
  item('3', 'Freezer', 'Haier', 'Z-1'),
  item('4', 'Refrigerator', 'B Medical', 'TCW 40R'),
];

it('offers each equipment type once, sorted', () => {
  expect(equipmentTypes(CATALOG)).toEqual(['Freezer', 'Refrigerator', 'Walk-in freezer']);
});

it('offers only the models of exactly the chosen type, sorted by make and model', () => {
  expect(modelsOfType(CATALOG, 'Freezer').map(makeModelLabel)).toEqual([
    'Haier Z-1',
    'Vestfrost A-1',
  ]);
  expect(modelsOfType(CATALOG, 'freezer')).toEqual([]);
});
