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
import { LocalDataUnavailableError, requireOnline } from '@/lib/local-data';
import { reportCaughtError } from '@/lib/report-error';
import { Route } from '@/routes/(protected)/_protected.requisitions.convert';

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/lib/local-data', async (original) => ({
  ...(await original<typeof import('@/lib/local-data')>()),
  requireOnline: vi.fn(),
}));
vi.mock('@/lib/report-error', () => ({ reportCaughtError: vi.fn() }));
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
  vi.mocked(requireOnline).mockReset();
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
      rows([row('April')]);
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
    await screen.findAllByText('April');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'requisitions.convert.title' })).toHaveFocus(),
    );
    await waitFor(() => expect(fetchConvertList).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getAllByRole('checkbox').at(-1) as HTMLElement);
    await action(createOrder);
    await confirm();
    await waitFor(() =>
      expect(releaseRequisitions).toHaveBeenNthCalledWith(2, {
        createOrder,
        requisitionsToRelease: [{ requisitionId: 'April', supplyingDepotId: 'a' }],
      }),
    );
    expect(queryClient.getQueryState([...queryKeys.home.all, 'test-count'])?.isInvalidated).toBe(
      true,
    );
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Select Page' })).not.toBeChecked(),
    );
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
  'clears ticks after uncertain failure %s and confirms a reselected unresolved row',
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
    expect(screen.getAllByRole('checkbox').at(-1)).not.toBeChecked();
    await selectRow();
    await action();
    await screen.findByText('requisitions.convert.retry-confirm');
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
it('checks every submitted status and clears all ticks after a 502', async () => {
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
  expect(boxes[2]).not.toBeChecked();
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
    expect(
      screen.getByRole('heading', { name: 'requisitions.convert.select-none' }),
    ).toBeInTheDocument();
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
it('requires extra confirmation before the normal confirmation for a refused unresolved conversion', async () => {
  rows();
  vi.mocked(releaseRequisitions).mockRejectedValueOnce(new AxiosError('Disconnected'));
  vi.mocked(fetchRequisition).mockRejectedValue(
    new AxiosError('Forbidden', undefined, undefined, undefined, { status: 403 } as never),
  );
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await confirm();
  await screen.findByText('requisitions.convert.uncertain-description');
  vi.mocked(releaseRequisitions).mockImplementation(async () => {
    rows([], 0);
  });
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  expect(screen.getAllByRole('checkbox').at(-1)).not.toBeChecked();
  await selectRow();
  await action();
  await screen.findByText('requisitions.convert.retry-confirm');
  await confirm();
  await screen.findByText('requisitions.convert.convert-confirm');
  expect(releaseRequisitions).toHaveBeenCalledTimes(1);
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
  await screen.findByText('requisitions.convert.release-unknown-description');
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  expect(screen.getAllByRole('checkbox').at(-1)).not.toBeChecked();
  expect(screen.queryByText('requisitions.convert.uncertain-description')).not.toBeInTheDocument();
  queryClient.clear();
});

it('treats offline refusal as unsent', async () => {
  rows();
  vi.mocked(requireOnline).mockImplementation(() => {
    throw new LocalDataUnavailableError();
  });
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await confirm();
  await screen.findByText('requisitions.convert.offline');
  expect(releaseRequisitions).not.toHaveBeenCalled();
  expect(fetchRequisition).not.toHaveBeenCalled();
  expect(reportCaughtError).not.toHaveBeenCalled();
  queryClient.clear();
});
it('keeps a refused release status explicitly unknown', async () => {
  rows();
  vi.mocked(releaseRequisitions).mockRejectedValueOnce(new AxiosError('Disconnected'));
  vi.mocked(fetchRequisition).mockRejectedValueOnce(new Error('Refused'));
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action(false);
  await confirm();
  await screen.findByText('requisitions.convert.release-unknown-description');
  expect(
    screen.getByRole('heading', { name: 'requisitions.convert.release-unknown' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('requisitions.convert.failed-description')).not.toBeInTheDocument();
  queryClient.clear();
});
it('clears validation when ticks no longer include a missing depot', async () => {
  rows([row('March', []), row('April', [])]);
  const { queryClient } = renderRoute('/requisitions/convert');
  await screen.findAllByText('March');
  await userEvent.click(screen.getAllByRole('checkbox')[1]);
  await action();
  await screen.findByRole('heading', { name: 'requisitions.convert.no-depot' });
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await userEvent.click(screen.getAllByRole('checkbox')[1]);
  await userEvent.click(screen.getAllByRole('checkbox')[2]);
  expect(
    screen.getAllByRole('combobox', { name: 'requisitions.convert.depot-label' }).at(-1),
  ).not.toHaveAttribute('aria-invalid', 'true');
  queryClient.clear();
});
it('resets validation after success before ticking a new depot-less row', async () => {
  rows([
    row('March', [
      { id: 'a', name: 'Depot A' },
      { id: 'b', name: 'Depot B' },
    ]),
  ]);
  vi.mocked(releaseRequisitions).mockImplementation(async () => {
    rows([row('April', [])]);
  });
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await screen.findByRole('heading', { name: 'requisitions.convert.no-depot' });
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'requisitions.convert.depot-label' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Depot A' }));
  await action();
  await confirm();
  await screen.findAllByText('April');
  await userEvent.click(screen.getAllByRole('checkbox').at(-1) as HTMLElement);
  expect(
    screen.getByRole('combobox', { name: 'requisitions.convert.depot-label' }),
  ).not.toHaveAttribute('aria-invalid', 'true');
  queryClient.clear();
});

it('shows the facility once in phone cards', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 390,
  } as DOMRect);
  rows();
  const { queryClient } = renderRoute('/requisitions/convert');
  await screen.findAllByText('March');
  expect(screen.queryByText('Family Planning - HC01 - Comfort')).not.toBeInTheDocument();
  expect(screen.getAllByText('HC01 - Comfort')).toHaveLength(1);
  queryClient.clear();
});

it('never resends a processed id in the next batch after a 503 with refused status reads', async () => {
  rows([row('March'), row('April')]);
  vi.mocked(fetchRequisition).mockRejectedValue(
    new AxiosError('Forbidden', undefined, undefined, undefined, { status: 403 } as never),
  );
  vi.mocked(releaseRequisitions)
    .mockImplementationOnce(async () => {
      rows([row('April')]);
      throw new AxiosError('Unavailable', undefined, undefined, undefined, {
        status: 503,
      } as never);
    })
    .mockResolvedValueOnce(undefined);
  const { queryClient } = renderRoute('/requisitions/convert');
  queryClient.setQueryData([...queryKeys.home.all, 'test-count'], 1);
  await screen.findAllByText('March');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Page' }));
  await action();
  await confirm();
  await screen.findByText('requisitions.convert.uncertain-description');
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(screen.queryByText('March')).not.toBeInTheDocument());
  expect(
    screen.getAllByRole('checkbox').every((box) => box.getAttribute('aria-checked') === 'false'),
  ).toBe(true);
  expect(queryClient.getQueryState([...queryKeys.home.all, 'test-count'])?.isInvalidated).toBe(
    true,
  );
  await userEvent.click(screen.getAllByRole('checkbox').at(-1) as HTMLElement);
  await action();
  await screen.findByText('requisitions.convert.retry-confirm');
  await confirm();
  await confirm();
  await waitFor(() =>
    expect(releaseRequisitions).toHaveBeenNthCalledWith(2, {
      createOrder: true,
      requisitionsToRelease: [{ requisitionId: 'April', supplyingDepotId: 'a' }],
    }),
  );
  queryClient.clear();
});
it('keeps phone depot labels and errors outside Field sizing rules and wraps the chosen name', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 390,
  } as DOMRect);
  rows([row('March', [])]);
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await userEvent.click(await screen.findByRole('button', { name: 'dialog.close' }));
  const select = screen.getByRole('combobox', { name: 'requisitions.convert.depot-label' });
  const field = select.closest('[data-slot="field"]');
  if (!field) throw new Error('Depot Field missing');
  expect(field.querySelector(':scope > .sr-only')).toBeNull();
  expect(field.querySelector('.contents .sr-only label')).not.toBeNull();
  expect(field.querySelector('.contents .sr-only [id$="-error"]')).not.toBeNull();
  expect(select).toHaveClass('w-full', 'whitespace-normal');
  queryClient.clear();
});

