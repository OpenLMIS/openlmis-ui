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
import { AxiosError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  approveBatchRequisitions,
  fetchBatchRequisitions,
  saveBatchRequisitions,
} from '@/features/requisitions/api/api';
import * as batchMarkers from '@/features/requisitions/lib/batch-session-markers';
import fp from '@/features/requisitions/lib/fixtures/batch/retrieveall-fp.json';
import { getLocalDb } from '@/integrations/local-db';
import { Route } from '@/routes/(protected)/_protected.requisitions.approve_.batch';
import { generateBatch } from '@/test-utils/batch-fixtures';

const security = vi.hoisted(() => ({ secure: true }));
vi.mock('@/lib/secure-context', () => ({
  get isSecureOrigin() {
    return security.secure;
  },
}));
vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/requisitions/api/api', () => ({
  fetchBatchRequisitions: vi.fn(),
  saveBatchRequisitions: vi.fn(),
  approveBatchRequisitions: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchCurrencySettings: vi.fn(async () => ({
    currencySymbol: '$',
    currencySymbolSide: 'left',
    currencyDecimalPlaces: 2,
    groupingSize: 3,
    groupingSeparator: ',',
    decimalSeparator: '.',
  })),
}));
const records = fp.requisitionDtos.slice(0, 2);
function renderRoute(ids = records.map((r) => r.id).join(',')) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/approve/batch',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    pendingComponent: Route.options.pendingComponent as never,
  } as never);
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/approve',
    component: () => <div>Approval List</div>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page, list] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [`/requisitions/approve/batch?ids=${ids}`] }),
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
  security.secure = true;
  sessionStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
    height: 49,
  } as DOMRect);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.tagName === 'TR' ? 49 : 512;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getBoundingClientRect().width;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(512);
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => {});
  useLoginData.getState().setLoginData({
    referenceDataUserId: crypto.randomUUID(),
    username: 'u',
    accessToken: 'token',
  });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_APPROVE|f|p']);
  vi.mocked(fetchBatchRequisitions).mockResolvedValue({
    requisitionDtos: records,
    requisitionErrors: [],
  });
  vi.mocked(saveBatchRequisitions).mockResolvedValue({
    requisitionDtos: records,
    requisitionErrors: [],
  });
  vi.mocked(approveBatchRequisitions).mockResolvedValue({
    requisitionDtos: records,
    requisitionErrors: [],
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('checks approve rights before loading any batch', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
  const loader = Route.options.loader as (arg: unknown) => Promise<unknown>;
  await expect(
    loader({ context: { queryClient: new QueryClient() }, deps: { ids: [records[0].id] } }),
  ).rejects.toBeInstanceOf(ForbiddenError);
  expect(fetchBatchRequisitions).not.toHaveBeenCalled();
});
it('validates, confirms, saves then approves and returns to the approval list', async () => {
  renderRoute();
  const input = (await screen.findAllByRole('textbox'))[0];
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.clear(input);
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.approve' }));
  await screen.findByRole('heading', { name: 'requisitions.batch.invalid-title' });
  expect(saveBatchRequisitions).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(input).toHaveFocus());
  await userEvent.type(input, '12');
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.approve' }));
  await screen.findByText('requisitions.batch.approve-confirm');
  expect(saveBatchRequisitions).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.confirm' }));
  await screen.findByText('Approval List');
  expect(saveBatchRequisitions).toHaveBeenCalledOnce();
  expect(fetchBatchRequisitions).toHaveBeenCalledOnce();
  expect(approveBatchRequisitions).toHaveBeenCalledWith(records.map((r) => r.id));
});
it('keeps only partial failures and shows the server reason', async () => {
  vi.mocked(approveBatchRequisitions).mockResolvedValue({
    requisitionDtos: [records[0]],
    requisitionErrors: [
      {
        requisitionId: records[1].id,
        errorMessage: { message: 'Not authorized at this facility' },
      },
    ],
  });
  const { router } = renderRoute();
  await screen.findAllByRole('textbox');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.batch.approve' })).toBeEnabled(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.approve' }));
  await userEvent.click(await screen.findByRole('button', { name: 'requisitions.batch.confirm' }));
  await screen.findAllByText(/Not authorized at this facility/);
  await waitFor(() => expect(router.state.location.search).toMatchObject({ ids: records[1].id }));
});
it('refetches a lost approval response and blocks a resend after reload', async () => {
  vi.mocked(approveBatchRequisitions).mockRejectedValue(
    new AxiosError('Lost response', '500', undefined, undefined, {
      status: 500,
      data: {},
    } as never),
  );
  const first = renderRoute();
  await screen.findAllByRole('textbox');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.batch.approve' })).toBeEnabled(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.approve' }));
  await userEvent.click(await screen.findByRole('button', { name: 'requisitions.batch.confirm' }));
  await screen.findAllByText('requisitions.batch.uncertain');
  await waitFor(() =>
    expect(vi.mocked(fetchBatchRequisitions).mock.calls.length).toBeGreaterThan(1),
  );
  await waitFor(() => expect(approveBatchRequisitions).toHaveBeenCalledOnce());
  cleanup();
  first.queryClient.clear();
  renderRoute();
  await screen.findAllByText('requisitions.batch.uncertain');
  expect(screen.getByRole('button', { name: 'requisitions.batch.approve' })).toBeDisabled();
  await waitFor(() => expect(approveBatchRequisitions).toHaveBeenCalledOnce());
});

