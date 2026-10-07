import { describe, expect, it } from 'vitest';
import {
  documentNumbers,
  namedWithFreeText,
  reasonLabel,
  stockCardProductName,
  toCardLines,
} from '@/features/stock-card/lib/card-lines';
import type { StockCardLine } from '@/features/stock-card/lib/types';

const line = (id: string, overrides: Partial<StockCardLine> = {}): StockCardLine => ({
  id,
  occurredDate: '2026-01-01',
  quantity: 10,
  stockOnHand: 30,
  ...overrides,
});

const reason = (name: string, reasonType = 'CREDIT', reasonCategory = 'ADJUSTMENT') => ({
  name,
  reasonType,
  reasonCategory,
});

describe('toCardLines', () => {
  it('reverses server order without sorting by date or changing the input', () => {
    const lines = [line('a'), line('b', { occurredDate: '2025-01-01' }), line('c')];
    expect(toCardLines(lines).map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(lines.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('splits physical inventory in reverse adjustment order with legacy balances', () => {
    const inventory = line('inventory', {
      stockOnHand: 35,
      signature: 'Signed',
      documentNumber: 'PI-1',
      stockAdjustments: [
        { reason: reason('Loss', 'DEBIT'), quantity: 10 },
        { reason: reason('Damage', 'DEBIT'), quantity: 5 },
        { reason: reason('Found'), quantity: 20 },
      ],
    });
    const input = [line('older'), inventory];
    const original = structuredClone(input);
    const result = toCardLines(input);
    expect(
      result.map(({ quantity, stockOnHand, reason }) => [quantity, stockOnHand, reason?.name]),
    ).toEqual([
      [20, 35, 'Found'],
      [5, 15, 'Damage'],
      [10, 20, 'Loss'],
      [10, 30, undefined],
    ]);
    expect(result.slice(0, 3)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signature: 'Signed', documentNumber: 'PI-1' }),
      ]),
    );
    expect(input).toEqual(original);
    expect(new Set(result.map((row) => row.rowId)).size).toBe(4);
  });

  it('keeps inventory without adjustments and ordinary transactions unchanged', () => {
    const inventory = line('inventory', { physicalInventory: true, stockAdjustments: [] });
    const ordinary = line('ordinary', {
      physicalInventory: false,
    });
    expect(toCardLines([inventory, ordinary])).toMatchObject([ordinary, inventory]);
    expect(toCardLines([])).toEqual([]);
  });
});

describe('stock card labels', () => {
  it('names sources and destinations only when an object exists', () => {
    expect(namedWithFreeText(null, 'Elsewhere')).toBe('');
    expect(namedWithFreeText({ name: 'Clinic' })).toBe('Clinic');
    expect(namedWithFreeText({ name: 'Clinic' }, 'Ward 1')).toBe('Clinic: Ward 1');
  });

  it('uses free text before the physical inventory label and leaves no reason blank', () => {
    expect(reasonLabel(line('a'), 'Physical Inventory')).toBe('');
    expect(reasonLabel(line('a', { reason: reason('Loss') }), 'Physical Inventory')).toBe('Loss');
    const inventory = line('a', { reason: reason('Overstock', 'CREDIT', 'PHYSICAL_INVENTORY') });
    expect(reasonLabel(inventory, 'Physical Inventory')).toBe('Physical Inventory');
    expect(reasonLabel({ ...inventory, reasonFreeText: 'Counted' }, 'Physical Inventory')).toBe(
      'Overstock: Counted',
    );
  });

  it('shows documents only with their origin or reversal relationship and falls back to No Number', () => {
    expect(documentNumbers(line('a', { documentNumber: 'Hidden' }), 'No Number')).toEqual({
      document: '',
      reversing: '',
      reversedBy: '',
    });
    expect(
      documentNumbers(
        line('a', {
          eventOrigin: 'STOCK_EVENT',
          documentNumber: 'DOC-1',
          reversedEventId: 'event1',
          reversedEventDocumentNumber: 'DOC-2',
          cancellationEventId: 'event2',
          cancellationEventDocumentNumber: 'DOC-3',
        }),
        'No Number',
      ),
    ).toEqual({ document: 'DOC-1', reversing: 'DOC-2', reversedBy: 'DOC-3' });
    expect(
      documentNumbers(
        line('a', {
          eventOrigin: 'STOCK_EVENT',
          reversedEventId: 'event1',
          cancellationEventId: 'event2',
        }),
        'No Number',
      ),
    ).toEqual({ document: 'No Number', reversing: 'No Number', reversedBy: 'No Number' });
  });

  it('adds the display unit only when supplied', () => {
    expect(
      stockCardProductName({ fullProductName: 'Vaccine', dispensable: { displayUnit: 'each' } }),
    ).toBe('Vaccine - each');
    expect(stockCardProductName({ fullProductName: 'Vaccine' })).toBe('Vaccine');
  });
});
