import { expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { LOCAL_TABLES, localTable } from '@/integrations/local-db';
import { defineDownloadProvider } from '@/lib/download-provider';
import { offlineAccessFixture } from '@/tests/offline-access';

it('rejects a fetched record for another owner or scope before it can be published', async () => {
  const fetch = vi.fn(async () => ({
    userId: 'owner',
    generation: 'g',
    fetchedAt: 1,
    scope: 'other',
  }));
  const provider = defineDownloadProvider({
    refreshOn: ['sign-in', 'periodic', 'force', 'accepted'],
    id: 'example',
    label: 'offline.download.home-stock',
    table: LOCAL_TABLES.homeStockDownloads,
    scopes: () => [{ id: 'scope', name: 'Scope', key: 'scope' }],
    fetch,
    accepts: (record, _access, scope) => record.scope === scope.id,
    isFresh: () => true,
  });
  const access = offlineAccessFixture();
  const [task] = provider.tasks(access);
  const signal = new AbortController().signal;
  await expect(task.fetch(signal)).rejects.toThrow('scope mismatch');
  fetch.mockResolvedValueOnce({ userId: 'other', generation: 'g', fetchedAt: 1, scope: 'scope' });
  await expect(task.fetch(signal)).rejects.toThrow('scope mismatch');
  fetch.mockResolvedValueOnce({ userId: 'owner', generation: 'g', fetchedAt: 1, scope: 'scope' });
  await expect(task.fetch(signal)).resolves.toMatchObject({ userId: 'owner', scope: 'scope' });
  expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'scope' }), signal);
});

it('distinguishes eligibility, missing owner data, outdated and ready scope records', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'owner', username: 'owner', accessToken: 'token' });
  const scope = { id: 'scope', name: 'Scope', key: ['home', 'scope'] };
  const record = {
    userId: 'owner',
    generation: 'g',
    fetchedAt: 1,
    facilityId: 'home',
    programId: 'scope',
    complete: true,
  };
  const provider = defineDownloadProvider({
    id: 'example',
    label: 'offline.download.home-stock',
    table: LOCAL_TABLES.homeStockDownloads,
    refreshOn: ['sign-in'],
    scopes: () => [scope],
    fetch: async () => record,
    accepts: (value) => value.complete,
    isFresh: () => true,
  });
  try {
    await localTable(LOCAL_TABLES.homeStockDownloads).clear();
    await localTable(LOCAL_TABLES.offlineAccess).clear();
    expect(await provider.readScopeState(scope)).toBe('missing');
    await localTable(LOCAL_TABLES.offlineAccess).put(offlineAccessFixture());
    expect(await provider.readScopeState({ ...scope, key: ['other', 'scope'] })).toBe('ineligible');
    expect(await provider.readScopeState(scope)).toBe('missing');
    await localTable(LOCAL_TABLES.homeStockDownloads).put({ ...record, userId: 'other' });
    expect(await provider.readScopeState(scope)).toBe('missing');
    await localTable(LOCAL_TABLES.homeStockDownloads).put({ ...record, complete: false });
    expect(await provider.readScopeState(scope)).toBe('outdated');
    await localTable(LOCAL_TABLES.homeStockDownloads).put(record);
    expect(await provider.readScopeState(scope)).toBe('ready');
    const [task] = provider.tasks(offlineAccessFixture());
    expect(task.isComplete(record)).toBe(true);
    expect(task.isComplete({ ...record, userId: 'other' })).toBe(false);
    expect(task.isComplete(undefined)).toBe(false);
  } finally {
    await localTable(LOCAL_TABLES.homeStockDownloads).clear();
    await localTable(LOCAL_TABLES.offlineAccess).clear();
    useLoginData.getState().clearLoginData();
  }
});
