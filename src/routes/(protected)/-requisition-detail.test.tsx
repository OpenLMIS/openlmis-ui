import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { Profiler, useId } from 'react';
import { toast } from 'sonner';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchOrderablesByIdentities,
  fetchProgramLookup,
  fetchSupervisoryNodesByIds,
} from '@/features/reference-data/api/api';
import { fetchRequisition, fetchStatusMessages } from '@/features/requisitions/api/api';
import { buildRequisitionDraft } from '@/features/requisitions/lib/draft';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { client } from '@/integrations/axios';
import { getLocalDb } from '@/integrations/local-db';
import { openReport } from '@/lib/open-report';
import { Route } from '@/routes/(protected)/_protected.requisitions.view_.$requisitionId';
import { expectRouteWarning } from '@/test-utils/expect-route-warning';
import { httpError } from '@/test-utils/http-error';

const modelTracking = vi.hoisted(() => ({
  enabled: false,
  models: [] as unknown[][],
  rows: [] as string[],
}));
vi.mock('@/features/requisitions/components/requisition-grid', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/requisitions/components/requisition-grid')>();
  return {
    ...actual,
    RequisitionGridView: (
      props: import('react').ComponentProps<typeof actual.RequisitionGridView>,
    ) => {
      if (modelTracking.enabled) modelTracking.models.push(props.models);
      return <actual.RequisitionGridView {...props} />;
    },
  };
});

vi.mock('@/components/ui/table', async (original) => {
  const actual = await original<typeof import('@/components/ui/table')>();
  return {
    ...actual,
    TableRow: (props: import('react').ComponentProps<typeof actual.TableRow>) => {
      const id = useId();
      return (
        <Profiler
          id={id}
          onRender={(id, phase) => {
            if (modelTracking.enabled && props.pinned && !props.surface && phase === 'update')
              modelTracking.rows.push(id);
          }}
        >
          <actual.TableRow {...props} />
        </Profiler>
      );
    },
  };
});

vi.mock('@/lib/open-report', () => ({
  openReport: vi.fn(() => ({ deliver: vi.fn(), close: vi.fn() })),
}));

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  storedTimeZone: vi.fn(() => null),
  fetchRejectionReasonCategories: vi.fn(async () => [
    { id: 'category', code: 'C', name: 'Category', active: true },
  ]),
  fetchRejectionReasons: vi.fn(async () => [
    {
      id: 'reason',
      code: 'R',
      name: 'Reason',
      active: true,
      rejectionReasonCategory: { id: 'category', code: 'C', name: 'Category', active: true },
    },
  ]),
  fetchUserRecord: vi.fn(async () => ({
    id: 'u',
    roleAssignments: [{ roleId: 'approve-role', programId: 'program', supervisoryNodeId: 'node' }],
  })),
  fetchRoles: vi.fn(async () => [
    { id: 'approve-role', rights: [{ name: 'REQUISITION_APPROVE' }] },
  ]),
  fetchFacility: vi.fn(async () => ({
    id: 'f',
    name: 'Comfort',
    code: 'HC01',
    type: { name: 'Clinic' },
  })),
  fetchProcessingPeriod: vi.fn(async () => ({ id: 'period', name: 'March', durationInMonths: 1 })),
  fetchProgramLookup: vi.fn(async () => ({ id: 'program', name: 'Family Planning' })),
  fetchCurrencySettings: vi.fn(async () => ({
    timeZoneId: 'UTC',
    currencyCode: 'USD',
    currencySymbol: '$',
    currencySymbolSide: 'left',
    currencyDecimalPlaces: 2,
    groupingSize: 3,
    groupingSeparator: ',',
    decimalSeparator: '.',
  })),
  fetchOrderablesByIdentities: vi.fn(async () => [product()]),
  fetchApprovedProductsByIdentities: vi.fn(async () => []),
  fetchSupervisoryNodesByIds: vi.fn(async () => []),
  fetchRequisitionGroup: vi.fn(async () => {
    throw new Error('Group lookup failed');
  }),
  fetchUserPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchMinimalFacilities: vi.fn(async () => [{ id: 'f', name: 'Comfort', code: 'HC01' }]),
}));
vi.mock('@/features/requisitions/api/api', async (original) => ({
  ...(await original<typeof import('@/features/requisitions/api/api')>()),
  fetchRequisition: vi.fn(),
  fetchStatusMessages: vi.fn(async () => []),
  fetchUnskipSetting: vi.fn(async () => ({ unskipRequisition: false })),
}));

vi.mock('@/features/requisitions/components/requisition-skeletons', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/requisitions/components/requisition-skeletons')
  >()),
  RequisitionTabsPending: ({ hideSkipped }: { hideSkipped?: boolean }) => (
    <div role="status" aria-label={hideSkipped ? 'pending-skipped-filter' : 'pending-products'} />
  ),
}));

function renderRoute(
  path: string,
  state?: import('@tanstack/react-router').HistoryState,
  seed?: (client: QueryClient) => void,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  seed?.(queryClient);
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/view/$requisitionId',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    errorComponent: Route.options.errorComponent as never,
    pendingComponent: Route.options.pendingComponent as never,
  });
  const history = createMemoryHistory({ initialEntries: [path] });
  if (state) history.replace(path, state);
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([
        layout.addChildren([
          list,
          createRoute({
            getParentRoute: () => layout,
            path: 'requisitions/approve',
            component: () => <p>Approval List</p>,
          }),
          createRoute({
            getParentRoute: () => layout,
            path: 'requisitions/initiate',
            component: () => <p>Create Authorize Search</p>,
          }),
          createRoute({
            getParentRoute: () => layout,
            path: 'requisitions/view',
            component: () => <p>Opening List</p>,
          }),
        ] as never),
      ] as never),
    ] as never),
    context: { queryClient },
    history,
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    { onCaughtError: () => {} },
  );
  return { router, queryClient };
}

afterEach(() => {
  cleanup();
  modelTracking.enabled = false;
  useLoginData.setState({ referenceDataUserId: null });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  onlineManager.setOnline(true);
});

it('shows a missing requisition with a link back to the list search', async () => {
  const assertWarning = expectRouteWarning(
    '/(protected)/_protected/requisitions/view/$requisitionId/requisitions/view/missing',
  );
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|p']);
  vi.mocked(fetchRequisition).mockRejectedValue(httpError(404));
  const { queryClient } = renderRoute('/requisitions/view/missing?facility=f&page=3');
  await screen.findByText('requisitions.requisition.not-found-description');
  const back = screen.getByRole('button', { name: 'requisitions.requisition.back' });
  const url = new URL((back as HTMLAnchorElement).href);
  expect(url.pathname).toBe('/requisitions/view');
  expect(Object.fromEntries(url.searchParams)).toEqual({ facility: 'f', page: '3' });
  assertWarning();
  queryClient.clear();
});

const patientRecord = () => ({
  ...record({
    template: {
      patientsTabEnabled: true,
      columnsMap: {
        skipped: column('skipped', 0, { option: { optionName: 'hideSkippedLineItems' } }),
        'orderable.fullProductName': column('orderable.fullProductName', 1),
        supplyingFacilityStockOnHand: column('supplyingFacilityStockOnHand', 2),
      },
    },
    requisitionLineItems: [
      {
        ...line({ requestedQuantity: 10 }),
        orderable: { id: 'product', versionNumber: 1 },
        approvedProduct: { id: 'approved', versionNumber: 1 },
      },
    ],
  }),
  id: 'r',
  facility: { id: 'f' },
  processingPeriod: { id: 'period' },
  requisitionLineItems: [
    {
      ...line({ requestedQuantity: 10 }),
      orderable: { id: 'product', versionNumber: 1 },
      approvedProduct: { id: 'approved', versionNumber: 1 },
    },
  ],
});
function approvalRecord() {
  return {
    ...patientRecord(),
    template: { ...patientRecord().template, patientsTabEnabled: false },
    status: 'IN_APPROVAL' as const,
    supervisoryNode: 'node',
  };
}
it('recognizes a string supervisory node as the current approval node', async () => {
  vi.stubEnv('BASE_URL', '/v2/');
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|program']);
  vi.mocked(fetchRequisition).mockResolvedValue(approvalRecord());
  const { queryClient } = renderRoute('/requisitions/view/r');
  await screen.findByRole('tab', { name: 'requisitions.requisition.full-supply', selected: true });
  expect(
    screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'requisitions.edit.actions.reject' }),
  ).toBeInTheDocument();
  expect(screen.getByText('requisitions.requisition.supplying-facility')).toBeInTheDocument();
  queryClient.clear();
});
it('shows total requisition cost on the default Patients tab', async () => {
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|program']);
  vi.mocked(fetchRequisition).mockResolvedValue(patientRecord());
  const { queryClient } = renderRoute('/requisitions/view/r');
  await screen.findByRole('tab', { name: 'requisitions.requisition.patients', selected: true });
  expect(await screen.findByText('requisitions.requisition.total-cost')).toBeInTheDocument();
  queryClient.clear();
});

it('keeps the skipped filter out of the pending default Patients tab', async () => {
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|program']);
  vi.mocked(fetchRequisition).mockResolvedValue(patientRecord());
  vi.mocked(fetchOrderablesByIdentities).mockImplementationOnce(() => new Promise(() => {}));
  const { queryClient } = renderRoute('/requisitions/view/r');
  await screen.findByRole('status', { name: 'pending-products' });
  expect(screen.getByRole('status', { name: 'pending-products' })).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'pending-skipped-filter' })).not.toBeInTheDocument();
  queryClient.clear();
});

it('keeps header facts and comments when approval group lookup fails', async () => {
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|program']);
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...patientRecord(),
    status: 'AUTHORIZED',
    supervisoryNode: null,
  });
  vi.mocked(fetchSupervisoryNodesByIds).mockResolvedValueOnce([
    { id: 'node', code: 'NODE', name: 'Node', requisitionGroup: { id: 'group' } },
  ]);
  const { queryClient } = renderRoute('/requisitions/view/r');
  await screen.findAllByText('requisitions.requisition.section-error-title');
  expect(screen.getByText('HC01 - Comfort')).toBeInTheDocument();
  expect(screen.queryByText('requisitions.requisition.no-comments')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'requisitions.requisition.comments' }),
  ).not.toBeInTheDocument();
  queryClient.clear();
});

