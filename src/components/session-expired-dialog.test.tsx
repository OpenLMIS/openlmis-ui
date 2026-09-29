import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionExpiredDialog } from '@/components/session-expired-dialog';
import * as authApi from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', async (original) => ({
  ...(await original<typeof import('@/features/auth/api/api')>()),
  login: vi.fn(),
  logout: vi.fn(),
}));

const ada = { referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'old-token' };

function UnsavedDraft({ ask }: { ask: (proceed: () => void) => void }) {
  useLeaveGuard(true, ask);
  return null;
}

async function renderAt(path: string, ask?: (proceed: () => void) => void, page?: React.ReactNode) {
  const root = createRootRoute({
    component: () => (
      <>
        <Outlet />
        <SessionExpiredDialog />
      </>
    ),
  });
  const routes = ['/users', '/login'].map((routePath) =>
    createRoute({
      getParentRoute: () => root,
      path: routePath,
      component: () => (
        <>
          <p>{routePath}</p>
          {page}
          {ask && routePath === '/users' && <UnsavedDraft ask={ask} />}
        </>
      ),
    }),
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText(path);
  return router;
}

beforeEach(() => {
  useLoginData.getState().clearLoginData();
  useLoginData.getState().setLoginData(ada);
});

describe('SessionExpiredDialog', () => {
  it('stays closed while the session is live', async () => {
    await renderAt('/users');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens over the page once the session expires, for the same user', async () => {
    await renderAt('/users');

    act(() => useLoginData.getState().expireSession());

    expect(await screen.findByRole('dialog')).toHaveTextContent('session.expired-title');
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.queryByLabelText('login.username')).not.toBeInTheDocument();
  });

  it('asks for the password before trying', async () => {
    useLoginData.getState().expireSession();
    await renderAt('/users');

    await userEvent.click(await screen.findByRole('button', { name: 'session.sign-in' }));

    expect(await screen.findByText('login.password-required')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('labels its own password field when the page behind has one too', async () => {
    useLoginData.getState().expireSession();
    await renderAt('/users', undefined, <input aria-label="page password" id="password" />);

    const field = within(await screen.findByRole('dialog')).getByLabelText('login.password');

    expect(document.querySelectorAll(`[id="${field.id}"]`)).toHaveLength(1);
  });

  it.each([
    [httpError(400), 'session.wrong-password'],
    [new AxiosError('Network Error', 'ERR_NETWORK'), 'session.cannot-connect'],
    [httpError(500), 'session.sign-in-failed'],
  ])('explains why signing in failed (%s)', async (error, message) => {
    vi.mocked(authApi.login).mockRejectedValue(error);
    useLoginData.getState().expireSession();
    await renderAt('/users');

    await userEvent.type(await screen.findByLabelText('login.password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'session.sign-in' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('says the password is wrong and stays open', async () => {
    vi.mocked(authApi.login).mockRejectedValue(httpError(400));
    useLoginData.getState().expireSession();
    await renderAt('/users');

    await userEvent.type(await screen.findByLabelText('login.password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'session.sign-in' }));

    expect(await screen.findByText('session.wrong-password')).toBeInTheDocument();
    expect(useLoginData.getState().expired).toBe(true);
    expect(screen.getByLabelText('login.password')).toHaveFocus();
    expect(screen.getByLabelText('login.password')).toHaveAccessibleDescription(
      'session.signed-in-as',
    );
  });

  it('signs the same user back in and closes', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'new-token',
      token_type: 'bearer',
      expires_in: 1800,
      scope: 'read write',
      referenceDataUserId: 'ada-id',
      username: 'ada',
    });
    useLoginData.getState().expireSession();
    await renderAt('/users');

    await userEvent.type(await screen.findByLabelText('login.password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'session.sign-in' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(authApi.login).toHaveBeenCalledWith({ username: 'ada', password: 'secret' });
    expect(useLoginData.getState()).toMatchObject({ accessToken: 'new-token', expired: false });
  });

  it('asks about unsaved changes before signing out', async () => {
    vi.mocked(authApi.logout).mockResolvedValue();
    let proceed: (() => void) | undefined;
    useLoginData.getState().expireSession();
    const router = await renderAt('/users', (next) => {
      proceed = next;
    });

    await userEvent.click(await screen.findByRole('button', { name: 'session.sign-out' }));

    expect(useLoginData.getState().isAuthenticated).toBe(true);
    await act(async () => proceed?.());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/login');
    expect(useLoginData.getState().isAuthenticated).toBe(false);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  });

  it('warns before signing out when the server was out of reach', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    useLoginData.getState().expireSession();
    await renderAt('/users');
    await userEvent.type(await screen.findByLabelText('login.password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'session.sign-in' }));
    await screen.findByText('session.cannot-connect');

    await userEvent.click(screen.getByRole('button', { name: 'session.sign-out' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('sign-out-offline.title');
    expect(authApi.logout).not.toHaveBeenCalled();
  });

  it('lets the user change the language without leaving it', async () => {
    useLoginData.getState().expireSession();
    await renderAt('/users');

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('button', { name: 'sidebar.change-language' })).toBeVisible();
  });

  it('tries to sign in and out even while offline, rather than waiting for the network', async () => {
    onlineManager.setOnline(false);
    vi.mocked(authApi.login).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    vi.mocked(authApi.logout).mockResolvedValue();
    useLoginData.getState().expireSession();
    const router = await renderAt('/users');

    await userEvent.type(await screen.findByLabelText('login.password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'session.sign-in' }));
    expect(await screen.findByText('session.cannot-connect')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'session.sign-out' }));
    await userEvent.click(await screen.findByRole('button', { name: 'sign-out-offline.confirm' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('holds both buttons while signing out', async () => {
    vi.mocked(authApi.logout).mockReturnValue(new Promise(() => {}));
    useLoginData.getState().expireSession();
    await renderAt('/users');

    await userEvent.click(await screen.findByRole('button', { name: 'session.sign-out' }));

    expect(screen.getByRole('button', { name: 'session.sign-out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'session.sign-in' })).toBeDisabled();
  });

  it('is not shown on the sign-in page itself', async () => {
    useLoginData.getState().expireSession();
    await renderAt('/login');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
