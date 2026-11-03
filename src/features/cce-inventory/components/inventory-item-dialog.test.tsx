import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInventoryItem, fetchCatalogItems } from '@/features/cce-inventory/api/api';
import { InventoryItemDialog } from '@/features/cce-inventory/components/inventory-item-dialog';
import type { CatalogItem, InventoryItemBody } from '@/features/cce-inventory/lib/types';
import {
  fetchMinimalFacilities,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import type { FacilityProgramSelection } from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import type { ProgramGrant } from '@/lib/permissions';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/cce-inventory/api/api', () => ({
  fetchCatalogItems: vi.fn(),
  createInventoryItem: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchMinimalFacilities: vi.fn(),
}));

const USER = 'u1';
const HOME = 'home';
const LURIO = 'lurio';
const BALAKA = 'balaka';
const EPI = 'epi';
const FP = 'fp';

const grant = (facilityId: string, programId: string): ProgramGrant => ({
  right: 'CCE_INVENTORY_EDIT',
  facilityId,
  programId,
});

const catalogItem = (
  id: string,
  type: string,
  manufacturer: string,
  model: string,
  energySource: CatalogItem['energySource'] = 'ELECTRIC',
): CatalogItem => ({ id, type, manufacturer, model, energySource });

const HAIER = catalogItem('c1', 'Freezer', 'Haier', 'HBD-286');
const VESTFROST = catalogItem('c2', 'Freezer', 'Vestfrost', 'MF 314');
const WALK_IN = catalogItem('c3', 'Walk-in freezer', 'Zanotti', 'WF-1');
const SOLAR = catalogItem('c4', 'Solar fridge', 'SunDanzer', 'BFRV 55', 'SOLAR');
const DOMETIC = catalogItem('c5', 'Refrigerator', 'Dometic', 'TCW 2000');
const MEDICAL = catalogItem('c6', 'Refrigerator', 'B Medical', 'TCW 40R');

const HOME_EPI: FacilityProgramSelection = { mode: 'my', programId: EPI, facilityId: HOME };

function renderDialog({
  grants = [grant(HOME, EPI), grant(LURIO, EPI), grant(HOME, FP)],
  initial = {},
}: {
  grants?: ProgramGrant[];
  initial?: FacilityProgramSelection;
} = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  renderPage(
    <InventoryItemDialog
      grants={grants}
      initial={initial}
      onClose={onClose}
      onSaved={onSaved}
      open
      userId={USER}
    />,
    { queryClient },
  );
  return { onSaved, onClose, invalidate };
}

type User = ReturnType<typeof userEvent.setup>;

const combobox = (name: string) => screen.findByRole('combobox', { name: new RegExp(name) });

const button = (name: string) => screen.findByRole('button', { name });

