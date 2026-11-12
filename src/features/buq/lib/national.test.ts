import { describe, expect, it } from 'vitest';
import { costTotals, groupOptions, nationalRows, parseCost } from '@/features/buq/lib/national';
import type { FinalApprovalItem } from '@/features/buq/lib/types';

const zone = (id: string, name: string, level: string) => ({ id, name, level: { name: level } });

const ZONES = [
  zone('mz', 'Mozambique', 'Country'),
  zone('ni', 'Niassa', 'Region'),
  zone('ca', 'Cabo Delgado', 'Region'),
  zone('cu', 'Cuamba', 'District'),
  zone('li', 'Lichinga', 'District'),
  zone('ta', 'Tanzania', 'Country'),
];

describe('groupOptions', () => {
  it('lists the supervised tree to depth three, parents first and names sorted', () => {
    const tree = {
      ta: {},
      mz: { ni: { li: ['x'], cu: [] }, ca: {} },
    };
    expect(groupOptions(tree, ZONES)).toEqual([
      { value: 'mz', label: 'Mozambique', description: 'Country' },
      { value: 'ca', label: 'Cabo Delgado', description: 'Region' },
      { value: 'ni', label: 'Niassa', description: 'Region' },
      { value: 'cu', label: 'Cuamba', description: 'District' },
      { value: 'li', label: 'Lichinga', description: 'District' },
      { value: 'ta', label: 'Tanzania', description: 'Country' },
    ]);
  });

  it('keeps a zone the zone list does not name, under its id', () => {
    expect(groupOptions({ gone: {} }, ZONES)).toEqual([
      { value: 'gone', label: 'gone', description: '' },
    ]);
  });
});

describe('parseCost', () => {
  it('reads the amount of the cost text with its decimals', () => {
    expect(parseCost('1834.06 USD')).toBe(1834.06);
    expect(parseCost('0.00 USD')).toBe(0);
  });

  it('gives nothing for text without an amount', () => {
    expect(parseCost('USD')).toBeNull();
    expect(parseCost(undefined)).toBeNull();
  });
});

const item = (
  id: string,
  facilityId: string,
  costs: Record<string, string>,
): FinalApprovalItem => ({
  bottomUpQuantification: {
    id,
    facilityId,
    programId: 'g',
    processingPeriodId: 'p',
    targetYear: 2018,
    status: 'APPROVED',
  },
  calculatedGroupsCosts: costs,
});

const FACILITIES = [
  { id: 'f1', name: 'Cuamba', type: { name: 'Health Center' } },
  { id: 'f2', name: 'Lichinga', type: { name: 'District Hospital' } },
];

it('joins each forecast to its facility and reads the five legacy groups', () => {
  const rows = nationalRows(
    [
      item('b1', 'f1', { Pharmaceuticals: '194.70 USD', 'Dental supplies': '0.00 USD' }),
      item('b2', 'gone', {}),
    ],
    FACILITIES,
  );
  expect(rows).toEqual([
    {
      id: 'b1',
      facilityName: 'Cuamba',
      facilityType: 'Health Center',
      status: 'APPROVED',
      costs: {
        pharmaceuticals: 194.7,
        medical: null,
        radiology: null,
        diagnostics: null,
        dental: 0,
      },
    },
    {
      id: 'b2',
      facilityName: '',
      facilityType: '',
      status: 'APPROVED',
      costs: {
        pharmaceuticals: null,
        medical: null,
        radiology: null,
        diagnostics: null,
        dental: null,
      },
    },
  ]);
});

it('sums every forecast exactly, with any other group in Others', () => {
  const totals = costTotals([
    item('b1', 'f1', {
      Pharmaceuticals: '0.10 USD',
      'Medical supplies': '582.80 USD',
      Others: '1834.06 USD',
    }),
    item('b2', 'f2', { Pharmaceuticals: '0.20 USD', Vaccines: '10.01 USD', Others: '0.00 USD' }),
  ]);
  expect(totals).toEqual({
    pharmaceuticals: 0.3,
    medical: 582.8,
    radiology: 0,
    diagnostics: 0,
    dental: 0,
    others: 1844.07,
  });
});
