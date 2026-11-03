import { describe, expect, it } from 'vitest';
import {
  EMPTY_INVENTORY_ITEM_DETAILS,
  hasFixedPower,
  type InventoryItemDetails,
  inventoryItemDetailsSchema,
  toInventoryItemBody,
  type ValidInventoryItemDetails,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type { CatalogItem, EnergySource } from '@/features/cce-inventory/lib/types';
import type { EquipmentStatus } from '@/lib/cce-equipment-status';

const catalogItem: CatalogItem = {
  id: 'c1',
  fromPqsCatalog: true,
  equipmentCode: 'E003/090',
  type: 'Refrigerator',
  model: 'TCW 40R',
  manufacturer: 'B Medical',
  energySource: 'ELECTRIC',
  storageTemperature: 'PLUS4',
  archived: false,
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
  it('takes a filled-in form', () => {
    expect(issues(filled)).toEqual([]);
  });

  it('asks for every field legacy marks as required', () => {
    expect(issues(EMPTY_INVENTORY_ITEM_DETAILS)).toEqual(
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
        'functionalStatus: cce-inventory.form.required',
      ]),
    );
  });

  it('treats a serial number or reference name of only spaces as empty', () => {
    expect(issues({ ...filled, equipmentTrackingId: '  ', referenceName: ' ' })).toEqual([
      'equipmentTrackingId: cce-inventory.form.required',
      'referenceName: cce-inventory.form.required',
    ]);
  });

  it.each([
    ['999', 'cce-inventory.form.year-range'],
    ['10000', 'cce-inventory.form.year-range'],
    ['1500.5', 'cce-inventory.form.year-range'],
  ])('refuses %s as a year', (year, message) => {
    expect(issues({ ...filled, yearOfInstallation: year, yearOfWarrantyExpiry: year })).toEqual([
      `yearOfInstallation: ${message}`,
      `yearOfWarrantyExpiry: ${message}`,
    ]);
  });

  it('takes the bounds of the year range and Arabic digits', () => {
    expect(issues({ ...filled, yearOfInstallation: '1000', yearOfWarrantyExpiry: '٩٩٩٩' })).toEqual(
      [],
    );
  });

  const statusRules: [EquipmentStatus, string[]][] = [
    ['AWAITING_REPAIR', ['reasonNotWorkingOrNotInUse: cce-inventory.form.required']],
    [
      'UNSERVICEABLE',
      [
        'reasonNotWorkingOrNotInUse: cce-inventory.form.required',
        'decommissionDate: cce-inventory.form.required',
      ],
    ],
    ['NEEDS_ATTENTION', []],
  ];

  it.each(statusRules)('asks %s for what legacy asks with it', (functionalStatus, expected) => {
    expect(issues({ ...filled, functionalStatus })).toEqual(sorted(expected));
  });
});

describe('hasFixedPower', () => {
  const energyRules: [EnergySource, boolean][] = [
    ['SOLAR', true],
    ['NOT_APPLICABLE', true],
    ['ELECTRIC', false],
  ];

  it.each(energyRules)(
    'tells whether %s equipment has fixed power fields',
    (energySource, expected) => {
      expect(hasFixedPower(energySource)).toBe(expected);
    },
  );
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
        },
        pair,
        catalogItem,
      ),
    ).toMatchObject({
      source: 'Ministry',
      yearOfWarrantyExpiry: 2026,
      additionalNotes: 'Spare key',
    });
  });

  it('sends not applicable power fields for equipment without mains power', () => {
    expect(
      toInventoryItemBody(filled, pair, { ...catalogItem, energySource: 'SOLAR' }),
    ).toMatchObject({
      voltageStabilizer: 'NOT_APPLICABLE',
      voltageRegulator: 'NOT_APPLICABLE',
      backupGenerator: 'NOT_APPLICABLE',
    });
  });

  it('sends the reason and the decommission date only with the statuses that use them', () => {
    const unserviceable: ValidInventoryItemDetails = {
      ...filled,
      functionalStatus: 'UNSERVICEABLE',
      reasonNotWorkingOrNotInUse: 'DEAD',
      decommissionDate: '2026-10-01',
    };

    expect(toInventoryItemBody(unserviceable, pair, catalogItem)).toMatchObject({
      reasonNotWorkingOrNotInUse: 'DEAD',
      decommissionDate: '2026-10-01',
    });
    const awaiting = toInventoryItemBody(
      { ...unserviceable, functionalStatus: 'AWAITING_REPAIR' },
      pair,
      catalogItem,
    );
    expect(awaiting).toMatchObject({ reasonNotWorkingOrNotInUse: 'DEAD' });
    expect(awaiting).not.toHaveProperty('decommissionDate');
    const functioning = toInventoryItemBody(
      { ...unserviceable, functionalStatus: 'FUNCTIONING' },
      pair,
      catalogItem,
    );
    expect(functioning).not.toHaveProperty('reasonNotWorkingOrNotInUse');
    expect(functioning).not.toHaveProperty('decommissionDate');
  });
});
