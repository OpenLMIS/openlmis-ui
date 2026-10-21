import { expect, it } from 'vitest';
import { summaryStockCard } from '@/features/stock-card/lib/summary-stock-card';
import { offlineAccessFixture } from '@/tests/offline-access';

const access = offlineAccessFixture();
const home = access.homeFacility;
if (!home) throw new Error('Missing fixture home');
const summary = {
  id: 'card',
  orderable: { id: 'product', productCode: 'P', fullProductName: 'Product', description: null },
  lot: null,
  stockOnHand: 10,
  active: true,
};
const bundle = { fetchedAt: 200, generation: 'bundle' };
const project = (history?: ReturnType<typeof summaryStockCard>) =>
  summaryStockCard(summary, home, access.programs[0], bundle, history);
const history = {
  ...project(),
  summaryOnly: false,
  stockOnHand: 5,
  lineItems: [{ id: 'line', occurredDate: '2026-01-01', quantity: 5, stockOnHand: 5 }],
  device: { fetchedAt: 100, generation: 'history' },
};

it('uses newer bundle balances without presenting inconsistent older history', () => {
  expect(project(history)).toMatchObject({
    stockOnHand: 10,
    lineItems: [],
    summaryOnly: true,
    device: bundle,
  });
});
it('keeps consistent history lines alongside a newer balance snapshot', () => {
  expect(project({ ...history, stockOnHand: 10 })).toMatchObject({
    stockOnHand: 10,
    lineItems: history.lineItems,
    summaryOnly: false,
    device: bundle,
  });
});
it('prefers a more recently viewed history over the download', () => {
  const newer = { ...history, device: { fetchedAt: 300, generation: 'newer' } };
  expect(project(newer)).toBe(newer);
});
