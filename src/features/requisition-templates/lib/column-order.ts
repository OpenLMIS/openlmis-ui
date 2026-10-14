import type { TemplateColumn } from '@/features/requisition-templates/lib/types';

export function sortColumns(columnsMap: Record<string, TemplateColumn>) {
  return Object.values(columnsMap).sort((a, b) => a.displayOrder - b.displayOrder);
}

export type OrderColumn = { id: string; canChangeOrder: boolean; displayOrder: number };

export function movableRuns<T extends OrderColumn>(rows: readonly T[]) {
  const runs: T[][] = [];
  let run: T[] = [];
  for (const row of rows) {
    if (row.canChangeOrder) {
      run.push(row);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

export function moveColumn(
  rows: readonly OrderColumn[],
  draggedKey: string,
  targetKey: string,
): Record<string, number> | null {
  const sorted = rows.toSorted((a, b) => a.displayOrder - b.displayOrder);
  const draggedIndex = sorted.findIndex((row) => row.id === draggedKey);
  const targetIndex = sorted.findIndex((row) => row.id === targetKey);
  const dragged = sorted[draggedIndex];
  const target = sorted[targetIndex];
  if (!dragged?.canChangeOrder || !target?.canChangeOrder) return null;
  const start = Math.min(draggedIndex, targetIndex);
  const end = Math.max(draggedIndex, targetIndex);
  if (sorted.slice(start, end + 1).some((row) => !row.canChangeOrder)) return null;
  let min = 0;
  let max: number | undefined;
  for (const row of sorted.filter((row) => !row.canChangeOrder)) {
    if (dragged.displayOrder > row.displayOrder) min = row.displayOrder;
    if (!max && dragged.displayOrder < row.displayOrder) max = row.displayOrder;
  }
  const upper = max || 999999999999999;
  const inArea = (order: number) => order > min && order < upper;
  const newOrder = target.displayOrder;
  if (!inArea(newOrder)) return null;
  const movingUp = draggedIndex > targetIndex;
  return Object.fromEntries(
    sorted.map((row) => {
      let order = row.displayOrder;
      if (inArea(order) && row.canChangeOrder) {
        if (row.id === draggedKey) order = newOrder;
        else if (movingUp && order >= newOrder && order < dragged.displayOrder) order++;
        else if (order <= newOrder && order > dragged.displayOrder) order--;
      }
      return [row.id, order];
    }),
  );
}
