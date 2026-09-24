import { LayoutDashboardIcon } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/query-boundary';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  approvalsOptions,
  convertCountOptions,
  equipmentStatusCountsOptions,
  openOrdersCountOptions,
} from '@/features/home/api/queries';
import { ApprovalsTable } from '@/features/home/components/approvals-table';
import { DashboardRow } from '@/features/home/components/dashboard-parts';
import { CardSkeleton, PENDING } from '@/features/home/components/dashboard-skeleton';
import { EquipmentStatusCard } from '@/features/home/components/equipment-status';
import { Stat, StatStrip } from '@/features/home/components/stat-strip';
import { SystemNotifications } from '@/features/home/components/system-notifications';
import type { DashboardAccess } from '@/features/home/lib/types';

// The charts bring Recharts, so they load apart from the page, and only for users who see them.
const loadPeriods = () => import('@/features/home/components/requisitions-by-period');
const loadStatuses = () => import('@/features/home/components/requisition-status-meter');
const RequisitionsByPeriod = lazy(() =>
  loadPeriods().then((module) => ({ default: module.RequisitionsByPeriod })),
);
const RequisitionStatusMeter = lazy(() =>
  loadStatuses().then((module) => ({ default: module.RequisitionStatusMeter })),
);

/** Starts fetching the chart code, e.g. from a loader while the data loads. */
export function preloadCharts() {
  void loadPeriods();
  void loadStatuses();
}

/** The home page body: only the parts the user's rights allow, laid out by the room the page has. */
export function HomeDashboard({ access }: { access: DashboardAccess }) {
  const { t } = useTranslation();
  const stats = [
    access.approve && (
      <Stat
        key="approve"
        label={t('home.stats.approve')}
        query={approvalsOptions()}
        select={(approvals) => approvals.total}
      />
    ),
    access.convert && (
      <Stat key="convert" label={t('home.stats.convert')} query={convertCountOptions()} />
    ),
    access.orders && (
      <Stat key="orders" label={t('home.stats.orders')} query={openOrdersCountOptions()} />
    ),
    access.equipment && (
      <Stat
        key="equipment"
        label={t('home.stats.equipment')}
        query={equipmentStatusCountsOptions()}
        select={(counts) => counts.AWAITING_REPAIR + counts.UNSERVICEABLE}
      />
    ),
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <QueryBoundary errorComponent={() => null} pendingFallback={null} resetKey="notifications">
        <SystemNotifications />
      </QueryBoundary>

      {!Object.values(access).some(Boolean) && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutDashboardIcon />
            </EmptyMedia>
            <EmptyTitle>{t('home.empty-title')}</EmptyTitle>
            <EmptyDescription>{t('home.empty-description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {stats.length > 0 && <StatStrip>{stats}</StatStrip>}

      {access.requisitions && (
        <DashboardRow
          narrow={
            <Suspense
              fallback={
                <CardSkeleton pending={PENDING.statuses} title={t('home.statuses.title')} />
              }
            >
              <RequisitionStatusMeter />
            </Suspense>
          }
          wide={
            <Suspense
              fallback={<CardSkeleton pending={PENDING.periods} title={t('home.periods.title')} />}
            >
              <RequisitionsByPeriod />
            </Suspense>
          }
        />
      )}

      {(access.approve || access.equipment) && (
        <DashboardRow
          narrow={access.equipment && <EquipmentStatusCard />}
          wide={access.approve && <ApprovalsTable />}
        />
      )}
    </div>
  );
}