it('retains edits through tabs and pages and marks calculated errors live', async () => {
  vi.mocked(fetchProgramLookup).mockResolvedValueOnce({
    id: 'program',
    code: 'FP',
    name: 'Family Planning',
    active: true,
    showNonFullSupplyTab: true,
  });
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|program',
    'REQUISITION_CREATE|f|program',
  ]);
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...patientRecord(),
    template: {
      columnsMap: Object.fromEntries(
        [
          column('orderable.fullProductName', 0),
          column('beginningBalance', 1, {
            source: 'USER_INPUT',
            columnDefinition: { columnType: 'NUMERIC' },
          }),
          column('totalConsumedQuantity', 2, {
            source: 'USER_INPUT',
            columnDefinition: { columnType: 'NUMERIC' },
          }),
          column('stockOnHand', 3),
          column('skipped', 4, { source: 'USER_INPUT' }),
        ].map((c) => [c.name, c]),
      ),
    },
    requisitionLineItems: [
      {
        ...line({ beginningBalance: 10, totalConsumedQuantity: 5 }),
        orderable: { id: 'product', versionNumber: 1 },
        approvedProduct: { id: 'approved', versionNumber: 1 },
      },
      {
        ...line({ id: 'second', beginningBalance: 2, totalConsumedQuantity: 1 }),
        orderable: { id: 'product', versionNumber: 1 },
        approvedProduct: { id: 'approved', versionNumber: 1 },
      },
    ],
  });
  const { router, queryClient } = renderRoute('/requisitions/view/r?detailSize=1');
  const input = await screen.findByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { value: '1' } });
  await waitFor(() => expect(screen.getByRole('button', { name: /Page 1:/ })).toBeInTheDocument());
  expect(screen.getByRole('checkbox', { name: 'skipped: Product (P1)' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByLabelText('requisitions.edit.validation.negative')).toBeInTheDocument();
  await router.navigate({
    to: '/requisitions/view/r',
    search: { detailSize: 1, detailPage: 2 },
  } as never);
  expect(
    await screen.findByRole('textbox', { name: 'beginningBalance: Product (P1)' }),
  ).toHaveValue('2');
  await router.navigate({ to: '/requisitions/view/r', search: { detailSize: 1 } } as never);
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toHaveValue(
      '1',
    ),
  );
  fireEvent.click(screen.getByRole('tab', { name: 'requisitions.requisition.non-full-supply' }));
  await screen.findByRole('button', { name: 'requisitions.edit.add-product' });
  fireEvent.click(screen.getByRole('tab', { name: /requisitions.requisition.full-supply/ }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toHaveValue(
      '1',
    ),
  );
  expect(
    within(screen.getByRole('tab', { selected: true })).getByLabelText(
      'requisitions.edit.invalid-lines',
    ),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '10' },
  });
  await waitFor(() =>
    expect(
      screen.queryByLabelText('requisitions.edit.validation.negative'),
    ).not.toBeInTheDocument(),
  );
  expect(screen.queryByRole('button', { name: /Page 1:/ })).not.toBeInTheDocument();
  queryClient.clear();
});

function editingRecord() {
  return {
    ...patientRecord(),
    eTag: '"base"',
    modifiedDate: '2026-10-28T10:00:00Z',
    template: {
      columnsMap: {
        'orderable.fullProductName': column('orderable.fullProductName', 0),
        beginningBalance: column('beginningBalance', 1, {
          source: 'USER_INPUT',
          columnDefinition: { columnType: 'NUMERIC' },
        }),
      },
    },
    requisitionLineItems: [
      {
        ...line({ beginningBalance: 10 }),
        approvedProduct: { id: 'approved', versionNumber: 1 },
        orderable: { id: 'product', versionNumber: 1 },
      },
      {
        ...line({ id: 'second', beginningBalance: 20 }),
        approvedProduct: { id: 'approved', versionNumber: 1 },
        orderable: { id: 'product', versionNumber: 1 },
      },
    ],
  };
}
async function addComment(text: string) {
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.add-comment' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'requisitions.edit.comment' }), {
    target: { value: text },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'requisitions.edit.save-comment' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText(text)).toBeInTheDocument();
}
async function openEditor(
  invalid = false,
  fromList = false,
  authorize = false,
  state?: import('@tanstack/react-router').HistoryState,
) {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
  await getLocalDb().table('requisitionDrafts').clear();
  vi.mocked(fetchOrderablesByIdentities).mockResolvedValue([{ ...product(), description: '' }]);
  vi.mocked(fetchProgramLookup).mockResolvedValue({
    id: 'program',
    name: 'Family Planning',
  } as never);
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|program',
    'REQUISITION_CREATE|f|program',
    'REQUISITION_DELETE|f|program',
    ...(authorize ? ['REQUISITION_AUTHORIZE|f|program'] : []),
  ]);
  const base: RequisitionRecord = editingRecord();
  if (authorize) base.status = 'SUBMITTED';
  if (invalid) base.requisitionLineItems[1].beginningBalance = null;
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  const rendered = renderRoute(
    `/requisitions/view/r?detailSize=1${fromList ? '&facility=f&page=3' : ''}`,
    state,
  );
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toBeEnabled(),
  );
  return { ...rendered, base };
}
it('syncs with If-Match before submitting with an idempotency key and returns to the list', async () => {
  const errorToast = vi.spyOn(toast, 'error');
  const { base, router, queryClient } = await openEditor(false, true);
  const calls: string[] = [];
  const put = vi.spyOn(client, 'put').mockImplementation(async () => {
    calls.push('put');
    return { data: base, headers: { etag: '"saved"' } };
  });
  const post = vi.spyOn(client, 'post').mockImplementation(async () => {
    calls.push('post');
    return { data: {} };
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.submit' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.actions.submit',
    }),
  );
  await screen.findByText('Opening List');
  expect(errorToast).not.toHaveBeenCalled();
  expect(calls).toEqual(['put', 'post']);
  expect(put.mock.calls[0][2]).toEqual({ timeout: 0, headers: { 'If-Match': '"base"' } });
  expect(post.mock.calls[0][2]).toEqual({
    timeout: 0,
    headers: { 'Idempotency-Key': expect.any(String) },
  });
  expect(router.state.location.pathname).toBe('/requisitions/view');
  expect(router.state.location.search).toMatchObject({ facility: 'f', page: 3 });
  expect(await getLocalDb().table('requisitionDrafts').get('r')).toBeUndefined();
  queryClient.clear();
});
it('jumps to the first invalid cell on another page after closing validation', async () => {
  const { router, queryClient } = await openEditor(true);
  expect(screen.queryByRole('button', { name: /Page 2:/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.submit' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText('requisitions.edit.validation-description')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(router.state.location.search).toMatchObject({ detailPage: 2 }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toHaveFocus(),
  );
  queryClient.clear();
});
it.each(['sync', 'submit'] as const)(
  'keeps device edits and offers Update when the save before %s fails',
  async (kind) => {
    const { queryClient } = await openEditor();
    fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
      target: { value: '42' },
    });
    vi.spyOn(client, 'put').mockRejectedValue(httpError(409));
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
    if (kind === 'submit') await confirmAction();
    else fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
    await screen.findByText('requisitions.edit.error.conflict');
    expect(post).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByRole('button', { name: 'requisitions.edit.update' }),
    ).toBeInTheDocument();
    expect(
      (await getLocalDb().table('requisitionDrafts').get('r')).draft.lines.line.beginningBalance,
    ).toBe('42');
    fireEvent.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
    expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toHaveValue(
      '42',
    );
    queryClient.clear();
  },
);
it('locks editing during Sync and uses the refetched ETag next time', async () => {
  const { base, queryClient } = await openEditor();
  await addComment('Temporary comment');
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.remove-comment' }));
  expect(screen.queryByText('Temporary comment')).not.toBeInTheDocument();
  let resolve!: (value: unknown) => void;
  const put = vi.spyOn(client, 'put').mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledOnce());
  expect(put.mock.calls[0][1]).toMatchObject({ draftStatusMessage: '' });
  expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toBeDisabled();
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...base,
    eTag: '"fresh"',
    modifiedDate: 'fresh',
    requisitionLineItems: [
      { ...base.requisitionLineItems[0], beginningBalance: 12 },
      base.requisitionLineItems[1],
    ],
  });
  resolve({
    data: {
      ...base,
      requisitionLineItems: [
        { ...base.requisitionLineItems[0], beginningBalance: 12 },
        base.requisitionLineItems[1],
      ],
    },
    headers: { etag: '"saved"' },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' })).toBeEnabled(),
  );
  expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toHaveValue('12');
  put.mockResolvedValue({ data: base, headers: { etag: '"next"' } });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
  expect(put.mock.calls[1][2]).toEqual({ timeout: 0, headers: { 'If-Match': '"fresh"' } });
  expect(put.mock.calls[1][1]).toMatchObject({ modifiedDate: 'fresh' });
  queryClient.clear();
});
it.each(['sync', 'submit'] as const)(
  'releases Save before its GET and serializes the next %s',
  async (kind) => {
    const { base, queryClient } = await openEditor();
    vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
    const fresh = { ...base, eTag: '"fresh"', modifiedDate: 'fresh' };
    const pending = Promise.withResolvers<typeof fresh>();
    vi.mocked(fetchRequisition).mockReturnValueOnce(pending.promise).mockResolvedValue(fresh);
    const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
    const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
    await waitFor(() => expect(put).toHaveBeenCalledOnce());
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: `requisitions.edit.actions.${kind}` }));
    if (kind === 'submit') {
      const dialog = await screen.findByRole('alertdialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'requisitions.edit.actions.submit' }),
      );
    }
    expect(put).toHaveBeenCalledOnce();
    pending.resolve(fresh);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1][2]).toMatchObject({ headers: { 'If-Match': '"fresh"' } });
    expect(put.mock.calls[1][1]).toMatchObject({
      modifiedDate: 'fresh',
      requisitionLineItems: [expect.objectContaining({ beginningBalance: 14 }), expect.anything()],
    });
    queryClient.clear();
  },
);
it('refetches after a saved PUT loses its GET before sending the next PUT', async () => {
  const { base, queryClient } = await openEditor();
  const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  fireEvent.change(input, { target: { value: '12' } });
  const calls: string[] = [];
  const put = vi.spyOn(client, 'put').mockImplementation(async () => {
    calls.push('put');
    return { data: base, headers: { etag: base.eTag } };
  });
  vi.mocked(fetchRequisition).mockImplementationOnce(async () => {
    calls.push('get-failed');
    throw new AxiosError('Connection lost');
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(put).toHaveBeenCalledOnce();
  fireEvent.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
  fireEvent.change(input, { target: { value: '14' } });
  vi.mocked(fetchRequisition).mockImplementation(async () => {
    calls.push('get');
    return {
      ...base,
      eTag: '"fresh"',
      modifiedDate: 'fresh',
      requisitionLineItems: base.requisitionLineItems.map((line) => ({
        ...line,
        beginningBalance: 12,
      })),
    };
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(calls).toHaveLength(5));
  expect(calls).toEqual(['put', 'get-failed', 'get', 'put', 'get']);
  expect(put.mock.calls[1][2]).toEqual({ timeout: 0, headers: { 'If-Match': '"fresh"' } });
  expect(put.mock.calls[1][1]).toMatchObject({
    modifiedDate: 'fresh',
    requisitionLineItems: [expect.objectContaining({ beginningBalance: 14 }), expect.anything()],
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' })).toBeEnabled(),
  );
  queryClient.clear();
});
it('deletes only after confirmation, removes the saved copy and toasts before returning', async () => {
  const { router, queryClient } = await openEditor();
  const copies = getLocalDb().table('requisitionCopies');
  await copies.put({ id: 'r', userId: 'u' });
  const success = vi.spyOn(toast, 'success');
  const navigate = vi.spyOn(router, 'navigate');
  const messageReads = vi.mocked(fetchStatusMessages).mock.calls.length;
  const remove = vi.spyOn(client, 'delete').mockImplementation(async () => {
    expect(success).not.toHaveBeenCalled();
    return { data: undefined };
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.delete' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'requisitions.edit.actions.delete' }));
  await screen.findByText('Create Authorize Search');
  expect(remove).toHaveBeenCalledWith('/requisitions/r', { timeout: 0 });
  expect(vi.mocked(fetchStatusMessages).mock.calls).toHaveLength(messageReads);
  expect(await copies.get('r')).toBeUndefined();
  expect(success).toHaveBeenCalledWith('requisitions.edit.success.delete', {
    description: 'requisitions.edit.success.delete-description',
  });
  expect(success.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  queryClient.clear();
});

it('checks a reused action key and retains saved values before Update', async () => {
  const { base, queryClient } = await openEditor();
  vi.spyOn(client, 'put').mockImplementation(async (_path, body) => {
    const saved = { ...base, ...(body as object) };
    vi.mocked(fetchRequisition).mockResolvedValue({ ...saved, eTag: '"fresh"' });
    return { data: saved, headers: { etag: '"saved"' } };
  });
  const reads = vi.mocked(fetchRequisition).mock.calls.length;
  vi.spyOn(client, 'post').mockRejectedValue(
    httpError(409, { messageKey: 'requisition.error.validation.idempotencyKey.alreadyUsed' }),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.submit' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.actions.submit',
    }),
  );
  await waitFor(() =>
    expect(
      within(screen.getByRole('alertdialog')).getByText('requisitions.edit.error.key-used'),
    ).toBeInTheDocument(),
  );
  const dialog = screen.getByRole('alertdialog');
  expect(await getLocalDb().table('requisitionDrafts').get('r')).toBeUndefined();
  expect(fetchRequisition).toHaveBeenCalledTimes(reads + 2);
  expect(
    within(dialog).getByRole('button', { name: 'requisitions.edit.update' }),
  ).toBeInTheDocument();
  queryClient.clear();
});

it('adds an available emergency full-supply product to its tab with the program price', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
  await getLocalDb().table('requisitionDrafts').clear();
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|program',
    'REQUISITION_CREATE|f|program',
  ]);
  const added = product({
    id: 'added',
    productCode: 'P2',
    fullProductName: 'Added',
    programs: [{ programId: 'program', fullSupply: true, pricePerPack: 7 }],
  });
  let offer!: (value: Awaited<ReturnType<typeof fetchOrderablesByIdentities>>) => void;
  vi.mocked(fetchOrderablesByIdentities).mockImplementation(async (identities) => {
    if (identities.length === 1 && identities[0].id === 'added')
      return new Promise((resolve) => {
        offer = resolve;
      });
    if (identities.some(({ id }) => id === 'added')) return new Promise(() => {});
    return [{ ...product(), description: null }];
  });
  const base = {
    ...editingRecord(),
    emergency: true,
    availableProducts: [{ id: 'added', versionNumber: 1 }],
    template: {
      columnsMap: {
        'orderable.fullProductName': column('orderable.fullProductName', 0),
        requestedQuantity: column('requestedQuantity', 1, {
          source: 'USER_INPUT',
          columnDefinition: { columnType: 'NUMERIC' },
        }),
      },
    },
  };
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  const user = userEvent.setup();
  const { router, queryClient } = renderRoute('/requisitions/view/r');
  await user.click(await screen.findByRole('button', { name: 'requisitions.edit.add-product' }));
  const dialog = await screen.findByRole('dialog');
  expect(
    screen.getAllByRole('textbox', { name: 'requestedQuantity: Product (P1)', hidden: true }),
  ).toHaveLength(2);
  expect(
    screen.queryByRole('status', { name: 'pending-products', hidden: true }),
  ).not.toBeInTheDocument();
  await waitFor(() => expect(offer).toBeDefined());
  offer([{ ...added, description: null }]);
  await user.click(await within(dialog).findByRole('checkbox', { name: /Added/ }));
  await user.click(
    within(dialog).getByRole('button', { name: 'requisitions.edit.products.add-picked' }),
  );
  await waitFor(() => expect(router.state.location.search.addProduct).toBeUndefined());
  const input = await screen.findByRole('textbox', { name: 'requestedQuantity: Added (P2)' });
  fireEvent.change(input, { target: { value: '30' } });
  const put = vi
    .spyOn(client, 'put')
    .mockResolvedValue({ data: base, headers: { etag: '"saved"' } });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledOnce());
  expect(put.mock.calls[0][1]).toMatchObject({
    requisitionLineItems: expect.arrayContaining([
      expect.objectContaining({
        orderable: { id: 'added', versionNumber: 1 },
        pricePerPack: 7,
        requestedQuantity: 30,
      }),
    ]),
  });
  queryClient.clear();
});

it('does not mark untouched lines until editing or a submit attempt', async () => {
  const { router, queryClient } = await openEditor(true);
  expect(screen.queryByLabelText('requisitions.edit.invalid-lines')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Page 2:/ })).not.toBeInTheDocument();
  await router.navigate({
    to: '/requisitions/view/r',
    search: { detailSize: 1, detailPage: 2 },
  } as never);
  const input = await screen.findByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { value: '1' } });
  fireEvent.change(input, { target: { value: '' } });
  await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
  queryClient.clear();
});
it('keeps an outdated device draft read-only until Update', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
  const base = editingRecord();
  await getLocalDb()
    .table('requisitionDrafts')
    .put({
      draftId: 'r',
      userId: 'u',
      formatVersion: 1,
      modifiedDate: 'older',
      draft: {
        lines: { line: { beginningBalance: '42' } },
        addedLines: [],
        removedLineIds: [],
        draftStatusMessage: '',
        datePhysicalStockCountCompleted: null,
      },
    });
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|program',
    'REQUISITION_CREATE|f|program',
  ]);
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  const { queryClient } = renderRoute('/requisitions/view/r');
  await screen.findByText('requisitions.edit.outdated-title');
  for (const input of screen.getAllByRole('textbox', { name: 'beginningBalance: Product (P1)' }))
    expect(input).toBeDisabled();
  expect(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' })).toBeDisabled();
  queryClient.clear();
});

