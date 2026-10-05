import type { RowSelectionState } from '@tanstack/react-table';
import { useCallback, useState } from 'react';

export type Picked = ReadonlyMap<string, string>;

export const NOTHING_PICKED: Picked = new Map();

export const toRowSelection = (picked: Picked): RowSelectionState =>
  Object.fromEntries([...picked.keys()].map((id) => [id, true]));

export function applySelection(
  picked: Picked,
  next: RowSelectionState,
  rows: readonly { id: string; rowName: string }[],
): Picked {
  const names = new Map(rows.map((row) => [row.id, row.rowName]));
  return new Map(Object.keys(next).map((id) => [id, names.get(id) ?? picked.get(id) ?? id]));
}

export const withoutIds = (picked: Picked, ids: readonly string[]): Picked =>
  new Map([...picked].filter(([id]) => !ids.includes(id)));

export function useFilterScoped<T>(filterKey: string, empty: T) {
  const [scoped, setScoped] = useState({ filterKey, value: empty });
  if (scoped.filterKey !== filterKey) setScoped({ filterKey, value: empty });

  const set = useCallback(
    (next: T, rowsFilterKey: string) => {
      if (rowsFilterKey === filterKey) setScoped({ filterKey, value: next });
    },
    [filterKey],
  );
  return [scoped.value, set] as const;
}
