import { useSuspenseQuery } from '@tanstack/react-query';
import {
  CircleCheckIcon,
  CircleXIcon,
  type LucideIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { EQUIPMENT_STATUSES } from '@/features/home/api/api';
import { equipmentStatusCountsOptions } from '@/features/home/api/queries';
import {
  CountBadge,
  DashboardCard,
  useFormatNumber,
} from '@/features/home/components/dashboard-parts';
import { PENDING } from '@/features/home/components/dashboard-skeleton';
import { sum } from '@/features/home/lib/sum';
import type { EquipmentStatus } from '@/features/home/lib/types';

type StatusStyle = {
  labelKey:
    | 'home.equipment.functioning'
    | 'home.equipment.needs-attention'
    | 'home.equipment.awaiting-repair'
    | 'home.equipment.unserviceable';
  icon: LucideIcon;
  iconClass: string;
  tone: 'success' | 'warning' | 'destructive';
};

/** Status colours carry good-to-critical meaning, so each also has its own icon and label. */
const STATUS_STYLE: Record<EquipmentStatus, StatusStyle> = {
  FUNCTIONING: {
    labelKey: 'home.equipment.functioning',
    icon: CircleCheckIcon,
    iconClass: 'text-success',
    tone: 'success',
  },
  NEEDS_ATTENTION: {
    labelKey: 'home.equipment.needs-attention',
    icon: TriangleAlertIcon,
    iconClass: 'text-warning',
    tone: 'warning',
  },
  AWAITING_REPAIR: {
    labelKey: 'home.equipment.awaiting-repair',
    icon: WrenchIcon,
    iconClass: 'text-warning',
    tone: 'warning',
  },
  UNSERVICEABLE: {
    labelKey: 'home.equipment.unserviceable',
    icon: CircleXIcon,
    iconClass: 'text-destructive',
    tone: 'destructive',
  },
};

const totalCount = (counts: Record<EquipmentStatus, number>) => sum(Object.values(counts));

/** How much cold chain equipment works, needs work or is out of service. */
export function EquipmentStatusCard() {
  const { t } = useTranslation();
  return (
    <DashboardCard
      badge={<CountBadge query={equipmentStatusCountsOptions()} select={totalCount} />}
      description={t('home.equipment.description')}
      name="equipment"
      pending={PENDING.equipment}
      title={t('home.equipment.title')}
    >
      <EquipmentRows />
    </DashboardCard>
  );
}

function EquipmentRows() {
  const { t } = useTranslation();
  const format = useFormatNumber();
  const { data } = useSuspenseQuery(equipmentStatusCountsOptions());
  const total = sum(Object.values(data));

  return (
    <ul className="flex flex-col gap-3">
      {EQUIPMENT_STATUSES.map((status) => {
        const { labelKey, icon: Icon, iconClass, tone } = STATUS_STYLE[status];
        const label = t(labelKey);
        return (
          <li className="flex flex-col gap-1.5" key={status}>
            <div className="flex items-center gap-2 text-sm">
              <Icon aria-hidden="true" className={`size-4 shrink-0 ${iconClass}`} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="font-medium tabular-nums">{format(data[status])}</span>
            </div>
            <Progress
              aria-label={label}
              tone={tone}
              value={total === 0 ? 0 : (data[status] / total) * 100}
            />
          </li>
        );
      })}
    </ul>
  );
}