it('orders columns by ids and names refused and missing records above the grid', async () => {
  vi.mocked(fetchBatchRequisitions).mockResolvedValue({
    requisitionDtos: [...records].reverse(),
    requisitionErrors: [
      { requisitionId: 'refused', errorMessage: { message: 'Permission refused' } },
    ],
  });
  renderRoute(`${records[0].id},${records[1].id},refused,missing`);
  await screen.findByText('Permission refused');
  await screen.findByText('missing');
  const headers = await screen.findAllByRole('columnheader');
  const groupLabels = headers.filter((h) => h.textContent?.includes('requisitions.batch.group'));
  expect(groupLabels).toHaveLength(2);
  const inputs = screen.getAllByRole('textbox');
  expect(inputs[0]).toHaveAccessibleName(/Feb2017/);
  expect(inputs[1]).toHaveAccessibleName(/Jan2017/);
});
it('never approves a failed save and keeps its reason alongside approval failures', async () => {
  vi.mocked(saveBatchRequisitions).mockResolvedValue({
    requisitionDtos: [records[0]],
    requisitionErrors: [
      { requisitionId: records[1].id, errorMessage: { message: 'Modified elsewhere' } },
    ],
  });
  vi.mocked(approveBatchRequisitions).mockResolvedValue({
    requisitionDtos: [],
    requisitionErrors: [
      { requisitionId: records[0].id, errorMessage: { message: 'No facility permission' } },
    ],
  });
  const { router } = renderRoute();
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  await userEvent.click(approve);
  await userEvent.click(await screen.findByRole('button', { name: 'requisitions.batch.confirm' }));
  await screen.findAllByText(/Modified elsewhere/);
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ ids: records.map((r) => r.id).join(',') }),
  );
  expect(screen.getByRole('alertdialog').textContent).toMatch(
    /No facility permission[\s\S]*Modified elsewhere/,
  );
  await screen.findAllByText(/No facility permission/);
  expect(approveBatchRequisitions).toHaveBeenCalledWith([records[0].id]);
});
it('Revert clears the durable copy so reload keeps server values', async () => {
  const first = renderRoute();
  const input = (await screen.findAllByRole('textbox'))[0];
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.clear(input);
  await userEvent.type(input, '123');
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.revert' }));
  await screen.findByText('requisitions.batch.revert-confirm');
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.confirm' }));
  await waitFor(() => expect(input).toHaveValue('0'));
  cleanup();
  first.queryClient.clear();
  renderRoute();
  const reloaded = (await screen.findAllByRole('textbox'))[0];
  await waitFor(() => expect(reloaded).toBeEnabled());
  expect(reloaded).toHaveValue('0');
  expect(saveBatchRequisitions).not.toHaveBeenCalled();
});

