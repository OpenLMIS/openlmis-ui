import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currencySettingsOptions,
  deploymentTimeZoneOptions,
} from '@/features/reference-data/api/queries';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{children}</Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('useDeploymentTimeZone', () => {
  it('reads the time zone the legacy UI shows dates in, without a token', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { timeZoneId: 'Africa/Blantyre' } });
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('Africa/Blantyre'));
    expect(client.get).toHaveBeenCalledWith('/localeSettings', {
      baseURL: '/',
      anonymous: true,
      connectionStatus: false,
      timeout: 10_000,
    });
  });

  it('keeps showing the last time zone it read when the settings cannot be read', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: { timeZoneId: 'Africa/Blantyre' } });
    const first = renderHook(() => useDeploymentTimeZone(), { wrapper });
    await waitFor(() => expect(first.result.current).toBe('Africa/Blantyre'));

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(client.get).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(client.get).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(queryClient.getQueryState(deploymentTimeZoneOptions().queryKey)?.fetchStatus).toBe(
        'idle',
      ),
    );
    expect(queryClient.getQueryData(deploymentTimeZoneOptions().queryKey)).toEqual({
      zone: 'Africa/Blantyre',
      read: false,
    });
    expect(result.current).toBe('Africa/Blantyre');
  });

  it('shows the zone it read before at once, without waiting for the server', () => {
    localStorage.setItem('openlmis-ui.time-zone', 'Africa/Blantyre');
    vi.mocked(client.get).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    expect(result.current).toBe('Africa/Blantyre');
  });

  it('asks again on the next screen after a failed read rather than keeping the fallback', async () => {
    vi.useFakeTimers({ now: new Date(), toFake: ['Date'] });
    vi.mocked(client.get).mockRejectedValueOnce(new Error('offline'));
    const first = renderHook(() => useDeploymentTimeZone(), { wrapper });
    await waitFor(() => expect(first.result.current).toBe('UTC'));
    first.unmount();
    vi.setSystemTime(Date.now() + 1_100);

    vi.mocked(client.get).mockResolvedValue({ data: { timeZoneId: 'Africa/Blantyre' } });
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('Africa/Blantyre'));
  });

  it('falls back to UTC, as legacy does, when it has never read one', async () => {
    vi.mocked(client.get).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('UTC'));
  });
});

it('serves the time zone and currency from one locale settings request', async () => {
  const settings = { timeZoneId: 'Africa/Blantyre', currencyCode: 'MWK', currencySymbol: 'K' };
  vi.mocked(client.get).mockResolvedValue({ data: settings });
  await queryClient.fetchQuery(deploymentTimeZoneOptions());
  const options = currencySettingsOptions();
  const currency = await queryClient.fetchQuery(options);
  expect(currency).toMatchObject({ currencyCode: 'MWK', currencySymbol: 'K' });
  expect(client.get).toHaveBeenCalledTimes(1);
});
