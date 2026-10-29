import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { client } from '@/integrations/axios';
import { Route } from '@/routes/(protected)/_protected.requisitions.initiate';
import { httpError } from '@/test-utils/http-error';

const f = '00000000-0000-4000-8000-000000000001';
const p = '00000000-0000-4000-8000-000000000002';
const path = `/requisitions/initiate?mode=my&facilityId=${f}&programId=${p}`;
const period = { id: 'period', name: 'January', startDate: '2026-01-01', endDate: '2026-01-31' };
vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchUserRecord: vi.fn(async () => ({
    id: 'u',
    homeFacilityId: '00000000-0000-4000-8000-000000000001',
  })),
  fetchUserPrograms: vi.fn(async () => [
    { id: '00000000-0000-4000-8000-000000000002', name: 'Family Planning' },
  ]),
  fetchMinimalFacilities: vi.fn(async () => [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Comfort', code: 'HC01' },
  ]),
  fetchFacility: vi.fn(async () => ({ supportedPrograms: [] })),
}));
function renderRoute(entry = path) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    ...Route.options,
    getParentRoute: () => layout,
    path: 'requisitions/initiate',
  } as never);
  const detail = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/view/$requisitionId',
    component: () => <div>Opened requisition</div>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page, detail] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [entry] }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue([`REQUISITION_CREATE|${f}|${p}`]);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
  } as DOMRect);
  vi.spyOn(client, 'get').mockResolvedValue({ data: [period] });
  vi.spyOn(client, 'post').mockResolvedValue({ data: { id: 'new' } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('applies Emergency and the picker selection to the URL, sending only safe period parameters', async () => {
  const { router, queryClient } = renderRoute('/requisitions/initiate');
  await userEvent.click(
    await screen.findByRole('radio', { name: 'requisitions.requisition.emergency' }),
  );
  expect(client.get).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'facility-program.search' }));
  await screen.findByText('January');
  expect(router.state.location.search).toEqual({
    mode: 'my',
    facilityId: f,
    programId: p,
    emergency: true,
  });
  expect(client.get).toHaveBeenCalledWith('/requisitions/periodsForInitiate', {
    params: { facilityId: f, programId: p, emergency: true },
  });
  await act(() => router.history.back());
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'requisitions.requisition.regular' })).toBeChecked(),
  );
  queryClient.clear();
});
it.each([1200, 390])(
  'initiates from the %ipx layout without a suggested period and carries the return search',
  async (width) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
    const { router, queryClient } = renderRoute();
    await userEvent.click(
      await screen.findByRole('button', { name: 'requisitions.initiate.proceed-label' }),
    );
    await screen.findByText('Opened requisition');
    expect(client.post).toHaveBeenCalledWith(
      '/v2/requisitions/initiate',
      {},
      {
        params: { program: p, facility: f, emergency: false },
        headers: { 'Idempotency-Key': expect.any(String) },
      },
    );
    expect(router.state.location.pathname).toBe('/requisitions/view/new');
    expect(router.state.location.state.requisitionReturn).toEqual({
      to: '/requisitions/initiate',
      search: { mode: 'my', facilityId: f, programId: p },
    });
    queryClient.clear();
  },
);
it.each([
  [{ message: 'Server reason' }, 'Server reason'],
  [
    {
      messageKey: 'requisition.error.initiate.finishPreviousRequisition',
      message: 'English server text',
    },
    'requisitions.initiate.error.finish-previous',
  ],
])('keeps the search and explains a definite failure: %o', async (body, description) => {
  const errorToast = vi.spyOn(toast, 'error');
  vi.mocked(client.post).mockRejectedValue(httpError(400, body));
  const { router, queryClient } = renderRoute();
  await userEvent.click(
    await screen.findByRole('button', { name: 'requisitions.initiate.proceed-label' }),
  );
  await waitFor(() =>
    expect(errorToast).toHaveBeenCalledWith('requisitions.initiate.initiate-failed', {
      description,
    }),
  );
  expect(router.state.location.pathname).toBe('/requisitions/initiate');
  queryClient.clear();
});
it('refetches an uncertain outcome before another attempt and takes a fresh key', async () => {
  let finish: (value: { data: (typeof period)[] }) => void = () => {};
  const { queryClient } = renderRoute(`${path}&emergency=true`);
  await screen.findByText('January');
  vi.mocked(client.post).mockRejectedValueOnce(httpError(502));
  vi.mocked(client.get).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
  );
  await waitFor(() => expect(client.get).toHaveBeenCalledTimes(2));
  expect(
    screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
  ).toBeDisabled();
  await act(() => finish({ data: [period] }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
    ).toBeEnabled(),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
  );
  await screen.findByText('Opened requisition');
  const calls = vi.mocked(client.post).mock.calls;
  expect(calls[0]?.[2]?.headers?.['Idempotency-Key']).not.toBe(
    calls[1]?.[2]?.headers?.['Idempotency-Key'],
  );
  queryClient.clear();
});
it('refuses a user who lacks all three entry rights', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW']);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await expect(
    (Route.options.loader as CallableFunction)({ context: { queryClient }, deps: { search: {} } }),
  ).rejects.toBeInstanceOf(ForbiddenError);
  expect(client.get).not.toHaveBeenCalled();
  queryClient.clear();
});

