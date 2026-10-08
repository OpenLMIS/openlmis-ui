import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{children}</Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => localStorage.clear());

describe('useDeploymentTimeZone', () => {
  it('reads the time zone the legacy UI shows dates in, without a token', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { timeZoneId: 'Africa/Blantyre' } });
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('Africa/Blantyre'));
    expect(client.get).toHaveBeenCalledWith('/localeSettings', { baseURL: '/', anonymous: true });
  });

  it('keeps showing the last time zone it read when the settings cannot be read', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: { timeZoneId: 'Africa/Blantyre' } });
    const first = renderHook(() => useDeploymentTimeZone(), { wrapper });
    await waitFor(() => expect(first.result.current).toBe('Africa/Blantyre'));

    vi.mocked(client.get).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('Africa/Blantyre'));
  });

  it('falls back to UTC, as legacy does, when it has never read one', async () => {
    vi.mocked(client.get).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('UTC'));
  });
});
