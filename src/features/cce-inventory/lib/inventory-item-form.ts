import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type {
  CatalogItem,
  EnergySource,
  InventoryItemBody,
  InventoryItemRecord,
  InventoryItemUpdate,
  PowerStatus,
  TemperatureGauge,
  TemperatureMonitor,
  Utilization,
} from '@/features/cce-inventory/lib/types';
import {
  EQUIPMENT_STATUSES,
  type EquipmentReason,
  type EquipmentStatus,
} from '@/lib/cce-equipment-status';
import type { SelectionMode } from '@/lib/facility-program-selection';
import { toOptionalWholeNumber, toWholeNumber, wholeNumberText } from '@/lib/whole-number';

const REQUIRED: ParseKeys = 'cce-inventory.form.required';
const YEAR_RANGE: ParseKeys = 'cce-inventory.form.year-range';
const PROGRAM_REQUIRED: ParseKeys = 'facility-program.program-required';
const FACILITY_REQUIRED: ParseKeys = 'facility-program.facility-required';

export const EQUIPMENT_REASONS: readonly [EquipmentReason, ...EquipmentReason[]] = [
  'NEEDS_SPARE_PARTS',
  'NO_FINANCE',
  'NO_FUEL',
  'SURPLUS',
  'DEAD',
  'NOT_IN_USE',
  'DECOMMISSIONED',
];

export const UTILIZATIONS: readonly [Utilization, ...Utilization[]] = [
  'ACTIVE',
  'NOT_IN_USE',
  'IN_STORE_FOR_ALLOCATION',
];

export const POWER_STATUSES: readonly [PowerStatus, ...PowerStatus[]] = [
  'YES',
  'NO',
  'UNKNOWN',
  'NOT_APPLICABLE',
];

export const TEMPERATURE_GAUGES: readonly [TemperatureGauge, ...TemperatureGauge[]] = [
  'BUILD_IN',
  'PAIRED',
  'NO_GAUGE',
];

export const TEMPERATURE_MONITORS: readonly [TemperatureMonitor, ...TemperatureMonitor[]] = [
  'BUILD_IN',
  'PAIRED',
  'NO_RTM',
];

export const statusUsesReason = (status: EquipmentStatus | '') =>
  status === 'AWAITING_REPAIR' || status === 'UNSERVICEABLE';

export const statusUsesDecommission = (status: EquipmentStatus | '') => status === 'UNSERVICEABLE';

const ALONG_WITH_OTHER_ISSUES = { when: () => true };

const optionalChoice = <T extends string>(values: readonly [T, ...T[]]) =>
  z.union([z.enum(values), z.literal('')]);

const choice = <T extends string>(values: readonly [T, ...T[]]) =>
  optionalChoice(values).pipe(z.enum(values, { error: REQUIRED }));

const filledText = z.string().refine((value) => value.trim() !== '', REQUIRED);

const year = (optional: boolean) =>
  wholeNumberText(
    { required: REQUIRED, invalid: YEAR_RANGE, tooLarge: YEAR_RANGE },
    { min: { value: 1000, tooSmall: YEAR_RANGE }, max: 9999, optional },
  );

function requireStatusDetails(
  details: {
    functionalStatus: EquipmentStatus;
    reasonNotWorkingOrNotInUse: EquipmentReason | '';
    decommissionDate: string;
  },
  context: z.RefinementCtx,
) {
  if (statusUsesReason(details.functionalStatus) && !details.reasonNotWorkingOrNotInUse) {
    context.addIssue({ code: 'custom', message: REQUIRED, path: ['reasonNotWorkingOrNotInUse'] });
  }
  if (statusUsesDecommission(details.functionalStatus) && !details.decommissionDate) {
    context.addIssue({ code: 'custom', message: REQUIRED, path: ['decommissionDate'] });
  }
}

export const statusSchema = z
  .object({
    functionalStatus: choice(EQUIPMENT_STATUSES),
    reasonNotWorkingOrNotInUse: optionalChoice(EQUIPMENT_REASONS),
    decommissionDate: z.string(),
  })
  .superRefine(requireStatusDetails, ALONG_WITH_OTHER_ISSUES);

export type StatusValues = z.input<typeof statusSchema>;

