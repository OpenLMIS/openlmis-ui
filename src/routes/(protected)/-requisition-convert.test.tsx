import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchConvertList,
  fetchRequisition,
  releaseRequisitions,
} from '@/features/requisitions/api/api';

import { queryKeys } from '@/lib/key-factory';
import { Route } from '@/routes/(protected)/_protected.requisitions.convert';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchCurrencySettings: vi.fn(async () => ({ timeZoneId: 'UTC' })),
  storedTimeZone: vi.fn(() => null),
  fetchUserRecord: vi.fn(async () => ({
    id: 'u',
    roleAssignments: [{ roleId: 'role', programId: '11111111-1111-4111-8111-111111111111' }],
  })),
  fetchRoles: vi.fn(async () => [{ id: 'role', rights: [{ name: 'ORDERS_EDIT' }] }]),
  fetchUserPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchPrograms: vi.fn(async () => [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Family Planning' },
  ]),
  fetchMinimalFacilities: vi.fn(async () => [{ id: 'f', name: 'Comfort', code: 'HC01' }]),
}));
vi.mock('@/features/requisitions/api/api', () => ({
  fetchConvertList: vi.fn(),
  releaseRequisitions: vi.fn(),
  fetchRequisition: vi.fn(),
}));

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/convert',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    pendingComponent: Route.options.pendingComponent as never,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([list] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    { onCaughtError: () => {} },
  );
  return { router, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
  } as DOMRect);
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['ORDERS_EDIT|warehouse']);
  vi.mocked(fetchConvertList).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it.each([
  ['', { page: 0, size: 20 }],
  [
    '?page=3&dir=asc&programId=11111111-1111-4111-8111-111111111111',
    {
      page: 2,
      size: 20,
      programId: '11111111-1111-4111-8111-111111111111',
    },
  ],
])('maps conversion URL %s to the legacy request', async (search, expected) => {
  const { queryClient } = renderRoute(`/requisitions/convert${search}`);
  await waitFor(() => expect(fetchConvertList).toHaveBeenCalledWith(expected));
  await screen.findByText(
    search ? 'requisitions.view.no-matches-title' : 'requisitions.convert.empty',
  );
  expect(screen.getByRole('checkbox')).not.toBeChecked();

  queryClient.clear();
});
it('refuses conversion access before fetching rows or lookups', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|p']);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const loader = Route.options.loader as (context: unknown) => Promise<unknown>;
  await expect(loader({ context: { queryClient }, deps: { search: {} } })).rejects.toBeInstanceOf(
    ForbiddenError,
  );
  expect(fetchConvertList).not.toHaveBeenCalled();
  queryClient.clear();
});

