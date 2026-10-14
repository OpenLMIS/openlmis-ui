import type { TemplateColumn } from '@/features/requisition-templates/lib/types';

export function sortColumns(columnsMap: Record<string, TemplateColumn>) {
  return Object.values(columnsMap).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function movableRuns(rows: readonly TemplateColumn[]) {
  const runs: TemplateColumn[][] = [];
  let run: TemplateColumn[] = [];
  for (const row of rows) {
    if (row.columnDefinition.canChangeOrder) {
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
  rows: readonly TemplateColumn[],
  draggedKey: string,
  targetKey: string,
): Record<string, number> | null {
  const sorted = rows.toSorted((a, b) => a.displayOrder - b.displayOrder);
  const draggedIndex = sorted.findIndex((row) => row.columnDefinition.id === draggedKey);
  const targetIndex = sorted.findIndex((row) => row.columnDefinition.id === targetKey);
  const dragged = sorted[draggedIndex];
  const target = sorted[targetIndex];
  if (!dragged?.columnDefinition.canChangeOrder || !target?.columnDefinition.canChangeOrder)
    return null;
  const start = Math.min(draggedIndex, targetIndex);
  const end = Math.max(draggedIndex, targetIndex);
  if (sorted.slice(start, end + 1).some((row) => !row.columnDefinition.canChangeOrder)) return null;
  let min = 0;
  let max: number | undefined;
  for (const row of sorted.filter((row) => !row.columnDefinition.canChangeOrder)) {
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
      if (inArea(order) && row.columnDefinition.canChangeOrder) {
        if (row.columnDefinition.id === draggedKey) order = newOrder;
        else if (movingUp && order >= newOrder && order < dragged.displayOrder) order++;
        else if (order <= newOrder && order > dragged.displayOrder) order--;
      }
      return [row.columnDefinition.id, order];
    }),
  );
}
