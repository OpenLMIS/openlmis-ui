import { useSuspenseQuery } from '@tanstack/react-query';
import {
  CircleCheckIcon,
  CircleXIcon,
  type LucideIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/query-boundary';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EQUIPMENT_STATUSES } from '@/features/home/api/api';
import { equipmentStatusCountsOptions } from '@/features/home/api/queries';
import {
  CountBadge,
  CountedTitle,
  useFormatNumber,
  WidgetError,
} from '@/features/home/components/dashboard-parts';
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

/** How much cold chain equipment works, needs work or is out of service. */
export function EquipmentStatusCard() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CountedTitle title={t('home.equipment.title')}>
          <EquipmentTotal />
        </CountedTitle>
        <CardDescription>{t('home.equipment.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          errorComponent={({ reset }) => <WidgetError onRetry={reset} />}
          pendingFallback={
            <div className="h-40 w-full">
              <Skeleton fill />
            </div>
          }
          resetKey="equipment"
        >
          <EquipmentRows />
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function EquipmentTotal() {
  const { data } = useSuspenseQuery(equipmentStatusCountsOptions());
  return <CountBadge count={EQUIPMENT_STATUSES.reduce((sum, status) => sum + data[status], 0)} />;
}

function EquipmentRows() {
  const { t } = useTranslation();
  const format = useFormatNumber();
  const { data } = useSuspenseQuery(equipmentStatusCountsOptions());
  const total = EQUIPMENT_STATUSES.reduce((sum, status) => sum + data[status], 0);

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