it('opens the editable adjustments dialog from its grid button', async () => {
  const base: RequisitionRecord = editingRecord();
  base.template.columnsMap = {
    ...base.template.columnsMap,
    totalLossesAndAdjustments: column('totalLossesAndAdjustments', 2, { source: 'USER_INPUT' }),
  };
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
  await getLocalDb().table('requisitionDrafts').clear();
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|program',
    'REQUISITION_CREATE|f|program',
  ]);
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  const { queryClient } = renderRoute('/requisitions/view/r');
  const adjustmentButton = (
    await screen.findAllByRole('button', { name: /^totalLossesAndAdjustments: .*Product \(P1\)/ })
  )[0];
  await waitFor(() => expect(adjustmentButton).toBeEnabled());
  fireEvent.click(adjustmentButton);
  expect(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'requisitions.edit.update',
    }),
  ).toBeInTheDocument();
  queryClient.clear();
});

it('validates the latest cell edits after the draft is already dirty', async () => {
  const { queryClient } = await openEditor();
  const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  fireEvent.change(input, { target: { value: '12' } });
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.submit' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText('requisitions.edit.validation-description')).toBeInTheDocument();
  queryClient.clear();
});

async function confirmAction(kind: 'submit' | 'authorize' = 'submit') {
  fireEvent.click(screen.getByRole('button', { name: `requisitions.edit.actions.${kind}` }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: `requisitions.edit.actions.${kind}`,
    }),
  );
}
it('locks grid and comment editing while Submit is pending', async () => {
  const { base, queryClient } = await openEditor();
  await addComment('Pending comment');
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  let complete!: (value: unknown) => void;
  const post = vi.spyOn(client, 'post').mockImplementation(
    () =>
      new Promise((done) => {
        complete = done;
      }),
  );
  await confirmAction();
  await waitFor(() => expect(post).toHaveBeenCalledOnce());
  expect(
    screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)', hidden: true }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'requisitions.edit.edit-comment', hidden: true }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'requisitions.edit.remove-comment', hidden: true }),
  ).toBeDisabled();
  complete({ data: {} });
  await screen.findByText('Create Authorize Search');
  queryClient.clear();
});
it.each(['submit', 'authorize'] as const)(
  'reconciles timed-out %s before retrying without another save',
  async (kind) => {
    const { base, queryClient } = await openEditor(false, false, kind === 'authorize');
    const saved = { ...base, modifiedDate: 'saved' };
    vi.mocked(fetchRequisition).mockResolvedValue(saved);
    const put = vi.spyOn(client, 'put').mockResolvedValue({ data: saved, headers: {} });
    const post = vi
      .spyOn(client, 'post')
      .mockRejectedValueOnce(new AxiosError('Timeout', 'ECONNABORTED'))
      .mockResolvedValue({ data: {} });
    await confirmAction(kind);
    fireEvent.click(await screen.findByRole('button', { name: 'dialog.close' }));
    vi.mocked(fetchRequisition).mockResolvedValue(saved);
    const reads = vi.mocked(fetchRequisition).mock.calls.length;
    await confirmAction(kind);
    await screen.findByText('Create Authorize Search');
    expect(vi.mocked(fetchRequisition).mock.calls.length).toBe(reads + 2);
    expect(put).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][2]).toEqual(post.mock.calls[0][2]);
    queryClient.clear();
  },
);
it.each(['submit', 'authorize'] as const)(
  'shows the advanced record after a timed-out %s instead of saving or posting again',
  async (kind) => {
    const { base, queryClient } = await openEditor(false, false, kind === 'authorize');
    const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
    const post = vi
      .spyOn(client, 'post')
      .mockRejectedValue(new AxiosError('Timeout', 'ECONNABORTED'));
    await confirmAction(kind);
    fireEvent.click(await screen.findByRole('button', { name: 'dialog.close' }));
    vi.mocked(fetchRequisition).mockResolvedValue({
      ...base,
      status: kind === 'submit' ? 'SUBMITTED' : 'AUTHORIZED',
      modifiedDate: 'advanced',
    });
    await confirmAction(kind);
    await screen.findByText('Create Authorize Search');
    expect(put).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledOnce();
    queryClient.clear();
  },
);
it('refuses a timed-out Submit retry when the server draft changed', async () => {
  const { base, queryClient } = await openEditor();
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi
    .spyOn(client, 'post')
    .mockRejectedValue(new AxiosError('Timeout', 'ECONNABORTED'));
  await confirmAction();
  fireEvent.click(await screen.findByRole('button', { name: 'dialog.close' }));
  vi.mocked(fetchRequisition).mockResolvedValue({ ...base, modifiedDate: 'changed' });
  await confirmAction();
  await screen.findByText('requisitions.edit.error.conflict');
  expect(put).toHaveBeenCalledOnce();
  expect(post).toHaveBeenCalledOnce();
  queryClient.clear();
});
it('keeps edits and makes no reads when closing a forbidden Sync', async () => {
  const { queryClient } = await openEditor();
  const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  fireEvent.change(input, { target: { value: '42' } });
  vi.spyOn(client, 'put').mockRejectedValue(httpError(403));
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  const dialog = await screen.findByRole('alertdialog');
  const reads = vi.mocked(fetchRequisition).mock.calls.length;
  fireEvent.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(input).toHaveValue('42');
  expect(fetchRequisition).toHaveBeenCalledTimes(reads);
  queryClient.clear();
});

