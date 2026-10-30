import { compileColumns, SUBSET_COLUMNS } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

const clientFields = new Set([
  'template',
  'availableProducts',
  'availableFullSupplyProducts',
  'availableNonFullSupplyProducts',
  'stockAdjustmentReasons',
  'eTag',
  'useQuantityUnit',
  'quantityUnit',
  'idempotencyKey',
  'patientQuantitiesNotAvailable',
  'quantities',
]);
function withoutClientFields(value: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !key.startsWith('$') && !clientFields.has(key)),
  );
}

export function transformRequisition(
  record: RequisitionRecord,
  addedLineIds: readonly string[] = [],
) {
  const body = withoutClientFields(record);
  const displayed = new Set(
    compileColumns(record.template, {
      status: record.status,
      emergency: record.emergency,
      tab: 'fullSupply',
    }).map((column) => column.name),
  );
  return {
    ...body,
    program: { id: record.program.id },
    facility: { id: record.facility.id },
    requisitionLineItems: record.requisitionLineItems.map((line) => {
      const next = withoutClientFields(line);
      if (addedLineIds.includes(line.id)) delete next.id;
      for (const column of Object.values(record.template.columnsMap)) {
        if (column.name === 'numberOfPatientsOnTreatmentNextMonth') continue;
        if (record.emergency && !SUBSET_COLUMNS.has(column.name)) continue;
        if (!displayed.has(column.name) || column.source === 'CALCULATED') next[column.name] = null;
      }
      if (record.status === 'AUTHORIZED' || record.status === 'IN_APPROVAL')
        next.skipped = line.skipped;
      next.orderable = { id: line.orderable.id, versionNumber: line.orderable.versionNumber };
      return next;
    }),
  };
}
