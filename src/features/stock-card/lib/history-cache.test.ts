import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  readStockCardHistory,
  saveStockCardHistory,
} from '@/features/stock-card/lib/history-cache';
import type { StockCard } from '@/features/stock-card/lib/types';
import { getLocalDb } from '@/integrations/local-db';

const card: StockCard = {
  id: 'card',
  facility: { id: 'home', code: 'H', name: 'Home' },
  program: { id: 'p', code: 'P', name: 'Program' },
  orderable: { id: 'o', productCode: 'MED', fullProductName: 'Medicine' },
  lot: null,
  stockOnHand: 12,
  active: true,
  lineItems: [{ id: 'l', occurredDate: '2026-01-01', quantity: 12, stockOnHand: 12 }],
};

beforeEach(async () => {
  useLoginData.setState({ referenceDataUserId: 'history-owner' });
  await getLocalDb().table('stockCardHistory').clear();
});
afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  vi.restoreAllMocks();
});

it('isolates histories by owner and retains the original copy across sign-out', async () => {
  await saveStockCardHistory(card);
  useLoginData.setState({ referenceDataUserId: 'another-history-owner' });
  expect(await readStockCardHistory(card.id)).toBeUndefined();
  await saveStockCardHistory({ ...card, stockOnHand: 999 });
  useLoginData.setState({ referenceDataUserId: null });
  useLoginData.setState({ referenceDataUserId: 'history-owner' });
  expect(await readStockCardHistory(card.id)).toMatchObject({
    stockOnHand: 12,
    lineItems: card.lineItems,
  });
});

it('keeps the 50 most recently fetched cards and renews a viewed card before pruning', async () => {
  let now = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  for (let index = 0; index < 50; index++) {
    now += 1;
    await saveStockCardHistory({ ...card, id: `card-${index}` });
  }
  now += 1;
  await saveStockCardHistory({ ...card, id: 'card-0' });
  now += 1;
  await saveStockCardHistory({ ...card, id: 'card-50' });
  expect(await getLocalDb().table('stockCardHistory').count()).toBe(50);
  expect(await readStockCardHistory('card-1')).toBeUndefined();
  expect(await readStockCardHistory('card-0')).toMatchObject({ downloadedAt: now - 1 });
  expect(await readStockCardHistory('card-50')).toMatchObject({ downloadedAt: now });
});

it('rejects a pending save after the identity changes, without writing to either owner', async () => {
  const saving = saveStockCardHistory(card);
  const rejected = expect(saving).rejects.toBeInstanceOf(SessionEndedError);
  useLoginData.setState({ referenceDataUserId: 'late-history-owner' });
  await rejected;
  expect(await readStockCardHistory(card.id)).toBeUndefined();
  useLoginData.setState({ referenceDataUserId: 'history-owner' });
  expect(await readStockCardHistory(card.id)).toBeUndefined();
});
