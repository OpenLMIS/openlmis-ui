import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchOrderablesByIdentities } from '@/features/reference-data/api/api';
import { fetchRequisition } from '@/features/requisitions/api/api';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import { Route } from '@/routes/(protected)/_protected.requisitions.view_.$requisitionId';
import { expectRouteWarning } from '@/tests/expect-route-warning';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchDeploymentTimeZone: vi.fn(async () => 'UTC'),
  storedTimeZone: vi.fn(() => null),
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
  fetchUserPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchMinimalFacilities: vi.fn(async () => [{ id: 'f', name: 'Comfort', code: 'HC01' }]),
}));
vi.mock('@/features/requisitions/api/api', () => ({
  fetchRequisition: vi.fn(),
  fetchStatusMessages: vi.fn(async () => []),
}));

vi.mock('@/features/requisitions/components/requisition-skeletons', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/requisitions/components/requisition-skeletons')
  >()),
  RequisitionGridPending: ({ hideSkipped }: { hideSkipped?: boolean }) => (
    <div role="status" aria-label={hideSkipped ? 'pending-skipped-filter' : 'pending-products'} />
  ),
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
    path: 'requisitions/view/$requisitionId',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    errorComponent: Route.options.errorComponent as never,
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

afterEach(() => {
  cleanup();
  useLoginData.setState({ referenceDataUserId: null });
  vi.restoreAllMocks();
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
it('recognizes a string supervisory node as the current approval node', async () => {
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|program']);
  vi.mocked(fetchRequisition).mockResolvedValue({
    ...patientRecord(),
    template: { ...patientRecord().template, patientsTabEnabled: false },
    status: 'IN_APPROVAL',
    supervisoryNode: 'node',
  });
  const { queryClient } = renderRoute('/requisitions/view/r');
  await screen.findByRole('tab', { name: 'requisitions.requisition.full-supply', selected: true });
  expect(screen.getByText('requisitions.requisition.legacy-description')).toBeInTheDocument();
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
  await screen.findByRole('heading', { name: 'requisitions.requisition.comments' });
  expect(screen.getByRole('status', { name: 'pending-products' })).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'pending-skipped-filter' })).not.toBeInTheDocument();
  queryClient.clear();
});
