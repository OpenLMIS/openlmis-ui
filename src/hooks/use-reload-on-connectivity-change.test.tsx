import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { useReloadOnConnectivityChange } from '@/hooks/use-reload-on-connectivity-change';
import { queryKeys, stockCardDeviceKey } from '@/lib/key-factory';

const invalidate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate }) }));

it('reloads on disconnect and invalidates both server and device cards on reconnect', () => {
  onlineManager.setOnline(true);
  const client = new QueryClient();
  const serverKey = queryKeys.stockCards.detail('card');
  const deviceKey = stockCardDeviceKey('card');
  client.setQueryData(serverKey, { stockOnHand: 20 });
  client.setQueryData(deviceKey, { stockOnHand: 10, summaryOnly: true });
  const view = renderHook(() => useReloadOnConnectivityChange(serverKey), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  act(() => onlineManager.setOnline(false));
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(deviceKey)?.isInvalidated).toBe(false);
  act(() => onlineManager.setOnline(true));
  expect(client.getQueryState(serverKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(deviceKey)?.isInvalidated).toBe(true);
  expect(invalidate).toHaveBeenCalledTimes(2);
  view.unmount();
  client.clear();
});
