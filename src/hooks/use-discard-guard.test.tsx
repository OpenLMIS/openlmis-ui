import {
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';

let guard: ReturnType<typeof useDiscardGuard>;

let leaving = false;
let saving = false;

function Draft({ dirty }: { dirty: boolean }) {
  const [allowed, setAllowed] = useState(false);
  guard = useDiscardGuard(dirty, { allowLeave: () => allowed || leaving, pending: saving });
  const { open, signingOut } = guard.dialog;
  return (
    <>
      <p>{open ? `asking${signingOut ? ' to sign out' : ''}` : 'editing'}</p>
      <button type="button" onClick={() => setAllowed(true)}>
        Allow leaving
      </button>
    </>
  );
}

async function renderAt(dirty: boolean, pending = false) {
  leaving = false;
  saving = pending;
  const root = createRootRoute({ component: Outlet });
  const routes = ['/profile', '/profile/roles', '/login'].map((path) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => (path === '/profile' ? <Draft dirty={dirty} /> : <p>{path}</p>),
    }),
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/profile'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText('editing');
  return router;
}

describe('useDiscardGuard', () => {
  it('lets the page go when nothing changed', async () => {
    const router = await renderAt(false);
    await act(() => router.navigate({ to: '/profile/roles' }));
    expect(await screen.findByText('/profile/roles')).toBeInTheDocument();
  });

  it('asks before leaving for another page, and stays on Keep Editing', async () => {
    const router = await renderAt(true);
    act(() => void router.navigate({ to: '/profile/roles' }));
    expect(await screen.findByText('asking')).toBeInTheDocument();
    act(() => guard.dialog.onKeepEditing());
    expect(await screen.findByText('editing')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('leaves once the changes are discarded', async () => {
    const router = await renderAt(true);
    act(() => void router.navigate({ to: '/profile/roles' }));
    await screen.findByText('asking');
    act(() => guard.dialog.onDiscard());
    expect(await screen.findByText('/profile/roles')).toBeInTheDocument();
  });

  it('never blocks a change on the same page, such as opening a dialog', async () => {
    const router = await renderAt(true);
    await act(() => router.navigate({ to: '/profile', search: { dialog: 'password' } }));
    expect(screen.getByText('editing')).toBeInTheDocument();
  });

  it('never blocks the way to sign in', async () => {
    const router = await renderAt(true);
    await act(() => router.navigate({ to: '/login' }));
    expect(await screen.findByText('/login')).toBeInTheDocument();
  });

  it('holds a sign out until the changes are discarded', async () => {
    await renderAt(true);
    const signOut = vi.fn();
    act(() => whenLeaveAllowed(signOut));
    expect(await screen.findByText('asking to sign out')).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
    act(() => guard.dialog.onDiscard());
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('lets the page go without asking once it allows it, e.g. right after a save', async () => {
    const router = await renderAt(true);
    leaving = true;
    await act(() => router.navigate({ to: '/profile/roles' }));
    expect(await screen.findByText('/profile/roles')).toBeInTheDocument();
  });

  it('runs a waiting sign out on request, e.g. once a save has kept the changes', async () => {
    await renderAt(true);
    const signOut = vi.fn();
    act(() => whenLeaveAllowed(signOut));
    await screen.findByText('asking to sign out');
    let ran = false;
    act(() => {
      ran = guard.leaveIfAsked();
    });
    expect(ran).toBe(true);
    expect(signOut).toHaveBeenCalledOnce();
    expect(await screen.findByText('editing')).toBeInTheDocument();
    expect(guard.leaveIfAsked()).toBe(false);
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    'asks the browser before a reload or a closed tab only with changes (%s)',
    async (dirty, asks) => {
      const root = createRootRoute({ component: () => <Draft dirty={dirty} /> });
      const router = createRouter({ routeTree: root, history: createBrowserHistory() });
      render(<RouterProvider router={router} />);
      await screen.findByText('editing');

      const unload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);

      expect(unload.defaultPrevented).toBe(asks);
      router.history.destroy();
    },
  );
});

it('blocks navigation while saving without offering a discard dialog', async () => {
  const router = await renderAt(true, true);
  act(() => void router.navigate({ to: '/profile/roles' }));
  await act(async () => {});
  expect(router.state.location.pathname).toBe('/profile');
  expect(guard.dialog.open).toBe(false);
  act(() => guard.dialog.onDiscard());
  expect(router.state.location.pathname).toBe('/profile');
});
it('blocks sign out while saving without allowing discard', async () => {
  await renderAt(true, true);
  const signOut = vi.fn();
  act(() => whenLeaveAllowed(signOut));
  expect(guard.dialog.open).toBe(false);
  act(() => guard.dialog.onDiscard());
  expect(signOut).not.toHaveBeenCalled();
});

it('hides an already blocked dialog once leaving is allowed', async () => {
  const router = await renderAt(true);
  act(() => void router.navigate({ to: '/profile/roles' }));
  await screen.findByText('asking');
  fireEvent.click(screen.getByRole('button', { name: 'Allow leaving' }));
  expect(guard.dialog.open).toBe(false);
});
it('does not ask before unload once leaving is allowed', async () => {
  leaving = false;
  saving = false;
  const root = createRootRoute({ component: () => <Draft dirty /> });
  const router = createRouter({ routeTree: root, history: createBrowserHistory() });
  render(<RouterProvider router={router} />);
  await screen.findByText('editing');
  leaving = true;
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);
  router.history.destroy();
});
