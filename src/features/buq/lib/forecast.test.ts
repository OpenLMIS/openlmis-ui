import { describe, expect, it } from 'vitest';
import {
  type ForecastDraft,
  forecastBody,
  forecastTotals,
  fundingComplete,
  initialDraft,
  lineValid,
  numbersValid,
  pageRows,
  productInfo,
  sortModels,
  withForecasted,
  withVerified,
} from '@/features/buq/lib/forecast';
import type { BuqForecast } from '@/features/buq/lib/types';

const SOURCES = [
  { id: 's1', name: 'Health Basket Fund' },
  { id: 's2', name: 'User fee' },
];

const forecast = (overrides: Partial<BuqForecast> = {}): BuqForecast => ({
  id: 'b1',
  facilityId: 'f1',
  programId: 'g1',
  processingPeriodId: 'p1',
  targetYear: 2018,
  status: 'DRAFT',
  bottomUpQuantificationLineItems: [
    {
      id: 'l1',
      orderableId: 'o1',
      annualAdjustedConsumption: 20,
      verifiedAnnualAdjustedConsumption: null,
      forecastedDemand: null,
      totalCost: null,
      remark: null,
    },
    {
      id: 'l2',
      orderableId: 'o2',
      annualAdjustedConsumption: 3,
      verifiedAnnualAdjustedConsumption: 4,
      forecastedDemand: 5,
      totalCost: 10,
      remark: { id: 'r1' },
    },
  ],
  fundingDetails: null,
  ...overrides,
});

const PRICES = { l1: 78.58, l2: 1.1 };

describe('initial values', () => {
  it('starts Verified from the consumption and Forecasted from Verified, keeping saved values', () => {
    const stored = forecast();
    stored.bottomUpQuantificationLineItems.push({
      ...stored.bottomUpQuantificationLineItems[0],
      id: 'l3',
      verifiedAnnualAdjustedConsumption: 25,
    });
    expect(initialDraft(stored, SOURCES).lines).toEqual({
      l1: { verified: '20', forecasted: '20', remarkId: '' },
      l2: { verified: '4', forecasted: '5', remarkId: 'r1' },
      l3: { verified: '25', forecasted: '25', remarkId: '' },
    });
  });

  it('offers every source when the forecast has no saved funding, else only the saved entries', () => {
    expect(initialDraft(forecast(), SOURCES).funding.map(({ sourceId }) => sourceId)).toEqual([
      's1',
      's2',
    ]);
    const saved = forecast({
      fundingDetails: {
        sourcesOfFunds: [
          {
            sourceOfFund: { id: 's2', name: 'User fee' },
            amountUsedInLastFinancialYear: 10.5,
            projectedFund: 20,
          },
        ],
      },
    });
    expect(initialDraft(saved, SOURCES).funding).toEqual([
      { sourceId: 's2', name: 'User fee', used: '10.5', projected: '20' },
    ]);
  });
});

describe('editing a line', () => {
  it('copies Verified into Forecasted and clears the remark once they match again', () => {
    const line = { verified: '20', forecasted: '20', remarkId: '' };
    const changed = withForecasted(line, '25');
    expect(lineValid(changed)).toBe(false);
    expect(lineValid({ ...changed, remarkId: 'r1' })).toBe(true);
    expect(withVerified('30')).toEqual({
      verified: '30',
      forecasted: '30',
      remarkId: '',
    });
  });

  it('keeps the chosen remark while Forecasted is retyped, clearing it only when they match', () => {
    const line = { verified: '20', forecasted: '25', remarkId: 'r1' };
    const blank = withForecasted(line, '');
    expect(blank.remarkId).toBe('r1');
    expect(withForecasted(blank, '30').remarkId).toBe('r1');
    expect(withForecasted(blank, '20').remarkId).toBe('');
  });

  it('refuses blank, decimal and too large numbers', () => {
    const line = { verified: '1', forecasted: '1', remarkId: '' };
    expect(numbersValid({ ...line, verified: '' })).toBe(false);
    expect(numbersValid({ ...line, forecasted: '1.5' })).toBe(false);
    expect(numbersValid({ ...line, forecasted: '2147483648' })).toBe(false);
    expect(numbersValid(line)).toBe(true);
  });
});

