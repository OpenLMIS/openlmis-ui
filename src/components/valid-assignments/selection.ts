import type { RowSelectionState } from '@tanstack/react-table';
import { useState } from 'react';

/** Picked rows by id, with the name each showed, so rows on other pages can still be named. */
export type Picked = ReadonlyMap<string, string>;

export const NOTHING_PICKED: Picked = new Map();

export const toRowSelection = (picked: Picked): RowSelectionState =>
  Object.fromEntries([...picked.keys()].map((id) => [id, true]));

export function applySelection(
  picked: Picked,
  next: RowSelectionState,
  rows: readonly { id: string; label: string }[],
): Picked {
  const names = new Map(rows.map((row) => [row.id, row.label]));
  return new Map(Object.keys(next).map((id) => [id, picked.get(id) ?? names.get(id) ?? id]));
}

export const withoutIds = (picked: Picked, ids: readonly string[]): Picked =>
  new Map([...picked].filter(([id]) => !ids.includes(id)));

/** A selection that a new filter clears, and that rows from any other filter cannot change. */
export function useFilterSelection(filterKey: string) {
  const [selection, setSelection] = useState({ filterKey, picked: NOTHING_PICKED });
  if (selection.filterKey !== filterKey) setSelection({ filterKey, picked: NOTHING_PICKED });

  const picked = selection.filterKey === filterKey ? selection.picked : NOTHING_PICKED;
  const setPicked = (next: Picked, rowsFilterKey: string) => {
    if (rowsFilterKey === filterKey) setSelection({ filterKey, picked: next });
  };
  return [picked, setPicked] as const;
}
