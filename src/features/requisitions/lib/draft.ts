import {
  applyPatientChanges,
  type PatientChanges,
  type PatientsData,
  parsePatients,
  rebasePatientChanges,
  writePatients,
} from '@/features/requisitions/lib/patients';
import type {
  RequisitionLineItem,
  RequisitionTemplate,
} from '@/features/requisitions/lib/requisition';
import { type ColumnContext, compileColumns } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { MAX_WHOLE_NUMBER, toLatinDigits, toOptionalWholeNumber } from '@/lib/whole-number';

type EditableLine = Omit<RequisitionLineItem, 'id' | 'orderable' | 'approvedProduct'>;
export type LineDraft = {
  [K in keyof EditableLine]?: NonNullable<RequisitionLineItem[K]> extends number
    ? RequisitionLineItem[K] | string
    : RequisitionLineItem[K];
};
export type RequisitionDraft = {
  patients?: PatientChanges | null;
  lines: Record<string, LineDraft>;
  addedLines: RequisitionRecord['requisitionLineItems'][number][];
  removedLineIds: string[];
  draftStatusMessage: string;
  datePhysicalStockCountCompleted: string | null;
};
export function buildRequisitionDraft(record: RequisitionRecord): RequisitionDraft {
  return {
    patients: null,
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
        (record.template.patientsTabEnabled &&
          ['AUTHORIZED', 'IN_APPROVAL'].includes(record.status) &&
          key === 'numberOfPatientsOnTreatmentNextMonth') ||
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
      if (!numeric || typeof value !== 'string') return [key, value];
      const parsed = toOptionalWholeNumber(value);
      return [
        key,
        parsed !== null &&
        Number.isInteger(parsed) &&
        Math.abs(parsed) <= MAX_WHOLE_NUMBER &&
        /^-?[0-9]+$/.test(toLatinDigits(value.trim()))
          ? parsed
          : null,
      ];
    }),
  ) as Partial<EditableLine>;
}
export function rebaseRequisitionDraft(
  record: RequisitionRecord,
  draft: RequisitionDraft,
  patients = parsePatients(record.patientsData),
): RequisitionDraft {
  const saved = new Map(record.requisitionLineItems.map((line) => [line.id, line]));
  const removed = new Set(draft.removedLineIds);
  const savedProducts = new Set(
    record.requisitionLineItems
      .filter((line) => !removed.has(line.id))
      .map((line) => line.orderable.id),
  );
  const addedLines = draft.addedLines.filter(
    (line) => !savedProducts.has(line.orderable.id) && !removed.has(line.id),
  );
  const available = new Map([...saved, ...addedLines.map((line) => [line.id, line] as const)]);
  const lines = Object.fromEntries(
    Object.entries(draft.lines).flatMap(([id, values]) => {
      const base = available.get(id);
      if (!base) return [];
      const editable = editableChanges(record, values);
      const normalized = normalizedChanges(record, editable);
      const changed = Object.fromEntries(
        Object.entries(editable).filter(([key, raw]) => {
          const value = normalized[key as keyof EditableLine] ?? null;
          if (value === null && typeof raw === 'string' && raw.trim()) return true;
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
    patients: rebasePatientChanges(patients, draft.patients),
    lines,
    addedLines,
    removedLineIds: draft.removedLineIds.filter((id) => saved.has(id)),
    draftStatusMessage: draft.draftStatusMessage,
    datePhysicalStockCountCompleted: draft.datePhysicalStockCountCompleted,
  };
}
export function applyRequisitionDraft(
  record: RequisitionRecord,
  draft: RequisitionDraft,
  patients?: PatientsData,
): RequisitionRecord {
  const basePatients = patients ?? parsePatients(record.patientsData);
  const current = rebaseRequisitionDraft(record, draft, basePatients);
  const removed = new Set(current.removedLineIds);
  return {
    ...record,
    patientsData:
      current.patients && !basePatients.unreadable
        ? writePatients(applyPatientChanges(basePatients, current.patients))
        : record.patientsData,
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
