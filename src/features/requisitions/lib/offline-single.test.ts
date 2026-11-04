import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { orderablesByIdentitiesOptions } from '@/features/reference-data/api/queries';
import { product, record } from './fixtures/builders';
import { captureSingle } from './offline-single';
import type { RequisitionRecord } from './types';

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
  );
  expect(refs.products.map((p) => p.id)).toEqual(['product', 'another']);
  client.clear();
});
