import { onlineManager, QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { fetchSystemNotifications } from '@/features/system-notifications/api/api';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
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

  it('stops paging after disconnect and preserves the complete cached list', async () => {
    get.mockClear();
    const firstPage = Promise.withResolvers<{
      data: { content: { id: string }[]; totalPages: number };
    }>();
    get.mockReturnValueOnce(firstPage.promise).mockResolvedValueOnce({
      data: { content: [{ id: 'another' }], totalPages: 2 },
    });
    const cache = new QueryClient();
    const options = systemNotificationsOptions();
    const cached = [{ id: 'cached', title: null, message: 'Last complete notice' }];
    cache.setQueryData(options.queryKey, cached, { updatedAt: 1 });
    try {
      const refresh = cache.fetchQuery(options).catch((error: unknown) => error);
      expect(get).toHaveBeenCalledOnce();
      onlineManager.setOnline(false);
      firstPage.resolve({ data: { content: [{ id: 'partial' }], totalPages: 2 } });
      expect(await refresh).toBeInstanceOf(Error);
      expect(get).toHaveBeenCalledOnce();
      expect(cache.getQueryData(options.queryKey)).toEqual(cached);
    } finally {
      cache.clear();
      get.mockReset();
    }
  });

  it('pauses a scheduled refresh retry after disconnect and keeps cached notices', async () => {
    vi.useFakeTimers();
    const cache = new QueryClient({
      defaultOptions: { queries: { networkMode: 'always', retry: 1, retryDelay: 1000 } },
    });
    const options = systemNotificationsOptions();
    const cached = [{ id: 'cached', title: null, message: 'Last complete notice' }];
    cache.setQueryData(options.queryKey, cached, { updatedAt: 1 });
    get.mockReset().mockRejectedValue(new Error('Unavailable'));
    try {
      const refresh = cache.fetchQuery(options).catch(() => undefined);
      await vi.advanceTimersByTimeAsync(0);
      expect(cache.getQueryState(options.queryKey)?.fetchFailureCount).toBe(1);
      onlineManager.setOnline(false);
      await vi.advanceTimersByTimeAsync(1000);
      expect(get).toHaveBeenCalledOnce();
      expect(cache.getQueryState(options.queryKey)?.fetchStatus).toBe('paused');
      expect(cache.getQueryData(options.queryKey)).toEqual(cached);
      await cache.cancelQueries({ queryKey: options.queryKey });
      await refresh;
    } finally {
      cache.clear();
      get.mockReset();
      vi.useRealTimers();
    }
  });
});
