import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useDeviceEvents } from '@/features/stock-events/hooks/use-device-events';
import { getLocalDb } from '@/integrations/local-db';

beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'shell-events', username: 'Ada', accessToken: 'token' });
  for (const table of ['stockEventQueue', 'stockEventSyncErrors', 'stockEventReceipts'])
    await getLocalDb().table(table).clear();
});

it('avoids full reads until owned work appears and updates the shared shell summary live', async () => {
  const receipts = vi.spyOn(getLocalDb().table('stockEventReceipts'), 'toArray');
  const result = renderHook(() => useDeviceEvents(true, true)).result;
  await waitFor(() => expect(result.current.events).toEqual([]));
  expect(receipts).not.toHaveBeenCalled();
  await getLocalDb()
    .table('stockEventQueue')
    .put({ localEventId: 'other', userId: 'someone-else', status: 'queued' });
  await waitFor(() => expect(result.current.hasDeviceEvents).toBe(false));
  expect(receipts).not.toHaveBeenCalled();
  await getLocalDb().table('stockEventQueue').clear();
  await getLocalDb()
    .table('stockEventQueue')
    .put({ localEventId: 'own', userId: 'shell-events', status: 'queued' });
  await waitFor(() => expect(result.current.hasDeviceEvents).toBe(true));
  expect(result.current.events).toEqual([expect.objectContaining({ localEventId: 'own' })]);
  expect(receipts).toHaveBeenCalled();
});