it.each([true, false])(
  'allows a reselected row without extra confirmation after a proven release (%s)',
  async (createOrder) => {
    rows();
    vi.mocked(releaseRequisitions).mockRejectedValueOnce(new AxiosError('Disconnected'));
    vi.mocked(fetchRequisition).mockResolvedValue({ id: 'March', status: 'RELEASED' } as never);
    const { queryClient } = renderRoute('/requisitions/convert');
    await selectRow();
    await action(createOrder);
    await confirm();
    await screen.findByText(
      createOrder
        ? 'requisitions.convert.uncertain-description'
        : 'requisitions.convert.release-unknown-description',
    );
    await waitFor(() => expect(fetchRequisition).toHaveBeenCalledWith('March'));
    await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
    await selectRow();
    await action(createOrder);
    await screen.findByText(
      createOrder ? 'requisitions.convert.convert-confirm' : 'requisitions.convert.release-confirm',
    );
    expect(screen.queryByText('requisitions.convert.retry-confirm')).not.toBeInTheDocument();
    queryClient.clear();
  },
);
it('allows release of a reselected unresolved row with only the normal release confirmation', async () => {
  rows();
  vi.mocked(releaseRequisitions).mockRejectedValueOnce(new AxiosError('Disconnected'));
  vi.mocked(fetchRequisition).mockRejectedValueOnce(new Error('Refused'));
  const { queryClient } = renderRoute('/requisitions/convert');
  await selectRow();
  await action();
  await confirm();
  await screen.findByText('requisitions.convert.uncertain-description');
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await selectRow();
  await action(false);
  await screen.findByText('requisitions.convert.release-confirm');
  expect(screen.queryByText('requisitions.convert.retry-confirm')).not.toBeInTheDocument();
  queryClient.clear();
});

it('describes a failed convert list without referring to one facility', async () => {
  vi.mocked(fetchConvertList).mockRejectedValue(new Error('Service failed'));
  const { queryClient } = renderRoute('/requisitions/convert');
  await screen.findByText('requisitions.convert.error-description');
  expect(screen.queryByText('requisitions.view.error-description')).not.toBeInTheDocument();
  queryClient.clear();
});
