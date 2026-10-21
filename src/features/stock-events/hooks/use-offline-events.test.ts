import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';

beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'shell-events', username: 'Ada', accessToken: 'token' });
  for (const table of [
    LOCAL_TABLES.stockEventQueue,
    LOCAL_TABLES.stockEventSyncErrors,
    LOCAL_TABLES.stockEventReceipts,
  ])
    await getLocalDb().table(table).clear();
});

it('avoids full reads until owned work appears and updates the shared shell summary live', async () => {
  const receipts = vi.spyOn(getLocalDb().table(LOCAL_TABLES.stockEventReceipts), 'toArray');
  const result = renderHook(() => useOfflineEvents(true, true)).result;
  await waitFor(() => expect(result.current.events).toEqual([]));
  expect(receipts).not.toHaveBeenCalled();
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .put({ localEventId: 'other', userId: 'someone-else', status: 'queued' });
  await waitFor(() => expect(result.current.hasDeviceEvents).toBe(false));
  expect(receipts).not.toHaveBeenCalled();
  await getLocalDb().table(LOCAL_TABLES.stockEventQueue).clear();
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .put({ localEventId: 'own', userId: 'shell-events', status: 'queued' });
  await waitFor(() => expect(result.current.hasDeviceEvents).toBe(true));
  expect(result.current.events).toEqual([expect.objectContaining({ localEventId: 'own' })]);
  expect(receipts).toHaveBeenCalled();
});