async function choose(user: User, field: string, option: RegExp) {
  await user.click(await combobox(field));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function toDetails(user: User, type: RegExp) {
  await choose(user, 'cce-inventory.form.equipment-type', type);
  await user.click(await button('cce-inventory.form.next'));
  await screen.findByRole('textbox', { name: /cce-inventory.form.serial-number/ });
}

async function fillDetails(user: User) {
  await user.type(
    screen.getByRole('textbox', { name: /cce-inventory.form.serial-number/ }),
    'SN-1',
  );
  await user.type(
    screen.getByRole('textbox', { name: /^cce-inventory.reference-name/ }),
    'Fridge 2',
  );
  await choose(user, 'cce-inventory.form.utilization', /cce-inventory.form.active/);
  await user.type(
    screen.getByRole('textbox', { name: /cce-inventory.form.year-of-installation/ }),
    '2019',
  );
  await choose(user, 'cce-inventory.form.manual-temperature-gauge', /cce-inventory.form.built-in/);
  await choose(user, 'cce-inventory.form.remote-temperature-monitor', /cce-inventory.form.no-rtm/);
  await choose(user, 'cce-inventory.form.functional-status', /cce-equipment.status.functioning/);
}

beforeEach(() => {
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
  vi.mocked(fetchCatalogItems).mockResolvedValue([
    WALK_IN,
    VESTFROST,
    HAIER,
    SOLAR,
    DOMETIC,
    MEDICAL,
  ]);
  vi.mocked(createInventoryItem).mockResolvedValue();
});

describe('InventoryItemDialog', () => {
  it('opens on the facility and program searched in the inventory', async () => {
    renderDialog({ initial: { mode: 'supervised', programId: EPI, facilityId: LURIO } });

    expect(
      await screen.findByRole('radio', { name: /facility-program.supervised-facility/ }),
    ).toBeChecked();
    expect(await combobox('facility-program.program')).toHaveValue('EPI');
    expect(await combobox('facility-program.facility')).toHaveValue('Lurio District Hospital');
  });

  it('offers only facilities the user may edit and picks a sole program by itself', async () => {
    const user = userEvent.setup();
    renderDialog({ grants: [grant(HOME, EPI), grant(LURIO, EPI)] });

    await waitFor(async () =>
      expect(await combobox('facility-program.program')).toHaveValue('EPI'),
    );
    await user.click(
      await screen.findByRole('radio', { name: /facility-program.supervised-facility/ }),
    );
    await user.click(await combobox('facility-program.facility'));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      expect.stringContaining('Comfort Health Clinic'),
      expect.stringContaining('Lurio District Hospital'),
    ]);
  });

  it('opens on my facility when a supervised link meets a user who edits only at home', async () => {
    renderDialog({
      grants: [grant(HOME, EPI)],
      initial: { mode: 'supervised', programId: EPI, facilityId: LURIO },
    });

    expect(
      await screen.findByRole('radio', { name: /facility-program.my-facility/ }),
    ).toBeChecked();
  });

  it('lists the models of exactly the chosen type and clears the model when the type changes', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await choose(user, 'cce-inventory.form.equipment-type', /^Freezer$/);
    await user.click(await combobox('cce-inventory.make-model'));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Haier HBD-286',
      'Vestfrost MF 314',
    ]);
    await user.click(screen.getByRole('option', { name: 'Haier HBD-286' }));
    await choose(user, 'cce-inventory.form.equipment-type', /^Freezer$/);
    expect(await combobox('cce-inventory.make-model')).toHaveValue('Haier HBD-286');
    await choose(user, 'cce-inventory.form.equipment-type', /^Refrigerator$/);
    expect(await combobox('cce-inventory.make-model')).toHaveValue('');
    await choose(user, 'cce-inventory.form.equipment-type', /^Walk-in freezer$/);
    expect(await combobox('cce-inventory.make-model')).toHaveValue('Zanotti WF-1');
  });

  it('keeps Next off until the facility, program, type and model are chosen', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: { mode: 'supervised', programId: EPI } });

    await combobox('cce-inventory.form.equipment-type');
    expect(await button('cce-inventory.form.next')).toBeDisabled();
    await choose(user, 'facility-program.facility', /Lurio District Hospital/);
    await choose(user, 'cce-inventory.form.equipment-type', /^Freezer$/);
    expect(await button('cce-inventory.form.next')).toBeDisabled();
    await choose(user, 'cce-inventory.make-model', /^Haier HBD-286$/);

    expect(await button('cce-inventory.form.next')).toBeEnabled();
  });

  it('shows the choice read only in step two and keeps the details on Back', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);
    for (const value of ['Comfort Health Clinic', 'EPI', 'Solar fridge', 'SunDanzer BFRV 55']) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    await user.type(
      screen.getByRole('textbox', { name: /cce-inventory.form.serial-number/ }),
      'SN-1',
    );
    await user.click(await button('cce-inventory.form.back'));
    await user.click(await button('cce-inventory.form.next'));

    expect(
      await screen.findByRole('textbox', { name: /cce-inventory.form.serial-number/ }),
    ).toHaveValue('SN-1');
  });

  it('fixes the power fields of solar equipment and frees them for an electric model', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);
    const solar = await combobox('cce-inventory.form.voltage-stabilizer');
    expect(solar).toHaveTextContent('cce-inventory.form.not-applicable');
    expect(solar).toBeDisabled();
    await user.click(await button('cce-inventory.form.back'));
    await toDetails(user, /^Walk-in freezer$/);

    const electric = await combobox('cce-inventory.form.voltage-stabilizer');
    expect(electric).toBeEnabled();
    expect(electric).not.toHaveTextContent('cce-inventory.form.not-applicable');
  });

  it('clears the reason only when the status changes', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Walk-in freezer$/);
    const status = 'cce-inventory.form.functional-status';
    await choose(user, status, /cce-equipment.status.unserviceable/);
    await choose(user, 'cce-inventory.form.reason', /cce-equipment.reason.dead/);
    await choose(user, status, /cce-equipment.status.unserviceable/);
    expect(await combobox('cce-inventory.form.reason')).toHaveTextContent('reason.dead');
    await choose(user, status, /cce-equipment.status.awaiting-repair/);

    expect(await combobox('cce-inventory.form.reason')).not.toHaveTextContent('reason.dead');
  });

  it('shows what is missing, then saves once and refreshes the inventory and Home', async () => {
    const user = userEvent.setup();
    const { onSaved, invalidate } = renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);
    await user.click(await button('cce-inventory.form.save'));
    expect(
      screen.getByRole('textbox', { name: /cce-inventory.form.serial-number/ }),
    ).toHaveAccessibleDescription(/cce-inventory.form.required/);
    expect(await combobox('cce-inventory.form.functional-status')).toHaveAccessibleDescription(
      /cce-inventory.form.required/,
    );
    await fillDetails(user);
    await user.dblClick(await button('cce-inventory.form.save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createInventoryItem).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createInventoryItem).mock.calls[0]?.[0]).toEqual({
      facility: { id: HOME },
      program: { id: EPI },
      catalogItem: SOLAR,
      equipmentTrackingId: 'SN-1',
      referenceName: 'Fridge 2',
      utilization: 'ACTIVE',
      yearOfInstallation: 2019,
      voltageStabilizer: 'NOT_APPLICABLE',
      voltageRegulator: 'NOT_APPLICABLE',
      backupGenerator: 'NOT_APPLICABLE',
      manualTemperatureGauge: 'BUILD_IN',
      remoteTemperatureMonitor: 'NO_RTM',
      functionalStatus: 'FUNCTIONING',
    } satisfies InventoryItemBody);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.inventoryItems.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.home.all });
  });

  it('keeps the draft with the server message, and drops the message on Back', async () => {
    const user = userEvent.setup();
    vi.mocked(createInventoryItem).mockRejectedValueOnce(
      httpError(400, { messageKey: 'cce.error.exists', message: 'SN-1 already exists.' }),
    );
    const { onSaved } = renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);
    await fillDetails(user);
    await user.click(await button('cce-inventory.form.save'));
    expect(await screen.findByText('SN-1 already exists.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /cce-inventory.form.serial-number/ })).toHaveValue(
      'SN-1',
    );
    await user.click(await button('cce-inventory.form.back'));
    await user.click(await button('cce-inventory.form.next'));

    expect(screen.queryByText('SN-1 already exists.')).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('closes once on a double-clicked Cancel in the details step', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Walk-in freezer$/);
    await user.dblClick(await button('dialog.cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
