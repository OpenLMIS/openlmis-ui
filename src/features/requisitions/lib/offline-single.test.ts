import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { fetchOrderablesByIdentities } from '@/features/reference-data/api/api';
import { orderablesByIdentitiesOptions } from '@/features/reference-data/api/queries';
import { fetchStatusMessages } from '../api/api';
import { product, record } from './fixtures/builders';
import { captureSingle } from './offline-capture-single';
import type { RequisitionRecord } from './types';

vi.mock('../api/api', () => ({ fetchStatusMessages: vi.fn(async () => []) }));
vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reference-data/api/api')>()),
  fetchOrderablesByIdentities: vi.fn(async () => []),
}));
vi.mock('./offline-access', () => ({
  readRequisitionAccess: vi.fn(async () => ({})),
  mayViewCopy: () => true,
}));
vi.mock('./offline-copies', async (original) => ({
  ...(await original<typeof import('./offline-copies')>()),
  commitCopy: vi.fn(),
}));
it('reuses the grid and available-product queries when capturing a copy', async () => {
  const { requisitionGridQueries, requisitionStatusMessagesOptions } = await import(
    '../api/queries'
  );
  const { facilityOptions } = await import('@/features/reference-data/api/queries');
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
  const queries = requisitionGridQueries(base);
  client.setQueryData([...queries[0].queryKey], [product()]);
  client.setQueryData([...queries[1].queryKey], []);
  client.setQueryData([...queries[2].queryKey], { id: base.processingPeriod.id });
  client.setQueryData([...queries[3].queryKey], {});
  client.setQueryData([...queries[4].queryKey], { id: base.program.id });
  client.setQueryData([...facilityOptions(base.facility.id).queryKey], { id: base.facility.id });
  client.setQueryData([...requisitionStatusMessagesOptions(base.id).queryKey], []);
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
  const { requisitionGridQueries, requisitionStatusMessagesOptions } = await import(
    '../api/queries'
  );
  const { facilityOptions } = await import('@/features/reference-data/api/queries');
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
  client.setQueryData([...queries[1].queryKey], []);
  client.setQueryData([...queries[2].queryKey], { id: 'period' });
  client.setQueryData([...queries[3].queryKey], {});
  client.setQueryData([...queries[4].queryKey], { id: 'p' });
  client.setQueryData([...facilityOptions('f').queryKey], { id: 'f' });
  client.setQueryData(requisitionStatusMessagesOptions('r').queryKey, []);
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
