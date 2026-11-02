import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { equipmentStatusCountsOptions } from '@/features/home/api/queries';
import {
  CountBadge,
  DashboardCard,
  useFormatNumber,
} from '@/features/home/components/dashboard-parts';
import { PENDING } from '@/features/home/components/dashboard-skeleton';
import { sum } from '@/features/home/lib/sum';
import {
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUSES,
  type EquipmentStatus,
} from '@/lib/cce-equipment-status';

const ICON_CLASS = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
} as const;

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
        const { labelKey, icon: Icon, tone } = EQUIPMENT_STATUS[status];
        const iconClass = ICON_CLASS[tone];
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
