import { QueryClient } from '@tanstack/react-query';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { type AxiosAdapter, AxiosError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCanOpen } from '@/components/app-shell/nav-access';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { client } from '@/integrations/axios';
import { isOnline } from '@/lib/online';
import { parsePermissions } from '@/lib/permissions';
import { renderPage } from '@/test-utils/render-page';

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

function ViewAccess() {
  const canOpen = useCanOpen();
  return <output>{canOpen('/requisitions/view') ? 'Available' : 'Hidden'}</output>;
}

function mount(permissions: string[]) {
  queryClient.setQueryData(permissionsOptions('u').queryKey, parsePermissions(permissions));
  renderPage(<ViewAccess />, {
    queryClient,
    routeStaticData: { '/requisitions/view': { rights: ['REQUISITION_VIEW'] } },
  });
}

it('skips optional supervision lookups when permission strings already grant VIEW', async () => {
  const adapter = vi.fn<AxiosAdapter>();
  client.defaults.adapter = adapter;
  mount(['REQUISITION_VIEW|f|p']);
  expect(await screen.findByRole('status')).toHaveTextContent('Available');
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
  mount([]);
  expect(await screen.findByRole('status')).toHaveTextContent('Hidden');
  release();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Available'));
});

it('treats failed optional lookups as no extra rights without marking the app offline', async () => {
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    throw new AxiosError('Network Error', 'ERR_NETWORK', config);
  });
  client.defaults.adapter = adapter;
  mount(['USERS_MANAGE']);
  await screen.findByRole('status');
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('status')).toHaveTextContent('Hidden');
  expect(isOnline()).toBe(true);
});
