import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { type AxiosAdapter, AxiosError } from 'axios';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useHasRight } from '@/components/app-shell/nav-access';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { client } from '@/integrations/axios';
import { isOnline } from '@/lib/online';
import { parsePermissions } from '@/lib/permissions';

const originalAdapter = client.defaults.adapter;
let queryClient: QueryClient;

beforeEach(() => {
  useLoginData.setState({ referenceDataUserId: 'u', expired: false });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

function mount(permissions: string[]) {
  queryClient.setQueryData(permissionsOptions('u').queryKey, parsePermissions(permissions));
  return renderHook(() => useHasRight('REQUISITION_VIEW'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

it('skips optional supervision lookups when permission strings already grant VIEW', () => {
  const adapter = vi.fn<AxiosAdapter>();
  client.defaults.adapter = adapter;
  const { result } = mount(['REQUISITION_VIEW|f|p']);
  expect(result.current).toBe(true);
  expect(queryClient.isFetching()).toBe(0);
  expect(adapter).not.toHaveBeenCalled();
});

it('keeps the shell available while supervision lookups load and grants VIEW when ready', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  client.defaults.adapter = async (config) => {
    await pending;
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data:
        config.url === '/roles'
          ? [{ id: 'viewer', rights: [{ name: 'REQUISITION_VIEW' }] }]
          : { id: 'u', roleAssignments: [{ roleId: 'viewer', supervisoryNodeId: 'node' }] },
    };
  };
  const { result } = mount([]);
  expect(result.current).toBe(false);
  release();
  await waitFor(() => expect(result.current).toBe(true));
});

it('treats failed optional lookups as no extra rights without marking the app offline', async () => {
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    throw new AxiosError('Network Error', 'ERR_NETWORK', config);
  });
  client.defaults.adapter = adapter;
  const { result } = mount(['USERS_MANAGE']);
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(result.current).toBe(false);
  expect(isOnline()).toBe(true);
});
