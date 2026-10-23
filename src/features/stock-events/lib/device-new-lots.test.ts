import { expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { readDeviceNewLots } from '@/features/stock-events/lib/device-new-lots';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';

it('reads owner new lots from queued, refused and accepted work and deduplicates by code and expiry', async () => {
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'device-lots-user',
    username: 'Ada',
    accessToken: 'token',
  });
  const db = getLocalDb();
  const queue = db.table(LOCAL_TABLES.stockEventQueue);
  const errors = db.table(LOCAL_TABLES.stockEventSyncErrors);
  const receipts = db.table(LOCAL_TABLES.stockEventReceipts);
  await Promise.all([queue.clear(), errors.clear(), receipts.clear()]);
  const lot = { lotCode: 'NEW-1', expirationDate: '2030-01-01', tradeItemId: 'trade' };
  const event = (id: string, lots: object[], userId = 'device-lots-user') => ({
    localEventId: id,
    userId,
    lines: lots.map((lot) => ({ lot })),
  });
  await queue.bulkAdd([
    event('queued', [lot, { ...lot, id: 'existing', lotCode: 'EXISTING' }]),
    event('other-owner', [{ ...lot, lotCode: 'OTHER' }], 'someone-else'),
  ]);
  await errors.add({
    localEventId: 'refused',
    event: event('refused', [
      { ...lot, lotCode: 'new-1' },
      { ...lot, lotCode: 'REFUSED' },
    ]),
  });
  await receipts.bulkAdd([
    {
      draftId: 'accepted',
      revision: 1,
      localEventId: 'accepted',
      event: event('accepted', [{ ...lot, lotCode: 'ACCEPTED' }]),
    },
    { draftId: 'minimal', revision: 1, localEventId: 'minimal' },
  ]);
  expect(await readDeviceNewLots()).toEqual([
    { ...lot, lotCode: 'new-1' },
    { ...lot, lotCode: 'REFUSED' },
    { ...lot, lotCode: 'ACCEPTED' },
  ]);
});
