import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { FormDialog, FormDialogTitle } from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { useOfflineSignOut } from '@/components/offline-sign-out';
import { ForbiddenError } from '@/features/auth/lib/access';
import { syncOtherTab, useLoginData } from '@/features/auth/store/login-data';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { Route } from '@/routes/(protected)/_protected';
import { expectRouteWarning } from '@/tests/expect-route-warning';

vi.mock('@/components/device-work', () => ({
  useDeviceWork: () => ({ hasDeviceEvents: false, countUnsyncedWork: async () => 0 }),
}));

vi.mock('@/components/nav-access', () => ({ useHasRight: () => false }));
vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => {
    const { confirm, dialog } = useOfflineSignOut();
    return (
      <>
        <Link to="/home">Home</Link>
        <button type="button" onClick={() => confirm(() => {})}>
          Sign Out
        </button>
        {dialog}
        {children}
      </>
    );
  },
}));
vi.mock('@/components/app-shell-skeleton', () => ({
  AppShellSkeleton: () => <p>Checking access</p>,
}));

const ada = { referenceDataUserId: 'ada', username: 'ada', accessToken: 'ada-token' };
const alan = { referenceDataUserId: 'alan', username: 'alan', accessToken: 'alan-token' };
const loader = vi.fn(async () => {
  if (useLoginData.getState().referenceDataUserId === 'alan')
    throw new ForbiddenError('USERS_MANAGE');
  return 'saved';
});

function Draft() {
  const [value, setValue] = useState('saved');
  const [target, setTarget] = useState<boolean>();
  const { shown, dialogProps } = useDialogTarget(target, () => setTarget(undefined));
  const guard = useDiscardGuard(value !== 'saved');
  return (
    <>
      <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
      <button type="button" onClick={() => setTarget(true)}>
        Open draft dialog
      </button>
      <DiscardChangesDialog {...guard.dialog} description="Unsaved draft" />
      <FormDialog {...dialogProps()}>
        <FormDialogTitle>Draft dialog</FormDialogTitle>
        {shown && <input aria-label="Dialog draft" defaultValue="saved" />}
      </FormDialog>
    </>
  );
}

const root = createRootRouteWithContext<{
  queryClient: QueryClient;
  getResolvedPathname?: () => string | undefined;
}>()({ component: Outlet });
Route.update({ getParentRoute: () => root, id: '/(protected)/_protected' } as never);
const draft = createRoute({
  getParentRoute: () => Route,
  path: '/draft',
  loader,
  component: Draft,
  errorComponent: () => <p>No Access</p>,
});
const home = createRoute({
  getParentRoute: () => Route,
  path: '/home',
  component: () => <p>Home page</p>,
});
const tree = root.addChildren([Route.addChildren([draft, home])]);

async function openDraft(onCaughtError?: (error: unknown) => void) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree: tree,
    context: {
      queryClient,
      getResolvedPathname: (): string | undefined =>
        router.state.matches.some(
          (match) => match.routeId === '/(protected)/_protected' && match.status === 'success',
        )
          ? router.state.resolvedLocation?.pathname
          : undefined,
    },
    history: createMemoryHistory({ initialEntries: ['/draft'] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    { onCaughtError },
  );
  await userEvent.setup().type(await screen.findByLabelText('Draft'), ' changed');
  return router;
}

beforeEach(() => {
  loader.mockReset();
  loader.mockImplementation(async () => {
    if (useLoginData.getState().referenceDataUserId === 'alan')
      throw new ForbiddenError('USERS_MANAGE');
    return 'saved';
  });
  useLoginData.getState().setLoginData(ada);
});

