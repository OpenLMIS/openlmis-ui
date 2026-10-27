import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchStockCard } from '@/features/stock-card/api/api';
import { stockCardOptions } from '@/features/stock-card/api/queries';
import { saveStockCardHistory } from '@/features/stock-card/lib/history-cache';
import type { StockCard } from '@/features/stock-card/lib/types';
import type { HomeStockAccess } from '@/lib/stock-programs';

vi.mock('@/features/stock-card/api/api', () => ({ fetchStockCard: vi.fn() }));
vi.mock('@/features/stock-card/lib/history-cache', () => ({ saveStockCardHistory: vi.fn() }));
afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  vi.resetAllMocks();
});

it('never saves a late server card into the next user database', async () => {
  useLoginData.setState({ referenceDataUserId: 'original' });
  let resolve!: (card: StockCard) => void;
  vi.mocked(fetchStockCard).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const reading = queryClient.fetchQuery(stockCardOptions('card', undefined, true));
  const rejected = expect(reading).rejects.toBeInstanceOf(SessionEndedError);
  useLoginData.setState({ referenceDataUserId: 'next' });
  resolve({ id: 'card' } as StockCard);
  await rejected;
  expect(saveStockCardHistory).not.toHaveBeenCalled();
});

it('never starts persisting a card when identity changes during access verification', async () => {
  useLoginData.setState({ referenceDataUserId: 'original' });
  vi.mocked(fetchStockCard).mockResolvedValue({ id: 'card' } as StockCard);
  let resolve!: (access: HomeStockAccess) => void;
  const access = vi.fn(
    () =>
      new Promise<HomeStockAccess>((done) => {
        resolve = done;
      }),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const reading = queryClient.fetchQuery(stockCardOptions('card', undefined, true, access));
  const rejected = expect(reading).rejects.toBeInstanceOf(SessionEndedError);
  await waitFor(() => expect(access).toHaveBeenCalledOnce());
  useLoginData.setState({ referenceDataUserId: 'next' });
  resolve({ homeFacility: null, programs: [], permissionStrings: [] });
  await rejected;
  expect(saveStockCardHistory).not.toHaveBeenCalled();
  queryClient.clear();
});
