import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import {
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchInventorySummaries,
  fetchPhysicalInventoryDraft,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  inventoryRefreshFilters,
  inventoryStockLinesOptions,
  inventorySummariesOptions,
  physicalInventoryDraftOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { DraftConflictError } from '@/lib/draft-store';

vi.mock('@/features/stock-events/api/physical-inventory-api', () => ({
  fetchPhysicalInventoryDraft: vi.fn(),
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
  expect(fetchInventoryStockLines).toHaveBeenCalledWith([], [], expect.any(Function));
  expect(fetchEligibleInventoryProducts).toHaveBeenCalledWith(scope, [], expect.any(Function));
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

it('keeps eligible products fresh when draft and stock queries are invalidated', async () => {
  const { queryKeys } = await import('@/lib/key-factory');
  const client = new QueryClient();
  const draft = { id: 'd', programId: 'p', facilityId: 'f', lineItems: [] };
  const options = eligibleInventoryProductsOptions(draft);
  await client.fetchQuery(options);
  await client.invalidateQueries({ queryKey: queryKeys.physicalInventories.all });
  expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(false);
  vi.mocked(fetchEligibleInventoryProducts).mockClear();
  await client.fetchQuery(options);
  expect(fetchEligibleInventoryProducts).not.toHaveBeenCalled();
});

it('scopes Save and Deactivate refreshes to draft and stock reads without reopening the device copy', async () => {
  const { queryKeys } = await import('@/lib/key-factory');
  const client = new QueryClient();
  const draft = { id: 'd', programId: 'p', facilityId: 'f', lineItems: [] };
  const draftKey = physicalInventoryDraftOptions({ programId: 'p', facilityId: 'f' }).queryKey;
  const stockKey = inventoryStockLinesOptions(draft).queryKey;
  const localKey = [...queryKeys.physicalInventories.detail(draft.id), 'local', 'entry'];
  const eligibleKey = eligibleInventoryProductsOptions(draft).queryKey;
  for (const key of [draftKey, stockKey, localKey, eligibleKey]) client.setQueryData(key, []);
  for (const filter of inventoryRefreshFilters(draft)) await client.invalidateQueries(filter);
  expect(client.getQueryState(draftKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(stockKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(localKey)?.isInvalidated).toBe(false);
  expect(client.getQueryState(eligibleKey)?.isInvalidated).toBe(false);
});
it('waits for entry freshness, then reuses that eligible expansion for actions', async () => {
  const client = new QueryClient();
  const scope = { programId: 'p', facilityId: 'f' };
  const beforeEntry = Date.now() - 1000;
  client.setQueryData(eligibleInventoryProductsOptions(scope).queryKey, [], {
    updatedAt: beforeEntry,
  });
  const entry = beforeEntry + 1;
  vi.mocked(fetchEligibleInventoryProducts).mockClear();
  await client.fetchQuery(eligibleInventoryProductsOptions(scope, entry));
  expect(fetchEligibleInventoryProducts).toHaveBeenCalledTimes(1);
  await client.fetchQuery(eligibleInventoryProductsOptions(scope, entry));
  expect(fetchEligibleInventoryProducts).toHaveBeenCalledTimes(1);
});

it('refreshes active summaries only once when invalidating a draft and its stock lines', async () => {
  const client = new QueryClient();
  const draft = { id: 'd', programId: 'p', facilityId: 'f', lineItems: [] };
  const summaries = inventorySummariesOptions(draft);
  client.setQueryData(summaries.queryKey, []);
  const observer = new QueryObserver(client, summaries);
  const unsubscribe = observer.subscribe(() => {});
  const fresh = Promise.withResolvers<[]>();
  vi.mocked(fetchInventorySummaries).mockClear();
  vi.mocked(fetchInventorySummaries).mockReturnValue(fresh.promise);
  const pending = inventoryRefreshFilters(draft).map((filter) => client.invalidateQueries(filter));
  expect(fetchInventorySummaries).toHaveBeenCalledTimes(1);
  fresh.resolve([]);
  await Promise.all(pending);
  unsubscribe();
  client.clear();
  vi.mocked(fetchInventorySummaries).mockResolvedValue([]);
});

it('does not refetch hydrated stock when the editor mounts', async () => {
  vi.mocked(fetchInventoryStockLines).mockClear();
  const client = new QueryClient();
  const draft = { id: 'fresh', programId: 'p', facilityId: 'f', lineItems: [] };
  await client.fetchQuery({ ...inventoryStockLinesOptions(draft), staleTime: 0 });
  const observer = new QueryObserver(client, inventoryStockLinesOptions(draft));
  const unsubscribe = observer.subscribe(() => {});
  expect(fetchInventoryStockLines).toHaveBeenCalledTimes(1);
  unsubscribe();
  client.clear();
});

it('shares normalized versioned orderable reads under the existing orderables list key', async () => {
  const { orderablesByIdentitiesOptions } = await import('@/features/reference-data/api/queries');
  const { queryKeys } = await import('@/lib/key-factory');
  const first = { id: 'a', versionNumber: 2 };
  const second = { id: 'b', versionNumber: 3 };
  const a = orderablesByIdentitiesOptions([second, first, first]);
  const b = orderablesByIdentitiesOptions([first, second]);
  expect(a.queryKey).toEqual(b.queryKey);
  expect(a.queryKey.slice(0, 2)).toEqual(queryKeys.orderables.list({}).slice(0, 2));
  const client = new QueryClient();
  const queryFn = vi.fn().mockResolvedValue([]);
  await Promise.all([client.fetchQuery({ ...a, queryFn }), client.fetchQuery({ ...b, queryFn })]);
  expect(queryFn).toHaveBeenCalledTimes(1);
  client.clear();
});

vi.mock('@/features/stock-events/lib/physical-inventory-local', () => ({
  reconcileInventoryCopies: vi.fn(),
}));
it.each([new Error('IndexedDB unavailable'), new DraftConflictError(undefined)])(
  'returns the server draft despite failed reconciliation: %s',
  async (error) => {
    const { reconcileInventoryCopies } = await import(
      '@/features/stock-events/lib/physical-inventory-local'
    );
    vi.mocked(reconcileInventoryCopies).mockRejectedValueOnce(error);
    const draft = { id: 'd', facilityId: 'f', programId: 'p', lineItems: [] };
    vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValueOnce(draft);
    await expect(
      new QueryClient().fetchQuery(physicalInventoryDraftOptions(draft)),
    ).resolves.toEqual(draft);
  },
);

it('does not expand eligible products after summaries finish while disconnected', async () => {
  const summaries = Promise.withResolvers<[]>();
  vi.mocked(fetchInventorySummaries).mockReturnValueOnce(summaries.promise);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const eligibleCalls = vi.mocked(fetchEligibleInventoryProducts).mock.calls.length;
  const pending = client.fetchQuery(
    eligibleInventoryProductsOptions({ facilityId: 'f', programId: 'p' }),
  );
  const assertion = expect(pending).rejects.toHaveProperty('name', 'LocalDataUnavailableError');
  onlineManager.setOnline(false);
  summaries.resolve([]);
  await assertion;
  expect(fetchEligibleInventoryProducts).toHaveBeenCalledTimes(eligibleCalls);
  client.clear();
});
