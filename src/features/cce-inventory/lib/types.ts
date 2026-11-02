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
