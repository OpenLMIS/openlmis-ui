import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const schema = z.object({
  q: z.string().optional(),
  page: z.number().optional(),
  user: z.string().optional(),
});
const CLOSED = { user: undefined };

type Search = z.infer<typeof schema>;

let actions: ReturnType<typeof useSearchNavigation<Search>>;

async function renderList(initial = '/users') {
  const root = createRootRoute({ component: Outlet });
  const list = createRoute({
    getParentRoute: () => root,
    path: '/users',
    validateSearch: schema,
    component: function List() {
      actions = useSearchNavigation<Search>(CLOSED);
      const search = list.useSearch();
      return <p>{JSON.stringify(search)}</p>;
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([list]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText(/\{/);
  return router;
}

describe('useSearchNavigation', () => {
  it('merges a change into the search, adding a history entry unless told to replace', async () => {
    const router = await renderList('/users?q=ada');
    await act(() => actions.updateSearch({ page: 2 }));
    expect(router.state.location.search).toEqual({ q: 'ada', page: 2 });
    expect(router.history.length).toBe(2);

    await act(() => actions.updateSearch((previous) => ({ q: `${previous.q}x` }), true));
    expect(router.state.location.search).toEqual({ q: 'adax', page: 2 });
    expect(router.history.length).toBe(2);
  });

  it('closes a dialog it opened by stepping back, so Back never reopens it', async () => {
    const router = await renderList('/users?q=ada');
    await act(() => actions.openDialog({ user: 'u1' }));
    expect(router.state.location.search).toEqual({ q: 'ada', user: 'u1' });

    act(() => actions.closeDialog());
    await screen.findByText('{"q":"ada"}');
    expect(router.history.length).toBe(2);
    expect(router.history.location.state.__TSR_index).toBe(0);
  });

  it('closes a dialog from a shared link by replacing the entry', async () => {
    const router = await renderList('/users?user=u1');
    act(() => actions.closeDialog());
    await screen.findByText('{}');
    expect(router.history.length).toBe(1);
  });
});
