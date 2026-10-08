import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { Route } from '@/routes/(protected)/_protected';

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/app-shell-skeleton', () => ({
  AppShellSkeleton: () => <p>Checking access</p>,
}));

const ada = { referenceDataUserId: 'ada', username: 'ada', accessToken: 'ada-token' };
const alan = { referenceDataUserId: 'alan', username: 'alan', accessToken: 'alan-token' };
const loader = vi.fn(async () => {
  if (useLoginData.getState().referenceDataUserId === 'alan') throw new Error('No Access');
  return 'saved';
});

function Draft() {
  const [value, setValue] = useState('saved');
  useDiscardGuard(value !== 'saved');
  return (
    <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
  );
}

const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Outlet });
Route.update({ getParentRoute: () => root, id: '/(protected)/_protected' } as never);
const draft = createRoute({
  getParentRoute: () => Route,
  path: '/draft',
  loader,
  component: Draft,
  errorComponent: () => <p>No Access</p>,
});
const tree = root.addChildren([Route.addChildren([draft])]);

async function openDraft() {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree: tree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/draft'] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await userEvent.setup().type(await screen.findByLabelText('Draft'), ' changed');
  return router;
}

beforeEach(() => {
  loader.mockReset();
  loader.mockImplementation(async () => {
    if (useLoginData.getState().referenceDataUserId === 'alan') throw new Error('No Access');
    return 'saved';
  });
  useLoginData.getState().setLoginData(ada);
});

describe('protected session identity', () => {
  it('drops the old draft while rechecking the next user rights', async () => {
    await openDraft();
    let release = () => {};
    loader.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          release = () => reject(new Error('No Access'));
        }),
    );
    act(() => useLoginData.getState().setLoginData(alan));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
    await act(async () => release());
    expect(await screen.findByText('No Access')).toBeInTheDocument();
  });

  it('starts a fresh draft when the next user can open the page', async () => {
    await openDraft();
    loader.mockResolvedValueOnce('saved');
    act(() => useLoginData.getState().setLoginData(alan));
    await waitFor(() => expect(screen.getByLabelText('Draft')).toHaveValue('saved'));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('keeps the draft through expiry and same-user reauthentication', async () => {
    await openDraft();
    act(() => useLoginData.getState().expireSession());
    expect(screen.getByLabelText('Draft')).toHaveValue('saved changed');
    act(() => useLoginData.getState().setLoginData({ ...ada, accessToken: 'renewed' }));
    expect(screen.getByLabelText('Draft')).toHaveValue('saved changed');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
