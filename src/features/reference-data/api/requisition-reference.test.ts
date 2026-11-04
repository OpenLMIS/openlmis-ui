import { QueryClient } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import * as api from '@/features/reference-data/api/api';
import {
  currencySettingsOptions,
  deploymentTimeZoneOptions,
  minimalFacilitiesOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import { requisitionReferences } from '@/features/reference-data/api/requisition-reference';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchUserRecord: vi.fn(async () => ({
    id: 'u',
    roleAssignments: [{ roleId: 'r', programId: 'p', supervisoryNodeId: 'n' }],
  })),
  fetchRoles: vi.fn(async () => [
    { id: 'r', rights: [{ name: 'REQUISITION_VIEW' }, { name: 'REQUISITION_APPROVE' }] },
  ]),
  fetchMinimalFacilities: vi.fn(async () => [{ id: 'f' }]),
  fetchPrograms: vi.fn(async () => [{ id: 'p' }]),
  fetchUserPrograms: vi.fn(async () => [{ id: 'p' }]),
  fetchSupervisoryNodesByIds: vi.fn(async (ids: string[]) =>
    ids.map((id) => ({ id, requisitionGroup: { id: 'g' } })),
  ),
  fetchRequisitionGroup: vi.fn(async () => ({ id: 'g' })),
  storedTimeZone: vi.fn(() => null),
  fetchCurrencySettings: vi.fn(async () => ({ timeZoneId: 'UTC' })),
}));
beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: 'u' });
});
it('shares in-flight and completed reference reads between sign-in downloads and pages', async () => {
  const client = new QueryClient();
  const download = requisitionReferences(client, 'u', { backgroundRead: true });
  const page = client.fetchQuery(minimalFacilitiesOptions());
  await Promise.all([download, page, requisitionReferences(client, 'u')]);
  await client.fetchQuery(supervisoryNodesByIdsOptions(['n']));
  for (const fn of [
    api.fetchUserRecord,
    api.fetchRoles,
    api.fetchMinimalFacilities,
    api.fetchPrograms,
    api.fetchUserPrograms,
    api.fetchRequisitionGroup,
  ])
    expect(fn).toHaveBeenCalledTimes(1);
  expect(
    vi.mocked(api.fetchSupervisoryNodesByIds).mock.calls.filter(([ids]) => ids.length),
  ).toHaveLength(1);
  await client.invalidateQueries({ queryKey: minimalFacilitiesOptions().queryKey });
  await client.fetchQuery(minimalFacilitiesOptions());
  expect(api.fetchMinimalFacilities).toHaveBeenCalledTimes(2);
  client.clear();
});
it('shares the locale settings read between the time zone and currency lookups', async () => {
  const client = new QueryClient();
  await Promise.all([
    client.fetchQuery(currencySettingsOptions()),
    client.fetchQuery(deploymentTimeZoneOptions()),
  ]);
  expect(api.fetchCurrencySettings).toHaveBeenCalledTimes(1);
  client.clear();
});

it('stops dependent reference reads when identity changes during sign-in preloading', async () => {
  let finish!: (user: never) => void;
  vi.mocked(api.fetchUserRecord).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const client = new QueryClient();
  const loading = requisitionReferences(client, 'u');
  const rejected = expect(loading).rejects.toThrow();
  useLoginData.setState({ referenceDataUserId: 'other' });
  finish({ id: 'u', roleAssignments: [] } as never);
  await rejected;
  expect(api.fetchSupervisoryNodesByIds).not.toHaveBeenCalled();
  client.clear();
});

it('shares a pending node superset with program-specific approval lookups', async () => {
  const client = new QueryClient();
  const all = client.fetchQuery(supervisoryNodesByIdsOptions(['n', 'other']));
  const subset = client.fetchQuery(supervisoryNodesByIdsOptions(['n']));
  await expect(subset).resolves.toEqual([{ id: 'n', requisitionGroup: { id: 'g' } }]);
  await all;
  expect(api.fetchSupervisoryNodesByIds).toHaveBeenCalledTimes(1);
  await client.fetchQuery({ ...supervisoryNodesByIdsOptions(['n']), staleTime: 0 });
  expect(api.fetchSupervisoryNodesByIds).toHaveBeenCalledTimes(2);
  client.clear();
});
