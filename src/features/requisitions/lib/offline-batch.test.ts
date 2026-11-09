import { QueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { cachedBatchMembership } from '@/features/requisitions/lib/offline-batch';
import { queryKeys } from '@/lib/key-factory';

it('accepts only complete recent approval results for the selected program', () => {
  const client = new QueryClient();
  const key = [...queryKeys.requisitions.all, 'approval', {}];
  const data = { content: [{ id: 'a', program: { id: 'p' } }] };
  client.setQueryData(key, data);
  expect(cachedBatchMembership(client, ['a'], 'p')).toEqual({
    found: data.content,
    remaining: new Set(),
  });
  expect(cachedBatchMembership(client, ['a', 'b'], 'p')).toBeUndefined();
  expect(cachedBatchMembership(client, ['a'], 'other')).toBeUndefined();
  client.setQueryData(key, data, { updatedAt: Date.now() - 61_000 });
  expect(cachedBatchMembership(client, ['a'], 'p')).toBeUndefined();
  client.clear();
});
