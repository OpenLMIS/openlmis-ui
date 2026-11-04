import { describe, expect, it } from 'vitest';
import {
  EMPTY_INVENTORY_ITEM_DETAILS,
  type InventoryItemDetails,
  inventoryItemDetailsSchema,
  inventoryItemSchema,
  toEditValues,
  toInventoryItemBody,
  toInventoryItemUpdate,
  type ValidInventoryItemDetails,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type { CatalogItem, InventoryItemRecord } from '@/features/cce-inventory/lib/types';
import type { EquipmentStatus } from '@/lib/cce-equipment-status';

const catalogItem: CatalogItem = {
  id: 'c1',
  type: 'Refrigerator',
  model: 'TCW 40R',
  manufacturer: 'B Medical',
  energySource: 'ELECTRIC',
};

const filled: ValidInventoryItemDetails = {
  equipmentTrackingId: ' SN-1 ',
  referenceName: ' Fridge 2 ',
  utilization: 'ACTIVE',
  yearOfInstallation: '2019',
  source: '',
  yearOfWarrantyExpiry: '',
  voltageStabilizer: 'YES',
  voltageRegulator: 'NO',
  backupGenerator: 'UNKNOWN',
  manualTemperatureGauge: 'BUILD_IN',
  remoteTemperatureMonitor: 'NO_RTM',
  additionalNotes: '',
  functionalStatus: 'FUNCTIONING',
  reasonNotWorkingOrNotInUse: '',
  decommissionDate: '',
};

const issues = (values: InventoryItemDetails) => {
  const result = inventoryItemDetailsSchema.safeParse(values);
  return (
    result.error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) ?? []
  ).toSorted();
};

const sorted = (list: string[]) => list.toSorted();

describe('inventoryItemDetailsSchema', () => {
  it('asks for every field legacy marks as required, the status ones along with the rest', () => {
    expect(issues({ ...EMPTY_INVENTORY_ITEM_DETAILS, functionalStatus: 'UNSERVICEABLE' })).toEqual(
      sorted([
        'equipmentTrackingId: cce-inventory.form.required',
        'referenceName: cce-inventory.form.required',
        'utilization: cce-inventory.form.required',
        'yearOfInstallation: cce-inventory.form.required',
        'voltageStabilizer: cce-inventory.form.required',
        'voltageRegulator: cce-inventory.form.required',
        'backupGenerator: cce-inventory.form.required',
        'manualTemperatureGauge: cce-inventory.form.required',
        'remoteTemperatureMonitor: cce-inventory.form.required',
        'reasonNotWorkingOrNotInUse: cce-inventory.form.required',
        'decommissionDate: cce-inventory.form.required',
      ]),
    );
  });

  it('treats a serial number or reference name of only spaces as empty', () => {
    expect(issues({ ...filled, equipmentTrackingId: '  ', referenceName: ' ' })).toEqual([
      'equipmentTrackingId: cce-inventory.form.required',
      'referenceName: cce-inventory.form.required',
    ]);
  });

  it.each(['999', '10000', '1500.5'])('refuses %s as a year', (year) => {
    expect(issues({ ...filled, yearOfInstallation: year, yearOfWarrantyExpiry: year })).toEqual([
      'yearOfInstallation: cce-inventory.form.year-range',
      'yearOfWarrantyExpiry: cce-inventory.form.year-range',
    ]);
  });

  it('takes the bounds of the year range and Arabic digits', () => {
    expect(issues({ ...filled, yearOfInstallation: '1000', yearOfWarrantyExpiry: '٩٩٩٩' })).toEqual(
      [],
    );
  });

  const statusRules: [EquipmentStatus, string[]][] = [
    ['AWAITING_REPAIR', ['reasonNotWorkingOrNotInUse: cce-inventory.form.required']],
    ['NEEDS_ATTENTION', []],
  ];

  it.each(statusRules)('asks %s for what legacy asks with it', (functionalStatus, expected) => {
    expect(issues({ ...filled, functionalStatus })).toEqual(expected);
  });
});

