import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthClientCredentials,
  getDeploymentFlags,
  loadRuntimeConfig,
} from '@/lib/runtime-config';

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

describe('getDeploymentFlags', () => {
  it('reads the feature flags the container wrote', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...config, featureFlags: { GS1_SCANNING: 'true' } })),
        ),
    );

    await loadRuntimeConfig();

    expect(getDeploymentFlags()).toEqual({ GS1_SCANNING: 'true' });
  });

  it('has no flags when the file carries none', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...config, featureFlags: 'on' }))),
    );

    await loadRuntimeConfig();

    expect(getDeploymentFlags()).toEqual({});
  });
});