it('opens an existing requisition for an AUTHORIZE-only user without posting', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([`REQUISITION_AUTHORIZE|${f}|${p}`]);
  vi.mocked(client.get).mockResolvedValue({
    data: [{ ...period, requisitionId: 'existing', requisitionStatus: 'SUBMITTED' }],
  });
  const { router, queryClient } = renderRoute();
  await userEvent.click(
    await screen.findByRole('button', { name: 'requisitions.initiate.proceed-label' }),
  );
  await screen.findByText('Opened requisition');
  expect(router.state.location.pathname).toBe('/requisitions/view/existing');
  expect(router.state.location.state.requisitionReturn?.search).toEqual({
    mode: 'my',
    facilityId: f,
    programId: p,
  });
  expect(client.post).not.toHaveBeenCalled();
  queryClient.clear();
});
it('does not post again when reconciliation fails, and the next click only reconciles', async () => {
  const { queryClient } = renderRoute(`${path}&emergency=true`);
  await screen.findByText('January');
  vi.mocked(client.post).mockRejectedValueOnce(httpError(502));
  vi.mocked(client.get).mockRejectedValueOnce(httpError(502));
  await userEvent.click(
    screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
    ).toBeEnabled(),
  );
  expect(client.get).toHaveBeenCalledTimes(2);
  await userEvent.click(
    screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
  );
  await waitFor(() => expect(client.get).toHaveBeenCalledTimes(3));
  expect(client.post).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
    ).toBeEnabled(),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'requisitions.initiate.proceed-label' }),
  );
  await screen.findByText('Opened requisition');
  expect(client.post).toHaveBeenCalledTimes(2);
  queryClient.clear();
});
it('adds a history entry and reloads periods on each repeated Search', async () => {
  const { router, queryClient } = renderRoute();
  await screen.findByText('January');
  const before = router.history.length;
  await userEvent.click(screen.getByRole('button', { name: 'facility-program.search' }));
  await waitFor(() => expect(router.history.length).toBe(before + 1));
  expect(client.get).toHaveBeenCalledTimes(2);
  queryClient.clear();
});

it('shows a translated unsupported-program failure and retries the period query', async () => {
  vi.mocked(client.get).mockRejectedValueOnce(
    httpError(400, {
      messageKey: 'requisition.error.facilityDoesNotSupportProgram',
      message: 'Raw facility and program IDs',
    }),
  );
  const { queryClient } = renderRoute();
  await screen.findByText('requisitions.initiate.error.not-supported-description');
  expect(screen.queryByText('Raw facility and program IDs')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  await screen.findByText('January');
  queryClient.clear();
});
