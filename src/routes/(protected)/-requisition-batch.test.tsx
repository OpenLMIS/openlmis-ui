import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type HistoryState,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  approveBatchRequisitions,
  fetchApprovalList,
  fetchBatchRequisitions,
  saveBatchRequisitions,
} from '@/features/requisitions/api/api';
import * as batchMarkers from '@/features/requisitions/lib/batch-session-markers';
import fp from '@/features/requisitions/lib/fixtures/batch/retrieveall-fp.json';
import * as savedBatches from '@/features/requisitions/lib/offline-batch';
import { getLocalDb } from '@/integrations/local-db';
import { IsolatingICU } from '@/lib/isolate-values';
import { Route } from '@/routes/(protected)/_protected.requisitions.approve_.batch';
import { generateBatch } from '@/test-utils/batch-fixtures';
import en from '../../../public/locales/en.json';

const labels = createInstance();
await labels.use(IsolatingICU).init({
  lng: 'en',
  keySeparator: false,
  nsSeparator: false,
  resources: {
    en: {
      translation: {
        'requisitions.batch.errors': en['requisitions.batch.errors'],
        'requisitions.batch.quantity-label': en['requisitions.batch.quantity-label'],
        'requisitions.batch.failure-line': en['requisitions.batch.failure-line'],
      },
    },
  },
});