describe('protected session identity', () => {
  it('drops the old draft while rechecking the next user rights', async () => {
    const denial = new ForbiddenError('USERS_MANAGE');
    const onCaughtError = vi.fn();
    const assertRouteWarning = expectRouteWarning('/(protected)/_protected/draft/draft');
    await openDraft(onCaughtError);
    let release = () => {};
    loader.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          release = () => reject(denial);
        }),
    );
    act(() => useLoginData.getState().setLoginData(alan));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
    await act(async () => release());
    expect(await screen.findByText('No Access')).toBeInTheDocument();
    expect(onCaughtError.mock.calls.map(([error]) => error)).toEqual([denial]);
    expect(onCaughtError.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
    assertRouteWarning();
  });

  it('starts a fresh draft when the next user can open the page', async () => {
    await openDraft();
    loader.mockResolvedValueOnce('saved');
    act(() => useLoginData.getState().setLoginData(alan));
    await waitFor(() => expect(screen.getByLabelText('Draft')).toHaveValue('saved'));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it.each(['token-first', 'id-first'])(
    'drops the draft after a legacy %s user switch',
    async (order) => {
      localStorage.setItem('openlmis.ACCESS_TOKEN', ada.accessToken);
      localStorage.setItem('openlmis.USER_ID', ada.referenceDataUserId);
      localStorage.setItem('openlmis.USERNAME', ada.username);
      useLoginData.getState().setLoginData(ada, 'legacy');
      await openDraft();
      loader.mockResolvedValue('saved');
      const changes =
        order === 'token-first'
          ? [
              ['ACCESS_TOKEN', alan.accessToken],
              ['USER_ID', alan.referenceDataUserId],
            ]
          : [
              ['USER_ID', alan.referenceDataUserId],
              ['ACCESS_TOKEN', alan.accessToken],
            ];
      for (const [key, value] of changes) {
        await act(async () => {
          localStorage.setItem(`openlmis.${key}`, value);
          await syncOtherTab(`openlmis.${key}`);
        });
      }
      expect(useLoginData.getState().referenceDataUserId).toBe(alan.referenceDataUserId);
      expect(useLoginData.getState().expired).toBe(false);
      await waitFor(() => expect(screen.getByLabelText('Draft')).toHaveValue('saved'));
    },
  );

  it('keeps the draft through expiry and same-user reauthentication', async () => {
    await openDraft();
    act(() => useLoginData.getState().expireSession());
    expect(screen.getByLabelText('Draft')).toHaveValue('saved changed');
    act(() => useLoginData.getState().setLoginData({ ...ada, accessToken: 'renewed' }));
    expect(screen.getByLabelText('Draft')).toHaveValue('saved changed');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

it('preserves an open online-only draft while the offline gate hides it', async () => {
  await openDraft();
  await act(() => onlineManager.setOnline(false));
  expect(
    await screen.findByRole('heading', { name: /offline\.(notice|page)-title/ }),
  ).toBeInTheDocument();
  await act(() => onlineManager.setOnline(true));
  expect(await screen.findByLabelText('Draft')).toHaveValue('saved changed');
  expect(loader).toHaveBeenCalledOnce();
});

it.each(['retry', 'search'])('retains hidden drafts after an offline %s', async (action) => {
  const router = await openDraft();
  await userEvent.click(screen.getByRole('button', { name: 'Open draft dialog' }));
  await userEvent.type(screen.getByLabelText('Dialog draft'), ' changed');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(() => onlineManager.setOnline(false));
  expect(
    await screen.findByRole('heading', { name: /offline\.(notice|page)-title/ }),
  ).toBeVisible();
  if (action === 'retry') {
    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
  } else {
    await act(() => router.navigate({ to: '/draft', search: { tab: 'other' } } as never));
  }
  expect(screen.getByLabelText('Draft')).toHaveValue('saved changed');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await act(() => onlineManager.setOnline(true));
  expect(await screen.findByLabelText('Draft')).toHaveValue('saved changed');
  expect(screen.getByLabelText('Dialog draft')).toHaveValue('saved changed');
  expect(screen.getByRole('dialog')).toBeVisible();
  vi.restoreAllMocks();
});

it.each(['Home', 'Sign Out'])('shows the hidden draft discard prompt for %s', async (action) => {
  const router = await openDraft();
  await act(() => onlineManager.setOnline(false));
  await userEvent.click(screen.getByRole(action === 'Home' ? 'link' : 'button', { name: action }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('discard-changes.title');
  await userEvent.click(screen.getByRole('button', { name: 'discard-changes.keep-editing' }));
  expect(router.state.location.pathname).toBe('/draft');
  expect(screen.getByLabelText('Draft')).toHaveValue('saved changed');
  await userEvent.click(screen.getByRole(action === 'Home' ? 'link' : 'button', { name: action }));
  await userEvent.click(
    await screen.findByRole('button', {
      name: action === 'Home' ? 'discard-changes.discard' : 'discard-changes.discard-sign-out',
    }),
  );
  if (action === 'Home') expect(await screen.findByText('Home page')).toBeVisible();
  else expect(await screen.findByRole('alertdialog')).toHaveTextContent('sign-out-offline.title');
});

it('keeps a failed offline Back entry gated through retry and invalidation', async () => {
  const router = await openDraft();
  await userEvent.clear(screen.getByLabelText('Draft'));
  await userEvent.type(screen.getByLabelText('Draft'), 'saved');
  await userEvent.click(screen.getByRole('link', { name: 'Home' }));
  await screen.findByText('Home page');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(() => onlineManager.setOnline(false));
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await act(async () => router.history.back());
  await screen.findByRole('heading', { name: /offline\.(notice|page)-title/ });
  await waitFor(() => expect(router.state.resolvedLocation?.pathname).toBe('/draft'));
  loader.mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
  expect(loader).not.toHaveBeenCalled();
  await act(() => router.invalidate());
  expect(loader).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
  warning.mockRestore();
  vi.restoreAllMocks();
});
