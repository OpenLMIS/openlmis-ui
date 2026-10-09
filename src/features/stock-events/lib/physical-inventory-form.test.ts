import { describe, expect, it } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import {
  inventoryCountSchema,
  inventoryLineError,
  inventoryReasonSchema,
  inventorySavePayload,
  inventorySubmitPayload,
  unaccounted,
  validateInventory,
} from '@/features/stock-events/lib/physical-inventory-form';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';

const product = { id: 'p', productCode: 'P', fullProductName: 'Product', description: null };
const line = () =>
  buildInventoryLines(
    [{ orderable: product, lot: null, stockOnHand: 10, stockCardId: 'c', active: true }],
    [],
  )[0];
const draft = { id: 'draft', facilityId: 'f', programId: 'program', lineItems: [] };
const reason = (reasonType: string, quantity: number) => ({
  reason: { id: reasonType, name: reasonType, reasonType },
  quantity,
});

describe('inventory counts and differences', () => {
  it('requires counts for an inactive card with stock and a stockless saved member', () => {
    expect(validateInventory([{ ...line(), active: false }], []).kind).toBe('invalid');
    expect(
      validateInventory(
        [{ ...line(), active: undefined, stockOnHand: null, stockCardId: null, isAdded: true }],
        [],
      ).kind,
    ).toBe('invalid');
  });
  it.each(['0', '2147483647', '٠'])('accepts a whole count %s', (value) =>
    expect(inventoryCountSchema.safeParse(value).success).toBe(true),
  );
  it.each(['', '-1', '1.5', '2147483648'])('refuses an invalid count %s', (value) =>
    expect(inventoryCountSchema.safeParse(value).success).toBe(false),
  );
  it('subtracts credits and adds debits, treating missing stock as zero', () => {
    expect(
      unaccounted({
        ...line(),
        quantity: quantityValue('12'),
        stockAdjustments: [reason('CREDIT', 4), reason('DEBIT', 2)],
      }),
    ).toBe(0);
    expect(unaccounted({ ...line(), stockOnHand: null, quantity: quantityValue('0') })).toBe(0);
    expect(unaccounted(line())).toBe(-10);
  });
  it('reports a missing count before an unaccounted difference', () => {
    expect(inventoryLineError(line())).toBe('stock-events.required');
    expect(inventoryLineError({ ...line(), quantity: quantityValue('9') })).toBe(
      'physical-inventory.unaccounted-error',
    );
  });
  it('requires positive reason quantities and refuses balance adjustments', () => {
    expect(inventoryReasonSchema.safeParse(reason('CREDIT', 0)).success).toBe(false);
    expect(inventoryReasonSchema.safeParse(reason('BALANCE_ADJUSTMENT', 1)).success).toBe(false);
    expect(inventoryReasonSchema.safeParse(reason('DEBIT', 1)).success).toBe(true);
  });
  it('checks the displayed inactive-zero rule before other validation and validates hidden lines', () => {
    const inactive = { ...line(), active: false, stockOnHand: 0 };
    expect(validateInventory([line(), inactive], [inactive]).kind).toBe('inactive');
    expect(validateInventory([line()], []).kind).toBe('invalid');
    expect(validateInventory([inactive], []).kind).toBe('valid');
  });
});

describe('inventory payloads', () => {
  it('saves member lines, marks blanks -1 and falls back to placeholders for an empty draft', () => {
    expect(inventorySavePayload(draft, [line()], []).lineItems[0]).toMatchObject({
      orderableId: 'p',
      lotId: null,
      quantity: -1,
    });
    const placeholders = [{ orderable: product, lot: null, stockOnHand: null }];
    expect(inventorySavePayload(draft, [], placeholders).lineItems[0]).toEqual({
      orderableId: 'p',
      lotId: null,
    });
  });
  it('submits the resource id, inactive blanks as zero and reasons by id', () => {
    const counted = {
      ...line(),
      quantity: quantityValue('12'),
      stockAdjustments: [reason('CREDIT', 2)],
    };
    const payload = inventorySubmitPayload(
      draft,
      [counted, { ...line(), active: false, quantity: quantityValue() }],
      '2026-10-09',
      'Signed',
    );
    expect(payload).toMatchObject({
      resourceId: 'draft',
      facilityId: 'f',
      programId: 'program',
      signature: 'Signed',
    });
    expect(payload.lineItems[0]).toMatchObject({
      quantity: 12,
      occurredDate: '2026-10-09',
      stockAdjustments: [{ reasonId: 'CREDIT', quantity: 2 }],
    });
    expect(payload.lineItems[1].quantity).toBe(0);
    expect(payload.lineItems[0]).not.toHaveProperty('justAdded');
  });
});

it('skips all validation for inactive zero-stock lines hidden by the inactive filter', () => {
  const hidden = { ...line(), active: false, stockOnHand: 0, quantity: quantityValue('3') };
  expect(validateInventory([hidden], []).kind).toBe('valid');
  expect(validateInventory([hidden, line()], []).kind).toBe('invalid');
  expect(inventorySubmitPayload(draft, [hidden], '2026-10-09', '').lineItems[0].quantity).toBe(3);
});

it('validates a counted inactive line hidden only by Keywords when inactive items are included', () => {
  const hidden = { ...line(), active: false, stockOnHand: 0, quantity: quantityValue('3') };
  expect(validateInventory([hidden], [], true).kind).toBe('invalid');
});
