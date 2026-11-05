import { useStore } from '@tanstack/react-form';
import { useMemo } from 'react';
import type { GridEditing, GridModel } from '@/features/requisitions/components/requisition-grid';
import { calculateLine } from '@/features/requisitions/lib/calculations';
import { applyRequisitionDraft, buildRequisitionDraft } from '@/features/requisitions/lib/draft';
import { validateLine } from '@/features/requisitions/lib/validation';

export function useLiveGridLine(model: GridModel, editing: GridEditing) {
  const changes = useStore(
    editing.editor.form.store,
    (state) => state.values.draft.lines[model.line.id],
  );
  const showAll = useStore(editing.editor.form.store, (state) => state.values.showAllErrors);
  const calculation = editing.calculation;
  return useMemo(() => {
    if (!calculation) return { model, errors: undefined };
    const { record, months, patients } = calculation;
    const source = record.requisitionLineItems.find((line) => line.id === model.line.id);
    if (!source) return { model, errors: undefined };
    const current = applyRequisitionDraft(
      {
        ...record,
        requisitionLineItems: [
          { ...model.line, orderable: source.orderable, approvedProduct: source.approvedProduct },
        ],
      },
      { ...buildRequisitionDraft(record), lines: { [model.line.id]: changes ?? {} } },
      patients,
    );
    const next = { ...model, line: current.requisitionLineItems[0] ?? model.line };
    const line = calculateLine(next, current, months, patients);
    const errors =
      changes || showAll
        ? validateLine(next, current, months, changes, editing.editableColumns, patients, line)
        : {};
    return { model: { ...next, line }, errors: Object.keys(errors).length ? errors : undefined };
  }, [model, changes, showAll, calculation, editing.editableColumns]);
}
