import { describe, expect, it, vi } from 'vitest';
import { fetchSystemNotifications } from '@/features/system-notifications/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

const get = vi.mocked(client.get);

describe('fetchSystemNotifications', () => {
  it('reads every active page with author details, newest first', async () => {
    get
      .mockResolvedValueOnce({ data: { content: [{ id: 'new' }], totalPages: 2 } })
      .mockResolvedValueOnce({ data: { content: [{ id: 'old' }], totalPages: 2 } });

    await expect(fetchSystemNotifications()).resolves.toEqual([{ id: 'new' }, { id: 'old' }]);
    expect(get.mock.calls.map(([url, config]) => [url, config?.params])).toEqual([
      [
        '/systemNotifications',
        { isDisplayed: true, expand: 'author', page: 0, size: 100, sort: 'createdDate,desc' },
      ],
      [
        '/systemNotifications',
        { isDisplayed: true, expand: 'author', page: 1, size: 100, sort: 'createdDate,desc' },
      ],
    ]);
  });
});
