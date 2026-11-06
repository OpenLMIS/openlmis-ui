import type { CatalogItem } from '@/features/cce-inventory/lib/types';

export const makeModelLabel = (item: Pick<CatalogItem, 'manufacturer' | 'model'>) =>
  `${item.manufacturer} ${item.model}`;

export function equipmentTypes(items: readonly CatalogItem[]) {
  return [...new Set(items.map((item) => item.type))].toSorted((a, b) => a.localeCompare(b));
}

export function soleItem<T>(items: readonly T[]): T | null {
  const [only, ...others] = items;
  return only !== undefined && others.length === 0 ? only : null;
}

export function modelsOfType(items: readonly CatalogItem[], type: string) {
  return items
    .filter((item) => item.type === type)
    .toSorted((a, b) => makeModelLabel(a).localeCompare(makeModelLabel(b)));
}

export function soleModelId(items: readonly CatalogItem[], type: string | null) {
  return type ? (soleItem(modelsOfType(items, type))?.id ?? null) : null;
}
