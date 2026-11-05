import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dismissAlert,
  fetchInventoryAlerts,
  fetchInventoryItem,
  transferInventoryItem,
  updateInventoryItem,
} from '@/features/cce-inventory/api/api';
import {
  InventoryItemView,
  type ItemAction,
} from '@/features/cce-inventory/components/inventory-item-view';
import type { InventoryAlert, InventoryItemRecord } from '@/features/cce-inventory/lib/types';
import {
  fetchFacility,
  fetchMinimalFacilities,
  fetchProgramLookup,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { queryKeys } from '@/lib/key-factory';
import type { ProgramGrant } from '@/lib/permissions';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/cce-inventory/api/api', () => ({
  fetchInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  fetchInventoryAlerts: vi.fn(),
  dismissAlert: vi.fn(),
  transferInventoryItem: vi.fn(),
  fetchAlertHistory: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchFacility: vi.fn(),
  fetchProgramLookup: vi.fn(),
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchMinimalFacilities: vi.fn(),
}));
vi.mock('@/hooks/use-deployment-time-zone', () => ({ useDeploymentTimeZone: () => 'UTC' }));

const FRIDGE: InventoryItemRecord = {
  id: 'i1',
  facility: { id: 'f1' },
  program: { id: 'p1' },
  catalogItem: {
    id: 'c1',
    type: 'Refrigerator',
    manufacturer: 'B Medical',
    model: 'TCW 40R',
    energySource: 'ELECTRIC',
    netVolume: 38,
  },
  equipmentTrackingId: 'SN-1',
  referenceName: 'Fridge 2',
  utilization: 'ACTIVE',
  yearOfInstallation: 2019,
  voltageStabilizer: 'YES',
  voltageRegulator: 'NO',
  backupGenerator: 'NOT_APPLICABLE',
  manualTemperatureGauge: 'BUILD_IN',
  remoteTemperatureMonitor: 'NO_RTM',
  functionalStatus: 'AWAITING_REPAIR',
  reasonNotWorkingOrNotInUse: 'NEEDS_SPARE_PARTS',
};

const EDIT: ProgramGrant = { right: 'CCE_INVENTORY_EDIT', facilityId: 'f1', programId: 'p1' };

function renderView({
  action,
  grants = [EDIT],
  transferGrants = [],
}: {
  action?: ItemAction;
  grants?: ProgramGrant[];
  transferGrants?: ProgramGrant[];
} = {}) {
  const onAction = vi.fn();
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  renderPage(
    <InventoryItemView
      action={action}
      grants={grants}
      itemId="i1"
      onAction={onAction}
      onClose={onClose}
      transferGrants={transferGrants}
      userId="u1"
    />,
    { queryClient },
  );
  return { onAction, onClose, invalidate };
}

const rowLabels = () =>
  [...screen.getByRole('dialog').querySelectorAll('[data-slot=settings-list] > *')].map(
    (row) => row.querySelector('span')?.textContent,
  );

const ALERT: InventoryAlert = {
  alert_id: 'a1',
  device_id: 'i1',
  start_ts: '2026-11-01T10:00:00Z',
  end_ts: null,
  dismissed: false,
  status: { 'en-US': 'Too warm' },
};

beforeEach(() => {
  vi.mocked(fetchInventoryAlerts).mockReset().mockResolvedValue([ALERT]);
  vi.mocked(dismissAlert).mockResolvedValue();
  vi.mocked(transferInventoryItem).mockResolvedValue();
  vi.mocked(fetchUserRecord).mockResolvedValue({
    id: 'u1',
    username: 'divo1',
    firstName: 'Divo',
    lastName: 'One',
    active: true,
    homeFacilityId: 'f1',
    roleAssignments: [],
  });
  vi.mocked(fetchUserPrograms).mockResolvedValue([
    { id: 'p1', code: 'PRG004', name: 'EPI', active: true },
  ]);
  vi.mocked(fetchMinimalFacilities).mockResolvedValue([
    { id: 'f1', code: 'HC01', name: 'Comfort Health Clinic', active: true },
    { id: 'f2', code: 'HC02', name: 'Nandumbo Health Center', active: true },
  ]);
  vi.mocked(fetchInventoryItem).mockReset().mockResolvedValue(FRIDGE);
  vi.mocked(updateInventoryItem).mockResolvedValue();
  vi.mocked(fetchFacility).mockResolvedValue({
    id: 'f1',
    code: 'HC01',
    name: 'Comfort Health Clinic',
    active: true,
    enabled: true,
    type: { id: 't1', code: 'HC', name: 'Health Center' },
    geographicZone: {
      id: 'z1',
      code: 'Z1',
      name: 'Cuamba',
      level: { name: 'District' },
    },
  });
  vi.mocked(fetchProgramLookup).mockResolvedValue({
    id: 'p1',
    code: 'PRG004',
    name: 'EPI',
    active: true,
  });
});

