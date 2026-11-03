import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInventoryItem, fetchCatalogItems } from '@/features/cce-inventory/api/api';
import { InventoryItemEditor } from '@/features/cce-inventory/components/inventory-item-editor';
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

function renderEditor({
  grants = [grant(HOME, EPI), grant(LURIO, EPI), grant(HOME, FP)],
  initial = NO_PAIR,
}: {
  grants?: ProgramGrant[];
  initial?: FacilityProgramSelection;
} = {}) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  renderPage(
    <InventoryItemEditor
      grants={grants}
      initial={initial}
      onCancel={onCancel}
      onSaved={onSaved}
      userId={USER}
    />,
    { queryClient },
  );
  return { onSaved, onCancel, invalidate };
}

const combobox = (name: string) => screen.findByRole('combobox', { name: new RegExp(name) });

async function choose(user: ReturnType<typeof userEvent.setup>, field: string, option: RegExp) {
  await user.click(await combobox(field));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
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

describe('InventoryItemEditor', () => {
  it('opens on the facility and program searched in the inventory', async () => {
    renderEditor({ initial: { mode: 'supervised', programId: EPI, facilityId: LURIO } });

    expect(
      await screen.findByRole('radio', { name: /facility-program.supervised-facility/ }),
    ).toBeChecked();
    expect(await combobox('facility-program.program')).toHaveValue('EPI');
    expect(await combobox('facility-program.facility')).toHaveValue('Lurio District Hospital');
  });

  it('offers only facilities the user may edit and picks a sole program by itself', async () => {
    const user = userEvent.setup();
    renderEditor({ grants: [grant(HOME, EPI), grant(LURIO, EPI)] });

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
    renderEditor({ initial: { mode: 'supervised', programId: EPI, facilityId: BALAKA } });

    expect(await combobox('facility-program.facility')).toHaveValue('');
  });

  it('opens on supervised facilities when the home facility offers no program to edit', async () => {
    renderEditor({ grants: [grant(LURIO, EPI)] });

    expect(
      await screen.findByRole('radio', { name: /facility-program.supervised-facility/ }),
    ).toBeChecked();
    expect(await combobox('facility-program.program')).toHaveValue('EPI');
  });

  it('lists the models of exactly the chosen type and clears the model when the type changes', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: { mode: 'my', programId: EPI, facilityId: HOME } });

    await choose(user, 'cce-inventory.form.equipment-type', /^Freezer$/);
    await user.click(await combobox('cce-inventory.form.make-model'));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Haier HBD-286',
      'Vestfrost MF 314',
    ]);
    await user.click(screen.getByRole('option', { name: 'Haier HBD-286' }));
    await choose(user, 'cce-inventory.form.equipment-type', /^Refrigerator$/);
    expect(await combobox('cce-inventory.form.make-model')).toHaveValue('');

    await choose(user, 'cce-inventory.form.equipment-type', /^Walk-in freezer$/);
    expect(await combobox('cce-inventory.form.make-model')).toHaveValue('Zanotti WF-1');
  });

  it('fixes the power fields of solar equipment to not applicable', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: { mode: 'my', programId: EPI, facilityId: HOME } });

    await choose(user, 'cce-inventory.form.equipment-type', /^Solar fridge$/);

    for (const field of ['voltage-stabilizer', 'voltage-regulator', 'backup-generator']) {
      const select = await combobox(`cce-inventory.form.${field}`);
      expect(select).toHaveTextContent('cce-inventory.form.not-applicable');
      expect(select).toBeDisabled();
    }
  });

  it('unlocks and clears the power fields when an electric model replaces a solar one', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: { mode: 'my', programId: EPI, facilityId: HOME } });

    await choose(user, 'cce-inventory.form.equipment-type', /^Solar fridge$/);
    await choose(user, 'cce-inventory.form.equipment-type', /^Walk-in freezer$/);

    const stabilizer = await combobox('cce-inventory.form.voltage-stabilizer');
    expect(stabilizer).toBeEnabled();
    expect(stabilizer).not.toHaveTextContent('cce-inventory.form.not-applicable');
  });

  it('clears the reason and the decommission date only when the status changes', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: { mode: 'my', programId: EPI, facilityId: HOME } });

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

  it('shows what is missing on Save, not on a model still waiting for its type, and sends nothing', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: { mode: 'my', programId: EPI, facilityId: HOME } });

    await combobox('cce-inventory.form.equipment-type');
    await user.click(screen.getByRole('button', { name: 'cce-inventory.form.save' }));

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
      'cce-inventory.form.equipment-type',
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
    expect(await combobox('cce-inventory.form.make-model')).not.toHaveAccessibleDescription(
      /cce-inventory.form.required/,
    );
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('saves the equipment once and refreshes the inventory and Home', async () => {
    const user = userEvent.setup();
    const { onSaved, invalidate } = renderEditor({
      initial: { mode: 'my', programId: EPI, facilityId: HOME },
    });

    await choose(user, 'cce-inventory.form.equipment-type', /^Solar fridge$/);
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'cce-inventory.form.save' }));

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
    const { onSaved } = renderEditor({ initial: { mode: 'my', programId: EPI, facilityId: HOME } });

    await choose(user, 'cce-inventory.form.equipment-type', /^Solar fridge$/);
    await fillDetails(user);
    await user.dblClick(screen.getByRole('button', { name: 'cce-inventory.form.save' }));

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
    const { onSaved } = renderEditor({ initial: { mode: 'my', programId: EPI, facilityId: HOME } });

    await choose(user, 'cce-inventory.form.equipment-type', /^Solar fridge$/);
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'cce-inventory.form.save' }));

    expect(await screen.findByText(/SN-1 serial number/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /cce-inventory.form.serial-number/ })).toHaveValue(
      'SN-1',
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('goes back without a request on Cancel', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderEditor({
      initial: { mode: 'my', programId: EPI, facilityId: HOME },
    });

    await user.click(await screen.findByRole('button', { name: 'cce-inventory.form.cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(createInventoryItem).not.toHaveBeenCalled();
  });
});