const row = (id = 'March', depots = [{ id: 'a', name: 'Depot A' }]) => ({
  requisition: {
    id,
    program: { id: 'p', name: 'Family Planning' },
    facility: { code: 'HC01', name: 'Comfort' },
    processingPeriod: { name: id },
    emergency: false,
  },
  supplyingDepots: depots,
});
function rows(content = [row()], total = 1) {
  vi.mocked(fetchConvertList).mockResolvedValue({
    content,
    number: 0,
    size: 1,
    totalElements: total,
    totalPages: total,
  });
}
async function selectRow() {
  await screen.findAllByText('March');
  await userEvent.click(screen.getAllByRole('checkbox').at(-1) as HTMLElement);
}
async function action(createOrder = true) {
  await userEvent.click(
    screen.getByRole('button', {
      name: createOrder ? /^requisitions.convert.convert/ : /^requisitions.convert.release/,
    }),
  );
}
async function confirm() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'requisitions.convert.confirm' }),
  );
}
it.each([true, false])(
  'sends one batch with current depots and refreshes on success (%s)',
  async (createOrder) => {
    rows();
    vi.mocked(releaseRequisitions).mockImplementation(async () => {
      rows([], 0);
    });
    const { queryClient } = renderRoute('/requisitions/convert');
    queryClient.setQueryData([...queryKeys.home.all, 'test-count'], 1);
    await selectRow();
    await action(createOrder);
    await confirm();
    await waitFor(() =>
      expect(releaseRequisitions).toHaveBeenCalledExactlyOnceWith({
        createOrder,
        requisitionsToRelease: [{ requisitionId: 'March', supplyingDepotId: 'a' }],
      }),
    );
    await screen.findByText('requisitions.convert.empty');
    expect(queryClient.getQueryState([...queryKeys.home.all, 'test-count'])?.isInvalidated).toBe(
      true,
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    queryClient.clear();
  },
);
it('requires a depot before confirming and focuses it after closing validation', async () => {
  rows([row('March', [])]);
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await screen.findByRole('heading', { name: 'requisitions.convert.no-depot' });
  expect(releaseRequisitions).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'requisitions.convert.depot-label' }),
    ).toHaveFocus(),
  );
  queryClient.clear();
});
it('shows a 400 server message while retaining ticks for correction', async () => {
  rows();
  vi.mocked(releaseRequisitions).mockRejectedValue(
    new AxiosError('Bad', undefined, undefined, undefined, {
      status: 400,
      data: { message: 'Approved quantity must be displayed' },
    } as never),
  );
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await confirm();
  await screen.findByText('Approved quantity must be displayed');
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  expect(screen.getAllByRole('checkbox').at(-1)).toBeChecked();
  queryClient.clear();
});
it.each([502, 400, undefined])(
  'reads submitted statuses after uncertain failure %s and blocks a plain retry',
  async (status) => {
    rows();
    vi.mocked(releaseRequisitions).mockRejectedValue(
      new AxiosError(
        'Bad',
        undefined,
        undefined,
        undefined,
        (status
          ? {
              status,
              data:
                status === 400
                  ? { messageKey: 'requisition.error.convertingMultipleRequisitions' }
                  : {},
            }
          : undefined) as never,
      ),
    );
    vi.mocked(fetchRequisition).mockResolvedValue({ id: 'March', status: 'APPROVED' } as never);
    const { queryClient } = renderRoute('/requisitions/convert');
    await selectRow();
    await action();
    await confirm();
    await screen.findByText('requisitions.convert.uncertain-description');
    expect(fetchRequisition).toHaveBeenCalledWith('March');
    await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
    await action();
    await screen.findByText('requisitions.convert.uncertain-description');
    expect(releaseRequisitions).toHaveBeenCalledTimes(1);
    queryClient.clear();
  },
);