describe('InventoryItemView', () => {
  it('shows the details in the legacy order, leaving out rows that are not set', async () => {
    renderView();

    expect(await screen.findByRole('heading', { name: 'Fridge 2' })).toBeInTheDocument();
    expect(screen.getByText('cce-equipment.reason.needs-spare-parts')).toBeInTheDocument();
    expect(rowLabels()).toEqual([
      'cce-inventory.details.district',
      'facility-program.facility',
      'facility-program.program',
      'cce-inventory.form.equipment-type',
      'cce-inventory.details.net-volume',
      'cce-inventory.make-model',
      'cce-inventory.form.serial-number',
      'cce-inventory.form.utilization',
      'cce-inventory.form.year-of-installation',
      'cce-inventory.form.voltage-stabilizer',
      'cce-inventory.form.backup-generator',
      'cce-inventory.form.voltage-regulator',
      'cce-inventory.form.manual-temperature-gauge',
      'cce-inventory.form.remote-temperature-monitor',
    ]);
    expect(screen.getByRole('button', { name: 'cce-inventory.details.edit' })).toBeInTheDocument();
  });

  it('offers Edit only to an editor of the item', async () => {
    renderView({ grants: [{ ...EDIT, facilityId: 'f2' }] });

    await screen.findByRole('heading', { name: 'Fridge 2' });
    expect(screen.queryByRole('button', { name: 'cce-inventory.details.edit' })).toBeNull();
  });

  it('saves the edited fields on a fresh copy and goes back to the details', async () => {
    const user = userEvent.setup();
    const fresh: InventoryItemRecord = { ...FRIDGE, functionalStatus: 'FUNCTIONING' };
    vi.mocked(fetchInventoryItem).mockResolvedValueOnce(FRIDGE).mockResolvedValueOnce(fresh);
    const { onAction, invalidate } = renderView({ action: 'edit' });

    const name = await screen.findByRole('textbox', { name: /^cce-inventory.reference-name/ });
    expect(name).toHaveValue('Fridge 2');
    await user.clear(name);
    await user.type(name, 'Fridge 3');
    await user.click(screen.getByRole('button', { name: 'cce-inventory.form.save' }));

    await waitFor(() => expect(onAction).toHaveBeenCalledWith(undefined));
    expect(updateInventoryItem).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateInventoryItem).mock.calls[0]?.[0]).toMatchObject({
      id: 'i1',
      referenceName: 'Fridge 3',
      functionalStatus: 'FUNCTIONING',
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.inventoryItems.all }),
      { throwOnError: true },
    );
  });

  it.each(['edit', 'status'] as const)(
    'closes after a saved %s whose refresh fails, without a save error to retry',
    async (action) => {
      const user = userEvent.setup();
      vi.mocked(fetchInventoryItem)
        .mockResolvedValueOnce(FRIDGE)
        .mockResolvedValueOnce(FRIDGE)
        .mockRejectedValueOnce(new Error('offline'));
      const { onClose, onAction } = renderView({ action });

      if (action === 'status') {
        await user.click(
          await screen.findByRole('combobox', { name: /cce-inventory.form.functional-status/ }),
        );
        await user.click(
          await screen.findByRole('option', { name: 'cce-equipment.status.functioning' }),
        );
      }
      await user.click(
        await screen.findByRole('button', {
          name: action === 'edit' ? 'cce-inventory.form.save' : 'cce-inventory.status.update',
        }),
      );

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(onAction).not.toHaveBeenCalled();
      expect(screen.queryByText('cce-inventory.form.save-error')).toBeNull();
      expect(updateInventoryItem).toHaveBeenCalledTimes(1);
    },
  );

  it('opens the details instead of the status form for a user who cannot edit the item', async () => {
    renderView({ action: 'status', grants: [{ ...EDIT, facilityId: 'f2' }] });

    expect(await screen.findByRole('heading', { name: 'Fridge 2' })).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /cce-inventory.form.functional-status/ }),
    ).toBeNull();
  });

  it('removes a dismissed alert even when the alerts cannot refresh', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchInventoryAlerts)
      .mockResolvedValueOnce([ALERT])
      .mockResolvedValueOnce([ALERT])
      .mockRejectedValue(new Error('offline'));
    renderView({ action: 'status' });

    await user.click(
      await screen.findByRole('button', { name: /cce-inventory.status.dismiss-label/ }),
    );

    expect(await screen.findByText('cce-inventory.status.no-alerts')).toBeInTheDocument();
    expect(screen.queryByText('Too warm')).toBeNull();
  });

  it('dismisses an alert, then updates the status of a fresh copy once the reason is chosen', async () => {
    const user = userEvent.setup();
    const fresh: InventoryItemRecord = { ...FRIDGE, equipmentTrackingId: 'SN-9' };
    vi.mocked(fetchInventoryItem)
      .mockResolvedValueOnce(FRIDGE)
      .mockResolvedValueOnce(FRIDGE)
      .mockResolvedValueOnce(fresh);
    const { onClose } = renderView({ action: 'status' });
    const choose = async (field: RegExp, option: string) => {
      await user.click(screen.getByRole('combobox', { name: field }));
      await user.click(await screen.findByRole('option', { name: option }));
    };

    expect(await screen.findByText('Too warm')).toBeInTheDocument();
    expect(rowLabels()).toEqual([
      'facility-program.facility',
      'cce-inventory.form.equipment-type',
      'cce-inventory.status.current',
    ]);
    await user.click(
      screen.getByRole('combobox', { name: /cce-inventory.form.functional-status/ }),
    );
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'cce-equipment.status.functioning',
      'cce-equipment.status.needs-attention',
      'cce-equipment.status.awaiting-repair',
      'cce-equipment.status.unserviceable',
    ]);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /cce-inventory.status.dismiss-label/ }));
    await waitFor(() => expect(dismissAlert).toHaveBeenCalledWith(ALERT, expect.anything()));
    await choose(/cce-inventory.form.functional-status/, 'cce-equipment.status.unserviceable');
    await choose(/cce-inventory.form.functional-status/, 'cce-equipment.status.awaiting-repair');
    const update = screen.getByRole('button', { name: 'cce-inventory.status.update' });
    expect(update).toBeDisabled();
    expect(screen.queryByText('cce-inventory.form.required')).toBeNull();
    await choose(/cce-inventory.form.reason/, 'cce-equipment.reason.dead');
    await user.click(update);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(updateInventoryItem).mock.calls[0]?.[0]).toMatchObject({
      id: 'i1',
      equipmentTrackingId: 'SN-9',
      yearOfInstallation: 2019,
      remoteTemperatureMonitor: 'NO_RTM',
      functionalStatus: 'AWAITING_REPAIR',
      reasonNotWorkingOrNotInUse: 'DEAD',
    });
  });

  it('closes after the status update even when the alerts cannot load', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchInventoryAlerts).mockRejectedValue(new Error('offline'));
    const { onClose } = renderView({ action: 'status' });

    await user.click(
      await screen.findByRole('combobox', { name: /cce-inventory.form.functional-status/ }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'cce-equipment.status.functioning' }),
    );
    expect(screen.getByText('cce-inventory.status.alerts-error-title')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'cce-inventory.status.update' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the details instead of transfer to a user who may transfer elsewhere only', async () => {
    renderView({
      action: 'transfer',
      transferGrants: [{ right: 'CCE_INVENTORY_TRANSFER', facilityId: 'f2', programId: 'p1' }],
    });

    expect(await screen.findByRole('heading', { name: 'Fridge 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'cce-inventory.transfer.open' })).toBeNull();
  });

  it('transfers the item to a facility the user may transfer to', async () => {
    const user = userEvent.setup();
    const transfer = (facilityId: string): ProgramGrant => ({
      right: 'CCE_INVENTORY_TRANSFER',
      facilityId,
      programId: 'p1',
    });
    const { onClose } = renderView({
      action: 'transfer',
      transferGrants: [transfer('f1'), transfer('f2')],
    });

    await user.click(await screen.findByRole('combobox', { name: /facility-program.facility/ }));
    await user.click(await screen.findByRole('option', { name: /Nandumbo Health Center/ }));
    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    await user.click(await screen.findByRole('option', { name: 'EPI' }));
    await user.click(screen.getByRole('button', { name: 'cce-inventory.status.update' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(transferInventoryItem).toHaveBeenCalledWith('i1', {
      programId: 'p1',
      facilityId: 'f2',
      yearOfInstallation: 2019,
    });
  });
});
