import type { ParseKeys } from 'i18next';
import {
  CircleCheckIcon,
  CircleXIcon,
  type LucideIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from 'lucide-react';

export type EquipmentStatus =
  | 'FUNCTIONING'
  | 'NEEDS_ATTENTION'
  | 'AWAITING_REPAIR'
  | 'UNSERVICEABLE';

export const EQUIPMENT_STATUSES: readonly [EquipmentStatus, ...EquipmentStatus[]] = [
  'FUNCTIONING',
  'NEEDS_ATTENTION',
  'AWAITING_REPAIR',
  'UNSERVICEABLE',
];

export type EquipmentTone = 'success' | 'warning' | 'destructive';

type EquipmentStatusStyle = {
  labelKey: ParseKeys;
  tone: EquipmentTone;
  icon: LucideIcon;
};

export const EQUIPMENT_STATUS: Record<EquipmentStatus, EquipmentStatusStyle> = {
  FUNCTIONING: {
    labelKey: 'cce-equipment.status.functioning',
    tone: 'success',
    icon: CircleCheckIcon,
  },
  NEEDS_ATTENTION: {
    labelKey: 'cce-equipment.status.needs-attention',
    tone: 'warning',
    icon: TriangleAlertIcon,
  },
  AWAITING_REPAIR: {
    labelKey: 'cce-equipment.status.awaiting-repair',
    tone: 'warning',
    icon: WrenchIcon,
  },
  UNSERVICEABLE: {
    labelKey: 'cce-equipment.status.unserviceable',
    tone: 'destructive',
    icon: CircleXIcon,
  },
};

export type EquipmentReason =
  | 'NEEDS_SPARE_PARTS'
  | 'NO_FINANCE'
  | 'NO_FUEL'
  | 'SURPLUS'
  | 'DEAD'
  | 'NOT_IN_USE'
  | 'DECOMMISSIONED';

export const EQUIPMENT_REASON_KEYS: Record<EquipmentReason, ParseKeys> = {
  NEEDS_SPARE_PARTS: 'cce-equipment.reason.needs-spare-parts',
  NO_FINANCE: 'cce-equipment.reason.no-finance',
  NO_FUEL: 'cce-equipment.reason.no-fuel',
  SURPLUS: 'cce-equipment.reason.surplus',
  DEAD: 'cce-equipment.reason.dead',
  NOT_IN_USE: 'cce-equipment.reason.not-in-use',
  DECOMMISSIONED: 'cce-equipment.reason.decommissioned',
};
