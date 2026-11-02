import { CircleCheckIcon, CircleXIcon, TriangleAlertIcon, WrenchIcon } from 'lucide-react';

export const EQUIPMENT_STATUSES = [
  'FUNCTIONING',
  'NEEDS_ATTENTION',
  'AWAITING_REPAIR',
  'UNSERVICEABLE',
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

/** Status colours carry good-to-critical meaning, so each also has its own icon and label. */
export const EQUIPMENT_STATUS = {
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
} as const;