describe('inventoryItemSchema', () => {
  it('asks for the model of a chosen type along with the other empty fields', () => {
    const result = inventoryItemSchema.safeParse({
      pair: { mode: 'my', programId: 'p1', facilityId: 'f1' },
      equipmentType: 'Refrigerator',
      catalogItemId: null,
      details: EMPTY_INVENTORY_ITEM_DETAILS,
    });

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('catalogItemId');
  });
});

describe('toInventoryItemBody', () => {
  const pair = { facilityId: 'f1', programId: 'p1' };

  it('sends the whole catalog item, trimmed texts, numbers and no empty optional field', () => {
    expect(toInventoryItemBody(filled, pair, catalogItem)).toEqual({
      facility: { id: 'f1' },
      program: { id: 'p1' },
      catalogItem,
      equipmentTrackingId: 'SN-1',
      referenceName: 'Fridge 2',
      utilization: 'ACTIVE',
      yearOfInstallation: 2019,
      voltageStabilizer: 'YES',
      voltageRegulator: 'NO',
      backupGenerator: 'UNKNOWN',
      manualTemperatureGauge: 'BUILD_IN',
      remoteTemperatureMonitor: 'NO_RTM',
      functionalStatus: 'FUNCTIONING',
    });
  });

  it('keeps the optional fields that were filled in', () => {
    expect(
      toInventoryItemBody(
        {
          ...filled,
          source: ' Ministry ',
          yearOfWarrantyExpiry: '٢٠٢٦',
          additionalNotes: ' Spare key ',
          functionalStatus: 'UNSERVICEABLE',
          reasonNotWorkingOrNotInUse: 'DEAD',
          decommissionDate: '2026-10-01',
        },
        pair,
        catalogItem,
      ),
    ).toMatchObject({
      source: 'Ministry',
      yearOfWarrantyExpiry: 2026,
      additionalNotes: 'Spare key',
      reasonNotWorkingOrNotInUse: 'DEAD',
      decommissionDate: '2026-10-01',
    });
  });
});

describe('editing a saved item', () => {
  const record: InventoryItemRecord = {
    id: 'i1',
    facility: { id: 'f1' },
    program: { id: 'p1' },
    catalogItem,
    equipmentTrackingId: 'SN-1',
    referenceName: 'Fridge 2',
    utilization: 'ACTIVE',
    yearOfInstallation: 2019,
    yearOfWarrantyExpiry: 2030,
    source: 'Ministry',
    voltageStabilizer: 'YES',
    voltageRegulator: 'NO',
    backupGenerator: 'UNKNOWN',
    manualTemperatureGauge: 'BUILD_IN',
    remoteTemperatureMonitor: 'PAIRED',
    remoteTemperatureMonitorId: 'rtm-1',
    additionalNotes: 'Spare key',
    functionalStatus: 'UNSERVICEABLE',
    reasonNotWorkingOrNotInUse: 'DEAD',
    decommissionDate: '2026-10-01',
  };

  it('saves an unedited item back as it was read', () => {
    const { details } = inventoryItemSchema.parse(toEditValues(record));

    expect(toInventoryItemUpdate(record, details)).toEqual(record);
  });

  it('shows and saves not applicable power for solar equipment only, as legacy', () => {
    const solar: InventoryItemRecord = {
      ...record,
      catalogItem: { ...catalogItem, energySource: 'SOLAR' },
    };
    const notApplicable: InventoryItemRecord = {
      ...record,
      catalogItem: { ...catalogItem, energySource: 'NOT_APPLICABLE' },
    };

    expect(toEditValues(solar).details.voltageStabilizer).toBe('NOT_APPLICABLE');
    expect(toEditValues(notApplicable).details.voltageStabilizer).toBe('YES');
  });
});
