import { expect, it, vi } from 'vitest';
import { defineDownloadProvider, downloadProviders } from '@/lib/download-provider';
import type { OfflineAccess } from '@/lib/offline-access';

it('rejects a fetched record for another owner or scope before it can be published', async () => {
  const fetch = vi.fn(async () => ({
    userId: 'owner',
    generation: 'g',
    fetchedAt: 1,
    scope: 'other',
  }));
  const provider = defineDownloadProvider({
    id: 'example',
    label: 'offline.download.home-stock',
    table: 'example',
    eligible: () => true,
    scopes: () => [{ id: 'scope', name: 'Scope', key: 'scope' }],
    fetch,
    accepts: (record, _access, scope) => record.scope === scope.id,
    isFresh: () => true,
  });
  const access = { userId: 'owner' } as OfflineAccess;
  const [task] = provider.tasks(access);
  const signal = new AbortController().signal;
  await expect(task.fetch(signal)).rejects.toThrow('scope mismatch');
  fetch.mockResolvedValueOnce({ userId: 'other', generation: 'g', fetchedAt: 1, scope: 'scope' });
  await expect(task.fetch(signal)).rejects.toThrow('scope mismatch');
  fetch.mockResolvedValueOnce({ userId: 'owner', generation: 'g', fetchedAt: 1, scope: 'scope' });
  await expect(task.fetch(signal)).resolves.toMatchObject({ userId: 'owner', scope: 'scope' });
  expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'scope' }), signal);
  expect(() => downloadProviders([provider, provider])).toThrow('Duplicate download provider');
});
