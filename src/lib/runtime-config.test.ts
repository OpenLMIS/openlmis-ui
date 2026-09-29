import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuthClientCredentials, loadRuntimeConfig } from '@/lib/runtime-config';

afterEach(() => vi.unstubAllGlobals());

const config = { authServerClientId: 'runtime-client', authServerClientSecret: 'runtime-secret' };

describe('loadRuntimeConfig', () => {
  it('loads again once the connection is back, when the first try found no network', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(new Response(JSON.stringify(config)));
    vi.stubGlobal('fetch', fetch);

    await loadRuntimeConfig();
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(getAuthClientCredentials().clientId).toBe('runtime-client'));

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
