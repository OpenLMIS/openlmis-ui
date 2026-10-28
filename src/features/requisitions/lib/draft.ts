import type {
  RequisitionLineItem,
  RequisitionTemplate,
} from '@/features/requisitions/lib/requisition';
import { type ColumnContext, compileColumns } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { toLatinDigits, toOptionalWholeNumber } from '@/lib/whole-number';

type EditableLine = Omit<RequisitionLineItem, 'id' | 'orderable' | 'approvedProduct'>;
export type LineDraft = {
  [K in keyof EditableLine]?: NonNullable<RequisitionLineItem[K]> extends number
    ? RequisitionLineItem[K] | string
    : RequisitionLineItem[K];
};
export type RequisitionDraft = {
  lines: Record<string, LineDraft>;
  addedLines: RequisitionRecord['requisitionLineItems'][number][];
  removedLineIds: string[];
  draftStatusMessage: string;
  datePhysicalStockCountCompleted: string | null;
};
export function buildRequisitionDraft(record: RequisitionRecord): RequisitionDraft {
  return {
    lines: {},
    addedLines: [],
    removedLineIds: [],
    draftStatusMessage: record.draftStatusMessage ?? '',
    datePhysicalStockCountCompleted: record.datePhysicalStockCountCompleted ?? null,
  };
}
function editableChanges(record: RequisitionRecord, changes: LineDraft) {
  return Object.fromEntries(
    Object.entries(changes).filter(
      ([key]) =>
        key === 'skipped' ||
        (key === 'stockAdjustments' && !record.template.populateStockOnHandFromStockCards) ||
        record.template.columnsMap[key]?.source === 'USER_INPUT',
    ),
  ) as LineDraft;
}
function normalizedChanges(record: RequisitionRecord, changes: LineDraft) {
  return Object.fromEntries(
    Object.entries(editableChanges(record, changes)).map(([key, value]) => {
      const type = record.template.columnsMap[key]?.columnDefinition?.columnType;
      const numeric =
        type === 'NUMERIC' ||
        type === 'CURRENCY' ||
        (type !== 'TEXT' &&
          !['requestedQuantityExplanation', 'remarks', 'remarksForTBDispensedQuantity'].includes(
            key,
          ));
      return [key, numeric && typeof value === 'string' ? toOptionalWholeNumber(value) : value];
    }),
  ) as Partial<EditableLine>;
}
export function rebaseRequisitionDraft(
  record: RequisitionRecord,
  draft: RequisitionDraft,
): RequisitionDraft {
  const saved = new Map(record.requisitionLineItems.map((line) => [line.id, line]));
  const removed = new Set(draft.removedLineIds);
  const addedLines = draft.addedLines.filter(
    (line) => !saved.has(line.id) && !removed.has(line.id),
  );
  const available = new Map([...saved, ...addedLines.map((line) => [line.id, line] as const)]);
  const lines = Object.fromEntries(
    Object.entries(draft.lines).flatMap(([id, values]) => {
      const base = available.get(id);
      if (!base) return [];
      const editable = editableChanges(record, values);
      const normalized = normalizedChanges(record, editable);
      const changed = Object.fromEntries(
        Object.entries(editable).filter(([key]) => {
          const value = normalized[key as keyof EditableLine] ?? null;
          const savedValue = base[key as keyof RequisitionLineItem] ?? null;
          return Array.isArray(value)
            ? JSON.stringify(value) !== JSON.stringify(savedValue)
            : !Object.is(value, savedValue);
        }),
      );
      return Object.keys(changed).length ? [[id, changed]] : [];
    }),
  );
  return {
    ...draft,
    lines,
    addedLines,
    removedLineIds: draft.removedLineIds.filter((id) => saved.has(id)),
  };
}
export function applyRequisitionDraft(
  record: RequisitionRecord,
  draft: RequisitionDraft,
): RequisitionRecord {
  const current = rebaseRequisitionDraft(record, draft);
  const removed = new Set(current.removedLineIds);
  return {
    ...record,
    draftStatusMessage: current.draftStatusMessage,
    datePhysicalStockCountCompleted: current.datePhysicalStockCountCompleted,
    requisitionLineItems: [...record.requisitionLineItems, ...current.addedLines]
      .filter((line) => !removed.has(line.id))
      .map((line) => ({ ...line, ...normalizedChanges(record, current.lines[line.id] ?? {}) })),
  };
}
export function canSkipLine(
  line: LineDraft,
  template: RequisitionTemplate,
  context: ColumnContext,
) {
  return compileColumns(template, context).every(({ name }) => {
    const column = template.columnsMap[name];
    if (!column) return true;
    if (
      !column.isDisplayed ||
      column.source !== 'USER_INPUT' ||
      column.name === 'skipped' ||
      column.columnDefinition?.columnType === 'BOOLEAN'
    )
      return true;
    const value = line[column.name as keyof LineDraft];
    const numericZero =
      column.columnDefinition?.columnType === 'NUMERIC' &&
      typeof value === 'string' &&
      /^0+$/.test(toLatinDigits(value.trim()));
    return (
      value == null || value === 0 || numericZero || (typeof value === 'string' && !value.trim())
    );
  });
}
export const canRemoveLine = (fullSupply: boolean, editable: boolean) => editable && !fullSupply;
