import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import {
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchInventorySummaries,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
  inventorySummariesOptions,
} from '@/features/stock-events/api/physical-inventory-queries';

vi.mock('@/features/stock-events/api/physical-inventory-api', () => ({
  fetchInventorySummaries: vi.fn().mockResolvedValue([]),
  fetchInventoryStockLines: vi.fn().mockResolvedValue([]),
  fetchEligibleInventoryProducts: vi.fn().mockResolvedValue([]),
}));
it('shares one full summaries request between stock hydration and eligible expansion', async () => {
  const client = new QueryClient();
  const scope = { programId: 'p', facilityId: 'f' };
  const draft = { ...scope, id: 'd', lineItems: [] };
  await Promise.all([
    client.fetchQuery(inventoryStockLinesOptions(draft)),
    client.fetchQuery(eligibleInventoryProductsOptions(scope)),
  ]);
  expect(fetchInventorySummaries).toHaveBeenCalledTimes(1);
  expect(fetchInventorySummaries).toHaveBeenCalledWith(scope);
  expect(fetchInventoryStockLines).toHaveBeenCalledWith([], []);
  expect(fetchEligibleInventoryProducts).toHaveBeenCalledWith([]);
});
it('does not hydrate old summaries after the signed-in user changes', async () => {
  const { useLoginData } = await import('@/features/auth/store/login-data');
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'first', username: 'first', accessToken: 'token' });
  vi.clearAllMocks();
  const summaries = Promise.withResolvers<[]>();
  vi.mocked(fetchInventorySummaries).mockReturnValueOnce(summaries.promise);
  const client = new QueryClient();
  const pending = client.fetchQuery(
    inventoryStockLinesOptions({ id: 'd', programId: 'p', facilityId: 'f', lineItems: [] }),
  );
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'next', username: 'next', accessToken: 'token' });
  summaries.resolve([]);
  await expect(pending).rejects.toThrow();
  expect(fetchInventoryStockLines).not.toHaveBeenCalled();
});

it('refreshes summaries and stock on entry but keeps the cache on stay', async () => {
  vi.clearAllMocks();
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const draft = { id: 'd', programId: 'p', facilityId: 'f', lineItems: [] };
  await client.fetchQuery(inventoryStockLinesOptions(draft));
  await client.fetchQuery({ ...inventorySummariesOptions(draft), staleTime: 0 });
  await client.fetchQuery({ ...inventoryStockLinesOptions(draft), staleTime: 0 });
  await client.ensureQueryData(inventoryStockLinesOptions(draft));
  expect(fetchInventorySummaries).toHaveBeenCalledTimes(2);
  expect(fetchInventoryStockLines).toHaveBeenCalledTimes(2);
  await client.ensureQueryData(inventoryStockLinesOptions(draft));
  expect(fetchInventorySummaries).toHaveBeenCalledTimes(2);
});
