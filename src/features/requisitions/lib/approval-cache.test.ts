import { QueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { removeApprovedFromLists } from '@/features/requisitions/lib/approval-cache';
import { queryKeys } from '@/lib/key-factory';

it('removes confirmed approvals from every cached filter before returning to the list', () => {
  const client = new QueryClient();
  const base = [...queryKeys.requisitions.all, 'approval'];
  const keys = [
    [...base, { page: 0 }],
    [...base, { program: 'p', page: 1 }],
  ];
  for (const key of keys)
    client.setQueryData(key, {
      content: [{ id: 'approved' }, { id: 'waiting' }],
      totalElements: 5,
    });
  removeApprovedFromLists(client, ['approved']);
  for (const key of keys)
    expect(client.getQueryData(key)).toEqual({ content: [{ id: 'waiting' }], totalElements: 4 });
  client.clear();
});
