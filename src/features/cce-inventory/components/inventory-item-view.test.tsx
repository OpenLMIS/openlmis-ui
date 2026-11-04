import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInventoryItem, updateInventoryItem } from '@/features/cce-inventory/api/api';
import { InventoryItemView } from '@/features/cce-inventory/components/inventory-item-view';
import type { InventoryItemRecord } from '@/features/cce-inventory/lib/types';
import { fetchFacility, fetchProgramLookup } from '@/features/reference-data/api/api';
import { queryKeys } from '@/lib/key-factory';
import type { ProgramGrant } from '@/lib/permissions';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/cce-inventory/api/api', () => ({
  fetchInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchFacility: vi.fn(),
  fetchProgramLookup: vi.fn(),
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

function renderView({ editing = false, grants = [EDIT] } = {}) {
  const onEditing = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  renderPage(
    <InventoryItemView
      editing={editing}
      grants={grants}
      itemId="i1"
      onClose={vi.fn()}
      onEditing={onEditing}
    />,
    { queryClient },
  );
  return { onEditing, invalidate };
}

const rowLabels = () =>
  [...screen.getByRole('dialog').querySelectorAll('[data-slot=settings-list] > *')].map(
    (row) => row.querySelector('span')?.textContent,
  );

beforeEach(() => {
  vi.mocked(fetchInventoryItem).mockResolvedValue(FRIDGE);
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
    const { onEditing, invalidate } = renderView({ editing: true });

    const name = await screen.findByRole('textbox', { name: /^cce-inventory.reference-name/ });
    expect(name).toHaveValue('Fridge 2');
    await user.clear(name);
    await user.type(name, 'Fridge 3');
    await user.click(screen.getByRole('button', { name: 'cce-inventory.form.save' }));

    await waitFor(() => expect(onEditing).toHaveBeenCalledWith(false));
    expect(updateInventoryItem).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateInventoryItem).mock.calls[0]?.[0]).toMatchObject({
      id: 'i1',
      referenceName: 'Fridge 3',
      functionalStatus: 'FUNCTIONING',
    });
    expect(invalidate).toHaveBeenCalledWith(
      { queryKey: queryKeys.inventoryItems.all },
      { throwOnError: true },
    );
  });

  it('stays in edit with the save error when the refresh after the save fails', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchInventoryItem)
      .mockResolvedValueOnce(FRIDGE)
      .mockResolvedValueOnce(FRIDGE)
      .mockRejectedValueOnce(new Error('offline'));
    const { onEditing } = renderView({ editing: true });

    await user.click(await screen.findByRole('button', { name: 'cce-inventory.form.save' }));

    expect(await screen.findByText('cce-inventory.form.save-error')).toBeInTheDocument();
    expect(onEditing).not.toHaveBeenCalled();
  });
});
