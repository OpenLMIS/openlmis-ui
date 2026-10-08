import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe('useDeploymentTimeZone', () => {
  it('reads the time zone the legacy UI shows dates in, without a token', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { timeZoneId: 'Africa/Blantyre' } });
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('Africa/Blantyre'));
    expect(client.get).toHaveBeenCalledWith('/localeSettings', { baseURL: '/', anonymous: true });
  });

  it('leaves the browser time zone in place when the settings cannot be read', async () => {
    vi.mocked(client.get).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(client.get).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