export const inventoryItemDetailsSchema = z
  .object({
    equipmentTrackingId: filledText,
    referenceName: filledText,
    utilization: choice(UTILIZATIONS),
    yearOfInstallation: year(false),
    source: z.string(),
    yearOfWarrantyExpiry: year(true),
    voltageStabilizer: choice(POWER_STATUSES),
    voltageRegulator: choice(POWER_STATUSES),
    backupGenerator: choice(POWER_STATUSES),
    manualTemperatureGauge: choice(TEMPERATURE_GAUGES),
    remoteTemperatureMonitor: choice(TEMPERATURE_MONITORS),
    additionalNotes: z.string(),
    functionalStatus: choice(EQUIPMENT_STATUSES),
    reasonNotWorkingOrNotInUse: optionalChoice(EQUIPMENT_REASONS),
    decommissionDate: z.string(),
  })
  .superRefine(requireStatusDetails, ALONG_WITH_OTHER_ISSUES);

export type InventoryItemDetails = z.input<typeof inventoryItemDetailsSchema>;

export type ValidInventoryItemDetails = z.output<typeof inventoryItemDetailsSchema>;

export const EMPTY_INVENTORY_ITEM_DETAILS: InventoryItemDetails = {
  equipmentTrackingId: '',
  referenceName: '',
  utilization: '',
  yearOfInstallation: '',
  source: '',
  yearOfWarrantyExpiry: '',
  voltageStabilizer: '',
  voltageRegulator: '',
  backupGenerator: '',
  manualTemperatureGauge: '',
  remoteTemperatureMonitor: '',
  additionalNotes: '',
  functionalStatus: '',
  reasonNotWorkingOrNotInUse: '',
  decommissionDate: '',
};

export type InventoryItemValues = {
  pair: { mode: SelectionMode; programId: string | null; facilityId: string | null };
  equipmentType: string | null;
  catalogItemId: string | null;
  details: InventoryItemDetails;
};

const picked = (message: ParseKeys) => z.string({ error: message }).min(1, message);

export const inventoryItemSchema = z
  .object({
    pair: z.object({
      mode: z.enum(['my', 'supervised']),
      programId: picked(PROGRAM_REQUIRED),
      facilityId: picked(FACILITY_REQUIRED),
    }),
    equipmentType: picked(REQUIRED),
    catalogItemId: z.string().nullable(),
    details: inventoryItemDetailsSchema,
  })
  .superRefine((values, context) => {
    if (values.equipmentType && !values.catalogItemId) {
      context.addIssue({ code: 'custom', message: REQUIRED, path: ['catalogItemId'] });
    }
  }, ALONG_WITH_OTHER_ISSUES);

const hasFixedPower = (energySource: EnergySource) =>
  energySource === 'SOLAR' || energySource === 'NOT_APPLICABLE';

export const solarPower = (energySource: EnergySource, value: PowerStatus): PowerStatus =>
  energySource === 'SOLAR' ? 'NOT_APPLICABLE' : value;

export const hasFixedPowerModel = (catalog: readonly CatalogItem[], id: string | null) =>
  catalog.some((item) => item.id === id && hasFixedPower(item.energySource));

export const powerFor = (catalog: readonly CatalogItem[], id: string | null): PowerStatus | '' =>
  hasFixedPowerModel(catalog, id) ? 'NOT_APPLICABLE' : '';

export type PowerField =
  | 'details.voltageStabilizer'
  | 'details.voltageRegulator'
  | 'details.backupGenerator';

export const POWER_FIELDS: readonly PowerField[] = [
  'details.voltageStabilizer',
  'details.voltageRegulator',
  'details.backupGenerator',
];

const optionalText = (value: string) => {
  const text = value.trim();
  return text ? text : undefined;
};