const security = vi.hoisted(() => ({ secure: true }));
vi.mock('@/lib/secure-context', () => ({
  get isSecureOrigin() {
    return security.secure;
  },
}));
vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/requisitions/api/api', () => ({
  fetchBatchRequisitions: vi.fn(),
  fetchApprovalList: vi.fn(),
  saveBatchRequisitions: vi.fn(),
  approveBatchRequisitions: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  storedTimeZone: vi.fn(() => 'UTC'),
  fetchCurrencySettings: vi.fn(async () => ({
    currencySymbol: '$',
    currencySymbolSide: 'left',
    currencyDecimalPlaces: 2,
    groupingSize: 3,
    groupingSeparator: ',',
    decimalSeparator: '.',
  })),
}));
let records = fp.requisitionDtos.slice(0, 2);
function renderRoute(ids = records.map((r) => r.id).join(','), state?: HistoryState) {
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
    gcTime: Route.options.gcTime,
    staleTime: Route.options.staleTime,
  } as never);
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/approve',
    component: () => <div>Approval List</div>,
  });
  const view = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/view',
    component: () => <div>View List</div>,
  });
  const path = `/requisitions/approve/batch?ids=${ids}`;
  const history = createMemoryHistory({ initialEntries: [path] });
  if (state) history.replace(path, state);
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page, list, view] as never)] as never),
    ] as never),
    context: { queryClient },
    history,
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={labels}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
beforeEach(() => {
  records = structuredClone(fp.requisitionDtos.slice(0, 2));
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
  vi.mocked(fetchApprovalList).mockImplementation(async () => {
    const response = await vi.mocked(fetchBatchRequisitions).mock.results.at(-1)?.value;
    return {
      content: (response?.requisitionDtos ?? records).map((record: { id: string }) => ({
        id: record.id,
      })),
      totalPages: 1,
    } as never;
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
  onlineManager.setOnline(true);
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
  const warning = vi.spyOn(toast, 'warning');
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
  warning.mockClear();
  await userEvent.click(screen.getAllByRole('button', { name: 'requisitions.batch.check' })[0]);
  await waitFor(() =>
    expect(warning).toHaveBeenCalledWith('requisitions.batch.status-uncertain', {
      description: 'requisitions.batch.uncertain',
    }),
  );
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
  await screen.findByText('requisitions.requisition missing');
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
  await waitFor(() =>
    expect(screen.getByRole('alertdialog').textContent).toMatch(
      /No facility permission[\s\S]*Modified elsewhere/,
    ),
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
it('keeps a refusal reason from the Sync response', async () => {
  vi.mocked(saveBatchRequisitions).mockResolvedValue({
    requisitionDtos: [records[0]],
    requisitionErrors: [
      { requisitionId: records[1].id, errorMessage: { message: 'Access revoked' } },
    ],
  });
  renderRoute();
  const sync = await screen.findByRole('button', { name: 'requisitions.batch.sync' });
  await waitFor(() => expect(sync).toBeEnabled());
  await userEvent.click(sync);
  await screen.findAllByText('Access revoked');
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

it('keeps Approve Anyway disabled offline for an opening marker', async () => {
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
  act(() => onlineManager.setOnline(false));
  expect(screen.getByRole('button', { name: 'requisitions.batch.anyway' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.anyway' }));
  expect(screen.queryByText('requisitions.batch.anyway-confirm')).not.toBeInTheDocument();
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
  await screen.findByRole('button', { name: 'dialog.close' });
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

it('does not reconcile an uncertain attempt against a timeout fallback snapshot', async () => {
  const id = records[0].id;
  const userId = useLoginData.getState().referenceDataUserId;
  await getLocalDb()
    .table('requisitionBatchDrafts')
    .put({
      draftId: id,
      userId,
      formatVersion: 1,
      revision: 1,
      baselineModifiedDate: 'newer-than-the-saved-copy',
      baselineStatus: records[0].status,
      approvedQuantities: {},
      unresolvedApproval: { attemptedAt: 'now' },
    });
  vi.mocked(fetchBatchRequisitions).mockRejectedValue(
    new AxiosError('Timeout', AxiosError.ECONNABORTED),
  );
  vi.spyOn(savedBatches, 'readBatch').mockResolvedValue({
    response: { requisitionDtos: [records[0]], requisitionErrors: [] },
    fetchedAt: 1,
    currency: {
      currencyCode: 'USD',
      currencySymbol: '$',
      currencySymbolSide: 'left',
      currencyDecimalPlaces: 2,
      groupingSize: 3,
      groupingSeparator: ',',
      decimalSeparator: '.',
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const loader = Route.options.loader as (args: unknown) => Promise<unknown>;
  await loader({ context: { queryClient }, deps: { ids: [id] }, location: { state: {} } });
  expect(
    (await getLocalDb().table('requisitionBatchDrafts').get(id)).unresolvedApproval,
  ).toBeDefined();
  queryClient.clear();
});

it('returns from a saved batch to the originating View list with its search intact', async () => {
  const search = { facility: 'f', program: 'p', offline: true, page: 3, dir: 'asc' as const };
  const { router } = renderRoute(records[0].id, {
    requisitionReturn: { to: '/requisitions/view', search },
  });
  await screen.findAllByRole('textbox');
  await userEvent.click(screen.getByRole('button', { name: 'dialog.cancel' }));
  await screen.findByText('View List');
  expect(router.state.location.search).toEqual(search);
});

async function publishBatchAccess() {
  const { LOCAL_TABLES } = await import('@/integrations/local-db');
  const userId = useLoginData.getState().referenceDataUserId;
  await getLocalDb()
    .table(LOCAL_TABLES.offlineAccess)
    .put({
      userId,
      generation: 'g',
      formatVersion: 1,
      fetchedAt: Date.now(),
      permissionStrings: ['REQUISITION_APPROVE|f|p'],
      programs: [],
      homeFacility: null,
      user: {
        id: userId,
        roleAssignments: [{ roleId: 'approver', programId: 'p', supervisoryNodeId: 'node' }],
      },
    });
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionAccess)
    .put({
      userId,
      generation: 'g',
      formatVersion: 1,
      fetchedAt: Date.now(),
      roles: [{ id: 'approver', rights: [{ name: 'REQUISITION_APPROVE' }] }],
      nodes: [],
      groups: [],
      facilities: [],
      programs: [],
    });
  vi.mocked(fetchApprovalList).mockResolvedValue({
    content: records.map((record) => ({
      id: record.id,
      status: 'AUTHORIZED',
      emergency: false,
      facility: { id: 'f' },
      program: { id: 'p' },
      processingPeriod: { id: 'period' },
    })),
    totalPages: 1,
  } as never);
}

it.each([false, true])(
  'persists only confirmed approval statuses and reopens read-only with partial failures=%s',
  async (partial) => {
    const { readCopy } = await import('@/features/requisitions/lib/offline-copies');
    await publishBatchAccess();
    const id = records[0].id;
    vi.mocked(fetchBatchRequisitions).mockResolvedValue({
      requisitionDtos: partial ? records : [records[0]],
      requisitionErrors: [],
    });
    vi.mocked(saveBatchRequisitions).mockResolvedValue({
      requisitionDtos: partial ? records : [records[0]],
      requisitionErrors: [],
    });
    vi.mocked(approveBatchRequisitions).mockImplementation(async () => {
      vi.mocked(fetchApprovalList).mockResolvedValue({ content: [], totalPages: 0 } as never);
      return {
        requisitionDtos: [
          { ...records[0], status: 'APPROVED', modifiedDate: '2026-11-03T00:00:00Z' },
        ],
        requisitionErrors: partial
          ? [{ requisitionId: records[1].id, errorMessage: { message: 'Still needs approval' } }]
          : [],
      };
    });
    renderRoute(partial ? records.map((record) => record.id).join(',') : id, {
      requisitionBatchRecords: [
        {
          id,
          status: 'AUTHORIZED',
          emergency: false,
          facility: { id: 'stale-facility' },
          program: { id: 'stale-program' },
          processingPeriod: { id: 'stale-period' },
        },
      ],
    });
    await screen.findAllByRole('textbox');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'requisitions.batch.approve' })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.approve' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'requisitions.batch.confirm' }),
    );
    if (partial) {
      await screen.findAllByText('Still needs approval');
      expect((await readCopy(records[1].id))?.batch?.confirmedApproval).toBeUndefined();
      expect((await readCopy(records[1].id))?.summary.status).toBe('AUTHORIZED');
    } else await screen.findByText('Approval List');
    expect(approveBatchRequisitions).toHaveBeenCalledWith(
      partial ? records.map((record) => record.id) : [id],
    );
    expect((await readCopy(id))?.batch?.confirmedApproval?.status).toBe('APPROVED');
    expect((await readCopy(id))?.summary.status).toBe('APPROVED');
    const { localApprovals } = await import('@/features/requisitions/lib/offline-search');
    expect((await localApprovals({ program: 'p' })).content.map((r) => r.id)).not.toContain(id);
    const reopened = await savedBatches.readBatch([id]);
    expect(reopened.response.requisitionDtos[0].status).toBe('APPROVED');
    cleanup();
    vi.mocked(fetchBatchRequisitions).mockRejectedValue(
      new AxiosError('Timeout', AxiosError.ECONNABORTED),
    );
    renderRoute(id);
    const quantity = (await screen.findAllByRole('textbox'))[0];
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'requisitions.batch.approve' })).toBeDisabled(),
    );
    expect(quantity).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'dialog.cancel' }));
    await screen.findByText('Approval List');
  },
);

it.each(['missing', 'timeout', 'refused'] as const)(
  'does not save approval proof for a %s response and preserves unknown attempts when needed',
  async (outcome) => {
    const { readCopy } = await import('@/features/requisitions/lib/offline-copies');
    await publishBatchAccess();
    const id = records[0].id;
    vi.mocked(fetchBatchRequisitions).mockResolvedValue({ requisitionDtos: [records[0]] });
    vi.mocked(saveBatchRequisitions).mockResolvedValue({ requisitionDtos: [records[0]] });
    if (outcome === 'timeout')
      vi.mocked(approveBatchRequisitions).mockRejectedValue(
        new AxiosError('Timeout', AxiosError.ECONNABORTED),
      );
    else
      vi.mocked(approveBatchRequisitions).mockResolvedValue({
        requisitionDtos: [],
        requisitionErrors:
          outcome === 'refused'
            ? [{ requisitionId: id, errorMessage: { message: 'Approval refused' } }]
            : [],
      });
    renderRoute(id);
    const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
    await waitFor(() => expect(approve).toBeEnabled());
    await userEvent.click(approve);
    await userEvent.click(
      await screen.findByRole('button', { name: 'requisitions.batch.confirm' }),
    );
    const reason =
      outcome === 'refused'
        ? 'Approval refused'
        : outcome === 'timeout'
          ? 'requisitions.batch.uncertain'
          : 'requisitions.batch.missing';
    await waitFor(() => expect(screen.getByRole('alertdialog').textContent).toContain(reason));
    const copy = await readCopy(id);
    expect(copy?.summary.status).toBe('AUTHORIZED');
    expect(copy?.batch?.confirmedApproval).toBeUndefined();
    const draft = await getLocalDb().table('requisitionBatchDrafts').get(id);
    if (outcome === 'refused') expect(draft?.unresolvedApproval).toBeUndefined();
    else expect(draft?.unresolvedApproval).toEqual({ attemptedAt: expect.any(String) });
  },
);

it.each(['ltr', 'rtl'])(
  'labels and tabs past a requisition no longer awaiting approval in %s',
  async (direction) => {
    document.documentElement.dir = direction;
    const batch = generateBatch(3, 2);
    batch[1].status = 'APPROVED';
    vi.mocked(fetchBatchRequisitions).mockResolvedValue({ requisitionDtos: batch });
    renderRoute(batch.map((r) => r.id).join(','));
    const inputs = await screen.findAllByRole('textbox');
    await waitFor(() => expect(inputs[0]).toBeEnabled());
    expect(screen.getByText('requisitions.batch.no-longer-awaiting')).toBeInTheDocument();
    act(() => inputs[0].focus());
    await userEvent.tab();
    expect(inputs[2]).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(inputs[0]).toHaveFocus();
    document.documentElement.dir = 'ltr';
  },
);

it('shows the saved batch response before its device copy finishes', async () => {
  const capture = vi.spyOn(savedBatches, 'captureBatch').mockResolvedValueOnce(undefined);
  renderRoute();
  const inputs = await screen.findAllByRole('textbox');
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  await userEvent.clear(inputs[0]);
  await userEvent.type(inputs[0], '77');
  const saved = records.map((record) => ({
    ...record,
    modifiedDate: 'new',
    requisitionLineItems: record.requisitionLineItems.map((line) => ({
      ...line,
      approvedQuantity: 88,
    })),
  }));
  vi.mocked(saveBatchRequisitions).mockResolvedValue({ requisitionDtos: saved });
  const copy = Promise.withResolvers<void>();
  capture.mockImplementation(() => copy.promise);
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  await waitFor(() => expect(inputs[0]).toHaveValue('88'));
  await act(async () => copy.resolve());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.batch.sync' })).toBeEnabled(),
  );
});

it('sends one approval when the confirmation is double clicked', async () => {
  security.secure = false;
  const response = Promise.withResolvers<Awaited<ReturnType<typeof approveBatchRequisitions>>>();
  vi.mocked(approveBatchRequisitions).mockReturnValue(response.promise);
  const { queryClient } = renderRoute();
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  await userEvent.click(approve);
  const confirm = await screen.findByRole('button', { name: 'requisitions.batch.confirm' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() => expect(approveBatchRequisitions).toHaveBeenCalledOnce());
  expect(saveBatchRequisitions).toHaveBeenCalledOnce();
  await act(async () => response.resolve({ requisitionDtos: records }));
  await screen.findByText('Approval List');
  expect(approveBatchRequisitions).toHaveBeenCalledOnce();
  queryClient.clear();
});

it('blocks a requisition moved to another node while still in approval', async () => {
  const batch = generateBatch(2, 1);
  batch[1].status = 'IN_APPROVAL';
  vi.mocked(fetchBatchRequisitions).mockResolvedValue({ requisitionDtos: batch });
  vi.mocked(fetchApprovalList).mockResolvedValue({
    content: [{ id: batch[0].id }],
    totalPages: 1,
  } as never);
  renderRoute(batch.map((r) => r.id).join(','));
  const inputs = await screen.findAllByRole('textbox');
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  expect(inputs[1]).toBeDisabled();
  expect(screen.getByText('requisitions.batch.no-longer-awaiting')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  expect(
    await screen.findByText(/requisitions.batch.no-longer-awaiting/, {
      selector: '.whitespace-pre-line',
    }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/requisitions.batch.possibly-approved/)).not.toBeInTheDocument();
});

it('fetches membership once in parallel with the batch and reuses it for capture', async () => {
  await publishBatchAccess();
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof fetchBatchRequisitions>>>();
  vi.mocked(fetchBatchRequisitions).mockReturnValue(pending.promise);
  const loader = Route.options.loader as (
    arg: unknown,
  ) => Promise<{ copyResult?: Promise<unknown> }>;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const loaded = loader({
    context: { queryClient: client },
    deps: { ids: records.map((r) => r.id) },
  });
  await waitFor(() => expect(fetchBatchRequisitions).toHaveBeenCalledOnce());
  expect(fetchApprovalList).toHaveBeenCalledOnce();
  pending.resolve({ requisitionDtos: records });
  await (await loaded).copyResult;
  expect(fetchApprovalList).toHaveBeenCalledOnce();
  const { readCopy } = await import('@/features/requisitions/lib/offline-copies');
  expect((await readCopy(records[0].id))?.batch?.approvalVerified).toBe(true);
  client.clear();
});
it('keeps the batch usable when approval membership returns a service error', async () => {
  vi.mocked(fetchApprovalList).mockRejectedValue(
    new AxiosError('Unavailable', undefined, undefined, undefined, {
      status: 500,
      data: {},
    } as never),
  );
  const { queryClient } = renderRoute();
  const inputs = await screen.findAllByRole('textbox');
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  expect(await screen.findByText('requisitions.offline.failed-description')).toBeInTheDocument();
  expect(fetchApprovalList).toHaveBeenCalledOnce();
  queryClient.clear();
});

it('accepts an old saved approval flag after fresh access and membership checks', async () => {
  const copies = await import('@/features/requisitions/lib/offline-copies');
  const access = await import('@/routes/-requisition-access');
  await publishBatchAccess();
  const leases = await Promise.all(records.map((record) => copies.beginCopy(record.id)));
  await savedBatches.captureBatch(leases, { requisitionDtos: records }, {} as never, 'read');
  vi.mocked(fetchBatchRequisitions).mockRejectedValueOnce(
    new AxiosError('Timeout', AxiosError.ECONNABORTED),
  );
  vi.spyOn(access, 'freshRequisitionAccess').mockResolvedValue({
    user: { roleAssignments: [{ roleId: 'approver', programId: 'p', supervisoryNodeId: 'node' }] },
    roles: [{ id: 'approver', rights: [{ name: 'REQUISITION_APPROVE' }] }],
  } as never);
  const { queryClient } = renderRoute();
  const sync = await screen.findByRole('button', { name: 'requisitions.batch.sync' });
  await waitFor(() => expect(sync).toBeEnabled());
  await userEvent.click(sync);
  await waitFor(() => expect(saveBatchRequisitions).toHaveBeenCalledOnce());
  expect(screen.queryByText('requisitions.batch.review-refreshed')).not.toBeInTheDocument();
  queryClient.clear();
});

it.each(['request', 'record'] as const)(
  'retires saved copies and draft when a failed approval reveals another approver acted (%s)',
  async (failure) => {
    await publishBatchAccess();
    const { readCopy } = await import('@/features/requisitions/lib/offline-copies');
    const id = records[0].id;
    const { queryClient } = renderRoute(id);
    const input = (await screen.findAllByRole('textbox'))[0];
    await waitFor(() => expect(input).toBeEnabled());
    await waitFor(async () => expect(await readCopy(id)).toBeDefined());
    vi.mocked(approveBatchRequisitions).mockImplementation(async () => {
      vi.mocked(fetchBatchRequisitions).mockResolvedValue({
        requisitionDtos: [{ ...records[0], status: 'APPROVED', modifiedDate: 'changed' }],
      });
      if (failure === 'record')
        return {
          requisitionErrors: [
            {
              requisitionId: id,
              errorMessage: { messageKey: 'requisition.error.approve.requisitionMustBeAuthorized' },
            },
          ],
        };
      throw new AxiosError('Already approved', '409', undefined, undefined, {
        status: 409,
        data: {},
      } as never);
    });
    await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.approve' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'requisitions.batch.confirm' }),
    );
    await waitFor(async () => expect(await readCopy(id)).toBeUndefined());
    expect(await getLocalDb().table('requisitionBatchDrafts').get(id)).toBeUndefined();
    expect(screen.queryByText('requisitions.offline.removed-title')).not.toBeInTheDocument();
    queryClient.clear();
  },
);

it('does not offer Update for a draft no longer awaiting approval', async () => {
  const hooks = await import('@/features/requisitions/hooks/use-batch-drafts');
  const useDrafts = hooks.useBatchDrafts;
  vi.spyOn(hooks, 'useBatchDrafts').mockImplementation((records) => ({
    ...useDrafts(records),
    outdated: () => true,
  }));
  const id = records[0].id;
  await getLocalDb()
    .table('requisitionBatchDrafts')
    .put({
      draftId: id,
      userId: useLoginData.getState().referenceDataUserId,
      formatVersion: 1,
      revision: 1,
      baselineModifiedDate: 'old',
      baselineStatus: 'AUTHORIZED',
      approvedQuantities: { [records[0].requisitionLineItems[0].id]: '12' },
    });
  vi.mocked(fetchApprovalList).mockResolvedValue({ content: [], totalPages: 1 } as never);
  const { queryClient } = renderRoute(id);
  await screen.findAllByRole('textbox');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.batch.revert' })).toBeEnabled(),
  );
  expect(
    screen.queryByRole('button', { name: 'requisitions.edit.update' }),
  ).not.toBeInTheDocument();
  queryClient.clear();
});

it('sends Sync while the opening offline capture is pending', async () => {
  const copy = Promise.withResolvers<void>();
  vi.spyOn(savedBatches, 'captureBatch').mockReturnValueOnce(copy.promise);
  renderRoute();
  const sync = await screen.findByRole('button', { name: 'requisitions.batch.sync' });
  await waitFor(() => expect(sync).toBeEnabled());
  try {
    await userEvent.click(sync);
    await waitFor(() => expect(saveBatchRequisitions).toHaveBeenCalledOnce());
  } finally {
    await act(async () => copy.resolve());
  }
});

it('renders batch rows while membership is pending and enables approval only after verification', async () => {
  let finish!: (result: never) => void;
  vi.mocked(fetchApprovalList).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  renderRoute();
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.verifying' });
  await screen.findByRole('table', { name: 'requisitions.batch.title' });
  expect(approve).toBeDisabled();
  await act(async () =>
    finish({ content: records.map((r) => ({ id: r.id })), totalPages: 1 } as never),
  );
  await waitFor(() => expect(approve).toBeEnabled());
});

it('counts a multiline request failure once instead of counting message lines', async () => {
  vi.mocked(saveBatchRequisitions).mockRejectedValueOnce(new Error('First line\nSecond line'));
  renderRoute();
  const inputs = await screen.findAllByRole('textbox');
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  expect(await screen.findByRole('heading', { name: 'There Was 1 Error' })).toBeInTheDocument();
});

it('keeps Sync membership when the opening read finishes later', async () => {
  const opening = Promise.withResolvers<Awaited<ReturnType<typeof fetchApprovalList>>>();
  vi.mocked(fetchApprovalList).mockReturnValueOnce(opening.promise);
  renderRoute();
  const sync = await screen.findByRole('button', { name: 'requisitions.batch.sync' });
  await waitFor(() => expect(sync).toBeEnabled());
  await userEvent.click(sync);
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  await act(async () => opening.resolve({ content: [], totalPages: 1 } as never));
  expect(approve).toBeEnabled();
  expect(screen.queryByText('requisitions.batch.no-longer-awaiting')).not.toBeInTheDocument();
});

it('uses the saveAll response for Sync without retrieving the batch again', async () => {
  security.secure = false;
  renderRoute();
  const input = (await screen.findAllByRole('textbox'))[0];
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.clear(input);
  await userEvent.type(input, '123');
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.batch.sync' }));
  await waitFor(() => expect(saveBatchRequisitions).toHaveBeenCalledOnce());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.batch.sync' })).toBeEnabled(),
  );
  expect(fetchBatchRequisitions).toHaveBeenCalledOnce();
});

it('keeps focus and every keystroke when reopening a warm batch', async () => {
  security.secure = false;
  const { router } = renderRoute();
  await screen.findAllByRole('textbox');
  await act(() => router.navigate({ to: '/requisitions/approve' }));
  await screen.findByText('Approval List');
  const opening = Promise.withResolvers<Awaited<ReturnType<typeof fetchApprovalList>>>();
  vi.mocked(fetchApprovalList).mockReturnValueOnce(opening.promise);
  await act(() =>
    router.navigate({
      to: '/requisitions/approve/batch',
      search: { ids: records.map((r) => r.id).join(',') },
    }),
  );
  const input = (await screen.findAllByRole('textbox'))[0];
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.clear(input);
  await userEvent.type(input, '987');
  await act(() =>
    opening.resolve({ content: records.map((r) => ({ id: r.id })), totalPages: 1 } as never),
  );
  await userEvent.type(input, '6543', { skipClick: true });
  expect(input).toHaveFocus();
  expect(input).toHaveValue('9876543');
  expect(fetchBatchRequisitions).toHaveBeenCalledOnce();
});

it('retrieves a trusted list opening before starting its offline membership scan', async () => {
  const response = Promise.withResolvers<Awaited<ReturnType<typeof fetchBatchRequisitions>>>();
  vi.mocked(fetchBatchRequisitions).mockReturnValueOnce(response.promise);
  vi.spyOn(savedBatches, 'cachedBatchMembership').mockReturnValue({
    found: [],
    remaining: new Set(),
  });
  renderRoute();
  await waitFor(() => expect(fetchBatchRequisitions).toHaveBeenCalledOnce());
  expect(fetchApprovalList).not.toHaveBeenCalled();
  await act(() => response.resolve({ requisitionDtos: records }));
  const approve = await screen.findByRole('button', { name: 'requisitions.batch.approve' });
  await waitFor(() => expect(approve).toBeEnabled());
  expect(fetchApprovalList).toHaveBeenCalledWith(expect.anything(), {
    backgroundDownload: true,
    downloadProvider: 'requisition-copy',
  });
});

it('settles a timed out membership read and allows retry without technical text', async () => {
  vi.mocked(fetchApprovalList).mockRejectedValueOnce(
    new AxiosError('timeout of 60000ms exceeded', 'ECONNABORTED'),
  );
  const { queryClient } = renderRoute();
  await screen.findByText('requisitions.batch.verification-failed');
  expect(
    screen.queryByRole('button', { name: 'requisitions.batch.verifying' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'requisitions.batch.approve' })).toBeDisabled();
  expect(screen.queryByText(/60000ms/)).not.toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: 'error.try-again' })[0]);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'requisitions.batch.approve' })).toBeEnabled(),
  );
  queryClient.clear();
});
