import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { expect, it } from 'vitest';
import { Route as PodRoute } from '@/routes/(protected)/_protected.orders.proof-of-delivery_.$podId';

it('retries a failed POD loader through the actual route error handler', async () => {
  let calls = 0;
  const root = createRootRoute();
  const page = createRoute({
    getParentRoute: () => root,
    path: '/',
    loader: async () => {
      calls += 1;
      if (calls === 1)
        throw new AxiosError('Server failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
          status: 500,
          data: {},
          statusText: '',
          headers: {},
          config: { headers: new AxiosHeaders() },
        });
    },
    component: () => <p>Loaded POD</p>,
    errorComponent: PodRoute.options.errorComponent as never,
  });
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await userEvent.setup().click(await screen.findByRole('button', { name: /try.again/i }));
  expect(await screen.findByText('Loaded POD')).toBeVisible();
  expect(calls).toBe(2);
});
