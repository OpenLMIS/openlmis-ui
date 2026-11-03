import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
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
): CatalogItem => ({
  id,
  fromPqsCatalog: true,
  type,
  manufacturer,
  model,
  energySource,
  storageTemperature: 'PLUS4',
  archived: false,
});

const HAIER = catalogItem('c1', 'Freezer', 'Haier', 'HBD-286');
const VESTFROST = catalogItem('c2', 'Freezer', 'Vestfrost', 'MF 314');
const WALK_IN = catalogItem('c3', 'Walk-in freezer', 'Zanotti', 'WF-1');
const SOLAR = catalogItem('c4', 'Solar fridge', 'SunDanzer', 'BFRV 55', 'SOLAR');
const DOMETIC = catalogItem('c5', 'Refrigerator', 'Dometic', 'TCW 2000');
const MEDICAL = catalogItem('c6', 'Refrigerator', 'B Medical', 'TCW 40R');

const NO_PAIR: FacilityProgramSelection = {
  mode: undefined,
  programId: undefined,
  facilityId: undefined,
};

const HOME_EPI: FacilityProgramSelection = { mode: 'my', programId: EPI, facilityId: HOME };

function renderDialog({
  grants = [grant(HOME, EPI), grant(LURIO, EPI), grant(HOME, FP)],
  initial = NO_PAIR,
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
    screen.getByRole('textbox', { name: /cce-inventory.form.reference-name/ }),
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

  it('leaves a facility the user may not edit blank instead of offering it', async () => {
    renderDialog({ initial: { mode: 'supervised', programId: EPI, facilityId: BALAKA } });

    expect(await combobox('facility-program.facility')).toHaveValue('');
  });

  it('keeps to supervised facilities when the home facility offers no program to edit', async () => {
    renderDialog({ grants: [grant(LURIO, EPI)] });

    expect(
      await screen.findByRole('radio', { name: /facility-program.supervised-facility/ }),
    ).toBeChecked();
    expect(await combobox('facility-program.program')).toHaveValue('EPI');
    expect(screen.getByRole('radio', { name: /facility-program.my-facility/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('lists the models of exactly the chosen type and clears the model when the type changes', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await choose(user, 'cce-inventory.form.equipment-type', /^Freezer$/);
    await user.click(await combobox('cce-inventory.form.make-model'));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Haier HBD-286',
      'Vestfrost MF 314',
    ]);
    await user.click(screen.getByRole('option', { name: 'Haier HBD-286' }));
    await choose(user, 'cce-inventory.form.equipment-type', /^Freezer$/);
    expect(await combobox('cce-inventory.form.make-model')).toHaveValue('Haier HBD-286');
    await choose(user, 'cce-inventory.form.equipment-type', /^Refrigerator$/);
    expect(await combobox('cce-inventory.form.make-model')).toHaveValue('');

    await choose(user, 'cce-inventory.form.equipment-type', /^Walk-in freezer$/);
    expect(await combobox('cce-inventory.form.make-model')).toHaveValue('Zanotti WF-1');
  });

  it('keeps Next off until the facility, program, type and model are chosen', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: { mode: 'supervised', programId: EPI, facilityId: undefined } });

    const next = await button('cce-inventory.form.next');
    expect(next).toBeDisabled();
    await choose(user, 'facility-program.facility', /Lurio District Hospital/);
    await choose(user, 'cce-inventory.form.equipment-type', /^Freezer$/);
    expect(next).toBeDisabled();
    await choose(user, 'cce-inventory.form.make-model', /^Haier HBD-286$/);

    expect(next).toBeEnabled();
  });

  it('shows the choice read only in step two and keeps the details on Back', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);
    const choice = screen.getByRole('group', { name: 'cce-inventory.form.equipment' });
    for (const value of ['Comfort Health Clinic', 'EPI', 'Solar fridge', 'SunDanzer BFRV 55']) {
      expect(within(choice).getByText(value)).toBeInTheDocument();
    }
    await user.type(
      screen.getByRole('textbox', { name: /cce-inventory.form.serial-number/ }),
      'SN-1',
    );
    await user.click(await button('cce-inventory.form.back'));
    expect(await combobox('cce-inventory.form.make-model')).toHaveValue('SunDanzer BFRV 55');
    await user.click(await button('cce-inventory.form.next'));

    expect(
      await screen.findByRole('textbox', { name: /cce-inventory.form.serial-number/ }),
    ).toHaveValue('SN-1');
  });

  it('fixes the power fields of solar equipment to not applicable', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);

    for (const field of ['voltage-stabilizer', 'voltage-regulator', 'backup-generator']) {
      const select = await combobox(`cce-inventory.form.${field}`);
      expect(select).toHaveTextContent('cce-inventory.form.not-applicable');
      expect(select).toBeDisabled();
    }
  });

  it('unlocks and clears the power fields when an electric model replaces a solar one', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await choose(user, 'cce-inventory.form.equipment-type', /^Solar fridge$/);
    await toDetails(user, /^Walk-in freezer$/);

    const stabilizer = await combobox('cce-inventory.form.voltage-stabilizer');
    expect(stabilizer).toBeEnabled();
    expect(stabilizer).not.toHaveTextContent('cce-inventory.form.not-applicable');
  });

  it('clears the reason and the decommission date only when the status changes', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Walk-in freezer$/);
    await choose(
      user,
      'cce-inventory.form.functional-status',
      /cce-equipment.status.unserviceable/,
    );
    await choose(user, 'cce-inventory.form.reason', /cce-equipment.reason.dead/);
    await choose(
      user,
      'cce-inventory.form.functional-status',
      /cce-equipment.status.unserviceable/,
    );
    expect(await combobox('cce-inventory.form.reason')).toHaveTextContent(
      'cce-equipment.reason.dead',
    );
    await choose(user, 'cce-inventory.form.functional-status', /cce-equipment.status.functioning/);
    expect(screen.queryByRole('combobox', { name: /cce-inventory.form.reason/ })).toBeNull();
    await choose(
      user,
      'cce-inventory.form.functional-status',
      /cce-equipment.status.awaiting-repair/,
    );

    expect(await combobox('cce-inventory.form.reason')).not.toHaveTextContent(
      'cce-equipment.reason.dead',
    );
  });

  it('shows what is missing on Save and sends nothing', async () => {
    const user = userEvent.setup();
    renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Walk-in freezer$/);
    await user.click(await button('cce-inventory.form.save'));

    for (const field of [
      'cce-inventory.form.serial-number',
      'cce-inventory.form.reference-name',
      'cce-inventory.form.year-of-installation',
    ]) {
      expect(screen.getByRole('textbox', { name: new RegExp(field) })).toHaveAccessibleDescription(
        /cce-inventory.form.required/,
      );
    }
    for (const field of [
      'cce-inventory.form.utilization',
      'cce-inventory.form.voltage-stabilizer',
      'cce-inventory.form.voltage-regulator',
      'cce-inventory.form.backup-generator',
      'cce-inventory.form.manual-temperature-gauge',
      'cce-inventory.form.remote-temperature-monitor',
      'cce-inventory.form.functional-status',
    ]) {
      expect(await combobox(field)).toHaveAccessibleDescription(/cce-inventory.form.required/);
    }
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('saves the equipment once and refreshes the inventory and Home', async () => {
    const user = userEvent.setup();
    const { onSaved, invalidate } = renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);
    await fillDetails(user);
    await user.click(await button('cce-inventory.form.save'));

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

  it('sends one request when Save is double-clicked', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);
    await fillDetails(user);
    await user.dblClick(await button('cce-inventory.form.save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createInventoryItem).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft and shows the server message when the equipment already exists', async () => {
    const user = userEvent.setup();
    vi.mocked(createInventoryItem).mockRejectedValueOnce(
      httpError(400, {
        messageKey: 'cce.error.inventory.item.alreadyExists',
        message:
          'Equipment of the SN-1 serial number, Solar fridge type, and BFRV 55 model already exists.',
      }),
    );
    const { onSaved } = renderDialog({ initial: HOME_EPI });

    await toDetails(user, /^Solar fridge$/);
    await fillDetails(user);
    await user.click(await button('cce-inventory.form.save'));

    expect(await screen.findByText(/SN-1 serial number/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /cce-inventory.form.serial-number/ })).toHaveValue(
      'SN-1',
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('closes without a request on Cancel', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ initial: HOME_EPI });

    await user.click(await button('cce-inventory.form.cancel'));

    expect(onClose).toHaveBeenCalled();
    expect(createInventoryItem).not.toHaveBeenCalled();
  });
});
