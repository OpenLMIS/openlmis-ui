import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import {
  cleanup,
  type RenderOptions,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  createInventoryItem,
  exportInventoryItems,
  fetchInventoryAlerts,
  fetchInventoryItems,
} from '@/features/cce-inventory/api/api';
import type { InventoryAlert, InventoryItem } from '@/features/cce-inventory/lib/types';
import {
  fetchMinimalFacilities,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { openLegacy } from '@/hooks/use-back-to-legacy';
import { downloadFile } from '@/lib/download-file';
import { Route } from '@/routes/(protected)/_protected.cce.inventory';
import { expectRouteWarning } from '@/test-utils/expect-route-warning';
import { httpError } from '@/test-utils/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchCurrencySettings: vi.fn(async () => ({ timeZoneId: 'UTC' })),
  storedTimeZone: vi.fn(() => null),
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchMinimalFacilities: vi.fn(),
}));
vi.mock('@/features/cce-inventory/api/api', () => ({
  fetchInventoryItems: vi.fn(),
  fetchInventoryAlerts: vi.fn(),
  exportInventoryItems: vi.fn(),
  fetchCatalogItems: vi.fn(async () => [
    { id: 'c1', type: 'Solar fridge', manufacturer: 'Sun', model: 'S1', energySource: 'SOLAR' },
  ]),
  createInventoryItem: vi.fn(),
  fetchInventoryItem: vi.fn(() => new Promise(() => {})),
}));
vi.mock('@/lib/download-file', () => ({ downloadFile: vi.fn() }));
vi.mock('@/hooks/use-back-to-legacy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-back-to-legacy')>()),
  legacyAvailable: () => true,
  openLegacy: vi.fn(),
}));

const USER = 'a337ec45-31a0-4f2b-9b2e-a105c4b669bb';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const BALAKA = '13037147-1769-4735-90a7-b9b310d128b8';
const LURIO = '5d1a3d73-9c05-4c56-9d27-7a1fd0f3d1a1';
const EPI = '418bdc1d-c303-4bd0-b2d3-d8901150a983';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const FRIDGE = '55bd67f1-cc2e-4bbe-8c47-679b5a8dc547';
const FREEZER = 'c87a5efa-c156-41b1-b9a4-1c2ff35ae2cc';
const COLD_BOX = 'b29e00b4-4953-4628-bbdf-9ed3bf0f0818';
const ALERT_TEXT = 'Less than 50% data available for this equipment';

const VIEW = `CCE_INVENTORY_VIEW|${HOME}|${EPI}`;
const EDIT = `CCE_INVENTORY_EDIT|${HOME}|${EPI}`;

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: FRIDGE,
  equipmentTrackingId: '1072961',
  referenceName: 'Fridge #11',
  catalogItem: { manufacturer: 'Haier', model: 'HBC-70', type: 'IRL' },
  functionalStatus: 'FUNCTIONING',
  yearOfInstallation: 2017,
  modifiedDate: '2017-10-01T00:00:00Z',
  lastModifier: { firstName: 'Eduardo', lastName: 'Magaia' },
  ...overrides,
});

const { equipmentTrackingId, modifiedDate, lastModifier, ...withoutOptional } = item();

const ITEMS = [
  item(),
  {
    ...withoutOptional,
    id: FREEZER,
    referenceName: 'Fridge #17',
    catalogItem: { manufacturer: 'Vestfrost', model: 'MF 314*', type: 'Freezer' },
    functionalStatus: 'AWAITING_REPAIR',
    reasonNotWorkingOrNotInUse: 'NEEDS_SPARE_PARTS',
  } satisfies InventoryItem,
  {
    ...withoutOptional,
    id: COLD_BOX,
    referenceName: 'Fridge #2',
    modifiedDate: '2018-05-04T10:00:00Z',
  } satisfies InventoryItem,
];

const alert = (overrides: Partial<InventoryAlert>): InventoryAlert => ({
  alert_id: 'a1',
  device_id: FRIDGE,
  start_ts: '2018-02-26T11:41:45Z',
  end_ts: null,
  dismissed: false,
  status: { 'en-US': ALERT_TEXT },
  ...overrides,
});

