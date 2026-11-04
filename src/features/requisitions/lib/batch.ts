import type { ParseKeys } from 'i18next';
import type {
  BatchLine,
  BatchQuantities,
  BatchRequisition,
  BatchResponse,
  BatchRow,
} from '@/features/requisitions/lib/batch-types';
import i18n from '@/integrations/i18n';
import { packsToShip } from '@/lib/quantity';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

export const batchIds = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  ),
];
export const batchLabel = (record: BatchRequisition) =>
  `${record.facilityName} - ${record.periodName}`;
export const batchText = (line: BatchLine, changes: Readonly<Record<string, string>> = {}) =>
  changes[line.id] ?? String(line.approvedQuantity ?? 0);
export function batchCost(line: BatchLine, text = batchText(line)) {
  const quantity = toWholeNumber(text);
  const { netContent, packRoundingThreshold, roundToZero } = line.orderable;
  if (!quantity || !Number.isFinite(quantity) || !netContent) return 0;
  return (
    packsToShip(
      quantity,
      netContent,
      packRoundingThreshold ?? Number.POSITIVE_INFINITY,
      roundToZero,
    ) * (line.pricePerPack ?? 0)
  );
}
export function batchRows(records: readonly BatchRequisition[]): BatchRow[] {
  const rows = new Map<string, BatchRow>();
  for (const record of records) {
    for (const line of record.requisitionLineItems) {
      let row = rows.get(line.orderable.id);
      if (!row) {
        row = { product: line.orderable, lines: new Map() };
        rows.set(line.orderable.id, row);
      }
      row.lines.set(record.id, line);
    }
  }
  return [...rows.values()];
}
export function batchTotals(
  records: readonly BatchRequisition[],
  quantities: BatchQuantities = {},
) {
  const perRecord = new Map<string, number>();
  let cost = 0;
  let quantity = 0;
  for (const record of records) {
    if (!batchApprovable(record)) {
      perRecord.set(record.id, 0);
      continue;
    }
    let total = 0;
    for (const line of record.requisitionLineItems) {
      const text = batchText(line, quantities[record.id]);
      const value = toWholeNumber(text);
      const q = Number.isFinite(value) ? value : 0;
      const c = batchCost(line, text);
      total += c;
      quantity += q;
    }
    perRecord.set(record.id, total);
    cost += total;
  }
  return { cost, quantity, perRecord };
}
const quantitySchema = wholeNumberText({
  required: 'stock-events.required',
  invalid: 'stock-events.positive-number',
  tooLarge: 'stock-events.number-too-large',
});
export function validateBatchQuantity(text: string): ParseKeys | undefined {
  const parsed = quantitySchema.safeParse(text);
  return parsed.success ? undefined : (parsed.error.issues[0]?.message as ParseKeys);
}
export function batchSaveBody(
  records: readonly BatchRequisition[],
  quantities: BatchQuantities = {},
) {
  return records.map((record) => ({
    id: record.id,
    modifiedDate: record.modifiedDate,
    requisitionLineItems: record.requisitionLineItems.map((line) => ({
      id: line.id,
      approvedQuantity: toWholeNumber(batchText(line, quantities[record.id])),
    })),
  }));
}
function batchErrorMessage(error: NonNullable<BatchResponse['requisitionErrors']>[number]) {
  if (error.errorMessage?.messageKey === 'requisitions.batch.no-longer-awaiting')
    return i18n.t('requisitions.batch.no-longer-awaiting');
  return (
    error.errorMessage?.message ??
    Object.values(error.fieldErrors ?? {})
      .map((e) => e.message)
      .filter(Boolean)
      .join('; ')
  );
}
export function parseBatchResult(response: BatchResponse, ids: readonly string[]) {
  const errors = new Map(
    response.requisitionErrors?.map((e) => [e.requisitionId, batchErrorMessage(e)]),
  );
  const returned = new Set(response.requisitionDtos?.map((r) => r.id));
  const succeeded = ids.filter((id) => returned.has(id) && !errors.has(id));
  const failed = new Map(
    ids
      .filter((id) => !succeeded.includes(id))
      .map((id) => [id, errors.get(id) || response.message || '']),
  );
  return { succeeded, failed };
}
export function orderBatch(response: BatchResponse, ids: readonly string[]) {
  const records = new Map(response.requisitionDtos?.map((r) => [r.id, r]));
  return {
    ...response,
    requisitionDtos: ids.flatMap((id) => {
      const r = records.get(id);
      return r ? [r] : [];
    }),
  };
}

export function batchRowTotals(
  row: BatchRow,
  quantities: BatchQuantities,
  records?: readonly BatchRequisition[],
) {
  let quantity = 0;
  let cost = 0;
  for (const [id, line] of row.lines) {
    if (records && !records.some((record) => record.id === id && batchApprovable(record))) continue;
    const text = batchText(line, quantities[id]);
    const value = toWholeNumber(text);
    quantity += Number.isFinite(value) ? value : 0;
    cost += batchCost(line, text);
  }
  return { quantity, cost };
}
export function lineInvalid(line: BatchLine, text: string) {
  return !line.skipped && validateBatchQuantity(text);
}
export function matchesBaseline(
  record: BatchRequisition | undefined,
  baseline: { baselineModifiedDate: string; baselineStatus: string },
) {
  return (
    !!record &&
    record.modifiedDate === baseline.baselineModifiedDate &&
    record.status === baseline.baselineStatus
  );
}

export const batchApprovable = (record: BatchRequisition) =>
  record.approvalAvailable !== false && ['AUTHORIZED', 'IN_APPROVAL'].includes(record.status);
