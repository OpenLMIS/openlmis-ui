import { QueryClient } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { facilityTypeApprovedOrderablesOptions } from '@/features/reference-data/api/queries';
import {
  fetchSupplyPartners,
  removeSupplyPartnerFacility,
  SupplyPartnerConflictError,
  saveSupplyPartner,
} from '@/features/supply-partners/api/api';
import { toSupplyPartnerDraft } from '@/features/supply-partners/lib/supply-partner-form';
import type { SupplyPartner } from '@/features/supply-partners/lib/types';
import { client } from '@/integrations/axios';
import { assertSessionScope } from '@/lib/session-scope';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/session-scope', () => ({ getSessionScope: () => 1, assertSessionScope: vi.fn() }));
const get = vi.mocked(client.get);
const put = vi.mocked(client.put);
const saved: SupplyPartner = {
  id: 'sp',
  code: 'SUP',
  name: 'Supplier',
  associations: [
    {
      id: 'old',
      program: { id: 'p' },
      supervisoryNode: { id: 'n' },
      facilities: [{ id: 'f' }],
      orderables: [{ id: 'o' }],
    },
  ],
};
beforeEach(() => vi.resetAllMocks());

it('sends only supported collection paging parameters even if passed richer table state', async () => {
  get.mockResolvedValueOnce({ data: { content: [] } });
  await fetchSupplyPartners({ page: 1, size: 20, name: 'unsupported', sort: 'name' } as Parameters<
    typeof fetchSupplyPartners
  >[0]);
  expect(get).toHaveBeenCalledWith('/supplyPartners', { params: { page: 1, size: 20 } });
});

it('rereads outside the detail cache and includes the matching body id, ignoring regenerated association ids', async () => {
  const latest = structuredClone(saved);
  latest.associations[0].id = 'regenerated';
  get.mockResolvedValueOnce({ data: latest });
  put.mockResolvedValueOnce({ data: { ...latest, name: 'Edited' } });
  const draft = { ...toSupplyPartnerDraft(saved), name: 'Edited' };
  await saveSupplyPartner(saved, draft);
  expect(get).toHaveBeenCalledWith('/supplyPartners/sp');
  expect(put).toHaveBeenCalledWith('/supplyPartners/sp', {
    id: 'sp',
    code: 'SUP',
    name: 'Edited',
    associations: [
      {
        program: { id: 'p' },
        supervisoryNode: { id: 'n' },
        facilities: [{ id: 'f' }],
        orderables: [{ id: 'o' }],
      },
    ],
  });
  expect(get.mock.invocationCallOrder[0]).toBeLessThan(put.mock.invocationCallOrder[0]);
});

it('does not PUT an unchanged draft or overwrite a changed or deleted partner', async () => {
  await expect(saveSupplyPartner(saved, toSupplyPartnerDraft(saved))).resolves.toBeNull();
  expect(get).not.toHaveBeenCalled();
  const draft = { ...toSupplyPartnerDraft(saved), name: 'Edited' };
  get.mockResolvedValueOnce({ data: { ...saved, name: 'Concurrent edit' } });
  await expect(saveSupplyPartner(saved, draft)).rejects.toBeInstanceOf(SupplyPartnerConflictError);
  get.mockRejectedValueOnce(new Error('404'));
  await expect(saveSupplyPartner(saved, draft)).rejects.toThrow('404');
  expect(put).not.toHaveBeenCalled();
});

it('stops before PUT when the session changes during the fresh read', async () => {
  get.mockResolvedValueOnce({ data: saved });
  vi.mocked(assertSessionScope)
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw new Error('Session ended');
    });
  await expect(
    saveSupplyPartner(saved, { ...toSupplyPartnerDraft(saved), name: 'Edited' }),
  ).rejects.toThrow('Session ended');
  expect(put).not.toHaveBeenCalled();
});

it('refreshes approvals before pruning and keeps the original memberships when that refresh fails', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const association = {
    programId: 'p',
    supervisoryNodeId: 'n',
    facilityIds: ['a', 'b'],
    orderableIds: ['o1', 'o2'],
  };
  const facilities = [
    { id: 'a', type: { id: 'ta', code: 'A', name: 'Type A' } },
    { id: 'b', type: { id: 'tb', code: 'B', name: 'Type B' } },
  ];
  await expect(
    removeSupplyPartnerFacility(
      queryClient,
      { ...association, facilityIds: ['a'] },
      'a',
      [],
      'P',
      false,
    ),
  ).rejects.toThrow('Selected facilities have not been resolved');
  expect(get).not.toHaveBeenCalled();
  const options = facilityTypeApprovedOrderablesOptions({
    facilityTypeCodes: ['B'],
    programCode: 'P',
  });
  queryClient.setQueryData(options.queryKey, [
    { id: 'o1', productCode: 'O1', fullProductName: 'Old Approval', description: null },
  ]);
  get.mockRejectedValueOnce(new Error('Approval read failed'));
  await expect(
    removeSupplyPartnerFacility(queryClient, association, 'a', facilities, 'P', true),
  ).rejects.toThrow('Approval read failed');
  expect(association.facilityIds).toEqual(['a', 'b']);
  expect(association.orderableIds).toEqual(['o1', 'o2']);
  get.mockResolvedValueOnce({ data: { content: [{ orderable: { id: 'o2' } }] } });
  await expect(
    removeSupplyPartnerFacility(queryClient, association, 'a', facilities, 'P', true),
  ).resolves.toEqual({
    association: { ...association, facilityIds: ['b'], orderableIds: ['o2'] },
    removedOrderableIds: ['o1'],
  });
  expect(get).toHaveBeenCalledTimes(2);
});