const page = (content: InventoryItem[], totalElements = content.length) => ({
  content,
  totalElements,
  totalPages: Math.ceil(totalElements / 10),
  number: 0,
  size: 10,
});

function renderRoute(path: string, renderOptions: Pick<RenderOptions, 'onCaughtError'> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'cce/inventory',
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
    defaultErrorComponent: ErrorFallback,
    history: createMemoryHistory({ initialEntries: [path] }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    renderOptions,
  );
  return { router };
}

const appliedPath = (extra = '', facility = HOME, program = EPI, mode = 'my') =>
  `/cce/inventory?mode=${mode}&programId=${program}&facilityId=${facility}${extra}`;

const widthOf = (width: number) =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);

const headers = () =>
  within(screen.getByRole('table'))
    .getAllByRole('columnheader')
    .map((header) => header.textContent);

const itemOf = async (name: string) => {
  const text = await screen.findByText(name);
  return (text.closest('tr') ?? text.closest('li')) as HTMLElement;
};

beforeEach(() => {
  vi.clearAllMocks();
  widthOf(1400);
  useLoginData.setState({ referenceDataUserId: USER });
  vi.mocked(fetchPermissionStrings).mockResolvedValue([VIEW, EDIT]);
  vi.mocked(fetchUserRecord).mockResolvedValue({
    id: USER,
    username: 'administrator',
    firstName: 'Admin',
    lastName: 'Istrator',
    active: true,
    homeFacilityId: HOME,
    roleAssignments: [],
  });
  vi.mocked(fetchUserPrograms).mockResolvedValue([
    { id: EPI, code: 'PRG004', name: 'EPI', active: true },
    { id: FP, code: 'PRG001', name: 'Family Planning', active: true },
  ]);
  vi.mocked(fetchMinimalFacilities).mockResolvedValue([
    { id: HOME, code: 'HC01', name: 'Comfort Health Clinic', active: true },
    { id: BALAKA, code: 'DH01', name: 'Balaka District Hospital', active: true },
    { id: LURIO, code: 'DH02', name: 'Lurio District Hospital', active: true },
  ]);
  vi.mocked(fetchInventoryItems).mockResolvedValue(page(ITEMS));
  vi.mocked(fetchInventoryAlerts).mockResolvedValue([
    alert({ alert_id: 'active', device_id: FRIDGE }),
    alert({ alert_id: 'past', device_id: FREEZER, end_ts: '2018-03-01T00:00:00Z' }),
  ]);
  vi.mocked(exportInventoryItems).mockResolvedValue(new Blob(['Facility Name\r\n']));
});

