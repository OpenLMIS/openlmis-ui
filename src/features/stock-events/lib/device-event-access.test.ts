import { onlineManager, QueryClient } from '@tanstack/react-query';
import { beforeEach, expect, it } from 'vitest';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { hasOwnDeviceEvents } from '@/features/stock-events/lib/device-event-access';
import { getLocalDb } from '@/integrations/local-db';
import { parsePermissions } from '@/lib/permissions';
import { Route } from '@/routes/(protected)/_protected.offline-events';

beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'device-owner', username: 'owner', accessToken: 'token' });
  for (const table of ['stockEventQueue', 'stockEventSyncErrors', 'stockEventReceipts'])
    await getLocalDb().table(table).clear();
});
it('opens the local recovery route without adjustment rights only for the owning pending work', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  client.setQueryData(permissionsOptions('device-owner').queryKey, parsePermissions([]));
  const loader = Route.options.loader as (input: unknown) => Promise<void>;
  await expect(loader({ context: { queryClient: client } })).rejects.toThrow('Missing right');
  await getLocalDb()
    .table('stockEventQueue')
    .put({ localEventId: 'own', userId: 'device-owner', status: 'queued' });
  await expect(loader({ context: { queryClient: client } })).resolves.toBeUndefined();
  await getLocalDb().table('stockEventQueue').clear();
  await getLocalDb().table('stockEventReceipts').put({ draftId: 'accepted', revision: 1 });
  await getLocalDb()
    .table('stockEventSyncErrors')
    .put({ localEventId: 'dismissed', dismissedAt: 1, event: { userId: 'device-owner' } });
  await getLocalDb()
    .table('stockEventQueue')
    .put({ localEventId: 'other', userId: 'someone-else' });
  await getLocalDb()
    .table('stockEventSyncErrors')
    .put({
      localEventId: 'accepted-after-review',
      category: 'uncertain',
      resolvedAt: 1,
      event: { userId: 'device-owner' },
    });
  expect(await hasOwnDeviceEvents()).toBe(false);
  client.clear();
});

it('opens empty Offline Events on an offline reload before any access download completes', async () => {
  await getLocalDb().table('offlineAccess').clear();
  onlineManager.setOnline(false);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: 'always' } },
  });
  const loader = Route.options.loader as (input: unknown) => Promise<void>;
  try {
    await expect(loader({ context: { queryClient: client } })).resolves.toBeUndefined();
  } finally {
    client.clear();
  }
});