it('renders phone cards and updates costs and totals while typing', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 390,
  } as DOMRect);
  renderRoute();
  const input = (await screen.findAllByRole('textbox'))[0];
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.clear(input);
  await userEvent.type(input, '10');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getAllByText('$51.00').length).toBeGreaterThan(1);
});
it('keeps every record after an exception-style approval 400 and shows the reason', async () => {
  vi.mocked(approveBatchRequisitions).mockRejectedValue(
    new AxiosError('400', '400', undefined, undefined, {
      status: 400,
      data: { message: 'The period has not ended' },
    } as never),
  );
  renderRoute();
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  await userEvent.click(approve);
  await userEvent.click(await screen.findByRole('button', { name: 'requisitions.batch.confirm' }));
  await screen.findAllByText(/The period has not ended/);
  expect(screen.queryByText('Approval List')).not.toBeInTheDocument();
  expect(approveBatchRequisitions).toHaveBeenCalledOnce();
});
it('Sync sends an empty cell as zero and holds back a record above the Java limit', async () => {
  renderRoute();
  const inputs = await screen.findAllByRole('textbox');
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  await userEvent.clear(inputs[0]);
  await userEvent.type(inputs[0], '2147483648');
  await userEvent.clear(inputs[1]);
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  await waitFor(() => expect(saveBatchRequisitions).toHaveBeenCalledOnce());
  expect(vi.mocked(saveBatchRequisitions).mock.calls[0][0]).toEqual([
    {
      id: records[1].id,
      modifiedDate: records[1].modifiedDate,
      requisitionLineItems: records[1].requisitionLineItems.map((l) => ({
        id: l.id,
        approvedQuantity: 0,
      })),
    },
  ]);
  expect(approveBatchRequisitions).not.toHaveBeenCalled();
});