describe('totals', () => {
  it('sums every line cost in cents and takes the gap from the projected funds', () => {
    const draft: ForecastDraft = {
      lines: {
        l1: { verified: '20', forecasted: '20', remarkId: '' },
        l2: { verified: '3', forecasted: '3', remarkId: '' },
      },
      funding: [
        { sourceId: 's1', name: '', used: '1', projected: '1000' },
        { sourceId: 's2', name: '', used: '0', projected: '500.5' },
      ],
    };
    expect(forecastTotals(draft, PRICES)).toEqual({
      totalCost: 1574.9,
      totalProjectedFund: 1500.5,
      gap: -74.4,
    });
  });

  it('needs both amounts for every source before sending', () => {
    const row = { sourceId: 's1', name: '', used: '1', projected: '2' };
    expect(fundingComplete([row, { ...row, sourceId: 's2', used: '0', projected: '0' }])).toBe(
      true,
    );
    expect(fundingComplete([row, { ...row, sourceId: 's2', projected: '' }])).toBe(false);
    expect(fundingComplete([row, { ...row, sourceId: 's2', used: '' }])).toBe(false);
    expect(fundingComplete([])).toBe(false);
  });

  it('costs a line from Forecasted and counts an unreadable amount as nothing', () => {
    const draft: ForecastDraft = {
      lines: {
        l1: { verified: '20', forecasted: '10', remarkId: 'r1' },
        l2: { verified: '3', forecasted: '3', remarkId: '' },
      },
      funding: [
        { sourceId: 's1', name: '', used: '1', projected: '1,234' },
        { sourceId: 's2', name: '', used: '0', projected: '100' },
      ],
    };
    expect(forecastTotals(draft, PRICES)).toEqual({
      totalCost: 789.1,
      totalProjectedFund: 100,
      gap: -689.1,
    });
  });
});

describe('write body', () => {
  it('sends the stored facility and program, every line with its consumption and money in cents', () => {
    const stored = forecast({
      fundingDetails: {
        id: 'fd1',
        sourcesOfFunds: [
          {
            sourceOfFund: { id: 's1' },
            amountUsedInLastFinancialYear: null,
            projectedFund: null,
          },
        ],
      },
    });
    const draft = initialDraft(stored, SOURCES);
    draft.lines.l2 = { verified: '6', forecasted: '8', remarkId: 'r2' };
    draft.funding = [{ sourceId: 's1', name: '', used: '1', projected: '2' }];
    const body = forecastBody(stored, draft, PRICES);

    expect(body).toMatchObject({ id: 'b1', facilityId: 'f1', programId: 'g1' });
    expect(body.bottomUpQuantificationLineItems).toEqual([
      {
        id: 'l1',
        orderableId: 'o1',
        annualAdjustedConsumption: 20,
        verifiedAnnualAdjustedConsumption: 20,
        forecastedDemand: 20,
        totalCost: 1571.6,
        remark: null,
      },
      {
        id: 'l2',
        orderableId: 'o2',
        annualAdjustedConsumption: 3,
        verifiedAnnualAdjustedConsumption: 6,
        forecastedDemand: 8,
        totalCost: 8.8,
        remark: { id: 'r2' },
      },
    ]);
    expect(body.fundingDetails).toEqual({
      id: 'fd1',
      totalProjectedFund: 2,
      totalForecastedCost: 1580.4,
      gap: -1578.4,
      sourcesOfFunds: [
        { sourceOfFund: { id: 's1' }, amountUsedInLastFinancialYear: 1, projectedFund: 2 },
      ],
    });
  });
});

describe('write body without funding', () => {
  it('sends no sources and no projected totals while funding was never entered', () => {
    const stored = forecast();
    const draft = initialDraft(stored, SOURCES);
    const body = forecastBody(stored, draft, PRICES);

    expect(body.fundingDetails).toEqual({
      id: undefined,
      totalProjectedFund: null,
      totalForecastedCost: 1577.1,
      gap: null,
      sourcesOfFunds: [],
    });
  });
});

describe('grid pages', () => {
  const models = sortModels([
    { lineId: 'a', category: 'Vaccines', name: 'Forteo' },
    { lineId: 'b', category: 'Anti-fungal', name: 'Ironman' },
    { lineId: 'c', category: 'Antibiotics', name: 'Sinuva' },
    { lineId: 'd', category: 'Anti-fungal', name: 'Ban' },
  ]);

  it('groups products by category name, then product name', () => {
    expect(models.map(({ lineId }) => lineId)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('pages products only and repeats the category heading on each page', () => {
    expect(pageRows(models, 0, 3).map((row) => row.id)).toEqual([
      'category:Anti-fungal',
      'd',
      'b',
      'category:Antibiotics',
      'c',
    ]);
    expect(pageRows(models, 1, 3).map((row) => row.id)).toEqual(['category:Vaccines', 'a']);
  });
});

describe('product price and category', () => {
  const orderable = {
    id: 'o1',
    productCode: '10122-313',
    fullProductName: 'Cardene IV',
    description: null,
    dispensable: { displayUnit: '10 tab strip' },
    programs: [
      { programId: 'other', pricePerPack: 78.58, orderableCategoryDisplayName: 'Anaesthetics' },
      { programId: 'g1', pricePerPack: 12, orderableCategoryDisplayName: 'Analgesics' },
    ],
  };

  it("prefers the BUQ program's entry, else takes the first program, as legacy", () => {
    expect(productInfo(orderable, 'g1', 20)).toEqual({
      consumption: 20,
      code: '10122-313',
      name: 'Cardene IV',
      unit: '10 tab strip',
      price: 12,
      category: 'Analgesics',
    });
    expect(productInfo(orderable, 'buq', 20)).toMatchObject({
      price: 78.58,
      category: 'Anaesthetics',
    });
  });
});
