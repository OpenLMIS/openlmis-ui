import type { DraftNode } from '@/features/supervisory-nodes/lib/node-form';

export function visibleSavedIds(
  rows: readonly DraftNode[],
  page: number,
  size: number,
  savedIds: ReadonlySet<string>,
) {
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(rows.length / size)));
  return [
    ...new Set(
      rows
        .slice((visiblePage - 1) * size, visiblePage * size)
        .filter(({ id }) => savedIds.has(id))
        .map(({ id }) => id),
    ),
  ].sort();
}