it.each([true, false])('stores approval markers before the POST on secure=%s', async (secure) => {
  security.secure = secure;
  const saved = records.map((record) => ({
    ...record,
    modifiedDate: '2026-11-02T12:00:00Z',
    status: 'IN_APPROVAL',
  }));
  vi.mocked(saveBatchRequisitions).mockResolvedValue({ requisitionDtos: saved });
  vi.mocked(approveBatchRequisitions).mockImplementation(async (ids) => {
    for (const id of ids) {
      if (secure) {
        expect(await getLocalDb().table('requisitionBatchDrafts').get(id)).toMatchObject({
          unresolvedApproval: { attemptedAt: expect.any(String) },
          baselineModifiedDate: saved[0].modifiedDate,
          baselineStatus: saved[0].status,
        });
      } else {
        const markers = Object.keys(sessionStorage).map((key) =>
          JSON.parse(sessionStorage.getItem(key) ?? 'null'),
        );
        expect(markers).toContainEqual(
          expect.objectContaining({
            userId: useLoginData.getState().referenceDataUserId,
            requisitionId: id,
            attemptedAt: expect.any(String),
            baselineModifiedDate: saved[0].modifiedDate,
            baselineStatus: saved[0].status,
          }),
        );
      }
    }
    return { requisitionDtos: records, requisitionErrors: [] };
  });
  renderRoute();
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  await userEvent.click(approve);
  await userEvent.click(await screen.findByRole('button', { name: 'requisitions.batch.confirm' }));
  await screen.findByText('Approval List');
  expect(approveBatchRequisitions).toHaveBeenCalledOnce();
});
it('keeps the failed record typed quantity when other records synchronize', async () => {
  vi.mocked(saveBatchRequisitions).mockResolvedValue({
    requisitionDtos: [records[0]],
    requisitionErrors: [
      { requisitionId: records[1].id, errorMessage: { message: 'Save refused' } },
    ],
  });
  renderRoute();
  const inputs = await screen.findAllByRole('textbox');
  await waitFor(() => expect(inputs[1]).toBeEnabled());
  await userEvent.clear(inputs[1]);
  await userEvent.type(inputs[1], '123');
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  await screen.findAllByText(/Save refused/);
  expect(await getLocalDb().table('requisitionBatchDrafts').get(records[1].id)).toMatchObject({
    approvedQuantities: { [records[1].requisitionLineItems[0].id]: '123' },
  });
});
it('refreshes after a failed Sync and names only affected records for review', async () => {
  vi.mocked(saveBatchRequisitions).mockRejectedValueOnce(new Error('Lost save'));
  vi.mocked(fetchBatchRequisitions)
    .mockResolvedValueOnce({ requisitionDtos: records })
    .mockResolvedValue({
      requisitionDtos: [
        { ...records[0], modifiedDate: 'changed', facilityName: 'Refreshed facility' },
        records[1],
      ],
    });
  renderRoute();
  const inputs = await screen.findAllByRole('textbox');
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  await userEvent.type(inputs[1], '2147483648');
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  await screen.findByText('Lost save');
  expect(screen.getAllByRole('textbox', { hidden: true })[0]).toHaveAccessibleName(
    /Refreshed facility/,
  );
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  await screen.findAllByText(/requisitions.batch.review-refreshed/);
  const description = screen.getByRole('alertdialog').textContent ?? '';
  expect(description).toContain(records[0].periodName);
  expect(description).not.toContain(records[1].periodName);
});
it('keeps a refusal reason after the Sync refetch', async () => {
  vi.mocked(fetchBatchRequisitions)
    .mockResolvedValueOnce({ requisitionDtos: records })
    .mockResolvedValue({
      requisitionDtos: [records[0]],
      requisitionErrors: [
        { requisitionId: records[1].id, errorMessage: { message: 'Access revoked' } },
      ],
    });
  renderRoute();
  const sync = await screen.findByRole('button', { name: 'requisitions.batch.sync' });
  await waitFor(() => expect(sync).toBeEnabled());
  await userEvent.click(sync);
  await screen.findByText('Access revoked');
  expect(screen.queryByText('requisitions.batch.missing')).not.toBeInTheDocument();
});
it('unlocks Approve only after confirming Approve Anyway for an opening marker', async () => {
  await getLocalDb()
    .table('requisitionBatchDrafts')
    .put({
      draftId: records[0].id,
      userId: useLoginData.getState().referenceDataUserId,
      formatVersion: 1,
      revision: 1,
      baselineModifiedDate: records[0].modifiedDate,
      baselineStatus: records[0].status,
      approvedQuantities: {},
      unresolvedApproval: { attemptedAt: 'now' },
    });
  renderRoute();
  await screen.findByText('requisitions.batch.uncertain');
  const approve = screen.getByRole('button', { name: 'requisitions.batch.approve' });
  expect(approve).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.anyway' }));
  await screen.findByText('requisitions.batch.anyway-confirm');
  expect(approve).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.confirm' }));
  await waitFor(() => expect(approve).toBeEnabled());
  expect(approveBatchRequisitions).not.toHaveBeenCalled();
});

it('shows missing product placeholders, invalid markers and save failure reasons on phone cards', async () => {
  vi.mocked(fetchBatchRequisitions).mockResolvedValue({
    requisitionDtos: [
      records[0],
      { ...records[1], requisitionLineItems: records[1].requisitionLineItems.slice(0, -1) },
    ],
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 390,
  } as DOMRect);
  vi.mocked(saveBatchRequisitions).mockResolvedValue({
    requisitionDtos: [records[0]],
    requisitionErrors: [
      { requisitionId: records[1].id, errorMessage: { message: 'Card save refused' } },
    ],
  });
  renderRoute();
  const inputs = await screen.findAllByRole('textbox');
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  await userEvent.clear(inputs[1]);
  expect(screen.getAllByText('requisitions.batch.invalid-requisition').length).toBeGreaterThan(0);
  await userEvent.type(inputs[1], '12');
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  await screen.findAllByText(/Card save refused/);
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  expect(screen.getAllByText('Card save refused').length).toBeGreaterThan(0);
});

