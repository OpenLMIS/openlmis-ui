import { QueryClient } from '@tanstack/react-query';
import { isNotFound } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireRight } from '@/features/auth/lib/access';
import { fetchAppConfiguration } from '@/features/system-settings/api/api';
import { loadRuntimeConfig } from '@/lib/runtime-config';
import { Route } from '@/routes/(protected)/_protected.settings';

vi.mock('@/features/auth/lib/access', () => ({ requireRight: vi.fn(async () => new Set()) }));
vi.mock('@/features/system-settings/api/api', () => ({ fetchAppConfiguration: vi.fn() }));

async function deployWith(flags: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ featureFlags: flags }))),
  );
  await loadRuntimeConfig();
}

const load = () =>
  (Route.options.loader as (match: unknown) => Promise<unknown>)({
    context: { queryClient: new QueryClient() },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('settings loader', () => {
  it('has no page while the deployment keeps Settings off, asking the server nothing', async () => {
    await deployWith({});

    const error = await load().catch((caught: unknown) => caught);

    expect(isNotFound(error)).toBe(true);
    expect(requireRight).not.toHaveBeenCalled();
    expect(fetchAppConfiguration).not.toHaveBeenCalled();
  });

  it('opens once the deployment turns Settings on', async () => {
    await deployWith({ SYSTEM_SETTINGS: 'true' });
    vi.mocked(fetchAppConfiguration).mockResolvedValue(null);

    await expect(load()).resolves.not.toThrow();
    expect(requireRight).toHaveBeenCalled();
  });
});