it('shows only the save error dialog when saving before Print fails', async () => {
  const { queryClient } = await openEditor();
  const errorToast = vi.spyOn(toast, 'error');
  vi.spyOn(client, 'put').mockRejectedValue(httpError(409));
  const get = vi.spyOn(client, 'get');
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.requisition.print' }));
  await screen.findByText('requisitions.edit.error.conflict');
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'requisitions.requisition.print', hidden: true }),
    ).toBeEnabled(),
  );
  expect(errorToast).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  expect(vi.mocked(openReport).mock.results.at(-1)?.value.close).toHaveBeenCalledOnce();
  queryClient.clear();
});

it('offers only Load for a newer device draft and adopts it without overwriting it', async () => {
  const { queryClient } = await openEditor();
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '12' },
  });
  const table = getLocalDb().table('requisitionDrafts');
  await waitFor(async () => expect(await table.get('r')).toBeDefined());
  const stored = await table.get('r');
  await table.put({
    ...stored,
    revision: stored.revision + 1,
    draft: { ...stored.draft, lines: { line: { beginningBalance: '99' } } },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '13' },
  });
  const dialog = await screen.findByRole('alertdialog');
  expect(
    within(dialog).getByText('requisitions.edit.draft-conflict-description'),
  ).toBeInTheDocument();
  expect(within(dialog).getAllByRole('button')).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole('button', { name: 'stock-events.draft-load' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toHaveValue(
      '99',
    ),
  );
  expect((await table.get('r')).revision).toBe(stored.revision + 1);
  queryClient.clear();
});
it('disables conflict Update offline with the footer action explanation', async () => {
  const { queryClient } = await openEditor();
  vi.spyOn(client, 'put').mockRejectedValue(httpError(409));
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await screen.findByText('requisitions.edit.error.conflict');
  onlineManager.setOnline(false);
  const update = screen.getByRole('button', { name: 'requisitions.edit.update' });
  await waitFor(() => expect(update).toHaveAttribute('aria-disabled', 'true'));
  expect(update).toHaveAttribute('aria-description', 'offline.action-description');
  queryClient.clear();
});

it('confirms Update before discarding a conflicting device draft', async () => {
  const capture = await import('@/features/requisitions/lib/offline-capture-single');
  const saveCopy = vi.spyOn(capture, 'captureSingle').mockResolvedValue({} as never);
  const { base, queryClient } = await openEditor(false, true);
  const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  fireEvent.change(input, { target: { value: '42' } });
  vi.spyOn(client, 'put').mockRejectedValue(httpError(409));
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  const error = await screen.findByRole('alertdialog');
  const reads = vi.mocked(fetchRequisition).mock.calls.length;
  fireEvent.click(within(error).getByRole('button', { name: 'requisitions.edit.update' }));
  await waitFor(() =>
    expect(screen.getByText('requisitions.edit.actions.update-confirm')).toBeInTheDocument(),
  );
  expect(fetchRequisition).toHaveBeenCalledTimes(reads);
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.cancel' }),
  );
  expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toHaveValue('42');
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.update',
    }),
  );
  saveCopy.mockImplementation(() => new Promise(() => {}));
  vi.mocked(fetchRequisition).mockResolvedValue({ ...base, modifiedDate: 'fresh' });
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.actions.update',
    }),
  );
  await waitFor(() => expect(fetchRequisition).toHaveBeenCalledTimes(reads + 1));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' })).toHaveValue(
      '10',
    ),
  );
  queryClient.clear();
});

it.each([true, false])(
  'reserves the pending footer only for editable requisitions: %s',
  async (editable) => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      'REQUISITION_VIEW|f|program',
      ...(editable ? ['REQUISITION_CREATE|f|program'] : []),
    ]);
    vi.mocked(fetchRequisition).mockResolvedValue(editingRecord());
    vi.mocked(fetchOrderablesByIdentities).mockImplementationOnce(() => new Promise(() => {}));
    const { queryClient } = renderRoute('/requisitions/view/r');
    await screen.findByRole('status', { name: 'pending-products' });
    expect(!!document.querySelector('[data-slot="workspace-footer"]')).toBe(editable);
    queryClient.clear();
  },
);

it.each(['submit', 'authorize'] as const)('uses the GET base for %s after Sync', async (kind) => {
  const { base, queryClient } = await openEditor(false, false, kind === 'authorize');
  vi.spyOn(toast, 'success');
  const put = vi.spyOn(client, 'put').mockResolvedValue({
    data: base,
    headers: { etag: base.eTag },
  });
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...base,
    eTag: 'W/"2"',
    modifiedDate: 'fresh',
  });
  const post = vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('requisitions.edit.synced-title', expect.anything()),
  );
  await confirmAction(kind);
  await screen.findByText('Create Authorize Search');
  expect(post).toHaveBeenCalledOnce();
  expect(put.mock.calls[1][2]).toEqual({ timeout: 0, headers: { 'If-Match': 'W/"2"' } });
  expect(put.mock.calls[1][1]).toMatchObject({ modifiedDate: 'fresh' });
  queryClient.clear();
});
it.each([1000, 390])(
  'loads invalid numeric text from a stored draft at width %s with a cell error',
  async (width) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
    const base: RequisitionRecord = editingRecord();
    base.template = {
      ...base.template,
      columnsMap: {
        ...base.template.columnsMap,
        totalReceivedQuantity: column('totalReceivedQuantity', 2, {
          source: 'USER_INPUT',
          columnDefinition: { columnType: 'NUMERIC' },
        }),
        totalStockoutDays: column('totalStockoutDays', 3, {
          source: 'USER_INPUT',
          columnDefinition: { columnType: 'NUMERIC' },
        }),
      },
    };
    await getLocalDb().table('requisitionDrafts').clear();
    await getLocalDb()
      .table('requisitionDrafts')
      .put({
        draftId: 'r',
        userId: 'u',
        formatVersion: 1,
        modifiedDate: base.modifiedDate,
        eTag: base.eTag,
        draft: {
          ...buildRequisitionDraft(base),
          lines: {
            line: { beginningBalance: '-', totalReceivedQuantity: '1x', totalStockoutDays: '1x' },
          },
        },
      });
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      'REQUISITION_VIEW|f|program',
      'REQUISITION_CREATE|f|program',
    ]);
    vi.mocked(fetchRequisition).mockResolvedValue(base);
    const { queryClient } = renderRoute('/requisitions/view/r?detailSize=1');
    const input = await screen.findByRole('textbox', { name: 'beginningBalance: Product (P1)' });
    await waitFor(() => expect(input).toBeEnabled());
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(input).toHaveAccessibleDescription('stock-events.positive-number');
    expect(input).toHaveValue('-');
    expect(
      screen.getByRole('textbox', { name: 'totalReceivedQuantity: Product (P1)' }),
    ).toHaveValue('1x');
    expect(screen.getByRole('textbox', { name: 'totalStockoutDays: Product (P1)' })).toHaveValue(
      '1x',
    );
    queryClient.clear();
  },
);
it.each(['-', '1x'])('keeps invalid typed %s editable with a cell error', async (value) => {
  const { queryClient } = await openEditor();
  const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  fireEvent.change(input, { target: { value } });
  await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
  expect(input).toHaveValue(value);
  queryClient.clear();
});
it('keeps open editor inputs and device autosave working offline while server actions are disabled', async () => {
  const { queryClient } = await openEditor();
  act(() => onlineManager.setOnline(false));
  const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  expect(input).toBeEnabled();
  fireEvent.change(input, { target: { value: '42' } });
  await waitFor(async () =>
    expect(
      (await getLocalDb().table('requisitionDrafts').get('r')).draft.lines.line.beginningBalance,
    ).toBe('42'),
  );
  for (const name of [
    'requisitions.edit.actions.sync',
    'requisitions.edit.actions.submit',
    'requisitions.edit.actions.delete',
    'requisitions.requisition.print',
  ]) {
    const button = screen.getByRole('button', { name });
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
    expect(button).toHaveAttribute(
      'aria-description',
      name === 'requisitions.requisition.print'
        ? 'offline.print-description'
        : 'offline.action-description',
    );
  }
  queryClient.clear();
});
it('does not show device save status for a read-only requisition', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
  const base = editingRecord();
  const table = getLocalDb().table('requisitionDrafts');
  await table.clear();
  await table.put({
    draftId: 'r',
    userId: 'u',
    formatVersion: 1,
    modifiedDate: base.modifiedDate,
    eTag: base.eTag,
    draft: { ...buildRequisitionDraft(base), lines: { line: { beginningBalance: '42' } } },
  });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|program']);
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  const { queryClient } = renderRoute('/requisitions/view/r');
  await screen.findByRole('tab', { name: 'requisitions.requisition.full-supply', selected: true });
  await screen.findAllByText('10');
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'pending-products' })).not.toBeInTheDocument(),
  );
  expect(await table.get('r')).toBeDefined();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
  expect(
    screen.queryByText(/stock-events\.draft-(saved|saving|loading|failed|conflict)/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Saved On This Device/i)).not.toBeInTheDocument();
  queryClient.clear();
});

it.each(['read', 'write'] as const)(
  'saves the in-memory draft to the server after device %s failure',
  async (failure) => {
    const records = await import('@/lib/local-records');
    const store = await import('@/lib/draft-store');
    const error = new Error('Device unavailable');
    if (failure === 'read') vi.spyOn(records, 'readOwnedRecord').mockRejectedValueOnce(error);
    const { base, queryClient } = await openEditor();
    if (failure === 'write') vi.spyOn(store, 'saveRevisionedDraft').mockRejectedValue(error);
    fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
      target: { value: '12' },
    });
    await screen.findByText('stock-events.draft-failed');
    const saved = {
      ...base,
      modifiedDate: 'saved',
      eTag: '"saved"',
      requisitionLineItems: base.requisitionLineItems.map((line) => ({
        ...line,
        beginningBalance: 12,
      })),
    };
    vi.mocked(fetchRequisition).mockResolvedValue(saved);
    const put = vi.spyOn(client, 'put').mockResolvedValue({ data: saved, headers: {} });
    fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
    await waitFor(() => expect(put).toHaveBeenCalledOnce());
    expect(put.mock.calls[0][1]).toMatchObject({
      requisitionLineItems: expect.arrayContaining([
        expect.objectContaining({ id: 'line', beginningBalance: 12 }),
      ]),
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' })).toBeEnabled(),
    );
    expect(screen.getByText('stock-events.draft-failed')).toBeInTheDocument();
    queryClient.clear();
  },
);

it('returns to Create/Authorize after tab and grid paging changes before finishing', async () => {
  vi.mocked(fetchProgramLookup).mockResolvedValueOnce({
    id: 'program',
    code: 'P',
    name: 'Family Planning',
    active: true,
    showNonFullSupplyTab: true,
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
  } as DOMRect);
  const search = {
    mode: 'supervised' as const,
    facilityId: 'f',
    programId: 'program',
    emergency: true,
  };
  const { router, queryClient } = await openEditor(false, false, false, {
    requisitionReturn: { to: '/requisitions/initiate', search },
  });
  fireEvent.click(screen.getByRole('tab', { name: /requisitions.requisition.non-full-supply/ }));
  await waitFor(() => expect(router.state.location.search.tab).toBe('nonFullSupply'));
  fireEvent.click(screen.getByRole('tab', { name: /requisitions.requisition.full-supply/ }));
  await screen.findByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
  await waitFor(() => expect(router.state.location.search.detailPage).toBe(2));
  expect(router.state.location.state.requisitionReturn).toEqual({
    to: '/requisitions/initiate',
    search,
  });
  vi.spyOn(client, 'delete').mockResolvedValue({ data: {} });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.delete' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.actions.delete',
    }),
  );
  await screen.findByText('Create Authorize Search');
  expect(router.state.location.search).toEqual(search);
  queryClient.clear();
});

