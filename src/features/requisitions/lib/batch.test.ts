import { describe, expect, it } from 'vitest';
import {
  batchCost,
  batchRows,
  batchSaveBody,
  batchTotals,
  orderBatch,
  parseBatchResult,
  validateBatchQuantity,
} from '@/features/requisitions/lib/batch';
import arv from '@/features/requisitions/lib/fixtures/batch/retrieveall-arv.json';
import fp from '@/features/requisitions/lib/fixtures/batch/retrieveall-fp.json';

describe('legacy batch calculations', () => {
  it('matches the captured ARV line costs, including rounded packs, and FP totals', () => {
    for (const record of arv.requisitionDtos)
      for (const line of record.requisitionLineItems)
        expect(batchCost(line, String(line.approvedQuantity))).toBeCloseTo(line.totalCost);
    expect(batchTotals(fp.requisitionDtos).cost).toBeCloseTo(99495.54);
    expect(batchTotals(fp.requisitionDtos).quantity).toBe(5295);
  });
  it('preserves first appearance and URL order with absent products', () => {
    const ids = fp.requisitionDtos.map((r) => r.id).reverse();
    const records = orderBatch(fp, ids).requisitionDtos;
    expect(records.map((r) => r.id)).toEqual(ids);
    const rows = batchRows(records);
    expect(rows[0].product.productCode).toBe('C600');
    expect(rows.find((r) => r.product.productCode === 'C400')?.lines.size).toBe(1);
  });
  it('includes skipped lines, treats null/empty as zero and does not default a missing threshold', () => {
    const line = {
      ...arv.requisitionDtos[0].requisitionLineItems[0],
      skipped: true,
      approvedQuantity: 15,
      orderable: {
        ...arv.requisitionDtos[0].requisitionLineItems[0].orderable,
        netContent: 10,
        packRoundingThreshold: undefined,
      },
    };
    expect(batchCost(line, '15')).toBe(50.35);
    expect(batchCost(line, '')).toBe(0);
    expect(batchTotals([{ ...arv.requisitionDtos[0], requisitionLineItems: [line] }]).cost).toBe(
      50.35,
    );
    expect(batchSaveBody(fp.requisitionDtos)[0]).toEqual({
      id: fp.requisitionDtos[0].id,
      modifiedDate: fp.requisitionDtos[0].modifiedDate,
      requisitionLineItems: fp.requisitionDtos[0].requisitionLineItems.map((l) => ({
        id: l.id,
        approvedQuantity: 0,
      })),
    });
  });
  it('validates required Java integers while accepting Arabic digits', () => {
    expect(validateBatchQuantity('')).toBe('stock-events.required');
    expect(validateBatchQuantity('2147483648')).toBe('stock-events.number-too-large');
    expect(validateBatchQuantity('-1')).toBeTruthy();
    expect(validateBatchQuantity('٢٤')).toBeUndefined();
  });
});
describe('batch results', () => {
  const records = fp.requisitionDtos;
  const ids = records.map((r) => r.id);
  it('requires explicit success and preserves field error reasons and missing ids', () => {
    const result = parseBatchResult(
      {
        requisitionDtos: [records[0]],
        requisitionErrors: [
          {
            requisitionId: ids[1],
            errorMessage: null,
            fieldErrors: { line: { message: 'Invalid line' } },
          },
        ],
      },
      ids,
    );
    expect(result.succeeded).toEqual([ids[0]]);
    expect(result.failed.get(ids[1])).toBe('Invalid line');
    expect(result.failed.has(ids[2])).toBe(true);
    expect(parseBatchResult({ message: 'Period has not ended' }, ids).succeeded).toEqual([]);
    expect(parseBatchResult(fp, ids).succeeded).toEqual(ids);
    expect(parseBatchResult({ requisitionDtos: [], requisitionErrors: [] }, ids).failed.size).toBe(
      3,
    );
  });
});
