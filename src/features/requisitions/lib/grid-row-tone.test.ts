import { expect, it } from 'vitest';
import { line, record } from '@/features/requisitions/lib/fixtures/builders';
import { gridRowTone } from '@/features/requisitions/lib/grid-row-tone';
import { buildLines } from '@/features/requisitions/lib/lines';

it('treats missing supplying stock as zero once supplying stock is available and prioritizes skipped rows', () => {
  const model = buildLines(
    record({ requisitionLineItems: [line({ approvedQuantity: 5 })] }),
    [],
  )[0];
  expect(model).toBeDefined();
  if (!model) throw new Error('Missing fixture line');
  const row = { id: model.line.id, model };
  expect(gridRowTone(row, true)).toBe('shortfall');
  expect(gridRowTone(row, false)).toBeUndefined();
  model.line.supplyingFacilityStockOnHand = 5;
  expect(gridRowTone(row, true)).toBeUndefined();
  model.line.supplyingFacilityStockOnHand = 4;
  expect(gridRowTone(row, true)).toBe('shortfall');
  model.line.skipped = true;
  expect(gridRowTone(row, true)).toBe('skipped');
});
