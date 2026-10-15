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
  if (!inArea(target.displayOrder)) return null;
  const run = sorted.filter((row) => row.canChangeOrder && inArea(row.displayOrder));
  const from = run.indexOf(dragged);
  const to = run.indexOf(target);
  const moved = run.toSpliced(from, 1).toSpliced(to, 0, dragged);
  const orders: Record<string, number> = {};
  let previous = Number.NEGATIVE_INFINITY;
  moved.forEach((row, index) => {
    previous = Math.max(run[index].displayOrder, previous + 1);
    orders[row.id] = previous;
  });
  if (max !== undefined && previous >= max) return null;
  return Object.fromEntries(sorted.map((row) => [row.id, orders[row.id] ?? row.displayOrder]));
}
