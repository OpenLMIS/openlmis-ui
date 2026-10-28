import type {
  RequisitionLineItem,
  RequisitionTemplate,
} from '@/features/requisitions/lib/requisition';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { toLatinDigits, toOptionalWholeNumber } from '@/lib/whole-number';

export type LineDraft = {
  [K in keyof RequisitionLineItem]?: NonNullable<RequisitionLineItem[K]> extends number
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
    lines: Object.fromEntries(
      record.requisitionLineItems.map((line) => [line.id, structuredClone(line)]),
    ),
    addedLines: [],
    removedLineIds: [],
    draftStatusMessage: record.draftStatusMessage ?? '',
    datePhysicalStockCountCompleted: record.datePhysicalStockCountCompleted ?? null,
  };
}
export function applyRequisitionDraft(
  record: RequisitionRecord,
  draft: RequisitionDraft,
): RequisitionRecord {
  const removed = new Set(draft.removedLineIds);
  return {
    ...record,
    draftStatusMessage: draft.draftStatusMessage,
    datePhysicalStockCountCompleted: draft.datePhysicalStockCountCompleted,
    requisitionLineItems: [...record.requisitionLineItems, ...draft.addedLines]
      .filter((line) => !removed.has(line.id))
      .map((line) => {
        const changes = Object.fromEntries(
          Object.entries(draft.lines[line.id] ?? {}).map(([key, value]) => {
            const type = record.template.columnsMap[key]?.columnDefinition?.columnType;
            const numeric =
              type === 'NUMERIC' ||
              type === 'CURRENCY' ||
              (key !== 'id' &&
                key !== 'requestedQuantityExplanation' &&
                key !== 'remarks' &&
                key !== 'remarksForTBDispensedQuantity' &&
                typeof value === 'string');
            return [
              key,
              numeric && typeof value === 'string' ? toOptionalWholeNumber(value) : value,
            ];
          }),
        );
        return { ...line, ...changes };
      }),
  };
}
export function canSkipLine(line: LineDraft, template: RequisitionTemplate) {
  return Object.values(template.columnsMap).every((column) => {
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