async function openApprover(
  invalid = false,
  reasons = false,
  fromList = true,
  adjustments = false,
) {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
  await getLocalDb().table('requisitionDrafts').clear();
  vi.mocked(fetchOrderablesByIdentities).mockResolvedValue([{ ...product(), description: '' }]);
  vi.mocked(fetchProgramLookup).mockResolvedValue({
    id: 'program',
    name: 'Family Planning',
  } as never);
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|program',
    'REQUISITION_APPROVE|f|program',
  ]);
  const base: RequisitionRecord = {
    ...editingRecord(),
    status: 'AUTHORIZED',
    supervisoryNode: 'node',
    template: {
      rejectionReasonWindowVisible: reasons,
      columnsMap: {
        ...editingRecord().template.columnsMap,
        ...(adjustments
          ? {
              totalLossesAndAdjustments: column('totalLossesAndAdjustments', 3, {
                source: 'USER_INPUT',
              }),
            }
          : {}),
        approvedQuantity: column('approvedQuantity', 2, {
          source: 'USER_INPUT',
          columnDefinition: { columnType: 'NUMERIC' },
        }),
      },
    },
    requisitionLineItems: [
      {
        ...line({ beginningBalance: null, approvedQuantity: invalid ? null : 2 }),
        approvedProduct: { id: 'approved', versionNumber: 1 },
        orderable: { id: 'product', versionNumber: 1 },
      },
    ],
  };
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  const rendered = renderRoute(
    '/requisitions/view/r',
    fromList
      ? {
          requisitionReturn: { to: '/requisitions/approve', search: { page: 3 } },
        }
      : undefined,
  );
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'approvedQuantity: Product (P1)' })).toBeEnabled(),
  );
  return { ...rendered, base };
}
async function confirmApproval() {
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.actions.approve',
    }),
  );
}
it('blocks invalid approval before confirmation or requests', async () => {
  const { queryClient } = await openApprover(true);
  const put = vi.spyOn(client, 'put');
  const post = vi.spyOn(client, 'post');
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  await screen.findByText('requisitions.edit.validation-description');
  expect(put).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
  queryClient.clear();
});
it('saves and approves despite creator errors and returns to the approval search', async () => {
  const { base, router, queryClient } = await openApprover();
  const calls: string[] = [];
  vi.spyOn(client, 'put').mockImplementation(async () => {
    calls.push('save');
    return { data: base, headers: {} };
  });
  const post = vi.spyOn(client, 'post').mockImplementation(async () => {
    calls.push('approve');
    return { data: {} };
  });
  expect(document.querySelector('tr[data-invalid]')).toBeNull();
  await confirmApproval();
  await screen.findByText('Approval List');
  expect(calls).toEqual(['save', 'approve']);
  expect(post).toHaveBeenCalledWith(
    '/requisitions/r/approve',
    {},
    { timeout: 0, headers: { 'Idempotency-Key': expect.any(String) } },
  );
  expect(router.state.location.search).toEqual({ page: 3 });
  queryClient.clear();
});
it.each(['APPROVED', 'IN_APPROVAL', 'REJECTED'] as const)(
  'reconciles an uncertain approval as %s without posting again',
  async (status) => {
    const { base, queryClient } = await openApprover();
    const success = vi.spyOn(toast, 'success');
    const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
    const post = vi
      .spyOn(client, 'post')
      .mockRejectedValue(new AxiosError('Timeout', 'ECONNABORTED'));
    await confirmApproval();
    await screen.findByRole('alertdialog');
    await waitFor(() => expect(screen.getByRole('button', { name: 'dialog.close' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
    vi.mocked(fetchRequisition).mockResolvedValue({
      ...base,
      status,
      supervisoryNode: 'next',
      modifiedDate: 'changed',
    });
    fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
    if (status === 'REJECTED') {
      await screen.findByText('requisitions.edit.error.conflict');
      expect(success).not.toHaveBeenCalled();
    } else await screen.findByText('Approval List');
    expect(put).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledOnce();
    queryClient.clear();
  },
);

it('reconciles a 503 approval after reconnect without sending it again', async () => {
  const { base, queryClient } = await openApprover();
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi.spyOn(client, 'post').mockRejectedValue(httpError(503));
  await confirmApproval();
  await screen.findByText('requisitions.edit.reconciling');
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  act(() => {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
  });
  vi.mocked(fetchRequisition).mockResolvedValue({ ...base, status: 'APPROVED' });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  await screen.findByText('Approval List');
  expect(post).toHaveBeenCalledOnce();
  queryClient.clear();
});
it('takes a new key after a used-key approval leaves the record unchanged', async () => {
  const { base, queryClient } = await openApprover();
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi
    .spyOn(client, 'post')
    .mockRejectedValueOnce(
      httpError(409, { messageKey: 'requisition.error.validation.idempotencyKey.alreadyUsed' }),
    )
    .mockResolvedValueOnce({ data: {} });
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  await confirmApproval();
  await screen.findByText('requisitions.edit.reconciling');
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  await screen.findByText('Approval List');
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[1]?.[2]).not.toEqual(post.mock.calls[0]?.[2]);
  queryClient.clear();
});
it('reconciles a lost rejection as done without rejecting again', async () => {
  const { base, queryClient } = await openApprover();
  const put = vi
    .spyOn(client, 'put')
    .mockImplementation(async (url) =>
      url === '/v2/requisitions/r'
        ? { data: base, headers: {} }
        : Promise.reject(new AxiosError('Timeout', 'ECONNABORTED')),
    );
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.reject' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.actions.reject',
    }),
  );
  await screen.findByText('requisitions.edit.reconciling');
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  vi.mocked(fetchRequisition).mockResolvedValue({ ...base, status: 'REJECTED' });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.reject' }));
  await screen.findByText('Approval List');
  expect(put.mock.calls.filter(([url]) => url === '/requisitions/r/reject')).toHaveLength(1);
  queryClient.clear();
});
it('requires a reason before confirming rejection and sends its DTO after saving', async () => {
  const { base, router, queryClient } = await openApprover(false, true);
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.reject' }));
  await screen.findByRole('combobox', { name: 'requisitions.reject.category' });
  const dialog = screen.getByRole('dialog');
  expect(router.state.location.search.dialog).toBe('reject-reasons');
  expect(
    within(dialog).getByRole('button', { name: 'requisitions.edit.actions.reject' }),
  ).toBeDisabled();
  expect(put).not.toHaveBeenCalled();
  await userEvent.click(
    within(dialog).getByRole('combobox', { name: 'requisitions.reject.category' }),
  );
  await userEvent.click(await screen.findByRole('option', { name: 'Category' }));
  await userEvent.click(
    within(dialog).getByRole('combobox', { name: 'requisitions.reject.reason' }),
  );
  await userEvent.click(await screen.findByRole('option', { name: 'Reason' }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'requisitions.reject.add' }));
  expect(
    within(dialog).getByRole('combobox', { name: 'requisitions.reject.category' }),
  ).not.toHaveTextContent('Category');
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  await userEvent.click(within(dialog).getByRole('button', { name: 'requisitions.reject.remove' }));
  expect(
    within(dialog).getByRole('combobox', { name: 'requisitions.reject.category' }),
  ).toHaveFocus();
  await userEvent.click(
    within(dialog).getByRole('combobox', { name: 'requisitions.reject.reason' }),
  );
  expect(screen.queryByRole('option', { name: 'Reason' })).not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await userEvent.click(
    within(dialog).getByRole('combobox', { name: 'requisitions.reject.category' }),
  );
  await userEvent.click(await screen.findByRole('option', { name: 'Category' }));
  await userEvent.click(
    within(dialog).getByRole('combobox', { name: 'requisitions.reject.reason' }),
  );
  await userEvent.click(await screen.findByRole('option', { name: 'Reason' }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'requisitions.reject.add' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'requisitions.edit.actions.reject' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.actions.reject',
    }),
  );
  await screen.findByText('Approval List');
  expect(put.mock.calls.map(([url]) => url)).toEqual([
    '/v2/requisitions/r',
    '/requisitions/r/reject',
  ]);
  expect(put.mock.calls[1][1]).toEqual([
    {
      rejectionReason: {
        id: 'reason',
        code: 'R',
        name: 'Reason',
        active: true,
        rejectionReasonCategory: { id: 'category', code: 'C', name: 'Category', active: true },
      },
    },
  ]);
  expect(put.mock.calls[1][2]).toEqual({
    timeout: 0,
    headers: { 'Idempotency-Key': expect.any(String) },
  });
  queryClient.clear();
});
it('resends a lost approval with the same key when the record is unchanged', async () => {
  const { base, queryClient } = await openApprover();
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi
    .spyOn(client, 'post')
    .mockRejectedValueOnce(new AxiosError('Timeout', 'ECONNABORTED'))
    .mockResolvedValueOnce({ data: {} });
  await confirmApproval();
  await screen.findByText('requisitions.edit.reconciling');
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  await screen.findByText('Approval List');
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[1]?.[2]).toEqual(post.mock.calls[0]?.[2]);
  queryClient.clear();
});
it('keeps approval edits blocked and ignores repeated clicks while reconciliation is pending', async () => {
  const { base, queryClient } = await openApprover();
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi
    .spyOn(client, 'post')
    .mockRejectedValue(new AxiosError('Timeout', 'ECONNABORTED'));
  await confirmApproval();
  await screen.findByText('requisitions.edit.reconciling');
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  let complete!: (record: RequisitionRecord) => void;
  vi.mocked(fetchRequisition).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const reads = vi.mocked(fetchRequisition).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  await waitFor(() => expect(fetchRequisition).toHaveBeenCalledTimes(reads + 1));
  expect(screen.getByRole('textbox', { name: 'approvedQuantity: Product (P1)' })).toBeDisabled();
  complete({ ...base, status: 'APPROVED' });
  await screen.findByText('Approval List');
  expect(put).toHaveBeenCalledOnce();
  expect(post).toHaveBeenCalledOnce();
  queryClient.clear();
});