afterEach(() => {
  cleanup();
  useLoginData.setState({ referenceDataUserId: null });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('CCE inventory page', () => {
  it('keeps the page closed to a user without the right to view the inventory', async () => {
    const onCaughtError = vi.fn((caught: unknown) => {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect(caught).toHaveProperty('message', 'Missing right CCE_INVENTORY_VIEW');
    });
    vi.mocked(fetchPermissionStrings).mockResolvedValue([`CCE_INVENTORY_EDIT|${HOME}|${EPI}`]);
    const matchId = `/(protected)/_protected/cce/inventory/cce/inventory${JSON.stringify({ search: { mode: 'my', programId: EPI, facilityId: HOME } })}`;
    const assertRouteWarning = expectRouteWarning(matchId);
    renderRoute(appliedPath(), { onCaughtError });

    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(fetchInventoryItems).not.toHaveBeenCalled();
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });

  it('shows the picker, asks for no equipment and keeps Export off before a search', async () => {
    renderRoute('/cce/inventory');

    expect(await screen.findByText('cce-inventory.pick-title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cce-inventory.export' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'cce-inventory.add' })).not.toBeInTheDocument();
    expect(fetchInventoryItems).not.toHaveBeenCalled();
  });

  it.each([
    ['no grant', [VIEW]],
    ['an edit grant without a view grant', [VIEW, `CCE_INVENTORY_EDIT|${BALAKA}|${EPI}`]],
  ])('refuses a link to a facility with %s, asking the server nothing', async (_name, grants) => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(grants);
    renderRoute(appliedPath('', BALAKA, EPI, 'supervised'));

    expect(await screen.findByText('cce-inventory.refused-title')).toBeInTheDocument();
    expect(fetchInventoryItems).not.toHaveBeenCalled();
  });

  it('lists only facilities with a view grant under Supervised Facility, home included', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      VIEW,
      `CCE_INVENTORY_VIEW|${BALAKA}|${EPI}`,
      `CCE_INVENTORY_EDIT|${LURIO}|${EPI}`,
    ]);
    const { router } = renderRoute('/cce/inventory');

    await user.click(
      await screen.findByRole('radio', { name: /facility-program.supervised-facility/ }),
    );
    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    await user.click(await screen.findByRole('option', { name: 'EPI' }));
    await user.click(screen.getByRole('combobox', { name: /facility-program.facility/ }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Balaka District HospitalDH01',
      'Comfort Health ClinicHC01',
    ]);
    await user.click(screen.getByRole('option', { name: /Balaka District Hospital/ }));
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        mode: 'supervised',
        programId: EPI,
        facilityId: BALAKA,
      }),
    );
    await user.click(
      within(await itemOf('Fridge #11')).getByRole('button', { name: /cce-inventory.view/ }),
    );
    expect(router.state.location.search).toHaveProperty('item', FRIDGE);
  });

  it('lists the equipment with the legacy columns and asks as legacy does', async () => {
    renderRoute(appliedPath());

    const fridge = await itemOf('Fridge #11');
    expect(headers()).toEqual([
      'cce-inventory.facility',
      'cce-inventory.serial-no',
      'cce-inventory.reference-name',
      'cce-inventory.make-model',
      'cce-inventory.type',
      'cce-inventory.functional-status',
      'cce-inventory.last-updated',
      'cce-inventory.year-installed',
      'cce-inventory.actions',
    ]);
    const cells = within(fridge).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Comfort Health Clinic');
    expect(cells[1]).toHaveTextContent('1072961');
    expect(cells[3]).toHaveTextContent('Haier HBC-70');
    expect(cells[4]).toHaveTextContent('IRL');
    expect(cells[5]).toHaveTextContent('cce-equipment.status.functioning');
    expect(cells[6]).toHaveTextContent('cce-inventory.last-updated-by');
    expect(cells[7]).toHaveTextContent('2017');

    const freezer = within(await itemOf('Fridge #17')).getAllByRole('cell');
    expect(freezer[1]?.textContent).toBe('');
    expect(freezer[5]).toHaveTextContent('cce-equipment.status.awaiting-repair');
    expect(freezer[5]).toHaveTextContent('cce-equipment.reason.needs-spare-parts');
    expect(freezer[6]?.textContent).toBe('');

    const coldBox = within(await itemOf('Fridge #2')).getAllByRole('cell');
    expect(coldBox[6]).toHaveTextContent('2018');
    expect(coldBox[6]).not.toHaveTextContent('Magaia');

    expect(fetchInventoryItems).toHaveBeenCalledWith({
      facilityId: HOME,
      programId: EPI,
      page: 0,
      size: 10,
      sort: ['referenceName,asc', 'id,asc'],
    });
    await waitFor(() =>
      expect(fetchInventoryAlerts).toHaveBeenCalledWith([FRIDGE, FREEZER, COLD_BOX]),
    );
  });

  it('shows an active alert bell that opens the alerts, and a past-only bell', async () => {
    const user = userEvent.setup();
    renderRoute(appliedPath());

    const fridge = await itemOf('Fridge #11');
    await user.click(
      await within(fridge).findByRole('button', { name: /cce-inventory.alerts-active/ }),
    );
    expect(await screen.findByText(ALERT_TEXT)).toBeInTheDocument();
    const freezer = await itemOf('Fridge #17');
    expect(within(freezer).getByLabelText('cce-inventory.alerts-past')).toBeInTheDocument();
    expect(
      within(freezer).queryByRole('button', { name: /cce-inventory.alerts-active/ }),
    ).not.toBeInTheDocument();
    const coldBox = await itemOf('Fridge #2');
    expect(within(coldBox).queryByLabelText(/cce-inventory.alerts/)).not.toBeInTheDocument();
  });

  it('keeps the list when the alerts fail to load, without bells', async () => {
    vi.mocked(fetchInventoryAlerts).mockRejectedValue(httpError(500));
    renderRoute(appliedPath());

    const fridge = await itemOf('Fridge #11');
    await waitFor(() => expect(fetchInventoryAlerts).toHaveBeenCalled());
    expect(within(fridge).queryByLabelText(/cce-inventory.alerts/)).not.toBeInTheDocument();
    expect(screen.getByText('Fridge #17')).toBeInTheDocument();
  });

  it('sends the status filter, sort and page from the link, as after a reload', async () => {
    renderRoute(
      appliedPath('&functionalStatus=AWAITING_REPAIR&sort=yearOfInstallation&dir=desc&page=2'),
    );

    await waitFor(() =>
      expect(fetchInventoryItems).toHaveBeenCalledWith({
        facilityId: HOME,
        programId: EPI,
        page: 1,
        size: 10,
        sort: ['yearOfInstallation,desc', 'referenceName,asc', 'id,asc'],
        functionalStatus: 'AWAITING_REPAIR',
      }),
    );
    expect(await screen.findByRole('button', { name: /^Filters/ })).toHaveTextContent('1');
  });

  it('filters by status from the Filters menu and starts again at the first page', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath('&page=2'));

    await user.click(await screen.findByRole('button', { name: /^Filters/ }));
    await user.click(
      await screen.findByRole('combobox', { name: 'cce-inventory.functional-status' }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'cce-equipment.status.awaiting-repair' }),
    );

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        mode: 'my',
        programId: EPI,
        facilityId: HOME,
        functionalStatus: 'AWAITING_REPAIR',
      }),
    );
  });

  it('drops a status the server does not know instead of sending it', async () => {
    const { router } = renderRoute(appliedPath('&functionalStatus=BROKEN'));

    await waitFor(() =>
      expect(fetchInventoryItems).toHaveBeenCalledWith({
        facilityId: HOME,
        programId: EPI,
        page: 0,
        size: 10,
        sort: ['referenceName,asc', 'id,asc'],
      }),
    );
    expect(router.state.location.search).not.toHaveProperty('functionalStatus');
  });

  it('tells no equipment apart from no matches, and clears the filter', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchInventoryItems).mockResolvedValue(page([]));
    const { router } = renderRoute(appliedPath('&functionalStatus=UNSERVICEABLE'));

    expect(await screen.findByText('cce-inventory.no-matches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'cce-inventory.clear-filters' }));

    expect(await screen.findByText('cce-inventory.empty')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ mode: 'my', programId: EPI, facilityId: HOME });
  });

  it('shows an error with a retry when the equipment fails to load', async () => {
    const failure = httpError(500);
    const onCaughtError = vi.fn((caught: unknown) => expect(caught).toBe(failure));
    const user = userEvent.setup();
    vi.mocked(fetchInventoryItems).mockRejectedValueOnce(failure);
    renderRoute(appliedPath(), { onCaughtError });

    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Fridge #11')).toBeInTheDocument();
    expect(onCaughtError).toHaveBeenCalled();
  });

  it.each([1400, 390])(
    'offers Add Equipment and the status update to an editor of this facility and program at width %i',
    async (width) => {
      const user = userEvent.setup();
      widthOf(width);
      const { router } = renderRoute(appliedPath('&functionalStatus=FUNCTIONING'));

      const fridge = await itemOf('Fridge #11');
      await user.click(within(fridge).getByRole('button', { name: /cce-inventory.update-status/ }));
      expect(openLegacy).toHaveBeenLastCalledWith(
        `#!/cce/inventory/${FRIDGE}/statusUpdate?page=0&size=10&facility=${HOME}&program=${EPI}&supervised=false&functionalStatus=FUNCTIONING`,
      );
      await user.click(screen.getByRole('button', { name: 'cce-inventory.add' }));
      expect(await screen.findByRole('dialog', { name: 'cce-inventory.form.title' })).toBeVisible();
      expect(router.state.location.search).toEqual({
        mode: 'my',
        programId: EPI,
        facilityId: HOME,
        functionalStatus: 'FUNCTIONING',
        item: 'new',
      });
      await user.click(await screen.findByRole('button', { name: 'dialog.cancel' }));
      await waitFor(() => expect(router.state.location.search).not.toHaveProperty('item'));
    },
  );

  it('asks before closing Add Equipment with details typed', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath('&item=new'));

    await user.click(await screen.findByRole('button', { name: 'cce-inventory.form.next' }));
    await user.type(
      await screen.findByRole('textbox', { name: /cce-inventory.form.serial-number/ }),
      'SN-1',
    );
    await user.keyboard('{Escape}');

    expect(
      await screen.findByRole('alertdialog', { name: /discard-changes/ }),
    ).toHaveAccessibleDescription('cce-inventory.form.discard-description');
    expect(router.state.location.search).toHaveProperty('item', 'new');
  });

  it('opens no Add Equipment from a link for a user who cannot edit, and drops it', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([VIEW]);
    const { router } = renderRoute(appliedPath('&item=new'));

    await itemOf('Fridge #11');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('item'));
  });

  it('keeps the details but drops edit from a link for a user who cannot edit', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([VIEW]);
    const { router } = renderRoute(appliedPath(`&item=${FRIDGE}&edit=true`));

    await itemOf('Fridge #11');
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'));
    expect(router.state.location.search).toHaveProperty('item', FRIDGE);
  });

  it('closes Add Equipment onto the list of the saved pair after Save', async () => {
    const user = userEvent.setup();
    vi.mocked(createInventoryItem).mockResolvedValue();
    const { router } = renderRoute(appliedPath('&item=new'));
    const choose = async (name: RegExp, option: RegExp) => {
      await user.click(await screen.findByRole('combobox', { name }));
      await user.click(await screen.findByRole('option', { name: option }));
    };

    await user.click(await screen.findByRole('button', { name: 'cce-inventory.form.next' }));
    await user.type(
      await screen.findByRole('textbox', { name: /cce-inventory.form.serial-number/ }),
      'SN-1',
    );
    await user.type(
      screen.getByRole('textbox', { name: /^cce-inventory.reference-name/ }),
      'Fridge 2',
    );
    await user.type(
      screen.getByRole('textbox', { name: /cce-inventory.form.year-of-installation/ }),
      '2019',
    );
    await choose(/cce-inventory.form.utilization/, /cce-inventory.form.active/);
    await choose(/cce-inventory.form.manual-temperature-gauge/, /cce-inventory.form.built-in/);
    await choose(/cce-inventory.form.remote-temperature-monitor/, /cce-inventory.form.no-rtm/);
    await choose(/cce-inventory.form.functional-status/, /cce-equipment.status.functioning/);
    await user.click(screen.getByRole('button', { name: 'cce-inventory.form.save' }));

    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('item'));
    expect(createInventoryItem).toHaveBeenCalledTimes(1);
    expect(router.state.location.search).toEqual({ mode: 'my', programId: EPI, facilityId: HOME });
  });

  it.each([
    ['a view-only user', [VIEW], 1400],
    ['an editor of another facility', [VIEW, `CCE_INVENTORY_EDIT|${BALAKA}|${EPI}`], 1400],
  ])('keeps the edit actions from %s while View stays', async (_name, grants, width) => {
    widthOf(width);
    vi.mocked(fetchPermissionStrings).mockResolvedValue(grants);
    renderRoute(appliedPath());

    const fridge = await itemOf('Fridge #11');
    expect(within(fridge).getByRole('button', { name: /cce-inventory.view/ })).toBeInTheDocument();
    expect(
      within(fridge).queryByRole('button', { name: /cce-inventory.update-status/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'cce-inventory.add' })).not.toBeInTheDocument();
  });

  it('exports the searched facility and program, not a choice left unsearched in the picker', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPermissionStrings).mockResolvedValue([VIEW, `CCE_INVENTORY_VIEW|${HOME}|${FP}`]);
    renderRoute(appliedPath('&functionalStatus=FUNCTIONING'));

    await itemOf('Fridge #11');
    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    await user.click(await screen.findByRole('option', { name: 'Family Planning' }));
    await user.click(screen.getByRole('button', { name: 'cce-inventory.export' }));

    await waitFor(() => expect(downloadFile).toHaveBeenCalled());
    expect(exportInventoryItems).toHaveBeenCalledWith(HOME, EPI);
    expect(vi.mocked(downloadFile).mock.calls[0]?.[1]).toBe('inventory_items.csv');
  });
});
