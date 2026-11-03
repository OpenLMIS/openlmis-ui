import type { EquipmentReason, EquipmentStatus } from '@/lib/cce-equipment-status';

export type InventoryItem = {
  id: string;
  equipmentTrackingId?: string;
  referenceName: string;
  catalogItem: { manufacturer: string; model: string; type: string };
  functionalStatus: EquipmentStatus;
  reasonNotWorkingOrNotInUse?: EquipmentReason;
  yearOfInstallation: number;
  modifiedDate?: string;
  lastModifier?: { firstName?: string; lastName?: string };
};

export type InventoryAlert = {
  alert_id: string;
  device_id: string;
  start_ts: string;
  end_ts: string | null;
  dismissed: boolean;
  status: Record<string, string>;
};

export type InventoryQuery = {
  facilityId: string;
  programId: string;
  page: number;
  size: number;
  sort?: string[];
  functionalStatus?: EquipmentStatus;
};

export type EnergySource = 'ELECTRIC' | 'SOLAR' | 'GASOLINE' | 'NOT_APPLICABLE';

export type StorageTemperature =
  | 'PLUS4'
  | 'PLUS3'
  | 'PLUS2'
  | 'PLUS1'
  | 'ZERO'
  | 'MINUS1'
  | 'MINUS2'
  | 'MINUS3'
  | 'MINUS4'
  | 'MINUS5'
  | 'MINUS6'
  | 'MINUS7'
  | 'MINUS8'
  | 'MINUS9'
  | 'MINUS10'
  | 'MINUS11'
  | 'MINUS12'
  | 'MINUS13'
  | 'MINUS14'
  | 'MINUS15'
  | 'MINUS16'
  | 'MINUS17'
  | 'MINUS18'
  | 'MINUS19'
  | 'MINUS20';

export type CatalogItem = {
  id: string;
  fromPqsCatalog: boolean;
  equipmentCode?: string;
  type: string;
  model: string;
  manufacturer: string;
  energySource: EnergySource;
  dateOfPrequal?: number;
  storageTemperature: StorageTemperature;
  maxOperatingTemp?: number;
  minOperatingTemp?: number;
  energyConsumption?: string;
  holdoverTime?: number;
  grossVolume?: number;
  netVolume?: number;
  dimensions?: { width: number; depth: number; height: number };
  visibleInCatalog?: boolean;
  archived: boolean;
};

export type Utilization = 'ACTIVE' | 'NOT_IN_USE' | 'IN_STORE_FOR_ALLOCATION';

export type PowerStatus = 'YES' | 'NO' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type TemperatureGauge = 'BUILD_IN' | 'PAIRED' | 'NO_GAUGE';

export type TemperatureMonitor = 'BUILD_IN' | 'PAIRED' | 'NO_RTM';

export type InventoryItemBody = {
  facility: { id: string };
  program: { id: string };
  catalogItem: CatalogItem;
  equipmentTrackingId: string;
  referenceName: string;
  utilization: Utilization;
  yearOfInstallation: number;
  yearOfWarrantyExpiry?: number;
  source?: string;
  voltageStabilizer: PowerStatus;
  voltageRegulator: PowerStatus;
  backupGenerator: PowerStatus;
  manualTemperatureGauge: TemperatureGauge;
  remoteTemperatureMonitor: TemperatureMonitor;
  additionalNotes?: string;
  functionalStatus: EquipmentStatus;
  reasonNotWorkingOrNotInUse?: EquipmentReason;
  decommissionDate?: string;
};