export function toInventoryItemBody(
  details: ValidInventoryItemDetails,
  { facilityId, programId }: { facilityId: string; programId: string },
  catalogItem: CatalogItem,
): InventoryItemBody {
  const power = (value: PowerStatus) => solarPower(catalogItem.energySource, value);
  const source = optionalText(details.source);
  const additionalNotes = optionalText(details.additionalNotes);
  const yearOfWarrantyExpiry = toOptionalWholeNumber(details.yearOfWarrantyExpiry);
  const { reasonNotWorkingOrNotInUse, decommissionDate } = details;
  return {
    facility: { id: facilityId },
    program: { id: programId },
    catalogItem,
    equipmentTrackingId: details.equipmentTrackingId.trim(),
    referenceName: details.referenceName.trim(),
    utilization: details.utilization,
    yearOfInstallation: toWholeNumber(details.yearOfInstallation),
    ...(yearOfWarrantyExpiry !== null && { yearOfWarrantyExpiry }),
    ...(source && { source }),
    voltageStabilizer: power(details.voltageStabilizer),
    voltageRegulator: power(details.voltageRegulator),
    backupGenerator: power(details.backupGenerator),
    manualTemperatureGauge: details.manualTemperatureGauge,
    remoteTemperatureMonitor: details.remoteTemperatureMonitor,
    ...(additionalNotes && { additionalNotes }),
    functionalStatus: details.functionalStatus,
    ...(reasonNotWorkingOrNotInUse && { reasonNotWorkingOrNotInUse }),
    ...(decommissionDate && { decommissionDate }),
  };
}

export function toEditValues(record: InventoryItemRecord): InventoryItemValues {
  const power = (value: PowerStatus) => solarPower(record.catalogItem.energySource, value);
  return {
    pair: { mode: 'supervised', programId: record.program.id, facilityId: record.facility.id },
    equipmentType: record.catalogItem.type,
    catalogItemId: record.catalogItem.id,
    details: {
      ...EMPTY_INVENTORY_ITEM_DETAILS,
      functionalStatus: 'FUNCTIONING',
      equipmentTrackingId: record.equipmentTrackingId ?? '',
      referenceName: record.referenceName,
      utilization: record.utilization,
      yearOfInstallation: String(record.yearOfInstallation),
      source: record.source ?? '',
      yearOfWarrantyExpiry: record.yearOfWarrantyExpiry?.toString() ?? '',
      voltageStabilizer: power(record.voltageStabilizer),
      voltageRegulator: power(record.voltageRegulator),
      backupGenerator: power(record.backupGenerator),
      manualTemperatureGauge: record.manualTemperatureGauge,
      remoteTemperatureMonitor: record.remoteTemperatureMonitor,
      additionalNotes: record.additionalNotes ?? '',
    },
  };
}

export function toInventoryItemUpdate(
  record: InventoryItemRecord,
  details: ValidInventoryItemDetails,
): InventoryItemUpdate {
  const { functionalStatus, reasonNotWorkingOrNotInUse, decommissionDate } = record;
  const { remoteTemperatureMonitorId } = record;
  return {
    ...toInventoryItemBody(
      details,
      { facilityId: record.facility.id, programId: record.program.id },
      record.catalogItem,
    ),
    id: record.id,
    functionalStatus,
    ...(reasonNotWorkingOrNotInUse && { reasonNotWorkingOrNotInUse }),
    ...(decommissionDate && { decommissionDate }),
    ...(remoteTemperatureMonitorId && { remoteTemperatureMonitorId }),
  };
}

export function toStatusUpdate(
  record: InventoryItemRecord,
  { functionalStatus, reasonNotWorkingOrNotInUse, decommissionDate }: z.output<typeof statusSchema>,
): InventoryItemRecord {
  const power = (value: PowerStatus) => solarPower(record.catalogItem.energySource, value);
  return {
    ...record,
    voltageStabilizer: power(record.voltageStabilizer),
    voltageRegulator: power(record.voltageRegulator),
    backupGenerator: power(record.backupGenerator),
    functionalStatus,
    reasonNotWorkingOrNotInUse: statusUsesReason(functionalStatus)
      ? reasonNotWorkingOrNotInUse || undefined
      : undefined,
    decommissionDate: statusUsesDecommission(functionalStatus) ? decommissionDate : undefined,
  };
}

export const transferSchema = z.object({
  programId: picked(PROGRAM_REQUIRED),
  facilityId: picked(FACILITY_REQUIRED),
  yearOfInstallation: year(false),
});

export type TransferValues = {
  programId: string | null;
  facilityId: string | null;
  yearOfInstallation: string;
};
