import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';
import { Route } from '@/routes/(protected)/_protected.administration.requisition-templates_.$id';

vi.mock('@/features/auth/lib/access', () => ({ requireRight: vi.fn(async () => undefined) }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(async () => [{ id: 'program', name: 'Program' }]),
  fetchFacilityTypes: vi.fn(async () => []),
}));
vi.mock('@/features/requisition-templates/api/api', () => ({
  fetchRequisitionTemplate: vi.fn(async (id: string) => ({
    id,
    name: id,
    program: { id: 'program' },
  })),
  fetchRequisitionTemplates: vi.fn(async () => []),
  fetchReasonTags: vi.fn(async () => []),
}));
vi.mock('@/features/requisition-templates/components/template-editor', () => ({
  TemplateEditor: ({ saved }: { saved: RequisitionTemplate }) => <h1>{saved.name}</h1>,
}));

it('captures the second saved template when navigating between ids in the same route', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Outlet });
  const shell = createRoute({
    getParentRoute: () => root,
    id: '/(protected)/_protected',
    component: Outlet,
  });
  Route.update({
    id: '/administration/requisition-templates_/$id',
    path: '/administration/requisition-templates/$id',
    getParentRoute: () => shell,
  } as never);
  const first = '11111111-1111-1111-1111-111111111111';
  const second = '22222222-2222-2222-2222-222222222222';
  const router = createRouter({
    routeTree: root.addChildren([shell.addChildren([Route] as never)] as never),
    context: { queryClient },
    history: createMemoryHistory({
      initialEntries: [`/administration/requisition-templates/${first}`],
    }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: first });
  await act(() =>
    router.navigate({
      to: '/administration/requisition-templates/$id',
      params: { id: second },
    } as never),
  );
  expect(await screen.findByRole('heading', { name: second })).toBeInTheDocument();
});
