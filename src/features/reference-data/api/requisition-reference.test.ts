import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import * as api from '@/features/reference-data/api/api';
import {
  currencySettingsOptions,
  deploymentTimeZoneOptions,
  minimalFacilitiesOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import { requisitionReferences } from '@/features/reference-data/api/requisition-reference';
import { preloadRequisitionReferences, warmRequisitionChunks } from '@/routes/-requisition-preload';

vi.mock('@/features/auth/api/api', () => ({
  fetchPermissionStrings: vi.fn(async () => ['REQUISITION_VIEW']),
}));
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
it('shares the locale settings read between the time zone and currency lookups', async () => {
  const client = new QueryClient();
  await Promise.all([
    client.fetchQuery(currencySettingsOptions()),
    client.fetchQuery(deploymentTimeZoneOptions()),
  ]);
  expect(api.fetchCurrencySettings).toHaveBeenCalledTimes(1);
  client.clear();
});

it('shares a pending node superset with program-specific approval lookups', async () => {
  const client = new QueryClient();
  const all = client.fetchQuery(supervisoryNodesByIdsOptions(['n', 'other']));
  const subset = client.fetchQuery(supervisoryNodesByIdsOptions(['n']));
  await expect(subset).resolves.toEqual([{ id: 'n', requisitionGroup: { id: 'g' } }]);
  await all;
  expect(api.fetchSupervisoryNodesByIds).toHaveBeenCalledTimes(1);
  await client.fetchQuery({
    ...supervisoryNodesByIdsOptions(['n'], undefined, true),
    staleTime: 0,
  });
  expect(api.fetchSupervisoryNodesByIds).toHaveBeenCalledTimes(2);
  client.clear();
});

it('forces download references to the server despite a populated session cache', async () => {
  const client = new QueryClient();
  await requisitionReferences(client, await api.fetchUserRecord('u'));
  await requisitionReferences(client, await api.fetchUserRecord('u'), { backgroundDownload: true });
  expect(api.fetchUserRecord).toHaveBeenCalledTimes(2);
  expect(api.fetchUserPrograms).not.toHaveBeenCalled();
  expect(api.fetchRoles).toHaveBeenCalledTimes(2);
  expect(api.fetchRequisitionGroup).toHaveBeenCalledTimes(2);
  expect(api.fetchMinimalFacilities).toHaveBeenCalledTimes(2);
  expect(api.fetchPrograms).toHaveBeenCalledTimes(2);
  client.clear();
});
it('classifies missing nodes as unavailable local data', async () => {
  vi.mocked(api.fetchSupervisoryNodesByIds).mockResolvedValueOnce([]);
  const client = new QueryClient();
  await expect(requisitionReferences(client, await api.fetchUserRecord('u'))).rejects.toMatchObject(
    {
      name: 'LocalDataUnavailableError',
    },
  );
  client.clear();
});
it('does not join a background node superset from a page', async () => {
  const client = new QueryClient();
  let finish!: (nodes: never[]) => void;
  vi.mocked(api.fetchSupervisoryNodesByIds).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const download = client.fetchQuery(
    supervisoryNodesByIdsOptions(['n', 'other'], { backgroundDownload: true }),
  );
  await expect(client.fetchQuery(supervisoryNodesByIdsOptions(['n']))).resolves.toHaveLength(1);
  expect(api.fetchSupervisoryNodesByIds).toHaveBeenCalledTimes(2);
  finish([]);
  await download;
  client.clear();
});

it('preloads with foreground config and leaves sibling requests alive on failure', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.fetchRoles).mockRejectedValueOnce(new Error('Refused'));
  await expect(preloadRequisitionReferences(client, 'u')).rejects.toThrow('Refused');
  await client.fetchQuery(minimalFacilitiesOptions());
  expect(api.fetchMinimalFacilities).toHaveBeenCalledTimes(1);
  expect(api.fetchMinimalFacilities).toHaveBeenCalledWith(undefined);
  expect(api.fetchUserRecord).toHaveBeenCalledWith('u', undefined);
  client.clear();
});
it('does not preload requisition lookups for an unrelated user', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValueOnce([]);
  vi.mocked(api.fetchUserRecord).mockResolvedValueOnce({ id: 'u', roleAssignments: [] } as never);
  const client = new QueryClient();
  await preloadRequisitionReferences(client, 'u');
  expect(api.fetchRoles).not.toHaveBeenCalled();
  client.clear();
});

it('warms only requisition chunks at idle and cancels scheduling on teardown', () => {
  let callback!: () => void;
  const cancel = vi.fn();
  vi.stubGlobal('requestIdleCallback', (task: () => void) => {
    callback = task;
    return 7;
  });
  vi.stubGlobal('cancelIdleCallback', cancel);
  const loadRouteChunk = vi.fn();
  const router = {
    routesById: {
      home: { id: '/home' },
      view: { id: '/requisitions/view' },
      orders: { id: '/requisitions/create-orders' },
    },
    loadRouteChunk,
  };
  try {
    const stop = warmRequisitionChunks(router as never);
    expect(loadRouteChunk).not.toHaveBeenCalled();
    callback();
    expect(loadRouteChunk).toHaveBeenCalledTimes(2);
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
    useLoginData.setState({ referenceDataUserId: 'other' });
    callback();
    expect(loadRouteChunk).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('starts picker references before a granted user record resolves', async () => {
  let finish!: (user: never) => void;
  vi.mocked(api.fetchUserRecord).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const client = new QueryClient();
  const loading = preloadRequisitionReferences(client, 'u');
  await waitFor(() => expect(api.fetchUserRecord).toHaveBeenCalled());
  expect(api.fetchMinimalFacilities).toHaveBeenCalled();
  expect(api.fetchUserPrograms).toHaveBeenCalled();
  finish({ id: 'u', roleAssignments: [] } as never);
  await loading;
  client.clear();
});

it('keeps sign-in warming to picker references so nodes and groups do not compete with pages', async () => {
  const client = new QueryClient();
  await preloadRequisitionReferences(client, 'u');
  expect(api.fetchMinimalFacilities).toHaveBeenCalledOnce();
  expect(api.fetchUserPrograms).toHaveBeenCalledOnce();
  expect(api.fetchSupervisoryNodesByIds).not.toHaveBeenCalled();
  expect(api.fetchRequisitionGroup).not.toHaveBeenCalled();
  client.clear();
});
