import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { fetchOrderablesByIdentities } from '@/features/reference-data/api/api';
import {
  facilityOptions,
  orderablesByIdentitiesOptions,
} from '@/features/reference-data/api/queries';
import { fetchStatusMessages } from '@/features/requisitions/api/api';
import {
  requisitionGridQueries,
  requisitionStatusMessagesOptions,
} from '@/features/requisitions/api/queries';
import { product, record } from '@/features/requisitions/lib/fixtures/builders';
import { captureSingle } from '@/features/requisitions/lib/offline-capture-single';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

vi.mock('@/features/requisitions/api/api', () => ({ fetchStatusMessages: vi.fn(async () => []) }));
vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reference-data/api/api')>()),
  fetchOrderablesByIdentities: vi.fn(async () => []),
}));
vi.mock('@/features/requisitions/lib/offline-access', () => ({
  readRequisitionAccess: vi.fn(async () => ({})),
  mayViewCopy: () => true,
}));
vi.mock('@/features/requisitions/lib/offline-copies', async (original) => ({
  ...(await original<typeof import('@/features/requisitions/lib/offline-copies')>()),
  commitCopy: vi.fn(),
}));
function seedCopyQueries(
  client: QueryClient,
  base: RequisitionRecord,
  products?: ReturnType<typeof product>[],
) {
  const queries = requisitionGridQueries(base);
  if (products) client.setQueryData([...queries[0].queryKey], products);
  client.setQueryData([...queries[1].queryKey], []);
  client.setQueryData([...queries[2].queryKey], { id: base.processingPeriod.id });
  client.setQueryData([...queries[3].queryKey], {});
  client.setQueryData([...queries[4].queryKey], { id: base.program.id });
  client.setQueryData([...facilityOptions(base.facility.id).queryKey], { id: base.facility.id });
  client.setQueryData(requisitionStatusMessagesOptions(base.id).queryKey, []);
}

it('reuses the grid and available-product queries when capturing a copy', async () => {
  const { getSessionScope } = await import('@/lib/session-scope');
  const base = {
    ...record(),
    id: 'r',
    facility: { id: 'f' },
    program: { id: 'p' },
    processingPeriod: { id: 'period' },
    availableProducts: [{ id: 'another', versionNumber: 1 }],
  } as RequisitionRecord;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedCopyQueries(client, base, [product()]);
  client.setQueryData(
    [...orderablesByIdentitiesOptions(base.availableProducts ?? []).queryKey],
    [{ ...product(), id: 'another' }],
  );
  vi.mocked(fetchStatusMessages).mockResolvedValueOnce([{ id: 'new-message' }] as never);
  vi.mocked(fetchStatusMessages).mockClear();
  const lease = { id: base.id, userId: 'u', generation: 0, session: getSessionScope() };
  await captureSingle(client, lease, base, 'read');
  await captureSingle(client, lease, base, 'read');
  expect(fetchStatusMessages).not.toHaveBeenCalled();
  const refs = await captureSingle(
    client,
    {
      id: base.id,
      userId: 'u',
      generation: 0,
      session: getSessionScope(),
    },
    base,
    'read',
    { freshMessages: true },
  );
  expect(fetchStatusMessages).toHaveBeenCalledOnce();
  expect(refs.messages).toEqual([{ id: 'new-message' }]);
  expect(refs.products.map((p) => p.id)).toEqual(['product', 'another']);
  client.clear();
});

it('waits for grid products before requesting missing available products', async () => {
  const { getSessionScope } = await import('@/lib/session-scope');
  const base = {
    ...record(),
    id: 'r',
    facility: { id: 'f' },
    program: { id: 'p' },
    processingPeriod: { id: 'period' },
    availableProducts: [{ id: 'product', versionNumber: 1 }],
  } as RequisitionRecord;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queries = requisitionGridQueries(base);
  let resolveProducts!: (value: Awaited<ReturnType<typeof fetchOrderablesByIdentities>>) => void;
  const pending = client.fetchQuery({
    ...queries[0],
    queryFn: () =>
      new Promise<Awaited<ReturnType<typeof fetchOrderablesByIdentities>>>((resolve) => {
        resolveProducts = resolve;
      }),
  });
  seedCopyQueries(client, base);
  vi.mocked(fetchOrderablesByIdentities).mockClear();
  const capture = captureSingle(
    client,
    { id: 'r', userId: 'u', generation: 0, session: getSessionScope() },
    base,
    'read',
  );
  await Promise.resolve();
  expect(fetchOrderablesByIdentities).not.toHaveBeenCalled();
  resolveProducts([{ ...product(), description: '' }]);
  await pending;
  await capture;
  expect(fetchOrderablesByIdentities).not.toHaveBeenCalled();
  client.clear();
});

it('waits for idle and foreground requests before fetching extra products in batches', async () => {
  const { getSessionScope } = await import('@/lib/session-scope');
  const base = {
    ...record(),
    id: 'r',
    facility: { id: 'f' },
    program: { id: 'p' },
    processingPeriod: { id: 'period' },
    availableProducts: Array.from({ length: 250 }, (_, index) => ({
      id: `extra-${index}`,
      versionNumber: 1,
    })),
  } as RequisitionRecord;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedCopyQueries(client, base, []);
  let idle: (() => void) | undefined;
  const releaseIdle = () => idle?.();
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    idle = callback;
    return 1;
  });
  vi.mocked(fetchOrderablesByIdentities).mockClear();
  vi.mocked(fetchOrderablesByIdentities).mockImplementation(
    async (ids) => ids.map((id) => ({ ...product(), id: id.id })) as never,
  );
  const capture = captureSingle(
    client,
    { id: 'r', userId: 'u', generation: 0, session: getSessionScope() },
    base,
    'read',
  );
  const { withRequestPriority } = await import('@/lib/background-request-gate');
  const pending = Promise.withResolvers<void>();
  const foreground = withRequestPriority(false, undefined, () => pending.promise);
  try {
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => expect(idle).toBeDefined());
    expect(fetchOrderablesByIdentities).not.toHaveBeenCalled();
    releaseIdle();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(fetchOrderablesByIdentities).not.toHaveBeenCalled();
    pending.resolve();
    await foreground;
    await capture;
    idle = undefined;
    const reordered = captureSingle(
      client,
      { id: 'r', userId: 'u', generation: 0, session: getSessionScope() },
      { ...base, availableProducts: base.availableProducts?.toReversed() },
      'read',
    );
    await waitFor(() => expect(idle).toBeDefined());
    releaseIdle();
    await reordered;
    expect(vi.mocked(fetchOrderablesByIdentities).mock.calls.map(([ids]) => ids.length)).toEqual([
      100, 100, 50,
    ]);
  } finally {
    pending.resolve();
    await foreground;
    await capture;
    vi.unstubAllGlobals();
    client.clear();
  }
});