it('takes a new approval key after reconciliation reloads a changed record', async () => {
  const { base, queryClient } = await openApprover();
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi
    .spyOn(client, 'post')
    .mockRejectedValueOnce(httpError(500))
    .mockResolvedValueOnce({ data: {} });
  await confirmApproval();
  await screen.findByText('requisitions.edit.reconciling');
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  vi.mocked(fetchRequisition).mockResolvedValue({ ...base, modifiedDate: 'changed' });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  await screen.findByText('requisitions.edit.error.conflict');
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await confirmApproval();
  await screen.findByText('Approval List');
  expect(post.mock.calls[1]?.[2]).not.toEqual(post.mock.calls[0]?.[2]);
  queryClient.clear();
});
it('offers Update during approval reconciliation and keeps its key', async () => {
  const { base, queryClient } = await openApprover();
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi
    .spyOn(client, 'post')
    .mockRejectedValueOnce(httpError(500))
    .mockResolvedValueOnce({ data: {} });
  await confirmApproval();
  await screen.findByText('requisitions.edit.reconciling');
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.update' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'requisitions.edit.actions.update',
    }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  await confirmApproval();
  await screen.findByText('Approval List');
  expect(post.mock.calls[1]?.[2]).toEqual(post.mock.calls[0]?.[2]);
  queryClient.clear();
});
it.each([false, true])('handles an approval lock with prior uncertainty %s', async (retry) => {
  const { base, queryClient } = await openApprover();
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi.spyOn(client, 'post');
  if (retry) post.mockRejectedValueOnce(httpError(500));
  post
    .mockRejectedValueOnce(
      httpError(409, {
        messageKey: 'requisition.error.approve.inProgress',
      }),
    )
    .mockResolvedValueOnce({ data: {} });
  await confirmApproval();
  if (retry) {
    await screen.findByText('requisitions.edit.reconciling');
    fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
    fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  }
  await screen.findByText(
    retry ? 'requisitions.edit.reconciling' : 'requisitions.edit.approval-in-progress',
  );
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  if (retry) {
    fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  } else await confirmApproval();
  await screen.findByText('Approval List');
  if (retry) expect(post.mock.calls[2]?.[2]).toEqual(post.mock.calls[0]?.[2]);
  else expect(post.mock.calls[1]?.[2]).not.toEqual(post.mock.calls[0]?.[2]);
  queryClient.clear();
});

async function openPatients(complete = false, unrelated = false, rowKey = 'numberOfAdultPatients') {
  useLoginData.getState().setLoginData({
    referenceDataUserId: crypto.randomUUID(),
    username: 'u',
    accessToken: 'token',
  });
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|program',
    'REQUISITION_CREATE|f|program',
  ]);
  const base = patientRecord();
  base.patientsData = JSON.stringify({
    TBData: [
      [
        {
          key: rowKey,
          isSkipped: false,
          data: Array.from({ length: 12 }, (_, month) => ({
            value: complete && month < 2 ? 1 : '',
            disabled: month >= 2,
          })),
        },
      ],
    ],
    leprosyData: [[]],
  });
  base.template = {
    patientsTabEnabled: true,
    columnsMap: {
      'orderable.fullProductName': column('orderable.fullProductName'),
      numberOfPatientsOnTreatmentNextMonth: column('numberOfPatientsOnTreatmentNextMonth', 1),
    },
  };
  vi.mocked(fetchOrderablesByIdentities).mockResolvedValue([
    { ...product({ productCode: '10010510AE' }), description: '' },
    ...(unrelated ? [{ ...product({ id: 'unrelated' }), description: '' }] : []),
  ]);
  if (unrelated)
    base.requisitionLineItems = [
      ...base.requisitionLineItems,
      {
        ...base.requisitionLineItems[0],
        id: 'unrelated',
        orderable: { id: 'unrelated', versionNumber: 1 },
      },
    ];
  vi.mocked(fetchRequisition).mockResolvedValue(base);
  const route = renderRoute('/requisitions/view/r');
  await screen.findByRole('tab', { name: 'requisitions.requisition.patients', selected: true });
  const inputs = await screen.findAllByRole('textbox', {
    name: 'requisitions.patients.cell-label',
  });
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  return { ...route, base, inputs };
}

it('opens patient validation without sending a request and focuses the first empty month', async () => {
  const { inputs, router, queryClient } = await openPatients();
  const put = vi.spyOn(client, 'put');
  const post = vi.spyOn(client, 'post');
  fireEvent.change(inputs[0], { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.submit' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText('requisitions.edit.validation-description')).toBeInTheDocument();
  expect(put).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(inputs[1]).toHaveFocus());
  expect(router.state.location.search.tab).toBe('patients');
  queryClient.clear();
});

it('saves draft patients and calculated TC before submitting without opening products', async () => {
  const { inputs, queryClient } = await openPatients(true);
  fireEvent.change(inputs[0], { target: { value: '٤' } });
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: {}, headers: {} });
  const post = vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
  await confirmAction();
  await waitFor(() => expect(post).toHaveBeenCalled());
  expect(put).toHaveBeenCalled();
  const body = put.mock.calls[0][1] as {
    patientsData: string;
    requisitionLineItems: { numberOfPatientsOnTreatmentNextMonth: number }[];
  };
  expect(body.requisitionLineItems[0].numberOfPatientsOnTreatmentNextMonth).toBe(5);
  expect(
    (JSON.parse(body.patientsData) as { TBData: { data: { value: number }[] }[][] }).TBData[0][0]
      .data[0].value,
  ).toBe(4);
  expect(put.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[0]);
  queryClient.clear();
});

it('blocks overflowing patient cells on Sync while retaining the typed draft', async () => {
  const { base, inputs, queryClient } = await openPatients(
    true,
    false,
    'numberOfRetreatmentPatients',
  );
  fireEvent.change(inputs[0], { target: { value: '2147483648' } });
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await screen.findByRole('alertdialog');
  expect(put).not.toHaveBeenCalled();
  expect(inputs[0]).toHaveValue('2147483648');
  queryClient.clear();
});

it('updates TC after patient edits while preserving unrelated product model references', async () => {
  modelTracking.enabled = true;
  modelTracking.models = [];
  try {
    const { queryClient } = await openPatients(true, true);
    fireEvent.click(screen.getByRole('tab', { name: 'requisitions.requisition.priority' }));
    await waitFor(() => expect(modelTracking.models.length).toBeGreaterThan(0));
    const before = modelTracking.models.at(-1) as {
      line: { numberOfPatientsOnTreatmentNextMonth: number };
    }[];
    expect(before[0].line.numberOfPatientsOnTreatmentNextMonth).toBe(2);
    fireEvent.click(screen.getByRole('tab', { name: 'requisitions.requisition.patients' }));
    const inputs = await screen.findAllByRole('textbox', {
      name: 'requisitions.patients.cell-label',
    });
    fireEvent.change(inputs[0], { target: { value: '8' } });
    fireEvent.click(screen.getByRole('tab', { name: /requisitions.requisition.priority/ }));
    await waitFor(() => {
      const after = modelTracking.models.at(-1) as typeof before;
      expect(after[0].line.numberOfPatientsOnTreatmentNextMonth).toBe(9);
      expect(after[1]).toBe(before[1]);
    });
    queryClient.clear();
  } finally {
    modelTracking.enabled = false;
  }
});

it('syncs patient edits with an empty enabled month', async () => {
  const { base, inputs, queryClient } = await openPatients();
  fireEvent.change(inputs[0], { target: { value: '4' } });
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledOnce());
  const body = put.mock.calls[0][1] as { patientsData: string };
  const patients = JSON.parse(body.patientsData) as {
    TBData: { data: { value: number | string }[] }[][];
  };
  expect(patients.TBData[0][0].data.slice(0, 2)).toMatchObject([{ value: 4 }, { value: '' }]);
  queryClient.clear();
});

it.each(['overflowing', 'unreadable'] as const)(
  'keeps stored approver TC and allows approval despite %s patients',
  async (patientsState) => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: crypto.randomUUID(),
      username: 'u',
      accessToken: 'token',
    });
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      'REQUISITION_VIEW|f|program',
      'REQUISITION_APPROVE|f|program',
    ]);
    const base = {
      ...patientRecord(),
      status: 'AUTHORIZED' as const,
      supervisoryNode: 'node',
      patientsData:
        patientsState === 'unreadable'
          ? '{broken'
          : JSON.stringify({
              TBData: [
                [
                  {
                    key: 'numberOfAdultPatients',
                    isSkipped: false,
                    data: [{ value: 2147483648, disabled: false }],
                  },
                ],
              ],
              leprosyData: [[]],
            }),
      template: {
        patientsTabEnabled: true,
        columnsMap: {
          'orderable.fullProductName': column('orderable.fullProductName'),
          numberOfPatientsOnTreatmentNextMonth: column('numberOfPatientsOnTreatmentNextMonth', 1),
        },
      },
      requisitionLineItems: [
        { ...patientRecord().requisitionLineItems[0], numberOfPatientsOnTreatmentNextMonth: 2 },
      ],
    };
    vi.mocked(fetchOrderablesByIdentities).mockResolvedValue([
      { ...product({ productCode: '10010510AE' }), description: '' },
    ]);
    vi.mocked(fetchRequisition).mockResolvedValue(base);
    const { queryClient } = renderRoute('/requisitions/view/r');
    const patientsTab = await screen.findByRole('tab', {
      name: /requisitions.requisition.patients/,
      selected: true,
    });
    expect(
      within(patientsTab).queryByLabelText('requisitions.edit.invalid-lines'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'requisitions.requisition.priority' }));
    const tc = await screen.findByRole('textbox', {
      name: 'numberOfPatientsOnTreatmentNextMonth: Product (10010510AE)',
    });
    await waitFor(() => expect(tc).toBeEnabled());
    expect(tc).toHaveValue('2');
    if (patientsState === 'overflowing') fireEvent.change(tc, { target: { value: '15' } });
    const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
    await confirmApproval();
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(put).toHaveBeenCalledOnce();
    expect(put.mock.calls[0][1]).toMatchObject({
      patientsData: base.patientsData,
      requisitionLineItems: [
        { numberOfPatientsOnTreatmentNextMonth: patientsState === 'overflowing' ? 15 : 2 },
      ],
    });
    queryClient.clear();
  },
);

it.each([false, true])(
  'shows a refreshed reopened record, or keeps local edits as outdated (edited: %s)',
  async (edited) => {
    const { base, router, queryClient } = await openEditor();
    const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
    if (edited) fireEvent.change(input, { target: { value: '42' } });
    vi.mocked(fetchRequisition).mockResolvedValue({
      ...base,
      modifiedDate: '2026-10-28T11:00:00Z',
      draftStatusMessage: 'New server comment',
      requisitionLineItems: base.requisitionLineItems.map((item) => ({
        ...item,
        beginningBalance: 12,
      })),
    });
    await queryClient.invalidateQueries({ queryKey: ['requisitions'], refetchType: 'none' });
    await act(async () => {
      await router.invalidate();
    });
    await waitFor(() => expect(input).toHaveValue(edited ? '42' : '12'));
    if (!edited) expect(await screen.findByText('New server comment')).toBeVisible();
    if (edited) {
      expect(await screen.findByText('requisitions.edit.outdated-title')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'requisitions.edit.actions.submit' }),
      ).toBeDisabled();
    }
    queryClient.clear();
  },
);

it('renders only the edited requisition line while typing', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  const { queryClient, router } = await openEditor();
  await act(async () => {
    await router.navigate({
      to: '/requisitions/view/$requisitionId',
      params: { requisitionId: 'r' },
      search: { detailSize: 100 },
    });
  });
  modelTracking.enabled = true;
  modelTracking.rows = [];
  fireEvent.change(screen.getAllByRole('textbox', { name: 'beginningBalance: Product (P1)' })[0], {
    target: { value: '42' },
  });
  await waitFor(() => expect(new Set(modelTracking.rows).size).toBe(1));
  modelTracking.enabled = false;
  queryClient.clear();
});

