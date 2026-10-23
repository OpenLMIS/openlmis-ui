import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { ValidAssignment } from '@/components/valid-assignments/types';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchValidAssignments } from '@/features/reference-data/api/api';
import { validDestinationsOptions } from '@/features/reference-data/api/queries';
import { counterpartyOptions } from '@/features/stock-events/lib/event-kinds';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';

vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reference-data/api/api')>()),
  fetchValidAssignments: vi.fn(),
}));

const scope = { facilityId: 'home', programId: 'program', facilityTypeId: 'type', scanning: false };
const filter = { facilityId: 'home', programId: 'program' };
const assignment = (name: string): ValidAssignment => ({
  id: name,
  name,
  programId: 'program',
  facilityTypeId: 'type',
  isFreeTextAllowed: false,
  geoLevelAffinityId: null,
  node: { id: `${name}-node`, referenceId: name, refDataFacility: false },
});

afterEach(async () => {
  await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).clear();
  useLoginData.getState().clearLoginData();
});

it('reads downloaded destinations offline under the server key and refetches them on reconnect', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'owner', username: 'owner', accessToken: 'token' });
  await getLocalDb()
    .table(LOCAL_TABLES.homeStockDownloads)
    .put({
      ...scope,
      userId: 'owner',
      generation: 'g',
      fetchedAt: Date.now(),
      formatVersion: 6,
      destinations: [assignment('Device')],
      sources: [],
      cards: [],
      reasons: [],
      tradeItems: [],
      identities: [],
    } satisfies HomeStockBundle);
  vi.mocked(fetchValidAssignments).mockResolvedValue([assignment('Server')]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const options = counterpartyOptions('destination', filter, scope);
  expect(options.queryKey).toEqual(validDestinationsOptions(filter).queryKey);
  onlineManager.setOnline(false);
  expect((await client.fetchQuery(options)).map(({ name }) => name)).toEqual(['Device']);
  expect(fetchValidAssignments).not.toHaveBeenCalled();
  onlineManager.setOnline(true);
  expect((await client.fetchQuery(options)).map(({ name }) => name)).toEqual(['Server']);
  client.clear();
});