it.each([1200, 390])(
  'keeps a changed depot across pages and filters at width %s',
  async (width) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
    vi.mocked(fetchConvertList).mockImplementation(async ({ page }) => ({
      content: [
        row(page ? 'April' : 'March', [
          { id: 'a', name: 'Depot A' },
          { id: 'b', name: 'Depot B' },
        ]),
      ],
      number: page,
      size: 1,
      totalElements: 2,
      totalPages: 2,
    }));
    vi.mocked(releaseRequisitions).mockResolvedValue(undefined);
    const { router, queryClient } = renderRoute('/requisitions/convert?size=1');
    await selectRow();
    await userEvent.click(
      screen.getByRole('combobox', { name: 'requisitions.convert.depot-label' }),
    );
    await userEvent.click(await screen.findByRole('option', { name: 'Depot B' }));
    await router.navigate({ to: '.', search: { size: 1, page: 2 } });
    await screen.findAllByText('April');
    await router.navigate({
      to: '.',
      search: { size: 1, programId: '11111111-1111-4111-8111-111111111111' },
    });
    await screen.findAllByText('March');
    expect(
      screen.getByRole('combobox', { name: 'requisitions.convert.depot-label' }),
    ).toHaveTextContent('Depot B');
    expect(screen.getAllByRole('checkbox').at(-1)).toBeChecked();
    await action();
    await confirm();
    await waitFor(() =>
      expect(releaseRequisitions).toHaveBeenCalledExactlyOnceWith({
        createOrder: true,
        requisitionsToRelease: [{ requisitionId: 'March', supplyingDepotId: 'b' }],
      }),
    );
    queryClient.clear();
  },
);
it('clamps an emptied last page after a successful conversion', async () => {
  let converted = false;
  vi.mocked(fetchConvertList).mockImplementation(async ({ page }) => ({
    content: converted && page ? [] : [row(page ? 'March' : 'February')],
    number: page,
    size: 1,
    totalElements: converted ? 1 : 2,
    totalPages: converted ? 1 : 2,
  }));
  vi.mocked(releaseRequisitions).mockImplementation(async () => {
    converted = true;
  });
  const { router, queryClient } = renderRoute('/requisitions/convert?size=1&page=2');
  await selectRow();
  await action();
  await confirm();
  await screen.findAllByText('February');
  expect(router.state.location.search.page).toBeUndefined();
  queryClient.clear();
});
it('checks every submitted status and drops only proven releases after a 502', async () => {
  rows([row('March'), row('April')]);
  vi.mocked(releaseRequisitions).mockRejectedValue(
    new AxiosError('Bad', undefined, undefined, undefined, { status: 502 } as never),
  );
  vi.mocked(fetchRequisition).mockImplementation(async (id) => {
    if (id === 'April') throw new Error('Refused');
    return { id, status: 'RELEASED' } as never;
  });
  const { queryClient } = renderRoute('/requisitions/convert');
  await screen.findAllByText('March');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Page' }));
  await action();
  await confirm();
  await screen.findByText('requisitions.convert.uncertain-description');
  expect(fetchRequisition).toHaveBeenCalledWith('March');
  expect(fetchRequisition).toHaveBeenCalledWith('April');
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  const boxes = screen.getAllByRole('checkbox');
  expect(boxes[1]).not.toBeChecked();
  expect(boxes[2]).toBeChecked();
  queryClient.clear();
});
it.each([true, false])(
  'validates empty selection for action %s without a request',
  async (createOrder) => {
    rows();
    const { queryClient } = renderRoute('/requisitions/convert');
    await screen.findAllByText('March');
    await action(createOrder);
    await screen.findByText(
      createOrder
        ? 'requisitions.convert.select-none-convert'
        : 'requisitions.convert.select-none-release',
    );
    expect(releaseRequisitions).not.toHaveBeenCalled();
    queryClient.clear();
  },
);

it('closes confirmation on a filter change while retaining the selected requisition', async () => {
  rows();
  const { router, queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await screen.findByText('requisitions.convert.convert-confirm');
  await router.navigate({ to: '.', search: { programId: '11111111-1111-4111-8111-111111111111' } });
  await waitFor(() =>
    expect(screen.queryByText('requisitions.convert.convert-confirm')).not.toBeInTheDocument(),
  );
  expect(screen.getAllByRole('checkbox').at(-1)).toBeChecked();
  expect(releaseRequisitions).not.toHaveBeenCalled();
  queryClient.clear();
});
it('requires the explicit Convert Again choice before resubmitting an uncertain conversion', async () => {
  rows();
  vi.mocked(releaseRequisitions).mockRejectedValueOnce(new AxiosError('Disconnected'));
  vi.mocked(fetchRequisition).mockResolvedValue({ id: 'March', status: 'APPROVED' } as never);
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await confirm();
  await screen.findByText('requisitions.convert.uncertain-description');
  vi.mocked(releaseRequisitions).mockImplementation(async () => {
    rows([], 0);
  });
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.convert.convert-again' }));
  await confirm();
  await screen.findByText('requisitions.convert.empty');
  expect(releaseRequisitions).toHaveBeenCalledTimes(2);
  queryClient.clear();
});
it('reconciles uncertain release without order without an order-duplication warning', async () => {
  rows();
  vi.mocked(releaseRequisitions).mockRejectedValueOnce(new AxiosError('Disconnected'));
  vi.mocked(fetchRequisition).mockResolvedValue({
    id: 'March',
    status: 'RELEASED_WITHOUT_ORDER',
  } as never);
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action(false);
  await confirm();
  await waitFor(() => expect(fetchRequisition).toHaveBeenCalledWith('March'));
  await waitFor(() => expect(screen.getAllByRole('checkbox').at(-1)).not.toBeChecked());
  expect(screen.queryByText('requisitions.convert.uncertain-description')).not.toBeInTheDocument();
  queryClient.clear();
});