it('preserves approval edits on a conflict after another approver acted and reloads on Update', async () => {
  const { base, queryClient } = await openApprover();
  const input = screen.getByRole('textbox', { name: 'approvedQuantity: Product (P1)' });
  fireEvent.change(input, { target: { value: '27' } });
  const put = vi
    .spyOn(client, 'put')
    .mockRejectedValue(httpError(409, { messageKey: 'requisition.error.versionMismatch' }));
  const post = vi.spyOn(client, 'post');
  await confirmApproval();
  await screen.findByText('requisitions.edit.error.conflict');
  expect(post).not.toHaveBeenCalled();
  expect(put).toHaveBeenCalledTimes(2);
  expect(input).toHaveValue('27');
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...base,
    status: 'APPROVED',
    modifiedDate: 'new',
    supervisoryNode: 'next',
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.update' }));
  fireEvent.click(await screen.findByRole('button', { name: 'requisitions.edit.actions.update' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'requisitions.edit.actions.approve' }),
    ).not.toBeInTheDocument(),
  );
  expect(post).not.toHaveBeenCalled();
  queryClient.clear();
});

it.each(['submit', 'approve'] as const)('updates the saved single copy after %s', async (kind) => {
  useLoginData.setState({ referenceDataUserId: 'u' });
  const { getLocalDb, LOCAL_TABLES } = await import('@/integrations/local-db');
  await getLocalDb().table(LOCAL_TABLES.requisitionCopies).clear();
  const access = await import('@/features/requisitions/lib/offline-access');
  const references = await import('@/features/reference-data/api/api');
  const copies = await import('@/features/requisitions/lib/offline-copies');
  const { readSingle } = await import('@/features/requisitions/lib/offline-single');
  const savedAccess = {
    access: {
      userId: 'u',
      permissionStrings: ['REQUISITION_VIEW|f|program'],
      user: { roleAssignments: [] },
    },
    saved: {
      nodes: [],
      roles: [],
      groups: [],
      facilities: [{ id: 'f', name: 'Comfort' }],
      programs: [{ id: 'program', name: 'Family Planning' }],
    },
  };
  vi.spyOn(access, 'readRequisitionAccess').mockResolvedValue(savedAccess as never);
  vi.spyOn(access, 'waitForRequisitionAccess').mockResolvedValue(savedAccess as never);
  vi.mocked(references.fetchApprovedProductsByIdentities).mockResolvedValue([
    { id: 'approved', meta: { versionNumber: 1 } },
  ] as never);
  const { base, queryClient } =
    kind === 'submit' ? await openEditor(false, true) : await openApprover();
  await waitFor(async () =>
    expect((await copies.readCopy('r'))?.single?.record.status).toBe(base.status),
  );
  const status = kind === 'submit' ? 'SUBMITTED' : 'APPROVED';
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: { etag: '"saved"' } });
  vi.spyOn(client, 'post').mockImplementation(async () => {
    vi.mocked(fetchRequisition).mockResolvedValue({
      ...base,
      status,
      modifiedDate: '2026-10-28T10:01:00Z',
    });
    return { data: {} };
  });
  if (kind === 'submit') await confirmAction();
  else await confirmApproval();
  await screen.findByText(kind === 'submit' ? 'Opening List' : 'Approval List');
  await waitFor(async () => expect((await readSingle('r')).single.record.status).toBe(status));
  queryClient.clear();
});

it('does not report recapture failure or save a copy in a different session after Submit', async () => {
  const capture = await import('@/features/requisitions/lib/offline-capture-single');
  const copies = await import('@/features/requisitions/lib/offline-copies');
  const pending = Promise.withResolvers<void>();
  const captureSingle = capture.captureSingle;
  const saveCopy = vi.spyOn(capture, 'captureSingle').mockResolvedValue({} as never);
  const error = vi.spyOn(toast, 'error');
  const { base, queryClient } = await openEditor(false, true);
  await waitFor(() => expect(saveCopy).toHaveBeenCalledOnce());
  saveCopy.mockImplementation(async (...args) => {
    await pending.promise;
    return captureSingle(...args);
  });
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
  await confirmAction();
  await screen.findByText('Opening List');
  await waitFor(() => expect(saveCopy).toHaveBeenCalledTimes(2));
  act(() =>
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'next-user',
      username: 'next',
      accessToken: 'next-token',
    }),
  );
  try {
    await act(async () => {
      pending.resolve();
      await Promise.allSettled(saveCopy.mock.results.map((result) => result.value));
    });
    expect(error).not.toHaveBeenCalledWith('requisitions.offline.failed-title', expect.anything());
    expect(await copies.readCopy('r')).toBeUndefined();
  } finally {
    pending.resolve();
    queryClient.clear();
  }
});

it('offers Update after a refreshed loader cannot adopt its device baseline', async () => {
  const { base, router, queryClient } = await openEditor();
  const store = await import('@/lib/draft-store');
  const save = vi
    .spyOn(store, 'saveRevisionedDraft')
    .mockRejectedValueOnce(new Error('Storage unavailable'));
  vi.mocked(fetchRequisition).mockResolvedValue({ ...base, modifiedDate: '2026-10-28T11:00:00Z' });
  await queryClient.invalidateQueries({ queryKey: ['requisitions'], refetchType: 'none' });
  await act(() => router.invalidate());
  expect(await screen.findByText('requisitions.edit.outdated-title')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'requisitions.edit.update' })).toBeEnabled();
  save.mockRestore();
  queryClient.clear();
});

it.each(['capture', 'clear'] as const)(
  'reports terminal device cleanup accurately after a %s failure',
  async (failure) => {
    const capture = await import('@/features/requisitions/lib/offline-capture-single');
    if (failure === 'clear') {
      const drafts = await import('@/features/requisitions/hooks/use-requisition-draft');
      const useDraft = drafts.useRequisitionDraft;
      vi.spyOn(drafts, 'useRequisitionDraft').mockImplementation((...args) => ({
        ...useDraft(...args),
        clear: async () => {
          throw new Error('Storage unavailable');
        },
      }));
    }
    vi.spyOn(toast, 'error');
    const saveCopy = vi.spyOn(capture, 'captureSingle').mockResolvedValue({} as never);
    const { base, queryClient } = await openEditor(false, true);
    vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
    vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
    await waitFor(() => expect(saveCopy).toHaveBeenCalledOnce());
    if (failure === 'capture') saveCopy.mockRejectedValueOnce(new Error('Storage unavailable'));
    await confirmAction();
    await screen.findByText('Opening List');
    expect(toast.error).not.toHaveBeenCalledWith('requisitions.edit.error-title', {
      description: 'requisitions.edit.clear-error',
    });
    if (failure === 'capture')
      expect(toast.error).toHaveBeenCalledWith('requisitions.offline.failed-title', {
        description: 'requisitions.offline.refresh-failed-description',
      });
    queryClient.clear();
  },
);

it('blocks Sync until loader adoption finishes and then uses the latest Sync baseline', async () => {
  vi.spyOn(toast, 'success');
  const drafts = await import('@/features/requisitions/hooks/use-requisition-draft');
  const useDraft = drafts.useRequisitionDraft;
  const adoption = Promise.withResolvers<void>();
  let adopting = false;
  vi.spyOn(drafts, 'useRequisitionDraft').mockImplementation((...args) => {
    const device = useDraft(...args);
    return {
      ...device,
      update: async (base) => {
        await device.update(base);
        adopting = true;
        await adoption.promise;
      },
    };
  });
  const { base, router, queryClient } = await openEditor();
  const loaded = { ...base, modifiedDate: '2026-10-28T11:00:00Z' };
  vi.mocked(fetchRequisition).mockResolvedValue(loaded);
  await queryClient.invalidateQueries({ queryKey: ['requisitions'], refetchType: 'none' });
  await act(() => router.invalidate());
  await waitFor(() => expect(adopting).toBe(true));
  const synced = { ...base, modifiedDate: '2026-10-28T12:00:00Z', eTag: '"synced"' };
  vi.mocked(fetchRequisition).mockResolvedValue(synced);
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: synced, headers: {} });
  expect(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' })).toBeDisabled();
  expect(put).not.toHaveBeenCalled();
  await act(async () => adoption.resolve());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('requisitions.edit.synced-title', expect.anything()),
  );
  await act(async () => adoption.resolve());
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
  expect(put.mock.calls[1][1]).toMatchObject({ modifiedDate: synced.modifiedDate });
  queryClient.clear();
});

it.each(['submit', 'approve', 'reject'] as const)(
  'reopens fresh without a removed-copy dialog after its own %s',
  async (kind) => {
    const { base, router, queryClient } =
      kind === 'submit' ? await openEditor(false, true) : await openApprover();
    vi.spyOn(client, 'put').mockImplementation(async (url) => {
      if (url === '/requisitions/r/reject') vi.mocked(fetchRequisition).mockResolvedValue(fresh);
      return { data: base, headers: {} };
    });
    const fresh = {
      ...base,
      status:
        kind === 'submit'
          ? ('SUBMITTED' as const)
          : kind === 'approve'
            ? ('APPROVED' as const)
            : ('REJECTED' as const),
      modifiedDate: '2026-10-28T12:00:00Z',
    };
    vi.spyOn(client, 'post').mockImplementation(async () => {
      vi.mocked(fetchRequisition).mockResolvedValue(fresh);
      return { data: {} };
    });
    if (kind === 'submit') await confirmAction();
    else if (kind === 'approve') await confirmApproval();
    else {
      fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.reject' }));
      fireEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'requisitions.edit.actions.reject',
        }),
      );
    }
    await screen.findByText(kind === 'submit' ? 'Opening List' : 'Approval List');
    const reads = vi.mocked(fetchRequisition).mock.calls.length;
    await act(async () => {
      router.history.back();
    });
    await waitFor(() =>
      expect(vi.mocked(fetchRequisition).mock.calls.length).toBeGreaterThan(reads),
    );
    await screen.findByText(`requisitions.status.${fresh.status.toLowerCase()}`);
    expect(screen.queryByText('requisitions.offline.removed-title')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    queryClient.clear();
  },
);

it.each(['approve', 'reject'] as const)('returns direct %s to the approval list', async (kind) => {
  const { base, queryClient } = await openApprover(false, false, false);
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
  if (kind === 'approve') await confirmApproval();
  else {
    fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.reject' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'requisitions.edit.actions.reject',
      }),
    );
  }
  await screen.findByText('Approval List');
  queryClient.clear();
});

it('starts known period, program and currency reads while the fresh requisition is pending', async () => {
  const api = await import('@/features/reference-data/api/api');
  const { queryKeys } = await import('@/lib/key-factory');
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|program']);
  let finish!: (value: ReturnType<typeof patientRecord>) => void;
  vi.mocked(fetchRequisition).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const period = vi.mocked(api.fetchProcessingPeriod).mock.calls.length;
  const program = vi.mocked(api.fetchProgramLookup).mock.calls.length;
  const currency = vi.mocked(api.fetchCurrencySettings).mock.calls.length;
  const { queryClient } = renderRoute('/requisitions/view/r', undefined, (cache) => {
    cache.setQueryData(queryKeys.requisitions.list({}), { content: [patientRecord()] });
  });
  await waitFor(() => {
    expect(api.fetchProcessingPeriod).toHaveBeenCalledTimes(period + 1);
    expect(api.fetchProgramLookup).toHaveBeenCalledTimes(program + 1);
    expect(api.fetchCurrencySettings).toHaveBeenCalledTimes(currency + 1);
    expect(finish).toBeDefined();
  });
  await act(async () => finish(patientRecord()));
  await screen.findByRole('tab', { name: 'requisitions.requisition.patients', selected: true });
  queryClient.clear();
});

