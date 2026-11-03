import type { CatalogItem } from '@/features/cce-inventory/lib/types';

export const makeModelLabel = (item: CatalogItem) => `${item.manufacturer} ${item.model}`;

export function equipmentTypes(items: readonly CatalogItem[]) {
  return [...new Set(items.map((item) => item.type))].toSorted((a, b) => a.localeCompare(b));
}

export function modelsOfType(items: readonly CatalogItem[], type: string) {
  return items
    .filter((item) => item.type === type)
    .toSorted((a, b) => makeModelLabel(a).localeCompare(makeModelLabel(b)));
}
