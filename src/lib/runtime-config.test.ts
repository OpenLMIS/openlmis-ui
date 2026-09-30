import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

const config = { authServerClientId: 'runtime-client', authServerClientSecret: 'runtime-secret' };

async function load() {
  vi.resetModules();
  return import('@/lib/runtime-config');
}

describe('loadRuntimeConfig', () => {
  it('loads again once the connection is back, when the first try found no network', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(new Response(JSON.stringify(config)));
    vi.stubGlobal('fetch', fetch);
    const { getAuthClientCredentials, loadRuntimeConfig } = await load();

    await loadRuntimeConfig();
    expect(getAuthClientCredentials().clientId).not.toBe('runtime-client');
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
    const { getDeploymentFlags, loadRuntimeConfig } = await load();

    await loadRuntimeConfig();

    expect(getDeploymentFlags()).toEqual({ GS1_SCANNING: 'true' });
  });

  it('has no flags when the file carries none', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...config, featureFlags: 'on' }))),
    );
    const { getDeploymentFlags, loadRuntimeConfig } = await load();

    await loadRuntimeConfig();

    expect(getDeploymentFlags()).toEqual({});
  });
});