it('finishes Sync and Submit while complete copy capture is still pending', async () => {
  const capture = await import('@/features/requisitions/lib/offline-capture-single');
  const saveCopy = vi.spyOn(capture, 'captureSingle').mockResolvedValue({} as never);
  const { base, queryClient } = await openEditor(false, true);
  await waitFor(() => expect(saveCopy).toHaveBeenCalledOnce());
  saveCopy.mockImplementation(() => new Promise(() => {}));
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(saveCopy).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.edit.actions.submit' })).toBeEnabled(),
  );
  await confirmAction();
  await screen.findByText('Opening List');
  expect(post).toHaveBeenCalledOnce();
  queryClient.clear();
});

it('does not open rejection reasons from a direct dialog link when the template disables them', async () => {
  const { router, queryClient } = await openApprover();
  await act(() => router.navigate({ to: '.', search: { dialog: 'reject-reasons' } } as never));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  queryClient.clear();
});

it('opens adjustments read-only for an approver who can edit approval quantities', async () => {
  const { queryClient } = await openApprover(false, false, true, true);
  fireEvent.click(screen.getAllByRole('button', { name: /^totalLossesAndAdjustments:/ })[0]);
  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).queryByRole('button', { name: 'requisitions.edit.update' }),
  ).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
  queryClient.clear();
});

it('uses neutral discard wording when device drafts are unavailable', async () => {
  const drafts = await import('@/features/requisitions/hooks/use-requisition-draft');
  const useDraft = drafts.useRequisitionDraft;
  vi.spyOn(drafts, 'useRequisitionDraft').mockImplementation((...args) => ({
    ...useDraft(...args),
    deviceAvailable: false,
  }));
  const { router, queryClient } = await openEditor();
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '42' },
  });
  act(() => {
    void router.navigate({ to: '/requisitions/view' });
  });
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText('orders.edit.discard-description')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'discard-changes.keep-editing' }));
  queryClient.clear();
});

it('uses the GET ETag after a failed Approve before retrying its PUT', async () => {
  const { base, queryClient } = await openApprover();
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: { etag: '"old"' } });
  vi.mocked(fetchRequisition).mockResolvedValue({ ...base, eTag: '"fresh"' });
  vi.spyOn(client, 'post').mockRejectedValueOnce(httpError(400)).mockResolvedValue({ data: {} });
  await confirmApproval();
  await screen.findByText('requisitions.edit.error-description');
  const dialog = screen.getByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
  await confirmApproval();
  await screen.findByText('Approval List');
  expect(put.mock.calls[1][2]).toMatchObject({ timeout: 0, headers: { 'If-Match': '"fresh"' } });
  queryClient.clear();
});

it('reconciles a lost PUT response before saving again with the fresh version', async () => {
  const { base, queryClient } = await openEditor();
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '12' },
  });
  const put = vi
    .spyOn(client, 'put')
    .mockRejectedValueOnce(new AxiosError('Lost response'))
    .mockResolvedValue({ data: base, headers: {} });
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...base,
    modifiedDate: 'fresh',
    extraData: { originalRequisition: 'server-recovered' },
    eTag: '"fresh"',
    requisitionLineItems: base.requisitionLineItems.map((line, index) =>
      index ? line : { ...line, beginningBalance: 12 },
    ),
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' })).toBeEnabled(),
  );
  expect(put.mock.calls[1][1]).toMatchObject({
    modifiedDate: 'fresh',
    extraData: { originalRequisition: 'server-recovered' },
  });
  expect(put.mock.calls[1][2]).toMatchObject({ headers: { 'If-Match': '"fresh"' } });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '14' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(3));
  expect(put.mock.calls[2][2]).toMatchObject({ headers: { 'If-Match': '"fresh"' } });
  expect(put.mock.calls[2][1]).toMatchObject({ modifiedDate: 'fresh' });
  queryClient.clear();
});

it.each(['submit', 'authorize', 'approve'] as const)(
  '%s does not read between save and transition',
  async (kind) => {
    const { base, queryClient } =
      kind === 'approve'
        ? await openApprover()
        : await openEditor(false, true, kind === 'authorize');
    const get = vi.mocked(fetchRequisition);
    const calls = get.mock.calls.length;
    vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: { etag: '"old"' } });
    const post = vi.spyOn(client, 'post').mockImplementation(async () => {
      expect(get.mock.calls.length).toBe(calls);
      return { data: {} };
    });
    if (kind === 'approve') await confirmApproval();
    else await confirmAction(kind);
    await screen.findByText(kind === 'approve' ? 'Approval List' : 'Opening List');
    expect(post.mock.calls[0][2]).toEqual({
      timeout: 0,
      headers: { 'Idempotency-Key': expect.any(String) },
    });
    queryClient.clear();
  },
);

it('automatically saves a clean conflict merge once with the fresh date and ETag', async () => {
  const { base, queryClient } = await openEditor();
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '12' },
  });
  const put = vi
    .spyOn(client, 'put')
    .mockRejectedValueOnce(httpError(409))
    .mockResolvedValue({ data: base, headers: {} });
  const get = vi
    .mocked(fetchRequisition)
    .mockResolvedValue({ ...base, modifiedDate: 'fresh', eTag: '"fresh"' });
  const calls = get.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
  expect(put.mock.calls[1][1]).toMatchObject({ modifiedDate: 'fresh' });
  expect(put.mock.calls[1][2]).toMatchObject({ headers: { 'If-Match': '"fresh"' } });
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(get.mock.calls.length - calls).toBe(2);
  queryClient.clear();
});

it('keeps typing during conflict recovery and prevents another Sync', async () => {
  const { base, queryClient } = await openEditor();
  const fresh = Promise.withResolvers<RequisitionRecord>();
  vi.spyOn(client, 'put')
    .mockRejectedValueOnce(httpError(409))
    .mockResolvedValue({ data: base, headers: {} });
  const get = vi
    .mocked(fetchRequisition)
    .mockReturnValueOnce(fresh.promise)
    .mockResolvedValue(base);
  const calls = get.mock.calls.length;
  const input = screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' });
  fireEvent.change(input, { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(get.mock.calls.length).toBe(calls + 1));
  expect(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' })).toBeDisabled();
  fireEvent.change(input, { target: { value: '14' } });
  await act(() => fresh.resolve({ ...base, modifiedDate: 'fresh', eTag: '"fresh"' }));
  await waitFor(() =>
    expect(vi.mocked(client.put).mock.calls[1]?.[1]).toMatchObject({
      requisitionLineItems: expect.arrayContaining([
        expect.objectContaining({ beginningBalance: 14 }),
      ]),
    }),
  );
  queryClient.clear();
});

it.each([true, false])(
  'preserves Approve outcome when the follow-up GET fails: %s',
  async (success) => {
    const { base, queryClient } = await openApprover();
    vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
    vi.mocked(fetchRequisition).mockRejectedValueOnce(new Error('Follow-up failed'));
    const post = vi.spyOn(client, 'post');
    if (success) post.mockResolvedValue({ data: {} });
    else post.mockRejectedValue(httpError(400));
    await confirmApproval();
    if (success) await screen.findByText('Approval List');
    else await screen.findByText('requisitions.edit.error-description');
    expect(post).toHaveBeenCalledOnce();
    queryClient.clear();
  },
);

it('reconciles an uncertain approval retry only once', async () => {
  const { base, queryClient } = await openApprover();
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi.spyOn(client, 'post').mockRejectedValue(new AxiosError('Lost approval'));
  await confirmApproval();
  await screen.findByText('requisitions.edit.reconciling');
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
  const get = vi.mocked(fetchRequisition).mockResolvedValue({ ...base, modifiedDate: 'newer' });
  const calls = get.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  await screen.findByRole('alertdialog');
  expect(get.mock.calls.length - calls).toBe(1);
  expect(post).toHaveBeenCalledOnce();
  queryClient.clear();
});

it('uses the GET modified date to retry an uncertain Approve without another save', async () => {
  const { base, queryClient } = await openApprover();
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...base,
    modifiedDate: 'after-save',
    eTag: '"fresh"',
  });
  const post = vi
    .spyOn(client, 'post')
    .mockRejectedValueOnce(new AxiosError('Lost approval'))
    .mockResolvedValue({ data: {} });
  await confirmApproval();
  await screen.findByText('requisitions.edit.reconciling');
  fireEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.approve' }));
  await screen.findByText('Approval List');
  expect(put).toHaveBeenCalledOnce();
  expect(post).toHaveBeenCalledTimes(2);
  queryClient.clear();
});

it('saves a resolved field conflict with the fresh server version', async () => {
  const user = userEvent.setup();
  const { base, queryClient } = await openEditor();
  fireEvent.change(screen.getByRole('textbox', { name: 'beginningBalance: Product (P1)' }), {
    target: { value: '12' },
  });
  const put = vi
    .spyOn(client, 'put')
    .mockRejectedValueOnce(httpError(409))
    .mockResolvedValue({ data: base, headers: {} });
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...base,
    modifiedDate: 'fresh',
    eTag: '"fresh"',
    requisitionLineItems: base.requisitionLineItems.map((item) => ({
      ...item,
      beginningBalance: 20,
    })),
  });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('radio', { name: 'requisitions.merge.yours: 12' }));
  await user.click(within(dialog).getByRole('button', { name: 'requisitions.merge.recover' }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
  expect(put.mock.calls[1][1]).toMatchObject({
    modifiedDate: 'fresh',
    requisitionLineItems: expect.arrayContaining([
      expect.objectContaining({ beginningBalance: 12 }),
    ]),
  });
  expect(put.mock.calls[1][2]).toMatchObject({ headers: { 'If-Match': '"fresh"' } });
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  queryClient.clear();
});

it('accepts a lost approval response when recovery already sees the next level', async () => {
  const { base, queryClient } = await openApprover();
  vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: {} });
  const post = vi.spyOn(client, 'post').mockImplementation(async () => {
    vi.mocked(fetchRequisition).mockResolvedValue({
      ...base,
      status: 'IN_APPROVAL',
      supervisoryNode: 'next',
      modifiedDate: 'accepted',
    });
    throw new AxiosError('Lost approval');
  });
  await confirmApproval();
  await screen.findByText('Approval List');
  expect(post).toHaveBeenCalledOnce();
  queryClient.clear();
});

it('submits an unchanged saved draft while its version refresh is still pending', async () => {
  const { base, queryClient } = await openEditor(false, true);
  const pending = Promise.withResolvers<RequisitionRecord>();
  vi.mocked(fetchRequisition).mockReturnValueOnce(pending.promise);
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: base, headers: { etag: '"old"' } });
  const post = vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(screen.getByRole('button', { name: 'requisitions.edit.actions.sync' }));
  await waitFor(() => expect(put).toHaveBeenCalledOnce());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.edit.actions.submit' })).toBeEnabled(),
  );
  await confirmAction();
  await screen.findByText('Opening List');
  expect(post.mock.calls[0][2]).toEqual({
    timeout: 0,
    headers: { 'Idempotency-Key': expect.any(String) },
  });
  expect(put).toHaveBeenCalledOnce();
  await act(() => pending.resolve({ ...base, eTag: '"fresh"' }));
  expect(await getLocalDb().table('requisitionDrafts').get('r')).toBeUndefined();
  queryClient.clear();
});