it('does not show removed approved ids as missing while URL replacement is loading', async () => {
  let release: (() => void) | undefined;
  const navigating = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(fetchBatchRequisitions)
    .mockResolvedValueOnce({ requisitionDtos: records })
    .mockImplementation(async () => {
      await navigating;
      return { requisitionDtos: [records[1]] };
    });
  vi.mocked(approveBatchRequisitions).mockResolvedValue({
    requisitionDtos: [records[0]],
    requisitionErrors: [
      { requisitionId: records[1].id, errorMessage: { message: 'Still needs approval' } },
    ],
  });
  renderRoute();
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  await userEvent.click(approve);
  await userEvent.click(await screen.findByRole('button', { name: 'requisitions.batch.confirm' }));
  await waitFor(() => expect(fetchBatchRequisitions).toHaveBeenCalledTimes(2));
  const missing = screen.queryByText('requisitions.batch.missing');
  release?.();
  expect(missing).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.batch.approve' })).toBeEnabled(),
  );
});

it('does not classify a confirmed POST as uncertain when local marker removal fails', async () => {
  security.secure = false;
  vi.mocked(approveBatchRequisitions).mockImplementation(async () => {
    vi.spyOn(batchMarkers, 'writeBatchSessionMarker').mockImplementation(() => {
      throw new Error('Marker removal failed');
    });
    return { requisitionDtos: records };
  });
  renderRoute();
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  await userEvent.click(approve);
  await userEvent.click(await screen.findByRole('button', { name: 'requisitions.batch.confirm' }));
  await screen.findByText('Marker removal failed');
  expect(screen.getByRole('alertdialog').textContent).not.toContain('requisitions.batch.uncertain');
  expect(fetchBatchRequisitions).toHaveBeenCalledOnce();
});

it.each(['ltr', 'rtl'])(
  'virtualizes rows and tabs to an unmounted row in %s',
  async (direction) => {
    document.documentElement.dir = direction;
    const large = generateBatch(2, 200);
    vi.mocked(fetchBatchRequisitions).mockResolvedValue({ requisitionDtos: large });
    renderRoute(large.map((r) => r.id).join(','));
    const inputs = await screen.findAllByRole('textbox');
    await waitFor(() => expect(inputs[0]).toBeEnabled());
    expect(inputs.length).toBeLessThan(100);
    const table = screen.getByRole('table', { name: 'requisitions.batch.title' });
    expect(table).toHaveAttribute('aria-rowcount', '203');
    expect(screen.getByRole('rowheader', { name: 'P0000' })).toBeInTheDocument();
    const last = screen.getAllByRole('textbox').at(-1) as HTMLInputElement;
    const nextRow = Number(last.id.split('-').at(-1)) + 1;
    act(() => last.focus());
    await userEvent.tab();
    expect(document.activeElement).toHaveAttribute('id', `batch-requisition-0-line-0-${nextRow}`);
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
    document.documentElement.dir = 'ltr';
  },
);
it('reveals and focuses an off-screen invalid quantity after closing the invalid dialog', async () => {
  const large = generateBatch(1, 200);
  vi.mocked(fetchBatchRequisitions).mockResolvedValue({ requisitionDtos: large });
  await getLocalDb()
    .table('requisitionBatchDrafts')
    .put({
      draftId: large[0].id,
      userId: useLoginData.getState().referenceDataUserId,
      formatVersion: 1,
      revision: 1,
      baselineModifiedDate: large[0].modifiedDate,
      baselineStatus: large[0].status,
      approvedQuantities: { 'line-0-199': '' },
    });
  renderRoute(large[0].id);
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  expect(document.getElementById('batch-requisition-0-line-0-199')).toBeNull();
  await userEvent.click(approve);
  await screen.findByRole('heading', { name: 'requisitions.batch.invalid-title' });
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() =>
    expect(document.activeElement).toHaveAttribute('id', 'batch-requisition-0-line-0-199'),
  );
  expect(saveBatchRequisitions).not.toHaveBeenCalled();
});
