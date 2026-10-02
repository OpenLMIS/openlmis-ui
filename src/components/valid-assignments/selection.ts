import type { RowSelectionState } from '@tanstack/react-table';

/** Picked rows by id, with the name each showed, so rows on other pages can still be named. */
export type Picked = ReadonlyMap<string, string>;

export const toRowSelection = (picked: Picked): RowSelectionState =>
  Object.fromEntries([...picked.keys()].map((id) => [id, true]));

export function applySelection(
  picked: Picked,
  next: RowSelectionState,
  rows: readonly { id: string; name: string }[],
): Map<string, string> {
  const names = new Map(rows.map((row) => [row.id, row.name]));
  return new Map(Object.keys(next).map((id) => [id, picked.get(id) ?? names.get(id) ?? id]));
}

export const withoutIds = (picked: Picked, ids: readonly string[]) =>
  new Map([...picked].filter(([id]) => !ids.includes(id)));
