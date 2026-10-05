import { describe, expect, it } from 'vitest';
import { filterReasons, type ReasonLabels, sortReasons } from '@/features/reasons/lib/reasons-list';
import type { Reason } from '@/features/reference-data/lib/types';

const reason = (id: string, name: string, reasonType: string, reasonCategory: string): Reason => ({
  id,
  name,
  reasonType,
  reasonCategory,
  isFreeTextAllowed: false,
  tags: [],
});

const reasons = [
  reason('1', 'Transfer In', 'CREDIT', 'TRANSFER'),
  reason('2', 'damage', 'DEBIT', 'ADJUSTMENT'),
  reason('3', 'Unpack Kit', 'DEBIT', 'AGGREGATION'),
  reason('4', 'Réception', 'CREDIT', 'TRANSFER'),
  reason('5', 'Balance', 'BALANCE_ADJUSTMENT', 'PHYSICAL_INVENTORY'),
];

const LABELS: Record<string, string> = {
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
  AGGREGATION: 'Aggregation',
  PHYSICAL_INVENTORY: 'Physical Inventory',
  CREDIT: 'Credit',
  DEBIT: 'Debit',
  BALANCE_ADJUSTMENT: 'Balance Adjustment',
};
const labels: ReasonLabels = {
  category: (code) => LABELS[code] ?? code,
  type: (code) => LABELS[code] ?? code,
};

const names = (list: Reason[]) => list.map((item) => item.name);

describe('filterReasons', () => {
  it('keeps every reason with no search', () => {
    expect(filterReasons(reasons, undefined)).toHaveLength(5);
  });

  it('finds a reason by part of its name, ignoring case and accents', () => {
    expect(names(filterReasons(reasons, 'DAMA'))).toEqual(['damage']);
    expect(names(filterReasons(reasons, ' recep '))).toEqual(['Réception']);
  });
});

describe('sortReasons', () => {
  it('sorts by name, ignoring case', () => {
    expect(names(sortReasons(reasons, 'name', false, labels))).toEqual([
      'Balance',
      'damage',
      'Réception',
      'Transfer In',
      'Unpack Kit',
    ]);
  });

  it('sorts by category label, then name', () => {
    expect(names(sortReasons(reasons, 'category', false, labels))).toEqual([
      'damage',
      'Unpack Kit',
      'Balance',
      'Réception',
      'Transfer In',
    ]);
  });

  it('sorts by type label descending, with names still ascending within a type', () => {
    expect(names(sortReasons(reasons, 'type', true, labels))).toEqual([
      'damage',
      'Unpack Kit',
      'Réception',
      'Transfer In',
      'Balance',
    ]);
  });
});
